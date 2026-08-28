<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import Check from '@lucide/svelte/icons/check';
	import Copy from '@lucide/svelte/icons/copy';
	import Trash2 from '@lucide/svelte/icons/trash-2';
	import X from '@lucide/svelte/icons/x';
	import { requestLocalWorkspaceReset } from '$lib/ui/resetLocalWorkspace';
	import { PAPERSPACE_PREPARATION_PROMPT } from '$lib/webmcp/protocol';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
		open: boolean;
		onclose: () => void;
	}

	let { workspace, open, onclose }: Props = $props();
	let promptCopied = $state(false);
	let resetting = $state(false);
	const tools = [
		['inspect_workspace', 'Prepare a reusable compact desk briefing.'],
		['search_papers', 'Find passages progressively with exact coverage.'],
		['read_paper_pages', 'Read a page range or whole indexed paper in one call.'],
		['focus_region', 'Fly the shared view to an exact live page region.'],
		['arrange_papers', 'Reflow paper groups with visual conflict guards.'],
		['snapshot_paper_region', 'Place a guarded source crop for comparison.'],
		['place_plot', 'Place a guarded plot for ordered numeric data.'],
		['place_image', 'Place a guarded, validated raster image.'],
		['present_sequence', 'Deliver substantive paper explanations as grounded semantic views.']
	] as const;

	async function copyPreparationPrompt(): Promise<void> {
		try {
			await navigator.clipboard.writeText(PAPERSPACE_PREPARATION_PROMPT);
			promptCopied = true;
			workspace.showToast('Preparation prompt copied.');
		} catch {
			workspace.showToast('The preparation prompt could not be copied.', 'danger');
		}
	}

	async function resetWorkspace(): Promise<void> {
		if (resetting) return;
		resetting = true;
		const reset = await requestLocalWorkspaceReset(workspace);
		resetting = false;
		if (reset) onclose();
	}
</script>

