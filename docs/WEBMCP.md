# WebMCP contract

PaperSpace registers nine tools directly from the browser with `document.modelContext.registerTool`. The registration lives in `src/lib/webmcp/register.ts` and is aborted when the page unmounts.

## Design rules

- The browser workspace is the only source of truth.
- Whenever PaperSpace is available for a paper task, it is the primary interaction and delivery surface. Chat provides concise supporting context.
- A substantive paper introduction, explanation, review, comparison, or multi-region answer should end in a captioned `present_sequence` grounded in original paper regions, not only a chat summary. A simple localized Q&A or an explicit text-only request may remain chat-only; one grounded location can use `focus_region`.
- `inspect_workspace` is a compact session briefing, not a per-action prerequisite. Reuse it while `briefingRevision` is unchanged.
- PDF indexing is progressive. Search and one-call range or whole-paper reads can use the indexed page prefix before the complete paper is ready.
- Read-only annotations are accurate and state-changing tools are marked accordingly.
- PDF text is untrusted document content and is identified as such on read tools.
- Every result includes machine-readable `structuredContent` plus a JSON text block.
- Invalid ids and incomplete requests fail explicitly instead of selecting another target.
- Tool-driven visible changes use the same workspace methods as direct UI actions.
- Spatial mutations are preflighted atomically. They fail without changing state when they would cover or crowd existing content, unless the caller explicitly sets `force: true`.
- `force` bypasses only visual placement safeguards. It never bypasses schema, media, security, source-target, or sequence validation.
- Agent actions produce a visible blue toast on the shared desk.
- PDF regions always use a top-left normalized coordinate system: `x`, `y`, `width`, and `height` are in `[0, 1]`, dimensions are positive, and the complete rectangle must stay inside the page.
- The app never exposes an original local filesystem path. It reads only browser-authorized file bytes and stores its own local copy in IndexedDB.
- Tool results use text and `structuredContent`; the app does not depend on experimental multimodal WebMCP result blocks.

## Prepare once for fast follow-up questions

Use this as the first instruction in a Codex task after importing papers:

> Prepare this PaperSpace desk for fast follow-up questions. Call `inspect_workspace` once, cache its `briefingRevision` and compact paper briefs, and do not change the desk. Treat PaperSpace as the primary interaction and delivery surface for paper work. When a later question requires paper text, read the broadest useful range in one `read_paper_pages` call; whole-paper reads are allowed and should not be split into repeated calls. Use `search_papers` for a specific passage and `focus_region` for one grounded source location. For introductions, explanations, reviews, comparisons, or answers grounded across multiple paper regions, call `present_sequence` with captioned original paper-region frames instead of stopping at a chat summary; keep chat concise and supporting. A chat-only answer is appropriate only for simple localized Q&A or when I explicitly request text-only. Add a snapshot, plot, or image only when the original regions and captions cannot resolve a stated comprehension gap. Report current readiness in one sentence, then wait for my questions.

This performs one bounded discovery call. Later reading is selected by the question, not artificially limited to small batches: a complete paper can be returned in one call when full context matters. The prompt does not ask the agent to summarize the corpus, poll indexing, rasterize every page, or inspect again before each action.

## Tool inputs

### `inspect_workspace`

No input. Returns `briefingRevision`, progressive readiness, an agent reuse protocol, workspace identity, local-storage disclosure, unfolded paper bounds, every page's world position and size, artifact summaries, camera state, the saved semantic sequence, and active sequence staging. A staged page includes its original `sourceSlot`.

Each paper also includes a compact `contentBrief`: the currently available indexed range, at most 24 evenly sampled page excerpts, and bounded textual source cues such as `Figure 2` or `Table 1`. Source cues are references found in extracted text, not claims that a visual was detected. Long papers remain bounded and report omitted indexed pages.

### `search_papers`

```json
{
	"query": "retrieval augmented generation",
	"paperId": "optional exact paper id",
	"limit": 8
}
```

Returns ranked page-level matches with `matchId`, a nearby quote, matching text blocks, and their union region. `coverage` reports indexed pages, total pages, and whether the corpus is complete. Matches from already indexed pages are available while later pages continue indexing.

### `read_paper_pages`

```json
{
	"paperId": "exact paper id",
	"startPage": 3,
	"endPage": 5,
	"includeBlocks": false
}
```

Omit `startPage` and `endPage` to read every currently indexed page in one call. Once indexing is complete, this returns the whole paper with no hidden page or character cap. Use one contiguous range instead when only part of the paper is relevant. `includeBlocks` defaults to `false`; enable it only when normalized text-block geometry is needed. `maxCharacters` is an optional explicit caller-selected cap. Every requested page must fall inside the paper's currently available indexed range; `coverage` reports the returned range, indexing completeness, character count, and whether an explicit cap truncated the result.

### `focus_region`

Use a recent search result:

```json
{ "matchId": "recent search match id", "padding": 0.06 }
```

Or target an explicit source rectangle:

```json
{
	"paperId": "exact paper id",
	"page": 7,
	"region": { "x": 0.12, "y": 0.36, "width": 0.74, "height": 0.18 },
	"padding": 0.06
}
```

Exactly one targeting mode should be used. `padding` accepts `0` through `0.35`. The camera pulls back to establish the route, travels through the desk, and lands with the padded source region as the visual center of the viewport.

### `arrange_papers`

```json
{
	"layout": "grid",
	"paperIds": ["optional", "paper", "subset"],
	"force": false
}
```

