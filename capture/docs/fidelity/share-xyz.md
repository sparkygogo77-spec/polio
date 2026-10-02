# share.xyz through the pipeline: what the export gets wrong, and where

Phase 1 of the fidelity lane, 2026-09-27. share.xyz is the owner's own site
(Next.js, prediction markets). Local run only: nothing was published, deployed
or put live. Three pages at 1440×900, headless, no wallet, no disclaimer:

| page   | route                              | captured          | exported          |
|--------|------------------------------------|-------------------|-------------------|
| home   | `/`                                | 3905 elements     | `index.html` 3.8 MB |
| event  | `/event/ai-bubble-burst-by/85299`  | 312 elements      | 229 KB            |
| league | `/league/nfl/b88aa7b2`             | 1178 elements     | 1.0 MB            |

Document: 3 pages, 5089 nodes, 8.5 MB, 218 pictures. Screenshots are beside
this file: `orig-<page>-{top,scroll900,full,hover}.png` is the live site in the
same headless Chromium, `ours-<page>-*.png` is polio's export served from disk.

## Converted again, 2026-09-30 (capture upkeep lane)

The committed captures (2026-09-28) converted again with today's converter
(`capture-site.mjs --reconvert --name share-xyz`; the live site cannot be
opened by this container's browser, so no retake), exported through polio
trunk 5244483 and compared with the live site as fetched by curl and served
from disk (its fonts, styles and pictures; its scripts' live data
unreachable). The markets on the page have moved since the capture (games
played, odds, a restricted-country banner), so what differs by data is left
out; what is ranked is what a page's structure decides: every visible run
of words on both pages, matched by its words, by area, with the drift a
taller card above carries down taken out.

| difference, most visible first | before | after | where it was fixed |
|---|---|---|---|
| lines of words 1–2px right of the page's (the logo word, the tabs, the banner line, every card's date, the side panel) | 68 runs at 1440, 58 at 2000 (home) | 0 | polio `parts/Text.tsx`: the glyph inset reaches outside the box, not into it (`tests/inset-room.mjs`) |
| the banner's "and" 18px above its line, on a 68px line | −18px | 0 | sink converter: a heading's own words among children set apart are set in the box the page drew them in (`tb`), on a `normal` line as tall as drawn (`check-words-placed.mjs`) |
| the search box empty | blank | "Search Markets" | sink converter: an older capture's empty field shows its placeholder, in the browser's own placeholder colour (a retake reads the page's) |
| the outcome rows "June 30" / "December 31", centred | cut, centred | "June 30, 2027", at the start | polio `parts/Cta.tsx`: a captured button's label is one label, commas and all (`tests/button-label-whole.mjs`); sink: a block button set `text-align: start` keeps it |
| YES / NO read "Yes" / "No", run into their price bar | lower case, overlapping | capitals, beside the bar | polio: the button takes its part's case and spacing; sink: folded words beside a part are set in their own box |
| "View Resolved", "Market ▾" centred | centred | at the start | sink: a flex-row button's words take their side from `justify-content` |

Share of the window differing from the live page (pixels more than 24 apart
in any channel; data changes included, so never near 0):

| page | 1440 top | 1440 +900 | 2000 top | 2000 +900 |
|---|---|---|---|---|
| home | 5.10 → 3.60% | 7.52 → 6.59% | 3.67 → 2.59% | 5.42 → 4.74% |
| event | 6.09 → 4.31% | 7.72 → 5.14% | 4.38 → 3.10% | 5.58 → 3.73% |
| league | 5.65 → 4.97% | 7.85 → 7.27% | 4.06 → 3.58% | 5.65 → 5.23% |

What is left is the data (today's games and prices, pictures the live
page's scripts would load), the price chart's axis labels (drawn by the
page's script), and a retake: the captures predate the dump's resting-state,
loader, loop-clock and placeholder-colour fixes.

## Integration (claude/capture-integration)

Re-captured with the integrated pipeline (`site/capture/capture-site.mjs
--url https://share.xyz/ --name share-xyz --pages "/, /event/…/85299,
/league/nfl/b88aa7b2"`; the page ids are now the paths' slugs) and exported
through polio `claude/trumpmorty-art` (db59f6b). `share-xyz/v2-orig-*` and
`share-xyz/v2-ours-*` are the pair at the top and one window down.

- **Tags stay their own words**: a span the browser computes as an image (the
  "Save 71×" badge, a venue tab's chip) is skipped by both arbiters, so it is
  never respaced by the join and never folded into the sentence it sits in
  (`check-tags.mjs`, red first).
- Fonts now come with the capture (24 face rules, self-hosted and
  cross-origin alike); background pictures, opacity, transforms and outlined
  type are recorded (see trumpmorty-fun.md).
- **Polio, not sink** (known on polio's integration lane, not chased here):
  every picture is a broken image in this export (the 9.3 MB document trips
  the importer's storage cap), and the sticky header's own white ground is
  drawn over the header's parts, so the top 113 px of every page is blank.

## How a capture gets from sink into polio today

1. `site/capture/capture-all.mjs` reads the one `routes.json` beside it (the
   SOLCINERATOR route list, hard-coded path) and runs `capture-route.mjs` per
   page into `site/capture/routes/<id>.json`, with bytes under `assets/source`.
2. `capture-to-document.mjs <routes.json> <out-dir> --assets <dir>` writes
   `<out-dir>/site/document.json` and `<out-dir>/assets/pictures/*` and prints
   the ledger. It is not fully site-agnostic: it dereferences `routes.sections`
   (`capture-to-document.mjs:687`) and crashes when the routes file has none.
3. By hand, the owner commits and pushes sink, opens polio's Builder, puts a
   GitHub token under Keys, and types `owner/sink` into the GitHub control;
   `repoRun.ts#readRepoSite` reads `site/document.json` and the pictures
   through api.github.com with that token (`repoRun.ts:285`, `copyOf` :215).
   There is no file, folder, URL or env-var door for a document: a capture must
   be committed to sink and pushed before the Builder can see it.
4. Locally the only bypass is polio's `scripts/export-site.mjs`, which fakes
   api.github.com from a folder with Playwright and asks the Builder for the
   export (`window.__studioExport`, `exportSite.ts:480`). That is what this run
   used; nothing was pushed for it.
5. A second site without touching SOLCINERATOR: its own folder, here
   `sites/share-xyz/{capture/routes.json, capture/routes/*.json, capture/ledger.txt,
   site/document.json, assets/pictures}`; run `capture-route.mjs` per page by
   hand (capture-all only knows the one routes file) and point the converter at
   that routes file with that folder as `<out-dir>`. `site/` and
   `assets/pictures` at the repository root stay SOLCINERATOR's. polio's
   importer still reads only `site/document.json` at the root, so a second site
   needs either a path setting in `repoImport.ts#MADE_HERE` or its own repo.

## Environment notes (not pipeline defects)

- The proxy re-terminates TLS and Chromium does not read the CA bundle;
  `certutil` had to add `/root/.ccr/ca-bundle.crt` to `~/.pki/nssdb` before
  `capture-route.mjs` could open the site. `curl` and Node worked without it.
- The proxy cut some transfers (`ws_closed_mid_exchange`): the first home
  capture lost four font files and two pictures ("could not fetch");
  `capture-route.mjs:218` fetches each byte once with no retry. The event page
  with `%3A` in its path answered "upstream request failed" twice; a different
  event was captured instead.
- Live site screenshots differ run to run (scores, odds, which app-download
  card variant shows, lazy-loaded logos). The originals here are one instant.

## The differences, most visible first

Cause key: **capture** = `site/capture/dump.mjs` never records it;
**converter** = `site/capture/capture-to-document.mjs` drops or mis-writes it;
**importer** = polio's `repoRun.ts` / `docTake.ts` drops it; **export** =
polio's renderer (`blocks.tsx`, `parts/theme.ts`, `exportSite.ts`) draws it wrong.

1. **Every picture is a broken-image icon** (team logos, the Share wordmark,
   the hero banner, the QR code, the phone). All three pages.
   Cause: **importer**. `repoRun.ts:110 MOST_PICTURES = 40` and
   `repoImport.ts:41 MAX_REPO_BYTES = 8 MB`; the document alone is 8.5 MB so
   `copyOf` (`repoRun.ts:234`) marks all 218 pictures "lost" and the export
   writes `<img>` tags with no bytes. Secondary: the document is that big
   because every node carries `from.selector` and full font objects
   (converter, `capture-to-document.mjs` node writer). A missing picture is
   then drawn as a pill with the file name ("banner.webp", "hyperliquid.png"):
   polio `parts/picture` placeholder. Fix: raise or remove the caps in
   `repoRun.ts#copyOf`, and slim the node in the converter.

2. **No rounded corners anywhere**: search field, hero banner, cards, odds
   pills ("5%"), Games/Futures tabs, the app card, Yes/No buttons are all
   square. Cause: **capture**. `dump.mjs` reads `border`, `boxShadow`, `pad`,
   never `borderRadius` (no `radius` key in any capture). Then **converter**
   has nowhere to put it and polio's node has only the `shape` enum
   (`blocks.tsx:283`) and the site-wide `format.layout.radius`. Fix: record
   `cs.borderRadius` in `dump.mjs`, add `node.radius` in polio
   (`store.ts` StudioNode, `parts/theme.ts#boxStyle`), write it in the converter.

3. **Cards lose their outline and lift**: the game cards are drawn flat with
   no ring; the original's ring is a `box-shadow` (`0 0 0 1px` + two soft
   shadows) on a transparent 1px border. Cause: **converter**. The capture has
   it (`shadow`, 233 elements); `capture-to-document.mjs:841` writes it as
   top-level `node.shadow`, but polio draws a shadow only from
   `node.edge.shadow` (`parts/theme.ts:185`, `:332`, trunk commit 0a85f05).
   Fix: write `edge: { …, shadow }` in the converter (ledger says "stored" 287×).

4. **The sticky header does not stick**: at scroll 900 the original still
   shows the header and category row; ours does not (`ours-home-scroll900`).
   Cause: **converter** + **export**. The capture records `pos: "sticky"` with
   its inset and z; the converter writes no `from.position` for sticky (ledger:
   "sticky: the box stays where it was measured", 7×) and polio's
   `fluidSite.ts:173` honours only `"fixed"`. Fix: converter writes
   `from.position: "sticky"` with the inset; `fluidSite.ts#fluidStyle` emits
   `position: sticky; top: <inset>` for it.

5. **Words folded into a box paint over the icon beside them**: "Unified",
   "Polymarket", "Hyperliquid" tabs; the "Yes"/"No" buttons ("Ye", "N"
   clipped); the "$2.6K Vol" rows; "Polymarket" pills. The tab's words were
   folded into the tab's whole box (`x 1016 w 83`) while its globe icon stays
   its own drawn-icon at `x 1024`, so the text starts under the icon and the
   `overflow: hidden` box wrapper (`blocks.tsx:240`) clips the rest.
   Cause: **converter**, the button/word fold (`capture-to-document.mjs:498`
   `kind === "button"`, and the "content, from the child that held the words"
   rule at :565). Fix: fold words only when the box holds nothing else, or keep
   the words' own box and let the button be a `box` behind them.

6. **Horizontal carousels spill across the page**: cards at x 1540 and 1906
   (page measured 2256 wide) are exported as `position: absolute` parts; on
   the home page the fourth NFL/CFB card overlaps the "Popular Leagues"
   column and runs off the right edge. Cause: **capture**. `dump.mjs` records
   every element's box but not the ancestor's `overflow`, so the converter
   cannot clip. Fix: record `cs.overflowX/Y` in `dump.mjs`; converter clips
   children to the nearest scrolling ancestor (or drops what is outside it);
   polio needs an `overflow` on the box wrapper or a carousel part.

7. **Hero headline is the wrong size and wrongly stacked**: "Polymarket" and
   "Hyperliquid" are 56px 600 on the site; the converter writes `font.size 3.5`
   and polio clamps to 2 (`parts/theme.ts:138 applyFont`, `CLAMP.size`), so
   they draw at 32px. The h1's own word "and" becomes a `value-prop` spanning
   the whole h1 box (`x 148 w 1143`) at 1.72×1.6 and floats above the line.
   Cause: **export** (clamp) and **converter** (heading with own word + spans).
   Fix: raise the clamp or let the converter pick a part whose scale reaches
   the measured size; split an h1's own words from its child spans by box.

8. **The price chart is drawn as a 200px sketch in the middle** of its 866×200
   box (event page). It is a drawn-icon with 3 paths and viewBox `0 0 866 200`
   but `options.size: 100` and the icon part fits the paths into a square.
   Cause: **converter** (writes `size 100` for a non-square SVG, `vector`
   writer) and **export** (`parts/drawn-icon` draws square). Fix: converter
   sets the icon's size to its box and keeps the aspect; the part honours a
   non-square viewBox. Note this is a live Recharts chart anyway (see below).

9. **"Save 71×" tags read "undefined"** in the tag's mint fill, and on the
   league page the card titles ("Cardinals vs 49ers") are gone, replaced by the
   tag's tooltip words "Save 71× in fees on Hyperliquid" (which the site hides).
   Cause: **converter**. The tag `span > span` becomes a `picture` node with
   `picture: null`, `label: "undefined"` and `content: "Save 71×"` (13 such
   nodes; the role rule chose picture with no `src`), and polio's picture part
   draws the label pill. The league title loss is the sentence/join rule
   (`join-arbiter.mjs`, "a sentence takes back the words of the elements
   inside it") taking the tooltip text as the card's line. Fix: never choose
   `picture` without `src`; do not fold a `title`/hidden text into a sentence.

10. **Category nav on the home page runs together** ("TrendingSportsPolitics…")
    while the same nav on event/league pages is right. The home capture placed
    each word flush against the previous (`Trending x 76 w 60`, `Sports x 136`)
    because the first home capture ran before the web fonts arrived
    (`capture-route.mjs:139 settle` waits for networkidle, not
    `document.fonts.ready`) and the nav was measured mid-layout.
    Cause: **capture**. Fix: await `document.fonts.ready` and a second layout
    pass before dumping.

11. **Link cards become buttons with centred words**: the app-download card is
    an `<a>` with a fill, so the converter makes it a `cta-primary` sized to
    the whole card (`316×58`, "Download the App") and polio centres the words
    over the "Markets Move Fast." line. Cause: **converter**
    (`capture-to-document.mjs:498`: `a` with `bg || border` → button). Fix:
    an `a` that holds block children is a `box` with a link, not a button.

12. **One-sided borders become full boxes**: the outcomes table on the event
    page gets a rectangle border; the site has only row dividers. Cause:
    **capture** + **converter**. `dump.mjs:91` reads the `border` shorthand
    and falls back to the top side; `NodeEdge` has one width for all sides.
    Fix: record four sides; add per-side widths to `NodeEdge` or draw a
    one-side edge as a 1px `box`.

13. **No hover states**: hovering a card on the site lifts its ring and
    tints the odds pill; the export has none. Cause: **capture**. `dump.mjs`
    reads computed style at rest only; nothing in the format holds a hover
    look. Fix: a second dump per interactive element with `:hover` forced
    (CDP `CSS.forcePseudoState`), written as `node.hover` polio would draw.

14. **Stroke widths and caps on icons**: every drawn-icon is outlined at 2
    units (ledger: 188× "the measured stroke width is not kept", 105× caps,
    95× joins). Visible on the chevrons and the "Unified" globe. Cause:
    **converter** + **export** (`vector.paths[]` holds geometry only). Fix:
    carry `sw`, `cap`, `join` per path.

15. **Font weights drift**: "Share" wordmark and card titles are heavier in
    ours; the ledger stores 161 weights it could not place (`fw … stored 161`),
    and the export's Inter comes from carried files, so metrics match but
    weight rounding does not. Cause: **converter** (`CLAMP.weight` to the
    hundred) — minor.

16. **Scrollbars**: the carousels' scroll buttons draw but nothing scrolls;
    the page has no horizontal scrollbar on the site (overflow hidden) but the
    export is 2256px wide. Same root as 6.

## What the site does that a static capture cannot hold

- **Live data**: scores ("LIVE Q2 14:55"), odds, volumes, the price chart,
  "in 3 hours" countdowns. A capture is one instant; `--sources` could name
  the feeds (the recorder was not run here).
- **Charts**: the event page's price history is a Recharts SVG redrawn on
  hover and on time-range buttons (1H…ALL); the export keeps one frame.
- **Carousels**: six horizontal rows with scroll buttons and momentum.
- **Sidebar and tabs**: collapsible league groups (Football ⌄), Buy/Sell,
  Games/Futures, the "Market" dropdown, the amount field, the search box.
- **Hero banner**: a static image (`banner.webp`), not canvas; the page has
  no `<canvas>`, `<video>` or WebGL, and three `requestAnimationFrame` uses
  (scroll/resize work). Entrance transitions on cards are CSS.
- **Lazy pictures**: logos load on scroll; a capture taken before they arrive
  gets the grey placeholder box.
- **App-card variants**: the "Download the App" card alternates green/black
  between loads.
- **Auth**: Log In / Sign Up, wallet state, restricted-country notice.

## Re-running

    node capture/site/capture/capture-route.mjs https://share.xyz/ sites/share-xyz/capture/routes/page_home.json --width 1440 --height 900 --assets sites/share-xyz/assets/source
    node capture/site/capture/capture-to-document.mjs sites/share-xyz/capture/routes.json sites/share-xyz --assets sites/share-xyz/assets/source > sites/share-xyz/capture/ledger.txt
    # polio: npm run build && npx next start -p 3013
    node scripts/export-site.mjs http://127.0.0.1:3013 /path/to/sink/sites/share-xyz /tmp/export
