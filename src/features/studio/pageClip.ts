/**
 * WHAT IS OFF THE PAGE IS NOT THE PAGE.
 *
 * A part standing past the page's top, left or right edge is drawn cut at
 * it on the board, as the site and the export cut it (trumpmorty.fun's
 * planet at -355,-441, its hero layers and ribbons past both sides). The page
 * grows downward to hold what is below it, so the foot is never cut. Only the
 * part's drawing is: its box, selection and handles, and the ink round the
 * page, are not (`tests/board-clips.mjs`, `tests/board-edges.mjs`).
 */
export function pageClip(n: { x: number; y: number; w: number }, pageW: number): string | undefined {
  const top = Math.max(0, -n.y), left = Math.max(0, -n.x), right = Math.max(0, n.x + n.w - pageW);
  if (!top && !left && !right) return undefined;
  return `inset(${top}px ${right}px 0px ${left}px)`;
}
