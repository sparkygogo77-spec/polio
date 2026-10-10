/**
 * The parts shelf, item by item: what each one is, which near-copies it
 * stands for, and what a published page really does with it.
 *
 * HIS ASK (Lane I): every category and every item in it is worth having,
 * has no duplicate, actually works on a published site, and can be edited
 * through the side panel. Three answers live here, as data:
 *
 *   · VARIATIONS, not near-copies (`VARIANTS`). Six opening banners that
 *     differed only in what stands behind the headline were six cards; they
 *     are one "Opening banner" with six versions. A built-in whole-site
 *     motion and the library feature that does the same to one part
 *     ("Appear on scroll" and "Reveal on scroll") were two cards in two
 *     bands; they are one item, and a captured site's own version joins it
 *     as a further variation (`captured.ts#siteVersions`). Every merged id
 *     still draws: a saved page holds ids, and none is deleted.
 *   · TAKEN OFF THE SHELF (`REMOVED`): things that are not a part of a
 *     page. A principle ("Simple then deep"), a Format setting drawn as a
 *     specimen ("Heading sizes"), a board tool ("Named area"). Each says
 *     where it lives instead. They still draw where a saved page has one.
 *   · WHAT THE PUBLISHED PAGE DOES (`PUBLISH`). The export is plain HTML:
 *     React is gone, so a part whose job is a press, a timer or a scroll
 *     does it only when the export ships a script for it. So an item is
 *     "Works when published" only when it draws complete (its job is what
 *     it shows) or when its script ships (`runs`); `tests/shelf-publish.mjs`
 *     exports every one of those and checks the page carries what it needs.
 *     Everything else says "Needs a build", or "Needs a key or backend"
 *     where that is what it waits on, and never pretends.
 *
 * Pure: no store, no React, so the checks read it as written. General: no
 * site is named anywhere in it.
 */
import { CARRIES, SHELF_GROUPS, isWorkKey, workIdOf, type ShelfGroup } from "./shelfGroups.ts";

/* ------------------------------------------------------------------ */
/* Variations                                                          */
/* ------------------------------------------------------------------ */

/** One version of an item: another catalogue part, or a library feature that goes onto a part. */
export interface VariantDef {
  /** A catalogue id, or `work:<id>`. */
  key: string;
  /** What this version is, in a few words. */
  label: string;
}

/**
 * Each shelf item's versions. The first line is the item itself: its own
 * version's label. The rest were cards of their own and are versions now.
 */
