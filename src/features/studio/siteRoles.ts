/**
 * The colours of a site the way a person thinks of them: a few roles, each
 * named in words, every count saying what it counts.
 *
 * HIS WORDS, on Trump & Morty: "Text 9 colours, Fills 39, Borders and
 * outlines 1 colour on 85 parts, Shadows and glows 11, Accents 26, Also on
 * this site 29 more. This is too much for a site; a few near-whites do not
 * need to be separate; not all fills or button colours need to be shown; I
 * cannot find the brown shadow buttons, the 85 borders and outlines, or the
 * 76 shadows; the background and pictures should not be counted, except
 * colours like the TV and every element on top of the background."
 *
 * So, read off the same spots `siteColours.ts` reads (`spotsOf`), but:
 *
 *   · ONLY WHAT IS ON TOP OF THE BACKGROUND. The page's own fill is left
 *     out, and so is a background layer: a part as wide as the page with
 *     other parts standing on it (a section band, a full-width picture
 *     behind a section). Its fill and its picture are scenery. A picture
 *     that is a part on top (the TV) adds its few main colours, sampled
 *     from the picture (`pictureColours`), never every pixel.
 *   · CLOSE SHADES ARE ONE SWATCH. Within a role, colours nearer than
 *     `MERGE_SHADES` in OKLab (a perceptual colour space) are one swatch,
 *     led by the one most parts wear, marked "3 shades" and openable.
 *   · A SHORT PALETTE FIRST. Up to eight roles a person thinks in (words,
 *     main fill, buttons, panels and cards, accent, outline, shadow,
 *     pictures on top), one or two swatches each; a colour worn by only one
 *     or two parts, and the rest, are under More.
 *   · EVERY COUNT SAYS WHAT IT IS: "Dark brown outline, 3 to 5 px, on 65
 *     parts", "Dark brown drop shadow on 69 parts".
 *
 * Pure: no store, no DOM. `tests/site-roles.mjs`.
 */
import { parseColor, type Palette } from "./look.ts";
import { colourKey, oklabDistance, spotsOf, type ColourSpot, type ColourUse, type Worn } from "./siteColours.ts";
import { insideControl } from "./partNames.ts";

/** Shades nearer than this in OKLab are one swatch: near-whites and creams, a yellow and its paler card. */
export const MERGE_SHADES = 0.05;
/** The most roles the short palette shows. */
export const ROLE_CAP = 8;
/** A colour worn by this many parts or fewer is under More. */
export const FEW = 2;

export type RoleKey = "words" | "main" | "buttons" | "panels" | "accent" | "outline" | "shadow" | "pictures";
export const ROLE_ORDER: readonly RoleKey[] = ["words", "main", "buttons", "panels", "accent", "outline", "shadow", "pictures"];
export const ROLE_LABEL: Record<RoleKey, string> = {
  words: "Words",
  main: "Main fill",
  buttons: "Buttons",
  panels: "Panels and cards",
  accent: "Accent",
  outline: "Outline",
  shadow: "Shadow",
  pictures: "Pictures on top",
};
/** The use a role recolours, in `swapColour`'s terms. */
export const ROLE_USE: Record<RoleKey, ColourUse> = {
  words: "text", main: "fill", buttons: "fill", panels: "fill", accent: "accent", outline: "border", shadow: "shadow", pictures: "fill",
};

export interface Part extends Worn {
  pageId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  featureId?: string;
  link?: unknown;
  prompt?: string;
  from?: { selector?: string } | null;
}

export interface RoleSwatch {
  /** Stable: `<role>|<lead colour key>`. */
  id: string;
  role: RoleKey;
  /** The lead shade: the one most parts wear. */
  value: string;
  /** Every shade the swatch stands for, the lead first (colour keys). */
  shades: string[];
  /** The parts wearing it in this role, and where on each. */
  spots: ColourSpot[];
  parts: number;
  /** The plain sentence: "Dark brown outline, 4 px, on 65 parts". */
  says: string;
  /** Spots that are a picture's colour: shown, never recoloured (the picture is a picture). */
  fromPictures: number;
}

export interface SiteRoles {
  /** The short palette: one row per role, up to `ROLE_CAP`, one or two swatches each. */
  short: { role: RoleKey; swatches: RoleSwatch[] }[];
  /** Everything else, by role. */
  more: RoleSwatch[];
  /** What was left out, and why, so the panel can say it. */
  left: { backgroundLayers: string[]; backgroundPictures: number; page: boolean };
}

/* ------------------------------------------------------------------ */
/* What is background                                                  */
/* ------------------------------------------------------------------ */

/** A colour's opacity, 1 when it has none written. */
function alphaOf(v: string): number {
  const m = /^rgba\([^,]+,[^,]+,[^,]+,\s*([\d.]+)\s*\)$/.exec(colourKey(v));
  return m ? Number(m[1]) : 1;
}

