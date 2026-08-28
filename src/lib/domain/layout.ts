import { boundsForRects, type Rect } from './camera';
import type { Arrangement, PaperPageRecord, PaperRecord } from './types';

export const PAGE_GAP = 64;
export const PAPER_GAP = 168;
export const DEFAULT_PAGE_WIDTH = 360;

export interface PagePlacement {
	pageNumber: number;
	x: number;
	y: number;
}

export interface PaperPlacement {
	id: string;
	x: number;
	y: number;
}

export function pageRect(page: PaperPageRecord): Rect {
	return { x: page.x, y: page.y, width: page.width, height: page.height };
}

export function paperBounds(paper: PaperRecord): Rect | null {
	return boundsForRects(paper.pages.map(pageRect));
}

export function pageGridColumns(pageCount: number): number {
	if (pageCount <= 1) return 1;
	return Math.min(6, Math.max(2, Math.ceil(Math.sqrt(pageCount * 1.12))));
}

export function layoutPaperPages(
	pages: readonly Pick<PaperPageRecord, 'pageNumber' | 'width' | 'height'>[],
	origin = { x: 0, y: 0 }
): PagePlacement[] {
	if (pages.length === 0) return [];
	const ordered = [...pages].sort((a, b) => a.pageNumber - b.pageNumber);
	const columns = pageGridColumns(ordered.length);
	const columnWidths = Array.from({ length: columns }, () => 0);
	const rowHeights: number[] = [];
	for (const [index, page] of ordered.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		columnWidths[column] = Math.max(columnWidths[column] ?? 0, page.width);
		rowHeights[row] = Math.max(rowHeights[row] ?? 0, page.height);
	}
	const columnOffsets = columnWidths.map((_, index) =>
		columnWidths.slice(0, index).reduce((sum, width) => sum + width + PAGE_GAP, origin.x)
	);
	const rowOffsets = rowHeights.map((_, index) =>
		rowHeights.slice(0, index).reduce((sum, height) => sum + height + PAGE_GAP, origin.y)
	);
	return ordered.map((page, index) => ({
		pageNumber: page.pageNumber,
		x: columnOffsets[index % columns] ?? origin.x,
		y: rowOffsets[Math.floor(index / columns)] ?? origin.y
	}));
}

export function arrangePapers(
	papers: readonly PaperRecord[],
	arrangement: Arrangement
): PaperPlacement[] {
	const groups = papers
		.map((paper) => ({ paper, bounds: paperBounds(paper) }))
		.filter((entry): entry is { paper: PaperRecord; bounds: Rect } => entry.bounds !== null)
		.sort(
			(a, b) => a.paper.importedAt - b.paper.importedAt || a.paper.id.localeCompare(b.paper.id)
		);
	if (groups.length === 0) return [];

	if (arrangement === 'row') {
		let x = 0;
		return groups.map(({ paper, bounds }) => {
			const placement = { id: paper.id, x, y: -bounds.height / 2 };
			x += bounds.width + PAPER_GAP;
			return placement;
		});
	}

	const columns =
		arrangement === 'columns' ? Math.min(3, groups.length) : Math.ceil(Math.sqrt(groups.length));
	const columnWidths = Array.from({ length: columns }, () => 0);
	const rowHeights: number[] = [];
	for (const [index, { bounds }] of groups.entries()) {
		const column = index % columns;
		const row = Math.floor(index / columns);
		columnWidths[column] = Math.max(columnWidths[column] ?? 0, bounds.width);
		rowHeights[row] = Math.max(rowHeights[row] ?? 0, bounds.height);
	}
	const columnOffsets = columnWidths.map((_, index) =>
		columnWidths.slice(0, index).reduce((sum, width) => sum + width + PAPER_GAP, 0)
	);
	const rowOffsets = rowHeights.map((_, index) =>
		rowHeights.slice(0, index).reduce((sum, height) => sum + height + PAPER_GAP, 0)
	);
	return groups.map(({ paper }, index) => ({
		id: paper.id,
		x: columnOffsets[index % columns] ?? 0,
		y: rowOffsets[Math.floor(index / columns)] ?? 0
	}));
}