export const VARIANTS: Record<string, { self: string; more: VariantDef[] }> = {
  /* Layout */
  "section-stack": { self: "Sections stacked", more: [{ key: "holy-grail", label: "Header, body, footer" }] },
  "card-grid": { self: "Even cards", more: [{ key: "bento-grid", label: "Tiles of mixed sizes" }, { key: "masonry", label: "Staggered heights" }] },
  "split-screen": { self: "Two halves", more: [{ key: "sidebar-layout", label: "A rail down one side" }, { key: "docs", label: "Documentation layout" }] },
  "tabs-panel": { self: "Tabs", more: [{ key: "work:press-shows", label: "A press shows its panel, on your own parts" }] },
  accordion: { self: "Folding rows", more: [{ key: "faq", label: "Questions and answers" }] },
  modal: { self: "A window over the page", more: [{ key: "drawer", label: "Slides in from an edge" }] },
  footer: { self: "Footer", more: [{ key: "sitemap-page", label: "Every page listed" }] },
  /* Navigation */
  "sticky-header": {
    self: "Stays at the top",
    more: [
      { key: "work:scroll-header", label: "Takes a bar once scrolled" },
      { key: "mega-menu", label: "With a big dropdown" },
      { key: "mobile-nav", label: "Phone menu" },
      { key: "home-anchor", label: "Just the name, back home" },
    ],
  },
  toc: { self: "A list of this page", more: [{ key: "scrollspy-nav", label: "Follows your reading" }] },
  "search-nav": { self: "Search box", more: [{ key: "search-autocomplete", label: "With suggestions as you type" }] },
  /* First screen */
  "hero-split": {
    self: "Words beside a picture",
    more: [
      { key: "hero-gradient", label: "Over a colour wash" },
      { key: "hero-typewriter", label: "Rotating headline" },
      { key: "hero-video", label: "Video behind" },
      { key: "hero-particles", label: "Particles behind" },
      { key: "hero-3d", label: "A turning object" },
    ],
  },
  "cta-primary": { self: "Main button", more: [{ key: "quick-action", label: "Does it at once" }] },
  "social-proof-strip": { self: "Names and numbers", more: [{ key: "logo-cloud", label: "Logo row" }, { key: "trust-badges", label: "Guarantees" }] },
  /* Text */
  prose: {
    self: "Plain text",
    more: [
      { key: "drop-cap", label: "Big first letter" },
      { key: "pull-quote", label: "A line pulled out, large" },
      { key: "highlight", label: "Highlighted words" },
      { key: "footnotes", label: "With footnotes" },
      { key: "reading-time", label: "Reading time" },
    ],
  },
  marquee: { self: "Words running sideways", more: [{ key: "work:marquee", label: "Any part, looped round" }] },
  "blog-index": {
    self: "Articles",
    more: [{ key: "changelog", label: "What's new, dated" }, { key: "tagging", label: "Tags" }, { key: "archive-mode", label: "Archive" }],
  },
  callout: { self: "A note to the reader", more: [{ key: "empty-states", label: "Nothing here yet" }] },
  "code-block": { self: "Code", more: [{ key: "diff-view", label: "Changes compared" }] },
  note: {
    self: "Note",
    more: [
      { key: "mood", label: "Mood or reference" },
      { key: "constraint", label: "A rule not to break" },
      { key: "gimmick", label: "The central idea" },
      { key: "wildcard", label: "Let the model choose" },
    ],
  },
  /* Media */
  gallery: {
    self: "A grid of pictures",
    more: [{ key: "lightbox", label: "Opens full screen" }, { key: "image-blur-up", label: "Blurred until loaded" }, { key: "photo-credit", label: "With captions and credits" }],
  },
  "video-player": { self: "Video", more: [{ key: "audio-player", label: "Audio" }, { key: "podcast", label: "Episode list" }] },
  "map-embed": { self: "Map", more: [{ key: "3d-viewer", label: "A model to spin" }] },
  "shape-sphere": { self: "A sphere on its own", more: [{ key: "work:planet", label: "On a part you already have" }] },
  "orb-css": { self: "Drawn by the page", more: [{ key: "orb-webgl", label: "Real light and depth" }, { key: "orb-image", label: "Wearing your picture" }] },
  /* Motion */
  "reveal-on-scroll": { self: "Every part, on every page", more: [{ key: "work:reveal", label: "One part" }] },
  "scroll-progress": { self: "A bar across the top", more: [{ key: "work:scroll-grow", label: "A line on the page fills" }] },
  parallax: { self: "The page background", more: [{ key: "work:follow-pointer", label: "Layers follow the pointer" }] },
  "smooth-scroll": { self: "The whole page", more: [{ key: "work:glide", label: "Links glide to their place" }] },
  "hover-tilt": { self: "Every part, on every page", more: [{ key: "work:tilt", label: "One part" }] },
  "page-load": { self: "A wipe as the page opens", more: [{ key: "work:crt-loader", label: "An old television tuning in" }] },
  /* Interaction */
  "copy-button": { self: "A value and a Copy button", more: [{ key: "work:copy-toast", label: "Any part copies its words" }] },
  shortcuts: { self: "Keys and a cheat sheet", more: [{ key: "hotkey-first", label: "Everything by keyboard" }] },
  "onboarding-tour": { self: "A guided tour", more: [{ key: "compass-onboard", label: "The first screen a newcomer sees" }] },
  /* Forms & shop */
  "contact-form": {
    self: "Contact form",
    more: [
      { key: "multi-step-form", label: "In steps" },
      { key: "booking", label: "Booking" },
      { key: "survey", label: "Quiz or survey" },
      { key: "autosave", label: "Saves as you type" },
    ],
  },
  newsletter: { self: "Email sign-up", more: [{ key: "rss", label: "A feed to follow" }] },
  "product-grid": { self: "Product grid", more: [{ key: "wishlist", label: "Saved for later" }] },
  discount: { self: "Promo codes", more: [{ key: "affiliate", label: "Referral links" }] },
  /* Data */
  charts: { self: "Chart", more: [{ key: "sparkline", label: "Tiny trend lines" }] },
  "stat-tiles": { self: "Number tiles", more: [{ key: "progress-tracker", label: "Progress to a target" }] },
  "work:sol-price": { self: "The price of SOL", more: [{ key: "work:token-price", label: "Any token, by its address" }] },
  "data-table": { self: "Sortable rows", more: [{ key: "dense-tables", label: "Packed tight" }, { key: "export", label: "Download the data" }] },
  "live-feed": { self: "Rows arriving", more: [{ key: "realtime-stream", label: "Pushed the instant they happen" }, { key: "multi-column-feed", label: "Several feeds side by side" }] },
  /* Social */
  comments: { self: "Comments", more: [{ key: "guestbook", label: "Guestbook" }] },
  moderation: { self: "People review a queue", more: [{ key: "ai-moderation", label: "Screened by artificial intelligence (AI) first" }] },
  /* AI */
  "ai-prompt-box": { self: "One box: describe it, it is made", more: [{ key: "ai-generate-content", label: "A section it writes" }] },
  "ai-summarize": { self: "Summarise", more: [{ key: "ai-translate", label: "Translate" }] },
  /* Engine */
  "dark-mode": { self: "Light and dark versions", more: [{ key: "theming", label: "Visitors pick a theme" }] },
};

