/**
 * A NAME FOR A PART THAT A PERSON CAN READ.
 *
 * A captured part arrives named by the page's machinery: "div · 1 inside",
 * "::after · 0 inside", "main · 7 inside (h)", or an id like "n_box_63".
 * Those are how the capture told its boxes apart, and they are what every
 * list in the side panel used to print. Nobody looking at a yellow comic
 * page thinks of its heading as "div · 1 inside".
 *
 * So a part is named, in this order, by
 *
 *   1. the name its owner gave it (a label that is not machinery),
 *   2. its own words ("Buy $TRORTY"),
 *   3. the name the browser computed for it, which the capture writes into
 *      the prompt ("The browser computes it as a button, named “Creator Hub”"),
 *   4. its picture's description,
 *   5. what it is (a button, a picture, a decoration) and the heading of the
 *      section it sits in ("Picture in “Meet Trumpmorty”").
 *
 * And the path the capture recorded ("body > main > section:nth-of-type(1)
 * > div") stays inside: `capturedFrom` reads it out of the prompt so the
 * panel can say "From trumpmorty.fun, “Meet Trumpmorty”" instead.
 *
 * Pure: no store, no DOM, no catalogue, so a test reads it on its own.
 */
import { under } from "./owns.ts";

export interface Named {
  id: string;
  label?: string;
  content?: unknown;
  prompt?: string;
  featureId?: string;
  pageId?: string;
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  font?: { size?: number } | null;
  picture?: { alt?: string } | null;
  link?: unknown;
  from?: { host?: string; url?: string; selector?: string; id?: string } | null;
}

/** The capture's own names for its boxes, and ids: never a name to show. */
export function isMachineLabel(label: string | undefined | null): boolean {
  const s = (label ?? "").trim();
  if (!s) return true;
  /* The capture's count of what a box holds is machinery whatever comes before it: "link “BUY” · 4 inside". */
  if (/·\s*\d+\s+inside(\s*\([\w\s]+\))?$/.test(s)) return true;
  if (/^n_[a-z]+_\d+$/i.test(s) || /^(node|box|part)[_-]?\d+$/i.test(s)) return true;
  /* "div · 1 inside", "::after · 0 inside", "main · 7 inside (h)", "section", "span" */
  const m = /^(::?[\w-]+|[a-z][a-z0-9-]*)(\s*·\s*\d+\s+inside)?(\s*\([\w\s]+\))?$/.exec(s);
  if (!m) return false;
  return m[1]!.startsWith(":") || !!m[2] || TAGS.has(m[1]!);
}

const TAGS = new Set(["div", "span", "section", "main", "header", "footer", "nav", "aside", "article", "a", "p", "li", "ul", "ol", "img", "svg", "path", "g", "button", "figure", "picture", "canvas", "video", "iframe", "form", "input", "label", "h1", "h2", "h3", "h4", "h5", "h6", "body", "strong", "em", "i", "b", "small"]);

/** A part's words, as one line. */
export function wordsOf(n: Pick<Named, "content">): string {
  const c = n.content;
  const raw = typeof c === "string" ? c : Array.isArray(c) ? (c as { text?: string }[]).map((s) => (s && typeof s === "object" ? s.text ?? "" : "")).join("") : "";
  return raw.replace(/\s+/g, " ").trim();
}

/** Words in curly quotes, once: a name that already quotes its words ("Link “BUY”") is not quoted again. */
export const quoted = (s: string) => (/[“”]/.test(s) ? s : `“${s}”`);

const clip = (s: string, max = 40) => (s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s);

/** What the browser computed the part to be, and the name it gave it, when the capture wrote that down. */
export function computedAs(prompt: string | undefined): { role: string; name: string | null } | null {
  const m = /computes it as (?:an? )?([\w-]+)(?:, named “([^”]+)”)?/i.exec(prompt ?? "");
  return m ? { role: m[1]!.toLowerCase(), name: m[2]?.trim() || null } : null;
}

