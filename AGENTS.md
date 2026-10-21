# AGENTS.md — how to extend this template

This repository is a **UI foundation**, not a finished product. It is designed
so that a prompt-driven agent (Claude Code, Cursor, Codex, a custom script) can
turn it into almost any kind of website by adding *feature modules* on top of
a shell that already handles navigation, right-click menus, a command palette,
keyboard shortcuts, tactile feedback, audio cues, settings, theming, and
toasts that never repeat themselves.

Everything below is the contract. Follow it and the shell picks up your work
automatically. Break it and the site still runs, but it stops feeling good.

---
## 0. Start here

```
npm install
npm run dev            # http://localhost:3000, the Builder is at /builder
npm run typecheck      # tsc --noEmit
npm run build          # next build (must pass before you push)
npm run test:changed   # the tests your change reaches, plus the smoke set (§12)
npm run test:all       # the whole suite, before asking for a merge (§12)
```

What else to read, and when:

| File | Read it when |
|---|---|
| `docs/DESIGN.md` | Before changing anything a person sees in the Builder: the menu's design language, its rules, how the owner works. |
| `docs/BUILDER-HISTORY.md` | Before changing a Builder file. Not read every session: search it for the file, test or part id you are touching; the rule for that code, and why, is there. |
| `docs/MERGE-LOG.md` | When you are the one merging to trunk: what went out, and the merge rules. |
| `docs/ARCHITECTURE.md` | For the folder layout beyond §1. |
| `docs/PROMPTS.md` | When turning the template into a specific site. |
| `docs/PRODUCTION-LOOP.md` | Before changing how a model route is called (§11). |

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

**Modules.** The Builder's code is moving into modules, one folder each under
`src/features/studio/`, entered only by its doors (`index.ts`, and `ui.ts` for
screens). `states/` is the first; its README says what is where. Import a
module's doors, never a file behind them: `tests/module-doors.mjs` fails otherwise.

| Panel | Where | What it does |
|---|---|---|
| **Look** | left, toggle with `l` | Colour and texture. Six roles every part reads, a mixer, harmony generators, contrast readouts; every colour and face the parts actually use, by use, with swap-all; under it a stack of texture layers that compile to plain CSS, the page's fill at its foot. |
| **Parts drawer** | under the board | Three steps: category (emoji, own colour) → sub-group → the parts as live previews on contrasting discs. Search cuts across all of it. Prunable; drag or click to place. |
| **Design / Preview** | top left | One switch (`p`). Design shows the board; Preview puts the live site in exactly the same place, with the library and panels gone. Nothing moves under you. |
| **Board** | centre | A page frame (1440 / 834 / 390 wide) is the site's viewport. Parts land inside it at real size and draw what they'll be. Snap, resize, draw regions, connect with arrows, group, and prompt each one. |
| **Companion** | floating, draggable | The same page as a phone or tablet — never desktop, since the board is the desktop view. Tap a part in it to select that part on the board. |
| **Element / Format / Pages** | right | With nothing picked, the page's parts as a tree in page order; picked, the part's own panel (Content, Position and size, Look, Motion, prompt); Format as This site, Whole-site features and a folded brief; the page manager with the shared link's card. A site made here has Refresh and Publish beside Go live: Publish puts the board into its Go live repository as the builder-ready kit for a code chat, Refresh brings the chat's work back and makes it a site from code (`BuilderSiteButtons.tsx`). A picture is made on the Pictures tab, which draws for the picked part when there is one; a part's Make a picture keeps only where its picture is sent. Below 768 px the whole side panel is a sheet over the foot of the board, opened by the same toggle, and the bar's folded controls sit behind one More key (`tests/phone-builder.mjs`; `docs/shots/phone-builder-1-panel.png`, `phone-builder-2-element.png`, `phone-builder-3-more.png`, `phone-builder-4-preview.png`, `phone-builder-5-tour-looks.png`, `phone-builder-5-tour-wheel.png`). |
| **Blueprint** | Compile button | Everything as a self-describing brief, markdown or JSON; optionally handed to Claude. |

The old addresses `/studio` and `/studio/design` still open the Builder.
Internally the module keeps its original id — the folder is
`src/features/studio/` and right-click scopes are prefixed `studio-` — while
everything the user sees says Builder. Don't rename the internals for cosmetics.

