<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import type { RenderTask } from 'pdfjs-dist';
	import type { PaperPageRecord, PaperRecord } from '$lib/domain/types';
	import { isPdfCancellation, loadPdfjs, pdfEngine } from './engine';
	import {
		discardPagePreview,
		pagePreview,
		pdfRasterResidency,
		replacePagePreview
	} from './rasterCache';

	interface Props {
		paper: PaperRecord;
		page: PaperPageRecord;
		zoom: number;
		render: boolean;
		settled: boolean;
		pinned: boolean;
		prewarmZoom: number | null;
	}

	type CanvasSlot = 'front' | 'back';

	const RENDER_SETTLE_MS = 140;

	let { paper, page, zoom, render, settled, pinned, prewarmZoom }: Props = $props();

	let frontCanvas = $state<HTMLCanvasElement | null>(null);
	let backCanvas = $state<HTMLCanvasElement | null>(null);
	let textContainer = $state<HTMLDivElement | null>(null);
	let activeCanvas = $state<CanvasSlot>('front');
	let ready = $state(false);
	let rasterFailure = $state<string | null>(null);
	let textFailure = $state<string | null>(null);
	let textActivated = $state(false);
	let baseWidth = $state(1);
	let highResolutionResident = false;
	let residentSignature: string | null = null;
	let hasSuccessfulRaster = false;
	let destroyed = false;
	let rasterQueue: Promise<void> = Promise.resolve();

	const textScale = $derived(page.width / baseWidth);
	const failure = $derived(rasterFailure ?? textFailure);
	const cacheKey = $derived(`${paper.id}:${page.pageNumber}`);

	function canvasFor(slot: CanvasSlot): HTMLCanvasElement | null {
		return slot === 'front' ? frontCanvas : backCanvas;
	}

	function inactiveSlot(): CanvasSlot {
		return activeCanvas === 'front' ? 'back' : 'front';
	}

	function clearCanvas(canvas: HTMLCanvasElement): void {
		canvas.width = 1;
		canvas.height = 1;
	}

	function rasterZoomBucket(value: number): number {
		return Math.min(4, Math.max(0.5, Math.ceil(value * 2) / 2));
	}

	function paintPreview(canvas: HTMLCanvasElement, preview: ImageBitmap): void {
		canvas.width = preview.width;
		canvas.height = preview.height;
		const context = canvas.getContext('2d', { alpha: false });
		if (!context) throw new Error('Canvas rendering is unavailable.');
		context.drawImage(preview, 0, 0);
	}

	function evictHighResolution(): void {
		highResolutionResident = false;
		residentSignature = null;
		const preview = pagePreview(cacheKey);
		const canvas = canvasFor(activeCanvas);
		if (!preview || !canvas || destroyed) return;
		paintPreview(canvas, preview);
		hasSuccessfulRaster = true;
		ready = true;
	}

	$effect(() => {
		if (render && settled) textActivated = true;
	});

	$effect(() => {
		pdfRasterResidency.setPinned(cacheKey, pinned);
	});

	$effect(() => {
		const container = textContainer;
		const paperId = paper.id;
		const pageNumber = page.pageNumber;
		const shouldActivate = textActivated;
		if (!container || !shouldActivate) return;

		let live = true;
		let textLayer: { cancel(): void } | null = null;
		textFailure = null;

		void (async () => {
			try {
				const [pdfjs, pageProxy] = await Promise.all([
					loadPdfjs(),
					pdfEngine.page(paperId, pageNumber)
				]);
				if (!live) return;
				const viewport = pageProxy.getViewport({ scale: 1 });
				baseWidth = viewport.width;
				container.replaceChildren();
				const layer = new pdfjs.TextLayer({
					textContentSource: pageProxy.streamTextContent({
						includeMarkedContent: true,
						disableNormalization: false
					}),
					container,
					viewport
				});
				textLayer = layer;
				container.style.width = '100%';
				container.style.height = '100%';
				await layer.render();
			} catch (error) {
				if (!live || isPdfCancellation(error)) return;
				textFailure = error instanceof Error ? error.message : 'Page text is unavailable.';
			}
		})();

		return () => {
			live = false;
			textLayer?.cancel();
			container.replaceChildren();
		};
	});

	$effect(() => {
		const paperId = paper.id;
		const pageNumber = page.pageNumber;
		const itemWidth = page.width;
		const requestedPrewarmZoom = prewarmZoom;
		let bucket: number;
		let shouldRender: boolean;
		let interactionSettled: boolean;
		if (requestedPrewarmZoom !== null) {
			bucket = rasterZoomBucket(requestedPrewarmZoom);
			shouldRender = true;
			interactionSettled = true;
		} else {
			bucket = rasterZoomBucket(zoom);
			shouldRender = render;
			interactionSettled = settled;
		}
		const shouldPin = pinned;
		const pixelRatio = Math.max(1, globalThis.devicePixelRatio || 1);
		const signature = `${paperId}:${pageNumber}:${itemWidth.toFixed(2)}:${bucket}:${pixelRatio}`;

		if (!shouldRender || !interactionSettled) return;
		if (hasSuccessfulRaster && !shouldPin) {
			if (highResolutionResident && residentSignature === signature) {
				pdfRasterResidency.touch(cacheKey);
			}
			return;
		}
		if (highResolutionResident && residentSignature === signature) {
			pdfRasterResidency.touch(cacheKey);
			return;
		}

		let live = true;
		let committed = false;
		let renderTask: RenderTask | null = null;
		const timer = setTimeout(() => {
			rasterQueue = rasterQueue
				.catch(() => undefined)
				.then(async () => {
					const targetSlot = inactiveSlot();
					const target = canvasFor(targetSlot);
					if (!target || !live) return;
					try {
						const pageProxy = await pdfEngine.page(paperId, pageNumber);
						if (!live) return;
						const baseViewport = pageProxy.getViewport({ scale: 1 });
						const scale = Math.min(
							4,
							Math.max(0.55, (itemWidth * bucket * pixelRatio) / baseViewport.width)
						);
						const viewport = pageProxy.getViewport({ scale });
						target.width = Math.max(1, Math.floor(viewport.width));
						target.height = Math.max(1, Math.floor(viewport.height));
						const context = target.getContext('2d', { alpha: false });
						if (!context) throw new Error('Canvas rendering is unavailable.');
						const task = pageProxy.render({
							canvas: target,
							canvasContext: context,
							viewport,
							background: '#ffffff'
						});
						renderTask = task;
						await task.promise;
						renderTask = null;
						if (!live) return;

						await replacePagePreview(cacheKey, target);
						if (!live) return;
						const previousSlot = activeCanvas;
						activeCanvas = targetSlot;
						hasSuccessfulRaster = true;
						ready = true;
						rasterFailure = null;
						residentSignature = signature;
						highResolutionResident = true;
						committed = true;
						pdfRasterResidency.retain(
							cacheKey,
							target.width * target.height,
							evictHighResolution,
							shouldPin
						);

						await tick();
						const previous = canvasFor(previousSlot);
						if (live && previous && activeCanvas !== previousSlot) clearCanvas(previous);
					} catch (error) {
						if (!live || isPdfCancellation(error)) return;
						rasterFailure =
							error instanceof Error ? error.message : 'This page could not be rendered.';
					} finally {
						if (!committed && activeCanvas !== targetSlot) clearCanvas(target);
					}
				});
		}, RENDER_SETTLE_MS);

		return () => {
			live = false;
			clearTimeout(timer);
			renderTask?.cancel();
		};
	});

	onDestroy(() => {
		destroyed = true;
		pdfRasterResidency.release(cacheKey, evictHighResolution);
		discardPagePreview(cacheKey);
	});
