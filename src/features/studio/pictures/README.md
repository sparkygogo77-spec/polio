# studio/pictures

Pictures and drawing: which model makes a picture (`imageRoute.ts`), the
picture store (`pictures.ts`), remaking a part's picture (`remake.ts`),
sketches (`sketch.ts`), drawing a sketch into parts (`drawRun.ts`), the
drawing board and the Pictures panel. A module of the builder audit's split
(item 11).

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure pictures. No React, no store, every import ends in
  `.ts`, so node tests load it.
- `run.ts`: drawing a sketch into parts, which needs the bundler's imports.
- `ui.ts`: the Pictures panel and the drawing board.
