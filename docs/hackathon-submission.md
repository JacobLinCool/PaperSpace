## Inspiration

Most AI tools treat a research paper as a file to summarize or a block of text to retrieve from. We wanted to explore a more WebMCP-native question:

**What becomes possible when a person and an agent can share not only a paper's text, but also its spatial reading environment inside the browser?**

Reading a paper is rarely linear. A reader moves between related work, methods, equations, figures, experiments, and appendices while building a mental map of where each idea lives. Conventional PDF viewers collapse that map into one page at a time. Chat interfaces collapse it even further into excerpts detached from their visual source.

PaperSpace preserves that spatial memory. Every page of every imported PDF is unfolded onto a borderless two-dimensional desk. Pages remain live, selectable PDF surfaces, but they can also be moved, grouped, searched, compared, and revisited as part of a persistent visual workspace.

The browser is essential to this interaction. It owns the PDFs the person explicitly selected, the rendered pages, the local text index, the page geometry, the current camera, and the workspace the person is looking at. WebMCP lets an agent understand and act on that exact state without uploading the papers to an application backend or maintaining a separate agent-only model.

We built PaperSpace for the WebMCP Challenge as a focused, open-source, single-person tool: no diagrams, sticky notes, accounts, collaboration system, or backend MCP server—only the parts that strengthen reading, understanding, and presenting papers.

The result is not “an AI chat beside a PDF.” It is a shared spatial instrument where the person controls the source material and the agent can help organize attention inside the same visible world.

## What it does

PaperSpace is a local-first spatial desk for research papers.

When a person imports a PDF, PaperSpace unfolds every page from left to right and top to bottom using each page's real aspect ratio. Every page becomes an independently movable and resizable live sheet with selectable text. The complete paper stays visible as a place, rather than becoming a single container with Previous and Next buttons.

PaperSpace extracts text and normalized page geometry locally with PDF.js. Each indexed page becomes searchable immediately instead of waiting for the full paper. A reusable `inspect_workspace` briefing reports exact coverage and compact sampled page excerpts, so an agent can prepare once and then read the broadest useful contiguous range in one call, including the whole paper when full context matters. Through WebMCP, the agent can search the available corpus, batch-read paper text, locate an exact passage, and guide the shared camera to that region. The camera first pulls back to establish spatial context, travels across the desk, and then lands with the target and breathing room inside the viewport. The target geometry determines the landing, but PaperSpace does not cover the source with a focus rectangle.

The app exposes nine WebMCP tools:

- `inspect_workspace` returns reusable readiness, compact paper briefs, every page's world geometry, visual artifacts, sequences, and camera state.
- `search_papers` progressively searches indexed pages and returns page-level matches with normalized source regions plus exact coverage.
- `read_paper_pages` reads one contiguous range or a whole indexed paper in one call, with optional block geometry and an explicit caller-selected character cap.
- `focus_region` guides the camera to a search match or an explicit PDF region.
- `arrange_papers` reflows pages into reading-order grids and arranges complete paper groups.
- `snapshot_paper_region` places a source-linked raster crop from an exact PDF region.
- `place_plot` creates a safe declarative line plot from finite numeric data.
- `place_image` validates and places a PNG, JPEG, or WebP visual while rejecting executable formats.
- `present_sequence` creates a captioned sequence of semantic paper regions and visual artifacts.

PaperSpace also gives the agent an explicit delivery contract. When PaperSpace is available, substantive introductions, explanations, reviews, comparisons, and answers grounded across multiple paper regions should be delivered through `present_sequence` instead of ending as detached chat summaries. Chat remains concise supporting context. Simple localized Q&A and explicit text-only requests remain lightweight exceptions, while a single grounded passage can use `focus_region`.

The sequence interaction is the heart of the product. Suppose one experiment is explained across related work, methods, and results on three distant pages. The agent can build a three-frame sequence with a caption for each view. When presentation begins, PaperSpace temporarily draws those original pages together beside their paper in first-appearance order. Their source positions remain visible as quiet numbered slots, so the reader never loses the paper's topology.

The same original page can support several region frames without being moved twice. Visual artifacts stay in their existing world positions. Exiting the sequence restores every moved page—including its position, size, and layer—and returns the camera to its exact entry state. Keeping a sequence saves only its semantic frames; replaying it organizes pages again from their current positions and restores them again afterward.

This enables requests such as:

- “Find where this experiment is motivated, defined, and evaluated, then organize those pages for me.”
- “Focus on the ablation equation without hiding the surrounding paragraph.”
- “Read the method and results, plot the reported trend, and place it beside the source page.”
- “Present the three views in sequence and explain what changes between them.”

Everything happens on the same desk the person can inspect and manipulate. Agent actions produce visible feedback, and temporary organization never silently overwrites the person's saved layout.

Spatial mutation tools also perform an atomic visual preflight inside the app. A plot, image, source crop, or arrangement that would cover or crowd existing content fails without changing the desk. An Agent may retry with `force: true` only when the disruption is intentional; this override never bypasses media, schema, source-target, or security validation.

## How we built it

PaperSpace is a pure frontend SvelteKit and TypeScript application compiled as a static site for Cloudflare Pages. It has no application server, account system, cloud database, or required environment variables.

The application is organized around four client-side layers:

- Svelte components render the infinite desk, unfolded PDF sheets, artifacts, search interface, frame editor, and presentation chrome.
- A single reactive workspace model owns paper metadata, per-page geometry, the camera, artifacts, semantic sequences, and all person- and agent-triggered state transitions.
- PDF.js renders pages and extracts text plus normalized block geometry in a same-origin Web Worker.
- IndexedDB stores validated workspace metadata, browser-authorized PDF copies, raster images, and saved semantic frames.

The workspace schema stores a stable paper identity and page number for every PDF page, while position, size, and layer remain mutable world properties. PDF inspection records each page's true dimensions. A deterministic row-major layout uses a bounded column count to keep long papers spatially legible, and complete paper bounds are used to prevent different imports from overlapping.

Every page has a DOM sheet so its identity remains stable in the world, but PaperSpace only activates expensive PDF canvas and text rendering near the viewport and above a useful zoom threshold. This preserves the experience of an unfolded paper without rasterizing every page of a long document at once.

PDF rasterization uses a two-tier residency system. Every successfully rendered page retains a 288-pixel-wide aspect-preserving preview, while an LRU applies a 48-million-pixel budget to unpinned high-resolution page canvases. Pages in the strict viewport, the current focus target, and the active sequence frame are pinned and may temporarily exceed that budget; an evicted page falls back to its preview instead of returning to a loading skeleton. Raster canvases and selectable text layers have independent lifecycles, so upgrading image resolution never rebuilds the text layer. Each page also uses two canvases: PDF.js renders into the inactive canvas, then PaperSpace swaps it into view only after the complete bitmap is ready.

Region targeting uses top-left normalized coordinates. The same semantic region can therefore be mapped through a page's current world geometry after the page has been moved or resized. Camera motion is handled by a cancellable controller with pull-back, travel, and landing keyframes, smooth center interpolation, logarithmic zoom interpolation, distance-aware timing, responsive caption-safe insets, and an immediate path for `prefers-reduced-motion`.

Presentation staging is transactional. PaperSpace validates every frame before changing state, deduplicates source pages by first appearance, snapshots their exact geometry and the entry camera, stages the original pages, and exposes their source slots. During presentation, page manipulation is disabled. Persistence also substitutes the original geometry if the browser saves while a sequence is active, ensuring temporary staging can never leak into the durable desk.

WebMCP is registered directly through `document.modelContext.registerTool(...)`. The WebMCP adapter is intentionally thin: every tool calls the same workspace methods used by the visible interface. There is no second state store or separate agent implementation that can drift from what the person sees. The delivery contract is visible both before execution in the registered tool descriptions and after inspection in `inspect_workspace.agentProtocol`, so an agent does not need a separate hidden prompt to understand that grounded paper work belongs on the shared desk.

Read tools mark extracted PDF content as untrusted. Invalid IDs, regions, and incomplete inputs fail explicitly. Original filesystem paths are never available to the app or returned to an agent; PaperSpace works only with file bytes the person authorized the browser to read. Generated visuals are bounded to source-linked PNG crops, validated raster formats, and finite declarative plot data rather than arbitrary HTML or SVG.

The tool boundary is deliberately honest about modality. PaperSpace returns extracted text, normalized regions, provenance, geometry, and mutation results through WebMCP. A source snapshot becomes a visible, source-linked artifact on the shared desk, but the current browser WebMCP path does not give PaperSpace a portable way to return those raster pixels as guaranteed multimodal image content to every agent client. Visual inspection may be available through a host-provided screenshot observation, but the app does not assume that implementation-defined capability.

