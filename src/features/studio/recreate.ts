/**
 * Recreating one element from a live site, near identically.
 *
 * The second phase of the create space. A person points at an element on a
 * real page and it arrives on the board as a part of this Builder — near
 * identically, and then **editable and promptable for another project**.
 * That last clause is the whole design constraint, and it rules out the
 * obvious implementation: a picture of somebody's header with fields bolted
 * on is not editable, it is a screenshot with a form over it.
 *
 * **Measure first, model second.** This app already holds the rule, three
 * times over: the drawn line is the specification and nothing may
 * paraphrase it; the clip is exact by construction and no segmenter can
 * beat it (`drawRun.ts`, `imageRoute.ts`). A live element is the same
 * situation. Its box, its words, its colours, its type and its layout are
 * *readable*, exactly, by the headless browser this app already ships
 * (`api/studio/headless.ts`). Screenshotting it and asking a model what
 * colour it thinks the background was is the line-described-is-a-line-lost
 * mistake in another costume. So:
 *
 *   1. The page is opened and the element **measured** — an `ElementReading`
 *      below. No model, no key, exact, and free.
 *   2. That reading picks a **real library part** out of the catalogue here,
 *      off the measurements, the way `coded.ts` picks one off a drawing: a
 *      declaration, a number, and a patch. Nothing is asked of anything.
 *   3. The part arrives with the real words in `content`, the real colours
 *      in `colour`, the real type in `font`, the measured layout in
 *      `options`, and its own `prompt`. It is an ordinary node made of a
 *      real component from that moment: the Inspector edits it, the wheel
 *      repaints it, the blueprint writes it, Build ships it.
 *   4. Only what measurement **cannot** give — the imagery inside it, a
 *      photograph or a mark — is a model's job, and that is the `recreate`
 *      step, the grounded one, which asks Nano Banana 2 with `image_search`
 *      and `google_search` on because the step is `recreate`
 *      (`groundingFor`). Those flags are euler's and are asked for by
 *      naming the step, never re-declared here.
 *
 * Without a key, steps 1 to 3 still happen in full: the structure, the
 * words, the colours and the type are all measured rather than generated.
 * A recreation is never lost to a missing key, the same rule the drawing
 * board keeps.
 *
 * Pure: no React, no store, no fetch, no browser. The route measures and
 * hands a reading here; the panel calls `recreateFrom` and applies the
 * patch. `tests/recreate.mjs` holds it.
 */
import type { NodeColour, NodeFont } from "./parts/theme.ts";
import type { StudioNode } from "./store.ts";

/**
 * The faces this app has, by name.
 *
 * Written out rather than imported: `FAMILY` lives in `parts/theme.ts`,
 * which reaches the palette and the whole render chain, and this file is
 * pure so that the route can measure without pulling any of it in.
 * `tests/recreate.mjs` holds this list to that one, so the two cannot
 * drift apart in silence.
 */
export const FAMILIES = [
  "geometric sans", "grotesque sans", "serif", "display", "condensed",
  "monospace", "handwritten", "system sans", "humanist sans",
] as const;

/* ------------------------------------------------------------------ */
/* What was measured                                                    */
/* ------------------------------------------------------------------ */

/** One run of words inside the element, with the size it was actually set at. */
export interface TextRun {
  words: string;
  /** Rendered size in CSS pixels, so the biggest run is the headline by measurement rather than by tag. */
  px: number;
  weight: number;
  /** Where it sits in the element's own box, as fractions, so a caption under a title is known to be under it. */
  y: number;
}

/** A picture inside the element. `src` is absolute; a small one may also arrive inline. */
export interface ReadImage {
  src: string;
  w: number;
  h: number;
  alt: string;
  /** True when it is the element's own background rather than an `img`. */
  ground?: boolean;
  /** True when it is the background of something behind it, the body's included: the page's look, not the block's. */
  behind?: boolean;
}

