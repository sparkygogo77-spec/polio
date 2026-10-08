# studio/panels

The side panels: the part panel (`Inspector.tsx`, its fields in
`inspector/`), the part tree (`PartTreePanel.tsx`), and the site's format
and motion panels. A module of the builder audit's split (item 11), the last
one. These are screens that read the other modules through their doors.

**Door.** Other files import this module only through `ui.ts`; anything
deeper fails `tests/module-doors.mjs`. It is all screens, so there is no pure
`index.ts`.
