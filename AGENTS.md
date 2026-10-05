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

**A repository can be connected, and its website lands as parts.** His
words: "connecting an existing repo website and the subsequent website
popping into my design board 1:1, and with a new category specifically for
the elements this repo imports". 1:1 means every block of the page arrives
as a real, editable part of this library at the position, size, words,
colours and type the page actually had — measured in a browser, never
described to a model. `repoImport.ts` is the pure half: the address
somebody typed, which files a browser would ask for, which of them is the
page (it asks `pageEntry`, so it cannot disagree with the route), the
category a repository gets, and a stored-zip writer. `repoRun.ts` is the
browser half: the tree and the blobs are fetched **by his browser with his
own token** — the zipball redirects to codeload, which sends no CORS
headers, and a token must never reach our server — packed here and handed
to the zip route that already exists, so a private repository works like a
public one and no new server capability was added. Its elements are kept
as **presets** (`FeatureDef.basedOn` + `preset`) in a category of their
own: `store.shelve` hands them to the catalogue, `getFeature` and
`searchFeatures` see one library rather than two, and `addNode` unfolds a
preset into an ordinary node, so the shelf, the wheel, search and "add
here" all work without knowing where a part came from. A repository with
no page in it to open says so and names what it found.

**A box on a page is a box.** His captured page landed 126 parts, and 75
of them — every wrapper with no words of its own: the header, a row, a
column, a card — were the Idea part, so each wore a dashed edge, an IDEA
label and a "header · 1 inside" line over his content. `box` (`PlainBox`,
Layout › Page shape) draws nothing of its own: its colour through `Fill`,
its edge, padding and layout from the node's box fields (below), and the
words typed into it, plainly. Nothing typed, nothing drawn — no edge, no
name, no count. The shelf gives it a line so the tile is not a blank disc.
`tests/plain-box.mjs` counts the words and the colours inside it, beside an
Idea part that still says what it is.

**A box carries its layout, its padding, its edge and how its words are
set, and the reflow keeps a laid-out box's children inside it.** The ledger
of his captured page — display 37, direction 37, align 33, pad 29, gap 19,
justify 15, border 13 — all went "nowhere: a node has no layout field".
`StudioNode` has four optional fields now, typed beside `NodeFont` in
`parts/theme.ts` so the parts folder still ships whole: `layout` (display,
direction, align, justify, gap, wrap, columns), `pad` (four sides), `edge`
(width, style, a colour or a palette role) and `text` (align, transform).
Margin and icon path geometry stay out: a box already stands where its
margin put it. `Block` puts them round the part as one `[data-part-box]`
wrapper, and only when a node says something, so a node that says nothing
gets the part alone and nothing already on a board moves; `applyText` sets
the theme's align so a part that reads `t.textAlign` follows it. Board,
pinned preview, full preview and Build all draw through `Block`, so they
agree. The blueprint writes them as one `box:` line. In the live page the
arithmetic of `placeNodes` moved to `live/reflow.ts`, pure, so
`tests/reflow-same.mjs` can hold it against the trunk algorithm written out
verbatim (BLACKORB at every device, two hundred random boards): a part
whose layout says flex or grid is a container, the parts its box holds are
placed inside its placed box, squeezed across with it, a wrapping row
wraps and grows past `WRAP_AT`, and what follows moves down — where before
every part at tablet or phone was stacked into one column and his header,
his strip of cards and his footer came out as a pile. `tests/box-fields.mjs`
measures the board and Preview at Tablet off a page shaped like his.

**Choosing a repository is what brings it in, and there is a way in.** He
made a fresh site on the Builds page, typed a repository into its Repos field
and pressed the button: it bound where Publish pushes and imported nothing,
the site stayed empty, and searching the palette for "import" and for "site"
found neither. "Attaching is importing" HAD shipped — inside `GithubButton`'s
own panel, whose list runs the import — but it never reached the Builds page's
separate repository field, and `GithubButton` returns null outright when a
site has neither a repository nor a token (`if (!url && !canPush) return
null`), so on a fresh site there was no door on screen anywhere. Nothing undid
it: it landed in one place and the place he used was an older control.
His ruling: typing an exact name is the wrong shape — choose from the
repositories he has, from inside the Builder, and choosing is what brings it
in. `RepoPicker` lists `/api/studio/repo` (the same list the GitHub panel
shows) and every press goes through `bringRepoIn` in `bringRepo.ts`, the one
door that holds the whole decision — stale build, is it a repository, is this
site bound elsewhere, is there a token, then place it or keep it and open the
board. `GithubButton` delegates to the same function; an importer is the worst
thing in this repository to have two of. The control lives in the Builder's
BAR, not above the board: a row above the board moves the board, which is the
one thing the Builder promises not to do, and it moved a drawn space out from
under `repo-lands`, which draws by coordinate. The Builds page's button now
reads "Publish here" and its labels say publishing, because the two are
different actions and one of them was pretending to be the other.
`tests/bring-repo-door.mjs` holds it, and reports a missing file as a failed
check rather than a stack trace so it can be run red against a tree without
the picker.

**One repo menu, two sections.** Later the owner found two places doing
overlapping things (the picker sheet, and the GitHub button's own panel with
"The repo this site goes to", "Bring in one of your repos", "Make a new repo"
and a typed "Bring a repo in"), and a branch or a `sites/<name>` folder had to
be typed as `owner/sink@branch/sites/name`. They are one menu now,
`RepoPicker.tsx`, mounted once in the top bar (`RepoMenuHost`) and opened by
every way in through `openRepoPicker()`: the board's door, the GitHub button,
the new site's offer and the palette. **Bring in**: pick a repo and it opens
out to its branches (default chosen) and its `sites/` folders, from
`/api/studio/repo/choices`; the typed owner/name field stays as a fallback.
Bringing into a site with parts asks, offering a new site for it. **Publish
to**: one of his repos or a new one by name, with a branch. The locks are the
same. `tests/repo-menu.mjs` holds it.

