<script lang="ts">
	import FileUp from '@lucide/svelte/icons/file-up';
	import { onMount } from 'svelte';
	import { zoomAt } from '$lib/domain/camera';
	import { paperBounds } from '$lib/domain/layout';
	import { requestLocalWorkspaceReset } from '$lib/ui/resetLocalWorkspace';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import ArtifactItem from './ArtifactItem.svelte';
	import PaperItem from './PaperItem.svelte';

	interface Props {
		workspace: Workspace;
		onrequestimport: () => void;
	}

	let { workspace, onrequestimport }: Props = $props();
	let root = $state<HTMLElement | null>(null);
	let dragOver = $state(false);
	let pan = $state<{
		pointerId: number;
		clientX: number;
		clientY: number;
		centerX: number;
		centerY: number;
	} | null>(null);

	const transform = $derived(
		`translate(${workspace.viewport.width / 2}px, ${workspace.viewport.height / 2}px) ` +
			`scale(${workspace.camera.zoom}) ` +
			`translate(${-workspace.camera.centerX}px, ${-workspace.camera.centerY}px)`
	);
	const inverseZoom = $derived(1 / workspace.camera.zoom);
	const paperPages = $derived(
		workspace.papers
			.flatMap((paper) => paper.pages.map((page) => ({ paper, page })))
			.sort((a, b) => a.page.zIndex - b.page.zIndex)
	);
	const paperGroups = $derived(
		workspace.papers
			.map((paper) => ({ paper, bounds: paperBounds(paper) }))
			.filter((entry) => entry.bounds !== null)
	);

	onMount(() => {
		if (!root) return;
		let focusFrame = 0;
		const observer = new ResizeObserver(([entry]) => {
			if (!entry) return;
			workspace.setViewport(entry.contentRect.width, entry.contentRect.height);
			if (workspace.focusedPaperRegion) {
				cancelAnimationFrame(focusFrame);
				focusFrame = requestAnimationFrame(() => {
					workspace.refitFocusedRegion();
				});
			}
		});
		observer.observe(root);
		return () => {
			cancelAnimationFrame(focusFrame);
			observer.disconnect();
		};
	});

	function onPointerDown(event: PointerEvent): void {
		if (event.button !== 0 && event.button !== 1) return;
		workspace.cancelCameraFlight();
		workspace.clearSelection();
		root?.setPointerCapture(event.pointerId);
		pan = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			centerX: workspace.camera.centerX,
			centerY: workspace.camera.centerY
		};
	}

	function onPointerMove(event: PointerEvent): void {
		if (!pan || pan.pointerId !== event.pointerId) return;
		workspace.updateCamera({
			zoom: workspace.camera.zoom,
			centerX: pan.centerX - (event.clientX - pan.clientX) / workspace.camera.zoom,
			centerY: pan.centerY - (event.clientY - pan.clientY) / workspace.camera.zoom
		});
	}

	function finishPointer(event: PointerEvent): void {
		if (!pan || pan.pointerId !== event.pointerId) return;
		pan = null;
		workspace.commitCamera();
	}

	function onWheel(event: WheelEvent): void {
		event.preventDefault();
		if (!root) return;
		const rect = root.getBoundingClientRect();
		if (event.ctrlKey || event.metaKey) {
			workspace.updateCamera(
				zoomAt(
					workspace.camera,
					workspace.viewport,
					{ x: event.clientX - rect.left, y: event.clientY - rect.top },
					workspace.camera.zoom * Math.exp(-event.deltaY * 0.0025)
				)
			);
		} else {
			workspace.updateCamera({
				...workspace.camera,
				centerX: workspace.camera.centerX + event.deltaX / workspace.camera.zoom,
				centerY: workspace.camera.centerY + event.deltaY / workspace.camera.zoom
			});
		}
		workspace.commitCamera();
	}

	function onKeydown(event: KeyboardEvent): void {
		if (event.key === 'Escape') workspace.clearSelection();
		if ((event.metaKey || event.ctrlKey) && event.key === '0') {
			event.preventDefault();
			workspace.updateCamera({ ...workspace.camera, zoom: 1 }, true, true);
		}
		if (!event.metaKey && !event.ctrlKey && event.shiftKey && event.code === 'Digit1') {
			event.preventDefault();
			workspace.fitAll();
		}
		if (event.key === '+' || event.key === '=') {
			event.preventDefault();
			workspace.updateCamera(
				{ ...workspace.camera, zoom: Math.min(4, workspace.camera.zoom * 1.2) },
				true,
				true
			);
		}
		if (event.key === '-') {
			event.preventDefault();
			workspace.updateCamera(
				{ ...workspace.camera, zoom: Math.max(0.12, workspace.camera.zoom / 1.2) },
				true,
				true
			);
		}
	}

	function onDragOver(event: DragEvent): void {
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
		dragOver = true;
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		dragOver = false;
		if (workspace.storageLocked) {
			workspace.showToast('Resolve local storage before importing.', 'danger');
			return;
		}
		const files = [...(event.dataTransfer?.files ?? [])].filter(
			(file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
		);
		if (files.length === 0) {
			workspace.showToast('Drop one or more PDF files.', 'danger');
			return;
		}
		void workspace.importFiles(files);
	}

	async function resetWorkspace(): Promise<void> {
		await requestLocalWorkspaceReset(workspace);
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<main
	class="desk"
	class:panning={pan !== null}
	class:drag-over={dragOver}
	class:frames-open={workspace.framesOpen}
	bind:this={root}
	aria-label="Spatial paper desk"
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={finishPointer}
	onpointercancel={finishPointer}
	onwheel={onWheel}
	ondragover={onDragOver}
	ondragleave={(event) => {
		if (event.currentTarget === event.target) dragOver = false;
	}}
	ondrop={onDrop}
>
	<div
		class="world"
		class:layout-moving={workspace.pageLayoutAnimating}
		style:transform
		style:--zoom={workspace.camera.zoom}
	>
		{#each paperGroups as group (group.paper.id)}
			<div
				class="paper-group-label"
				style:left="{group.bounds!.x}px"
				style:top="{group.bounds!.y - 40 / workspace.camera.zoom}px"
				style:transform="scale({inverseZoom})"
			>
				<strong>{group.paper.title}</strong>
				<span>{group.paper.pageCount} pages</span>
			</div>
		{/each}
		{#each workspace.sequencePageOrigins as origin (`${origin.paperId}:${origin.page}`)}
			<div
				class="source-slot"
				style:left="{origin.x}px"
				style:top="{origin.y}px"
				style:width="{origin.width}px"
				style:height="{origin.height}px"
				style:z-index={Math.max(0, origin.zIndex - 1)}
				aria-label="Original position of page {origin.page}"
			>
				<span style:transform="scale({inverseZoom})">p. {origin.page}</span>
			</div>
		{/each}
		{#each paperPages as entry (`${entry.paper.id}:${entry.page.pageNumber}`)}
			<PaperItem {workspace} paper={entry.paper} page={entry.page} zoom={workspace.camera.zoom} />
		{/each}
		{#each [...workspace.artifacts].sort((a, b) => a.zIndex - b.zIndex) as artifact (artifact.id)}
			<ArtifactItem {workspace} {artifact} zoom={workspace.camera.zoom} />
		{/each}
	</div>

	{#if workspace.storageLocked}
		<section class="empty recovery" aria-labelledby="recovery-title">
			<div class="empty-paper" aria-hidden="true">
				<div class="paper-lines"><span></span><span></span><span></span><span></span></div>
			</div>
			<div class="empty-copy">
				<h1 id="recovery-title">Local storage needs attention.</h1>
				<p>{workspace.error} Resetting clears all browser-local PaperSpace data on this device.</p>
				<button class="import-button danger" type="button" onclick={resetWorkspace}
					>Reset local data</button
				>
			</div>
		</section>
	{:else if workspace.ready && workspace.papers.length === 0 && workspace.artifacts.length === 0}
		<section class="empty" aria-labelledby="empty-title">
			<div class="empty-paper" aria-hidden="true">
				<div class="paper-lines"><span></span><span></span><span></span><span></span></div>
			</div>
			<div class="empty-copy">
				<h1 id="empty-title">Make room for a paper.</h1>
				<p>
					Drop PDFs anywhere on the desk, or choose files from this computer. Everything stays in
					this browser.
				</p>
				<button class="import-button" type="button" onclick={onrequestimport}>
					<FileUp size={17} strokeWidth={1.75} aria-hidden="true" />
					Import PDFs
				</button>
				<p class="hint">Pan by dragging the desk. Pinch or use Ctrl + scroll to zoom.</p>
			</div>
		</section>
	{/if}

	{#if dragOver}
		<div class="drop-message" role="status">
			<FileUp size={22} strokeWidth={1.75} aria-hidden="true" />
			<span>Place PDFs on this desk</span>
		</div>
	{/if}
</main>

<style>
	.desk {
		position: absolute;
		inset: var(--ps-statusbar-h) 0 0;
		overflow: hidden;
		background-color: var(--ps-desk);
		background-image: radial-gradient(circle, rgb(76 86 106 / 14%) 0.75px, transparent 0.9px);
		background-size: 24px 24px;
		cursor: grab;
		touch-action: none;
		outline: none;
	}

	.desk.panning {
		cursor: grabbing;
	}

	.world {
		position: absolute;
		inset: 0;
		transform-origin: 0 0;
		pointer-events: none;
		will-change: transform;
	}

	.world :global(.paper),
	.world :global(.artifact) {
		pointer-events: auto;
	}

	.world.layout-moving :global(.paper) {
		transition:
			left 680ms cubic-bezier(0.16, 1, 0.3, 1),
			top 680ms cubic-bezier(0.16, 1, 0.3, 1),
			width 680ms cubic-bezier(0.16, 1, 0.3, 1),
			height 680ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow var(--ps-transition);
	}

	.paper-group-label {
		position: absolute;
		z-index: 2;
		display: flex;
		align-items: baseline;
		gap: 9px;
		max-width: 420px;
		color: var(--ps-text-strong);
		transform-origin: top left;
		white-space: nowrap;
		pointer-events: none;
	}

	.paper-group-label strong {
		overflow: hidden;
		max-width: 330px;
		font-size: 13px;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-overflow: ellipsis;
	}

	.paper-group-label span {
		font-family: var(--ps-mono);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		color: var(--ps-text-muted);
	}

	.source-slot {
		position: absolute;
		box-sizing: border-box;
		border: calc(1px / var(--zoom)) dashed color-mix(in srgb, var(--ps-text-muted) 48%, transparent);
		border-radius: 2px;
		background: color-mix(in srgb, var(--ps-desk-deep) 32%, transparent);
		pointer-events: none;
	}

	.source-slot span {
		position: absolute;
		top: 10px;
		left: 10px;
		padding: 3px 6px;
		border-radius: var(--ps-radius-s);
		background: color-mix(in srgb, var(--ps-desk) 92%, transparent);
		color: var(--ps-text-muted);
		font-family: var(--ps-mono);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		transform-origin: top left;
	}

	@media (prefers-reduced-motion: reduce) {
		.world.layout-moving :global(.paper) {
			transition: none;
		}
	}

	.empty {
		position: absolute;
		left: 50%;
		top: 46%;
		display: grid;
		grid-template-columns: 186px 310px;
		align-items: center;
		gap: 38px;
		width: min(620px, calc(100vw - 48px));
		translate: -50% -50%;
		pointer-events: none;
	}

	.empty-paper {
		position: relative;
		width: 176px;
		aspect-ratio: 0.707;
		border: 1px solid var(--ps-border);
		border-radius: 2px;
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-item);
		rotate: -3deg;
	}

	.empty-paper::after {
		content: '';
		position: absolute;
		inset: 9px -11px -9px 10px;
		z-index: -1;
		border: 1px solid var(--ps-border);
		border-radius: 2px;
		background: color-mix(in srgb, var(--ps-paper) 64%, var(--ps-desk-deep));
		rotate: 5deg;
	}

	.paper-lines {
		position: absolute;
		inset: 17% 13%;
		display: grid;
		align-content: start;
		gap: 10px;
	}

	.paper-lines span {
		height: 7px;
		background: var(--ps-desk-deep);
	}

	.paper-lines span:first-child {
		width: 66%;
		height: 12px;
		margin-bottom: 8px;
	}

	.paper-lines span:nth-child(3) {
		width: 83%;
	}

	.empty-copy {
		pointer-events: auto;
	}

	h1 {
		margin: 0 0 10px;
		font-size: 21px;
		line-height: 1.2;
		font-weight: 700;
		letter-spacing: -0.015em;
		color: var(--ps-text-strong);
	}

	p {
		margin: 0;
		font-size: 13.5px;
		line-height: 1.55;
		color: var(--ps-text-muted);
	}

	.import-button {
		display: inline-flex;
		align-items: center;
		gap: 7px;
		height: 34px;
		margin-top: 18px;
		padding: 0 14px;
		border: 0;
		border-radius: var(--ps-radius-s);
		background: var(--ps-frost-deep);
		color: var(--ps-paper);
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		transition: background-color var(--ps-transition);
	}

	.import-button:hover {
		background: color-mix(in srgb, var(--ps-frost-deep) 86%, var(--ps-text-strong));
	}

	.import-button.danger {
		background: var(--ps-danger);
	}

	.hint {
		margin-top: 12px;
		font-family: var(--ps-mono);
		font-size: 10.5px;
		line-height: 1.45;
	}

	.drop-message {
		position: absolute;
		inset: 18px;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 10px;
		border: 2px dashed var(--ps-frost-deep);
		border-radius: var(--ps-radius-l);
		background: color-mix(in srgb, var(--ps-desk) 86%, transparent);
		color: var(--ps-frost-deep);
		font-size: 14px;
		font-weight: 600;
		pointer-events: none;
		z-index: 100;
	}

	@media (max-width: 640px) {
		.empty {
			grid-template-columns: 1fr;
			justify-items: center;
			gap: 28px;
			text-align: center;
		}

		.empty-paper {
			width: 132px;
		}
	}

	@media (min-width: 721px) {
		.desk.frames-open {
			right: 370px;
		}
	}
</style>
