# AGENTS.md — how to extend this template

This repository is a **UI foundation**, not a finished product. It is designed
so that a prompt-driven agent (Claude Code, Cursor, Codex, a custom script) can
turn it into almost any kind of website by adding *feature modules* on top of
a shell that already handles navigation, right-click menus, a command palette,
keyboard shortcuts, tactile feedback, audio cues, settings, theming, and a
news feed that never repeats itself.

Everything below is the contract. Follow it and the shell picks up your work
automatically. Break it and the site still runs, but it stops feeling good.

---

## 1. Mental model

```
site.config.ts            ← one declarative spec: name, copy, theme, nav style, demos
src/core/                 ← the shell. You rarely edit this.
src/features/studio/      ← the visual builder (see §2b)
src/features/<id>/        ← one folder per feature. This is where you build.
src/features/index.ts     ← the module list (npm run new:feature edits it)
```

The template is **not terminal-specific**. Dense, keyboard-first UI is one
category in the feature catalog, not the house style — the same foundation is
meant to carry a portfolio, a shop, a documentation site or a toy.

A **feature module** is a plain object (`defineFeature({...})`) declaring:

| Field           | What the shell does with it                                     |
|-----------------|-----------------------------------------------------------------|
| `routes`        | Rendered via the catch-all route. Supports `/a/:id` and `/a/*`. |
| `nav`           | Top tabs and sidebar entries (grouped, ordered, badged).        |
| `commands`      | Show up in ⌘K with fuzzy search.                                |
| `shortcuts`     | Global hotkeys, including two-key chords (`"g p"`).             |
| `contextMenus`  | Items for a right-click *scope* (see §4).                       |
| `settingGroups` / `settings` | Appear in the settings drawer, persisted, searchable. |
| `statusItems`   | Small widgets in the bottom status bar.                         |
| `onMount`       | Start streams/timers on the client. Return a cleanup.           |
| `demo: true`    | Module only loads if listed in `site.demoModules`.              |

The full type is in `src/core/types.ts`. Read it once.

---

## 2. Adding a feature (the happy path)

```bash
npm run new:feature orders --name "Orders" --icon ListOrdered
npm run dev
```

Then fill in `src/features/orders/index.ts`. The complete, realistic example is
`src/features/studio/` — the Builder itself (routes, commands, shortcuts, context
menus, module settings). A component reference is `src/features/showcase/`,
hidden from nav but routable at `/showcase`.

Checklist before you say a feature is done:

- [ ] `npm run typecheck` and `npm run build` pass.
- [ ] Every interactive element is a `Button`, `Switch`, `Segmented`, etc. from `@/core/ui`, so it has sound + press feedback for free.
- [ ] Anything a user might right-click carries `{...ctxProps(scope, id, data)}` and the module contributes items for that scope.
- [ ] Every event you emit goes through `ctx.publish({ key, ... })` **with a stable key** (§3).
- [ ] Any list that can exceed ~100 rows uses `VirtualList`.
- [ ] New options are `settings` on the manifest; most of them `advanced: true`.
- [ ] Useful actions are also `commands` (so ⌘K finds them) and, if frequent, `shortcuts`.
- [ ] Sensitive numbers are wrapped in `<Blur>`; identifiers get the `streamer-hidden` class.
- [ ] Nothing imports a store directly from a page when `useActions()` can do it.

---

## 2b. The Builder (`/builder`)

The Builder is the front door: **one workspace** where you lay out what a site
should be *before* writing the prompt that says what it is.

| Panel | Where | What it does |
|---|---|---|
| **Look** | left, toggle with `l` | Colour and texture. Six roles every part reads, a mixer, harmony generators, contrast readouts; under it a stack of texture layers that compile to plain CSS. |
| **Parts drawer** | under the board | Three steps: category (emoji, own colour) → sub-group → the parts as live previews on contrasting discs. Search cuts across all of it. Prunable; drag or click to place. |
| **Design / Preview** | top left | One switch (`p`). Design shows the board; Preview puts the live site in exactly the same place, with the library and panels gone. Nothing moves under you. |
| **Board** | centre | A page frame (1440 / 834 / 390 wide) is the site's viewport. Parts land inside it at real size and draw what they'll be. Snap, resize, draw regions, connect with arrows, group, and prompt each one. |
| **Companion** | floating, draggable | The same page as a phone or tablet — never desktop, since the board is the desktop view. Tap a part in it to select that part on the board. |
| **Element / Format / Pages** | right | The selected part's contents, size and position in the frame, options and prompt; ~70 site-wide format options; the page manager. |
| **Blueprint** | Compile button | Everything as a self-describing brief, markdown or JSON; optionally handed to Claude. |

The old addresses `/studio` and `/studio/design` still open the Builder.
Internally the module keeps its original id — the folder is
`src/features/studio/` and right-click scopes are prefixed `studio-` — while
everything the user sees says Builder. Don't rename the internals for cosmetics.

```
src/features/studio/
  catalog.ts     218 parts in 12 categories, plain names, one f(...) line each;
                 CATEGORY_SIZE + DETAILS give each its real size, options, contents
  blocks.tsx     dispatcher: Block → parts/; the labelled box is the last resort
  parts/         the real components, one archetype file per family; props only,
                 no store / Radix / core imports — a generated site ships this folder
                 Layout Hero Text Media Forms Tabs Accordion Header SearchBox Cta
                 Commerce Data Social Ai Power Platform Ops Interact Motion Behaviour
  look.ts        colour (OKLCH maths, harmony, contrast) and texture (layer → CSS)
  texture.ts     cooking a picture into a tile: cut-out, pattern, rotate
  planets.tsx    twelve outline category marks, one per kind of part
  showcase.ts    where a part would sit on a page, and how wide
  LookPanel.tsx  the mixer and the texture stack
  Palette.tsx    the parts drawer under the board
  live/          the live site: layout (absolute or reflowed), LiveSite renderer,
                 behaviours.ts + LiveShell.tsx (tier B run for real),
                 PreviewPage route at /builder/preview/<page>
  format.ts      ~70 declarative site-format options (pages, scroll, type, …)
  store.ts       the document: pages, nodes, groups, shapes, format, brief, frame width
  spec.ts        compiles the board into a blueprint
  Canvas.tsx     the frame, drag with snapping, 8-way resize, draw, group, pan/zoom
  RadialMenu.tsx the part menu: the wheel, its levels, the pull; menuGeometry.ts cuts it
  DrawBoard.tsx  the drawing board the wheel's Draw slab opens; sketch.ts reads a drawing
  Preview.tsx    the pinned live preview: LiveSite scaled down, fully clickable
  Palette.tsx    the library
  Inspector.tsx  per-part contents, size & position, options, prompt
  index.ts       routes, commands, shortcuts, and every context menu
```

**The frame is the truth.** The board is not boundless space with icons on it.
A page frame sits at the origin at the width you pick (Desktop 1440, Tablet
834, Phone 390; height grows past the lowest part, never under 900, with a
dashed line where the first screen ends). Parts land inside it at their real
default size — a nav bar spans the full width, a search box is 420 × 48, tabs
are 720 × 260 — and draw their `content` and `options` exactly (type
"Episodes, Characters" into a tabs part and those are the tabs on the board).
Nothing slips to fit on the board: where a part sits and how big it is *in
the frame* is the specification. The blueprint says it as an agent can act on
it — width as a share of the frame, height as a minimum, the frame as the
desktop layout with rows stacking in reading order on narrower screens — so
"fast on mid-range mobile" and a 1200px pricing table stop contradicting each
other in the same brief.

**Position is meaning.** The compiler reads coordinates, so:

| On the board | In the blueprint |
|---|---|
| Higher up | Earlier in the page |
| Same horizontal band | One row, ordered left to right |
| Width in the frame | `full width` or `N% wide`, plus `left` / `centre` / `right` |
| Contents typed in the inspector | `contains: …` — what the container holds |
| Data typed in the inspector | `data: …` — what it shows or does |
| A wire marked "carries data" | `reads from: …`, plus a backend section |
| Inside a drawn frame | Belongs to that region |
| A chain from A to B | An explicit relationship, and the reason for it |
| In a group | Shares the group's prompt |

Dragging snaps to the frame's edges and centre and to other parts' edges, with
guide lines; corners and edges resize; `f` fits the frame in view; the
inspector has numeric X / Y / W / H and Full width / flush left / centre /
flush right.

**Parts are real.** A part is one React component rendered in two modes.
On the board it is `mode="board"`: initial state, held still (a global rule
pauses animations under `[data-mode="board"]`), wrapped `inert` with
`pointer-events: none` so dragging and selecting never fight it. In the live
preview it is `mode="live"`: tabs switch, the search box filters the contents
you typed, rows expand, links navigate. The pinned preview window is the live
site scaled down; `p` opens it full size at `/builder/preview/<page path>`,
`b` comes back. The contract is `parts/types.ts` (`PartProps`, `PartDef`):

- Parts fill the box they are given, draw `content` exactly, read `options`
  with `opt()`, and never import the store, Radix, or `@/core` — the folder is
  what a generated site ships. Hand-roll ARIA; no portals (the preview lives
  inside a scaled transform); pointer maths as rect ratios; every non-typed
  number comes from `parts/sample.ts`, seeded by the content, so board, live
  preview and generated site agree.
- Tiers: **A** visual part (a real component); **B** behaviour applied to the
  whole live site; **C** platform mock that cannot run in a browser (auth,
  checkout, an API) and shows a truthful state change instead.
- A **tier-B part draws a small scene of what it does** on the board — snapping,
  parallax, a wipe, a morph — rather than a nameless chip, because the name
  ("Morphing transition") does not tell you anything on its own. In the live
  site it is *not laid out at all*: `placeNodes` drops tier B, and `LiveShell`
  turns the ones present into real effects — progress bar, back-to-top, reveal
  on scroll, parallax on the page background, smooth scrolling, snap, the
  opening wipe, a custom cursor, tilt on hover, confetti on success. The six
  that cannot be run honestly in a preview (`sticky-story`, `scroll-video`,
  `morph-transition`, `physics`, `horizontal-scroll`, `infinite-scroll`) are
  named in the corner of the preview and written into the blueprint instead of
  faked.
- `node.link` (`{ kind: "page" | "url" | "node", target }`) is where a
  linkable part sends people; nav bars also resolve link labels to pages by
  name with no setup. The blueprint writes it as `links to:`.
- `node.data` is what a part shows or does, in the author's words — the values
  and actions a backend has to provide ("live coin price, trader P&L", or
  "join duel"). An arrow between two parts can be marked `relation: "data"`,
  meaning the target reads from the source; marking it appends `from <source>`
  to the target's data box, so the wire and the sentence never disagree.
  `showWires` hides every arrow on the board (`w`) without deleting anything.
  The compiler turns all of this into a **"What the backend must provide"**
  section, so a final prompt that builds the server is written against a list
  the board produced rather than from memory. None of it is domain-specific:
  it is free text plus wires.
- **All 218 ids are real components.** There is no legacy path: `blocks.tsx`
  falls back to a labelled box (`data-part-fallback`) only if an id loses its
  `DEFS` line, and `all.mjs` fails if that ever happens. Every part's root
  carries `data-part={id}`, tier-B roots also carry `data-behaviour`, and the
  live page wraps each laid-out part in `[data-live-node=id]`.
- The store is persisted with `skipHydration`; every Builder surface calls
  `useStudioHydration()` first so the saved board comes back before any
  effect writes. Without it a reload wipes the document.

**Extending it — all one-line changes:**

- *A new part in the library*: add one `f(...)` entry to `RAW` in
  `catalog.ts`. Use a plain name someone who doesn't build websites would say
  ("Search box", not "Site Search"). It gets its category's default size and
  becomes draggable, searchable, right-clickable and part of the blueprint
  immediately. To give it its own size, options, or a "what does it contain"
  field, add a `DETAILS` entry (`w`, `h`, `options`, `content: { label,
  placeholder }`). To make it real, write or extend an archetype in `parts/`
  and add the id to `DEFS` in `parts/index.ts` (one line: component, ids,
  tier, linkable). Every id must appear in `DEFS`; without a line it draws as
  a labelled box and `all.mjs` fails.
