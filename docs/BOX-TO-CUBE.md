# A drawn box becoming a real object

The running note for one arc: draw a box and get back a real, turnable 3D
cube with editable faces. One list, in the order the work was done, every
claim with a number and what measured it.

Branch `claude/exciting-meitner-xa0h2a`, off trunk `claude/template-ui-website-builder-11bfgl`.

## Where it stood before anything was changed

Measured by driving the Builder with Playwright against `next dev` on port
3000 with every `/api/studio/*` route answered `ok: false, reason: no-key`
(scratchpad `truth.mjs`, 2026-09-15):

- A plain box drawn with the pen (220 × 160 board px, snap mode, no words)
  and made real asked "Is this box a cube?" and made nothing until answered.
- Waved on, it landed as `custom-idea`, kind `surface`, 277 × 201, no cube:
  a flat part. That is the owner's report, reproduced.
- The reader and the tracer were both called on that road (`reshape`, `image`).
- The catalogue already claimed a box **with the word** cube or box beside
  it, and an isometric drawing (three quads at a corner, or a hexagon with a
  Y). Baselines before the change: `tests/cube.mjs` 59/59,
  `tests/coded.mjs` 39/39, `tests/oddness.mjs` 53/53.

## What was built, in the owner's order

1. **A drawn box is recognised as a box by its own geometry, and says so.**
   `shapeKind.isBox`: one closed line, four corners (three to six after the
   wobble is taken out), filling more than 93% of its own frame
   (`outlineShape` "box"), drawn alone. `kindOfSketch` reads it as the cube
   when nothing is said beside it and the drawing is `lone` (nothing of the
   page inside it, nothing real drawn on; `reshapeRun.loneDrawing`). The
   disc says "a box: it will be a cube" while it is drawn, the part's chip
   says `box · cube`, the panel wears "a box, made a cube". A captioned box,
   a box round parts, or a box over a real part keep their old meaning. The
   "Is this box a cube?" question is gone for a lone box: it is decided.
2. **That box becomes a real object.** The cube keeps the drawn proportion
   (a square is a cube, a wide box is a wide box as deep as its short side,
   `cubeDims`); pitch is held within 85° so it cannot be tumbled upside
   down, spin into the limit is spent; on release it eases to the nearest
   rest pose, a three-quarter view (−18°, −32°) a quarter turn at a time,
   or tipped to the top (−72°) or bottom (+72°). Arrow keys step between
   rests. `facing` was wrong before (pitch +90 was called the top; it shows
   the bottom) and is read off the rest poses now. Resting yaw is folded
   into one turn.
3. **Faces are selectable, promptable, editable.** Press a face (a press that
   does not become a drag) and it is picked: it wears the board's mark, the
   panel marks its card, scrolls it in and hands its heading the keys.
   Naming a face in the panel turns the cube to show it. The wheel's pencil
   edits the picked face. Every face has its own prompt; the blueprint
   writes it. Face edits push undo.
4. **It survives what a flat part survives.** Move, resize by the handle
   (the object follows the box), the drawn ratio (kept from the drawing),
   undo, save and reopen: all walked below with numbers.
5. **The model road is behind the routing table.** `solidRoute.ts`,
   `solidRun.ts`: the `object` cell of the two-axis table routes to
   `tencent/hunyuan3d-2mv`; the cube's own four faces go up as the four
   views (`views`, a field the image route now takes for a mesh model);
   the card in the panel and the piece on the wheel light up the moment a
   Replicate token is present (browser keys panel or server, a yes-or-no only)
   and otherwise say what would light them, with no call made; the answer
   lands as `mesh-3d` with the cube kept, and "Back to the cube" is one
   press.

## The judged walk, measured

`tests/box-to-cube.mjs` drives the Builder with Playwright, every
`/api/studio/*` route mocked (`reshape`, `body`: no key; `image`: no token,
then a mocked solid answer), and photographs each step into `docs/shots/`.
Numbers below are that suite's own output (74 of 74 hold), run against
`next dev` on port 3000 and again, identically, against the production
build (`npm run build` rc 0, `next start` on port 4300): box-to-cube
74/74, cube 62/62, cube-part 29/29, oddness 53/53, coded 39/39,
scaffold 31/31. The shots in `docs/shots/box-to-cube-*.png` are from the
build run.

