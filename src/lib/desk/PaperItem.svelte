<script lang="ts">
	import Focus from '@lucide/svelte/icons/focus';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { PaperPageRecord, PaperRecord } from '$lib/domain/types';
	import PdfPage from '$lib/pdf/PdfPage.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import type { Workspace } from '$lib/workspace/workspace.svelte';

	interface Props {
		workspace: Workspace;
		paper: PaperRecord;
		page: PaperPageRecord;
		zoom: number;
	}

	let { workspace, paper, page, zoom }: Props = $props();
	let root = $state<HTMLElement | null>(null);
	let hovered = $state(false);
	let drag = $state<
		| { kind: 'move'; pointerId: number; clientX: number; clientY: number; x: number; y: number }
		| { kind: 'resize'; pointerId: number; clientX: number; width: number }
		| null
	>(null);

	const selected = $derived(workspace.isPageSelected(paper.id, page.pageNumber));
	const controlsVisible = $derived(workspace.presentingIndex === null && (selected || hovered));
	const renderPage = $derived(workspace.shouldRenderPage(paper.id, page.pageNumber));
	const pinPageRaster = $derived(workspace.shouldPinPageRaster(paper.id, page.pageNumber));
	const prewarmZoom = $derived(workspace.rasterPrewarmZoom(paper.id, page.pageNumber));
	const renderSettled = $derived(
		!workspace.cameraAnimating && !workspace.pageLayoutAnimating && drag === null
	);
	const inverseZoom = $derived(1 / zoom);
	const toolbarTop = $derived(-38 / zoom);
	const labelBottom = $derived(-29 / zoom);
	const outlineWidth = $derived(2 / zoom);
	const handleSize = $derived(14 / zoom);

	function isTextGlyph(target: EventTarget | null): boolean {
		return target instanceof Element && target.closest('.text-layer span') !== null;
	}

	function onPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		if (workspace.presentingIndex !== null) return;
		workspace.selectPage(paper.id, page.pageNumber);
		if (event.button !== 0 || isTextGlyph(event.target)) return;
		if (event.target instanceof Element && event.target.closest('[data-control]')) return;
		workspace.bringPageToFront(paper.id, page.pageNumber);
		root?.setPointerCapture(event.pointerId);
		drag = {
			kind: 'move',
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			x: page.x,
			y: page.y
		};
	}

	function onResizeDown(event: PointerEvent): void {
		event.preventDefault();
		event.stopPropagation();
		workspace.selectPage(paper.id, page.pageNumber);
		workspace.bringPageToFront(paper.id, page.pageNumber);
		root?.setPointerCapture(event.pointerId);
		drag = {
			kind: 'resize',
			pointerId: event.pointerId,
			clientX: event.clientX,
			width: page.width
		};
	}

	function onPointerMove(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.kind === 'move') {
			workspace.movePage(
				paper.id,
				page.pageNumber,
				drag.x + (event.clientX - drag.clientX) / zoom,
				drag.y + (event.clientY - drag.clientY) / zoom
			);
			return;
		}
		workspace.resizePage(
			paper.id,
			page.pageNumber,
			drag.width + (event.clientX - drag.clientX) / zoom
		);
	}

	function finishPointer(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.kind === 'move') {
			workspace.movePage(paper.id, page.pageNumber, page.x, page.y, true);
		} else {
			workspace.resizePage(paper.id, page.pageNumber, page.width, true);
		}
		drag = null;
	}

	async function requestRemove(): Promise<void> {
		const hasSourceCrops = workspace.artifacts.some(
			(artifact) => artifact.kind === 'snapshot' && artifact.source.paperId === paper.id
		);
		if (
			!confirm(
				`Remove “${paper.title}” and all ${paper.pageCount} pages from this desk? The local PDF copy will also be deleted.${hasSourceCrops ? ' Its source crops will remain as detached images.' : ''}`
			)
		) {
			return;
		}
		await workspace.removePaper(paper.id);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	class="paper"
	class:selected
	class:moving={drag?.kind === 'move'}
	class:presenting={workspace.presentingIndex !== null}
	bind:this={root}
	style:left="{page.x}px"
	style:top="{page.y}px"
	style:width="{page.width}px"
	style:height="{page.height}px"
	style:z-index={page.zIndex}
	style:--selection-width="{outlineWidth}px"
	aria-label="{paper.title}, page {page.pageNumber} of {paper.pageCount}"
	data-paper-id={paper.id}
	data-page-number={page.pageNumber}
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={finishPointer}
	onpointercancel={finishPointer}
	ondblclick={() => workspace.focusPage(paper.id, page.pageNumber)}
>
	<PdfPage
		{paper}
		{page}
		{zoom}
		render={renderPage}
		settled={renderSettled}
		pinned={pinPageRaster}
		{prewarmZoom}
	/>

	<button
		class="keyboard-select sr-only"
		type="button"
		aria-label="Select {paper.title}, page {page.pageNumber}"
		onfocus={() => workspace.selectPage(paper.id, page.pageNumber)}
		onclick={() => workspace.focusPage(paper.id, page.pageNumber)}
	>
		Select {paper.title}, page {page.pageNumber}
	</button>

	<span class="page-number" style:transform="scale({inverseZoom})">{page.pageNumber}</span>

	{#if controlsVisible}
		<div
			class="paper-toolbar"
			data-control
			style:top="{toolbarTop}px"
			style:transform="scale({inverseZoom})"
		>
			<span class="page-count">Page {page.pageNumber} / {paper.pageCount}</span>
			<span class="divider"></span>
			<IconButton
				icon={Focus}
				label="Focus page {page.pageNumber}"
				size="sm"
				onclick={() => workspace.focusPage(paper.id, page.pageNumber)}
			/>
			<IconButton
				icon={Trash2}
				label="Remove paper"
				size="sm"
				variant="danger"
				onclick={requestRemove}
			/>
		</div>
	{/if}

	{#if hovered || selected}
		<div
			class="paper-label"
			data-control
			style:bottom="{labelBottom}px"
			style:transform="scale({inverseZoom})"
		>
			<span class="title" title={paper.title}>{paper.title}</span>
			<span class="index" class:failed={paper.indexStatus === 'failed'}>
				{#if paper.indexStatus === 'ready'}
					Text ready
				{:else if paper.indexStatus === 'failed'}
					Index failed
				{:else}
					Indexing {paper.indexedPages}/{paper.pageCount}
				{/if}
			</span>
		</div>
	{/if}

	{#if selected && workspace.presentingIndex === null}
		<button
			class="resize-handle"
			data-control
			aria-label="Resize page {page.pageNumber}"
			style:width="{handleSize}px"
			style:height="{handleSize}px"
			onpointerdown={onResizeDown}
		></button>
	{/if}
</article>

<style>
	.paper {
		position: absolute;
		border: 1px solid var(--ps-border);
		border-radius: 2px;
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-item);
		cursor: grab;
		user-select: none;
		transition:
			box-shadow var(--ps-transition),
			outline-color var(--ps-transition);
	}

	.paper.selected:not(.presenting) {
		outline: var(--selection-width) solid var(--ps-frost-deep);
		outline-offset: calc(-1 * var(--selection-width));
		box-shadow: var(--ps-shadow-item-active);
	}

	.paper.moving {
		cursor: grabbing;
	}

	.paper.presenting {
		cursor: default;
	}

	.page-number {
		position: absolute;
		top: 8px;
		left: 8px;
		z-index: 4;
		display: grid;
		place-items: center;
		min-width: 22px;
		height: 20px;
		padding: 0 5px;
		border: 1px solid rgb(216 222 233 / 84%);
		border-radius: var(--ps-radius-s);
		background: rgb(255 255 255 / 88%);
		color: var(--ps-text-muted);
		font-family: var(--ps-mono);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		transform-origin: top left;
		pointer-events: none;
	}

	.paper-toolbar,
	.paper-label {
		position: absolute;
		display: flex;
		align-items: center;
		border: 1px solid var(--ps-border);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
		white-space: nowrap;
		z-index: 10;
		user-select: none;
	}

	.paper-toolbar {
		right: 0;
		gap: 2px;
		padding: 3px;
		border-radius: var(--ps-radius-m);
		transform-origin: top right;
	}

	.page-count {
		padding: 0 6px;
		font-family: var(--ps-mono);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
		color: var(--ps-text-muted);
	}

	.divider {
		width: 1px;
		height: 18px;
		margin: 0 2px;
		background: var(--ps-border);
	}

	.paper-label {
		left: 0;
		max-width: min(360px, 90vw);
		height: 24px;
		padding: 0 8px;
		border-radius: var(--ps-radius-s);
		transform-origin: bottom left;
	}

	.title {
		overflow: hidden;
		min-width: 0;
		max-width: 230px;
		text-overflow: ellipsis;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--ps-text-strong);
	}

	.index {
		margin-left: 8px;
		padding-left: 8px;
		border-left: 1px solid var(--ps-border);
		font-size: 10px;
		color: var(--ps-text-muted);
	}

	.index.failed {
		color: var(--ps-danger);
	}

	.resize-handle {
		position: absolute;
		right: calc(-7px / var(--zoom, 1));
		bottom: calc(-7px / var(--zoom, 1));
		z-index: 12;
		padding: 0;
		border: calc(2px / var(--zoom, 1)) solid var(--ps-paper);
		border-radius: 50%;
		background: var(--ps-frost-deep);
		box-shadow: 0 1px 4px rgb(46 52 64 / 18%);
		cursor: nwse-resize;
	}
</style>
