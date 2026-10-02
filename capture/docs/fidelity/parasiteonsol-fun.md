# parasiteonsol.fun through the pipeline

The owner's own site: "Parasite", Solana coins priced in another coin, where
every trade burns the host. One script (`/app.js`), three faces (Pixelify
Sans, Silkscreen, Atkinson Hyperlegible), pixel art, script-drawn canvases,
four videos, a grid-paper background, and live data read from the chain.
Taken 2026-09-29 with
`site/capture/capture-site.mjs --url https://parasiteonsol.fun/ --crawl`,
at 1440 × 900, in headless Chromium, and exported with polio
`claude/hopeful-johnson-0i6m66`. Everything ran locally; nothing was
published or deployed.


## Status, 2026-09-29 evening (capture upkeep)

The tables below are the first take's (sink da50f14, exported with polio
`claude/hopeful-johnson-0i6m66`). Since then the site was taken again twice
(bd2d8b1, 782942c) with these fixes; each row of "What does not" now reads:

| Where | Now |
|---|---|
| Hero scene | **Better**: the canvas is a 15-frame flipbook, not one still (sink b662ab2, check-canvas). The walk is still frames, not the drawing |
| Live numbers, long lists, clock | Open by design: live data (hand-off below) |
| Small dark label chips | **Fixed**: a chip folded into its sentence keeps its fill, padding, rounding (sink b662ab2) and its own size (bd2d8b1); polio draws it (d329b44). check-chips 6/6 |
| Videos | **Fixed**: both videos are the site's own files (`assets/pictures/vid_*.mp4`, `node.media.file`) and play (sink a2e15a9, polio 51ca33b) |
| 1440 width (the 15px scrollbar gutter) | Open: the document says 1425 (`frameWidth`); the export's page does not reserve the gutter |
| Section columns at 2000 | **Fixed**: 158 parts carry their 1240px max-width (sink 556de04, polio 235c134) |
| Fields | **Fixed**: its 37 fields show their placeholders (782942c) |

Not yet re-measured against live at 1440 and 2000 after these: this
container's browser cannot open live pages. The new comparison tools
(`site/capture/tools/`, below) are how to do it.

## What was taken

| | |
|---|---|
| Pages | `/`, `/coins`, `/burned`, `/devs`, `/docs`, `/stats`, `/log`, `/feedback`, and one representative per repeated id pattern: `/h/:id` (a host coin; 11 ids kept), `/burned/:id` (12), `/devs/:id` (42). The ids are in `run.json` as `crawl.patterns` |
| Parts | 7,601; 164 pictures; 3 faces; the page laid out 1425 wide (`html { scrollbar-gutter: stable }` keeps 15px for the scrollbar), so `frameWidth` is 1425 |
| Head | title, description, address, theme colour, card, share picture, icons, other meta |
| Motion | 7 `@keyframes`, 4 canvases sampled, 6 reveals on the home page |
| Presses | 41 states: the sound switch, the Tree / Burn ledger tabs, the Route / Trade switch, the coin list's sort tabs (New, Trending, Mcap, Near graduation), and others |
| Long lists | 5 lists kept to a window and a little more, each with what live had (`doc.lists`, `node.rows`): home 26 of 30, `/coins` 16 of 48 (redrawn live), `/docs` 26 of 41, `/stats` 27 of 75 (redrawn live), `/h/:id` 26 of 30 |
| Videos | 4 (two on the home page, the same two on `/h/:id`), each a picture of its poster, with `node.media` (source, poster, controls) |

## The export against live, 1440 and 2000

Measured by `compare.mjs` (lost with its container; `site/capture/tools/compare-shots.mjs` is its replacement), which scrolls the normal 900px-tall window screen
by screen on both. Words are compared word by word. "Mean difference" is the
average colour difference per pixel, 0–255, per screen. Crops
(`parasiteonsol-fun/`, live on the left, export on the right):
`hero-1440.jpg`, `hero-2000.jpg`, `video-1440.jpg`, `home-2000-y1800.jpg`,
`coins-1440.jpg`, `stats-1440.jpg`, `docs-2000.jpg`, `burned-1440.jpg`,
`coin-page-1440.jpg`.

| Page, width | Words found | Mean difference per screen | Height (live → export) |
|---|---|---|---|
| `/` 1440 | 81.7 % | 9.4–39.2 | 8593 → 8630 |
| `/` 2000 | 81.6 % | 7.2–38.5 | same |
| `/coins` 1440 / 2000 | 45 % (list kept to 16 of 48, by design) | 15.3–22.1 / 11.8–16.5 | 4381 → 1889 (trimmed) |
| `/docs` 1440 / 2000 | 93.2 % | 8.3–18.3 / 6.0–13.2 | 8733 → 8097 (list kept to 26 of 41) |
| `/stats` 1440 / 2000 | 55.9 % (list kept to 27 of 75, by design) | 6.8–9.3 / 4.9–6.7 | 4763 → 2795 (trimmed) |
| `/burned` 1440 / 2000 | 90.7 % | 16.9–17.1 / 12.5–12.7 | 1384 → 1384 |
| `/h/Ai66LHZG…` 1440 / 2000 | 83.3 % | 7.3–19.6 / 5.5–34.9 | 8396 → 8396 |

