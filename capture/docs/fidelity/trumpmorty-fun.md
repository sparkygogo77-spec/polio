# trumpmorty.fun through the pipeline: what an artistic site loses, and where

Fidelity lane 2, 2026-09-27. trumpmorty.fun is the owner's own site: one hand-made
HTML page (`assets/css/style.css`, `assets/js/main.js`), a cartoon landing page
built from web fonts, layered background pictures, hard offset shadows,
outlined display type, rotated stickers, a CRT loader on a canvas, a dust
canvas, a marquee and a DEX Screener iframe. Local run only: nothing was
published, deployed or put live. The old contract addresses on the page are
obsolete and were ignored. Read `docs/fidelity/share-xyz.md` first: this
report only adds to it.

| capture              | route | what it is                                                        | captured     |
|----------------------|-------|-------------------------------------------------------------------|--------------|
| `page_home`          | `/`   | as the pipeline sees it: straight after load, loader still up     | 258 elements |
| `page_home_settled`  | `/`   | loader gone, every `.reveal` section scrolled into view first     | 242 elements |

Both at 1440×900, page 1440×6094, headless. The settled capture was taken
through `sites/trumpmorty-fun/capture/pw-settle.cjs`, a Playwright stand-in
handed to `capture-route.mjs` by `PLAYWRIGHT_MODULE`; no capture code was
changed. Document: 2 pages, 445 parts, 0.7 MB, 1 picture. The export is
`index.html` (196 KB) and `settled/index.html` (181 KB), `assets/site.css`
2 KB, one picture. Screenshots beside this file: `orig-home-y<scroll>.png` is
the live site in the same headless Chromium at that scroll offset,
`orig-home-loader.png` is the site as it stands when `capture-route.mjs`
dumps, `orig-home-full.png` the whole page; `ours-home-*.png` is polio's
export of the settled capture served from disk.

The site itself is not a next.js app and is a single route, so the "one
route per page" pipeline fits it trivially; the whole cost is in what the
dump does not read. `site/capture/dump.mjs` records box, display, flex,
padding, margin, border (one side), colour, background colour, font, text
transform, letter spacing, shadow, position, inset, z, src and the svg
strokes. It records **nothing** of: `background-image` (pictures or
gradients), `opacity`, `visibility`, `transform`, `filter`,
`mix-blend-mode`, `text-shadow`, `-webkit-text-stroke` / `paint-order`,
`clip-path`, `border-radius`, `overflow`, `animation`, `transition`,
`cursor`, `object-fit`, `aspect-ratio`. The ledger's key list is the whole
vocabulary: align aria bg border cap color cols d dir disp ff fill fs fw gap
h href ins join just lh ls mar maxw minh name pad pos role shadow src stroke
sw t ta text title tt vb w x y z. An artistic page is made of the missing
half.

Cause key as in the share.xyz report: **capture** = `dump.mjs` /
`capture-route.mjs`; **converter** = `capture-to-document.mjs`;
**importer** = polio `repoRun.ts` / `docTake.ts`; **export** = polio's
renderer (`blocks.tsx`, `parts/theme.ts`, `fluidSite.ts`, `exportSite.ts`).

## Integration (claude/capture-integration)

The three lanes' branches are merged here (radius / edge.shadow / sticky /
word-fold / tags / sections; the artistic capture; the capture workflow).
`orig2-home-*.png` and `ours4-home-*.png` are the live site and the export
after re-capturing with `site/capture/capture-site.mjs` (the integrated
pipeline: `--url https://trumpmorty.fun/ --name trumpmorty-fun`), exported
through polio `claude/trumpmorty-art` (db59f6b). New on this branch:

- **The hero title sits above the planet**: a part paints in the stacking
  context of its nearest `relative` ancestor with a z-index (the title's
  wrapper is `relative; z-index: 3`), so it is written after the z-auto
  planet band. `check-art.mjs` asserts it. A `sticky` ancestor's z-index is
  not used, so the root capture still converts byte for byte.