**A brought-in HTML page comes in element by element, and its sibling pages
as pages.** PST's test page (plain HTML, no styles of its own, its screens
filled in by scripts) came in through Bring it in as seven "bands of words":
the reading was by block (`CANDIDATES` picks a few big boxes, `MEASURE` reads
each whole, `recreate.ts` makes each one part), so every section folded into
one part, its headings into its paragraphs, its buttons and fields were lost,
and a hidden panel read as a tall blank box (Balance, 1422x563). A page read
from a repository's files now goes through `PARTS` (`siteRead.ts`): each
heading, paragraph, line, list item, button, link, field (input, textarea,
select with its options), checkbox with its label and picture is a part of
its own, under a box for the section it sits in (owned by path, as a
capture's are), at the box, words, ink and type the browser computed. A page
with no styles of its own keeps the browser's defaults that way (h1 32px
bold, a button's grey face and edge, bullets, margins). Every part keeps its
id and data-* attributes (`node.hooks`): the published page writes them on a
field's or checkbox's real input (`parts/PageControls.tsx`), else on the
part's box, and a value written into a sentence keeps its hook on its run
(`Span.hooks`; `alike` will not fold it away). Hidden at load (the hidden
attribute, display none, a template) is read in place for a moment and
hidden again, and lands as a hidden part (`node.state`), never a gap; an
empty element with a hook lands as an empty box (a slot the code fills). The
zip route's `parts` mode reads the entry and each other HTML page beside or
under it (up to twelve); `pageParts.ts` makes them one document, Home first,
a link to a sibling file going to its page, and lands it as a capture lands
(`landAsBrought`, without the sweep: its sentence joining is for a capture's
fragments). The report (`reportSays`) is counts of what landed, by kind and
page, hidden, hooked, unstyled, scripts not run, pictures not carried. A page
`PARTS` finds nothing in falls back to the reading by blocks.
`tests/plain-page.mjs` holds it on a PST-shaped fixture.

**The design goes back to the code as a style layer, never a fresh page.**
The owner's ruling for a site brought in from a code repository (PonsStars):
it is redesigned on the board and goes back as a layer over its existing code,
because a fresh page drops the scripts. At import the zip route reads each
page's source (`sourceHooks.ts`): every `data-hook` and `id` with its line,
and every CSS variable its styles define; each part keeps `node.source` (file,
line, hook, whether its words are static, and its look as it came in), and the
site keeps `look.styleSource` (repository, branch, folder, the inventory).
`styleLayer.ts` writes CSS keyed by `[data-hook="…"]` / `#id` with only what
the owner changed (colours, type, spacing, edges, shadow, rounding; size and
offset only for a part he moved or resized himself, `byHand`, so the board's
own tidying writes nothing), sets a source CSS variable where he set it or
where every part wearing its colour now wears one other, changes words only
where the HTML holds them as plain text written once, and never writes
`display`, `visibility` or `content`. The hook check says, for every source
hook, covered, untouched or missing (deleted, or renamed on the board: the
layer keeps the code's name), in words. `styleLayerRun.ts` reads the pages
fresh, adds one `<link>` per page, refuses any change that would lose a hook,
and commits in his browser with his token to a new `style/<site>-<date>`
branch (never the default or the branch it was read from), handing back the
compare link so he merges it himself. The repo menu's "Send the design back"
section (`StyleLayerPanel.tsx`) shows the counts and warnings; the part panel
shows each part's hook, file and line, linked. The regular export is
unchanged. `tests/style-layer.mjs` runs the original page plus the layer with
its scripts (a practice-style flow) and checks every hook and the look.

**Every part keeps its tie to the code it came from, read only.** The owner:
"i need all the code imported properly associated with the elements in the
builder too". Bring it in also reads the repository's scripts beside the page
(and a `hooks.json` if it keeps one), as text, never into the zip
(`repoRun.ts`). Each part's `source.code` holds its markup (file and line), the
CSS rules that style it (matched in the browser, and rules naming its hook, id
or class for its other states, each with file and line), and every script
reference (`codeRefs.ts`): file, line, the function it is in (an anonymous
handler is "the click handler on deposit-review"), and what it does in plain
words (listens, builds, writes, shows or hides, styles, reads, finds), found
from `hooks.json` where it lists a hook and by reading the scripts otherwise
(the hook's name as a string, an id where ids are looked up, a class where
classes are, a variable a hook was put in followed down its function, a hook
handed to a helper like `setText`). A part its code fills at run time is
marked so, naming the function that fills it, and its words are never treated
as static by the style layer. The part panel's Code section shows all of it,
linked to the line on GitHub, with nothing to type into.

**A builder-ready repository goes both ways by the kit's contract.** The kit
(kit/, copied from PST; kit/FROM.md) is the contract between the Builder and
the code chats (kit/PIPELINE.md). Four pieces hold it here. Export for code
(`exportForCode.ts`, `kitExport.ts`, the command "Export for code"): the
regular export rewritten into the kit's layout, looking the same: every
element hooked, inline styles and style blocks into `base.css` keyed by hook,
`.x`/`#x` selectors written `[class~="x"]`/`[id="x"]`, every colour a token in
`tokens.css`, an empty `style-layer.css`, `builder.json` with a screen per
page and the site's link rules, the kit's tools, docs and CI, and `hooks.json`
made by the kit's own check on the server (`/api/studio/kit-map`, `kitMap.ts`),
which must pass. Send the design back: always from and into the repository's
default branch, a new `style/` branch and a pull request, never merged here;
for a repository with `builder.json` only `style-layer.css` (rules by
data-hook, colours in custom properties, earlier rounds kept) and the remade
`hooks.json` change, so `kit:diff --style-only` passes, and words stay the
code's. Each round first reads the code again (`kitRun.ts readRound`, on the
panel's opening): pages, hooks and tokens added or gone since import
(`styleSource.seen`), and the design's rules for hooks no page has now.
Link rules: a kit repository's `links` become the site's link list
(`kitLinksToOffsite`, `!re:` lines), and the export writes the list back
(`offsiteToKitLinks`). `tests/kit-round-trip.mjs` runs the starter round
trip against a real git repository; `tests/export-for-code.mjs` holds the
export on the sink's site. After changing kit/, run `npm run kit:files`.

**Export for code to a branch keeps every hook the site came in with.** The
command "Export for code to a branch of its repo" (`designBranch.ts`) writes
the same export under `design/` on a new `design/<site>-<date>` branch of the
repository the site came from, never its default branch, and opens a draft
pull request with `design/HOOK-CHANGES.md`: hooks moved, added, removed. A
hook it came in with (`styleSource.onBoard`, recorded at import: parts, words
and a list's choices, `options.choiceHooks`) is written exactly as it was,
and a `template-` part goes out as a `<template>` again. A part made here
gets a hook from its name (`chart-main`, never an id) and is listed as new.
A move is measured from where he first took the part in hand
(`StudioNode.handFrom`), so the board's own tidying is not his.
`tests/export-to-branch.mjs` holds it, on PST when given a checkout.

**A page's hidden states are designed on the board, and stay hidden on the
page.** Parts a page starts hidden come in as state groups
(`hidden:<hook>`). The States control on the page strip (`StatesChip`,
`boardStates.ts`) switches groups, or the repository's preview screens, on
for the board alone (`statesOn`); a screen shows exactly the hooks it showed
when the repository's own code built it, read at import in the background
(`/api/studio/zip` with `screens`, kept as `styleSource.screens`; the only
place a repository's scripts run, with nothing reachable but its own files).
Picking a hidden part switches its group on. The parts keep their state, so
the export and Go live still open hidden; a move or size made with a state on
is a rule under the part's hook in the style layer. `tests/board-states.mjs`
holds it, on PST when given a checkout, else on the kit's starter.

**A part's scripts are read here and changed by a code chat, never edited in
the Builder.** The part panel's code view has three pieces for a repo site:
"Show the code" (`ScriptLines`) fetches each referenced file at the commit
the site came from and shows the lines around each use, read only, linked to
GitHub; "Settings its code uses" (`PartSettings`, `styleLayer.ts#partTokens`)
lists the tokens the part's styles use and the ones its scripts read in the
same functions, edited as the style layer edits tokens (`varsSet`), so they go
back as token changes; and "Ask the code chat" (`askCode.ts`) writes the
request, the hook, its code refs and a picture of the part
(`/api/studio/screenshot` with `hook`) to a new `request/<hook>-<date>`
branch with a draft pull request. `tests/code-view.mjs` holds all three.

**A big site exports in small pieces, and says each step.** Export for code
to a branch asks GitHub for the repository first (a key it refuses, 401, is
said at once), pulls pictures written inside pages and stylesheets into
files of their own (`kitExport.ts#pullPictures`), sends the kit's check its
files gzipped (`kitRun.ts#kitMapOnServer`, ungzipped with a cap in
`/api/studio/kit-map`; the host refuses a body over 4.5 MB with 413), sends
each file to GitHub as its own blob, except a file the repository already
has (git's own name for its bytes, `designBranch.ts#gitBlobSha`), which is
pointed at and never sent again, and shows every step on one card.

**Every design that goes back carries its design record.** Export for code
to a branch and Send the design back both write `design/record.json`
(`designRecord.ts`, `exportForCode.ts#boardRecord`), in the format PST's
`kit/DESIGN-RECORD.md` defines: the capture record's shape, each part with
its hook, name, the part it sits in (hooks.json's parents, else the board's
containment), hidden states and which values are the site's tokens. The
capturer writes each part's `hook` too (`capture/site/capture/dump.mjs`), so a
look-only capture of a build is checked against the record with the kit's
`tools/record-diff.mjs`. `tests/export-to-branch.mjs` holds it, on PST's Chart
TV when given a checkout.

**A kit repository comes in by its builder.json; its hooks map and tokens are
read as the kit writes them.** The contract is PST's `kit/BUILDER-CONTRACT.md`.
`builder.json` (`builderManifest.ts`) carries `kit`, `name`, `pages`
(`{file, title}`), `hooks`, `tokens`, `styleLayer`, `preview` (`page`, `query`,
`screens: [{name, page}]`), `gallery`, `scripts` (`hookCalls`, `helperFiles`),
`links` (`allowHosts`, `block`) and `tokensModule`, every path relative to the
manifest itself. Bring it in reads it first, ahead of a document made here or a
page found by name: its pages in its order and by their titles (the zip route's
`entry` and `pages`), parts named by their data-hook, the code view from the
hooks file it names (PST's is `web/builder-hooks.json`), its tokens as
variables, and the style layer written to its `styleLayer`; the preview screens
and gallery are named in the import line, not brought in. Without one,
everything is found as before. The hooks map is read in both shapes
(`codeRefs.ts#readHooksJson`): the kit's (`kit` set; references with `uses`,
paths from builder.json's folder; `tokens` per hook and as the top-level map)
and PST's older `web/hooks.json` (`actions`, paths from its own folder,
`cssVariables`). "(top level)" and "anonymous" are no function; stylesheets
listed among a hook's references are shown as CSS rules; a hook the map does
not list falls back to the scan, which also reads the contract's
`// hooks: nav-{home,about}` comments. Where the map calls a line a read and
the line itself writes, shows or styles (PST's map calls `setText(...)` a read),
the line's own reading is used, so a part its code writes is marked filled by
code. Variables from the tokens file (linked, `@import`ed, or named by the
manifest) are tokens: the style layer lists them all, lets any be set (a size or
a face as well as a colour; a face follows the board like a colour does),
writes them under `:root:root` so they win wherever the tokens file sits, and
never edits the tokens file. A style layer already there that the Builder did
not write is said before it is replaced. `tests/code-view.mjs` holds it on a
kit-shaped fixture and on a copy of the kit's own starter (`tests/fixtures/kit-starter`,
with its real builder.json and hooks.json) and PST's root builder.json.

**Every hook on a kit page reaches the board.** An inline `<svg>` comes in as a
picture part (tag names inside svg are lower case: test with
`tagName.toUpperCase()`), and each hooked or id'd shape inside it as its own
`shape` part: fill reads as the background, stroke as the border, a circle or
ellipse is round; its style layer rules are written as `fill`/`stroke`
(`svgDeclarations`). A hooked `<body>` is a section at the top, a hooked label
round a field is a section around the check, a picture inside a button is a
picture part after it, a `<template>` is a section, and a list's `<option>`
hooks are carried by the list (`inner`): the hook check counts all of them as
untouched, never missing. `tests/style-layer.mjs` holds it on PST's duel circles.

**A box displaces only what it actually stands under.** The healing above
cleared every overlap on his Documentation page and left it full of holes:
1763x2403 became 1763x5323, sixteen gaps over 60px totalling 2876px — almost
exactly the height gained — and of the twelve widest, twelve had no horizontal
span in common between the pair above and below. A 45px flame at x603-633 was
pushing "Seamless Token Swapping" at x1309-1457 down by 493px. Zero crossings
was true and it was not the result: his standing rule is that a capture stays
true to its size and its ratios, and doubling the page height breaks that more
visibly than the overlap did. The cause was ONE RUNNING TOTAL: rows were taken
in order down the page and every growth, and every overlap prised apart, was
added to a single `shift` that every later row then took, whatever column it
was in. The floor asked the right question — what does this stand under — and
the answer was applied to everything below it. The growth path had the same
fault and had carried it since the first commit. So there is no running total:
`fitRows` places each box against the boxes it actually stands under (above
it, sharing some of its width, neither holding the other), keeping the gap the
capture recorded and clamping it at zero so a pair saved into each other is
laid apart. Two boxes in different columns share no span and can never
displace each other. This REPLACES the row banding rather than restoring it —
rows were never the right unit, only a cheap stand-in for "what is above me",
and they are why a stored overlap was invisible. Three cards side by side
still push the page down once, now for a reason: what sits under all three is
placed against each and keeps the largest answer. Measured the way he measures
it, in `tests/grew-moves.mjs`: on a three-column page at his own x-spans,
nothing outside the body column moves and healing opens no empty space inside
any column. Counting gaps between parts consecutive by top edge is NOT safe
there — when one column moves, the sequence reorders and pairs that were never
adjacent get named — so emptiness is measured down each column instead.

**An old board heals itself on load, and a box he moved is his.** Two things
were wrong with the healing above. Its gate was `from` — the live element a
part was recreated from — and `from` is written on ONE import door
(`FromASite`), so every board that arrived by another one looked hand-placed
and was never healed at all. And it only ever repaired an overlap that GROWTH
had created: an overlap already written into the document — a capture that
recorded a box and the one under it into each other, or heights an older
one-shot tidy left — was invisible, because neither box was drawing taller
than it was saved and `toRows` bands two boxes lying on each other into one
row, where every member takes the same shift and nothing moves apart. That is
what survived on his Documentation page after the rest healed. He ruled
against re-importing to fix it: a re-import throws away everything he has
changed since, and he would hit it again after every landed fix.

So the question is asked the other way round. `StudioNode.byHand` says HIS
HAND PUT THIS BOX WHERE IT IS, and a part is the machine's unless it says so:
set when a part is added from the library, the wheel or "add here", and when
a box is dragged, resized or typed into. A node carrying it is never grown,
never shifted and never pushed — though it still stands on the page as a
floor for what comes under it, because it is still there. A document saved
before the field existed is settled once on hydration: if nothing in it came
off a page (no repository brought in, no part carrying `from`, no box carrying
a layout, padding, edge or text setting — those four are written by a capture
and by nothing else) then the board is his and nothing may move. Otherwise it
heals, and parts he moved before today are unmarked because nothing recorded
that he did — bounded by the healing only ever moving a part DOWN, so it can
never put one back where the capture had it.

And `fitRows` carries a floor: a row is laid below the lowest thing already
placed that it stands over. Only what it stands over, and never a box that
holds this one or is held by it — a captured page is wrappers round wrappers
and prising a child out of its parent is far worse than the overlap. The rows
`toRows` returns are cut first, in the tidy, into what is actually side by
side; `toRows` itself is left alone because it is the live page's, held
verbatim against the trunk algorithm by `tests/reflow-same.mjs`.
`tests/grew-moves.mjs` holds all of it at his own measurements, each mechanism
run red on its own first.

**A box that grew moves what follows it, whenever it grows.** The floor in
`parts/primitives.tsx` keeps a box's words visible by letting it draw taller
than the document says. Nothing moved what sat under it unless a flex parent
happened to be doing the moving — his words, "a box grows as a flex child",
and the paragraphs on his captured Documentation page are not flex children of
anything. He counted twenty-one pairs of parts crossing each other where
neither contains the other, all the same shape: a 684-wide paragraph sitting on
the bullets beneath it by 20 to 40 pixels, the bullets at the y the capture
recorded. The arithmetic was never wrong — `fitRows` has always done exactly
this — it ran from one import door (`FromASite`) and nowhere else, ONCE. And
one-shot over a runtime guarantee is the gap: the heights were written against
whatever face resolved that day, so editing words, changing the frame width or
resolving a wider face grew the box again and nothing moved. `useSettleToWords`
keeps it up instead, on the board, off a `ResizeObserver`. It converges because
`fitRows` writes the height a box DREW at, so the next measurement has nothing
to say, and a shift moves boxes without resizing them, which no observer
reports. `settleToWords` pushes no undo checkpoint: it restores an invariant
rather than making an edit, and a checkpoint per settle would fill the stack
with steps that undo nothing a person did — one of which would put the overlap
back. Only a part with `from` (the live element it was recreated from, absent
on everything drawn or placed) GROWS, and a page holding nothing captured never
settles at all. A hand-placed part below a captured one that grew does travel
with it: half a page moving is worse than either, and it is one predicate to
flip. `tests/grew-moves.mjs` counts crossings the way he counted them, and was
red on the unfixed build at `para×b1 by 18px`.

**A space between two runs belongs to the run after it, and only if the page
draws one.** His header is one node with three runs and read back "A
SolWorksproject". It cannot be fixed at the join: "Sol|Works" takes no space
and "Works|project" takes one, both are letter against letter at gap zero, and
both pairs of boxes butt, so no rule reading only the text or only the
geometry can tell them apart. Only the page knew, and `siteRead.ts` was
trimming it away (`raw.replace(/\s+/g," ").trim()`) before anything
downstream could see it. The reader keeps it now under three rules, and they
are the browser's: it rides on the run AFTER it and never the one before, so
it is written down exactly once and rejoining cannot double it; it counts only
where the page RENDERS a space, because whitespace at the edge of a line is
collapsed away by CSS and a headline indented in the markup must not gain one;
and the question is asked of the LINE the run sits in, not of the element
being read, because a fragment read on its own cannot see what is beside it.
`spaceBefore` walks its own block's text nodes, skipping nested blocks, and
finds the nearest ink before it. `recreate.ts`'s `lines()` stops trimming when
there is one item, since then the item IS the part's whole text;
`reassemble.ts` believes a carried space over any guess and infers no second
one from the gap. `tests/reader-space.mjs` runs the real `MEASURE` over a real
DOM and was red on each rule on its own — the first version of it was
**vacuous**, its fixture putting the runs in one block where the older glue
path already joined them, so it passed with the fix reverted.

**How far apart two pieces of one sentence may sit is measured off the box,
not off the type.** His price line — `n_prose_92` "$ 116.59" and `n_prose_95`
"-1.94 %", 22px edge to edge — never merged. The old limit was derived from a
type size the capture often does not record, so it collapsed to its 2px floor
and multiplied up: 14.4px, or 20.7px with a size. The cut sat between one and
eight pixels from a gap that is plainly a word space. A box's own HEIGHT is
always recorded and scales with the type the way a word space does, so
`joinLimit` is `max(spaceAt(a) * 4, min(a.h, b.h) * 0.75)`. At his scale the
limit falls at 43px: 43 joins, 44 does not, and his 22 is inside it with room.
A control 400px along the same line is still separate, and so is
`n_ctaprimary_59`, 139px below and sharing no band of the page.

**A captured wrapper is fitted to what it holds, and one holding nothing
goes.** Collapsed on LOAD rather than dropped at capture, for the same reason
`reassemble.ts` exists: his board is already written down, so a capture-time
rule fixes the next page he takes and does nothing for the one he is looking
at. And "drop the empty ones" is the wrong rule — the banner he clicked on,
`n_box_75`, is 1763x82, is NOT empty, and carries 33px of dead space under its
only child, which is itself an empty box. The claim count and the geometry
disagree in both directions on his page, so `slimWrappers` trusts neither
claim and asks where the boxes actually are. Only the bottom is ever trimmed:
shrinking a box moves nothing, lifting one would. NOTHING IS REMOVED, and that correction was
measured rather than reasoned: both empty wrappers on his home page turned out
to be REAL SURFACES THAT HAD SLID BELOW THE CONTENT THEY OWN — the banner,
1763x65 at y 147, with its whole header above it at -11..105, and the Your
Tokens panel, 1507x172 at y 1247, with its heading at 1056. Deleting those
takes his banner and his panel off the page for good. They are misplaced, not
junk, and putting them back round what they own is a different and larger
piece. So an empty wrapper is named in the report and left exactly where it
is. Also never touched: a wrapper his hand placed (not fitted either — its
size is his answer, as with the button and the healing) and one that shows a
surface of its own. And a wrapper is a `box`: every one of the
75 wordless parts in his captured document is one, and a part of another kind
holding nothing is something else — a `picture` with no picture is a stand-in
by design, and deleting it takes a slot off the page somebody meant to fill. Containment is within one page, because
every page starts at 0,0 again. Note what this does NOT do: positions are
absolute and the healing is monotone, so giving a box back its height gives
back the height and does not move what sits below it. `tests/reassemble.mjs`
is pure and `tests/boxes-fit.mjs` runs it through the palette; both halves of
the store action were disabled in turn to watch the right checks go red.
The whole of this work, with the numbers, is in `docs/SPANS.md`.

**A captured board is put right when it opens — every page, once, one undo.**
Three rebuilds landed, merged and deployed, and his board did not move by a
byte: each was correct and reached a stored document, but only when a person
pressed a command, and the cheap answer turned out to be eighteen presses
across nine pages. His words about boxes coming out wrong were "it should be
done automatically properly". `sweepDocument` runs from `useStudioHydration`,
before anything else writes — which also makes it deterministic, because the
healing only ever runs for the page on screen, so a sweep that waited for it
would judge the open page by settled heights and the other eight by captured
ones. Three promises, each red-proved on its own: EVERY PAGE (the commands
already were page-agnostic — `sentences` groups per page and `slimWrappers`
keeps containment within one — so the work was handing them the whole document
and never a slice); ONE CHECKPOINT, taken before either pass, because
automatic removal is only acceptable if a single undo puts every part back;
and ONCE PER DOCUMENT, marked with `SWEEP`, the version of the rules it went
through, so bumping that number is the whole of "put every board right again".
A board nobody captured is never swept and is marked so it is never asked — the
same question `onRehydrateStorage` asks about whose boxes these are. It says
what it did (`sweepNote`, watched for rather than handed back, because
hydration can resolve after a surface's own effects have run — that race would
otherwise have shipped as an intermittent silence). `tests/sweep-on-open.mjs`
holds all of it; `tests/old-board.mjs` is the shape of check that was missing,
which opens a board the old code wrote and presses NOTHING.

**The paint a capture dropped, worked out again from what is left.** The other
lane taught the converter to read `oklab()`, which reaches a new capture and
nothing at all on a board already written down. An active control is picked
out by a translucent tint of its own colour over what is behind it —
`oklab(0.86644 -0.233888 0.179499 / 0.1)` on his time buttons — and the drop
left it with a border colour and no surface. `repaint.ts` puts it back from
three things the document still holds: the tint's colour as the node's own
INK, what it was laid over as the surface of the innermost containing box that
paints one — or the PAGE's own background when none does — and WHICH node it
is, because a set of choices where the rest agree names its odd one out. Only
the opacity is assumed, and it is one named constant (`TINT`). The first
version of this predicate read the accent and required a painted backdrop, and
would have silently skipped the docs sidebar, which has neither: no accent
field, ink in `colour.text`, and every box behind it unpainted. The rule is
written as "differs from what the others share" and never as "equals the
green", so it survives a different accent, does not grab text that is green by
design, and finds NO active entry on his home page, where every sidebar entry
is the same grey — which is what his reference shows. Green at a tenth over
`rgb(21, 25, 34)` is `rgb(19, 48, 31)` and over `rgb(16, 21, 26)` is
`rgb(14, 44, 23)`: both the values the other lane reached from the opposite
direction by re-reading the capture. Only a part carrying a `variant` is
considered, deliberately — without that, a column of paragraphs with one
coloured differently is indistinguishable from a set of choices, and missing
an active entry is safe where inventing one is not. The colour goes in `bg`, the role the
WRAPPER fills from, and that was measured rather than reasoned because the
chrome lane moved a node's fill out there mid-flight: seeded four ways at
60x30 and read as painted pixels, `accent` + `variant: solid` has the button
paint 35x15 of a 35x18 box while `colour.bg` paints the whole of it — the very
"a box's fill reaches its edge" fault, and `Cta.tsx` now stands aside
(`background: saidRole(t, "bg") ? "transparent" : fill`). The variant is left
alone deliberately, departing from the "and variant solid" the other lane
specified: with `bg` set the button paints nothing either way, and forcing
`solid` would flip the text of a node that never named a colour onto the
accent's contrast. (`Cta.tsx`'s `ghost` branch fills with `accent + "22"`,
which against an `rgb(...)` string is no colour at all, which is why the fault
showed as nothing rather than as a faint tint.) Every condition that stops it painting
something bare was red-proved separately: a pair is ambiguous and left alone,
a set whose others disagree says nothing, an unlabelled mark is not a choice
(two 20x20 `svg` marks in his own document met every geometric test), a part
with no variant is not a control, and with neither a painted box nor a page
colour behind it the answer would be invented rather than worked out.

**The same box emitted twice.** Measured on his document: 24 pairs across
nine pages where one box holds another at 88% or more of its area, repeating
per page. Thirteen PIXEL IDENTICAL — the main content panel of almost every
page, twice, exactly on top of itself. Nine differing by EXACTLY ONE PIXEL OF
WIDTH, 256 against 255: the sidebar, on every page. Not one element read
through two box models, which was the standing hypothesis — his raw capture
holds six parent/child pairs with identical rects and they are two distinct
DOM elements every time (`div` in `div`, `button` in `div`, `img` in `div`).
The cause is one gap: `pageBlocks` dedupes properly, one box is one block
within two pixels, and `offered` threw that away — `rest` was filtered against
the blocks that SURVIVED the wrapper-opening loop and never against itself, so
wherever neither twin survived, both were emitted. That also explains the
off-by-one shape, because the tolerance that would have caught 256-against-255
lives inside `pageBlocks` and `rest` applied none. Fixed in `offered` (reaches
a NEW capture) and retrofitted by `twins.ts` in the sweep (reaches a board
already written down).

`twins.ts` is a separate file from the wrapper rule ON PURPOSE. A duplicate
may be removed because an identical twin remains, which it TESTS — `keeps`,
and the check that no keeper is itself on the removal list; where it cannot
prove the twin survives it leaves both. An empty wrapper may not be removed at
all. Keep the twin that SAYS or DRAWS something, else the outermost: "keep the
first" throws away the button of a `div`-wrapping-a-button pair and leaves a
bare box, which looks fine in a count and is wrong on his screen. The
tolerance is two pixels and no wider, so a pair that DISAGREES on height keeps
both — removing one would be choosing a height nothing here knows. And the
dedupe reads the document AS SAVED, never the result of the other passes:
fitting a wrapper changes a height, and his page_home column pair (528 against
431, one containing the other) is left the same height by it — a dedupe
reading that result deletes a node on the strength of a size THIS CODE chose.
It did exactly that until the check caught it. A box may only be removed for
something the capture said.

**A wrapper is put back round the parts it owns.** Measured on his nine pages
and 631 nodes before a line was written: 35 wrappers, 652px of lift, 1548px of
growth, and the two worst are the two faults he reported — his Your Tokens
panel owning nine parts with all nine outside it (225px lift) and his banner
owning twenty-five with all twenty-five outside it (158px). Then the same
1763x82 banner and 1280x49 wrapper on each of the other seven pages, identical
every time: the converter doing one thing repeatedly, not two accidents.

GROW ONLY, and the measurement is the argument. The obvious rule — put the
wrapper where its contents are — flags 31 of 126 on the committed
capture-derived document against this rule's 2, and **29 of those 31 differ
from their contents only by their own PADDING**, which it would strip from
every one. Keeping the wrapper's box and taking in what escaped is the
difference between correcting a fault and flattening a page. Never widen it.

The move is in one direction: out. The healing only pushes DOWN to clear an
overlap, so the two cannot fight — and measured (`tests/wrapper-heals.mjs`),
the healing is not the obstacle but the amplifier: left alone it clears the
banner's 11px overhang by shoving it 101px past its own logo and drags the
page with it; with the wrapper grown first it does nothing and the page is
101px shorter. I had told the coordinator the opposite, from reasoning rather
than measurement, and it was wrong.

Ordering, and the rule it establishes: the grow pass reads the document AS
SAVED, like the dedupe, and runs BEFORE the fitting — so the fitting does act
on a box this code chose, which the dedupe is forbidden to do. The difference
is named rather than implicit: **a deletion may only be justified by something
the capture said; recomputing a HEIGHT from corrected geometry is not the same
act.** Fitting the banner once it properly holds its header gives back the
space under it; fitting it before would have measured it against an empty div.

**Why a wrapper lands below the content it owns.** `tests/wrapper-below.mjs`
runs the real `MEASURE` against DOMs built to isolate it. A captured element's
box is its own rect GROWN to swallow children that run out of it, and the
growth has three limits — a child outside any one of them is not swallowed, so
it arrives as a loose part and its parent arrives as an empty box wherever its
own collapsed rect happened to be:

1. **A positioned child is skipped outright** (`cs.position === "fixed" ||
   "absolute"`), however plainly it is inside its parent in the markup.
2. **`TOUCH = 24`** — a child more than 24px clear of the box is out of reach.
   His banner's contents end at 105 and the band starts at 147: 42px.
3. **Two levels only** (`for (const c of el.children) for (const k of [c,
   ...c.children])`). Content overflowing from three levels down is invisible;
   the same content one level nearer is swallowed, which is what pins it to
   the depth and nothing else.

And the thing that makes it fixable: the reading already knows. Every
candidate carries the DOM path it was read from and a recreation keeps it
(`node.from.selector` — all 126 nodes of his committed document have one), so
a wrapper's true children are the nodes whose path CONTINUES its own: no
geometry, no reach, no positioning to trip over. Nothing reads it.

**A button in the Builder is pressable in the Builder.** His nine captured
pages were reachable only from the tab bar, which makes a correct import feel
dead. A second press on a linkable part that has a link follows it —
deliberately the SAME gesture that opens a solid for handling (`HANDS_ON`),
because he is one person learning one tool and a second way to press things
would cost more than it buys. One press still selects and moves; a part with no
link, or one the library does not make linkable, falls through to the drag
exactly as before, so the board stays a layout surface. A page is assigned from
the Element panel's `LinkField`, which already existed. Why his sidebar was dead
is a measured fact rather than a guess: `box` is registered with neither
`linkable` nor `linkWhole`, so a link on one is inert on every surface, and the
same link on a `cta-primary` navigates — held in `tests/press-in-builder.mjs`
so it cannot quietly stop being true. That is also why the entries could not be
classified as buttons until the clothes work above landed: doing it sooner
would have repainted his greys.

**A captured control keeps its own clothes, and still works.** `cta-primary`
hardcoded how it looked: its words in the accent's contrast colour, weight
700, a 2px edge in the accent, the label centred. Right for a button dragged
out of the library; wrong for one off his page, where the sidebar entries are
grey at weight 400, unedged and set left beside an icon — so a captured
control was either faithful and dead or working and restyled. His ruling is
both. The rule is one line: **the node where the node spoke, the part's own
where it did not.** The obstacle was never the values — `node.colour`,
`node.font`, `node.edge` and `node.text` all reached the theme already — it is
that a part could not tell a value the NODE chose from the same value the SITE
happens to have: `t.textAlign` reads "left" whether he set left or nobody said
anything, so a button reading it would quietly un-centre every hand-placed
button on a left-set page. `Theme.said` (`NodeSaid` in `parts/theme.ts`)
records exactly which of the roles, the alignment and the edge a node named
for itself; `overrideTheme`, `applyText` and `applyEdge` fill it as they
apply. Weight and letter-spacing need no entry, because `t.fontWeight` and
`t.letterSpacing` are set ONLY from a node's own font — `t.fontWeight ?? 700`
is already "his, else mine". An edge is the one that stands aside rather than
follows: `blocks.tsx` already draws a node's edge on the `[data-part-box]`
wrapper, so a part that draws its own inside it makes two edges 2px apart —
a part sees `t.said.edge` and draws none. A node that says nothing leaves
`said` undefined and every fallback at the literal that was always there:
twenty-nine hand-placed buttons, every id, variant, size and shape, came back
byte-identical across this change. `tests/button-own.mjs` holds both halves,
and was run red first with the fallbacks reverted.

Only `cta-primary` has been taught this. It is not the only part that
overrules a node — no part reads `t.fontWeight`, and of the seven a capture
can become (`recreate.ts`) only `hero-split` and `value-prop` read
`t.textAlign` — but it is the only one of them whose whole body is a single
run of words, so it is the only one where "the node's weight" is unambiguous.
In a composite the node's weight is the BODY weight and a card title's 600 or
a wordmark's 800 is the part's own hierarchy, which a node does not get to
flatten. Teach the next part the same way: read `said`, fall back to the
literal, and change nothing for a node that said nothing.

**A picture draws the picture it holds, and the layer it wears is its own.**
Two ways a part carries a picture. `node.picture`, a file in this browser's
storage, the way the split hero and the product page hold theirs: the
Picture part ignored the prop and drew its stand-in crop with the file's
name on a plate; it goes through `PictureSlot` now like they do.
`node.texture`, an image layer in the look's stack, the way the Builder's
own shrink-in import and his capture carry theirs: the part wears the layer
whether or not it is on, and on, the page and every card wore it too — his
logo came up tiled across the whole ground with the parts unreadable under
it. `docTake.pictureLayersOff` turns a layer some picture names off for the
page wherever a document is taken in (`loadDoc`, the persister's merge), and
the shrink-in import adds its layer off. And a node that carries `pad` says
its padding is all the padding: `applyPad` sets `t.tight` and a part that
pads its words (the pitch line, prose's box styles) adds none, because a
captured box was measured with its padding inside it. `tests/picture-held.mjs`
holds the three; it was run red against the build before the fix.

**A canvas world's characters open their dialogs, and a control does what
it did.** parasiteonsol.fun walks its coins as pets on a canvas and a press
on one opens that coin's dialog; the capture used to keep a flipbook with
nothing to press. sink (`worlds.mjs`) now holds the page's animation frames
still one by one, presses every sprite its script drew, and carries in
`node.world` each character's box in every frame (fractions of the canvas)
and the dialog it opened, dressed in the page's computed look as classes
(`css`), plus what every control in it did when pressed on live.
`parts/World.tsx` draws, live only, a press area per character that walks
with a step-end animation as long as the flipbook, inside a box laid over
the part the way the picture covers it (so it stays on the pet at any width),
and the dialogs, closed. The `world-dialogs` feature opens one, closes it by
its close button, Escape or a press outside, and replays each control's
`data-world-does`: `link` (only to a path on the site), `copy`, `ui` (the
elements a press changed, by `data-world-el`), `close`, `native`, `share`.
The owner's rules hold it: **only true backend actions stay hooks** — a
wallet prompt, a write to a server, a form stay `hook` with what was seen in
`data-world-hook`, found by `data-world-control` — and **a link leaves the
site only where the site's allow-list says** (`parts/offsite.ts`, the
advanced format field `links.offsite`, first match decides; the defaults:
pump.fun kept, dexscreener kept but never a token's page (`/*/*`), X and
Twitter out, `share:own` lets a Share of the site's own page run, anything
unnamed out). sink leaves every off-site control inert with its address in
`data-world-offsite`; `cleanDialog` gives back the ones the list allows and
keeps the rest inert, and the export applies the same list to the page's
own off-site links (a refused one keeps `data-offsite`). A page of the site
is always a link; a copied own address is copied as this site's
(`data-world-copy-path`). The export keeps every `data-world-*` and the
dialogs' own attributes, and points site paths at their page files.
`tests/world-dialogs.mjs` (sink `check-worlds.mjs` for the capture).

**A sprite world is drawn again live, never looped.** The owner at 2000
wide: the page's pets wander on paths of their own at the canvas's own size,
so a wider window is a wider meadow; one flipbook scaled to cover the box made
them huge, cut and looping. When sink reads what a world is made of
(`node.world.stage`: the page's pixel scale at each window width, a sprite
sheet cut to the pieces used, each scene's fill, backgrounds and props, each
character's sprite, home, range, foot, pace, label and the host it rides),
the picture part draws a canvas over the captured still and
`library/stageEngine.ts` (inside the `world-dialogs` script, so Preview and
published run it) draws it: art as wide as the box at the page's scale, pets
their own size, wandering with a pace that drifts, stops and turns, riders
carried and turned with their hosts, labels, props flickering, press areas
placed where each pet is drawn, and the page's scene tabs (`scene.tab`, a
part, pressed anywhere in its box) panning between scenes. Less motion stands
it still. `tests/sprite-world.mjs`. The document also lists in `doc.held`
every control the capture did not press because it would call a server,
prompt a wallet or leave the site, with page, part, character, stable name and
selector, for a later Learn step.

**Faces come through one to one, or say why they did not.** His ruling:
fonts must come through as they are, because size and ratios have to stay
true — he measured his layout against the real face, and a substitute that
is merely close is a layout fault wearing a disguise. The name of a face
travelled (`NodeFont.face`) and the file did not, so his headings wrapped
in a wider face and nothing said so. `FACES` (`siteRead.ts`) reads a
page's `@font-face` rules off its sheets, addresses made absolute against
the sheet that declared them, and lists the sheets it cannot read;
`fonts.ts` (`carryFaces`, pure, the routes hand in the fetcher) carries
the faces the readings are set in: Latin subsets only, by unicode-range;
a system face has no rule and is named and moved on; a host whose licence
forbids carrying (Typekit, Adobe, Cloud.typography, Monotype, MyFonts) is
not fetched and its sheet link is kept with the reason; a file past
`FONT_FILE_MAX` or behind a dead address is kept by its address with the
reason, never dropped. They live in `look.fonts`, a stack beside the
textures, and a part goes on naming its face by name, so a carried face
stays swappable — the wheel's family readout lists carried faces first,
set in themselves, and choosing a class drops the face. `CarriedFonts`
puts the rules on the board and in the live page (the published static
site copies them like any rule; Build writes them into `globals.css`) and
asks every face to load; one that will not is said once as a toast with
why. The strip says what came, what could not and why, what is a system
face, and — `genericSays` — what is set in a generic keyword like
`ui-monospace`, the machine's own face, which is a different face on a
different machine and cannot be carried. `tests/fonts-carried.mjs` holds
the carrying, the reading off a served page, and the drawing in the
Builder with a real file under a made-up name.

**A hand on a vine pulls it; a press takes it apart from the middle.** His
words: "the line in the middle of the vines is hoverable ... i would rather
no line, the vine maybe pulls a little when you hover ... when click
vanishes and fades away and disintegrates from the middle". So `.vine-cut`
paints nothing at all — it is only the shape that catches the pointer — and
what answers a hand is the vine: `strandPath(from, to, tug)` takes the bow
out of it and it draws taut. A press parts it at the middle
(`Build.cut`): the curve is sliced into two pieces that draw back towards
their boards, crumbling at the break, fading as they go, and the iteration
is pruned when there is nothing left of the vine rather than at the press.
Sliced, never erased — `destination-out` on a shared canvas would punch
through whatever vine crossed this one.

**The boxes arrive when you open the timeline.** His words: "if you are in
the design preview and havent seen the timeline yet dont have the elements
add until you open the timeline where everything not seen yet is all loaded
in sequentially but each box starts maybe .2 seconds apart, not once the
previous is finished". So an update is never a thing that happened
somewhere he was not looking: `useForming` keeps a session-scoped `watched`
set, and every box he has not watched arrive starts forming the moment the
timeline opens, `STAGGER_MS` (200) apart. Apart, not after — a formation
takes 2.6s, so a run of six overlaps and reads as a sequence rather than a
queue. A box whose turn has not come is not drawn at all, because a box
sitting at zero is a box that is already there and empty. "Haven't seen the
timeline yet" includes a session that has only just started, which reverses
the older rule that a reload showed everything as it stood.

**A box that holds words is never shorter than its words** (`textFit.ts`,
`tests/words-fit.mjs`). A captured part carries the width and height the
page it came from was measured at, and every renderer treated that as a
ceiling: "PnL Over Time" came in at 143 by 41, its words needed more than
41, and they were gone — not deleted, pushed into a scroll region on a board
nobody can scroll. His rule: captured geometry is a starting size, never a
ceiling.

The floor is CSS and it is the guarantee. Three boxes used to pin a part to
the node's height — `Fill` in `parts/primitives.tsx`, the `data-part-box` a
captured node wears in `blocks.tsx`, and the board's own part wrapper in
`Canvas.tsx`, which was `absolute inset-0` and so could never be taller than
the node. They set a minimum now and grow past it, on the board and on the
live page alike, so the part draws at the size its words need whatever face
resolved and whatever was typed since.

A height written onto a node is a CONVENIENCE and never the truth. After an
import the tidy reads back what each box drew at, writes those heights down
and moves what sits below down by the growth — his words, "the texts should
follow each other based on full size" — in one undo step, by rows, so three
cards side by side push the page down once rather than three times. Those
numbers are measured against whatever face resolved that day; a face that
resolves wider later makes them too small, and the CSS floor is what keeps
the words visible when they are.

**A captured box that centres its words down is as tall as it was**
(`theme.ts#boxStyle`, `tests/ca-bar-seams.mjs`). The capture reads padding
off where the words sat; in a box that centres them in a height of its own
that is the centring, not a floor. trumpmorty.fun's remote keys (96 tall,
words read 53 from the top and 21 from the foot) drew 105 and put the footer
34px low. Only the difference goes on, on the side that had more, so the
words' middle is where it was read. A box placed by hand keeps its padding.

**A rounded box and the parts painted in it meet without a seam**
(`tests/ca-bar-seams.mjs`). On the page the CA bar's ends were inside the
bar; here they are parts of their own, cut to its rounded inside. So every
part stands on a whole pixel (`fluidSite.ts#snapPlace`: the fill snaps to the
grid and a `clip-path` does not, and half a pixel of the bar's white showed),
and a behaviour that writes an inline `transition` adds to the part's own
from the stylesheet and gives it back when it is done
(`library/behaviours.ts#SHEET_TRANSITION`), or the ends snap home while the
bar eases back and its white flashes round them. A part the export moves
inside the part it turns with keeps its width in the page's terms
(`fluidSite.ts#pageUnits`): in `100%` of the remote, the remote's keys were
0 wide and their words, numbers and gloss hung off them.

**What moves under the pointer carries what is on it, and what can be
pressed points over its whole box** (`carry.ts`, `tests/ca-bar-seams.mjs`).
A captured box a hover, press or focus moves, or that tilts under the
pointer, takes every part it owns by element path (its `::before` too)
inside its own box on the published page, so one transform moves the key
and its gloss, the card and its badge, together; a nested part gets no
follow rule and no second reveal of its own. A link, a button (the
capture's role), a call to action or a part with a pressed look shows the
pointing hand, and so does every part inside it.

**A site's stylesheets scale with it** (`cssMerge.ts`, `tests/css-scale.mjs`).
`assets/site.css` holds what every page shares (palette, faces, resets,
keyframes); each page loads its own parts' and its panels' motion from
`assets/motion/<page>.css` (pages switched in place share one). A group's
rule names its host and the element path its parts stand under (`data-at`,
a short code per part), never every part by name, and rules saying the
same thing are folded into one class only where no rule's order could
decide differently. parasiteonsol.fun's 26 MB sheet is 77 KB and 418 KB.

**A captured page's boxes arrive the same way** (`boxEntry.ts`,
`tests/boxes-land.mjs`). `FromASite` lands every block it read in one
synchronous loop, and they all appeared in the same frame, which reads as a
picture being pasted rather than as a page being built. They come up
`STAGGER_MS` apart now, the same number as the timeline, imported rather
than written again. What waits is the PAINTING and not the part: every node
is added in the same run it always was, and a box holds its place in the
layout at `opacity: 0` until its turn. That is not taste. A part added on a
timer takes its undo checkpoint on a timer, and a board that is half arrived
when undo is pressed breaks quietly. The suite pins the ceiling: clearing an
import costs one press per part and one for the surface, the same with the
stagger as without it.

**A control is dead if the pixels do not move.** That is the test, and the
light panel is where it was written: `tests/light-alive.mjs` moves every
control end to end and reads the board back as pixels. Two were dead. "How
high it hangs" scaled the shadow by `min(3, dist * reach) * lift`, where
`dist` is a fraction of the page — the product ran 0.23 to 0.02 and never
came near the 3 it was held under, so the whole control was worth two
pixels of shadow; `castFrom` now measures the length in multiples of how
far the thing stands off the page. "Warmth" tinted a lit face that one
component in the app painted, at `oklch(1 0.02 …)`, a chroma at which no
hue can be read; the wash is painted by `Fill` on every part now and
carries a colour. And there was one formula in two places, `liftVars` for
the board and `liftTheme` for the parts, which had drifted — both call
`look.liftCss` now, because the copy that was wrong was the one on the
board, which is the one anybody would have looked at.

**The column gets the middle; the fan is furniture.** His ruling, after the
set measured 281px left of centre in a 1318px frame: the boxes are what
gets centred and the lane fan hangs off them, so "nothing sits on an edge"
does not outrank "the thing you are reading is in the middle". `settleView`
takes `weigh`: it decides the centre of mass and the hold ACROSS, while
everything — the fan included — still decides the zoom and is still held
DOWN the page. The asymmetry is the point: a fan overhanging to the right
is furniture you can see, a fan under the opaque band along the foot is
furniture that is gone. The first attempt weighed the column on both axes
and put 178px of lane under the band. Screenshots: `docs/shots/lanes-hanging.png`,
`lanes-opened.png`, `lanes-carried.png` and `lanes-narrow.png`.

**The fit belongs to the room, so it follows the room.** It used to be one
attempt in one frame after the timeline mounted, and it gave up in silence
if the pane had not laid out yet — and because the pan is the component's
own state starting at zero while the zoom is the store's and survives, what
was left was the board's scale with no translation at all. That is the
`matrix(0.683, 0, 0, 0.683, 0, 0)` he read off the deploy, with the updates
pinned to the frame's top-left and part of the timeline outside the frame.
Now a `ResizeObserver` on the frame and on the band re-runs it: it waits
for a room with a size, it waits for a resize to stop before fitting to it,
and it fits again when the arrival is over (the fan is measured off the
last box, which is not there while the run is still coming in). A view
somebody moved is theirs and is left alone unless the room has stranded it
off an edge.

**One readout, one press, both surfaces.** The timeline's zoom is the
board's zoom — one number in one store — so the percentage in the bar was
already showing whichever surface was in front and had nothing to press
for. It is the fit now: `requestFit()` bumps `fitNonce`, the board fits and
the timeline settles. The "fit in view" button beside it and the timeline's
own bottom-left box (an update count, a "centre" button and a second copy
of the percentage) are both gone — three controls that did one job.

**Centring is centring in what you can see.** The pane the timeline stands
in has travel of its own, by design, so scrolling past the last update
reaches the prompt section under it. The settle did not know: it measures
the room from the timeline's own top, and with the pane at its foot that
top is the band's height above the window — measured at 1440×900 with six
updates, the set was cut off 192px above the screen with 304px of nothing
below it, and asking for the middle put it back in exactly the same place.
A settle now puts the pane back with it. That was also what the removed
corner button caused on its own: a control at the foot of a pane with
travel scrolls that pane to itself when it takes focus.

**Fail loudly in the Builder, never on the published site.** The publish
boundary is a rule, not a detail: he is the only person who needs to know a
part did not render, and a visitor must never see the scaffolding. It is
also the absolute rule — the site never mentions him, the chats, the models
or how the work is made, and "nothing has been built for it yet" is a
sentence about how the work is made. The audit shipped once: his live page
served that note, a "No words written for these yet" block and an "Asked
for in the prompt and not on the page" list to anybody who visited. So
`Theme.published` is true only for the page a visitor is served;
`unwritten()` gives sample prose on the board, the plain fact in the live
preview, and nothing at all published; `LiveSite` stands no note for an
unbuilt section there; and `staticSite` writes no in-place note and no foot
block. Nothing is lost — `auditSite()` gathers the same five lists and the
publish card shows them under "What will not go out", which is the same
information at the same volume on the side of the boundary that is his.

**What the brief promises, the page carries or admits.** Four faults he
measured on his own deploy were one fault: the brief said a thing and the
board carried something else, and nothing anywhere owned up. So the brief
and the page now read the same lists. `spec.unbuiltSections` is the sections
of a page's layout that no part carries — a region drawn with words on it
and nothing inside — and `LiveSite` stands a note where each one was drawn
instead of leaving a silent gap. `promised.missingCopy` is the copy a prompt
names outright (quoted, or in capitals) that the part is not showing:
`blocks` tags it on the board where the work is done, and `staticSite` names
it at the foot of the published page. Neither reads the rest of a prompt, so
a prompt about nothing but colour and weight is never accused of anything.

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
  when changed; `*` marks what the author set. A field a renderer reads is
  marked `live` in `format.ts`; the rest are marked "brief" in the panel,
  because the preview does not draw them, and `tests/format-live.mjs` holds
  the flags to the renderers' own source. A default left out was read as
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
- **A body can be drawn instead of written** (`renderer.ts`,
  `api/studio/image/route.ts`). Claude writing SVG by hand is the right
  answer for a diagram or a band of sentences and the wrong one for a thing
  that has to *look* like something, so there is a second way to fill an
  Idea part and it goes through Replicate: **vector**
  (`recraft-ai/recraft-v3-svg`) comes back as SVG, **raster**
  (`black-forest-labs/flux-2-pro`) as a `data:` URI inside an `<img>`. An
  SVG a drawing model emitted is not more trusted than one a writing model
  typed: it goes through `cleanSnippet` on the way in and renders under the
  same `sandbox=""` and the same content policy, with a bigger ceiling
  (`RENDER_LIMIT`) because a drawing is every curve it drew, and past the
  ceiling it is refused rather than cut.

  **The drawing path has no model that writes in it** (`drawRun.ts`,
  `tests/shapes.mjs`). Make real on an Idea part used to rasterise the
  strokes, describe them, and ask Claude to *write* SVG that looked like
  them: two translations, and the drawing was what got lost in both.
  `recraft-ai/recraft-vectorize` takes a picture and returns the SVG of what
  is in it, so the drawing drives the vector. The loop is: rasterise
  (`pictureOf`), trace (`/api/studio/image`, kind `vectorize`), sanitise
  (`cleanSnippet`), cut to `outline.cut` and photograph it cut (the render
  route takes a `clip` now, so the silhouette scored is the silhouette the
  board shows), score at the same 0.72 — **like against like**
  (`targetFor`, `compare`). The test that decides is the one `outlinePath`
  already made. A **closed** line that encloses a real share of its own box
  is the edge of a thing, so both sides are filled — the target is the
  outline filled and the render has its holes flooded, so a traced edge
  becomes the region it encloses — and the score is plain area against
  area; a trace with a gap in it leaks, fills nothing and scores badly,
  which is correct. An **open** line is the thing itself, so both sides
  stay ink and the score is how much of each lies within a tolerance the
  width of the drawn stroke (`CLIP_STROKE / 2`), which forgives a line a
  stroke off and does not forgive a line that is not there. Closed but
  enclosing almost nothing — a helix that ends where it began — is ink, not
  area (`ENCLOSES_ENOUGH`). Thin ink is never scored against a filled area;
  that one comparison capped every run on the first bench.

  The frames have to match too, which is why **every rung crops**. The
  part's box *is* the drawing's box and the SVG is stretched into it with
  `preserveAspectRatio="none"`, so the picture is cropped to the ink and
  each axis stretched on its own: fitting the ink inside a square here and
  stretching it into a wide part there applies the distortion once instead
  of cancelling it, and the trace lands somewhere the drawing never was. Under the bar it
  goes again **on the picture, not on words** — there is nothing to argue
  with — up one rung of `LADDER`: thicken the line, harden the contrast,
  and on the last go drop the ground. Three goes, the best
  kept, every score stored on the part. The traced ground is stripped from
  every answer (`dropGround`), because a white plate the tracer found under
  the drawing is not the drawing. No Claude call happens anywhere in it, and
  the whole path runs with a locked keys panel: the part, the crop, the
  behaviour, the body and the iteration on the timeline all land without a
  reader. `writeBody` is still there for a part that genuinely wants words
  and is reached only when nothing was traced at all.
- **The cube is a part of the library first, and interpretation's business
  second.** `cube-3d` is in the shelf under Media › Solids: search "cube",
  drop it, and it is a cube with faces on it before anything is typed —
  the part reads `node.cube` when it has been edited, the content field
  when it has not, and falls back to three examples so the shelf shows a
  cube rather than a blank box, exactly as every other part falls back.
  **It is the one part that takes the pointer on the board** (`HANDS_ON` in
  `Canvas.tsx`). Everything on the canvas is `inert` because the canvas is
  a layout surface, but a cube you cannot turn is a picture of a cube, so
  once it is the *selected* part it takes the pointer and the keys; let go
  of it and it is inert again, which is how it is still dragged around the
  page. It must `stopPropagation` on the press: the board's surface
  captures the pointer on every pointerdown, and without that the cube's
  own capture is overridden a frame later and the turn becomes a move.
- **Interpretation picks from a catalogue before it traces anything**
  (`coded.ts`, `tests/coded.mjs`). There used to be one road: whatever was
  drawn became a picture of itself, traced and clipped to the line. Right
  for a helix, wrong for anything that has to *do* something, and it made
  the board a machine for producing cutouts. Now the drawing and the words
  are offered to `pickCoded` first: a list of real library parts, each
  declaring **what** it is, what it **needs** from the author, what a
  drawing has to **look like** to mean it, a `match` that turns that
  sentence into a number off the geometry, and a `configure` that builds
  the node patch. Best over `SURE_ENOUGH` wins and no model is asked
  anything. A matcher may read the words as well as the strokes — "a box"
  and "a box, as a cube" are different instructions — but it may never
  call anything: the layer decides for free and decides the same way every
  time. **The fall-through stays**: nothing matched means the reader names
  a library part and the vectorizer traces the line, exactly as before.
  Adding the next one is a file and a line in `CODED`, not a rewrite, and
  there are two in it for that reason: the **cube**, which needed a part
  written, and the **accordion**, which needed only a declaration over a
  part the library already had. The accordion is gated on purpose — three
  parallel bars are already read as a *list*, and most of the time that is
  what someone drew, so a stack only means an accordion when the words say
  so or when the bars are inside a box, which is not how anyone draws a
  plain list.
- **A cube is where the coded path earns its keep** (`parts/Cube.tsx`,
  `parts/cubePose.ts`, `parts/cubeFaces.ts`, `shapeKind.isBox`,
  `shapeKind.isCube`, `tests/cube.mjs`, `tests/box-to-cube.mjs`). A traced
  drawing is a picture and a picture of a cube does not turn, so this one
  part is not drawn at all: the drawing supplies the kind and the
  proportions, the prompt supplies what goes on the faces, and the element
  is code.
  **Recognition is geometric and free, and a box on its own is a box.**
  Three quadrilaterals meeting at a vertex, a hexagon with a Y in it, or
  **one closed line with four corners that fills its frame, drawn alone**
  (`isBox`): nothing said beside it, nothing of the page inside it, and
  nothing real drawn on (a blank idea part counts as nothing). That last
  case used to be a question ("Is this box a cube?") and, waved on, a flat
  cutout; it is now decided off the four corners, because a box is the
  drawing this whole arc is judged on. The gate is `lone`, worked out by
  the run (`reshapeRun.loneDrawing`) and handed to `kindOfSketch` and the
  catalogue: a captioned box keeps its words' meaning, a box round three
  cards is their frame, a box over the hero is the hero's new edge. The
  disc says "a box: it will be a cube" while it is being drawn, the part's
  chip says `box · cube` after, and the panel wears "a box, made a cube".
  A drawing too small to be a part is grown to the floors in proportion
  (`applyProportion`), because the floors differ by axis and a 44 × 36
  mark was landing 80 × 36 with its one fact lost. What a person does
  second — two cubes, a cube in a space beside a flat part, a box that is
  not square, a fresh browser opening `/site` — is measured by
  `tests/cube-second.mjs`; the space's picked-part panel carries "This
  space" as the way back to the space's own panel, because its key on the
  board goes once a part is inside it.
  A cube skips the reshape route entirely, so the whole path — kind, size,
  faces, the part itself — happens with no model call of any sort.
  **It is the proportion it was drawn at.** The catalogue keeps the part's
  fitted width and height (grown in proportion only under `CUBE_MIN`), and
  the object inside is as deep as its shorter side: a square box is a cube,
  a wide box is a wide box (`cubeDims`). Resizing by the handle
  reproportions the object exactly as it reproportions a flat part, which
  is what the drawn ratio surviving means for a solid.
  **The part** is six faces in a `preserve-3d` box with no library: drag to
  turn, the last samples become spin that decays. **It cannot be tumbled
  into nonsense**: yaw is free, pitch is held within `PITCH_LIMIT` (85°) of
  level, and spin into the limit is spent rather than left pinned. **It has
  a resting pose it returns to**: when the spin dies it eases to the
  nearest rest (`nearestRest`), the three-quarter view from a little above
  (`REST`, −18 / −32) turned a quarter at a time round the yaw, or tipped
  to look down on the top or up at the bottom (`REST_PITCHES`). Never a
  flat square, never an edge. Arrow keys step between rests: left and
  right round the sides, up to the top, down to the bottom. `facing` reads
  the face in front off the rest pose, and a positive quarter turn brings
  the *left* face round, because yaw turns the cube, not the camera. Each
  face is shaded by how much it faces the page's lamp, which is what stops
  six rectangles reading as a folded net. Nothing snaps until it has been
  turned, so the pose it is left at survives arriving. A right press is
  not the cube's: it falls through to the board and opens the wheel.
  **A face is picked like a part.** A press on a face that does not become
  a drag says which face (`cube-face` `PartEvent`); the board keeps it as
  `store.pickedFace` (transient, let go with the selection) and hands it
  back as `pick`, so the face wears the board's own mark. The panel marks
  the same card, scrolls it in and gives its heading the keys, so "pick a
  face and give it words" is one press and typing; naming a face in the
  panel turns the cube to show it (`restFor`, the short way round). The
  wheel's pencil is about the picked face when there is one: heading, line
  and the face's own prompt. Every face has a `prompt` of its own, exactly
  as a part has, and the blueprint writes it (`for: …`) beside its words.
  **One undo takes back an edit, not a letter.** Typing writes the document
  a keystroke at a time, and each write used to push its own undo entry.
  `pushEdit` in the store keys a run of writes to the same field: the
  first pushes, the rest within `EDIT_RUN_MS` (1.5 s) ride on it, and any
  other push, an undo or a redo ends the run. `setCubeFace` uses it per
  face and field, and `updateNode` uses it whenever a patch touches only
  the typed fields (`prompt`, `content`, `data`, `label`), so the part's
  own prompt is one undo per edit too. Clearing a face is a step of its
  own. `tests/box-to-cube.mjs` presses eleven keys and then one undo.
  **The faces live on the node** (`node.cube`), not in the part, because
  they are the author's words: `facesFrom` splits the content field, or the
  prompt after a "a cube with…:" lead-in, one item a face, and **leaves the
  rest blank** — inventing filler for an unwritten face is the thing that
  makes a page read as generated. Turning it in Preview writes
  the angle back through a `cube` `PartEvent` tagged with its node, so
  where it was left is what the board draws. Build writes it as a component
  with its own state rather than a snapshot of one angle, which is the only
  part in `scaffold.ts` that is written rather than copied; the written
  component carries the same proportion, limit and rest poses.
  **The model road is behind the routing table, and the no-key road is the
  whole thing** (`solidRoute.ts`, `solidRun.ts`). The cube needs no key.
  Past it, the same two-axis table that routes every picture routes a box
  to the one cell that returns a solid — `object` at the first step,
  `tencent/hunyuan3d-2mv`, which takes front, back, left and right views —
  and a cube's own faces are those four views, drawn flat off the node
  (`faceView`) and sent up the image route at stage two (`views`, a field
  the route now takes for a mesh model). The card in the panel and the
  piece on the wheel light up the moment a Replicate token is present
  (`rendererReady`: this browser's keys panel or the server's environment,
  never a value, only a yes) and otherwise say what would light them; no
  call is made to find that out. The answer lands as `mesh-3d` with
  `node.cube` kept, so the faces stay editable and "Back to the cube" is
  one press with nothing lost. The still under a solid is the object
  drawn flat at its resting pose (`cubeStill`: orthographic, every face an
  affine map of its own picture, shaded by the lamp, the words on it), not
  one front face, so a box nobody has written on is still a box on the
  board and in the fallback. The vendor is never reached from a test:
  `tests/box-to-cube.mjs` mocks the route and measures what goes up and
  what lands.
- **A drawn shape says what the part does, not only what it looks like**
  (`shapeKind.ts`, `store.applyDrawnKind`). The clip is untouched: a
  triangle still cuts out as a triangle. The geometry is read a second time
  for behaviour, in order of certainty — a closed line inside another closed
  line is a **container** and adopts every part that falls inside it into a
  group; three or more straight strokes running the same way at a similar
  length are a **list** and seed one row each; a single straight open line,
  with or without the two short strokes that make it an arrow, is a
  **connector** and becomes a chain between the two parts nearest its ends,
  ceasing to be a part itself; one closed line is a **surface** that holds
  what is placed on it; anything else is a **mark**, which is what every
  drawing was. It is read off the geometry, so it survives a locked keys panel,
  it is stored as `node.kind`, and it reaches the blueprint as "the shape
  means".
- **The bench is how the drawing path is judged** (`tests/shapes.mjs`).
  Five fixed drawings — a 3 stack, a helix, a spiral, a star, a ring —
  three runs each, printing how each was scored, every go's overlap, the
  goes used, the wall time and the cost at $0.08 a trace. Four of the five
  clear 0.72 on the first go; the star takes two, because a thin trace of
  its points leaks when the holes are flooded and thickening closes it. One
  bar covers both kinds, so there is no case for two. The renders and the scores are real.
  With no Replicate token the tracer is stood in for by a real one (the
  picture is decoded in a second browser page, thresholded and run-length
  traced), so the loop is under test and only the vendor is absent; with a
  token set, the model is used. Change the loop, run the bench, and say
  what the numbers did.

  In the body loop (`bodyRun.ts`) the renderer goes **first**, and it is
  scored on the same bar as everything else: the silhouette of what it drew
  against the outline that was drawn, intersection over union, `GOOD_ENOUGH`
  at 0.72. Clear it and Claude is never asked. Short of it, the renderer's
  own render is what the first written attempt is given to beat, with the
  drawn picture beside it as always, and at the end the best of everything
  is kept, drawn or written. The drawn PNG is the reference on both paths
  and in the critique.

  The token is the person's, not the deployment's, and lives where the
  Claude key lives: a service card under Keys beside Claude, held in the same
  keys panel in this browser, unlocked the same way, sent as `x-replicate-key` by
  `rendererHeader()` with each call. The route holds it for the length of the
  call — never written down, never logged, never returned, and the one place
  a library's error message could carry it is scrubbed. A
  `REPLICATE_API_TOKEN` in the server's environment still works and is a
  silent fallback rather than the path: the browser's token wins, which is
  the reverse of every other route here and right, because the person who
  typed it is the person being billed. `/api/keys/status` reports the
  server's, present or absent, the same yes-or-no it gives for every other
  name. With no token anywhere the route answers HTTP 200, `ok: false`,
  `reason: "unavailable"`, the same shape and the same path a locked Claude
  key answers with, and the loop says `noRendererKeyMessage` rather than "no
  token", because a keys panel holding one behind a PIN is the usual case. A
  renderer call is the first thing here that
  spends money per press rather than per token, so `RENDER_COST` (0.04
  raster, 0.08 vector) rides back with the answer, is kept on the part
  (`PartCode.cost`), lands on the iteration's card and ends the usage line.
  Tested by `tests/renderer.mjs`.
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
  Right-press one for what can be done with it. A box carries a wireframe
  of what that iteration produced, drawn off its own document snapshot,
  with the parts it changed lit: the headline is what it did, the picture
  is what it looks like. An **element prompt** is not a box at all: a
  drawing is a small purple construct piece, the drawn strokes and the
  name, no headline, joined by purple strands. Headline boxes are for the
  iterations that moved the whole site.

  Between them run **strands** (`strand.ts`), and they are hard light
  rather than wire: a translucent emerald body, three bands of marbling
  swimming inside it on their own phases, a hair of near-white down each
  rim so it reads as a solid object, and energy running both along the
  line and helixing around it. Everything is sampled off the curve, not
  stroked as a bezier, because marbling, rim and helix are all functions
  of how far along a point is. Strands anchor to where the boxes are
  rather than to a measurement of them, so they stretch in the same frame
  as the drag. On each strand sits the **loop starter**: examine,
  critique, iterate.

  **The first thing anyone does makes iteration one.** Nothing seeded the
  timeline: threads were landed by an ask coming back and by a drawing
  being made real, and by nothing else, so someone who had laid out a whole
  board opened it and found it empty, which reads as broken rather than as
  "nothing has happened yet". The fix is not invented history. `seed()`
  hangs off `push()` — the undo checkpoint every genuine mutation already
  takes, so "a real action" needs no second definition — and lands one
  iteration, mode `start`, holding the board as it was *before* that first
  change: somewhere to stand, and something for the next one to hang off.
  It fires once and never again. Until it does, the empty timeline says
  nothing has happened yet and what will change that.

  **The flag and the state mark** are the two things on the box that are
  not about what the iteration said. `this iteration` (`CurrentButton`,
  `store.currentThreadId`) is where the work is: one per timeline, on the
  box, and pressing it moves it. The section below reads whatever is open
  and falls back to what is flagged, the prompt area in it says "working
  here", and a new thread hangs off the flagged one rather than off
  whatever landed last. It is persisted, because "where was I" is the
  question a timeline exists to answer. Beside it, one dot: **green when
  the work behind that iteration finished, red while it is still going or
  was abandoned**, and no third colour, because a third colour turns a
  glance into a legend. A drawing lands as `running` and is marked `done`
  when its body has been traced; anything still `running` when the store
  rehydrates is turned to `cut`, since the process that was running is
  gone. The box keeps its own emerald and purple: the state mark is the
  only thing here that is red or green. Tested by `tests/current.mjs`.

  An iteration is *read on the box*, not in a panel somewhere else.
  Clicking one grows two cards out of it: what went in from the top edge,
  what came out of the bottom, each joined to the box by the same
  construct (`paintConnector`). Under the timeline, and reached by
  carrying on scrolling exactly as the parts shelf is under the board,
  `TimelineDetail.tsx` keeps only the prompt, pinned to the top of the
  section and visibly larger at any zoom or window size, and the menu of
  what this generation can be turned into. It reads like the boxes do:
  the same emerald cards, the same eyebrow labels, no file tree, no
  stages, nothing that looks like a codebase. The iteration book lives
  there too, in its own tab with its own menu, and the page layout of the
  book no longer draws the trail: the timeline above it is the trail.
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
  (the wheel, the palette, the keys panel, the Blueprint); a page, a panel or a
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
  re-encoded before it is stored, because the document's localStorage mirror
  is what most readers see and one phone photo would fill it. `usePasteImage` ignores a paste aimed at
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
- **The middle column is one scroller, and the board is as tall as the site.**
  `[data-studio-pane]` in `StudioPage.tsx` is the only thing that scrolls; in
  it sit the board and, under the board, the shelf. `Canvas`'s root is
  **never** `size-full` or `h-full`: its height is `pageH * zoom +
  FRAME_GUTTER` — the site as drawn plus the ground either side — and it has
  no `overflow` of its own. That is the rule, and it is the one this layout
  has broken twice: a root the pane's height with `overflow-hidden` is a
  scrollbox with the bar turned off, whatever the wheel handler does inside
  it (measured once at 943px of root holding 1841px of page). The wheel is
  not handled for vertical movement at all — the pane's own scroll is the
  mechanism, so one gesture runs from the head of the site, through all of
  it, and on into the categories. `Canvas` handles only ctrl-zoom and
  sideways pan.
  **The page's height does not follow a hand.** It is the lowest thing on
  the page plus 160, which shrink-wraps the content with no slack in it, so
  every pixel a part is dragged downward used to be a pixel the page grew —
  and the board is as tall as the page and the shelf sits under the board in
  the same scroller, so the preview resized and the categories were pushed
  down live, while the button was still held (measured: page 1960 → 2197,
  shelf top 1456 → 1606, for one part dragged 240px). `Canvas` holds the
  height in a ref for as long as `drag.kind` is `node` or `resize`, and
  settles it when the hand comes off. A pan is not held: it changes nothing
  about the document. The timeline never showed this despite being in the
  same pane, because it is `h-full` and cannot grow — that clue is what
  narrowed it. `tests/hand-steady.mjs` holds it, and note what that file
  says about its fixture: a page short enough to leave `mt-auto` some slack
  reports the fault fixed while it is broken, because the shelf is pinned to
  the bottom edge and cannot move. It needs a page with travel in it.

  **The page keeps its origin and stops clipping; the board grows to hold
  what is outside it.** y=0 is the site's top: the page grows *downward* to
  meet what is drawn (`frameHeight`) and never upward, because moving the
  origin would renumber every coordinate in the document. `data-page-window`
  therefore has no `overflow` of its own — anything drawn outside the page
  shows on the ground where it was drawn, on all four sides. Upward the
  *board* makes the room (`frameTopReach`, ink and spaces only, not parts),
  and the pane's `scrollTop` is nudged by the same amount in the same frame
  so the ground does not jump out from under the hand mid-stroke. Sideways
  needs none of that: the board pans across, so a thing off the left is a
  pan away rather than lost.
  **Do not check this with `scrollHeight`.** It measures overflow below and
  to the right only, so two of the four sides are invisible to it — a box
  with content above reports `scrollHeight` equal to `clientHeight`, and
  that is how 28px of a drawn line sat above the page's edge with every
  check green. `tests/board-edges.mjs` compares the drawn thing's own
  rectangle against each clipping ancestor instead, which sees all four.

  **`frameHeight` counts everything the page draws, not only its parts.**
  The window the page stands in is sized from it, so anything it does not
  count is rendered behind an edge no gesture can pass: one pen stroke a
  hundred pixels below a stock page hid 138px. Pass `shapes` and `spaces`
  with the nodes. A new kind of thing that renders inside the page is a new
  thing for it to count.

  Four numbers hold it, and `tests/full-page.mjs` asserts them: the board's
  height is the site's rendered height plus the gutter; the pane's
  `scrollHeight` is that plus the shelf band; no ancestor of `[data-frame]`
  has `overflow: hidden` with `scrollHeight > clientHeight`; and one wheel
  sequence from the top reaches `[data-parts-search]`.
  **A suite that does not name its document proves nothing.** This one
  reported 36 of 36 while all four numbers were false on the deployment,
  for two reasons worth not repeating. It never said what it measured — a
  dev server here and a browser pointed at Vercel are different documents,
  and `/api/version` exists precisely so a deployment can name its own
  commit, so every run prints it now. And its fixture was parts and
  nothing else, which agreed with a `frameHeight` that counted parts and
  nothing else: two wrongs measuring each other. Fixtures carry ink and a
  drawn space below the last part, because a person's page does. It also
  finds the board by walking OUT from `[data-frame]` to whichever ancestor
  is a child of the pane — never by a class name, which stops matching
  silently and then measures the wrong element.

  Two consequences worth knowing. The ground (`Workspace`) is mounted
  **outside** the pane, in `[data-studio-scroll]` — inside a scroller it is
  only the pane's own size, anchored at the top, so a long page runs off the
  end of the sky. And the shelf band carries `mt-auto`, so on a page shorter
  than the pane it sits on the bottom edge as it always has, and only a page
  that overruns pushes it under the fold. Note that anything calling
  `scrollIntoView` inside the board scrolls the pane (Playwright does this
  before a click) — put it back at the top first.
- **Import takes a picture or a video, and the frame lands two ways.** The
  background's wheel piece (`SLOTS_BG.duplicate`) was Picture: an
  `image/*` chooser whose only destination was `addTexture({ pattern: true,
  scale: 60, opacity: 0.5 })` — the picture reduced to a monochrome mask,
  repainted in a palette colour, half transparent, tiled across the page.
  Right for a background texture, and the only answer, so there was no way
  to bring a picture in as a picture and no way to bring in a video at all.
  `ImportFlow.tsx` owns it now: a video is scrubbed to a frame, and the
  frame lands as **Fit to standard** (one covering picture on the page —
  still a texture layer, because a background is one, but `pattern: false`
  and `weave: 1`) or **Shrink in** (a `picture` part at the picture's own
  aspect, inset from the frame, wearing the frame through `node.texture`).
  Two rules hold it up. **A preview is not an edit**: the frame under the
  playhead is painted by `Canvas` from a module-level value, never through
  `addTexture`, which calls `push()` — a scrubber dragged across three
  seconds would otherwise write one undo entry per frame and leave an
  abandoned import in the saved document. And **a part that wears a picture
  needs a renderer**: without one it falls through to the dashed `Unknown`
  card, which paints the flat surface colour and drops `surfacePaint` on
  the floor, so the picture is on the part and invisible.
- **A shelf card says what it offers** (`ShelfCards.tsx`, `shelfFacts.ts`,
  `tests/shelf-cards.mjs`). The owner's walk-through of the twelve
  categories, and the rules it left: an open category keeps every
  category's name on the row; sub-groups are plain purpose words and are the
  groups (footprint is a small tag, never the grouping); every card shows
  the thing fitted whole on the site's own page colour with the site's own
  words (`exampleContent`, never sample filler), one line of what it does
  (`doesOf`), and a badge: **Works now** or **Idea, needs building**, plus
  **Needs a key / a backend / Costs money** where true. A motion is shown on
  a small page of the site doing its one thing (`MotionDemo.tsx`), once
  under the hand, looping in the detail card. **A click opens the detail
  card and adds nothing**; its Add to page adds, picks, outlines and scrolls
  to the part. Dragging a card still places it at once. Whole-site features
  are **switches** (`switchOf`): a motion the live page runs is one of its
  parts on every page, the rest are Format fields the brief carries. A card
  used on the open page says "On this page: N parts" and jumps to them. The
  shelf's Motion category and the Motion tab link to each other
  (`studio:panel` and `studio:shelf` events). No fire round the cards.
- **The shelf is laid out like a page, in page order.** (Superseded for the
  open category by the card rules above: grouped by purpose.) `groupIntoBands` puts
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
  switched there. **The Inspector no longer shows it**: the page's fill and
  its textures are the site's look, so they are a section of the Look panel
  (`BackgroundInspector`, mounted in `LookPanel.tsx`) and the Element tab
  leads with the page's own elements instead. Picking the page there gives
  the roll of what is on it, each row a press away from that part's editor,
  with the way to Looks folded to a line at the foot. A tab named Element
  that says only where the fill went reads as an empty tab
  (`tests/element-leads.mjs`). **⌘X cuts it** (`cutBackground`: every page layer off, the
  fill flat, what went held), **⌘V puts it back** (`pasteBackground`), ⌫
  strips it the same way. Cut and paste on parts work too (`cutNodes` /
  `pasteNodes`); `cut()` and `paste()` pick by what is selected and what was
  cut last. What is held is a module variable, never persisted. The canvas
  menu has a Background submenu for the same three things.
- **A fill carries its own tile** (`fillLayers`, `FILL_TILE` in
  `parts/theme.ts`). One definition says what the page's fill is AND how big
  it is laid down, because a layer that goes out unsized is sized `auto` by
  CSS, and `auto` on a repeating gradient is one hairline down the left and
  one across the top rather than a grid. When it was missing, every consumer
  patched a size in privately and none agreed: the Look panel's swatch at
  8px, the board's page frame at 24px, the live page and the exported site
  at neither. `themeFrom` writes the fill as the `background` SHORTHAND
  (`<image> 0 0 / <size> repeat`) so the tile travels with the image into
  the preview, the frame and the site's `pageCss`, none of which set a
  second property. A miniature asks for a smaller tile (`SWATCH_TILE`); it
  does not overrule one it was handed (`tests/fill-tile.mjs`).
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
  - **The ground does not stop for a drag.** It used to: `Canvas.tsx` put
    `data-board-drag` on the root for the length of one and the ground held
    the frame it was on. That was paid for by a per-frame cloud repaint which
    no longer exists, and a pan with the whole ground running measures inside
    budget at both sizes, so both the pause and the flag are gone. See the
    ground's own rules below before putting either back.
  - **A shadow is a CSS variable, not a render.** `liftTheme` hands a part
    `var(--lift-shadow, <the shadow>)`, so an undragged board is exactly what
    it was; while the sun is being dragged `lightRig.ts` sets the variable on
    each part's box instead. One pass per animation frame however fast the
    hand is, geometry measured once when the drag begins (from the nodes'
    own x/y/w/h, never the DOM), surfaces off screen skipped, and the store
    written once — on the drop. Before: panning p50 16ms / p95 47ms, the sun
    p95 43ms and a 130ms stall. After: 1.3 / 16 and 1.4 / 8.
- **Every surface stands off the page under the lamp** (`Canvas.tsx`:
  `NodeView`'s `--lift-shadow`; the one rule in `globals.css`;
  `lightRig.ts`). `liftTheme` hands the shadow to the *part*, and exactly one
  thing in the library ever put it anywhere — the button primitive — so Place
  the light did nothing to a hero, a card, a gallery or a form. The box round
  a part is the surface every part has, so the value is carried on the
  wrapper and one rule puts it on that box; with no lamp there is no
  variable, the rule falls back to `none`, and an unlit board is what it
  always was. A part cut to a drawn outline is left out, because a
  rectangular shadow under a path is a shadow of the wrong thing. The lamp's
  space is the page *window*, and the rig measures parts in that same space
  or the drag and the render after it disagree by a pixel or two. A drop
  leaves the drag's values standing for the render to overwrite; a miss puts
  the committed lamp's own values back, because removing the property takes
  React's inline value with it and nothing re-renders to restore it.
- **The root is the Builder, and a test says a control is *visible*.**
  (`next.config.ts`; `tests/deployed.mjs`; the `onScreen` helpers in
  `tests/header.mjs` and `tests/board-layout.mjs`.) The deployment used to
  redirect `/` to `/site` the moment anything had been published into the
  repository, which turned the tool's own front door into the site it had
  built: the published page hides the shell with an injected `<style>` and
  passes `published`, so its bar is `cn(…, "hidden")` — tailwind-merge drops
  `flex`, keeps `hidden` — and what a person found was a site with no
  toolbar, no shelf, no panel and nothing saying where the Builder had gone.
  The published site is at `/site`, which is what Publish writes and what the
  book calls it; the root is the app.
  Every suite stayed green through all of it, because a query finds an
  element whose `display` is `none`: it has a role, it has a name, `count()`
  counts it. **Existence is not the assertion.** A control is there when it
  has an offset parent and a rectangle with both sides above zero, and the
  bar and every control in it are held to that. `tests/deployed.mjs` asks the
  deployment itself, over HTTP, because a redirect is not in the markup.
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
- **The timeline's view goes to where the boxes are** (`timelineView.ts`).
  Boxes are dragged wherever a person wants them, so the origin stops meaning
  anything within a minute: centring means the centre of mass of the boxes
  weighted by size, with the bounds of the whole set fitted inside a margin
  so nothing sits on an edge, and the holding wins where the two disagree.
  It runs **on demand** — the timeline opening, a drag ending, the centre
  button — never while a box is moving, and it reads the store's own spots
  rather than measuring the DOM. It animates there, and the animation writes
  the plot's transform straight to the element and commits to state once at
  the end: a render a frame re-renders every box and restarts the strand
  loop, and it measured at a 33ms beat, half rate. `viewAt` is the one answer
  to "where is the view", and the strands, the ground drag and a box being
  picked up all read it there.
- **A performance fix never degrades something a person can see without
  saying so.** Not the resolution, not the redraw rate, not the number of
  things on screen. If the only way to hit the number is to take something
  away, stop and report the measurement — the trade is the owner's to make,
  not the optimiser's. This is a standing rule, and it was written after the
  nebula pass below traded the cloud layers' independent headings for frames
  and did not say so plainly enough.
- **One weather, one implementation, four surfaces** (`ground.ts`). The
  workspace behind the page, the timeline's floor, the add disc and the
  drawing board all stand on the same hook. The discs used to keep their own
  copy, repainting the whole nebula on a 33ms `setInterval` — which against a
  16.7ms frame lands two frames on one beat and none on the next — and they
  skipped for exactly the reason the walls did. There is one implementation
  now and a `shape` option for the round ones. Do not grow a second.
- **The clouds move; they are not redrawn to move.** Four layers, each on its
  own canvas, each keeping its own heading, speed and slow turn, screened
  together with `mix-blend-mode: screen` over a CSS sky, at **full
  resolution**, slid and turned on the compositor with `translate3d` and
  `rotate` every frame, and repainted only on a resize, a distance change, or
  when a layer runs out of the material it was laid with. A recycle bakes in
  the turn and drift it had reached and resets the transform, so it is the
  same pixels in the same place; one layer to a frame, so even that fits in a
  frame. Never solve a judder here by changing a rate.
- **The original only held 60 because its layer never moved.** Before any of
  this the ground measured a clean 60fps with no late frame — and the cloud
  canvas's transform changed on 0 of 241 frames, because the motion came
  entirely from repainting the canvas 2.4 times a second. That is the judder
  J called two fps. A frame rate about this ground means nothing without the
  companion number: how many frames the layer actually moved on.
- **This container rasterises in software** (ANGLE/SwiftShader, confirmed
  through `WEBGL_debug_renderer_info`), so every compositing measurement
  taken here is a **floor, not a verdict**: four window-sized layers measure
  13.9fps here and are nothing on a graphics card. J runs hardware and made
  the call with the numbers in front of him. `docs/shelf/README.md` has the
  whole table. **Do not reduce the resolution, the layer count or the move
  rate to make a number on this box look better** — see the standing rule
  above, and take it to J instead.
- **Nothing draws a grid over the app, and no setting can bring one back.**
  The ground is nebula and nothing else — the Builder, the timeline and both
  discs, since they all stand on `useGround`. What was removed, all of it:
  the `.ambient-grid` div `ThemeProvider` put over every page, the `bg-grid`
  utility that drew it, the `--grid-line` colour it drew in, the
  `[data-grid]` attribute in both `ThemeProvider` and the pre-hydration
  `boot.ts`, the `effects.grid` setting, its switch on the showcase page and
  its field in `site.config.ts`. Do not add it back under another name.
  Three things that sound like it and are not, so nobody hunts for a stub:
  · `GRID` and `snapGrid` in `Canvas.tsx` are the snapping *rule* — 8px,
    nothing drawn, nothing measured against a picture.
  · `SCREEN.dots` in `core/ui/void.ts` is the texture on the plate editors'
    typing surface, a screen face, not the ground. One user, `PlateEditors`.
  · The Texture panel's `+ Grid` and `+ Dots` layers belong to the *site*
    being built and are drawn inside the frame. They stay.
- **The transform must undo the rotation of the offset baked into the paint.**
  This was the reset J was seeing. A layer is painted with the drift so far
  baked into the pattern and carried the rest of the way by
  `transform: translate3d(d) rotate(t)` — which is the matrix `T·R`, so the
  rotation turns the *baked* offset too. The layer therefore sat at
  `R(t)·laid + d` when it should have sat at `travel(now)`, and the error
  `(R(t) − I)·laid` grew with the drift and the angle together and snapped to
  nothing the next time the layer was laid. Measured at **32px** on
  near-violet. It read as irregular rather than as a cycle because a layer is
  laid again on either of two triggers, drift exhausting the margin or the
  turn passing `TURN_MAX`, and the two periods beat against each other.
  `carry()` turns the baked offset by the same angle and subtracts it, so the
  layer sits at `travel(now)` at every instant and being laid again changes
  nothing anybody can see. `spent()` measures that same carried distance,
  because that is what actually runs off the edge of the paint.
  **A transform jumping to zero at a laying is correct and expected** — the
  paint takes the offset, the transform gives up exactly what the paint took.
  Sampling transforms alone will therefore always look like a reset; what has
  to be continuous is `R(t)·laid + d`, which is what `tests/ground-seam.mjs`
  checks, against a control of frames where nothing was laid so the
  measurement's own noise is not read as a seam. `data-laid-at` on each layer
  exists only so that number can be worked out from outside. The same test
  also samples **the pixels under a fixed point on screen**, running the
  transform backwards to find which pixel of the layer's own bitmap is there,
  because the arithmetic would pass even if the paint came back different.
  `near-violet` is the layer a seam shows on first and the one that gets
  reported: its spin is the largest at 0.8°/s, so it is laid again every
  12.5s where the far layers take 50s and 67s. It is the canary, not a
  special case — there is one code path for all four and both tiles are the
  same 256px.
- **A layer is repainted by swapping a buffer, never by clearing one.**
  The ground was flickering black. Three causes were checked by name against
  a running page (`tests/ground-steady.mjs`), not guessed at: the holder
  being torn down and rebuilt (0 in 45s), a layer losing its backing store (0),
  a canvas resize (0). What was left is the repaint itself, and it had a
  window in it — `clearRect` and then a blended `fillRect` are two operations
  with an empty canvas between them, and an empty canvas is a black hole in
  the ground if anything at all lands between the two. So `paintCloudLayer`
  fills with `globalCompositeOperation = "copy"`: same pixels, one operation,
  no cleared state to catch. And a recycle paints an `OffscreenCanvas` the
  compositor is not sampling, which the visible layer takes through
  `transferFromImageBitmap` — a pointer swap, not a copy.
  **Do not turn that transfer into a `drawImage`.** It was measured both
  ways: painting the buffer and blitting it cost 33 frames over 80ms in
  forty seconds against 13 for painting in place, because a full-surface
  blit is a second full-surface raster. The transfer costs nothing and
  measured 5, with the beat going 18.9ms → 10ms. The layers therefore carry
  a `bitmaprenderer` context, so `getContext("2d")` on one returns null —
  anything that wants their pixels has to `drawImage` them into a scratch
  canvas first. A test that forgets is not a failing test, it is a silently
  passing one.
- **Never read a pixel back on or near a loop, and check before adding one.**
  A 60×40 `getImageData` off a ground layer on the deploy was timed at about
  **950ms**. That is not a GPU-to-CPU sync, which costs a few milliseconds;
  it is a whole composited layer being forced to rasterise synchronously,
  because the layers are window-sized, promoted with `will-change: transform`
  and blended with `mix-blend-mode: screen`. The audit that followed found
  **no readback on any loop in shipped code** — every `getImageData`,
  `toDataURL`, `toBlob` and canvas-to-canvas `drawImage` in `src/` is
  user-triggered and one-shot (texture import, body outline, reshape, tweets
  media, motion export), and the noise tiles are memoized behind
  `darkMatterTiles`. Keep it that way: one readback a frame would stall the
  compositor, and that is the blink.
  The number matters anyway, for the *write* path — if reading 60×40 off such
  a canvas costs that, rewriting the whole of one, which is what a recycle
  did, pays the same class of cost. That is the argument for the bitmap
  transfer above, and it came from a measurement on real hardware rather
  than from this container, which measures the same readback at **0ms** even
  with the old promoted-and-blended conditions rebuilt on purpose
  (`tests/ground-readback.mjs`). This box cannot see the phenomenon at all.
- **Nothing stops the ground, and there is no drag pause.** There was one: a
  `data-board-drag` flag on the root while the hand was down, and the clouds
  held where they were. It was bought when the clouds were repainted every
  frame to move them, so a pan and a full-surface repaint wanted the same
  main thread. Moving a cloud is a transform write now, so the bill stopped
  arriving. Measured with the whole ground running through a pan
  (`tests/pan-weather.mjs`, three runs): at a pane's size p50 3.9–4.1ms, p95
  5.6–6.0ms, max 11–13.7ms; at 1440p p50 9.6–10.2ms, p95 13.5–17.5ms, max
  29.8–97.6ms — the high max being a recycle landing inside the pan, which is
  the only cost left. The single run with the pause still in was no better
  (p95 17ms and 41.5ms, max 36.7ms and 128.8ms), so **no layer needed
  keeping**. Nothing reads or writes the flag now; `board-speed.mjs` sets it
  anyway, so that if anything ever starts reading it again the suite says so.
  Do not reintroduce a pause without measuring a pan first: the flag that
  could go on and not come off is how the sparks got stuck still, and the
  two problems went away together.
- **Nothing on this ground is ever completely still.** Darters used to sit at
  a dead stop between kicks; they idle now at `DART_IDLE`, a slow wander the
  kick swamps and decays back into. A spark whose life ends is relit *and
  drawn* in the same frame rather than skipped for one.
- **One ember in five is green, and it is the palette's own green.**
  `GREEN_IN = 5` in `darkMatter.ts`, fixed on the spark at the cast rather
  than rolled per life: a coin flipped each time a spark relights would
  flicker between the two colours and would land on 14% one minute and 27%
  the next. The stride is five against a cast of seventeen, so the green
  walks through all five kinds instead of settling on one, and every spark is
  lit at a fresh random spot, so there is no band or clump. The colour is
  `PROCESS.done` converted through `oklchToRgb` rather than an rgb triple
  written down, so the ground follows the palette if the palette moves — and
  it is rgb rather than an `oklch()` string because a canvas silently keeps
  the last colour it understood if it cannot read the new one. `castSize`,
  the drift and the sizes are untouched; only the ink changed.
  `tests/ground-clean.mjs` counts green against red off the ember canvas's
  own pixels. Read that number as a neighbourhood, not the ratio: it is
  *pixel area*, and a spark that is streaking covers more of it than one that
  is sitting, so it wanders either side of 20% run to run. The one-in-five is
  exact by construction.
- **Process state is red or green, and the names live in one place**
  (`PROCESS` and `ProcessState` in `threads.ts`). Red for every process
  unfinished or abandoned, green for every one completed; `running`, `cut`,
  `done`, and absent counts as done. The timeline's boxes and the bar's
  Finish key both read from there, and a third colour or a second vocabulary
  is not allowed in: it would make a legend out of a glance.
- **Finish reads dark, not bright.** The key was a mid-green slab with
  near-black glyphs, which on a dark bar is a shape that melts — the body the
  lightest thing there, the marks on it the darkest. It is a deep green slab
  with a bright green rim now, a white flag, and the counts lit in their own
  red and green at 13px, so the marks carry and the key holds them.
- **The timeline's view goes to where the boxes are** (`timelineView.ts`).
  Boxes are dragged wherever a person wants them, so the origin stops meaning
  anything within a minute: centring means the centre of mass of the boxes
  weighted by size, with the bounds of the whole set fitted inside a margin
  so nothing sits on an edge, and the holding wins where the two disagree.
  It runs **on demand** — the timeline opening, a drag ending, the centre
  button — never while a box is moving, and it reads the store's own spots
  rather than measuring the DOM. It animates there, and the animation writes
  the plot's transform straight to the element and commits to state once at
  the end: a render a frame re-renders every box and restarts the strand
  loop, and it measured at a 33ms beat, half rate. `viewAt` is the one answer
  to "where is the view", and the strands, the ground drag and a box being
  picked up all read it there.
- **A performance fix never degrades something a person can see without
  saying so.** Not the resolution, not the redraw rate, not the number of
  things on screen. If the only way to hit the number is to take something
  away, stop and report the measurement — the trade is the owner's to make,
  not the optimiser's. This is a standing rule, and it was written after the
  nebula pass below traded the cloud layers' independent headings for frames
  and did not say so plainly enough.
- **The ground is deliberately one field at half resolution.** Not an
  oversight and not a starting point: J was shown the numbers and chose it.
  The four cloud layers are screened together into one canvas, that canvas is
  slid on the compositor, and `CloudLayer.carries` names the one layer whose
  heading the whole field takes. What it costs is the layers' independent
  headings and their slow turns — the bloom where they cross no longer
  shifts. The restoration that gives those back is built, measured and kept
  at `docs/shelf/nebula-four-layers.patch`; it is on the shelf because it
  cannot hold 60fps here, not because it is wrong. **Do not "fix" the ground
  back to four layers without measuring on a machine with a graphics card
  first.**
- **The original only held 60 because its layer never moved.** Before the
  speed pass the ground measured a clean 60fps with no late frame — and the
  cloud canvas's transform changed on 0 of 241 frames, because the motion
  came entirely from repainting the canvas 2.4 times a second. That is the
  judder J called two fps. A frame-rate number about this ground means
  nothing without the companion number: how many frames the layer actually
  moved on.
- **This container rasterises in software** (ANGLE/SwiftShader, confirmed
  through `WEBGL_debug_renderer_info`), so every compositing measurement
  taken here is a **floor, not a verdict**. Blending and large layers cost
  real milliseconds here that a GPU does not charge for. Quote the numbers
  with that caveat attached, and never conclude a design is unaffordable from
  this box alone.
- **What the nebula costs, measured, so the trade is on the record.** At
  1440×900 in a production build on that software-rasterising machine, at the
  screen's own rate:

  | | board | timeline |
  |---|---|---|
  | the original: repainted 2.4×/s, layer never moves | 60fps, 0 late | 60fps, 0 late |
  | four layers, own headings and turns, full resolution, compositor | 13.9fps | 11.5fps |
  | the same at the original's half resolution | 13.3fps | 10.1fps |
  | the same with the slow turn frozen | 20.7fps | 17.6fps |
  | four layers screened into one canvas each frame | 24.1fps | 19.3fps |
  | one field, one heading, half resolution (what is here) | 60fps, 0 late | 59.8fps, 1 late |

  The cost is the number of window-sized layers the compositor samples every
  frame; blending is free at full resolution and dear at half, and per-frame
  rotation costs about a third on top. `docs/shelf/README.md` has the
  decomposition and how to measure it again.
- **The clouds move; they are not redrawn to move** (`ground.ts`). The
  workspace and the timeline stand on the same dark matter, and the way it
  travels is the rule: the whole cloud field is painted **once** onto a
  canvas bigger than the box, and slid every frame with `translate3d`. The
  content is repainted only when the material runs out (about every twelve
  seconds — the margin is kept small because the compositor pays for the
  layer's size every frame and a recycle costs four frames), on a resize, or
  when the distance changes — and the recycle bakes
  the drift so far into the paint, snapped to a whole backing pixel, so it
  puts the same pixels in the same place and cannot be seen. It is laid one
  layer to a frame so even that moment fits in a frame. The sky is a CSS
  gradient on a div, because it never moves. Only the embers are repainted,
  thirty times a second, which is what a streak needs.
  Do not solve a judder here by changing a rate. The clouds used to be
  redrawn every 420ms to move them, and 2.4 changes a second is what an eye
  reads as the nebula's frame rate whatever the page loop is doing — J called
  it two fps while the page ran at 357. Measured before and after, in a
  production build: the board 450fps → 360fps unthrottled, and 60fps with no
  late frame at the screen's own rate both times; the cloud content 2.25
  changes a second → none in four seconds, with the layer moving on 1,443 of
  1,443 frames.
  **Do not reach for `mix-blend-mode` to put the layers back together.** A
  canvas per layer would keep each one's own heading, and it costs half the
  frame rate where there is no GPU: measured at 1440×900, ground hidden
  60fps/0 late, four blended layers 29fps, one blended layer 43fps, one
  unblended layer 60fps/0 late. Blending a window-sized layer is the
  expensive thing, not moving it. The four layers are screened together
  inside the canvas instead, `CloudLayer.carries` names the one whose speed
  the field takes, and over a ground this dark screening onto it and
  compositing onto it differ by about a percent.
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
  A private copy is the bug — the keys panel kept its own five-value screen
  with every number a little away from the shared one — and so is a surface
  painted out of a third family: the trail's canvas was the shell's ground
  with its hue typed as 150, a green nothing else in the app is near. The
  suite measures the hue of every painted surface in the book and holds the
  keys panel to importing rather than redefining.
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
  **Make real** posts the drawing as a picture first and numbers second: a
  black-on-white raster of the strokes (`pictureOf`), announced as the thing
  to read the shape off, then the measurements for what a picture is
  imprecise about. Every drawing call carries it, a new part and a reshape of
  an existing one alike, and so does the body loop's critique step, which
  sends the drawing and the render side by side. It goes with the part as it
  is, the words, the frame width and
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
- The parts drawer drills down rather than listing 231 tiles: categories carry
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
  is invalid HTML and breaks hydration. `content-visibility: auto` keeps 226 of
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
  repository through the git data API, then calls `VERCEL_DEPLOY_HOOK` when
  set. It pushes `site/document.json` (the document; the app renders it at
  `/site`), `site/BLUEPRINT.md`, `site/blueprint.json` and any generated
  files. Paths are checked (`safePath`); files are capped. The token rides
  from the browser as `x-github-token` and `GITHUB_TOKEN` is the fallback;
  `GET` says only whether one would be found, never what it is. A site with
  no repository sends `create` and gets a private one made for it, named
  after the site — nobody is asked for a repository up front.
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
  is a token at all. The token is the server's `VERCEL_TOKEN` or the keys panel's
  `x-vercel-token`, server first, like the Claude key. A build outlives a
  serverless request, so the client polls (`watchDeploy` in `agent.ts`)
  rather than the route waiting. The deploy hook stays what it always was:
  a poke for a project not connected to the repository, which answers with
  nothing you can open. `tests/go-live.mjs` covers both halves.
- **`/builds` and `/` are the same door.** `features/builds` (the Sites/Repos
  front door) answers at both, and neither is ever redirected away — see
  "The root is the Builder" above for why `/` used to strand the tool on a
  publish and no longer does. Anything that has to keep working regardless of
  which alias it was reached through links to `/builds`, the name that says
  what it is.
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
- **The stand-in server.** sink's capture records every data request a page
  makes on its own as an API map with one sample answer per read
  (`sites/<name>/api/map.json`, sink `network.mjs`); Bring reads it in beside
  the document (`repoRun.ts` `standInOf`, `document.standIn`) and the store
  keeps it with the board (`standIn`, never in `studioDoc`). The advanced
  Build option **Stand-in server** (`build.standIn`, off by default) makes a
  built site (`public/stand-in.js`, loaded first by the layout) and a
  published one (`publishedDoc` carries it, `PublishedPage` installs it)
  answer those reads with their samples, by fetch or XMLHttpRequest: method, host and path, `:id` any
  one piece, a JSON-RPC or GraphQL read by its operation. Writes and anything
  unrecorded go to the network. A recorded live feed (WebSocket or
  EventSource, sink's `stream`) is replayed at its recorded pace in a loop;
  what the page sends on it goes nowhere, and an unrecorded feed is the
  browser's own. One copy of the answering:
  `standIn.ts` `STAND_IN_RUNTIME`. sink's capturer now declares
  `capturer.learn`, so Learn on click (`learn.ts`) sends. `tests/stand-in.mjs`.

- **Drawing with a site's style (style kits).** The owner: "if I have this
  theme of buttons on the Trump & Morty site, I should be able to select the
  theme for the button I'm drawing, so a cone would come out with the same
  shadow behind it, a lighting bar on it maybe, and then decide after it's
  drawn what colour and how it behaves". Four files, two pure:
  - `styleKits.ts` (pure) reads **kits** off every board's real parts:
    buttons, cards, panels and badges (`roleOf`), each kit its fill or
    gradient, border (an opaque inset ring counts), outer shadows (offset,
    blur, spread, colour, hard when unblurred), **lighting bar** (an inset
    light band, or a `::before` gloss strip laid inside the part: the Trorty
    remote keys' white at 0.35, 10px down, 12px in), shade, rim, corners,
    how its words are set, and its own `:hover` / `:active`. Parts that
    differ only in fill are one kit with those fills as swatches; at most
    four kits a role; named "<site> <role>" and then by what differs
    ("Trorty button, shadow to the corner"). The site's short name is its
    `$TICKER` when it has one (`siteShortName`). `motionsFromDoc` lists a
    board's captured animations that move, turn, scale or fade (never a
    background scroll or a clip wipe), plus its script marquee as a slide.
  - `wornShape.ts` (pure) is the drawn shape's record, `node.worn` (a copy
    of the kit, so the page never depends on the board it came from), and
    the geometry that makes a kit right on a non-rectangle: the **shadow is
    the outline moved**, never the box; an inset band is the outline less
    itself moved, turned with the shape's long axis and kept on the lit
    side; a gloss is a strip parallel to the long axis cut to the outline
    pulled in. Also the drawing basics: `nearlyClosed` / `closeLine`,
    smoothing, `snapOutline` (circle, ellipse, triangle, box, star; a blob
    stays), and `wornCss`, the part's own stylesheet (motion under
    `prefers-reduced-motion: no-preference`, hover and press).
  - `WornShape.tsx` draws it as one SVG in the part's pixels; `blocks.tsx`
    hands a node with `worn` to it after every hook. It is not cut with
    `clip-path` (that would cut the shadow off). The board draws it still;
    the Preview and the export play it, and the export is its own markup
    and `<style>`, nothing of the Builder's.
  - `DrawKits.tsx`: the picker is the space tool's tenant on the tool
    options bar (`toolOptions.tsx`): this site's kits, then every other site
    in Builds, then Plain (a space, exactly as before, and the default).
    With a kit in hand, a closed line drawn with S is a part wearing it
    (`Canvas.tsx`), and its part panel opens. Its options live in Lane G's
    part panel: Content has its words; Look has what it is (button with
    where it leads, following the site's list of places links may go;
    picture frame; decoration; section), colour (the site's roles first,
    then the kit's swatches, words switched to a readable colour under 4.5
    to 1), kit swap with a live preview, lighting bar, undo the snap and
    edit points; Motion has a motion list from every board with speed and
    strength, hover and press. The plain ones are Lane I's options data
    (`partOptions.ts`, source `worn`), drawn by `PartFields`; the ones that
    need a picture or a hand are `WornLook` / `WornMotion` in `DrawKits.tsx`.
  `tests/style-kits.mjs` (three sink boards, no browser) and
  `tests/draw-with-kit.mjs` (a cone drawn by hand on trumpmorty.fun, in
  geometry and in pixels, and exported) hold it. Committed shots, copied
  by hand from its run: [the source button beside the cone](docs/shots/lane-j-source-and-cone.png),
  [the picker](docs/shots/lane-j-picker.png), [its options in the part panel](docs/shots/lane-j-part-panel.png),
  [a cone with its lighting bar](docs/shots/lane-j-cone-with-bar.png) and
  [the exported page](docs/shots/lane-j-exported.png).

- **Start a new site: an original theme, rolled.** The owner has an idea and
  does not want to build on another site's theme unless he gives a design
  philosophy. Builds' **New site** marks the project `starter`; the Builder
  opens it on one sample page (`newSite.ts#startNewSite`, once, after the
  board has loaded: the board is not loaded on the Builds page). Files:
  - `siteTheme.ts` (pure): **the theme is one record** in five lockable
    groups. Colours: base hue, harmony rule (analogous, complementary,
    triadic, split complementary, single colour), light, dark or mid, chroma;
    made in OKLCH, each word colour moved in lightness until it reads at 4.5
    to 1 on what it sits on. Fonts: one of `PAIRINGS` (two faces at most,
    stacks every computer has, so the export needs nothing fetched). Shapes:
    corners, border, shadow style (none, soft, hard, glow) with **one light
    direction**, button size and shape. Layout: type scale ratio, spacing
    step, density, header, first screen and footer variants, cards in a row.
    Motion: calm, bouncy, snappy. `rollTheme` keeps locked groups, rolls the
    rest inside the philosophy's ranges; towards **Familiar** it starts from
    a captured style kit (`styleKits.ts`) and a known pairing, towards
    **Original** it rolls again until `kitDistance` (a point per look:
    accent in OKLab, corner roundness, border, shadow kind and depth) is
    past `minDistanceAt(originality)`. `readPhilosophy` maps words to ranges
    by rules and says back what it understood and what it did not; an
    artificial intelligence (AI) step could later read a whole sentence and
    suggest ranges for words no rule knows. `coherence` checks a page:
    contrast, one accent family, one radius family, one shadow direction,
    spaces on one scale. `themeCounts` is the reach by group.
  - `starterPage.ts` (pure): the sample page from generic parts only (box,
    prose, cta-primary): header with links to its own sections, first
    screen with a title, a line, an address bar whose Copy is the library's
    copy feature, two buttons, a row of cards, optional "Try these", footer
    with links, socials and small print. Each part carries its own look, as
    a captured part does, so board, preview and export draw one record.
    Ids are fixed by slot (`st_…`): a re-roll keeps words and links, and a
    part the last build made that the page no longer has stays deleted.
  - `tryThese.ts`: two or three shelf items from different categories, only
    those whose badge says they work when published (`statusOf`), never a
    site switch or a feature that needs a host part.
  - `ThemePanel.tsx`: the top of the Look tab for a site made here:
    Randomize, Familiar to Original, a lock per group with what it is now,
    the philosophy box, the Try these switch. Roll settings live in
    `look.themeRoll`, outside undo; the theme in `look.theme`.
    `store.applyTheme` is one undo step, named by `historyNames.ts`
    ("randomize theme: warm triadic, hard shadows").
  Three general fixes came with it: two pieces of words that link to
  different places are two controls, never one sentence
  (`reassemble.ts#linkedApart`); the on-open sweep reads a part placed by
  hand as his even when it carries padding or an edge; and a font with an
  exact `px` and no multiplier is drawn at that size (`applyFont`).
  `tests/site-theme.mjs` (50 rolls, distances, locks, philosophy, Try these)
  and `tests/new-site-theme.mjs` (New site, rolls, undo, locks, philosophy,
  Try these, export against board) hold it. Shots, six rolls and one
  philosophy: [roll 1](docs/shots/lane-j-roll-1.png), [roll 2](docs/shots/lane-j-roll-2.png),
  [roll 3](docs/shots/lane-j-roll-3.png), [roll 4](docs/shots/lane-j-roll-4.png),
  [roll 5](docs/shots/lane-j-roll-5.png), [roll 6](docs/shots/lane-j-roll-6.png),
  [a philosophy read into ranges](docs/shots/lane-j-roll-philosophy.png).

- **Components: a button and its stacked parts are one thing.** The owner:
  "make sure the builder properly understands and associates a button, its
  outline, its shadow, its animations and the text within it all as one
  thing". `components.ts` (pure) reads components back from the parts a
  capture stacked: a HOST (the part that paints the element and carries its
  link and states) and its LAYERS, each by job (words, lighting, shadow,
  outline, fill, icon, decoration). Kinds: tab (`tab “…”` labels), ticker
  (the band a running marquee is in), copy-address bar (a dressed control
  holding an address), and button, badge, card, panel from the style kits'
  own signals (`roleOf`, `lookOf`). Containment as everywhere else: the
  page path when both parts have one (and the layer is drawn on or beside
  the host), else the box; the innermost component owns a part; a
  component inside another is its child. A part a press shows (`state`) is
  read with that press's parts only; a captured component's layers are
  captured parts only (a shape drawn on it by hand stays its own).
  **Nothing is written to the document**, so the published page is what it
  was. Read once per board structure (not per drag frame);
  `rereadComponents()` after a drag or resize ends.
  - The board: a press on any layer of a button, badge, tab, copy bar or
    card picks the component (`owner.ts#ownerOf`), and those are grabbed
    whole like controls; panels and tickers stay drawn across (the owner's
    ruling for big holders), so a press on the picture in a panel or a
    ticker's running words picks that part; a move carries every layer and child (`ridersOf`); a
    resize lays every layer back on the host at its share
    (`resizedWith`), unsnapped so nothing drifts a pixel.
  - The Element list: one row per component, named by its kind ("Button:
    BUY $TRORTY") with "N layers", none of its layers a row of its own, a
    press picking the host (`partList.ts#foldComponentRows`); a row further
    down than the list has drawn is scrolled to by its place. Under "Show
    nesting" the tree shows it as one group, keeping the host's own name
    with "Button · 5 layers" beside it, its layers folded under it whatever
    the path said, each named for its job (`partTree.ts#foldComponents`). A
    component with no layers is just its part: no badge, no folding. After
    the back arrow, pressing the same part's row opens its panel again.
  - The part panel: Look leads with "This button": colours by job, each
    recoloured on the part that paints it as one undo (`recolour`), where it
    leads, under the hand, when pressed, motion, and its layers, each one
    press from being edited alone; a layer's panel says whose it is.
  - **What other lanes call.** Colour roles (Lane I): pass
    `{ countAs, kindOf }` built from `componentsOf(nodes, palette)` as the
    last argument of `siteRoles` (`SiteColours.tsx` does), and a button's
    parts count as one button. Learned library (Lane G):
    `componentsOf(nodes, palette).list` for every component and
    `componentSpec(nodes, comp, palette)` for one as plain data (kind,
    layers by job with boxes as shares of the host, fill, words, outline,
    shadow, lighting, radius, link, hover, press, motion);
    `countAsOne(nodes, ids, palette)` for any count of parts.
  `tests/components.mjs` (three sink boards) and `tests/components-board.mjs`
  (trumpmorty through the board; export identical after undo) hold it.

- **Better drawing: join, cut, words along a path, a picture mask; and
  "What is this?".** Two drawn shapes picked together show **Join them** and
  **Cut the front one out** in the panel (`JoinOrCut`, `DrawKits.tsx`).
  `combine()` in `wornShape.ts` samples both outlines and runs them through
  `polygon-clipping` (MIT): the result is `worn.poly`, every piece and hole
  as closed rings in the part's box, drawn even-odd, so the kit's shadow
  (the outline moved), lighting bar (clipped to it) and border all follow
  the new edge, a hole included. The back shape's kit, colour, bar and
  motion are kept; one undo gives the two shapes back. An **open line**
  drawn with a kit (`lineFromStroke`) is **words along a path**: an SVG
  `textPath` on the line (`PathWordsShape` in `WornShape.tsx`), lettered in
  the kit's fill, outlined in its border, with its first shadow; words,
  font, size, start and direction are in the panel, and any closed shape can
  carry words round its outline too. **A picture dropped onto any drawn
  shape** goes into it (`Canvas.tsx` onDrop, `insideOutline`), clipped to the
  outline with the kit's border and shadow round it. **What is this?**
  (`WhatIsThis`) is the first block of a drawn shape's panel, unanswered
  until chosen, with the kit's own kind marked "suggested": Button asks
  where it leads (a page or section of the site; an address only as the
  site's list allows, with the reason in words from `explainLink` in
  `parts/offsite.ts`: pump.fun kept, a DEX Screener (decentralised exchange
  screener) page of one contract address refused, X profiles refused);
  Picture frame asks for a picture; Section goes behind every part; Decoration
  opens Motion; Words along a path asks for the words. A drawn shape's
  Content keeps one words field, not two.
  `tests/draw-combine-rules.mjs` (no browser) and `tests/draw-combine.mjs`
  (Trump & Morty kit, in geometry, pixels and the export) hold it. Shots:
  [the question](docs/shots/lane-j-draw2-what-is-this.png),
  [join](docs/shots/lane-j-draw2-join.png), [cut](docs/shots/lane-j-draw2-cut.png),
  [words along a path](docs/shots/lane-j-draw2-path-words.png),
  [a picture mask](docs/shots/lane-j-draw2-mask.png),
  [where a button leads](docs/shots/lane-j-draw2-button-leads.png),
  [the published page](docs/shots/lane-j-draw2-exported.png).

- **Remake this picture from one prompt** (`RemakePicture.tsx`, `remake.ts`,
  `/api/studio/remake`, `tests/remake-picture.mjs`). The owner: "right-click
  any image on the site, type one prompt, make that image an instant
  reference, and by default have GPT Image 2 regenerate it with the prompt,
  replacing it at the exact same dimensions, with the same purpose and
  animations." Doors: the wheel's tray under a part holding a picture, a
  right-click on its row in the parts tree, and Remake… in its picture field.
  The picture's own file goes to OpenAI's image edit call as the reference,
  on the person's own key (keys panel, OpenAI, sent only as `x-openai-key`).
  The model is a setting (`studio.remakeModel`, default `gpt-image-2`); when
  the key cannot use it, the newest GPT image model it can is used and the
  card says so. The size asked is the nearest supported one (`askSize`), and
  the answer is fitted to the original's exact pixels (cover, centred),
  see-through kept. Only `picture` and `pictureVersions` change on the part,
  so its place, size, link, clip, motion, hover and press stay; its words for
  people who cannot see it stay, with an offer to use the prompt. Progress
  and Cancel on the part; one Undo step; a version strip in the picture
  field; files in the picture store, paths in the document, and a kept
  version's file is never thrown away when the picture is swapped.

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
  this browser no longer has, words hard to read (`wordsContrast`), parts off
  the page at phone or tablet width (the preview's own `placeNodes` until
  Lane D's check lands; swap it in `readBoard`), and buttons that do nothing
  (`badge.ts` `decisions`). Each line has Fix (where there is one) and Show,
  and Publish anyway is always there: the list informs, it never holds a
  site back. A clean board publishes straight away. A new kind of problem is
  one more block in `checkBoard`, read by the check that already owns it.
  `tests/publish-check.mjs`.
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
  module folder is the pattern (see `studio/store.ts`).
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
  stays as a silent fallback. This file used to say a GitHub token in a
  browser would do nothing; that was wrong, and Publish now pushes with the
  person's own. Adding a
  service to `SERVICES` means adding a header a route reads and an arm to
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
  its own. A held key is sent as a header and used for that one call when
  the server has none.
- **Never widen what a status route says.** A length, a prefix, a first
  character: each narrows a guess. Name and boolean, nothing else.
- **Undo names its step, and the steps are a list** (`HistoryControls.tsx`,
  `historyNames.ts`). A step is named by comparing the two documents either
  side of it, never by the action that took the checkpoint, so every kind
  of edit has a name without saying one: "Undo: move COPY CA". The list
  beside the keys shows the last fifty, newest first; a press goes there in
  one change of state (`travel`), not fifty undos. A new kind of edit that
  reads as "an edit" wants a line in `stepName`. `tests/undo-history.mjs`.
- **The save line** (`SaveLine.tsx`, a `status` item in the top bar, only in
  the Builder) says "Saved in this browser, 12:04" off `docStore.ts`'s
  `onSave`, never "Saving…" on every edit, and red when the browser would
  not keep it. It opens the backups, and once per site that was never
  backed up or published it opens by itself after ten edits (`nudged`).
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

## 10b. Running the tests

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
