## Inspiration

Most AI tools treat a research paper as a file to summarize or a block of text to retrieve from. We wanted to explore a more WebMCP-native question:

**What becomes possible when a person and an agent share a paper's text and its spatial reading environment inside the browser?**

Reading a paper is rarely linear. A reader moves between related work, methods, equations, figures, experiments, and appendices while building a mental map of where each idea lives. Conventional PDF viewers collapse that map into one page at a time. Chat interfaces collapse it even further into excerpts detached from their visual source.

PaperSpace preserves that spatial memory. Every page of every imported PDF is unfolded onto a borderless two-dimensional desk. Pages remain live, selectable PDF surfaces, but they can also be moved, grouped, searched, compared, and revisited as part of a persistent visual workspace.

The browser is essential to this interaction. It owns the PDFs the person explicitly selected, the rendered pages, the local text index, the page geometry, the current camera, and the workspace the person is looking at. WebMCP gives an agent direct access to that authorized, browser-local state, keeping the person and the agent aligned on one live workspace.

We built PaperSpace for the WebMCP Challenge as a focused, open-source, single-person tool centered on reading, understanding, and presenting research papers.

PaperSpace is a shared spatial instrument where the person controls the source material and the agent helps organize attention inside the same visible world.

## What it does

PaperSpace is a local-first spatial desk for research papers.

When a person imports a PDF, PaperSpace unfolds every page from left to right and top to bottom using each page's real aspect ratio. Every page becomes an independently movable and resizable live sheet with selectable text. The complete paper stays visible as a spatial place with its reading order intact.

PaperSpace extracts text and normalized page geometry locally with PDF.js. Each page becomes searchable as soon as its index is ready. A reusable `inspect_workspace` briefing reports exact coverage and compact sampled page excerpts, so an agent can prepare once and then read the broadest useful contiguous range in one call, including the whole paper when full context matters. Through WebMCP, the agent can search the available corpus, batch-read paper text, locate an exact passage, and guide the shared camera to that region. The camera first pulls back to establish spatial context, travels across the desk, and then lands with the source itself centered in a calm view with generous breathing room.

The app exposes nine WebMCP tools:

- `inspect_workspace` returns reusable readiness, compact paper briefs, every page's world geometry, visual artifacts, sequences, and camera state.
- `search_papers` progressively searches indexed pages and returns page-level matches with normalized source regions plus exact coverage.
- `read_paper_pages` reads one contiguous range or a whole indexed paper in one call, with optional block geometry and an explicit caller-selected character cap.
- `focus_region` guides the camera to a search match or an explicit PDF region.
- `arrange_papers` reflows pages into reading-order grids and arranges complete paper groups.
- `snapshot_paper_region` places a source-linked raster crop from an exact PDF region.
- `place_plot` creates a safe declarative line plot from finite numeric data.
- `place_image` validates and places PNG, JPEG, and WebP visuals.
- `present_sequence` creates a captioned sequence of semantic paper regions and visual artifacts.

PaperSpace also gives the agent an explicit delivery contract. When PaperSpace is available, substantive introductions, explanations, reviews, comparisons, and answers grounded across multiple paper regions are delivered through `present_sequence`. Chat provides concise supporting context, while a single grounded passage can use `focus_region` and simple localized Q&A remains lightweight.

The sequence interaction is the heart of the product. Suppose one experiment is explained across related work, methods, and results on three distant pages. The agent can build a three-frame sequence with a caption for each view. When presentation begins, PaperSpace temporarily draws those original pages together beside their paper in first-appearance order. Quiet numbered source slots preserve the paper's topology throughout the presentation.

The same original page can support several region frames through one staged page. Visual artifacts stay in their existing world positions. Exiting the sequence restores every moved page—including its position, size, and layer—and returns the camera to its exact entry state. Keeping a sequence saves its semantic frames; replaying it organizes pages again from their current positions and restores them again afterward.

This enables requests such as:

- “Find where this experiment is motivated, defined, and evaluated, then organize those pages for me.”
- “Focus on the ablation equation and keep the surrounding paragraph in view.”
- “Read the method and results, plot the reported trend, and place it beside the source page.”
- “Present the three views in sequence and explain what changes between them.”

Everything happens on the same desk the person can inspect and manipulate. Agent actions produce visible feedback, and temporary organization is transactionally isolated from the person's saved layout.

Spatial mutation tools perform an atomic visual preflight inside the app. Standard calls place plots, images, source crops, and arrangements in clear areas. An agent can use `force: true` for an intentional dense layout, while media, schema, source-target, and security validation remain active.

## How we built it

PaperSpace is a pure frontend SvelteKit and TypeScript application compiled as a static site for Cloudflare Pages. Browser storage and browser-authorized files provide the complete runtime state.

The application is organized around four client-side layers:

