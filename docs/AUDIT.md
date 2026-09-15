# What actually works

An audit of the Builder as merged, not as described. Two rankings — what
fluid website design needs under it, and what is genuinely novel — each
feature given a verdict backed by evidence, not by a passing test alone.
Then the same items re-ranked by the gap between what they promise and
what they deliver, biggest gap first, because that list is what gets
worked next.

Audited at `d1084ea` (`claude/template-ui-website-builder-11bfgl`), 2026-09-11.

## How this was checked

Three kinds of evidence, named per item below:

- **Run myself, this session.** A fresh `npm run build && next start` of
  this exact commit, then the full scratchpad battery (23 suites) and
  every `tests/*.mjs` (44 files) driven against it — the same battery the
  merge process runs before every push. Two real bugs were found and fixed
  this way while preparing this audit (see the gap list, #1).
- **Read and reproduced by hand.** For a handful of features I drove the
  Builder directly with Playwright beyond what the suites already cover —
  seeding a real multi-part, multi-page document and screenshotting the
  live result, opening the iteration book with no key and reading its
  actual message, checking the deployed site's key status over HTTP.
  Screenshots are under the session scratchpad; `docs/shots/cube.png` is
  checked into the repo already.
- **Cited from `docs/PRODUCTION-LOOP.md`.** A separate, more detailed
  audit of the drawing-to-part pipeline landed in this same merge window —
  call-by-call, measured payload sizes, real dollar costs, and a list of
  bugs found by reading the code and printing what actually crosses the
  wire. Where I cite it below I have read the relevant section and the
  code it points at, not just the conclusion.

**On keys.** This environment and the live deployment
(`https://polio-two.vercel.app`) both currently have **no server-side keys
configured** — confirmed by calling `/api/keys/status` on the live site
directly: `ANTHROPIC_API_KEY`, `REPLICATE_API_TOKEN`, `GITHUB_TOKEN` and
`VERCEL_TOKEN` all answer `false`. So today, in production, every
AI-dependent path runs in its no-key fallback. I did not paste a personal
key into the keys panel to force the real paths, and I did not attempt a real
Publish or Go Live even though a `GITHUB_TOKEN` happens to be present in
*this* sandbox's own environment (scoped to this repository by the harness
that runs me) — exercising Publish for real would write a commit as a side
effect of an audit, which is not this task. Where a verdict depends on a
key I did not have, it says so explicitly rather than guessing at what a
real call would do.

---

## 1. Fluid website design — the essentials

Ranked by how load-bearing each is: remove it, and building a site here is
worse than writing the HTML by hand.

