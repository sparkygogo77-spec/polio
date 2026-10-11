/**
 * THE SITE'S OWN KINDS OF SURFACE, for the theme preview at the head of
 * Colours (`SiteColours.tsx#ThemePreview`).
 *
 * J (2026-10-09), on PonsStars: the first preview drew one made-up card
 * twice, put the lime words on orange and yellow, and showed yellow cards
 * where only the buttons are yellow. "It should generate a copy of the
 * types of panels from the website ... the black tabs around the green
 * font should be imported, as that's where the green font exists only."
 *
 * So the preview is read off the parts, not made up:
 *
 *   · A KIND is a fill colour (close shades one kind) worn by three parts or
 *     more, its plain ink too: PonsStars' cream cards and black tabs are
 *     near-white and near-black, never theme roles, and are its surfaces.
 *   · Each part's words belong to the surface they stand on: the part
 *     itself when it has a fill, else the smallest filled part on the same
 *     page (and in the same hidden state) holding it. Words with nothing
 *     under them stand on the page.
 *   · A kind says what it really carries: its most-worn words colour and
 *     face, its outline (colour and width), its shadow and its corners,
 *     whether it is a button, and which kind its buttons stand in.
 *   · A kind carries every part's id, its shades and gradient stops, the
 *     words standing on it and their glow, so one edit in the preview's
 *     editor reaches every copy of it across the site (J, 2026-10-09).
 *   · A kind is named by what it is for, never by its colour.
 *   · A part drawn again on every page (a rail, a header) is one part in
 *     every count and every name (`repeats.ts`; J, 2026-10-11).
 *
 * Pure: no store, no DOM. `tests/theme-kinds.mjs`.
 */
import { colourKey, coloursIn, faceOf, glowsIn, oklabDistance, parseColor, spotsOf, type Palette, type Worn } from "./look/index.ts";
import { isButton, type Part } from "./siteRoles.ts";
import { componentsOf, type CompNode } from "./components.ts";
import { repeatsAcrossPages, thingsIn } from "./repeats.ts";

/** Closer than the palette merges: a cream card and a grey field are two kinds of surface even where they are one swatch. */
export const KIND_SHADES = 0.025;
/** Surfaces whose middle part is smaller than this both ways are decoration. */
export const SPECK = 48;
/** A strip this tall or less is a tab or label bar. */
export const TAB_HEIGHT = 40;
/**
 * A strip this thin or less (and four times as long) is trim: the hazard lip
 * under a main button, a stripe down a row's edge. Never a button of its own,
 * never mixed with the surfaces of its colour, drawn as a small dot (J,
 * 2026-10-11, on the PonsStars redesign: the striped lip under "Start
 * recording" was a kind of button, "Buttons 2, 24").
 */
export const TRIM = 8;
/** How far a lone panel's shade may be from a surface's and still be one of them. */
export const PANEL_SHADES = 0.06;
/** A surface covering this share of the site or more is kept in the preview however many kinds there are. */
export const BIG_SURFACE = 0.03;
/** A part both ways bigger than this is a panel: a kind most of whose area is panels is drawn as a box, never a tab. */
export const PANEL = 2 * TAB_HEIGHT;
/** A gradient-painted piece this big or more (its longer side, px) is a kind of its own, however few parts wear it. */
export const PIECE = 192;
/**
 * A surface whose parts together cover less than this share of the site's
 * pages is an accent: a legend's dots, a table's thin progress bars and the
 * stripes down its rows' edges. It is drawn as a small dot in the preview,
 * not a box as big as a panel (J, 2026-10-11, on sunkcoin: "Bars 2" is the
 * orange of the little dots in the legend, and should not be its own panel
 * as big as "Bars"). By area covered, not by how many parts wear it: 47
 * dots and bars are still a speck of the page.
 */
export const ACCENT_SHARE = 0.015;
/** Or its parts are this small (middle part's area, px²): a dot, a bar, a stripe, however many there are. */
export const ACCENT_PART = 48 * 48;