Most words not found are numbers that change every few seconds (prices, burn
totals, the chain's slot, "18h ago") and rows of the long lists left out by
design; the rest are listed below.

### What matches

The header and its nav, the hero frame and title, the stat bar, the video
blocks (as their frames), every section's type in its pixel faces, the grid
paper, the coin cards (the first 16), the burn register, the docs, the
host-coin page, and the feedback and log pages. Page links keep their exact
case (`/h/Ai66LHZG…`), and in-page links (`#register`, `#inoculate`,
`#mechanism`, `#burns`, `#warming`) go to the parts those places became.

### What does not, and why

| Where | Difference | Why |
|---|---|---|
| Hero scene | Live draws the creatures on a canvas and walks them; the export shows the frame captured, still. At 2000 live redraws the scene for the wider window, while the export stretches the 1440 frame to cover | A script-drawn canvas: the capture keeps what it drew, not the drawing. The biggest share of the home page's difference |
| Live numbers | SOL totals, burned amounts, slot and "ago" times are the capture's | Live data (the endpoints below) |
| Long lists | `/coins` and `/stats` hold about 1.2 screens of rows | The owner's rule: the backend fills them |
| Small dark label chips | The white-on-dark tags ("11:28 UTC", "HOST", "LIVE FROM CHAIN") lose their dark fill, so their words vanish on the cream paper | A small inline box's own background is not drawn by the export yet; left for a follow-up |
| Videos | A still with no play control | polio has no video part yet; `node.media` carries what a player needs |
| 1440 width | Live is laid out 1425 wide (a reserved scrollbar), the export 1440 wide | The export's own page does not keep the scrollbar gutter; parts stretch 15px wider |
| Clock | The small UTC clock in the tags stands still | A script clock |

## What the capture needed, fixed on this branch (each with a check that fails first)

| Gap seen on this site | General fix | Check (before → after) |
|---|---|---|
| `/coins` stopped the capture: the page redrew its rows while the capture scrolled | A row the page removed is skipped | sink `check-motion-sample` (7) red → 27/27 |
| Endless or live lists grew with every scroll (the owner's direction) | `list-trim.js`: a list of 12+ items of one shape keeps what starts within 1.2 windows, cut in the page so the section is that tall; trimmed again as it grows or is redrawn; `doc.lists` and `node.rows` say what live had | sink `check-lists` 5/11 → 11/11; `check-representatives` (3) moved to the new rule |
| The hero stood 84px low and the page 168px low | polio sizes a window-height hero as the page wrote it (`clamp(520px, -168px + 100svh, 900px)`), not always `max(100svh, px)` | polio `hero-height` 1/6 → 6/6 |
| Grid paper exported flat | A body painted with a picture or gradient is a backdrop part | sink `check-media` (1) |
| Videos were empty boxes | A video is a picture of its poster or frame, with `node.media` | sink `check-media` (2) |
| At 2000 the export stopped 575px short | `frameWidth` is the width the page lays out in (1425 here), so full-width bands stretch | sink `check-scrollbar-width` 1/3 → 3/3 |
| `/h/Ai66…` exported as `/h/ai66…` | polio writes a page's own path in its exact case | polio `path-case` 4/6 → 6/6 |
| `##inoculate` on the parts a press shows | A press's in-page links are settled like the page's own | sink `check-details` 7/8 → 8/8 |

## Functions not captured (hand-off to a backend chat)

For a model that implements these against the Builder's parts. The endpoints
are the site's own, same-origin, JSON. Shapes are keys and types seen on
2026-09-29. No wallet, token or cookie was used or kept. "The chain" means
Solana, read through the site's own RPC (remote procedure call) relay.

Shared data, every page:

- `GET /api/config` → `{ site, cluster, ca, ticker, twitter, siteUrl }` (all
  strings): the token's contract address (CA), ticker and links.
- `POST /api/rpc` with a JSON-RPC body, e.g. `{ method: "getSlot" }`, about
  every 250ms while a page is open: feeds the "CHAIN · SLOT" figure. Other
  reads (host and parasite accounts) go through the same relay.
- `GET /api/meta?uri=<metadata address>` → `{ name, symbol, description,
  image, twitter, website }`: one call per coin, for its name and picture.
  Coin pictures are served by `/api/img/<cid>`.
- `GET /api/hot`: "infection of the hour" (its shape was not readable from
  the capture's browser; read `app.js`).
- `GET /api/burns` → `{ supply, burned, treasury: { runs, burned, sol },
  recent: [{ sig, t, burned, sol }×30] }`: burn totals and the burn ledger.
- `GET /changelog.json` → `[{ date, title, items: [string] }]`: the Log page
  and the "Log · 18h" badge in the nav.

### Header (every page)

- **SND OFF / SND ON**: sound switch, remembered. Captured as a press (the
  header's two states). Attach a sound feature to the button.
- **Mine**: the connected wallet's own coins (needs a wallet).
- **Connect**: wallet connect (Phantom and others). Not captured; attach a
  wallet-connect feature. Everything marked "needs a wallet" below waits on it.

### Home

- **Hero scene**: a canvas animation drawn by `app.js` (the host and its
  parasites walking). Captured as one frame. Port the drawing as a canvas
  feature on the hero's picture part.
- **Stat bar** (hosts, parasites, host tokens burned, $PARASITE burned,
  warming up, chain slot, CA with copy): `/api/burns`, `/api/rpc`,
  `/api/config`. Attach to the stat parts; "copy" fits the Builder's "Copy
  with toast".
- **Colony list** (11 host coins, each with a "Copy CA" button): the chain
  plus `/api/meta`. Kept to its first rows (`doc.lists`); the backend fills
  the rest. Copy CA fits "Copy with toast".
- **Tree / Burn ledger**, **Route / Trade**: captured as presses.
- **Inoculate a host** (`#inoculate`, `#register`): the form "hostmint, name,
  symbol, file (picture), desc" that launches a parasite coin on a host;
  needs a wallet to sign. Not captured beyond its fields. Inputs: host mint
  address, name, symbol, picture file, description. Output: a signed launch
  transaction.
- **Videos**: "Parasite in 90 seconds" (`/assets/video/parasite-story-web.mp4`)
  and the 38-second "add any coin as a host" (`/assets/video/parasite-v2-web.mp4`),
  as their posters with `node.media`. A video part should play `media.src`
  with `media.poster` and controls.

### Coins (`/coins`)

- **List** (48 live, 16 kept): coin cards with market cap, age, trades,
  progress bar, "CA … copy", DexScreener and Solscan links, "Buy". Data: the
  chain + `/api/meta` + `GET /api/trades?m=<mint>,…` (one call for every
  listed mint; the answer was an empty object at the capture). The sort tabs
  are captured as presses; the search box (ticker, name or CA) is not.
- **Buy**: a swap (needs a wallet). **Launch one**: goes to the inoculate form.

### Burned (`/burned`, `/burned/:id`)

- **Check** (input `ca`): looks up a coin's burns. Not captured beyond the
  field; the coin page `/burned/:id` is the result (12 ids known).

### Devs (`/devs`, `/devs/:id`)

- Sort (Volume / Burned / Coins / Graduated) captured as presses; "Copy
  address" and "Open $…" per developer; `/devs/:id` is one developer's page
  (42 ids known).

### Stats (`/stats`)

- The burn register: every host and parasite account of the program, read
  from the chain when the page opens (the page says so). Kept to 27 of its 75
  rows.

### Feedback (`/feedback`)

- The form "text, handle, website" with Idea / Bug / Other and Send, and the
  list with Top / New / Upvote. Not captured beyond its fields and presses;
  the endpoint is only called on send.

### Coin pages (`/h/:id`, 11 known)

- The same blocks as the home page, for one host: its parasites, burns and
  warming status, with anchors `#inoculate`, `#burns`, `#warming`.

## Tips

- sink `claude/capture-consolidated`: the capture, this report and its crops
- polio `claude/hopeful-johnson-0i6m66`: the fixes the export needed, on trunk `212b1c4`

## The pet worlds, live against the export (re-taken 2026-09-29, evening)

The home and host pages' canvas worlds are captured as what they are made of
(`node.world.stage`, sink `worlds.mjs` / `stage.mjs`) and drawn again live by
polio (`library/stageEngine.ts`), not played as a loop. Measured by a script
that opens live and the export side by side at 1440 and 2000 wide
(`world-hero-*.jpg`, `world-dialog-*.jpg`, live on the left).

| | 1440 | 2000 |
|---|---|---|
| Canvas scale (art pixels, CSS px each) | live 373×234 at 3, export 373×234 at 3 | the same |
| A pet pressed on live, the same coin pressed in the export | $SCAT, dialog 640×868 both, mean difference 26.3 | the same |
| Preset 0.1 | amount 0.1, chosen true,false,false, both | the same |
| Escape / a press outside | closes | closes |
| Buy with SOL, dexscreener pressed in the export | nothing happens, page stays | the same |
| Scene tab (Beach) in the export | switches the world (26% of its pixels change) | the same |
| Page errors, windows opened | 0, 0 | 0, 0 |

What matches: the dusk ground, moon, stars, chest and fire (the page's own
painting, captured per scale with the pets left out), pets at their own size
with riders and labels, wandering with stops and turns, and each pet's dialog.
What does not yet: the export packs the hosts into more rows and stands them
higher than live; live draws pets by its own row layout, which the capture
reads as each pet's foot at one moment. Live's "Night mode" banner and
"Drip shop" button appeared after the capture. The world's look follows the
time of day on live (dusk here); the capture keeps the time it was taken.
