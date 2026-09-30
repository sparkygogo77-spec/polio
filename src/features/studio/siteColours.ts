/**
 * EVERY COLOUR AND FACE A SITE USES, BY WHAT IT IS USED FOR, AND SWAP-ALL.
 *
 * The six roles (`paletteFrom.ts`) are what a site made here is built from.
 * A site brought in is not: trumpmorty.fun paints one near-black on its words,
 * its outlines, its hard shadows and eight fills, a dozen pastels on one card
 * each, and three faces on 90 parts. Six roles cannot say that, and the ones
 * they left out (every shadow, every outline on the words, every gradient,
 * every run of coloured words) never reached the panel at all
 * (docs/audit/palette-captured.md).
 *
 * So this reads the parts as they are, never a guess about them:
 *
 *   text     a part's words (text, muted) and each run of words in it
 *   fill     a part's fill (bg, surface), a stop in its gradient, the page
 *   border   its drawn edge, and the outline round its words (text-stroke)
 *   shadow   its box-shadow, its text-shadow, its aura
 *   accent   a colour that IS a colour (chroma 0.05 or more, the rule
 *            `paletteFrom.ts` uses), wherever it is worn, and any accent or
 *            highlight slot that is not the part's own fill again. On
 *            trumpmorty.fun every accent slot is a copy of the fill, so a
 *            group read off the slots alone was empty; the colours that stand
 *            out are what a person means by the site's accents.
 *
 * and counts PARTS, not mentions: a card whose bg and surface are the same
 * dark is one part with that fill. A role name on a part ("text") is read as
 * the colour the role has now, so a linked part counts as what it shows.
 *
 * SWAP-ALL writes the new colour into exactly the spots that wore the old
 * one, and nowhere else: a part that named a role gets the literal (it is
 * one of the parts that was asked for, the role and the others that read it
 * do not move). Faces the same way: the face, and the page's stack behind it
 * so the old face cannot win from under it.
 *
 * Pure: no store, no DOM, so a test reads it against a real capture.
 */
import { contrast, parseColor, ROLES, toHex, type Palette, type RoleId } from "./look.ts";

export type ColourUse = "text" | "fill" | "border" | "shadow" | "accent";
export const COLOUR_USES: readonly ColourUse[] = ["text", "fill", "border", "shadow", "accent"];
export const USE_LABEL: Record<ColourUse, string> = {
  text: "Text",
  fill: "Fills",
  border: "Borders & outlines",
  shadow: "Shadows & glows",
  accent: "Accents",
};

/** One place a colour is worn: which part, what for, and the words for it. */
export interface ColourSpot {
  id: string;
  use: ColourUse;
  where: string;
  /** Set when the part names a palette role rather than the colour itself. */
  role?: RoleId;
}

export interface SiteColour {
  key: string;
  /** The colour as first met, for painting the swatch. */
  value: string;
  /** Parts wearing it, whatever for. */
  parts: number;
  /** Parts wearing it, per use. */
  by: Record<ColourUse, number>;
  spots: ColourSpot[];
}

/** The part fields this reads. A StudioNode is one; so is a bare capture node. */
export interface Worn {
  id: string;
  label?: string;
  colour?: Partial<Record<string, string>> | null;
  edge?: { width?: number; style?: string; colour?: string; shadow?: string } | null;
  art?: { background?: string; textShadow?: string; textStroke?: { w: number; color: string } } | null;
  aura?: string | null;
  content?: unknown;
  font?: { face?: string; family?: string; stack?: string; size?: number; weight?: number; spacing?: number } | null;
  picture?: unknown;
}

