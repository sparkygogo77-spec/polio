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
/** How far a lone panel's shade may be from a surface's and still be one of them. */
export const PANEL_SHADES = 0.06;
/** A part both ways bigger than this is a panel: a lone one joins the boxes it is a shade of. */
export const PANEL = 2 * TAB_HEIGHT;
/** A gradient-painted piece this big or more (its longer side, px) is a kind of its own, however few parts wear it. */
export const PIECE = 192;
/**
 * Kept for the record of what a speck of the site is: a kind is NOT an accent
 * by its share of the site any more. Every page a site has added to that
 * share's whole, so on the PonsStars redesign (six tall pages) 31 worded wood
 * bars and their texture fell under it and came out a 12 px dot (J,
 * 2026-10-11: "not sure why this little bars icon in the preview is used for
 * the bars and material on bars"). A kind is small by its own middle part,
 * `ACCENT_PART`, and only when no words stand on it.
 */
export const ACCENT_SHARE = 0.015;
/** A kind whose middle part is this small (area, px²) and carries no words is a small accent: a dot, a screw, a stripe, however many there are. */
export const ACCENT_PART = 48 * 48;
/** A surface whose middle part is at least this wide and this tall is a panel: it always gets a box, worn by two parts or more (J, 2026-10-11: the paper forms and wood boards had none). */
export const PANEL_W = 160;
export const PANEL_H = 96;

export interface SurfaceKind {
  /** The lead fill. */
  fill: string;
  /** What it is for, never its colour (J, 2026-10-09): "Main fill" for the most-worn surface, then "Panels", "Fields", "Buttons" and so on. */
  name: string;
  /** Parts wearing it as their own fill, a part repeated across pages counted once. */
  parts: number;
  /** How much of the site its parts cover together, px². */
  cover: number;
  /** A small accent: its middle part is a speck (`ACCENT_PART`) with no words on it, a screw, a dot, a stripe. Drawn small, in the box it sits in, with no count on it. */
  accent: boolean;
  /** A bar with no words on it that is not a speck (a long rule, a striped strip): drawn as a bar, in its own paint. */
  strip: boolean;
  /** Its parts are round (a dot, a screw head, a lamp): its small swatch is round too. */
  round: boolean;
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

/** Words in a hook that say how a part is wrapped or which one it is, not what it is. */
const VAGUE = new Set(["wrap", "wrapper", "inner", "outer", "inside", "holder", "container", "content", "item", "part", "el", "bg", "js", "is", "has", "the", "of", "and", "tl", "tr", "bl", "br", "left", "right", "top", "bottom", "middle", "mid", "center", "centre"]);
const plural = (w: string) => (/(s|x|z|ch|sh)$/.test(w) ? (/[^s]s$/.test(w) && w.length > 3 ? w : `${w}es`) : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : `${w}s`);
const wordsIn = (hook: string) => hook.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1 && !VAGUE.has(w));

/**
 * A KIND NAMED BY ITS PARTS' HOOKS (J, 2026-10-11): "Panels: Last audited",
 * "Panels 2" and "Main fill" told J nothing. The page's own code names its
 * parts (`data-hook`, an id), and the word most of a kind's hooks share is
 * what they are ("lab-drawer-label", "play-drawer-label" → labels; the later
 * word when two are shared as often), and the word before it, when most share
 * that too, says which (→ Drawer labels). A page's name or a number in a hook
 * is in too few of them to count, and so are where words ("tl", "left"). A
 * ::before or ::after is left out: the redesign's 78 screw heads drawn by
 * their plates have no name, its 14 hooked ones say "screw". Each part drawn
 * on every page counted once.
 * Null when too few of the parts have a hook (a captured live site's
 * "div · 8 inside"), or they share no word: the kind then keeps the name its
 * shape or its parts give it.
 */