export interface ElementReading {
  /** Where it came from, kept on the node so the panel can say so and read it again. */
  from: { url: string; host: string; selector: string; at: number };
  /** The element's box on the page, in CSS pixels. */
  box: { x: number; y: number; w: number; h: number };
  /** How far down the page it sits, as a fraction of the page's height: a header is at the top by measurement. */
  down: number;
  tag: string;
  role: string | null;
  /** Every run of words inside it, in reading order. */
  text: TextRun[];
  /** What it links to: the words, and where they go. */
  links: { words: string; href: string }[];
  /** The words on anything that reads as a button. */
  buttons: string[];
  images: ReadImage[];
  /**
   * What it is painted with. Every colour is `rgb()` or `rgba()`, as the
   * browser reports it. `behind` is the nearest painted background up the
   * page from it, the body's included, for a block that paints nothing of
   * its own: what a person sees behind its words.
   */
  paint: { bg: string; text: string; border: string | null; radius: number; shadow: boolean; behind?: string | null };
  /** How it is set. `family` is the first name off the stack, lowercased. */
  type: { family: string; px: number; weight: number; spacing: number; leading: number };
  /** How its own children run: across, down, or in a grid of so many. */
  layout: { flow: "row" | "column" | "grid"; columns: number; gap: number };
  /** The direct children's boxes, in the element's own coordinates. The structure, without the DOM. */
  children: { x: number; y: number; w: number; h: number }[];
}

/** How sure a match has to be before the catalogue claims the element. */
export const SURE_ENOUGH = 0.5;

/* ------------------------------------------------------------------ */
/* Reading the measurements                                             */
/* ------------------------------------------------------------------ */

/** Width over height. A header is wide, a button is small and wide, a hero is nearly square. */
export const aspect = (r: ElementReading): number => r.box.w / Math.max(1, r.box.h);

/** The biggest run of words in it, which is the headline whatever it was tagged. */
export function headline(r: ElementReading): TextRun | null {
  let best: TextRun | null = null;
  for (const t of r.text) if (t.words.trim() && (!best || t.px > best.px)) best = t;
  return best;
}

/** Every run but the headline, in reading order. */
export function body(r: ElementReading): TextRun[] {
  const head = headline(r);
  return r.text.filter((t) => t !== head && t.words.trim());
}

/** A colour the browser reported, as [r, g, b, a]. Null for a colour it did not. */
export function rgba(v: string | null | undefined): [number, number, number, number] | null {
  const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?/i.exec(v ?? "");
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3]), m[4] === undefined ? 1 : Number(m[4])];
}

/** Is this colour see-through enough to mean "nothing was painted here"? */
export function bare(v: string | null | undefined): boolean {
  const c = rgba(v);
  return !c || c[3] < 0.05;
}

/** How far from grey a colour is, 0..1: what makes an accent an accent. */
export function chroma(v: string | null | undefined): number {
  const c = rgba(v);
  if (!c) return 0;
  const [r, g, b] = c;
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255;
}

/** How light, 0..1. */
export function light(v: string | null | undefined): number {
  const c = rgba(v);
  if (!c) return 0;
  return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
}

/**
 * The family the page was set in, as one of this app's own.
 *
 * Named rather than copied: the site's stack is somebody else's font list,
 * and a part that carried it verbatim would render in a face the generated
 * project has no licence to and no file for. The nearest of `FAMILY` is
 * what a person can then change from the wheel, which is the point.
 */
export function familyOf(stack: string): string | undefined {
  const s = stack.toLowerCase();
  if (/mono|courier|consolas|menlo/.test(s)) return "monospace";
  if (/georgia|times|garamond|serif/.test(s) && !/sans-serif/.test(s)) return "serif";
  if (/impact|black|display/.test(s)) return "display";
  if (/narrow|condensed/.test(s)) return "condensed";
  if (/futura|avenir|century gothic|poppins|montserrat/.test(s)) return "geometric sans";
  if (/helvetica|inter|arial|roboto/.test(s)) return "grotesque sans";
  if (/segoe|trebuchet|tahoma/.test(s)) return "humanist sans";
  if (/comic|cursive|script/.test(s)) return "handwritten";
  return /sans/.test(s) ? "system sans" : undefined;
}

/**
 * The type, as a part's own override.
 *
 * `size` is relative to the site's base, which is this app's rule: a part
 * set a shade larger stays a shade larger when the site's type changes. So
 * a 19px body on a 16px page is 1.19, not 19.
 */
