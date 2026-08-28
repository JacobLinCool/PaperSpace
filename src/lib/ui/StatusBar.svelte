<script lang="ts" module>
	function focusInput(node: HTMLInputElement) {
		node.focus();
		node.select();
	}
</script>

<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import PanelsTopLeft from '@lucide/svelte/icons/panels-top-left';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import BrandMark from './BrandMark.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
		onmcpinfo: () => void;
	}

	let { workspace, onmcpinfo }: Props = $props();
	let editing = $state(false);
	let draft = $state('');

	function startRename(): void {
		draft = workspace.state.name;
		editing = true;
	}

	function finishRename(): void {
		workspace.rename(draft);
		editing = false;
	}

	function renameKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') finishRename();
		if (event.key === 'Escape') editing = false;
	}
</script>

<header class="statusbar">
	<div class="start">
		<div class="brand" aria-label="PaperSpace">
			<BrandMark size={25} />
			<span>PaperSpace</span>
		</div>
		<span class="divider"></span>
		{#if editing}
			<input
				class="desk-name-input"
				aria-label="Desk name"
				bind:value={draft}
				onblur={finishRename}
				onkeydown={renameKeydown}
				use:focusInput
			/>
		{:else}
			<button class="desk-name" type="button" title="Rename desk" onclick={startRename}>
				{workspace.state.name}
			</button>
		{/if}
	</div>

	<div class="center" aria-label="Workspace status">
		{#if workspace.importingCount > 0}
			<span class="status importing">Importing {workspace.importingCount}</span>
		{:else if workspace.error}
			<span class="status error">Local storage needs attention</span>
		{:else}
			<span class="status">
				{workspace.papers.length}
				{workspace.papers.length === 1 ? 'paper' : 'papers'}
				· {workspace.pageCount}
				{workspace.pageCount === 1 ? 'page' : 'pages'}
				{#if workspace.artifacts.length > 0}
					· {workspace.artifacts.length} {workspace.artifacts.length === 1 ? 'visual' : 'visuals'}
				{/if}
			</span>
		{/if}
	</div>

	<div class="end">
		<button
			class="mcp-status {workspace.webMcpStatus}"
			type="button"
			onclick={onmcpinfo}
			aria-label="WebMCP status"
		>
			<span class="dot"></span>
			<Bot size={15} strokeWidth={1.75} aria-hidden="true" />
			<span>{workspace.webMcpStatus === 'ready' ? 'WebMCP ready' : 'WebMCP'}</span>
		</button>
		<IconButton
			icon={PanelsTopLeft}
			label={workspace.framesOpen ? 'Close frame sequence' : 'Open frame sequence'}
			pressed={workspace.framesOpen}
			onclick={() => (workspace.framesOpen = !workspace.framesOpen)}
		/>
	</div>
</header>

<style>
	.statusbar {
		position: fixed;
		inset: 0 0 auto;
		z-index: 200;
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
		align-items: center;
		height: var(--ps-statusbar-h);
		padding: 0 8px 0 10px;
		border-bottom: 1px solid var(--ps-border);
		background: var(--ps-paper);
		box-shadow: 0 1px 2px rgb(46 52 64 / 5%);
	}

	.start,
	.end {
		display: flex;
		align-items: center;
		min-width: 0;
	}

	.start {
		gap: 9px;
	}

	.end {
		justify-content: flex-end;
		gap: 4px;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 8px;
		color: var(--ps-text-strong);
		font-size: 14px;
		font-weight: 700;
		letter-spacing: -0.01em;
		text-decoration: none;
	}

	.divider {
		width: 1px;
		height: 20px;
		background: var(--ps-border);
	}

	.desk-name,
	.desk-name-input {
		min-width: 0;
		max-width: min(340px, 38vw);
		height: 28px;
		border: 1px solid transparent;
		border-radius: var(--ps-radius-s);
		background: transparent;
		color: var(--ps-text);
		font-size: 12.5px;
		font-weight: 600;
	}

	.desk-name {
		overflow: hidden;
		padding: 0 6px;
		text-overflow: ellipsis;
		white-space: nowrap;
		cursor: text;
	}

	.desk-name:hover {
		background: var(--ps-desk);
	}

	.desk-name-input {
		width: 280px;
		padding: 0 7px;
		border-color: var(--ps-border-strong);
		background: var(--ps-paper);
	}

	.center {
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.status {
		font-size: 11px;
		font-weight: 600;
		color: var(--ps-text-muted);
	}

	.status.importing {
		color: var(--ps-frost-deep);
	}

	.status.error {
		color: var(--ps-danger);
	}

	.mcp-status {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 28px;
		padding: 0 8px;
		border: 0;
		border-radius: var(--ps-radius-s);
		background: transparent;
		color: var(--ps-text-muted);
		font-size: 11.5px;
		font-weight: 600;
		cursor: pointer;
		transition: background-color var(--ps-transition);
	}

	.mcp-status:hover {
		background: var(--ps-desk-deep);
	}

	.dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--ps-border-strong);
	}

	.mcp-status.ready .dot {
		background: var(--ps-success);
	}

	.mcp-status.failed .dot {
		background: var(--ps-danger);
	}

	@media (max-width: 720px) {
		.statusbar {
			grid-template-columns: minmax(0, 1fr) auto;
		}

		.center,
		.brand span,
		.mcp-status span:not(.dot) {
			display: none;
		}
	}
</style>
