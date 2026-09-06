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
| **Library** | left, toggle with `l` | All 218 parts as visual tiles, searchable, by category. Drag onto the board or click to drop. Blurb lives in the tooltip and right-click. |
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
  blocks.tsx     dispatcher: Block → parts/ (or parts/legacy.tsx until migrated)
  parts/         the real components, one archetype file per family; props only,
                 no store / Radix / core imports — a generated site ships this folder
                 Layout Hero Text Media Forms Tabs Accordion Header SearchBox
                 Cta Behaviour + legacy.tsx (not yet migrated) + the fallback
  live/          the live site: layout (absolute or reflowed), LiveSite renderer,
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
  whole live site (scroll effects, cursor, shortcuts — chip on the board, effect
  in `live/`); **C** platform mock that cannot run in a browser (auth, checkout)
  and shows a truthful state change instead.
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
- Anything without an archetype yet draws through `parts/legacy.tsx`, then
  the labelled-box fallback (`data-part-fallback`). Layout, navigation, first
  screen, text, media and forms are migrated — 90 parts, no fallbacks; shop,
  data, social, AI, dense and under-the-hood are still legacy. Every part's root carries
  `data-part={id}`; the live page wraps each in `[data-live-node=id]`.
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
  tier, linkable). Until then it draws through `parts/legacy.tsx` or the
  labelled-box fallback.
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
- Right-clicking a **part** opens the wheel (`RadialMenu.tsx`), not a list: six
  wedges — Contents, Size & place, Look, Links & data, Prompt, More — as a half
  circle facing away from the nearest screen edge, each opening one small panel.
  Everything else keeps a short list menu; a wheel of three items is worse than
  a list. If you add controls to a part, put them in the right wedge rather than
  lengthening anything.
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
