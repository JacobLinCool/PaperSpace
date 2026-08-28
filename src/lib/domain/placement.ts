import type { Rect } from './camera';
import type { ArtifactRecord, PaperRecord } from './types';

export const VISUAL_CLEARANCE = 24;

export type VisualConflict =
	| {
			kind: 'paper-page';
			paperId: string;
			paperTitle: string;
			page: number;
			relation: 'overlap' | 'clearance';
			overlapRatio: number;
	  }
	| {
			kind: 'artifact';
			artifactId: string;
			title: string;
			relation: 'overlap' | 'clearance';
			overlapRatio: number;
	  };

function intersectionArea(first: Rect, second: Rect): number {
	const width = Math.max(
		0,
		Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x)
	);
	const height = Math.max(
		0,
		Math.min(first.y + first.height, second.y + second.height) - Math.max(first.y, second.y)
	);
	return width * height;
}

function expanded(rect: Rect, clearance: number): Rect {
	return {
		x: rect.x - clearance,
		y: rect.y - clearance,
		width: rect.width + clearance * 2,
		height: rect.height + clearance * 2
	};
}

export function clearHorizontalOffset(
	candidate: Rect,
	obstacles: readonly Rect[],
	clearance = VISUAL_CLEARANCE
): number {
	let x = candidate.x;
	for (let pass = 0; pass <= obstacles.length; pass += 1) {
		const placed = { ...candidate, x };
		const blocking = obstacles.filter(
			(obstacle) => intersectionArea(expanded(placed, clearance), obstacle) > 0
		);
		if (blocking.length === 0) return x - candidate.x;
		x = Math.max(...blocking.map((obstacle) => obstacle.x + obstacle.width + clearance));
	}
	throw new Error('A clear horizontal placement could not be resolved.');
}

function conflictRelation(
	candidate: Rect,
	obstacle: Rect,
	clearance: number
): { relation: VisualConflict['relation']; overlapRatio: number } | null {
	const overlap = intersectionArea(candidate, obstacle);
	if (overlap > 0) {
		return {
			relation: 'overlap',
			overlapRatio:
				overlap / Math.min(candidate.width * candidate.height, obstacle.width * obstacle.height)
		};
	}
	if (intersectionArea(expanded(candidate, clearance), obstacle) > 0) {
		return { relation: 'clearance', overlapRatio: 0 };
	}
	return null;
}

export function visualConflicts(
	candidate: Rect,
	papers: readonly PaperRecord[],
	artifacts: readonly ArtifactRecord[],
	clearance = VISUAL_CLEARANCE
): VisualConflict[] {
	const conflicts: VisualConflict[] = [];
	for (const paper of papers) {
		for (const page of paper.pages) {
			const relation = conflictRelation(candidate, page, clearance);
			if (!relation) continue;
			conflicts.push({
				kind: 'paper-page',
				paperId: paper.id,
				paperTitle: paper.title,
				page: page.pageNumber,
				...relation
			});
		}
	}
	for (const artifact of artifacts) {
		const relation = conflictRelation(candidate, artifact, clearance);
		if (!relation) continue;
		conflicts.push({
			kind: 'artifact',
			artifactId: artifact.id,
			title: artifact.title,
			...relation
		});
	}
	return conflicts.sort(
		(first, second) =>
			Number(second.relation === 'overlap') - Number(first.relation === 'overlap') ||
			second.overlapRatio - first.overlapRatio
	);
}

export function mergeVisualConflicts(conflicts: readonly VisualConflict[]): VisualConflict[] {
	const unique = new Map<string, VisualConflict>();
	for (const conflict of conflicts) {
		const key =
			conflict.kind === 'paper-page'
				? `paper:${conflict.paperId}:${conflict.page}`
				: `artifact:${conflict.artifactId}`;
		const previous = unique.get(key);
		if (
			!previous ||
			conflict.relation === 'overlap' ||
			conflict.overlapRatio > previous.overlapRatio
		) {
			unique.set(key, conflict);
		}
	}
	return [...unique.values()];
}

export class VisualConflictError extends Error {
	readonly code = 'VISUAL_CONFLICT';

	constructor(readonly conflicts: readonly VisualConflict[]) {
		const first = conflicts[0];
		const target =
			first?.kind === 'paper-page'
				? `paper “${first.paperTitle}”, page ${first.page}`
				: first?.kind === 'artifact'
					? `visual “${first.title}”`
					: 'existing desk content';
		super(
			`VISUAL_CONFLICT: This operation would ${first?.relation === 'clearance' ? 'crowd' : 'cover'} ${target}. No changes were made. Retry with force: true only when that visual disruption is intentional.`
		);
		this.name = 'VisualConflictError';
	}
}
