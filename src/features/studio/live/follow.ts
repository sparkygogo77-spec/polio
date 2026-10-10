/**
 * A PART THAT FOLLOWS A LINE'S WORDS IS PLACED AFTER THEM.
 *
 * PST's Balance note wraps, and its "?" sits right after "matches.", in the
 * same line. The board places parts where the page measured them, so set in
 * another machine's font the words wrapped elsewhere and the "?" stayed
 * behind: above the words, or over them (J, 2026-10-09). The import reads
 * such a part as following the line (`siteread/parts.ts#tieAfter`, stored as
 * `node.follows`); here, once the page is drawn, it is moved to where the
 * words end now: the same room after the last word, its middle where it was
 * against that row. Only a nudge (`translate`): its stored place, size and
 * everything else about it are untouched, and where the words end where
 * they did, it does not move at all.
 *
 * AND WHERE THE PAGE SET IT ON A ROW OF ITS OWN, IT STAYS THERE: on a phone
 * the note is one row as wide as its box and the page puts its "?" under it,
 * where the part already is.
 */
export interface Follows { id: string; gap: number; dy: number }

export function followsOf(n: unknown): Follows | null {
  const f = (n as { follows?: Follows | null }).follows;
  return f && typeof f.id === "string" && Number.isFinite(f.gap) && Number.isFinite(f.dy) ? f : null;
}

/** The last row of words drawn inside an element: its right edge and its middle, on screen. */
function wordsEnd(el: Element): { right: number; mid: number } | null {
  const walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  for (let t = walk.nextNode(); t; t = walk.nextNode()) if ((t.textContent ?? "").replace(/\u200b/g, "").trim()) last = t as Text;
  if (!last) return null;
  const range = document.createRange();
  range.selectNodeContents(last);
  const rects = Array.from(range.getClientRects()).filter((q) => q.width > 0 && q.height > 0);
  const q = rects[rects.length - 1];
  return q ? { right: q.right, mid: (q.top + q.bottom) / 2 } : null;
}

/**
 * Place every follower on the page drawn under `root`. `find` names a part's element by its id;
 * `words` the element holding its words, when that is not the part's own (the board's part
 * carries chips with words of their own). `scale` is the page's zoom, when it is not a transform on `root`.
 */
export function placeFollowers(root: HTMLElement, followers: { id: string; follows: Follows }[], find: (id: string) => string, opts: { words?: (id: string) => string; scale?: number } = {}): void {
  /* The page may be drawn scaled (the Preview fits a wide page in its window): screen pixels over the page's own. */
  const scale = opts.scale ?? (root.offsetWidth > 0 ? root.getBoundingClientRect().width / root.offsetWidth : 1);
  if (!(scale > 0)) return;
  for (const f of followers) {
    const el = root.querySelector<HTMLElement>(find(f.id));
    const to = root.querySelector((opts.words ?? find)(f.follows.id));
    if (!el || !to) continue;
    el.style.translate = "";
    const end = wordsEnd(to);
    const box = el.getBoundingClientRect();
    if (!end || box.width === 0 || box.height === 0) continue;
    const holds = to.getBoundingClientRect();
    /* Where the page set it at this width: in the words' rows (after them), or on a row of its own under them (left as it is). */
    const mid0 = box.top + box.height / 2;
    if (mid0 > holds.bottom + 2 * scale || mid0 < holds.top - 2 * scale) continue;
    const x = end.right + f.follows.gap * scale;
    const mid = end.mid + f.follows.dy * scale;
    const dx = (x - box.left) / scale;
    const dy = (mid - (box.top + box.height / 2)) / scale;
    if (Math.abs(dx) > 0.5 || Math.abs(dy) > 0.5) el.style.translate = `${Math.round(dx * 10) / 10}px ${Math.round(dy * 10) / 10}px`;
  }
}
