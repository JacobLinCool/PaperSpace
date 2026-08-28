import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
	createEmptyWorkspace,
	type PaperRecord,
	type PlotArtifactRecord,
	type PlotSeries
} from '$lib/domain/types';
import { IncompatibleWorkspaceError, type PaperSpaceStorage } from '$lib/persistence/storage';
import type { PdfEngine } from '$lib/pdf/engine';
import { Workspace } from './workspace.svelte';

function paper(): PaperRecord {
	return {
		id: 'paper-1',
		filename: 'paper.pdf',
		title: 'Experiment paper',
		author: null,
		fileSize: 100,
		pageCount: 4,
		pages: [
			{ pageNumber: 1, x: 0, y: 0, width: 360, height: 500, zIndex: 1 },
			{ pageNumber: 2, x: 424, y: 0, width: 360, height: 500, zIndex: 2 },
			{ pageNumber: 3, x: 848, y: 0, width: 360, height: 500, zIndex: 3 },
			{ pageNumber: 4, x: 0, y: 564, width: 360, height: 500, zIndex: 4 }
		],
		importedAt: 1,
		pageIndexes: [],
		indexStatus: 'pending',
		indexedPages: 0
	};
}

describe('workspace initialization', () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it('automatically clears an incompatible local workspace and opens a fresh desk', async () => {
		vi.useFakeTimers();
		const clearAll = vi.fn().mockResolvedValue(undefined);
		const persistence = {
			loadWorkspace: vi.fn().mockRejectedValue(new IncompatibleWorkspaceError(2)),
			clearAll
		} as unknown as PaperSpaceStorage;
		const workspace = new Workspace(persistence);

		await workspace.initialize();

		expect(clearAll).toHaveBeenCalledOnce();
		expect(workspace.ready).toBe(true);
		expect(workspace.storageLocked).toBe(false);
		expect(workspace.error).toBeNull();
		expect(workspace.state).toMatchObject({ version: 3, papers: [], artifacts: [], frames: [] });
		expect(workspace.toast?.message).toBe(
			'PaperSpace updated. Previous local workspace was cleared.'
		);
	});

	it('does not erase local data for an unrelated storage failure', async () => {
		const clearAll = vi.fn().mockResolvedValue(undefined);
		const persistence = {
			loadWorkspace: vi.fn().mockRejectedValue(new Error('IndexedDB failed')),
			clearAll
		} as unknown as PaperSpaceStorage;
		const workspace = new Workspace(persistence);

		await workspace.initialize();

		expect(clearAll).not.toHaveBeenCalled();
		expect(workspace.ready).toBe(true);
		expect(workspace.storageLocked).toBe(true);
		expect(workspace.error).toBe('IndexedDB failed');
	});

	it('keeps recovery available when automatic clearing itself fails', async () => {
		const persistence = {
			loadWorkspace: vi.fn().mockRejectedValue(new IncompatibleWorkspaceError(2)),
			clearAll: vi.fn().mockRejectedValue(new Error('Storage is blocked'))
		} as unknown as PaperSpaceStorage;
		const workspace = new Workspace(persistence);

		await workspace.initialize();

		expect(workspace.ready).toBe(true);
		expect(workspace.storageLocked).toBe(true);
		expect(workspace.error).toBe('Automatic local reset failed: Storage is blocked');
	});

	it('clears every browser-local workspace record on an explicit reset', async () => {
		vi.useFakeTimers();
		const clearAll = vi.fn().mockResolvedValue(undefined);
		const destroy = vi.fn().mockResolvedValue(undefined);
		const persistence = { clearAll } as unknown as PaperSpaceStorage;
		const pdf = { destroy } as unknown as PdfEngine;
		const workspace = new Workspace(persistence, pdf);
		workspace.state = { ...createEmptyWorkspace(), papers: [paper()] };

		await workspace.resetLocalData();

		expect(destroy).toHaveBeenCalledOnce();
		expect(clearAll).toHaveBeenCalledOnce();
		expect(workspace.state).toMatchObject({ version: 3, papers: [], artifacts: [], frames: [] });
		expect(workspace.storageLocked).toBe(false);
		expect(workspace.toast?.message).toBe('A new local workspace is ready.');
	});
});

