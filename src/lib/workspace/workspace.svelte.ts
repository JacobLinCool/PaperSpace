import {
	boundsForRects,
	cameraFlightDuration,
	cameraFlightKeyframes,
	cameraViewportRect,
	fitRect,
	fitRectWithInsets,
	sampleCameraFlight,
	type CameraFlightProfile,
	type Rect,
	type Size
} from '$lib/domain/camera';
import {
	DEFAULT_PAGE_WIDTH,
	PAPER_GAP,
	arrangePapers,
	layoutPaperPages,
	pageRect,
	paperBounds
} from '$lib/domain/layout';
import { assertPageRegion, regionToWorldRect } from '$lib/domain/region';
import { searchPapers } from '$lib/domain/search';
import {
	clearHorizontalOffset,
	mergeVisualConflicts,
	visualConflicts,
	VisualConflictError,
	type VisualConflict
} from '$lib/domain/placement';
import {
	createEmptyWorkspace,
	type Arrangement,
	type ArtifactRecord,
	type CameraState,
	type FrameRecord,
	type FrameTarget,
	type ImageArtifactRecord,
	type PageRegion,
	type PageTextIndex,
	type PaperPageRecord,
	type PaperRecord,
	type PlotArtifactRecord,
	type PlotSeries,
	type SearchMatch,
	type SnapshotArtifactRecord,
	type WorkspaceState
} from '$lib/domain/types';
import { pdfEngine, type PdfEngine } from '$lib/pdf/engine';
import {
	PAGE_RENDER_ENTER_ZOOM,
	pageIntersectsViewport,
	pageIsInRenderNeighborhood
} from '$lib/pdf/renderNeighborhood';
import {
	IncompatibleWorkspaceError,
	storage,
	type PaperSpaceStorage
} from '$lib/persistence/storage';

const MAX_PDF_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const DEFAULT_ARTIFACT_WIDTH = 480;
const MIN_ITEM_WIDTH = 260;
const MAX_ITEM_WIDTH = 920;
const SAVE_DELAY_MS = 180;

export interface ToastMessage {
	id: string;
	message: string;
	tone: 'neutral' | 'danger' | 'agent';
}

export interface SequenceFrameInput {
	name?: string;
	caption?: string;
	target: FrameTarget;
}

export interface SpatialMutationResult<T> {
	value: T;
	forced: boolean;
	conflicts: VisualConflict[];
}

interface ActiveSequence {
	name: string;
	frames: FrameRecord[];
	temporary: boolean;
	originalCamera: CameraState;
	pageOrigins: SequencePageOrigin[];
}

export interface SequencePageOrigin {
	paperId: string;
	page: number;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
}

export interface SelectedPage {
	paperId: string;
	page: number;
}

export interface FocusedPaperRegion {
	paperId: string;
	page: number;
	region: PageRegion;
}

export interface RasterPrewarmTarget {
	paperId: string;
	page: number;
	zoom: number;
}

interface DecodedImage {
	blob: Blob;
	mimeType: ImageArtifactRecord['mimeType'];
}

function cleanFilename(filename: string): string {
	return (
		filename
			.replace(/\.pdf$/i, '')
			.replace(/[_-]+/g, ' ')
			.trim() || 'Untitled paper'
	);
}

function errorMessage(error: unknown): string {
	return error instanceof Error && error.message ? error.message : 'An unexpected error occurred.';
}

function isPdfFile(file: File, bytes: ArrayBuffer): boolean {
	if (file.type && file.type !== 'application/pdf') return false;
	return new TextDecoder('ascii').decode(bytes.slice(0, 5)) === '%PDF-';
}

function highestZ(state: WorkspaceState): number {
	return Math.max(
		0,
		...state.papers.flatMap((paper) => paper.pages.map((page) => page.zIndex)),
		...state.artifacts.map((entry) => entry.zIndex)
	);
}

function decodeImageDataUrl(dataUrl: string): DecodedImage {
	const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(dataUrl);
	if (!match?.[1] || !match[2]) {
		throw new Error('Image data must be a base64 PNG, JPEG, or WebP data URL.');
	}
	const mimeType = match[1] as DecodedImage['mimeType'];
	const encoded = match[2].replace(/\s+/g, '');
	if (encoded.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4) {
		throw new Error('Images must be non-empty and no larger than 5 MB.');
	}
	let binary: string;
	try {
		binary = atob(encoded);
	} catch {
		throw new Error('The image data is not valid base64.');
	}
	if (binary.length === 0 || binary.length > MAX_IMAGE_BYTES) {
		throw new Error('Images must be non-empty and no larger than 5 MB.');
	}
	const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
	const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;
	const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
	const webp =
		String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
		String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP';
	if (
		(mimeType === 'image/png' && !png) ||
		(mimeType === 'image/jpeg' && !jpeg) ||
		(mimeType === 'image/webp' && !webp)
	) {
		throw new Error('The image bytes do not match the declared media type.');
	}
	return { blob: new Blob([bytes], { type: mimeType }), mimeType };
}

function checkedPage(paper: PaperRecord, page: number): number {
	if (!Number.isInteger(page) || page < 1 || page > paper.pageCount) {
		throw new Error(`Page must be between 1 and ${paper.pageCount}.`);
	}
	return page;
}

function expandedRegion(region: PageRegion, padding: number): PageRegion {
	const checked = assertPageRegion(region);
	const safePadding = Math.max(0, Math.min(0.35, padding));
	const left = Math.max(0, checked.x - safePadding);
	const top = Math.max(0, checked.y - safePadding);
	const right = Math.min(1, checked.x + checked.width + safePadding);
	const bottom = Math.min(1, checked.y + checked.height + safePadding);
	return { x: left, y: top, width: right - left, height: bottom - top };
}

function itemRect(item: ArtifactRecord): Rect {
	return { x: item.x, y: item.y, width: item.width, height: item.height };
}

function checkedMutation<T>(
	value: T,
	conflicts: VisualConflict[],
	force: boolean
): SpatialMutationResult<T> {
	if (conflicts.length > 0 && !force) throw new VisualConflictError(conflicts);
	return { value, forced: force && conflicts.length > 0, conflicts };
}

function pageKey(paperId: string, page: number): string {
	return `${paperId}:${page}`;
}

function fitGuidedTarget(rect: Rect, viewport: Size, presenting: boolean): CameraState {
	if (!presenting) return fitRect(rect, viewport, 72);
	const narrow = viewport.width <= 640;
	return fitRectWithInsets(rect, viewport, {
		top: narrow ? 68 : 76,
		right: narrow ? 24 : 88,
		bottom: narrow ? 184 : 156,
		left: narrow ? 24 : 88
	});
}

