---
name: PaperSpace
description: A quiet Nord Polar Light spatial desk for reading, comparing, and presenting live PDFs.
colors:
  text-strong: '#2e3440'
  text: '#3b4252'
  text-muted: '#4c566a'
  desk: '#eceff4'
  desk-deep: '#e5e9f0'
  paper: '#ffffff'
  paper-soft: '#f8f9fb'
  frost-deep: '#4d6e97'
  frost: '#81a1c1'
  frost-cyan: '#88c0d0'
  frost-teal: '#8fbcbb'
  danger: '#a94b55'
  warning: '#d2a93b'
  success: '#769d5c'
  accent: '#b48ead'
  border: 'rgb(76 86 106 / 18%)'
  border-strong: 'rgb(76 86 106 / 32%)'
  selection: 'rgb(136 192 208 / 35%)'
  caption-surface: 'rgb(10 12 16 / 76%)'
  caption-shadow: 'rgb(10 12 16 / 20%)'
typography:
  headline:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '21px'
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: '-0.015em'
  title:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '14px'
    fontWeight: 650
    lineHeight: 1.2
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13.5px'
    fontWeight: 400
    lineHeight: 1.55
  caption:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 1.45
  compact-body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '12.5px'
    fontWeight: 400
    lineHeight: 1.5
  action:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 600
    lineHeight: 1
  input:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '13px'
    fontWeight: 400
    lineHeight: 1
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: '11.5px'
    fontWeight: 600
    lineHeight: 1.25
  mono:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    fontSize: '10.5px'
    fontWeight: 400
    lineHeight: 1.45
  micro:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    fontSize: '9.5px'
    fontWeight: 400
    lineHeight: 1.4
  plot:
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
    fontSize: '9px'
    fontWeight: 400
    lineHeight: 1.2
rounded:
  paper: '2px'
  field: '4px'
  sm: '6px'
  md: '10px'
  lg: '14px'
  pill: '999px'
  circle: '50%'
spacing:
  micro: '2px'
  tight: '4px'
  compact: '8px'
  control: '12px'
  panel: '14px'
  float: '16px'
  desk-grid: '24px'
  page-gap: '64px'
  paper-gap: '168px'
components:
  icon-button:
    backgroundColor: 'transparent'
    textColor: '{colors.text-muted}'
    rounded: '{rounded.sm}'
    size: '34px'
  icon-button-small:
    backgroundColor: 'transparent'
    textColor: '{colors.text-muted}'
    rounded: '{rounded.sm}'
    size: '28px'
  primary-action:
    backgroundColor: '{colors.frost-deep}'
    textColor: '{colors.paper}'
    typography: '{typography.action}'
    rounded: '{rounded.sm}'
    padding: '0 14px'
    height: '34px'
  search-field:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text-strong}'
    typography: '{typography.input}'
    rounded: '{rounded.sm}'
    padding: '0 10px'
    height: '36px'
  paper-sheet:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    rounded: '{rounded.paper}'
  panel:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    rounded: '{rounded.lg}'
  frame-editor:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    width: '370px'
  presentation-caption:
    backgroundColor: '{colors.caption-surface}'
    textColor: '{colors.paper}'
    typography: '{typography.caption}'
    rounded: '{rounded.sm}'
    padding: '8px 12px'
  status-bar:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.text}'
    height: '44px'
---

# Design System: PaperSpace

## Overview

**Creative North Star: "The Polar Reading Room"**

PaperSpace inherits Nord Polar Light thesis: a quiet Snow Storm field, brighter white papers, restrained Frost controls, compact Polar Night type, and only enough chrome to support concentrated reading. It is light-only. The desk is not a card or framed workspace; it is a full-bleed, borderless dotted field whose papers remain the dominant visual objects.

The interface uses three physical altitudes: the desk at ground level, live PDF and visual sheets above it, and contextual chrome floating highest. The product is a focused paper-reading workspace, not a general whiteboard. Diagram nodes, connectors, sticky notes, drawing tools, and generic canvas-object patterns do not belong.

