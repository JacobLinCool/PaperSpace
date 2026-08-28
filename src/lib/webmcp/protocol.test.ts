import { describe, expect, it } from 'vitest';
import { PAPERSPACE_AGENT_PROTOCOL, PAPERSPACE_PREPARATION_PROMPT } from './protocol';

describe('PaperSpace agent delivery protocol', () => {
	it('makes the workspace the default delivery surface for substantive paper work', () => {
		expect(PAPERSPACE_AGENT_PROTOCOL).toEqual(
			expect.arrayContaining([
				expect.stringContaining('primary interaction and delivery surface'),
				expect.stringContaining('do not stop at a chat summary'),
				expect.stringContaining('simple localized Q&A'),
				expect.stringContaining('Prefer original paper-region frames')
			])
		);
	});

	it('puts the same delivery rule in the copyable preparation prompt', () => {
		expect(PAPERSPACE_PREPARATION_PROMPT).toContain(
			'Treat PaperSpace as the primary interaction and delivery surface'
		);
		expect(PAPERSPACE_PREPARATION_PROMPT).toContain('call present_sequence');
		expect(PAPERSPACE_PREPARATION_PROMPT).toContain('simple localized Q&A');
	});
});
