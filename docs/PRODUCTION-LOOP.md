# The production loop

From a line drawn on the board to a finished element on the page: every call,
in order, what goes up, what comes back, who pays for it, and what it costs.

This is an audit, not a design document. It was written by reading the code
and measuring the payloads, and it is meant to be the ground for optimising
the API calling later — so where a number is measured it says so, and where a
number is estimated it says that too, along with how to check it.

Measured on 2026-09-11 against this repository, with `site/document.json`
(BLACKORB: 2 pages, 33 parts, 19 of them with their own prompt) as the board.

---

## 1. The loop, call by call

A drawing goes on the queue (`queue.ts`) and `DrawQueue` runs one job at a
time. `runDrawJob` (`reshapeRun.ts`) is the whole of it.

| # | Call | Where from | Where to | Runs when |
|---|------|-----------|----------|-----------|
| 1 | `POST /api/studio/reshape` | `reshapeRun.ts` | **Claude, `claude-opus-5`** | Every drawing |
| 2 | `POST /api/studio/image` | `bodyRun.ts` | **Replicate**, `recraft-ai/recraft-v3-svg` (vector) or `black-forest-labs/flux-2-pro` (raster) | Only for a part that came back `custom-idea`, and only if a Replicate token exists |
| 3 | `POST /api/studio/render` | `bodyRun.ts` | **Nobody** — headless Chromium on our own server | Once per attempt, including the renderer's |
| 4 | `POST /api/studio/body` | `bodyRun.ts` | **Claude, `claude-opus-5`** | Up to 3 times, while the overlap is under the bar |
| 5 | `POST /api/studio/screenshot` | `agent.ts` | **Nobody** — headless Chromium | Once per page, before an ask, when the setting is on |
| 6 | `POST /api/studio/generate` | `agent.ts` | **Claude, `claude-opus-5`** | Plan / Critique / Fill / Finish / Ideas / Ask / Build |

