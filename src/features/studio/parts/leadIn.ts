/**
 * WHAT STANDS BEFORE THE WORDS IN A ROW PUSHES THEM ALONG.
 *
 * trumpmorty.fun's badge is `<div class="onair"><i></i> LIVE FROM THE
 * YELLOW DIMENSION</div>`: a flex row, gap 10, whose first child is a 12px
 * red dot. On the page the words start after the dot and the gap (x 136).
 * A capture keeps the div's words as the div's own content and the dot as a
 * part of its own at the dot's place, so the board drew the words from the
 * div's padding (x 115) and the dot sat on the "L".
 *
 * Everything needed is in the document: the row (`layout`), its gap, its
 * padding, and a part whose selector is a direct child of the row's, in the
 * flow (no `position`), standing at the start of the row. The words are
 * inset past the furthest such part and the gap, as the row itself would.
 * Nothing is written to the document: the parts stay where the capture put
 * them and the inset is worked out wherever they are drawn (the board, the
 * preview, the export), so moving the dot moves the words with it.
 *
 * Pure. `tests/lead-in.mjs`.
 */

export interface LeadNode {
  id: string;
  pageId?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  content?: unknown;
  from?: { selector?: string; position?: string } | null;
  layout?: { display?: string; direction?: string; justify?: string; gap?: number } | null;
  pad?: { top?: number; right?: number; bottom?: number; left?: number } | null;
}

const hasWords = (c: unknown) => (typeof c === "string" ? c.trim().length > 0 : Array.isArray(c) && c.length > 0);
/** How far off a row's start a first child may stand (a turned badge moves its children a pixel or two). */
const SLACK = 4;

/** The left padding each row needs so its words start after what stands before them, by part id. */
export function leadInsets(nodes: readonly LeadNode[]): Map<string, number> {
  const out = new Map<string, number>();
  const rows = nodes.filter((n) => {
    const l = n.layout;
    return !!l && /flex/.test(l.display ?? "") && (!l.direction || l.direction === "row")
      && (!l.justify || /^(normal|start|flex-start|left)$/.test(l.justify)) && hasWords(n.content) && !!n.from?.selector;
  });
  if (!rows.length) return out;
  for (const row of rows) {
    const sel = `${row.from!.selector!} > `;
    const padL = row.pad?.left ?? 0;
    const start = row.x + padL;
    let reach = -Infinity;
    for (const c of nodes) {
      const cs = c.from?.selector;
      if (c === row || !cs || !cs.startsWith(sel) || cs.slice(sel.length).includes(" > ")) continue;
      if (c.from?.position || (c.pageId && row.pageId && c.pageId !== row.pageId)) continue;
      if (hasWords(c.content)) continue;
      if (Math.abs(c.x - start) > SLACK) continue;
      if (c.y + c.h < row.y || c.y > row.y + row.h) continue;
      reach = Math.max(reach, c.x + c.w);
    }
    if (reach === -Infinity) continue;
    const gap = typeof row.layout?.gap === "number" && Number.isFinite(row.layout.gap) ? Math.max(0, row.layout.gap) : 0;
    const left = Math.round((reach - row.x + gap) * 100) / 100;
    if (left > padL) out.set(row.id, left);
  }
  return out;
}

/** The node as drawn: its left padding past what stands before its words, or the node itself when nothing does. */
export function withLead<N extends LeadNode>(n: N, leads: ReadonlyMap<string, number>): N {
  const left = leads.get(n.id);
  if (left === undefined) return n;
  return { ...n, pad: { top: 0, right: 0, bottom: 0, ...(n.pad ?? {}), left } };
}

const cache = new WeakMap<readonly LeadNode[], Map<string, number>>();
/** `leadInsets`, once per list of parts. */
export function leadsOf(nodes: readonly LeadNode[]): Map<string, number> {
  let m = cache.get(nodes);
  if (!m) { m = leadInsets(nodes); cache.set(nodes, m); }
  return m;
}