| Step | Measured | With |
|---|---|---|
| Draw a box with the pen, no words | 240 × 180 screen px, snap mode | Playwright pointer |
| It lands as the cube | `cube-3d`, kind `cube`, 302 × 227 board px (ratio 1.33 against 1.33 drawn), 240 screen px wide against 240 drawn, board zoom 0.794 | `localStorage` document, part bounding box |
| No model called | 0 calls to reshape, body or image | route counters |
| Object dims | 223 × 168 × 168 (74% of the part, depth = short side) | `data-cube-dims` |
| Rest pose on arrival | −18, −32 | `data-cube-turn` |
| Drag turns it | −18,−32 → −11,15 over 112 px | `data-cube-turn` mid-drag |
| Comes to rest | −18, 58 after 1558–1688 ms; written on the node | polled attribute, document |
| Cannot be tumbled | 480 px upward drag reaches 85° of a possible 202°; returns to 72, 58 | `data-cube-turn` |
| Pick a face by pressing it | `left` picked, mark on the face, panel card marked, `left heading` focused | `data-cube-pick`, `data-face-picked`, `document.activeElement` |
| Type words | "Hello there" on `left` on the node and on the cube | document, face innerText |
| Turn away and back | two quarter turns show `right`; words still on `left`, not on `right`; two back shows `left` with the words; four quarter turns return to `left` | `data-cube-face`, face innerText |
| Panel names a face | pressing `back` in the panel turns the cube to `back` | `data-cube-face` |
| Wheel's pencil | plate is about the picked face; writes "From the wheel" on it | `data-plate-face`, document |
| Move | 120,60 screen px dragged → 122,58 board px moved (snap) | document |
| Resize by the handle | 302 × 227 → 432 × 304 for 100,60 screen px; object 223×168×168 → 320×225×225 | document, `data-cube-dims` |
| Undo | resize then move taken back, 302 × 227 and 287,343 | document |
| Reload | cube, 432 × 304, faces, rest pose all back and drawn | document, `data-cube-turn` |
| Blueprint | carries the face's words, `for: the greeting`, the proportion line | brief body text |
| No token | card unlit, says "No Replicate token yet…", names `tencent/hunyuan3d-2mv`, 0 calls | `data-solid-*`, route counters |
| Token present (server, mocked status) | card lit; one stage-2 call with front 6740 b64 chars and views 14592, 16772, 9500; `said` routes to `object`; no key in the body or header | captured request |
| Mocked answer | lands as `mesh-3d` from `tencent/hunyuan3d-2mv`, cube kept with its words; Back to the cube restores `cube-3d` | document, DOM |

What this does **not** measure: the vendor. No Replicate call is made from
any test, so "a solid comes back" is the route's contract and the mocked
answer's shape, not a mesh seen. The one screenshot of the solid landed
(`box-to-cube-10-solid-landed.png`) shows the still with "the solid would
not load", which is the honest state for a GLB of 24 bytes.

## Suites touched

- `tests/cube.mjs` 62/62 (was 59/59): square → proportion, settle → rest,
  the top is the top.
- `tests/cube-part.mjs` 29/29: settle → rest.
- `tests/oddness.mjs` 53/53: a bare box is no longer asked about; the
  browser half asks about a scribble instead.
- `tests/coded.mjs` 39/39, `tests/scaffold.mjs` 31/31 unchanged.
- `tests/box-to-cube.mjs` 82/82, new (74 at the first pass; 76 with the
  Where it goes card; 82 with the limit and undo shots, the undo runs and
  the still).
- `tests/shapes.mjs` 21/21 alone against the build (15 of 15 traced); it
  read 13 of 15 under the dev server while the walk ran beside it, which
  was load, not the change.

## Left open

- The panel's "Where it goes" card read a cube as "a mark or small icon"
  routed to GPT Image 2, because it read the part's words and a cube has
  none. Fixed after the first pass: `planFor` reads the part first
  (`isSolidPart`), so a cube is "an object you can turn", one step, to
  `tencent/hunyuan3d-2mv`, the same answer the solid card gives. Checked
  by the walk suite.