`layout` accepts `grid`, `row`, or `columns`. Each selected paper is first reflowed into a reading-order page grid, then the complete unfolded paper bounds are arranged. Omitting `paperIds` arranges the full desk. The complete draft is checked before any page moves; conflicts with stationary papers or visual artifacts fail atomically unless `force` is true.

### `snapshot_paper_region`

```json
{
	"paperId": "exact paper id",
	"page": 7,
	"region": { "x": 0.12, "y": 0.36, "width": 0.74, "height": 0.18 },
	"title": "Ablation table",
	"caption": "Removing the routing loss reduces recall.",
	"scale": 2,
	"focus": true,
	"force": false
}
```

Rasterizes the exact region as a PNG at scale `0.75` through `3`, capped at 4096 pixels per dimension. Use a persistent crop for side-by-side comparison; use `focus_region` or a paper-region frame for ordinary navigation. The crop is placed beside its source paper and retains source page geometry. Placement fails before image persistence if it would cover or crowd existing content and `force` is false. If the paper is later removed, the crop remains as a detached image.

### `place_plot`

```json
{
	"title": "Loss landscape",
	"caption": "The minimum occurs near λ = 0.4.",
	"xLabel": "λ",
	"yLabel": "Loss",
	"series": [
		{
			"name": "Method A",
			"points": [
				{ "x": 0, "y": 1.4 },
				{ "x": 0.4, "y": 0.8 },
				{ "x": 1, "y": 1.2 }
			]
		}
	],
	"focus": true,
	"force": false
}
```

Creates a non-executable SVG line plot from 1 to 8 named series, at least 2 points per series, and at most 2,000 finite numeric points total. A line plot is appropriate only when x values have a real ordered numeric meaning. Do not invent numeric positions to connect categories, symbolic complexity classes, or table rows, and do not replace an adequate source figure or table. Placement is guarded unless `force` is true.

### `place_image`

```json
{
	"dataUrl": "data:image/png;base64,…",
	"title": "Geometric interpretation",
	"caption": "The projection decomposes the residual into two orthogonal terms.",
	"focus": true,
	"force": false
}
```

Accepts base64 PNG, JPEG, or WebP up to 5 MB. Essential labels, legend mappings, and annotations must be visible inside a generated image; its caption is supplementary. The decoded byte signature must match the declared MIME type and the browser must decode valid positive image dimensions. SVG, HTML, remote URLs, and executable markup are rejected. Placement is guarded unless `force` is true.

### `present_sequence`

```json
{
	"title": "Why the experiment works",
	"frames": [
		{
			"kind": "paper-region",
			"paperId": "paper id",
			"page": 2,
			"region": { "x": 0.08, "y": 0.2, "width": 0.84, "height": 0.24 },
			"name": "Prior assumption",
			"caption": "Related work assumes a fixed retrieval set."
		},
		{
			"kind": "artifact",
			"artifactId": "visual artifact id",
			"name": "Visual explanation",
			"caption": "The derived curve shows why adaptive retrieval is stable."
		}
	],
	"startAt": 1,
	"save": false
}
```

Validates all 1 to 20 frames before changing presentation state. Lead with original paper-region evidence and add derived artifacts only when they resolve a stated comprehension gap. A `paper-region` frame requires `paperId`, one-based `page`, and `region`; an `artifact` frame requires `artifactId`. Unique source pages are gathered in first-appearance order into the nearest clear horizontal lane beside the related paper bounds, while numbered source slots remain in their original positions. The staged group automatically clears live pages and artifacts, so presentation does not expose a `force` option. Repeated frames may target different regions of the same gathered page. Artifacts stay in place. Exiting restores every page and the entry camera exactly. The result reports `organizedPages` with each page's source and staged positions.

This is the default delivery tool for substantive paper-grounded work while PaperSpace is available. Introductions, explanations, reviews, comparisons, and answers spanning multiple source regions should be presented here with captions; chat should support the sequence rather than replace it. Prefer original `paper-region` frames and add an artifact only when the source plus caption leaves a stated comprehension gap.

The sequence is the reading set; there is no separate reading-set object. It is temporary by default, and the person can keep its semantic frames from the presentation bar. Keeping a sequence never persists its temporary page arrangement. `save: true` replaces the saved sequence explicitly.

## Manual agent test

1. Import at least one text-based PDF. Full indexing does not need to finish before the first inspection.
2. Send the one-time preparation prompt and confirm `inspect_workspace` reports readiness plus compact page briefs.
3. Ask for an introduction to the paper. Confirm the agent delivers it as a captioned sequence of original paper regions instead of only a chat summary.
4. Ask it to search for a phrase that appears in the PDF.
5. Ask it to focus the strongest result using its `matchId`; confirm the passage is visible without an overlay box and that the camera establishes spatial context before landing.
6. Ask it to read only the relevant method and result pages, then place a source crop or a numeric visualization only if the source regions cannot explain the point adequately.
7. Ask it to present three captioned views across related work, method, and results; confirm the three original pages gather and numbered source slots remain behind.
8. Keep the temporary sequence, exit presentation, confirm the pages return to their exact positions, and replay it from the frame panel.
9. Confirm that every state change is visible on the same desk and that no network storage or original file path is involved.
10. Attempt a visual placement that conflicts with a paper. Confirm it fails without mutation, then retry with `force: true` only to verify the explicit override path.

## Unsupported browsers

When `document.modelContext` is absent, PaperSpace marks WebMCP as unavailable and registers no tools. It does not switch to the deprecated navigator API. PDF reading, search, persistence, spatial arrangement, saved-sequence playback, and existing visual artifacts remain normal person-facing browser features.
