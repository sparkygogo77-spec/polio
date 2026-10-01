/**
 * A PAGE ON A TABLET AND ON A PHONE.
 *
 * The owner's words: as sensible as possible. The Builder drew the desktop
 * layout at every width and cut off what did not fit: on a phone the title,
 * the BUY button, the copy-address bar and the picture beside them ran off
 * the right edge and the nav was gone. This works out, for one page, what a
 * tablet (834 wide) and a phone (390 wide) show, in three layers:
 *
 *   1. THE SITE'S OWN. When a capture recorded the site at that width (each
 *      part's `widths.tablet` / `widths.phone` box, docs/RESPONSIVE.md), the
 *      page is drawn exactly as the site drew itself there.
 *   2. A SENSIBLE ONE, made here, when it did not. Reading order is the
 *      desktop's, top to bottom, left to right. A block that stays legible
 *      scaled down to the width is kept whole and scaled; one that would
 *      shrink its words too far is opened, and what it holds is stacked
 *      inside it. Cards that sit side by side go two across on a tablet and
 *      one on a phone. A nav (a row of three or more links in the top band,
 *      or a narrow column of them down a side) becomes a Menu button that
 *      opens a panel. Buttons go full width and at least 44px tall; a row of
 *      small chips stays a row that wraps. Big titles scale to fit; pictures
 *      fit the width and keep their shape. A part hanging mostly off the
 *      page (a planet at the side, a float) is a decoration of the wide
 *      layout and is left out.
 *   3. THE PERSON'S. Each part's `small.tablet` / `small.phone` rule says
 *      show or hide, full width, a place in the order, and a size. A rule at
 *      one width changes nothing at the other, or on the desktop.
 *
 * Pure: no React, no store, no catalogue. What a part IS (a control, a
 * picture, a heading) is asked of the caller, so `tests/small-plan.mjs` can
 * hold the arithmetic on a captured page without a browser, and the board,
 * Preview, the companion window and the export all draw the same plan
 * (`smallCss.ts`).
 */

export type SmallDevice = "tablet" | "phone";

/** The widths the plan is made for. The renderer is fluid around them. */
export const SMALL_WIDTH: Record<SmallDevice, number> = { tablet: 834, phone: 390 };
/** Below this a window is a phone, below the next a tablet (the export's media queries). */
export const PHONE_MAX = 599;
export const TABLET_MAX = 1023;

/** What a person asked of one part at one width. Every field is optional; none means "as worked out". */
export interface DeviceRule {
  show?: "hide" | "show";
  /** As wide as the page. */
  full?: boolean;
  /** Places moved among the parts beside it: -1 is one earlier, 2 is two later. None keeps its desktop place. */
  order?: number;
  /** A multiplier on its size, 0.5 to 1.5. */
  size?: number;
}

/** Where the site itself put a part at a width, from a capture. */
export interface SizedBox { x: number; y: number; w: number; h: number; hidden?: boolean }

export interface SmallNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** The person's rules per width. */
  small?: Partial<Record<SmallDevice, DeviceRule>> | null;
  /** The site's own boxes per width, from a capture. */
  widths?: Partial<Record<SmallDevice, SizedBox>> | null;
  from?: { selector?: string; position?: string } | null;
}

/** What the plan needs to know about a part, asked of the caller. */
export interface SmallRules<N extends SmallNode> {
  /** Something a visitor presses: a button, a link. */
  isControl: (n: N) => boolean;
  /** A control that goes to a page or an address: a nav entry. */
  isLink: (n: N) => boolean;
  /** Draws words. */
  hasWords: (n: N) => boolean;
  /** A heading: big words that should scale to fit rather than wrap at full size. */
  isHeading: (n: N) => boolean;
  /** Does `outer` hold `inner`? (`owner.ts#holds`: the capture's path, else the box.) */
  holds: (outer: N, inner: N) => boolean;
  /** A block that moves as one on the desktop (what it holds is drawn inside it there): kept whole at every width. */
  keepWhole?: (n: N) => boolean;
}

export type SmallItem<N extends SmallNode = SmallNode> =
  /** One part, in the flow: words wrap at the width; a control is at least 44px. */
  | { kind: "part"; node: N; full: boolean; w: number; minH: number; fit: number; control: boolean; bleed?: boolean }
  /** A block kept whole and scaled to the width: drawn at its desktop size, every part where it was. */
  | { kind: "keep"; node: N; members: { node: N; x: number; y: number; w: number; h: number }[]; w: number; h: number; max: number; tap?: boolean; bleed?: boolean }
  /** A block opened: its own box behind, what it holds stacked inside. */
  | { kind: "open"; node: N; pad: number; children: SmallItem<N>[]; bleed?: boolean }
  /** Small things that stay side by side and wrap (chips, icons). */
  | { kind: "row"; children: SmallItem<N>[] }
  /** Cards two across (a tablet). */
  | { kind: "grid"; cols: number; children: SmallItem<N>[] }
  /** The nav, behind a Menu button. */
  | { kind: "menu"; links: SmallItem<N>[]; holders: string[] };

