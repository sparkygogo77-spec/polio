# From the captures to the document

`../document.json` is https://ccc-woad.vercel.app as the Builder's document,
the file the exact-copy path loads whole: nine pages, every visible element
of each as its own part at its own box. Made by declared rules only, against
polio trunk b73babb; `ledger.txt` is what the converter printed — for every
captured property, where it went (a typed field, a parent it folded into, a
CSS default, or nowhere), page by page.

## The files

- `routes.json` — the site's pages, read from its source (the zip in this
  repository's history, commit 9bd8288): two routes, `/` and `/docs`, and
  the eight sections of the sidebar, which switch in place on `/` and are
  each captured as the page they are on screen. `sections` says which page
  each sidebar button leads to.
- `capture-route.mjs` — one mechanical dump of one page or one state of it:
  the tree from `body`, every visible element with its real box, its own
  words and its computed styles; the page's `@font-face` rules; an icon's
  strokes with their geometry; a button's `title`.
- `capture-all.mjs` — every page in `routes.json`, into `routes/<id>.json`,
  with the bytes (pictures, font files) under `../../assets/source`.
- `capture-to-document.mjs` — the captures as the document.
- `sources-recorder.js` — where each live value comes from: runs in the page,
  records its fetch, XHR and WebSocket traffic, and matches each answer to
  the words it changed. See "Where the live values come from" below.
- `dump.mjs` — the dump itself, the one function both ways of capturing run
  in the page.
- `console-capture.js` — the snippet to paste into the console on the live
  site, with his own wallet connected; made by `console-capture.mjs`.
- `check-sources.mjs` — the check for all of it, against a stand-in page.
- `network.mjs` — the network recorder: every data request a page makes on
  its own (method, address with values redacted, status, answer shape, how
  often it comes back, a sample answer), gathered by the converter into
  `sites/<name>/api/map.json` and `api/samples/`. A live feed (WebSocket,
  EventSource) is read only: its first 50 messages with their timing and
  shape, secrets stripped, and what the page sent on a socket as its shape;
  nothing is ever sent on it but what the page itself sent. `--network` (on by default
  in `capture-site.mjs`, `--no-network` to leave it out).
- `held.mjs` — the presses an automatic capture holds back on the page: a
  form's button or words that write (`held: server-call`), words that spend,
  sign or connect (`held: wallet`); gathered into `doc.held` with the part and
  the live selector. A press in the states pass that tries to write is
  stopped before it leaves and held the same way.
- `learn.mjs` — Learn on click: the capture workflow's `learn` input
  (`{targets, pressesPerControl: 1, stopOnWallet: true, cap}`) pressed on the
  live site after the capture, once each, 2 s apart, stopping at any wallet
  prompt; a control in a canvas world's dialog is reached by pressing its
  character (frames held) and pressed by its recorded place in the dialog;
  `doc.learned`, `learn/run.json`, the screen each press left.
  The document declares `capturer: { learn: true }`.
- `check-network.mjs` — the check for those three, on a STANDIN site.
- `presses.mjs` — what a press did besides changing the page: a navigation by
  script or pushState, a window opened, a copy; and a wait for a panel that
  arrives late. The presses pass (`--states`) now presses a button on its own
  too (one of many alike first, `--singles-max`, default 40): where it went is
  its link, what it copied is `behaviours.presses`, a panel it brought is a
  state, a wallet's dialog it brought is held. `check-presses.mjs`.