describe('PDF raster working set', () => {
	it('pins strict-viewport and explicit reading targets at high resolution', () => {
		const workspace = new Workspace();
		workspace.state = {
			...createEmptyWorkspace(),
			camera: { centerX: 180, centerY: 250, zoom: 1 },
			papers: [paper()]
		};
		workspace.setViewport(1000, 800);

		expect(workspace.shouldPinPageRaster('paper-1', 1)).toBe(true);
		expect(workspace.shouldPinPageRaster('paper-1', 3)).toBe(false);

		workspace.state.camera.zoom = 0.2;
		expect(workspace.shouldPinPageRaster('paper-1', 1)).toBe(false);

		workspace.focusedPaperRegion = {
			paperId: 'paper-1',
			page: 3,
			region: { x: 0.1, y: 0.1, width: 0.2, height: 0.2 }
		};
		expect(workspace.shouldPinPageRaster('paper-1', 3)).toBe(true);

		workspace.focusedPaperRegion = null;
		workspace.selectedPage = { paperId: 'paper-1', page: 3 };
		expect(workspace.shouldPinPageRaster('paper-1', 3)).toBe(true);
	});

	it('publishes a landing-resolution prewarm target until manual camera input cancels it', () => {
		const workspace = new Workspace();
		workspace.state = { ...createEmptyWorkspace(), papers: [paper()] };
		workspace.setViewport(1200, 800);

		workspace.focusPage('paper-1', 3);

		expect(workspace.focusedPaperRegion).toBeNull();
		expect(workspace.rasterPrewarmTarget).toMatchObject({ paperId: 'paper-1', page: 3 });
		expect(workspace.rasterPrewarmZoom('paper-1', 3)).toBeGreaterThan(0);
		expect(workspace.shouldPinPageRaster('paper-1', 3)).toBe(true);

		workspace.updateCamera({ centerX: 0, centerY: 0, zoom: 0.8 });

		expect(workspace.rasterPrewarmTarget).toBeNull();
	});
});

