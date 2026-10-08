/* The look module's part-look door: copying one part's look to others and style kits applied to parts (store-bound, no screens). See README.md. */
export { FACETS, FACET_WORDS, lookDiffers, lookHas, lookOf, lookPatch } from "./partLook";
export type { Facet, PartLook, PasteOpts } from "./partLook";
export { makeAllLike, makeAllReach, pasteLook, pasteTargets, useLookClip, useMakeAll } from "./partLookApply";
export { lookOfKit } from "./kitLook";