export interface SurfaceKind {
  /** The lead fill. */
  fill: string;
  /** What it is for, never its colour (J, 2026-10-09): "Main fill" for the most-worn surface, then "Panels", "Fields", "Buttons" and so on. */
  name: string;
  /** Parts wearing it as their own fill, a part repeated across pages counted once. */
  parts: number;
  /** How much of the site its parts cover together, px². */
  cover: number;
  /** A small accent colour (`ACCENT_SHARE`): drawn as a dot in the preview, not a box. */
  accent: boolean;
  /**
   * Its parts are loading bars (`components.ts`, kind "progress"): their
   * tracks, or the level bars inside them. Every colour of them is one
   * element, shown together as "Loading bars" (J, 2026-10-11). Null otherwise.
   */
  progress: "track" | "level" | null;
  /** Their ids: one edit recolours every one of them. */
  ids: string[];
  /** Every shade of the fill they wear (close shades are one kind). */
  shades: string[];
  /** The colours of its gradient, light first, when the kind is painted with one: one button, not one per stop. */
  stops: string[];
  /** Parts whose words stand on it (itself included). */
  wordsIds: string[];
  /** The glow on those words (soft coloured light behind the letters, not a hard drop shadow), the most-worn one. */
  glow: string | null;
  /** How far that glow spreads, in px. */
  glowSize: number;
  /** Half its words or more wear that glow: only then does the preview draw it, so it shows what the site shows. */
  glowShown: boolean;
  /** The face key the words are counted under (`faceOf`), for swapping. */
  faceKey: string | null;
  /** A few of its own words, so a button in the preview says what the site's buttons say. */
  sample: string | null;
  /** Its parts' middle width and height, in px. */
  w: number;
  h: number;
  /** How its parts lie (`shapeOf`): bars, rows of a table, a grid of cards; null for none in particular. */
  shape: KindShape | null;
  /** A short strip that is not a field or a button: a tab or a label bar, drawn over the panel's top edge as the site does (J, 2026-10-09). */
  tab: boolean;
  button: boolean;
  /** Most-worn words colour on it, and how many parts' words that is; null when no words stand on it. */
  words: string | null;
  wordsParts: number;
  /** The font its words are set in: a stack as the page wrote it, or a face's key. */
  face: string | null;
  outline: { colour: string; width: number } | null;
  shadow: string | null;
  /** The background as the parts paint it, a gradient included (a button's light and body); the flat fill when they paint none. */
  paint: string;
  radius: number;
  /** One big gradient-painted piece (a TV's body), named after itself rather than a role. */
  piece: boolean;
  /** For a button kind, the index of the kind most of its parts stand in (-1: the page). */
  inside: number;
}

export interface SiteKinds {
  page: { fill: string; words: string | null; face: string | null; faceKey: string | null; wordsIds: string[]; glow: string | null; glowSize: number; glowShown: boolean };
  kinds: SurfaceKind[];
}

/**
 * HOW A KIND'S PARTS LIE, read off their boxes (J, 2026-10-11, on sunkcoin):
 * the wallet table's rows came out "Panels 6", its orange loading bars
 * "Panels", and eight rule cards in three columns one more "Panels". A kind
 * is named by what its parts plainly are, whatever element they were:
 *
 *   · bars: thin strips, four times as long as thick or more, no thicker than
 *     BAR_HEIGHT, lying or standing (a loading bar, a meter's fill, the
 *     stripe down a row's edge);
 *   · dots: small and about as wide as tall, DOT_SIZE or less (a legend's
 *     dots, a status light);
 *   · rows: three or more wide strips the same width, one under another in one
 *     column (a table's rows, a list's lines);
 *   · grid: four or more parts the same size in two columns or more and two
 *     rows or more (cards in a grid).
 *
 * Half the kind's parts or more must lie that way. Pure: `tests/kind-shapes.mjs`.
 */
export type KindShape = "bars" | "dots" | "rows" | "grid";
/** A bar is this tall or less. */
export const BAR_HEIGHT = 16;
/** A dot is this wide and tall or less. */
export const DOT_SIZE = 24;
/** Parts within this share of each other's width and height are the same size. */
const SAME_SIZE = 0.1;
/** Edges within this many px are in line. */
const IN_LINE = 8;

