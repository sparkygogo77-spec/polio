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
  /** What each drawn hook says in this screen (read at import): a step shows these words, and the same parts saying other things (you won, you lost) are another state. */
  texts?: Record<string, string>;
  /** The size, in px, each of those hooks' words are set at in this screen. */
  sizes?: Record<string, number>;
  /** What a part with a still draws in this screen, as its picture (PST's chart: the match's candles). */
  stills?: Record<string, unknown>;
  /** The step of the site's flow this screen shows (its preview's `data-preview-step`): a part goes through these, in the order they first come. */
  step?: string;
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
export function boardShows(on: readonly string[], screens: readonly ScreenRead[] | null | undefined, pageOf: (file: string) => string | null, frames?: Pick<FramesRead, "inFrame" | "stepOf"> | null, decide?: ReadonlyMap<string, boolean> | null) {
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
    /* A part stepped on the board decides what is inside it, and only that (`steppedParts`). */
    const said = n.id ? decide?.get(n.id) : undefined;
    if (said !== undefined) return said;
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
    let dy = median(anchors.map((n) => n.y - k * s.boxes![hookOf(n)!]![1]));
    /* The screen's top stays on the page's top (J, 2026-10-06): a line a
       screen adds high up (PST's "Game server offline.") moves most parts
       down, and their median offset lifted the nav and the title above the
       page, under the board's name. */
    const tops = here.filter((n) => !n.state && !pinned(n) && shows(n) && hookOf(n) && s.boxes![hookOf(n)!]);
    if (tops.length) {
      const pageTop = Math.min(...tops.map((n) => n.y));
      const drawnTop = Math.min(...tops.map((n) => k * s.boxes![hookOf(n)!]![1] + dy));
      if (drawnTop < pageTop) dy += pageTop - drawnTop;
    }
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
    keepOverlaysOnPage(here, out, shows);
  }
  return out;
}

/**
 * AN OVERLAY STAYS ON THE PAGE. A part pinned to the window (PST's tour: its
 * shade and its card, where the screen had scrolled to the queue) was read
 * where that window stood, and could land below the board's page, outside
 * it (J, 2026-10-05). Each one pinned to the window, with everything in it,
 * is moved up until its foot is on the page, and down to the page's top.
 */
/** Pinned to the window rather than in the page's flow. */
const pinned = (n: PlaceNode) => (n as PlaceNode & { from?: { position?: string } | null }).from?.position === "fixed";

function keepOverlaysOnPage(here: readonly PlaceNode[], out: Map<string, PlaceBox>, shows: (n: PlaceNode) => boolean): void {
  const box = (n: PlaceNode) => out.get(n.id) ?? n;
  const flow = here.filter((n) => !n.state && !pinned(n));
  if (!flow.length) return;
  const foot = Math.max(...flow.map((n) => box(n).y + box(n).h));
  const roots = here.filter((n) => pinned(n) && shows(n)).filter((n, _, all) => !all.some((o) => o !== n && contains(box(o), box(n))));
  for (const r of roots) {
    const b = box(r);
    const dy = b.y + b.h > foot ? Math.max(-b.y, foot - (b.y + b.h)) : b.y < 0 ? -b.y : 0;
    if (!dy) continue;
    for (const n of here) {
      if (n !== r && !contains(b, box(n))) continue;
      const at = box(n);
      out.set(n.id, { ...at, y: at.y + dy });
    }
  }
}
const contains = (o: PlaceBox, n: PlaceBox) => n.x >= o.x - 1 && n.y >= o.y - 1 && n.x + n.w <= o.x + o.w + 1 && n.y + n.h <= o.y + o.h + 1;

