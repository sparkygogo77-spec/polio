/**
 * THE PAGE'S OWN GROUND. A browser paints a page's body colour to the window's edges. The
 * look carries one site's ground (PST's Play: cream with dots), and every page wore it:
 * PST's Leaderboard, Profile and Match pages are white on the site and came in white only
 * under their parts, cream round them, on the board, in the Preview and published. A page
 * whose body part was read with a colour of its own (not the look's) is that colour, edge
 * to edge. `tests/page-ground.mjs`.
 */
import type { StudioNode } from "./board/store";

const LITERAL = /^(#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()/i;

/** The colour the page's body was read with, when it is its own and not the look's ground; else null. */
export function pageGround(pageNodes: readonly StudioNode[], lookBg: string | undefined): string | null {
  const body = pageNodes.find((n) => n.from?.selector === "body" && !n.state);
  const bg = body?.colour?.bg;
  if (!bg || !LITERAL.test(bg.trim())) return null;
  return bg.replace(/\s+/g, "") === (lookBg ?? "").replace(/\s+/g, "") ? null : bg;
}
