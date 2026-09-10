/**
 * A part's coded body: the code Claude writes for a drawing, and the rules
 * it is held to before it is ever rendered.
 *
 * An Idea part with a helix drawn round it should *be* a helix of
 * sentences, not an empty box cut to a helix. So the drawing goes up as a
 * path and a picture, and what comes back is a self-contained fragment —
 * SVG, or HTML and CSS — that fills the outline.
 *
 * It is rendered in an iframe with no permissions at all: `sandbox=""` (no
 * scripts, no same-origin, no forms, no navigation) with a content policy
 * that allows inline styles and data: images and nothing else. Two locks,
 * because either one alone is one mistake from being no lock. This file is
 * the third: what comes back is cleaned before it is stored, so a fragment
 * that tried to fetch something is not kept in the document waiting for a
 * future renderer to be more generous than this one.
 *
 * Pure, and tested by `tests/snippet.mjs`.
 */

/** The most code a part's body may be. Enough for a page's worth of SVG; not a bundle. */
export const SNIPPET_LIMIT = 24_000;

export interface PartCode {
  /** The cleaned fragment: SVG or HTML with inline styles, nothing else. */
  html: string;
  /** How much of the drawing's silhouette the render actually covered, 0..1. */
  overlap: number;
  /** How many goes it took. */
  attempts: number;
  /** What each go scored, in order. The record of the loop, kept with what it produced. */
  scores?: number[];
  at: number;
  /** What Claude said it drew, in a line. */
  note?: string;
  /** What was taken out of the code on the way in, if anything. */
  stripped?: string[];
}

/** What a fragment may not carry, and what it is called when it is taken out. */
const RULES: { name: string; re: RegExp; to?: string }[] = [
  { name: "a script", re: /<script\b[\s\S]*?<\/script\s*>/gi },
  { name: "a script", re: /<script\b[^>]*\/?>/gi },
  { name: "a frame", re: /<\/?(?:iframe|object|embed|applet|portal)\b[^>]*>/gi },
  { name: "a stylesheet link", re: /<link\b[^>]*>/gi },
  { name: "a meta directive", re: /<meta\b[^>]*>/gi },
  { name: "a base", re: /<base\b[^>]*>/gi },
  { name: "an event handler", re: /\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi },
  { name: "a javascript: link", re: /(?:href|src|xlink:href)\s*=\s*(?:"|')?\s*javascript:[^"'>]*/gi },
  { name: "an import", re: /@import[^;]+;?/gi },
  { name: "a fetched font or image", re: /url\(\s*(?:"|')?\s*(?:https?:)?\/\/[^)]*\)/gi, to: "none" },
  { name: "an external address", re: /(?:href|src|xlink:href)\s*=\s*(?:"|')(?:https?:)?\/\/[^"']*(?:"|')/gi, to: '=""' },
];

/**
 * Clean a fragment: take out anything that would reach off the page or run,
 * and say what was taken.
 *
 * The list is deliberately blunt. A fragment that needs a `<link>` or a
 * script is not the kind of thing this holds, and quietly dropping the tag
 * is better than a body that half works — the note says what went, and the
 * next attempt is told not to do it again.
 */
export function cleanSnippet(raw: string): { html: string; stripped: string[] } {
  // A fenced block is what a model hands back when it is being helpful.
  let html = raw.trim();
  const fence = html.match(/^```[a-z]*\n([\s\S]*?)\n?```$/i);
  if (fence) html = fence[1]!.trim();
  // Nothing outside the body of it: a whole document is a fragment with
  // scaffolding round it, and the scaffolding is this file's job.
  const body = html.match(/<body\b[^>]*>([\s\S]*?)<\/body\s*>/i);
  if (body) html = body[1]!.trim();

  const stripped: string[] = [];
  for (const rule of RULES) {
    if (rule.re.test(html)) {
      stripped.push(rule.name);
      html = html.replace(rule.re, rule.to ?? "");
    }
    rule.re.lastIndex = 0;
  }
  if (html.length > SNIPPET_LIMIT) {
    html = html.slice(0, SNIPPET_LIMIT);
    stripped.push("everything past the size limit");
  }
  return { html: html.trim(), stripped: [...new Set(stripped)] };
}

/**
 * The fragment as a whole document, for a sandboxed frame.
 *
 * The policy is the belt to the sandbox's braces: nothing loads, styles may
 * be inline, images may be data: URIs and that is the lot. The reset makes
 * the fragment fill the part and never scroll — a body cut to an outline
 * that then scrolls inside it is two shapes disagreeing.
 */
export function frameDoc(code: string, opts: { background?: string; colour?: string; font?: string } = {}): string {
  const bg = opts.background ?? "transparent";
  const fg = opts.colour ?? "currentColor";
  const font = opts.font ?? "ui-sans-serif, system-ui, sans-serif";
  return `<!doctype html><html><head><meta charset="utf-8">
<meta http-equiv="content-security-policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">
<style>
  html, body { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background: ${bg}; color: ${fg}; font-family: ${font}; }
  *, *::before, *::after { box-sizing: border-box; }
  svg { display: block; width: 100%; height: 100%; }
</style></head><body>${code}</body></html>`;
}

/** Is there anything here worth rendering? */
export function hasBody(code: PartCode | null | undefined): boolean {
  return !!code && typeof code.html === "string" && code.html.trim().length > 0;
}
