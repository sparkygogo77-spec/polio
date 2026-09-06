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
  commerce: "middle",
  data: "middle",
  social: "lower",
  ai: "lower",
  interact: "lower",
  power: "lower",
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