export interface SmallPlan<N extends SmallNode = SmallNode> {
  device: SmallDevice;
  width: number;
  /** "site": the capture's own layout at this width; "made": worked out here. */
  mode: "site" | "made";
  items: SmallItem<N>[];
  /** For "site": every shown part's box at this width. */
  boxes: { node: N; x: number; y: number; w: number; h: number }[];
  /** The page's height at this width, for "site" (the made plan flows and is measured). */
  height: number;
  /** Left out at this width, by rule or as a decoration. */
  hidden: string[];
}

/* ------------------------------------------------------------------ the numbers */

/** Kept whole when its words would stay at least this big. */
const KEEP_TEXT = 0.72;
/** A part this far off the page's sides is a decoration of the wide layout. */
const OFF_PAGE = 0.5;
/** The gap between items and the room either side of the page. */
export const SMALL_GAP = 12;
export const TAP = 44;
/** Chips: small controls this narrow, three or more in a row, stay a row. */
const CHIP_W = 140;
/** As wide as the page, on the desktop: nine tenths of it (`reshape.ts#FULL_BLEED`). */
const FULL_BLEED = 0.9;

const area = (n: SmallNode) => Math.max(1, n.w) * Math.max(1, n.h);

/** Parts in one horizontal band are a row; rows top to bottom, each left to right. The desktop's reading order. */
export function rowsOf<N extends SmallNode>(nodes: readonly N[]): N[][] {
  const sorted = [...nodes].sort((a, b) => a.y - b.y || a.x - b.x);
  const rows: N[][] = [];
  for (const n of sorted) {
    const row = rows[rows.length - 1];
    if (row) {
      const bottom = Math.max(...row.map((r) => r.y + r.h));
      const top = Math.min(...row.map((r) => r.y));
      const overlap = Math.min(bottom, n.y + n.h) - Math.max(top, n.y);
      if (overlap > Math.min(n.h, bottom - top) * 0.34) { row.push(n); continue; }
    }
    rows.push([n]);
  }
  return rows.map((r) => [...r].sort((a, b) => a.x - b.x));
}

/** How much of a part lies outside the page's sides, as a share of its width. */
export function offPage(n: SmallNode, W: number): number {
  const inside = Math.max(0, Math.min(W, n.x + n.w) - Math.max(0, n.x));
  return 1 - inside / Math.max(1, n.w);
}

/**
 * The tree of what holds what: each part's nearest holder. The page is drawn
 * in this shape at every width (`LiveSite`), each holder with what it holds
 * in a box of its own, so one element per part can be laid out per width.
 */
export function smallTree<N extends SmallNode>(nodes: readonly N[], rules: Pick<SmallRules<N>, "holds">): { kids: Map<string, N[]>; roots: N[] } {
  return treeOf(nodes, rules.holds);
}

function treeOf<N extends SmallNode>(nodes: readonly N[], holds: (a: N, b: N) => boolean): { kids: Map<string, N[]>; roots: N[] } {
  const parent = new Map<string, N>();
  for (const n of nodes) {
    let best: N | null = null;
    for (const c of nodes) {
      if (c === n || !holds(c, n)) continue;
      if (!best || area(c) < area(best) || (area(c) === area(best) && (c.from?.selector?.length ?? 0) > (best.from?.selector?.length ?? 0))) best = c;
    }
    if (best) parent.set(n.id, best);
  }
  /* A cycle (two boxes that each claim the other) is broken at the larger. */
  for (const n of nodes) {
    const seen = new Set<string>([n.id]);
    let p = parent.get(n.id);
    while (p) { if (seen.has(p.id)) { parent.delete(n.id); break; } seen.add(p.id); p = parent.get(p.id); }
  }
  const kids = new Map<string, N[]>();
  const roots: N[] = [];
  for (const n of nodes) {
    const p = parent.get(n.id);
    if (p) kids.set(p.id, [...(kids.get(p.id) ?? []), n]);
    else roots.push(n);
  }
  return { kids, roots };
}