interface Box { x?: number; y?: number; w?: number; h?: number; pageId?: string }
const sameSize = (a: Box, b: Box) => Math.abs((a.w ?? 0) - (b.w ?? 0)) <= SAME_SIZE * Math.max(a.w ?? 0, b.w ?? 0, 1) && Math.abs((a.h ?? 0) - (b.h ?? 0)) <= SAME_SIZE * Math.max(a.h ?? 0, b.h ?? 0, 1);
/** Distinct values, edges within IN_LINE of each other counted once. */
const lines = (vs: number[]) => vs.sort((a, b) => a - b).reduce<number[]>((out, v) => (out.length && v - out[out.length - 1]! <= IN_LINE ? out : [...out, v]), []).length;
/** The biggest set of parts the same size as each other, on one page. */
function biggestAlike<T extends Box>(ms: readonly T[]): T[] {
  let best: T[] = [];
  for (const m of ms) {
    const like = ms.filter((o) => (o.pageId ?? "") === (m.pageId ?? "") && sameSize(m, o));
    if (like.length > best.length) best = like;
  }
  return best;
}
/** One kind's shape, or null when its parts lie no way in particular. */
export function shapeOf(ms: readonly Box[]): KindShape | null {
  const n = ms.length;
  if (!n) return null;
  const thin = (p: Box) => Math.min(p.w ?? 0, p.h ?? 0), long = (p: Box) => Math.max(p.w ?? 0, p.h ?? 0);
  const bar = (p: Box) => thin(p) > 0 && thin(p) <= BAR_HEIGHT && long(p) >= 4 * thin(p);
  const dot = (p: Box) => thin(p) > 0 && long(p) <= DOT_SIZE && long(p) <= 2 * thin(p);
  if (ms.filter(bar).length * 2 >= n) return "bars";
  if (ms.filter(dot).length * 2 >= n) return "dots";
  const like = biggestAlike(ms);
  if (like.length * 2 < n) return null;
  const cols = lines(like.map((p) => p.x ?? 0)), rows = lines(like.map((p) => p.y ?? 0));
  const wide = like.every((p) => (p.w ?? 0) >= 3 * (p.h ?? 0));
  if (like.length >= 3 && cols === 1 && rows >= 3 && wide) return "rows";
  if (like.length >= 4 && cols >= 2 && rows >= 2) return "grid";
  return null;
}
const SHAPE_NAME: Record<KindShape, string> = { bars: "Bars", dots: "Dots", rows: "Rows", grid: "Grid" };

/**
 * A kind of button named by what its buttons say, when most say one thing
 * ("Copy buttons"), else "Buttons".
 */
function buttonsName(own: Map<string, number>, members: number): string {
  const t = top(own);
  if (t && t[1] >= 2 && t[1] * 2 >= members && t[0].length <= 14 && /[a-z]{2}/i.test(t[0])) {
    const w = t[0].toLowerCase();
    return `${w.charAt(0).toUpperCase()}${w.slice(1)} buttons`;
  }
  return "Buttons";
}

/** What a part is, in a word, by the shelf part it landed as. */
const WHAT: Record<string, string> = { box: "Panels", card: "Cards", field: "Fields", prose: "Labels", heading: "Headings", "cta-primary": "Buttons", picture: "Pictures" };
const wordsOf = (p: Node): string => {
  const c = (p as { content?: unknown }).content;
  const t = typeof c === "string" ? c : Array.isArray(c) ? c.map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : "")).join("") : "";
  return t.replace(/\s+/g, " ").trim();
};

/** A part's own name, readable: "chart-tv-body" is "Chart TV body". */
const pieceName = (p: Node): string | null => {
  const l = String((p as { label?: unknown }).label ?? "").trim();
  /* The capture's own "div · 8 inside" is what it is, not a name (`partNames.ts`). */
  if (!l || !/[a-z]/i.test(l) || /\u00b7|·|\binside\b/.test(l) || /^(div|span|section|article|main|aside|header|footer|nav|ul|ol|li|p|a|img|svg|figure)$/i.test(l)) return null;
  const w = l.replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim().split(" ").map((x) => (x.length === 2 ? x.toUpperCase() : x.toLowerCase()));
  return (w.join(" ").charAt(0).toUpperCase() + w.join(" ").slice(1)).slice(0, 28);
};

