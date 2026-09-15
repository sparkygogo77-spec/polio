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
   Replicate token is present (browser vault or server, a yes-or-no only)
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
- `tests/box-to-cube.mjs` 74/74, new.
- `tests/shapes.mjs` 21/21 alone against the build (15 of 15 traced); it
  read 13 of 15 under the dev server while the walk ran beside it, which
  was load, not the change.

## Left open

- The panel's "Where it goes / Model" cards (another session's) still
  describe a cube as "a mark or small icon" routed to GPT Image 2, because
  they read the part's words, and a cube has none. They are not wrong
  about the words; they are wrong about the part. Not touched here.
- The still a solid falls back to is the front face drawn flat, which is
  blank when the front face is blank.
