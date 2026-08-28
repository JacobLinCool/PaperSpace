# PaperSpace

PaperSpace is a local-first spatial desk for reading, understanding, and presenting research papers. Drop PDFs onto a borderless canvas, search their text with page geometry, focus exact passages, and move through captioned semantic views across distant pages.

It is deliberately smaller than a general whiteboard. There are no sticky notes, diagrams, accounts, collaboration features, or backend services. The entire product runs in one browser tab and stores its workspace in IndexedDB.

## What it does

- Imports one or more local PDFs and unfolds every page in reading order on a freeform pan-and-zoom desk.
- Renders each page as an independently movable and resizable live PDF sheet with selectable text using PDF.js.
- Extracts and indexes text with normalized page geometry for cross-paper search and precise focus.
- Reflows paper pages into deterministic grids and arranges unfolded paper groups as a grid, reading row, or columns.
- Places source-linked PDF crops, validated raster images, and safe declarative plots on the desk.
- Presents captioned sequences that temporarily gather related original pages, preserve numbered source slots, and restore the desk on exit.
- Registers browser-native WebMCP tools against the same visible workspace.
- Persists authorized PDF copies, image bytes, positions, page indexes, and saved sequences locally.

No PDF content is uploaded by the application.

## WebMCP

PaperSpace uses the current imperative API at `document.modelContext.registerTool`. There is no MCP server and no compatibility shim for the deprecated navigator API.

| Tool                    | Effect                                                                              |
| ----------------------- | ----------------------------------------------------------------------------------- |
| `inspect_workspace`     | Returns reusable readiness, compact paper briefs, geometry, visuals, and sequences. |
| `search_papers`         | Progressively finds indexed passages with focusable regions and coverage.           |
| `read_paper_pages`      | Reads a contiguous range or a whole indexed paper in one call.                      |
| `focus_region`          | Flies through spatial context to a recent match or explicit live-page region.       |
| `arrange_papers`        | Atomically reflows paper groups with app-side spatial conflict guards.              |
| `snapshot_paper_region` | Places a guarded, source-linked crop for persistent comparison.                     |
| `place_plot`            | Places a guarded line plot for semantically ordered numeric data.                   |
| `place_image`           | Validates and safely places a self-contained PNG, JPEG, or WebP image.              |
| `present_sequence`      | Gathers related original pages and presents captioned views; temporary by default.  |

When PaperSpace is available, substantive paper-grounded introductions, explanations, reviews, comparisons, and multi-region answers should be delivered through `present_sequence` with captioned original paper regions. Chat remains concise supporting context. Simple localized Q&A and explicit text-only requests are the exceptions.

Read tools return structured content as well as a text representation. PDF text becomes searchable page by page during indexing. Visible spatial mutations run an app-side preflight and fail without changing state when they would crowd or cover existing content; `force: true` is an explicit visual-only override.

See [docs/WEBMCP.md](docs/WEBMCP.md) for the tool contract and testing notes.

## Run locally

Requirements: Node.js 22 or later and pnpm 11.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:5173`, then drag a PDF onto the desk or use the import control.

For WebMCP testing, open the site in a WebMCP-capable agent browser. PaperSpace makes browser support visible in the top bar; the reading desk itself remains fully usable when WebMCP is unavailable.

## Quality checks

```bash
pnpm check
pnpm lint
pnpm test
pnpm test:e2e
pnpm build
```

The production build is a static site in `dist/`.

## Deploy to Cloudflare Pages

Create a Pages project for this repository with:

- Build command: `pnpm build`
- Build output directory: `dist`
- Node.js version: 22 or later

No environment variables, server functions, databases, or storage bindings are required. SvelteKit generates a hash-based content security policy for each static build, while `static/_headers` supplies Cloudflare-only response headers such as frame protection.

## Architecture

PaperSpace has four client-side layers:

1. Svelte components render the desk, live PDFs, visual artifacts, search, and presentation controls.
2. A single reactive workspace owns paper metadata, live page sheets, page regions, artifacts, camera flights, sequences, and agent-visible state.
3. PDF.js renders pages and extracts text in a same-origin web worker.
4. IndexedDB stores validated workspace metadata, authorized PDF copies, and raster image bytes in separate object stores.

The WebMCP adapter is a thin registration boundary over the workspace API. This keeps tool behavior identical to direct person actions and prevents a second, agent-only state model.

## Project scope

PaperSpace was implemented as a focused, open-source WebMCP Challenge project. This repository is a clean browser-only implementation centered on individual paper reading, local text retrieval, and frame-based presentation.

## License

[MIT](LICENSE)
