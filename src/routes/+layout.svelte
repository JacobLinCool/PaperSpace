<script lang="ts">
	import '../app.css';

	let { children } = $props();
</script>

<svelte:head>
	<title>PaperSpace</title>
</svelte:head>

{@render children()}