The confirmed direction-contract seed is `guided-region-triad`. Its shipped visual signature is a gathered-region triad: one captioned sequence draws the original related-work, method, and result pages out of an unfolded paper, leaves numbered source slots behind, and guides the camera across three exact PDF-region targets. It proves that a reading sequence can reorganize distant source areas without flattening them into screenshots or erasing their place in the paper. Three is the reference composition, not a universal frame-count rule; the durable rule is that each frame names a semantic paper region or visual artifact.

This world ships as a fully static Cloudflare Pages client. Workspace state, authorized PDF copies, and raster artifacts remain browser-local; the PDF worker is a same-origin static asset. Backend states and server-dependent surfaces are outside the design system.

**Key Characteristics:**

- A calm, high-density system UI that recedes behind source material.
- Every PDF page unfolded in reading order as a live white sheet on a cool dotted desk, never a page-swapping card, thumbnail, or screenshot.
- Top-left normalized source regions that guide camera landing without adding an overlay box to the paper.
- Sequence-driven page gathering with numbered source slots and exact restoration on exit.
- Compact floating controls and panels that appear only when the current task needs them.
- Captioned semantic sequences with explicit human control over whether an agent-created sequence is kept.
- Frost Deep for selection and primary action; Aurora hues are semantic, not decorative.
- Lucide outline icons at 1.75 stroke weight, paired with text or accessible names.

## Colors

Nord Polar Light separates the cool Snow Storm desk from bright paper while Polar Night carries nearly all text. Frost provides interaction emphasis; Aurora colors communicate state only.

### Primary

- **Frost Deep:** Selection outlines, primary actions, active icon controls, import state, links, and agent feedback. White is its on-color.
- **Frost, Frost Cyan, and Frost Teal:** Supporting interaction colors. Frost Cyan also supplies the translucent text-selection wash.

### Secondary

- **Danger:** Destructive hover states, failed indexing, save failures, PDF render failures, and danger toasts.
- **Success:** WebMCP readiness dots and the tinted ready message.
- **Warning and Accent:** Reserved semantic tokens. Do not use them as ornamental variety.

### Neutral

- **Polar Night:** `text-strong`, `text`, and `text-muted` establish the complete text hierarchy.
- **Snow Storm:** `desk` is the canvas; `desk-deep` is hover fill, skeleton ink, and subtle tonal separation.
- **Paper:** `paper` is the brightest surface; `paper-soft` is a quiet field state.
- **Borders:** Translucent muted Polar Night at regular and strong opacity separates controls without making the desk feel boxed in.

**The Paper Is Brightest Rule.** Keep source pages and chrome brighter than the Snow Storm field; never invert the hierarchy.

**The Semantic Aurora Rule.** Danger, warning, success, and accent communicate meaning only. They are not a decorative palette.

**Contrast convention.** Strong, regular, and muted Polar Night text exceed 6:1 on Paper and Snow Storm. Frost Deep and Danger exceed 4.5:1 on Paper and `desk`; white on either also exceeds 4.5:1. Do not place small Frost Deep text on `desk-deep`, where the pairing is 4.32:1.

## Typography

The interface uses one system sans stack for fast, native-feeling controls and one system monospace stack for measurements, page numbers, indices, and tool names. There is no display face.

### Hierarchy

- **Headline:** Reserved for the empty-desk invitation; bold and compact.
- **Title:** Panel headings and brand-scale labels; semibold rather than oversized.
- **Body:** Explanations, empty states, search excerpts, and captions.
- **Label:** Controls, field labels, statuses, and metadata.
- **Mono:** Zoom percentages, page counts, frame numbers, page references, shortcuts, and WebMCP tool identifiers. Use tabular numerals where values change.

**The Source Leads Rule.** Interface type stays small and restrained so PDF typography, figures, and tables own attention.

## Layout

The application fills the viewport and prevents page scrolling. A fixed status bar occupies the top 44px; the pan-and-zoom desk fills everything below it. The desk uses a 24px radial-dot rhythm with 0.75px muted dots and no surrounding border.

Desktop chrome is spatial rather than permanent: the main toolbar floats 16px above the bottom center, the zoom dock floats 16px from the lower-right corner, search opens as a 390px maximum inset panel, WebMCP opens as a 430px maximum popover, and frames open as a 370px right-edge editor. At 721px and above, the desk yields exactly 370px to that editor instead of allowing it to cover the reading target. Search and frames are mutually exclusive. Keep contextual surfaces near their trigger and leave the rest of the desk visible whenever space allows.

