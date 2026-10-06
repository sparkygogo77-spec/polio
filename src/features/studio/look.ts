// Split by topic into ./lookparts/ (see its README). Re-exports keep every import working.
export { oklchToRgb, rgbToOklch, toHex, fromHex, css, parseColor, contrast, ROLES, ROLE_LABEL, paletteFromHue, HARMONIES, harmonise } from "./lookparts/colour.ts";
export type { Oklch, RoleId, Palette, Harmony } from "./lookparts/colour.ts";
export { TEXTURE_KINDS, DRIFT_CYCLE, rollPatch, reiterate, TEXTURE_TARGETS, lands, shiftHue, newLayer } from "./lookparts/texture.ts";
export type { TextureKind, BlendMode, Crop, TextureLayer, TextureTarget } from "./lookparts/texture.ts";
export { layerCss, textureCss, driftKeyframes, withAlpha } from "./lookparts/textureCss.ts";
export { defaultLight, washCss, defaultRoll, emptyLook, castFrom, liftCss } from "./lookparts/light.ts";
export type { Light, Look, ThemeRollSettings } from "./lookparts/light.ts";
export { ANIM_SPEED, ANIM_DELAY, ANIM_EASE, ENTRANCE_MS, SPEED_K, DELAY_MS, speedK, delayMs, speedWord, speedFromSlider, sliderFromSpeed, entranceCss, AURA_STYLES, AURA_WORD, auraColour, complementOf, markColour, auraShadow, auraStyle, auraFilter, describeLight, describeLook } from "./lookparts/motion.ts";
export type { AnimSpeed, AnimDelay, AnimEase, AuraStyle } from "./lookparts/motion.ts";
