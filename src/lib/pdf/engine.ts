import type {
	PDFDocumentLoadingTask,
	PDFDocumentProxy,
	PDFPageProxy,
	PageViewport
} from 'pdfjs-dist';
import type { PageRegion, PageTextIndex, TextBlock } from '$lib/domain/types';
import { assertPageRegion } from '$lib/domain/region';
import { storage, type PaperSpaceStorage } from '$lib/persistence/storage';

export interface PdfInfo {
	pageCount: number;
	title: string | null;
	author: string | null;
	pages: Array<{ width: number; height: number; aspect: number }>;
}

interface OpenDocument {
	proxy: PDFDocumentProxy;
	task: PDFDocumentLoadingTask;
	pages: Map<number, Promise<PDFPageProxy>>;
	lastUsed: number;
}

type PdfjsModule = typeof import('pdfjs-dist');
type PdfTextItem = {
	str: string;
	transform: number[];
	width: number;
};

const MAX_OPEN_DOCUMENTS = 8;
let pdfjsPromise: Promise<PdfjsModule> | null = null;

export function loadPdfjs(): Promise<PdfjsModule> {
	pdfjsPromise ??= import('pdfjs-dist').then((pdfjs) => {
		pdfjs.GlobalWorkerOptions.workerSrc = new URL(
			'pdfjs-dist/build/pdf.worker.min.mjs',
			import.meta.url
		).href;
		return pdfjs;
	});
	return pdfjsPromise;
}

function metadataText(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

async function describe(proxy: PDFDocumentProxy): Promise<PdfInfo> {
	const [pages, metadata] = await Promise.all([
		Promise.all(Array.from({ length: proxy.numPages }, (_, index) => proxy.getPage(index + 1))),
		proxy.getMetadata().catch(() => null)
	]);
	const info = metadata?.info as { Title?: unknown; Author?: unknown } | undefined;
	return {
		pageCount: proxy.numPages,
		title: metadataText(info?.Title),
		author: metadataText(info?.Author),
		pages: pages.map((page) => {
			const viewport = page.getViewport({ scale: 1 });
			return {
				width: viewport.width,
				height: viewport.height,
				aspect: viewport.width > 0 ? viewport.height / viewport.width : Math.SQRT2
			};
		})
	};
}

function pageText(items: readonly unknown[]): string {
	const output: string[] = [];
	for (const item of items) {
		if (!item || typeof item !== 'object' || !('str' in item)) continue;
		const text = (item as { str: string; hasEOL?: boolean }).str;
		if (!text) continue;
		output.push(text);
		if ((item as { hasEOL?: boolean }).hasEOL) output.push('\n');
		else output.push(' ');
	}
	return output
		.join('')
		.replace(/[ \t]+\n/g, '\n')
		.replace(/[ \t]{2,}/g, ' ')
		.trim();
}

function clampUnit(value: number): number {
	return Math.max(0, Math.min(1, value));
}

function pageBlocks(
	items: readonly unknown[],
	viewport: PageViewport,
	transform: (first: number[], second: number[]) => number[]
): TextBlock[] {
	const blocks: TextBlock[] = [];
	for (const candidate of items) {
		if (!candidate || typeof candidate !== 'object' || !('str' in candidate)) continue;
		const item = candidate as PdfTextItem;
		const text = item.str.trim();
		if (!text) continue;
		const matrix = transform(viewport.transform, item.transform);
		const fontHeight = Math.max(1, Math.hypot(matrix[2] ?? 0, matrix[3] ?? 0));
		const x = clampUnit((matrix[4] ?? 0) / viewport.width);
		const y = clampUnit(((matrix[5] ?? 0) - fontHeight) / viewport.height);
		const width = Math.min(
			1 - x,
			Math.max(0.000_1, (item.width * viewport.scale) / viewport.width)
		);
		const height = Math.min(1 - y, Math.max(0.000_1, fontHeight / viewport.height));
		blocks.push({ text, region: { x, y, width, height } });
	}
	return blocks;
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) =>
				blob ? resolve(blob) : reject(new Error('The browser could not encode the image.')),
			type
		);
	});
}

export interface PdfSnapshot {
	blob: Blob;
	pixelWidth: number;
	pixelHeight: number;
}

export class PdfEngine {
	#open = new Map<string, Promise<OpenDocument>>();

	constructor(private readonly persistence: PaperSpaceStorage = storage) {}

	async inspect(data: ArrayBuffer): Promise<PdfInfo> {
		const pdfjs = await loadPdfjs();
		const task = pdfjs.getDocument({
			data: new Uint8Array(data.slice(0)),
			enableXfa: false,
			verbosity: 0
		});
		const proxy = await task.promise;
		try {
			return await describe(proxy);
		} finally {
			await task.destroy();
		}
	}