- The still a solid falls back to is the front face drawn flat, which is
  blank when the front face is blank.

## Morning report

One list. Every number is from `tests/box-to-cube.mjs` run against the
production build (ports 4300 and 4302), or from the build itself. "Watched"
means I looked at the committed screenshot in `docs/shots/` myself;
"held by the suite" means a check read it off the DOM or the document and
I did not see it.

1. A person can draw a plain box with the pen, type nothing, press Make
   real, and get a real cube back. Before, they got a question and then a
   flat part. Measured: a 240 × 180 px box lands as `cube-3d`, 302 × 227
   board px, ratio 1.33 against 1.33 drawn, 240 screen px wide against 240
   drawn, zero model calls. Watched: `box-to-cube-1-drawn.png`,
   `box-to-cube-2-landed.png`.
2. The box says it is a box. The disc says "a box: it will be a cube"
   while it is drawn (held by the suite), and the part's chip says
   `box · cube` (watched in every shot from 2 on).
3. The cube is the shape they drew: a square box is a cube, a wide box is
   a wide box as deep as its short side. Measured: object 223 × 168 × 168
   inside the 302 × 227 part. Watched: shot 2, where the front is wider
   than it is tall.
4. They can turn it by dragging, on the board, the moment it lands. Measured:
   −18,−32 to −11,15 over 112 px of drag; it comes to rest at −18,58 after
   1.6 s, and that pose is written on the node. Watched: `box-to-cube-3-turned.png`.
5. They cannot tumble it into nonsense. Measured: 480 px of upward drag
   pitches it to 85° of a possible 202°, and it returns to a rest pose
   (72, 58). Watched: `box-to-cube-3b-pitch-limit-held.png`, the hand
   still down and the box pinned at the limit, and
   `box-to-cube-3c-pitch-limit-rested.png`, where it came to rest.
6. They can press a face to pick it, and the panel hands that face the
   keys, so typing puts words on it. Measured: the `left` face picked, its
   heading focused, "Hello there" on that face in the document and on the
   cube. Watched: `box-to-cube-4-face-written.png`, with the picked face
   outlined in the board's mark.
7. Turn it again and the words are still on that face. Measured: two
   quarter turns show `right`, "Hello there" is still on `left` and not on
   `right`; two back shows `left` with the words; four quarter turns come
   back to `left`. Watched: `box-to-cube-5-turned-away.png` (no words
   visible, the written face is behind) and `box-to-cube-6-turned-back.png`
   (the words back in front).
8. Naming a face in the panel turns the cube to show it, and the wheel's
   pencil edits the picked face. Measured: `back` named, cube shows
   `back`; "From the wheel" written from the wheel's plate. Watched: shot 7
   shows "From the wheel" on the front face. The wheel plate itself: held
   by the suite, not screenshotted.
9. They can move and resize the whole thing like any part. Measured: 120,60
   screen px of drag moves it 122,58 board px; the corner handle grows it
   from 302 × 227 to 432 × 304 and the object from 223×168×168 to
   320×225×225, with the words still on it. Watched:
   `box-to-cube-7-moved-resized.png`.
10. Undo takes the resize and then the move back (302 × 227, then 287,343),
    and a reload brings the cube, its size, its faces and its pose back.
    Watched: `box-to-cube-7b-undone.png`, the box back at its old size
    with both words on it. The reload is held by the suite.
10a. One undo takes back an edit, not a letter. "Hello there" typed as
    eleven keystrokes comes off the face with one press and back with one
    redo; a prompt of twenty-three keystrokes comes back with one press,
    and the size stays. Watched: `box-to-cube-4b-face-undo-redo.png`. The
    same helper serves the part's own prompt, contents, data and name.
10b. The still under a solid is the object: 512 × 360, 89 distinct colours
    at five bits, with the words on two faces, where it was one blank
    plate. Watched: `box-to-cube-10-solid-landed.png`.
