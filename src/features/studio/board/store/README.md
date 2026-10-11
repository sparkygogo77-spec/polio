# studio/board/store

The studio store, split by topic. `../store.ts` (the board module's store door) re-exports everything it always
exported; other files import it as `./board/store` (or `@/features/studio/board/store`).

| File | Holds |
| --- | --- |
| `model.ts` | Document types: `StudioNode`, `StudioPage`, groups, shapes, brief, trail, zoom limits, `BACKGROUND_ID`, `Doc` |
| `frame.ts` | Page frame sizing: `frameHeight`, `frameTopReach`, `FRAME_WIDTHS`, `placeInFrame` |
| `state.ts` | `StudioState`: every field and action the store has |
| `history.ts` | Undo helpers and limits, `snapshot`, thread/trail helpers, the sweep's `with*` passes, starter doc, `shelve`, `onBoardEdit`, `pen` (read/swap guards), `pickedStates` |
| `create.ts` | `useStudio` itself: undo checkpoints (`push`, `pushEdit`), initial state, history actions (undo, redo, travel, commit), the persist config, `PRISTINE` |
| `nodes.ts` | Part actions: add, update, fit, sweep, raise/lower, remove, duplicate, cube faces, drawn kinds |
| `board.ts` | Groups, shapes, ink, spaces, pages, selection, cut/copy/paste (and what is held) |
| `view.ts` | Tool, ink, zoom, pan, format, motion, look, textures, menu, features, bring in/send back |
| `threads.ts` | Brief, asks, spend, threads, draft queue, revisions, clear/reset, theme, `loadDoc` |
| `persist.ts` | `docOnly` (what is saved), `mergeDoc` (loading a saved doc), `takeCarriedRepo` |
| `load.ts` | Site swap (`swapDoc`), import mark, page selectors, bounds, `useStudioHydration`, `livePath`, another tab saving the same key (`watchOtherTabs`, `otherTab`, `loadNewer`, `keepThisTab`, `takeOpenSite`) |