Every Claude call is `client.beta.messages.stream(...)` with
`betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, so
`claude-opus-5` is what is asked for and not always what serves it. The model
that actually answered comes back on `usage.model`, and the price below is
Opus 5's.

### 1 · Read the drawing — `/api/studio/reshape`

**Sent** (`reshapeRun.ts` → route):

| Block | What | Measured size |
|---|---|---|
| system | The reading rules: the outline is a hard boundary, the proportion is held, what marks inside a boundary mean | 3,096 chars ≈ **885 tok** |
| *cache breakpoint* | The library: 225 parts as `id — name · category · w×h · blurb` | 18,934 chars ≈ **5,410 tok** |
| text | "THE DRAWING…" — the picture announced before it is shown | ≈ 110 tok |
| image | `pictureOf(strokes)`: the strokes on white, 640 × 640 PNG | 71,824 base64 chars, **546 image tok** |
| text | The frame width; the part as it stands (kind, name, size, contents, data, prompt, options set, options offered); the drawing measured (boundary, shape, aspect, box, crossings); the strokes as numbers (`sketchToText`, ~160 chars); the author's words | ≈ 250 tok |

**Back**: one JSON object against `ANSWER_SCHEMA` — `featureId`, `label`, `w`,
`h`, `shape`, `content`, `prompt`, `options[]`, `note`. `max_tokens: 16000`,
`thinking: adaptive`, `output_config.effort: "medium"`.

`checkAnswer` (`reshape.ts`) holds every field to the catalog and the frame
before any of it touches the board. With no key, or a refusal, or an
unreadable answer, `applyProportion` still shapes the part from the drawing —
the key is never load-bearing.

The library block carries `cache_control: { type: "ephemeral" }`. Because the
breakpoint is the **first** content block, everything in front of it — system
included — is in the cached prefix: **6,295 tokens**. It is the same bytes on
every drawing, so the second drawing within the five-minute window reads it
instead of sending it.

### 2 · Draw the body — `/api/studio/image`

Only reached for `custom-idea`, from `bodyFor` → `writeBody` → `askRenderer`.
Default kind is `vector`.

**Sent**: `kind`, `label`, `prompt` (the part's prompt joined with the drawn
words), `closed`, `w`, `h`, `palette`. The route turns that into one line of
words (`renderPrompt`) plus a size or ratio (`recraftSize` / `fluxRatio`), and
that is the entire input to the drawing model. **It is never shown the
outline, and never shown the drawing.**

**Back**: SVG (cleaned by `cleanSnippet`, refused over `RENDER_LIMIT` =
240,000 chars) or pixels as a `data:` URI inside an `<img>`, refused over
2,400,000 chars. Plus `cost`, `model`, `bytes`.

**Price**: `RENDER_COST` in `renderer.ts` — **$0.08** vector, **$0.04** raster.
Hardcoded, not read back from Replicate.

### 3 · Look at what came back — `/api/studio/render`

No model. Chromium opens the fragment alone in a box exactly `w × h`, with the
page's content policy (`frameDoc`: `default-src 'none'`, inline styles, `data:`
images) and every non-`data:` request aborted, and screenshots it with
`omitBackground`.

`shotMask` reduces that to a 96 × 96 grid of "painted / not painted";
`targetMask` reduces the drawn outline (`OutlineClip.cut`) to the same grid;
`compare` returns intersection over union plus a sentence about which quarter
is emptiest.

**Measured**: 0.41–0.49 s per call, and a **fresh Chromium launch every time**
(`found.pw.chromium.launch(...)` inside the handler).

Note what the target actually is. `outlinePath` returns `null` when a closed
line fills more than 98.5% of its own box, and `targetMask(null)` fills the
whole grid — so a rectangle-ish drawing is scored against the whole box and a
body that fills the box scores 1.0. For anything else the target is the
outline, the render is **unclipped**, and a body that fills the box scores only
the outline's share of it. A thin band drawn edge to edge cannot reach 0.72 by
filling the box; it has to actually reproduce the silhouette.

### 4 · Write the body — `/api/studio/body`

**Sent** (`askForBody`):

| Block | What | Size |
|---|---|---|
| system | The six hard rules: self-contained, fills the outline, stays in the box, is the content not a description, uses the palette, under 24,000 chars | 2,239 chars ≈ **640 tok** |
| *cache breakpoint* | "You are writing one part's body…" | ≈ **25 tok** |
| image | The drawing, 640 × 640 | **546 tok** |
| image | The last attempt as it rendered (`shot`) | 137 tok at 320 × 320; 480 at 900 × 400; 1,229 at 1280 × 720 |
| text | Size, label, prompt, the outline as a path, the palette, the critique, and **the whole previous attempt** | path 1,919–4,006 chars (**640–1,335 tok**); previous sliced to `SNIPPET_LIMIT` = 24,000 chars (**up to 8,000 tok**) |

**Back**: `{ code, note }` against `SCHEMA`. `max_tokens: 24000`,
`thinking: adaptive`, `effort: "medium"`. `cleanSnippet` strips anything that
reaches off the page before it is returned, and again on the way into
`/api/studio/render`, and the part renders under `sandbox=""`.

### 5 · The pictures — `/api/studio/screenshot`

Before an ask, `screenshotPages(limit, device)` photographs the first
`studio.screenshotPages` pages (default 4) one at a time, POSTing the **whole
document** each time. The route puts the document in `localStorage` via
`addInitScript`, opens `/builder/preview<path>`, lets the site's scroller grow
to its full height, resizes the window to it (capped at 6,000 px) and shoots.

**Measured**: 1280 × 2121 PNG, 262,827 bytes, **2.8 s**, fresh Chromium per
page. There is a 90 s client deadline per page (`SHOT_DEADLINE_MS`); pages that
time out are counted and the words go without them.

### 6 · The ask — `/api/studio/generate`

Two shapes, one route.

- **Nothing vined** (the default): the whole blueprint goes in the **last**
  block, uncached, every time. Measured for BLACKORB: **19,345 chars ≈ 5,527
  tok**.
- **Pieces vined to the thread**: `briefPrefix(markdown)` goes first with
  `cache_control` (**4,376 chars ≈ 1,250 tok**), then only the pieces whose
  fingerprint has moved since this thread last sent them, then `skipped` as a
  count so the answer knows the rest exist.

Plus the pictures, plus the mode instruction, plus — for Build — the
`REPO_CONTRACT` (1,094 chars) and the scaffold contract: the file list
`buildScaffold()` already wrote from the document, deterministically, in the
browser, with no model involved.

`max_tokens: 64000` for Build, `32000` otherwise; `effort: "high"` except
Ideas. The route holds its own budget (`ANSWER_BUDGET_MS`, `maxDuration` less
5 s) and answers itself rather than being killed mid-call; the browser holds a
second deadline (330 s for Build, 210 s otherwise).

---

## 2. How the overlap loop decides to go again

`writeBody`, `bodyRun.ts`. The bar is `GOOD_ENOUGH = 0.72`; the budget is
`MAX_ATTEMPTS = 3` written attempts.

```
attempt 0   the renderer (if a token exists)   → render → score
            score ≥ 0.72 → stop, keep it
            score  < 0.72 → its own render becomes `prev`, and the loop runs
            no token       → `rendererSays` is recorded, and the loop runs

