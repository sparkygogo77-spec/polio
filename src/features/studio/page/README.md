# studio/page

The Builder page, split by topic. `../StudioPage.tsx` re-exports what it always exported, so other files keep importing from `./StudioPage`.

| File | Holds |
| --- | --- |
| `sizes.ts` | Band, shelf and work heights, `TOOLS`, `NARROW`, `FOLDING`, `useMedia`, `useNarrow`, `useViewportDevice` |
| `head.tsx` | The top: `SiteHead`, `PageChips`, `StatesChip` |
| `toolbar.tsx` | `Toolbar`, `MoreTools`, `DecideCount`, `ToolPicker`, `DeviceSwitch`, `SearchTools`, `UpdatesToggle`, `PreviewToggle` |
| `side.tsx` | The side panel: `SIDE_TABS`, widths (`SIDE_MIN`, `SIDE_DEFAULT`), `useSideWidth`, `SideEdge`, `SheetHandle` |
| `StudioPage.tsx` | `StudioPage`: lays the page out. One component |
