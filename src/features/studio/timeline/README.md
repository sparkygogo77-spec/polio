# studio/timeline

The timeline (Finish), split by topic. `../Timeline.tsx` re-exports what it always exported
(`Timeline`, `isElement`, `headlineOf`, `SHOT_RATIO`, `Drawn`, `Made`), so other files keep importing from `./Timeline`.

| File | Holds |
| --- | --- |
| `layout.tsx` | Card sizes (`BOX`, `PIECE`, `GROW`, `GAP`), `seed`, `useForming`, `paintRim`, `scatter`, `isElement`, `kindOf`, `sizeOf`, `headlineOf` |
| `Timeline.tsx` | `Timeline`: the surface, pan and zoom, drag, the kept view. One component, so it stays in one file |
| `vines.ts` | The strands between boxes: `Vine`, `syncLights`, `ends` |
| `IterationBox.tsx` | One box: `Standing`, `IterationBox`, `ownParts`, `Asked` |
| `pieces.tsx` | `SHOT_RATIO`, `SiteShot`, `Features`, `ElementPiece`, `thin`, `Drawn` |
| `cards.tsx` | The card that opens from a box: `Card`, `Bill`, `WentIn`, `EditHere`, `Made`, `CopyBit`, `VineCut`, `BoxMenu` |
