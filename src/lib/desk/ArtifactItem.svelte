<script lang="ts">
	import Focus from '@lucide/svelte/icons/focus';
	import LocateFixed from '@lucide/svelte/icons/locate-fixed';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import type { ArtifactRecord } from '$lib/domain/types';
	import IconButton from '$lib/ui/IconButton.svelte';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import PlotGraphic from './PlotGraphic.svelte';

	interface Props {
		workspace: Workspace;
		artifact: ArtifactRecord;
		zoom: number;
	}

	let { workspace, artifact, zoom }: Props = $props();
	let root = $state<HTMLElement | null>(null);
	let imageUrl = $state<string | null>(null);
	let hovered = $state(false);
	let drag = $state<
		| { kind: 'move'; pointerId: number; clientX: number; clientY: number; x: number; y: number }
		| { kind: 'resize'; pointerId: number; clientX: number; width: number }
		| null
	>(null);

	const selected = $derived(workspace.selectedArtifactId === artifact.id);
	const inverseZoom = $derived(1 / zoom);
	const controlsVisible = $derived(workspace.presentingIndex === null && (selected || hovered));
	const toolbarTop = $derived(-38 / zoom);
	const labelBottom = $derived(-30 / zoom);
	const outlineWidth = $derived(2 / zoom);
	const handleSize = $derived(14 / zoom);
	const kindLabel = $derived(
		artifact.kind === 'snapshot'
			? 'Source crop'
			: artifact.kind === 'plot'
				? 'Derived plot'
				: 'Image'
	);

	$effect(() => {
		const id = artifact.id;
		if (artifact.kind === 'plot') {
			imageUrl = null;
			return;
		}
		let live = true;
		let url: string | null = null;
		void workspace
			.artifactImage(id)
			.then((blob) => {
				if (!live) return;
				url = URL.createObjectURL(blob);
				imageUrl = url;
			})
			.catch((error) =>
				workspace.showToast(
					error instanceof Error ? error.message : 'Image loading failed.',
					'danger'
				)
			);
		return () => {
			live = false;
			if (url) URL.revokeObjectURL(url);
		};
	});

	function onPointerDown(event: PointerEvent): void {
		event.stopPropagation();
		if (workspace.presentingIndex !== null) return;
		workspace.selectArtifact(artifact.id);
		if (event.button !== 0) return;
		if (event.target instanceof Element && event.target.closest('[data-control]')) return;
		workspace.bringArtifactToFront(artifact.id);
		root?.setPointerCapture(event.pointerId);
		drag = {
			kind: 'move',
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			x: artifact.x,
			y: artifact.y
		};
	}

	function onResizeDown(event: PointerEvent): void {
		event.preventDefault();
		event.stopPropagation();
		workspace.selectArtifact(artifact.id);
		workspace.bringArtifactToFront(artifact.id);
		root?.setPointerCapture(event.pointerId);
		drag = {
			kind: 'resize',
			pointerId: event.pointerId,
			clientX: event.clientX,
			width: artifact.width
		};
	}

	function onPointerMove(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.kind === 'move') {
			workspace.moveArtifact(
				artifact.id,
				drag.x + (event.clientX - drag.clientX) / zoom,
				drag.y + (event.clientY - drag.clientY) / zoom
			);
		} else {
			workspace.resizeArtifact(artifact.id, drag.width + (event.clientX - drag.clientX) / zoom);
		}
	}

	function finishPointer(event: PointerEvent): void {
		if (!drag || drag.pointerId !== event.pointerId) return;
		if (drag.kind === 'move') workspace.moveArtifact(artifact.id, artifact.x, artifact.y, true);
		else workspace.resizeArtifact(artifact.id, artifact.width, true);
		drag = null;
	}

	async function requestRemove(): Promise<void> {
		if (!confirm(`Remove “${artifact.title}” from this desk?`)) return;
		await workspace.removeArtifact(artifact.id);
	}
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<article
	class="artifact"
	class:selected
	class:presenting={workspace.presentingIndex !== null}
	class:moving={drag?.kind === 'move'}
	bind:this={root}
	style:left="{artifact.x}px"
	style:top="{artifact.y}px"
	style:width="{artifact.width}px"
	style:height="{artifact.height}px"
	style:z-index={artifact.zIndex}
	style:--selection-width="{outlineWidth}px"
	aria-label="{kindLabel}: {artifact.title}"
	onpointerenter={() => (hovered = true)}
	onpointerleave={() => (hovered = false)}
	onpointerdown={onPointerDown}
	onpointermove={onPointerMove}
	onpointerup={finishPointer}
	onpointercancel={finishPointer}
	ondblclick={() => workspace.focusArtifact(artifact.id)}