export function fontFrom(r: ElementReading, base = 16): NodeFont {
  const f: NodeFont = {};
  const fam = familyOf(r.type.family);
  if (fam) f.family = fam;
  if (r.type.px > 0) f.size = Math.round((r.type.px / base) * 100) / 100;
  if (r.type.weight) f.weight = r.type.weight;
  if (Number.isFinite(r.type.spacing) && Math.abs(r.type.spacing) > 0.005) f.spacing = Math.round(r.type.spacing * 1000) / 1000;
  if (r.type.leading > 0) f.leading = Math.round((r.type.leading / Math.max(1, r.type.px)) * 100) / 100;
  return f;
}

/**
 * The colours, as a part's own override.
 *
 * Three of the six roles can be measured honestly off one element and the
 * other three cannot, so only three are written. `bg` is what it is painted
 * on, `text` is what its words are set in, and `accent` is the most
 * coloured thing in it — a button's fill, else its border. A role nobody
 * measured is left alone rather than guessed, so the part follows the site
 * for the rest, which is what makes it fit the project it is recreated
 * into rather than dragging somebody else's palette across.
 */
export function colourFrom(r: ElementReading): NodeColour {
  const c: NodeColour = {};
  // Painted on nothing of its own, a block is painted on what is behind it: the page's ground is its ground.
  if (!bare(r.paint.bg)) c.bg = r.paint.bg;
  else if (!bare(r.paint.behind)) c.bg = r.paint.behind ?? undefined;
  if (!bare(r.paint.text)) c.text = r.paint.text;
  const accent = [r.paint.border, r.paint.bg].filter((v) => !bare(v) && chroma(v) > 0.12)[0];
  if (accent && accent !== c.bg) c.accent = accent;
  return c;
}

/** The words a part draws, one per line: this app's own rule for contents that may hold commas. */
export const lines = (items: string[]): string => items.map((s) => s.trim()).filter(Boolean).join("\n");

/* ------------------------------------------------------------------ */
/* The catalogue                                                        */
/* ------------------------------------------------------------------ */

export interface Recreatable {
  id: string;
  /** The library id this becomes. It must already exist in the catalog. */
  featureId: string;
  /** One sentence: what this is. */
  what: string;
  /** What an element has to measure like to mean it. */
  looksLike: string;
  /** How sure, 0 to 1. Zero means no. Never calls anything. */
  match: (r: ElementReading) => number;
  /** What the node becomes, and the line that says what happened. */
  configure: (r: ElementReading) => { patch: Partial<StudioNode>; did: string };
}

/** Everything measured that every recreation carries, whichever part it becomes. */
function common(r: ElementReading): Partial<StudioNode> {
  const colour = colourFrom(r);
  const font = fontFrom(r);
  return {
    w: Math.max(40, Math.round(r.box.w)),
    h: Math.max(24, Math.round(r.box.h)),
    ...(Object.keys(colour).length ? { colour } : {}),
    ...(Object.keys(font).length ? { font } : {}),
    ...(r.paint.radius >= 999 ? { shape: "circle" as const } : r.paint.radius > 6 ? { shape: "rounded" as const } : {}),
  };
}

/**
 * A bar across the top with a name at one end and links at the other.
 *
 * The header reads `logo:` and `button:` out of its own contents rather
 * than printing "Logo" and "Get started" on every site ever built from
 * this, so a recreation fills both by name.
 */
const TOP_BAR: Recreatable = {
  id: "top-bar",
  featureId: "sticky-header",
  what: "The bar across the top: the site's name at one end, its links at the other, often a button.",
  looksLike: "Wide and short, at the very top of the page, with several links in a row.",
  match: (r) => {
    if (r.down > 0.12 || aspect(r) < 4 || r.box.h > 160) return 0;
    const nav = r.tag === "header" || r.tag === "nav" || r.role === "banner" || r.role === "navigation";
    if (r.links.length < 2) return nav ? 0.55 : 0;
    return nav ? 1 : 0.75;
  },
  configure: (r) => {
    const head = headline(r);
    // The name is the biggest short run, or the first link, or the host.
    const name = (head && head.words.length <= 24 ? head.words : "") || r.links[0]?.words || r.from.host;
    const nav = r.links.filter((l) => l.words.trim() && l.words !== name).map((l) => l.words);
    const button = r.buttons[0];
    return {
      patch: {
        featureId: "sticky-header",
        custom: false,
        content: lines([`logo: ${name}`, ...nav.slice(0, 6), ...(button ? [`button: ${button}`] : [])]),
        ...common(r),
      },
      did: `a top bar for ${name}, ${nav.length} link${nav.length === 1 ? "" : "s"}${button ? ` and a ${button} button` : ""}`,
    };
  },
};

