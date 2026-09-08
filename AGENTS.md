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
  catalog.ts     218 parts in 14 categories, plain names, one f(...) line each;
                 CATEGORY_SIZE + DETAILS give each its real size, options, contents
  blocks.tsx     dispatcher: Block → parts/; the labelled box is the last resort
  parts/         the real components, one archetype file per family; props only,
                 no store / Radix / core imports — a generated site ships this folder
                 Layout Hero Text Media Forms Tabs Accordion Header SearchBox Cta
                 Commerce Data Social Ai Power Platform Ops Interact Motion Behaviour
  look.ts        colour (OKLCH maths, harmony, contrast) and texture (layer → CSS)
  texture.ts     cooking a picture into a tile: cut-out, pattern, rotate
  planets.tsx    fourteen outline category marks, one per kind of part
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
Nothing slips to fit: where a part sits and how big it is *in the frame* is
the specification, and the blueprint says so ("do not reflow to fit").

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
| Arrow from A to B | An explicit relationship |
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

**Rules:**

- Only *changed* format values reach the blueprint. Defaults are noise.
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
- **The wheel is the whole editor, and the right panel is the convenience.**
  Anything the Inspector can do to one part, the wheel can do too: the per-part
  options that used to be panel-only live under `Edit ▸ Options`, and the board
  tint and glyph under `Edit ▸ Tint` and `Edit ▸ Glyph`. Add a per-part control
  to both, or to the wheel alone — never to the panel alone. What is still
  panel-only is what is not a part: a page's prompt, a drawn shape, a group's
  name and prompt, and the bulk edits that apply to a whole selection.
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

      empty  │  Animation (inner) · Prompt (outer)
    ─────────●─────────
     Delete  │  Duplicate · Edit (inner) · Looks (outer)

  It used to swing so the empty quadrant faced the middle of the screen, which
  meant the menu was a different shape depending on where you clicked and your
  hand could never learn it. Delete is bottom-left. Looks is bottom-right.
  Always. The one thing that moves it is `menuSpin`: hold the **right button**
  down on an open menu and drag, and the whole wheel turns to any orientation,
  chased at a fifth of the way per frame rather than pinned to the pointer, and
  remembered. A turn swallows the `contextmenu` the button's release would
  otherwise fire, or the page's own menu lands on top of the wheel you were
  arranging.
- Each working quadrant is cut once more at `MID` into an inner band and an
  outer block, which is how three quadrants carry six buttons. Delete is the
  whole quadrant beside the empty one, undivided. The pointer keeps a clear
  circle with the **lock** in it. Level 2 is **green** and takes the quadrant
  that was empty; a group of more than four takes the quadrant below it as
  well, since the blue level is gone by then and there is nothing down there to
  cover. Level 3 is **crimson** and *replaces* the green rather than opening
  beside it — same anchor, same direction, different colour, and the menu is
  only ever one thing at a time. Escape steps back one level.
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
  turns it at a right angle instead of cutting it off with a chord.
- **Flat colour, no gradient.** A vertical gradient under a heavy drop shadow
  read as a lump of dark glass. One flat colour reads as one button: the old
  *hover* colour is the resting colour and hover goes a step brighter again,
  with an edge always darker than the face.
- `menuShape` (square or swept round) is set from the **toolbar**, not from the
  menu — a toggle that only exists while the thing it changes is open is a
  toggle you can never find again. It lights up while a menu is open, and the
  outside-click handler exempts `[data-menu-shape]` so flipping it does not
  shut the menu you were comparing. It also exempts Radix portals: a select's
  list is not a descendant of the menu, and closing on it shut the whole thing
  the moment you picked an option.
  The menu sits at `z-[68]`, above the top bar, or one opened near an edge has
  pieces behind the chrome.
- **There is no prompt bar.** The master prompt lives inside the blueprint
  dialog, where it is read; the way in is one round blue button over the top
  right of the board (`.finish-orb`, `[data-finish]`). A text field stretched
  across the width of the page tabs was permanent chrome for something touched
  twice in a session, and the widest thing on screen for the least frequent
  thing on it. The orb is the only control in the Builder allowed to look like
  an object rather than a control, and its light comes from the top left like
  the page's own lamp.
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
- Categories are the fourteen outline planets in `planets.tsx` — `currentColor`
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
  falls back to copying the blueprint. Never make the API key load-bearing.

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
