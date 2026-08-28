# Product

<!-- impeccable:product-schema 1 -->

> Product facts in this initial record are inferred from the explicit implementation brief supplied on 2026-08-28. The brief delegated implementation details and asked for direct execution without a discovery pause.

## Platform

web

## Stack

Delegated: SvelteKit 2 and Svelte 5 with a fully static adapter, TypeScript, PDF.js, IndexedDB, and the browser-native WebMCP imperative API. The stack preserves the interaction model while producing static assets that deploy directly to Cloudflare Pages.

## Users

Individual researchers, graduate students, and technical readers working alone on a desktop or laptop. Their core job is to spread multiple papers across a persistent spatial desk, compare distant pages, and build a guided reading sequence without switching among tabs or losing spatial context.

## Product Purpose

PaperSpace is a local-first, two-dimensional paper-reading desk. It lets one person place PDFs freely on a borderless canvas, inspect and search their contents, focus exact page regions, derive visual explanations, and present a sequence of semantic views across distant pages.

Success means the reader can import a paper, retrieve relevant passages with an agent, see the exact source regions in context, place a crop or derived visual beside the paper, and move through a captioned sequence in one coherent browser-only experience.

## Positioning

PaperSpace is neither a conventional tabbed PDF reader nor a general whiteboard. Its distinctive mechanism is a persistent spatial workspace in which source PDFs remain live, searchable documents while both the person and a WebMCP agent act on the same visible two-dimensional arrangement.

## Operating Context

- Desktop-first personal research sessions using a mouse or trackpad.
- Academic PDFs with multi-column text, figures, tables, appendices, and long page ranges.
- A WebMCP-aware browser agent may inspect and operate the open workspace with user-mediated permission.
- The application is opened from a static Cloudflare Pages URL and requires no account or backend.

## Capabilities and Constraints

- Borderless pan-and-zoom canvas with every PDF page unfolded as a freely positioned and resizable live sheet.
- Local PDF import, deterministic reading-order page grids, live rendering, and progressively searchable extracted text that becomes available page by page.
- Persistent desks, authorized PDF copies, per-page geometry, raster artifacts, and saved semantic sequences stored locally in IndexedDB.
- Region focus uses top-left normalized page coordinates and a pull-back, travel, and landing camera flight without covering the source with an outline.
- Visual artifacts are limited to source crops, signature-validated raster images, and safe declarative numeric plots; arbitrary HTML and SVG are excluded.
- Frame sequences contain semantic targets—paper regions or visual artifacts—with a name and caption. During presentation, unique related source pages gather beside their paper while numbered source slots preserve page-order context; exiting restores the exact prior layout. Agent-created sequences are temporary unless explicitly saved or kept by the person.
- WebMCP tools provide a reusable compact desk briefing, search and read the currently indexed page range, focus or arrange content, place guarded visuals, and present atomic sequences.
- The browser can only use files the person explicitly selects. Original filesystem paths are neither available to nor exposed by the app; PaperSpace works with browser-authorized local copies.
- Single-person only. No authentication, collaboration, presence, comments, billing, diagram sheets, sticky notes, Mermaid, or backend MCP server.
- Pure frontend output. No server routes, Cloudflare Workers, server processes, databases, object storage, or required third-party service. PDF.js uses a same-origin browser Web Worker shipped as a static client asset.

## Brand Commitments

- Product name: **PaperSpace**.
- Inherit **Nord Polar Light** visual world and overall color system.
- Light-only. Paper remains brighter than the Snow Storm desk surface.
- The surface is the product: a quiet top status bar, a borderless desk, floating bottom controls, and contextual panels instead of a permanent inspector.
- System sans typography and Lucide icons with restrained, high-density controls.

## Evidence on Hand

- `DESIGN.md` define the incumbent product and visual identity.
- No testimonials, user counts, benchmarks, or external case studies are available and none may be fabricated.

## Product Principles

1. **Papers before chrome.** Interface furniture recedes so source material owns attention.
2. **Spatial context is durable.** Page identity and order are stable while page position remains editable; temporary sequence layouts never overwrite the saved desk.
3. **Source material stays live.** A paper remains renderable and text-searchable rather than becoming a screenshot.
4. **Agents share the visible desk.** WebMCP operates the same client-side state the person sees, with clear tool contracts and immediate visual feedback.
5. **Focused scope beats whiteboard breadth.** Every feature must strengthen reading, understanding, comparison, or presentation of papers.
6. **Prepare once, read in one pass.** Agents reuse a compact briefing, then request the broadest useful contiguous range in one call. Whole-paper reads are valid when a question needs full context; repeated small page batches are not the default.

## Accessibility & Inclusion

- All icon-only controls require accessible names and visible tooltips.
- Keyboard shortcuts supplement, never replace, visible controls.
- Motion respects `prefers-reduced-motion` and camera transitions settle immediately when requested.
- Nord Polar Light contrast must meet WCAG AA for interface text and controls.
