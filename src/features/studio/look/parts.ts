/* The look module's part-look door: one part's look and a style kit as a part look. No screens and no store hooks, so jiti tests can load it (pasting and Make all like are behind ./ui.ts). See README.md. */
export { FACETS, FACET_WORDS, lookDiffers, lookHas, lookOf, lookPatch } from "./partLook";
export type { Facet, PartLook, PasteOpts } from "./partLook";
export { lookOfKit } from "./kitLook";
