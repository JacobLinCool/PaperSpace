# PaperSpace WebMCP Demo Video Script

## Production target

- **Audience:** Devpost judges for The WebMCP Challenge
- **Primary story:** how Codex, browser-declared WebMCP tools, and PaperSpace form one visible interaction loop
- **Source paper:** _Balance of Benchmarks: Semantic Density Reweighting for Benchmark Multiplicity and Task-Conditioned Evaluation_
- **Maximum length:** 3 minutes
- **Narration:** English
- **Format:** real PaperSpace footage plus a concise diagram of the browser-native tool flow

## Storyboard and narration

### Scene 1: The browser becomes an agent interface

**On-screen title:** `PaperSpace + WebMCP`

**Subtitle:** `A live research desk that an AI agent can operate with you`

**Screen action:** Begin on the unfolded paper and reveal the full spatial desk.

**Narration**

> This is PaperSpace, a browser-native research workspace that exposes its live reading desk to AI agents through WebMCP. The paper is our test. Can an agent turn one request into visible, grounded interaction?

### Scene 2: Ask in Codex, watch the browser respond

**On-screen caption:** `Ask in Codex · watch the browser respond`

**Screen action:** Show Codex and PaperSpace side by side. Animate the user prompt through the WebMCP bridge into the browser workspace.

**Narration**

> The user asks Codex, “Introduce this paper using PaperSpace.” PaperSpace is open beside the conversation in the built-in browser. WebMCP lets that page expose its own capabilities to the agent, so the answer appears as visible interaction on the shared desk, with chat providing concise guidance.

### Scene 3: A browser-declared tool chain

**On-screen caption:** `inspect_workspace → read_paper_pages → present_sequence`

**Screen action:** Reveal the three real WebMCP tools in order, with their purpose under each call.

**Narration**

> When the page opens, Codex discovers the tools declared by the site. It calls inspect workspace once for a compact desk briefing, reads the indexed paper in one broad request, then calls present sequence with semantic page regions and captions. The browser-local workspace connects the agent directly to the active reading context.

### Scene 4: A live, local spatial desk

**On-screen caption:** `24 live PDF pages · browser-local`

**Screen action:** Show the entire paper unfolded as page sheets on the borderless canvas.

**Narration**

> PaperSpace keeps every PDF page live on a borderless two-dimensional desk. Page identity and order remain visible while positions can change. Browser authorization keeps the PDF, extracted text, layout, and saved sequences together in local workspace storage.

### Scene 5: Deliver the answer inside PaperSpace

**On-screen caption:** `Original regions · captions · temporary grouping`

**Screen action:** Start the guided sequence and move through the paper’s problem, method, and result.

**Narration**

> For a grounded introduction, present sequence gathers the relevant original pages, preserves their source slots, and adds a caption to every view. Here Codex moves from the paper’s motivation, to its method, to the evidence, with every explanation anchored to the original pages.

### Scene 6: Focus with semantic coordinates

**On-screen caption:** `focus_region · normalized coordinates`

**Screen action:** Call `focus_region` on a real figure and show the full pull-back, travel, and landing motion.

**Narration**

> If the user asks about a precise figure or equation, focus region targets normalized coordinates on the live page. The camera pulls back, travels across the desk, and lands with the requested region centered in a readable view. The person can redirect the motion at any time.

### Scene 7: One shared, reversible state

**On-screen caption:** `Shared state · reversible by default`

**Screen action:** Exit the sequence and show the gathered pages returning to their exact source slots.

**Narration**

> Every command participates in one shared, reversible state. The person sees each change in the browser, can move pages or stop a flight, and can keep or exit a sequence. On exit, PaperSpace restores the exact page geometry and the previous camera.

### Scene 8: The WebMCP loop

**On-screen title:** `Codex ↔ WebMCP ↔ PaperSpace`

**Subtitle:** `The browser is the shared interface`

**Screen action:** Close on the three-part architecture, followed by the deployment and local-storage facts.

**Narration**

> That is the WebMCP loop: Codex understands the request, the browser exposes the tools, and PaperSpace becomes the shared interface. It is a pure SvelteKit frontend, persisted in IndexedDB and deployable to Cloudflare Pages. The browser itself is the integration layer.

## Prompt shown in the video

```text
Introduce this paper using PaperSpace.
```

## Closing lockup

```text
PaperSpace
The browser is the shared interface

paperspace.pages.dev
github.com/JacobLinCool/PaperSpace
```
