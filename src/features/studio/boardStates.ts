/**
 * THE PAGE'S HIDDEN STATES, SHOWN ON THE BOARD TO DESIGN THEM.
 *
 * A page brought in from code starts most of itself hidden: PonsStars' play
 * page has its match panel, chart, result and pop-ups behind `hidden`, 375
 * of its 620 parts. They come in as parts of a state group
 * (`StudioNode.state`, `hidden:<hook>`, `pageParts.ts`) and are not drawn
 * where the page opens, so they took no room on the board, could not be
 * seen or arranged, and picking the chart panned to empty space.
 *
 * The States control on the page strip (`StatesChip`) switches them on for
 * the board alone (`statesOn`): a group by its hook (`hidden:match-panel`),
 * or a preview screen of the repository (`screen:mid-match`), which shows
 * exactly the parts that screen shows (read off the page as its own code
 * builds it, at import: `styleSource.screens`) and hides the rest of its
 * page. Nothing else changes: the parts keep their state, so the published
 * and exported page is hidden by default as the code expects, and a style
 * made while a state is on is a style on that part, which the style layer
 * writes under its hook (`styleLayer.ts`).
 *
 * Pure: `tests/board-states.mjs` holds it on PonsStars.
 */

import { readStepKey, type FramesRead } from "./stateFrames.ts";

/** One preview screen, as read at import: its page and the hooks it shows. */
export interface ScreenRead {
  name: string;
  label?: string;
  /** The page file it is a state of (`web/index.html`). */
  page: string;
  /** Every hook drawn on that page in this screen. */
  shows: string[];
  /** Where each drawn hook is in this screen, [x, y, w, h] from the screen's own corner (read at import). */
  boxes?: Record<string, [number, number, number, number]>;
}

export interface StateNode {
  id?: string;
  pageId: string;
  hooks?: Record<string, string> | null;
  state?: { group: string; option: number } | null;
}

/** A group's own hook: `hidden:match-panel` is match-panel; a template's group names its template. */
export const groupHook = (group: string): string => group.replace(/^hidden:(template:)?/, "");

/** The key a screen is switched on by. */
export const screenKey = (name: string) => `screen:${name}`;

/**
 * What the board draws, with these states on. `pageOf` turns a screen's page
 * file into the board's page id.
 */
export function boardShows(on: readonly string[], screens: readonly ScreenRead[] | null | undefined, pageOf: (file: string) => string | null, frames?: Pick<FramesRead, "inFrame" | "stepOf"> | null) {
  const groups = new Set(on.filter((k) => !k.startsWith("screen:") && !k.startsWith("step:")));
  /* One face of a frame, picked on its States timeline: that face alone, in its frame (`stateFrames.ts`). */
  const picked = new Map<string, string>();
  for (const k of on) { const s = readStepKey(k); if (s) picked.set(s.frame, s.step); }
  const byPage = new Map<string, Set<string>[]>();
  for (const s of screens ?? []) {
    if (!on.includes(screenKey(s.name))) continue;
    const page = pageOf(s.page);
    if (!page) continue;
    const list = byPage.get(page) ?? [];
    list.push(new Set(s.shows));
    byPage.set(page, list);
  }
  return (n: StateNode): boolean => {
    if (picked.size && frames && n.id) {
      const f = frames.inFrame.get(n.id);
      const want = f ? picked.get(f) : undefined;
      if (want !== undefined) return frames.stepOf.get(n.id) === want;
    }
    if (n.state && groups.has(n.state.group)) return true;
    const shown = byPage.get(n.pageId);
    if (!shown) return !n.state;
    const hook = n.hooks?.["data-hook"];
    if (hook) return shown.some((s) => s.has(hook));
    /* A part with no hook of its own goes with its group, or stays as the page opens. */
    return n.state ? shown.some((s) => s.has(groupHook(n.state!.group))) : true;
  };
}

/** The hidden groups on one page, by hook, with their part counts: templates last. */
export function hiddenGroups(nodes: readonly StateNode[], pageId: string): { group: string; hook: string; parts: number; template: boolean }[] {
  const count = new Map<string, number>();
  for (const n of nodes) if (n.pageId === pageId && n.state?.group?.startsWith("hidden:")) count.set(n.state.group, (count.get(n.state.group) ?? 0) + 1);
  return [...count].map(([group, parts]) => ({ group, hook: groupHook(group), parts, template: group.startsWith("hidden:template:") }))
    .sort((a, b) => Number(a.template) - Number(b.template) || b.parts - a.parts || a.hook.localeCompare(b.hook));
}

/** A box on the board. */
export interface PlaceBox { x: number; y: number; w: number; h: number }
interface PlaceNode extends StateNode { id: string; x: number; y: number; w: number; h: number }

const median = (xs: number[]): number => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2;
};

