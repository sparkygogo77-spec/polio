# studio/palette

The shelf under the board, split by topic. `../Palette.tsx` re-exports what it always exported, so imports from `./Palette` keep working.

| File | Holds |
| --- | --- |
| `shelf.tsx` | Where a dropped part lands (`dropPoint`, `visibleMiddle`, `addFeatureToCanvas`), `RemovedCard`, shelf sizes, open/folded/tall state and their hooks |
| `Palette.tsx` | `Palette`, `ShelfStrip`, `OpenShelf`: the shelf itself. `OpenShelf` is one component |
| `cards.tsx` | `CategorySection`, `EntryCard`, `Band` |
| `onPage.tsx` | `ShelfGrip`, `onThisPage`, `goToPart`, `OnThisPage` |
| `yours.tsx` | `YoursPlanet`, `FromYourSites`: the "From your sites" shelf of panels kept from imports and components saved by hand (`../library/fromSites.ts`) |