/** The last element of a capture path: "section:nth-of-type(1)" is "section", "::after" is "::after". */
function lastTag(selector: string | undefined): string {
  const last = (selector ?? "").split(">").map((s) => s.trim()).filter(Boolean).pop() ?? "";
  /* A line of words the capture read straight off its holder (`section ::line(5)`) is words, not the holder. */
  if (/::line\(/.test(last)) return "";
  if (/::?(before|after)\b/.test(last)) return "::after";
  return (last.match(/^[a-z][a-z0-9-]*/i)?.[0] ?? "").toLowerCase();
}

/** True when the path runs through a link or a button: the words are that control's label. */
export function insideControl(n: Pick<Named, "from" | "prompt" | "link">): boolean {
  const path = (n.from?.selector ?? "").split(">").map((s) => s.trim().match(/^[a-z][a-z0-9-]*/i)?.[0]?.toLowerCase() ?? "");
  if (path.slice(0, -1).some((t) => t === "a" || t === "button")) return true;
  const last = path[path.length - 1];
  if (last === "a" || last === "button") return true;
  const as = computedAs(n.prompt);
  return !!as && (as.role === "button" || as.role === "link");
}

const ROLE_WORD: Record<string, string> = {
  a: "Link", link: "Link", button: "Button", img: "Picture", image: "Picture", picture: "Picture", svg: "Drawing", video: "Video",
  h1: "Heading", h2: "Heading", h3: "Heading", h4: "Heading", heading: "Heading", p: "Words", span: "Words", li: "List item",
  ul: "List", ol: "List", list: "List", nav: "Menu", navigation: "Menu", header: "Header", footer: "Footer", section: "Section",
  main: "Page body", form: "Form", input: "Field", textbox: "Field", "::after": "Decoration", "::before": "Decoration",
  iframe: "Embedded page", canvas: "Drawing", select: "Field", textarea: "Field",
  /* A <details> toggle: pressed, it opens what its <details> holds. */
  summary: "Toggle",
};

/** What kind of thing the part is, in a word. */
export function kindOf(n: Named, featureName?: (id: string) => string | undefined): string {
  const as = computedAs(n.prompt);
  if (as && ROLE_WORD[as.role]) return ROLE_WORD[as.role]!;
  const tag = lastTag(n.from?.selector) || (n.label ?? "").trim().match(/^(::?[\w-]+|[a-z][a-z0-9-]*)/)?.[0]?.toLowerCase() || "";
  if (tag === "::before") return "Decoration";
  if (ROLE_WORD[tag]) return ROLE_WORD[tag]!;
  if (n.picture) return "Picture";
  if (wordsOf(n)) return "Words";
  const f = n.featureId ? featureName?.(n.featureId) : undefined;
  if (f && f !== "Box") return f;
  return "Box";
}

const contains = (a: Named, b: Named) =>
  (a.x ?? 0) <= (b.x ?? 0) + 1 && (a.y ?? 0) <= (b.y ?? 0) + 1 &&
  (a.x ?? 0) + (a.w ?? 0) >= (b.x ?? 0) + (b.w ?? 0) - 1 && (a.y ?? 0) + (a.h ?? 0) >= (b.y ?? 0) + (b.h ?? 0) - 1;

/* Read once per part object: parts are never changed in place (the store makes a new one), so the answer holds. */
const headingish = new WeakMap<Named, boolean>();
export const isHeadingish = (n: Named) => {
  let v = headingish.get(n);
  if (v === undefined) {
    const words = wordsOf(n);
    const tag = !words || words.length > 60 ? "" : lastTag(n.from?.selector);
    v = !!words && words.length <= 60 && (/^h[1-4]$/.test(tag) || computedAs(n.prompt)?.role === "heading" || n.featureId === "heading" || (n.font?.size ?? 0) >= 24);
    headingish.set(n, v);
  }
  return v;
};

/*
 * ONE LIST, READ ONCE. Naming every part of a board asks, for each part,
 * what every other part holds: on a 2,000-part capture (sunkcoin.fun) that
 * was billions of comparisons and froze the Builder for twenty seconds. What
 * a list says (each page's parts, what each box holds, its first heading) is
 * kept beside the list itself, and a new list (any edit) starts afresh.
 */
interface ListMemo { pages: Map<string, readonly Named[]>; within: Map<Named, Named[]>; heading: Map<Named, string | null>; headed: Map<string, boolean> }
const memos = new WeakMap<readonly Named[], ListMemo>();
const memoOf = (all: readonly Named[]): ListMemo => {
  let m = memos.get(all);
  if (!m) { m = { pages: new Map(), within: new Map(), heading: new Map(), headed: new Map() }; memos.set(all, m); }
  return m;
};
/** The list's parts on a page (every part when the page is not said). */
function onPageOf(pageId: string | undefined, all: readonly Named[]): readonly Named[] {
  if (!pageId) return all;
  const m = memoOf(all);
  let p = m.pages.get(pageId);
  if (!p) { p = all.filter((x) => x.pageId === pageId); m.pages.set(pageId, p); }
  return p;
}

/** The parts drawn inside `box` on its page, top to bottom, then left to right. */
/*
 * WHAT A PART HOLDS, BY THE PATH WHERE THE CAPTURE RECORDED ONE. Read by the
 * box alone, thesolface's hero held its fixed header (the header lies inside
 * the hero's box at y 14), and the hero was named for the header's button,
 * Section "JOIN THE WAVE" (J, 2026-10-21). Between two parts that both carry
 * a path, one holds the other only when its box does and the other's path
 * continues its own (`owns.ts#under`); a part placed by hand, with no path,
 * is read by its box as before (tests/section-names.mjs).
 */
const pathOf = (n: Named) => (n.from?.selector ?? "").trim();
const holds = (box: Named, x: Named) => {
  if (!(contains(box, x) && (x.w ?? 0) * (x.h ?? 0) < (box.w ?? 0) * (box.h ?? 0))) return false;
  const p = pathOf(box), q = pathOf(x);
  return !p || !q || under(p, q);
};
function within(box: Named, all: readonly Named[]): Named[] {
  const m = memoOf(all);
  let got = m.within.get(box);
  if (!got) {
    got = onPageOf(box.pageId, all)
      .filter((x) => x.id !== box.id && holds(box, x))
      .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
    m.within.set(box, got);
  }
  return got;
}

/** The first heading inside a part: a section is named by its own heading, never the page's. */
/* The h1–h4 element a part's words sit in, by its path: the hero's title is an h1 of two spans, "THE" and "SOL FACE", neither a heading on its own. */
const HEADING_STEP = /^(.* > h[1-4](?::nth-of-type\(\d+\))?)(?: > .*)?$/;
const headingAt = (n: Named) => HEADING_STEP.exec(pathOf(n))?.[1] ?? null;
const meets = (a: Named, b: Named) => (a.x ?? 0) < (b.x ?? 0) + (b.w ?? 0) && (b.x ?? 0) < (a.x ?? 0) + (a.w ?? 0) && (a.y ?? 0) < (b.y ?? 0) + (b.h ?? 0) && (b.y ?? 0) < (a.y ?? 0) + (a.h ?? 0);
/** The words of the h1–h4 element at `el`, read across its pieces in order: those whose path is inside it and that touch its own box, or the box of the part being named where the element has no part of its own (a copy elsewhere with the same path, a press-shown twin, is not one of them). */
function headingWords(el: string, near: Named, all: readonly Named[]): string {
  const page = onPageOf(near.pageId, all);
  const own = page.find((q) => pathOf(q) === el) ?? near;
  return page.filter((q) => q.id !== own.id && headingAt(q) === el && !!wordsOf(q) && meets(own, q)).sort((x, y) => (x.y ?? 0) - (y.y ?? 0) || (x.x ?? 0) - (y.x ?? 0)).map(wordsOf).join(" ");
}

/** The first heading inside a part: a part that reads as one, or the words of an h1–h4 element read across its pieces. */
function headingIn(box: Named, all: readonly Named[]): string | null {
  const inside = within(box, all);
  for (const p of inside) {
    const el = wordsOf(p) ? headingAt(p) : null;
    /* Its pieces by the path: a piece wider than the heading's own box ("SOL FACE", 736 in 708) is still part of it. */
    if (el) return clip(headingWords(el, box, all) || wordsOf(p));
    if (isHeadingish(p)) return clip(wordsOf(p));
  }
  /* The part may itself be the h1, holding the pieces. */
  const own = pathOf(box);
  if (own && headingAt(box) === own) { const words = headingWords(own, box, all); if (words) return clip(words); }
  return null;
}

function firstHeading(box: Named, all: readonly Named[]): string | null {
  const m = memoOf(all);
  if (m.heading.has(box)) return m.heading.get(box)!;
  const v = headingIn(box, all);
  m.heading.set(box, v);
  return v;
}

/* A button's words name the button, never what holds it (the header was "Header “JOIN THE WAVE”"). */
const isControl = (n: Named) => /^cta-/.test(n.featureId ?? "");

/* Ids a framework gives its own wrappers, which say nothing about the page. */
const FRAMEWORK_IDS = new Set(["root", "app", "__next", "__nuxt", "__layout", "svelte", "main-content", "content", "wrapper", "page"]);

/**
 * The page's own name for an element, as words: `community` is "Community",
 * `lore-section` is "Lore section", `howToBuy` is "How to buy". An id a
 * machine made (`radix-:r1:`, `w-node-4f2a`, digits in it) or a framework's
 * wrapper (`__next`) says nothing and is no name.
 */
export function idWords(id: string | undefined | null): string | null {
  const raw = typeof id === "string" ? id.trim() : "";
  if (!raw || raw.length > 32 || FRAMEWORK_IDS.has(raw.toLowerCase()) || !/^[A-Za-z][A-Za-z_-]*$/.test(raw)) return null;
  const words = raw.replace(/([a-z])([A-Z])/g, "$1 $2").split(/[-_\s]+/).filter(Boolean).map((w) => w.toLowerCase());
  if (!words.length || words.some((w) => w.length === 1 && words.length > 1)) return null;
  const s = words.join(" ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** A part's own title: its first heading, else the page's id for it (`#community`), else its first words. */
function ownTitle(box: Named, all: readonly Named[]): string | null {
  const inside = within(box, all);
  const heading = inside.length ? headingIn(box, all) : null;
  if (heading) return heading;
  const named = idWords(box.from?.id);
  if (named) return named;
  if (!inside.length) return null;
  const controls = inside.filter(isControl).map(pathOf).filter(Boolean);
  const h = inside.find((m) => !!wordsOf(m) && !isControl(m) && !controls.some((c) => under(c, pathOf(m))));
  return h ? clip(wordsOf(h)) : null;
}

/** Kinds that are a place on the page, not a thing in a section: never "Footer in …". */
const LANDMARKS = new Set(["Section", "Header", "Footer", "Menu", "Page body", "Form", "List"]);

/**
 * The heading of the section a part sits in: the first heading inside the
 * smallest part that holds it and has one, else the nearest heading above
 * it on its page. Null when the page has none.
 */
export function sectionOf(n: Named, all: readonly Named[]): string | null {
  const memo = memoOf(all);
  const key = n.pageId ?? "";
  let headed = memo.headed.get(key);
  if (headed === undefined) { headed = onPageOf(n.pageId, all).some(isHeadingish); memo.headed.set(key, headed); }
  /* The page's only heading may be the part itself, which never names its own section. */
  if (!headed || (isHeadingish(n) && !onPageOf(n.pageId, all).some((m) => m.id !== n.id && isHeadingish(m)))) return null;
  const page = onPageOf(n.pageId, all).filter((m) => m.id !== n.id);
  const holders = page.filter((m) => contains(m, n) && (m.w ?? 0) * (m.h ?? 0) > (n.w ?? 0) * (n.h ?? 0)).sort((a, b) => (a.w! * a.h!) - (b.w! * b.h!));
  for (const box of holders) {
    const h = firstHeading(box, all);
    if (h) return h;
  }
  const above = page.filter((h) => isHeadingish(h) && (h.y ?? 0) <= (n.y ?? 0)).sort((a, b) => (b.y ?? 0) - (a.y ?? 0));
  return above.length ? clip(wordsOf(above[0]!)) : null;
}

/** The name to print for a part, wherever parts are listed. */
export function partName(n: Named, all: readonly Named[] = [], featureName?: (id: string) => string | undefined): string {
  if (!isMachineLabel(n.label)) return clip(n.label!.trim(), 60);
  const words = wordsOf(n);
  if (words) return clip(words);
  const as = computedAs(n.prompt);
  const kind = kindOf(n, featureName);
  if (as?.name) return clip(`${kind} “${as.name}”`);
  const alt = n.picture?.alt?.trim();
  if (alt) return clip(`${kind} “${alt}”`);
  /* A part that holds others is named by what it holds: "Section “The Lore”". */
  const title = ownTitle(n, all);
  if (title) return clip(`${kind} “${title}”`, 60);
  if (LANDMARKS.has(kind)) return kind;
  const section = sectionOf(n, all);
  return section ? clip(`${kind} in “${section}”`, 60) : kind;
}

/**
 * Where a captured part came from, said plainly, and its prompt without the
 * capture's own sentence about it.
 *
 * The capture begins a part's prompt with "Captured from <address> as
 * <element path>." The address is worth saying; the path is how the capture
 * found the element and nothing a person reads. `rest` is the prompt with
 * that sentence taken off, and `join` puts it back, so the panel edits the
 * owner's words and the document keeps the capture's record whole.
 */
export function capturedFrom(n: Named, all: readonly Named[] = []): { says: string; prefix: string; rest: string } | null {
  const prompt = n.prompt ?? "";
  const m = /^\s*Captured from (\S+?)\/? as [^\n]*?\.(?=\s|$)\s*/.exec(prompt);
  if (!m && !n.from?.host && !n.from?.url) return null;
  const rawHost = m?.[1] ?? n.from?.host ?? n.from?.url ?? "";
  const host = rawHost.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  if (!host) return null;
  /* A section is from its own heading. */
  const heading = firstHeading(n, all);
  if (heading && !wordsOf(n)) return { says: `From ${host}, the “${heading}” section`, prefix: m?.[0] ?? "", rest: m ? prompt.slice(m[0].length) : prompt };
  const section = sectionOf(n, all);
  /* The part's own name when it has one (its words, its label, the name the
     browser gave it); the section it sits in when it has only a kind. */
  const own = partName(n, []);
  const hasOwn = own !== kindOf(n);
  const where = hasOwn
    ? `${quoted(own)}${section && section !== own && !own.includes(`“${section}”`) ? ` in the “${section}” section` : ""}`
    : section ? `the “${section}” section` : own.toLowerCase();
  return { says: `From ${host}, ${where}`, prefix: m?.[0] ?? "", rest: m ? prompt.slice(m[0].length) : prompt };
}

/**
 * A report line with the machinery taken out: the lists of internal ids a
 * sweep names ("…left alone: n_box_63, n_box_70.") and the capture's names
 * for its boxes ("main · 7 inside (h)"). What is left says how many and
 * what happened, which is what a person reads the line for; the ids stay
 * in the details beside it.
 */
export function idless(text: string): string {
  const ID = String.raw`(?:n_[a-z]+_\d+|[a-z]+_[a-z0-9]*\d[a-z0-9_]*)`;
  return text
    .replace(new RegExp(String.raw`:\s*${ID}(?:→${ID})?(?:,\s*${ID}(?:→${ID})?)*(?=[.;]|$)`, "g"), "")
    .replace(/(?:::?[\w-]+|\b[a-z][a-z0-9-]*)\s*·\s*\d+\s+inside(?:\s*\([\w\s]+\))?/g, "a box")
    .replace(/\s{2,}/g, " ")
    .trim();
}