/** The first screen: a big line, a sentence under it, usually a button. */
const HERO: Recreatable = {
  id: "hero",
  featureId: "hero-split",
  what: "The first screen: the big line, the sentence under it, and the button.",
  looksLike: "Near the top, tall, with one run of words far bigger than the rest.",
  match: (r) => {
    if (r.down > 0.45 || r.box.h < 220) return 0;
    const head = headline(r);
    if (!head || head.px < 28) return 0;
    const rest = body(r);
    const big = rest.length ? head.px / Math.max(1, Math.max(...rest.map((t) => t.px))) : 2;
    if (big < 1.5) return 0;
    return Math.min(1, 0.5 + (head.px - 28) / 60 + (r.buttons.length ? 0.2 : 0));
  },
  configure: (r) => {
    const head = headline(r)!;
    const rest = body(r).slice(0, 2).map((t) => t.words);
    return {
      patch: {
        featureId: "hero-split",
        custom: false,
        content: lines([head.words, ...rest, ...r.buttons.slice(0, 1).map((b) => `button: ${b}`)]),
        ...common(r),
      },
      did: `a first screen headed "${head.words.slice(0, 40)}"`,
    };
  },
};

/** Several boxes the same size, side by side or wrapped: a card grid. */
const CARDS: Recreatable = {
  id: "cards",
  featureId: "card-grid",
  what: "Repeating cards: the same box several times with different words in it.",
  looksLike: "Three or more children of near enough the same size, in a row or a grid.",
  match: (r) => {
    const kids = r.children;
    if (kids.length < 3) return 0;
    const w = kids.map((k) => k.w);
    const spread = (Math.max(...w) - Math.min(...w)) / Math.max(1, Math.max(...w));
    if (spread > 0.25) return 0;
    // A row of links in a bar is not a grid of cards: cards have area.
    if (kids[0]!.h < 60) return 0;
    return r.layout.flow === "grid" || r.layout.columns > 1 ? 1 : 0.7;
  },
  configure: (r) => {
    const kids = r.children.length;
    const cols = r.layout.columns > 1 ? r.layout.columns : Math.max(1, Math.round(r.box.w / Math.max(1, r.children[0]!.w)));
    /*
     * A card's title, not a card's every word.
     *
     * `body` drops the headline, which is right for a band that has one and
     * wrong here — a grid's titles are all the same size, so dropping the
     * largest ate the first card. Taking the first few runs instead was
     * wrong the other way: each card holds a title *and* a sentence, so
     * three cards came back as "Quiet", "Nothing shouts here." and "Slow".
     *
     * The titles are the runs set at the largest size that appears about as
     * many times as there are cards, which is what a title *is* on a grid
     * of repeating boxes. Measured, not guessed at from tags: the page may
     * mark them up however it likes.
     */
    const sizes = new Map<number, TextRun[]>();
    for (const t of r.text) {
      if (!t.words.trim() || t.words.length >= 60) continue;
      sizes.set(t.px, [...(sizes.get(t.px) ?? []), t]);
    }
    const bySize = [...sizes.entries()].sort((a, b) => b[0] - a[0]);
    const titleRuns = bySize.find(([, runs]) => runs.length >= kids)?.[1] ?? bySize[0]?.[1] ?? [];
    /*
     * Each title with its own sentence: the runs after a title and before
     * the next, joined, as "title: sentence", which is what the grid part
     * reads. Without it the part drew a filler sentence under a real title.
     */
    const titles = titleRuns.slice(0, kids).map((t) => {
      const at = r.text.indexOf(t);
      // The sentence is the run right after the title: the card's own line,
      // not its code sample and its link as well, which came out as
      // "…and WebKit. npm init playwright@latest Testing documentation".
      const after = r.text[at + 1];
      const said = after && !titleRuns.includes(after) ? after.words.trim().replace(/\s+/g, " ").slice(0, 160) : "";
      const title = t.words.replace(/:/g, " ").trim();
      return said ? `${title}: ${said}` : title;
    });
    return {
      patch: {
        featureId: "card-grid",
        custom: false,
        content: lines(titles.length ? titles : Array.from({ length: kids }, (_, i) => `Card ${i + 1}`)),
        options: { columns: String(Math.max(1, Math.min(6, cols))) },
        ...common(r),
      },
      did: `${kids} cards in ${cols} column${cols === 1 ? "" : "s"}`,
    };
  },
};

