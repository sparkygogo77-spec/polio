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
