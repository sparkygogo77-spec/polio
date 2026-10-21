/**
 * A BACKGROUND READ AS A STACK OF LAYERS (the Look panel's layer list).
 *
 * J (2026-10-21): hide lives in a layer list in the Look panel, as the
 * background's layers. A captured section's background is already a stack of
 * parts. thesolface.site's hero, bottom to top: the section's own fill, the
 * frog picture, a vertical fade (its `::after`), masked grid lines, the green
 * glows, and over them the film the capture took of it. The page has its own,
 * pinned to the window: a progress bar, an SVG grain, the cursor glow.
 *
 * A section's layers are its fill, then every part with no words in it that
 * the page placed out of the flow straight in the section (or a ::before /
 * ::after of one), in the order they paint, then the films laid on the
 * section or on those. Its content (a wrapper in the flow and what is in it,
 * a badge with words) is not background, however it is placed. The page's
 * layers are the wordless parts pinned straight to the body, then the films
 * on them and on the body.
 *
 * Pure: `tests/look-layers.mjs` reads thesolface's stack without a browser.
 */
import { FILM_STRETCH } from "../shelf/parts/primitives";

export interface LayerPart {
  id: string;
  pageId?: string;
  featureId?: string;
  label?: string;
  content?: unknown;
  w: number;
  h: number;
  hidden?: boolean;
  colour?: { bg?: string | null } | Record<string, unknown> | null;
  art?: { background?: string; mask?: string } & Record<string, unknown> | null;
  picture?: { w?: number; h?: number; moving?: { kind: string } | null } | null;
  from?: { selector?: string; position?: string } | null;
}

export interface Layer {
  id: string;
  /** A plain name: Fill, Picture, Fade, Lines, Glow, Grain, Bar, Moving picture, Shape. */
  name: string;
  /** What to paint its little swatch with: a colour or a CSS background. Empty for a picture, which shows its own. */
  swatch: string;
  /** Its eye: drawn, or not. */
  on: boolean;
  /** Why it is off when the person did not shut it: a film too stretched to show, or one pinned to the window. */
  why?: string;
  /** The section's own fill: always at the foot, never moved. */
  fixed?: boolean;
  /** A grain or noise over the whole page: the site's texture, in all but name. */
  texture?: boolean;
  /** A film. */
  film?: boolean;
}

const pathOf = (n: LayerPart) => (n.from?.selector ?? "").trim();
const isFilm = (n: LayerPart) => pathOf(n).endsWith("::frames") && !!n.picture?.moving;
const wordsOf = (n: LayerPart) => {
  const c = n.content;
  return typeof c === "string" ? c.trim() : Array.isArray(c) ? c.map((r) => (r as { text?: string }).text ?? "").join("").trim() : "";
};
const PSEUDO = /::(before|after)$/;
/** A path straight in another: one step down, or a ::before / ::after of it. */
const straightIn = (holder: string, kid: string) => {
  if (!kid.startsWith(holder)) return false;
  const rest = kid.slice(holder.length);
  return /^::(before|after)$/.test(rest) || (/^ > [^>]+$/.test(rest) && !rest.includes("::frames"));
};
const inside = (holder: string, kid: string) => kid.startsWith(`${holder} > `) || kid.startsWith(`${holder}::`);

/** Why a film is held back where it is laid (`PictureSlot`), or nothing when it plays. */
export function filmHeldWhy(n: LayerPart): string | undefined {
  if (!isFilm(n) || n.hidden === false) return undefined;
  if (n.from?.position === "fixed") return "Pinned to the window: the part it was filmed on draws itself.";
  const p = n.picture!;
  if (p.w && p.h && (n.w > p.w * FILM_STRETCH + 0.5 || n.h > p.h * FILM_STRETCH + 0.5)) {
    return `Filmed at ${p.w}×${p.h}, stretched ${(Math.max(n.w / p.w, n.h / p.h)).toFixed(1)}× here: a blur. Open its eye to show it anyway.`;
  }
  return undefined;
}

