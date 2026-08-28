<script lang="ts">
	import type { LucideIcon } from '@lucide/svelte';
	import { tick } from 'svelte';

	interface Props {
		icon: LucideIcon;
		label: string;
		onclick?: (event: MouseEvent) => void;
		disabled?: boolean;
		pressed?: boolean;
		variant?: 'ghost' | 'toolbar' | 'danger';
		size?: 'sm' | 'md';
		type?: 'button' | 'submit';
	}

	let {
		icon: Icon,
		label,
		onclick,
		disabled = false,
		pressed = false,
		variant = 'ghost',
		size = 'md',
		type = 'button'
	}: Props = $props();
	let tooltipNode = $state<HTMLSpanElement | null>(null);
	let tooltipVisible = $state(false);
	let tooltipAbove = $state(false);
	let tooltipOffsetX = $state(0);

	async function showTooltip(event: Event): Promise<void> {
		if (disabled) return;
		const button = event.currentTarget as HTMLButtonElement;
		tooltipVisible = true;
		await tick();
		if (!tooltipNode) return;

		const trigger = button.getBoundingClientRect();
		const tooltip = tooltipNode.getBoundingClientRect();
		const inset = 8;
		const gap = 7;
		const belowTop = trigger.bottom + gap;
		const roomBelow = belowTop + tooltip.height <= window.innerHeight - inset;
		const roomAbove = trigger.top - gap - tooltip.height >= inset;
		tooltipAbove = !roomBelow && roomAbove;
		const viewportCenter = Math.min(
			window.innerWidth - inset - tooltip.width / 2,
			Math.max(inset + tooltip.width / 2, trigger.left + trigger.width / 2)
		);
		tooltipOffsetX = viewportCenter - (trigger.left + trigger.width / 2);
	}

	function hideTooltip(): void {
		tooltipVisible = false;
	}
</script>

<button
	{type}
	class="icon-button {variant} {size}"
	class:pressed
	{disabled}
	aria-label={label}
	aria-pressed={pressed ? 'true' : undefined}
	data-tooltip={label}
	{onclick}
	onpointerenter={showTooltip}
	onpointerleave={hideTooltip}
	onfocus={showTooltip}
	onblur={hideTooltip}
>
	<Icon size={size === 'sm' ? 17 : 19} strokeWidth={1.75} aria-hidden="true" />
	<span
		bind:this={tooltipNode}
		class="tooltip"
		class:visible={tooltipVisible}
		class:above={tooltipAbove}
		style={`left: calc(50% + ${tooltipOffsetX}px);`}
		role="tooltip"
	>
		{label}
	</span>
</button>

<style>
	.icon-button {
		position: relative;
		display: inline-grid;
		place-items: center;
		width: 34px;
		height: 34px;
		padding: 0;
		border: 0;
		border-radius: var(--ps-radius-s);
		background: transparent;
		color: var(--ps-text-muted);
		cursor: pointer;
		transition:
			background-color var(--ps-transition),
			color var(--ps-transition);
	}

	.icon-button.sm {
		width: 28px;
		height: 28px;
	}

	.icon-button:hover:not(:disabled),
	.icon-button:focus-visible:not(:disabled) {
		background: var(--ps-desk-deep);
		color: var(--ps-text-strong);
	}

	.icon-button.pressed,
	.icon-button.toolbar.pressed {
		background: var(--ps-frost-deep);
		color: var(--ps-paper);
	}

	.icon-button.danger:hover:not(:disabled),
	.icon-button.danger:focus-visible:not(:disabled) {
		background: color-mix(in srgb, var(--ps-danger) 16%, var(--ps-paper));
		color: var(--ps-danger);
	}

	.icon-button:disabled {
		opacity: 0.42;
		cursor: default;
	}

	.tooltip {
		position: absolute;
		left: 50%;
		top: calc(100% + 7px);
		z-index: 1000;
		width: max-content;
		max-width: 190px;
		padding: 5px 7px;
		border-radius: var(--ps-radius-s);
		background: var(--ps-text-strong);
		color: var(--ps-paper);
		font-size: 11.5px;
		line-height: 1.25;
		font-weight: 500;
		box-shadow: 0 2px 7px rgb(46 52 64 / 18%);
		pointer-events: none;
		opacity: 0;
		visibility: hidden;
		transform: translateX(-50%);
		transition:
			opacity 110ms ease-out,
			visibility 0s linear 110ms;
	}

	.tooltip.above {
		top: auto;
		bottom: calc(100% + 7px);
	}

	.tooltip.visible {
		opacity: 1;
		visibility: visible;
		transition-delay: 420ms, 420ms;
	}
</style>
