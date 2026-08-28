export const WORKSPACE_VERSION = 3 as const;

export interface CameraState {
	centerX: number;
	centerY: number;
	zoom: number;
}

export interface PageRegion {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface TextBlock {
	text: string;
	region: PageRegion;
}

export interface PageTextIndex {
	text: string;
	blocks: TextBlock[];
}

export interface PaperPageRecord {
	pageNumber: number;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
}

export interface PaperRecord {
	id: string;
	filename: string;
	title: string;
	author: string | null;
	fileSize: number;
	pageCount: number;
	pages: PaperPageRecord[];
	importedAt: number;
	pageIndexes: PageTextIndex[];
	indexStatus: 'pending' | 'indexing' | 'ready' | 'failed';
	indexedPages: number;
}

interface ArtifactBase {
	id: string;
	title: string;
	caption: string;
	x: number;
	y: number;
	width: number;
	height: number;
	zIndex: number;
	createdAt: number;
}

export interface SnapshotArtifactRecord extends ArtifactBase {
	kind: 'snapshot';
	mimeType: 'image/png';
	pixelWidth: number;
	pixelHeight: number;
	source: {
		paperId: string;
		page: number;
		region: PageRegion;
	};
}

export interface ImageArtifactRecord extends ArtifactBase {
	kind: 'image';
	mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
	pixelWidth: number;
	pixelHeight: number;
}

export interface PlotPoint {
	x: number;
	y: number;
}

export interface PlotSeries {
	name: string;
	points: PlotPoint[];
}

export interface PlotArtifactRecord extends ArtifactBase {
	kind: 'plot';
	xLabel: string;
	yLabel: string;
	series: PlotSeries[];
}

export type ArtifactRecord = SnapshotArtifactRecord | ImageArtifactRecord | PlotArtifactRecord;

export type FrameTarget =
	| {
			kind: 'paper-region';
			paperId: string;
			page: number;
			region: PageRegion;
	  }
	| {
			kind: 'artifact';
			artifactId: string;
	  };

export interface FrameRecord {
	id: string;
	name: string;
	caption: string;
	createdAt: number;
	target: FrameTarget;
}

export interface WorkspaceState {
	version: typeof WORKSPACE_VERSION;
	name: string;
	sequenceName: string;
	camera: CameraState;
	papers: PaperRecord[];
	artifacts: ArtifactRecord[];
	frames: FrameRecord[];
	updatedAt: number;
}

export interface SearchMatch {
	matchId: string;
	paperId: string;
	title: string;
	page: number;
	score: number;
	quote: string;
	region: PageRegion;
	blocks: TextBlock[];
}

export type Arrangement = 'grid' | 'row' | 'columns';

export function createEmptyWorkspace(now = Date.now()): WorkspaceState {
	return {
		version: WORKSPACE_VERSION,
		name: 'My reading desk',
		sequenceName: 'Saved sequence',
		camera: { centerX: 0, centerY: 0, zoom: 0.85 },
		papers: [],
		artifacts: [],
		frames: [],
		updatedAt: now
	};
}
