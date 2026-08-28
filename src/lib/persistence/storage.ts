import { assertPageRegion } from '$lib/domain/region';
import {
	WORKSPACE_VERSION,
	createEmptyWorkspace,
	type ArtifactRecord,
	type FrameRecord,
	type PageRegion,
	type PageTextIndex,
	type PaperPageRecord,
	type PaperRecord,
	type WorkspaceState
} from '$lib/domain/types';

const DATABASE_NAME = 'paperspace';
const DATABASE_VERSION = 2;
const WORKSPACE_KEY = 'main';

interface StoredPdf {
	id: string;
	data: ArrayBuffer;
}

interface StoredImage {
	id: string;
	data: Blob;
}

export class IncompatibleWorkspaceError extends Error {
	constructor(readonly savedVersion: unknown) {
		super('The saved workspace uses an unsupported data version.');
		this.name = 'IncompatibleWorkspaceError';
	}
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
	return new Promise((resolve, reject) => {
		request.addEventListener('success', () => resolve(request.result), { once: true });
		request.addEventListener(
			'error',
			() => reject(request.error ?? new Error('IndexedDB failed')),
			{
				once: true
			}
		);
	});
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
	return new Promise((resolve, reject) => {
		transaction.addEventListener('complete', () => resolve(), { once: true });
		transaction.addEventListener(
			'error',
			() => reject(transaction.error ?? new Error('IndexedDB transaction failed')),
			{ once: true }
		);
		transaction.addEventListener(
			'abort',
			() => reject(new Error('IndexedDB transaction aborted')),
			{
				once: true
			}
		);
	});
}

function openDatabase(): Promise<IDBDatabase> {
	if (!('indexedDB' in globalThis)) {
		return Promise.reject(new Error('This browser does not provide IndexedDB.'));
	}
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
		request.addEventListener(
			'upgradeneeded',
			() => {
				const database = request.result;
				if (!database.objectStoreNames.contains('workspace'))
					database.createObjectStore('workspace');
				if (!database.objectStoreNames.contains('pdfs')) {
					database.createObjectStore('pdfs', { keyPath: 'id' });
				}
				if (!database.objectStoreNames.contains('images')) {
					database.createObjectStore('images', { keyPath: 'id' });
				}
			},
			{ once: true }
		);
		request.addEventListener('success', () => resolve(request.result), { once: true });
		request.addEventListener(
			'error',
			() => reject(request.error ?? new Error('IndexedDB failed')),
			{
				once: true
			}
		);
		request.addEventListener(
			'blocked',
			() => reject(new Error('Close other PaperSpace tabs and retry.')),
			{
				once: true
			}
		);
	});
}

function record(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		throw new Error(`${label} must be an object.`);
	}
	return value as Record<string, unknown>;
}

function text(value: unknown, label: string, allowEmpty = false): string {
	if (typeof value !== 'string' || (!allowEmpty && value.length === 0)) {
		throw new Error(`${label} must be ${allowEmpty ? 'a string' : 'a non-empty string'}.`);
	}
	return value;
}

function finite(value: unknown, label: string, minimum?: number): number {
	if (
		typeof value !== 'number' ||
		!Number.isFinite(value) ||
		(minimum !== undefined && value < minimum)
	) {
		throw new Error(
			`${label} must be a finite number${minimum === undefined ? '' : ` at least ${minimum}`}.`
		);
	}
	return value;
}

function integer(value: unknown, label: string, minimum = 0): number {
	const checked = finite(value, label, minimum);
	if (!Number.isInteger(checked)) throw new Error(`${label} must be an integer.`);
	return checked;
}

function pageRegion(value: unknown, label: string): PageRegion {
	const candidate = record(value, label);
	return assertPageRegion({
		x: finite(candidate.x, `${label}.x`),
		y: finite(candidate.y, `${label}.y`),
		width: finite(candidate.width, `${label}.width`),
		height: finite(candidate.height, `${label}.height`)
	});
}

function pageIndex(value: unknown, label: string): PageTextIndex {
	const candidate = record(value, label);
	const blocks = candidate.blocks;
	if (!Array.isArray(blocks)) throw new Error(`${label}.blocks must be an array.`);
	return {
		text: text(candidate.text, `${label}.text`, true),
		blocks: blocks.map((block, index) => {
			const entry = record(block, `${label}.blocks[${index}]`);
			return {
				text: text(entry.text, `${label}.blocks[${index}].text`),
				region: pageRegion(entry.region, `${label}.blocks[${index}].region`)
			};
		})
	};
}