- Svelte components render the infinite desk, unfolded PDF sheets, artifacts, search interface, frame editor, and presentation chrome.
- A single reactive workspace model owns paper metadata, per-page geometry, the camera, artifacts, semantic sequences, and all person- and agent-triggered state transitions.
- PDF.js renders pages and extracts text plus normalized block geometry in a same-origin Web Worker.
- IndexedDB stores validated workspace metadata, browser-authorized PDF copies, raster images, and saved semantic frames.

The workspace schema stores a stable paper identity and page number for every PDF page, while position, size, and layer remain mutable world properties. PDF inspection records each page's true dimensions. A deterministic row-major layout uses a bounded column count to keep long papers spatially legible, and complete paper bounds are used to prevent different imports from overlapping.

Every page has a DOM sheet so its identity remains stable in the world. PaperSpace activates detailed PDF canvas and text rendering near the viewport and above a useful zoom threshold, keeping long unfolded papers responsive.

PDF rasterization uses a two-tier residency system. Every successfully rendered page retains a 288-pixel-wide aspect-preserving preview, while an LRU applies a 48-million-pixel budget to unpinned high-resolution page canvases. Pages in the strict viewport, the current focus target, and the active sequence frame are pinned and may temporarily exceed that budget. A compact preview preserves visual continuity as high-resolution canvases move through the working set. Raster canvases and selectable text layers have independent lifecycles, and a double-canvas pipeline swaps each completed bitmap into view atomically.

Region targeting uses top-left normalized coordinates. The same semantic region can therefore be mapped through a page's current world geometry after the page has been moved or resized. Camera motion is handled by a cancellable controller with pull-back, travel, and landing keyframes, smooth center interpolation, logarithmic zoom interpolation, distance-aware timing, responsive caption-safe insets, and an immediate path for `prefers-reduced-motion`.

Presentation staging is transactional. PaperSpace validates every frame before changing state, deduplicates source pages by first appearance, snapshots their exact geometry and the entry camera, stages the original pages, and exposes their source slots. Presentation mode pauses page manipulation, while persistence serializes the source geometry and entry camera to keep the durable desk unchanged.

WebMCP is registered directly through `document.modelContext.registerTool(...)`. The WebMCP adapter is intentionally thin: every tool calls the same workspace methods used by the visible interface. One reactive workspace serves both the interface and the tools. The delivery contract is visible before execution in the registered tool descriptions and after inspection in `inspect_workspace.agentProtocol`, making the shared desk the natural surface for grounded paper work.

Read tools label extracted PDF content as untrusted source material and validate every ID, region, and required input. Browser authorization supplies the file bytes, and WebMCP exposes bounded semantic operations over that content. Generated visuals use source-linked PNG crops, validated raster formats, and finite declarative plot data.

PaperSpace returns extracted text, normalized regions, provenance, geometry, and mutation results through WebMCP. Source snapshots become visible, source-linked artifacts on the shared desk, and host-provided visual observation can add pixel-level inspection when available.

We used Codex as a collaborative implementation and review agent throughout the focused rebuild. It helped translate the product interaction contract into the per-page workspace schema, sequence transaction, camera controller, and WebMCP boundary; write unit and Playwright coverage; exercise the tools against a real multi-page PDF; capture desktop and mobile evidence; and run structured visual and architecture checkpoints. We manually exercised the live WebMCP workflow with Codex, while the automated browser suite installs a controlled `document.modelContext` harness to verify all nine registrations and their shared visible effects. The final verification runs Vitest, Svelte diagnostics, Prettier, ESLint, a static production build, and Playwright end to end.

## Challenges we ran into

The first challenge was preserving the spatial identity of a paper while allowing its layout to change. A page number remains stable for search results, citations, frames, and artifacts, while its world coordinates adapt to the reader's task. We separated semantic identity from mutable geometry so a reader—or an agent helping with a specific experiment—can gather related pages and every tool still targets the correct source.

The second challenge was making sequence organization fully transactional. Visibility changes and delayed IndexedDB saves can occur while pages are staged, so persistence serializes the stored source geometry and entry camera while the visible workspace presents the temporary arrangement.

Camera guidance was another subtle problem. Pulling back, traveling at a higher viewpoint, and landing near the target communicates distance and direction across the desk. The controller remains cancellable by pan, wheel, or another focus request, reserves caption-safe space on small screens, and provides an immediate landing path for reduced-motion users.

Rendering an unfolded long paper required balancing spatial continuity with browser cost. Every page keeps a stable world position and source slot, while detailed canvases and text layers follow the reader's current view. This led us to treat rendering as a residency and scheduling problem across viewport movement, dragging, resizing, and camera flight.

The resulting residency system keeps each page's last successful bitmap visible during interaction. A completed replacement renders offscreen and swaps atomically, while a separate text-layer cache preserves selectable text. A 288-pixel preview supports every rendered page, a 48-million-pixel LRU budget bounds the unpinned high-resolution working set, and different viewport entry and exit margins stabilize pages near the boundary.

