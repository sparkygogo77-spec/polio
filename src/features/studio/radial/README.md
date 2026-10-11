# studio/radial

The part menu (the wheel), split by topic. `../RadialMenu.tsx` re-exports what it always exported,
so other files keep importing from `./RadialMenu`.

| File | Holds |
| --- | --- |
| `open.ts` | Which wheel is open and where: `openRadial`, `openBoard`, `drawOnPart`, `writeOnPart`, `closeRadial`, `moveRadial`, `radialAt`, `pageSpot`, `useRadial` |
| `choices.ts` | The slots and what each offers: `SLOTS`, `SLOTS_BG`, `choicesFor`, `bgChoicesFor`, pull distances, `TRAY_DROP`, hues, `useRadialOpen` |
| `RadialMenu.tsx` | `RadialMenu`: the wheel itself. One component, so it stays in one file |
| `ring.tsx` | Drawing the ring and its editors: `PullLine`, `PullEnds`, `Ring`, inks, swatches, `Editor` |
| `selectionEdit.ts` | An edit on the wheel is an edit to the selection: `applyToSelection`, `spreadEdit`, `selectionFor`. Looks and options merge key by key; an option reaches only parts that have it |
