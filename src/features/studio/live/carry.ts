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

export interface CarryBox { id: string; x: number; y: number; w: number; h: number; moves: boolean; still?: boolean; path?: string }

const holds = (o: AttachBox, i: AttachBox) =>
  i.x >= o.x - 1 && i.y >= o.y - 1 && i.x + i.w <= o.x + o.w + 1 && i.y + i.h <= o.y + o.h + 1;

/*
 * A PART ON A BODY'S EDGE IS PART OF IT (J, 2026-10-10: "even if the badge
 * isnt entirely on the panel it should still be considered one part", and
 * the TV's antennas "should be considered attached ... if its touching").
 *
 * A small part touching or overlapping a much bigger one without being inside
 * it (a panel's WALLET badge on its top edge, an antenna standing on the TV)
 * belongs to that body: an effect on the body moves it too. Small parts that
 * touch each other (an antenna and the ball on its tip) go together. It never
 * works the other way: a button on the TV with an effect of its own moves
 * alone and never drags the TV, and a body as big as the part (the red bar
 * over the TV) is a neighbour, not a body.
 *
 * Touching more than one body, it goes with the one it shares the most with
 * on the page it came from (the TV that holds its antennas in the site's own
 * code, not the bar above it), then the one whose smallest holder on the
 * board is smallest, then the smallest. Bodies drawn as the same box (a panel
 * and the column it fills) are one.
 */
export interface AttachBox { id: string; x: number; y: number; w: number; h: number; path?: string }
/** How many times bigger a body is than what it carries on its edge. */
const BODY = 8;
/** More small parts than this touching in a row are a layout (a list, a row of buttons), not a decoration. */
const DECOR = 6;
const touching = (a: AttachBox, b: AttachBox) => a.x <= b.x + b.w + 2 && b.x <= a.x + a.w + 2 && a.y <= b.y + b.h + 2 && b.y <= a.y + a.h + 2;
const areaOf = (b: AttachBox) => Math.max(1, b.w) * Math.max(1, b.h);
const steps = (p?: string) => (p ?? "").split(/\s*>\s*/).filter(Boolean);
const shared = (a?: string, b?: string) => { const x = steps(a), y = steps(b); let i = 0; while (i < x.length && i < y.length && x[i] === y[i]) i++; return i; };
/* From the site's own code, when both came from it: the part sits in the body or beside it in the same box (a badge in its panel, antennas beside the TV's body). A table's cells are a table, never decorations. */
const kin = (body: AttachBox, part: AttachBox) => !body.path || !part.path || (!/(^|>)\s*(td|th|tr|thead|tbody|li)\b/.test(part.path) && shared(body.path, part.path) >= steps(body.path).length - 1);

/** Part id → the bodies it is attached to (several only when they are drawn as the same box). Parts inside a body are not in it. */
export function attachments(boxes: readonly AttachBox[]): Map<string, string[]> {
  const n = boxes.length;
  const up = boxes.map((_, i) => i);
  const find = (i: number): number => (up[i] === i ? i : (up[i] = find(up[i]!)));
  const near = (a: AttachBox, b: AttachBox) => touching(a, b) && !holds(a, b) && !holds(b, a);
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    const a = boxes[i]!, b = boxes[j]!, r = areaOf(a) / areaOf(b);
    if (r < BODY && r > 1 / BODY && near(a, b)) up[find(i)] = find(j);
  }
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) groups.set(find(i), [...(groups.get(find(i)) ?? []), i]);
  const out = new Map<string, string[]>();
  for (const g of groups.values()) {
    const set = g.length > DECOR ? g.map((i) => [i]) : [g];
    for (const k of set) {
      const ks = k.map((i) => boxes[i]!);
      const left = Math.min(...ks.map((b) => b.x)), top = Math.min(...ks.map((b) => b.y));
      const all: AttachBox = { id: "", x: left, y: top, w: Math.max(...ks.map((b) => b.x + b.w)) - left, h: Math.max(...ks.map((b) => b.y + b.h)) - top };
      const touched = boxes.filter((c, ci) => !k.includes(ci) && ks.some((m) => near(c, m) && areaOf(c) >= BODY * areaOf(m) && kin(c, m)) && ks.every((m) => !holds(c, m) && !holds(m, c)));
      if (!touched.length) continue;
      const rank = (c: AttachBox) => {
        const depth = Math.max(...ks.filter((m) => touching(c, m)).map((m) => shared(c.path, m.path)));
        const held = boxes.filter((o) => o !== c && !ks.includes(o) && holds(o, c) && holds(o, all)).reduce((s, o) => Math.min(s, areaOf(o)), Infinity);
        return { depth, held, own: areaOf(c) };
      };
      const scored = touched.map((c) => ({ c, r: rank(c) }));
      const deep = Math.max(...scored.map((x) => x.r.depth));
      /* Of those as near in the code, the outermost: antennas touching the TV's screen as well as its body go with the body. */
      const near1 = scored.filter((x) => x.r.depth === deep);
      const ranked = near1.filter(({ c }) => !near1.some(({ c: d }) => d !== c && holds(d, c) && !holds(c, d))).sort((p, q) => p.r.held - q.r.held || p.r.own - q.r.own);
      const best = ranked[0]!.c;
      const same = ranked.filter(({ c }) => c.x === best.x && c.y === best.y && c.w === best.w && c.h === best.h).map(({ c }) => c.id);
      for (const m of ks) out.set(m.id, same);
    }
  }
  return out;
}

/**
 * Part id → the panel that carries it. `boxes` in drawing order: a part
 * inside a moving panel goes with the smallest one drawn before it (on top
 * of it); a part attached to a moving body (`attachments`) goes with it
 * wherever it is drawn, and so does what it holds. A panel that is hidden
 * until a press, or a part that is, is left as it is (`still`).
 */
export function carriers(boxes: readonly CarryBox[]): Map<string, string> {
  const out = new Map<string, string>();
  const live = boxes.filter((b) => !b.still);
  const att = attachments(live);
  /* A part attached to a moving body moves too, so what it holds rides with it. */
  const moving = new Set(live.filter((b) => b.moves).map((b) => b.id));
  for (let round = 0; round < 4; round++) for (const [id, bodies] of att) if (bodies.some((b) => moving.has(b))) moving.add(id);
  boxes.forEach((inner, i) => {
    if (inner.still) return;
    let best: CarryBox | null = null;
    for (let j = 0; j < i; j++) {
      const o = boxes[j]!;
      if (!moving.has(o.id) || o.still || o.w * o.h <= inner.w * inner.h || !holds(o, inner)) continue;
      if (!best || o.w * o.h < best.w * best.h) best = o;
    }
    if (best) { out.set(inner.id, best.id); return; }
    const body = att.get(inner.id)?.find((b) => moving.has(b));
    if (body) out.set(inner.id, body);
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
