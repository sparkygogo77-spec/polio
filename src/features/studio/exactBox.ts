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
 *
 * SO IS A CAPTURED BOX THE PAGE CUTS ITS CONTENTS TO. gotchi.gg's activity
 * card is a 440px window over a list of rows that scrolls inside it
 * (`overflow: hidden` or `auto`, recorded as `art.overflow`). Drawn as a
 * floor, the window grew to every row it held, 440 → 582, and the three
 * sections under it moved down 88 to 142px on the first settle: a board that
 * no longer stood where the page did, with nobody asking it to. The page's
 * window is a window: its height is a height, and what it holds is cut, as
 * the page cuts it. Only a box: a words part keeps its floor, so words are
 * never cut off. `tests/clipped-box-keeps-height.mjs`.
 */
export const exactBox = (n: { featureId: string; from?: { selector?: string | null } | null; art?: { overflow?: string | null } | null }): boolean =>
  n.featureId === "picture" || (n.featureId === "box" && !!n.from?.selector && /hidden|clip|auto|scroll/.test(n.art?.overflow ?? ""));