### 1. Real, self-contained parts — 226 of them, identical on the board, live, and in Build
**Works as intended.** Every catalog id resolves to an actual React
component (no legacy fallback path exists), and the same component runs
in three places — inert on the board, interactive in Preview, copied
verbatim by the scaffold into the generated codebase — so what you see
while building is what ships.
*Checked:* this session's own battery, `all.mjs` (19/19) and `parts.mjs`
(13/13): every catalog id renders a real part, not a fallback, at desktop
and at 390px phone width. These two suites were **not** green when I
started this audit — see the gap list (#1) for the bug and the fix.
Also confirmed by hand: seeded a bare `hero-split` part with no prompt and
no content and screenshotted the live render — a full hero section with
sensible placeholder copy ("Say the one thing this site does / in a
single line people remember", two buttons), not a blank box.

### 2. The canvas — place, drag, resize, snap
**Works as intended.** Numeric size and position, flush-left/right/centre,
resize handles, snapping, marquee select and grouping.
*Checked:* `wheel.mjs` (171/171) and `frame.mjs` (32/32) drive all of this
directly — not existence checks, actual drags and resizes with the
resulting node geometry asserted.

### 3. Live preview — a real interactive site, not a screenshot
**Works as intended.** `/builder/preview` renders the actual document with
pointer events on, real routing between pages, real scrolling.
*Checked:* `live.mjs` (23/23), `preview.mjs` (11/11). Confirmed by hand: a
seeded two-page document rendered as a working page at `/builder/preview`
with a page-tab nav and a "live · 47ms" status readout, screenshotted.

### 4. Colour — six roles from one accent, any element can override
**Works as intended.** Naming a role repaints every part that reads it;
one element can still take a colour of its own without leaving the
palette.
*Checked:* `colour.mjs` (12/12) — role repaint, per-element override,
and that the override reaches the live site, not just the board.

### 5. Background and texture layers
**Works as intended.** A stack of layers (flat colour, gradient, image,
noise/grain), each targetable to page or surfaces, merges into one
picture.
*Checked:* `texture.mjs` (19/19), `layers.mjs` (13/13), `texture-patch.mjs`
(28/28).

### 6. Multi-page, with real navigation between them
**Works as intended.** A part's `Links to` field stores a real link
(`{kind:"page", target}`); the header component and hero/CTA buttons
resolve it and the live preview actually navigates.
*Checked:* `live.mjs`'s "header link navigates to the page with that
name" — asserts the URL changed and the target page's own content is on
screen, not just that a click fired.

### 7. Responsive frame widths — desktop, tablet, phone, real reflow
**Works as intended.** Each width is the device's real viewport, not a
scaled preview; parts genuinely reflow rather than just shrinking.
*Checked:* `board-layout.mjs` (65/65, including "everything still draws
at 390" — every part, not a sample), `parts.mjs`'s phone-width pass.

### 8. Publish (to GitHub) and Go live (to Vercel)
**Half works — here is exactly where it stops.** The routes, the no-token
messaging, and the safety rails (a repository allow-list, a bad token
correctly rejected by the *real* Vercel API) are all real and tested. What
is not tested — by this audit or, as far as `/api/keys/status` shows, by
the live deployment itself right now — is a **successful** publish or
deploy, because no environment I have access to has a working
`GITHUB_TOKEN`/`VERCEL_TOKEN` configured for the app, and I deliberately
did not supply one to avoid writing to a real repository as a side effect
of an audit.
*Checked:* `go-live.mjs` — "with no token there is nothing to deploy
with", "a bad token gets as far as Vercel and is reported as a bad token"
(a real network call, not mocked), the GitHub repo allow-list enforced and
named in the error. Confirmed by hand: opened the iteration book with no
key and read the Publish row verbatim — `Publish [no GitHub token ·
download instead]` with a working Download fallback beside the disabled
push.

### 9. Undo/redo and keyboard-first editing
**Works as intended.** Every tool has a shortcut; undo restores the exact
prior state including mid-drag origins.
*Checked:* `studio.mjs`'s "undo restores the drag origin", `bugs.mjs`'s
sweep of shortcuts and reload survival.

### 10. The parts shelf — 226 parts, searchable, three clicks away
**Works as intended.** Category → subgroup → part, or type to search
across all of them.
*Checked:* `library.mjs` (15/15), `shelf.mjs` (24/24).

---

## 2. Genuinely novel — nothing else has these

### 1. Drawing a part and having it become real
**Half works — here is exactly where it stops.** The pipeline is real and
well-engineered: a drawing is read once by Claude (what it is, not what it
looks like), then *traced* by Replicate — the picture goes to
`recraft-ai/recraft-vectorize` and the SVG of what's actually in the
picture comes back — scored against the drawn outline, retried up to
three times on the picture itself when it misses, and only falls back to
a Claude-written body when nothing traced at all. This is a real, recent
correction: it used to describe the drawing in words and ask Claude to
redraw it, which is exactly the kind of double-translation that loses a
drawing. **But** it needs two keys this app does not have anywhere I can
check: `ANTHROPIC_API_KEY` for the read, `REPLICATE_API_TOKEN` for the
trace. On the live deployment today, both are unset, so every drawn part
falls back to shape-and-size-from-geometry alone — no read, no trace, no
written body. I have not seen the AI-driven path run for real.
*Checked:* `docs/PRODUCTION-LOOP.md` (a call-by-call audit with measured
payload sizes and real costs — $0.045–$0.30 per drawn element depending
on path); `tests/shapes.mjs` (21/21, a local stand-in tracer so the loop
itself is proven without a real Replicate token — 4 of 5 benchmark
drawings clear the pass bar on the first trace, the fifth on the second).
`/api/keys/status` on the live deployment: `ANTHROPIC_API_KEY: false`,
`REPLICATE_API_TOKEN: false`.

### 2. The Timeline — every iteration as a place, not a list
**Works as intended.** Landed calls scatter as boxes you drag anywhere;
strands between them are sampled hard-light curves, not lines; a chain
prompt gets a headline box, a drawing gets a small purple piece with no
headline. Clicking a box grows a card out of it in place rather than
opening a side panel.
*Checked:* `timeline-centre.mjs` (15/15), `timeline-view.mjs` (15/15) —
the view re-centres on where the boxes actually are, weighted by size,
never mid-drag. None of this needs a key; it is pure client state, and it
was driven end to end with seeded documents, not just checked for
presence.

### 3. "This iteration" — a flag and one dot, nothing more
**Works as intended.** One flag marks where a session is working, and a
new ask hangs off the flagged box rather than whatever landed last; one
dot is green when an iteration's work finished and red while it is
running or was abandoned — never a third colour. Both persist across a
reload.
*Checked:* `current.mjs` (22/22) — four seeded iterations, the flag
appearing on exactly one box, a thread left `running` correctly turning
to `abandoned` on rehydrate (the tab that was running it is gone), the
prompt section following the flag rather than the last-landed thread.

### 4. The light placer — one lamp, every part works out its own shadow
**Works as intended, and this session fixed a real regression in it.**
Drag one lamp from the wheel onto the page; every part computes its own
shadow direction and length from where its centre sits relative to the
lamp. It used to only work on the button primitive — every other part in
the library (a hero, a card, a gallery, a form) sat there unlit, which is
a bug this session's merges found and fixed: the shadow is now carried on
the box every part shares, not something each part has to opt into.
*Checked:* `light-placer.mjs` (16/16) — dragged from the wheel, dropped at
a measured page position, shadow strength slider verified to actually
change strength, Escape cancels, a drop off the page leaves the lamp
untouched. `board-speed.mjs`'s measured drag performance after the fix:
p95 15.9ms, nothing over 16.7ms across 650 frames — the fix did not trade
correctness for a stutter.

### 5. Chain links with reasons
**Half works — here is exactly where it stops.** Drawing a wire between
two parts does not just join them: the reason is *derived*, in order — an
explicit condition in the target's own words, then the first value a data
chain carries, then the sentence naming the other part, then the bare
relation — and it is capped to one line so it reads on the wire itself.
This reaches the compiled blueprint correctly (the common, default path,
which sends the whole document). **It does not reach Claude on the
"pieces vined to the thread" path**: `askClaude` maps each piece to
`{id, label, where, prompt, size, neighbours}` and drops `links`, so on
that one optimization path — sending only the pieces whose fingerprint
moved, instead of the whole blueprint — the reasons are silently absent
from what the model actually reads. This is documented as a real bug, not
a design choice, in `docs/PRODUCTION-LOOP.md` §5.
*Checked:* `chain-links.mjs` (25/25) — on the board and in the blueprint.
The vined-path gap is cited from `PRODUCTION-LOOP.md`'s own reading of
`agent.ts`'s piece-mapping code, which names the exact line.

### 6. A drawn or dropped box becomes a real, turning 3D cube
**Works as intended — and this session closed the last real gap in it.**
This is the one part in the library that is not drawn or written at all:
recognition is pure geometry (three quadrilaterals meeting at a vertex, a
hexagon with a Y in it, or a plain box when the words say "cube") with no
model call anywhere, and the element itself is six faces in a real
`preserve-3d` box — drag to turn, arrow keys to step, it eases onto the
nearest right angle rather than getting stuck. Empty faces are left
blank rather than invented, because filler is what makes a page read as
generated. Two real bugs were found and fixed in the same merge window
this audit covers: this session found the part's root was missing the
`data-part` attribute every other part carries (a one-line mistake — `id=`
instead of `data-part=`), breaking the "every part is a real component"
coverage guarantee for exactly this one part; separately, the cube
dropped straight from the shelf looked inert because the board's own
pointer-capture silently overrode the cube's a frame later, which is now
fixed with an explicit `stopPropagation`.
*Checked:* `cube.mjs` (51/51, the drawn-recognition path) and the newly
added `cube-part.mjs` (29/29, the shelf-dropped path specifically: inert
until picked up, a real drag that turns rather than moves the element,
settling on a right angle, all four arrow-key sides plus the top, face
editing, survival across a reload, presence in what Publish sends, and
turning on the live page too) — both green on this exact merged tree.
`docs/shots/cube.png` is a first-party screenshot set from three angles.

### 7. The scaffold — the site is written from the document, not described to Claude
**Works as intended.** `buildScaffold()` renders every part once into a
detached root, reads the DOM it actually produced, and turns that
directly into a codebase — tokens, one component per part carrying the
exact markup, a page per page. Deterministic: the same document produces
the same bytes every time. Only the gaps a document can't hold — an Idea
part with no body, where data comes from — are then asked of Claude, and
its answer is merged over the scaffold by path.
*Checked:* `scaffold.mjs` (31/31), including the determinism check
directly (same document in, same bytes out, twice).

### 8. The radial wheel — a part picker you draw with, not a dropdown
**Works as intended.** Four quadrants around the pointer, right-drag to
turn it, a middle button that's always the way back, a third level that
replaces rather than floats beside the second.
*Checked:* `wheel.mjs` (171/171) — the single most exhaustive suite in the
battery, covering the menu geometry, the add-disc's own drawing surface
and dark-matter ground, category browsing, search, and the wheel's own
performance.

### 9. Reiterate — one patch, re-rolled, from the same photograph
**Works as intended, and needs no key at all.** Re-pressing it does not
regenerate anything with a model; it re-crops the same source photograph
at a different window, scale and rotation, so eight presses in a row
land eight genuinely different, validly-bounded patches without ever
running off the picture — a close crop, a middling one, a wide one, a
strip, not eight samples of one distribution.
*Checked:* `texture-patch.mjs`'s Reiterate section (part of its 28/28) —
eight consecutive presses, asserts no two give the same patch, that the
patches come in more than one size band, and that none of them runs off
the source image.

### 10. The iteration book — a live, AI-readable blueprint of the whole board
**Works as intended, and needs no key to be useful.** The board compiles
to a real markdown brief and a JSON spec continuously, with no model
call — colours as roles, widths as shares of the frame, which part links
where, what a wire means — explicitly written to "stand alone" so it can
be pasted into any agent when there's no key to ask Claude directly.
*Checked directly:* opened the book on a bare, freshly-cleared board with
no key configured and read the generated brief verbatim — a real,
correctly-structured "Untitled site, build brief" markdown document,
generated client-side, no network request involved. Also `brief-wording.mjs`
(14/14).

---

## 3. The gap, biggest first — what to loop on next

Same twenty items, re-ranked by the distance between what each promises
and what it currently delivers. A feature with no gap sits at the bottom
even if it is important; a feature that overclaims sits at the top even
if it is small.

1. **Cube's `data-part` and pointer-capture bugs (fixed this session).**
   Listed first because it is the sharpest illustration of the kind of gap
   this audit is for: two one-line mistakes (`id=` instead of `data-part=`,
   and a missing `stopPropagation`) made a real, working, well-tested
   feature *look* broken or absent from two different directions — a
   coverage check that silently lost one part out of 226, and a part that
   was live but felt inert because the board stole its pointer a frame
   later. Both are fixed and reverified (100/100 across `all.mjs`,
   `parts.mjs`, `cube.mjs`, `cube-part.mjs`) as of `d1084ea`. Left here as
   the standing example: a passing suite total hides exactly this kind of
   off-by-one until someone reads what actually failed.
2. **Drawing becomes a real part.** The most-promised, most-built novel
   feature in the app, and the one with no path to seeing it run for real
   in this environment or on the live deployment as configured today —
   both `ANTHROPIC_API_KEY` and `REPLICATE_API_TOKEN` are unset. The
   engineering is real and the no-key fallback is honest, but "drawing
   becomes real" is the single biggest promise in the product and it is
   currently unverifiable end to end by anyone without both keys in hand.
3. **Chain links with reasons.** A specific, named, already-diagnosed bug:
   the reason silently does not reach Claude on the "pieces vined" send
   path, only on the full-blueprint path. Small in code (one dropped
   field in one mapping function), but it means the exact feature the
   product is proudest of — a wire that explains itself — goes quiet
   precisely when the app is being most careful about what it sends.
4. **Publish and Go live.** Both are engineered to a standard I would
   trust — real error handling against the real Vercel API, a named
   allow-list — but neither has ever been exercised to a *successful*
   completion by this audit, and the live deployment itself currently has
   no token configured for either. The gap here is not the code; it is
   that "ship the site" — the actual point of a website builder — is
   unverified past the request leaving the browser.
5. **The screenshot-for-Claude cap** *(noted in `PRODUCTION-LOOP.md`, not
   independently reverified here)*. A page screenshot is capped at 6,000px
   tall before being sent to Claude ahead of an ask; the API's own
   downscale then squeezes a 1280-wide capture to 334px wide on a page
   near that cap, which the source doc says is illegible. If true this
   silently degrades what Claude sees of a long page precisely when
   screenshots are meant to ground an answer in what the board looks
   like.
6. **The rest of the fluid-design list** (parts, canvas, live preview,
   colour, background/texture, multi-page, responsive frames, undo/redo,
   the shelf) **and the rest of the novel list** (Timeline, "This
   iteration", light placer, the scaffold, the wheel, Reiterate, the
   iteration book) — no material gap found. Each was driven end to end by
   an automated suite that asserts real state changes rather than
   element existence, and the ones I could reach by hand behaved exactly
   as their own documentation says.
