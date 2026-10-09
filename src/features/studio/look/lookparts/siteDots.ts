/**
 * A SITE'S OWN DOTS, READ AS ITS PAGE TEXTURE.
 *
 * J (2026-10-09): PonsStars' page is cream with faint dots, drawn by its own
 * CSS (`[data-hook="app"] { background: radial-gradient(dots 15%,
 * transparent 16%) 0 0 / 18px 18px, cream }`). Brought in, the page part
 * carries that gradient on `art.background`, so the Texture row said None
 * while dots were plainly there; picking Dots then laid a second set over
 * them, and None, or deleting every layer, never took them away.
 *
 * Here that one pattern (a radial gradient that is a colour up to a stop and
 * clear after it, tiled) is read as a Dots texture: its colour, how solid
 * and its tile size. The Texture row shows it as the page's, its dials
 * rewrite the same gradient (so what goes back to the site is its own CSS,
 * changed), and None takes the gradient off the part.
 *
 * Pure: no store, no React. `tests/site-dots-texture.mjs` holds it.
 */
export interface Art { background?: string; backgroundOptions?: string[]; [k: string]: unknown }

export interface SiteDots {
  /** Which layer of `art.background` the dots are. */
  index: number;
  /** The dots' colour without its alpha, as #rrggbb. */
  colour: string;
  /** Its alpha, 0..1. */
  opacity: number;
  /** The tile, px. */
  scale: number;
  /** Where the dot stops and the clear begins, % of the tile's corner distance. */
  stop: number;
}

/** Split a CSS list at its top-level commas. */
export function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0, from = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) { out.push(s.slice(from, i).trim()); from = i + 1; }
  }
  out.push(s.slice(from).trim());
  return out.filter((x) => x !== "");
}

const hex2 = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");

/** A CSS colour as [#rrggbb, alpha], for rgb(), rgba() and hex; null for anything else. */
function rgba(c: string): [string, number] | null {
  const v = c.trim().toLowerCase();
  if (v === "transparent") return ["#000000", 0];
  const m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/.exec(v);
  if (m) {
    const a = m[4] == null ? 1 : m[4].endsWith("%") ? Number(m[4].slice(0, -1)) / 100 : Number(m[4]);
    return [`#${hex2(+m[1]!)}${hex2(+m[2]!)}${hex2(+m[3]!)}`, a];
  }
  const h = /^#([0-9a-f]{3,8})$/.exec(v)?.[1];
  if (!h) return null;
  const full = h.length <= 4 ? h.split("").map((x) => x + x).join("") : h;
  return [`#${full.slice(0, 6)}`, full.length === 8 ? parseInt(full.slice(6, 8), 16) / 255 : 1];
}

const DOT = /^radial-gradient\(\s*((?:rgba?\([^)]*\))|#[0-9a-fA-F]{3,8}|transparent)\s+([\d.]+)%\s*,\s*((?:rgba?\([^)]*\))|#[0-9a-fA-F]{3,8}|transparent)\s+([\d.]+)%\s*\)$/;

/** The dot pattern among a part's backgrounds, if it has one. */
export function siteDotsOf(art: Art | null | undefined): SiteDots | null {
  if (!art?.background) return null;
  const layers = splitTop(art.background);
  const sizes = splitTop(art.backgroundOptions?.[0] ?? "");
  for (let i = 0; i < layers.length; i++) {
    const m = DOT.exec(layers[i]!);
    if (!m) continue;
    const dot = rgba(m[1]!), clear = rgba(m[3]!);
    if (!dot || !clear || dot[1] <= 0 || clear[1] > 0.01) continue;
    const stop = Number(m[2]), edge = Number(m[4]);
    if (!(stop > 0 && stop <= 50 && edge >= stop && edge - stop <= 5)) continue;
    const size = /^([\d.]+)px(?:\s+([\d.]+)px)?$/.exec(sizes[i] ?? "");
    if (!size) continue;
    return { index: i, colour: dot[0], opacity: dot[1], scale: Number(size[1]), stop };
  }
  return null;
}

/** The same art with its dots set to these. */
export function writeSiteDots(art: Art, dots: SiteDots, to: Partial<Pick<SiteDots, "colour" | "opacity" | "scale">>): Art {
  const colour = rgba(to.colour ?? dots.colour)?.[0] ?? dots.colour;
  const opacity = Math.max(0, Math.min(1, to.opacity ?? dots.opacity));
  const scale = Math.max(2, Math.round(to.scale ?? dots.scale));
  const r = parseInt(colour.slice(1, 3), 16), g = parseInt(colour.slice(3, 5), 16), b = parseInt(colour.slice(5, 7), 16);
  const layers = splitTop(art.background ?? "");
  layers[dots.index] = `radial-gradient(rgba(${r}, ${g}, ${b}, ${Math.round(opacity * 1000) / 1000}) ${dots.stop}%, rgba(0, 0, 0, 0) ${dots.stop + 1}%)`;
  const opts = [...(art.backgroundOptions ?? [])];
  const sizes = splitTop(opts[0] ?? "");
  sizes[dots.index] = `${scale}px ${scale}px`;
  opts[0] = sizes.join(", ");
  return { ...art, background: layers.join(", "), backgroundOptions: opts };
}

/** The same art without its dots: what is left of its backgrounds, or `none`. */
export function dropSiteDots(art: Art, dots: SiteDots): Art {
  const layers = splitTop(art.background ?? "");
  layers.splice(dots.index, 1);
  const opts = (art.backgroundOptions ?? []).map((o) => { const xs = splitTop(o); xs.splice(dots.index, 1); return xs.join(", "); });
  const left = layers.filter((l) => l !== "none");
  /* Nothing of its own left: `none`, which a style layer sends back as the pattern taken off. */
  if (!left.length) return { ...art, background: "none", backgroundOptions: undefined };
  return { ...art, background: layers.join(", "), backgroundOptions: opts };
}
