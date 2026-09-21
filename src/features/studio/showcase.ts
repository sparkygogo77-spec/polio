/**
 * Where a part would sit on a real page.
 *
 * The library used to be a row of equal tiles, which told you nothing about a
 * part except its name. Laying the previews out the way a page is laid out —
 * navigation across the top, the search box centred under it, grids filling the
 * body, the footer last — means the shelf itself teaches the shape of a site.
 *
 * Two numbers do the work: which band of the page a part belongs to, and how
 * much of the width it takes. Both are derived, so a new `f(...)` line in the
 * catalog is placed sensibly without anyone writing a rule for it.
 */
import type { CategoryId, FeatureDef } from "./catalog";

export type Band = "top" | "upper" | "middle" | "lower" | "bottom";

export const BANDS: Band[] = ["top", "upper", "middle", "lower", "bottom"];

export const BAND_LABEL: Record<Band, string> = {
  top: "Across the top",
  upper: "First screen",
  middle: "The body",
  lower: "Further down",
  bottom: "Foot of the page",
};

/** A category's usual home. Individual parts override this below. */
const BY_CATEGORY: Record<CategoryId, Band> = {
  nav: "top",
  hero: "upper",
  structure: "middle",
  content: "middle",
  media: "middle",
  forms: "middle",
  data: "middle",
  social: "lower",
  ai: "lower",
  interact: "lower",
  motion: "lower",
  platform: "bottom",
};

/** The parts whose place on a page is not their category's. */
const BY_ID: Record<string, Band> = {
  "search-nav": "top", "search-autocomplete": "top", "ai-search": "top",
  breadcrumbs: "top", "home-anchor": "top", "toc": "top", "scrollspy-nav": "top",
  footer: "bottom", "sitemap-page": "bottom", pagination: "bottom", rss: "bottom",
  "value-prop": "upper", "cta-primary": "upper", "social-proof-strip": "upper",
  "logo-cloud": "upper", "trust-badges": "upper", "marquee": "upper",
  "cookie-consent": "bottom", "back-to-top": "bottom", "status-bar": "bottom",
  "print": "bottom", "a11y": "bottom", "seo": "bottom", "analytics": "bottom",
  newsletter: "lower", testimonials: "lower", faq: "lower", countdown: "lower",
  "product-grid": "middle", "card-grid": "middle", "bento-grid": "middle", masonry: "middle",
  gallery: "middle", charts: "middle", "data-table": "middle", dashboard: "middle",
};

export function bandOf(feature: FeatureDef): Band {
  return BY_ID[feature.id] ?? BY_CATEGORY[feature.category] ?? "middle";
}

/**
 * How many of twelve columns the preview takes.
 *
 * Not a straight ratio: at true scale a product grid would fill the shelf on
 * its own and you would see two parts at a time. Only a part that really spans
 * the page — a header, a footer, a hero — spans the shelf; everything else is
 * compressed so wide things still read as wider without eating the row.
 */
export function spanOf(feature: FeatureDef, frameWidth = 1440): number {
  const w = feature.w ?? 420;
  if (w >= frameWidth - 60) return 12;
  return Math.max(2, Math.min(6, Math.round((w / frameWidth) * 7)));
}

/**
 * Parts that draw a repeating card. On the shelf they show two, not six: a
 * grid of six thumbnails inside a thumbnail is mush, and two is enough to say
 * "this repeats".
 */
const REPEATS = new Set([
  "card-grid", "bento-grid", "masonry", "product-grid", "wishlist", "blog-index",
  "gallery", "testimonials", "ai-recommend", "comparison-table", "community-badges",
  "forum", "changelog", "archive-mode", "logo-cloud", "avatar-stack", "pricing-table",
]);

/** Two items, named after the part, so a shelf preview shows a quantity of two. */
export function previewContent(feature: FeatureDef): string | undefined {
  // A box draws only what it is given, so the shelf gives it a line to show what it is.
  if (feature.id === "box") return "Whatever you put in it";
  if (!REPEATS.has(feature.id)) return undefined;
  const noun = feature.name.split(" ")[0] ?? "Item";
  return `${noun} one, ${noun} two`;
}