- `clip-path` is recorded (`node.art.clipPath`).
- The capture retries a fetch the proxy cuts, up to three times.

Still polio's: gradients on the terrain, and everything under "Still wrong
after phase 2" that is drawn, not written.

## Phase 2: what was fixed on this branch, and what the export shows now

Commits `ce43a78` and the one after it, on `claude/trumpmorty-fidelity`.
`ours2-home-y<scroll>.png` beside this file is the export after the fixes;
`ours-home-*.png` is before. The stand-in check is
`node capture/site/capture/check-art.mjs` (red on the code before, green after):
a page served on two hostnames of one local server so its font stylesheet
is cross-origin like Google Fonts, with a background picture and gradient,
a 5% grain sheet, a loader that removes itself, a reveal-on-scroll
paragraph, an outlined rotated title and a WebP picture.

| item | done | before → after |
|------|------|----------------|
| 1. web fonts from a cross-origin stylesheet | yes | 0 face rules, Arial everywhere → 17 rules, VT323 / Luckiest Guy / Fredoka (7 weights) fetched and carried (`capture-route.mjs`, after the dump: reads each `faces.links` stylesheet with the browser's request context, parses `@font-face`, pushes into `faces.faces`; the `--assets` loop then fetches the woff2 files). The export loads all three. |
| 2. background-image and gradients | yes, partly drawn | not recorded → `dump.mjs` records `bgi` + `bgo`; `capture-route.mjs` lists every `url()` for `--assets`; the converter carries the first `url()` as the box's own `node.picture` (9 boxes: the sky, the planet layers, the loader still) and keeps a gradient in `node.art.background` (8, stored: polio draws no gradient). The hero's sky and planet draw; the pink terrain is a gradient + clip-path and does not. |
| 3. WebP / JPEG / GIF / SVG pictures | yes | 1 picture (PNG) → 10 (`site/capture/image-size.mjs`, used by `pictureFor`; the record keeps the source extension and type). The TV still, both lore stills, the planets and the footer face draw. |
| 4. opacity, mix-blend-mode, filter | recorded; the invisible layer dropped | `dump.mjs` records `op`, `blend`, `filter`, `bfilter`, `inert`; the converter writes `opacity` on the node and the rest in `node.art`, and drops a layer that paints nothing (opacity ≤ .05, or inert and empty, or inert and fixed outside the window). The `.grain` sheet and the toast are gone, so nothing is pinned any more: the eyeballs, "CH 47 LIVE" and the planet pills stay in the hero (`ours2-home-y900` … `y5400` show none of them). polio does not yet draw opacity, blend or filter. |
| 5. text-stroke, paint-order, text-shadow, transform | recorded, not drawn | `dump.mjs` records `tsh`, `tstroke`, `porder`, `tf` (the matrix), `anim`; the converter writes them into `node.art`. polio's `NodeText` / `applyFont` still draw none, so the sticker type is flat and the rotations are level: that is polio's part of the fix (`parts/theme.ts`). |
| 6. settle | yes | `capture-route.mjs` now awaits `document.fonts.ready`, then waits up to `--settle` seconds (12) for a fixed element covering ≥90% of the window to be gone or to have stopped animating, then scrolls through the page once and returns to the top before the dump. The loader is no longer in the capture and every `.reveal` section is shown; the `pw-settle.cjs` stand-in is deleted. |

Still wrong after phase 2, in order of visibility:

- **The hero title is hidden under the planet picture**: "TRUMP & MORTY"
  and the ticker badge are there in the document but the
  `planet-orange.webp` layer (an absolute `img`, 1180×1180, `z-index: -1`
  on the site) is drawn after the flow, over them, because the converter
  keeps only the order of positioned bands and never a negative z
  (ledger: "the number itself is not kept"). Fix: **converter** writes a
  band with z < 0 before the flow; polio draws `from.z` when present.
- **The pink terrain and the section skies are flat**: gradients
  (`node.art.background`) and `clip-path` are not drawn; polio needs
  `background-image` on the box wrapper (`parts/theme.ts#boxStyle`).
- **The sticker type is flat and the stickers are level** (item 5): polio.
- The marquee still runs as one level red band (overflow and the
  quadrupled words: share.xyz #6 and the converter's word rule).
- Radius, `node.shadow`, word-fold, one-sided borders: the other lane's.

## New differences, most visible first

1. **Every positioned part of the hero is pinned to the screen and rides
   over every section**: the three eyeballs, "CH 47 ● LIVE", the
   "planet-ring.webp" pill and "planet-orange.webp" pill sit at the same
   viewport spot in `ours-home-y900` … `y5400`, over THE LORE, the buy
   cards, the chart and the remote (65 `position: fixed` in the export, the
   site has 3). Cause: **capture** → **export**. The site's film-grain layer
   `.grain{position:fixed;inset:0;z-index:900;background:url(grain.png);
   opacity:.05;mix-blend-mode:multiply}` is dumped as a bare fixed
   1440×900 box (no opacity, no background-image, no blend mode recorded),
   the converter writes it as a fixed `box` (`body > div:nth-of-type(2)`,
   `from.position: "fixed"`), and polio's `fluidSite.ts#place` (line 173,
   `C.position === "fixed"` → `f = "both"`) then hands that `fixed` down to
   every positioned part its 1440×900 box catches, which is the whole hero.
   Fix: `dump.mjs` records `opacity`, `visibility`, `pointerEvents`,
   `mixBlendMode` and `backgroundImage`; the converter drops a box that
   paints nothing (opacity ≤ .05 and no children, or `visibility: hidden`)
   instead of writing it; and `fluidSite.ts#place` should pin only parts
   that are the fixed band's own descendants by selector, never by geometry
   (the `inside()` test at :189 already exists for the height rule).

2. **No web fonts: Luckiest Guy, Fredoka and VT323 all fall back to the
   system sans**. The wordmark, "TRUMP & MORTY", "THE LORE", every button
   and the CA field read in Arial. Cause: **capture**. The faces come from
   a Google Fonts stylesheet (`fonts.googleapis.com/css2?family=Luckiest+Guy…`),
   which is cross-origin, so `document.styleSheets[i].cssRules` throws and
   `dump.mjs` records `faces: []` and only the `<link>` href
   (`capture-route.mjs` prints "0 face rules"); `capture-route.mjs:213`
   then has no font sources to fetch and the converter writes the three
   faces as "carried (0KB)". The export's `font-family: Fredoka, …` has no
   `@font-face` behind it. share.xyz's fonts were self-hosted, so this never
   showed. Fix: in `capture-route.mjs`, fetch each stylesheet `<link>` the
   page loads (or read them through CDP `CSS.getStyleSheetText`), parse its
   `@font-face` rules with the page's own UA so Google serves woff2, and
   pass them to the dump as faces with sources; the converter then carries
   the bytes as it does for same-origin faces.

3. **Every background picture and gradient is gone: the page is flat
   colour**. The hero's sky (`.hero__sky{background:url(sky.webp)}`), the
   orange planet, the pink terrain, the star field behind THE LORE, the
   halftone dots behind the chart, the yellow-to-orange sky of the remote
   section, the loader's scanlines, the CA field's stripes. Cause:
   **capture**. `dump.mjs` records `bg` as the background *colour* only
   (`cs.backgroundColor`); there is no `bgImage` key, so nothing lists
   `sky.webp`/`grain.png`/`terrain.webp` for `--assets` to fetch, and the
   converter has nothing to write. Fix: record `cs.backgroundImage` (with
   `backgroundSize/Position/Repeat`) in `dump.mjs`; `capture-route.mjs:212`
   adds `url(...)` sources to the set it fetches; the converter writes a
   `url()` picture as `node.picture` behind the box (polio boxes take a
   picture today) and a gradient as a new `edge.gradient` or a rasterised
   picture; polio's `parts/theme.ts#boxStyle` needs `background-image`.

4. **The `<img>` pictures that are `.webp` are black boxes with a file-name
   pill**: the TV screen (`trorty-900.webp`), the two lore stills
   (`eyes.webp`, `face.webp`), both planets, the footer face. Only
   `eyeball.png` came through. Cause: **converter**. `capture-route.mjs`
   did fetch all seven files into `assets/source` (424 KB), but
   `capture-to-document.mjs#pictureFor` only decodes PNG (`pngSize`, line 303; the picture
   record is always written as `assets/pictures/<id>.png`, `type:
   "image/png"`, line 306–310), so a `.webp` answers "the bytes were not
   supplied (--assets)" (13×) and the node gets `picture: null` with the
   file name as its label. Then the same picture-placeholder pill as
   share.xyz #1 draws. Fix: `pictureFor` reads webp/jpeg/gif/svg size from
   the header (or via `sharp`), keeps the source extension and type in the
   record, and the converter path list allows them; polio's importer copies
   any image type.

5. **The display headline is scattered letters**: "TRUMP & MORTY" exports
   as `T U P M &`, `M R O T Y` at 30px, each letter its own `prose` part
   sitting where its wobbling span was measured mid-animation, with no
   outline, no offset shadow, no red/pink second shadow. Cause: **capture**
   + **converter** + **export**. The h1 is per-letter `<span class="l">`
   (`animation: wob 2.6s infinite`, `transform-origin`), so each letter is
   an element with its own box; the dump reads the box at one frame of the
   animation (letters overlap, `T U P M`), and the converter's own-words
   rule makes each span a `prose`. `-webkit-text-stroke: 5px`, `paint-order:
   stroke fill`, `text-shadow: 7px 7px 0 ink, 11px 11px 0 red` and
   `line-height: .86` are not recorded. Fix: `dump.mjs` records
   `textShadow`, `webkitTextStroke`, `paintOrder`, `transform` and
   `animationName`; the converter folds a run of inline spans that are
   single characters back into their parent's words (the parent's
   `aria-label` "Trump and Morty" says what it is); polio's `NodeText`
   grows `stroke` and `shadow`; and captures should be taken with
   animations paused (CDP `Animation.setPlaybackRate(0)` or
   `prefers-reduced-motion`) so a measured box is the rest box.