const area = (p: Part) => Math.max(0, p.w ?? 0) * Math.max(0, p.h ?? 0);
const holds = (outer: Part, inner: Part) => {
  const ox = outer.x ?? 0, oy = outer.y ?? 0, ix = inner.x ?? 0, iy = inner.y ?? 0;
  const w = Math.max(0, Math.min(ox + (outer.w ?? 0), ix + (inner.w ?? 0)) - Math.max(ox, ix));
  const h = Math.max(0, Math.min(oy + (outer.h ?? 0), iy + (inner.h ?? 0)) - Math.max(oy, iy));
  return area(inner) > 0 && (w * h) / area(inner) >= 0.8;
};

/**
 * The parts that are the site's background: as wide as the page (90% of the
 * frame or more) with other, smaller parts standing on them. A section band,
 * a full-width picture behind a section, the page's own wrapper.
 */
export function backgroundLayers(parts: readonly Part[], frameWidth: number): Set<string> {
  const out = new Set<string>();
  const byPage = new Map<string, Part[]>();
  for (const p of parts) byPage.set(p.pageId ?? "", [...(byPage.get(p.pageId ?? "") ?? []), p]);
  for (const page of byPage.values()) {
    for (const p of page) {
      if ((p.w ?? 0) < frameWidth * 0.9) continue;
      if (page.some((q) => q !== p && area(q) < area(p) * 0.9 && holds(p, q))) out.add(p.id);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Words for a colour                                                  */
/* ------------------------------------------------------------------ */

const HUES: [number, string][] = [[15, "pink"], [45, "red"], [70, "orange"], [105, "yellow"], [135, "lime"], [165, "green"], [200, "teal"], [235, "sky blue"], [275, "blue"], [310, "purple"], [345, "magenta"], [360, "pink"]];

/** A colour in the words a person would use: "Dark brown", "Near-white", "Cream", "Red". */
export function colourName(v: string): string {
  const c = parseColor(v);
  if (!c) return "This colour";
  const { l, c: ch, h } = c;
  /* A dark colour reads as its hue at far less colour than a light one: rgb(26, 15, 11) is a brown to the eye, not a black. */
  if (ch < (l < 0.35 ? 0.01 : 0.025)) {
    if (l < 0.22) return "Near-black";
    if (l > 0.93) return "Near-white";
    return l < 0.5 ? "Dark grey" : "Light grey";
  }
  const hue = HUES.find(([to]) => h < to)?.[1] ?? "pink";
  if ((hue === "orange" || hue === "yellow" || hue === "red") && l < 0.45) return l < 0.25 ? "Dark brown" : "Brown";
  if (hue === "yellow" && l > 0.9 && ch < 0.08) return "Cream";
  const tone = l < 0.4 ? "Dark " : l > 0.85 && ch < 0.1 ? "Pale " : "";
  const word = `${tone}${hue}`;
  return word.charAt(0).toUpperCase() + word.slice(1);
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** Widths of the outlines a set of parts draws, as "4 px" or "3 to 5 px". */
function widths(parts: readonly Part[]): string {
  const w = [...new Set(parts.map((p) => Number((p.edge as { width?: number } | null)?.width)).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  if (!w.length) return "";
  return w.length === 1 ? `${w[0]} px` : `${w[0]} to ${w[w.length - 1]} px`;
}

/** Whether the shadows a set of parts casts are hard drop shadows (no blur) or soft glows. */
function shadowKind(parts: readonly Part[]): string {
  const css = parts.map((p) => `${(p.edge as { shadow?: string } | null)?.shadow ?? ""} ${(p.art as { textShadow?: string } | null)?.textShadow ?? ""}`).join(" ");
  const lens = [...css.matchAll(/(-?[\d.]+)px\s+(-?[\d.]+)px\s+([\d.]+)px/g)].map((m) => ({ off: Math.abs(Number(m[1])) + Math.abs(Number(m[2])), blur: Number(m[3]) }));
  if (!lens.length) return "shadow";
  const hard = lens.filter((x) => x.blur <= 1 && x.off > 0).length;
  const glow = lens.filter((x) => x.off === 0 && x.blur > 0).length;
  return hard >= lens.length / 2 ? "drop shadow" : glow >= lens.length / 2 ? "glow" : "soft shadow";
}

function sentence(role: RoleKey, value: string, parts: readonly Part[], spots: readonly ColourSpot[], shades: number): string {
  const name = colourName(value);
  const n = new Set(spots.map((s) => s.id)).size;
  const on = `on ${plural(n, "part")}`;
  const more = shades > 1 ? ` (${shades} shades)` : "";
  switch (role) {
    case "words": return `${name} words ${on}${more}`;
    case "main": return `${name} main fill ${on}${more}`;
    case "buttons": return `${name} buttons: ${plural(n, "button")}${more}`;
    case "panels": return `${name} panels and cards ${on}${more}`;
    case "accent": return `${name} accent ${on}${more}`;
    case "outline": {
      const letters = new Set(spots.filter((s) => /letter|words/.test(s.where)).map((s) => s.id)).size;
      const boxes = parts.filter((p) => spots.some((s) => s.id === p.id && s.where === "border"));
      const wide = widths(boxes);
      return `${name} outline${wide ? `, ${wide},` : ""} ${on}${letters ? `, ${letters} of them round the words` : ""}${more}`;
    }
    case "shadow": return `${name} ${shadowKind(parts)} ${on}${more}`;
    case "pictures": return `${name} in ${plural(n, "picture")} on top of the page${more}`;
  }
}

/* ------------------------------------------------------------------ */
/* The roles                                                           */
/* ------------------------------------------------------------------ */

const BUTTON_PARTS = new Set(["cta-primary", "quick-action", "follow", "magnetic-buttons", "copy-button"]);
const isButton = (p: Part) => BUTTON_PARTS.has(p.featureId ?? "") || !!p.link || insideControl({ from: p.from ?? null, prompt: p.prompt, link: p.link as never });

interface Entry { key: string; value: string; spots: ColourSpot[]; area: number }

/** One role's colours as swatches: close shades merged round the one most parts wear. */
function cluster(role: RoleKey, entries: Entry[], byId: Map<string, Part>, within: number): RoleSwatch[] {
  const parts = (e: Entry) => new Set(e.spots.map((s) => s.id)).size;
  const sorted = [...entries].sort((a, b) => parts(b) - parts(a) || b.area - a.area || a.key.localeCompare(b.key));
  const groups: Entry[][] = [];
  for (const e of sorted) {
    const home = groups.find((g) => oklabDistance(g[0]!.value, e.value) < within);
    if (home) home.push(e); else groups.push([e]);
  }
  return groups.map((g) => {
    const spots = g.flatMap((e) => e.spots);
    const ids = [...new Set(spots.map((s) => s.id))];
    const ps = ids.map((id) => byId.get(id)).filter((p): p is Part => !!p);
    return {
      id: `${role}|${g[0]!.key}`,
      role,
      value: g[0]!.value,
      shades: g.map((e) => e.key),
      spots,
      parts: ids.length,
      says: sentence(role, g[0]!.value, ps, spots, g.length),
      fromPictures: spots.filter((s) => s.where === "in its picture").length,
    };
  });
}

/**
 * The site's colours by role. `pictureColours` gives, per picture part, its
 * few main colours (sampled in the browser); a part without an entry adds
 * none.
 */
export function siteRoles(
  parts: readonly Part[],
  palette: Partial<Palette>,
  frameWidth: number,
  pictureColours: ReadonlyMap<string, readonly string[]> = new Map(),
  within = MERGE_SHADES,
): SiteRoles {
  const back = backgroundLayers(parts, frameWidth);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const pools: Record<RoleKey, Map<string, Entry>> = Object.fromEntries(ROLE_ORDER.map((r) => [r, new Map()])) as Record<RoleKey, Map<string, Entry>>;
  const put = (role: RoleKey, key: string, value: string, spot: ColourSpot, p: Part) => {
    const e = pools[role].get(key) ?? { key, value, spots: [], area: 0 };
    if (!e.spots.some((s) => s.id === spot.id && s.where === spot.where)) e.spots.push(spot);
    e.area += area(p);
    pools[role].set(key, e);
  };
  let backgroundPictures = 0;
  const fills: { key: string; value: string; spot: ColourSpot; p: Part }[] = [];
  for (const p of parts) {
    const behind = back.has(p.id);
    if (behind && p.picture) backgroundPictures++;
    for (const w of spotsOf(p, palette)) {
      const value = w.spot.role ? palette[w.spot.role] ?? w.raw : w.raw;
      if (!parseColor(value)) continue;
      /* A see-through colour paints a tint of what is under it, not itself: left to the full list. */
      if (alphaOf(value) < 0.5) continue;
      const u = w.spot.use;
      if (u === "fill") {
        if (behind) continue;
        if (isButton(p)) put("buttons", w.key, value, w.spot, p);
        else fills.push({ key: w.key, value, spot: w.spot, p });
      } else if (u === "text") put("words", w.key, value, w.spot, p);
      else if (u === "border") put("outline", w.key, value, w.spot, p);
      else if (u === "shadow") put("shadow", w.key, value, w.spot, p);
      /* An accent is a colour that stands out, never a grey: a grey in an accent slot is left to the full list. */
      else if (u === "accent" && (parseColor(value)?.c ?? 0) >= 0.05) put("accent", w.key, value, w.spot, p);
    }
    if (p.picture && !behind) {
      for (const c of (pictureColours.get(p.id) ?? []).slice(0, 3)) {
        const key = colourKey(c);
        if (key) put("pictures", key, c, { id: p.id, use: "fill", where: "in its picture" }, p);
      }
    }
  }
  /* The main fill is the fill covering the most of what stands on the background; the other fills are panels and cards. */
  const fillPool = new Map<string, Entry>();
  for (const f of fills) {
    const e = fillPool.get(f.key) ?? { key: f.key, value: f.value, spots: [], area: 0 };
    e.spots.push(f.spot);
    e.area += area(f.p);
    fillPool.set(f.key, e);
  }
  const fillSwatches = cluster("panels", [...fillPool.values()], byId, within);
  const areaOf = (s: RoleSwatch) => s.shades.reduce((n, k) => n + (fillPool.get(k)?.area ?? 0), 0);
  const main = [...fillSwatches].sort((a, b) => areaOf(b) - areaOf(a))[0];
  const swatches: Record<RoleKey, RoleSwatch[]> = Object.fromEntries(ROLE_ORDER.map((r) => [r, [] as RoleSwatch[]])) as Record<RoleKey, RoleSwatch[]>;
  for (const s of fillSwatches) {
    const role: RoleKey = s === main ? "main" : "panels";
    const ps = [...new Set(s.spots.map((x) => x.id))].map((id) => byId.get(id)!).filter(Boolean);
    swatches[role].push({ ...s, id: `${role}|${s.shades[0]}`, role, says: sentence(role, s.value, ps, s.spots, s.shades.length) });
  }
  for (const r of ROLE_ORDER) if (r !== "main" && r !== "panels") swatches[r] = cluster(r, [...pools[r].values()], byId, within);

  const short: SiteRoles["short"] = [];
  const more: RoleSwatch[] = [];
  for (const r of ROLE_ORDER) {
    const list = swatches[r].sort((a, b) => b.parts - a.parts);
    const many = list.filter((s) => s.parts > FEW);
    /* One or two per role: the second only when it is worn by a fair share of the role, never a one-off. */
    const total = list.reduce((n, s) => n + s.parts, 0);
    const shown = many.slice(0, 1).concat(many.slice(1, 2).filter((s) => s.parts >= Math.max(FEW + 1, total * 0.2)));
    /* Two in a row with one name say which is which. */
    if (shown.length === 2 && colourName(shown[0]!.value) === colourName(shown[1]!.value)) {
      const [a, b] = shown as [RoleSwatch, RoleSwatch];
      const lighter = (parseColor(a.value)?.l ?? 0) >= (parseColor(b.value)?.l ?? 0) ? a : b;
      for (const x of shown) x.says = x.says.replace(/^(\S+)/, `$1 (${x === lighter ? "lighter" : "darker"})`);
    }
    if (shown.length && short.length < ROLE_CAP) short.push({ role: r, swatches: shown });
    else shown.length = 0;
    more.push(...list.filter((s) => !shown.includes(s)));
  }
  return { short, more, left: { backgroundLayers: [...back], backgroundPictures, page: !!palette.bg } };
}

/* ------------------------------------------------------------------ */
/* A picture's main colours                                            */
/* ------------------------------------------------------------------ */

/**
 * The few colours a picture is mostly made of, from its pixels (RGBA, as a
 * canvas gives them): coarse buckets, near ones merged, the ones covering at
 * least `floor` of the opaque pixels, most first. Transparent pixels and the
 * picture's own near-white or near-black matting are not its colours when
 * they are only a rim.
 */
export function mainColours(rgba: ArrayLike<number>, max = 3, floor = 0.08): string[] {
  const buckets = new Map<string, { r: number; g: number; b: number; n: number }>();
  let opaque = 0;
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 200) continue;
    opaque++;
    const k = `${rgba[i]! >> 4},${rgba[i + 1]! >> 4},${rgba[i + 2]! >> 4}`;
    const b = buckets.get(k) ?? { r: 0, g: 0, b: 0, n: 0 };
    b.r += rgba[i]!; b.g += rgba[i + 1]!; b.b += rgba[i + 2]!; b.n++;
    buckets.set(k, b);
  }
  if (!opaque) return [];
  const cols = [...buckets.values()].map((b) => ({ v: `rgb(${Math.round(b.r / b.n)}, ${Math.round(b.g / b.n)}, ${Math.round(b.b / b.n)})`, n: b.n })).sort((a, b) => b.n - a.n);
  const merged: { v: string; n: number }[] = [];
  for (const c of cols) {
    const near = merged.find((m) => oklabDistance(m.v, c.v) < MERGE_SHADES * 2);
    if (near) near.n += c.n; else merged.push({ ...c });
  }
  return merged.filter((m) => m.n / opaque >= floor).sort((a, b) => b.n - a.n).slice(0, max).map((m) => m.v);
}
