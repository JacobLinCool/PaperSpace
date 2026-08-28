<script lang="ts">
	import Focus from '@lucide/svelte/icons/focus';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
	}

	let { workspace }: Props = $props();
	const zoomPercent = $derived(Math.round(workspace.camera.zoom * 100));
</script>

{#if workspace.presentingIndex === null}
	<div class="zoom-dock" aria-label="Zoom controls">
		<IconButton
			icon={Minus}
			label="Zoom out"
			size="sm"
			onclick={() =>
				workspace.updateCamera(
					{ ...workspace.camera, zoom: Math.max(0.12, workspace.camera.zoom / 1.2) },
					true,
					true
				)}
		/>
		<button
			class="zoom-value"
			type="button"
			title="Reset zoom to 100%"
			onclick={() => workspace.updateCamera({ ...workspace.camera, zoom: 1 }, true, true)}
		>
			{zoomPercent}%
		</button>
		<IconButton
			icon={Plus}
			label="Zoom in"
			size="sm"
			onclick={() =>
				workspace.updateCamera(
					{ ...workspace.camera, zoom: Math.min(4, workspace.camera.zoom * 1.2) },
					true,
					true
				)}
		/>
		<span class="divider"></span>
		<IconButton icon={Focus} label="Fit all content" size="sm" onclick={() => workspace.fitAll()} />
	</div>
{/if}

<style>
	.zoom-dock {
		position: fixed;
		right: 16px;
		bottom: 16px;
		z-index: 220;
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 4px;
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-m);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
	}

	.zoom-value {
		width: 48px;
		height: 28px;
		padding: 0;
		border: 0;
		border-radius: var(--ps-radius-s);
		background: transparent;
		color: var(--ps-text-muted);
		font-family: var(--ps-mono);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
		cursor: pointer;
	}

	.zoom-value:hover {
		background: var(--ps-desk-deep);
	}

	.divider {
		width: 1px;
		height: 18px;
		margin: 0 2px;
		background: var(--ps-border);
	}

	@media (max-width: 720px) {
		.zoom-dock {
			bottom: 70px;
		}
	}
</style>