- *A new site-format option*: add one entry to `FORMAT_FIELDS` in `format.ts`.
  The panel renders it generically, the compiler emits it when changed, and the
  preview should honour it if it is visual. Mark it `advanced: true` unless it
  belongs in the first screen.
- *A new kind of mark on the board*: add a `ShapeKind` in `store.ts`, draw it
  in `Canvas.tsx`'s `ShapeView`, and describe it in `spec.ts`.

**A part draws what the page needs, or it is not the part.** Four things the
BLACKORB rebuild could only fake, each fixed where it lived rather than
worked around on the board: a header's wordmark and its button are read out
of its contents (`logo: $BORB`, `button: Connect wallet`) instead of being
"Logo" and "Get started" on every site ever built from this, and the footer
reads `logo:` the same way, because the foot of a page carries the same name
the top of it does; a display line
can turn colour at its last word or its last sentence (`turn`, `splitTurn`),
which is what a headline on a dark page nearly always does and could only be
had before by butting two parts together; a card grid can be `ruled` — a
hairline, a drawn mark, an uppercase title, no box — as well as boxed; and
the panel a page ends on is `invite-panel`, a real part with a label, a
turning headline and a button, where a dashed region with its name printed
in the middle used to stand in for it.

**The orbs, and what they are for.** `orb-css`, `orb-webgl` and `orb-image`
are one object drawn three ways — layered gradients, a three.js sphere, a
picture — with the same four sliders on each (size, tilt, colour, glow) and
the same rings and tag around them, so the difference between the three
techniques is visible rather than argued about. `parts/Orb.tsx` holds all
three. Two things in there are worth keeping: a crescent on a sphere is a
*conic* gradient masked to the outer band, never a radial one (a circle of
light is a blob, and a blob reads as a stain); and the WebGL orb is lit by an
environment — a canvas with two wide coloured lamps painted into it, wrapped
round the scene — because point lights on a smooth black sphere give three
white pinpricks and nothing else. three.js is imported dynamically, so a page
with no orb never loads it, and any failure (no WebGL, no chunk) falls back
to the drawn orb and says so in the tag. `corner-glow`, `eyebrow-rule` and
`details-table` came from the same rebuild: a light off the edge of the page,
a kicker with a rule, and label-and-value rows that copy.

**Rules:**

