# trendtrader.pro/ttp through the pipeline

The owner's own site: the TTP token's page, a folder of trendtrader.pro.
Plain HTML and CSS with its own scripts (`/ttp/ttp.js`, `market.js`,
`market-demo.js`), DM Sans, a live market widget drawn with TradingView
Lightweight Charts, and a cookie banner. Taken 2026-09-29 with
`site/capture/capture-site.mjs --url https://trendtrader.pro/ttp/ --pages "/, /ttp-tokenomics/" --crawl`,
at 1440 × 900, in headless Chromium, and exported with polio
`claude/hopeful-johnson-0i6m66`. Everything ran locally; nothing was
published or deployed.


## Status, 2026-09-29 evening (capture upkeep)

**This take must be taken again.** It was made with the capturer's
`--agree` default, and its cookie banner ("Cookie banner: agreed to before
the capture", below) was pressed through: the owner's rule is that a
capture never accepts Terms or cookies. Two general fixes stop it happening
again (sink f4c95d5): `--hide-gate` hides a gate instead of agreeing to it,
and the presses pass (`--states`) now leaves any consent or terms choice,
and anything that writes, alone; a cookie banner's Accept All / Reject pair
used to be pressed as a "group" (check-rest-states: red before, green
after). Retake, from a machine whose browser can open the site:

    node capture/site/capture/capture-site.mjs --url https://trendtrader.pro/ttp/ --name trendtrader-pro --pages "/ttp/, /ttp-tokenomics/" --hide-gate

`capture-site` now carries anything the owner set on the document across
(keep-owner.mjs). The rows of "What does not" below, now:

| Where | Now |
|---|---|
| Live market widget | Open by design: live data |
| Button labels a few px low | Open |
| Same-page anchors named by part | Open, by design (the jump lands in the same place) |
| Chart legend marks | Open: drawn by the chart's script |
| Cookie banner | **Retake**: it will be in the capture as the page shows it, never agreed to |
| Hover and pressed looks | **Fixed in the capture** (sink f4c95d5): the resting look is read with the pointer off the page and never catches a hover's transition; `:active` is kept apart. Reaches this site at its retake |

## What was taken

| | |
|---|---|
| Pages | `/ttp/` (the address given, as the document's `/`) and `/ttp-tokenomics/` (its white paper, linked from it) |
| Crawl | kept to those two folders; 12 other pages of the host (`/`, `/pricing`, `/blog`, `/legal/…`) are listed in `run.json` as `crawl.outside`, not taken. No repeated id pattern inside the folders, so no representative pages were needed |
| Parts | 1,484; 39 pictures; one face (DM Sans, 4 rules) |
| Head | title, description, site name, address, theme colour, card, share picture, other meta (`doc.head`) |
| Motion | 18 `@keyframes`, 2 hover motions, 2 canvases sampled, 5–7 scrolled-header changes per page |
| Presses | 12 states: the chart's 1H / 6H / 24H / 7D and Line / Candles, the market tabs, the pool example (Before the buy / Market buy / Later selling) and every FAQ question opening its answer |

## The export against live, 1440 and 2000

Measured by `compare.mjs` (lost with its container; `site/capture/tools/compare-shots.mjs` is its replacement), which scrolls the normal 900px-tall window screen
by screen on both (a full-page screenshot re-lays out a page sized in window
units, so it is not used). Words are compared word by word, which ignores
line breaks. "Mean difference" is the average colour difference per pixel,
0–255, per screen.

| Page, width | Words found | Links | Mean difference per screen | Page foot |
|---|---|---|---|---|
| `/ttp/` 1440 | 99.1 % | 43 of 52 the same address; the rest are same-page anchors (below) | 3.5–15.4 (worst: roadmap and FAQ, from the drift) | +76px |
| `/ttp/` 2000 | 99.1 % | same | 2.5–11.4 | +76px |
| `/ttp-tokenomics/` 1440 | 100 % | 36 of 48; rest are anchors | 1.7–7.0 | 0 |
| `/ttp-tokenomics/` 2000 | 100 % | same | 3.0–5.9 | +4px |

Crops (`trendtrader-pro/`, live on the left, export on the right):
`hero-1440.jpg`, `hero-2000.jpg`, `backtest-2000.jpg`, `market-1440.jpg`,
`roadmap-1440.jpg`, `horizons-1440.jpg`, `faq-1440.jpg`, `tokenomics-1440.jpg`,
`tokenomics-2000-y4500.jpg`.

### What matches

The header and nav, the hero (the gradient "TTP", the coin, the buttons, the
fine print), every section's words and type, the backtest chart and figures,
the pool example with its three presses, the roadmap's three drawings (the coins
now drawn in them) and the tokenomics page, top to bottom, at both widths. The
FAQ opens closed, as live does, and each question opens its own answer.

### What does not, and why

| Where | Difference | Why |
|---|---|---|
| Live market widget | The export shows the chart, trade totals and market table as they were at the capture. Live shows them when its data arrives, and "Synchronizing price history…" until then | Live data (`/api/ttp-market`, Alchemy, Pyth). The widget's height changes with its load state, and the part of the page below it moves by up to about 30px: most of the page-foot drift |
| Button labels | Each label sits a few px low in its pill (+12px on the heading positions measured) | polio's button draws its words in its own box. The layout is the same; only the words move |
| Same-page anchors | `#contract`, `#distribution`, `#model`, `#market`, `#roadmap` and the tokenomics chapters point at the parts they name (`#n_box_…`), not at the page's own ids | polio names a link to a part by the part. The jump lands in the same place |
| Chart legend | The small line marks in front of "Selected pool state" and "Before the buy" are missing | 2px inline marks drawn by the chart's script |
| Cookie banner | Not in the export | Agreed to before the capture; a site built from this sets its own consent |

## What the capture needed, fixed on this branch (each with a check that fails first)

| Gap seen on this site | General fix | Check (before → after) |
|---|---|---|
| The address is a folder: the crawl roamed the whole host and took `/ttp` twice | `/` typed with a folder address is that folder; the crawl stays inside the typed pages' folders | sink `check-representatives` (4) 14/17 → 17/17 |
| FAQ answers drawn over the questions | What the browser does not draw (a closed `details`, `content-visibility: hidden`) is left out; each question is a press showing its answer | sink `check-details` 2/7 → 7/7 |
| "What’s next for / TrendTrader Pro & TTP." run together | A shown `<br>` is a line break in the words | sink `check-line-breaks` 2/4 → 4/4; polio `heading-commas` 6/7 → 7/7 |
| Headings wrapped greedily | `text-wrap: balance` / `pretty` kept as `text.wrap`, and applied | sink `check-line-breaks` 4/6 → 6/6; polio `heading-commas` 7/8 → 8/8 |
| "50% · $5,000 in market buys" drawn "50% · $5" | A heading is one sentence, never cut at a comma (gotchi.gg and stonkfun.xyz had two each) | polio `heading-commas` 2/6 → 6/6 |
| The gradient "TTP" drawn as a teal box | `background-clip: text` kept as `art.backgroundClip`, and applied | sink `check-media` (3) 6/7 → 7/7; polio `text-fill` 2/3 → 3/3 |
| Roadmap drawings without their coins; labels twice, once in a serif | A drawing kept whole has its `<image>`s written in and no `<text>` (its words are parts) | sink `check-svg-whole` 3/5 → 5/5 |

## Functions not captured (hand-off to a backend chat)

For a model that implements these against the Builder's parts. The endpoints
are the site's own: public GETs returning JSON. Shapes are keys and types seen
on 2026-09-29. No token, cookie or wallet was used or kept.

### Header (both pages)

- **Resources menu** and **Open menu** (narrow windows): open a list of
  links. Attach to the header's "Resources" part; a dropdown feature fits.
- **Log In / Sign Up**: links to `app.trendtrader.pro/login` and `/signup`.
  They are captured as links; nothing more is needed.

### TTP page (`/ttp/`)

- **Copy CA**: copies the token's mint address (shown in the "Buy & track
  TTP" card). The Builder's "Copy with toast" feature fits; attach to the
  "Copy CA" button.
- **Live market widget** ("Live market"): the price chart (TradingView
  Lightweight Charts, five-minute candles or their closing line), period
  presses 1H / 6H / 24H / 7D, Line / Candles, "Reset view", "Chart data"; the
  "Trading activity" panel (buy and sell volume, net buy volume, swaps,
  trader addresses, average swap, VWAP (volume-weighted average price),
  high, low); the tabs Markets / Recent trades / Token details with "Pause
  updates" and Newer / Older paging. Data: `GET /api/ttp-market`, which the
  page's `market.js` reads and refreshes (its JSON was not readable from the
  capture's browser, so its shape is left to the backend chat to read from
  `market.js`); SOL/USD from Pyth. Attach to the chart picture part, the
  activity figures and the market table parts. Captured: each press's first
  state. Not captured: the data arriving, live updates, paging.
