import { describe, expect, it } from 'vitest';
import { layoutPaperPages, pageGridColumns } from './layout';

describe('unfolded paper layout', () => {
	it('chooses a bounded deterministic column count', () => {
		expect(pageGridColumns(1)).toBe(1);
		expect(pageGridColumns(6)).toBe(3);
		expect(pageGridColumns(40)).toBe(6);
	});

	it('places every page in row-major order while respecting page dimensions', () => {
		const placements = layoutPaperPages([
			{ pageNumber: 3, width: 360, height: 600 },
			{ pageNumber: 1, width: 360, height: 500 },
			{ pageNumber: 2, width: 420, height: 520 },
			{ pageNumber: 4, width: 360, height: 500 }
		]);
		expect(placements).toEqual([
			{ pageNumber: 1, x: 0, y: 0 },
			{ pageNumber: 2, x: 424, y: 0 },
			{ pageNumber: 3, x: 908, y: 0 },
			{ pageNumber: 4, x: 0, y: 664 }
		]);
	});
});
