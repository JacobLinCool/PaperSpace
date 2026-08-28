<script lang="ts">
	import FileSearch from '@lucide/svelte/icons/file-search';
	import Search from '@lucide/svelte/icons/search';
	import X from '@lucide/svelte/icons/x';
	import type { SearchMatch } from '$lib/domain/types';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
		open: boolean;
		onclose: () => void;
	}

	let { workspace, open, onclose }: Props = $props();
	let query = $state('');
	let results = $state<SearchMatch[]>([]);
	let searched = $state(false);
	let input = $state<HTMLInputElement | null>(null);

	$effect(() => {
		if (open) queueMicrotask(() => input?.focus());
	});

	$effect(() => {
		if (!open) return;
		const closeOnEscape = (event: KeyboardEvent) => {
			if (event.key === 'Escape') onclose();
		};
		window.addEventListener('keydown', closeOnEscape);
		return () => window.removeEventListener('keydown', closeOnEscape);
	});

	function runSearch(): void {
		searched = true;
		results = workspace.search(query, 12);
	}

	function openResult(result: SearchMatch): void {
		workspace.focusRegion(result.paperId, result.page, result.region);
	}
</script>

{#if open}
	<section class="panel" aria-labelledby="search-title">
		<header>
			<div class="heading">
				<Search size={17} strokeWidth={1.75} aria-hidden="true" />
				<h2 id="search-title">Search papers</h2>
			</div>
			<IconButton icon={X} label="Close search" size="sm" onclick={onclose} />
		</header>

		<form
			onsubmit={(event) => {
				event.preventDefault();
				runSearch();
			}}
		>
			<label for="paper-search">Words or an exact phrase</label>
			<div class="search-row">
				<input
					id="paper-search"
					bind:this={input}
					bind:value={query}
					placeholder="e.g. contrastive objective"
					autocomplete="off"
				/>
				<button type="submit" disabled={!query.trim()}>Search</button>
			</div>
		</form>

		<div class="result-area" aria-live="polite">
			{#if workspace.papers.length === 0}
				<div class="quiet-state">
					<FileSearch size={22} strokeWidth={1.5} aria-hidden="true" />
					<p>Import a PDF before searching.</p>
				</div>
			{:else if !searched}
				<p class="guidance">
					Search uses text extracted locally from every page. The same index is available to WebMCP
					agents.
				</p>
			{:else if results.length === 0}
				<div class="quiet-state">
					<FileSearch size={22} strokeWidth={1.5} aria-hidden="true" />
					<p>No indexed page contains “{query.trim()}”.</p>
				</div>
			{:else}
				<ol class="results">
					{#each results as result (result.matchId)}
						<li>
							<button type="button" onclick={() => openResult(result)}>
								<span class="result-meta">
									<strong>{result.title}</strong>
									<span>p.{result.page}</span>
								</span>
								<span class="quote">{result.quote}</span>
							</button>
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	</section>
{/if}

<style>
	.panel {
		position: fixed;
		top: calc(var(--ps-statusbar-h) + 12px);
		right: 12px;
		bottom: 12px;
		z-index: 210;
		display: flex;
		flex-direction: column;
		width: min(390px, calc(100vw - 24px));
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-l);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
		overflow: hidden;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 46px;
		padding: 0 9px 0 14px;
		border-bottom: 1px solid var(--ps-border);
	}

	.heading {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	h2 {
		margin: 0;
		font-size: 14px;
		font-weight: 650;
		color: var(--ps-text-strong);
	}

	form {
		padding: 14px;
		border-bottom: 1px solid var(--ps-border);
	}

	label {
		display: block;
		margin-bottom: 6px;
		font-size: 11.5px;
		font-weight: 600;
		color: var(--ps-text-muted);
	}

	.search-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 7px;
	}

	input {
		min-width: 0;
		height: 36px;
		padding: 0 10px;
		border: 1px solid var(--ps-border-strong);
		border-radius: var(--ps-radius-s);
		background: var(--ps-paper);
		color: var(--ps-text-strong);
		font-size: 13px;
	}

	input::placeholder {
		color: var(--ps-text-muted);
	}

	.search-row > button {
		height: 36px;
		padding: 0 13px;
		border: 0;
		border-radius: var(--ps-radius-s);
		background: var(--ps-frost-deep);
		color: var(--ps-paper);
		font-size: 12.5px;
		font-weight: 600;
		cursor: pointer;
	}

	.search-row > button:disabled {
		opacity: 0.42;
		cursor: default;
	}

	.result-area {
		overflow: auto;
		flex: 1;
	}

	.guidance {
		margin: 0;
		padding: 18px 16px;
		font-size: 12.5px;
		line-height: 1.55;
		color: var(--ps-text-muted);
	}

	.quiet-state {
		display: grid;
		place-items: center;
		align-content: center;
		gap: 10px;
		height: 190px;
		padding: 20px;
		color: var(--ps-text-muted);
		text-align: center;
	}

	.quiet-state p {
		margin: 0;
		font-size: 12.5px;
		line-height: 1.5;
	}

	.results {
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.results li + li {
		border-top: 1px solid var(--ps-border);
	}

	.results button {
		display: block;
		width: 100%;
		padding: 12px 14px;
		border: 0;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background-color var(--ps-transition);
	}

	.results button:hover,
	.results button:focus-visible {
		background: color-mix(in srgb, var(--ps-frost-cyan) 12%, var(--ps-paper));
	}

	.result-meta {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}

	.result-meta strong {
		overflow: hidden;
		font-size: 12.5px;
		font-weight: 650;
		color: var(--ps-text-strong);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.result-meta span {
		font-family: var(--ps-mono);
		font-size: 10.5px;
		font-variant-numeric: tabular-nums;
		color: var(--ps-frost-deep);
	}

	.quote {
		display: -webkit-box;
		overflow: hidden;
		margin-top: 6px;
		font-size: 12px;
		line-height: 1.5;
		color: var(--ps-text-muted);
		-webkit-line-clamp: 3;
		line-clamp: 3;
		-webkit-box-orient: vertical;
	}
</style>