6. **The loader is what the pipeline captures**: the raw `page_home`
   capture carries the CRT loader (`div (fixed, z 2000, 16 parts)`: TUNING
   96%, the bar, "CH 47", "REC") over the hero, because
   `capture-route.mjs:139 settle()` waits for `networkidle` + 1.2 s while
   the loader counts to 100 on `document.fonts.ready` plus 350 ms + 800 ms
   fade. `orig-home-loader.png` is that instant. `index.html` of the export
   draws the loader's words over the hero, with the black loader box pinned
   (issue 1 again, z 2000). Cause: **capture**. Fix: `capture-route.mjs`
   waits for `document.fonts.ready`, for animations on `position: fixed`
   elements to end, and for no element covering the viewport to be removed
   or faded within a grace period; or a `--wait-gone <selector>` flag.

7. **Reveal-on-scroll sections are captured hidden and displaced**: in the
   raw capture every `.reveal` below the fold is at `opacity: 0;
   transform: translateY(46px) scale(.96)`; the dump records neither, so the
   converter writes them visible at the translated box (46 px low, 4 %
   small). Once revealed, cards 3–5 of a row carry `rotate(±1.5deg)`, which
   is also not recorded (the buy cards, the roadmap cards and the remote's
   `rotate(-2deg)` are all drawn level). Cause: **capture**. Fix: record
   `opacity` and `transform` (as the matrix, `cs.transform`), scroll the
   page once before the dump (what `pw-settle.cjs` does here), and let the
   converter write a rotation as `node.rotate` for polio to draw with
   `transform: rotate()` on the wrapper.