function detachSnapshot(artifact: SnapshotArtifactRecord): ImageArtifactRecord {
	return {
		id: artifact.id,
		kind: 'image',
		title: artifact.title,
		caption: artifact.caption,
		x: artifact.x,
		y: artifact.y,
		width: artifact.width,
		height: artifact.height,
		zIndex: artifact.zIndex,
		createdAt: artifact.createdAt,
		mimeType: artifact.mimeType,
		pixelWidth: artifact.pixelWidth,
		pixelHeight: artifact.pixelHeight
	};
}

export class Workspace {
	state = $state<WorkspaceState>(createEmptyWorkspace());
	ready = $state(false);
	error = $state<string | null>(null);
	storageLocked = $state(false);
	selectedPage = $state<SelectedPage | null>(null);
	selectedArtifactId = $state<string | null>(null);
	focusedPaperRegion = $state<FocusedPaperRegion | null>(null);
	rasterPrewarmTarget = $state<RasterPrewarmTarget | null>(null);
	framesOpen = $state(false);
	presentingIndex = $state<number | null>(null);
	activeSequence = $state<ActiveSequence | null>(null);
	importingCount = $state(0);
	webMcpStatus = $state<'checking' | 'ready' | 'unavailable' | 'failed'>('checking');
	toast = $state<ToastMessage | null>(null);
	viewport = $state<Size>({ width: 1, height: 1 });
	cameraAnimating = $state(false);
	pageLayoutAnimating = $state(false);

	#saveTimer: ReturnType<typeof setTimeout> | null = null;
	#toastTimer: ReturnType<typeof setTimeout> | null = null;
	#layoutTimer: ReturnType<typeof setTimeout> | null = null;
	#cameraFlight: number | null = null;
	#indexQueue = Promise.resolve();
	#matches: Record<string, SearchMatch> = Object.create(null) as Record<string, SearchMatch>;
	#renderNeighborhood: Record<string, true> = Object.create(null) as Record<string, true>;

	constructor(
		private readonly persistence: PaperSpaceStorage = storage,
		private readonly pdf: PdfEngine = pdfEngine
	) {}

	get papers(): PaperRecord[] {
		return this.state.papers;
	}

	get pageCount(): number {
		return this.state.papers.reduce((total, paper) => total + paper.pages.length, 0);
	}

	get artifacts(): ArtifactRecord[] {
		return this.state.artifacts;
	}

	get frames(): FrameRecord[] {
		return this.state.frames;
	}

	get camera(): CameraState {
		return this.state.camera;
	}

	get presentationFrames(): FrameRecord[] {
		return this.activeSequence?.frames ?? [];
	}

	get presentingFrame(): FrameRecord | null {
		return this.presentingIndex === null
			? null
			: (this.presentationFrames[this.presentingIndex] ?? null);
	}

	get hasTemporarySequence(): boolean {
		return this.activeSequence?.temporary ?? false;
	}

	get sequencePageOrigins(): readonly SequencePageOrigin[] {
		return this.activeSequence?.pageOrigins ?? [];
	}

	get organizedSequencePages() {
		return this.sequencePageOrigins.map((origin) => {
			const page = this.pageByNumber(origin.paperId, origin.page);
			return {
				paperId: origin.paperId,
				page: origin.page,
				from: { x: Math.round(origin.x), y: Math.round(origin.y) },
				to: page ? { x: Math.round(page.x), y: Math.round(page.y) } : null
			};
		});
	}

	async initialize(): Promise<void> {
		try {
			this.state = await this.persistence.loadWorkspace();
			this.resumeIndexing();
		} catch (error) {
			if (error instanceof IncompatibleWorkspaceError) {
				try {
					await this.persistence.clearAll();
					this.#useFreshWorkspace();
					this.showToast('PaperSpace updated. Previous local workspace was cleared.');
				} catch (resetError) {
					this.error = `Automatic local reset failed: ${errorMessage(resetError)}`;
					this.storageLocked = true;
				}
			} else {
				this.error = errorMessage(error);
				this.storageLocked = true;
			}
		} finally {
			this.ready = true;
		}
	}

