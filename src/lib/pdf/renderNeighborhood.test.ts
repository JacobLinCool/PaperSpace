import { describe, expect, it } from 'vitest';
import {
	PAGE_RENDER_ENTER_ZOOM,
	PAGE_RENDER_EXIT_ZOOM,
	pageIntersectsViewport,
	pageIsInRenderNeighborhood
} from './renderNeighborhood';

const visible = { x: 0, y: 0, width: 1000, height: 800 };
const page = { x: 1500, y: 100, width: 300, height: 420 };

describe('PDF render neighborhood', () => {
	it('identifies only pages that intersect the strict viewport', () => {
		expect(pageIntersectsViewport({ ...page, x: 980 }, visible)).toBe(true);
		expect(pageIntersectsViewport({ ...page, x: 1001 }, visible)).toBe(false);
	});

	it('keeps an active page resident beyond the stricter entry boundary', () => {
		expect(
			pageIsInRenderNeighborhood({ page, visible, zoom: PAGE_RENDER_ENTER_ZOOM, wasActive: false })
		).toBe(true);
		const nearBoundary = { ...page, x: 1700 };
		expect(
			pageIsInRenderNeighborhood({
				page: nearBoundary,
				visible,
				zoom: PAGE_RENDER_ENTER_ZOOM,
				wasActive: false
			})
		).toBe(false);
		expect(
			pageIsInRenderNeighborhood({
				page: nearBoundary,
				visible,
				zoom: PAGE_RENDER_ENTER_ZOOM,
				wasActive: true
			})
		).toBe(true);
	});

	it('uses separate zoom thresholds for entry and exit', () => {
		const zoomBetweenThresholds = (PAGE_RENDER_ENTER_ZOOM + PAGE_RENDER_EXIT_ZOOM) / 2;
		expect(
			pageIsInRenderNeighborhood({ page, visible, zoom: zoomBetweenThresholds, wasActive: false })
		).toBe(false);
		expect(
			pageIsInRenderNeighborhood({ page, visible, zoom: zoomBetweenThresholds, wasActive: true })
		).toBe(true);
		expect(
			pageIsInRenderNeighborhood({
				page,
				visible,
				zoom: PAGE_RENDER_EXIT_ZOOM - 0.01,
				wasActive: true
			})
		).toBe(false);
	});
});
