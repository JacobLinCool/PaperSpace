# Title

PaperSpace

## One-line Summary

PaperSpace is a local-first spatial research desk where a person and a WebMCP agent can read, arrange, focus, and present live PDF pages together in one browser-native 2D workspace.

## Problem

Research-paper reading is spatial and non-linear. A reader moves repeatedly between related work, methods, equations, figures, results, and appendices while remembering where each piece of evidence lives. Conventional PDF viewers reduce that paper to one page at a time, while chat interfaces often reduce it further to detached excerpts.

That separation creates two problems. The person loses the paper's spatial topology, and the agent acts on a text-only representation that is disconnected from the document and camera the person is actually using.

## Solution

PaperSpace unfolds every page of every imported PDF onto a borderless two-dimensional desk. Pages retain stable paper and page identities, selectable text, and normalized source regions, while their world positions remain movable. The person can preserve the physical feeling of a paper, and the agent can search, read, focus, arrange, derive visuals, and present semantic views against the same live workspace.

The central interaction is a captioned sequence. If one experiment spans related work, methods, and results, an agent can temporarily gather those original pages, present exact regions in order, and leave numbered source slots behind. Exiting restores every page and the entry camera exactly. A saved sequence stores semantic targets rather than screenshots or recorded camera coordinates, so it can be reconstructed from the current desk later.

## Why This Matters

PaperSpace is a strong fit for WebMCP because the browser owns context that cannot be separated from the experience: user-authorized local PDFs, extracted text, page geometry, current world positions, visual artifacts, the camera, and active presentation state. A backend tool would need a second upload and a second representation of the workspace. WebMCP lets the agent operate on the same browser-local state the person can see and manipulate.

Together, a person and an agent can do something that is difficult in either a PDF viewer or a chat alone: locate evidence across distant pages, reorganize those original pages around one question, guide attention to exact regions without obscuring the paper, add a source-linked explanation only when it resolves a gap, and then return the desk to its prior state.

## How We Used AI

PaperSpace does not bundle a model or send PDFs to an application backend. It exposes nine browser-native WebMCP tools to the agent selected by the person. The agent supplies interpretation and planning; PaperSpace supplies authorized source text, normalized geometry, live workspace state, reversible actions, and visible results.

The WebMCP contract makes PaperSpace the primary delivery surface for substantive paper-grounded work. Introductions, explanations, reviews, comparisons, and multi-region answers are presented as captioned views of original paper regions rather than stopping as detached chat summaries. Simple localized Q&A and explicit text-only requests remain lightweight exceptions.

The tool design intentionally separates dependable semantic access from client-dependent visual access. Agents can reliably read extracted text and structured page geometry. PaperSpace can create source-linked raster artifacts on the desk, but it does not claim that current WebMCP clients will always deliver those pixels to a multimodal model.

## How We Used Codex

Codex was our collaborative implementation and review agent throughout PaperSpace's design and development. We used it to translate the product contract into a per-page workspace schema, transactional sequence staging, cancellable camera flights, bounded visual-mutation preflights, and a thin WebMCP adapter over the same actions used by the interface.

Codex also helped write and run unit and Playwright coverage, inspect real browser behavior, diagnose PDF raster churn, refine WebMCP tool descriptions and schemas, and audit the final product and submission narrative against the implemented source. Product decisions and final verification remained human-directed.

## Key Features

- Unfolds complete PDFs in reading order using each page's actual aspect ratio.
- Keeps every page as an independently movable and resizable live PDF sheet with selectable text.
- Indexes text page by page with normalized geometry for exact search and focus.
- Provides a reusable `inspect_workspace` briefing and whole-paper or broad-range reads to avoid repeated setup calls.
- Makes captioned PaperSpace sequences the default delivery for substantive paper-grounded explanations.
- Guides the camera with cancellable pull-back, travel, and landing motion rather than teleporting.
- Temporarily gathers the original pages needed by a semantic sequence and restores the desk exactly on exit.
- Creates source-linked PDF crops, validated raster images, and safe declarative line plots.
- Rejects visually destructive placements atomically unless the agent explicitly retries with `force: true`; security and validation checks are never bypassed.
- Persists authorized PDFs, extracted indexes, geometry, artifacts, and saved semantic frames in IndexedDB.
- Runs as a pure static SvelteKit frontend suitable for Cloudflare Pages, with no account, backend, database, or required environment variable.