/** Every key that is a version of another item, and which item. */
export const VARIANT_OF: ReadonlyMap<string, string> = new Map(
  Object.entries(VARIANTS).flatMap(([item, v]) => v.more.map((m) => [m.key, item] as [string, string])),
);

/* ------------------------------------------------------------------ */
/* Taken off the shelf                                                 */
/* ------------------------------------------------------------------ */

/** Ids that are not a part of a page, and where each one lives instead. */
export const REMOVED: Record<string, string> = {
  "multi-page": "Pages are made in the Pages panel; a box saying there are several pages added nothing to one.",
  waypoint: "A marker with nothing to show a visitor.",
  "scan-region": "The board's own region tool draws a named area round parts.",
  "container-width": "It is Format, Layout, Content width: one setting for the whole site.",
  "heading-scale": "It is Format, Type, Type scale; on a page it drew a specimen of sizes.",
  "fluid-type": "A rule for how the build sets type, written into the brief by Format, Type.",
  "textbox-format": "It is Format, Type, Text box style.",
  "micro-copy": "Tone of voice is Format, Concept, Tone, and every word is the site's own.",
  graduation: "A principle for how a site grows with its visitor, not a part of a page.",
  responsive: "Every published page already reflows for phones and tablets; the Preview at Phone shows it.",
  "brand-system": "The Look panel is the brand kit: colours, faces and marks for the whole site.",
};

/* ------------------------------------------------------------------ */
/* What the published page does with it                                */
/* ------------------------------------------------------------------ */

/**
 * How the export carries an item.
 *   · `draws`: its job is what it shows, and the page shows it complete.
 *   · `runs`: it needs a script, and the export ships one (named).
 *   · `still`: it needs a script and none ships, so it is published still.
 *   · `brief`: a setting for the whole build, written into the blueprint.
 *   · `note`: words for whoever builds the site; never on the page.
 */
