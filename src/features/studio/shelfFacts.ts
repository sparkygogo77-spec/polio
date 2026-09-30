/**
 * What a card on the parts shelf says about the thing it shows.
 *
 * HIS WORDS, from a walk through the twelve categories: the cards "don't
 * show well what they offer or what each element does". Four questions a
 * person asks of every card, and this file is the one place each is
 * answered, so the card, the detail card and the checks read the same
 * answer:
 *
 *   · WHAT DOES IT DO? One line, always (`doesOf`). It was a hover tooltip
 *     for some and nothing for most.
 *   · DOES IT WORK, OR IS IT AN IDEA? (`statusOf`). The shelf mixes two
 *     kinds of thing: parts the published page draws and runs as they are,
 *     and parts that are a picture of a feature plus a brief for a later
 *     build (a checkout, a chat, a login). They looked the same.
 *   · WHAT DOES IT NEED? (`needsOf`): a key, a backend, money. Said where it
 *     is true, never guessed at from the name.
 *   · IS IT A PART, OR A SETTING FOR THE WHOLE SITE? (`switchOf`). Snap
 *     scrolling, a custom cursor, languages, analytics: none of these is a
 *     thing you put somewhere on a page, and a card that placed a box for
 *     one taught that it was.
 *
 * Plus the words a preview shows (`exampleContent`): drawn from the open
 * site, its name and its own headings, rather than invented filler.
 *
 * Pure: no store, no React, so `tests/shelf-cards.mjs` runs it as written.
 * General by construction: nothing here names a site.
 */
import type { FeatureDef } from "./catalog.ts";
import { BAND_LABEL, bandOf, shapeOf, type Shape } from "./showcase.ts";

/* ------------------------------------------------------------------ */
/* Works now, or an idea                                               */
/* ------------------------------------------------------------------ */

export type Status = "works" | "idea";

export const STATUS_LABEL: Record<Status, string> = {
  works: "Works now",
  idea: "Idea, needs building",
};

export const STATUS_MEANS: Record<Status, string> = {
  works: "The published site draws this and runs it as you see it.",
  idea: "The published site shows a picture of it. The working version is written into the blueprint for a later build.",
};

/**
 * The platform stand-ins: parts the registry draws as a picture of a
 * feature (tier C in `parts/index.ts`). `tests/shelf-cards.mjs` reads that
 * file and holds this list to it, so the two cannot drift apart.
 */
export const PICTURE_ONLY: ReadonlySet<string> = new Set([
  "checkout", "subscription", "invoice", "moderation",
  "ai-chat", "ai-prompt-box", "ai-generate-content", "ai-summarize", "ai-translate", "ai-recommend", "ai-moderation", "ai-voice",
  "auth", "cookie-consent", "i18n", "theming", "dark-mode", "qr-bridge", "weather-time", "print", "seo", "analytics",
  "database", "api", "pwa", "perf", "testing", "email", "cms", "versioning", "integration", "captcha",
]);

/**
 * Whole-page motions the live page runs (`deriveBehaviours` in
 * `live/behaviours.ts`). The other motions on the shelf are named in the
 * preview's corner rather than run, which is an idea by this file's
 * reading.
 */
export const RUN_MOTIONS: ReadonlySet<string> = new Set([
  "scroll-progress", "back-to-top", "reveal-on-scroll", "parallax", "smooth-scroll",
  "scroll-snap", "page-load", "cursor-effects", "hover-tilt", "confetti",
]);
/** The motions the live page names but does not run (`DESCRIBE_ONLY` there). */
export const NAMED_MOTIONS: ReadonlySet<string> = new Set([
  "sticky-story", "scroll-video", "morph-transition", "physics", "horizontal-scroll", "infinite-scroll",
]);

export type Need = "key" | "backend" | "money" | "wallet";

export const NEED_LABEL: Record<Need, string> = {
  key: "Needs a key",
  backend: "Needs a backend",
  money: "Costs money",
  wallet: "Needs a wallet",
};

export const NEED_MEANS: Record<Need, string> = {
  key: "A key is a secret code from the outside service this talks to, kept on the server.",
  backend: "A backend is a server that stores and sends things; a published page on its own cannot.",
  money: "The service behind it charges, per use or per month.",
  wallet: "The visitor connects a crypto wallet in their browser.",
};