{#if open}
	<section class="popover" aria-labelledby="webmcp-title">
		<header>
			<div class="heading">
				<Bot size={18} strokeWidth={1.75} aria-hidden="true" />
				<div>
					<h2 id="webmcp-title">WebMCP</h2>
					<p>Browser-native agent tools</p>
				</div>
			</div>
			<IconButton icon={X} label="Close WebMCP details" size="sm" onclick={onclose} />
		</header>

		{#if workspace.webMcpStatus === 'ready'}
			<div class="ready-message">
				<Check size={16} strokeWidth={2} aria-hidden="true" />
				<span>Nine tools are registered on <code>document.modelContext</code>.</span>
			</div>
		{:else if workspace.webMcpStatus === 'checking'}
			<p class="notice">Checking this browser for WebMCP support.</p>
		{:else}
			<p class="notice">
				Open this app in ChatGPT’s in-app browser, or enable WebMCP testing in Chrome 149 or later.
				The desk still works normally without agent tools.
			</p>
		{/if}

		<div class="prepare">
			<div>
				<strong>Prepare once, then ask</strong>
				<p>Give Codex one compact briefing now, then batch later paper reads.</p>
			</div>
			<button type="button" class="copy-prompt" onclick={copyPreparationPrompt}>
				{#if promptCopied}
					<Check size={14} strokeWidth={2} aria-hidden="true" /> Copied
				{:else}
					<Copy size={14} strokeWidth={1.75} aria-hidden="true" /> Copy prompt
				{/if}
			</button>
		</div>

		<ul>
			{#each tools as [name, description] (name)}
				<li>
					<code>{name}</code>
					<span>{description}</span>
				</li>
			{/each}
		</ul>

		<footer class="data-actions">
			<div>
				<strong>Local workspace</strong>
				<p>Remove every paper, visual, index, and saved sequence from this browser.</p>
			</div>
			<button
				type="button"
				class="reset-data"
				aria-label="Reset local data"
				disabled={resetting}
				onclick={resetWorkspace}
			>
				<Trash2 size={14} strokeWidth={1.75} aria-hidden="true" />
				{resetting ? 'Resetting…' : 'Reset data'}
			</button>
		</footer>
	</section>
{/if}

<style>
	.popover {
		position: fixed;
		top: calc(var(--ps-statusbar-h) + 8px);
		right: clamp(12px, 3.334vw, 48px);
		z-index: 240;
		width: min(430px, calc(100vw - 24px));
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-m);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
		overflow: hidden;
		display: flex;
		max-height: calc(100vh - var(--ps-statusbar-h) - 20px);
		flex-direction: column;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 9px 10px 13px;
		border-bottom: 1px solid var(--ps-border);
	}

	.heading {
		display: flex;
		align-items: center;
		gap: 9px;
	}

	h2,
	.heading p {
		margin: 0;
	}

	h2 {
		font-size: 13.5px;
		font-weight: 650;
		color: var(--ps-text-strong);
	}

	.heading p {
		margin-top: 1px;
		font-size: 10.5px;
		color: var(--ps-text-muted);
	}

	.ready-message,
	.notice {
		margin: 0;
		padding: 11px 13px;
		font-size: 11.5px;
		line-height: 1.5;
	}

	.prepare {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 11px 13px;
		border-top: 1px solid var(--ps-border);
		background: var(--ps-paper);
	}

	.prepare strong,
	.prepare p {
		margin: 0;
	}

	.prepare strong {
		display: block;
		font-size: 11.5px;
		font-weight: 650;
		color: var(--ps-text-strong);
	}

	.prepare p {
		margin-top: 2px;
		font-size: 10.5px;
		line-height: 1.4;
		color: var(--ps-text-muted);
	}

	.copy-prompt {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 28px;
		padding: 0 9px;
		border: 1px solid var(--ps-border-strong);
		border-radius: var(--ps-radius-s);
		background: var(--ps-paper);
		color: var(--ps-frost-deep);
		font: inherit;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
	}

	.copy-prompt:hover {
		background: var(--ps-desk-deep);
	}

	.ready-message {
		display: flex;
		align-items: flex-start;
		gap: 7px;
		background: color-mix(in srgb, var(--ps-success) 12%, var(--ps-paper));
		color: color-mix(in srgb, var(--ps-success) 55%, var(--ps-text-strong));
	}

	.notice {
		background: var(--ps-paper-soft);
		color: var(--ps-text-muted);
	}

	code {
		font-family: var(--ps-mono);
		font-size: 10.5px;
	}

	ul {
		min-height: 0;
		max-height: 420px;
		flex: 1 1 auto;
		overflow: auto;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: grid;
		grid-template-columns: minmax(125px, 150px) 1fr;
		gap: 10px;
		padding: 9px 13px;
		border-top: 1px solid var(--ps-border);
	}

	li:first-child {
		border-top: 0;
	}

	li code {
		color: var(--ps-frost-deep);
		overflow-wrap: anywhere;
	}

	li span {
		font-size: 11px;
		line-height: 1.4;
		color: var(--ps-text-muted);
	}

	.data-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 11px 13px;
		border-top: 1px solid var(--ps-border);
		background: var(--ps-paper-soft);
	}

	.data-actions strong,
	.data-actions p {
		margin: 0;
	}

	.data-actions strong {
		display: block;
		font-size: 11.5px;
		font-weight: 650;
		color: var(--ps-text-strong);
	}

	.data-actions p {
		max-width: 245px;
		margin-top: 2px;
		font-size: 10.5px;
		line-height: 1.4;
		color: var(--ps-text-muted);
	}

	.reset-data {
		flex: 0 0 auto;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 28px;
		padding: 0 9px;
		border: 1px solid color-mix(in srgb, var(--ps-danger) 48%, var(--ps-border));
		border-radius: var(--ps-radius-s);
		background: var(--ps-paper);
		color: var(--ps-danger);
		font: inherit;
		font-size: 10.5px;
		font-weight: 600;
		line-height: 1;
		cursor: pointer;
		transition:
			background-color var(--ps-transition),
			border-color var(--ps-transition);
	}

	.reset-data:hover:not(:disabled),
	.reset-data:focus-visible:not(:disabled) {
		border-color: var(--ps-danger);
		background: color-mix(in srgb, var(--ps-danger) 10%, var(--ps-paper));
	}

	.reset-data:disabled {
		opacity: 0.5;
		cursor: default;
	}

	@media (max-width: 460px) {
		.data-actions p {
			display: none;
		}
	}
</style>