type Node = Part & { radius?: number | null; state?: { group?: string } | null; edge?: { width?: number; colour?: string; style?: string; shadow?: string } | null };

const area = (p: Node) => Math.max(0, p.w ?? 0) * Math.max(0, p.h ?? 0);
/** A thin strip, four times as long as it is thick or more (`TRIM`). */
const isTrim = (p: Node) => { const a = Math.min(p.w ?? 0, p.h ?? 0), b = Math.max(p.w ?? 0, p.h ?? 0); return a > 0 && a <= TRIM && b >= 4 * a; };
/** Painted in stripes: a repeating gradient, the hazard tape look. */
const STRIPES = /repeating-(linear|conic)-gradient\(/;
const holds = (o: Node, i: Node) => {
  const w = Math.max(0, Math.min((o.x ?? 0) + (o.w ?? 0), (i.x ?? 0) + (i.w ?? 0)) - Math.max(o.x ?? 0, i.x ?? 0));
  const h = Math.max(0, Math.min((o.y ?? 0) + (o.h ?? 0), (i.y ?? 0) + (i.h ?? 0)) - Math.max(o.y ?? 0, i.y ?? 0));
  return area(i) > 0 && (w * h) / area(i) >= 0.8;
};
const alpha = (v: string) => { const m = /rgba\([^)]*,\s*([\d.]+)\s*\)$/.exec(v.replace(/\s+/g, " ")); return m ? Number(m[1]) : 1; };
const top = <T,>(m: Map<T, number>): [T, number] | null => [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
const bump = <T,>(m: Map<T, number>, k: T, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

/** A part's glows: on its words, and on its runs of words. */
const glowsOf = (p: Node): { colour: string; blur: number }[] => {
  const c = (p as { content?: unknown }).content;
  const runs = Array.isArray(c) ? (c as { textShadow?: unknown }[]).map((r) => (r && typeof r.textShadow === "string" ? r.textShadow : null)) : [];
  return [(p as { art?: { textShadow?: string } | null }).art?.textShadow, ...runs].flatMap((sh) => glowsIn(sh));
};

/** The most-worn glow among some words: its colour, its widest blur (a glow is drawn in rings), and whether half the words wear it. */
const glowOf = (m: Map<string, number>, worn: Map<string, { colour: string; blur: number }>, words: number) => {
  const g = top(m);
  const w = g ? worn.get(g[0]) : undefined;
  /* As written, so its see-through survives a resize. */
  return { glow: w?.colour ?? g?.[0] ?? null, glowSize: w ? Math.round(w.blur) : 6, glowShown: !!g && g[1] * 2 >= words };
};

/** At most `cap` kinds (and two painted pieces), the most-worn first, buttons and surfaces both. */
export function siteKinds(nodes: readonly Worn[], palette: Partial<Palette>, background: ReadonlySet<string> = new Set(), cap = 10): SiteKinds {
  const parts = nodes as readonly Node[];
  /* The site's area: each page as far as its parts reach. */
  const reach = new Map<string, { w: number; h: number }>();
  for (const p of parts) {
    const r = reach.get(p.pageId ?? "") ?? { w: 0, h: 0 };
    reach.set(p.pageId ?? "", { w: Math.max(r.w, (p.x ?? 0) + (p.w ?? 0)), h: Math.max(r.h, (p.y ?? 0) + (p.h ?? 0)) });
  }
  const siteArea = [...reach.values()].reduce((a, r) => a + r.w * r.h, 0);
  /* Loading bars, read as components: a track and the level bar it holds. */
  const comps = componentsOf(nodes as unknown as readonly CompNode[], palette as Record<string, string | undefined>);
  const progressOf = (id: string): "track" | "level" | null => {
    const c = comps.byId.get(comps.of.get(id) ?? "");
    if (c?.kind !== "progress") return null;
    return c.id === id ? "track" : c.layers.some((l) => l.id === id && l.role === "fill") ? "level" : null;
  };
  const fillOf = new Map<string, string>();
  for (const p of parts) {
    if (background.has(p.id)) continue;
    /* Its own fill, else its gradient's body (the last stop: a button's light is the first). */
    const spots = spotsOf(p, palette).filter((s) => s.spot.use === "fill" && alpha(s.key) >= 0.6);
    const f = spots.find((s) => s.spot.where === "fill" || s.spot.where === "surface") ?? spots.filter((s) => s.spot.where === "in a gradient").pop();
    if (f && parseColor(f.key)) fillOf.set(p.id, f.key);
  }
  /* Kinds: fills clustered, the most-worn first. Buttons and surfaces never share a kind, however close their fills
     (J, 2026-10-09): the site's plain grey buttons and a TV body painted near that grey were one "Menu" kind whose
     Fill showed only on the TV and whose Words and Outline showed nowhere. */
  /* Trim (a thin strip, not a loading bar) is a class of its own, so a button's lip is neither a button nor one of the surfaces of its colour. */
  /* A strip the colour of a loading bar stays with the loading bars (sunkcoin's rows wear their bar's colour down their edge). */
  const barFills = [...new Set(parts.filter((p) => fillOf.has(p.id) && progressOf(p.id)).map((p) => fillOf.get(p.id)!))];
  const trim = new Set(parts.filter((p) => fillOf.has(p.id) && isTrim(p) && !progressOf(p.id) && !barFills.some((f) => oklabDistance(f, fillOf.get(p.id)!) < KIND_SHADES)).map((p) => p.id));
  const btn = new Set(parts.filter((p) => fillOf.has(p.id) && !trim.has(p.id) && isButton(p)).map((p) => p.id));
  const keyOf = (id: string) => `${btn.has(id) ? "b" : trim.has(id) ? "t" : "s"}|${fillOf.get(id)!}`;
  /* A part drawn again on every page is one part (`repeats.ts`). */
  const once = repeatsAcrossPages(parts as never);
  const one = (id: string) => once.get(id) ?? id;
  const counted = new Map<string, Set<string>>();
  for (const id of fillOf.keys()) { const k = keyOf(id); counted.set(k, (counted.get(k) ?? new Set()).add(one(id))); }
  const count = new Map([...counted].map(([k, v]) => [k, v.size]));
  const leads: { fill: string; button: boolean; cls: string; members: Set<string> }[] = [];
  const kindOfKey = new Map<string, number>();
  for (const [key] of [...count.entries()].sort((a, b) => b[1] - a[1])) {
    const cls = key.slice(0, 1), button = cls === "b", k = key.slice(2);
    let i = leads.findIndex((g) => g.cls === cls && oklabDistance(g.fill, k) < KIND_SHADES);
    if (i < 0) { leads.push({ fill: k, button, cls, members: new Set() }); i = leads.length - 1; }
    kindOfKey.set(key, i);
  }
  const moved = new Map<string, number>();
  const kindAt = (id: string) => moved.get(id) ?? kindOfKey.get(keyOf(id))!;
  for (const id of fillOf.keys()) leads[kindAt(id)]!.members.add(id);
  /* A panel whose own shade is worn by one or two parts (the PonsStars key cabinet, a darker wood than the rail's) joins the
     surface it is a shade of, rather than vanish from the preview with the one-offs (J, 2026-10-11). */
  const byId = new Map(parts.map((p) => [p.id, p] as const));
  leads.forEach((g, i) => {
    if (g.cls !== "s" || thingsIn(g.members, once) >= 3) return;
    for (const id of [...g.members]) {
      const p = byId.get(id)!;
      if (Math.min(p.w ?? 0, p.h ?? 0) <= PANEL) continue;
      /* Of the surfaces it is a shade of, the one covering most of the site: the wood, not a strip of it. */
      let best = -1, most = 0;
      leads.forEach((h, j) => {
        if (j === i || h.cls !== "s" || thingsIn(h.members, once) < 3 || oklabDistance(g.fill, h.fill) >= PANEL_SHADES) return;
        const c = [...h.members].reduce((a, m) => a + area(byId.get(m)!), 0);
        if (c > most) { most = c; best = j; }
      });
      if (best < 0) continue;
      g.members.delete(id);
      leads[best]!.members.add(id);
      moved.set(id, best);
    }
  });
  /* The surface each part stands on: itself if filled, else the smallest filled part holding it. */
  const filled = parts.filter((p) => fillOf.has(p.id));
  const under = (p: Node): Node | null => {
    if (fillOf.has(p.id)) return p;
    let best: Node | null = null;
    for (const q of filled) {
      if (q === p || q.pageId !== p.pageId || (q.state?.group ?? "") !== (p.state?.group ?? "") || !holds(q, p)) continue;
      if (!best || area(q) < area(best)) best = q;
    }
    return best;
  };
  /* What a part stands in: the smallest part holding it whose fill is another kind worn by three parts or more (a same-colour layer or a one-off wrapper is passed through). */
  const kindOf = (q: Node) => kindAt(q.id);
  const container = (p: Node): number => {
    let best: Node | null = null;
    for (const q of filled) {
      if (q === p || q.pageId !== p.pageId || (q.state?.group ?? "") !== (p.state?.group ?? "") || area(q) <= area(p) || !holds(q, p)) continue;
      const k = kindOf(q);
      if (k === kindOf(p) || thingsIn(leads[k]!.members, once) < 3) continue;
      if (!best || area(q) < area(best)) best = q;
    }
    return best ? kindOf(best) : -1;
  };
  const words = leads.map(() => new Map<string, number>());
  const faces = leads.map(() => new Map<string, number>());
  const pageWords = new Map<string, number>();
  const pageFaces = new Map<string, number>();
  const wordsIds = leads.map(() => [] as string[]);
  const glows = leads.map(() => new Map<string, number>());
  const glowsWorn = new Map<string, { colour: string; blur: number }>();
  const faceKeys = leads.map(() => new Map<string, number>());
  const samples = leads.map(() => new Map<string, number>());
  /* A button kind's own words, each counted once per button: what most of them say names the kind. */
  const own = leads.map(() => new Map<string, number>());
  const pageIds: string[] = [];
  const pageGlows = new Map<string, number>();
  const pageFaceKeys = new Map<string, number>();
  /* A label is counted once per part, not once per page it is drawn on. */
  const said = new Set<string>();
  for (const p of parts) {
    if (background.has(p.id)) continue;
    const t = spotsOf(p, palette).find((s) => s.spot.use === "text");
    if (!t) continue;
    const u = under(p);
    const i = u ? kindAt(u.id) : -1;
    bump(i < 0 ? pageWords : words[i]!, t.key);
    bump(i < 0 ? pageFaces : faces[i]!, (p as { font?: { stack?: string } | null }).font?.stack || faceOf(p));
    (i < 0 ? pageIds : wordsIds[i]!).push(p.id);
    bump(i < 0 ? pageFaceKeys : faceKeys[i]!, faceOf(p));
    for (const k of new Set(glowsOf(p).map((g) => { const k = colourKey(g.colour); if ((glowsWorn.get(k)?.blur ?? 0) < g.blur) glowsWorn.set(k, g); return k; }))) bump(i < 0 ? pageGlows : glows[i]!, k);
    const w = wordsOf(p);
    /* Its own parts' words first (a trade button's "10%"), then words standing on it; a label, not a sentence. */
    const first = !said.has(one(p.id));
    said.add(one(p.id));
    if (first && i >= 0 && w && w.length <= 24 && (u === p || /[A-Za-z]{2}/.test(w))) bump(samples[i]!, w, u === p ? 1000 : 1);
    if (first && i >= 0 && w && u === p) bump(own[i]!, w.toLowerCase());
  }
  const kinds: (Omit<SurfaceKind, "piece"> & { big: number; label: string | null; trim: boolean })[] = leads.map((g, i) => {
    const ms = parts.filter((p) => g.members.has(p.id));
    const outlines = new Map<string, number>();
    const shadows = new Map<string, number>();
    const paints = new Map<string, number>();
    const radii = new Map<number, number>();
    const inside = new Map<number, number>();
    let buttons = 0;
    const what = new Map<string, number>();
    const met = new Set<string>();
    for (const p of ms) {
      /* What a kind is, by its parts, each counted once however many pages draw it. */
      if (!met.has(one(p.id))) bump(what, WHAT[p.featureId ?? ""] ?? "parts");
      met.add(one(p.id));
      const e = p.edge;
      if (e && (e.width ?? 1) > 0 && e.style !== "none" && e.colour) {
        const c = spotsOf({ id: p.id, edge: e } as Worn, palette).find((s) => s.spot.use === "border");
        if (c) bump(outlines, `${c.key}|${e.width ?? 1}`);
      }
      if (e?.shadow) bump(shadows, e.shadow);
      const bg = (p as { art?: { background?: string } | null }).art?.background;
      if (bg && /gradient\(/.test(bg)) bump(paints, bg);
      bump(radii, Number(p.radius ?? 0) < 1 ? 0 : Math.round(Number(p.radius)));
      if (btn.has(p.id)) buttons++;
      bump(inside, container(p));
    }
    const o = top(outlines);
    const w = top(words[i]!);
    const paint = (() => { const g = top(paints); return g && g[1] >= ms.length / 2 ? g[0] : leads[i]!.fill; })();
    const mid = (f: (p: Node) => number) => ms.map(f).sort((a, b) => a - b)[ms.length >> 1] ?? 0;
    const midW = mid((p) => p.w ?? 0), midH = mid((p) => p.h ?? 0);
    const isButtons = buttons >= ms.length / 2;
    const isTrimKind = g.cls === "t";
    const shape = isButtons || isTrimKind ? null : shapeOf(ms);
    /* Most of its area panels (the lined index cards a site's forms sit on): a box, however many small tags share its colour. */
    const panels = ms.filter((p) => Math.min(p.w ?? 0, p.h ?? 0) > PANEL);
    const panelled = panels.length * 4 >= ms.length && panels.reduce((a, p) => a + area(p), 0) * 2 >= ms.reduce((a, p) => a + area(p), 0);
    const striped = ms.filter((p) => STRIPES.test((p as { art?: { background?: string } | null }).art?.background ?? "")).length * 2 >= ms.length;
    const biggest = ms.reduce<Node | null>((b, p) => (!b || area(p) > area(b) ? p : b), null);
    const cover = ms.reduce((a, p) => a + area(p), 0);
    /* Half its parts loading-bar tracks, or a third their level bars (the same orange is often a row's edge stripe too): a loading bar's colour. */
    const tracks = ms.filter((p) => progressOf(p.id) === "track").length, levels = ms.filter((p) => progressOf(p.id) === "level").length;
    const progress = isButtons ? null : tracks * 2 >= ms.length ? "track" as const : levels * 3 >= ms.length ? "level" as const : null;
    return {
      cover,
      trim: isTrimKind,
      progress,
      accent: !isButtons && (isTrimKind || !!progress || (!panelled && (cover < ACCENT_SHARE * siteArea || mid(area) < ACCENT_PART))),
      big: biggest ? Math.max(biggest.w ?? 0, biggest.h ?? 0) : 0,
      label: biggest ? pieceName(biggest) : null,
      w: midW,
      h: midH,
      /* A bar is not a tab: drawn over a panel's top edge, PonsStars-style, sunkcoin's loading bars read as labels. */
      tab: !isButtons && !isTrimKind && !shape && !panelled && midH > 0 && midH <= TAB_HEIGHT && top(what)?.[0] !== "Fields",
      shape,
      fill: g.fill,
      name: isButtons ? buttonsName(own[i]!, thingsIn(g.members, once)) : isTrimKind ? (striped ? "Stripes" : "Trim") : progress === "track" ? "Loading bars" : progress === "level" ? "Loading bar level" : shape ? SHAPE_NAME[shape] : top(what)?.[0] ?? "Parts",
      parts: thingsIn(g.members, once),
      ids: ms.map((p) => p.id),
      shades: [...new Set(ms.map((p) => fillOf.get(p.id)!))],
      stops: /gradient\(/.test(paint) ? [...new Set(coloursIn(paint).map(colourKey))] : [],
      wordsIds: wordsIds[i]!,
      ...glowOf(glows[i]!, glowsWorn, wordsIds[i]!.length),
      faceKey: top(faceKeys[i]!)?.[0] ?? null,
      sample: top(samples[i]!)?.[0] ?? null,
      button: buttons >= ms.length / 2,
      words: w?.[0] ?? null,
      wordsParts: w?.[1] ?? 0,
      face: top(faces[i]!)?.[0] ?? null,
      /* Half the parts or more draw it, or it is not this kind's outline. */
      outline: o && o[1] >= ms.length / 2 ? { colour: o[0].split("|")[0]!, width: Number(o[0].split("|")[1]) } : null,
      paint,
      shadow: (() => { const s = top(shadows); return s && s[1] >= ms.length / 2 ? s[0] : null; })(),
      radius: top(radii)?.[0] ?? 0,
      /* Where a third of its parts or more stand inside a kind, it is shown there: the page is only the fallback. */
      inside: (() => { const k = top(new Map([...inside].filter(([x]) => x >= 0))); return k && k[1] >= ms.length / 3 ? k[0] : -1; })(),
    };
  });
  /* Keep the kinds worn by three parts or more, and re-point `inside` at the kept list. A surface whose parts are
     all specks (a TV's antenna balls) is decoration, not a kind of panel anyone reads the site by. A big piece
     painted with a gradient (the TV bodies) is kept on its own however few wear it, named after its biggest part,
     and edited as one gradient (J, 2026-10-09). */
  const isPiece = (k: (typeof kinds)[number]) => !k.button && !k.trim && k.stops.length > 1 && k.big >= PIECE;
  /* Past the cap, a big real surface (the wood the forms and the TV stand on) is still kept: the cap drops the small things first. */
  const many = kinds.map((k, i) => ({ k, i })).filter(({ k }) => !isPiece(k) && k.parts >= 3 && (k.button || !!k.progress || Math.max(k.w, k.h) >= SPECK))
    .filter(({ k }, j) => j < cap || (!k.button && !k.accent && !k.trim && k.cover >= BIG_SURFACE * siteArea));
  const pieces = kinds.map((k, i) => ({ k: { ...k, name: k.label ?? `Painted ${k.name.toLowerCase().replace(/s$/, "")}`, piece: true, accent: false, progress: null }, i })).filter(({ k }) => isPiece(k)).slice(0, 2);
  /* A tab is drawn as a strip already: only a surface drawn as a box can be an accent. */
  const kept = [...many.map(({ k, i }) => ({ k: { ...k, piece: false, tab: k.tab && !k.progress, accent: k.accent && (!k.tab || !!k.progress) }, i })), ...pieces];
  const at = new Map(kept.map(({ i }, j) => [i, j]));
  /* Names by role: the most-worn surface is the main fill; the rest by what they are, numbered when two share a name. */
  const seen = new Map<string, number>();
  const named = kept.map(({ k }, j) => {
    /* The main fill is the most-worn plain surface: a grid, rows or bars keep their own name. */
    const main = (x: (typeof kept)[number]["k"]) => !x.button && !x.piece && !x.shape && !x.accent;
    const base = main(k) && j === kept.findIndex(({ k: x }) => main(x)) ? "Main fill" : k.name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const { big: _b, label: _l, trim: _t, ...kind } = k;
    /* A second kind of the same name says what is on it ("Bars: Latest payday"), not "Bars 4": a number tells nothing apart. */
    const says = k.sample && k.sample.length <= 18 && /[a-z]{2}/i.test(k.sample) ? k.sample.charAt(0).toUpperCase() + k.sample.slice(1).toLowerCase() : null;
    return { ...kind, name: n > 1 ? (says ? `${base}: ${says}` : `${base} ${n}`) : base, inside: at.get(k.inside) ?? -1 };
  });
  return {
    page: { fill: palette.bg ?? "#ffffff", words: top(pageWords)?.[0] ?? null, face: top(pageFaces)?.[0] ?? null, faceKey: top(pageFaceKeys)?.[0] ?? null, wordsIds: pageIds, ...glowOf(pageGlows, glowsWorn, pageIds.length) },
    kinds: named,
  };
}
