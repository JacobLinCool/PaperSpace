import type { PaperRecord, WorkspaceState } from '$lib/domain/types';

const MAX_BRIEFED_PAGES = 24;
const MAX_EXCERPT_CHARACTERS = 180;
const MAX_SOURCE_CUES = 6;
const SOURCE_CUE_PATTERN =
	/\b(?:fig(?:ure)?\.?|table|algorithm|equation|eq\.?)\s*(?:[a-z]?\d+(?:[.-]\d+)*[a-z]?|[ivxlcdm]+)\b/giu;

function compactText(text: string): string {
	return text.replace(/\s+/g, ' ').trim();
}

function sampledPageIndexes(pageCount: number): number[] {
	if (pageCount <= MAX_BRIEFED_PAGES) return Array.from({ length: pageCount }, (_, index) => index);
	const indexes = new Set<number>();
	for (let index = 0; index < MAX_BRIEFED_PAGES; index += 1) {
		indexes.add(Math.round((index * (pageCount - 1)) / (MAX_BRIEFED_PAGES - 1)));
	}
	return [...indexes].sort((first, second) => first - second);
}

export function sourceCues(text: string): string[] {
	const unique = new Map<string, string>();
	for (const match of text.matchAll(SOURCE_CUE_PATTERN)) {
		const cue = compactText(match[0]);
		const key = cue
			.toLocaleLowerCase()
			.replace(/^fig(?:ure)?\.?/, 'figure')
			.replace(/^eq\.?/, 'equation');
		if (!unique.has(key)) unique.set(key, cue);
		if (unique.size >= MAX_SOURCE_CUES) break;
	}
	return [...unique.values()];
}

export function paperContentBrief(paper: PaperRecord) {
	const availablePages = paper.pageIndexes.length;
	const briefedIndexes = sampledPageIndexes(availablePages);
	return {
		status: paper.indexStatus,
		availablePageRange: availablePages > 0 ? { start: 1, end: availablePages } : null,
		indexedPages: availablePages,
		pageCount: paper.pageCount,
		complete: paper.indexStatus === 'ready' && availablePages === paper.pageCount,
		pageBriefs: briefedIndexes.map((index) => {
			const page = paper.pageIndexes[index]!;
			const text = compactText(page.text);
			return {
				page: index + 1,
				characters: page.text.length,
				excerpt:
					text.length > MAX_EXCERPT_CHARACTERS
						? `${text.slice(0, MAX_EXCERPT_CHARACTERS - 1).trimEnd()}…`
						: text,
				sourceCues: sourceCues(page.text)
			};
		}),
		sampled: availablePages > briefedIndexes.length,
		omittedIndexedPages: availablePages - briefedIndexes.length
	};
}

function revisionHash(value: string): string {
	let hash = 2_166_136_261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16_777_619);
	}
	return (hash >>> 0).toString(36);
}

export function briefingRevision(state: WorkspaceState): string {
	const signature = JSON.stringify({
		papers: state.papers.map((paper) => [
			paper.id,
			paper.title,
			paper.author,
			paper.pageCount,
			paper.indexStatus,
			paper.pageIndexes.length
		]),
		artifacts: state.artifacts.map((artifact) => [
			artifact.id,
			artifact.kind,
			artifact.title,
			artifact.caption
		]),
		frames: state.frames.map((frame) => [frame.id, frame.name, frame.caption, frame.target])
	});
	return revisionHash(signature);
}

export function workspaceReadiness(papers: readonly PaperRecord[], importingCount: number) {
	const totalPages = papers.reduce((total, paper) => total + paper.pageCount, 0);
	const indexedPages = papers.reduce((total, paper) => total + paper.pageIndexes.length, 0);
	const failedPapers = papers
		.filter((paper) => paper.indexStatus === 'failed')
		.map((paper) => paper.id);
	const indexingPapers = papers
		.filter((paper) => paper.indexStatus === 'pending' || paper.indexStatus === 'indexing')
		.map((paper) => paper.id);
	const complete = papers.length > 0 && indexedPages === totalPages && failedPapers.length === 0;
	const status =
		papers.length === 0 && importingCount === 0
			? 'empty'
			: complete
				? 'ready'
				: indexedPages > 0
					? 'partial'
					: failedPapers.length > 0
						? 'failed'
						: 'indexing';
	return {
		status,
		questionReady: indexedPages > 0,
		indexedPages,
		totalPages,
		indexingPapers,
		failedPapers,
		message:
			status === 'ready'
				? 'Compact paper briefs are ready. Search or read only the pages needed for the question.'
				: status === 'partial'
					? 'Indexed pages are searchable now. Do not wait for the full paper unless the question needs an unavailable page.'
					: status === 'indexing'
						? 'Text indexing is in progress. Do not poll; a later search will use every page available at that moment and report exact coverage.'
						: status === 'empty'
							? 'Import at least one PDF before preparing the desk.'
							: 'Some paper indexes failed. Questions can use any pages already listed as available.'
	};
}
