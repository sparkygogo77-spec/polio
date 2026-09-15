# The production loop

From a line drawn on the board to a finished element on the page: every call,
in order, what goes up, what comes back, who pays for it, and what it costs.

This is an audit, not a design document. It was written by reading the code
and measuring the payloads, and it is meant to be the ground for optimising
the API calling later — so where a number is measured it says so, and where a
number is estimated it says that too, along with how to check it.

Measured against this repository with `site/document.json` (BLACKORB: 2 pages,
33 parts, 19 of them with their own prompt) as the board.

**The headline, since it moved:** the drawing path no longer goes through a
model that writes. A drawn Idea part is *traced* — the picture goes to
`recraft-ai/recraft-vectorize` and the SVG of the drawing comes back — and
Claude is reached only to read what the drawing *is* (which part, how big,
what it holds) and, as a fallback, to write a body when nothing traced at
all. Per drawn element that is one Claude call and one to three Replicate
calls, where it used to be up to four Claude calls.

---

## 1. The loop, call by call

A drawing goes on the queue (`queue.ts`) and `DrawQueue` runs one job at a
time. `runDrawJob` (`reshapeRun.ts`) is the whole of it.

| # | Call | Where from | Where to | Runs when |
|---|------|-----------|----------|-----------|
| 1 | `POST /api/studio/reshape` | `reshapeRun.ts` | **Claude, `claude-opus-5`** | Every drawing |
| 2 | `POST /api/studio/image` (`vectorize`) | `drawRun.ts` | **Replicate**, `recraft-ai/recraft-vectorize` | 1–3 times, for a part that came back `custom-idea` |
| 3 | `POST /api/studio/render` | `bodyRun.ts` `judge` | **Nobody** — headless Chromium on our own server | Once per trace or attempt |
| 4 | `POST /api/studio/body` | `bodyRun.ts` | **Claude, `claude-opus-5`** | Only when *nothing* traced **and** the part has words |
| 5 | `POST /api/studio/screenshot` | `agent.ts` | **Nobody** — headless Chromium | Once per page, before an ask, when the setting is on |
| 6 | `POST /api/studio/generate` | `agent.ts` | **Claude, `claude-opus-5`** | Plan / Critique / Fill / Finish / Ideas / Ask / Build |