/** Every part a block holds, at any depth. */
function under<N extends SmallNode>(n: N, kids: Map<string, N[]>): N[] {
  const out: N[] = [];
  const walk = (m: N) => { for (const k of kids.get(m.id) ?? []) { out.push(k); walk(k); } };
  walk(n);
  return out;
}

/* ------------------------------------------------------------------ the plan */

export function smallPlan<N extends SmallNode>(all: readonly N[], device: SmallDevice, W: number, rules: SmallRules<N>): SmallPlan<N> {
  const width = SMALL_WIDTH[device];
  const ruleOf = (n: N): DeviceRule => n.small?.[device] ?? {};
  const hidden: string[] = [];

  /* 1. The site's own layout at this width, when the capture has it for most of the page. */
  const sized = all.filter((n) => n.widths?.[device]);
  if (all.length && sized.length >= all.length * 0.5) {
    const boxes: SmallPlan<N>["boxes"] = [];
    for (const n of all) {
      const b = n.widths?.[device];
      const r = ruleOf(n);
      if (!b || (b.hidden && r.show !== "show") || r.show === "hide") { hidden.push(n.id); continue; }
      const k = Math.max(0.5, Math.min(1.5, r.size ?? 1));
      const w = r.full ? width : Math.min(width, Math.round(b.w * k));
      boxes.push({ node: n, x: r.full ? 0 : Math.max(0, Math.min(width - w, b.x)), y: b.y, w, h: Math.round(b.h * (w / Math.max(1, b.w))) });
    }
    const height = Math.max(320, ...boxes.map((b) => b.y + b.h));
    return { device, width, mode: "site", items: [], boxes, height, hidden };
  }

  /* 2. Made here. Decorations and hidden parts go first, with everything they hold. */
  const { kids, roots: allRoots } = treeOf(all, rules.holds);
  const gone = new Set<string>();
  const drop = (n: N) => { gone.add(n.id); hidden.push(n.id); for (const k of under(n, kids)) { gone.add(k.id); } };
  for (const n of all) {
    if (gone.has(n.id)) continue;
    const r = ruleOf(n);
    if (r.show === "hide") drop(n);
    else if (r.show !== "show" && offPage(n, W) >= OFF_PAGE) drop(n);
  }
  const alive = (ns: readonly N[]) => ns.filter((n) => !gone.has(n.id));

  /* The nav: three or more links in the page's top band in one row, or down a narrow side column. Their whole group becomes the menu. */
  const pageH = Math.max(...all.map((n) => n.y + n.h), 1);
  const links = alive(all).filter((n) => rules.isControl(n) && rules.isLink(n));
  const navIds = new Set<string>();
  const topBand = links.filter((n) => n.y < Math.min(200, pageH * 0.15));
  for (const row of rowsOf(topBand)) if (row.length >= 3) for (const n of row) navIds.add(n.id);
  const side = links.filter((n) => n.x + n.w <= W * 0.3 || n.x >= W * 0.7);
  const cols = new Map<number, N[]>();
  for (const n of side) { const k = Math.round(n.x / 40); cols.set(k, [...(cols.get(k) ?? []), n]); }
  for (const c of cols.values()) if (c.length >= 3) for (const n of c) navIds.add(n.id);
  /* What holds the nav links and nothing else (the list round them, a link's own words) goes with them. */
  const inNav = (n: N): boolean => navIds.has(n.id) || (under(n, kids).length > 0 && under(n, kids).every((k) => navIds.has(k.id) || inNavLeaf(k)));
  const inNavLeaf = (k: N): boolean => [...navIds].some((id) => { const l = all.find((x) => x.id === id); return !!l && rules.holds(l, k); });
  const menu: SmallItem<N>[] = [];
  /* What held only nav links (the list round them) went into the menu with them. */
  const holders: string[] = [];

  const A = width - SMALL_GAP * 2;
  /* Moved by whole places: -1 lands just before the one that was before it. */
  const orderOf = (n: N, i: number) => { const o = ruleOf(n).order ?? 0; return i + (o ? o + Math.sign(o) * 0.5 : 0); };

  const lay = (siblings: readonly N[], room: number): SmallItem<N>[] => {
    const rows = rowsOf(alive(siblings));
    const out: { item: SmallItem<N>; key: number }[] = [];
    let i = 0;
    for (const row of rows) {
      /* Nav links leave the flow for the menu. */
      const rest: N[] = [];
      for (const n of row) {
        if (inNav(n)) { menu.push(...navItems(n, room)); if (!navIds.has(n.id)) holders.push(n.id); continue; }
        rest.push(n);
      }
      if (!rest.length) continue;
      /* A row that fits as it is, at its own size, stays a row (a header's logo, links and icons on a tablet). */
      const across = rest.reduce((t, n) => t + n.w, 0) + SMALL_GAP * (rest.length - 1);
      if (rest.length >= 2 && across <= room && rest.every((n) => n.w <= room * 0.6)) {
        out.push({ item: { kind: "row", children: rest.map((n) => (kids.get(n.id)?.length ? one(n, n.w) : chip(n))) }, key: orderOf(rest[0]!, i) });
        i += rest.length;
        continue;
      }
      /* Cards are alike: within a quarter of each other's width and two fifths of each other's height, and no smaller than a card. */
      const alike = (ns: N[]) => {
        const ws = ns.map((n) => n.w), hs = ns.map((n) => n.h);
        return Math.min(...ws) >= 160 && Math.min(...ws) >= Math.max(...ws) * 0.75 && Math.min(...hs) >= Math.max(...hs) * 0.6;
      };
      if (device === "tablet" && rest.length >= 2 && rest.every((n) => n.w <= W * 0.55) && alike(rest)) {
        const colW = Math.floor((room - SMALL_GAP) / 2);
        out.push({ item: { kind: "grid", cols: 2, children: rest.map((n) => one(n, colW)) }, key: orderOf(rest[0]!, i) });
        i += rest.length;
        continue;
      }
      /* Chips: two or more small things side by side (tabs, icons, tags, a logo beside its links) stay a row that wraps. */
      if (rest.length >= 2 && rest.every((n) => n.w <= CHIP_W || n.w <= room * 0.5)) {
        out.push({ item: { kind: "row", children: rest.map((n) => chip(n)) }, key: orderOf(rest[0]!, i) });
        i += rest.length;
        continue;
      }
      /* Cards: two across on a tablet, where each is narrow enough. */
      for (const n of rest) { out.push({ item: one(n, room), key: orderOf(n, i) }); i++; }
    }
    return out.sort((a, b) => a.key - b.key).map((o) => o.item);
  };

  /* The parts of a nav group, as menu entries: each link once, full width. */
  const navItems = (n: N, room: number): SmallItem<N>[] => {
    const own = navIds.has(n.id) ? [n] : [];
    const inside = under(n, kids).filter((k) => navIds.has(k.id));
    return [...own, ...inside].sort((a, b) => a.y - b.y || a.x - b.x).map((l) => entry(l, room));
  };

  /* A menu entry or a chip: the link with what it holds (its words, its icon), whole, at least a tap tall. */
  const whole = (l: N, room: number): SmallItem<N> => {
    const members = [l, ...under(l, kids)].filter((m) => !gone.has(m.id)).map((m) => ({ node: m, x: m.x - l.x, y: m.y - l.y, w: m.w, h: m.h }));
    return { kind: "keep", node: l, members, w: l.w, h: l.h, max: Math.round(Math.min(room, l.w)), tap: true };
  };
  const entry = (l: N, room: number): SmallItem<N> => (under(l, kids).length ? whole(l, room) : part(l, room, true));
  const chip = (n: N): SmallItem<N> => (under(n, kids).length ? whole(n, A) : { ...(part(n, A, false) as Extract<SmallItem<N>, { kind: "part" }>), full: false, w: Math.min(A, n.w) });

  /* One part, or one block, at a width. */
  const one = (n: N, room: number): SmallItem<N> => {
    const r = ruleOf(n);
    const held = alive(kids.get(n.id) ?? []);
    const k = Math.max(0.5, Math.min(1.5, r.size ?? 1));
    if (!held.length) return part(n, room, r.full ?? false);
    /* A control is pressed as one: a button with its words, a link with its icon. */
    if (rules.isControl(n)) return whole(n, room);
    /* A block that moves as one on the desktop carries what it holds inside it there: it is kept whole. */
    if (rules.keepWhole?.(n) && !under(n, kids).some((m) => navIds.has(m.id))) {
      const members = [n, ...under(n, kids)].filter((m) => !gone.has(m.id)).map((m) => ({ node: m, x: m.x - n.x, y: m.y - n.y, w: m.w, h: m.h }));
      return { kind: "keep", node: n, members, w: n.w, h: n.h, max: Math.round(Math.min(room, n.w * k)) };
    }
    /*
     * A part with words of its own is read as one: its words wrap at the
     * width. What it holds that a visitor presses (an inline link) follows
     * it, so nothing to press is lost; anything else over its words is part
     * of them and is left out.
     */
    if (rules.hasWords(n)) {
      const pressed: SmallItem<N>[] = [];
      for (const k of under(n, kids)) {
        if (gone.has(k.id)) continue;
        if (rules.isControl(k)) pressed.push(entry(k, room));
        gone.add(k.id);
        if (!rules.isControl(k)) hidden.push(k.id);
      }
      const words = part(n, room, r.full ?? false);
      return pressed.length ? { kind: "row", children: [words, ...pressed] } : words;
    }
    const inside = under(n, kids);
    const words = [n, ...inside].some((m) => !gone.has(m.id) && rules.hasWords(m));
    const presses = [n, ...inside].some((m) => !gone.has(m.id) && rules.isControl(m));
    const navHere = inside.some((m) => navIds.has(m.id));
    const target = r.full ? room : Math.min(room, n.w * k);
    const s = target / Math.max(1, n.w);
    /* Kept whole: nothing to read or press, or its words stay legible and everything in it to press is still a tap tall. */
    const tapOk = [n, ...inside].every((m) => gone.has(m.id) || !rules.isControl(m) || m.h * Math.min(1, s) >= TAP);
    const keep = !navHere && (!words && !presses ? true : s >= KEEP_TEXT && (!presses || tapOk));
    if (keep) {
      const members = [n, ...inside].filter((m) => !gone.has(m.id)).map((m) => ({ node: m, x: m.x - n.x, y: m.y - n.y, w: m.w, h: m.h }));
      /* Drawn no wider than the room, and never blown up past its own size unless asked. */
      return { kind: "keep", node: n, members, w: n.w, h: n.h, max: Math.round(Math.min(room, n.w * k)) };
    }
    /* Opened: its own inset round what it holds, as it had, up to the page's gap; deep wrappers cost no width. */
    const inset = Math.max(0, Math.min(...held.map((k) => Math.min(k.x - n.x, n.x + n.w - (k.x + k.w)))));
    const pad = Math.min(SMALL_GAP, Math.round(inset));
    return { kind: "open", node: n, pad, children: lay(held, room - pad * 2) };
  };

  /* One part in the flow. */
  const part = (n: N, room: number, forceFull: boolean): SmallItem<N> => {
    const r = ruleOf(n);
    const control = rules.isControl(n);
    const k = Math.max(0.5, Math.min(1.5, r.size ?? 1));
    const words = rules.hasWords(n);
    /* Words, buttons and anything wider than half the room take the room; a picture fits it and is never blown up past its own size. */
    const full = forceFull || !!r.full || (control && n.w > CHIP_W) || ((words || control) && n.w * k >= room * 0.5);
    const w = full ? room : Math.round(Math.min(room, n.w * k));
    /* A heading scales to fit as a whole, never smaller than half: its words then wrap at that size. */
    const fit = rules.isHeading(n) ? Math.max(0.5, Math.min(1, (room / Math.max(1, n.w)) * k)) : 1;
    /* What has no words keeps its shape; words take what they need from a floor. */
    const minH = control ? Math.max(TAP, Math.round(n.h * k)) : words ? Math.min(Math.round(n.h * k), 240) : Math.round(n.h * (w / Math.max(1, n.w)));
    return { kind: "part", node: n, full, w, minH, fit, control };
  };

  /*
   * FULL BLEED. A part as wide as the page on the desktop (nine tenths of it,
   * the reshape rule) runs edge to edge here too: a header bar, a banner, a
   * band of colour. Only at the top level; inside a block it fills the block.
   */
  const items = lay(allRoots, A).map((it) => ((it.kind === "part" || it.kind === "keep" || it.kind === "open") && it.node.w >= W * FULL_BLEED ? { ...it, bleed: true } : it)) as SmallItem<N>[];
  if (menu.length) items.unshift({ kind: "menu", links: menu, holders });
  return { device, width, mode: "made", items, boxes: [], height: 0, hidden };
}

/** Every part a plan draws, in the order it draws them: what a test compares with the desktop's reading order. */
export function planOrder<N extends SmallNode>(plan: SmallPlan<N>): string[] {
  if (plan.mode === "site") return [...plan.boxes].sort((a, b) => a.y - b.y || a.x - b.x).map((b) => b.node.id);
  const out: string[] = [];
  const walk = (it: SmallItem<N>) => {
    if (it.kind === "part") out.push(it.node.id);
    else if (it.kind === "keep") out.push(...it.members.map((m) => m.node.id));
    else if (it.kind === "open") { out.push(it.node.id); it.children.forEach(walk); }
    else if (it.kind === "menu") { out.push(...it.holders); it.links.forEach(walk); }
    else it.children.forEach(walk);
  };
  plan.items.forEach(walk);
  return out;
}