describe('sequence page staging', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => {
		vi.useRealTimers();
		vi.unstubAllGlobals();
	});

	it('moves each related original page once and restores exact positions on exit', () => {
		const workspace = new Workspace();
		workspace.state = { ...createEmptyWorkspace(), papers: [paper()] };
		const original = workspace.state.papers[0]!.pages.map((page) => ({ ...page }));

		workspace.presentSequence('Experiment path', [
			{
				name: 'Prior work',
				target: {
					kind: 'paper-region',
					paperId: 'paper-1',
					page: 1,
					region: { x: 0.1, y: 0.1, width: 0.5, height: 0.2 }
				}
			},
			{
				name: 'Result',
				target: {
					kind: 'paper-region',
					paperId: 'paper-1',
					page: 3,
					region: { x: 0.1, y: 0.5, width: 0.6, height: 0.2 }
				}
			},
			{
				name: 'Prior work detail',
				target: {
					kind: 'paper-region',
					paperId: 'paper-1',
					page: 1,
					region: { x: 0.2, y: 0.3, width: 0.4, height: 0.1 }
				}
			}
		]);

		expect(workspace.sequencePageOrigins.map((entry) => entry.page)).toEqual([1, 3]);
		expect(workspace.pageByNumber('paper-1', 2)).toMatchObject(original[1]!);
		expect(workspace.pageByNumber('paper-1', 1)!.x).toBeGreaterThan(1208);

		workspace.stopPresentation();
		expect(workspace.state.papers[0]!.pages).toEqual(original);
		expect(workspace.sequencePageOrigins).toEqual([]);
	});

	it('restores the entry camera immediately when reduced motion is requested', () => {
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({ matches: true }))
		);
		const requestAnimationFrame = vi.fn(() => 41);
		vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
		const workspace = new Workspace();
		const entryCamera = { centerX: 140, centerY: 220, zoom: 0.72 };
		workspace.state = { ...createEmptyWorkspace(), camera: entryCamera, papers: [paper()] };
		workspace.setViewport(1200, 800);

		workspace.presentSequence('Reduced-motion path', [
			{
				target: {
					kind: 'paper-region',
					paperId: 'paper-1',
					page: 3,
					region: { x: 0.1, y: 0.4, width: 0.7, height: 0.2 }
				}
			}
		]);
		expect(requestAnimationFrame).not.toHaveBeenCalled();
		expect(workspace.camera).not.toEqual(entryCamera);

		workspace.stopPresentation();
		expect(workspace.camera).toEqual(entryCamera);
	});

	it('stages gathered pages beyond existing visuals without requiring force', () => {
		const workspace = new Workspace();
		const obstacle: PlotArtifactRecord = {
			id: 'visual-1',
			kind: 'plot',
			title: 'Existing explanation',
			caption: '',
			x: 1376,
			y: 0,
			width: 520,
			height: 360,
			zIndex: 5,
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
		workspace.state = { ...createEmptyWorkspace(), papers: [paper()], artifacts: [obstacle] };

		workspace.presentSequence('Clear sequence', [
			{
				target: {
					kind: 'paper-region',
					paperId: 'paper-1',
					page: 1,
					region: { x: 0, y: 0, width: 1, height: 1 }
				}
			}
		]);

		expect(workspace.pageByNumber('paper-1', 1)!.x).toBeGreaterThanOrEqual(1920);
	});

	it('cancels an active camera flight as soon as manual camera input arrives', () => {
		const requestAnimationFrame = vi.fn(() => 73);
		const cancelAnimationFrame = vi.fn();
		vi.stubGlobal(
			'matchMedia',
			vi.fn(() => ({ matches: false }))
		);
		vi.stubGlobal('requestAnimationFrame', requestAnimationFrame);
		vi.stubGlobal('cancelAnimationFrame', cancelAnimationFrame);
		const workspace = new Workspace();
		workspace.setViewport(1200, 800);

		workspace.flyTo(
			{ centerX: 1800, centerY: 700, zoom: 1.2 },
			{ x: 1700, y: 600, width: 200, height: 200 }
		);
		expect(workspace.cameraAnimating).toBe(true);

		const manualCamera = { centerX: 25, centerY: -40, zoom: 0.9 };
		workspace.updateCamera(manualCamera);
		expect(cancelAnimationFrame).toHaveBeenCalledWith(73);
		expect(workspace.cameraAnimating).toBe(false);
		expect(workspace.camera).toEqual(manualCamera);
	});
});