### WebMCP tool surface

1. `inspect_workspace`
2. `search_papers`
3. `read_paper_pages`
4. `focus_region`
5. `arrange_papers`
6. `snapshot_paper_region`
7. `place_plot`
8. `place_image`
9. `present_sequence`

## Architecture

PaperSpace is a SvelteKit 2 and Svelte 5 static application written in TypeScript.

- Svelte components render the borderless desk, live PDF sheets, artifacts, search, frame editing, and presentation chrome.
- One reactive workspace owns person- and agent-triggered state transitions so there is no separate agent-only model.
- PDF.js renders pages and extracts text plus normalized block geometry in a same-origin Web Worker.
- IndexedDB stores validated workspace metadata, browser-authorized PDF copies, raster image bytes, and semantic frames.
- `document.modelContext.registerTool(...)` registers WebMCP directly in the page; each tool delegates to the same workspace methods as the visible interface.
- PDF raster residency preserves a compact preview for rendered pages, bounds unpinned high-resolution canvases with an LRU budget, and swaps completed renders atomically so motion does not clear a page back to a skeleton.

## Testing Instructions

1. Open the live URL in ChatGPT's in-app browser or Google Chrome with WebMCP enabled.
2. Import a multi-page research PDF. Confirm all pages unfold on the desk and that no Previous/Next controls appear.
3. Ask the agent to call `inspect_workspace` once and report indexing readiness.
4. Ask it to read the broadest useful page range in one `read_paper_pages` call, or use `search_papers` for one exact passage.
5. Ask it to focus a returned match. Confirm the camera pulls back, travels, and lands on the passage without drawing a rectangle over the PDF.
6. Ask it to find an experiment across related work, methods, and results, then call `present_sequence` with three captioned paper-region frames.
7. Confirm the three original pages gather, numbered source slots remain behind, captions switch with the frames, and exiting restores the original page positions and camera.
8. Ask it to place a source crop or plot. To test the guardrail, request a placement that conflicts with existing content; confirm the first call fails without mutation and an intentional `force: true` retry succeeds.
9. Reset the local workspace from the toolbar when a clean run is needed.

No credentials are required. PDFs remain local to the browser.

## Public Demo Link