- **A part's own splitting rule beats the shared one.** `items()` splits on
  commas *and* newlines, which is right for tab labels and wrong for anything
  whose values contain commas: a paragraph ("for the builders, believers, and
  bold thinkers") came out as three paragraphs, and a supply figure
  ("1,000,000,000") as three rows. Prose splits on lines only; the details
  table splits on lines, and on commas only when there are no lines. If a
  part's content is prose or figures, split it yourself and say why.
- **A document is its look as well as its parts.** `loadDoc` used to drop
  `look` and `motion`, and `PreviewPage` never passed `look` to `LiveSite`,
  so a published site came back in the palette derived from the accent hue —
  the board, the pinned preview and `/site` disagreed about the colour of the
  same document. Anything that loads or renders a document carries the whole
  of it.
- Every plain format value reaches the blueprint, resolved; advanced ones only
  when changed; `*` marks what the author set. A default left out was read as
  "not decided" and the whole visual system got inferred from six colours.
- The blueprint explains its own conventions in "How to read this" and the
  Claude routes repeat them in their system prompt. Change one, change both:
  a critique that reports what the brief already answered is the tell.
- A drawn region with words on it and nothing inside is a *section*: it takes
  a row in "Layout, top to bottom" and is built from its prompt. A region with
  parts in it groups them; an empty, unnamed one is ignored.
- **Any closed line becomes the part's exact edge.** `shape` names the five
  shapes worth naming (box, rounded, circle, ellipse) and everything else —
  a helix, a star, a scrawl — used to become a rectangle with the drawing
  thrown away. `outlinePath` (`sketch.ts`) keeps the line itself: put in the
  part's own box, 0..1 in each axis, smoothed into cubics, thinned to at
  most 96 points, and stored on the node as `outline`. `blocks.tsx` cuts the
  part to it with `clip-path: url(#…)` against an inline `clipPath` in
  `objectBoundingBox` units, so it stretches with the part and never needs
  recomputing. An **open** line has no inside, so it is walked into a closed
  band of the stroke's own thickness first — one mechanism, because browsers
  agree about clipping an HTML element and disagree about masking one. A
  rectangle yields no clip at all: cutting a box to a box is cutting
  nothing. `tests/outline-clip.mjs` holds the star, the helix, the spiral,
  the box and the empty cases.
- **Build writes the looks from the document and asks Claude only for the
  rest.** It used to be one ask — here is the blueprint, write every file —
  and the blueprint is words, which are lossy about looks: a palette
  becomes "a warm accent", a shadow becomes "a soft shadow", and every
  re-generation drifted away from the board. Now `buildScaffold()`
  (`scaffoldRun.ts`) renders each part once into a detached root, reads the
  DOM it actually made, and `scaffold.ts` turns that into a codebase:
  `app/globals.css` with the palette's own values as tokens,
  `components/parts/<Name>.tsx` per part carrying that markup as JSX —
  styles, shape, clip, texture and the lamp's shadow included — a page per
  page placing them where the board places them, `components/Frame.tsx`,
  and `BUILD.md` saying what was written and what was not. Pure and
  deterministic: the same document gives the same bytes
  (`tests/scaffold.mjs`). Only then is Claude asked, and it is told the
  scaffold exists, listed, with the gaps named: an Idea part with no body,
  where the data comes from, what happens after an interaction. Files it
  returns are merged over the scaffold by path, so naming one is how it
  replaces one. Never go back to generating the looks.
- **Finish opens the timeline, and it is a workspace, not a list.**
  The green flag on the toolbar (`FinishFlag`) puts the Builder in `book`
  mode, where `Timeline.tsx` fills the window exactly as the board does:
  the same dark matter under it (dimmer — the boxes have to be the
  brightest thing), no panels down either side, drag the ground to pan out
  as far as you like. Each landed call is an **iteration box** — emerald,
  low contrast, an icon, whether it was a chain prompt or an element
  prompt, and one line saying what that iteration actually did. Nothing is
  aligned or grouped: boxes are scattered off their own id and dragged
  anywhere (`threadSpots`, keyed `box:<id>`), and a drag is not a click.
  Right-press one for what can be done with it. Between them run
  **strands** (`strand.ts`): one tight line, a little thicker than a
  hairline, with bands of light running *inside* it — not a bead
  travelling a wire — anchored to where the boxes are rather than to a
  measurement of them, so they stretch in the same frame as the drag. On
  each strand sits the **loop starter**: examine, critique, iterate.
  Under the timeline, and reached by carrying on scrolling exactly as the
  parts shelf is under the board, `TimelineDetail.tsx` reads **one**
  iteration: the stages across the top (asked → came back → changed →
  critique → what came next), the prompt small above the preview, and a
  menu down the side for turning that generation into something. The
  iteration book lives there too, in its own tab with its own menu, and
  the page layout of the book no longer draws the trail — the timeline
  above it is the trail.
- **The Blueprint and the Trail are one page: the iteration book.**
  `BriefDialog.tsx` is one `Book` component in three shapes — a dialog over
  the board, a panel pinned open beside it (`store.bookPinned`, no overlay,
  the board still workable), and the Builder's third screen next to Design
  and Preview (`mode: "book"`, `IterationBook`). The page shows the idea, the
  ask, the pinned threads, the trail, the brief and the JSON at once, because
  the last thread is read while the next ask is written; the dialog and the
  panel keep the Brief/JSON/Trail tabs, which is all the room they have.
  Everything in it is written on the same card as the tour writes on — a soft
  edge, a small heading, the words under it — so the Builder speaks in one
  voice. A thread can be pinned (`pinnedThreads`) and it and its answer stay
  at the top of the book; what an answer led to afterwards — files pushed, a
  build on Vercel — is written onto that thread's card by `noteThread`, so a
  Finish card says what was actually made of it.
- **A landed API call is a thread, not an update.** Every ask that comes back
  — a plan, a critique, the code, a drawing read — lands a `Thread`
  (`threads.ts`, `store.landThread`): what was asked, what came back, what it
  put on the board, and the board as it stood. Threads hang off whichever was
  live, so the Trail view is the tree of how the site was reasoned about
  (`ThreadTree.tsx`), all of them visible at once, each collapsed to one line
  — asked → did — and opening one shows the prompt, the answer and what
  changed. **Prune cuts one node only:** its children re-hang from its parent,
  because they happened, and the board goes to whatever is live after the cut
  (`liveAfterPrune`). Standing on a thread applies its document, and only its
  document's own fields — a thread's `doc` has been through localStorage and
  can carry keys a snapshot does not, and spreading those blindly set things
  nobody meant to set. The vines between the cards are painted on a canvas
  and move: a history drawn as a static diagram is the thing this replaced.
  `tests/threads.mjs` holds the tree, the cut, the diff, the pieces and what
  a second call resends to their rules.
- **The trail is a staircase, and the pieces float round it.** The timeline
  runs from the upper left down to the right, one step per thread in the
  order they landed, and each thread hangs off its step; the step after the
  last one is the call that has not fired. Every element on the board that
  carries a prompt is a **piece** (`piecesFrom`), floating beside the thread
  that last touched it, or on the shelf under the trail when no thread has.
  A thread or a piece can be dragged and **only that one moves** — where it
  was put is kept against its id in `threadSpots`, nothing re-lays out, and
  one button puts the trail back on its staircase. The trail scales to fit
  its box by default, because it outgrows any dialog after a few threads,
  and 1:1 is one press away; the drag maths divides by that scale.
- **Purple is pending, green has landed, and the colours never swap.** A
  piece clicked into the next call is vined to it in purple, before anything
  is sent, so the drawing says what is about to go up. Everything landed —
  the spine, the threads, the pieces they worked on — is green.
- **A call sends the brief once and the pieces that moved.** With pieces
  vined, `askClaude` sends `briefPrefix(markdown)` — everything above the
  pages, plus "How to read this" — as the first block, marked
  `cache_control: ephemeral`, and after it only the vined pieces whose
  fingerprint has changed since this thread last sent them
  (`piecesToSend`, `sentPieces`). The second call of a thread reads the
  brief from the cache instead of sending it, and the answer reports
  `usage.cached`. With nothing vined the whole blueprint goes, exactly as
  before. A piece's fingerprint is its prompt and its size: change either
  and it is resent, change neither and it is not.
- Critique, Fill prompts and Finish come back with a `json revisions` block:
  one item per finding, each naming its target and carrying the target's whole
  prompt as it should now read. `recordAsk` in the store puts each beside the
  prompt it was about; `applyRevision` takes one. The Blueprint dialog's Trail
  view draws the lot as a map — written → found → now — and is where a
  critique is read. Any new ask that produces prompts must use the same block.
- The library is prunable. `hiddenFeatures` in the store holds ids removed from
  the library — the ✕ on a tile, "Remove from the library" or "Remove every
  <category> part" in its menu. Nothing is deleted: a counter in the panel
  footer reveals them, clicking one restores it, and one command puts them all
  back. An emptied category loses its chip. A part already on a board keeps
  working when its tile is removed. Prefer pruning to shipping a crowded panel.
- Right-clicking a **part** opens the wheel (`RadialMenu.tsx`), not a list —
  see the geometry note below. Everything else keeps a short list menu; a wheel
  of three items is worse than a list. If you add controls to a part, put them
  in the right quadrant rather than lengthening anything.
- **A picked part is marked in its own complement, not in the app's accent**
  (`markColour`, `complementOf` in `look.ts`). Two solid pixels of accent-blue
  made the part being edited the one part you could not see, and sat on top of
  the aura — which is the thing most often being edited when the mark is up.
  The mark is the far side of the part's aura, or its fill, or the site's
  accent, at a lightness that reads on a dark page and a light one; one line,
  thin, offset inwards so the aura's own hairline stays outside it. The page
  takes the complement of its own colour, ink the complement of its own hue.
- **One void, one screen, in core** (`src/core/ui/void.ts`). The console
  defined them, the command palette kept a copy because core may not import a
  feature, and the copies had drifted — two voids three hundredths of a
  lightness apart. Everything imports them now; the console's numbers are the
  ones kept. A surface that belongs to the Builder's console wears the void
  (the wheel, the palette, the vault, the Blueprint); a page, a panel or a
  card uses the shell's tokens.
- **The wheel is the whole editor, and the right panel is the convenience.**
  Anything the Inspector can do to one part, the wheel can do too: the per-part
  options that used to be panel-only live under `Edit ▸ Options`, and the board
  tint and glyph under `Edit ▸ Tint` and `Edit ▸ Glyph`. Add a per-part control
  to both, or to the wheel alone — never to the panel alone. What is still
  panel-only is what is not a part: a page's prompt, a drawn shape, a group's
  name and prompt, and the bulk edits that apply to a whole selection.
- **Every role a part can repaint has to paint something.** `bg` used to set
  only the ground behind a part, which most parts cover with a card of their
  own, and `highlight` was read by eight of seventy parts — so two of the six
  swatches did nothing you could see and the whole control read as broken.
  Setting `bg` alone now carries `surface` and `line` with it, the same step
  apart the palette keeps them (say what the surface should be and that stands
  aside), and `highlight` is what the secondary `Btn` and every `Placeholder`
  are drawn in. If you add a role, give it somewhere to land first.
- `look` in the store holds six colour roles and a texture stack, and every
  `themeFrom(format, look)` call reads it — the board frame, the live site, the
  companion and the library previews all repaint together. Roles override what
  the accent hue would derive; a texture layer compiles to a CSS background, so
  nothing is loaded and a generated site ships it as a stylesheet. Both reach
  the blueprint under "Colour and texture", written out exactly.
- **Any one element can repaint itself.** `node.colour` is a partial map of the
  six roles; a value is either a colour or the *name* of another role, so
  "make this one's background the accent" stays inside the palette and follows
  it when the palette changes. `Block` applies it with `overrideTheme`, `Fill`
  paints `t.ownBackground` only when a part was told to, and the blueprint
  writes a `colour, this part only:` line. `ColourOverride.tsx` is the one
  control, used by both the wheel's Look wedge and the Inspector. `node.hue` is
  a separate, board-only tint on the label chip and is labelled as such.
- A texture aimed at `surfaces` (or `both`) is painted by `cardStyle(t)`, so
  every card and panel in every part wears it without any part knowing.
- **The page is behind the site, not through it.** A part is transparent by
  default, so a texture on the page used to read straight through every
  section, bar and card — which made `page`, `surfaces` and `both` all look
  like the same wash. When a layer lands behind the page, `themeFrom` sets
  `t.partGround` to the background colour and `Fill` paints it, so the picture
  shows in the margins and the gaps and nowhere else. A part that paints its
  own box (`cardStyle`, or an explicit `background` in its `style`) still
  wins, and a part that repaints its own background role drops the floor.
- `target: "over"` is the fourth option and the old behaviour, made
  deliberate: the stack is compiled over `transparent` into `t.overlayStyle`
  and painted above the finished page — `[data-frame-wash]` on the board,
  `[data-live-wash]` on the live site. Keep it faint; it covers the words too.
- Pictures come in three ways — choose, drag, paste — through
  `ImageIntake.tsx`. Everything is shrunk to 640px on the long edge and
  re-encoded before it is stored, because the document lives in localStorage
  and one phone photo would fill it. `usePasteImage` ignores a paste aimed at
  an input or textarea, so typing is never interrupted.
- **A picture is cooked before it is a texture** (`texture.ts`). Dropped in
  raw it tiles as a grid of photographs, covers the background colour, and
  gives the colour role, the opacity and the contrast nothing to bite on.
  So a canvas pass keys out the colour the edges sit on (free, in-browser)
  and reduces the picture to a *pattern* — a mask of where it is light and
  dark, painted in a palette role — which is what makes it tintable and lets
  the background show through. The result is baked onto `layer.baked`, so
  everything downstream stays a synchronous CSS lookup; `LookPanel`'s `Baker`
  re-cooks on a debounce whenever an input changes.
- **Nothing a layer emits may be an opaque wash of the base colour.** This is
  the rule the whole stack rests on, and it was broken twice. A picture's
  opacity used to be a flat veil of the background colour laid back over the
  tile, and its weave a radial veil of the same — both fine on a single layer
  over a flat page, both fatal to a stack, because a veil covers the layers
  underneath exactly as well as it fades the picture. `Treatment.alpha` and
  `Treatment.weave` cut into the tile's *own* alpha in `texture.ts` now
  (`fade`, `weaveEdges`), `veilFor` is gone, and what shows through a
  half-solid layer is the layer below it. The sliders are "How solid" and
  "Weave"; `layer.weave` still runs from a tiled grid to one picture covering
  the surface, thinning toward its edges so tiles bleed into each other.
- **A grain is painted in its colour, like everything else.** `noise`, `grain`
  and `paper` used to desaturate their turbulence and lay the grey straight
  down, so three of the fourteen kinds silently ignored the colour role and,
  turned up, became an opaque grey lid. The filter now takes the noise's
  luminance as *alpha* and a `feColorMatrix` constant column as the colour, so
  a grain is a scatter of holes in a palette colour. Its opacity is
  `opacity ** 0.7` on the tile — steep where a grain lives, and still reaching
  1, where a straight multiplier saturated halfway up the slider and the top
  half did nothing.
- **A layer can hold a colour of its own** (`TextureLayer.colour`) instead of
  naming a palette role, picked off the same `Spectrum` the menu uses. Six
  roles is the right answer for a texture meant to follow the site and the
  wrong answer for the thing people reach for first — a flat ground in a
  colour they already have in mind — which could not be said at all.
- **Size and Bleed are not the same control.** Weave used to grow the tile as
  well as soften it, so it and Size were two sliders fighting over one number
  and neither did what it said. Size sets the tile; Bleed thins its edges into
  the tile's own alpha so tiles run into each other, and only at the very top
  does it become one covering picture.
- `affects(kind)` says which controls a texture kind can actually use, and the
  panel only draws those. A slider that moves and changes nothing is worse
  than one that is not there.
- **Where a texture lands is per layer**, not per stack (`layer.target`, read
  through `lands()`): one texture on the page and a different one on the cards
  is the normal case, and a single switch for the whole stack cannot say it.
  `layer.hue` turns that layer's colour without touching the palette — the tint
  for a pattern, a `hue-rotate` on the pixels for a picture that keeps its own
  colours.
- **The background role is the background.** `themeFrom` used to build the
  board's backdrop from the accent hue and ignore `roles.bg` entirely, so the
  background picker did nothing until a texture happened to force the other
  path. The flourishes (gradient, grid) are painted *over* `roles.bg` now.
- Background lists are split by `splitLayers`, which counts brackets. A regex
  cannot: `linear-gradient(oklch(…), oklch(…))` has a comma at depth two, and
  splitting there shifts every size and repeat one place along — which is why
  tiled textures silently came out as `cover` and most blend modes looked
  identical.
- Colours reach `texture.ts` as `oklch()`. Do not ask the browser to resolve
  them — Chromium hands `oklch(...)` straight back from `getComputedStyle`, so
  a regex looking for `rgb(` finds nothing and every pattern comes out white.
  Convert with `parseColor` + `oklchToRgb` (which returns 0..1, not bytes).
- **The middle column is one scroller**: the board at full size, the shelf
  under it (`[data-studio-scroll]` in `StudioPage.tsx`). The board pane is the
  window's height less a strip, so a piece of the shelf always shows and the
  page is always whole. Nothing scales the board — scrolling carries you past
  it and back. The canvas's wheel handler pans until the page runs out and
  then stops calling `preventDefault`, which hands the gesture to the column;
  that is why `overscroll-contain` is gone from the canvas root. Note that
  anything calling `scrollIntoView` inside the board now scrolls the column
  (Playwright does this before a click) — put it back at the top first.
- **The shelf is laid out like a page, in page order.** `groupIntoBands` puts
  the parts in the bands they would occupy going down a page, and `spanOf`
  decides how much of the shelf's width each takes: full-width parts get the
  row to themselves, the rest sit two, three or four across with a 10px gap.
  A preview you cannot read is not a preview, so the heights are generous.
- **Every sub-group has a moon** (`moons.tsx`), drawn through the same `Svg`
  shell as the planets: 24 grid, one stroke, no fill, `currentColor`. One
  entry per id in `SUBGROUPS`; ids that repeat across categories share a mark.
- **The fire belongs to the part, not the shelf.** There is no flame behind
  the whole scroller any more — one big field lit a row of previews like a
  bar. Each preview has a rim that just clears its edges (`.ember-rim`) and
  tongues climbing out of its bottom, red at rest, blue within 180ms of being
  reached for, back to red over 0.7s.
- A **range option** (`FeatureOption.kind === "range"`, built with `range(id,
  label, default, min, max)`) is a number on a slider rather than a pick from
  a list, read with `num(options, id, def, min, max)` in `parts/types.ts`.
  `values` keeps one entry — the default — so everything that reads
  `values[0]` is unaffected, and the value is stored as a string like every
  other option. The Inspector draws it with the core `Slider`, the wheel's
  Options plate with a range input, and the drawing board's reader may set it
  to any number inside the ends (`reshape.ts` clamps). Reach for it when the
  thing being set is a quantity — how big, how far over, what colour, how
  much glow — where a list of five values is a list of five compromises.
- A **set option** (`FeatureOption.kind === "set"`) is any number of presets at
  once, stored as one comma-separated string and drawn by the Inspector as
  chips you switch on and off. `set(options, id, default)` in `parts/types.ts`
  reads it; an empty string means "all off" and only a missing key falls back
  to the part's own default. The footer's social row is the first of these:
  one footer part, three shapes, and everything it holds on show — because a
  part with variations you cannot see is a part you have to guess at.
- **The panel shows the stack, not just the layers.** `StackPreview` runs the
  real compositor over the real layers, grouped by where they land, and every
  swatch sits on a checkerboard — a column of chips over an opaque ground
  tells you what each layer is and nothing about what they do together, which
  is the only question worth asking once there is more than one of them, and
  it makes a see-through layer and a lid look identical.
- **The texture stack is a stack.** A new layer goes on top (index 0 is the
  front, as `textureCss` reads it). Every layer shows the same seven controls
  in the same order — where it lands, how solid, scale, angle, contrast, hue,
  blend — whatever kind it is: a panel that changed shape with the kind meant
  you could never learn where anything was. So the kinds that could not be
  turned were given a way to be (checks, dots and halftone are SVG tiles with
  a rotate; blobs and mesh swing their fields round; turbulence rotates its
  tile), and `affects()` now answers true for everything.
- **`kind: "flat"`** is a flat static colour with opacity — the ground the
  stack was missing. At contrast 0 it is exactly flat; turning contrast up
  fades it along the angle, so even there both controls do something real.
- **Merging** bakes a layer and the one under it into one picture
  (`flattenLayers` in `texture.ts`): the pair is painted into an SVG
  `foreignObject` exactly as the browser paints it — same gradients, same
  blend modes, same order — drawn to a canvas and returned as a tile, which
  `mergeTexture` swaps in for both. A browser that will not render
  foreignObject returns null and the layers are left alone.
- **The part menu is four quadrants round the pointer** (`RadialMenu.tsx`), and
  the layout never moves:

      empty  │  Animation · Prompt (inner) · Draw (outer)
    ─────────●─────────
     Delete  │  Duplicate · Edit (inner) · Looks (outer)

  It used to swing so the empty quadrant faced the middle of the screen, which
  meant the menu was a different shape depending on where you clicked and your
  hand could never learn it. Delete is bottom-left. Looks is bottom-right.
  Draw is top-right. Always. The one thing that moves it is `menuSpin`. The
  two working quadrants are cut the same way — two icons on the inner band,
  one word on the outer block — so a hand that has learned one has learned
  the other.
- **One line, two ends: red moves, green turns** (`PullStage`: `pull`,
  `moving`, `turning`). The menu opens on the right **press**, so the hold that
  opened it is the hold that pulls — a click to open and a second press to pull
  was the bug. Dragging used to start turning the moment you cleared the hole,
  so a right-click that wandered a few pixels spun the menu. So: the **first
  real movement fixes a line** through the pointer, and from there the handle
  is *on* that line whatever your hand does — sliding either way along it,
  never steering, because a free hand wobbles and a wobble on a dial is a
  mis-set dial. Both ends are marked at once: a **red ring** at the end you
  pulled toward, a **green ring** at the other. The line fades up as it
  lengthens (`PULL_FROM` → `PULL_LOCK`). Reach the **red** ring and the line
  goes and the **whole menu comes loose** and follows your hand in any
  direction, holding the offset it had when it came loose so it does not jump.
  Reach the **green** ring instead and the line goes, the green ring stays lit
  where it is, and the **wheel turns** under your hand, chased a fifth of the
  way per frame rather than pinned, with no snapping. Either way, letting go
  ends it and the line is gone. The line is drawn *under* the pieces
  (`PullLine`) and the two rings *over* them (`PullEnds`), so the thing you are
  reaching for is never hidden behind a slab. The pull is measured from the
  same point the menu is drawn at: `openRadial`/`moveRadial` keep the menu on
  screen, so a menu opened near an edge does not pull its line from a point
  that is not its middle. The right button being down is kept by hand (`held`)
  as well as read off `buttons`, and the "swallow the next context menu" flag
  is also cleared by the next press: on a Mac the browser fires `contextmenu`
  on the press, and there is none on the release to swallow.
- **While the menu is open the right button belongs to it.** The `contextmenu`
  is swallowed in the capture phase — the app's own menu listens further down
  and `preventDefault` alone does not stop it — and then there are exactly
  three outcomes: on the menu itself, nothing (that press is a pull); on any
  part, including a different corner of the same one, the menu **moves there**
  and starts again at its first level (`seq` on `Open` counts openings, not
  moves, so carrying it across the screen does not reset it); on anything that
  is not a part, it closes.
- **The menu can be pushed aside and left there.** Press its middle and drag
  (`moveRadial`) and it moves; clicking the part it belongs to no longer closes
  it, so it can be parked where there is room and worked against. Anything else
  clicked still puts it away. The lock and the handle are the same button — a
  drag moves, a press without one toggles the lock.
- Each working quadrant is cut once more at `MID` into an inner band and an
  outer block, which is how three quadrants carry six buttons. Delete is the
  whole quadrant beside the empty one, undivided. The pointer keeps a clear
  circle with the **lock** in it. Level 2 is **green** and takes the quadrant
  that was empty; a group of more than four takes the quadrant below it as
  well, since the blue level is gone by then and there is nothing down there to
  cover. Level 3 is **crimson** and takes the quadrants the green is *not*
  using, with the green left up. Escape steps back one level.
  The inner band is too narrow for a word without it hanging over the
  neighbours, so its three pieces are **icon only** (`compact`), the word on
  the tooltip. The green Looks pieces show what they would change rather than
  a symbol for it: Hue is a strip of the part's own roles as painted right now
  (`HueSwatch`), Texture is the tile it is wearing (`TextureSwatch`), and Aura
  glows in the aura the part has (`glow`).
- **Every word is part of its piece.** Each label is a `foreignObject` inside
  the same rotated `<g>` as its path, turned back upright by `-spin`. It used
  to be positioned HTML with a transition on `left`/`top`, which is why every
  word trailed its button round a turn: it was chasing a number the slab had
  already reached. Now the only thing that eases is the hover nudge, and a word
  cannot be anywhere but on its piece. The same `Glued` does it for the console.
- **The geometry is drawn inset and grown back.** `piece()` pulls every path in
  by `ROUND` and half a `SEAM` and the renderer strokes it back out with a
  round-joined stroke of its own colour, which is what curves every corner —
  including where a wedge narrows to a point at the pointer, which is where a
  wedge otherwise looks sharpest and worst. Hovering just strokes *wider*,
  taking a couple of pixels back out of the seam, which is why the seams are
  cut wider than they need to look. The angular part of the seam is worked out
  per radius, so it is the same number of pixels wide against the pointer as at
  the outer edge; a fixed angle is a hairline inside and a canyon outside, and
  that is what made the ring read as one shape with lines drawn on it. Square
  outer edges land on the square's real corners, so a piece that turns a corner
  turns it at a right angle instead of cutting it off with a chord. `piece()`
  brings its turns back under one before the corner walk: the console's
  quadrants start where the green stops, at a full turn, and without that they
  matched no corner and came out as triangles with the labels hanging outside.
- **Flat colour, no gradient.** A vertical gradient under a heavy drop shadow
  read as a lump of dark glass. One flat colour reads as one button: the old
  *hover* colour is the resting colour and hover goes a step brighter again,
  with an edge always darker than the face.
- **The third level is three more quadrants** (`menuGeometry.ts` for the
  shapes, `RingConsole.tsx` for what sits on a slab, `RingEditors.tsx` for the
  editors). It was a box three times — a tooltip beside the wheel, a slab over
  it, a slab exactly the size of it — then a ring outside the wheel, and each
  was wrong for the same reason: the first two levels are geometry you throw a
  pointer at, and anything else is a different program wearing the same
  colours. Now it is the three quadrants the green is not using (two, when the
  group is wide), each cut with the same `piece()` as everything else, on the
  green level's own rings, in crimson — three more Delete-shaped slabs, and
  the menu is one object. `QuadrantConsole` draws them and hands the editor
  its `Slab`s; a bare slab is the handle the whole menu is shoved aside by.
  What goes on a slab: `ArcChips` along the band (wrapping to a second row one
  chip further in when there are more than fit), `ArcSlider`s bent round it —
  hue, lightness, strength — `SectorButton` for a slab that *is* a button
  (Add a picture, No aura; opaque even when disabled, or the slab's rim shows
  through as a second outline), and `Caption`, the one word on a slab that is
  not upright: it is **engraved along the slab's inner arc** as a `textPath`,
  walked the other way and hung under the arc on the lower half of the screen
  so it reads the right way up at any turn. Straight captions collided with
  the chips as soon as the wheel was turned so a slab pointed sideways.
  Everything is in the wheel's local coordinates inside the same rotated group
  as the slab, so the console turns with the wheel and nothing trails.
  **`arcPath` splits every sector at its halfway point and passes 0 for the
  large-arc flag.** Passing 1 because the whole span is over half a turn sends
  each half the long way round and the shape comes out inside out.
  A few choices are text, and there is no honest way to bend a text field round
  a curve: those get `PlateQuad`, a flat plate *inscribed in* the first slab,
  wearing the slab's colour. It is the one rectangle, and it is inside a
  quadrant.
  **A hue pick lifts chroma to at least `LIVE`**: picking the orange end while
  the current colour was a near-grey used to hand back another near-grey — the
  right hue at a chroma of 0.01 — and the control read as broken.
- `ArcChips` spreads to about twice a chip's own width and no further, centred
  in the sweep. Filling the whole arc whatever the count put two chips a
  quarter turn apart with nothing between them, which reads as two unrelated
  buttons rather than a choice of two. A chip wears the thing it sets — a
  colour, a tile, a glow — and edges are lit by `litEdge(hue)`: a lighter line
  along the top inside edge, a darker one along the bottom, leaning
  differently for warm, green and cool faces. A shade either way, never a
  bevel. `CONSOLES` names which choices get slabs of their own: the three that
  are about looks. The rest go on the plate.
  **The slabs are the void** (`CONSOLE` in `RingConsole.tsx`): the same dark
  purple-blue as the drawing board's surface, with a thin *lighter* rim —
  on something that dark the edge has to be the lit line — and no aura at
  all; a slab drops straight off into the board (`SLAB_AURA` is only a
  plain dark drop shadow now). Red is kept for the one thing on a slab that
  is *on* (`PICKED`) and for nothing else. Grey went: a grey slab with red
  controls read as mud next to the blue and green above it, and a red slab
  with red controls had nothing left to say "this one is picked". The slabs
  are cut `SHRINK` pixels smaller than the green level on every edge
  (`piece()`'s last argument), so the menu never reads larger than it is.
  The rules behind all of this are in `docs/DESIGN.md`; read it first.
- **The way back is the middle.** Past the first level the lock's spot holds
  one button (`data-menu-home`) that returns to the start; the green X on the
  rim and the red X on the console are gone. It is also still the handle the
  menu is carried by. Escape steps back one level at a time.
- **An aura is a colour, a size and a style** (`AuraStyle` in `look.ts`:
  `glow`, `ring`, `pulse`; `auraStyle()` returns everything the element
  wears, including the `aura-pulse` animation driven off two custom
  properties). The colour is a palette role or a colour of its own
  (`auraColour()` resolves either); the board, the live site and the blueprint
  all read it the same way. The Aura editor is three slabs: **boxes**
  (`GridChips` — packed into the square of the quadrant, not strung on an
  arc, dealt nearest the pointer first: an X for none, then `recentColours`,
  then the six roles; the box *is* the colour, and the picked one wears the
  small red aura), the **spectrum** (the same `SpectrumSlab` the Hue editor
  draws), and the **sample** — one block wearing exactly what the part wears,
  three style chips each wearing its own style, four sizes. Nothing else on
  the menu changes colour: the green Aura piece and the sample block are the
  two things that show the aura, so they are the two things that swap.
  `recentColours` is filled by any spectrum's `onCommit` — the moment the
  hand lets go, not on every drag step.
- **Words and lists go on a screen** (`PlateEditors.tsx`). Name, contents,
  the part's prompt, its data, links and options are `PlateEditor`s: a
  `PlateQuad` inscribed in the slab **opposite the green**, which the
  console cuts **square** for it whatever `menuShape` is (`ConsoleSpan.shapes`),
  so the plate always has a square to sit in. The plate is a console screen
  set into the slab (`SCREEN`, in `RingConsole.tsx`): dark teal glass,
  scanlines, a faint dot matrix, a lit bezel, phosphor lettering in a
  monospaced face — because words are typed on a screen, not on a slab.
  **The whole slab is laid out round the hole**: the screen takes the far
  corner, from the hole's tangents out to the slab's edges; the strip along
  the top beside the hole carries the title and the part's name, above the
  screen rather than on it; the strip down the near side under the hole is
  the **rail** — an information key (`RailButton`) that shows what the part
  is on the screen, and whatever else an editor adds (Options has a reset).
  Which corner the hole is in follows where the slab points once the wheel's
  turn is added, so the layout mirrors; between the four upright positions
  the box shrinks by the sum of the turn's cosine and sine so an upright box
  stays inside a tilted slab. What is on it is not a form:
  a setting with a handful of values is a row of `Tick` boxes (the screen's
  keys), one lit; a set is the same boxes switched on and off; only a name,
  a prompt, an address and the data are typed. Options shows **layout**
  options only; the ones in `MOTION_OPTION_IDS` are Behaviour, under
  Animation. Contents carries **Make it a prompt** on the slab beside it — a
  placeholder, cut and wired, doing nothing yet. Glyph left the wheel: a
  mark on the board is not a thing the site has.
- **Animation is three screens, not a list** (`AnimQuads`). Its green level
  is options — Entrance, Speed, Extras, and **Behaviour** when the part has
  motion options of its own — the first three opening the same three slabs,
  each painted as a screen (`ScreenFace`), with its own lit
  (`ConsoleSpan.lit`, `ANIM_SLAB`): **speed top-right, as one slider**
  (`animSpeed` is a number now — a multiplier on `ENTRANCE_MS`, log-scaled
  along the slider so the middle feels like the middle; `speedWord` names
  the nearest stop for the caption and the blueprint), the entrance
  bottom-right (the kinds as icon keys, a four-way pad for where a slide
  comes from; Slide with no direction means from below), and bottom-left the
  **delay as a slider** (`animDelay`, milliseconds) with the easing as three
  icon keys. A saved board with the old words is read by `speedK`/`delayMs`.
  Behaviour (`BehaviourQuads`) puts one motion option per screen as a
  readout with arrows (`ArcStepper`), captioned with the option's name: a
  top bar's on-scroll, a ticker's speed, a slideshow's autoplay. **No
  word-boxes anywhere on a slab**: a choice with a picture is an icon key,
  a choice that is only words is a stepper, and anything continuous — the
  aura's size included — is a slider.
- **Sliders are smooth** (`ArcSlider`). The mark follows the hand from local
  state, one read per animation frame, with the pointer captured by the
  slider so a hand that strays off the band keeps hold of it, and the read
  wraps the short way round so a hand past the start does not jump to the
  end. `live={false}` writes the part only where the hand lets go — for the
  entrance, which replays on every change and does not want sixty replays
  a second. The mark is drawn once and turned to the value, so it eases
  between values it did not see the hand set. `entranceCss()` in `look.ts` turns `anim` + `animSpeed` +
  `animDelay` + `animEase` into the one `animation` shorthand the live site,
  the blueprint's words and the demo all use. **The slab the motion comes
  across plays it**: `Ghost` is a path in the slab's own shape and grey that
  runs the entrance and then `ghost-out`s, on the bottom-left slab for
  anything from below or the left (and anything that does not move), the
  top-right for what drops or comes from the right; the small ▶ by that
  slab's hole replays it.
- **The first level is seven pieces.** The top quadrant is cut like the
  bottom one: two icons on the inner band — Animation and the **pencil**
  (`write`: Words, Contents, Links, Data, and a Priority placeholder that
  does nothing yet — everything you write *about* a part) — and one word on
  the outer block, **Draw**. Edit is how the part is *built*: Name, Options
  (layout only) and **Font** (`FontQuads`: size and weight as arcs on one
  slab, spacing and leading on the next, the families as boxes set in their
  own faces on the third; `NodeFont` on the node, `applyFont` in
  `parts/theme.ts`, every value relative to the site's so a part stays a
  shade larger when the site's type changes). A green choice that fires on
  the spot (one with `act`) never becomes `subPick`, or Escape would have to
  clear it before it could leave the level. Size and Tint are gone: every
  edge of a selected part is a resize bar (`HANDLES` with `bar`), and
  `FillTab` under the part opens on hover into Fill width, Flush left,
  Centre, Flush right. The board-tint field left the Inspector; `hueMenu`
  stays for drawings and groups, which are only ever on the board.
- **Font is three screens** (`FontQuads`): size and weight as two arcs on
  the first, spacing and leading on the second, the family as a readout with
  arrows on the third, set in its own face, with "the site's" as the first
  stop. The captions read the numbers out.
- **The page's background is a thing you can pick** (`BACKGROUND_ID` in
  `store.ts`). A press on the bare frame puts it in `selection` (a drag from
  there is still a marquee); the frame wears the accent outline and a label,
  and the Inspector shows `BackgroundInspector` — the fill (the format's
  `palette.background`) and the texture layers that land on the page,
  switched there. **⌘X cuts it** (`cutBackground`: every page layer off, the
  fill flat, what went held), **⌘V puts it back** (`pasteBackground`), ⌫
  strips it the same way. Cut and paste on parts work too (`cutNodes` /
  `pasteNodes`); `cut()` and `paste()` pick by what is selected and what was
  cut last. What is held is a module variable, never persisted. The canvas
  menu has a Background submenu for the same three things.
- **The background has the wheel too** (`SLOTS_BG`, `bgChoicesFor` in
  `RadialMenu.tsx`; `BackgroundEditors.tsx`). A right press on the bare
  frame opens the same seven pieces about the page, in the same places, so
  a hand that has learned one has learned the other: Motion (a motion asset
  behind the page — placeholder), the pencil (the page's Words on the
  plate), More (Preview here, Put the background back), **Picture** on the
  outer block (a file, taken as an image texture layer on the page), **Cut**
  and Edit (**Width**: the frame's width as three keys, with Fit in view and
  the wires beside it so no slab is bare; Per page — placeholder), Looks
  (**Color**: one editor, three slabs — the bg role off the spectrum; the
  fill as icon keys writing `format["palette.background"]` with the recent
  colours and "from the accent" on the band inside them; the **veil**, a
  slider for `look.veil`, a black overlay at that opacity painted by the
  board, the live site and the blueprint; **Texture**: the stack's layers as
  tiles, several on at once — `GridChips` with `values` — plus Add a picture
  and Clear the page), and **Strip** where Delete is. The middle is **Add**
  (`data-menu-add`, still the handle `data-menu-handle`); the page has
  nothing to lock. Everything a part's wheel does that makes no sense for a
  page is a placeholder that taps, not a missing piece; and no editor
  leaves a slab empty.
- **One ground, at two distances** (`darkMatter.ts`). `paintDarkMatter` —
  two tiles of fractal value noise made once (`darkMatterTiles`: violet
  soft, magenta sharper), laid each frame as repeating patterns in two
  depths (huge and barely moving at the back, smaller and passing in
  front) screened together, then the embers (`paintEmbers`: the `CAST`,
  five `Kind`s — riders in knots on `gustOf(group)`, drifters on their own
  heading, fallers, risers, darters that kick and decay — each streaked by
  its own speed and relit as its kind where it dies). No stars. Two
  surfaces stand on it: the add disc, clipped and closed off by its
  horizon, and the **workspace behind the page** (`Workspace.tsx`), a wall
  with none. The wall is the same sky further back (`dim`), because the
  disc's own brightness across a whole screen is a lightbox and every panel
  round the board picks up a halo. Sparks are per surface (`SparkField`,
  never module state — a disc open over the workspace would otherwise share
  one cast and tear it in half) and `castSize` grows with the **square
  root** of the area: the disc's density on a wall is a swarm. The ground
  never touches the page itself — what a site's background is stays the
  site's business, and nothing here reaches the preview, the published page
  or a screenshot of either.
- **The add disc** (`AddDisc.tsx`, `data-add-disc`): pressed from the
  page's middle, the wheel becomes a disc the size of the drawing board,
  painted with the ground above. The hole (`data-add-scroll`, `overflow: clip`
  so nothing inside can scroll it, clipped to `WELL_R`) holds one category's
  parts as `PartPreview`s at `COLUMN_W` with a `GAP` between them and each
  sub-group's name as a phosphor heading (`data-add-head`). The column is
  never scrolled by the browser: it is a **drum** on a spring (`drum` ref:
  `pos`, `vel`, `target`; `SPRING_K`, `SPRING_ZETA`) and `apply()` writes
  its transform and every row's roll — scaled to the hole's chord where it
  is and to a drum curve of its distance from the middle, dimmed with it —
  once per frame. The wheel listener is non-passive: `NOTCH` pixels is one
  notch; a lone notch adds `NUDGE` to the velocity so the drum leans and
  springs back; the second within `NOTCH_MS` commits `sel` to the next part
  (`choose`), and a flick commits once per pair. A new column jumps its
  first part to the middle. The chosen part (`data-add-chosen`,
  `aria-selected`) wears a blue rim; a press on it calls `addNode` centred
  on `open.at` — the canvas point `pageSpot(frame, x, y)` gives, passed to
  `openRadial` by the frame's own press handler in `Canvas.tsx` and by the
  menu's context-menu handler when the wheel moves to a new spot on the
  frame (the context-menu event that trails the opening press is left
  alone, or it would reopen the wheel without the spot) — and the store
  keeps it inside the page (`placeInFrame`), or `addFeatureToCanvas` when
  there is no point; then the menu closes; a press on another rolls to it. Arrows move the
  drum, Enter adds. The categories are tabs (`data-add-tab`, `role="tab"`)
  round the left of the rim from `TABS_FROM` to `TABS_TO` degrees, top to
  bottom, in `keyForHue(c.hue)` with the `PLANET` mark; the search
  (`data-add-search`) is a short bar in the top cap and searches every
  category. Back is a `RimButton` (exported from `DrawBoard.tsx`) at 318°;
  Escape steps back to the wheel.
- **Icon keys wear their own colours** (`KEY_HUES`, `keyOf` in
  `RingConsole.tsx`): opaque, a shade bright, white lines on them and dark
  on the yellows. The entrance kinds, the easings, the slide directions,
  the fills and the widths each take one. The picked key still wears the
  red ring.
- **Connect is a chain** (`Canvas.tsx`, the arrow branch of pointer-up;
  `edgePoint`, `Chain`, `isChain`, `reasonOn`; `links.ts`). A wire drawn from
  one part to another seats: its points are moved to the two parts' edges, it
  draws itself on (`wire-snap`, dash offset over the wire's own length), both
  parts ring once (`node-snap`), the confirm cue plays, and when the source is
  a linkable part its `link` becomes `{ kind: "node", target }`. It is then
  drawn as a chain and nothing else is: interlocking links in red
  (`CHAIN_RED`), a hollow link at its tail, a filled one at its head, no
  arrowhead, and a glow in the far side of that red when it is picked up. A
  wire with an end in the air is still a plain arrow in the pen's colour.
- **A chain says why it is there** (`links.ts`: `linkReason`, `chainLines`).
  A link that only says two parts are joined reaches the blueprint as "A → B",
  which is a fact nobody can build from, and nobody wants to type the reason
  twice. So it is *derived*, in order: a condition in the target's own words
  that turns on the source ("only when the wallet is connected"), then, on a
  data chain, the first value the source holds ("reads address from Connect
  wallet"), then the sentence in which one part names the other, then the
  relation itself. Kept to one line (`CAP`), because it is drawn on the wire.
  A name typed on the chain always wins, and the Name box in the inspector
  shows the derived reason as its placeholder, so what is written there is
  what the chain says. It goes three places: on the chain, into the blueprint
  (`spec.ts`, `connections[].reason`), and onto both parts' **pieces**
  (`threads.ts`, `Piece.links`, `chained: → Claim — …`) — where it also moves
  the fingerprint, so a part whose chains changed is resent rather than
  assumed unchanged. `tests/chain-links.mjs` holds all of it, on the board and
  off it. The tool's icon is a chain (`Link`) everywhere it appears.
- **A mark is the far side of what it marks** (`look.ts`: `complementOf`,
  `markColour`; `Canvas.tsx`: `NodeView`, the frame's outline, `CHAIN_MARK`).
  A picked thing is ringed in the complement of its own aura or fill — the
  page in the complement of its backdrop, a chain in the far side of its red
  — one thin line, drawn *inside* the thing's edge so its aura is still
  outside the mark and still visible. Never the app's accent, never a fill,
  and never two rings: the dashed hover outline is off once a part is picked,
  because it is drawn in the part's category hue and on a first-screen part
  that is a red. `tests/picked.mjs` holds it.
- **The bar says where you are** (`StudioPage.tsx`: `SiteHead`, `PageChips`,
  `PreviewToggle`; `DrawQueue.tsx`: the finish key; `tests/header.mjs`). It
  reads left to right: **Builds**, the site's **mark** (its favicon — the
  wordmark's first letter in the site's own accent, which is what the brief
  promises), the site's **build**, then its **pages**, with the way to add one
  on the same control rather than loose beside it. The Builder has no nav tab:
  "Builder" named a tab for the screen you were already on, and the build name
  says which site instead. Design is not a button either — it is the ground
  state, and the two ways out of it are at the far end: **Preview**, then
  **Finish**, an icon-only green flag with a tick that carries the make-real
  queue and opens the timeline. Pressing either again comes back. Green
  because Finish ends the work rather than changing it; everything that only
  changes something wears the console's own colours.  The Builder's bar is the **only** nav: no tab row above it repeating its
  first item, and no side rail — with no module asking for a side entry the
  rail is not drawn at all (`core/shell/Sidebar.tsx`), because a rail with
  nothing on it is a stripe of chrome that does nothing. The wordmark goes to
  "/", and "/" is Builds, so there is always a way back.

- **A piece is not an iteration** (`ThreadTree.tsx`: `CHIP`, the piece chip).
  A piece is a prompt on the board that the next call can carry, so it is
  never off: it keeps its purple whether or not it is vined, and vined is the
  lit state of that same colour rather than the difference between grey and
  alive. It is drawn well under half the size of a thread card, because it is
  not one.
- **The board keeps up with the hand** (`Workspace.tsx`, `darkMatter.ts`'s
  `layers`, `lightRig.ts`; `tests/board-speed.mjs`). Two gestures were slow
  and each for its own reason, and both fixes are rules rather than tuning:
  - **The weather is two layers on two clocks.** The clouds are four
    full-surface pattern fills and drift by about a pixel a second; the embers
    are a few dozen one-pixel streaks and are the whole reason the ground
    moves. Drawing both thirty times a second spent the frame on the half
    nobody could see moving. `paintDarkMatter` takes `layers: "clouds" |
    "sparks" | "all"`, and the workspace draws the embers at thirty and the
    clouds at two. Anything drawn once — a screenshot, the reduced-motion
    still — asks for "all".
  - **Nothing paints while the hand is down.** `Canvas.tsx` puts
    `data-board-drag` on the root for the length of a drag and the ground
    holds the frame it is on. It is an attribute rather than store state
    because a flag that re-renders the board on the first pixel of a drag is
    the thing it exists to avoid.
  - **A shadow is a CSS variable, not a render.** `liftTheme` hands a part
    `var(--lift-shadow, <the shadow>)`, so an undragged board is exactly what
    it was; while the sun is being dragged `lightRig.ts` sets the variable on
    each part's box instead. One pass per animation frame however fast the
    hand is, geometry measured once when the drag begins (from the nodes'
    own x/y/w/h, never the DOM), surfaces off screen skipped, and the store
    written once — on the drop. Before: panning p50 16ms / p95 47ms, the sun
    p95 43ms and a 130ms stall. After: 1.3 / 16 and 1.4 / 8.
- **The frame is one screen, and the site scrolls inside it**
  (`Canvas.tsx`: `SCREEN_H`, `pageH` vs `frameH`, `data-page-window` and
  `data-page-scroll`; `store.pageScroll`; `tests/board-layout.mjs`). Each
  frame width is a real device, so each has a real viewport — 1440×900,
  834×1112, 390×844 — and the pane's own shape leans it a tenth either way
  and no further. The board never scrolls: the wheel moves the page behind
  the frame's edge the way a browser does, and the workspace fits the pane
  with the ground showing all round. The scrolled layer is transparent to the
  hand (`pointer-events-none`, with the parts taking their own presses back)
  or the bare page would never be bare.
- **One side, and a band that is always there.** There were two panels, and
  the right one was hidden below 1280px — exactly where room is short. The
  column on the left carries everything now and answers what is in your hand:
  a part picks Element, the page picks Look, nothing picks Look. Under the
  board is the parts shelf and under the timeline is "This iteration", both a
  fixed band (`BAND_H`, a clamp so a short window loses height rather than
  the band) rather than a floor you scroll down to.
- **The shelf is round buttons and a screen.** A planet is a round thing, so
  its button is round: a disc of the category's own colour, the icon half
  again as big as it was, wrapping to as many rows as it needs, and "New
  idea" at the end of them in a dashed rim. The search is a screen across the
  whole shelf — teal glass, phosphor, the same as the palette's field —
  because a dark box at the end of a dark row is a search nobody finds.
- **One weather, one clock** (`ground.ts`). The workspace and the timeline
  stand on the same dark matter and now paint it the same way: a single
  `requestAnimationFrame` loop with the two clocks checked inside it, the
  embers at thirty a second, the clouds at two and at half resolution — they
  are soft, so half a backing pixel each is invisible and costs a quarter —
  and never both in one frame. Measured before: the timeline flat at 23fps,
  the board at 30 with a 34ms hitch twice a second, which is why the board
  was the one that looked wrong. A hitch in smooth motion is what an eye
  catches; uniformly slow motion is not.
- **Placing the lamp does not put the ground out.** The placer used to throw
  an 86% black over everything in the board but the page, which is most of
  the nebula. The page is ringed in the lamp's own colour instead. Placing is
  a thing you do to the board, so it ends when the board does — it was a flag
  nobody cleared on the way out, which is how the same dim turned up over an
  empty timeline.
- **Designs are tracked in the panel** (`Designs`, `nodeDesigns`,
  `backgroundDesigns` in `Inspector.tsx`): a row of coloured keys under the
  header for everything the wheel has set. Add a line there when a part or
  the page gains a new thing to set; a setting that cannot be seen is a
  setting that will be set twice.
- **Two materials, defined once** (`core/ui/void.ts`; `tests/surfaces.mjs`).
  Every surface of the Builder's console is the void or the screen, and both
  live in core so nothing can drift: a feature that wants either imports it.
  A private copy is the bug — the key vault kept its own five-value screen
  with every number a little away from the shared one — and so is a surface
  painted out of a third family: the trail's canvas was the shell's ground
  with its hue typed as 150, a green nothing else in the app is near. The
  suite measures the hue of every painted surface in the book and holds the
  vault to importing rather than redefining.
- **Nothing is sliced by a fold.** A panel that scrolls scrolls its *reading
  matter*: the rows you act on — Publish, Download, Copy — sit below the
  scroller, not at the end of it, or the panel's own edge cuts one in half on
  open with nothing to say there is more. Same rule on a card: a row of
  options is pushed to the foot (`mt-auto`, which needs the column above it
  to be `flex-1`) so the bars line up across a row of cards whatever each one
  had to say above them.
- **The command palette is a console** (`CommandPalette.tsx`) and the
  chrome leans into the void (`--void-h` and the dark tokens in
  `globals.css`): a shade, not a colour. Keep new chrome on the tokens.
- **More is a piece of the wheel** (`SLOTS.more`; the top inner band is
  three icons — Animation, the pencil, More). It opens into green pieces
  built from the same list the tray held, each firing on the spot and dimmed
  when it has nothing to do (`Choice.dim`). The `HoverTray` stays only under
  the drawing board, which has no band to put a piece on. What More holds —
  **Preview here** (the live page, scrolled to the part: `livePath` plus the
  part's id as the hash, which `PreviewPage` reads), **Bring forward** and
  **Send back** (`raiseNode`/`lowerNode`: the node list *is* the z-order),
  **Copy looks** and **Paste looks** (colour, font, texture, aura, size and
  style, held in a module variable rather than the store — a hand holding
  something, not a thing the site remembers). Under the wheel rather than on
  it, so the wheel stays the wheel; a tab rather than a row, so it is not
  chrome until it is wanted. `keepOnScreen` gives the bottom edge extra room
  for it and *only* the bottom: pushing the menu further from every edge
  moved a menu opened near the top away from the hand that opened it, and
  the pull that starts from that hold lost its line.
- **Texture's third slab is Reiterate**, a placeholder: the button is cut and
  wired, and pressing it does nothing yet. It is the place for "change one
  thing about this texture at random" — scale, grain, colour, bleed — so a
  texture can be wandered through rather than set. The take-it-off-the-site
  button that was there is gone; the stack is edited from the Looks panel.
- **Draw is the outer top-right slab, and it is the drawing board**
  (`DrawBoard.tsx`, `sketch.ts`). It is not a level: press it and the wheel is
  gone, and in its place is one disc the size of the whole menu (`BOARD_R`),
  no hole in the middle, every pixel of it drawing surface. The disc is the
  **void**: dark purple-blue, four clouds of darker violet and blue on
  orbits of a minute and a half to nearly three (repainted on a slow ticker,
  `DRIFT_MS`, sub-pixel per tick), one warm point at the middle that
  breathes, to start from — no stars, no crosshair, no caption: a scatter
  of points on a drawing surface is a scatter of things to draw round. The
  inside of the edge falls to near black, and past the rim is a black
  hole's horizon: a hair of dim orange-red right at the edge, spread thin
  for a few tens of pixels and gone. No lit rim and no dark bands — a hole
  in the screen, not a plate on it. Nothing sits on its face: Back
  straddles the top of the rim, the words go in a thin strip in the bottom
  cap, and Make real and Clear are in the same tray the wheel has, hung
  under the disc, which lights blue as soon as there is a stroke to make
  real. Escape steps
  back to the wheel; the board does not turn with `menuSpin`. What is drawn
  is kept on the part as `node.sketch` (strokes as
  fractions of the board's width, plus the words), so the board reopens with
  the drawing on it and the blueprint writes a `drawn:` line for it.
  **Make real** posts the drawing — a small black-on-white picture and the
  strokes as numbers — with the part as it is, the words, the frame width and
  the whole library to `src/app/api/studio/reshape/route.ts`, and applies
  what comes back after checking every field against the catalog
  (`allowedOptions`, a real `featureId`, a size inside the frame). Without a
  key the route says so and the board reshapes the part from the drawing's
  proportion alone (`fitToSketch`, keeping the part's area); the drawing is
  never lost to a missing key. The same disc opens with no part under it
  from the canvas menu ("Draw a new part here", `openBoard`), and then Make
  real adds a part in that shape at that spot.
- **The eraser sweeps.** A press takes what is under it — a drawing first,
  else a part — and the hold that follows is a `Drag` of kind `erase`: every
  drawing the pointer crosses goes too, one history entry for the whole sweep.
  Hits are measured by geometry (`hitShape`: distance to a pen polyline, an
  arrow's segment, or a region's four edges) rather than by asking the browser
  what is under the pointer, because a one-pixel pen line is not something a
  moving pointer lands on. A sweep never takes a part: a part under a passing
  eraser is not an instruction, and a part is erased by pressing on it.
- **A dropped picture joins the site's stack.** The texture console's well
  calls `addTexture`, so what you add lands in the same rail as everything
  else and every other part can wear it. There is no separate library: the
  site's stack *is* the library.
- `menuShape` (square or swept round) is set from the **toolbar**, not from the
  menu — a toggle that only exists while the thing it changes is open is a
  toggle you can never find again. It lights up while a menu is open, and the
  outside-click handler exempts `[data-menu-shape]` so flipping it does not
  shut the menu you were comparing. It also exempts Radix portals: a select's
  list is not a descendant of the menu, and closing on it shut the whole thing
  the moment you picked an option.
  The menu sits at `z-[68]`, above the top bar, or one opened near an edge has
  pieces behind the chrome.
- **One bar, not three.** The master prompt lives inside the blueprint dialog
  where it is read; the pages and the way out live on the toolbar. A prompt
  field stretched across a row of its own was permanent chrome for something
  touched twice a session; the page tabs had a full-width strip for a list that
  is usually one item long; and the Finish orb floated over the board, which
  put the door in front of the work. `PageChips` and `FinishButton`
  (`.finish-orb`, `[data-finish]`) are both toolbar-height now, and the two
  rows they cost are board. The orb is the only control in the Builder allowed
  to look like an object rather than a control, and its light comes from the
  top left like the page's own lamp.
- **A part carries `anim`, `aura` and `texture` of its own** beside `colour`.
  `anim` is a CSS animation name from `ENTRANCES` played on the live site
  only — the board draws where a part ends up, so laying out a page never
  becomes watching it. `aura` names a palette role and becomes a glow round
  the element (`auraShadow`), applied at the node wrapper, not inside the
  part. `texture` names one layer of the site's stack to wear instead of what
  the site wears, or "none".
- **One light over the page** (`Look.light`, `castFrom`, `liftTheme`). The
  lamp has a position on the page, a height, a strength and a lift; every part
  works out its own shadow from where its centre stands relative to it, so a
  card on the left throws left and one under the lamp throws almost nothing.
  `cardStyle` and `Btn` wear `t.shadow`, and a primary button also gets
  `t.sheen` on the face turned toward the light. The blueprint says where the
  light is and that shadows are per-element, not one shadow for everything.
- **Frame interpolation lives in `motion.ts` and `MotionPanel.tsx`** — the
  crate on the left, beside Look. `planFrames` decides which two keyframes
  each output frame sits between and how far along it is (hold, gap weights,
  easing, loop); the panel draws that to one canvas, so 45 frames cost nothing
  to store. It is a cross-dissolve and says so: `motionBrief` writes the brief
  from `docs/MOTION.md` on the identical timing, and `spec.ts` puts it in the
  blueprint, so the Builder's own pass is the floor and a generator's is the
  ceiling.
- The parts drawer drills down rather than listing 218 tiles: categories carry
  an emoji and their category hue, picking one slides the rest away and reveals
  its sub-groups (`SUBGROUPS` in `catalog.ts` — every id belongs to exactly
  one).
- **The shelf is shaped like a page.** `showcase.ts` gives every part a band
  (across the top / first screen / the body / further down / foot of the page)
  and a column span, both derived from its category and its real width, so a
  header spans the shelf and a search box sits centred under it. Nothing is
  hand-placed; a new `f(...)` line lands somewhere sensible on its own. The
  span is compressed rather than true to scale, because at true scale a product
  grid would fill the shelf on its own.
- `PartPreview` renders a part at its real width and only ever scales *down*.
  Magnifying a 420px preview to fill a wide card turned a nav bar into one
  enormous word.
- The shelf lights parts instead of boxing them (`.ember*` in `globals.css`):
  a blue flame rising from below each one — a steady bed and two tongues on
  their own clocks, so it is always moving and never pulses in step. Reaching
  for a part feeds it in 180ms; letting go takes the full 0.7s to die down.
  Deliberately not the site accent — the shelf is the workshop, not the thing
  being built.
- The shelf has a **fixed height** and scrolls. The board keeps the rest and
  never zooms out past fitting the page's width, so both side edges are always
  on screen with a small gutter; a pane that grew just means a wider gutter,
  and only a page that would be cut off triggers a re-fit.
- Categories are the twelve outline planets in `planets.tsx` — `currentColor`
  only, no fills, one hue each. At 16px a filled planet is a blob; a ring and
  two lines still read as Saturn. Pick one and it becomes a crumb with its
  sub-groups beside it.
- Parts that repeat a card show **two** on the shelf, not six (`previewContent`
  in `showcase.ts`). A grid of six thumbnails inside a thumbnail is mush.
- A shelf preview shows the **surface**, never the page: `PartPreview` swaps
  `bg` and `backdrop` for `surface` before drawing. A shelf full of page
  backgrounds is a shelf of identical rectangles, and what you are choosing
  between is the part. The previews float on one field the colour of the
  surface's complement, dimmed, with a single flame burning behind the whole
  scroller (`.ember-shelf`) rather than one under every card — a flame per part
  reads as a bar once the cards are full width.
- The phone companion starts **collapsed**. It floats over the board, and a
  panel covering a resize handle you cannot see is the bug the user hit; one
  click opens it.
- Library previews render the real component through `PartPreview.tsx`, not an
  icon — two grids that differ only in shape used to look identical. Previews
  are `aria-hidden` **and** `inert` (they contain real buttons and inputs, which
  would otherwise land in the tab order and the a11y tree), and the tile is a
  `role="button"` div rather than a `<button>`, since a button inside a button
  is invalid HTML and breaks hydration. `content-visibility: auto` keeps 218 of
  them roughly as cheap as the icons were.
- `FeatureDef.explain` is one sentence saying what a part is and when you would
  want it, for the parts whose name is not enough (all of motion, interaction,
  under-the-hood, AI and dense). It shows on hover on the board and in the
  library tooltip. Write one for any new part that is not self-evident.
- Every Builder surface carries a right-click scope: `studio-node`,
  `studio-group`, `studio-shape`, `studio-canvas`, `studio-palette`,
  `studio-page`, `studio-brief`, `studio-format-group`, `studio-live`,
  `studio-live-node`. If you add a surface,
  give it a scope and contribute a menu — that is the standing expectation.
- The blueprint must stay self-contained: it explains its own conventions so
  any agent can act on it without this app. If you change the compiler, keep
  the "How to read this" section honest.
- The board and the live preview render the same part component, so a part
  never looks like one thing on the board and another in the preview. Parts
  are size-aware (they read `t.fontPx` and the node's `w`/`h`) and plain on
  purpose — shape, order, proportion and behaviour are truthful, the art comes
  from Stage 4's skins. Don't add decoration a format option, a content field
  or an asset can't explain.
- A part that holds things (tabs, nav links, search scope, form fields, FAQ
  rows, footer columns) should say what it holds through `content`, not only
  through its prompt. Prompts describe behaviour; contents are the literal
  list the board draws.
- Calling Claude is optional. `src/app/api/studio/generate/route.ts` returns
  `ok: false` with a reason when `ANTHROPIC_API_KEY` is absent, and the UI
  falls back to copying the blueprint; `reshape/route.ts` does the same and
  the drawing board falls back to the drawing's proportion. Never make the
  API key load-bearing.
- **A Claude route answers within a budget of its own.** `generate` keeps
  `ANSWER_BUDGET_MS`, a few seconds inside its `maxDuration`, and answers
  itself when it runs out rather than being killed mid-call with nothing sent;
  the SDK client gets `timeout` and `maxRetries: 0` inside that, so the
  default ten-minute wait and two retries cannot outlive the function. Set
  `STUDIO_ANSWER_BUDGET_MS` where the deployment allows less than
  `maxDuration` asks for — a Vercel hobby plan stops a function at 60 seconds
  whatever the file says, and a budget above the real ceiling never fires.
  Every failure is HTTP 200 with a reason, the seconds it took, and the API's
  own status and request id where there is one. On the other side
  `askClaude()` takes the caller's abort signal and keeps a deadline of its
  own, and reads the body as text before parsing, so a gateway's error page
  reads as the timeout it is instead of a JSON parse error.
- **Two browsers, in that order.** `api/studio/headless.ts` `findPlaywright()`
  looks for a full Playwright install first (`PLAYWRIGHT_MODULE`, the project,
  the box's own) and only when there is none falls to `playwright-core`
  driving `@sparticuz/chromium` — the Chromium cut down to something a
  serverless function bundle can carry. The pairing **is** a dependency and has
  to be: a host installs what `package.json` lists and nothing else, so leaving
  it out left the deployed site with the code that looks for a browser and no
  browser to find. It is imported by name (not through `createRequire`, which
  the tracer cannot follow), kept out of the bundle by `serverExternalPackages`
  and copied into the function by `outputFileTracingIncludes` — the packed
  browser is read off disk beside the module and no import mentions it. A full
  Playwright is still required from outside the project, because it is
  installed outside it. The `Found` it
  gives back carries `video`, which is true only for the full install:
  recording is written by an ffmpeg that install ships and the serverless
  pairing has none, so a route that needs video (either `preview-video`)
  answers `reason: "no-video"` **before launching anything**, and the tweet
  console greys Render with the reason rather than running a whole tour to
  find out at the end. `tests/serverless-browser.mjs` holds that claim, and
  checks the manifest first, since that is the half a passing local run
  cannot see.
- **Claude sees the site.** `api/studio/headless.ts` opens the preview route
  in a headless browser with the author's document written into storage
  first (`withPreview`), so a server render shows what the author sees;
  `screenshot/route.ts` photographs a page with it and `generate` takes those
  pictures as image blocks beside the blueprint. `generate` has seven modes
  (plan, critique, expand, finish, ideas, ask, build); `build` answers with
  files as fenced blocks whose info string is `lang path`, which
  `features/studio/agent.ts` `filesFromMarkdown` reads back. Add a mode by
  adding to `MODE_INSTRUCTIONS` and to `MODES` in `agent.ts`; nothing else
  knows the list.
- **Publish** (`publish/route.ts`) makes one commit on a branch of a
  repository with `GITHUB_TOKEN` through the git data API, then calls
  `VERCEL_DEPLOY_HOOK` when set. It pushes `site/document.json` (the
  document; the app renders it at `/site`, and `next.config.ts` redirects
  `/` there when it is non-empty), `site/BLUEPRINT.md`, `site/blueprint.json`
  and any generated files. Paths are checked (`safePath`); files are capped.
  The token never reaches the browser; `GET` says only what is set.
  A request may name its own `repo` and `branch`, because the Builds page
  keeps more than one site and each says where it publishes; `GITHUB_REPO` is
  where anything that names nowhere goes. What a request may name is bounded
  by the token's own permissions, and by `GITHUB_REPOS` when that is set —
  set it on any Builder that strangers can open.
- **Go live** (`deploy/route.ts`) is the other half: `POST` asks Vercel to
  build the repository's branch and answers as soon as it is queued; `GET
  ?id=` says how that build is getting on and, when it is `READY`, what
  address it is at — the shortest alias, which is the production domain,
  else the deployment's own host. `GET` with no id says only whether there
  is a token at all. The token is the server's `VERCEL_TOKEN` or the vault's
  `x-vercel-token`, server first, like the Claude key. A build outlives a
  serverless request, so the client polls (`watchDeploy` in `agent.ts`)
  rather than the route waiting. The deploy hook stays what it always was:
  a poke for a project not connected to the repository, which answers with
  nothing you can open. `tests/go-live.mjs` covers both halves.
- **`/builds` is `/`'s survivor.** `features/builds` (the Sites/Repos front
  door) answers at both `/` and `/builds`, and anything that has to keep
  working after a publish links to `/builds`: once `site/document.json` is
  non-empty the redirect above sends `/` to `/site` before the router ever
  gets it, so a link to bare `/` stops reaching Builds the moment the site it
  is inside goes live. `/` stays the unpublished front door; `/builds` is the
  one path the redirect does not touch.
- **Reiterate is one thing at a time, and on a picture that thing is the
  patch** (`reiterate`, `rollPatch` in `look.ts`). A photograph carries more
  textures than the whole generated set — the weave in the corner, the grain
  across the middle — and the crop window is what gets at them, where turning
  the tint only dresses the same square differently. So a picture layer rolls
  a new patch and nothing else, and is set drifting once if it was still. The
  roll is the add disc's lesson applied to a number: **kinds, not one
  distribution** (close, middling, wide, strip, each with its own shape), and
  a place required to be a real distance from the patch before it. Baking
  moved out of the Look panel to `Bakers.tsx`, mounted by `StudioPage`: a
  patch re-rolled on the wheel has to cook whether or not a panel is open.
- **The drawing board snaps.** `sketch.ts` `refineStroke(points, mode)`:
  `snap` reads a finished stroke as a line (levelled when nearly level), a
  polyline, a box, a triangle or an ellipse and replaces it with the clean
  shape; `smooth` averages it; `raw` keeps it. The mode is the setting
  `studio.drawMode` and the switch on the board's rim.

---

## 2b-ii. Builds (`src/features/builds`)

The front door at `/`, and the answer to "where is the other thing I was
making". There was a landing page announcing a version and a changelog panel
behind it; both are gone, and nothing replaces the changelog — the commits
carry why a thing arrived.

- **One document is open; the rest wait beside it.** `builder.studio` stays
  the key the Builder reads and writes. Every project keeps its own copy at
  `builder.doc:<id>`, and `open(id)` is save → copy in → `useStudio.persist
  .rehydrate()`, which puts the canvas and every panel on the new document
  without a reload. Both stores are `skipHydration`, so something has to
  start them: the feature's `onMount` rehydrates the list and `adopt()`s
  whatever the Builder is already holding on a first run, so nobody arrives
  to find their work replaced by an empty list.
- **A project is three facts, all local.** The document, the repository it
  publishes to, and the address it last went live at. Nothing about it
  reaches a server until a publish.
- **Counts come from storage, not from the studio store**, which is only
  hydrated inside the Builder and would otherwise answer with its own empty
  defaults on every other page.
- **The same list is in the top bar** (`SwitchButton`, a `topBarItems`
  contribution) and is not there until there are two sites to switch between.
- **A card leads with the site, not with its counts.** `SitePreview` renders
  the project's own document — real parts, real palette, real texture, real
  light — at the frame's true width, scaled to the card, in `board` mode. It
  is the render, not a picture of it: nothing to store, nothing to go stale,
  and a project whose colour changed looks changed. The name and the options
  bar sit under it, and the bar is pushed to the foot (`mt-auto`) so the bars
  line up across a row whatever each card had to say above them.

---

## 2b-iii. The tour (`src/features/tour`)

Opened from Builds and from the palette (`?`). One layer over the app, an SVG
mask with a hole cut for each thing a step is about, and a card beside each
hole. It is not a slideshow: each step **stages the real screen** first — opens
the wheel, opens the drawing board, opens the Blueprint — and then lights what
is actually there.

- **At most four things per step, each with three facts**: a name, one line of
  what it is for, and where it lives. Five is a list, and a list is what a tour
  exists to avoid. `tests/tour.mjs` holds both.
- **A spot whose thing is not on this screen keeps its card and loses its
  hole.** Some of what the tour names lives somewhere the tour is not standing;
  saying so is the job, not a failure.
- **Navigation is on screen the whole way**: which step of how many, back,
  next, skip, and a pip per step. A tour you cannot leave is a trap.
- **What it stages must stay staged.** The wheel closes on a press anywhere
  else and a modal dialog closes on a press outside it, so both ask
  `document.documentElement.dataset.tourOn` before acting. A modal dialog also
  marks everything else `inert`, so the tour is portalled to `document.body`
  and takes that mark off itself each frame.
- **Adding a step** is an entry in `STEPS` (`steps.ts`): a route, an `arrive`
  that puts the screen in the right state, a `leave` that undoes it, and its
  spots. Anchor spots on `data-` attributes, never on text or on a class.

---

## 2c. The tweet console (`src/features/tweets`)

A dashboard, not a page: `T` (or the palette, or the status-bar count) brings
it down over whatever is open, the way the key vault does, and Escape
takes it away. It drafts posts to X, previews them, records a tour of the
live site to go with them, queues them, and sends them.

- **Files.** `store.ts` is the document (drafts, the queue, the log), persisted
  to `builder.tweets`; pictures go to IndexedDB through `media.ts` and the
  draft keeps a thumbnail. `text.ts` counts the way X counts and cuts threads.
  `tour.ts` drives the preview iframe and records the tab; `gif.ts` is a
  dependency-free GIF writer (median-cut palette, delta frames, LZW) used by
  both the server route and `gif-browser.ts`. `send.ts` is the three ways out
  (API, X's compose page, clipboard) and `preflight`, the list of reasons a
  draft cannot go yet. `index.ts` holds the manifest and the scheduler;
  `TweetConsole.tsx` is the surface.
- **Routes.** `/api/tweets/send` posts one post (multipart: `payload` JSON plus
  `media_k` files) through OAuth 1.0a with `X_API_KEY`, `X_API_SECRET`,
  `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`; `/api/tweets/status` says whether they
  are there (never what they are); `/api/tweets/preview-video` renders the
  tour with a *full* Playwright (`PLAYWRIGHT_MODULE` to name one) and returns
  a GIF, or the WebM with an `x-tour-note` when it could not — it shares the
  studio's lookup, and refuses with `no-video` on the serverless browser.
  Without keys every route answers `ok: false` with a reason and the console
  falls back — Send opens X with the words. Keys are never load-bearing.
- **The queue is honest.** It runs only while the app is open (a tick every
  `tweets.tickSec`, and on visibility and `online`). A due post still goes
  out up to `tweets.sendWindowMin` late; later it is marked `missed` and
  offered again. Failures retry with `retryBackoffSec · 2^attempts` up to
  `retryAttempts`; a thread that half-posted is final, never retried, because
  a retry would post the first half again. Do not add a "background" mode
  that pretends otherwise.
- **The tour** is one page, scrolled at a walking pace, pressing what it
  passes (`[role="tab"]`, `[aria-expanded="false"]`) and nothing that
  navigates. The route mirrors `tour.ts`; change one, change both.
- **Every surface has a scope**: drafts in the rail carry `tweet-draft`, whose
  menu does what the buttons do (send now, schedule, duplicate, copy, open in
  X, record a tour, delete with confirm). New actions go in both places.
- **Settings** live under the `tweets` group, ids `tweets.<name>`; anything a
  first-time user should not meet is `advanced: true`. Each one is read in the
  console and the console says, next to the control it affects, what it is
  doing.

---

## 3. The news feed: never repeat yourself

`ctx.publish(input)` is the only way to tell the user something happened. The
rule that makes it feel right:

> **Same `key` → same line.** A second publish with the same key inside the
> coalesce window updates the existing line in place (body replaced, `×N`
> count, `diff.from` kept from the *original*). Identical content is
> suppressed entirely. If a value reverts to where it started before the user
> reads it, the line is removed. Toasts follow the same key and update rather
> than stack.

Key conventions:

| Event                              | Key                               |
|------------------------------------|-----------------------------------|
| A setting changed                  | `setting:<setting id>` (automatic)|
| An entity's field changed          | `<module>:<field>:<entity id>`    |
| An action on an entity             | `<module>:<verb>:<entity id>`     |
| A module-wide status               | `<module>:<status>`               |

Use `diff: { from, to, format }` for value changes so the line reads
"Slippage 1% → 3%". Use `coalesceMs: Infinity` for settings-like state. Use
`ttlMs` for transient things (a graduation, a fill). Set `toast: true` only
for things the user should see right now. Set `sound: false` when the caller
already played a cue.

Per-source rate limiting (30/s) protects the feed from runaway streams; the
drop count is visible in the panel.

---

## 4. Right-click scopes

```tsx
<div {...ctxProps("token", token.address, token)}>…</div>
```

```ts
contextMenus: [{
  scope: "token",
  items: (target, ctx) => {
    const t = target.data as Token;
    return [
      { type: "label", label: t.ticker },
      { id: "buy", label: "Quick buy", icon: Zap, children: [...] },
      { id: "copy", label: "Copy CA", icon: Copy, shortcut: "mod+c", onSelect: () => void ctx.copy(t.address) },
      { type: "separator" },
      { id: "hide", label: "Hide", danger: true, onSelect: ... },
    ];
  },
}]
```

- Nested scopes stack: right-clicking a row inside a column shows row items,
  then column items, then the core page items. Don't repeat page-level items.
- `checked` renders a checkbox item; `children` renders a submenu; `hint`
  is a dim trailing note; `danger` colours red and plays the deny cue.
- Text inputs keep the native menu unless they sit inside a scope.

---

## 5. Feedback and sound

- `Button` plays `tap` on pointer-down and vibrates where supported. Override
  with `sound="confirm"`, `sound={false}`. `optimistic` + `doneLabel` shows a
  done state instantly.
- `play(cue)` from `@/core/audio` for anything else. Cue names are in
  `CueName` (core/types.ts). Categories (ui / feedback / alerts / feed) map to
  the Audio settings so users can mute just the feed.
- `useFlashOnChange(value)` returns a ref; the element flashes green/red by
  direction. `NumberTicker` does this plus tweening.
- Respect `effects.motion`: use the `tactile` utility and the `animate-*`
  classes; they collapse to zero duration when motion is off.

---

## 6. Settings

Declare, don't build UI:

```ts
settings: [
  { id: "orders.confirm", group: "orders", label: "Confirm before sending", type: "toggle", default: true },
  { id: "orders.defaultSlippage", group: "orders", label: "Default slippage", type: "slider", default: 1, min: 0.1, max: 50, step: 0.1, format: (v) => `${v}%`, advanced: true },
]
```

Read with `useSetting<T>(id)` in components or `ctx.getSetting(id)` in
callbacks. Changing a setting automatically plays a cue and publishes a
coalesced feed line ("Default slippage 1% → 2.5%").

**Put most options under `advanced: true`.** The default drawer should look
calm. "Every option possible" and "options hidden away" both hold because
the drawer is searchable and has an Advanced switch.

---

## 7. Theming

Tokens live in `src/app/globals.css` as CSS variables and are exposed to
Tailwind as `bg-panel`, `text-fg-muted`, `border-border`, `text-up`,
`text-down`, `bg-accent-soft`, etc. The accent is a single hue
(`--accent-h`) so one setting recolours everything. Never hard-code colours
in components; use the tokens so light mode, contrast and accent changes
keep working.

Density and radius are also tokens (`--row-h`, `--cell-x`, `--radius`).
Use `h-(--row-h)` for rows so the density toggle affects them.

---

## 8. Routing

Pages are client components rendered through `app/[...slug]/page.tsx`. The
registry matches `path` patterns in order: static first, then `:param`, then
`/*`. You do not create files under `src/app/` for new pages. If you need a
server component or an API route, add it under `src/app/api/` as normal
Next.js code and call it from your module.

---

## 9. Removing the demos

Set `demoModules: []` in `site.config.ts` and `showcase` will no longer load.
The Builder is not a demo; it always loads. Delete the showcase folder and
remove it from `src/features/index.ts` when you're sure.

---

## 10. Things not to do

- Don't add a toast for every event. Toast only what needs eyes now.
- Don't publish without a key from a loop or a stream.
- Don't render more than ~100 DOM rows without `VirtualList`.
- Don't add a global provider for feature state; a zustand store inside the
  module folder is the pattern (see `studio/store.ts`).
- Don't put feature logic in `site.config.ts` or `src/core/`.
- Don't hard-code shortcut labels in UI; pass `shortcut="mod+k"` and `Kbd`
  formats it per platform.

---

## 11. Keys, and the top bar

- **A module can put a control in the top bar.** `topBarItems: [{ id, order,
  component }]` on a feature module, mirroring `statusItems`. The bar renders
  whatever is registered and imports no feature; anything that has to live up
  there arrives this way. `keys` contributes the key, `studio` the GitHub mark.
- **Keys belong on the server.** `ANTHROPIC_API_KEY`, `VERCEL_TOKEN`, the four
  `X_*`, `GITHUB_TOKEN`/`GITHUB_REPO`, `VERCEL_DEPLOY_HOOK`: read in route
  handlers, never prefixed for the browser, never returned. `/api/keys/status`
  answers only which names are set, plus the repository name, which is not a
  secret. Anything added there must pass the same test: a name and a yes or no.
- **Two keys can be held in the browser, and only two.** The Claude key and
  the Vercel token, because those are the two the routes take as a header
  (`x-anthropic-key`, `x-vercel-token`). A GitHub token in a browser would do
  nothing, so the panel says so rather than offering a field. Adding a
  service to `SERVICES` means adding a header a route reads and an arm to
  `/api/keys/test`, which asks each service the smallest question it answers
  — one answer per service, never one standing in for another.
- **The vault is the fallback, not the pattern.** `src/features/keys` holds
  the key in this browser, in localStorage, in the clear, open on arrival and
  across reloads and tabs, with one way out: **Forget the key**. There is no
  PIN on the way in. Four digits was a speed bump in front of something
  anything on the machine could read the moment it was unlocked, and it cost
  an unattended run every five minutes and every reload. The panel says
  plainly what holding a key here means and that the server is where a key
  belongs — do not restyle that warning away. The sealed vault is still
  there behind **Seal the key under a PIN** (`keys.pin`, off, advanced):
  PBKDF2 at 310,000 rounds into an AES-GCM box, only the box stored, never
  the PIN or a hash of it, with the tab-held and kept-for-this-tab modes
  beside it. A key sealed before the setting existed is brought across by
  typing the PIN once in the panel; a key held for the tab comes across on
  its own. A held key is sent as a header and used for that one call when
  the server has none.
- **Never widen what a status route says.** A length, a prefix, a first
  character: each narrows a guess. Name and boolean, nothing else.

---

## 11. More than one session works this repository

Sessions run in parallel on their own branches, so the code you are looking at
can be older than the code that is live. Before changing a shared file — the
Builder's canvas, wheel, panels and store are the ones that move — fetch the
default branch, read what is there now, and write your change to fit it.

`.claude/hooks/catch-up.sh` does the fetch on every prompt and reports how far
this branch has drifted — from the default branch, and from every other branch
that has commits this one lacks, naming their newest work. It only reports:
whether to merge is yours to judge, because only you know what is half-finished
in your tree. Nothing about it is required for the app to build; delete it and
the rule above still stands.

**Check for updates before every commit, always.** The hook runs at the start
of a turn; a turn can be long. Before you commit — not after, not at the next
prompt — fetch again (`git fetch --prune origin`), compare against every remote
branch, read what arrived, merge what relates, run the checks on the merged
tree, and only then commit and push. A commit made against a branch that has
since moved is a merge someone has to referee.

When two sessions want the same file, the one already holding it wins. Hand
the other the change in words rather than editing behind it — a four-line fix
made twice is a merge someone has to referee.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
