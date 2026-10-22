/**
 * A PART PAINTS BENEATH WHAT IT HOLDS.
 *
 * The board and the published page paint parts in the document's order. A
 * capture can list a box after the parts in it: thesolface.site's hero comes
 * after its own background pictures, ::after and glows, and its opaque fill
 * was painted over them, the hero's splash plain dark (J, 2026-10-21). On the
 * page a box's background is always beneath what is in it.
 *
 * `holdersFirst` keeps the order but moves each part's holder (by the page
 * path the capture recorded, on the same page; a press-shown copy is never a
 * holder) to just before the first part it holds. Plain, so Node checks it:
 * `tests/holders-first.mjs`.
 */
interface Pathed { id: string; pageId?: string; from?: { selector?: string } | null; state?: unknown }

const pathOf = (n: Pathed) => (n.from?.selector ?? "").trim();
/** One step up a path: a pseudo-element or a line is its element's; else the last " > " step goes. */
function up(path: string): string | null {
  const pseudo = /(::?(?:before|after|frames)| ::line\(\d+\))$/.exec(path);
  if (pseudo) return path.slice(0, pseudo.index);
  const i = path.lastIndexOf(" > ");
  return i < 0 ? null : path.slice(0, i);
}

export function holdersFirst<T extends Pathed>(nodes: readonly T[]): readonly T[] {
  const at = new Map<string, T>();
  for (const n of nodes) { const p = pathOf(n); if (p && !n.state && !at.has(`${n.pageId ?? ""}|${p}`)) at.set(`${n.pageId ?? ""}|${p}`, n); }
  const placed = new Set<T>();
  const out: T[] = [];
  let moved = false;
  const place = (n: T) => {
    if (placed.has(n)) return;
    placed.add(n);
    /* Its holders first, outermost first, where the document lists them later. */
    const p = pathOf(n);
    const holders: T[] = [];
    for (let q = p ? up(p) : null; q; q = up(q)) { const h = at.get(`${n.pageId ?? ""}|${q}`); if (h && h !== n && !placed.has(h)) holders.unshift(h); }
    for (const h of holders) { moved = true; place(h); }
    out.push(n);
  };
  for (const n of nodes) place(n);
  return moved ? out : nodes;
}