/** The parts of one band, in the order they would appear down a page. */
export function groupIntoBands(features: FeatureDef[]): { band: Band; items: FeatureDef[] }[] {
  const buckets = new Map<Band, FeatureDef[]>();
  for (const f of features) {
    const band = bandOf(f);
    const list = buckets.get(band);
    if (list) list.push(f);
    else buckets.set(band, [f]);
  }
  // Widest first inside a band, so rows pack instead of leaving ragged holes.
  return BANDS.filter((b) => buckets.has(b)).map((band) => ({
    band,
    items: [...buckets.get(band)!].sort((a, b) => spanOf(b) - spanOf(a)),
  }));
}

/* ------------------------------------------------------------------ */
/* Grouping by size and shape                                          */
/* ------------------------------------------------------------------ */

/**
 * The shelf groups elements by how big they are and what shape they are, not
 * by where they would sit on a page.
 *
 * WHY IT CHANGED. Bands — across the top, first screen, the body, further
 * down, the foot — are a good thing to know and a bad way to pack a shelf.
 * A band holds whatever sizes it happens to hold, so a twelve-span card 1820
 * across sits in the same flex line as a quarter-width one, and because a
 * line is only as tall as the tallest card allows, the short ones leave holes
 * under them and the wide one leaves the rest of its row empty. Measured on
 * Layout with the shelf 1188 wide: "The body" put one full-width card in a
 * row by itself and left 548px of that row bare.
 *
 * Grouped by size instead, every card in a group has the same width and the
 * same height cap — `sizeFor` in `Palette.tsx` derives both from the span —
 * so a group tiles exactly and there are no holes to leave.
 *
 * SHAPE, not only size. Full width splits in two: a strip (something much
 * wider than it is tall — a header, a footer, a marquee, a logo row) and a
 * block (a hero, a section). They are both twelve spans and they are not the
 * same object, and a strip is 118 tall against a block's 208, so mixing them
 * is the hole problem again inside one group. Strips come first, because two
 * of them stack inside the shelf's strip where one block fills it.
 *
 * The page-position knowledge above is kept, not deleted: it is the right
 * answer to a different question, and `bandOf` is what a reading of an
 * imported page would want.
 */
export type Shape = "strip" | "block" | "half" | "third" | "quarter";

export const SHAPES: Shape[] = ["strip", "block", "half", "third", "quarter"];

export const SHAPE_LABEL: Record<Shape, string> = {
  strip: "Full width, shallow",
  block: "Full width",
  half: "Half width",
  third: "A third each",
  quarter: "A quarter each",
};

/** Much wider than it is tall: a strip rather than a block. */
export function isStrip(feature: FeatureDef): boolean {
  return (feature.w ?? 420) / (feature.h ?? 88) >= 5;
}

/** Which size-and-shape group a part belongs to. */
export function shapeOf(feature: FeatureDef, frameWidth = 1440): Shape {
  const span = spanOf(feature, frameWidth);
  if (span >= 12) return isStrip(feature) ? "strip" : "block";
  if (span >= 6) return "half";
  if (span >= 4) return "third";
  return "quarter";
}

/**
 * The shelf's groups, biggest first, and inside a group the widest-relative-to
 * -tall first — so similar shapes end up beside each other and the eye can
 * compare them.
 */
export function groupIntoShapes(features: FeatureDef[]): { shape: Shape; items: FeatureDef[] }[] {
  const buckets = new Map<Shape, FeatureDef[]>();
  for (const f of features) {
    const shape = shapeOf(f);
    const list = buckets.get(shape);
    if (list) list.push(f);
    else buckets.set(shape, [f]);
  }
  const aspect = (f: FeatureDef) => (f.w ?? 420) / (f.h ?? 88);
  return SHAPES.filter((sh) => buckets.has(sh)).map((shape) => ({
    shape,
    items: [...buckets.get(shape)!].sort((a, b) => aspect(b) - aspect(a)),
  }));
}