We used Codex as a collaborative implementation and review agent throughout the focused rebuild. It helped translate the product interaction contract into the per-page workspace schema, sequence transaction, camera controller, and WebMCP boundary; write unit and Playwright coverage; exercise the tools against a real multi-page PDF; capture desktop and mobile evidence; and run structured visual and architecture checkpoints. We manually exercised the live WebMCP workflow with Codex, while the automated browser suite installs a controlled `document.modelContext` harness to verify all nine registrations and their shared visible effects. The final verification runs Vitest, Svelte diagnostics, Prettier, ESLint, a static production build, and Playwright end to end.

## Challenges we ran into

The first challenge was preserving the spatial identity of a paper while allowing its layout to change. A page number must remain stable for search results, citations, frames, and artifacts, but the page's world coordinates cannot be fixed. The reader—or an agent helping with a specific experiment—may move related pages together. We separated semantic identity from mutable geometry so tools always target the correct source even after extensive rearrangement.

The second challenge was making sequence organization temporary in every sense. It was not enough to animate pages back when the person pressed Exit. A visibility change or delayed IndexedDB save during presentation could accidentally persist the staged coordinates. We made persistence sequence-aware: it serializes the stored source geometry and entry camera while the visible workspace remains staged.

Camera guidance was another subtle problem. A direct pan-and-zoom transition feels like teleportation and removes the desk's spatial meaning. Pulling back, traveling at a higher viewpoint, and landing near the target creates a sense of distance and direction. The motion also had to remain cancellable by pan, wheel, or another focus request, work on small screens without colliding with captions, and disappear entirely for reduced-motion users.

Rendering an unfolded long paper required balancing spatial continuity with browser cost. Hiding pages from the world would break their stable positions and source slots, while rendering every PDF canvas and text layer would waste memory and main-thread time. Our first working version still felt wrong: pages near a viewport boundary repeatedly dropped back to skeletons, and dragging, resizing, or flying the camera could restart raster work before the previous render had completed.

We treated this as a residency problem rather than a loading-spinner problem. A skeleton now appears only before a page's first successful raster. During interaction, PaperSpace scales the last successful bitmap instead of clearing it. A completed replacement renders offscreen and swaps atomically, while a separate text-layer cache remains untouched. A 288-pixel preview provides a readable fallback for every rendered page, a 48-million-pixel LRU budget bounds the unpinned high-resolution working set, and different viewport entry and exit margins prevent pages near the boundary from oscillating between render states.

Guided camera flights made the timing problem more interesting. Waiting until the camera landed produced a visible blur-then-sharpen jump, but rendering at every animation keyframe caused expensive churn. The flight controller now publishes the target page and final landing zoom as soon as focus begins. That page renders once at its destination resolution into the inactive canvas while the existing bitmap carries the pull-back and travel phases. If the render completes in time, the high-resolution page is already present before landing; if the person pans, zooms, or starts another flight, the stale pre-render is cancelled immediately.

Local files also impose an important browser security boundary. The File API gives PaperSpace the bytes the person explicitly selected, but not a reusable absolute filesystem path that an agent can reopen later. The browser stores an authorized local copy, PDF.js derives text and geometry inside the page, and WebMCP exposes only the bounded semantic operations the product supports. This is a constraint, but it is also the privacy model: a website cannot silently turn one file selection into general filesystem access.

A related boundary appeared when we tried to make visual paper content agent-readable. PaperSpace can rasterize a PDF region and place the resulting image on the desk, but its WebMCP tools currently return textual and structured metadata rather than a portable image payload that every client is required to deliver to a multimodal model. Codex can reliably read the locally extracted text and exact region geometry; whether it can inspect rendered pixels depends on a screenshot or other visual observation supplied by the host. We chose to state that limitation explicitly instead of adding a client-specific or unverified fallback.

Finally, WebMCP is still experimental. We deliberately target the current imperative `document.modelContext` API and show a clear unavailable state when the browser does not provide it. The reading desk remains useful without WebMCP, but we do not ship a deprecated alias, compatibility shim, or unverified fallback registration path.

## Accomplishments that we're proud of

We are proud that PaperSpace treats spatial context as part of understanding rather than decoration. A paper remains an unfolded, live document whose topology survives search, agent focus, temporary reorganization, and presentation.

We are also proud of the sequence model. It does not capture screenshots or save camera coordinates as a presentation. It stores semantic targets—paper regions or artifacts—and reconstructs the most useful temporary arrangement from the desk as it exists at playback time. This makes a saved sequence durable without freezing the workspace.

