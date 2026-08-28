<script lang="ts">
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import FileUp from '@lucide/svelte/icons/file-up';
	import Grid2X2 from '@lucide/svelte/icons/grid-2-x-2';
	import Rows3 from '@lucide/svelte/icons/rows-3';
	import Search from '@lucide/svelte/icons/search';
	import type { Arrangement } from '$lib/domain/types';
	import type { Workspace } from '$lib/workspace/workspace.svelte';
	import IconButton from './IconButton.svelte';

	interface Props {
		workspace: Workspace;
		searchOpen: boolean;
		onrequestimport: () => void;
		ontogglesearch: () => void;
	}

	let { workspace, searchOpen, onrequestimport, ontogglesearch }: Props = $props();
	let arrangeOpen = $state(false);

	function arrange(mode: Arrangement): void {
		arrangeOpen = false;
		workspace.arrange(mode, undefined, 'person', true);
	}
</script>

{#if workspace.presentingIndex === null}
	<nav class="toolbar" aria-label="Desk tools">
		<IconButton
			icon={FileUp}
			label="Import PDFs"
			disabled={workspace.storageLocked}
			onclick={onrequestimport}
		/>
		<IconButton icon={Search} label="Search papers" pressed={searchOpen} onclick={ontogglesearch} />
		<span class="divider"></span>
		<div class="arrange-wrap">
			<IconButton
				icon={Grid2X2}
				label="Arrange papers"
				pressed={arrangeOpen}
				disabled={workspace.papers.length === 0}
				onclick={() => (arrangeOpen = !arrangeOpen)}
			/>
			{#if arrangeOpen}
				<div class="arrange-menu" role="menu" aria-label="Arrange papers">
					<button type="button" role="menuitem" onclick={() => arrange('grid')}>
						<Grid2X2 size={16} strokeWidth={1.75} aria-hidden="true" /> Grid
					</button>
					<button type="button" role="menuitem" onclick={() => arrange('row')}>
						<Rows3 size={16} strokeWidth={1.75} aria-hidden="true" /> Reading row
					</button>
					<button type="button" role="menuitem" onclick={() => arrange('columns')}>
						<Columns3 size={16} strokeWidth={1.75} aria-hidden="true" /> Columns
					</button>
				</div>
			{/if}
		</div>
	</nav>
{/if}

<style>
	.toolbar {
		position: fixed;
		left: 50%;
		bottom: 16px;
		z-index: 220;
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

	.divider {
		width: 1px;
		height: 20px;
		margin: 0 2px;
		background: var(--ps-border);
	}

	.arrange-wrap {
		position: relative;
	}

	.arrange-menu {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 10px);
		width: 160px;
		padding: 5px;
		border: 1px solid var(--ps-border);
		border-radius: var(--ps-radius-m);
		background: var(--ps-paper);
		box-shadow: var(--ps-shadow-chrome);
		translate: -50% 0;
	}

	.arrange-menu button {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		height: 32px;
		padding: 0 9px;
		border: 0;
		border-radius: var(--ps-radius-s);
		background: transparent;
		color: var(--ps-text);
		font-size: 12.5px;
		text-align: left;
		cursor: pointer;
	}

	.arrange-menu button:hover,
	.arrange-menu button:focus-visible {
		background: var(--ps-desk-deep);
	}
</style>