function paperPageRecord(value: unknown, label: string): PaperPageRecord {
	const candidate = record(value, label);
	return {
		pageNumber: integer(candidate.pageNumber, `${label}.pageNumber`, 1),
		x: finite(candidate.x, `${label}.x`),
		y: finite(candidate.y, `${label}.y`),
		width: finite(candidate.width, `${label}.width`, 1),
		height: finite(candidate.height, `${label}.height`, 1),
		zIndex: finite(candidate.zIndex, `${label}.zIndex`)
	};
}

function paperRecord(value: unknown, label: string): PaperRecord {
	const candidate = record(value, label);
	const pageCount = integer(candidate.pageCount, `${label}.pageCount`, 1);
	if (!Array.isArray(candidate.pages)) throw new Error(`${label}.pages must be an array.`);
	const pages = candidate.pages.map((page, index) =>
		paperPageRecord(page, `${label}.pages[${index}]`)
	);
	if (pages.length !== pageCount) throw new Error(`${label}.pages must cover every PDF page.`);
	const pageNumbers = new Set(pages.map((page) => page.pageNumber));
	if (
		pageNumbers.size !== pageCount ||
		pages.some((page) => page.pageNumber < 1 || page.pageNumber > pageCount)
	) {
		throw new Error(`${label}.pages must contain each page number exactly once.`);
	}
	if (!Array.isArray(candidate.pageIndexes))
		throw new Error(`${label}.pageIndexes must be an array.`);
	const pageIndexes = candidate.pageIndexes.map((page, index) =>
		pageIndex(page, `${label}.pageIndexes[${index}]`)
	);
	if (pageIndexes.length > pageCount) throw new Error(`${label}.pageIndexes exceeds pageCount.`);
	const indexStatus = candidate.indexStatus;
	if (!['pending', 'indexing', 'ready', 'failed'].includes(indexStatus as string)) {
		throw new Error(`${label}.indexStatus is invalid.`);
	}
	if (indexStatus === 'ready' && pageIndexes.length !== pageCount) {
		throw new Error(`${label} has an incomplete ready text index.`);
	}
	const indexedPages = integer(candidate.indexedPages, `${label}.indexedPages`);
	if (indexedPages > pageCount) throw new Error(`${label}.indexedPages exceeds pageCount.`);
	const author = candidate.author;
	if (author !== null && typeof author !== 'string') throw new Error(`${label}.author is invalid.`);
	return {
		id: text(candidate.id, `${label}.id`),
		filename: text(candidate.filename, `${label}.filename`),
		title: text(candidate.title, `${label}.title`),
		author,
		fileSize: integer(candidate.fileSize, `${label}.fileSize`),
		pageCount,
		pages,
		importedAt: finite(candidate.importedAt, `${label}.importedAt`, 0),
		pageIndexes,
		indexStatus: indexStatus as PaperRecord['indexStatus'],
		indexedPages
	};
}