8. **Outlined, offset-shadowed "sticker" type is flat**: THE LORE, HOW TO
   BUY, LIVE CHART, "LOOK AT THE CHART!", "$TRORTY", every button label:
   `-webkit-text-stroke` + `paint-order` + `text-shadow` are the site's
   whole typographic language and none of the three is read. Cause:
   **capture** (not read) → **converter/export** (`NodeText` has align,
   transform, spacing only). Fix: as 5; `parts/theme.ts#applyFont` emits
   `-webkit-text-stroke`, `paint-order`, `text-shadow`.

9. **The marquee band is a level red slab, not a tilted ribbon**: the
   `.marquee` is `transform: rotate(-2deg)` with a `translateX` animation
   and `overflow: hidden`; ours draws a flat red block 1440 wide from y 690
   to 900 whose words start mid-sentence ("THE CHART ✦ $TRORTY…") and run
   under the fold. Cause: **capture** (rotate/overflow not read) +
   **converter** (`main.js` quadruples the marquee's innerHTML, so the dump
   has four copies and the converter keeps all as one long `prose`). Fix:
   record `transform` and `overflow`; the converter clips words to the box
   (share.xyz #6 records overflow for the same reason).

10. **The `<canvas>` dust layer, the loader's static canvas and the DEX
    iframe are drawn as boxes**: the hero's 1440×900 `#dustCanvas` becomes
    a `box` with `role: Canvas` (drawn as a black rectangle in
    `page_home`), `#staticCanvas` likewise; `#dexFrame` is `hidden` until
    the user clicks so the chart section is a black 1120×590 box
    (`ours-home-y2700`) where the site shows the DEX Screener frame. Cause:
    **capture**. Fix: for a `canvas`, `dump.mjs` records
    `canvas.toDataURL()` as a picture (one frame of the dust is a fine
    still); for an `iframe`, record its `src` (or the `data-*` the page
    sets it from) and let the converter write an `embed` node; polio has
    no embed part yet.

11. **The toast is drawn**: `#toast` is fixed at (691, 1060), 57×33,
    below the viewport, `opacity: 0` until shown; the export pins it as a
    green box at the bottom centre of every screen (`fluidSite.ts:175`
    treats a fixed part whose bottom is past H as `"both"` and clamps it
    in). Cause: **capture** (opacity) + **export**. Fix: as 1; a fixed part
    outside the window is not drawn.

12. **Buttons lose their bevel and pressed shadow**: `box-shadow: 5px 5px
    0 ink` on the pill buttons, the `::before` highlight band on the remote
    keys and the `::after` "feet" under BUY. The shadow is share.xyz #3
    (`node.shadow` vs `edge.shadow`, 128× "stored" here). The
    pseudo-elements are new: `dump.mjs` walks elements only, so `::before`
    / `::after` (the TV's antenna balls, the button highlight strips, the
    remote's shine, the loader's OSD corners) do not exist in the capture.
    Cause: **capture**. Fix: `getComputedStyle(el, "::before")` with
    `content !== "none"` becomes a child box in the dump.

13. **The header keeps its drop line but not its colour**: at scroll 900
    the site's header is yellow with a 3 px ink underline; ours is red
    (the marquee band's colour bled through: the header box has
    `background: rgba(243,212,64,.92)` + `backdrop-filter: blur(6px)` and
    a 3 px `border-bottom`, and only the border came through). Cause:
    **capture** (`border` shorthand one side, `backdrop-filter` not read;
    alpha in `bg` kept but the band under it is wrong from issue 9).

14. **The custom cursor**: the site sets `cursor: pointer` only, so nothing
    is lost here; noted because the brief asked. (No `cursor: url()` and no
    JS cursor follower; `mx/my` in `main.js` drive the TV's tilt, not a
    cursor.)

## Already in the share.xyz report (seen again here)

- **#2 no `border-radius`**: every card, button, pill, the TV bezel and the
  remote are square (93× `border-radius: 0px` in the export).
- **#3 shadows written to `node.shadow`, drawn from `edge.shadow`**: 128
  hard-offset ink shadows stored, none drawn.
- **#5 words folded into a box paint over the icon**: "BUY ON PUMP.FUN"
  runs under its pill icon and out of its box; "CA <address>" is one line
  of the address colour with the CA badge lost; "SELECT CHANNEL" and "CH
  01"–"CH 03" tags clipped ("SELECT CHA", "CH 0").
- **#7 heading clamp**: the section titles draw at ~48px instead of the
  site's `clamp(46px, 7vw, 96px)`; the hero at 30px instead of 124px.
- **#12 one-sided borders** (the header's underline is the one that
  survived, the rest of a box's edge is invented).
- **#13 no hover states**: `.btn:hover{transform:translate(-2px,-2px)}` and
  the eyeball follow on hover are lost.
- **#14 icon strokes**: the TG/X icons and the DEX chart glyph outline at
  the default width (this branch, `ded751c`, already keeps strokes: 14
  `stroke` captured and folded, so it is partly fixed here).
- **#1 picture cap** did not bite: one picture, 0.7 MB document.
- The converter's `routes.sections` crash: avoided by writing `"sections":
  {}` in `routes.json`, as share.xyz did.
- Chromium and the proxy CA: `certutil` (from `libnss3-tools`, which had to
  be `apt-get update`d) added `/root/.ccr/ca-bundle.crt` to
  `~/.pki/nssdb` before `capture-route.mjs` could open the site.

## What the site does that a static export cannot hold

- **The CRT loader**: a canvas of animated static (`drawStatic`, 20 fps),
  scanline animation, a zooming still, a tuning counter that waits for the
  fonts, then a `crtOff` collapse. A capture can hold one frame of it or
  skip it; the export should skip it.
- **The dust canvas** in the hero: floating specks drawn every frame.
- **The wobbling headline** (`wob` per letter), the pulsing ticker badge,
  the blinking LIVE dot, the spinning eyes (`eyeSpin`), the antenna
  `ampSpin`, the bobbing planets (`floatA/B`), the drip under BUY, the
  `screenJit` on the TV screen: 15 keyframe animations. The rest box of
  each is what a static page can show.
- **Scroll-driven motion**: `main.js#frame` moves the hero layers with
  scroll velocity and the mouse (parallax on `.hero__layer`), tilts the
  TV toward the pointer (`transform-style: preserve-3d`), and inertia
  wheel scrolling. Static: none.
- **Reveal on scroll** (`IntersectionObserver` → `.in` with staggered
  delays): the export can only show the revealed state.
- **The marquee** (`translateX` loop, four copies of the text).
- **The DEX Screener iframe** (live chart, hidden until the user opens it)
  and the "LIVE" price/blink counters: one frame at best.
- **Copy CA buttons and the toast**: JS; the address itself is obsolete.
- **`mix-blend-mode: multiply` grain and `screen` static**: a static page
  can hold the blend mode if it is written, but the grain at `.05`
  opacity is not worth a picture.
- **Hover**: button lift, eyeball look-at-pointer.

## Re-running

    node capture/site/capture/capture-route.mjs https://trumpmorty.fun/ sites/trumpmorty-fun/capture/routes/page_home.json --width 1440 --height 900 --assets sites/trumpmorty-fun/assets/source
    PLAYWRIGHT_MODULE=$PWD/sites/trumpmorty-fun/capture/pw-settle.cjs node capture/site/capture/capture-route.mjs https://trumpmorty.fun/ sites/trumpmorty-fun/capture/routes/page_home_settled.json --width 1440 --height 900 --assets sites/trumpmorty-fun/assets/source
    node capture/site/capture/capture-to-document.mjs sites/trumpmorty-fun/capture/routes.json sites/trumpmorty-fun --assets sites/trumpmorty-fun/assets/source > sites/trumpmorty-fun/capture/ledger.txt
    # polio (trunk claude/template-ui-website-builder-11bfgl): npm ci && npm run build && npx next start -p 3013
    node scripts/export-site.mjs http://127.0.0.1:3013 /path/to/sink/sites/trumpmorty-fun /tmp/export