/**
 * What each part needs before it can do what its picture shows. Only where
 * it is true: a tab strip needs nothing, a contact form needs somewhere for
 * the message to go.
 */
const NEEDS: Record<string, Need[]> = {
  /* Forms send what was typed somewhere. */
  "contact-form": ["backend"], "multi-step-form": ["backend"], booking: ["backend"], survey: ["backend"],
  "file-upload": ["backend"], newsletter: ["backend"], autosave: ["backend"], "inline-edit": ["backend"],
  captcha: ["key"],
  /* Shop: Stripe or the like. */
  "cart-drawer": ["backend"], checkout: ["backend", "key", "money"], subscription: ["backend", "key", "money"],
  invoice: ["backend"], discount: ["backend"], wishlist: ["backend"], affiliate: ["backend"], "coin-economy": ["backend"],
  /* People, and what they leave behind. */
  profiles: ["backend"], "community-badges": ["backend"], "activity-feed": ["backend"], comments: ["backend"],
  chat: ["backend"], forum: ["backend"], guestbook: ["backend"], mentions: ["backend"], reactions: ["backend"],
  follow: ["backend"], moderation: ["backend"], "collab-cursors": ["backend"], gamification: ["backend"],
  /* Live data comes from somewhere. */
  "live-feed": ["backend"], "realtime-stream": ["backend"], "multi-column-feed": ["backend"],
  /* Every model call is a key and a bill. */
  "ai-chat": ["backend", "key", "money"], "ai-prompt-box": ["backend", "key", "money"], "ai-generate-content": ["backend", "key", "money"],
  "ai-summarize": ["backend", "key", "money"], "ai-translate": ["backend", "key", "money"], "ai-recommend": ["backend", "key", "money"],
  "ai-search": ["backend", "key", "money"], "ai-autofill": ["backend", "key", "money"], "ai-moderation": ["backend", "key", "money"],
  "ai-voice": ["backend", "key", "money"],
  /* The engine room. */
  auth: ["backend", "money"], database: ["backend"], api: ["backend"], cms: ["backend"], versioning: ["backend"],
  email: ["backend", "key", "money"], analytics: ["key", "money"], integration: ["key"], "weather-time": ["key"],
};

export function needsOf(feature: Pick<FeatureDef, "id" | "basedOn">): Need[] {
  return NEEDS[feature.id] ?? NEEDS[feature.basedOn ?? ""] ?? [];
}

/** Works now, or an idea that needs building. */
export function statusOf(feature: Pick<FeatureDef, "id" | "basedOn">): Status {
  const id = feature.basedOn ?? feature.id;
  if (PICTURE_ONLY.has(id) || NAMED_MOTIONS.has(id)) return "idea";
  /* A part that cannot do its job without something the published page does not have is a picture of that job. */
  if (needsOf(feature).length) return "idea";
  return "works";
}

/* ------------------------------------------------------------------ */
/* A part, or a switch for the whole site                              */
/* ------------------------------------------------------------------ */

/**
 * A setting for the whole site, shown as a switch rather than a card that
 * places a box.
 *
 * Two ways a switch is kept, and both were already in the document:
 *   · `parts`: the motion is one of the page's own behaviour parts, which
 *     the live page reads and runs (`deriveBehaviours`) and lays out
 *     nowhere. On means every page carries one.
 *   · `format`: the Format panel's field for it, which the blueprint
 *     carries to the build (and, for page transitions, the live page runs).
 */
export type SiteSwitch =
  | { kind: "parts" }
  | { kind: "format"; key: string; on: string | boolean; off: string | boolean };

const SWITCHES: Record<string, SiteSwitch> = {
  ...Object.fromEntries([...RUN_MOTIONS].map((id) => [id, { kind: "parts" } as SiteSwitch])),
  "page-transitions": { kind: "format", key: "pages.transition", on: "fade", off: "none" },
  "dark-mode": { kind: "format", key: "build.darkLight", on: true, off: false },
  print: { kind: "format", key: "build.print", on: true, off: false },
  i18n: { kind: "format", key: "build.i18n", on: true, off: false },
  "cookie-consent": { kind: "format", key: "build.cookieConsent", on: true, off: false },
  analytics: { kind: "format", key: "build.analytics", on: true, off: false },
  testing: { kind: "format", key: "build.tests", on: true, off: false },
  "error-handling": { kind: "format", key: "build.errorScreens", on: true, off: false },
  pwa: { kind: "format", key: "build.offline", on: true, off: false },
};