Every Claude call is `client.beta.messages.stream(...)` with
`betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, so
`claude-opus-5` is what is asked for and not always what serves it. The model
that actually answered comes back on `usage.model`, and the prices below are
Opus 5's.

### 1 · Read the drawing — `/api/studio/reshape`

**Sent** (`reshapeRun.ts` → route):

| Block | What | Measured size |
|---|---|---|
| system | The reading rules: the outline is a hard boundary, the proportion is held, what marks inside a boundary mean | 3,096 chars ≈ **885 tok** |
| *cache breakpoint* | The library: 225 parts as `id — name · category · w×h · blurb` | 18,934 chars ≈ **5,410 tok** |
| text | "THE DRAWING…" — the picture announced before it is shown | ≈ 110 tok |
| image | `pictureOf(strokes)` at its default: the strokes on white with the board's rim, 640 × 640 PNG | 71,824 base64 chars, **546 image tok** |
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
included — is in the cached prefix: **6,295 tokens**, the same bytes on every
drawing, read from the cache by any drawing within the five-minute window.

### 2 · Trace the drawing — `/api/studio/image`, kind `vectorize`

Reached only for `custom-idea`, from `bodyFor` → `drawBody`.

**Sent**: `{ kind: "vectorize", picture, label, w, h }`. The route hands
Replicate **only** `{ image: "data:image/png;base64,…" }` — the picture and
nothing else. No words, no palette, no size, no outline: there is nothing to
describe because the line is right there.

The picture is redrawn for each go, up the `LADDER` in `drawRun.ts`. Every
rung crops to the ink (the part's box *is* the drawing's box) and drops the
board's rim; what the rungs turn is how easy the ink is to trace:

| Go | Picture | Measured base64 |
|---|---|---|
| 1 · as drawn | 640px, 8px line, cropped | 46,540 chars (a helix) · 40,080 (a star) |
| 2 · thickened | 768px, 16px line, cropped, pure black on white | 54,996 · 51,212 |
| 3 · thicker still, no ground | 768px, 26px line, cropped, contrast, **transparent** | 41,660 · 44,184 |

**Back**: the SVG of what was in the picture, cleaned by `cleanSnippet` under
the same rules a written body gets, refused over `RENDER_LIMIT` (240,000
chars). The route also strips the white plate a vectorizer traces under the
drawing (`dropGround`), which is a rectangle the size of the frame.

**Price**: `RENDER_COST.vectorize` in `renderer.ts` — **$0.08** a go.
Hardcoded, not read back from Replicate.

### 3 · Look at what came back — `/api/studio/render`

No model. Chromium opens the fragment alone in a box exactly `w × h`, **cut
to the part's own `clip`** so the silhouette scored is the silhouette the
board will show, with the page's content policy (`frameDoc`:
`default-src 'none'`, inline styles, `data:` images) and every non-`data:`
request aborted, then screenshots it with `omitBackground`.

`targetFor` decides what it is scored against, and this is the part that
changed most:

- **Closed, and enclosing enough of its own box** → the person drew the edge
  of a thing, so the thing is the area inside it. Both sides are filled and
  the score is area against area.
- **Otherwise** → the person drew a line, so the line is the thing. Both
  sides stay as ink and the score is ink against ink with a tolerance band
  the width of the drawn stroke.

Never thin ink against a filled area, which is what capped every run before:
a traced line scored against a filled ribbon tops out at the ink's own share
of the shape however good the trace is.

**Measured**: 0.41–0.49 s per call, and a **fresh Chromium launch every time**
(`found.pw.chromium.launch(...)` inside the handler).

### 4 · Write a body — `/api/studio/body`

The fallback, and only the fallback: reached when `drawBody` returned nothing
at all — no token, a refusal, an empty answer — *and* the part has words to
work from. It is called with `renderer: false`, because the tracer has
already been asked and had nothing.

**Sent**:

| Block | What | Size |
|---|---|---|
| system | The six hard rules: self-contained, fills the outline, stays in the box, is the content not a description, uses the palette, under 24,000 chars | 2,239 chars ≈ **640 tok** |
| *cache breakpoint* | "You are writing one part's body…" | ≈ **25 tok** |
| image | The drawing, 640 × 640 | **546 tok** |
| image | The last attempt as it rendered (`shot`) | 137 tok at 320 × 320; 480 at 900 × 400; 1,229 at 1280 × 720 |
| text | Size, label, prompt, the outline as a path, the palette, the critique, and **the whole previous attempt** | path 1,919–4,006 chars (**640–1,335 tok**); previous sliced to `SNIPPET_LIMIT` = 24,000 chars (**up to 8,000 tok**) |

**Back**: `{ code, note }` against `SCHEMA`. `max_tokens: 24000`,
`thinking: adaptive`, `effort: "medium"`. Up to three attempts, best kept.

### 5 · The pictures — `/api/studio/screenshot`

Before an ask, `screenshotPages(limit, device)` photographs the first
`studio.screenshotPages` pages (default 4) one at a time, POSTing the **whole
document** each time.

**Measured**: 1280 × 2121 PNG, 262,827 bytes, **2.8 s**, fresh Chromium per
page. There is a 90 s client deadline per page (`SHOT_DEADLINE_MS`).

### 6 · The ask — `/api/studio/generate`

Two shapes, one route.

- **Nothing vined** (the default): the whole blueprint goes in the **last**
  block, uncached, every time. Measured for BLACKORB: **19,345 chars ≈ 5,527
  tok**.
- **Pieces vined to the thread**: `briefPrefix(markdown)` goes first with
  `cache_control` (**4,376 chars ≈ 1,250 tok**), then only the pieces whose
  fingerprint has moved since this thread last sent them, then `skipped` as a
  count.

Plus the pictures, the mode instruction, and — for Build — the
`REPO_CONTRACT` (1,094 chars) and the scaffold contract: the file list
`buildScaffold()` already wrote from the document, deterministically, in the
browser, with no model involved.

`max_tokens: 64000` for Build, `32000` otherwise; `effort: "high"` except
Ideas. The route holds its own budget (`ANSWER_BUDGET_MS`) and answers itself
rather than being killed mid-call; the browser holds a second deadline (330 s
for Build, 210 s otherwise).

---

## 2. How the loop decides to go again

`drawBody`, `drawRun.ts`. The bar is `GOOD_ENOUGH = 0.72`; the budget is
`MAX_TRACES = 3`, one per rung of the ladder.

```
go n     draw the picture at rung n (crop, thicken, harden, drop the ground)
         → trace it            (/api/studio/image, vectorize, $0.08)
         → clean it            (cleanSnippet)
         → render it clipped   (/api/studio/render)
         → score it            (area v area, or ink v ink with tolerance)
         score ≥ 0.72 → stop, keep it
         score  = -1  → stop (no headless browser, so nothing was compared)
         nothing traced → stop, and fall through to the written body
         otherwise    → next rung