11. The blueprint says all of it: the face's words, the face's own prompt
    ("for: the greeting"), the proportion, and what a drawn box means. Held
    by the suite.
12. With no key anywhere, nothing errors. The solid card is unlit, says
    "No Replicate token yet…", names `tencent/hunyuan3d-2mv`, and makes
    zero calls; the "Where it goes" card says "an object you can turn", one
    first pass. Watched: `box-to-cube-8-solid-unlit.png`.
13. The moment a token is present the road lights up and one call goes up
    the routing table. Measured: front view 6740 base64 chars plus three
    views of 14592, 16772 and 9500, words that route to `object`, the model
    slug `tencent/hunyuan3d-2mv`, no key in the body. Watched:
    `box-to-cube-9-solid-lit.png`.
14. The answer lands as a solid with the cube kept, and Back to the cube is
    one press. Watched: `box-to-cube-10-solid-landed.png`.

What falls short, by name:

- **The vendor was never reached.** Items 13 and 14 are a mocked route
  answering a 24-byte GLB. The request that goes up is measured; a real
  mesh coming back is the route's contract, not something seen.
- **The still is orthographic where the part is in perspective.** Shot 10
  is the object, but its edges are parallel where the live cube's converge
  a little; a person comparing the two side by side would see it.
- **The tumble test's return pose is the bottom row.** After a long upward
  drag it rests looking up at the bottom (72, 58), which is what the drag
  asked for; the suite then presses Up once to get back to the middle row.
- **The shapes bench once read 13 of 15** under the dev server while the
  walk ran beside it; alone on the build it is 15 of 15. Load, not the
  change, but it was seen.
- **Undo runs are timed, not semantic.** A pause of more than 1.5 s in the
  middle of typing one word makes two edits of it. Chosen over "until the
  field loses focus" because a field can lose focus without the person
  meaning the edit to end.

## Finished items, for the morning

One line each: what closed, the number that proves it, and how it was
seen. "Watched" is a committed screenshot I looked at; "held by the suite"
is a check that read it and I did not.

- A plain drawn box becomes a real cube with no words and no key: 240 × 180 drawn → `cube-3d` at 302 × 227, ratio 1.33 kept, 0 model calls. Watched.
- The box says it is a box: `box · cube` on the part chip, "a box: it will be a cube" on the disc. Chip watched; disc held by the suite.
- The object keeps the drawn proportion: 223 × 168 × 168 inside 302 × 227, depth the short side. Watched.
- It turns by dragging where it lands: −18,−32 → −11,15 over 112 px; rests at −18,58 in 1.6 s. Watched.
- It cannot be tumbled: 480 px of upward drag reaches 85° of a possible 202°, then returns to rest. Watched, held and rested.
- A face is picked by pressing it and typing lands on it: `left` picked, heading focused, "Hello there" on that face. Watched.
- The words stay on their face through turns: two quarters away, two back, four round, still on `left`. Watched, away and back.
- Naming a face in the panel turns the cube to it; the wheel's pencil writes on the picked face: "From the wheel" on `back`. Watched on the cube; the plate held by the suite.
- Move and resize like any part: 120,60 px → 122,58 moved; 302 × 227 → 432 × 304, object 320 × 225 × 225. Watched.
- Undo takes the resize and the move back: 302 × 227, then 287,343. Watched.
- One undo takes back an edit, not a letter: 11 keystrokes off a face in one press, 23 off the part's prompt in one press, size untouched. Watched (face); prompt held by the suite.
- Reload brings the cube, its size, faces and pose back. Held by the suite.
- The blueprint carries the faces, a face's own prompt, the proportion and what a drawn box means. Held by the suite.
- No key, no error: the solid card unlit, names `tencent/hunyuan3d-2mv`, 0 calls; "Where it goes" says "an object you can turn", one first pass. Watched.
- A token lights the road and one call goes up with four views (6740 + 14592 + 16772 + 9500 base64 chars), no key in the body. Watched.
- The answer lands as a solid with the cube kept; Back to the cube is one press. Watched.
- The still under a solid is the object: 512 × 360, 89 distinct colours where a blank plate had 1. Watched.
- Suites on the build: box-to-cube 82/82, cube 62/62, cube-part 29/29, oddness 53/53, coded 39/39, scaffold 32/32, shapes 21/21, audit-panel 25/25, import 32/32, ink 46/46, molten 121/121, menu-pass 101/101; typecheck clean, build rc 0.