export function switchOf(featureId: string): SiteSwitch | null {
  return SWITCHES[featureId] ?? null;
}

/** Page transitions run on the live page from the Format field; the rest of the format switches are written into the brief. */
export function switchStatus(featureId: string): Status {
  if (featureId === "page-transitions") return "works";
  const s = SWITCHES[featureId];
  if (s?.kind === "parts") return "works";
  return "idea";
}

/** Whether a format switch reads as on. A select is on at anything but its off value. */
export function formatSwitchOn(s: Extract<SiteSwitch, { kind: "format" }>, value: unknown): boolean {
  if (typeof s.on === "boolean") return value === true;
  return value !== undefined && value !== null && value !== s.off;
}

/* ------------------------------------------------------------------ */
/* One line: what it does                                              */
/* ------------------------------------------------------------------ */

const firstSentence = (s: string) => {
  const m = s.match(/^.*?[.!?](?=\s|$)/);
  return (m ? m[0] : s).trim();
};

/**
 * One line under every card. The long explanation's first sentence where
 * there is one (it was written to be read), else the catalogue's blurb.
 */
export function doesOf(feature: Pick<FeatureDef, "blurb" | "explain">): string {
  const line = feature.explain ? firstSentence(feature.explain) : feature.blurb;
  const s = line.trim();
  return /[.!?]$/.test(s) ? s : `${s}.`;
}

/* ------------------------------------------------------------------ */
/* How big, and where it goes                                          */
/* ------------------------------------------------------------------ */

const SHAPE_TAG: Record<Shape, string> = {
  strip: "Full width, thin",
  block: "Full width",
  half: "Half width",
  third: "A third",
  quarter: "Small",
};

/** The small footprint tag. Footprint used to be the grouping; it is a tag now. */
export function footprintOf(feature: FeatureDef): string {
  return SHAPE_TAG[shapeOf(feature)];
}

/** Where on a page this usually sits, in words. */
export function whereOf(feature: FeatureDef): string {
  return BAND_LABEL[bandOf(feature)];
}

/* ------------------------------------------------------------------ */
/* The open site's own words                                           */
/* ------------------------------------------------------------------ */

export interface SiteWords {
  name: string;
  /** Short lines the site uses as headings and labels, one to seven words. */
  headings: string[];
  /** Longer lines: sentences the site actually says. */
  lines: string[];
  /** What its buttons say. */
  buttons: string[];
  /** Its pages' names. */
  pages: string[];
}

/** What a node offers for the site's words: enough of a part to read its words. */
export interface WordSource { featureId: string; content: unknown; label?: string }

const HEADING_PARTS = new Set(["value-prop", "eyebrow-rule", "pull-quote", "heading-scale", "hero-split", "hero-video", "hero-gradient", "hero-typewriter", "hero-particles", "hero-3d", "gimmick"]);
const BUTTON_PARTS = new Set(["cta-primary", "quick-action", "follow", "magnetic-buttons"]);
const LINE_PARTS = new Set(["prose", "drop-cap", "callout", "textbox-format", "value-prop"]);