/** Each shown part's words and picture as the lit page screens have them (the tour card's "How it works"), by id. */
export function screenLooks(nodes: readonly (PlaceNode & { content?: unknown })[], on: readonly string[], screens: readonly ScreenRead[] | null | undefined, pageOf: (file: string) => string | null): Map<string, StepLook> {
  const out = new Map<string, StepLook>();
  for (const s of screens ?? []) {
    if (!on.includes(screenKey(s.name))) continue;
    const page = s.page ? pageOf(s.page) : null;
    const shows = new Set(s.shows);
    for (const n of nodes) {
      if ((page && n.pageId !== page) || out.has(n.id) || !n.hooks?.["data-hook"] || !shows.has(n.hooks["data-hook"])) continue;
      const look = stepLook(n, s);
      if (look) out.set(n.id, look);
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

/**
 * THE SCREENS THAT CHANGE THIS PART. A part's own hidden faces are not all
 * it goes through: PonsStars' TV wakes, goes offline, plays a sample, plays
 * the match and shows the result, each a preview screen of its code. A
 * screen is one of this part's states when what it draws inside the part
 * differs from what the page opens with there; screens that draw the same
 * inside it are one state, the first named.
 */
export function screensOfPart(nodes: readonly PlaceNode[], frame: PlaceNode, screens: readonly ScreenRead[], pageFile: string | null): ScreenRead[] {
  /* Wholly inside it (2px either way), and smaller: a wrapper whose middle happens to fall in it is not in it. */
  const E = 2;
  const inside = nodes.filter((n) => n.pageId === frame.pageId && n.id !== frame.id && n.w * n.h < frame.w * frame.h && n.x >= frame.x - E && n.y >= frame.y - E && n.x + n.w <= frame.x + frame.w + E && n.y + n.h <= frame.y + frame.h + E);
  const hooks = new Set(inside.map((n) => n.hooks?.["data-hook"]).filter((h): h is string => !!h));
  const opens = [...new Set(inside.filter((n) => !n.state).map((n) => n.hooks?.["data-hook"]).filter((h): h is string => !!h))].sort().join(" ");
  /*
   * One per distinct state, in the order it first appears; named by the
   * screen most about this part: its name or label says the part's words
   * (PonsStars' "Chart TV: a match on screen" over the page-wide
   * "mid-match"), and, the same, the most of what it draws is inside it.
   */
  const PLAIN = new Set(["row", "panel", "box", "area", "wrap", "inner", "body", "frame", "line", "text", "label", "icon", "shape"]);
  const words = new Set([frame, ...inside.slice().sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 4)]
    .flatMap((n) => (n.hooks?.["data-hook"] ?? "").toLowerCase().split(/[^a-z0-9]+/)).filter((w) => w.length > 1 && !PLAIN.has(w)));
  const says = (sc: ScreenRead) => { const t = `${sc.name} ${sc.label ?? ""}`.toLowerCase().split(/[^a-z0-9]+/); return [...words].filter((w) => t.includes(w)).length; };
  const mine = screens.filter((sc) => !pageFile || sc.page === pageFile);
  /*
   * J (2026-10-05): a part's steps follow the real flow. When the site says
   * which step of its flow each screen shows (`step`), the part goes through
   * those steps in that order, one each: a screen with no step (a pop-up,
   * the tour floating over it) is the page's state, not this part's. Two
   * steps in a row that draw the same inside it, word for word, are one.
   */
  const flow = mine.some((sc) => sc.step);
  const groups = new Map<string, { at: number; best: ScreenRead; share: number; said: number; drawn: string }>();
  /* A part the page hides until its code shows it (the match panel) has a step only where the screen draws it: in the lobby it is not on the page at all. */
  const fh = frame.hooks?.["data-hook"];
  mine.forEach((sc, at) => {
    if (flow && !sc.step) return;
    if (frame.state && fh && !sc.shows.includes(fh)) return;
    const own = sc.shows.filter((h) => hooks.has(h));
    const here = [...new Set(own)].sort().join(" ");
    if (!here || here === opens) return;
    const share = own.length / Math.max(1, sc.shows.length);
    const said = says(sc);
    const drawn = `${here}|${here.split(" ").map((h) => sc.texts?.[h] ?? "").join("\u0001")}`;
    const key = flow ? sc.step! : here;
    const g = groups.get(key);
    if (!g) groups.set(key, { at, best: sc, share, said, drawn });
    else if (said > g.said || (said === g.said && share > g.share + 1e-9)) { g.best = sc; g.share = share; g.said = said; }
  });
  const list = [...groups.values()].sort((a, b) => a.at - b.at);
  if (!flow) return list.map((g) => g.best);
  /* Steps in a row that draw the same here are one: the one most about this part names it (the match panel's "between matches", not "connecting"). */
  const runs: (typeof list)[] = [];
  for (const g of list) { const last = runs.at(-1); if (last && last[0]!.drawn === g.drawn) last.push(g); else runs.push([g]); }
  return runs.map((run) => run.reduce((a, b) => (b.said > a.said || (b.said === a.said && b.share > a.share + 1e-9) ? b : a)).best);
}


/**
 * A PART'S STEPS, ALL OF THEM, KEPT TO THE PART.
 *
 * J (2026-10-05): "some parts problematically shift the whole board or
 * aren't limited to just the one panel": a part's step that came from a
 * preview screen switched the whole screen on, so the rest of the page
 * hid, moved or came in with it. A part's step is its own now: its hidden
 * faces (`stateFrames.ts`) and the screens that change what it draws
 * (`screensOfPart`), each switched on as `step:<frame>=<key>`, a screen's
 * key being `screen:<name>`. Only the parts inside the part go through it;
 * everything outside stays as the page opens (or as a whole-page screen
 * has it). What comes in on the page as a whole is the page's state: its
 * screens, picked as the page's own.
 */
export interface PartStep {
  key: string;
  label: string;
  hook: string | null;
  parts: string[];
  /** The screen it is, when it is one: a screen kept to the part. */
  screen?: string;
}

const insideBox = (n: PlaceBox, f: PlaceBox, e = 2) => n.x >= f.x - e && n.y >= f.y - e && n.x + n.w <= f.x + f.w + e && n.y + n.h <= f.y + f.h + e;
/** The parts in a part's own box (2px either way) on its page, smaller than it. */
export function partsInside<T extends PlaceNode>(nodes: readonly T[], frame: PlaceBox & { id: string; pageId: string }): T[] {
  return nodes.filter((n) => n.pageId === frame.pageId && n.id !== frame.id && n.w * n.h < frame.w * frame.h && insideBox(n, frame));
}
/** Does a screen draw this part? Its hook, or its group's hook, or as the page opens. */
export const screenDraws = (shows: ReadonlySet<string>, n: StateNode): boolean => {
  const h = n.hooks?.["data-hook"];
  return h ? shows.has(h) : !n.state || shows.has(groupHook(n.state.group));
};

/** Every step of a part, in order: its faces, then the screens that change it. */
export function partSteps(nodes: readonly PlaceNode[], frame: PlaceNode, faces: readonly { key: string; label: string; hook: string | null; parts: string[] }[], screens: readonly ScreenRead[], pageFile: string | null): PartStep[] {
  const inside = partsInside(nodes, frame);
  const own = screensOfPart(nodes, frame, screens, pageFile);
  /*
   * A block the page hides inside a part that is not one-face-at-a-time
   * (PonsStars' scoreboard in the chart row, shown from the match's start
   * through its result) is not a step of its own when the part's screens
   * draw it: it comes in with them, where they draw it.
   */
  const drawnBy = new Set(own.flatMap((x) => x.shows));
  const oneAtATime = frame.hooks?.["data-state"] !== undefined;
  const kept = faces.filter((s) => s.key === "open" || oneAtATime || !s.hook || !drawnBy.has(s.hook));
  /* What it opens with, named plainly: the step of the site's flow that draws it so, else "as the page opens" (never a hook's stub, "tv-row"). */
  const named = kept.map((s) => {
    if (s.key !== "open" || oneAtATime) return { ...s };
    const opensAs = opensStep(nodes, frame, screens, pageFile);
    return { ...s, label: opensAs ?? "as the page opens" };
  });
  return [
    ...named,
    ...own.map((x) => {
      const shows = new Set(x.shows);
      return { key: screenKey(x.name), label: x.step || (x.label || x.name).replace(/^[^:]{1,40}:\s*/, ""), hook: null, parts: inside.filter((n) => screenDraws(shows, n)).map((n) => n.id), screen: x.name };
    }),
  ];
}

/** The step of the site's flow whose screen draws inside the part what it opens with, if one does. */
function opensStep(nodes: readonly PlaceNode[], frame: PlaceNode, screens: readonly ScreenRead[], pageFile: string | null): string | null {
  const inside = partsInside(nodes, frame);
  const hooks = new Set(inside.map((n) => n.hooks?.["data-hook"]).filter((h): h is string => !!h));
  const opens = [...new Set(inside.filter((n) => !n.state).map((n) => n.hooks?.["data-hook"]).filter((h): h is string => !!h))].sort().join(" ");
  for (const sc of screens) {
    if (!sc.step || (pageFile && sc.page !== pageFile)) continue;
    if ([...new Set(sc.shows.filter((h) => hooks.has(h)))].sort().join(" ") === opens) return sc.step;
  }
  return null;
}

/**
 * Where these parts of a part are drawn as a screen draws them: set where
 * that screen has them relative to the part (the part itself does not
 * move), and kept inside it. Nothing outside the part is here.
 */
export function partPlaces(nodes: readonly PlaceNode[], frame: PlaceNode, screen: ScreenRead, shown: ReadonlySet<string>): Map<string, PlaceBox> {
  const inner = partsInside(nodes, frame);
  const inside = new Set(inner.map((n) => n.id));
  const hookOf = (n: PlaceNode) => n.hooks?.["data-hook"];
  const fh = hookOf(frame);
  const fb = fh ? screen.boxes?.[fh] : undefined;
  const places = new Map<string, PlaceBox>();
  if (fb && fb[2] > 8) {
    /*
     * J (2026-10-05): a step draws with the page's real layout. Every part
     * the screen draws inside the part goes where the screen has it from the
     * part's own corner (the TV down under the scoreboard and narrower, the
     * trade buttons beside it), not only those the page as a whole moved;
     * and the boxes that fill the part edge to edge (its row, the TV round
     * the screen) go with them.
     */
    const k = Math.abs(frame.w / fb[2] - 1) < 0.02 ? 1 : frame.w / fb[2];
    const sel = (n: PlaceNode) => (n as PlaceNode & { from?: { selector?: string } | null }).from?.selector ?? null;
    const fs = sel(frame);
    const edge = fs ? nodes.filter((n) => n.pageId === frame.pageId && n.id !== frame.id && !inside.has(n.id) && !n.state && sel(n)?.startsWith(`${fs} > `)) : [];
    const target = new Map<string, PlaceBox>();
    /* A turned part's box on the screen is the box round its turn, not its own: it goes with what holds it. */
    const turned = (n: PlaceNode) => !!(n as PlaceNode & { art?: { transform?: string } | null }).art?.transform;
    for (const n of [...inner.filter((n) => shown.has(n.id)), ...edge]) {
      const b = hookOf(n) && !turned(n) ? screen.boxes?.[hookOf(n)!] : undefined;
      if (!b) continue;
      const w = Math.min(Math.round(k * b[2]), frame.w);
      target.set(n.id, { x: Math.min(Math.max(Math.round(frame.x + k * (b[0] - fb[0])), frame.x), frame.x + frame.w - w), y: Math.max(Math.round(frame.y + k * (b[1] - fb[1])), frame.y), w, h: Math.round(k * b[3]) });
    }
    /* A part with no hook of its own goes with the smallest hooked part that holds it. */
    const hooked = [...inner, ...edge].filter((n) => target.has(n.id)).sort((a, b) => a.w * a.h - b.w * b.h);
    for (const n of [...inner, ...edge]) {
      if (target.has(n.id) || (hookOf(n) && !turned(n)) || (inside.has(n.id) && !shown.has(n.id))) continue;
      const cx = n.x + n.w / 2, cy = n.y + n.h / 2;
      const by = hooked.find((h) => cx >= h.x && cx <= h.x + h.w && cy >= h.y && cy <= h.y + h.h);
      if (!by) continue;
      const to = target.get(by.id)!;
      target.set(n.id, { x: n.x + (to.x - by.x), y: n.y + (to.y - by.y), w: n.w, h: n.h });
    }
    for (const [id, b] of target) {
      const n = nodes.find((x) => x.id === id)!;
      if (b.x !== n.x || b.y !== n.y || b.w !== n.w || b.h !== n.h) places.set(id, b);
    }
    const h = Math.round(k * fb[3]);
    if (h !== frame.h) places.set(frame.id, { x: frame.x, y: frame.y, w: frame.w, h });
    return places;
  }
  /* The part itself not drawn by the screen: lined up with the page as a whole. */
  const draw = (n: PlaceNode) => n.id === frame.id || (inside.has(n.id) ? shown.has(n.id) : !n.state);
  const all = screenPlaces(nodes.filter((n) => n.pageId === frame.pageId), [screenKey(screen.name)], [screen], () => frame.pageId, draw);
  const f = all.get(frame.id);
  const dx = f ? frame.x - f.x : 0, dy = f ? frame.y - f.y : 0;
  let foot = frame.y + frame.h;
  for (const [id, b] of all) {
    if (!inside.has(id) || !shown.has(id)) continue;
    const w = Math.min(b.w, frame.w);
    const at = { x: Math.min(Math.max(b.x + dx, frame.x), frame.x + frame.w - w), y: Math.max(b.y + dy, frame.y), w, h: b.h };
    places.set(id, at);
    foot = Math.max(foot, at.y + at.h);
  }
  /*
   * Taller in this state, as the page draws it (the balance panel with its
   * play-money note is 195px longer): the part grows to hold it rather than
   * its lines being pushed up over each other. Its own margin under the
   * last line is kept.
   */
  if (foot > frame.y + frame.h) {
    const opens = partsInside(nodes, frame).filter((n) => !n.state);
    const last = opens.length ? Math.max(...opens.map((n) => n.y + n.h)) : frame.y + frame.h;
    const pad = Math.min(40, Math.max(0, frame.y + frame.h - last));
    places.set(frame.id, { x: frame.x, y: frame.y, w: frame.w, h: Math.round(foot + pad - frame.y) });
  }
  return places;
}

/**
 * A FACE THE PAGE ADDS, IN THE PART'S FLOW. The balance panel's play-money
 * note was read where the page draws it once shown: in its column, between
 * the lines it comes between. So it stays there, and everything in the part
 * from there down moves down by its height and the gap the column keeps;
 * what holds it grows by as much, the part too. Nothing is borrowed from a
 * screen that also changes other things.
 */
export function facePlaces(nodes: readonly PlaceNode[], frame: PlaceNode, face: readonly string[], shown: ReadonlySet<string>): Map<string, PlaceBox> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const own = face.map((id) => byId.get(id)).filter((n): n is PlaceNode => !!n);
  const places = new Map<string, PlaceBox>();
  if (!own.length) return places;
  const top = Math.min(...own.map((n) => n.y)), foot = Math.max(...own.map((n) => n.y + n.h));
  const faceIds = new Set(face);
  const rest = partsInside(nodes, frame).filter((n) => shown.has(n.id) && !faceIds.has(n.id));
  /* The column's own gap: the commonest space between one line and the next below it. */
  const lines = rest.filter((n) => n.w >= frame.w * 0.5 && n.h < frame.h * 0.5).sort((a, b) => a.y - b.y);
  const gaps = lines.slice(1).map((n, i) => n.y - (lines[i]!.y + lines[i]!.h)).filter((g) => g > 0 && g < 48);
  const gap = gaps.length ? median(gaps) : 12;
  const by = Math.round(foot - top + gap);
  for (const n of rest) {
    if (n.y >= top - 1) places.set(n.id, { x: n.x, y: n.y + by, w: n.w, h: n.h });
    else if (n.y + n.h > top) places.set(n.id, { x: n.x, y: n.y, w: n.w, h: n.h + by });
  }
  places.set(frame.id, { x: frame.x, y: frame.y, w: frame.w, h: frame.h + by });
  return places;
}

interface FrameRead { byFrame: Map<string, { frame: string; steps: { key: string; hook: string | null; parts: string[] }[] }>; inFrame: Map<string, string>; stepOf: Map<string, string> }

/**
 * THE PARTS A PICKED STEP DECIDES, AND WHERE IT DRAWS THEM. For each part
 * stepped on the board (`step:<frame>=<key>`), only the parts inside it:
 *
 *   · a screen kept to the part: what that screen draws inside it, where it
 *     draws it;
 *   · a face of a part that shows one face at a time (`data-state`, the TV
 *     box): that face alone;
 *   · a face the page adds to what the part opens with (the balance panel's
 *     play-money note): what it opens with and that face, in the part's
 *     flow (`facePlaces`).
 *
 * Whatever is not in the map is the page's to decide (`boardShows`). A part
 * taller in its step than on the board is in `places` itself, grown.
 */
export function steppedParts(nodes: readonly PlaceNode[], on: readonly string[], screens: readonly ScreenRead[] | null | undefined, fileOf: (pageId: string) => string | null, frames: FrameRead): { decide: Map<string, boolean>; places: Map<string, PlaceBox>; within: Map<string, string>; looks: Map<string, StepLook> } {
  const decide = new Map<string, boolean>();
  /* Each decided part, to the part stepped that decides it. */
  const within = new Map<string, string>();
  const places = new Map<string, PlaceBox>();
  const looks = new Map<string, StepLook>();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const k of on) {
    const s = readStepKey(k);
    const f = s ? byId.get(s.frame) : undefined;
    const fr = f ? frames.byFrame.get(f.id) : undefined;
    if (!s || !f || !fr) continue;
    const file = fileOf(f.pageId);
    const mine = (x: ScreenRead) => !file || !x.page || x.page === file;
    if (s.step.startsWith("screen:")) {
      const screen = (screens ?? []).find((x) => screenKey(x.name) === s.step && mine(x));
      if (!screen) continue;
      const shows = new Set(screen.shows);
      const inner = partsInside(nodes, f);
      const shown = new Set(inner.filter((n) => screenDraws(shows, n)).map((n) => n.id));
      for (const n of inner) { decide.set(n.id, shown.has(n.id)); within.set(n.id, f.id); }
      for (const [id, b] of partPlaces(nodes, f, screen, shown)) places.set(id, b);
      /* Its words and its drawing as this screen has them ("You lost.", FINAL, the match's chart), not the page's as it opens. */
      for (const n of inner) {
        if (!shown.has(n.id)) continue;
        const look = stepLook(n, screen);
        if (look) looks.set(n.id, look);
      }
      continue;
    }
    const step = fr.steps.find((x) => x.key === s.step);
    if (!step) continue;
    const adds = s.step !== "open" && f.hooks?.["data-state"] === undefined && fr.steps.some((x) => x.key === "open");
    const shown = new Set<string>();
    for (const st of fr.steps) for (const id of st.parts) {
      if (frames.inFrame.get(id) !== f.id) continue;
      /* What it opens with is what no state hides: a hidden block inside that face is not shown with it. */
      const v = st.key === s.step || (adds && st.key === "open" && !byId.get(id)?.state);
      decide.set(id, v);
      within.set(id, f.id);
      if (v) shown.add(id);
    }
    if (adds) for (const [id, b] of facePlaces(nodes, f, step.parts.filter((id) => frames.inFrame.get(id) === f.id), shown)) places.set(id, b);
  }
  /*
   * A part taller or shorter in its step moves what is under it in its
   * column by as much, and what holds it grows with it, as the page's flow
   * does: it never covers the lines below it (J, 2026-10-05).
   */
  const stepped = new Set(within.values());
  for (const [id, b] of [...places]) {
    const f = byId.get(id);
    if (!f || !stepped.has(id) || b.h === f.h) continue;
    const by = b.h - f.h, foot = f.y + f.h;
    for (const n of nodes) {
      if (n.pageId !== f.pageId || n.id === f.id || within.has(n.id) || n.x >= f.x + f.w || n.x + n.w <= f.x) continue;
      /* An overlay pinned to the window (the tour) is not in the page's flow. */
      if ((n as PlaceNode & { from?: { position?: string } | null }).from?.position === "fixed") continue;
      const at = places.get(n.id) ?? { x: n.x, y: n.y, w: n.w, h: n.h };
      if (n.y >= foot - 1) places.set(n.id, { ...at, y: at.y + by });
      else if (n.y <= f.y && n.y + n.h >= foot - 1 && !(n.x === f.x && n.y === f.y && n.w === f.w && n.h === f.h)) places.set(n.id, { ...at, h: at.h + by });
    }
  }
  return { decide, places, within, looks };
}