	#useFreshWorkspace(): void {
		this.state = createEmptyWorkspace();
		this.error = null;
		this.storageLocked = false;
		this.selectedPage = null;
		this.selectedArtifactId = null;
		this.focusedPaperRegion = null;
		this.rasterPrewarmTarget = null;
		this.activeSequence = null;
		this.presentingIndex = null;
		this.cancelCameraFlight();
		this.#matches = Object.create(null) as Record<string, SearchMatch>;
		this.#renderNeighborhood = Object.create(null) as Record<string, true>;
	}

	async resetLocalData(): Promise<void> {
		await this.pdf.destroy();
		await this.persistence.clearAll();
		this.#useFreshWorkspace();
		this.showToast('A new local workspace is ready.');
	}

	setViewport(width: number, height: number): void {
		if (width <= 0 || height <= 0) return;
		this.viewport = { width, height };
	}

	showToast(message: string, tone: ToastMessage['tone'] = 'neutral'): void {
		this.toast = { id: crypto.randomUUID(), message, tone };
		if (this.#toastTimer) clearTimeout(this.#toastTimer);
		this.#toastTimer = setTimeout(() => {
			this.toast = null;
		}, 3600);
	}

	#scheduleSave(): void {
		if (this.storageLocked) return;
		this.state.updatedAt = Date.now();
		if (this.#saveTimer) clearTimeout(this.#saveTimer);
		this.#saveTimer = setTimeout(() => {
			this.#saveTimer = null;
			void this.saveNow();
		}, SAVE_DELAY_MS);
	}

	async saveNow(): Promise<void> {
		if (this.storageLocked) return;
		try {
			const snapshot = $state.snapshot(this.state);
			if (this.activeSequence) {
				snapshot.camera = { ...this.activeSequence.originalCamera };
				for (const origin of this.activeSequence.pageOrigins) {
					const page = snapshot.papers
						.find((paper) => paper.id === origin.paperId)
						?.pages.find((page) => page.pageNumber === origin.page);
					if (!page) continue;
					page.x = origin.x;
					page.y = origin.y;
					page.width = origin.width;
					page.height = origin.height;
					page.zIndex = origin.zIndex;
				}
			}
			await this.persistence.saveWorkspace(snapshot);
			this.error = null;
		} catch (error) {
			this.error = `Local save failed: ${errorMessage(error)}`;
			this.showToast(this.error, 'danger');
		}
	}

	async importFiles(files: readonly File[]): Promise<void> {
		if (this.storageLocked) throw new Error('Local storage must be reset before importing.');
		for (const file of files) await this.#importFile(file);
	}

	async #importFile(file: File): Promise<void> {
		this.importingCount += 1;
		try {
			if (file.size > MAX_PDF_BYTES) throw new Error('PDFs must be 100 MB or smaller.');
			const data = await file.arrayBuffer();
			if (!isPdfFile(file, data)) throw new Error(`${file.name} is not a valid PDF.`);
			const info = await this.pdf.inspect(data);
			const id = crypto.randomUUID();
			await this.persistence.putPdf(id, data);
			const zBase = highestZ(this.state) + 1;
			const pageShapes: PaperPageRecord[] = info.pages.map((page, index) => ({
				pageNumber: index + 1,
				x: 0,
				y: 0,
				width: DEFAULT_PAGE_WIDTH,
				height: DEFAULT_PAGE_WIDTH * page.aspect,
				zIndex: zBase + index
			}));
			const draftPlacements = layoutPaperPages(pageShapes);
			for (const page of pageShapes) {
				const placement = draftPlacements.find((entry) => entry.pageNumber === page.pageNumber)!;
				page.x = placement.x;
				page.y = placement.y;
			}
			const draftBounds = boundsForRects(pageShapes.map(pageRect))!;
			const existingBounds = boundsForRects([
				...this.state.papers.flatMap((paper) => paper.pages.map(pageRect)),
				...this.state.artifacts.map(itemRect)
			]);
			const origin = existingBounds
				? { x: existingBounds.x + existingBounds.width + PAPER_GAP, y: existingBounds.y }
				: {
						x: this.state.camera.centerX - draftBounds.width / 2,
						y: this.state.camera.centerY - draftBounds.height / 2
					};
			for (const page of pageShapes) {
				page.x += origin.x;
				page.y += origin.y;
			}
			const paper: PaperRecord = {
				id,
				filename: file.name,
				title: info.title ?? cleanFilename(file.name),
				author: info.author,
				fileSize: file.size,
				pageCount: info.pageCount,
				pages: pageShapes,
				importedAt: Date.now(),
				pageIndexes: [],
				indexStatus: 'pending',
				indexedPages: 0
			};
			this.state.papers.push(paper);
			this.selectPage(id, 1);
			const importedBounds = paperBounds(paper);
			if (importedBounds)
				this.flyTo(fitRect(importedBounds, this.viewport, 64), importedBounds, false);
			this.#scheduleSave();
			this.showToast(`${paper.title} added to the desk`);
			this.queueIndex(id);
		} catch (error) {
			this.showToast(errorMessage(error), 'danger');
		} finally {
			this.importingCount -= 1;
		}
	}

	resumeIndexing(): void {
		for (const paper of this.state.papers) {
			if (paper.indexStatus !== 'ready' || paper.pageIndexes.length !== paper.pageCount) {
				this.queueIndex(paper.id);
			}
		}
	}

	queueIndex(id: string): Promise<void> {
		this.#indexQueue = this.#indexQueue.then(() => this.#indexPaper(id)).catch(() => {});
		return this.#indexQueue;
	}

	async #indexPaper(id: string): Promise<void> {
		const paper = this.paperById(id);
		if (!paper || (paper.indexStatus === 'ready' && paper.pageIndexes.length === paper.pageCount)) {
			return;
		}
		paper.indexStatus = 'indexing';
		paper.indexedPages = 0;
		this.#scheduleSave();
		try {
			const indexes = await this.pdf.extractText(id, (indexedPages, _pageCount, index) => {
				const current = this.paperById(id);
				if (!current) return;
				current.pageIndexes[indexedPages - 1] = index;
				current.indexedPages = current.pageIndexes.length;
				this.state.updatedAt = Date.now();
			});
			const current = this.paperById(id);
			if (!current) return;
			current.pageIndexes = indexes;
			current.indexedPages = indexes.length;
			current.indexStatus = 'ready';
			this.#scheduleSave();
		} catch (error) {
			const current = this.paperById(id);
			if (!current) return;
			current.indexStatus = 'failed';
			this.#scheduleSave();
			this.showToast(`Text indexing failed for ${current.title}: ${errorMessage(error)}`, 'danger');
		}
	}

	paperById(id: string): PaperRecord | undefined {
		return this.state.papers.find((paper) => paper.id === id);
	}

	pageByNumber(paperId: string, pageNumber: number): PaperPageRecord | undefined {
		return this.paperById(paperId)?.pages.find((page) => page.pageNumber === pageNumber);
	}

	shouldRenderPage(paperId: string, pageNumber: number): boolean {
		const key = pageKey(paperId, pageNumber);
		const page = this.pageByNumber(paperId, pageNumber);
		if (!page) {
			delete this.#renderNeighborhood[key];
			return false;
		}
		const visible = cameraViewportRect(this.camera, this.viewport);
		const active = pageIsInRenderNeighborhood({
			page,
			visible,
			zoom: this.camera.zoom,
			wasActive: this.#renderNeighborhood[key] === true
		});
		if (active) this.#renderNeighborhood[key] = true;
		else delete this.#renderNeighborhood[key];
		return active;
	}

	shouldPinPageRaster(paperId: string, pageNumber: number): boolean {
		if (
			(this.selectedPage?.paperId === paperId && this.selectedPage.page === pageNumber) ||
			(this.focusedPaperRegion?.paperId === paperId && this.focusedPaperRegion.page === pageNumber)
		) {
			return true;
		}
		if (
			this.rasterPrewarmTarget?.paperId === paperId &&
			this.rasterPrewarmTarget.page === pageNumber
		) {
			return true;
		}
		const frameTarget = this.presentingFrame?.target;
		if (
			frameTarget?.kind === 'paper-region' &&
			frameTarget.paperId === paperId &&
			frameTarget.page === pageNumber
		) {
			return true;
		}
		if (this.camera.zoom < PAGE_RENDER_ENTER_ZOOM) return false;
		const page = this.pageByNumber(paperId, pageNumber);
		if (!page) return false;
		return pageIntersectsViewport(page, cameraViewportRect(this.camera, this.viewport));
	}

	rasterPrewarmZoom(paperId: string, pageNumber: number): number | null {
		const target = this.rasterPrewarmTarget;
		return target?.paperId === paperId && target.page === pageNumber ? target.zoom : null;
	}

	artifactById(id: string): ArtifactRecord | undefined {
		return this.state.artifacts.find((artifact) => artifact.id === id);
	}

	selectPage(paperId: string | null, page = 1): void {
		if (paperId) {
			const paper = this.paperById(paperId);
			if (!paper) return;
			this.selectedPage = { paperId, page: checkedPage(paper, page) };
		} else {
			this.selectedPage = null;
		}
		this.selectedArtifactId = null;
		this.focusedPaperRegion = null;
		this.rasterPrewarmTarget = null;
	}

	isPageSelected(paperId: string, page: number): boolean {
		return this.selectedPage?.paperId === paperId && this.selectedPage.page === page;
	}

	selectArtifact(id: string | null): void {
		this.selectedArtifactId = id;
		this.selectedPage = null;
		this.focusedPaperRegion = null;
		this.rasterPrewarmTarget = null;
	}

	clearSelection(): void {
		this.selectedPage = null;
		this.selectedArtifactId = null;
		this.focusedPaperRegion = null;
		this.rasterPrewarmTarget = null;
	}

	bringPageToFront(paperId: string, pageNumber: number): void {
		const page = this.pageByNumber(paperId, pageNumber);
		if (!page) return;
		page.zIndex = highestZ(this.state) + 1;
		this.#scheduleSave();
	}

	bringArtifactToFront(id: string): void {
		const artifact = this.artifactById(id);
		if (!artifact) return;
		artifact.zIndex = highestZ(this.state) + 1;
		this.#scheduleSave();
	}

	movePage(paperId: string, pageNumber: number, x: number, y: number, persist = false): void {
		const page = this.pageByNumber(paperId, pageNumber);
		if (!page || this.presentingIndex !== null) return;
		page.x = x;
		page.y = y;
		if (persist) this.#scheduleSave();
	}

	moveArtifact(id: string, x: number, y: number, persist = false): void {
		const artifact = this.artifactById(id);
		if (!artifact) return;
		artifact.x = x;
		artifact.y = y;
		if (persist) this.#scheduleSave();
	}

	resizePage(paperId: string, pageNumber: number, width: number, persist = false): void {
		const page = this.pageByNumber(paperId, pageNumber);
		if (!page || this.presentingIndex !== null) return;
		const aspect = page.height / page.width;
		page.width = Math.min(MAX_ITEM_WIDTH, Math.max(MIN_ITEM_WIDTH, width));
		page.height = page.width * aspect;
		if (persist) this.#scheduleSave();
	}

	resizeArtifact(id: string, width: number, persist = false): void {
		const artifact = this.artifactById(id);
		if (!artifact) return;
		const aspect = artifact.height / artifact.width;
		artifact.width = Math.min(MAX_ITEM_WIDTH, Math.max(MIN_ITEM_WIDTH, width));
		artifact.height = artifact.width * aspect;
		if (persist) this.#scheduleSave();
	}

	async removePaper(id: string): Promise<void> {
		const paper = this.paperById(id);
		if (!paper) return;
		await Promise.all([this.persistence.deletePdf(id), this.pdf.forget(id)]);
		this.state.papers = this.state.papers.filter((entry) => entry.id !== id);
		for (const key of Object.keys(this.#renderNeighborhood)) {
			if (key.startsWith(`${id}:`)) delete this.#renderNeighborhood[key];
		}
		this.#matches = Object.fromEntries(
			Object.entries(this.#matches).filter(([, match]) => match.paperId !== id)
		);
		this.state.artifacts = this.state.artifacts.map((artifact): ArtifactRecord => {
			if (artifact.kind !== 'snapshot' || artifact.source.paperId !== id) return artifact;
			return detachSnapshot(artifact);
		});
		if (this.selectedPage?.paperId === id) this.selectedPage = null;
		if (this.focusedPaperRegion?.paperId === id) this.focusedPaperRegion = null;
		if (this.rasterPrewarmTarget?.paperId === id) this.rasterPrewarmTarget = null;
		this.state.frames = this.state.frames.filter(
			(frame) => frame.target.kind !== 'paper-region' || frame.target.paperId !== id
		);
		if (this.activeSequence) {
			this.activeSequence.frames = this.activeSequence.frames.filter(
				(frame) => frame.target.kind !== 'paper-region' || frame.target.paperId !== id
			);
		}
		this.#reconcilePresentation();
		this.#scheduleSave();
		this.showToast(`${paper.title} removed`);
	}

	async removeArtifact(id: string): Promise<void> {
		const artifact = this.artifactById(id);
		if (!artifact) return;
		if (artifact.kind !== 'plot') await this.persistence.deleteImage(id);
		this.state.artifacts = this.state.artifacts.filter((entry) => entry.id !== id);
		if (this.selectedArtifactId === id) this.selectedArtifactId = null;
		this.state.frames = this.state.frames.filter(
			(frame) => frame.target.kind !== 'artifact' || frame.target.artifactId !== id
		);
		if (this.activeSequence) {
			this.activeSequence.frames = this.activeSequence.frames.filter(
				(frame) => frame.target.kind !== 'artifact' || frame.target.artifactId !== id
			);
		}
		this.#reconcilePresentation();
		this.#scheduleSave();
		this.showToast(`${artifact.title} removed`);
	}

	async artifactImage(id: string): Promise<Blob> {
		const artifact = this.artifactById(id);
		if (!artifact || artifact.kind === 'plot')
			throw new Error('This artifact has no raster image.');
		return this.persistence.getImage(id);
	}

	updateCamera(camera: CameraState, persist = false, animate = false): void {
		if (animate) {
			this.focusedPaperRegion = null;
			this.flyTo(camera, cameraViewportRect(camera, this.viewport), persist);
			return;
		}
		this.cancelCameraFlight();
		this.focusedPaperRegion = null;
		this.state.camera = camera;
		if (persist) this.#scheduleSave();
	}

	cancelCameraFlight(): void {
		if (this.#cameraFlight !== null && typeof cancelAnimationFrame === 'function') {
			cancelAnimationFrame(this.#cameraFlight);
		}
		this.#cameraFlight = null;
		this.cameraAnimating = false;
		this.rasterPrewarmTarget = null;
	}

	flyTo(
		camera: CameraState,
		target: Rect,
		persist = true,
		profile: CameraFlightProfile = 'standard',
		prewarmPage: Pick<RasterPrewarmTarget, 'paperId' | 'page'> | null = null
	): void {
		this.cancelCameraFlight();
		this.rasterPrewarmTarget = prewarmPage ? { ...prewarmPage, zoom: camera.zoom } : null;
		const reduceMotion =
			typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
		if (reduceMotion || typeof requestAnimationFrame !== 'function') {
			this.state.camera = camera;
			if (persist) this.#scheduleSave();
			return;
		}
		const keyframes = cameraFlightKeyframes(this.state.camera, camera, this.viewport, target);
		const duration = cameraFlightDuration(this.state.camera, camera, this.viewport, profile);
		const startedAt = performance.now();
		this.cameraAnimating = true;
		const tick = (now: number) => {
			const elapsed = Math.min(1, (now - startedAt) / duration);
			this.state.camera = sampleCameraFlight(keyframes, elapsed);
			if (elapsed < 1) {
				this.#cameraFlight = requestAnimationFrame(tick);
				return;
			}
			this.#cameraFlight = null;
			this.cameraAnimating = false;
			this.state.camera = camera;
			if (persist) this.#scheduleSave();
		};
		this.#cameraFlight = requestAnimationFrame(tick);
	}

	#animatePageLayout(): void {
		this.pageLayoutAnimating = true;
		if (this.#layoutTimer) clearTimeout(this.#layoutTimer);
		this.#layoutTimer = setTimeout(() => {
			this.pageLayoutAnimating = false;
		}, 720);
	}

	commitCamera(): void {
		this.#scheduleSave();
	}

	focusPage(paperId: string, page: number, source: 'person' | 'agent' = 'person'): PaperRecord {
		const paper = this.focusRegion(paperId, page, { x: 0, y: 0, width: 1, height: 1 }, 0, source);
		this.focusedPaperRegion = null;
		return paper;
	}

	focusRegion(
		paperId: string,
		page: number,
		region: PageRegion,
		padding = 0.06,
		source: 'person' | 'agent' = 'person'
	): PaperRecord {
		const paper = this.paperById(paperId);
		if (!paper) throw new Error(`No paper exists with id ${paperId}.`);
		const checkedPageNumber = checkedPage(paper, page);
		const paperPage = this.pageByNumber(paperId, checkedPageNumber)!;
		const focus = expandedRegion(region, padding);
		const rect = regionToWorldRect(focus, pageRect(paperPage));
		this.selectedPage = null;
		this.selectedArtifactId = null;
		this.focusedPaperRegion = {
			paperId,
			page: checkedPageNumber,
			region: assertPageRegion(region)
		};
		const presenting = this.presentingIndex !== null;
		const landingCamera = fitGuidedTarget(rect, this.viewport, presenting);
		this.flyTo(landingCamera, rect, true, presenting ? 'sequence' : 'standard', {
			paperId,
			page: checkedPageNumber
		});
		if (source === 'agent') {
			this.showToast(`Agent focused page ${page} of ${paper.title}`, 'agent');
		}
		return paper;
	}

	focusMatch(matchId: string, padding = 0.06, source: 'person' | 'agent' = 'agent'): SearchMatch {
		const match = this.#matches[matchId];
		if (!match) throw new Error('The search match is unavailable. Run search_papers again.');
		this.focusRegion(match.paperId, match.page, match.region, padding, source);
		return match;
	}

	refitFocusedRegion(): void {
		const target = this.focusedPaperRegion;
		if (!target) return;
		const page = this.pageByNumber(target.paperId, target.page);
		if (!page) return;
		const rect = regionToWorldRect(expandedRegion(target.region, 0.06), pageRect(page));
		this.cancelCameraFlight();
		this.state.camera = fitGuidedTarget(rect, this.viewport, this.presentingIndex !== null);
		this.rasterPrewarmTarget = {
			paperId: target.paperId,
			page: target.page,
			zoom: this.state.camera.zoom
		};
	}

	focusArtifact(id: string, source: 'person' | 'agent' = 'person'): ArtifactRecord {
		const artifact = this.artifactById(id);
		if (!artifact) throw new Error(`No visual artifact exists with id ${id}.`);
		this.selectedPage = null;
		this.selectedArtifactId = null;
		this.focusedPaperRegion = null;
		this.flyTo(
			fitGuidedTarget(itemRect(artifact), this.viewport, this.presentingIndex !== null),
			itemRect(artifact),
			true,
			this.presentingIndex !== null ? 'sequence' : 'standard'
		);
		if (source === 'agent') this.showToast(`Agent focused ${artifact.title}`, 'agent');
		return artifact;
	}

	fitAll(): void {
		this.focusedPaperRegion = null;
		const bounds = boundsForRects([
			...this.state.papers.flatMap((paper) => paper.pages.map(pageRect)),
			...this.state.artifacts.map(itemRect)
		]);
		const target = bounds ?? { x: -1, y: -1, width: 2, height: 2 };
		this.flyTo(
			bounds ? fitRect(bounds, this.viewport, 64) : { centerX: 0, centerY: 0, zoom: 0.85 },
			target,
			true
		);
	}

	arrange(
		arrangement: Arrangement,
		paperIds?: readonly string[],
		source: 'person' | 'agent' = 'person',
		force = false
	): SpatialMutationResult<PaperRecord[]> {
		const requested = paperIds?.length ? [...paperIds] : null;
		const papers = requested
			? this.state.papers.filter((paper) => requested.includes(paper.id))
			: this.state.papers;
		if (requested && papers.length !== requested.length) {
			throw new Error('One or more paper ids were not found.');
		}
		const drafts = papers.map((paper) => ({
			...paper,
			pages: paper.pages.map((page) => ({ ...page }))
		}));
		for (const paper of drafts) {
			const placements = layoutPaperPages(paper.pages);
			for (const page of paper.pages) {
				const placement = placements.find((entry) => entry.pageNumber === page.pageNumber)!;
				page.x = placement.x;
				page.y = placement.y;
			}
		}
		const placements = arrangePapers(drafts, arrangement);
		for (const paper of drafts) {
			const placement = placements.find((entry) => entry.id === paper.id);
			const bounds = paperBounds(paper);
			if (!placement || !bounds) continue;
			const dx = placement.x - bounds.x;
			const dy = placement.y - bounds.y;
			for (const page of paper.pages) {
				page.x += dx;
				page.y += dy;
			}
		}
		const stationaryPapers = this.state.papers.filter(
			(paper) => !papers.some((selected) => selected.id === paper.id)
		);
		const conflicts = mergeVisualConflicts(
			drafts.flatMap((paper) =>
				paper.pages.flatMap((page) =>
					visualConflicts(pageRect(page), stationaryPapers, this.state.artifacts)
				)
			)
		);
		const result = checkedMutation(papers, conflicts, force);
		for (const paper of papers) {
			const draft = drafts.find((candidate) => candidate.id === paper.id)!;
			for (const page of paper.pages) {
				const next = draft.pages.find((candidate) => candidate.pageNumber === page.pageNumber)!;
				page.x = next.x;
				page.y = next.y;
			}
		}
		this.#animatePageLayout();
		this.#scheduleSave();
		const bounds = boundsForRects(papers.flatMap((paper) => paper.pages.map(pageRect)));
		if (bounds) this.flyTo(fitRect(bounds, this.viewport, 72), bounds, true);
		if (source === 'agent') {
			this.showToast(`Agent arranged ${papers.length} papers as ${arrangement}`, 'agent');
		}
		return result;
	}

	search(query: string, limit = 8, paperId?: string): SearchMatch[] {
		const papers = paperId
			? this.state.papers.filter((paper) => paper.id === paperId)
			: this.state.papers;
		if (paperId && papers.length === 0) throw new Error(`No paper exists with id ${paperId}.`);
		const matches = searchPapers(papers, query, limit);
		const recent = {
			...this.#matches,
			...Object.fromEntries(matches.map((match) => [match.matchId, match]))
		};
		const expired = Object.keys(recent).slice(0, -100);
		for (const matchId of expired) delete recent[matchId];
		this.#matches = recent;
		return matches;
	}

	readPaperPages(
		paperId: string,
		startPage = 1,
		endPage?: number,
		includeBlocks = false,
		maxCharacters?: number
	) {
		const paper = this.paperById(paperId);
		if (!paper) throw new Error(`No paper exists with id ${paperId}.`);
		if (paper.pageIndexes.length === 0) {
			throw new Error(
				'No pages are indexed yet. Retry after inspect_workspace reports indexedPages above zero.'
			);
		}
		const start = checkedPage(paper, startPage);
		if (start > paper.pageIndexes.length) {
			throw new Error(
				`Pages 1 through ${paper.pageIndexes.length} are indexed; requested page ${start} is not ready yet.`
			);
		}
		const end = checkedPage(paper, endPage ?? paper.pageIndexes.length);
		if (end < start) throw new Error('endPage must be greater than or equal to startPage.');
		if (end > paper.pageIndexes.length) {
			throw new Error(
				`Pages 1 through ${paper.pageIndexes.length} are indexed; requested page ${end} is not ready yet.`
			);
		}
		if (maxCharacters !== undefined && (!Number.isInteger(maxCharacters) || maxCharacters < 500)) {
			throw new Error('maxCharacters must be an integer of at least 500.');
		}

		let remaining = maxCharacters ?? Number.POSITIVE_INFINITY;
		let truncated = false;
		const pages: Array<{ page: number; text: string; blocks: PageTextIndex['blocks'] }> = [];
		for (const [offset, index] of paper.pageIndexes.slice(start - 1, end).entries()) {
			if (remaining <= 0) {
				truncated = true;
				break;
			}
			const text = index.text.slice(0, remaining);
			if (text.length < index.text.length) truncated = true;
			pages.push({
				page: start + offset,
				text,
				blocks: includeBlocks ? index.blocks : []
			});
			remaining -= text.length;
			if (truncated) break;
		}

		return {
			pages,
			coverage: {
				startPage: start,
				endPage: end,
				returnedThrough: pages.at(-1)?.page ?? null,
				indexedPages: paper.pageIndexes.length,
				totalPages: paper.pageCount,
				indexingComplete:
					paper.indexStatus === 'ready' && paper.pageIndexes.length === paper.pageCount,
				wholePaper: start === 1 && end === paper.pageCount && !truncated,
				charactersReturned: pages.reduce((total, page) => total + page.text.length, 0),
				truncated
			}
		};
	}

	async snapshotRegion(
		paperId: string,
		page: number,
		region: PageRegion,
		title?: string,
		caption = '',
		scale = 2,
		force = false
	): Promise<SpatialMutationResult<SnapshotArtifactRecord>> {
		const paper = this.paperById(paperId);
		if (!paper) throw new Error(`No paper exists with id ${paperId}.`);
		const checkedPageNumber = checkedPage(paper, page);
		const sourcePage = this.pageByNumber(paperId, checkedPageNumber)!;
		const checkedRegion = assertPageRegion(region);
		const snapshot = await this.pdf.snapshot(paperId, checkedPageNumber, checkedRegion, scale);
		const id = crypto.randomUUID();
		const width = DEFAULT_ARTIFACT_WIDTH;
		const height = width * (snapshot.pixelHeight / snapshot.pixelWidth);
		const bounds = paperBounds(paper)!;
		const artifact: SnapshotArtifactRecord = {
			id,
			kind: 'snapshot',
			title: title?.trim().slice(0, 80) || `${paper.title}, page ${page}`,
			caption: caption.trim().slice(0, 400),
			x: bounds.x + bounds.width + 80,
			y: sourcePage.y + checkedRegion.y * sourcePage.height,
			width,
			height,
			zIndex: highestZ(this.state) + 1,
			createdAt: Date.now(),
			mimeType: 'image/png',
			pixelWidth: snapshot.pixelWidth,
			pixelHeight: snapshot.pixelHeight,
			source: { paperId, page: checkedPageNumber, region: checkedRegion }
		};
		const conflicts = visualConflicts(itemRect(artifact), this.state.papers, this.state.artifacts);
		const result = checkedMutation(artifact, conflicts, force);
		await this.persistence.putImage(id, snapshot.blob);
		this.state.artifacts.push(artifact);
		this.#scheduleSave();
		this.showToast(`Created ${artifact.title}`, 'agent');
		return result;
	}

	async placeImage(
		dataUrl: string,
		title: string,
		caption = '',
		force = false
	): Promise<SpatialMutationResult<ImageArtifactRecord>> {
		const decoded = decodeImageDataUrl(dataUrl);
		const bitmap = await createImageBitmap(decoded.blob);
		const pixelWidth = bitmap.width;
		const pixelHeight = bitmap.height;
		bitmap.close();
		if (pixelWidth <= 0 || pixelHeight <= 0) throw new Error('The image has invalid dimensions.');
		const id = crypto.randomUUID();
		const width = DEFAULT_ARTIFACT_WIDTH;
		const artifact: ImageArtifactRecord = {
			id,
			kind: 'image',
			title: title.trim().slice(0, 80) || 'Generated image',
			caption: caption.trim().slice(0, 400),
			x: this.camera.centerX - width / 2,
			y: this.camera.centerY - (width * pixelHeight) / pixelWidth / 2,
			width,
			height: (width * pixelHeight) / pixelWidth,
			zIndex: highestZ(this.state) + 1,
			createdAt: Date.now(),
			mimeType: decoded.mimeType,
			pixelWidth,
			pixelHeight
		};
		const conflicts = visualConflicts(itemRect(artifact), this.state.papers, this.state.artifacts);
		const result = checkedMutation(artifact, conflicts, force);
		await this.persistence.putImage(id, decoded.blob);
		this.state.artifacts.push(artifact);
		this.#scheduleSave();
		this.showToast(`Agent placed ${artifact.title}`, 'agent');
		return result;
	}

	placePlot(
		title: string,
		caption: string,
		xLabel: string,
		yLabel: string,
		series: PlotSeries[],
		force = false
	): SpatialMutationResult<PlotArtifactRecord> {
		if (series.length < 1 || series.length > 8) throw new Error('Plots require 1 to 8 series.');
		let pointCount = 0;
		const cleanSeries = series.map((entry, index) => {
			if (!entry.name.trim()) throw new Error(`Series ${index + 1} needs a name.`);
			if (entry.points.length < 2)
				throw new Error(`Series ${entry.name} needs at least two points.`);
			pointCount += entry.points.length;
			return {
				name: entry.name.trim().slice(0, 40),
				points: entry.points.map((point) => {
					if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
						throw new Error('Plot points must contain finite x and y values.');
					}
					return { x: point.x, y: point.y };
				})
			};
		});
		if (pointCount > 2000) throw new Error('Plots support at most 2,000 total points.');
		const width = 520;
		const artifact: PlotArtifactRecord = {
			id: crypto.randomUUID(),
			kind: 'plot',
			title: title.trim().slice(0, 80) || 'Derived plot',
			caption: caption.trim().slice(0, 400),
			x: this.camera.centerX - width / 2,
			y: this.camera.centerY - 180,
			width,
			height: 360,
			zIndex: highestZ(this.state) + 1,
			createdAt: Date.now(),
			xLabel: xLabel.trim().slice(0, 60),
			yLabel: yLabel.trim().slice(0, 60),
			series: cleanSeries
		};
		const conflicts = visualConflicts(itemRect(artifact), this.state.papers, this.state.artifacts);
		const result = checkedMutation(artifact, conflicts, force);
		this.state.artifacts.push(artifact);
		this.#scheduleSave();
		this.showToast(`Agent placed ${artifact.title}`, 'agent');
		return result;
	}

	#validateTarget(target: FrameTarget): FrameTarget {
		if (target.kind === 'paper-region') {
			const paper = this.paperById(target.paperId);
			if (!paper) throw new Error(`No paper exists with id ${target.paperId}.`);
			return {
				kind: 'paper-region',
				paperId: target.paperId,
				page: checkedPage(paper, target.page),
				region: assertPageRegion(target.region)
			};
		}
		if (!this.artifactById(target.artifactId)) {
			throw new Error(`No visual artifact exists with id ${target.artifactId}.`);
		}
		return { kind: 'artifact', artifactId: target.artifactId };
	}

	#sequencePageOrigins(frames: readonly FrameRecord[]): SequencePageOrigin[] {
		const seen: string[] = [];
		const origins: SequencePageOrigin[] = [];
		for (const frame of frames) {
			if (frame.target.kind !== 'paper-region') continue;
			const key = pageKey(frame.target.paperId, frame.target.page);
			if (seen.includes(key)) continue;
			seen.push(key);
			const page = this.pageByNumber(frame.target.paperId, frame.target.page);
			if (!page) throw new Error('A sequence page is no longer available.');
			origins.push({
				paperId: frame.target.paperId,
				page: frame.target.page,
				x: page.x,
				y: page.y,
				width: page.width,
				height: page.height,
				zIndex: page.zIndex
			});
		}
		return origins;
	}

	#stageSequencePages(origins: readonly SequencePageOrigin[]): void {
		if (origins.length === 0) return;
		const paperIds = origins
			.map((origin) => origin.paperId)
			.filter((paperId, index, values) => values.indexOf(paperId) === index);
		const relatedBounds = boundsForRects(
			paperIds.flatMap((paperId) => this.paperById(paperId)?.pages.map(pageRect) ?? [])
		);
		if (!relatedBounds) return;
		const shapes = origins.map((origin, index) => ({
			pageNumber: index + 1,
			width: origin.width,
			height: origin.height
		}));
		const placements = layoutPaperPages(shapes, {
			x: relatedBounds.x + relatedBounds.width + PAPER_GAP,
			y: relatedBounds.y
		});
		const stagedBounds = boundsForRects(
			placements.map((placement, index) => ({
				x: placement.x,
				y: placement.y,
				width: shapes[index]!.width,
				height: shapes[index]!.height
			}))
		)!;
		const horizontalOffset = clearHorizontalOffset(stagedBounds, [
			...this.state.papers.flatMap((paper) => paper.pages.map(pageRect)),
			...this.state.artifacts.map(itemRect)
		]);
		const zBase = highestZ(this.state) + 1;
		for (const [index, origin] of origins.entries()) {
			const page = this.pageByNumber(origin.paperId, origin.page);
			const placement = placements[index];
			if (!page || !placement) continue;
			page.x = placement.x + horizontalOffset;
			page.y = placement.y;
			page.zIndex = zBase + index;
		}
		this.#animatePageLayout();
	}

	#restoreSequenceLayout(sequence: ActiveSequence): void {
		for (const origin of sequence.pageOrigins) {
			const page = this.pageByNumber(origin.paperId, origin.page);
			if (!page) continue;
			page.x = origin.x;
			page.y = origin.y;
			page.width = origin.width;
			page.height = origin.height;
			page.zIndex = origin.zIndex;
		}
		this.#animatePageLayout();
	}

	#applyTarget(target: FrameTarget, source: 'person' | 'agent' = 'person'): void {
		if (target.kind === 'paper-region') {
			this.focusRegion(target.paperId, target.page, target.region, 0.055, source);
		} else {
			this.focusArtifact(target.artifactId, source);
		}
	}

	#reconcilePresentation(): void {
		if (this.presentingIndex === null) return;
		if (!this.activeSequence || this.activeSequence.frames.length === 0) {
			this.stopPresentation();
			return;
		}
		this.presentingIndex = Math.min(this.presentingIndex, this.activeSequence.frames.length - 1);
		const frame = this.activeSequence.frames[this.presentingIndex];
		if (frame) this.#applyTarget(frame.target);
	}

	presentSequence(
		name: string,
		inputs: readonly SequenceFrameInput[],
		startAt = 1,
		save = false,
		source: 'person' | 'agent' = 'agent'
	): FrameRecord[] {
		if (inputs.length < 1 || inputs.length > 20) {
			throw new Error('A presentation sequence requires 1 to 20 frames.');
		}
		if (!Number.isInteger(startAt) || startAt < 1 || startAt > inputs.length) {
			throw new Error(`startAt must be an integer between 1 and ${inputs.length}.`);
		}
		const frames = inputs.map((input, index) => ({
			id: crypto.randomUUID(),
			name: input.name?.trim().slice(0, 80) || `Step ${index + 1}`,
			caption: input.caption?.trim().slice(0, 400) || '',
			createdAt: Date.now() + index,
			target: this.#validateTarget(input.target)
		}));
		const sequenceName = name.trim().slice(0, 80) || 'Guided reading';
		if (save) {
			this.state.sequenceName = sequenceName;
			this.state.frames = frames;
			this.#scheduleSave();
		}
		if (this.activeSequence) this.#restoreSequenceLayout(this.activeSequence);
		const pageOrigins = this.#sequencePageOrigins(frames);
		this.activeSequence = {
			name: sequenceName,
			frames,
			temporary: !save,
			originalCamera: { ...this.state.camera },
			pageOrigins
		};
		this.#stageSequencePages(pageOrigins);
		this.framesOpen = false;
		this.presentingIndex = startAt - 1;
		this.#applyTarget(frames[this.presentingIndex]!.target, source);
		if (source === 'agent') this.showToast(`Agent prepared ${frames.length} guided views`, 'agent');
		return frames;
	}

	keepActiveSequence(): void {
		if (!this.activeSequence?.temporary) return;
		this.state.sequenceName = this.activeSequence.name;
		this.state.frames = $state.snapshot(this.activeSequence.frames);
		this.activeSequence = {
			name: this.state.sequenceName,
			frames: this.state.frames,
			temporary: false,
			originalCamera: this.activeSequence.originalCamera,
			pageOrigins: this.activeSequence.pageOrigins
		};
		this.#scheduleSave();
		this.showToast('Sequence kept in this workspace.');
	}

	updateFrame(id: string, patch: Partial<Pick<FrameRecord, 'name' | 'caption'>>): void {
		const frame = this.state.frames.find((entry) => entry.id === id);
		if (!frame) return;
		if (patch.name !== undefined && patch.name.trim()) frame.name = patch.name.trim().slice(0, 80);
		if (patch.caption !== undefined) frame.caption = patch.caption.trim().slice(0, 400);
		this.#scheduleSave();
	}

	removeFrame(id: string): void {
		const index = this.state.frames.findIndex((entry) => entry.id === id);
		if (index < 0) return;
		this.state.frames.splice(index, 1);
		this.#scheduleSave();
	}

	moveFrame(id: string, delta: -1 | 1): void {
		const index = this.state.frames.findIndex((entry) => entry.id === id);
		const target = index + delta;
		if (index < 0 || target < 0 || target >= this.state.frames.length) return;
		const [frame] = this.state.frames.splice(index, 1);
		if (frame) this.state.frames.splice(target, 0, frame);
		this.#scheduleSave();
	}

	goToFrame(selector: number | string): FrameRecord {
		const index =
			typeof selector === 'number'
				? Math.max(0, Math.min(this.state.frames.length - 1, Math.round(selector)))
				: this.state.frames.findIndex((frame) => frame.id === selector);
		const frame = this.state.frames[index];
		if (!frame) throw new Error('The requested frame does not exist.');
		this.#applyTarget(frame.target);
		return frame;
	}

	startPresentation(index = 0): FrameRecord {
		if (this.state.frames.length === 0) throw new Error('No saved sequence is available.');
		if (this.activeSequence) this.#restoreSequenceLayout(this.activeSequence);
		const pageOrigins = this.#sequencePageOrigins(this.state.frames);
		this.activeSequence = {
			name: this.state.sequenceName,
			frames: this.state.frames,
			temporary: false,
			originalCamera: { ...this.state.camera },
			pageOrigins
		};
		this.#stageSequencePages(pageOrigins);
		this.presentingIndex = Math.max(0, Math.min(this.state.frames.length - 1, index));
		const frame = this.presentationFrames[this.presentingIndex]!;
		this.#applyTarget(frame.target);
		return frame;
	}

	stepPresentation(delta: -1 | 1): void {
		if (this.presentingIndex === null) return;
		const next = Math.max(
			0,
			Math.min(this.presentationFrames.length - 1, this.presentingIndex + delta)
		);
		this.presentingIndex = next;
		const frame = this.presentationFrames[next];
		if (frame) this.#applyTarget(frame.target);
	}

	stopPresentation(): void {
		const sequence = this.activeSequence;
		if (sequence) {
			this.#restoreSequenceLayout(sequence);
			this.focusedPaperRegion = null;
			this.flyTo(
				sequence.originalCamera,
				cameraViewportRect(sequence.originalCamera, this.viewport),
				false,
				'sequence'
			);
		}
		this.presentingIndex = null;
		this.activeSequence = null;
	}

	frameTargetLabel(frame: FrameRecord): string {
		if (frame.target.kind === 'artifact') {
			return this.artifactById(frame.target.artifactId)?.title ?? 'Missing visual';
		}
		const paper = this.paperById(frame.target.paperId);
		return `${paper?.title ?? 'Missing paper'} · p. ${frame.target.page}`;
	}

	rename(name: string): void {
		const clean = name.trim().slice(0, 80);
		if (!clean) return;
		this.state.name = clean;
		this.#scheduleSave();
	}

	async dispose(): Promise<void> {
		if (this.#saveTimer) {
			clearTimeout(this.#saveTimer);
			this.#saveTimer = null;
			await this.saveNow();
		}
		if (this.#toastTimer) clearTimeout(this.#toastTimer);
		if (this.#layoutTimer) clearTimeout(this.#layoutTimer);
		this.cancelCameraFlight();
		await this.pdf.destroy();
	}
}

export const workspace = new Workspace();