const clean = (s: string) => s.replace(/\s+/g, " ").replace(/^[\s"'“”]+|[\s"'“”]+$/g, "").trim();
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;

/**
 * The open site's own words, read off its parts. Headings from the parts
 * that are headings, sentences from the parts that are prose, button
 * labels from buttons. A captured site's boxes carry their words too, and
 * are read by length: short is a heading, long is a line.
 */
export function siteWordsOf(name: string, nodes: WordSource[], pages: string[] = []): SiteWords {
  const out: SiteWords = { name: clean(name) || "Your site", headings: [], lines: [], buttons: [], pages: [] };
  const add = (list: string[], s: string) => { const c = clean(s); if (c && !list.includes(c)) list.push(c); };
  for (const n of nodes) {
    if (typeof n.content !== "string" || !n.content.trim()) continue;
    const raw = n.content;
    /* "label: …, heading: …, button: …" as the invitation panel keeps it. */
    const keyed = raw.match(/heading:\s*([^,\n]+)/i);
    if (keyed) add(out.headings, keyed[1]!);
    const btn = raw.match(/button:\s*([^,\n]+)/i);
    if (btn) add(out.buttons, btn[1]!);
    if (keyed || btn) continue;
    const first = raw.split(/\n/)[0]!;
    if (/^[a-z]+:\s/i.test(first) && !/[.!?]$/.test(first)) continue;       // "logo: …" and friends
    if (BUTTON_PARTS.has(n.featureId)) { if (words(first) <= 5) add(out.buttons, first); continue; }
    const sentence = firstSentence(first);
    if (HEADING_PARTS.has(n.featureId) && words(first) <= 9) add(out.headings, first.length > 70 ? sentence : first);
    else if (LINE_PARTS.has(n.featureId) || words(first) > 9) { if (words(sentence) >= 5 && sentence.length <= 160) add(out.lines, sentence); }
    else if (words(first) >= 1 && words(first) <= 7 && first.length <= 60) add(out.headings, first);
  }
  for (const p of pages) if (p && !/^home$/i.test(p)) add(out.pages, p);
  return out;
}

/** An item in a comma list: no commas or colons of its own, which would split it. */
const item = (s: string) => clean(s.replace(/[,:;]+/g, " ")).slice(0, 80);
const short = (s: string) => words(s) <= 4;

/**
 * Whether a catalogue placeholder is an example (the words a part would
 * really hold) or an instruction to the person ("Optional, one per card").
 * Only the first kind may be drawn on a preview.
 */
export function isExample(placeholder: string): boolean {
  return !/^(optional|type |one |what |describe|anything|the first|a paragraph|a line|how |sites, eras)/i.test(placeholder.trim())
    && !/…$/.test(placeholder.trim());
}

/**
 * The words a preview is drawn with.
 *
 * The site's own where there are enough of them, set in the shape the part
 * reads (`content.label` says what that shape is); the catalogue's example
 * where the site has too few; and nothing, so the part draws its own
 * default, where neither fits. Never invented filler.
 */
export function exampleContent(feature: FeatureDef, w: SiteWords): string | undefined {
  const label = (feature.content?.label ?? "").toLowerCase();
  const placeholder = feature.content?.placeholder ?? "";
  const fallback = placeholder && isExample(placeholder) ? placeholder : undefined;
  if (!label) return undefined;
  const heads = w.headings.map(item).filter(Boolean);
  const shorts = [...w.pages, ...heads.filter(short)].map(item);
  const lines = w.lines.map(item).filter(Boolean);
  const pairs = heads.slice(0, 3).map((h, i) => (lines[i] ? `${h}: ${lines[i]}` : h));

  if (/headline/.test(label)) return heads[0] ? [heads[0], lines[0]].filter(Boolean).join(", ") : fallback;
  if (/label, heading, button/.test(label)) {
    return heads[0] ? `label: ${shorts[0] ?? w.name}, heading: ${heads[0]}, button: ${w.buttons[0] ?? "Get in touch"}` : fallback;
  }
  if (/links, and the wordmark/.test(label)) return `logo: ${w.name}${shorts.length ? `, ${shorts.slice(0, 4).join(", ")}` : ""}`;
  if (/card titles|tile titles|article titles|product names|questions/.test(label)) {
    return pairs.length >= 2 ? pairs.join(", ") : fallback;
  }
  if (/links|top-level items|tab labels|row titles|sections|bands|trail|steps|sidebar items|left side items|tile labels|phrases|names|logos/.test(label)) {
    return shorts.length >= 2 ? shorts.slice(0, 4).join(", ") : fallback;
  }
  if (/sentence|quote|paragraph|sample text|note|the idea/.test(label)) return lines[0] ?? heads[0] ?? fallback;
  if (/^title$|the words|the tag/.test(label)) return shorts[0] ?? heads[0] ?? fallback;
  if (/^label$/.test(label)) return w.buttons[0] ?? fallback;
  return fallback;
}