Still open, by name:

- **The vendor**: a mocked route answering a 24-byte GLB, left alone on purpose until a key is on the site.
- **The still is orthographic** where the live cube is in perspective.
- **Undo runs are timed** (1.5 s), not semantic.
- **The reload, the disc caption, the wheel plate and the prompt undo** are held by the suite only.

## What a person does second

Four questions past the judged walk, measured by `tests/cube-second.mjs`
against the production build (31 of 31 on the board, port 4305; 7 of 7
in the fresh browser), each with what falls short named. Watched means
the committed shot in `docs/shots/cube-second-*.png`.

**More than one cube on a board.** Two boxes drawn become two cubes, each
at its own proportion (307 × 237 and 279 × 279), with no model called.
Picking one makes only that one hands-on; turning it leaves the other at
−18,−32; a face picked on one takes the words ("Alpha") and the other's
six stay blank; picking the other lets the first face go; the arrow keys
turn only the picked one; both come back after a reload with their own
words and poses. Watched: `cube-second-1-two-cubes.png`. Falls short:
nothing found. Note for anyone drawing several: boxes put down in one
sitting within reach of each other are one drawing by the board's own
ink rule, so draw one, make it real, then the next.

**A cube in a space beside a flat part.** A space drawn round a flat part
opens; a box drawn inside it becomes a cube (311 × 186); the cube has a
panel of its own in the space; the space counts "2 parts"; the cube turns
in there (to −18,58); Lock the layout locks both; dragging the space's
size handle carries the cube with it (311 × 186 at 191,491 → 374 × 220 at
256,567, object 230 × 138 × 138 → 277 × 163 × 163) and the flat part too
(480 × 200 → 578 × 237). Watched: `cube-second-2-in-a-space.png`,
`cube-second-2b-space-resized.png`. Fell short and fixed: the space's
own key on the board goes the moment a part is inside it, so a space
holding placed parts and no drawings had no panel to lock the layout
from; the picked part's panel now carries "This space" (`data-space-own`)
as the way back. Also fell short and fixed: the cube landed at a
fractional position (191.03, 491.38) where every other part lands on
whole pixels; a drawn part's landing is rounded now, and the suite holds
it to integers.

**A drawn box that is not square.** Pure: 480 × 160 stays 480 × 160,
140 × 420 stays 140 × 420, 50 × 40 grows to 150 × 120, 600 × 60 grows to
1200 × 120, depth is always the short side, and a 6:1 box is still a box.
On the board: a 360 × 90 box is a slab (502 × 126 part, object
371 × 93 × 93), a 90 × 300 box is a pillar (126 × 419, object
93 × 310 × 93), a 44 × 36 box grows to 148 × 120 in proportion (object
110 × 89 × 89). Watched: `cube-second-3-not-square.png`. Fell short and
fixed: a tiny box lost its proportion before the cube could keep it,
because the part floors (80 wide, 24 tall) were clamped one axis at a
time (44 × 36 → 80 × 36 → 192 × 120); both axes grow by one factor now.
Still short: on a slab or a pillar the narrow faces are as wide as the
object is deep, so a heading on them is the short side's 11%, 11 px at
these sizes, and reads as a label at best. The front heading is at the
11 px floor on all three.

**Saved and reopened in a new browser.** The document as Publish sends it
(`site/document.json`, 3395 bytes, one node) carries the cube, its faces
and its pose; the site was built with it; a fresh browser context with
nothing in it opened `/site`: the cube is on it, standing where it was
left (document −18,148, site −18,148), with "Second browser" on the left
face, at its drawn proportion (248 × 186 × 186); a visitor can turn it
(−18,148 → −18,188) and it comes to rest for them (−18,−122 after
1.5 s). Watched: `cube-second-4-fresh-browser.png`; the words are on the
face turned away at that pose, so the shot shows the object and not the
words. The document written for this was restored afterwards; the
repo's `site/document.json` is unchanged.

