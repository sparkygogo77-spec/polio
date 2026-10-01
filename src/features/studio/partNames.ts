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
  from?: { host?: string; url?: string; selector?: string } | null;
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
  iframe: "Embedded page", canvas: "Drawing",
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

export const isHeadingish = (n: Named) => {
  const words = wordsOf(n);
  if (!words || words.length > 60) return false;
  const tag = lastTag(n.from?.selector);
  if (/^h[1-4]$/.test(tag) || computedAs(n.prompt)?.role === "heading" || n.featureId === "heading") return true;
  return (n.font?.size ?? 0) >= 24;
};

/** The parts drawn inside `box` on its page, top to bottom, then left to right. */
function within(box: Named, all: readonly Named[]): Named[] {
  return all
    .filter((m) => m.id !== box.id && (!box.pageId || m.pageId === box.pageId) && contains(box, m) && (m.w ?? 0) * (m.h ?? 0) < (box.w ?? 0) * (box.h ?? 0))
    .sort((a, b) => (a.y ?? 0) - (b.y ?? 0) || (a.x ?? 0) - (b.x ?? 0));
}

/** The first heading inside a part: a section is named by its own heading, never the page's. */
function firstHeading(box: Named, all: readonly Named[]): string | null {
  const h = within(box, all).find(isHeadingish);
  return h ? clip(wordsOf(h)) : null;
}

/** A part's own title when it holds others: its first heading, else its first words. */
function ownTitle(box: Named, all: readonly Named[]): string | null {
  const inside = within(box, all);
  if (!inside.length) return null;
  const h = inside.find(isHeadingish) ?? inside.find((m) => !!wordsOf(m));
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
  const page = all.filter((m) => m.id !== n.id && (!n.pageId || m.pageId === n.pageId));
  if (!page.some(isHeadingish)) return null;
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
