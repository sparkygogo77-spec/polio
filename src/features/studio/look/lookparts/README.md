# studio/look/lookparts

The look maths, split by topic. `../index.ts` (the look module's door) re-exports everything. Imports keep their `.ts` extension so tests can load these in Node.

| File | Holds |
| --- | --- |
| `colour.ts` | Oklch maths (`oklchToRgb`, `rgbToOklch`, `toHex`, `fromHex`, `parseColor`, `contrast`), roles and `Palette`, `paletteFromHue`, `harmonise` |
| `texture.ts` | Texture kinds and layers: `TextureLayer`, `rollPatch`, `reiterate`, `lands`, `shiftHue`, `newLayer` |
| `textureCss.ts` | Layers to CSS: `layerCss`, `textureCss`, `driftKeyframes`, `withAlpha` |
| `light.ts` | `Light`, `Look`, `washCss`, `castFrom`, `liftCss`, defaults |
| `motion.ts` | Animation speed, delay, ease, entrances, aura colours and styles, `describeLight`, `describeLook` |
