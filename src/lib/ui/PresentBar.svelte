<script lang="ts">
	import BookmarkPlus from '@lucide/svelte/icons/bookmark-plus';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import X from '@lucide/svelte/icons/x';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
	}

	let { workspace }: Props = $props();

	$effect(() => {
		if (workspace.presentingIndex === null) return;
		const onKeydown = (event: KeyboardEvent) => {
			if (event.key === 'ArrowRight' || event.key === 'PageDown' || event.key === ' ') {
				event.preventDefault();
				workspace.stepPresentation(1);
			}
			if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
				event.preventDefault();
				workspace.stepPresentation(-1);
			}
			if (event.key === 'Escape') workspace.stopPresentation();
		};
		window.addEventListener('keydown', onKeydown);
		return () => window.removeEventListener('keydown', onKeydown);
	});
</script>

{#if workspace.presentingIndex !== null && workspace.presentingFrame}
	<div class="caption" aria-live="polite">
		<strong>{workspace.presentingFrame.name}</strong>
		{#if workspace.presentingFrame.caption}<span>{workspace.presentingFrame.caption}</span>{/if}
	</div>
	<div class="present-bar" aria-label="Presentation controls">
		<IconButton
			icon={ChevronLeft}
			label="Previous frame"
			disabled={workspace.presentingIndex === 0}
			onclick={() => workspace.stepPresentation(-1)}
		/>
		<span class="count"
			>{workspace.presentingIndex + 1} / {workspace.presentationFrames.length}</span
		>
		<IconButton
			icon={ChevronRight}
			label="Next frame"
			disabled={workspace.presentingIndex === workspace.presentationFrames.length - 1}
			onclick={() => workspace.stepPresentation(1)}
		/>
		<span class="divider"></span>
		{#if workspace.hasTemporarySequence}
			<IconButton
				icon={BookmarkPlus}
				label="Keep sequence"
				onclick={() => workspace.keepActiveSequence()}
			/>
		{/if}
		<IconButton icon={X} label="Exit presentation" onclick={() => workspace.stopPresentation()} />
	</div>
{/if}

<style>
	.present-bar {
		position: fixed;
		left: 50%;
		bottom: 16px;
		z-index: 230;
		display: flex;
		align-items: center;
		gap: 3px;
		padding: 5px;
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-l);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
		translate: -50% 0;
	}

	.count {
		min-width: 62px;
		font-family: var(--ps-mono);
		font-size: 11px;
		font-variant-numeric: tabular-nums;
		text-align: center;
		color: var(--ps-text-muted);
	}

	.divider {
		width: 1px;
		height: 20px;
		margin: 0 2px;
		background: var(--ps-border);
	}

	.caption {
		position: fixed;
		left: 50%;
		bottom: 76px;
		z-index: 229;
		max-width: min(720px, calc(100vw - 40px));
		padding: 8px 12px;
		border-radius: var(--ps-radius-s);
		background: var(--ps-caption-surface);
		color: var(--ps-paper);
		font-size: 15px;
		line-height: 1.45;
		text-align: center;
		text-wrap: balance;
		box-shadow: 0 3px 12px var(--ps-caption-shadow);
		translate: -50% 0;
		pointer-events: none;
	}

	.caption strong,
	.caption span {
		display: block;
	}

	.caption strong {
		margin-bottom: 2px;
		font-size: 11px;
		font-weight: 650;
		letter-spacing: 0.01em;
	}
</style>