function nameOf(n: LayerPart): { name: string; texture?: boolean } {
  if (isFilm(n)) return { name: "Moving picture" };
  const bg = n.art?.background ?? "";
  if (/feTurbulence|noise/i.test(bg)) return { name: "Grain", texture: true };
  if (n.picture) return { name: "Picture" };
  if (/radial-gradient/.test(bg)) return { name: "Glow" };
  if (/repeating-|\b1px\b/.test(bg) || n.art?.mask) return { name: "Lines" };
  if (/linear-gradient/.test(bg)) return { name: "Fade" };
  if (/url\(/.test(bg)) return { name: "Picture" };
  if (n.h <= 8 || n.w <= 8) return { name: "Bar" };
  return { name: "Shape" };
}

const fillOf = (n: LayerPart) => {
  const bg = (n.colour as { bg?: string | null } | null | undefined)?.bg;
  return typeof bg === "string" ? bg : "";
};

function asLayer(n: LayerPart): Layer {
  const { name, texture } = nameOf(n);
  const why = n.hidden === true ? undefined : filmHeldWhy(n);
  return {
    id: n.id, name, swatch: n.art?.background || fillOf(n), on: n.hidden !== true && !why,
    ...(why ? { why } : {}), ...(texture ? { texture } : {}), ...(isFilm(n) ? { film: true } : {}),
  };
}

/** Number a name that repeats ("Glow", "Glow 2"), bottom to top. */
function numbered(layers: Layer[]): Layer[] {
  const seen = new Map<string, number>();
  return layers.map((l) => {
    if (l.fixed) return l;
    const k = (seen.get(l.name) ?? 0) + 1;
    seen.set(l.name, k);
    return k > 1 ? { ...l, name: `${l.name} ${k}` } : l;
  });
}

/**
 * The background layers of a section (`holder`, a part's id) or of the page
 * (`null`), bottom to top, in the order they paint.
 */
export function layersOf(all: readonly LayerPart[], holder: string | null, pageId?: string): Layer[] {
  const owner = holder ? all.find((n) => n.id === holder) ?? null : null;
  const page = owner?.pageId ?? pageId;
  const nodes = all.filter((n) => !page || n.pageId === page);
  const subtreeHasWords = (n: LayerPart) => !!wordsOf(n) || nodes.some((m) => inside(pathOf(n), pathOf(m)) && !!wordsOf(m));
  const outOfFlow = (n: LayerPart) => n.from?.position === "absolute" || n.from?.position === "fixed";

  if (owner) {
    const at = pathOf(owner);
    if (!at) return [];
    const layers = nodes.filter((n) => n !== owner && !isFilm(n) && straightIn(at, pathOf(n)) && (outOfFlow(n) || PSEUDO.test(pathOf(n))) && !subtreeHasWords(n));
    /* A ::before / ::after of a layer is a layer of its own (the frog picture's fade). */
    const pseudos = nodes.filter((n) => !isFilm(n) && PSEUDO.test(pathOf(n)) && layers.some((l) => pathOf(n) === `${pathOf(l)}::before` || pathOf(n) === `${pathOf(l)}::after`) && !layers.includes(n));
    const stack = [...layers, ...pseudos].sort((a, b) => nodes.indexOf(a) - nodes.indexOf(b));
    const films = nodes.filter((n) => isFilm(n) && [at, ...stack.map(pathOf)].some((p) => pathOf(n) === `${p}::frames`));
    const fill: Layer = { id: owner.id, name: "Fill", swatch: fillOf(owner) || owner.art?.background || "", on: owner.hidden !== true, fixed: true };
    return [fill, ...numbered([...stack, ...films].map(asLayer))];
  }

  const pinned = nodes.filter((n) => n.from?.position === "fixed" && !isFilm(n) && /^body > [^>]+$/.test(pathOf(n)) && !subtreeHasWords(n));
  const films = nodes.filter((n) => isFilm(n) && (pathOf(n) === "body::frames" || pinned.some((p) => pathOf(n) === `${pathOf(p)}::frames`)));
  return numbered([...pinned, ...films].map(asLayer));
}