export type Publish =
  | { kind: "draws" }
  | { kind: "runs"; by: Runtime }
  | { kind: "still"; waits: string }
  | { kind: "brief" }
  | { kind: "note" };

/**
 * What ships the script.
 *   · `site-motion`: `assets/site-motion.js` and the page's `#site-motion` settings.
 *   · `parts`: `assets/parts.js` and the page's `#site-parts` list (folding rows, tabs, copy).
 *   · `keyframes`: the keyframes the part's own style names, in the page's stylesheet.
 *   · `view-transition`: the page's stylesheet asks the browser to fade between pages.
 *   · `work`: the library feature's own script (`assets/features/<id>.js`).
 */
export type Runtime = "site-motion" | "parts" | "keyframes" | "view-transition" | "work";

const draws: Publish = { kind: "draws" };
const brief: Publish = { kind: "brief" };
const note: Publish = { kind: "note" };
const runs = (by: Runtime): Publish => ({ kind: "runs", by });
const still = (waits: string): Publish => ({ kind: "still", waits });

const PRESS = "what a press does";
const TIMER = "what moves on its own";
const POINTER = "what follows the pointer";
const SCROLLING = "what follows the scroll";
const PLAYER = "a real player";
const THREE_D = "drawing in three dimensions";

/** Every catalogue id. A new one without a line here fails `tests/shelf-plan.mjs`. */
export const PUBLISH: Record<string, Publish> = {
  /* Layout */
  "section-stack": draws, "holy-grail": draws, box: draws, "card-grid": draws, "bento-grid": draws, masonry: draws,
  "split-screen": draws, "sidebar-layout": draws, docs: draws,
  "tabs-panel": runs("parts"), accordion: runs("parts"), faq: runs("parts"),
  modal: still(PRESS), drawer: still(PRESS),
  footer: draws, "sitemap-page": draws,
  "multi-page": brief, waypoint: draws, "scan-region": note, "container-width": brief,
  /* Navigation */
  "sticky-header": draws, "home-anchor": draws, "mega-menu": still(PRESS), "mobile-nav": still(PRESS),
  breadcrumbs: draws, toc: draws, "scrollspy-nav": still(SCROLLING), "search-nav": still("searching"), "search-autocomplete": still("searching"),
  pagination: still("the pages it numbers"),
  /* First screen */
  "hero-split": draws, "hero-gradient": draws, "hero-typewriter": still(TIMER), "hero-video": still(PLAYER),
  "hero-particles": still(TIMER), "hero-3d": still(THREE_D), "hero-scroll-cue": draws,
  "value-prop": draws, gimmick: note, "cta-primary": draws, "quick-action": still(PRESS), "invite-panel": still(PRESS),
  "social-proof-strip": draws, "logo-cloud": draws, "trust-badges": draws, testimonials: draws, countdown: still(TIMER),
  /* Text */
  prose: draws, "drop-cap": draws, "pull-quote": draws, highlight: draws, footnotes: draws, "reading-time": draws,
  "eyebrow-rule": draws, "kinetic-type": still(TIMER), marquee: runs("keyframes"),
  "blog-index": draws, changelog: draws, tagging: draws, "archive-mode": draws, rss: still("a feed address"),
  callout: draws, "empty-states": draws, "code-block": runs("parts"), "diff-view": draws,
  "heading-scale": brief, "fluid-type": brief, "textbox-format": brief, "micro-copy": brief,
  /* A new idea is the owner's own part: its name and words publish, and a builder makes the rest from its prompt (`Note`). */
  "custom-idea": brief, note, mood: note, constraint: note, wildcard: note,
  /* Media */
  picture: draws, gallery: draws, "photo-credit": draws, lightbox: still(PRESS), "image-blur-up": still("loading pictures in"),
  carousel: still(PRESS), "before-after": draws,
  "video-player": still(PLAYER), "audio-player": still(PLAYER), podcast: still(PLAYER),
  "map-embed": still("a map service"), "3d-viewer": still(THREE_D),
  "generative-art": draws, "avatar-stack": draws, "corner-glow": draws,
  "orb-css": draws, "orb-image": draws, "orb-webgl": still(THREE_D), "cube-3d": still(THREE_D), "mesh-3d": still(THREE_D),
  /* Drawn by the part, and turned on the published page by the planet script it carries (`works.ts#PART_SCRIPT`), as the orbs are. */
  "shape-sphere": draws, "shape-cube": draws, "shape-pyramid": draws,
  "drawn-icon": draws,
  /* Motion */
  "reveal-on-scroll": runs("site-motion"), "scroll-progress": runs("site-motion"), parallax: runs("site-motion"),
  "smooth-scroll": runs("site-motion"), "scroll-snap": runs("site-motion"), "page-load": runs("site-motion"),
  "cursor-effects": runs("site-motion"), "hover-tilt": runs("site-motion"), "back-to-top": runs("site-motion"),
  "page-transitions": runs("view-transition"),
  confetti: still("a moment of success to celebrate"), "sticky-story": still(SCROLLING), "horizontal-scroll": still(SCROLLING),
  "scroll-video": still(SCROLLING), "infinite-scroll": still("more items to load"), "morph-transition": still("moving between pages"), physics: still(POINTER),
  /* Interaction */
  "copy-button": runs("parts"),
  "drag-drop": still(PRESS), "undo-redo": still(PRESS), "inline-edit": still("somewhere to save"),
  tooltips: still(POINTER), "hover-card": still(POINTER), "magnetic-buttons": still(POINTER),
  "command-palette": still("the keyboard"), shortcuts: still("the keyboard"), "hotkey-first": still("the keyboard"), "context-menus": still(PRESS), presets: still(PRESS),
  toasts: still(PRESS), "optimistic-ui": still(PRESS), "sound-cues": still(PRESS), haptics: still(PRESS), skeletons: still("content that loads"),
  "onboarding-tour": still(PRESS), "compass-onboard": still(PRESS), "whats-new": runs("work"), graduation: still(PRESS),
  "easter-egg": still(PRESS), gamification: still("somewhere to keep score"), "workflow-builder": still(PRESS), "cog-settings": still(PRESS), "blur-privacy": still(PRESS),
  /* Forms & shop */
  "contact-form": still("somewhere to send it"), "multi-step-form": still("somewhere to send it"), booking: still("somewhere to send it"),
  survey: still("somewhere to send it"), autosave: still("somewhere to save"), "inline-validation": still(PRESS), captcha: still("a checking service"),
  field: draws, checkbox: draws,
  newsletter: still("somewhere to send it"), "date-picker": still(PRESS), rating: still(PRESS), "filter-panel": still(PRESS), "file-upload": still("somewhere to send it"),
  "product-grid": draws, "product-detail": draws, "comparison-table": draws, wishlist: still("somewhere to save"),
  "pricing-table": draws, subscription: still("payments"), "cart-drawer": still("a cart kept somewhere"), checkout: still("payments"),
  discount: still("codes kept somewhere"), affiliate: still("links kept somewhere"), invoice: still("orders kept somewhere"), "coin-economy": still("balances kept somewhere"),
  /* Data */
  charts: draws, sparkline: draws, "pie-breakdown": draws, heatmap: draws, "stat-tiles": draws, "progress-tracker": draws, leaderboard: draws,
  "details-table": draws, "data-table": still(PRESS), "dense-tables": draws, export: still(PRESS),
  timeline: draws, "calendar-view": draws, dashboard: draws, "network-graph": draws, kanban: still("dragging cards"),
  "live-feed": still("a live source"), "realtime-stream": still("a live source"), "multi-column-feed": still("a live source"),
  "virtualised-list": still("thousands of rows to list"), "status-bar": draws, "terminal-console": still("the keyboard"), "split-panes": still("dragging the bar"),
  /* Social */
  "share-sheet": still(PRESS), reactions: still("counts kept somewhere"), follow: still("followers kept somewhere"),
  comments: still("comments kept somewhere"), guestbook: still("messages kept somewhere"), chat: still("a live source"), forum: still("posts kept somewhere"),
  mentions: still("people to mention"), profiles: still("accounts"), "community-badges": still("accounts"), "activity-feed": still("accounts"),
  moderation: still("posts kept somewhere"), "ai-moderation": still("a model"), "collab-cursors": still("a live source"),
  /* AI */
  "ai-chat": still("a model"), "ai-voice": still("a model"), "ai-prompt-box": still("a model"), "ai-generate-content": still("a model"),
  "ai-summarize": still("a model"), "ai-translate": still("a model"), "ai-search": still("a model"), "ai-recommend": still("a model"), "ai-autofill": still("a model"),
  /* Engine: settings for the whole build, carried in the brief. */
  "dark-mode": brief, theming: brief, print: brief, seo: brief, a11y: brief, i18n: brief, "error-handling": brief, perf: brief,
  analytics: brief, testing: brief, pwa: brief, "cookie-consent": brief, responsive: brief, "brand-system": brief,
  email: still("a mail service"), integration: still("the outside service"), "weather-time": still("a weather service"), "qr-bridge": still(PRESS),
  auth: still("accounts"), database: still("a database"), cms: still("somewhere to save"), versioning: still("somewhere to save"), api: still("a server"),
};