- **Site stats** (scans, markets, signals, traders): `GET /api/stats` →
  `{ scans: number, markets: number, signals: number, traders: number }`.
- **Carousel** ("Previous" / "Next" in the research section): steps through
  its cards. A carousel feature fits the two buttons and the card row.
- **Video** ("Play video: TTP introduction"): a YouTube video
  (`youtu.be/9H9NJYNZ6ds`). Captured as its poster picture; an embed plays it.
- **Explainers** ("Read the diagram explanation", "About the research and
  its scope", "Why position sizing matters", "How these figures are
  calculated"): open a panel of text. Show on press fits if the panel's
  words are added as parts.
- **FAQ**: captured (each question opens its answer). Opening several at
  once, or closing one again, is not.

### Tokenomics (`/ttp-tokenomics/`)

- **Contents** ("Jump to a chapter"), **Expand all chapters** / **Collapse
  all**, "Read this chapter": a chapter list that opens and closes sections.
  Captured: the page as it opens, with the pool example's three presses.
- **Cookie consent** (Deny / Accept All): the site's own consent banner. A
  site built from this needs its own consent if it keeps analytics.

## Tips

- sink `claude/capture-consolidated`: the capture, this report and its crops
- polio `claude/hopeful-johnson-0i6m66`: the fixes the export needed, on trunk `212b1c4`