/** Page and parts, as one key. `rgb(26, 15, 11)`, `#1a0f0b` and `rgb(26,15,11)` are one colour. */
export function colourKey(v: string | null | undefined): string {
  const s = (v ?? "").trim().toLowerCase();
  if (!s) return "";
  const hex = s.match(/^#([0-9a-f]{3,8})$/);
  if (hex) {
    let h = hex[1]!;
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    const n = (i: number) => parseInt(h.slice(i, i + 2), 16);
    const a = h.length === 8 ? Math.round((n(6) / 255) * 1000) / 1000 : 1;
    return a === 1 ? `rgb(${n(0)}, ${n(2)}, ${n(4)})` : `rgba(${n(0)}, ${n(2)}, ${n(4)}, ${a})`;
  }
  const rgb = s.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const [r, g, b] = [rgb[1], rgb[2], rgb[3]].map((x) => Math.round(Number(x)));
    const raw = rgb[4];
    const a = raw === undefined ? 1 : raw.endsWith("%") ? Number(raw.slice(0, -1)) / 100 : Number(raw);
    return a >= 1 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`;
  }
  /* oklch(), hsl() and the rest — the palette writes oklch — read as the rgb they are. */
  const c = parseColor(s);
  if (c) return colourKey(toHex(c));
  return s.replace(/\s+/g, "");
}

/** Colours written inside a CSS value: a shadow list, a gradient. */
const IN_CSS = /(?:rgba?|oklch|oklab|hsla?|lab|lch|color)\([^)]*\)|#[0-9a-f]{3,8}\b/gi;
export function coloursIn(css: string | null | undefined): string[] {
  return [...String(css ?? "").matchAll(IN_CSS)].map((m) => m[0]);
}

const isRole = (v: string): v is RoleId => (ROLES as readonly string[]).includes(v);
/** A colour that is a colour, not a grey: the line `paletteFrom.ts` draws. */
export const chromatic = (v: string) => (parseColor(v)?.c ?? 0) >= 0.05;

/** Every spot a part wears a colour, with the colour as written and as it reads now. */
export function spotsOf(n: Worn, palette: Partial<Palette> = {}): { raw: string; key: string; spot: ColourSpot }[] {
  const out: { raw: string; key: string; spot: ColourSpot }[] = [];
  const add = (raw: string | undefined | null, use: ColourUse, where: string) => {
    const v = (raw ?? "").trim();
    if (!v) return;
    const role = isRole(v) ? v : undefined;
    const reads = role ? palette[role] ?? "" : v;
    if (!reads || (!role && !parseColor(v) && !/^rgba?\(/i.test(v))) return;
    out.push({ raw: v, key: colourKey(reads), spot: { id: n.id, use, where, ...(role ? { role } : {}) } });
  };
  const c = n.colour ?? {};
  add(c.text, "text", "words");
  add(c.muted, "text", "quieter words");
  add(c.bg, "fill", "fill");
  if (colourKey(c.surface) !== colourKey(c.bg)) add(c.surface, "fill", "surface");
  const fills = new Set([colourKey(c.bg), colourKey(c.surface)]);
  if (c.accent && !fills.has(colourKey(c.accent))) add(c.accent, "accent", "accent");
  if (c.highlight && !fills.has(colourKey(c.highlight))) add(c.highlight, "accent", "highlight");
  if (Array.isArray(n.content)) {
    for (const s of n.content as { colour?: string; textShadow?: string; textStroke?: { w: number; color: string } }[]) {
      if (!s || typeof s !== "object") continue;
      add(s.colour, "text", "a run of words");
      for (const x of coloursIn(s.textShadow)) add(x, "shadow", "shadow on a letter");
      if (s.textStroke && s.textStroke.w > 0) add(s.textStroke.color, "border", "outline on a letter");
    }
  }
  const e = n.edge;
  if (e && (e.width ?? 1) > 0 && e.style !== "none") add(e.colour, "border", "border");
  for (const x of coloursIn(e?.shadow)) add(x, "shadow", "shadow");
  const a = n.art;
  for (const x of coloursIn(a?.textShadow)) add(x, "shadow", "shadow on the words");
  if (a?.textStroke && a.textStroke.w > 0) add(a.textStroke.color, "border", "outline on the words");
  for (const x of coloursIn(a?.background)) add(x, "fill", "in a gradient");
  if (n.aura) add(n.aura, "shadow", "aura");
  return out;
}

/** The page's own colour is worn too, by the page. */
export const PAGE_ID = "@page";

/**
 * Every colour on the site, grouped by what it is used for, each with how
 * many parts use it that way. A colour used two ways is in both groups.
 */
export function tallyColours(nodes: readonly Worn[], palette: Partial<Palette> = {}): {
  all: SiteColour[];
  byUse: Record<ColourUse, SiteColour[]>;
  pictures: number;
} {
  const map = new Map<string, { value: string; spots: ColourSpot[] }>();
  const put = (key: string, value: string, spot: ColourSpot) => {
    const hit = map.get(key) ?? { value, spots: [] };
    hit.spots.push(spot);
    map.set(key, hit);
  };
  if (palette.bg) put(colourKey(palette.bg), palette.bg, { id: PAGE_ID, use: "fill", where: "the page", role: "bg" });
  for (const n of nodes) for (const w of spotsOf(n, palette)) put(w.key, w.spot.role ?? w.raw, w.spot);
  const all: SiteColour[] = [...map.entries()].map(([key, h]) => {
    const by = Object.fromEntries(COLOUR_USES.map((u) => [u, new Set(h.spots.filter((s) => s.use === u).map((s) => s.id)).size])) as Record<ColourUse, number>;
    const value = isRole(h.value) ? palette[h.value] ?? key : h.value;
    if (chromatic(value)) by.accent = new Set(h.spots.map((s) => s.id)).size;
    return { key, value, parts: new Set(h.spots.map((s) => s.id)).size, by, spots: h.spots };
  }).sort((x, y) => y.parts - x.parts || x.key.localeCompare(y.key));
  const byUse = Object.fromEntries(COLOUR_USES.map((u) => [u,
    all.filter((c) => c.by[u] > 0).sort((x, y) => y.by[u] - x.by[u] || x.key.localeCompare(y.key)),
  ])) as Record<ColourUse, SiteColour[]>;
  return { all, byUse, pictures: nodes.filter((n) => !!n.picture).length };
}

/** Which parts wear this colour (for this use, or any), and for what. */
export function whoWears(nodes: readonly Worn[], palette: Partial<Palette>, colour: string, use?: ColourUse): ColourSpot[] {
  const k = colourKey(colour);
  const found = tallyColours(nodes, palette).all.find((c) => c.key === k);
  return (found?.spots ?? []).filter((s) => !use || s.use === use);
}

/** Replace, inside a CSS value, every colour that is `from` with `to`. */
function swapIn(css: string, from: string, to: string): string {
  return css.replace(IN_CSS, (m) => (colourKey(m) === from ? to : m));
}

/**
 * Recolour exactly the spots that wear `from` — every use, or one — and
 * nothing else. Returns the nodes (unchanged ones are the same objects), the
 * page colour when the page wore it, and the ids of the parts it touched.
 */
export function swapColour<N extends Worn>(
  nodes: readonly N[],
  palette: Partial<Palette>,
  fromColour: string,
  to: string,
  opts: { use?: ColourUse; only?: ReadonlySet<string> } = {},
): { nodes: N[]; pageBg: string | null; changed: string[] } {
  const from = colourKey(fromColour);
  /* A role name is a colour to a part's slot, an edge and a run; inside a CSS value it is not. */
  const lit = isRole(to) ? palette[to] ?? to : to;
  /* An accent is the colour wherever it is worn (see the head of this file), so recolouring one recolours all its uses. */
  const scope = opts.use === "accent" && chromatic(fromColour) ? undefined : opts.use;
  const want = (use: ColourUse, id: string) => (!scope || scope === use) && (!opts.only || opts.only.has(id));
  const hits = (raw: string | undefined | null) => {
    const v = (raw ?? "").trim();
    if (!v) return false;
    return colourKey(isRole(v) ? palette[v] : v) === from;
  };
  const changed = new Set<string>();
  const out = nodes.map((n) => {
    let next: N = n;
    const touch = (patch: Partial<N>) => { next = { ...next, ...patch }; changed.add(n.id); };
    if (n.colour) {
      const c: Record<string, string> = { ...(n.colour as Record<string, string>) };
      const fills = new Set([colourKey(c.bg), colourKey(c.surface)]);
      let moved = false;
      for (const slot of Object.keys(c)) {
        const use: ColourUse = slot === "text" || slot === "muted" ? "text" : slot === "bg" || slot === "surface" ? "fill"
          : (slot === "accent" || slot === "highlight") && fills.has(colourKey(c[slot])) ? "fill" : "accent";
        if (hits(c[slot]) && want(use, n.id)) { c[slot] = to; moved = true; }
      }
      if (moved) touch({ colour: c } as Partial<N>);
    }
    if (Array.isArray(n.content)) {
      let moved = false;
      const runs = (n.content as Record<string, unknown>[]).map((s) => {
        if (!s || typeof s !== "object") return s;
        let r = s;
        if (typeof s.colour === "string" && hits(s.colour) && want("text", n.id)) { r = { ...r, colour: to }; moved = true; }
        if (typeof s.textShadow === "string" && want("shadow", n.id) && coloursIn(s.textShadow).some((x) => colourKey(x) === from)) { r = { ...r, textShadow: swapIn(s.textShadow, from, lit) }; moved = true; }
        const st = s.textStroke as { w: number; color: string } | undefined;
        if (st && hits(st.color) && want("border", n.id)) { r = { ...r, textStroke: { ...st, color: lit } }; moved = true; }
        return r;
      });
      if (moved) touch({ content: runs } as Partial<N>);
    }
    const e = next.edge;
    if (e) {
      let edge = e;
      if ((e.width ?? 1) > 0 && e.style !== "none" && hits(e.colour) && want("border", n.id)) edge = { ...edge, colour: to };
      if (e.shadow && want("shadow", n.id) && coloursIn(e.shadow).some((x) => colourKey(x) === from)) edge = { ...edge, shadow: swapIn(e.shadow, from, lit) };
      if (edge !== e) touch({ edge } as Partial<N>);
    }
    const a = next.art;
    if (a) {
      let art = a;
      if (a.textShadow && want("shadow", n.id) && coloursIn(a.textShadow).some((x) => colourKey(x) === from)) art = { ...art, textShadow: swapIn(a.textShadow, from, lit) };
      if (a.textStroke && hits(a.textStroke.color) && want("border", n.id)) art = { ...art, textStroke: { ...a.textStroke, color: lit } };
      if (a.background && want("fill", n.id) && coloursIn(a.background).some((x) => colourKey(x) === from)) art = { ...art, background: swapIn(a.background, from, lit) };
      if (art !== a) touch({ art } as Partial<N>);
    }
    if (next.aura && hits(next.aura) && want("shadow", n.id)) touch({ aura: to } as Partial<N>);
    return next;
  });
  const pageBg = palette.bg && colourKey(palette.bg) === from && want("fill", PAGE_ID) ? lit : null;
  if (pageBg) changed.add(PAGE_ID);
  return { nodes: out, pageBg, changed: [...changed] };
}

/* ------------------------------------------------------------------ */
/* Faces                                                               */
/* ------------------------------------------------------------------ */

/** The key a part's face is counted under: its own face, its family, or the site's type. */
export const SITE_TYPE = "";
export function faceOf(n: Worn): string {
  const f = n.font;
  return (f?.face?.trim().replace(/['"]/g, "") || f?.family || SITE_TYPE);
}
const hasWords = (n: Worn) => (typeof n.content === "string" ? n.content.trim().length > 0 : Array.isArray(n.content) && n.content.length > 0);

export interface SiteFont {
  /** The face or family name, or "" for the site's own type. */
  key: string;
  parts: number;
  ids: string[];
  /** Sizes and weights it is set at, so the row can say how it is used. */
  sizes: number[];
  weights: number[];
}

/** Every face that sets words on the site, with the parts set in it. Runs in another face count their part too. */
export function tallyFonts(nodes: readonly Worn[]): SiteFont[] {
  const map = new Map<string, SiteFont>();
  const put = (key: string, n: Worn) => {
    const hit = map.get(key) ?? { key, parts: 0, ids: [], sizes: [], weights: [] };
    if (!hit.ids.includes(n.id)) { hit.ids.push(n.id); hit.parts++; }
    if (typeof n.font?.size === "number" && !hit.sizes.includes(n.font.size)) hit.sizes.push(n.font.size);
    if (typeof n.font?.weight === "number" && !hit.weights.includes(n.font.weight)) hit.weights.push(n.font.weight);
    map.set(key, hit);
  };
  for (const n of nodes) {
    if (!hasWords(n) && !n.font) continue;
    put(faceOf(n), n);
    if (Array.isArray(n.content)) for (const s of n.content as { face?: string }[]) if (s?.face) put(s.face.replace(/['"]/g, ""), n);
  }
  return [...map.values()].sort((a, b) => b.parts - a.parts || a.key.localeCompare(b.key));
}

/** A face to set: a real face by name (carried with the site), or one of the app's families. */
export type FaceTo = { face: string } | { family: string } | { site: true };

/**
 * Set every part (and run) that is in `from` in `to` instead, and nothing
 * else. The page's stack goes with the old face: it names that face first,
 * and a stack wins over a face (`applyFont`), so leaving it would leave the
 * part in the old face.
 */
export function swapFont<N extends Worn>(
  nodes: readonly N[],
  from: string,
  to: FaceTo,
  only?: ReadonlySet<string>,
  /** Size, weight, spacing or leading to set on them too, when the change was more than the face. */
  patch: Partial<Pick<NonNullable<Worn["font"]>, "size" | "weight" | "spacing">> & { leading?: number } = {},
): { nodes: N[]; changed: string[] } {
  const sameFace = ("face" in to && to.face === from) || ("family" in to && to.family === from) || ("site" in to && from === SITE_TYPE);
  const changed: string[] = [];
  const out = nodes.map((n) => {
    if (only && !only.has(n.id)) return n;
    let next: N = n;
    if ((hasWords(n) || n.font) && faceOf(n) === from) {
      const was = (n.font ?? {}) as NonNullable<Worn["font"]> & { leading?: number };
      let font: Record<string, unknown>;
      if (sameFace) font = { ...was, ...patch };
      else {
        /* The page's stack names the old face first and wins over a face, so it goes with it. */
        const { face: _f, family: _fam, stack: _s, ...rest } = was;
        void _f; void _fam; void _s;
        font = { ...rest, ...patch, ...("face" in to ? { face: to.face } : "family" in to ? { family: to.family } : {}) };
      }
      const same = JSON.stringify(font) === JSON.stringify(was);
      if (!same) next = { ...next, font: Object.keys(font).length ? font : null } as N;
    }
    if (!sameFace && Array.isArray(n.content) && n.content.some((s: { face?: string }) => s?.face?.replace(/['"]/g, "") === from)) {
      const runs = (n.content as { face?: string }[]).map((s) => {
        if (s?.face?.replace(/['"]/g, "") !== from) return s;
        const { face: _f, ...r } = s;
        void _f;
        return "face" in to ? { ...r, face: to.face } : r;
      });
      next = { ...next, content: runs } as N;
    }
    if (next !== n) changed.push(n.id);
    return next;
  });
  return { nodes: out, changed };
}

/* ------------------------------------------------------------------ */
/* What one part's edit changed, for "every part like it"              */
/* ------------------------------------------------------------------ */

/**
 * The colours one part moved from and to since `before`, each with the use it
 * was moved for: its words from the near-black to white is `text`, its border
 * from ink to red is `border`. "Every part with this colour" swaps exactly
 * these, for exactly these uses, across the site.
 */
export function movedColours(before: Worn, after: Worn, palette: Partial<Palette> = {}): { from: string; to: string; use: ColourUse }[] {
  const was = new Map<string, { key: string; raw: string }>();
  for (const w of spotsOf(before, palette)) was.set(`${w.spot.use}|${w.spot.where}`, { key: w.key, raw: w.spot.role ? palette[w.spot.role] ?? w.raw : w.raw });
  const out = new Map<string, { from: string; to: string; use: ColourUse }>();
  for (const w of spotsOf(after, palette)) {
    const b = was.get(`${w.spot.use}|${w.spot.where}`);
    if (!b || b.key === w.key) continue;
    /* A role stays a role: the other parts follow it too, rather than a copy of what it is today. */
    const to = w.raw;
    out.set(`${w.spot.use}|${b.key}`, { from: b.raw, to, use: w.spot.use });
  }
  return [...out.values()];
}

/** The face (and size, weight, spacing, leading) one part moved from and to since `before`, or null. */
export function movedFont(before: Worn, after: Worn): { from: string; to: FaceTo; patch: Record<string, number> } | null {
  const b = (before.font ?? {}) as Record<string, unknown>, a = (after.font ?? {}) as Record<string, unknown>;
  const patch: Record<string, number> = {};
  for (const k of ["size", "weight", "spacing", "leading"]) if (typeof a[k] === "number" && a[k] !== b[k]) patch[k] = a[k] as number;
  const from = faceOf(before), now = faceOf(after);
  if (from === now && !Object.keys(patch).length) return null;
  const to: FaceTo = after.font?.face ? { face: now } : after.font?.family ? { family: now } : { site: true };
  return { from, to, patch };
}

/** How many parts follow each role right now, recounted rather than read off the import. */
export function roleFollowers(nodes: readonly Worn[]): Record<RoleId, number> {
  const out = Object.fromEntries(ROLES.map((r) => [r, new Set<string>()])) as Record<RoleId, Set<string>>;
  for (const n of nodes) {
    for (const v of Object.values(n.colour ?? {})) if (typeof v === "string" && isRole(v)) out[v].add(n.id);
    const ev = n.edge?.colour;
    if (typeof ev === "string" && isRole(ev)) out[ev].add(n.id);
    if (Array.isArray(n.content)) for (const s of n.content as { colour?: string }[]) if (s && typeof s.colour === "string" && isRole(s.colour)) out[s.colour].add(n.id);
  }
  return Object.fromEntries(ROLES.map((r) => [r, out[r].size])) as Record<RoleId, number>;
}

/* ------------------------------------------------------------------ */
/* Close shades, merged                                                */
/* ------------------------------------------------------------------ */

/** Distance in OKLab, where 0.02 is a shade most people cannot tell apart side by side. */
export function oklabDistance(a: string, b: string): number {
  const x = parseColor(a), y = parseColor(b);
  if (!x || !y) return Infinity;
  const lab = (c: { l: number; c: number; h: number }) => [c.l, c.c * Math.cos((c.h * Math.PI) / 180), c.c * Math.sin((c.h * Math.PI) / 180)];
  const [l1, a1, b1] = lab(x), [l2, a2, b2] = lab(y);
  return Math.hypot(l1! - l2!, a1! - a2!, b1! - b2!);
}

/** The default "how close": shades nearer than this read as one colour. */
export const CLOSE_SHADES = 0.035;

export interface ShadeGroup {
  /** The shade the others become: the one most parts wear. */
  to: SiteColour;
  /** The shades that become it. */
  from: SiteColour[];
  /** Parts that would change, for this use. */
  parts: number;
}

/**
 * Colours of one use that sit within `within` of each other, grouped round
 * the one most parts wear. A site brought in carries dozens of near-copies
 * of one yellow (243,212,64 and 242,226,129 and 240,223,123 are three of
 * them), each worn by a part or two; merging makes them one colour to change.
 * Greedy and ordered by use, so the lead of a group is always its commonest.
 */
export function closeShades(list: readonly SiteColour[], use: ColourUse, within = CLOSE_SHADES): ShadeGroup[] {
  const sorted = [...list].filter((c) => c.key !== "" && parseColor(c.value)).sort((a, b) => b.by[use] - a.by[use] || a.key.localeCompare(b.key));
  const groups: { to: SiteColour; from: SiteColour[] }[] = [];
  for (const c of sorted) {
    /* A see-through colour is not a shade of an opaque one. */
    const alpha = (v: string) => (/^rgba\(/.test(colourKey(v)) ? Number(colourKey(v).split(",")[3]) : 1);
    const home = groups.find((g) => alpha(g.to.value) === alpha(c.value) && oklabDistance(g.to.value, c.value) <= within);
    if (home) home.from.push(c);
    else groups.push({ to: c, from: [] });
  }
  return groups.filter((g) => g.from.length).map((g) => ({
    ...g,
    parts: new Set(g.from.flatMap((c) => c.spots.filter((s) => use === "accent" || s.use === use).map((s) => s.id))).size,
  }));
}

/* ------------------------------------------------------------------ */
/* Words against what they sit on                                      */
/* ------------------------------------------------------------------ */

type Placed = Worn & { pageId?: string; x?: number; y?: number; w?: number; h?: number };

/**
 * How readable each part's words are against the fill they actually sit on:
 * the part's own fill, else the smallest part under it with one, else the
 * page. The two role swatches (Text against Background) are compared by the
 * mixer's badge, and on a site brought in those two roles are often never
 * worn together at all: trumpmorty.fun's "text 1.2" was near-black words
 * against a near-black role no word sits on. This measures what is worn.
 */
export function wordsContrast(nodes: readonly Placed[], palette: Partial<Palette> = {}): { id: string; ratio: number }[] {
  const read = (v: string | undefined | null) => {
    const s = (v ?? "").trim();
    if (!s) return null;
    const c = parseColor(isRole(s) ? palette[s] ?? "" : s);
    return c && !/^rgba\(.*,\s*0(\.0+)?\)$/.test(colourKey(isRole(s) ? palette[s] : s)) ? c : null;
  };
  const opaque = (n: Placed) => {
    const k = colourKey(n.colour?.bg && isRole(n.colour.bg) ? palette[n.colour.bg as RoleId] : n.colour?.bg);
    return !!k && !/^rgba\(/.test(k);
  };
  const filled = nodes.filter((n) => opaque(n) && (n.w ?? 0) > 0 && (n.h ?? 0) > 0);
  const page = read(palette.bg);
  const out: { id: string; ratio: number }[] = [];
  for (const n of nodes) {
    if (!hasWords(n)) continue;
    const ink = read(n.colour?.text);
    if (!ink) continue;
    let ground = opaque(n) ? read(n.colour?.bg) : null;
    if (!ground) {
      const under = filled
        .filter((m) => m.id !== n.id && m.pageId === n.pageId && (m.x ?? 0) <= (n.x ?? 0) + 1 && (m.y ?? 0) <= (n.y ?? 0) + 1 && (m.x ?? 0) + (m.w ?? 0) >= (n.x ?? 0) + (n.w ?? 0) - 1 && (m.y ?? 0) + (m.h ?? 0) >= (n.y ?? 0) + (n.h ?? 0) - 1)
        .sort((a, b) => a.w! * a.h! - b.w! * b.h!)[0];
      ground = under ? read(under.colour?.bg) : page;
    }
    if (!ground) continue;
    out.push({ id: n.id, ratio: Math.round(contrast(ink, ground) * 10) / 10 });
  }
  return out;
}
