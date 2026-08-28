<script lang="ts">
	import { onMount } from 'svelte';
	import DeskCanvas from '$lib/desk/DeskCanvas.svelte';
	import { registerWebMcp } from '$lib/webmcp/register';
	import { workspace } from '$lib/workspace/workspace.svelte';
	import BrandMark from '$lib/ui/BrandMark.svelte';
	import FramesPanel from '$lib/ui/FramesPanel.svelte';
	import PresentBar from '$lib/ui/PresentBar.svelte';
	import SearchPanel from '$lib/ui/SearchPanel.svelte';
	import StatusBar from '$lib/ui/StatusBar.svelte';
	import Toast from '$lib/ui/Toast.svelte';
	import Toolbar from '$lib/ui/Toolbar.svelte';
	import WebMcpInfo from '$lib/ui/WebMcpInfo.svelte';
	import ZoomDock from '$lib/ui/ZoomDock.svelte';

	let fileInput = $state<HTMLInputElement | null>(null);
	let searchOpen = $state(false);
	let mcpInfoOpen = $state(false);

	function requestImport(): void {
		fileInput?.click();
	}

	function filesChanged(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];
		input.value = '';
		if (files.length > 0) void workspace.importFiles(files);
	}

	$effect(() => {
		if (workspace.framesOpen) searchOpen = false;
	});

	onMount(() => {
		let unregister = () => {};
		let live = true;
		void (async () => {
			await workspace.initialize();
			if (!live) return;
			unregister = await registerWebMcp(workspace);
		})();

		const persistWhenHidden = () => {
			if (document.visibilityState === 'hidden') void workspace.saveNow();
		};
		document.addEventListener('visibilitychange', persistWhenHidden);
		return () => {
			live = false;
			unregister();
			document.removeEventListener('visibilitychange', persistWhenHidden);
			void workspace.dispose();
		};
	});
</script>

<svelte:head>
	<title>{workspace.ready ? workspace.state.name : 'PaperSpace'} · PaperSpace</title>
</svelte:head>

<input
	class="file-input"
	bind:this={fileInput}
	type="file"
	accept="application/pdf,.pdf"
	multiple
	onchange={filesChanged}
/>

{#if !workspace.ready}
	<div class="loading" role="status">
		<BrandMark size={34} />
		<span>Opening your reading desk</span>
	</div>
{:else}
	<StatusBar {workspace} onmcpinfo={() => (mcpInfoOpen = !mcpInfoOpen)} />
	<DeskCanvas {workspace} onrequestimport={requestImport} />
	<Toolbar
		{workspace}
		{searchOpen}
		onrequestimport={requestImport}
		ontogglesearch={() => {
			searchOpen = !searchOpen;
			workspace.framesOpen = false;
		}}
	/>
	<ZoomDock {workspace} />
	<SearchPanel {workspace} open={searchOpen} onclose={() => (searchOpen = false)} />
	<FramesPanel {workspace} />
	<PresentBar {workspace} />
	<WebMcpInfo {workspace} open={mcpInfoOpen} onclose={() => (mcpInfoOpen = false)} />
	<Toast toast={workspace.toast} />
{/if}

<style>
	.file-input {
		position: fixed;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
	}

	.loading {
		position: fixed;
		inset: 0;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 12px;
		background: var(--ps-desk);
		color: var(--ps-text-muted);
		font-size: 12.5px;
		font-weight: 600;
	}
</style>