/** Every library feature ships its own script, so every one runs where it is put. */
export function publishOf(key: string): Publish {
  if (isWorkKey(key)) return runs("work");
  return PUBLISH[key] ?? still(PRESS);
}

/* ------------------------------------------------------------------ */
/* The shelf, assembled                                                */
/* ------------------------------------------------------------------ */

/**
 * FINISHED OR SKETCH (the audit, item 10). A card is a sketch when the
 * published page does not do its job: it needs a press, a timer, a player
 * or a backend and no script ships for it, so it goes out still. Everything
 * else is finished: it draws complete, its script ships, it is a setting the
 * build reads (a whole-site switch), or it is a note meant for the builder.
 * Sketches stay on the shelf, hidden until "Show sketches" is on, and are
 * never deleted, because a saved page holds their ids.
 */
export function isFinished(key: string): boolean {
  return publishOf(key).kind !== "still";
}

/** An item as a group lists it, with its versions. */
export interface ShelfEntry {
  key: string;
  versions: VariantDef[];
}

/** A category's groups with each item's versions, in reading order. */
export function shelfOf(category: string): { group: ShelfGroup; entries: ShelfEntry[] }[] {
  return (SHELF_GROUPS[category] ?? []).map((group) => ({
    group,
    entries: group.items.map((key) => {
      const v = VARIANTS[key];
      return { key, versions: v ? [{ key, label: v.self }, ...v.more] : [{ key, label: "" }] };
    }),
  }));
}

/** Whether a catalogue id or a work key is shown as a card of its own. */
export function onShelf(key: string): boolean {
  return Object.values(SHELF_GROUPS).some((gs) => gs.some((g) => g.items.includes(key)));
}

/** The card a key is shown on: itself, the item it is a version of, or none when it was taken off. */
export function itemOf(key: string): string | null {
  if (onShelf(key)) return key;
  const of = VARIANT_OF.get(key);
  return of && onShelf(of) ? of : null;
}

/** Every work key the shelf places, as a card or as a version of one. */
export function placedWorks(): string[] {
  const items = Object.values(SHELF_GROUPS).flatMap((gs) => gs.flatMap((g) => g.items));
  const own = items.filter(isWorkKey);
  const versions = [...VARIANT_OF.keys()].filter(isWorkKey);
  /* A part on the shelf that carries its own feature places that feature too. */
  const carried = [...items, ...VARIANT_OF.keys()].filter((k) => CARRIES[k]);
  return [...new Set([...own, ...versions, ...carried])].map(workIdOf);
}