attempt n   ask /api/studio/body with (previous, critique, shot)
            → render → score
            score ≥ 0.72 → stop
            score  < 0.72 and n < 3 → this attempt becomes `prev`, go again
            score  = -1 (no headless browser) → stop, nothing was compared

keep        the BEST attempt, never the last — the renderer's counts as one
```

Three things end the loop early: clearing the bar, `overlap < 0` (no Chromium
on the server, so nothing can be judged), and an answer that came back empty
when an earlier attempt already landed.

`drawnWell` is computed once, before the loop, from the renderer's attempt —
so a renderer that clears the bar skips the written attempts entirely, and a
renderer that misses costs its $0.08 *and* the full three goes.

---

## 3. Where the key comes from, at each step

| Call | Key | Precedence | What happens without it |
|---|---|---|---|
| `/api/studio/reshape` | `ANTHROPIC_API_KEY` | **Server env wins**, else `x-anthropic-key` from the browser vault | HTTP 200, `reason: "no-key"`. The part still takes the drawing's proportion and shape, and the drawing goes into the blueprint |
| `/api/studio/body` | `ANTHROPIC_API_KEY` | **Server env wins**, else `x-anthropic-key` | HTTP 200, `reason: "no-key"`. The part keeps its shape and its prompt |
| `/api/studio/image` | `REPLICATE_API_TOKEN` | **Browser header wins**, else server env | HTTP 200, `reason: "unavailable"`. The loop falls through to writing the body |
| `/api/studio/render` | none | — | `reason: "no-playwright"`; the body is kept unjudged (`overlap: -1`) |
| `/api/studio/screenshot` | none | — | `available: false`; the words go alone |
| `/api/studio/generate` | `ANTHROPIC_API_KEY` | **Server env wins**, else `x-anthropic-key` | HTTP 200, `reason: "no-key"`; copy the blueprint into any agent |
| `/api/studio/publish` | `GITHUB_TOKEN` | Server env only | Not configured |
| `/api/studio/deploy` | `VERCEL_TOKEN` | `x-vercel-token` from the vault, else server env | Not configured |

The browser's side is `keyHeader()` and `rendererHeader()` in `agent.ts`,
reading `heldKeys()` from the vault (`features/keys/store.ts`). A supplied key
is used for the one call and nothing else: never stored, never logged, never
echoed. `/api/keys/status` answers a name and a boolean, nothing more.

**The Replicate precedence is deliberately the opposite of the others**: the
person who typed the token is the person being billed per press, so their
token wins over the deployment's.

---

## 4. What it costs

### Prices

| | Input | Output | Cache write (1.25×) | Cache read (0.1×) |
|---|---|---|---|---|
| Claude Opus 5 (`claude-opus-5`) | $5 / MTok | $25 / MTok | $6.25 / MTok | $0.50 / MTok |
| Claude Sonnet 5 (`claude-sonnet-5`) | $2 / MTok | $10 / MTok | $2.50 / MTok | $0.20 / MTok |
| Replicate, vector (`recraft-v3-svg`) | — | — | — | **$0.08 a call** |
| Replicate, raster (`flux-2-pro`) | — | — | — | **$0.04 a call** |

### How these numbers were arrived at

Input tokens are from measured character counts at **3.5 chars/token** for
prose and markdown and **3.0 chars/token** for SVG and path data, which
tokenises denser. Image tokens are `width × height / 750` after the API's
downscale to 1,568 px on the long edge — so the 1280 × 2121 page screenshot
becomes 946 × 1568 and costs **1,978 tokens**.

**Output tokens are the one thing here that is not measured.** Every Claude
call runs `thinking: adaptive`, and thinking bills as output at $25/MTok. The
estimates below assume **1,500 output tokens** for a reshape (≈1,200 thinking +
a short JSON answer), **2,600** for a body (≈1,500 thinking + a ~3,000-char
fragment), and **6,000–20,000** for an ask. Nothing in the app records a real
output count today (see §5), which is exactly why this is an estimate.

### One drawn element

| Path | Calls | Cost |
|---|---|---|
| **A part the library has** — the common case | 1 reshape | **$0.081** cold · **$0.045** warm |
| **An Idea part, best case** | reshape + renderer + 1 render | **$0.125** warm |
| **An Idea part, best case, no Replicate token** | reshape + 1 body + 1 render | **$0.124** warm |
| **An Idea part, three goes** | reshape + renderer + 3 bodies + 4 renders | **$0.42** |
| **An Idea part, three goes, no renderer** | reshape + 3 bodies + 3 renders | **$0.30** |

"Cold" is the first drawing: the 6,295-token library prefix is written to the
cache at 1.25×. "Warm" is any drawing within five minutes of the last one — the
queue runs one job at a time at roughly 20–40 s each, so a session of drawings
stays warm, and a drawing after a five-minute pause pays the write again.

The arithmetic, so it can be re-run with better output numbers:

```
reshape  cold  6,295 × $6.25/M + 906 × $5/M + 1,500 × $25/M = $0.0814
reshape  warm  6,295 × $0.50/M + 906 × $5/M + 1,500 × $25/M = $0.0452
body #1 after a renderer miss  11,306 × $5/M + 2,600 × $25/M = $0.1215
body #1 with no renderer        2,736 × $5/M + 2,600 × $25/M = $0.0787
body #2, #3                     4,306 × $5/M + 2,600 × $25/M = $0.0865
```

**The renderer path costs more at three goes than the no-renderer path**
($0.42 against $0.30) — the $0.08 plus up to 8,000 tokens of its own SVG
pasted into the first written attempt as "your last attempt, in full".

### A full site build

The Build ask alone, on BLACKORB (2 pages, 33 parts):

```
input   system 503 + 2 pictures 3,956 + labels 40 + build instruction 340
        + REPO_CONTRACT 313 + scaffold contract ~740 + blueprint 5,527
      = 11,419 tok                                            → $0.057
