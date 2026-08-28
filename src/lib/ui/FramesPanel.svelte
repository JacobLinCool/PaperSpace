<script lang="ts">
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import Focus from '@lucide/svelte/icons/focus';
	import Play from '@lucide/svelte/icons/play';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import type { FrameRecord } from '$lib/domain/types';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
	}

	let { workspace }: Props = $props();

	function updateName(frame: FrameRecord, event: Event): void {
		workspace.updateFrame(frame.id, { name: (event.currentTarget as HTMLInputElement).value });
	}

	function updateCaption(frame: FrameRecord, event: Event): void {
		workspace.updateFrame(frame.id, { caption: (event.currentTarget as HTMLInputElement).value });
	}

	function startPresenting(): void {
		try {
			workspace.framesOpen = false;
			workspace.startPresentation();
		} catch (error) {
			workspace.showToast(
				error instanceof Error ? error.message : 'Presentation could not start.',
				'danger'
			);
		}
	}
</script>

{#if workspace.framesOpen}
	<section class="panel" aria-labelledby="frames-title">
		<header>
			<h2 id="frames-title">Frame sequence</h2>
			<IconButton
				icon={X}
				label="Close frames"
				size="sm"
				onclick={() => (workspace.framesOpen = false)}
			/>
		</header>

		<div class="panel-actions">
			<button
				class="primary"
				type="button"
				disabled={workspace.frames.length === 0}
				onclick={startPresenting}
			>
				<Play size={15} strokeWidth={1.75} aria-hidden="true" /> Present saved sequence
			</button>
		</div>

		{#if workspace.frames.length === 0}
			<div class="empty">
				<Play size={22} strokeWidth={1.5} aria-hidden="true" />
				<p>
					Agent-created guided views appear here after you keep them. Each frame targets a paper
					region or visual artifact.
				</p>
			</div>
		{:else}
			<ol class="frames">
				{#each workspace.frames as frame, index (frame.id)}
					<li>
						<div class="frame-number">{index + 1}</div>
						<div class="frame-copy">
							<input
								value={frame.name}
								aria-label="Frame name"
								onblur={(event) => updateName(frame, event)}
							/>
							<input
								class="caption"
								value={frame.caption}
								maxlength="400"
								placeholder="Optional caption"
								aria-label="Frame caption"
								onblur={(event) => updateCaption(frame, event)}
							/>
							<span class="target">{workspace.frameTargetLabel(frame)}</span>
						</div>
						<div class="frame-actions">
							<IconButton
								icon={Focus}
								label="Go to frame"
								size="sm"
								onclick={() => workspace.goToFrame(frame.id)}
							/>
							<IconButton
								icon={ArrowUp}
								label="Move frame up"
								size="sm"
								disabled={index === 0}
								onclick={() => workspace.moveFrame(frame.id, -1)}
							/>
							<IconButton
								icon={ArrowDown}
								label="Move frame down"
								size="sm"
								disabled={index === workspace.frames.length - 1}
								onclick={() => workspace.moveFrame(frame.id, 1)}
							/>
							<IconButton
								icon={Trash2}
								label="Delete frame"
								size="sm"
								variant="danger"
								onclick={() => workspace.removeFrame(frame.id)}
							/>
						</div>
					</li>
				{/each}
			</ol>
		{/if}
	</section>
{/if}

<style>
	.panel {
		position: fixed;
		top: var(--ps-statusbar-h);
		right: 0;
		bottom: 0;
		z-index: 205;
		display: flex;
		flex-direction: column;
		width: min(370px, 100vw);
		border-left: 1px solid var(--ps-border);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 46px;
		padding: 0 9px 0 14px;
		border-bottom: 1px solid var(--ps-border);
	}

	h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 650;
		color: var(--ps-text-strong);
	}

	.panel-actions {
		display: flex;
		gap: 7px;
		padding: 12px 14px;
		border-bottom: 1px solid var(--ps-border);
	}

	.panel-actions button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: 32px;
		padding: 0 11px;
		border-radius: var(--ps-radius-s);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
	}

	.panel-actions .primary {
		border: 0;
		background: var(--ps-frost-deep);
		color: var(--ps-paper);
	}

	.panel-actions button:disabled {
		opacity: 0.42;
		cursor: default;
	}

	.empty {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 10px;
		min-height: 210px;
		padding: 28px;
		color: var(--ps-text-muted);
		text-align: center;
	}

	.empty p {
		max-width: 30ch;
		margin: 0;
		font-size: 12.5px;
		line-height: 1.55;
	}

	.frames {
		overflow: auto;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.frames li {
		display: grid;
		grid-template-columns: 26px minmax(0, 1fr);
		gap: 7px;
		padding: 11px 12px;
		border-bottom: 1px solid var(--ps-border);
	}

	.frame-number {
		display: grid;
		place-items: center;
		align-self: start;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--ps-desk-deep);
		font-family: var(--ps-mono);
		font-size: 10px;
		font-weight: 600;
		color: var(--ps-text-muted);
	}

	.frame-copy {
		min-width: 0;
	}

	.frame-copy input {
		width: 100%;
		height: 26px;
		padding: 0 5px;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--ps-text-strong);
		font-size: 12.5px;
		font-weight: 600;
	}

	.frame-copy input:hover,
	.frame-copy input:focus {
		border-color: var(--ps-border);
		background: var(--ps-paper-soft);
	}

	.frame-copy input.caption {
		margin-top: 1px;
		color: var(--ps-text-muted);
		font-size: 11.5px;
		font-weight: 400;
	}

	.frame-copy input::placeholder {
		color: var(--ps-text-muted);
	}

	.target {
		display: block;
		overflow: hidden;
		margin: 3px 5px 0;
		color: var(--ps-text-muted);
		font-family: var(--ps-mono);
		font-size: 9.5px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.frame-actions {
		grid-column: 2;
		display: flex;
		justify-content: flex-end;
		gap: 1px;
		margin-top: 6px;
		opacity: 0;
		transition: opacity var(--ps-transition);
	}

	.frames li:hover .frame-actions,
	.frames li:focus-within .frame-actions {
		opacity: 1;
	}

	@media (hover: none) {
		.frame-actions {
			opacity: 1;
		}
	}
</style>