## The inventory, continued from the top (second pass)

Picked up where the inventory session stopped, one row at a time, each
check written first and run red against the code of the day before the
fix. Every suite below is new unless named otherwise; the numbers are the
suite's own count, and "red before" is what the same check said before
the change.

| Row | What changed | Check | Count |
|---|---|---|---|
| B27 | The Motion panel says a crate plays there and goes into the blueprint as a brief, and no part of the page plays it yet (`data-motion-reach`). Playing a crate on a live part stays open, named. | `tests/motion-reach.mjs`; "no renderer reads a crate" is derived from 39 renderer files' source | 7/7, 2 red before |
| C1 | A file the browser cannot decode is refused with the Import flow's sentence at every door (well, Texture drop, wheel captions, paste) and nothing is kept. | `tests/picture-refused.mjs`, 3 MB HEIC-labelled junk by the chooser, 1 MB TIFF-labelled by a drop | 9/9, 4 red before |
| C2 | A covering picture bakes at its own size (640 on the long edge), not the 320 px tile; one shared number `COVERS_AT`. | `tests/cover-tile.mjs`, decodes both baked tiles: 320 × 240 and 640 × 480, 26 KB and 408 KB | 5/5, 1 red before |
| C3 | An animation keeps its first frame and says so; a link drop is told to save the picture first; a see-through picture is kept lossless. Cost written down: a noisy 640 px cut-out is 1.2 MB as PNG against 274 KB as WebP, worst case. | `tests/picture-doors.mjs` | 9/9, 4 red before |
| C4 | The disc holds every recorded point to 0..1. | `tests/ink-on-disc.mjs`, a box dragged a fifth past the edge: x to 1.000, was 1.200 | 5/5, 2 red before |
| C6 | Several open lines, or one straight bar, cut nothing; a diagonal and a spiral still band. Measured, not as the row said: the old cut on three bars was a 12-point zigzag spanning 0.97 of the part's height, noise, not a sliver. | `tests/open-lines.mjs`; `outline-clip.mjs` 20/20 and `drawn-part.mjs` 22/22 hold | 6/6, 2 red before |
| C7 | A box qualified as a flat thing (text, search, check, info, … box) is no claim of shape. | `tests/box-words.mjs`, 7 solid and 13 flat phrasings; `cube-part.mjs` 29/29, `box-to-cube.mjs` 82/82, `cube.mjs` 63/63 hold | 7/7, 4 red before |
| C8 | One ceiling, `PART_MAX_H`, held on both sides in the outline fit, the checker and the landing. | `tests/tall-column.mjs`: 267 × 1600 → 178 × 1600, 200 × 1600 → 100 × 1600 | 10/10, 4 red before |
| C10 | `mimeOf` knows AVIF, SVG and BMP and says unknown rather than PNG; one shared `base64Picture` takes URL-safe base64; the byte fetch runs under 30 s; unknown bytes are refused with a sentence on both passes. | `tests/picture-bytes.mjs`; `render-answer.mjs` 13/13, `render-cost.mjs` 11/11, `imaging.mjs` 193/193 hold | 18/18, 7 red before |
| C11 | A narrowed part grows by its narrowing, bounded at 4×; full width is nine tenths. The row's 1439 example was off by one (already full); the check uses 1400. | `tests/phone-heights.mjs`: 1200 × 80 → 366 × 262, content 262 in 262 | 5/5, 2 red before |
| C12 | `splitTurn` is one pure rule using the language's own breaks; `!`, `?`, `。` end a sentence; the subline is every line after the first; `dir="auto"`; the header's links wrap. Left open, named: a comma in a one-line label. | `tests/turn-of-phrase.mjs` | 14/14, 4 red before |
| C14 | One pure plan splits the route's 180 s (20 launch, 106 tour, 54 ffmpeg); the tour stops at its deadline; the response names the width and any cut. | `tests/tour-budget.mjs`; the stall itself is a source read | 12/12, 5 red before |
| C15, C16 | A video the browser cannot play goes in with no preview and a warning; the GIF rate has no floor, so a 5-minute recording keeps 5 minutes at 1.2 fps. | `tests/tweet-intake.mjs` | 12/12, 6 red before |
| C17, C18 | Names decode by the entry's flag (CP437 table); the method is on the entry and an unreadable page is refused; Zip64 is refused by name; an entry inflates no further than it declared. | `tests/zip-honest.mjs`, zips written by hand; `zip-import.mjs` 79/79 holds | 11/11, 7 red before |
| C19 | More served types; a bare name served as what its bytes say; a bad `%` is a miss; only a script that would run counts. | `tests/zip-assets.mjs` | 12/12, 8 red before |
| C26 | The crop picker says a picture that never shows; a tall picture is squashed into twice the width and the squash said. | `tests/crop-picker.mjs`: 167 × 334 where it was 167 × 1670 | 6/6, 2 red before |
| D16, D17, D18, D24, D27 | The cube session's own loose checks now measure what they name (one question about the cube; x, y, w, h held; the token expression itself; done or failed only for the missing key; the publish seam). | `oddness.mjs` 53/53, `cube-part.mjs` 29/29, `cube.mjs` 63/63 | no reds: the code was right, the checks were hollow |