PaperSpace gives people and agents one source of truth. A tool that focuses a region, arranges papers, places a plot, or starts a sequence changes the same visible state as a direct person action. The result is inspectable collaboration rather than an invisible background workflow.

The application remains completely frontend-only. PDFs, extracted text, layouts, images, and frames stay in the browser's local storage. A static deployment can provide a meaningful agentic research environment without user accounts, backend document ingestion, vector infrastructure, or application secrets.

We kept the tool surface expressive but bounded. Nine tools cover discovery, retrieval, spatial navigation, arrangement, source-linked visual creation, and guided presentation. Inputs are validated, text is treated as untrusted source content, executable image formats are rejected, and agent actions are visible to the person.

The final product is more than a technical proof of concept. It includes responsive presentation behavior, reduced-motion support, local persistence recovery, viewport-aware PDF rendering, source-aware artifacts, a complete frame editor, Nord Polar Light visual design, production security headers, and a static Cloudflare Pages build.

We are especially proud that the unfolded desk no longer trades spatial continuity for rendering stability. Even under camera flight, drag, resize, cache pressure, and high-DPI zoom, a page keeps showing its last successful image, upgrades without a white flash, and arrives at a guided reading target already sharp whenever rendering completes within the flight. This makes the performance architecture visible as calmness rather than as additional interface.

## What we learned

We learned that WebMCP is strongest when the browser holds context that is both semantically important and inseparable from the user experience.

PaperSpace's useful state is not just PDF text. It includes which local documents the person authorized, where every page currently sits, which passages map to which visible regions, what the camera is showing, which artifacts came from which source, and which temporary sequence is active. A traditional server-side MCP integration could reproduce pieces of this, but it would not naturally share the live spatial world the person is using.

We also learned that an agent needs semantic handles, not recorded gestures. A frame should mean “this region of page 7” rather than “camera x/y/zoom at one moment.” A search result should include a source region rather than only a quote. A generated crop should retain its paper and page provenance. These contracts survive layout changes and remain understandable to both the person and the agent.

Spatial stability does not mean fixed coordinates. The durable properties are identity, page order, provenance, and the ability to return. Coordinates are working material. Once we separated those concepts, the agent could temporarily organize the pages relevant to one experiment without erasing the reader's larger mental map.

We learned that camera motion is part of information architecture. The pull-back phase answers “where am I leaving?”, the travel phase communicates distance, and the landing answers “what should I read now?” Removing the visible focus rectangle made the PDF itself—not the interface overlay—the final object of attention.

We also learned that PDF rendering quality is a scheduling problem, not simply a resolution setting. Keeping every page permanently at maximum resolution wastes memory; downgrading aggressively destroys continuity. The useful unit of policy is the reader's next likely view: preserve a compact preview for every rendered page, pin the small high-resolution working set that matters now, and pre-render the semantic destination rather than chasing every intermediate camera frame.

Finally, local-first and agent-capable are compatible, but capability boundaries must remain visible. The browser can expose useful, precise operations over user-authorized content without exposing original paths or introducing a document backend. Text, geometry, and reversible workspace actions are dependable today; direct visual understanding should be advertised only when the WebMCP client can prove that it supplies image observations. The key is to design tools around bounded product actions and to keep every state change visible and reversible.

## What's next for PaperSpace

Next, we want to deepen experiment-centered reading without turning PaperSpace into a general whiteboard. An agent should be able to identify the pages, figures, equations, and result tables associated with one experiment, propose a semantic sequence, and let the reader approve or refine that organization directly on the desk.

We want to improve browser-local retrieval for long and scanned papers, including optional on-device OCR and richer section-aware indexing while preserving the same normalized source geometry and privacy boundary.

We also want a standards-based visual-read path. When WebMCP clients expose a portable, capability-testable way to deliver image content or annotated screenshots to the agent, PaperSpace can offer exact page-region observations without pretending that an absolute local path is available or coupling the app to one client.

We also want to strengthen multi-paper synthesis. A sequence could connect a method from one paper, a competing assumption from another, and a replication result from a third while keeping every source page live and spatially grounded.

Further work includes more complete keyboard navigation, accessible spoken descriptions of spatial moves, larger-corpus rendering benchmarks, import and export of local workspace bundles, and broader testing across WebMCP-capable browsers and agent clients.

Our larger goal is to make research reading a genuinely shared human-agent activity: papers remain source material rather than chat attachments, the reader retains spatial context and control, and the agent can help direct attention, assemble evidence, and explain relationships inside the same visible workspace.
