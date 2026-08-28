export const PAPERSPACE_AGENT_PROTOCOL = [
	'Reuse this compact briefing while briefingRevision is unchanged.',
	'When paper text is needed, read the broadest useful range once. Whole-paper reads are allowed; do not split one intended read into repeated page batches.',
	'Use search_papers when only a specific passage or focusable source region is needed.',
	'PaperSpace is the primary interaction and delivery surface whenever it is available for a paper task.',
	'For an introduction, explanation, review, comparison, or any answer grounded across multiple paper regions, do not stop at a chat summary. Call present_sequence with captioned original paper-region frames and keep chat concise and supporting.',
	'For one grounded passage, use focus_region. A chat-only answer is appropriate only for simple localized Q&A or when the person explicitly requests text-only.',
	'Prefer original paper-region frames. Add a snapshot, plot, or image only when source regions and captions cannot resolve a stated comprehension gap.',
	'Visual mutations preflight layout conflicts. Retry with force: true only when covering or crowding source material is intentional.'
] as const;

export const PAPERSPACE_PREPARATION_PROMPT =
	'Prepare this PaperSpace desk for fast follow-up questions. Call inspect_workspace once, cache its briefingRevision and compact paper briefs, and do not change the desk. Treat PaperSpace as the primary interaction and delivery surface for paper work. When a later question requires paper text, read the broadest useful range in one read_paper_pages call; whole-paper reads are allowed and should not be split into repeated calls. Use search_papers for a specific passage and focus_region for one grounded source location. For introductions, explanations, reviews, comparisons, or answers grounded across multiple paper regions, call present_sequence with captioned original paper-region frames instead of stopping at a chat summary; keep chat concise and supporting. A chat-only answer is appropriate only for simple localized Q&A or when I explicitly request text-only. Add a snapshot, plot, or image only when the original regions and captions cannot resolve a stated comprehension gap. Report current readiness in one sentence, then wait for my questions.';
