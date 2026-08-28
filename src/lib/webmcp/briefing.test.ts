import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace, type PaperRecord } from '$lib/domain/types';
import { briefingRevision, paperContentBrief, sourceCues, workspaceReadiness } from './briefing';

function paper(pageCount = 3): PaperRecord {
	return {
		id: 'paper-1',
		filename: 'paper.pdf',
		title: 'Adaptive retrieval',
		author: 'Researcher',
		fileSize: 10,
		pageCount,
		pages: Array.from({ length: pageCount }, (_, index) => ({
			pageNumber: index + 1,
			x: index * 424,
			y: 0,
			width: 360,
			height: 500,
			zIndex: index + 1
		})),
		importedAt: 1,
		pageIndexes: [
			{
				text: 'Method overview. Figure 2 shows adaptive routing. See Table 1 for results.',
				blocks: []
			}
		],
		indexStatus: 'indexing',
		indexedPages: 1
	};
}

describe('compact WebMCP briefing', () => {
	it('extracts bounded source cues without claiming they are embedded visuals', () => {
		expect(sourceCues('Figure 2, fig. 2, Table 1 and Equation 4.')).toEqual([
			'Figure 2',
			'Table 1',
			'Equation 4'
		]);
	});

	it('makes a partial index immediately available for questions', () => {
		const candidate = paper();
		expect(workspaceReadiness([candidate], 0)).toMatchObject({
			status: 'partial',
			questionReady: true,
			indexedPages: 1,
			totalPages: 3
		});
		expect(paperContentBrief(candidate)).toMatchObject({
			availablePageRange: { start: 1, end: 1 },
			complete: false,
			pageBriefs: [expect.objectContaining({ page: 1, sourceCues: ['Figure 2', 'Table 1'] })]
		});
	});

	it('changes the cache revision only when briefing content changes', () => {
		const state = { ...createEmptyWorkspace(), papers: [paper()] };
		const initial = briefingRevision(state);
		state.camera.centerX = 900;
		expect(briefingRevision(state)).toBe(initial);
		state.papers[0]!.pageIndexes.push({ text: 'Results', blocks: [] });
		expect(briefingRevision(state)).not.toBe(initial);
	});
});
