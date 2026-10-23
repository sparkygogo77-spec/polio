/**
 * A PART THAT IS EXACTLY ITS BOX.
 *
 * Every part stands in a box whose height is a floor (`min-height`), so a
 * part's words are never cut off when they need more room than was measured.
 * A picture has no words to keep, and its picture fills the part with
 * `height: 100%`: a share of a box with no height of its own, which the
 * browser reads as the picture's own height. So a square picture the page
 * showed cut to a 870×495 box (thesolface.site's gallery slide) stood 870
 * tall on the board and on the published page, over the card under it.
 * A picture's part is its box: its height is a height, on the board and on
 * the published page at the width it was measured. At the small widths the
 * page's own rules size it again (`smallCss.ts`, `height: auto !important`).
 * `tests/published-picture-box.mjs`.
 */
export const exactBox = (n: { featureId: string }): boolean => n.featureId === "picture";