function hookName(ms: readonly Node[], one: (id: string) => string): string | null {
  const seen = new Set<string>();
  const lists: string[][] = [];
  let all = 0;
  for (const p of ms) {
    if (seen.has(one(p.id))) continue;
    seen.add(one(p.id));
    /* A ::before or ::after is its host's decoration and carries no name of its own: it neither names the kind nor counts against a name. */
    if (/::(before|after)$/.test(String((p as { label?: unknown }).label ?? ""))) continue;
    all++;
    const hook = p.hooks?.["data-hook"] || p.hooks?.id;
    const w = hook ? wordsIn(hook) : [];
    if (w.length) lists.push(w);
  }
  const named = lists.length;
  if (!named || named * 2 < all) return null;
  /* How many hooks hold each word, and how far along them it sits (0 first, 1 last). */
  const df = new Map<string, { n: number; along: number }>();
  for (const w of lists) for (const [i, x] of w.entries()) { if (w.indexOf(x) !== i) continue; const d = df.get(x) ?? { n: 0, along: 0 }; df.set(x, { n: d.n + 1, along: d.along + (w.length > 1 ? i / (w.length - 1) : 1) }); }
  /* A hook's first word is often its page or section ("lib-", "play-"): a word counts for more the later it sits. */
  const score = (d: { n: number; along: number }) => d.n * (0.4 + (0.6 * d.along) / d.n);
  const head = [...df.entries()].sort((a, b) => score(b[1]) - score(a[1]) || b[1].n - a[1].n)[0];
  if (!head || head[1].n * 5 < named * 2 || (named > 1 && head[1].n < 2)) return null;
  const leads = new Map<string, number>();
  for (const w of lists) { const i = w.indexOf(head[0]); if (i > 0) bump(leads, w[i - 1]!); }
  const lead = top(leads);
  const name = lead && lead[1] * 3 >= head[1].n * 2 ? `${lead[0]} ${plural(head[0])}` : plural(head[0]);
  return (name.charAt(0).toUpperCase() + name.slice(1)).replace(/\btv\b/gi, "TV");
}

type Node = Part & { radius?: number | null; hooks?: Record<string, string>; state?: { group?: string } | null; edge?: { width?: number; colour?: string; style?: string; shadow?: string } | null };

