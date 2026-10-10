/**
 * A PANEL CARRIES WHAT IS ON IT, in the Preview as on the published page.
 *
 * The Preview draws every part on its own against the page, so an effect
 * given to a panel (a lift, a float, a tilt) moved the panel's box and left
 * its words and buttons standing where they were. The published page puts a
 * part inside the box that holds it; this says which parts the Preview must
 * draw inside which panel for the same to happen there: a part goes in the
 * smallest panel that holds it, moves as a whole, and is drawn under it.
 *
 * Pure: boxes in, a map out (`LiveSite.tsx` draws it).
 */
import { usesOf } from "../shelf/library/works.ts";

/** The effects that move or show a part as a whole: what is on it goes with it. */
export const CARRIES: ReadonlySet<string> = new Set([
  "hover-lift", "press-push", "float", "spin", "blink", "tilt", "reveal", "switch-on", "scroll-grow", "follow-pointer", "screen-filter",
]);

/** Whether a part's effects move it as a whole. */
export function movesWhole(work: unknown): boolean {
  return usesOf(work as never).some((u) => !u.off && CARRIES.has(u.id));
}

export interface CarryBox { id: string; x: number; y: number; w: number; h: number; moves: boolean; still?: boolean }

const holds = (o: CarryBox, i: CarryBox) =>
  i.x >= o.x - 1 && i.y >= o.y - 1 && i.x + i.w <= o.x + o.w + 1 && i.y + i.h <= o.y + o.h + 1;

/**
 * Part id → the panel that carries it. `boxes` in drawing order: only a part
 * drawn after a panel (on top of it) is carried. A panel that is hidden
 * until a press, or a part that is, is left as it is (`still`).
 */
export function carriers(boxes: readonly CarryBox[]): Map<string, string> {
  const out = new Map<string, string>();
  boxes.forEach((inner, i) => {
    if (inner.still) return;
    let best: CarryBox | null = null;
    for (let j = 0; j < i; j++) {
      const o = boxes[j]!;
      if (!o.moves || o.still || o.w * o.h <= inner.w * inner.h || !holds(o, inner)) continue;
      if (!best || o.w * o.h < best.w * best.h) best = o;
    }
    if (best) out.set(inner.id, best.id);
  });
  return out;
}

type LeanBox<E> = { el: E; r: { left: number; top: number; width: number; height: number } };
const inside = (o: LeanBox<unknown>["r"], i: LeanBox<unknown>["r"]) =>
  i.left >= o.left - 1 && i.top >= o.top - 1 && i.left + i.width <= o.left + o.width + 1 && i.top + i.height <= o.top + o.height + 1;
/**
 * What leans under the pointer: the smallest part there that holds others and
 * is narrower than `widest` (else the part itself), and every part drawn
 * within it. Pure, on measured boxes, so it is tested without a page.
 */
export function leanSet<E, B extends LeanBox<E>>(boxes: readonly B[], x: number, y: number, widest: number): { card: B; set: B[] } | null {
  const under = boxes.filter((b) => x >= b.r.left && x <= b.r.left + b.r.width && y >= b.r.top && y <= b.r.top + b.r.height);
  if (!under.length) return null;
  const area = (b: B) => b.r.width * b.r.height;
  const holding = (c: B) => boxes.filter((b) => b !== c && area(b) < area(c) && inside(c.r, b.r));
  const cards = under.filter((c) => c.r.width <= widest && holding(c).length > 0).sort((p, q) => area(p) - area(q));
  if (cards[0]) return { card: cards[0], set: [cards[0], ...holding(cards[0])] };
  const alone = [...under].sort((p, q) => area(p) - area(q))[0]!;
  return { card: alone, set: [alone] };
}
