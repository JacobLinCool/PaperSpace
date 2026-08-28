import type { Rect } from '$lib/domain/camera';

export const PAGE_RENDER_ENTER_ZOOM = 0.3;
export const PAGE_RENDER_EXIT_ZOOM = 0.22;
export const PAGE_RENDER_ENTER_MARGIN = 0.55;
export const PAGE_RENDER_EXIT_MARGIN = 0.9;

interface RenderNeighborhoodInput {
	page: Rect;
	visible: Rect;
	zoom: number;
	wasActive: boolean;
}

export function pageIntersectsViewport(page: Rect, visible: Rect): boolean {
	return !(
		page.x + page.width < visible.x ||
		page.x > visible.x + visible.width ||
		page.y + page.height < visible.y ||
		page.y > visible.y + visible.height
	);
}

export function pageIsInRenderNeighborhood({
	page,
	visible,
	zoom,
	wasActive
}: RenderNeighborhoodInput): boolean {
	const minimumZoom = wasActive ? PAGE_RENDER_EXIT_ZOOM : PAGE_RENDER_ENTER_ZOOM;
	if (zoom < minimumZoom) return false;
	const marginRatio = wasActive ? PAGE_RENDER_EXIT_MARGIN : PAGE_RENDER_ENTER_MARGIN;
	const margin = Math.max(visible.width, visible.height) * marginRatio;
	return !(
		page.x + page.width < visible.x - margin ||
		page.x > visible.x + visible.width + margin ||
		page.y + page.height < visible.y - margin ||
		page.y > visible.y + visible.height + margin
	);
}