	async #entry(id: string): Promise<OpenDocument> {
		const existing = this.#open.get(id);
		if (existing) {
			const entry = await existing;
			entry.lastUsed = performance.now();
			return entry;
		}
		const promise = Promise.all([loadPdfjs(), this.persistence.getPdf(id)]).then(
			async ([pdfjs, data]) => {
				const task = pdfjs.getDocument({
					data: new Uint8Array(data),
					enableXfa: false,
					verbosity: 0
				});
				const proxy = await task.promise;
				return { proxy, task, pages: new Map(), lastUsed: performance.now() };
			}
		);
		this.#open.set(id, promise);
		try {
			const entry = await promise;
			await this.#evict(id);
			return entry;
		} catch (error) {
			this.#open.delete(id);
			throw error;
		}
	}

	async #evict(exceptId: string): Promise<void> {
		if (this.#open.size <= MAX_OPEN_DOCUMENTS) return;
		const entries = await Promise.all(
			[...this.#open.entries()]
				.filter(([id]) => id !== exceptId)
				.map(async ([id, value]) => ({ id, value: await value }))
		);
		entries.sort((a, b) => a.value.lastUsed - b.value.lastUsed);
		const oldest = entries[0];
		if (!oldest) return;
		this.#open.delete(oldest.id);
		oldest.value.pages.clear();
		await oldest.value.task.destroy();
	}

	async document(id: string): Promise<PDFDocumentProxy> {
		return (await this.#entry(id)).proxy;
	}

	async page(id: string, pageNumber: number): Promise<PDFPageProxy> {
		const entry = await this.#entry(id);
		const cached = entry.pages.get(pageNumber);
		if (cached) return cached;
		const request = entry.proxy.getPage(pageNumber);
		entry.pages.set(pageNumber, request);
		try {
			return await request;
		} catch (error) {
			entry.pages.delete(pageNumber);
			throw error;
		}
	}

	async extractText(
		id: string,
		onProgress?: (indexedPages: number, pageCount: number, page: PageTextIndex) => void,
		signal?: AbortSignal
	): Promise<PageTextIndex[]> {
		const proxy = await this.document(id);
		const pdfjs = await loadPdfjs();
		const pages: PageTextIndex[] = [];
		for (let pageNumber = 1; pageNumber <= proxy.numPages; pageNumber += 1) {
			if (signal?.aborted) throw new DOMException('Text indexing was cancelled.', 'AbortError');
			const page = await this.page(id, pageNumber);
			const content = await page.getTextContent({
				includeMarkedContent: true,
				disableNormalization: false
			});
			const viewport = page.getViewport({ scale: 1 });
			const index = {
				text: pageText(content.items),
				blocks: pageBlocks(content.items, viewport, pdfjs.Util.transform)
			};
			pages.push(index);
			onProgress?.(pageNumber, proxy.numPages, index);
		}
		return pages;
	}

	async snapshot(
		id: string,
		pageNumber: number,
		region: PageRegion,
		scale = 2
	): Promise<PdfSnapshot> {
		const checked = assertPageRegion(region);
		const page = await this.page(id, pageNumber);
		const base = page.getViewport({ scale: 1 });
		const safeScale = Math.max(0.75, Math.min(3, scale));
		const maxScale = Math.min(
			4096 / (base.width * checked.width),
			4096 / (base.height * checked.height)
		);
		const viewport = page.getViewport({ scale: Math.min(safeScale, maxScale) });
		const cropX = checked.x * viewport.width;
		const cropY = checked.y * viewport.height;
		const pixelWidth = Math.max(1, Math.ceil(checked.width * viewport.width));
		const pixelHeight = Math.max(1, Math.ceil(checked.height * viewport.height));
		const canvas = document.createElement('canvas');
		canvas.width = pixelWidth;
		canvas.height = pixelHeight;
		const context = canvas.getContext('2d', { alpha: false });
		if (!context) throw new Error('Canvas rendering is unavailable.');
		await page.render({
			canvas,
			canvasContext: context,
			viewport,
			transform: [1, 0, 0, 1, -cropX, -cropY],
			background: '#ffffff'
		}).promise;
		return { blob: await canvasBlob(canvas, 'image/png'), pixelWidth, pixelHeight };
	}

	async forget(id: string): Promise<void> {
		const promise = this.#open.get(id);
		this.#open.delete(id);
		if (!promise) return;
		const entry = await promise;
		entry.pages.clear();
		await entry.task.destroy();
	}

	async destroy(): Promise<void> {
		const entries = await Promise.allSettled(this.#open.values());
		this.#open.clear();
		await Promise.all(
			entries.flatMap((entry) =>
				entry.status === 'fulfilled' ? [entry.value.task.destroy().catch(() => {})] : []
			)
		);
	}
}

export const pdfEngine = new PdfEngine();

export function isPdfCancellation(error: unknown): boolean {
	return (
		error !== null &&
		typeof error === 'object' &&
		'name' in error &&
		((error as { name?: string }).name === 'AbortError' ||
			(error as { name?: string }).name === 'RenderingCancelledException')
	);
}
