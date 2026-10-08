# studio/board

The board: its store, the canvas that draws pages, parts and shapes, and the
press rules that decide what a press on the board starts. Second module of the
builder audit's split (item 11); `states/` set the pattern.

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure press rules. No React, no store, every import ends in
  `.ts`, so node tests load it directly.
- `store.ts`: the studio store (`useStudio` and friends) and its types. Split by
  topic under `store/` (see `store/README.md`).
- `ui.ts`: the screens, `Canvas` and `isChain` (`../Canvas.tsx` re-exports them).
- `reads.ts`: what the board reads off a page's states, for `states/`.

All are named re-exports, not `export *`, so a name is still there when an
import cycle loads a door before the file behind it.

| File | Holds |
| --- | --- |
| `press.ts` | `PRESS_RULES`: what is under the hand leads to which drag, as an ordered table |
| `pressRead.ts` | Reads the press facts off the DOM and store; builds group, resize and move drags |
| `helpers.ts` | What the board reads from states (`steppedOnBoard`, `looksOnBoard`, `liftedOnBoard`, `shownOnBoard`, `placedOnBoard`), grid, gutters, double-press timing, size limits, `Handle`, `Drag`, `Guides` |
| `DesktopCanvas.tsx` | `Canvas` (desktop board or `SmallBoard`) and `DesktopCanvas`: pointer handling, tools, drag, resize, snapping, the board's layers |
| `geometry.ts` | Hit tests and lines: `midOf`, `edgePoint`, `hitNode`, `hitShape`, `hitAlong`, `segsCross`, `penPath` |
| `ShapeView.tsx` | Ink, frames and wires: `Chain`, `isChain`, `ShapeView`, and the resize handle tables |
| `NodeView.tsx` | One part on the board: `FillTab`, `BoardSurface`, `BoardPartCopy`, `useUnshown`, `NodeView`, `DecideBadge` |

`DesktopCanvas` is one component, so it stays in one file: splitting its body
would be a rewrite, not a move.
