/**
 * The parts registry. One line per catalog id; the `DEFS` array is the source
 * of truth for which archetype draws which part and whether it can link.
 *
 * Adding a part: write an archetype (or add a branch to one), then add its id
 * here. Anything not listed still draws through `legacy.tsx` until it is
 * migrated, and finally the labelled-box fallback.
 */
import { Accordion } from "./Accordion";
import { Behaviour, Captcha } from "./Behaviour";
import { Cta } from "./Cta";
import { Header } from "./Header";
import { Hero, ProofStrip, ValueProp } from "./Hero";
import { Breadcrumbs, Footer, Grid, Note, Outline, Overlay, Pagination, Sections, Split } from "./Layout";
import { ArticleList, Callout, CodeBlock, Marquee, Prose } from "./Text";
import { Art, AvatarStack, BeforeAfter, Carousel, Gallery, Player, Viewer } from "./Media";
import { DatePicker, FileDrop, FilterPanel, Form, Newsletter, Rating } from "./Forms";
import { SearchBox } from "./SearchBox";
import { Tabs } from "./Tabs";
import type { PartDef } from "./types";

export const DEFS: PartDef[] = [
  /* ---------------------------------------------------------- navigation */
  { component: Header, ids: ["sticky-header", "mega-menu", "mobile-nav", "home-anchor"], tier: "A", linkable: true },
  { component: SearchBox, ids: ["search-nav", "search-autocomplete", "ai-search"], tier: "A" },
  { component: Breadcrumbs, ids: ["breadcrumbs"], tier: "A" },
  { component: Outline, ids: ["toc", "scrollspy-nav"], tier: "A" },
  { component: Pagination, ids: ["pagination"], tier: "A" },

  /* ------------------------------------------------------------- layout */
  { component: Sections, ids: ["section-stack", "holy-grail", "scan-region", "container-width", "multi-page", "waypoint"], tier: "A" },
  { component: Grid, ids: ["card-grid", "bento-grid", "masonry"], tier: "A", linkable: true },
  { component: Split, ids: ["split-screen", "sidebar-layout", "docs"], tier: "A" },
  { component: Tabs, ids: ["tabs-panel"], tier: "A" },
  { component: Accordion, ids: ["accordion", "faq"], tier: "A" },
  { component: Overlay, ids: ["modal", "drawer"], tier: "A" },
  { component: Footer, ids: ["footer", "sitemap-page"], tier: "A", linkable: true },
  { component: Note, ids: ["custom-idea", "wildcard", "note", "mood", "constraint"], tier: "A" },

  /* -------------------------------------------------------- first screen */
  { component: Hero, ids: ["hero-split", "hero-video", "hero-gradient", "hero-typewriter", "hero-particles", "hero-3d", "hero-scroll-cue"], tier: "A", linkable: true },
  { component: ValueProp, ids: ["value-prop", "gimmick"], tier: "A" },
  { component: Cta, ids: ["cta-primary", "quick-action", "follow"], tier: "A", linkable: true },
  { component: ProofStrip, ids: ["social-proof-strip", "logo-cloud", "trust-badges"], tier: "A" },

  /* --------------------------------------------------------------- text */
  { component: Prose, ids: ["prose", "heading-scale", "fluid-type", "drop-cap", "pull-quote", "highlight", "kinetic-type", "textbox-format", "micro-copy", "reading-time", "footnotes"], tier: "A" },
  { component: Marquee, ids: ["marquee"], tier: "A" },
  { component: CodeBlock, ids: ["code-block", "diff-view"], tier: "A" },
  { component: Callout, ids: ["callout", "empty-states"], tier: "A" },
  { component: ArticleList, ids: ["blog-index", "changelog", "tagging", "archive-mode"], tier: "A", linkable: true },

  /* -------------------------------------------------------------- media */
  { component: Gallery, ids: ["gallery", "lightbox", "image-blur-up", "photo-credit"], tier: "A" },
  { component: Carousel, ids: ["carousel"], tier: "A" },
  { component: BeforeAfter, ids: ["before-after"], tier: "A" },
  { component: Player, ids: ["video-player", "audio-player", "podcast"], tier: "A" },
  { component: Viewer, ids: ["map-embed", "3d-viewer"], tier: "A" },
  { component: AvatarStack, ids: ["avatar-stack"], tier: "A" },
  { component: Art, ids: ["generative-art"], tier: "A" },

  /* -------------------------------------------------------------- forms */
  { component: Form, ids: ["contact-form", "multi-step-form", "inline-validation", "autosave", "booking", "survey", "ai-autofill"], tier: "A" },
  { component: Newsletter, ids: ["newsletter", "rss"], tier: "A" },
  { component: FileDrop, ids: ["file-upload"], tier: "A" },
  { component: FilterPanel, ids: ["filter-panel"], tier: "A" },
  { component: DatePicker, ids: ["date-picker", "calendar-view"], tier: "A" },
  { component: Rating, ids: ["rating"], tier: "A" },

  /* ------------------------------------- behaviours and platform mocks */
  { component: Behaviour, ids: ["page-transitions", "back-to-top"], tier: "B" },
  { component: Captcha, ids: ["captcha"], tier: "C" },
];

export const PARTS: Record<string, PartDef> = Object.fromEntries(DEFS.flatMap((d) => d.ids.map((id) => [id, d])));

export function resolvePart(featureId: string): PartDef | null {
  return PARTS[featureId] ?? null;
}

export function isLinkable(featureId: string): boolean {
  return resolvePart(featureId)?.linkable === true;
}

export type { NodeLink, Part, PartDef, PartEvent, PartMode, PartProps } from "./types";
export { opt } from "./types";
export { items, themeFrom, titled, type Theme } from "./theme";