- EFFICIENT PRESSES (`check-twins.mjs`): a control in an item of a list (a
  row, a card, a pet's dialog) at the same place and with the same words once
  its content is out is a twin; one is pressed, the rest are told what it did
  in their own words and marked (`behaviours.inferred`, a world dialog's
  `data-world-inferred`). A press is undone in place (Escape, the close
  control, the toggle or the tab that was on) and the page loaded again only
  when it did not come back or the address moved (`--reload-each`,
  `--no-twins` for the old way). A pet whose picture is known is not pressed
  again every frame. Pages of one template given are taken once
  (`templates` in routes.json) and linked to.
- `glide.mjs` — how the page's in-page links take a visitor to their
  places: each pressed from the top, the scroll read every frame, read as
  one rule (`behaviours.glide`: the time for a distance, the curve, where
  it stops). With `--behaviours`.
- `check-press-feel.mjs` — the owner's four from trumpmorty.fun, on a
  stand-in: a scripted glide read as its rule; a copy bar's "COPIED!" and
  toast read as a state with how long each lasted and where the toast came
  from (`states[].timing`); a hover that paints the item's background or a
  `::before` pill only there under it; a blink and a pulse read at rest, and
  a rule of many stops with its own timing functions, stop for stop.
- `audit-keyframes.mjs` — every animation on every site captured, its
  stops against the page's stylesheet (`--css`), and any part whose look at
  rest was caught mid-animation. An audit, not a check.
- `check-border-sides.mjs` — the check that an edge on some sides only (a
  footer's `border-top`, a bottom rule, sides of different widths, sides of
  one width in different colours) is recorded side by side (`bsides`,
  `bcolours`) and drawn on those sides only, with what the box holds as wide
  as on the page.
- `check-script-built.mjs` — what the PonsStars design preview showed, on
  stand-in pages: a page its script builds after load is read only once it
  stops changing (no element added or taken out and no change of height for
  1.5 s, no request in flight, at most 30 s: `--built`, `--built-quiet`),
  the wait said on stderr and kept as `cap.built`; a chart of canvases
  stacked in a table (Lightweight Charts) is a picture per canvas at its
  drawn size, place and stacking; the same chart copied as `<img>`s of
  `data:` addresses is carried from the addresses' own bytes, never
  fetched; words on one line beside elements keep their order and spaces
  (each run of an element's own words recorded with its box, `ot`, and put
  back by `inline-runs.mjs`: a sentence folds its words' children in as
  runs, a nav's bars become parts of their own between its links); pages
  that differ only by their query stay separate pages.
- `check-strokes.mjs` — the check that an icon keeps every stroke (straight
  lines, rounded rects, every SVG shape) and a card its `box-shadow`.
- `check-motion.mjs` — the check that a page's `@keyframes`, animations,
  transitions, `:hover` / `:focus` rules and iframes reach the document
  (`doc.keyframes`, `node.motion`, `node.embed`), and that a title split into
  per-letter spans is one part again. The fields: `docs/motion.md`.
- `check-fluid-type.mjs` — the check that type set with the window keeps
  its rule: the font-size an element takes as written, from its own rule or
  inherited (an `em` of it multiplied through), when it names a window unit,
  as `font.fluid` beside `font.px` (and per run for a folded title); and a
  `min-height: 100svh` box's own height, `vh.content`, for a shorter window.
- `check-overlays.mjs` — the check that a screen's filter survives: a
  scanline `::before` (repeating gradient), a vignette `::after` that is only
  an inset shadow, an overlay-blended wash that flickers, a 1px screen-blended
  line, and the label dimmed over them, each a part in paint order.
- `check-paint-order.mjs` — the check that parts come in the order the
  browser paints them: a band ranks by the z-index of the context it sits in,
  then its own (two ribbons crossing in a `z-index: 6` tape, the red one
  `z-index: 2`, the red one on top).
- `check-svg-paint.mjs` — the check that an inline svg is carried as the
  page draws it, each icon rasterised as carried against the page's own
  pixels: a turned shape (attribute, a group's, or CSS with its origin and
  box), outlines and fills together, a shape seen through, and it is kept
  whole with its computed paint and turns; a one-colour icon stays a drawn
  icon, its width and caps as `vector.stroke`, hard pixel edges as
  `vector.crisp`.
- `audit-svg.mjs` — the same measure on a live site: every inline svg the
  document carries, against the live element (`--agree` for a terms gate,
  `--shots` for the pairs). An audit to compare before and after, not a
  check: live pages move.
- `check-clips-turns.mjs` — the check that a rounded box that clips its
  overflow cuts its children to its inner curve (`inset(… round rx / ry)`,
  in the child's own frame: the TV screen's `28px/34px`, the CA bar's ends),
  that an elliptical corner keeps both radii (`radii`, `radiiY`), that what
  animates a turn is written about its `transform-origin` (`art.origin`) and
  what it holds turns with it (the antenna's ball), and that a grid's
  `justify-items` is kept (`layout.items`), and that what turns only because
  what holds it turns (a ribbon's words) says so, with its own transform
  apart (`art.turnsWith`).
- `check-units.mjs` — the check that an absolute or fixed layer keeps the
  units it was written in (`left: -16vw`, `bottom: 13%`, `width: min(62vw,
  860px)`, `background-size: cover`), the value the cascade picked, as
  `node.units`, with `units.of`: the block they are taken of (the window, or
  the positioned ancestor by its selector, its part and its box).
- `behaviours-recorder.js`, `behaviours-drive.mjs` — with `--behaviours`,
  what the page's scripts do to it: a loader, an intro, reveal on scroll, a
  header that changes once scrolled, layers that follow the pointer, a
  marquee, the loops that run forever; into the document as
  `doc.behaviours`, by part. `check-behaviours.mjs` holds it against a
  stand-in page. The fields: `docs/behaviours.md`.
- `check-rest-states.mjs` — the check that a look is read at rest (the
  pointer off the page, never the first frame of a transition back from a
  hover), that `:hover` and `:active` are kept apart (`motion.hover`,
  `motion.active`), that a part inside a rounded box that clips is cut to
  its curve, that a loader's switch-off is timed from the navigation
  (`loader.nav`), that a loop says which clock moves it (`clock`), and that
  a cookie banner's choices are never pressed.
- `keep-owner.mjs` — run by `capture-site.mjs` on every retake: what the
  converter never writes (a feature and its settings, a part placed by
  hand, a lock, a drawn part) is carried from the document as it was.
  `check-keep-owner.mjs` holds it on trumpmorty.fun's own document.
- `tools/` — comparing a copy with the live site, at 1440 and 2000:
  `compare-shots.mjs` (the two side by side, and how much differs),
  `compare-geometry.mjs` (a thing named by its words, at rest, hovered and
  pressed: its box, shadow, transform and whether its corners are cut),
  `motion-timing.mjs` (when the loader starts to go, from the navigation;
  each ribbon's step a frame and clock). `tools/check-tools.mjs` holds them
  to two stand-in pages. They launch the browser as `capture-route.mjs`
  does (`CHROMIUM`, `CHROMIUM_ARGS`, the HTTPS proxy).
- `ccc-capture.json` — his original dump of `/`, 2026-09-21, kept as the
  record. The document is made from `routes/page_home.json`, taken the same
  way at the same size, so all nine pages are measured alike.
- `routes/*.json` were re-taken on 2026-09-30 (`capture-all.mjs`, 1763×1427),
  so the footer's `border-top` is recorded on its top only (`bsides`, see
  `check-border-sides.mjs`); the site itself had changed since 2026-09-22
  (its figures, its logo, its chips), and the document is made from the
  re-take.

To make it again, from the repository root:

    node capture/site/capture/capture-all.mjs
    node capture/site/capture/capture-to-document.mjs site/capture/routes.json . --assets assets/source > site/capture/ledger.txt

## Where the live values come from

A capture can also say where each live value on the page comes from — the
SOL price from a price service, refreshed every few seconds; a balance from
an RPC call that carries the wallet's address — so the Builder can later
offer a working feature in its place. Two ways to take it:

**By hand, on the live site (the real wallet).** Open the page, connect the
wallet, get it showing what should be captured. Open the console (F12 →
Console; Chrome may ask you to type `allow pasting` first), paste the whole
of `console-capture.js`, press Enter, and **leave the tab open and in front
for about 60 seconds** — a value that refreshes has to be seen refreshing
more than once for its interval to be known. A `capture-<page>.json` file
downloads at the end; nothing is sent anywhere. It only sees traffic from
the moment it is pasted, so a socket the page had already opened is not
seen, and it cannot read the accessibility tree, so the roles the headless
capture writes are not in it. To watch longer or shorter:
`node capture/site/capture/console-capture.mjs --seconds 90 > site/capture/console-capture.js`.

**Headless, with the stand-in wallet.** `--sources <seconds>` on
`capture-route.mjs` or `capture-all.mjs` injects the same recorder before
the page's scripts and watches each page that long after it settles:

    node capture/site/capture/capture-all.mjs --sources 60

Either way the capture gains an optional `sources` section and each element
fed gains `feeds`, and the converter carries it into the document as its
own top-level `sources` section, naming parts by id. A capture without it
converts exactly as before, and the document has no `sources` key at all;
polio's importer reads only the fields it knows and ignores it. In the
document:

    "sources": {
      "version": 1,
      "sources": [{
        "id": "src_108b6094", "kind": "fetch", "method": "GET",
        "url": "https://…/api/price?ids=SOL&vs=usd&api_key=[redacted]",
        "count": 9, "everyMs": 5000, "steady": true, "needsWallet": false,
        "redacted": ["api_key"], "status": 200, "type": "json",
        "sample": { "solana": { "usd": 157.0514, "usd_24h_change": -1.2345 } },
        "pages": ["page_home"]
      }],
      "feeds": [{
        "part": "n_prose_3", "page": "page_home", "source": "src_108b6094",
        "path": "solana.usd", "everyMs": 5000, "confidence": 1, "seen": 9,
        "shown": "$157.56", "needsWallet": false
      }]
    }

A source is one address (with its RPC method, for a JSON-RPC POST); `kind`
is fetch, xhr or websocket; `everyMs` is the median gap between its answers
and `steady` whether they all came within a quarter of it; `sample` is its
first answer, cut to a few levels. A feed is a part whose words changed
within two seconds of an answer to show a number in it — as displayed:
rounded, with `$`, commas, K/M/B or `%`; `scale` is there when the page
showed it scaled (`1e-9`: lamports shown as SOL). `confidence` grows with
how many answers it followed and how many digits matched, and drops when
the same words matched more than one path; `alternatives` counts the ones
that lost. A source or a feed is `needsWallet` when its address or request
carried the connected wallet's address.

What is never kept: header values (only `auth: true`, that one was sent),
query parameters named like a key, token, secret, signature or password,
and any value that looks like one — a JWT, a UUID, a random token, a
signature, a long base64 blob, a 64-byte key, a seed phrase — each written
`[redacted]`. A public address (a mint) is kept; the connected wallet's is
written `{wallet}`, everywhere, and is never stored.

## What a captured element is, before what it looks like

Every element carries the role the browser's accessibility tree computed
for it, its accessible name, its states, and for a field its type and
placeholder. The part is chosen from the role first — heading, paragraph,
image, button — and from shape only where the tree gave none. Where the
library has no part for a role (link, navigation, banner, main,
complementary, contentinfo, list, listitem, textbox) the look stays exactly
what the shape rule draws, and the role travels anyway: in the label every
surface shows (`textbox “Ask or search...”`, `link “Documentation”`), in the
prompt the blueprint writes, and for textbox, button and link in `data`,
which the blueprint writes under "What the backend must provide", with type,
placeholder, name and state. The accessible name is what recovers the
sixteen icon-only documentation links and the header's person button, which
had no words on the page. His search field is a `textbox`: the page declares
no search role, so none is written, and its placeholder travels as evidence.
A typed field for the role would be cleaner than label, prompt and data; that
is a change to polio's node, not to this converter.

## What a captured element becomes

Its own part, at its own box, chosen by what the element itself draws. Own
words on a heading are a `value-prop`, on a painted or edged button or link
a `cta-primary`, otherwise `prose`; an `img` is the `picture` part holding
`node.picture`, a reference to a file under `assets/pictures/` committed
beside the document; an `svg` whose strokes were captured is a `drawn-icon`
holding them as `node.vector`, drawn as outlines or fills as the page drew
them; any element with no words of its own is `box`, the plain part that
draws nothing of its own. Every node carries what the capture recorded of
its box in the four node fields — `layout`, `pad`, `edge`, `text` — except a
button, which draws its own edge and padding. The face a part is set in
(`font.face`) is carried in `look.fonts` with its file, Latin subset only,
by polio's own rules (`fonts.ts#carryFaces`); a generic keyword such as
`ui-monospace` is the machine's own face and is named as such.

Every SVG shape is captured as the path that draws it: `path`, `line`,
`rect` (rounded where it has `rx`/`ry`), `circle`, `ellipse`, `polyline`,
`polygon`. A straight line's box has no width or no height and is kept all
the same: before that, the upright of his "$" and the lid of his trash can
were dropped. A stroke's cap and join are recorded (`cap`, `join`) and go
nowhere in the document, because `vector.paths[]` holds only geometry. A
`box-shadow` is recorded as `shadow`, as the browser computed it, and
carried as `node.shadow` on the part; polio has no field that draws it yet.
The committed captures predate both, so they keep what they had until the
site is captured again.

There are no groups: a container is a box holding its children by geometry,
and nothing else wraps them. Nothing enters `look.texture`.

An `href` whose path is a route of the site is `{ kind: "page" }`, a page in
the document; anything else stays an address. A sidebar button carries the
page its section was captured as.

## The wallet, and what the capture cannot answer

The sidebar and every section it leads to render only with a wallet
connected. A headless browser has no wallet, so the captures of `/` and its
sections use a stand-in Phantom provider (`--wallet`) with a fixed key that
signs nothing. The address on the wallet button is the stand-in's, not his;
the live numbers (SOL price, the burn feed) are whatever the site showed at
the moment; every section shows what it shows a wallet that holds nothing.

Words set in `ui-monospace` were measured in this machine's monospace face,
which is wider than the one his capture was measured in: the same label
came in at 85px on his machine and 92px here. Words set in Press Start 2P,
a carried face, measure the same on both.

## A button is a button, in its own clothes

Every element the tree calls a button, its words on it or in a child, is
the `cta-primary` part carrying those words (polio trunk b73babb: "the node
where the node spoke, the part's own where it did not"). A button node
says everything the capture measured — `colour.text`, `colour.bg` when it
had a fill, `font`, `text.align`, `edge` as measured or an edge of none,
`pad` — and the part stands aside for each. The span that held the words is
folded into the button; the icon beside it stays its own drawn-icon. Where
the fill could not be carried (an `oklab()` tint the document does not
read) the variant is outline, never a solid accent the page did not have.

One gap remains on the polio side: the wrapper draws a node's edge and
padding but not its fill, which `Fill` paints inside the padding, so a
padded button with a fill (the active sidebar entry) shows its fill inset
by the padding rather than to the edge of its box.

## What trumpmorty.fun and share.xyz showed the capture losing

`check-capture-fixes.mjs` holds a stand-in page with one of each, and what
each now becomes:

- **A button folds only what looks like it.** Children holding a button's
  words are folded into it when they look alike (colour, size, face,
  weight) and paint nothing of their own; else each is its own part, and a
  button whose words were all in them is the box they sit in. trumpmorty's
  `.ca` (CA on yellow, the address on dark, COPY on teal) is three parts,
  and a remote key's `<small>00</small>` is its own line, the key's HOME set
  where the page drew it (`tb`, the box round an element's own words).
- **Pseudo-elements that draw.** A `::before` / `::after` placed absolute
  that paints a fill, a background, an edge, a shadow or words is recorded
  as a child (`t: "::before"`, placed by its resolved left, top and size in
  its containing block) and becomes a part named `… > article::before`: the
  roadmap's dots, the dot patterns, the drips, the keys' gloss.
- **What a script grows.** The scroll-through looks at every element with
  no box at the top at each step; one that grew (the roadmap's fill) keeps
  the largest box it was seen at (`grown`).
- **Boxes as laid out.** Each element is measured with its own transform
  lifted, so a tilted ribbon's box is its own, not the box round its
  rotation; `ptf` is everything that moves it as one page-space matrix, and
  becomes `art.transform` about the part's centre. A capture says so with
  `untransformed: true`; one taken before keeps its old reading.
- **Clipping.** `ov` is a box's overflow and padding box; a part wholly
  outside the boxes that clip it is not drawn, one across the edge carries
  `art.clipPath: inset(…)`. A `relative` box after an overlapping z-auto
  band paints after it (share.xyz's headline over its backdrop).
- **In-page anchors.** `href="#lore"` is `{ kind: "node" }` to the part the
  element with that id (`domId`) became.
- **One address, one file.** `--assets` keeps each fetched file under a
  hash of its whole address and its name (`asset-name.mjs`): by name alone,
  share.xyz's `/_next/image?url=…` pictures were all one file. A face file
  declared for several weights is carried once, with a weight range.
- **What was cut on the way in** (a stylesheet, face, picture or script the
  proxy aborted) is asked for again before anything is measured; what still
  fails is in the capture as `missing`.
- An edge on some sides only (`bsides`) travels as inset lines on
  `edge.shadow`; `color(srgb …)` words and fills are carried as the colour
  they look.

## Any site, from the Builder

`capture-site.mjs` runs the same capture and converter for an address
typed in, into its own `sites/<name>/` beside the others; the root
`site/` is never written. `.github/workflows/capture.yml` runs it from
the Actions tab or from the Builder's "Capture a site" dialog
(`workflow_dispatch` with `url`, `name`, `pages`) and pushes the folder
to `captures/<name>` with `GITHUB_TOKEN` alone. Its check:
`node capture/site/capture/check-capture-site.mjs`. The converter also writes
`sites/<name>/ledger.json`, a machine-readable copy of `capture/ledger.txt`;
it is ignored (`.gitignore`) and the workflow takes it out of its commit, so
only `ledger.txt` is kept. The whole shape is in polio's
`docs/capture-from-builder.md`.
