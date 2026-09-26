/**
 * The site's own picture, for the mark beside its name in the bar.
 *
 * THE RULE. Of the pictures on the board, the one on the most pages; of
 * those, the one drawn largest. A logo is the picture a site repeats, so
 * repetition leads, and among what repeats the biggest is the mark rather
 * than an icon beside it. Measured on sink's nine pages:
 *
 *   pic_cc8659c3  SolWorks logo   112x112  on 8 pages   ← this one
 *   pic_ebf39fa1  Solana mark      48x24   on 8 pages   (ties on pages, smaller)
 *   pic_95e3b0fe  question mark   128x128  on 4 pages   (bigger, but only the empty states)
 *
 * Derived when drawn, from the parts, rather than stored: nothing to keep in
 * step when a picture is swapped or a page deleted. No pictures means null,
 * and the caller keeps the letter.
 */
import type { Picture } from "./pictures";

export function siteLogo(nodes: readonly { pageId: string; w: number; h: number; picture?: Picture | null }[]): Picture | null {
  const by = new Map<string, { pic: Picture; pages: Set<string>; area: number }>();
  for (const n of nodes) {
    if (!n.picture) continue;
    const c = by.get(n.picture.id) ?? { pic: n.picture, pages: new Set<string>(), area: 0 };
    c.pages.add(n.pageId);
    c.area = Math.max(c.area, n.w * n.h);
    by.set(n.picture.id, c);
  }
  let best: { pic: Picture; pages: Set<string>; area: number } | null = null;
  for (const c of by.values()) {
    if (!best || c.pages.size > best.pages.size || (c.pages.size === best.pages.size && c.area > best.area)) best = c;
  }
  return best?.pic ?? null;
}
