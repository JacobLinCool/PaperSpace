import { describe, expect, it } from 'vitest';
import { searchPapers } from './search';
import { createEmptyWorkspace, type PaperRecord } from './types';

function paper(overrides: Partial<PaperRecord> = {}): PaperRecord {
	return {
		id: 'paper-1',
		filename: 'paper.pdf',
		title: 'Spatial Reading',
		author: null,
		fileSize: 100,
		pageCount: 2,
		pages: [
			{ pageNumber: 1, x: 0, y: 0, width: 360, height: 509, zIndex: 1 },
			{ pageNumber: 2, x: 424, y: 0, width: 360, height: 509, zIndex: 2 }
		],
		importedAt: 1,
		pageIndexes: [
			{
				text: 'A borderless canvas for close reading.',
				blocks: [
					{
						text: 'A borderless canvas for close reading.',
						region: { x: 0.1, y: 0.2, width: 0.7, height: 0.05 }
					}
				]
			},
			{
				text: 'Frame sequences preserve context.',
				blocks: [
					{
						text: 'Frame sequences preserve context.',
						region: { x: 0.15, y: 0.4, width: 0.6, height: 0.06 }
					}
				]
			}
		],
		indexStatus: 'ready',
		indexedPages: 2,
		...overrides
	};
}

describe('paper search', () => {
	it('ranks exact phrases and returns a focusable page region', () => {
		const [match] = searchPapers([paper()], 'frame sequences');
		expect(match).toMatchObject({
			paperId: 'paper-1',
			page: 2,
			score: 102,
			region: { x: 0.15, y: 0.4, width: 0.6, height: 0.06 }
		});
		expect(match?.quote).toContain('preserve context');
	});

	it('returns no matches for an empty query', () => {
		expect(searchPapers([paper()], '   ')).toEqual([]);
	});

	it('creates the canonical empty workspace shape', () => {
		expect(createEmptyWorkspace(123)).toMatchObject({
			version: 3,
			papers: [],
			artifacts: [],
			frames: [],
			updatedAt: 123
		});
	});
});