Focused-region composition is responsive state, not a one-time camera capture. Region coordinates are top-left normalized within an individual live page sheet, converted through that page's current world geometry, and fitted with breathing room. A viewport resize or the desktop frame editor changing the desk width triggers a camera refit so the source remains visible. Guided focus is blue-free: it never paints a rectangle, wash, or selection outline over the PDF. On narrower viewports, panels overlay rather than permanently shrinking the already constrained desk.

Presentation focus reserves explicit caption-safe insets around every semantic target. Desktop uses 76px top, 88px left and right, and 156px bottom; viewports at 640px or narrower use 68px top, 24px left and right, and 184px bottom. These insets protect the source from the caption and navigation stack instead of shrinking or obscuring it after landing.

| Surface         | Desktop                                                                              | 390px viewport                                                                           |
| --------------- | ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Status bar      | Three columns: brand and desk name, centered workspace status, WebMCP and frames     | Two columns; center status, brand word, and WebMCP text hide while their controls remain |
| Empty desk      | Paper illustration and copy in two columns                                           | Single centered column below the 640px breakpoint                                        |
| Search          | 390px maximum panel with 12px right inset                                            | 366px wide, preserving 12px margins                                                      |
| WebMCP          | 430px maximum popover with a responsive 12px to 48px right inset                     | 366px wide, preserving approximately 12px margins                                        |
| Frames          | 370px right edge panel                                                               | 370px wide, leaving a narrow strip of desk                                               |
| Bottom controls | Toolbar centered; zoom dock at bottom right                                          | Toolbar remains at bottom; zoom dock moves to 70px above the edge to avoid overlap       |
| Presentation    | Editing accessories, main toolbar, and zoom dock hide; caption sits above navigation | The same paper-first state; caption and navigation form a compact bottom stack           |
| Toasts          | Centered 76px above the bottom edge                                                  | Lifted to 124px above the edge so bottom controls remain clear                           |

The recurring spacing vocabulary is practical rather than ornamental: 2 to 5px inside dense controls, 8 to 14px for control and panel padding, 16px for floating offsets, and 24px for the desk rhythm. Do not expand this into generous dashboard spacing that displaces papers.

## Elevation & Depth

Depth is a strict three-altitude model:

1. **Desk:** Flat Snow Storm color and dots, with no outer container or shadow.
2. **Paper:** A 1px translucent border and `0 1px 3px rgb(46 52 64 / 12%), 0 1px 2px rgb(46 52 64 / 8%)`. Selection raises it to `0 4px 14px rgb(46 52 64 / 18%), 0 2px 4px rgb(46 52 64 / 10%)` plus an inset-aligned Frost Deep outline.
3. **Chrome:** Toolbars, docks, menus, panels, and popovers use `0 2px 12px rgb(46 52 64 / 14%)`. The status bar uses only `0 1px 2px rgb(46 52 64 / 5%)` so it remains quiet.

Transient messages may rise above chrome with a stronger `0 4px 16px rgb(46 52 64 / 24%)`; presentation captions use a dark translucent field and a `0 3px 12px rgb(10 12 16 / 20%)` shadow.

### Motion

State changes use the shared `120ms ease-out` transition. Guided camera moves pull back to a shared overview, follow a subtle spatial arc at overview altitude, then land on the target. Center and logarithmic zoom are sampled from one C1-continuous monotone Hermite spline, so pull-back, travel, and landing remain legible phases without stopping at their boundaries. Routine flights stay distance-aware at 560–1100ms; sequence flights use a calmer 720–1400ms range that also accounts for zoom distance. As soon as a paper-region flight begins, its target sheet pre-renders against the final landing zoom into the inactive canvas while the last successful bitmap remains visible; a replacement flight or manual camera input cancels that work. Sequence pages move over 680ms. A PDF skeleton fades once after the first successful raster; later raster upgrades swap atomically without fading the paper away. Toasts settle over `180ms`, and tooltips fade over `110ms ease-out` after a 420ms reveal delay. Manual pan or zoom cancels a flight immediately. Under `prefers-reduced-motion: reduce`, camera and page-layout motion settle directly.

