import { describe, expect, it } from 'vitest';
import { assertPageRegion, regionToWorldRect, unionRegions } from './region';

describe('page region geometry', () => {
	it('maps a normalized page region into the paper world rect', () => {
		expect(
			regionToWorldRect(
				{ x: 0.25, y: 0.2, width: 0.5, height: 0.3 },
				{ x: 100, y: 200, width: 400, height: 600 }
			)
		).toEqual({ x: 200, y: 320, width: 200, height: 180 });
	});

	it('rejects a region that leaves the page', () => {
		expect(() => assertPageRegion({ x: 0.8, y: 0.1, width: 0.3, height: 0.2 })).toThrow(
			'within the normalized page bounds'
		);
	});

	it('unions text blocks into one focus region', () => {
		expect(
			unionRegions([
				{ x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
				{ x: 0.35, y: 0.28, width: 0.4, height: 0.12 }
			])
		).toEqual({ x: 0.1, y: 0.2, width: 0.65, height: 0.2 });
	});
});
