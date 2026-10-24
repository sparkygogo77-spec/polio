/**
 * COMPARE, WITHOUT THE SCREEN: which two sites, which way, and the little sums.
 *
 * `/builder/compare?a=<site>&b=<site>&mode=side|slider` is the whole state of
 * the view that can be shared in a link; the rest (the wipe, the page) is
 * kept in the page. Nothing here reads storage or the DOM, so the tests can
 * hold each sum on its own.
 */
import type { PreviewDoc } from "../SitePreview";

export type CompareMode = "side" | "slider";

export interface Sides { a: string | null; b: string | null; mode: CompareMode }

/** The two sites and the mode out of a query string. Anything else falls back to side by side. */
export function readSides(search: string): Sides {
  const q = new URLSearchParams(search);
  return { a: q.get("a") || null, b: q.get("b") || null, mode: q.get("mode") === "slider" ? "slider" : "side" };
}

/** The query string for these sides, the other way. Side by side is the default, so it is not written. */
export function writeSides(s: Sides): string {
  const q = new URLSearchParams();
  if (s.a) q.set("a", s.a);
  if (s.b) q.set("b", s.b);
  if (s.mode === "slider") q.set("mode", "slider");
  const out = q.toString();
  return out ? `?${out}` : "";
}

/** The link that puts `a` beside `b` (either may be left for the page to ask for). */
export function compareHref(a: string | null, b?: string | null): string {
  return `/builder/compare${writeSides({ a, b: b ?? null, mode: "side" })}`;
}

/** Where the wipe is, 0 to 100, for a pointer at `x` over a box that starts at `left` and is `width` wide. */
export function wipeAt(x: number, left: number, width: number): number {
  if (!(width > 0)) return 50;
  return Math.max(0, Math.min(100, ((x - left) / width) * 100));
}

/** The width each pane is drawn at: half the room less the gap side by side, all of it for the slider. */
export function paneWidth(room: number, mode: CompareMode, gap: number): number {
  const w = mode === "side" ? (room - gap) / 2 : room;
  return Math.max(0, Math.floor(w));
}

/** The same document on another of its pages (or untouched when it has no such page). */
export function onPage(doc: PreviewDoc | null, pageId: string | null): PreviewDoc | null {
  if (!doc || !pageId || !doc.pages?.some((p) => p.id === pageId)) return doc;
  return { ...doc, activePageId: pageId };
}

/**
 * The page of `doc` that stands for page `named` of the other site: the one
 * with the same name, else the one in the same place, else its first. A copy
 * keeps its page ids, but a better version may not, and a name is what a
 * person reads.
 */
export function matchPage(doc: PreviewDoc | null, named: { id: string; name: string; index: number } | null): string | null {
  const pages = doc?.pages ?? [];
  if (!pages.length) return null;
  if (!named) return doc?.activePageId ?? pages[0]!.id;
  return (pages.find((p) => p.id === named.id) ?? pages.find((p) => p.name === named.name) ?? pages[named.index] ?? pages[0]!).id;
}

/** The frame width a document is drawn at, as `SitePreview` reads it. */
export function frameOf(doc: PreviewDoc | null): number {
  return Number(doc?.format?.["frame.width"]) || doc?.frameWidth || 1440;
}