Left where it was, and whose:

- B30 (keys session), D2, D3, D8, D12–D14, D22, D25, D26, D30, D37,
  D39–D42 (flagged by the inventory session to their owners); D10 and
  D36 are the euler session's, whose suites came in with its merge
  (`199d336`), and are now named as such in the table.
- E6 (97 `data-*` attributes queried by nothing): the owner's call which
  are seams for suites still to be written; nothing deleted.
- The narrow-face 11px heading: open, as asked; the font was not shrunk.

Observed, not chased: `tests/shapes.mjs` (the euler session's bench)
reports 11 of 15 drawings coming back with a body on this dev server,
with and without the C4 clamp stashed (so not the clamp's), where the
first pass of this session saw 13/15 under load and 15/15 alone. It is
the one red in the suites run today, and it is not one of this
session's.

Build: `npm run build` passes at `390703e`. Trunk was already merged in;
no import line moved.

## The inventory, third pass: B22 in four pieces, and what was found on the way

B22 was the one L row left that was nobody else's: Build exported each
part's markup and the page's tokens and dropped what Preview adds. Taken
in four pieces, each check written first and red against the export of
the day, each closing with the site it writes run through tsc in a scratch
folder so a built site compiles as A4 promised.

| Piece | What the export now carries | Check | Count |
|---|---|---|---|
| 1 | The eight entrance keyframes and the aura's pulse, the page's drift keyframes, each part's entrance and aura on its wrapper, a link as an anchor round the part (a page's path, `#id`, a URL in a new tab), the wash, the veil, the backdrop | `tests/export-whole.mjs`, which also typechecks the site it wrote | 14/14, 12 red before |
| 2 | Each page's tier-B behaviours, derived by the live page's own call, run by one dependency-free `components/Shell.tsx` against the window: progress bar, back to top, reveal, parallax, smooth, snap, the opening wipe, the cursor, tilt, the burst, the corner note | `tests/export-behaviours.mjs` | 9/9, 8 red before |
| 3 | A solid written as the live part again: the GLB as data in the file, three.js loaded only in the browser and only when installed, the still as the said fallback, the same turning; BUILD.md names `npm install three` | `tests/export-mesh.mjs` | 10/10, 7 red before |
| 4 | The tablet and phone placements the live page computes, every part in a `Place` that reads the device from the `Frame`, which picks the phone's layout on a phone and scales only between the widths | `tests/export-reflow.mjs` | 7/7, 5 red before |

Found on the way, not mine, left with the finding as D43: the live shell's
opening wipe and celebration burst name keyframes (`mo-wipe`, `mo-burst`)
defined nowhere in the repository, so on the live page the intro is a
still plate for 900 ms and the burst is eighteen still squares. The
export's shell defines its own.

Also found by the tsc step, and fixed: a wrapper carrying an aura's CSS
variables failed React's style type; the export casts such a style.

Build: `npm run build` passes. Everything is pushed; trunk was merged in
twice on the way with no import line moved.