**The Three Altitudes Rule.** New surfaces must belong clearly to desk, paper, or chrome. Do not create intermediate card stacks, decorative shadows, or competing elevation levels.

## Shapes

Paper geometry is nearly square-cornered at the `paper` radius. Editable frame fields use the `field` radius. Compact controls use `sm`, menus and smaller floating chrome use `md`, and primary panels or toolbars use `lg`. Pills are reserved for scrollbars; circles are reserved for status dots, frame indices, and the selected-paper resize handle.

Borders are one-pixel, translucent, and functional. The desk itself has no border. A manually selected page uses an outline scaled inversely with zoom so the perceived stroke remains 2px, and its circular resize handle remains a perceived 14px. Guided focus and presentation never reuse this selection outline.

**The Paper Silhouette Rule.** A PDF should read as a sheet, not a rounded card. Keep its radius at the paper value.

## Components

### Unfolded live PDF pages

A paper is a titled group of individual live page sheets arranged left-to-right and top-to-bottom. Each sheet has its own persisted world geometry and an independently cached transparent selectable PDF.js text layer. Neutral skeleton lines appear only before a page's first successful raster. Camera motion, dragging, and resizing scale the last successful bitmap, then one higher-resolution render completes in an inactive canvas and swaps atomically after interaction settles. Every loaded page retains a 288px-wide aspect-preserving preview; a 48,000,000-pixel LRU budget bounds high-resolution canvases and evicts only unpinned nearby or offscreen pages back to that preview. Pages intersecting the strict viewport, selected pages, focused regions, and the active paper frame stay pinned at high resolution. Separate viewport entry and exit margins prevent pages near the boundary from repeatedly changing render state. Render failure appears as a Danger-tinted message without clearing the last successful bitmap.

Every sheet carries an inverse-scaled page number. Hover or manual selection reveals a compact toolbar with the page reference, focus, and whole-paper removal. A contextual label exposes the paper title and indexing state. There are no previous or next page controls because all pages already exist on the desk. Selection adds the Frost Deep outline, raised paper shadow, and circular resize handle; double-click focuses that page.

Search, WebMCP, and semantic frames convert a normalized region through the target sheet's current geometry. The camera then pulls back, travels, and lands with deliberate breathing room. The region itself stays clean and readable, without an outline, wash, selection state, or captured camera rectangle.

### Visual artifact

Source crops and signature-validated PNG, JPEG, and WebP images use the same sheet-like silhouette as papers; declarative numeric plots use a white plotting surface with restrained Polar Night axes and the existing Nord palette for series. Artifacts move, resize, focus, and delete like spatial reading material, but never expose generic drawing controls or executable markup. A source crop retains its paper, page, and normalized region and offers a contextual action back to that exact source. Its lower label identifies the title and artifact kind.

### Status bar

The 44px status bar holds brand and editable desk name at the start, paper/page/import/save status in the center, and WebMCP plus frame controls at the end. WebMCP state uses both a labeled control and a semantic dot; save errors and import activity change text color without changing the bar's quiet white surface.

### Floating toolbar and zoom dock

The bottom toolbar groups import, search, and paper arrangement. Its arrangement menu opens upward. The separate zoom dock groups zoom out, a resettable monospace percentage, zoom in, and fit all content. Icon buttons are 34px, or 28px in dense controls; pressed controls invert to Frost Deep with white icons, disabled controls use 42% opacity, and destructive hover uses a light Danger tint.

### Contextual panels

- **Search:** A rounded inset panel with a labeled query field, primary Search action, local-index guidance, quiet empty states, and compact result rows. Results show title, monospace page reference, and a three-line excerpt.
- **WebMCP:** A compact top-right popover with readiness messaging, a quiet “Prepare once, then ask” strip with one copy action, and a two-column inventory of the nine registered tools: `inspect_workspace`, `search_papers`, `read_paper_pages`, `focus_region`, `arrange_papers`, `snapshot_paper_region`, `place_plot`, `place_image`, and `present_sequence`. The copied prompt tells Codex to reuse one compact briefing, then combine later paper reading into the broadest useful one-call range; whole-paper reads are explicitly allowed. A pinned, low-emphasis destructive footer lets the person explicitly reset all browser-local desk data after confirmation. Tool identifiers use monospace; capability descriptions stay muted.
- **Frames:** A 370px right-edge editor for the saved semantic sequence. Agent-created temporary sequences appear in presentation first and enter this panel only when saved or explicitly kept. Each numbered frame exposes an editable name and caption, a paper-region or visual-artifact target label, and focus, reorder, and delete actions on hover or focus; actions remain visible on non-hover devices. Frames store semantic targets, never camera screenshots.