</script>

<div class="page-surface" class:ready data-pdf-page-surface>
	<div class="skeleton" aria-hidden="true">
		<span></span><span></span><span></span><span></span><span></span><span></span>
	</div>
	<canvas class:active={activeCanvas === 'front'} bind:this={frontCanvas} aria-hidden="true"
	></canvas>
	<canvas class:active={activeCanvas === 'back'} bind:this={backCanvas} aria-hidden="true"></canvas>
	<div
		class="text-layer"
		bind:this={textContainer}
		style:--total-scale-factor={textScale}
		style:--scale-factor={textScale}
	></div>
	{#if failure}
		<p class="failure" role="status">{failure}</p>
	{/if}
</div>

<style>
	.page-surface {
		position: absolute;
		inset: 0;
		overflow: hidden;
		background: var(--ps-paper);
	}

	canvas {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		opacity: 0;
		pointer-events: none;
	}

	.ready canvas.active {
		opacity: 1;
	}

	.skeleton {
		position: absolute;
		inset: 11% 9%;
		display: grid;
		align-content: start;
		gap: 3.5%;
		opacity: 1;
		transition: opacity 160ms ease-out;
	}

	.ready .skeleton {
		opacity: 0;
	}

	.skeleton span {
		display: block;
		height: 2.2%;
		min-height: 4px;
		background: var(--ps-desk-deep);
	}

	.skeleton span:nth-child(1) {
		width: 62%;
		height: 4%;
	}

	.skeleton span:nth-child(3),
	.skeleton span:nth-child(6) {
		width: 81%;
	}

	.failure {
		position: absolute;
		inset: auto 12px 12px;
		margin: 0;
		padding: 8px 10px;
		border-radius: var(--ps-radius-s);
		background: color-mix(in srgb, var(--ps-danger) 12%, var(--ps-paper));
		color: var(--ps-danger);
		font-size: 12px;
		line-height: 1.4;
		z-index: 2;
	}

	.text-layer {
		position: absolute;
		inset: 0;
		pointer-events: none;
		text-align: initial;
		overflow: clip;
		opacity: 1;
		line-height: 1;
		letter-spacing: normal;
		word-spacing: normal;
		text-size-adjust: none;
		forced-color-adjust: none;
		transform-origin: 0 0;
		caret-color: var(--ps-text-strong);
		z-index: 1;
		--min-font-size: 1;
		--text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size));
		--min-font-size-inv: calc(1 / var(--min-font-size));
		--scale-round-x: 1px;
		--scale-round-y: 1px;
	}

	.text-layer :global(span),
	.text-layer :global(br) {
		position: absolute;
		color: transparent;
		white-space: pre;
		cursor: text;
		transform-origin: 0% 0%;
		user-select: text;
		-webkit-user-select: text;
	}

	.text-layer :global(span) {
		pointer-events: auto;
	}

	.text-layer :global(> :not(.markedContent)),
	.text-layer :global(.markedContent span:not(.markedContent)) {
		z-index: 1;
		--font-height: 0;
		font-size: calc(var(--text-scale-factor) * var(--font-height));
		--scale-x: 1;
		--rotate: 0deg;
		transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv));
	}

	.text-layer :global(.markedContent) {
		display: contents;
	}

	.text-layer :global(::selection) {
		background: var(--ps-selection);
	}
</style>
