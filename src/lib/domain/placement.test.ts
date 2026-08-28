import { describe, expect, it } from 'vitest';
import type { PaperRecord, PlotArtifactRecord } from './types';
import {
	clearHorizontalOffset,
	mergeVisualConflicts,
	visualConflicts,
	VisualConflictError
} from './placement';

const paper: PaperRecord = {
	id: 'paper-1',
	filename: 'paper.pdf',
	title: 'Paper',
	author: null,
	fileSize: 1,
	pageCount: 1,
	pages: [{ pageNumber: 1, x: 0, y: 0, width: 360, height: 500, zIndex: 1 }],
	importedAt: 1,
	pageIndexes: [],
	indexStatus: 'pending',
	indexedPages: 0
};

const artifact: PlotArtifactRecord = {
	id: 'plot-1',
	kind: 'plot',
	title: 'Existing plot',
	caption: '',
	x: 500,
	y: 0,
	width: 300,
	height: 200,
	zIndex: 2,
	createdAt: 1,
	xLabel: 'x',
	yLabel: 'y',
	series: [
		{
			name: 'Series',
			points: [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 }
			]
		}
	]
};

describe('visual placement guards', () => {
	it('reports page overlap and near-edge crowding separately', () => {
		expect(visualConflicts({ x: 100, y: 100, width: 200, height: 200 }, [paper], [])).toEqual([
			expect.objectContaining({ kind: 'paper-page', page: 1, relation: 'overlap' })
		]);
		expect(visualConflicts({ x: 370, y: 0, width: 100, height: 100 }, [paper], [])).toEqual([
			expect.objectContaining({ kind: 'paper-page', page: 1, relation: 'clearance' })
		]);
	});

	it('detects artifacts and deduplicates repeated obstacle reports', () => {
		const conflict = visualConflicts({ x: 520, y: 20, width: 100, height: 100 }, [], [artifact]);
		expect(conflict).toEqual([
			expect.objectContaining({ kind: 'artifact', artifactId: 'plot-1', relation: 'overlap' })
		]);
		expect(mergeVisualConflicts([...conflict, ...conflict])).toHaveLength(1);
	});

	it('provides an actionable force-only recovery error', () => {
		const conflicts = visualConflicts({ x: 100, y: 100, width: 200, height: 200 }, [paper], []);
		const error = new VisualConflictError(conflicts);
		expect(error).toMatchObject({ code: 'VISUAL_CONFLICT', conflicts });
		expect(error.message).toContain('No changes were made');
		expect(error.message).toContain('force: true');
	});

	it('moves a temporary group only far enough to clear horizontal obstacles', () => {
		const offset = clearHorizontalOffset({ x: 400, y: 0, width: 300, height: 500 }, [
			{ x: 450, y: 100, width: 200, height: 200 },
			{ x: 900, y: 0, width: 100, height: 500 }
		]);
		expect(offset).toBe(624);
	});
});
