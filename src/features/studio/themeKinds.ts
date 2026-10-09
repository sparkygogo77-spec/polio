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
 *
 * Pure: no store, no DOM. `tests/theme-kinds.mjs`.
 */
import { colourKey, coloursIn, faceOf, oklabDistance, parseColor, spotsOf, type Palette, type Worn } from "./look/index.ts";
import { isButton, type Part } from "./siteRoles.ts";

/** Closer than the palette merges: a cream card and a grey field are two kinds of surface even where they are one swatch. */
export const KIND_SHADES = 0.025;
/** Surfaces whose middle part is smaller than this both ways are decoration. */
export const SPECK = 48;
/** A strip this tall or less is a tab or label bar. */
export const TAB_HEIGHT = 40;

export interface SurfaceKind {
  /** The lead fill. */
  fill: string;
  /** What it is for, never its colour (J, 2026-10-09): "Main fill" for the most-worn surface, then "Panels", "Fields", "Buttons" and so on. */
  name: string;
  /** Parts wearing it as their own fill. */
  parts: number;
  /** Their ids: one edit recolours every one of them. */
  ids: string[];
  /** Every shade of the fill they wear (close shades are one kind). */
  shades: string[];
  /** The colours of its gradient, light first, when the kind is painted with one: one button, not one per stop. */
  stops: string[];
  /** Parts whose words stand on it (itself included). */
  wordsIds: string[];
  /** The glow on those words (a coloured shadow behind the letters), the most-worn one. */
  glow: string | null;
  /** The face key the words are counted under (`faceOf`), for swapping. */
  faceKey: string | null;
  /** A few of its own words, so a button in the preview says what the site's buttons say. */
  sample: string | null;
  /** Its parts' middle width and height, in px. */
  w: number;
  h: number;
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
  /** For a button kind, the index of the kind most of its parts stand in (-1: the page). */
  inside: number;
}

export interface SiteKinds {
  page: { fill: string; words: string | null; face: string | null; faceKey: string | null; wordsIds: string[]; glow: string | null };
  kinds: SurfaceKind[];
}

/** What a part is, in a word, by the shelf part it landed as. */
const WHAT: Record<string, string> = { box: "Panels", card: "Cards", field: "Fields", prose: "Labels", heading: "Headings", "cta-primary": "Buttons", picture: "Pictures" };
const wordsOf = (p: Node): string => {
  const c = (p as { content?: unknown }).content;
  const t = typeof c === "string" ? c : Array.isArray(c) ? c.map((r) => (r && typeof r === "object" && typeof (r as { text?: unknown }).text === "string" ? (r as { text: string }).text : "")).join("") : "";
  return t.replace(/\s+/g, " ").trim();
};

type Node = Part & { radius?: number | null; state?: { group?: string } | null; edge?: { width?: number; colour?: string; style?: string; shadow?: string } | null };