function artifactRecord(value: unknown, label: string): ArtifactRecord {
	const candidate = record(value, label);
	const base = {
		id: text(candidate.id, `${label}.id`),
		title: text(candidate.title, `${label}.title`),
		caption: text(candidate.caption, `${label}.caption`, true),
		x: finite(candidate.x, `${label}.x`),
		y: finite(candidate.y, `${label}.y`),
		width: finite(candidate.width, `${label}.width`, 1),
		height: finite(candidate.height, `${label}.height`, 1),
		zIndex: finite(candidate.zIndex, `${label}.zIndex`),
		createdAt: finite(candidate.createdAt, `${label}.createdAt`, 0)
	};
	if (candidate.kind === 'plot') {
		if (
			!Array.isArray(candidate.series) ||
			candidate.series.length < 1 ||
			candidate.series.length > 8
		) {
			throw new Error(`${label}.series must contain 1 to 8 series.`);
		}
		let pointCount = 0;
		const series = candidate.series.map((value, seriesIndex) => {
			const entry = record(value, `${label}.series[${seriesIndex}]`);
			if (!Array.isArray(entry.points) || entry.points.length < 2) {
				throw new Error(`${label}.series[${seriesIndex}] needs at least two points.`);
			}
			pointCount += entry.points.length;
			return {
				name: text(entry.name, `${label}.series[${seriesIndex}].name`),
				points: entry.points.map((value, pointIndex) => {
					const point = record(value, `${label}.series[${seriesIndex}].points[${pointIndex}]`);
					return {
						x: finite(point.x, 'plot point x'),
						y: finite(point.y, 'plot point y')
					};
				})
			};
		});
		if (pointCount > 2000) throw new Error(`${label} exceeds 2,000 plot points.`);
		return {
			...base,
			kind: 'plot',
			xLabel: text(candidate.xLabel, `${label}.xLabel`, true),
			yLabel: text(candidate.yLabel, `${label}.yLabel`, true),
			series
		};
	}
	if (candidate.kind !== 'image' && candidate.kind !== 'snapshot') {
		throw new Error(`${label}.kind is invalid.`);
	}
	const mimeType = candidate.mimeType;
	if (!['image/png', 'image/jpeg', 'image/webp'].includes(mimeType as string)) {
		throw new Error(`${label}.mimeType is invalid.`);
	}
	const raster = {
		...base,
		mimeType: mimeType as 'image/png' | 'image/jpeg' | 'image/webp',
		pixelWidth: integer(candidate.pixelWidth, `${label}.pixelWidth`, 1),
		pixelHeight: integer(candidate.pixelHeight, `${label}.pixelHeight`, 1)
	};
	if (candidate.kind === 'image') return { ...raster, kind: 'image' };
	if (mimeType !== 'image/png') throw new Error(`${label} snapshot must be PNG.`);
	const source = record(candidate.source, `${label}.source`);
	return {
		...raster,
		kind: 'snapshot',
		mimeType: 'image/png',
		source: {
			paperId: text(source.paperId, `${label}.source.paperId`),
			page: integer(source.page, `${label}.source.page`, 1),
			region: pageRegion(source.region, `${label}.source.region`)
		}
	};
}

function frameRecord(value: unknown, label: string): FrameRecord {
	const candidate = record(value, label);
	const target = record(candidate.target, `${label}.target`);
	return {
		id: text(candidate.id, `${label}.id`),
		name: text(candidate.name, `${label}.name`),
		caption: text(candidate.caption, `${label}.caption`, true),
		createdAt: finite(candidate.createdAt, `${label}.createdAt`, 0),
		target:
			target.kind === 'paper-region'
				? {
						kind: 'paper-region',
						paperId: text(target.paperId, `${label}.target.paperId`),
						page: integer(target.page, `${label}.target.page`, 1),
						region: pageRegion(target.region, `${label}.target.region`)
					}
				: target.kind === 'artifact'
					? {
							kind: 'artifact',
							artifactId: text(target.artifactId, `${label}.target.artifactId`)
						}
					: (() => {
							throw new Error(`${label}.target.kind is invalid.`);
						})()
	};
}

export function validateWorkspaceState(value: unknown): WorkspaceState {
	const candidate = record(value, 'Saved workspace');
	if (candidate.version !== WORKSPACE_VERSION) {
		throw new IncompatibleWorkspaceError(candidate.version);
	}
	if (
		!Array.isArray(candidate.papers) ||
		!Array.isArray(candidate.artifacts) ||
		!Array.isArray(candidate.frames)
	) {
		throw new Error('The saved workspace is incomplete.');
	}
	const papers = candidate.papers.map((paper, index) => paperRecord(paper, `papers[${index}]`));
	const artifacts = candidate.artifacts.map((artifact, index) =>
		artifactRecord(artifact, `artifacts[${index}]`)
	);
	const frames = candidate.frames.map((frame, index) => frameRecord(frame, `frames[${index}]`));
	const paperIds = new Set(papers.map((paper) => paper.id));
	const artifactIds = new Set(artifacts.map((artifact) => artifact.id));
	const frameIds = new Set(frames.map((frame) => frame.id));
	if (
		paperIds.size !== papers.length ||
		artifactIds.size !== artifacts.length ||
		frameIds.size !== frames.length ||
		new Set([...paperIds, ...artifactIds]).size !== papers.length + artifacts.length
	) {
		throw new Error('The saved workspace contains duplicate ids.');
	}
	for (const artifact of artifacts) {
		if (artifact.kind === 'snapshot') {
			const paper = papers.find((entry) => entry.id === artifact.source.paperId);
			if (!paper || artifact.source.page > paper.pageCount) {
				throw new Error('A saved snapshot refers to a missing paper page.');
			}
		}
	}
	for (const frame of frames) {
		const target = frame.target;
		if (target.kind === 'paper-region') {
			const paper = papers.find((entry) => entry.id === target.paperId);
			if (!paper || target.page > paper.pageCount) {
				throw new Error('A saved frame refers to a missing paper page.');
			}
		} else if (!artifactIds.has(target.artifactId)) {
			throw new Error('A saved frame refers to a missing visual artifact.');
		}
	}
	const camera = record(candidate.camera, 'camera');
	const zoom = finite(camera.zoom, 'camera.zoom', 0.12);
	if (zoom > 4) throw new Error('camera.zoom exceeds the supported range.');
	return {
		version: WORKSPACE_VERSION,
		name: text(candidate.name, 'workspace.name'),
		sequenceName: text(candidate.sequenceName, 'workspace.sequenceName'),
		camera: {
			centerX: finite(camera.centerX, 'camera.centerX'),
			centerY: finite(camera.centerY, 'camera.centerY'),
			zoom
		},
		papers,
		artifacts,
		frames,
		updatedAt: finite(candidate.updatedAt, 'workspace.updatedAt', 0)
	};
}