/** What a part shows in a step instead of what it opens with: its words, its picture. */
export interface StepLook { content?: unknown; picture?: unknown; font?: { px: number } & Record<string, unknown> }
type Run = { text?: string; hooks?: Record<string, string> | null } & Record<string, unknown>;
/** A part's words and picture as a screen has them, where they differ from the page as it opens. */
export function stepLook(n: PlaceNode & { content?: unknown }, screen: ScreenRead): StepLook | null {
  const texts = screen.texts ?? {};
  const hook = n.hooks?.["data-hook"];
  const out: StepLook = {};
  if (typeof n.content === "string") {
    const t = hook ? texts[hook] : undefined;
    if (t !== undefined && t !== n.content.replace(/\s+/g, " ").trim()) out.content = t;
  } else if (Array.isArray(n.content)) {
    let changed = false;
    const runs = (n.content as Run[]).map((r) => {
      const h = r && typeof r === "object" ? r.hooks?.["data-hook"] : undefined;
      const t = h ? texts[h] : undefined;
      if (t === undefined || t === (r.text ?? "").replace(/\s+/g, " ").trim()) return r;
      changed = true;
      return { ...r, text: t };
    });
    if (changed) out.content = runs;
  }
  /* A part the page left empty as it opens came in with no type size: its words are set at the screen's. */
  const px = hook ? screen.sizes?.[hook] : undefined;
  if (out.content !== undefined && !(n as { font?: unknown }).font && px) out.font = { px };
  const pic = hook ? screen.stills?.[hook] : undefined;
  if (pic) out.picture = pic;
  return out.content !== undefined || out.picture !== undefined ? out : null;
}