>
	{#if artifact.kind === 'plot'}
		<PlotGraphic {artifact} />
	{:else if imageUrl}
		<img src={imageUrl} alt={artifact.title} draggable="false" />
	{:else}
		<div class="image-loading" role="status">Loading image</div>
	{/if}

	{#if controlsVisible}
		<div
			class="artifact-toolbar"
			data-control
			style:top="{toolbarTop}px"
			style:transform="scale({inverseZoom})"
		>
			{#if artifact.kind === 'snapshot'}
				<IconButton
					icon={LocateFixed}
					label="Show source region"
					size="sm"
					onclick={() =>
						workspace.focusRegion(
							artifact.source.paperId,
							artifact.source.page,
							artifact.source.region
						)}
				/>
			{/if}
			<IconButton
				icon={Focus}
				label="Focus visual"
				size="sm"
				onclick={() => workspace.focusArtifact(artifact.id)}
			/>
			<IconButton
				icon={Trash2}
				label="Remove visual"
				size="sm"
				variant="danger"
				onclick={requestRemove}
			/>
		</div>
	{/if}

	{#if workspace.presentingIndex === null}
		<div
			class="artifact-label"
			data-control
			style:bottom="{labelBottom}px"
			style:transform="scale({inverseZoom})"
		>
			<span class="title" title={artifact.title}>{artifact.title}</span>
			<span class="kind">{kindLabel}</span>
		</div>
	{/if}

	{#if selected && workspace.presentingIndex === null}
		<button
			class="resize-handle"
			data-control
			aria-label="Resize visual"
			style:width="{handleSize}px"
			style:height="{handleSize}px"
			onpointerdown={onResizeDown}
		></button>
	{/if}
</article>

<style>
	.artifact {
		position: absolute;
		overflow: visible;
		border: 1px solid var(--ps-border);
		border-radius: 2px;
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-item);
		cursor: grab;
		user-select: none;
	}

	.artifact.selected:not(.presenting) {
		outline: var(--selection-width) solid var(--ps-frost-deep);
		outline-offset: calc(-1 * var(--selection-width));
		box-shadow: var(--ps-shadow-item-active);
	}

	.artifact.moving {
		cursor: grabbing;
	}

	.artifact.presenting {
		cursor: default;
	}

	img,
	:global(.artifact > svg) {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: contain;
		background: var(--ps-paper);
	}

	.image-loading {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		background: var(--ps-paper-soft);
		color: var(--ps-text-muted);
		font-size: 12px;
	}

	.artifact-toolbar {
		position: absolute;
		right: 0;
		z-index: 10;
		display: flex;
		gap: 2px;
		padding: 3px;
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-m);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
		transform-origin: top right;
	}

	.artifact-label {
		position: absolute;
		left: 0;
		z-index: 8;
		display: flex;
		align-items: center;
		max-width: min(390px, 90vw);
		height: 24px;
		padding: 0 8px;
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-s);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-item);
		transform-origin: bottom left;
		white-space: nowrap;
	}

	.title {
		overflow: hidden;
		max-width: 250px;
		color: var(--ps-text-strong);
		font-size: 11.5px;
		font-weight: 600;
		text-overflow: ellipsis;
	}

	.kind {
		margin-left: 8px;
		padding-left: 8px;
		border-left: 1px solid var(--ps-border);
		color: var(--ps-text-muted);
		font-size: 10px;
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