/** One painted box with one short line in it, that goes somewhere. */
const BUTTON: Recreatable = {
  id: "button",
  featureId: "cta-primary",
  what: "The one button: a painted box with a few words in it that goes somewhere.",
  looksLike: "Small, wider than it is tall, painted or outlined, with one short run of words.",
  match: (r) => {
    if (r.box.h > 90 || r.box.w > 460 || aspect(r) < 1.2) return 0;
    const words = r.text.map((t) => t.words.trim()).filter(Boolean);
    if (words.length !== 1 || words[0]!.length > 32) return 0;
    const painted = !bare(r.paint.bg) || !!r.paint.border;
    const acts = r.tag === "button" || r.role === "button" || r.links.length === 1;
    if (!painted && !acts) return 0;
    return painted && acts ? 1 : 0.7;
  },
  configure: (r) => {
    const words = r.text.map((t) => t.words.trim()).filter(Boolean)[0] ?? "Get started";
    const href = r.links[0]?.href;
    return {
      patch: {
        featureId: "cta-primary",
        custom: false,
        content: words,
        ...(href && /^https?:/i.test(href) ? { link: { kind: "url" as const, target: href } } : {}),
        ...common(r),
      },
      did: `a "${words}" button`,
    };
  },
};

/** The foot of the page: the same name as the top, and a lot of links. */
const FOOTER: Recreatable = {
  id: "footer",
  featureId: "footer",
  what: "The foot of the page: the name again, the links, the legal line.",
  looksLike: "Wide, at the bottom of the page, with many links.",
  match: (r) => {
    if (r.down < 0.6 || aspect(r) < 2) return 0;
    if (r.tag === "footer" || r.role === "contentinfo") return 1;
    /*
     * Untagged, a footer is a band of written links low on the page. Only
     * links that are words on the page count: once icon links were named
     * by their labels, a band of nine company marks near the foot read as
     * a footer with nine links, and it is a band of pictures.
     */
    const said = r.text.map((t) => t.words.trim()).filter(Boolean);
    const written = r.links.filter((l) => said.some((w) => w === l.words || w.includes(l.words)));
    return written.length >= 4 ? 0.7 : 0;
  },
  configure: (r) => {
    const name = r.from.host.replace(/^www\./, "");
    const links = r.links.map((l) => l.words).filter(Boolean).slice(0, 10);
    return {
      patch: {
        featureId: "footer",
        custom: false,
        content: lines([`logo: ${name}`, ...links]),
        ...common(r),
      },
      did: `a footer with ${links.length} link${links.length === 1 ? "" : "s"}`,
    };
  },
};

/**
 * A list of links: a sidebar of pages, a list of resources, a menu that is
 * not the top bar. One of the commonest things on any page, and it was
 * landing as a band of words, which kept the words and lost the fact that
 * every one of them goes somewhere.
 */
const LINKS: Recreatable = {
  id: "links",
  featureId: "scrollspy-nav",
  what: "A list of links: a sidebar of pages, resources, a menu that is not the top bar.",
  looksLike: "Three or more links, and the links are most of the words in it; not at the very top or the very bottom of the page.",
  match: (r) => {
    if (r.links.length < 3) return 0;
    // The top bar and the footer are their own shapes and read first.
    if (r.down <= 0.12 && aspect(r) >= 4) return 0;
    const said = r.text.map((t) => t.words.trim()).filter(Boolean);
    const linked = r.links.map((l) => l.words.trim()).filter(Boolean);
    if (!said.length) return 0;
    // How much of the words are links: all of them is a list, half is a band with links in it.
    const share = said.filter((w) => linked.some((l) => l === w || w.startsWith(l) || l.startsWith(w))).length / said.length;
    if (share < 0.5) return 0;
    return 0.6 + 0.4 * share;
  },
  configure: (r) => {
    const links = r.links.map((l) => l.words.trim()).filter(Boolean).slice(0, 24);
    const head = headline(r);
    // A heading over the list is the list's name, and it is not a link.
    const named = head && !links.includes(head.words.trim()) && head.words.length <= 40 ? head.words.trim() : null;
    return {
      patch: {
        featureId: "scrollspy-nav",
        custom: false,
        content: lines(links),
        ...common(r),
      },
      did: `a list of ${links.length} links${named ? ` under "${named}"` : ""}`,
    };
  },
};