/**
 * WHERE A SCREEN DRAWS ITS PARTS. A state the code shows sits in the page's
 * flow: the practice note shown, the lines under it move down. The board
 * keeps each part where the page first drew it, so a screen that shows two
 * states drew them on top of each other. Each screen read at import says
 * where every hook it drew sat (`boxes`); lined up with the page's parts
 * (the median offset and scale of the parts both have), each shown part is
 * drawn there while that screen is on, and a part with no hook moves with
 * the hooked part that holds it. Only the board's drawing: the parts keep
 * their own boxes. Returns the parts to draw elsewhere, by id.
 */
export function screenPlaces(nodes: readonly PlaceNode[], on: readonly string[], screens: readonly ScreenRead[] | null | undefined, pageOf: (file: string) => string | null, shows: (n: PlaceNode) => boolean, pageHint?: (s: ScreenRead) => string | null): Map<string, PlaceBox> {
  const out = new Map<string, PlaceBox>();
  const done = new Set<string>();
  for (const s of screens ?? []) {
    if (!s.boxes || !on.includes(screenKey(s.name))) continue;
    const page = (s.page ? pageOf(s.page) : null) ?? pageHint?.(s) ?? null;
    if (!page || done.has(page)) continue;
    done.add(page);
    const here = nodes.filter((n) => n.pageId === page);
    const hookOf = (n: PlaceNode) => n.hooks?.["data-hook"];
    const anchors = here.filter((n) => !n.state && hookOf(n) && s.boxes![hookOf(n)!] && n.w > 8 && n.h > 8 && s.boxes![hookOf(n)!]![2] > 8);
    if (anchors.length < 3) continue;
    let k = median(anchors.map((n) => n.w / s.boxes![hookOf(n)!]![2]));
    if (!Number.isFinite(k) || k <= 0 || Math.abs(k - 1) < 0.02) k = 1;
    const dx = median(anchors.map((n) => n.x - k * s.boxes![hookOf(n)!]![0]));
    const dy = median(anchors.map((n) => n.y - k * s.boxes![hookOf(n)!]![1]));
    /* Every shown hooked part the screen drew, where it drew it; those more than 2px off are moved. */
    const target = new Map<string, PlaceBox>();
    const moved = new Map<string, PlaceBox>();
    for (const n of here) {
      const b = hookOf(n) ? s.boxes[hookOf(n)!] : undefined;
      if (!b || !shows(n)) continue;
      const to = { x: Math.round(k * b[0] + dx), y: Math.round(k * b[1] + dy), w: Math.round(k * b[2]), h: Math.round(k * b[3]) };
      if (Math.abs(to.x - n.x) > 2 || Math.abs(to.y - n.y) > 2) { moved.set(n.id, to); target.set(n.id, to); }
      else target.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h });
    }
    if (!moved.size) continue;
    /* A part with no hook of its own goes with the smallest hooked part that holds it. */
    const hooked = here.filter((n) => target.has(n.id)).sort((a, b) => a.w * a.h - b.w * b.h);
    for (const n of here) {
      if (moved.has(n.id)) { out.set(n.id, moved.get(n.id)!); continue; }
      if (hookOf(n) || !shows(n)) continue;
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      const holding = hooked.filter((h) => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h);
      /* One of its own state first: a state's words go with that state, not with a line it was drawn over. */
      const by = holding.find((h) => (h.state?.group ?? null) === (n.state?.group ?? null)) ?? holding[0];
      if (!by) continue;
      const to = target.get(by.id)!;
      if (to.x !== by.x || to.y !== by.y) out.set(n.id, { x: n.x + (to.x - by.x), y: n.y + (to.y - by.y), w: n.w, h: n.h });
    }
  }
  return out;
}

/**
 * THE PART UNDER THE HAND, INSIDE THE ONE PICKED. A part that holds others
 * can cover them (a TV whose still picture is over its duel circles), so a
 * press never reaches them. Two presses on it go in: the smallest part
 * drawn under the point, inside it, is picked. Escape climbs back out.
 */
export function partUnder<T extends PlaceNode>(nodes: readonly T[], outer: T, at: { x: number; y: number }, shows: (n: T) => boolean, place?: (n: T) => PlaceBox | undefined): T | null {
  const box = (n: T): PlaceBox => place?.(n) ?? n;
  const o = box(outer);
  const holds = (b: PlaceBox, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
  let best: T | null = null;
  for (const n of nodes) {
    if (n.id === outer.id || n.pageId !== outer.pageId || !shows(n)) continue;
    const b = box(n);
    if (!holds(b, at.x, at.y) || b.w * b.h >= o.w * o.h || !holds(o, b.x + b.w / 2, b.y + b.h / 2)) continue;
    if (!best || b.w * b.h < box(best).w * box(best).h) best = n;
  }
  return best;
}
