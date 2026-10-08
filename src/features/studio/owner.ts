/**
 * Who a part belongs to on the board: its parent, the control it is the
 * words of, and the words a control carries.
 *
 * A button on a captured page is often two parts, the button and the words
 * drawn over it. One press used to pick the words, because they are on top,
 * so a person reaching for BUY could only ever move the label off its
 * button. So one press picks the CONTROL THAT OWNS what was pressed (a
 * button, a link, a card), a second press (or Enter) goes into the words,
 * and Escape climbs back out one level at a time. Moving a control carries
 * what it holds.
 *
 * Ownership is read the same two ways the rest of the Builder reads it: the
 * page path the capture recorded (`owns.ts`), else the box (`holds.ts`).
 * Nothing here moves or writes anything; it only answers.
 */
import type { StudioNode } from "./board/store";
import { carriedBy, componentOf, componentsOf, GRABBED, type CompNode } from "./components";
import { isControl } from "./control";
import { under } from "./owns";
import { plain } from "./parts/spans";

type Boxed = Pick<StudioNode, "id" | "pageId" | "x" | "y" | "w" | "h" | "featureId" | "link" | "data" | "content"> & {
  from?: { selector?: string } | null;
  locked?: boolean;
};

const pathOf = (n: Boxed) => (n.from?.selector ?? "").trim();
const area = (n: Boxed) => Math.max(0, n.w) * Math.max(0, n.h);

/** Does `outer` hold `inner`: by the recorded page path, else wholly inside its box and smaller. */
export function holds(outer: Boxed, inner: Boxed): boolean {
  if (outer.id === inner.id || outer.pageId !== inner.pageId) return false;
  const a = pathOf(outer);
  const b = pathOf(inner);
  if (a && b) return under(a, b);
  const slack = 1;
  return inner.x >= outer.x - slack && inner.y >= outer.y - slack
    && inner.x + inner.w <= outer.x + outer.w + slack && inner.y + inner.h <= outer.y + outer.h + slack
    && area(inner) < area(outer);
}

/** A card: a part a visitor reads as one thing, by its kind or by what the capture recorded it as. */
export function isCard(n: Boxed): boolean {
  if (/card/i.test(n.featureId)) return true;
  if (/^\s*(article|card)\b/i.test(n.data ?? "")) return true;
  const last = pathOf(n).split(">").pop() ?? "";
  return /(^|[.#\s-])card\b/i.test(last) || /^article\b/i.test(last.trim());
}

/** A thing a press should pick whole: a control or a card. */
export const isOwner = (n: Boxed) => isControl(n) || isCard(n);

/** The words a part draws, as one plain string. */
export const wordsOf = (n: Pick<StudioNode, "content">) => plain(n.content).trim();

/** The nearest part that holds this one, or null at the top. */
export function parentOf<N extends Boxed>(nodes: readonly N[], n: Boxed): N | null {
  let best: N | null = null;
  for (const c of nodes) if (holds(c, n) && (!best || area(c) < area(best))) best = c;
  return best;
}

/**
 * The control or card a press on this part should pick instead, or null when
 * the part is one itself or nothing owns it. The nearest one wins, so a
 * button inside a card owns its own words, and a press on the button itself
 * stays on the button: a control or a card is never passed up.
 */
export function ownerOf<N extends Boxed>(nodes: readonly N[], n: Boxed, palette?: Record<string, string | undefined> | null): N | null {
  /*
   * A layer of a component (its words, its light, its shadow layer) picks the
   * component: they are one thing (`components.ts`). Only the kinds a press
   * takes whole (a button, a tab, a copy bar, a badge, a card): a panel or a
   * ticker is a big holder, drawn across, so a press on the picture in it or
   * on its running words picks that part, as a press inside a section does.
   * Moved, a panel still carries its layers.
   */
  const comp = componentOf(nodes as unknown as CompNode[], n.id, palette);
  if (comp && comp.id !== n.id && GRABBED.has(comp.kind)) return nodes.find((x) => x.id === comp.id) ?? null;
  if (isOwner(n)) return null;
  let best: N | null = null;
  for (const c of nodes) if (isOwner(c) && holds(c, n) && (!best || area(c) < area(best))) best = c;
  return best;
}

/**
 * The parts a moving part carries with it: everything it holds (a control,
 * a panel, a card), and every layer of a component (`components.ts`), its
 * children's too, that is not already in hand.
 */
export function ridersOf<N extends Boxed>(nodes: readonly N[], ids: readonly string[], palette?: Record<string, string | undefined> | null): string[] {
  const inHand = new Set(ids);
  const out: string[] = [];
  const comps = componentsOf(nodes as unknown as CompNode[], palette);
  const locked = new Set(nodes.filter((n) => n.locked).map((n) => n.id));
  for (const id of ids) {
    for (const p of carriedBy(comps, id)) if (!inHand.has(p) && !locked.has(p)) { inHand.add(p); out.push(p); }
    /* A part that holds others carries them too, a control or not: a panel or the tour's card dragged with its words and buttons, never off them (J, 2026-10-06: "Always moves", then the card left its steps behind). */
    const c = nodes.find((n) => n.id === id);
    if (!c) continue;
    for (const n of nodes) if (!inHand.has(n.id) && !n.locked && holds(c, n)) { inHand.add(n.id); out.push(n.id); }
  }
  return out;
}

/** Where Enter goes: the part's own words, else the biggest words it holds. */
export function wordsIn<N extends Boxed>(nodes: readonly N[], n: N): N | null {
  if (wordsOf(n)) return n;
  let best: N | null = null;
  for (const c of nodes) if (wordsOf(c) && holds(n, c) && (!best || area(c) > area(best))) best = c;
  return best;
}