describe('progressive paper access', () => {
	it('publishes each extracted page before the complete paper finishes indexing', async () => {
		vi.useFakeTimers();
		let publishFirst!: () => void;
		const firstPublished = new Promise<void>((resolve) => (publishFirst = resolve));
		let continueIndexing!: () => void;
		const pause = new Promise<void>((resolve) => (continueIndexing = resolve));
		const firstIndex = { text: 'First page is searchable.', blocks: [] };
		const secondIndex = { text: 'Second page completes the paper.', blocks: [] };
		const pdf = {
			extractText: vi.fn(async (_id, onProgress) => {
				onProgress?.(1, 2, firstIndex);
				publishFirst();
				await pause;
				onProgress?.(2, 2, secondIndex);
				return [firstIndex, secondIndex];
			})
		} as unknown as PdfEngine;
		const workspace = new Workspace(undefined, pdf);
		const candidate = paper();
		candidate.pageCount = 2;
		candidate.pages = candidate.pages.slice(0, 2);
		workspace.state = { ...createEmptyWorkspace(), papers: [candidate] };

		const indexing = workspace.queueIndex(candidate.id);
		await firstPublished;
		expect(workspace.papers[0]).toMatchObject({
			indexStatus: 'indexing',
			indexedPages: 1,
			pageIndexes: [firstIndex]
		});
		expect(workspace.search('searchable')).toHaveLength(1);

		continueIndexing();
		await indexing;
		expect(workspace.papers[0]).toMatchObject({
			indexStatus: 'ready',
			indexedPages: 2,
			pageIndexes: [firstIndex, secondIndex]
		});
		vi.useRealTimers();
	});

	it('reads an indexed prefix without waiting for the complete paper', () => {
		const workspace = new Workspace();
		const candidate = paper();
		candidate.pageIndexes = [{ text: 'The method is available now.', blocks: [] }];
		candidate.indexStatus = 'indexing';
		candidate.indexedPages = 1;
		workspace.state = { ...createEmptyWorkspace(), papers: [candidate] };

		expect(workspace.readPaperPages('paper-1', 1)).toMatchObject({
			pages: [{ page: 1, text: 'The method is available now.', blocks: [] }],
			coverage: {
				startPage: 1,
				endPage: 1,
				indexedPages: 1,
				totalPages: 4,
				indexingComplete: false,
				wholePaper: false,
				truncated: false
			}
		});
		expect(() => workspace.readPaperPages('paper-1', 2)).toThrow(
			'Pages 1 through 1 are indexed; requested page 2 is not ready yet.'
		);
	});

	it('reads a fully indexed long paper in one call without a page or hidden text cap', () => {
		const workspace = new Workspace();
		const candidate = paper();
		candidate.pageCount = 32;
		candidate.pages = Array.from({ length: 32 }, (_, index) => ({
			pageNumber: index + 1,
			x: (index % 6) * 424,
			y: Math.floor(index / 6) * 564,
			width: 360,
			height: 500,
			zIndex: index + 1
		}));
		candidate.pageIndexes = Array.from({ length: 32 }, (_, index) => ({
			text: `Page ${index + 1}: ${'complete paper text '.repeat(200)}`,
			blocks: [
				{
					text: `Page ${index + 1}`,
					region: { x: 0.1, y: 0.1, width: 0.2, height: 0.04 }
				}
			]
		}));
		candidate.indexStatus = 'ready';
		candidate.indexedPages = 32;
		workspace.state = { ...createEmptyWorkspace(), papers: [candidate] };

		const reading = workspace.readPaperPages('paper-1');

		expect(reading.pages).toHaveLength(32);
		expect(reading.pages.every((page) => page.blocks.length === 0)).toBe(true);
		expect(reading.coverage).toMatchObject({
			startPage: 1,
			endPage: 32,
			returnedThrough: 32,
			indexedPages: 32,
			totalPages: 32,
			indexingComplete: true,
			wholePaper: true,
			truncated: false
		});
		expect(reading.coverage.charactersReturned).toBeGreaterThan(50_000);
	});
});

describe('guarded spatial mutations', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it('rejects a conflicting plot atomically unless force is explicit', () => {
		const workspace = new Workspace();
		workspace.state = {
			...createEmptyWorkspace(),
			camera: { centerX: 180, centerY: 250, zoom: 1 },
			papers: [paper()]
		};
		const series: PlotSeries[] = [
			{
				name: 'Method',
				points: [
					{ x: 0, y: 1 },
					{ x: 1, y: 0.5 }
				]
			}
		];

		expect(() => workspace.placePlot('Loss curve', '', 'lambda', 'loss', series)).toThrow(
			'VISUAL_CONFLICT'
		);
		expect(workspace.artifacts).toHaveLength(0);

		const forced = workspace.placePlot('Loss curve', '', 'lambda', 'loss', series, true);
		expect(forced).toMatchObject({ forced: true });
		expect(forced.conflicts[0]).toMatchObject({
			kind: 'paper-page',
			paperId: 'paper-1',
			page: 1,
			relation: 'overlap'
		});
		expect(workspace.artifacts).toHaveLength(1);
	});

	it('preflights an arrangement before changing any page geometry', () => {
		const workspace = new Workspace();
		const candidate = paper();
		const original = candidate.pages.map((page) => ({ ...page }));
		const obstacle: PlotArtifactRecord = {
			id: 'artifact-1',
			kind: 'plot',
			title: 'Keep clear',
			caption: '',
			x: 0,
			y: 0,
			width: 520,
			height: 360,
			zIndex: 5,
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
		workspace.state = { ...createEmptyWorkspace(), papers: [candidate], artifacts: [obstacle] };

		expect(() => workspace.arrange('grid', undefined, 'agent')).toThrow('VISUAL_CONFLICT');
		expect(workspace.papers[0]!.pages).toEqual(original);
	});
});
