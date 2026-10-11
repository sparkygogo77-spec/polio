/**
 * ONE PART, ON EVERY PAGE.
 *
 * A brought-in site draws its rail, header and footer again on each page, and
 * the board keeps one copy per page. Counted as parts, PonsStars' Departments
 * rail and its buttons were "Panels: Pending review, 20" in Colours when they
 * are one rail (J, 2026-10-11: "mainly the same item across different pages
 * instead of being considered one thing").
 *
 * So a part that repeats across pages is one thing: the same `data-hook`
 * (its code finds it by that name on every page), or, with no hook, the same
 * kind of part in the same place with the same words and paint. Copies are
 * paired by their order on each page, so a list whose rows share one hook
 * keeps every row on the page with the most of them.
 *
 * Pure: `tests/repeats.mjs`.
 */

interface Rep {
  id: string;
  pageId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  featureId?: string;
  content?: unknown;
  colour?: Partial<Record<string, string>> | null;
  art?: { background?: string } | null;
  hooks?: Record<string, string> | null;
}

const words = (c: unknown): string =>
  (typeof c === "string" ? c : Array.isArray(c) ? c.map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : "")).join("") : "").replace(/\s+/g, " ").trim();

/** What makes two copies on two pages the same part. */
function sameKey(n: Rep): string {
  const hook = n.hooks?.["data-hook"];
  if (hook) return `hook|${hook}`;
  const r = (v: number | undefined) => Math.round((v ?? 0) / 4);
  return ["box", n.featureId ?? "", r(n.x), r(n.y), r(n.w), r(n.h), words(n.content), JSON.stringify(n.colour ?? null), n.art?.background ?? ""].join("|");
}

/**
 * For each part, the id of the copy it repeats (the first one met, pages in
 * the order given); a part that repeats nothing maps to itself.
 */
export function repeatsAcrossPages(nodes: readonly Rep[]): Map<string, string> {
  /* Reading order on each page, so the nth copy on one page meets the nth on another. */
  const order = [...nodes].sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
  const nth = new Map<string, number>();
  const first = new Map<string, string>();
  const out = new Map<string, string>();
  for (const n of order) {
    const key = sameKey(n);
    const at = `${n.pageId ?? ""}\u0000${key}`;
    const i = nth.get(at) ?? 0;
    nth.set(at, i + 1);
    const k = `${key}\u0000${i}`;
    const was = first.get(k);
    if (!was) first.set(k, n.id);
    out.set(n.id, was ?? n.id);
  }
  return out;
}

/** How many things these parts are, a part repeated across pages counted once. */
export const thingsIn = (ids: Iterable<string>, once: ReadonlyMap<string, string>): number =>
  new Set([...ids].map((id) => once.get(id) ?? id)).size;