output  20,000 tok (assumed; the cap is 64,000)               → $0.500
                                                        Build  $0.56
```

At the 64,000-token cap it is **$1.66**. The scaffold itself — tokens, a
component per part carrying the markup that part actually renders, and the
pages that place them — is written in the browser from the document, costs
nothing, and took milliseconds; only the gaps are asked for.

A whole site, end to end — 20 drawn parts of which 5 are Idea parts, 2 pages,
three asks (Plan, Critique, Finish) and one Build:

| | | |
|---|---|---|
| 20 reshape calls | 1 cold + 19 warm | $0.94 |
| 5 Idea parts | 2 clear on the renderer, 3 go the distance | $1.28 |
| 3 asks with pictures | ≈10,400 in, ≈6,000 out each | $0.61 |
| 1 Build | as above | $0.56 |
| | **total** | **≈ $3.38** |

### Where the money actually is

**This loop is output-bound.** Roughly 90% of that $3.38 is output tokens at
$25/MTok. Every input-side optimisation in §5 together moves about a tenth of
the bill; the levers that move the rest are fewer goes, smaller `max_tokens`,
lower `effort`, and a cheaper model for the mechanical calls.

For scale: the reshape call is a structured read of a drawing against a fixed
library, which is the most mechanical call in the app. On Sonnet 5 the same
call is `6,295 × $0.20/M + 906 × $2/M + 1,500 × $10/M = $0.018` against
$0.045 — 60% off, on 20 calls a site.

---

## 5. Marked

### Asked for twice

- **The drawing picture is rendered twice in the browser.** `pictureOf(strokes)`
  runs in `DrawBoard.tsx:203` for `job.picture`, and again in
  `reshapeRun.ts` `bodyFor` for the body loop. Same strokes, same 640 px, same
  71,824 base64 characters, computed twice and held twice. `job.picture` is
  already in hand when `bodyFor` runs.
- **The drawing goes up twice.** Once to `/api/studio/reshape` and once to
  `/api/studio/body` — two routes, so two uploads, but the same 546 image
  tokens billed twice. It then goes up again on every retry.
- **The author's words go up twice inside one body call.** `bodyFor` sends
  `prompt: [node.prompt, drawn.words].join("\n")`, and `node.prompt` at that
  moment is the prompt the reshape call *just wrote out of those words*. The
  model gets Claude's expansion of the words and the words.
- **The drawing is described three ways in one reshape call**: the picture, the
  strokes as numbers, and the measured boundary. This is deliberate and
  documented — the numbers settle what a picture is imprecise about — and it is
  cheap: `sketchToText` measures ~160 chars, about 45 tokens. Not a cost
  problem; listed so it is not mistaken for one.
- **The blueprint and the pictures go whole on every ask.** Plan, Critique,
  Finish and Build each carry the same 5,527-token blueprint and the same
  3,956 tokens of screenshots, uncached, because the cached path only engages
  when pieces are vined to the thread. Four asks re-send about 38,000 tokens.

### Sent and not used

- **`pieces[].links` never reaches the model.** `usePieces()` builds the chain
  reasons (`chainLines`), `Piece` carries them, `piecesFrom` fingerprints them,
  and `/api/studio/generate` has the code to print them (`chained: …`). But
  `askClaude` in `agent.ts` maps pieces to
  `{ id, label, where, prompt, size, neighbours }` and **drops `links`**. On the
  vined path the chains are silently absent; they survive only in the whole
  blueprint, which the vined path does not send. This is a bug, not an
  optimisation.
- **`pieces[].id` is sent and never read** by the generate route.
- **`label` is sent to the renderer and thrown away** whenever a prompt exists:
  `renderPrompt` uses `ask.prompt || ask.label`.
- **`RenderAsk.kind`, `w` and `h` are passed into `renderPrompt` and unread**
  there; `shapeFor` reads the size separately.
- **The renderer is judged on something it was never shown.** `askRenderer`
  sends words, a size and a palette — no outline path, no picture of the
  drawing — and then the result is scored on silhouette overlap against that
  outline. An $0.08 call is asked to hit a shape it has not seen.
- **A 6,000-px-tall screenshot is sent and cannot be read.** The route caps the
  page height at 6,000 px; the API then downscales the long edge to 1,568,
  which squeezes a 1280-wide shot to **334 px wide**. It costs 699 tokens and
  no text on it is legible. The measured 2,121-px page is fine (946 wide); the
  cap is where this breaks.
- **Every usage figure the body route returns is dropped.** The route answers
  `usage: { input, output, cached, model }`; `askForBody` in `bodyRun.ts` reads
  only `{ ok, html, note, message, reason }`. The reshape route's usage is
  reduced to `usage?.model`. `askClaude` keeps `cached` and `input` and drops
  `output`. **Nothing in the app records an output token**, which is the one
  number that would settle §4 — and output is ~90% of the bill.

### Cacheable between goes

- **The body route's cache breakpoint never takes.** The prefix in front of it
  is the system prompt (640 tok) plus a 25-token sentence — about 665 tokens,
  under the 1,024-token minimum a prefix needs before it is cached at all. The
  `cache_control` on `body/route.ts:154` is, as written, a no-op on every call.
- **Moving that breakpoint past the drawing would make it real.** The drawing
  image is identical across all three attempts at one part. Marked there, the
  prefix is 640 + 25 + 546 ≈ 1,211 tokens — over the minimum — and attempts 2
  and 3 read it instead of sending it. Worth about 1,200 tokens a retry.
- **The outline path is stable across attempts and is not cached.** 640–1,335
  tokens, sent unchanged three times. It sits in the same text block as the
  critique and the previous attempt, which do change, so splitting the block is
  the prerequisite.
- **The whole blueprint is stable across an ask session and is not cached**
  unless pieces are vined. `briefPrefix` already exists and already carries
  `cache_control`; the Pages half is what varies, and it is the half that isn't
  split out on the unvined path.
- **The screenshots are stable across asks and are not cached.** Three asks in
  a row against an unchanged board re-send the same 3,956 image tokens.
- **The scaffold file list and `REPO_CONTRACT` are stable for Build** and sit
  after the blueprint, so they can never be part of a prefix as ordered.
- **The reshape library prefix is the one thing that is cached properly**:
  6,295 tokens, first block, the same bytes on every drawing, five-minute
  window. It is the model for the rest.

### Not an API cost, but part of the loop

- **A fresh Chromium per request, every time.** `withPreview` and
  `/api/studio/render` each call `chromium.launch()` inside the handler. One
  Idea part at three goes launches four browsers; a four-page ask launches
  four more. Measured: 0.45 s a render, 2.8 s a page screenshot.
- **The whole document is uploaded once per page photographed** — 33 KB × 4 —
  because the document travels in the request body rather than being addressed.

---

## 6. Re-measuring this

Nothing here needs a key.

```
npm run dev
# blueprint and brief-prefix sizes: put site/document.json into
# localStorage["builder.studio"] as {state: doc, version: 0}, reload /builder,
# call window.__studioOpenBrief(), read [data-brief-body].textContent
# page screenshot: POST site/document.json to /api/studio/screenshot and read
# width/height out of the PNG header (bytes 16..24)
# body render: POST a fragment to /api/studio/render
# outline paths: node --experimental-strip-types against a copy of sketch.ts,
# call outlinePath({ strokes, words: "" }) and measure .cut
```

The library prefix is `FEATURES` printed as
`id — name · category · w×h · blurb(≤140)`, one per line; 225 entries,
18,934 characters at the time of writing.

The figure that most needs replacing with a measurement is output tokens.
Every route already returns `usage.output_tokens`; §5 says where it is
dropped.