keep     the BEST go, never the last
```

Under the bar it goes again **on the picture, not on words**: there is
nothing to argue with, so what changes is what the tracer was given. The
written loop, when it is reached, still argues — it gets the overlap, a
picture of what it rendered and what is short.

---

## 3. Where the key comes from, at each step

| Call | Key | Precedence | What happens without it |
|---|---|---|---|
| `/api/studio/reshape` | `ANTHROPIC_API_KEY` | **Server env wins**, else `x-anthropic-key` from the browser keys panel | HTTP 200, `reason: "no-key"`. The part still takes the drawing's proportion and shape |
| `/api/studio/body` | `ANTHROPIC_API_KEY` | **Server env wins**, else `x-anthropic-key` | HTTP 200, `reason: "no-key"`. The part keeps its shape and its prompt |
| `/api/studio/image` | `REPLICATE_API_TOKEN` | **Browser header wins**, else server env | HTTP 200, `reason: "unavailable"`. The loop falls through to the written body |
| `/api/studio/render` | none | — | `reason: "no-playwright"`; the body is kept unjudged (`overlap: -1`) |
| `/api/studio/screenshot` | none | — | `available: false`; the words go alone |
| `/api/studio/generate` | `ANTHROPIC_API_KEY` | **Server env wins**, else `x-anthropic-key` | HTTP 200, `reason: "no-key"`; copy the blueprint into any agent |
| `/api/studio/publish` | `GITHUB_TOKEN` | Server env only | Not configured |
| `/api/studio/deploy` | `VERCEL_TOKEN` | `x-vercel-token` from the keys panel, else server env | Not configured |

The browser's side is `keyHeader()` and `rendererHeader()` in `agent.ts`,
reading `heldKeys()` from the keys panel. A supplied key is used for the one call
and nothing else: never stored, never logged, never echoed.
`/api/keys/status` answers a name and a boolean, nothing more.

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
| Replicate, trace (`recraft-vectorize`) | — | — | — | **$0.08 a call** |
| Replicate, vector (`recraft-v3-svg`) | — | — | — | $0.08 a call |
| Replicate, raster (`flux-2-pro`) | — | — | — | $0.04 a call |

### How these numbers were arrived at

Input tokens are from measured character counts at **3.5 chars/token** for
prose and markdown and **3.0 chars/token** for SVG and path data. Image
tokens are `width × height / 750` after the API's downscale to 1,568 px on the
long edge — so the 1280 × 2121 page screenshot becomes 946 × 1568 and costs
**1,978 tokens**.

**Output tokens are the one thing here that is not measured.** Every Claude
call runs `thinking: adaptive`, and thinking bills as output at $25/MTok. The
estimates below assume **1,500 output tokens** for a reshape, **2,600** for a
written body, and **6,000–20,000** for an ask. Nothing in the app records a
real output count today (see §5), which is exactly why this is an estimate.

### One drawn element

| Path | Calls | Cost |
|---|---|---|
| **A part the library has** — the common case | 1 reshape | **$0.081** cold · **$0.045** warm |
| **An Idea part, traced first go** | reshape + 1 trace + 1 render | **$0.125** warm |
| **An Idea part, three goes at the trace** | reshape + 3 traces + 3 renders | **$0.285** warm |
| **An Idea part, nothing traced, words to fall back on** | reshape + up to 3 written attempts | **$0.30** warm |

"Cold" is the first drawing: the 6,295-token library prefix is written to the
cache at 1.25×. "Warm" is any drawing within five minutes of the last one —
the queue runs one job at a time at roughly 20–40 s each, so a session of
drawings stays warm, and a drawing after a five-minute pause pays the write
again.

The arithmetic, so it can be re-run with better output numbers:

```
reshape  cold  6,295 × $6.25/M + 906 × $5/M + 1,500 × $25/M = $0.0814
reshape  warm  6,295 × $0.50/M + 906 × $5/M + 1,500 × $25/M = $0.0452
one trace                                                     $0.0800
written body #1 (no previous)   2,736 × $5/M + 2,600 × $25/M = $0.0787
written body #2, #3             4,306 × $5/M + 2,600 × $25/M = $0.0865
```

Note what the tracer changed about the shape of this: **three goes at the
trace cost $0.24 flat**, because a trace is priced per press and carries no
tokens at all. The old written path's three goes cost $0.29 in tokens *plus*
the $0.08 renderer call, and were slower.

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
nothing, and takes milliseconds; only the gaps are asked for.

A whole site, end to end — 20 drawn parts of which 5 are Idea parts, 2 pages,
three asks (Plan, Critique, Finish) and one Build:

| | | |
|---|---|---|
| 20 reshape calls | 1 cold + 19 warm | $0.94 |
| 5 Idea parts | 2 traced first go, 3 taking all three | $0.88 |
| 3 asks with pictures | ≈10,400 in, ≈6,000 out each | $0.61 |
| 1 Build | as above | $0.56 |
| | **total** | **≈ $2.99** |

### Where the money actually is

**The Claude half is output-bound.** Roughly 90% of the Claude spend is
output tokens at $25/MTok; every input-side optimisation in §5 together moves
about a tenth of it. The levers that move the rest are lower `effort`,
smaller `max_tokens`, and a cheaper model for the mechanical calls.

For scale: the reshape call is a structured read of a drawing against a fixed
library, which is the most mechanical call in the app. On Sonnet 5 the same
call is `6,295 × $0.20/M + 906 × $2/M + 1,500 × $10/M = $0.018` against
$0.045 — 60% off, on 20 calls a site.

**The Replicate half is flat per press**, so the only lever there is how many
goes the ladder takes. Two-thirds of a three-go part's Replicate bill is the
second and third rungs.

---

## 5. Marked

### Asked for twice

- **The drawing is rasterised four times for one Idea part.** `pictureOf`
  runs once in `DrawBoard.tsx` for `job.picture` (the reshape call's 640px
  rim-on picture) and once per rung in `drawRun.ts` (three crops). They are
  genuinely different pictures, so this is not waste — but a part that then
  falls through to the written body rasterises a *fifth*, at the default
  again, when `job.picture` is already in hand and identical.
- **The drawing goes up twice to two services**: once to Claude for the
  reading, once (to three times) to Replicate for the trace. Different
  renderings, so both are earned; the reading's 546 image tokens are billed
  once per drawing.
- **The author's words go up twice inside one written-body call.** The
  fallback sends `prompt: [node.prompt, drawn.words].join("\n")`, and
  `node.prompt` at that moment is the prompt the reshape call *just wrote out
  of those words*.
- **The drawing is described three ways in one reshape call**: the picture,
  the strokes as numbers, and the measured boundary. Deliberate and
  documented, and cheap — `sketchToText` measures ~160 chars, about 45
  tokens. Listed so it is not mistaken for a cost problem.
- **The blueprint and the pictures go whole on every ask.** Plan, Critique,
  Finish and Build each carry the same 5,527-token blueprint and the same
  3,956 tokens of screenshots, uncached, because the cached path only engages
  when pieces are vined. Four asks re-send about 38,000 tokens.

### Sent and not used

- **`pieces[].links` never reaches the model.** `usePieces()` builds the chain
  reasons (`chainLines`), `Piece` carries them, `piecesFrom` fingerprints
  them, and `/api/studio/generate` has the code to print them (`chained: …`).
  But `askClaude` in `agent.ts` maps pieces to
  `{ id, label, where, prompt, size, neighbours }` and **drops `links`**. On
  the vined path the chains are silently absent; they survive only in the
  whole blueprint, which the vined path does not send. This is a bug, not an
  optimisation.
- **`label`, `w` and `h` are sent to the tracer and never used.** `drawRun`
  posts them; the route's `input()` returns `{ image }` alone for a
  `vectorize` kind. Harmless, but they are in the request.
- **`pieces[].id` is sent and never read** by the generate route.
- **Every usage figure the body route returns is dropped.** The route answers
  `usage: { input, output, cached, model }`; `askForBody` reads only
  `{ ok, html, note, message, reason }`. The reshape route's usage is reduced
  to `usage?.model`. `askClaude` keeps `cached` and `input` and drops
  `output`. **Nothing in the app records an output token**, which is the one
  number that would settle §4 — and output is ~90% of the Claude bill.
- **A 6,000-px-tall screenshot is sent and cannot be read.** The route caps
  the page height at 6,000 px; the API then downscales the long edge to
  1,568, which squeezes a 1280-wide shot to **334 px wide**. It costs 699
  tokens and no text on it is legible. The measured 2,121-px page is fine
  (946 wide); the cap is where this breaks.

### Fixed since the last pass, and worth not undoing

- **The tracer is no longer judged on something it was never shown.** It used
  to be given words and a size and then scored on silhouette overlap against
  an outline it had not seen. It now gets the drawing itself, and the render
  it is scored from is cut to the same outline the board cuts to.
- **Thin ink is no longer scored against a filled area.** `targetFor` picks
  area-against-area for a closed drawing that encloses something and
  ink-against-ink with a tolerance band for a line. That comparison was the
  ceiling on every previous run.

### Cacheable between goes

- **The body route's cache breakpoint never takes.** The prefix in front of
  it is the system prompt (640 tok) plus a 25-token sentence — about 665
  tokens, under the 1,024-token minimum a prefix needs before it is cached at
  all. The `cache_control` on `body/route.ts:154` is, as written, a no-op on
  every call.
- **Moving that breakpoint past the drawing would make it real.** The drawing
  image is identical across all three attempts at one part. Marked there, the
  prefix is 640 + 25 + 546 ≈ 1,211 tokens — over the minimum — and attempts 2
  and 3 read it instead of sending it. Worth about 1,200 tokens a retry.
- **The outline path is stable across attempts and is not cached.** 640–1,335
  tokens, sent unchanged three times, in the same text block as the critique
  and the previous attempt, which do change.
- **The whole blueprint is stable across an ask session and is not cached**
  unless pieces are vined. `briefPrefix` already exists and already carries
  `cache_control`; the Pages half is what varies, and it is the half that is
  not split out on the unvined path.
- **The screenshots are stable across asks and are not cached.** Three asks in
  a row against an unchanged board re-send the same 3,956 image tokens.
- **The reshape library prefix is the one thing that is cached properly**:
  6,295 tokens, first block, the same bytes on every drawing, five-minute
  window. It is the model for the rest.

### Not an API cost, but part of the loop

- **A fresh Chromium per request, every time.** `withPreview` and
  `/api/studio/render` each call `chromium.launch()` inside the handler. One
  Idea part at three goes launches three browsers; a four-page ask launches
  four more. Measured: 0.45 s a render, 2.8 s a page screenshot.
- **The whole document is uploaded once per page photographed** — 33 KB × 4 —
  because the document travels in the request body rather than being
  addressed.

---

## 6. Re-measuring this

Nothing here needs a key.

```
npm run build && npx next start          # production, as the deploy runs it
# blueprint and brief-prefix sizes: put site/document.json into
# localStorage["builder.studio"] as {state: doc, version: 0}, reload /builder,
# call window.__studioOpenBrief(), read [data-brief-body].textContent
# page screenshot: POST site/document.json to /api/studio/screenshot and read
# width/height out of the PNG header (bytes 16..24)
# body render: POST a fragment to /api/studio/render
# ladder pictures: run pictureOf's own arithmetic per rung of drawRun.LADDER
# outline paths: node --experimental-strip-types against a copy of sketch.ts,
# call outlinePath({ strokes, words: "" }) and measure .cut
```

The library prefix is `FEATURES` printed as
`id — name · category · w×h · blurb(≤140)`, one per line; 225 entries,
18,934 characters at the time of writing.

The figure that most needs replacing with a measurement is output tokens.
Every route already returns `usage.output_tokens`; §5 says where it is
dropped.
