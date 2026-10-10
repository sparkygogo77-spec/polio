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
import { plain } from "./shelf";

type Boxed = Pick<StudioNode, "id" | "pageId" | "x" | "y" | "w" | "h" | "featureId" | "link" | "data" | "content"> & {
  from?: { selector?: string } | null;
  locked?: boolean;
  hooks?: Record<string, string> | null;
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
  /* A part inside an app area (kit rule 34) is the app's: a press picks the area. */
  const app = appAreaOf(nodes, n);
  if (app) return app;
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
 * AN APP AREA IS THE CODE'S WORKING BOX (kit rule 34). J (2026-10-10): the
 * TV screen PonsStars' game draws in "is an element I can move that the game
 * server would follow", and he wants such boxes kept and placeable on every
 * site. A site marks the box with `data-app-area="<name>"`; its script fills
 * and measures what is inside. On the board the box moves and resizes, and
 * everything inside rides with it: a press inside picks the box, a drag on
 * anything inside moves the box, and the parts inside have no handles of
 * their own. The style layer never writes their size or place.
 */
export const appAreaName = (n: Pick<Boxed, "hooks">): string | null => {
  const v = n.hooks?.["data-app-area"];
  return v === undefined ? null : v.trim() || "App";
};

/** What the board says on an app area. */
export const appAreaLabel = (name: string) => `${name} area: what is inside moves with it`;

/** The outermost app area that holds this part (never the part itself), or null. */
export function appAreaOf<N extends Boxed>(nodes: readonly N[], n: Boxed): N | null {
  let best: N | null = null;
  for (const c of nodes) if (appAreaName(c) !== null && holds(c, n) && (!best || area(c) > area(best))) best = c;
  return best;
}

/** Every part inside any app area: the parts that have no handles of their own. */
export function inAppAreaIds(nodes: readonly Boxed[]): Set<string> {
  const areas = nodes.filter((n) => appAreaName(n) !== null);
  const out = new Set<string>();
  if (!areas.length) return out;
  for (const n of nodes) if (areas.some((a) => holds(a, n))) out.add(n.id);
  return out;
}

/** A press or a drag on a part inside an app area is on the area: ids swapped for their area, each once. */
export function liftToAppArea<N extends Boxed>(nodes: readonly N[], ids: readonly string[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const n = nodes.find((x) => x.id === id);
    const to = (n && appAreaOf(nodes, n)?.id) || id;
    if (!out.includes(to)) out.push(to);
  }
  return out;
}

/** What an app area takes when it is resized: everything inside, scaled with it. */
export function appAreaRiders(nodes: readonly Boxed[], id: string): string[] {
  const a = nodes.find((n) => n.id === id);
  if (!a || appAreaName(a) === null) return [];
  return nodes.filter((n) => holds(a, n)).map((n) => n.id);
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

const HOLDERS = new WeakMap<readonly Boxed[], Set<string>>();

/**
 * The parts other parts sit in: the panels, as against the fields. A texture
 * can land on one kind and not the other (`texture.ts#lands`).
 *
 * By the recorded page path where there is one, which is every ancestor of
 * every path, so a page of thousands of parts is one pass; else by the box,
 * among the parts that have no path (a site made here: a few dozen). Kept
 * per list, so every part of a page can ask without the page asking again.
 */
export function holderIds(nodes: readonly Boxed[]): Set<string> {
  const known = HOLDERS.get(nodes);
  if (known) return known;
  const out = new Set<string>();
  const above = new Set<string>();
  for (const n of nodes) {
    const parts = pathOf(n).split(" > ");
    for (let i = 1; i < parts.length; i++) above.add(`${n.pageId ?? ""}\u0000${parts.slice(0, i).join(" > ")}`);
  }
  const loose: Boxed[] = [];
  for (const n of nodes) {
    const p = pathOf(n);
    if (p) { if (above.has(`${n.pageId ?? ""}\u0000${p}`)) out.add(n.id); }
    else loose.push(n);
  }
  for (const o of loose) if (loose.some((i) => holds(o, i))) out.add(o.id);
  HOLDERS.set(nodes, out);
  return out;
}

const WRAPPERS = new WeakMap<readonly Boxed[], Set<string>>();

/**
 * THE SITE'S OWN WRAPPERS ARE THE CODE'S, NOT THE BOARD'S (J, 2026-10-09:
 * the "app" box that holds the whole of PonsStars "should be in the backend
 * and not for me to mess with"). A part is one when it came from the site's
 * code (brought in or captured, not made here), draws no words of its own,
 * and holds most of its page: at least half of the page's other parts, over
 * at least 60% of the area they cover, or every one of them (the page's
 * body, however short the browser measured it). On the board a press goes through it
 * to the parts inside, a marquee and Select everything leave it out, and it
 * rides along when everything it holds is moved. Kept per list.
 */
export function wrapperIds(nodes: readonly Boxed[]): Set<string> {
  const known = WRAPPERS.get(nodes);
  if (known) return known;
  const out = new Set<string>();
  const byPage = new Map<string, Boxed[]>();
  for (const n of nodes) { const k = n.pageId ?? ""; const l = byPage.get(k); if (l) l.push(n); else byPage.set(k, [n]); }
  const spreadOf = (list: readonly Boxed[]) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const m of list) { x0 = Math.min(x0, m.x); y0 = Math.min(y0, m.y); x1 = Math.max(x1, m.x + m.w); y1 = Math.max(y1, m.y + m.h); }
    return Math.max(1, (x1 - x0) * (y1 - y0));
  };
  for (const list of byPage.values()) {
    if (list.length < 3) continue;
    /* Only a part near the size of the whole page is weighed further: a board of a thousand parts asks this on every move. */
    const page = spreadOf(list);
    for (const n of list) {
      const top = !!pathOf(n) && !pathOf(n).includes(">");
      if (!top && area(n) < 0.6 * 0.6 * page) continue;
      const made = n as Boxed & { source?: unknown };
      if (!made.source && !pathOf(n)) continue;
      if (wordsOf(n) || isOwner(n)) continue;
      const rest = list.filter((m) => m.id !== n.id);
      let held = 0;
      for (const m of rest) if (holds(n, m)) held++;
      if (held < Math.max(2, rest.length / 2)) continue;
      if (held === rest.length || area(n) >= 0.6 * spreadOf(rest)) out.add(n.id);
    }
  }
  WRAPPERS.set(nodes, out);
  return out;
}

/** Is this part one of the site's own wrappers (`wrapperIds`)? */
export const isWrapper = (nodes: readonly Boxed[], n: Pick<Boxed, "id">) => wrapperIds(nodes).has(n.id);