export class PaperSpaceStorage {
	#database: Promise<IDBDatabase> | null = null;

	#db(): Promise<IDBDatabase> {
		this.#database ??= openDatabase();
		return this.#database;
	}

	async loadWorkspace(): Promise<WorkspaceState> {
		const database = await this.#db();
		const transaction = database.transaction('workspace', 'readonly');
		const value = await requestResult(transaction.objectStore('workspace').get(WORKSPACE_KEY));
		await transactionDone(transaction);
		return value === undefined ? createEmptyWorkspace() : validateWorkspaceState(value);
	}

	async saveWorkspace(state: WorkspaceState): Promise<void> {
		const database = await this.#db();
		const transaction = database.transaction('workspace', 'readwrite');
		transaction.objectStore('workspace').put(structuredClone(state), WORKSPACE_KEY);
		await transactionDone(transaction);
	}

	async putPdf(id: string, data: ArrayBuffer): Promise<void> {
		const database = await this.#db();
		const transaction = database.transaction('pdfs', 'readwrite');
		transaction.objectStore('pdfs').put({ id, data } satisfies StoredPdf);
		await transactionDone(transaction);
	}

	async getPdf(id: string): Promise<ArrayBuffer> {
		const database = await this.#db();
		const transaction = database.transaction('pdfs', 'readonly');
		const value = await requestResult<StoredPdf | undefined>(
			transaction.objectStore('pdfs').get(id)
		);
		await transactionDone(transaction);
		if (!value) throw new Error('The PDF data is missing from this browser.');
		return value.data;
	}

	async deletePdf(id: string): Promise<void> {
		const database = await this.#db();
		const transaction = database.transaction('pdfs', 'readwrite');
		transaction.objectStore('pdfs').delete(id);
		await transactionDone(transaction);
	}

	async putImage(id: string, data: Blob): Promise<void> {
		const database = await this.#db();
		const transaction = database.transaction('images', 'readwrite');
		transaction.objectStore('images').put({ id, data } satisfies StoredImage);
		await transactionDone(transaction);
	}

	async getImage(id: string): Promise<Blob> {
		const database = await this.#db();
		const transaction = database.transaction('images', 'readonly');
		const value = await requestResult<StoredImage | undefined>(
			transaction.objectStore('images').get(id)
		);
		await transactionDone(transaction);
		if (!value) throw new Error('The visual image data is missing from this browser.');
		return value.data;
	}

	async deleteImage(id: string): Promise<void> {
		const database = await this.#db();
		const transaction = database.transaction('images', 'readwrite');
		transaction.objectStore('images').delete(id);
		await transactionDone(transaction);
	}

	async clearAll(): Promise<void> {
		const database = await this.#db();
		const transaction = database.transaction(['workspace', 'pdfs', 'images'], 'readwrite');
		transaction.objectStore('workspace').clear();
		transaction.objectStore('pdfs').clear();
		transaction.objectStore('images').clear();
		await transactionDone(transaction);
	}
}

export const storage = new PaperSpaceStorage();