```
src/features/studio/
  catalog.ts     231 parts in 12 categories, plain names, one f(...) line each;
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
  siteColours.ts every colour and face the parts use, by use (text, fills,
                 borders, shadows, accents), and swap-all; SiteColours.tsx
                 is the Look panel's "On this site" and "Fonts on this site",
                 the wheel's tray "All with this colour / in this font" is
                 the same call (docs/audit/palette-captured.md)
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
  PartTreePanel.tsx  the parts tree, the summary's lists, a part panel's sections
  partTree.ts    what holds what, in page order
  library/       the feature library: working code with no look of its own.
                 works.ts (manifests, scripts, the runtime publishing ships),
                 behaviours.ts (reveal, copy, tilt, follow, marquee, embed,
                 CRT loader, dust, header bar on scroll, blink, spin, float,
                 lift on hover, grow with the scroll: the same
                 shape, registered in LIBRARY; a part can carry several,
                 `work.also`, see usesOf/withWork; `off` switches one off),
                 captured.ts (a capture's `doc.behaviours` attached as
                 features on import, docs/CAPTURED-BEHAVIOURS.md),
                 read.ts (what the one box reads), badge.ts (where the ! goes),
                 contract.ts (TASKS.md, the feature contract in AGENTS.md /
                 CLAUDE.md and features/<id>/ written into every published
                 repo), roundTrip.ts + repoFeatures.ts (features/ folders read
                 back from the owner's own repos, offered for review; never
                 run), useLibrary.ts (accepted features, kept across sites)
  WorkShelf.tsx  the review card for features offered from a repository
  shelfGroups.ts where every shelf item sits: groups by purpose, in order
  shelfPlan.ts   near-copies as versions of one card, what was taken off,
                 and what the published page does with each id (badges)
  shelfTheme.ts  the colours a captured page paints most, by area, and
                 every preview pair held to 4.5 to 1
  partOptions.ts every part's editable fields as data (version, words,
                 link, options, colours, speed, feature inputs) by panel
                 section; PartFields.tsx is the small reader
  library/siteMotion.ts  what the export ships so whole-site motions,
                 folding rows, tabs and Copy work published
  library/siteVersions.ts a capture's effects as versions of shelf cards
  tour.ts        the "What's new" card: steps, when it shows, updates, and
                 the site's features a step can show (tourChoices);
                 parts/WhatsNew.tsx draws it (on the board open, live closed),
                 library/tour.ts is the feature that opens it, steps through
                 it and remembers each visitor's last update (localStorage);
                 TourEditor.tsx edits it in the Element panel. A step's
                 preview is the real part drawn again (LiveSite `PartCopy`,
                 `data-copy-of`), and the features runtime runs a part's
                 features on its copies too, except NOT_ON_COPIES
                 (tests/whats-new.mjs)
  SayBox.tsx     the one box on the pencil: type, it applies, "understood as …"
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
- **Nothing a part invents, and nothing about how the work is made, may
  reach a page a stranger reads.** Sample prose
  is how a layout reads on the board before anybody writes it; on a live or
  published page the same prose is the site talking in the owner's name about
  nothing, which is how his thesis went out as "Warm ledger clear orbit open
  ledger". Words nobody typed go through `unwritten(mode, …)` in
  `parts/sample.ts`, which keeps the sample on the board and says plainly,
  live, that the words are missing; `staticSite` then lists every part that
  had to say it. A wordmark with nothing typed for it is `t.siteName`, off
  the brief, never "Logo".
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
- **All 231 ids are real components.** There is no legacy path: `blocks.tsx`
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


**Everything else about the Builder is in `docs/BUILDER-HISTORY.md`.** It is
about three thousand lines, one entry per behaviour: bringing a repository or
a captured page in, healing a captured board, the wheel and the pencil, the
timeline, pictures and drawings, publishing, Go live and Export for code, the
kit's contract, and the rules each of those earned. It is not read every
session, so before changing a Builder file, search it for that file's name
and its test, and follow what the entry says.

---

## 2b-ii. Builds (`src/features/builds`)

The front door at `/`, and the answer to "where is the other thing I was
making". There was a landing page announcing a version and a changelog panel
behind it; both are gone, and nothing replaces the changelog — the commits
carry why a thing arrived.

- **One document is open; the rest wait beside it.** `builder.studio` stays
  the key the Builder reads and writes. Every project keeps its own copy at
  `builder.doc:<id>`, and `open(id)` is save → copy in → `swapDoc`, which
  puts the canvas and every panel on the new document without a reload.
- **The document lives in IndexedDB, with localStorage beside it**
  (`studio/docStore.ts`). localStorage holds about 5 MB and a captured site
  can be 8 MB, so the key's home is the `builder.docs` database; localStorage
  keeps a mirror of what fits (whole, or with its recorded paths packed,
  `from.selector` → `from.sel`, which `mergeDoc` unpacks) and a pointer with
  the site's shape for what does not. A whole document found in localStorage
  is read from there and carried across, synchronously, so a check may still
  seed the key and the owner's site from before survives; only a pointer, or
  the `#idb` flag beside the key, sends a read to IndexedDB. The builds store
  moves documents between the keys through it and waits for the write. Both stores are `skipHydration`, so something has to
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
- **A card leads with the site, not with its counts, as a picture.** The
  card used to draw the whole site live (`SitePreview`): with the owner's
  sites that was 30,890 page elements and 470 keyboard stops on one page.
  Now each site is drawn once, off screen, inert, down to the card's fold,
  turned into a small WebP (`builds/thumbs.tsx`: the markup and the page's
  styles in an SVG `foreignObject`, pictures inlined as data) and kept in
  IndexedDB with a signature of the document, so it is made again only when
  the site changes. The card's Preview opens the live render on demand in a
  dialog Escape closes. The name and the options bar sit under it, and the
  bar is pushed to the foot (`mt-auto`) so the bars line up across a row.
  `tests/builds-thumbs.mjs`.