const area = (p: Node) => Math.max(0, p.w ?? 0) * Math.max(0, p.h ?? 0);
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
export function siteKinds(nodes: readonly Worn[], palette: Partial<Palette>, background: ReadonlySet<string> = new Set(), cap = 24): SiteKinds {
  const parts = nodes as readonly Node[];
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
  /* The filled parts words stand on: real words, not a text colour a ::before inherits with nothing to say (the redesign's screw heads). */
  const carries = new Set<string>();
  for (const p of parts) {
    if (background.has(p.id) || !wordsOf(p).replace(/\u200b/g, "").trim()) continue;
    const u = under(p);
    if (u) carries.add(u.id);
  }
  /*
   * WHAT A PART IS, by its own box, before it is put with others (J, 2026-10-11). One colour is worn by a panel, a
   * label, a stripe and a screw alike: on the PonsStars redesign the dark brown of the drawer labels was also the
   * room's dim layer and the striped strips' paint, and the cream of the queue panel also the clock's face. A kind
   * that mixed them was drawn as none of them, and each fix tuned the guess for one screenshot. So a kind is one
   * colour worn by one sort of thing:
   *
   *   · bar     a loading bar's track or level, and a strip of its colour (sunkcoin's rows wear their bar's colour
   *             down their edge);
   *   · strip   no words on it, a bar (BAR_HEIGHT thick or less, four times as long): a rule, a button's striped lip
   *             (the trim of #230, which was a kind of button, "Buttons 2");
   *   · speck   no words on it, smaller than ACCENT_PART: a screw, a dot, a lamp;
   *   · label   words on it, TAB_HEIGHT tall or less: a label bar, a name plate, a tag;
   *   · box     the rest: a panel, a card, a form, a board.
   *
   * Buttons are a kind of their own, as before, but a strip, or a speck drawn by a ::before or ::after, is the
   * button's trim, never a button.
   */
  const barFills = [...new Set(parts.filter((p) => fillOf.has(p.id) && progressOf(p.id)).map((p) => fillOf.get(p.id)!))];
  const sortOf = (p: Node): "bar" | "speck" | "strip" | "label" | "box" => {
    const w = p.w ?? 0, h = p.h ?? 0, thin = Math.min(w, h), long = Math.max(w, h), worded = carries.has(p.id);
    const bar = !worded && thin > 0 && thin <= BAR_HEIGHT && long >= 4 * thin;
    if (progressOf(p.id) || (bar && barFills.some((f) => oklabDistance(f, fillOf.get(p.id)!) < KIND_SHADES))) return "bar";
    /* A bar first, however small its area: the redesign's striped strips were drawn as a dot (J, 2026-10-11). */
    if (bar) return "strip";
    if (!worded && w * h < ACCENT_PART) return "speck";
    if (worded && h > 0 && h <= TAB_HEIGHT) return "label";
    return "box";
  };
  const sorts = new Map(filled.map((p) => [p.id, sortOf(p)]));
  const pseudo = (p: Node) => /::(before|after)$/.test(String((p as { label?: unknown }).label ?? ""));
  const btn = new Set(filled.filter((p) => isButton(p) && sorts.get(p.id) !== "strip" && sorts.get(p.id) !== "bar" && !(sorts.get(p.id) === "speck" && pseudo(p))).map((p) => p.id));
  const keyOf = (id: string) => `${btn.has(id) ? "button" : sorts.get(id)}|${fillOf.get(id)!}`;
  /* A part drawn again on every page is one part (`repeats.ts`). */
  const once = repeatsAcrossPages(parts as never);
  const one = (id: string) => once.get(id) ?? id;
  const counted = new Map<string, Set<string>>();
  for (const id of fillOf.keys()) { const k = keyOf(id); counted.set(k, (counted.get(k) ?? new Set()).add(one(id))); }
  const count = new Map([...counted].map(([k, v]) => [k, v.size]));
  const leads: { fill: string; button: boolean; sort: string; members: Set<string> }[] = [];
  const kindOfKey = new Map<string, number>();
  for (const [key] of [...count.entries()].sort((a, b) => b[1] - a[1])) {
    const sort = key.slice(0, key.indexOf("|")), k = key.slice(key.indexOf("|") + 1), button = sort === "button";
    let i = leads.findIndex((g) => g.sort === sort && oklabDistance(g.fill, k) < KIND_SHADES);
    if (i < 0) { leads.push({ fill: k, button, sort, members: new Set() }); i = leads.length - 1; }
    kindOfKey.set(key, i);
  }
  const moved = new Map<string, number>();
  const kindAt = (id: string) => moved.get(id) ?? kindOfKey.get(keyOf(id))!;
  for (const id of fillOf.keys()) leads[kindAt(id)]!.members.add(id);
  /* A panel whose own shade is worn by one or two parts (the PonsStars key cabinet, a darker wood than the rail's) joins the
     boxes it is a shade of, rather than vanish from the preview with the one-offs (J, 2026-10-11). */
  const byId = new Map(parts.map((p) => [p.id, p] as const));
  leads.forEach((g, i) => {
    if (g.sort !== "box" || thingsIn(g.members, once) >= 3) return;
    for (const id of [...g.members]) {
      const p = byId.get(id)!;
      if (Math.min(p.w ?? 0, p.h ?? 0) <= PANEL) continue;
      /* Of the boxes it is a shade of, the one covering most of the site: the wood, not a strip of it. */
      let best = -1, most = 0;
      leads.forEach((h, j) => {
        if (j === i || h.sort !== "box" || thingsIn(h.members, once) < 3 || oklabDistance(g.fill, h.fill) >= PANEL_SHADES) return;
        const c = [...h.members].reduce((a, m) => a + area(byId.get(m)!), 0);
        if (c > most) { most = c; best = j; }
      });
      if (best < 0) continue;
      g.members.delete(id);
      leads[best]!.members.add(id);
      moved.set(id, best);
    }
  });
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
  const kinds: (Omit<SurfaceKind, "piece"> & { big: number; label: string | null; hooked: boolean })[] = leads.map((g, i) => {
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
    const shape = isButtons ? null : shapeOf(ms);
    const striped = ms.filter((p) => STRIPES.test((p as { art?: { background?: string } | null }).art?.background ?? "")).length * 2 >= ms.length;
    const biggest = ms.reduce<Node | null>((b, p) => (!b || area(p) > area(b) ? p : b), null);
    const cover = ms.reduce((a, p) => a + area(p), 0);
    /* Half its parts loading-bar tracks, or a third their level bars (the same orange is often a row's edge stripe too): a loading bar's colour. */
    const tracks = ms.filter((p) => progressOf(p.id) === "track").length, levels = ms.filter((p) => progressOf(p.id) === "level").length;
    const progress = isButtons ? null : tracks * 2 >= ms.length ? "track" as const : levels * 3 >= ms.length ? "level" as const : null;
    /*
     * How the preview draws it follows from the sort of thing its parts are (`sortOf`), never from a share of the
     * whole site (that grew with every page: the redesign's 31 worded wood bars came out a dot; J, 2026-10-11):
     * specks are small accents, label bars go over a panel's top edge, strips are bars, the rest are boxes.
     */
    const sort = g.sort;
    const accent = !isButtons && (!!progress || sort === "speck");
    /* A bar of loading-bar colour is not a tab: sunkcoin's loading bars read as labels. A field is a box. */
    const tab = !isButtons && !accent && sort === "label" && top(what)?.[0] !== "Fields";
    const hooked = isButtons || progress ? null : hookName(ms, one);
    return {
      cover,
      progress,
      accent,
      strip: !isButtons && !accent && sort === "strip",
      round: ms.filter((p) => Math.min(p.w ?? 0, p.h ?? 0) > 0 && Number(p.radius ?? 0) * 2 >= Math.min(p.w ?? 0, p.h ?? 0) - 1).length * 2 >= ms.length,
      /* Its middle part's longer side: one big part painted the same (a ruler among 115 screws) does not make the screws a piece. */
      big: Math.max(midW, midH),
      label: biggest ? pieceName(biggest) : null,
      hooked: !!hooked,
      w: midW,
      h: midH,
      tab,
      shape,
      fill: g.fill,
      name: isButtons ? buttonsName(own[i]!, thingsIn(g.members, once)) : progress === "track" ? "Loading bars" : progress === "level" ? "Loading bar level" : hooked ?? (sort === "strip" && striped ? "Stripes" : tab && shape === "bars" ? "Label bars" : shape ? SHAPE_NAME[shape] : sort === "strip" ? "Trim" : top(what)?.[0] ?? "Parts"),
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
  /* A piece is one or two big painted parts; three or more of them are a kind of surface, drawn as a box like any other. */
  const isPiece = (k: (typeof kinds)[number]) => !k.button && k.stops.length > 1 && k.big >= PIECE && k.parts < 3;
  /* A panel always gets a box, worn by two parts or more; specks are kept as small accents (the screws, J 2026-10-11). */
  const panel = (k: (typeof kinds)[number]) => !k.button && !k.accent && k.w >= PANEL_W && k.h >= PANEL_H;
  const many = kinds.map((k, i) => ({ k, i })).filter(({ k }) => !isPiece(k) && (k.parts >= 3 || (panel(k) && k.parts >= 2)) && (k.button || !!k.progress || k.accent || Math.max(k.w, k.h) >= SPECK)).slice(0, cap);
  const pieces = kinds.map((k, i) => ({ k: { ...k, name: k.label ?? `Painted ${k.name.toLowerCase().replace(/s$/, "")}`, piece: true, accent: false, strip: false, progress: null }, i })).filter(({ k }) => isPiece(k)).slice(0, 2);
  /* A tab is drawn as a strip already: only a surface drawn as a box can be an accent. */
  const kept = [...many.map(({ k, i }) => ({ k: { ...k, piece: false, tab: k.tab && !k.progress, accent: k.accent && (!k.tab || !!k.progress), strip: k.strip && !k.tab }, i })), ...pieces];
  const at = new Map(kept.map(({ i }, j) => [i, j]));
  /* Names by role: the most-worn surface is the main fill; the rest by what they are, numbered when two share a name. */
  const seen = new Map<string, number>();
  const used = new Set<string>();
  const named = kept.map(({ k }, j) => {
    /* The main fill is the most-worn plain surface: a grid, rows or bars keep their own name. */
    /* No "Main fill": it told J nothing (2026-10-11). A kind is named by its parts' hooks, or by what its parts are. */
    const base = k.name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    const { big: _b, label: _l, hooked: _h, ...kind } = k;
    /*
     * A second kind of the same name is told apart by how it looks, "Dark labels" beside "Labels", never by the words
     * on one of its parts: "Panels: Last audited" read as the name of one panel (J, 2026-10-11). A number only when
     * the two look alike.
     */
    const first = kept.find(({ k: x }) => x !== k && x.name === base)?.k;
    const dl = first ? (parseColor(k.fill)?.l ?? 0) - (parseColor(first.fill)?.l ?? 0) : 0;
    const looks = `${dl < 0 ? "Dark" : "Light"} ${base.charAt(0).toLowerCase()}${base.slice(1)}`;
    const name = n === 1 ? base : Math.abs(dl) >= 0.2 && !used.has(looks) ? looks : `${base} ${n}`;
    used.add(name);
    return { ...kind, name, inside: at.get(k.inside) ?? -1 };
  });
  return {
    page: { fill: palette.bg ?? "#ffffff", words: top(pageWords)?.[0] ?? null, face: top(pageFaces)?.[0] ?? null, faceKey: top(pageFaceKeys)?.[0] ?? null, wordsIds: pageIds, ...glowOf(pageGlows, glowsWorn, pageIds.length) },
    kinds: named,
  };
}

/**
 * WHAT THE PREVIEW DRAWS (`SiteColours.tsx#ThemePreview`), pure, so a test can
 * hold it to a real board rather than to a made-up one (J, 2026-10-11: fixes
 * checked on a stale saved board came out poor on the redesign).
 *
 *   · tabs      label bars, the most-worn first, drawn over the top edge of the first box;
 *   · surfaces  every kind drawn as a box, the biggest first by how much of the
 *               site it covers, not by how many parts wear it: the paper forms
 *               and wood boards fell behind four kinds of small labels; the
 *               one the buttons stand in comes first; a big painted piece too;
 *   · buttons   as the site's buttons, standing in their surface;
 *   · accents   small swatches shaped like their parts, with no count on them
 *               (the count shows once one is picked), in the box they sit in;
 *   · strips    bars with no words that are no speck, drawn as a bar;
 *   · bars      every loading bar's colours, one chip.
 */
export function previewPlan(site: SiteKinds) {
  const k = site.kinds;
  const holdsButtons = (x: SurfaceKind) => Number(k.some((b) => b.button && b.inside === k.indexOf(x)));
  return {
    tabs: k.filter((x) => x.tab && !x.button).slice(0, 6),
    surfaces: [...k.filter((x) => !x.button && !x.tab && !x.piece && !x.accent && !x.strip && !x.progress).sort((a, b) => b.cover - a.cover).slice(0, 8), ...k.filter((x) => x.piece)].sort((a, b) => holdsButtons(b) - holdsButtons(a)),
    buttons: k.filter((x) => x.button).slice(0, 4),
    accents: k.filter((x) => x.accent && !x.progress).slice(0, 10),
    strips: k.filter((x) => x.strip && !x.button && !x.progress).slice(0, 4),
    bars: [...k.filter((x) => x.progress === "track"), ...k.filter((x) => x.progress === "level")].slice(0, 6),
  };
}
