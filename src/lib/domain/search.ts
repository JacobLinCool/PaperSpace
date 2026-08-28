import { unionRegions } from './region';
import type { PaperRecord, SearchMatch, TextBlock } from './types';

function normalize(value: string): string {
	return value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
}

function snippet(source: string, needle: string): string {
	const normalized = normalize(source);
	const offset = normalized.indexOf(needle);
	if (offset < 0) return source.replace(/\s+/g, ' ').trim().slice(0, 280);
	const start = Math.max(0, offset - 110);
	const end = Math.min(normalized.length, offset + needle.length + 160);
	return `${start > 0 ? '…' : ''}${normalized.slice(start, end)}${end < normalized.length ? '…' : ''}`;
}

interface IndexedBlock {
	block: TextBlock;
	text: string;
	start: number;
	end: number;
}

function indexBlocks(blocks: readonly TextBlock[]): { text: string; blocks: IndexedBlock[] } {
	const indexed: IndexedBlock[] = [];
	let text = '';
	for (const block of blocks) {
		const normalized = normalize(block.text);
		if (!normalized) continue;
		if (text) text += ' ';
		const start = text.length;
		text += normalized;
		indexed.push({ block, text: normalized, start, end: text.length });
	}
	return { text, blocks: indexed };
}

function matchingBlocks(
	indexed: IndexedBlock[],
	exactOffset: number,
	length: number,
	terms: string[]
): TextBlock[] {
	if (exactOffset >= 0) {
		const end = exactOffset + length;
		const exact = indexed
			.filter((entry) => entry.end > exactOffset && entry.start < end)
			.map((entry) => entry.block);
		if (exact.length > 0) return exact;
	}
	const termBlocks = indexed
		.filter((entry) => terms.some((term) => entry.text.includes(term)))
		.slice(0, 12)
		.map((entry) => entry.block);
	return termBlocks.length > 0 ? termBlocks : indexed.slice(0, 1).map((entry) => entry.block);
}

export function searchPapers(
	papers: readonly PaperRecord[],
	query: string,
	limit = 8
): SearchMatch[] {
	const needle = normalize(query);
	if (!needle) return [];
	const terms = needle.split(' ').filter(Boolean);
	const matches: SearchMatch[] = [];

	for (const paper of papers) {
		for (const [pageIndex, page] of paper.pageIndexes.entries()) {
			const indexed = indexBlocks(page.blocks);
			const haystack = indexed.text || normalize(page.text);
			const exactOffset = haystack.indexOf(needle);
			const termOffsets = terms.map((term) => haystack.indexOf(term));
			if (exactOffset < 0 && termOffsets.some((offset) => offset < 0)) continue;
			const occurrences = terms.reduce((total, term) => {
				let count = 0;
				let cursor = 0;
				while ((cursor = haystack.indexOf(term, cursor)) >= 0) {
					count += 1;
					cursor += term.length;
				}
				return total + count;
			}, 0);
			const blocks = matchingBlocks(indexed.blocks, exactOffset, needle.length, terms);
			const pageNumber = pageIndex + 1;
			const anchor = exactOffset >= 0 ? exactOffset : Math.min(...termOffsets);
			matches.push({
				matchId: `${paper.id}:${pageNumber}:${anchor}`,
				paperId: paper.id,
				title: paper.title,
				page: pageNumber,
				score: (exactOffset >= 0 ? 100 : 30) + Math.min(occurrences, 20),
				quote: snippet(page.text || haystack, needle),
				region: unionRegions(blocks.map((block) => block.region)),
				blocks
			});
		}
	}

	return matches
		.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title) || a.page - b.page)
		.slice(0, Math.max(1, Math.min(20, limit)));
}