[https://paperspace.pages.dev/](https://paperspace.pages.dev/)

## Public Repository Link

[https://github.com/JacobLinCool/PaperSpace](https://github.com/JacobLinCool/PaperSpace)

## Demo Video

**TODO:** Add a public YouTube URL for a narrated demo shorter than three minutes.

Suggested story arc:

1. Import and unfold a paper.
2. Inspect once, then search or read without repeated setup.
3. Focus one exact region through a spatial camera flight.
4. Gather three experiment-related pages into a captioned sequence.
5. Exit and show exact restoration of the desk.
6. Briefly show the nine `document.modelContext.registerTool(...)` registrations in source.

## Screenshot Shot List

1. **Unfolded paper desk:** a complete multi-page PDF visible as a spatial reading surface.
2. **Exact region focus:** the camera landed on a formula, figure, or result without a focus overlay.
3. **Experiment sequence:** three distant original pages gathered with numbered source slots and a visible caption.
4. **Human-agent visual explanation:** a source page beside a source-linked crop or a semantically valid plot.
5. **WebMCP implementation:** the app's ready state alongside the nine registered tool definitions in the public repository.

## Submission Readiness Notes

Official event: **The WebMCP Challenge** (`webmcp`).

PaperSpace submission: [Devpost submission 1154203](https://devpost.com/submit-to/31011-the-webmcp-challenge/manage/submissions/1154203-paperspace/project_details/edit).

Official submission deadline: **September 3, 2026 at 1:00 PM Pacific Time** (**September 4 at 4:00 AM in Taipei**). The current official phase is submissions open.

Judging criteria:

- WebMCP Leverage
- Execution
- Potential Impact
- Creativity & Ambition

Local source readiness:

- [x] Pure frontend implementation with nine direct WebMCP registrations.
- [x] Top-level MIT license.
- [x] Static Cloudflare Pages build configuration and security headers.
- [x] Local run, architecture, and WebMCP testing documentation.
- [x] Final local verification on August 29, 2026: 51/51 Vitest tests, 0 Svelte errors or warnings, Prettier and ESLint, static production build, and 9/9 Playwright flows.
- [x] Public Cloudflare Pages deployment verified after the CSP fix.
- [x] Public repository URL configured with a top-level MIT license.
- [ ] Record and publish the required narrated demo under three minutes.
- [ ] Capture the five final screenshots after visual verification.
- [x] PaperSpace-specific Devpost submission identified without modifying the other WebMCP Challenge entries.

The copy-ready seven-section Devpost narrative is in [`docs/hackathon-submission.md`](docs/hackathon-submission.md).

## Known Limitations

### Browser-authorized files do not expose absolute paths

The browser gives PaperSpace the bytes of a file the person explicitly selected, not a reusable absolute filesystem path that an agent can reopen later. PaperSpace persists an authorized browser-local copy and exposes bounded text, geometry, and workspace operations. This is both a WebMCP integration constraint and an important privacy boundary: the page never gains general filesystem access.

### Visual tool results are not yet portable across WebMCP clients

PaperSpace can rasterize a PDF region and place the image visibly on the desk, but its current WebMCP tools return text and structured metadata rather than a guaranteed multimodal image payload. Codex can reliably consume extracted text, provenance, and normalized regions. Direct inspection of rendered pixels depends on a screenshot or visual observation supplied by the client, which the app cannot assume or capability-test portably today.

This differs from the broader MCP protocol, which defines image content for tool results. The current browser WebMCP path and host behavior do not yet provide PaperSpace with an equally portable end-to-end guarantee. We intentionally avoid a client-specific or unverified fallback.

### Additional boundaries

- A browser without the current imperative `document.modelContext` API can use the reading desk but receives no WebMCP tools.
- Scanned PDFs without embedded text require future browser-local OCR for semantic search and reading.
- Very large corpora remain constrained by browser storage, memory, and PDF rasterization cost even though rendering is viewport-aware and budgeted.
- The required video and final evidence assets are not yet filled into this local packet.

Technical references: [WebMCP Community Group Draft](https://webmachinelearning.github.io/webmcp/) and [MCP tool result content types](https://modelcontextprotocol.io/specification/2025-06-18/server/tools).

## TODO Official Form Fields

Do not copy these into Devpost until every value has been confirmed for the PaperSpace-specific project.

- **Submitter Type** (required): confirm `Individual`, `Team of Individuals`, or `Organization`.
- **Country of residence** (required): confirm the legal answer for every submitter.
- **Organization name** (optional): complete only if submitting for an organization.
- **App Status** (required): select `New`; PaperSpace is a new standalone project.
- **Live URL** (required): add the accessible Cloudflare Pages URL.
- **Testing instructions** (optional): adapt the verified steps above and include credentials only if deployment later adds authentication.
- **Public code repository URL** (required): add the public Git URL and verify the MIT license is detected in the repository About section.
- **Agent/client testing** (required): confirm the exact Codex/ChatGPT/Chrome client names and versions used in the final manual run; distinguish the Playwright registration harness from a real agent client.
- **AI tools leveraged** (required): confirm Codex and any other AI tools actually used.
- **Learning level** (required): choose `None`, `Moderate`, or `Significant`.
- **Career AI value** (required): choose `Yes` or `No`.
- **Demo video** (required): add a public YouTube video under three minutes with audio.
- **Project photos/thumbnail:** upload manually on Devpost after capturing final evidence.

No Devpost project or submission should be created, updated, or re-submitted from this packet without an explicit PaperSpace project selection and explicit user confirmation.
