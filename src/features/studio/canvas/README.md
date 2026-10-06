# studio/canvas

The board, split by topic. `../Canvas.tsx` re-exports what it always exported
(`Canvas`, `isChain`), so other files keep importing from `./Canvas`.

| File | Holds |
| --- | --- |
| `helpers.ts` | What the board reads from states (`steppedOnBoard`, `looksOnBoard`, `liftedOnBoard`, `shownOnBoard`, `placedOnBoard`), grid, gutters, double-press timing, size limits, `Handle`, `Drag`, `Guides` |
| `DesktopCanvas.tsx` | `Canvas` (desktop board or `SmallBoard`) and `DesktopCanvas`: pointer handling, tools, drag, resize, snapping, the board's layers |
| `geometry.ts` | Hit tests and lines: `midOf`, `edgePoint`, `hitNode`, `hitShape`, `hitAlong`, `segsCross`, `penPath` |
| `ShapeView.tsx` | Ink, frames and wires: `Chain`, `isChain`, `ShapeView`, and the resize handle tables |
| `NodeView.tsx` | One part on the board: `FillTab`, `BoardSurface`, `BoardPartCopy`, `useUnshown`, `NodeView`, `DecideBadge` |

`DesktopCanvas` is one component, so it stays in one file: splitting its body
would be a rewrite, not a move.