/**
 * A band of words: a section that is neither a bar, a hero, a grid nor a
 * button. It is the fall-through and it still lands a real part.
 */
const PROSE: Recreatable = {
  id: "prose",
  featureId: "value-prop",
  what: "A band of words: a line and a sentence, with nothing else going on.",
  looksLike: "Anything with words in it that is not one of the shapes above.",
  match: (r) => (r.text.some((t) => t.words.trim()) ? 0.5 : 0),
  configure: (r) => {
    const head = headline(r);
    return {
      patch: {
        featureId: "value-prop",
        custom: false,
        content: lines([head?.words ?? "", ...body(r).slice(0, 3).map((t) => t.words)]),
        ...common(r),
      },
      did: head ? `a band of words: "${head.words.slice(0, 40)}"` : "a band of words",
    };
  },
};

/**
 * The catalogue, most particular first.
 *
 * Adding the next one is a file and a line here, the same as `coded.ts`,
 * and for the same reason: the layer decides for free and decides the same
 * way every time.
 */
export const RECREATABLE: readonly Recreatable[] = [TOP_BAR, HERO, CARDS, BUTTON, FOOTER, LINKS, PROSE];

/* ------------------------------------------------------------------ */
/* The answer                                                           */
/* ------------------------------------------------------------------ */

export interface Recreation {
  /** Which catalogue entry claimed it. */
  id: string;
  /** How sure, so the panel can say the reading was a guess. */
  sure: number;
  patch: Partial<StudioNode>;
  /** What happened, in a line, for the news and the card. */
  did: string;
  /** True when the element holds a picture measurement cannot make: the grounded step has something to do. */
  wantsPicture: boolean;
}

/** The pictures in it that are worth asking a model for: real ones, not spacers or icons. */
export function picturesIn(r: ElementReading): ReadImage[] {
  return r.images.filter((im) => im.w >= 64 && im.h >= 64);
}

/**
 * The part this element becomes. Nothing is asked of anything.
 *
 * Best over `SURE_ENOUGH` wins; the fall-through always matches, so there
 * is always an answer and it is always a real part of the library.
 */
export function recreateFrom(r: ElementReading): Recreation {
  let best: Recreatable | null = null;
  let sure = 0;
  for (const c of RECREATABLE) {
    const n = c.match(r);
    if (n > sure) { best = c; sure = n; }
  }
  const pick = sure >= SURE_ENOUGH && best ? best : PROSE;
  const { patch, did } = pick.configure(r);
  const wants = picturesIn(r).length > 0;
  return {
    id: pick.id,
    sure: pick === PROSE && best !== PROSE ? PROSE.match(r) : sure,
    patch: {
      ...patch,
      label: labelFor(pick, r),
      prompt: promptFor(pick, r),
      from: r.from,
    } as Partial<StudioNode>,
    did,
    wantsPicture: wants,
  };
}

/** What it is called on the board: what it is, and whose it was. */
export function labelFor(pick: Recreatable, r: ElementReading): string {
  const host = r.from.host.replace(/^www\./, "");
  const what = pick.id === "top-bar" ? "Top bar" : pick.id === "hero" ? "First screen" : pick.id === "cards" ? "Cards" : pick.id === "button" ? "Button" : pick.id === "footer" ? "Footer" : pick.id === "links" ? "Links" : "Words";
  return `${what} from ${host}`;
}

/**
 * The prompt it arrives with.
 *
 * Seeded rather than blank, and seeded with the two things a person needs
 * next: what it is a recreation of, and that the words and colours are the
 * real ones so changing them is the work. A part that arrived with an empty
 * prompt would be a part nobody knows how to steer.
 */
export function promptFor(pick: Recreatable, r: ElementReading): string {
  const host = r.from.host.replace(/^www\./, "");
  return `Recreated from ${host}: ${pick.what.toLowerCase()} The words, the colours and the type are the real ones, measured. Say here what should change for this project.`;
}
