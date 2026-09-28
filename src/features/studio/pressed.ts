/**
 * Pure: no React, no store, no DOM, so `tests/pressed-follow.mjs` holds it
 * without a browser. `textFit.ts` applies it wherever the healing writes.
 */
export interface Fitted {
  id: string;
  h: number;
  y: number;
}

/**
 * A PART A PRESS SHOWS MOVES WITH THE PAGE (`StudioNode.state`, sink
 * `behaviours.states`). The healing reads the page as it opens, where such a
 * part is not drawn, so it moved the page's parts and left these behind:
 * gotchi.gg's starter row went down 9px, and pup's chosen card, shown on a
 * press, stood 9px above kit's. Each follows the move of the part it stands
 * in for — read from the same element, else from its nearest holder — and
 * keeps its own height. `tests/pressed-follow.mjs`.
 */
export function withPressed(fitted: readonly Fitted[], nodes: readonly { id: string; pageId?: string; y: number; from?: { selector?: string | null } | null; state?: unknown }[]): Fitted[] {
  const moved = new Map(fitted.map((f) => [f.id, f]));
  const base = nodes.filter((n) => !n.state && n.from?.selector && moved.has(n.id));
  if (!base.length) return [...fitted];
  const out = [...fitted];
  for (const s of nodes) {
    const sel = s.state ? s.from?.selector?.trim() : null;
    if (!sel) continue;
    let best: (typeof base)[number] | null = null;
    for (const b of base) {
      if (b.pageId !== s.pageId) continue;
      const bs = b.from!.selector!.trim();
      if (bs !== sel && !sel.startsWith(`${bs} > `)) continue;
      if (!best || bs.length > best.from!.selector!.trim().length) best = b;
    }
    if (!best) continue;
    const dy = moved.get(best.id)!.y - best.y;
    if (dy) out.push({ id: s.id, y: s.y + dy, h: (s as { h?: number }).h ?? 0 });
  }
  return out;
}

