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
 *
 * Pure: no store, no DOM. `tests/theme-kinds.mjs`.
 */
import { faceOf, oklabDistance, parseColor, spotsOf, type Palette, type Worn } from "./look/index.ts";
import { colourName, isButton, type Part } from "./siteRoles.ts";

/** Closer than the palette merges: a cream card and a grey field are two kinds of surface even where they are one swatch. */
export const KIND_SHADES = 0.025;

export interface SurfaceKind {
  /** The lead fill. */
  fill: string;
  /** "Dark brown labels": its colour and what most of its parts are. */
  name: string;
  /** Parts wearing it as their own fill. */
  parts: number;
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
  page: { fill: string; words: string | null; face: string | null };
  kinds: SurfaceKind[];
}

/** What a part is, in a word, by the shelf part it landed as. */
const WHAT: Record<string, string> = { box: "panels", card: "cards", field: "fields", prose: "labels", heading: "headings", "cta-primary": "buttons", picture: "pictures" };

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
  for (const p of parts) {
    if (background.has(p.id)) continue;
    const t = spotsOf(p, palette).find((s) => s.spot.use === "text");
    if (!t) continue;
    const u = under(p);
    const i = u ? kindOfFill.get(fillOf.get(u.id)!)! : -1;
    bump(i < 0 ? pageWords : words[i]!, t.key);
    bump(i < 0 ? pageFaces : faces[i]!, (p as { font?: { stack?: string } | null }).font?.stack || faceOf(p));
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
      bump(radii, Math.round(Number(p.radius ?? 0)));
      if (isButton(p)) buttons++;
      bump(inside, container(p));
    }
    const o = top(outlines);
    const w = top(words[i]!);
    return {
      fill: g.fill,
      name: `${colourName(g.fill)} ${buttons >= ms.length / 2 ? "buttons" : top(what)?.[0] ?? "parts"}`,
      parts: ms.length,
      button: buttons >= ms.length / 2,
      words: w?.[0] ?? null,
      wordsParts: w?.[1] ?? 0,
      face: top(faces[i]!)?.[0] ?? null,
      /* Half the parts or more draw it, or it is not this kind's outline. */
      outline: o && o[1] >= ms.length / 2 ? { colour: o[0].split("|")[0]!, width: Number(o[0].split("|")[1]) } : null,
      paint: (() => { const g = top(paints); return g && g[1] >= ms.length / 2 ? g[0] : leads[i]!.fill; })(),
      shadow: (() => { const s = top(shadows); return s && s[1] >= ms.length / 2 ? s[0] : null; })(),
      radius: top(radii)?.[0] ?? 0,
      /* Where a third of its parts or more stand inside a kind, it is shown there: the page is only the fallback. */
      inside: (() => { const k = top(new Map([...inside].filter(([x]) => x >= 0))); return k && k[1] >= ms.length / 3 ? k[0] : -1; })(),
    };
  });
  /* Keep the kinds worn by three parts or more, and re-point `inside` at the kept list. */
  const kept = kinds.map((k, i) => ({ k, i })).filter(({ k }) => k.parts >= 3).slice(0, cap);
  const at = new Map(kept.map(({ i }, j) => [i, j]));
  return {
    page: { fill: palette.bg ?? "#ffffff", words: top(pageWords)?.[0] ?? null, face: top(pageFaces)?.[0] ?? null },
    kinds: kept.map(({ k }) => ({ ...k, inside: at.get(k.inside) ?? -1 })),
  };
}