### Frame presentation

Presentation is also the reading-set layout. Before the first frame, every unique paper-region page is gathered once in frame first-appearance order into the nearest clear horizontal lane beside its related paper bounds. The complete staged group shifts only far enough to preserve 24px clearance from live pages and visual artifacts. Numbered low-contrast source slots remain in the original grid; unrelated pages and visual artifacts do not move. Presentation hides page and artifact editing accessories, the main toolbar, the zoom dock, and the frame editor, then shows a centered previous/count/next/exit bar. The frame name and optional caption float above it on a dark translucent surface while the camera flies to the semantic target with enough inset to keep caption chrome clear of the source. Exiting restores exact page geometry and the entry camera. A temporary sequence exposes an explicit Keep action that saves semantic frames only. Arrow keys, Page Up/Down, Space, and Escape mirror visible controls.

### Tooltips and accessibility

Every icon-only control has an accessible name and a visible tooltip. Tooltips appear on hover and keyboard focus, prefer the space below, flip above when necessary, and clamp their center to an 8px viewport inset; they use a 7px trigger gap and a 190px maximum width. Pressed controls expose `aria-pressed`; panels use labeled semantic sections; status changes and search results use live regions; dangerous errors use alerts. Keyboard shortcuts supplement visible controls. Global keyboard focus uses a 2px Frost Deep ring at 60% opacity, and text selection uses the Frost Cyan selection token.

## Do's and Don'ts

### Do:

- **Do** preserve the three-altitude hierarchy and let PDF pages remain the brightest, most prominent objects.
- **Do** use Frost Deep for primary action and selection, and Danger only for destructive or failed states.
- **Do** keep controls compact, contextual, keyboard reachable, AA-contrast compliant, and labeled for assistive technology.
- **Do** keep tooltips inside the viewport and move competing bottom controls at narrow widths.
- **Do** preserve top-left normalized source regions, resolve them through the target page's current geometry, and refit the camera when the available desk viewport changes.
- **Do** keep page identity and reading order stable while allowing page positions to move; sequence layouts must leave source slots and restore exactly on exit.
- **Do** make frame targets semantic paper regions or visual artifacts, and require an explicit Keep action for temporary sequences.
- **Do** keep visual artifacts source-linked or safely declarative: crops, signature-validated raster images, and numeric plots only.
- **Do** preflight Agent spatial mutations against live pages and visuals before committing. A conflict must leave the desk unchanged unless the Agent explicitly uses the visual-only `force` override.
- **Do** make extracted paper text progressively available page by page and keep the initial WebMCP briefing bounded, reusable, and explicit about indexing coverage.
- **Do** let agents read a whole indexed paper in one call when full context matters; prefer one broad contiguous read over repeated small page batches.
- **Do** preserve pure static Cloudflare Pages deployment: browser-local state, same-origin PDF worker assets, and no required environment variables or server bindings.
- **Do** make new features strengthen paper reading, comparison, search, spatial arrangement, or frame presentation.

### Don't:

- **Don't** add dark mode. The implemented design system is light-only.
- **Don't** wrap the desk in a card, add a permanent inspector, or fill the viewport with dashboard chrome.
- **Don't** introduce whiteboard, diagram, connector, drawing, Mermaid, sticky-note, or generic canvas-object patterns.
- **Don't** turn live PDFs into thumbnails, screenshots, or decorative document cards.
- **Don't** collapse a paper into one page-swapping item or draw a focus rectangle over guided source content.
- **Don't** store frame views as camera captures or accept arbitrary HTML, SVG, or executable artifact payloads.
- **Don't** introduce backend behavior, server routes, Workers, databases, object storage, accounts, or collaboration into this visual system.
- **Don't** use Aurora colors as decoration, invent extra elevation levels, or add gratuitous motion.
