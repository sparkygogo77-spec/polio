/* The look module's pure door: colour, texture, light and motion maths, site colours, style kits and carried fonts. No React, no store, every import ends in .ts, so node tests load it.
 * Part looks that need the store are behind ./parts.ts, the Look panel and picture-to-texture hooks behind ./ui.ts. Named re-exports (not export *) so an import cycle still sees every name. See README.md. */
export { HARMONIES, ROLES, ROLE_LABEL, contrast, css, fromHex, harmonise, oklchToRgb, paletteFromHue, parseColor, rgbToOklch, toHex } from "./lookparts/colour.ts";
export type { Harmony, Oklch, Palette, RoleId } from "./lookparts/colour.ts";
export { reach, rollTheme } from "./lookparts/themeDice.ts";
export type { DiceSwatch, ThemeRoll } from "./lookparts/themeDice.ts";
export { DRIFT_CYCLE, GRAINY, TEXTURE_KINDS, TEXTURE_TARGETS, channels, lands, newLayer, spotsOfTarget, targetOfSpots, reiterate, rollPatch, shiftHue, svgUrl } from "./lookparts/texture.ts";
export type { BlendMode, Crop, TextureKind, TextureLayer, TextureSpot, TextureTarget } from "./lookparts/texture.ts";
export { driftKeyframes, layerCss, textureCss, withAlpha } from "./lookparts/textureCss.ts";
export { castFrom, defaultLight, defaultRoll, emptyLook, liftCss, washCss } from "./lookparts/light.ts";
export type { Light, Look, SavedPalette, ThemeRollSettings } from "./lookparts/light.ts";
export { ANIM_DELAY, ANIM_EASE, ANIM_SPEED, AURA_STYLES, AURA_WORD, DELAY_MS, ENTRANCE_MS, SPEED_K, auraColour, auraFilter, auraShadow, auraStyle, complementOf, delayMs, describeLight, describeLook, entranceCss, markColour, sliderFromSpeed, speedFromSlider, speedK, speedWord } from "./lookparts/motion.ts";
export type { AnimDelay, AnimEase, AnimSpeed, AuraStyle } from "./lookparts/motion.ts";
export { CLOSE_SHADES, COLOUR_USES, SAME_TO_THE_EYE, distinctShades, PAGE_ID, SITE_TYPE, USE_LABEL, chromatic, closeShades, colourKey, coloursIn, faceOf, firstSays, fontsInPageOrder, movedColours, movedFont, oklabDistance, roleFollowers, spotsOf, swapColour, swapFont, tallyColours, tallyFonts, whoWears } from "./siteColours.ts";
export type { ColourSpot, ColourUse, FaceTo, FontFirst, ShadeGroup, SiteColour, SiteFont, Worn } from "./siteColours.ts";
export { KITS_PER_ROLE, KIT_ROLES, PLAIN_BAR, colourWord, contrastOf, kitsFromDoc, lookOf, luminanceOf, mix, motionWord, motionsFromDoc, parseGradient, parseRgba, parseShadows, parseTransform, rgbCss, rgbaCss, roleOf, siteBar, siteShortName, splitTop } from "./styleKits.ts";
export type { BoardMotion, KitBand, KitDoc, KitFill, KitNode, KitRole, KitShadow, KitState, KitText, ParsedShadow, Rgba, StyleKit } from "./styleKits.ts";
export { FONT_FILE_MAX, FONT_RULES_MAX, FONT_TOTAL_MAX, GENERIC_FACES, carryFaces, coversLetters, facesSays, fontFaceCss, fontId, fontLinks, forbids, formatOf, genericSays, genericsOf, isLatin, licenceOf } from "./fonts.ts";
export type { CarriedFont, FaceRead, FacesCarried, FacesRead, FetchBytes, FontSource } from "./fonts.ts";
