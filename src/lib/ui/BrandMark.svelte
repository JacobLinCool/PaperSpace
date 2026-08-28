<script lang="ts">
	interface Props {
		size?: number;
	}

	let { size = 24 }: Props = $props();
</script>

<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
	<rect width="32" height="32" rx="7" fill="var(--ps-frost-deep)" />
	<g transform="translate(5 4)">
		<rect
			x="5"
			y="2"
			width="17"
			height="22"
			rx="1"
			transform="rotate(5 13.5 13)"
			fill="var(--ps-desk-deep)"
		/>
		<rect
			x="1"
			y="2"
			width="17"
			height="22"
			rx="1"
			transform="rotate(-4 9.5 13)"
			fill="var(--ps-paper)"
		/>
		<path d="M5 9h9M5 12h10M4.5 15h8M4 18h9" stroke="var(--ps-desk-deep)" stroke-width="1" />
		<circle cx="17" cy="6.5" r="3" fill="none" stroke="var(--ps-frost-cyan)" stroke-width="1.6" />
	</g>
</svg>