- **Two sites never share a publish target** (`sharedTarget` in
  `builds/store.ts`). A target is a repository and a branch. The site that
  last published there keeps it (`published`, else `live`); every other
  site naming it has Update live site off with a sentence naming the keeper,
  flagged in the repository menu, the site switcher, the card and Builds,
  Repos. `setRepo` refuses a target another site holds, and a duplicate
  starts with none. Nothing changes a site's stored target on its own.
  `tests/shared-target.mjs`.
- **A publish carries every file its pages point at, and says which it could not**
  (`studio/siteRefs.ts`, run in `collectFiles`). Every page and sheet is
  read for what it references (src, srcset, poster, stylesheet and icon
  hrefs, share pictures, every `url(…)`); what the Builder serves itself
  from `public/` (the construct faces, the empty picture's crop) is copied
  in at the same path, and anything else nothing provides is a warning in
  the publish status with a plain list of files and the pages that use
  them; the publish still goes, so the owner is never kept from going live. Links between
  pages are addresses and are not held to it. `tests/site-refs.mjs`,
  `tests/publish-complete.mjs`.
- **Update live site shows one short list first** (`studio/publishCheck.ts`,
  `PublishCheck.tsx`): links that leave the site against Format's "Links off
  the site" rules (`parts/offsite.ts`), share links to choose about, pictures
  this browser no longer has, parts off
  the page at phone or tablet width (the preview's own `placeNodes` until
  Lane D's check lands; swap it in `readBoard`), and buttons that do nothing
  (`badge.ts` `decisions`). Each line has Fix (where there is one) and Show,
  and Publish anyway is always there: the list informs, it never holds a
  site back. A clean board publishes straight away. A new kind of problem is
  one more block in `checkBoard`, read by the check that already owns it.
  It runs before Go live, Publish (a site made here or from code) and the
  repo menu's Open a pull request (`checkThenPublish`); opened from the repo
  menu, Show also closes the menu. `tests/publish-check.mjs`,
  `tests/send-back-check.mjs`.
- **The launch kit** (`studio/launchKit.ts`, `LaunchKit.tsx`, the rocket key
  in the top bar in the Builder, and the palette) draws a share card
  (1200 by 630), an X banner (1500 by 500, the bottom left clear for the
  profile picture), the site icon at 16, 32, 48, 180, 192 and 512, and three
  meme templates with captions to type, on a canvas, from the site's own
  palette (`resolvePalette`), faces (the biggest words' face and the most
  used one, carried faces loaded first; else Format's heading and body
  fonts), name, line and logo (`siteLogo`). Each downloads as a named PNG.
  "Use on the published page" keeps the card and the icons as pictures and
  writes them into `brief.head` (image, icons, the large card), which the
  export already turns into og:image, twitter:image and icon links, and the
  publish already carries. Nothing is asked of a server. `tests/launch-kit.mjs`.
- **A publish is said in plain steps** (`studio/publishWords.ts`): Saving to
  GitHub…, Saved to GitHub ✓ waiting for Vercel…, Live ✓ with the time and
  the address. A failure is one sentence saying whether the change is saved
  and what to do (Vercel's daily limit with its reset time, the Builder's
  own server with its status code, a missing key, GitHub unreachable); what
  the provider said is behind "details". `tests/publish-status-line.mjs`,
  `tests/publish-words.mjs`.
- **Whether a site has changes not yet published is read off the site, not
  the document** (`builds/publishState.ts`, `builds/edits.ts`). The studio
  store tells `onBoardEdit` listeners when a person changes the board (a
  checkpoint, a typing run, undo, redo, a jump in the history; never the
  board settling itself), and the time is written on the site as
  `editedAt`. A push records the `editedAt` its pages were written from,
  with the commit's sha and page (`published`), and a READY deployment
  keeps Vercel's page for it (`live.inspectorUrl`), all from what the
  publish already answered. The card says "Changes not published yet: last
  change …, last publish …" and carries the two links; nothing on Builds
  opens a document or asks a route for it. `tests/builds-changes.mjs`.
- **A site goes to one file and back** (`studio/backup.ts`). Download a
  backup (the save line in the top bar, each card, ⌘K) writes
  `{ kind: "polio-board-backup", version, site, document, pictures }`:
  the document envelope exactly as the store persists it, and every
  picture's bytes found anywhere in it. Load a backup always makes a new
  site beside the others and never takes another site's publish target. A
  newer `version` is refused in words; bump it only when an older reader
  would misread the file, so a later server-side home can read the same
  files. Nothing from the Keys panel is ever in one. `tests/board-backup.mjs`.
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

A drawer, not a page: `T` (or the palette, or the status-bar count) opens it
on the right of the screen and leaves the board usable beside it; there is
no backdrop, and Escape closes it only from inside it. Narrow, it is one
column with Post, Preview and Tour as tabs; when the window leaves the board
420 pixels beside a 1040-wide drawer, the post sits beside its preview or
tour. The drafts and the log are behind its Drafts key. "Console size" in
its settings still offers the old whole screen. It drafts posts to X,
previews them, records a tour of the live site to go with them, queues them,
and sends them. `tests/tweet-console.mjs`.

- **Files.** `store.ts` is the document (drafts, the queue, the log), persisted
  to `builder.tweets`; pictures go to IndexedDB through `media.ts` and the
  draft keeps a thumbnail. `text.ts` counts the way X counts and cuts threads.
  `tour.ts` drives the preview iframe and records the tab, by the rules in `tourRules.ts`; `gif.ts` is a
  dependency-free GIF writer (median-cut palette, delta frames, LZW) used by
  both the server route and `gif-browser.ts`. `send.ts` is the three ways out
  (API, X's compose page, clipboard) and `preflight`, the list of reasons a
  draft cannot go yet. `index.ts` holds the manifest and the scheduler;
  `TweetConsole.tsx` is the surface.
- **Routes.** `/api/tweets/send` posts one post (multipart: `payload` JSON plus
  `media_k` files) through OAuth 1.0a with `X_API_KEY`, `X_API_SECRET`,
  `X_ACCESS_TOKEN`, `X_ACCESS_SECRET`; `/api/tweets/status` says whether they
  are there (never what they are); the tour is rendered by the studio's own
  `/api/studio/preview-video`, which takes the document with the request so
  the recording is of the site as built, runs a *full* Playwright
  (`PLAYWRIGHT_MODULE` to name one) and returns a GIF, or the WebM with an
  `x-tour-note` when it could not, and refuses with `no-video` on the
  serverless browser. (A copy of that route under `/api/tweets` never read
  the document and recorded an empty site; it is gone.)
  Without keys every route answers `ok: false` with a reason and the console
  falls back — Send opens X with the words. Keys are never load-bearing.
- **The queue is honest.** It runs only while the app is open (a tick every
  `tweets.tickSec`, and on visibility and `online`). A due post still goes
  out up to `tweets.sendWindowMin` late; later it is marked `missed` and
  offered again. Failures retry with `retryBackoffSec · 2^attempts` up to
  `retryAttempts`; a thread that half-posted is final, never retried, because
  a retry would post the first half again. Do not add a "background" mode
  that pretends otherwise.
- **The site in the Tour box is the real site, smaller** (`ScaledFrame` in
  `TweetConsole.tsx`). The iframe is the device's real screen
  (`tourRules.ts`, `VIEWPORT`: 1440 by 900, 834 by 1112, 390 by 844), the
  preview inside it is put in its Window view (laid out as the published
  page is), and the whole frame is scaled to fit. Squeezing the page into
  the box laid it out for a width nobody has. Only the app's own top bar,
  side bar and preview bar are hidden in the frame, by their marks
  (`data-app-topbar`, `data-app-sidebar`, `data-live-bar`); hiding every
  `header` and `footer` took the site's own off the page.
- **The tour works the site the way a person would** (`tour.ts`,
  `planSteps`): every tab of a strip (the one showing last), menus and rows
  that open, a chart swept with the pointer, copy buttons, a few of the
  page's own buttons, in page order, with a ring where each press lands.
  `refusal` keeps it off anything that connects a wallet, signs in, buys,
  sends a form or writes, and the frame cannot leave the page (links held,
  forms not sent, no window opens, the clipboard untouched). Nothing to
  press, it scrolls. It fits a clip length (`timing`: each press watched at
  least `DWELL_MIN_MS`, the last ones dropped when there are too many, the
  scroll given the rest, the end waited out) and stops at "Stop scrolling
  at". Preview tour plays it; Record has this browser record this tab
  (MP4 where it can, cut to the frame with Region Capture where it can) and
  stops at the clip length; the clip is checked against X's limits
  (`xRefuses`, said in words, Attach off until it is fixed, Make a GIF for
  a WebM). Render on server is offered only where the server can record,
  and keeps its own older scroll-and-press tour in
  `/api/studio/preview-video`. `tests/tweet-tour.mjs`.
- **A tour clip after each publish** (`afterPublish.ts`, "Make a tour clip
  after each publish", off by default, a switch on the Tour). A browser lets
  a page ask to record a tab only straight after a press, so `goLive.ts`
  says `studio:publish-start` inside the press and this asks then, once, and
  holds the recording; on `studio:went-live` it makes a draft "<site> is live:
  <address>", opens the console on its Tour (intent "clip"), records the tour
  with the held recording for the clip length the Tour is set to (the clip
  length and the stop are settings, so they are remembered), makes a WebM a
  GIF, and attaches it when X takes it, else says which limit in the log.
  `studio:publish-end` without going live lets the recording go and says so.
  The Builder knows nothing of who listens. `tests/tour-after-publish.mjs`.
- **Every surface has a scope**: drafts in the rail carry `tweet-draft`, whose
  menu does what the buttons do (send now, schedule, duplicate, copy, open in
  X, record a tour, delete with confirm). New actions go in both places.
- **Settings** live under the `tweets` group, ids `tweets.<name>`; anything a
  first-time user should not meet is `advanced: true`. Each one is read in the
  console and the console says, next to the control it affects, what it is
  doing.

---

## 3. Toasts: never repeat yourself

`ctx.publish(input)` is the only way to tell the user something happened. The
rule that makes it feel right:

> **Same `key` → same card.** A second publish with the same key while its
> toast is still up updates that card in place (body replaced, `×N` count,
> `diff.from` kept from the *original*). Identical content is suppressed
> entirely. If a value reverts to where it started while the card is up, the
> card goes with it.

**Nothing is kept.** There was a notification centre here — a bell, an unread
count, a panel of everything ever published — and it was removed on the
owner's word: buggy, and nobody read it. So a publish with no `toast` says
nothing at all. If the user should know, say `toast: true`; if they should be
able to go somewhere, give it an `href` and the card's title becomes the
link.

Key conventions:

| Event                              | Key                               |
|------------------------------------|-----------------------------------|
| A setting changed                  | `setting:<setting id>` (automatic)|
| An entity's field changed          | `<module>:<field>:<entity id>`    |
| An action on an entity             | `<module>:<verb>:<entity id>`     |
| A module-wide status               | `<module>:<status>`               |

Use `diff: { from, to, format }` for value changes so the card reads
"Slippage 1% → 3%". Use `coalesceMs: Infinity` for settings-like state. Set
`sound: false` when the caller already played a cue.

Per-source rate limiting (30/s) protects the corner from runaway streams, and
costs its slot whether or not the publish asked for a card.

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

Radius is a token too (`--radius`). There is no density mode: compact
against comfortable moved the body's font size by one pixel and nothing
else, so it was removed rather than kept as a control that does nothing.

**The four sizes the Builder is written in are tokens** (`--text-fine`
0.5625rem, `--text-small` 0.625rem, `--text-plain` 0.6875rem,
`--text-large` 0.75rem — 9, 10, 11 and 12px at the default scale), used as
`text-fine`, `text-small`, `text-plain`, `text-large`. **In rem, so Font
scale reaches them**: `html` takes `font-size: calc(100% * var(--font-scale))`,
so a px size is one that setting cannot touch, and the Builder's own chrome
was 578 of them. Each fraction is exact in binary, so at scale 1 they are
exactly the pixel counts they replaced; at the ends of the slider they run
7.65 to 11.25px (85%) and 11.25 to 15px (125%). They were 578
arbitrary values across 66 files, which is not a scale, it is one decision
taken 578 times. Use a name; do not write `text-[10px]` in a component.
Two things go with them:

- **A new named size must be declared in `src/core/lib/cn.ts` as well.**
  `tailwind-merge` knows Tailwind's own scale and nothing else, so it reads
  an unknown `text-*` name as a text COLOUR and drops the size as a
  duplicate wherever a component sets both in one `cn` call. The text then
  inherits 13px silently. `tests/type-scale.mjs` holds it, in both merge
  orders, and measures the four on screen.
- **`src/features/studio/parts/` keeps its arbitrary values on purpose.**
  A part is what the exported site is made of, and the export writes its own
  stylesheet from the document's tokens rather than shipping this one, so a
  name that stylesheet has never heard of is a size that goes missing in
  somebody's built site.

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
  module folder is the pattern (see `studio/board/store.ts`).
- Don't put feature logic in `site.config.ts` or `src/core/`.
- Don't hard-code shortcut labels in UI; pass `shortcut="mod+k"` and `Kbd`
  formats it per platform.

---

## 11. Keys, and the top bar

- **A module can put a control in the top bar.** `topBarItems: [{ id, order,
  component }]` on a feature module. The bar renders
  whatever is registered and imports no feature; anything that has to live up
  there arrives this way. `keys` contributes the key, `studio` the GitHub mark.
  An item that acts on the open site names its pages, `routes: ["/builder",
  "/builder/*"]`, and the bar leaves it off everywhere else: on Builds the
  bar never shows the last site's Publish or live link. No `routes`, every
  page.
- **Keys are read on the server and never prefixed for the browser.**
  `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `GITHUB_TOKEN`, `VERCEL_TOKEN`,
  the four `X_*`, `VERCEL_DEPLOY_HOOK`: read in route handlers, never
  returned. `/api/keys/status` answers only which names are set, plus the
  repository name, which is not a secret. Anything added there must pass the
  same test: a name and a yes or no.
- **A key the person is billed or credited for is held in their browser.**
  Claude, Replicate, GitHub and Vercel, each riding to its own route as its
  own header (`x-anthropic-key`, `x-replicate-key`, `x-github-token`,
  `x-vercel-token`) and never to any other, because a route with no use for a
  key should never be handed one. The environment variable of the same name
  stays as a silent fallback: every route picks through `keyFor`
  (`src/app/api/keyFor.ts`), the browser's key first, the server's when the
  browser offers none. This file used to say a GitHub token in a
  browser would do nothing; that was wrong, and Publish now pushes with the
  person's own. Adding a
  service to `SERVICES` means adding a header a route reads (with its
  variable in `KEY_ENV`, `keyFor.ts`) and an arm to
  `/api/keys/test`, which asks each service the smallest question it answers
  — one answer per service, never one standing in for another.
- **Nothing writes a key down in the clear. Ever, under any name.** One
  entry, `builder.keys`, always a sealed box: under this browser's own
  non-extractable key when there is no PIN (`keyring.ts`), under the PIN when
  there is one (`crypto.ts`). The tab's own record in sessionStorage is
  sealed the same way, and where a browser can seal nothing it writes
  nothing. There was a second entry, `builder.keys.plain`, keeping a readable
  copy so a reload did not lose the key — which made the sealed one pointless
  while it existed; it is read, folded in and deleted on the next load. If a
  caller ever cannot read the sealed one, fix that caller. Do not add a
  readable copy for its convenience. `tests/no-plain-key.mjs` searches every
  name and value in both stores for a pasted key rather than checking the
  entry it expects. Say what the browser's key is worth in the same breath as
  claiming it: real against anything that reads the disk, worth nothing
  against code running on the page.
- **The keys panel is the fallback, not the pattern.** `src/features/keys` holds
  the key in this browser, open on arrival and across reloads and tabs, with
  one way out: **Forget the key**, which takes the entry and the wrapping key
  with it. There is no PIN on the way in. Four digits was a speed bump in front of something
  anything running on the page could read the moment it was unlocked, and it cost
  an unattended run every five minutes and every reload. The panel says
  plainly what holding a key here means and that the server is where a key
  belongs — do not restyle that warning away. The sealed keys is still
  there behind **Seal the key under a PIN** (`keys.pin`, off, advanced):
  PBKDF2 at 310,000 rounds into an AES-GCM box, only the box stored, never
  the PIN or a hash of it, with the tab-held and kept-for-this-tab modes
  beside it. A key sealed before the setting existed is brought across by
  typing the PIN once in the panel; a key held for the tab comes across on
  its own. A held key is sent as a header and used for that one call,
  before the server's (`keyFor`).
- **Never widen what a status route says.** A length, a prefix, a first
  character: each narrows a guess. Name and boolean, nothing else.
- **Undo names its step, and the steps are a list** (`HistoryControls.tsx`,
  `historyNames.ts`). A step is named by comparing the two documents either
  side of it, never by the action that took the checkpoint, so every kind
  of edit has a name without saying one: "Undo: move COPY CA". The list
  beside the keys shows the last fifty, newest first; a press goes there in
  one change of state (`travel`), not fifty undos. A new kind of edit that
  reads as "an edit" wants a line in `stepName`. `tests/undo-history.mjs`.
  A step that changes more than the document keeps those fields beside it
  (`Step.aside`, `history.ts#stepTo`): a bring-in's frame width, learned
  record, stand-in, sweep mark, states and shelf come back with its undo,
  and no other step touches them (`tests/undo-bring-in.mjs`).
- **The save line** (`SaveLine.tsx`, a `status` item in the top bar, only in
  the Builder) says "Saved in this browser, 12:04" off `docStore.ts`'s
  `onSave`, never "Saving…" on every edit, and red when the browser would
  not keep it. It opens the backups, and once per site that was never
  backed up or published it opens by itself after ten edits (`nudged`).
  **A tab never saves over another tab's newer work**: every saved document
  carries the stamp of the tab that wrote it (`docStore.ts`), and a tab
  behind another's save writes nothing. With nothing of its own unsaved it
  takes the newer work; otherwise the line goes red and a bubble asks for
  the newer work or this tab's, or, when the other tab opened a different
  site, a reload (`board/store/load.ts`, "Another tab"; `tests/two-tabs.mjs`).
- **One molten surface, not two reds that nearly match**
  (`src/core/ui/molten.css`, handle in `src/core/ui/molten.ts`). Glowing
  constructs — the timeline's iteration boxes, the element cards — are one
  language, and it is defined in that file and nowhere else. It holds the
  five stops (`--molten-white`, `-hot`, `-body`, `-deep`, `-char`, and the
  `--ember-*` set for the hotter temperature), the five keyframes
  (`molten-drift`, `molten-churn`, `molten-breathe`, `molten-flare`,
  `molten-ember`) and the two classes. **Nothing else may declare a
  `--molten-*` property or a `molten-*` keyframe**: import `moltenClass` and
  `moltenSeed` and use what is there, or add a stop to that file. Two
  branches render these, so a second definition is not a variation, it is a
  bug. **The palette is seven stops, and their relationship is the
  agreement** — taken from a photograph of green enamel under a bright edge,
  not from any one value: `char`/`field` is the field and most of a construct
  is this, very dark and low in colour; `body`/`lit` is the lit body, seen in
  a few places rather than across the face; `edge`/`edge-hot` is the edge
  only, the brightest thing there is, and it turns toward yellow as it
  lightens; `vein` is fine bright filaments at low coverage. The green must
  never wash out to pale. The red side is the same structure at a red hue.
  **Nothing plays**: two keyframes, both minutes long and travelling two per
  cent, so a construct looks the same whenever you glance at it. **Which temperature means what is part of the agreement**: `verdant`
  is an iteration (the timeline's boards, and the Finish key that opens
  them), `ember` is a drawing and anything that came off one, `lantern` is
  the base set. Green holds, red was drawn. A construct that is green on one
  branch and red on the other is worse than either colour. A construct is `<div className={moltenClass(kind)} style={moltenSeed(id)}>`
  with one `<span data-molten="" />` inside it carrying the edge, the flare
  and the ember. `tests/molten.mjs` holds the whole of it, including that
  no other file declares one.
- **What has landed is read, not written, and current on its own**
  (`/api/updates`, `studio/landed.ts`). There is no changelog file and there
  will not be one. The Updates slide over asks `/api/updates` when it opens:
  GitHub's commits API from the very commit the deployment was built from
  (`VERCEL_GIT_COMMIT_SHA`, repository from `VERCEL_GIT_REPO_OWNER`/`SLUG`),
  so the list is exactly what is live whatever depth Vercel cloned at; a
  list for one commit is kept for the function's life and cached ten
  minutes at the edge. Where GitHub cannot answer it reads `git log`, and
  last the checked-in snapshot `passes.generated.ts` (`npm run passes`),
  saying which it used. One plain line per change, newest first, on a card
  per day (the timeline's `Row`), with the live version and build time on top; merges, a check
  committed red, repeats and lines about the making (`aboutTheSite`) are
  left out. `tests/updates-current.mjs`.
- **Ask the deployment, not a dev server** (`tests/deploy-check.mjs`, `npm run
  check:deploy`). Every other suite here talks to localhost, which is how a
  cube drawn on the live site did nothing: the work had never reached trunk
  and nothing said so. This one fetches the real URL, follows no redirect,
  and puts the commit the deployment is serving next to trunk's head in one
  line — stale, unmerged, or current. `/api/version` is what makes that
  answerable, and it may carry a commit, a branch, an environment and a build
  time and **nothing else**: it is public, so the rule for
  `/api/keys/status` applies to it.
  Then it opens the Builder and asks, **by visibility and never by
  existence**, for the things that have each broken at least once: the bar and
  every control in it, the category shelf, both searches, a side panel, the
  nebula, the Finish key, the Keys panel naming Claude and Replicate, and the
  cube findable by typing "cube" the way a person would. Anything absent names
  itself. It writes `docs/DEPLOY-CHECK.md` so there is a record rather than a
  scroll, and `.github/workflows/deploy-check.yml` runs it after every trunk
  push once the deployment is actually serving that commit.
  Two things to know before reading a red one. A failure part-way through the
  browser half is reported as a failure — an earlier draft only spoke up when
  the page never opened, which would have let the Builder's checks go missing
  under a green summary, which is this file's own bug in miniature. And an
  agent container behind an egress proxy cannot open the page at all: the HTTP
  rows still answer, the Builder's rows are absent rather than failed, and the
  record says so.
- **What the loop actually spends is written down**, in
  `docs/PRODUCTION-LOOP.md`: every call from a drawn line to a finished
  element, in order, with the model each one goes to, what is sent, what
  comes back, how the loop decides to go again, where the key comes from at
  each step, and what one element and one site cost. The payload sizes there
  are measured, not guessed, and the page says how to measure them again.
  Read it before changing anything about how a route is called. Two things it
  says that are easy to get backwards: the Claude half is **output-bound**, so
  moving a payload around is worth about a tenth of what changing the number
  of goes is worth; and the Replicate half is **flat per press**, so there the
  only lever is how many rungs of the ladder are climbed.

---

## 12. Running the tests

`npm run test:all` runs every file in `tests/`, each on the server its own
header asks for (`scripts/test-all.mjs` says how it reads them). A run is
three phases: a parallel batch, longest first by the times the last runs
took (`scripts/test-timings.json`, then the untracked `.test-timings.json`);
anything that failed in the batch run again alone, and reported **flaky** if
it passes then; and last, one at a time, the tests whose header has a line
`Runs alone: <why>`. Tag a test that way when it measures time, frames or
motion and a busy machine changes what it measures, never to hide a
failure: its checks stay as they are and its result alone is the result.
The run ends with a summary: passed, failed, flaky, timed out, skipped, the
phases' times and the slowest ten.

`npm run test:changed` (`--changed [ref]`) runs only the tests that touch a
file changed since the ref (default: where the branch left trunk), picked by
path, import path or name, plus a header line `Covers: path, path` for files
a test exercises without naming them, and the smoke set (`SMOKE` in the
script), which always runs. Run it while working; run the whole suite before
asking for a merge.

## 13. More than one session works this repository

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
