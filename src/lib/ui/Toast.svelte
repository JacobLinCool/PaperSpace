<script lang="ts">
	import Bot from '@lucide/svelte/icons/bot';
	import type { ToastMessage } from '$lib/workspace/workspace.svelte';

	interface Props {
		toast: ToastMessage | null;
	}

	let { toast }: Props = $props();
</script>

{#if toast}
	<div class="toast {toast.tone}" role={toast.tone === 'danger' ? 'alert' : 'status'}>
		{#if toast.tone === 'agent'}
			<Bot size={16} strokeWidth={1.75} aria-hidden="true" />
		{/if}
		<span>{toast.message}</span>
	</div>
{/if}

<style>
	.toast {
		position: fixed;
		left: 50%;
		bottom: 76px;
		z-index: 300;
		display: flex;
		align-items: center;
		gap: 7px;
		max-width: min(520px, calc(100vw - 32px));
		padding: 9px 12px;
		border-radius: var(--ps-radius-m);
		background: var(--ps-text-strong);
		color: var(--ps-paper);
		font-size: 12.5px;
		line-height: 1.4;
		box-shadow: 0 4px 16px rgb(46 52 64 / 24%);
		translate: -50% 0;
		animation: settle 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.toast.danger {
		background: var(--ps-danger);
	}

	.toast.agent {
		background: var(--ps-frost-deep);
	}

	@keyframes settle {
		from {
			opacity: 0;
			translate: -50% 5px;
			filter: blur(2px);
		}
	}

	@media (max-width: 720px) {
		.toast {
			bottom: 124px;
		}
	}
</style>
