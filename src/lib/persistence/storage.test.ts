import { describe, expect, it } from 'vitest';
import { createEmptyWorkspace } from '$lib/domain/types';
import { IncompatibleWorkspaceError, validateWorkspaceState } from './storage';

describe('workspace persistence validation', () => {
	it('accepts the canonical current workspace', () => {
		const workspace = createEmptyWorkspace(123);
		expect(validateWorkspaceState(workspace)).toEqual(workspace);
	});

	it('rejects an unsupported workspace version', () => {
		try {
			validateWorkspaceState({ ...createEmptyWorkspace(), version: 1 });
			expect.unreachable('Expected an incompatible workspace error.');
		} catch (error) {
			expect(error).toBeInstanceOf(IncompatibleWorkspaceError);
			expect(error).toMatchObject({ savedVersion: 1 });
		}
	});

	it('rejects the collapsed v2 paper schema instead of migrating it', () => {
		const legacy = {
			...createEmptyWorkspace(),
			version: 2,
			papers: [
				{
					id: 'legacy-paper',
					pageCount: 2,
					currentPage: 1,
					x: 0,
					y: 0,
					width: 420,
					height: 594
				}
			]
		};
		expect(() => validateWorkspaceState(legacy)).toThrow('unsupported data version');
	});

	it('rejects a frame whose semantic target is missing', () => {
		const workspace = createEmptyWorkspace(123);
		workspace.frames.push({
			id: 'frame-1',
			name: 'Missing result',
			caption: '',
			createdAt: 123,
			target: { kind: 'artifact', artifactId: 'missing-artifact' }
		});
		expect(() => validateWorkspaceState(workspace)).toThrow(
			'A saved frame refers to a missing visual artifact.'
		);
	});
});
