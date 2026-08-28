import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	discardPagePreview,
	HIGH_RESOLUTION_PIXEL_BUDGET,
	PAGE_PREVIEW_WIDTH,
	RasterResidency,
	replacePagePreview
} from './rasterCache';

describe('PDF raster residency', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('uses the expanded default high-resolution pixel budget', () => {
		expect(new RasterResidency().maxPixels).toBe(48_000_000);
		expect(HIGH_RESOLUTION_PIXEL_BUDGET).toBe(48_000_000);
	});

	it('creates a 288px-wide page preview without changing its aspect ratio', async () => {
		const close = vi.fn();
		const createImageBitmap = vi.fn(
			async () => ({ width: 288, height: 576, close }) as ImageBitmap
		);
		vi.stubGlobal('createImageBitmap', createImageBitmap);
		const source = { width: 1000, height: 2000 } as HTMLCanvasElement;

		const preview = await replacePagePreview('preview-page', source);

		expect(PAGE_PREVIEW_WIDTH).toBe(288);
		expect(preview).toMatchObject({ width: 288, height: 576 });
		expect(createImageBitmap).toHaveBeenCalledWith(source, 0, 0, 1000, 2000, {
			resizeWidth: 288,
			resizeHeight: 576,
			resizeQuality: 'medium'
		});
		discardPagePreview('preview-page');
		expect(close).toHaveBeenCalledOnce();
	});

	it('evicts the least recently used high-resolution raster', () => {
		const residency = new RasterResidency(10);
		const evictA = vi.fn();
		const evictB = vi.fn();
		const evictC = vi.fn();

		residency.retain('a', 6, evictA);
		residency.retain('b', 4, evictB);
		residency.touch('a');
		residency.retain('c', 4, evictC);

		expect(evictA).not.toHaveBeenCalled();
		expect(evictB).toHaveBeenCalledOnce();
		expect(evictC).not.toHaveBeenCalled();
		expect(residency.residentPixels).toBe(10);
		expect(residency.size).toBe(2);
	});

	it('releases only the raster owned by the supplied eviction callback', () => {
		const residency = new RasterResidency(10);
		const owner = vi.fn();
		residency.retain('page', 8, owner);

		residency.release('page', vi.fn());
		expect(residency.size).toBe(1);

		residency.release('page', owner);
		expect(residency.size).toBe(0);
		expect(residency.residentPixels).toBe(0);
	});

	it('never evicts a pinned visible raster and trims it after unpinning', () => {
		const residency = new RasterResidency(10);
		const visible = vi.fn();
		const nearby = vi.fn();

		residency.retain('visible', 8, visible, true);
		residency.retain('nearby', 6, nearby);

		expect(visible).not.toHaveBeenCalled();
		expect(nearby).toHaveBeenCalledOnce();
		expect(residency.residentPixels).toBe(8);

		residency.retain('nearby', 6, nearby, true);
		expect(residency.residentPixels).toBe(14);
		residency.setPinned('visible', false);

		expect(visible).toHaveBeenCalledOnce();
		expect(residency.residentPixels).toBe(6);
	});
});
