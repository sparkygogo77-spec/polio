# studio/states

Everything about a page's states: the screens a site declares, the panels and
their states, what the board shows for each, per-state edits, the Show switch,
the Structure view and its regions. First module of the builder audit's split
(item 4); the others follow the same pattern.

**Doors.** Other files import this module only through its two doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure rules. No React, no store, every import ends in `.ts`,
  so node tests (and plain `.ts` files like `styleLayer.ts`) load it directly.
- `ui.ts`: the screens, and the helpers that need the board store or React.

Both are named re-exports, not `export *`, so a name is still there when an
import cycle loads a door before the file behind it.

| File | Holds |
| --- | --- |
| `boardStates.ts` | Screens read from a site, where each draws its parts (`screenPlaces`), part steps |
| `stateFrames.ts` | A box's faces and the frame they share: `stateFrames`, `clampMove`, `liftToFrame`, `seatStates` |
| `stateRules.ts` | The declared rules: `data-panel`/`data-states`/`data-show`, scenes.json, samples.json, `foldScenes` |
| `stateEdits.ts` | Per-state edits (`byState`), checked out and back in; what the board wears now, read checked in by the history, the save and Publish |
| `scenes.ts` | A page's scenes |
| `panels.ts`, `panelsOf.ts` | Panels and their states, and which belong to a page |
| `panelSpotlight.ts` | Drawing one panel in place on its ancestors |
| `show.ts` | The Show switch's previews by moment and on-top overlays |
| `structure.ts` | The Structure view's outline, regions and layout tokens per hook |
| `sceneStep.ts` | Stepping the board through scenes (store) |
| `decideShown.ts` | Which parts wear the orange "!" (store, React) |
| `StatesTimeline.tsx`, `PanelsPage.tsx`, `PanelsMore.tsx`, `ShowSwitch.tsx`, `StructureView.tsx`, `PartFocus.tsx` | The screens |
