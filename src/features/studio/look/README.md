# studio/look

How things look: colour, texture, light and motion maths, the site's own
colours, style kits and carried fonts, copying one part's look to others, and
the Look panel. Third module of the builder audit's split (item 11), after
`states/` and `board/`.

**Doors.** Other files import this module only through its doors; anything
deeper fails `tests/module-doors.mjs`. Files in here import each other freely.

- `index.ts`: the pure looks. No React, no store, every import ends in `.ts`,
  so node tests (and plain `.ts` files like `styleLayer.ts`) load it directly.
- `parts.ts`: part looks that need the store (`lookOf`, `lookPatch`,
  `useMakeAll`, `pasteLook`, `lookOfKit`). Note `index.ts` has its own
  `lookOf` from `styleKits.ts`: the kit look of a captured node.
- `ui.ts`: the screens, the Look panel and picture-to-texture.

All are named re-exports, not `export *`, so a name is still there when an
import cycle loads a door before the file behind it.

| File | Holds |
| --- | --- |
| `lookparts/` | Colour, texture, light and motion maths (see its README) |
| `siteColours.ts` | The site's own colours, tallied from a capture; readable-backdrop fixes |
| `styleKits.ts` | A site's own ways of dressing a button, a card, a field |
| `fonts.ts` | Faces carried with a site, and their licences |
| `partLook.ts`, `partLookApply.ts` | One part's look, copied to others (Make all like) |
| `kitLook.ts` | A style kit as a part look |
| `texture.ts` | Turning a picture into a texture (browser canvas) |
| `LookPanel.tsx` | The Look panel |
