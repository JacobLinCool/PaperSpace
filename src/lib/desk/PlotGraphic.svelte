<script lang="ts">
	import type { PlotArtifactRecord } from '$lib/domain/types';

	interface Props {
		artifact: PlotArtifactRecord;
	}

	let { artifact }: Props = $props();
	const colors = [
		'#4d6e97',
		'#a94b55',
		'#668b50',
		'#9a7598',
		'#bf6f56',
		'#5b7f88',
		'#80664f',
		'#586174'
	];
	const points = $derived(artifact.series.flatMap((series) => series.points));
	const xMin = $derived(Math.min(...points.map((point) => point.x)));
	const xMax = $derived(Math.max(...points.map((point) => point.x)));
	const yMin = $derived(Math.min(...points.map((point) => point.y)));
	const yMax = $derived(Math.max(...points.map((point) => point.y)));
	const safeXRange = $derived(xMax === xMin ? 1 : xMax - xMin);
	const safeYRange = $derived(yMax === yMin ? 1 : yMax - yMin);
	const ticks = [0, 0.25, 0.5, 0.75, 1];

	function sx(value: number): number {
		return 56 + ((value - xMin) / safeXRange) * 430;
	}

	function sy(value: number): number {
		return 294 - ((value - yMin) / safeYRange) * 238;
	}

	function path(pointsInSeries: PlotArtifactRecord['series'][number]['points']): string {
		return pointsInSeries
			.map((point, index) => `${index === 0 ? 'M' : 'L'} ${sx(point.x)} ${sy(point.y)}`)
			.join(' ');
	}

	function tickValue(min: number, range: number, ratio: number): string {
		const value = min + range * ratio;
		return Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.01)
			? value.toExponential(1)
			: Number(value.toPrecision(3)).toString();
	}
</script>

<svg viewBox="0 0 520 340" role="img" aria-label={artifact.title}>
	<rect width="520" height="340" fill="#ffffff" />
	{#each ticks as tick (tick)}
		<line
			x1="56"
			x2="486"
			y1={sy(yMin + safeYRange * tick)}
			y2={sy(yMin + safeYRange * tick)}
			class="grid"
		/>
		<text x="48" y={sy(yMin + safeYRange * tick) + 4} text-anchor="end" class="tick">
			{tickValue(yMin, safeYRange, tick)}
		</text>
		<text x={sx(xMin + safeXRange * tick)} y="312" text-anchor="middle" class="tick">
			{tickValue(xMin, safeXRange, tick)}
		</text>
	{/each}
	<line x1="56" x2="486" y1="294" y2="294" class="axis" />
	<line x1="56" x2="56" y1="56" y2="294" class="axis" />
	{#each artifact.series as series, index (series.name)}
		<path
			d={path(series.points)}
			fill="none"
			stroke={colors[index % colors.length]}
			stroke-width="2.4"
			stroke-linejoin="round"
			stroke-linecap="round"
		/>
	{/each}
	{#if artifact.xLabel}
		<text x="271" y="332" text-anchor="middle" class="label">{artifact.xLabel}</text>
	{/if}
	{#if artifact.yLabel}
		<text x="15" y="175" text-anchor="middle" class="label" transform="rotate(-90 15 175)"
			>{artifact.yLabel}</text
		>
	{/if}
	<g class="legend">
		{#each artifact.series as series, index (series.name)}
			<line
				x1={66 + (index % 3) * 144}
				x2={80 + (index % 3) * 144}
				y1={18 + Math.floor(index / 3) * 18}
				y2={18 + Math.floor(index / 3) * 18}
				stroke={colors[index % colors.length]}
				stroke-width="2.4"
			/>
			<text x={85 + (index % 3) * 144} y={22 + Math.floor(index / 3) * 18}>{series.name}</text>
		{/each}
	</g>
</svg>

<style>
	svg {
		display: block;
		width: 100%;
		height: 100%;
		font-family: var(--ps-mono);
	}

	.grid {
		stroke: rgb(76 86 106 / 13%);
		stroke-width: 1;
	}

	.axis {
		stroke: var(--ps-text-muted);
		stroke-width: 1.2;
	}

	.tick {
		fill: var(--ps-text-muted);
		font-size: 9px;
	}

	.label {
		fill: var(--ps-text);
		font-family: inherit;
		font-size: 10px;
		font-weight: 600;
	}

	.legend text {
		fill: var(--ps-text);
		font-size: 9px;
	}
</style>