const area = (p: Node) => Math.max(0, p.w ?? 0) * Math.max(0, p.h ?? 0);
const holds = (o: Node, i: Node) => {
  const w = Math.max(0, Math.min((o.x ?? 0) + (o.w ?? 0), (i.x ?? 0) + (i.w ?? 0)) - Math.max(o.x ?? 0, i.x ?? 0));
  const h = Math.max(0, Math.min((o.y ?? 0) + (o.h ?? 0), (i.y ?? 0) + (i.h ?? 0)) - Math.max(o.y ?? 0, i.y ?? 0));
  return area(i) > 0 && (w * h) / area(i) >= 0.8;
};
const alpha = (v: string) => { const m = /rgba\([^)]*,\s*([\d.]+)\s*\)$/.exec(v.replace(/\s+/g, " ")); return m ? Number(m[1]) : 1; };
const top = <T,>(m: Map<T, number>): [T, number] | null => [...m.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
const bump = <T,>(m: Map<T, number>, k: T, by = 1) => m.set(k, (m.get(k) ?? 0) + by);

/** At most `cap` kinds, the most-worn first, buttons and surfaces both. */
export function siteKinds(nodes: readonly Worn[], palette: Partial<Palette>, background: ReadonlySet<string> = new Set(), cap = 8): SiteKinds {
  const parts = nodes as readonly Node[];
  const fillOf = new Map<string, string>();
  for (const p of parts) {
    if (background.has(p.id)) continue;
    /* Its own fill, else its gradient's body (the last stop: a button's light is the first). */
    const spots = spotsOf(p, palette).filter((s) => s.spot.use === "fill" && alpha(s.key) >= 0.6);
    const f = spots.find((s) => s.spot.where === "fill" || s.spot.where === "surface") ?? spots.filter((s) => s.spot.where === "in a gradient").pop();
    if (f && parseColor(f.key)) fillOf.set(p.id, f.key);
  }
  /* Kinds: fills clustered, the most-worn first. */
  const count = new Map<string, number>();
  for (const k of fillOf.values()) bump(count, k);
  const leads: { fill: string; members: Set<string> }[] = [];
  const kindOfFill = new Map<string, number>();
  for (const [k] of [...count.entries()].sort((a, b) => b[1] - a[1])) {
    let i = leads.findIndex((g) => oklabDistance(g.fill, k) < KIND_SHADES);
    if (i < 0) { leads.push({ fill: k, members: new Set() }); i = leads.length - 1; }
    kindOfFill.set(k, i);
  }
  for (const [id, k] of fillOf) leads[kindOfFill.get(k)!]!.members.add(id);
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
  const kindOf = (q: Node) => kindOfFill.get(fillOf.get(q.id)!)!;
  const container = (p: Node): number => {
    let best: Node | null = null;
    for (const q of filled) {
      if (q === p || q.pageId !== p.pageId || (q.state?.group ?? "") !== (p.state?.group ?? "") || area(q) <= area(p) || !holds(q, p)) continue;
      const k = kindOf(q);
      if (k === kindOf(p) || leads[k]!.members.size < 3) continue;
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
  const faceKeys = leads.map(() => new Map<string, number>());
  const samples = leads.map(() => new Map<string, number>());
  const pageIds: string[] = [];
  const pageGlows = new Map<string, number>();
  const pageFaceKeys = new Map<string, number>();
  for (const p of parts) {
    if (background.has(p.id)) continue;
    const t = spotsOf(p, palette).find((s) => s.spot.use === "text");
    if (!t) continue;
    const u = under(p);
    const i = u ? kindOfFill.get(fillOf.get(u.id)!)! : -1;
    bump(i < 0 ? pageWords : words[i]!, t.key);
    bump(i < 0 ? pageFaces : faces[i]!, (p as { font?: { stack?: string } | null }).font?.stack || faceOf(p));
    (i < 0 ? pageIds : wordsIds[i]!).push(p.id);
    bump(i < 0 ? pageFaceKeys : faceKeys[i]!, faceOf(p));
    for (const g of spotsOf(p, palette).filter((s) => s.spot.use === "shadow" && /words|letter/.test(s.spot.where))) bump(i < 0 ? pageGlows : glows[i]!, g.key);
    const w = wordsOf(p);
    /* Its own parts' words first (a trade button's "10%"), then words standing on it; a label, not a sentence. */
    if (i >= 0 && w && w.length <= 24 && (u === p || /[A-Za-z]{2}/.test(w))) bump(samples[i]!, w, u === p ? 1000 : 1);
  }
  const kinds: SurfaceKind[] = leads.map((g, i) => {
    const ms = parts.filter((p) => g.members.has(p.id));
    const outlines = new Map<string, number>();
    const shadows = new Map<string, number>();
    const paints = new Map<string, number>();
    const radii = new Map<number, number>();
    const inside = new Map<number, number>();
    let buttons = 0;
    const what = new Map<string, number>();
    for (const p of ms) {
      bump(what, WHAT[p.featureId ?? ""] ?? "parts");
      const e = p.edge;
      if (e && (e.width ?? 1) > 0 && e.style !== "none" && e.colour) {
        const c = spotsOf({ id: p.id, edge: e } as Worn, palette).find((s) => s.spot.use === "border");
        if (c) bump(outlines, `${c.key}|${e.width ?? 1}`);
      }
      if (e?.shadow) bump(shadows, e.shadow);
      const bg = (p as { art?: { background?: string } | null }).art?.background;
      if (bg && /gradient\(/.test(bg)) bump(paints, bg);
      bump(radii, Number(p.radius ?? 0) < 1 ? 0 : Math.round(Number(p.radius)));
      if (isButton(p)) buttons++;
      bump(inside, container(p));
    }
    const o = top(outlines);
    const w = top(words[i]!);
    const paint = (() => { const g = top(paints); return g && g[1] >= ms.length / 2 ? g[0] : leads[i]!.fill; })();
    const mid = (f: (p: Node) => number) => ms.map(f).sort((a, b) => a - b)[ms.length >> 1] ?? 0;
    const midW = mid((p) => p.w ?? 0), midH = mid((p) => p.h ?? 0);
    const isButtons = buttons >= ms.length / 2;
    return {
      w: midW,
      h: midH,
      tab: !isButtons && midH > 0 && midH <= TAB_HEIGHT && top(what)?.[0] !== "Fields",
      fill: g.fill,
      name: buttons >= ms.length / 2 ? "Buttons" : top(what)?.[0] ?? "Parts",
      parts: ms.length,
      ids: ms.map((p) => p.id),
      shades: [...new Set(ms.map((p) => fillOf.get(p.id)!))],
      stops: /gradient\(/.test(paint) ? [...new Set(coloursIn(paint).map(colourKey))] : [],
      wordsIds: wordsIds[i]!,
      glow: top(glows[i]!)?.[0] ?? null,
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
     all specks (a TV's antenna balls) is decoration, not a kind of panel anyone reads the site by. */
  const kept = kinds.map((k, i) => ({ k, i })).filter(({ k }) => k.parts >= 3 && (k.button || Math.max(k.w, k.h) >= SPECK)).slice(0, cap);
  const at = new Map(kept.map(({ i }, j) => [i, j]));
  /* Names by role: the most-worn surface is the main fill; the rest by what they are, numbered when two share a name. */
  const seen = new Map<string, number>();
  const named = kept.map(({ k }, j) => {
    const base = !k.button && j === kept.findIndex(({ k: x }) => !x.button) ? "Main fill" : k.name;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return { ...k, name: n > 1 ? `${base} ${n}` : base, inside: at.get(k.inside) ?? -1 };
  });
  return {
    page: { fill: palette.bg ?? "#ffffff", words: top(pageWords)?.[0] ?? null, face: top(pageFaces)?.[0] ?? null, faceKey: top(pageFaceKeys)?.[0] ?? null, wordsIds: pageIds, glow: top(pageGlows)?.[0] ?? null },
    kinds: named,
  };
}
