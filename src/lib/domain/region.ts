import type { Rect } from './camera';
import type { PageRegion } from './types';

const REGION_EPSILON = 0.000_001;

export function assertPageRegion(region: PageRegion): PageRegion {
	const values = [region.x, region.y, region.width, region.height];
	if (values.some((value) => !Number.isFinite(value))) {
		throw new Error('Region coordinates must be finite numbers.');
	}
	if (region.x < 0 || region.y < 0 || region.width <= 0 || region.height <= 0) {
		throw new Error('Region coordinates must be positive and start within the page.');
	}
	if (
		region.x + region.width > 1 + REGION_EPSILON ||
		region.y + region.height > 1 + REGION_EPSILON
	) {
		throw new Error('Region coordinates must stay within the normalized page bounds.');
	}
	return {
		x: Math.max(0, Math.min(1, region.x)),
		y: Math.max(0, Math.min(1, region.y)),
		width: Math.min(1 - region.x, region.width),
		height: Math.min(1 - region.y, region.height)
	};
}

export function regionToWorldRect(region: PageRegion, pageRect: Rect): Rect {
	const checked = assertPageRegion(region);
	return {
		x: pageRect.x + checked.x * pageRect.width,
		y: pageRect.y + checked.y * pageRect.height,
		width: checked.width * pageRect.width,
		height: checked.height * pageRect.height
	};
}

export function unionRegions(regions: readonly PageRegion[]): PageRegion {
	if (regions.length === 0) return { x: 0, y: 0, width: 1, height: 1 };
	const checked = regions.map(assertPageRegion);
	const left = Math.min(...checked.map((region) => region.x));
	const top = Math.min(...checked.map((region) => region.y));
	const right = Math.max(...checked.map((region) => region.x + region.width));
	const bottom = Math.max(...checked.map((region) => region.y + region.height));
	return { x: left, y: top, width: right - left, height: bottom - top };
}