Guided camera flights added a timing challenge. The flight controller publishes the target page and final landing zoom as soon as focus begins. That page renders once at its destination resolution into the inactive canvas while the existing bitmap carries the pull-back and travel phases. Completed work can arrive before landing, and any person-initiated pan, zoom, or new flight immediately redirects the rendering schedule.

Browser authorization became the foundation of the privacy model. The File API supplies the bytes the person explicitly selected, IndexedDB stores an authorized local copy, PDF.js derives text and geometry in the page, and WebMCP exposes bounded semantic operations over that content.

A related challenge was defining dependable visual provenance across clients. PaperSpace can rasterize a PDF region, place the source-linked image on the desk, and return the text, exact region geometry, and provenance through WebMCP. Host-provided visual observation can extend this contract with pixel-level inspection.

Finally, we targeted the current imperative `document.modelContext` API directly and made its availability visible in the interface. This kept the implementation precise and made all nine registrations easy to verify in a real browser and in Playwright.

## Accomplishments that we're proud of

We are proud that PaperSpace treats spatial context as part of understanding. A paper remains an unfolded, live document whose topology survives search, agent focus, temporary reorganization, and presentation.

We are also proud of the sequence model. It stores semantic targets—paper regions or artifacts—and reconstructs the most useful temporary arrangement from the desk as it exists at playback time. Each saved sequence remains durable as the workspace evolves.

PaperSpace gives people and agents one source of truth. A tool that focuses a region, arranges papers, places a plot, or starts a sequence changes the same visible state as a direct person action. Every collaboration step is visible and inspectable.

The application is completely frontend-only. PDFs, extracted text, layouts, images, and frames stay in browser-local storage, while a static deployment provides the full agentic research environment.

We kept the tool surface expressive and bounded. Nine tools cover discovery, retrieval, spatial navigation, arrangement, source-linked visual creation, and guided presentation. Inputs and visual formats are validated, text is treated as untrusted source content, and agent actions are visible to the person.

The final product is more than a technical proof of concept. It includes responsive presentation behavior, reduced-motion support, local persistence recovery, viewport-aware PDF rendering, source-aware artifacts, a complete frame editor, Nord Polar Light visual design, production security headers, and a static Cloudflare Pages build.

We are especially proud of the unfolded desk's combination of spatial continuity and rendering stability. During camera flight, drag, resize, cache pressure, and high-DPI zoom, a page keeps showing its last successful image, swaps in completed upgrades atomically, and can arrive at a guided reading target already sharp. The performance architecture appears to the reader simply as calmness.

## What we learned

We learned that WebMCP is strongest when the browser holds context that is both semantically important and inseparable from the user experience.

PaperSpace's useful state combines PDF text with the local documents the person authorized, every page's current position, the visible region for each passage, the camera, artifact provenance, and active presentation state. WebMCP makes this complete live spatial world directly available as the shared interaction context.

We also learned that semantic handles make agent actions durable. A frame means “this region of page 7.” A search result carries both its quote and source region. A generated crop retains its paper and page provenance. These contracts survive layout changes and remain understandable to both the person and the agent.

Spatial stability comes from identity, page order, provenance, and the ability to return. Coordinates are working material. Once we separated those concepts, the agent could temporarily organize the pages relevant to one experiment while preserving the reader's larger mental map.

We learned that camera motion is part of information architecture. The pull-back phase answers “where am I leaving?”, the travel phase communicates distance, and the landing answers “what should I read now?” The PDF source itself remains the final object of attention.

We also learned that PDF rendering quality is a scheduling problem. The useful unit of policy is the reader's next likely view: preserve a compact preview for every rendered page, pin the high-resolution working set that matters now, and pre-render the semantic destination during a camera flight.

Finally, local-first and agent-capable reinforce each other. Browser authorization, precise semantic operations, dependable text and geometry, and reversible workspace actions create a clear capability model. Designing tools around bounded product actions keeps every state change visible and understandable.

## What's next for PaperSpace

Next, we want to deepen experiment-centered reading. An agent should be able to identify the pages, figures, equations, and result tables associated with one experiment, propose a semantic sequence, and let the reader approve or refine that organization directly on the desk.

We want to improve browser-local retrieval for long and scanned papers through optional on-device OCR and richer section-aware indexing, while preserving normalized source geometry and browser-local privacy.

We also want a standards-based visual-read path that lets WebMCP clients advertise image observation capabilities and receive exact page-region observations through a portable contract.

We also want to strengthen multi-paper synthesis. A sequence could connect a method from one paper, a competing assumption from another, and a replication result from a third while keeping every source page live and spatially grounded.

Further work includes more complete keyboard navigation, accessible spoken descriptions of spatial moves, larger-corpus rendering benchmarks, import and export of local workspace bundles, and broader testing across WebMCP-capable browsers and agent clients.

Our larger goal is to make research reading a genuinely shared human-agent activity: the paper remains the living source, the reader retains spatial context and control, and the agent helps direct attention, assemble evidence, and explain relationships inside the same visible workspace.
