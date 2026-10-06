import { homeOf } from "../homePage.ts";
import type { ScaffoldPage, ScaffoldPart } from "./types.ts";

/**
 * A style object as JSX writes it: plain keys bare, a CSS variable quoted,
 * and the whole cast to `CSSProperties` when a variable is in it, since
 * React's style type does not know custom properties and the export has
 * to typecheck.
 */
export function styleJsx(style: Record<string, string | number>): string {
  const body = `{ ${Object.entries(style).map(([k, v]) => `${/^[a-zA-Z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${JSON.stringify(v)}`).join(", ")} }`;
  return Object.keys(style).some((k) => k.startsWith("--")) ? `${body} as CSSProperties` : body;
}

const slugOf = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** Where a link goes in the exported site, as an href, the way the live page resolves it. */
export function hrefOf(link: ScaffoldPart["link"], pages: ScaffoldPage[]): { href: string; newTab: boolean } | null {
  if (!link || !link.target.trim()) return null;
  const t = link.target.trim();
  if (link.kind === "url") return { href: t, newTab: true };
  if (link.kind === "node") return { href: `#${t}`, newTab: false };
  const page =
    pages.find((p) => p.id === t) ??
    pages.find((p) => p.path === t || p.path === "/" + slugOf(t)) ??
    pages.find((p) => p.name.toLowerCase() === t.toLowerCase()) ??
    (t.toLowerCase() === "home" || t === "/" ? homeOf(pages) ?? null : null);
  return page ? { href: page.path, newTab: false } : null;
}

/* ------------------------------------------------------------------ */
/* HTML → JSX                                                          */
/* ------------------------------------------------------------------ */

const VOID_TAGS = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"]);

/** React's names for the attributes HTML spells differently. */
const ATTR: Record<string, string> = {
  class: "className",
  for: "htmlFor",
  tabindex: "tabIndex",
  colspan: "colSpan",
  rowspan: "rowSpan",
  maxlength: "maxLength",
  readonly: "readOnly",
  autocomplete: "autoComplete",
  autofocus: "autoFocus",
  contenteditable: "contentEditable",
  crossorigin: "crossOrigin",
  srcset: "srcSet",
  novalidate: "noValidate",
  enctype: "encType",
  "xlink:href": "xlinkHref",
  "xml:lang": "xmlLang",
};

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());

/** One CSS declaration list as a React style object literal. */
export function styleToObject(css: string): string {
  const out: string[] = [];
  for (const bit of splitDeclarations(css)) {
    const i = bit.indexOf(":");
    if (i < 0) continue;
    const key = bit.slice(0, i).trim();
    const value = bit.slice(i + 1).trim();
    if (!key || !value) continue;
    const name = key.startsWith("--") ? `"${key}"` : camel(key);
    out.push(`${name}: ${JSON.stringify(value)}`);
  }
  return `{ ${out.join(", ")} }`;
}

/**
 * A declaration list, split into declarations.
 *
 * Not `split(";")`: a data: URI has semicolons in it (`;base64`), and so
 * does a font stack with an escaped one. Parentheses and quotes are
 * counted, so `background-image: url(data:image/png;base64,AA==)` stays
 * one declaration.
 */
function splitDeclarations(css: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let quote: string | null = null;
  let start = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) {
      out.push(css.slice(start, i));
      start = i + 1;
    }
  }
  out.push(css.slice(start));
  return out;
}

/** Text that JSX would read as code, made into text again. */
const escapeText = (s: string) => s.replace(/[{}]/g, (c) => `{"${c}"}`);

/**
 * The markup a part rendered, as JSX.
 *
 * Not a general HTML parser: the input is React's own output, so tags are
 * balanced, attributes are quoted, and there is nothing exotic in it. What
 * it has to get right is the handful of names React spells differently,
 * inline styles (which is where every part keeps its looks), and braces in
 * text.
 */
export function htmlToJsx(html: string, indent = "    "): string {
  let out = "";
  let i = 0;
  const push = (s: string) => { out += s; };
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) {
      push(escapeText(html.slice(i)));
      break;
    }
    if (lt > i) push(escapeText(html.slice(i, lt)));
    // A comment: React's output has none, but a hand-written body might.
    if (html.startsWith("<!--", lt)) {
      i = html.indexOf("-->", lt) + 3;
      continue;
    }
    const gt = findTagEnd(html, lt);
    const raw = html.slice(lt, gt + 1);
    if (raw.startsWith("</")) {
      push(raw);
      i = gt + 1;
      continue;
    }
    const nameEnd = raw.search(/[\s/>]/);
    const tag = raw.slice(1, nameEnd < 0 ? raw.length - 1 : nameEnd);
    const attrs = parseAttrs(raw.slice(nameEnd, raw.endsWith("/>") ? -2 : -1));
    const written = attrs
      .map(({ name, value }) => {
        if (/^(data|aria)-/.test(name)) return `${name}=${JSON.stringify(value)}`;
        if (name === "style") return `style={${styleToObject(value)}}`;
        const jsxName = ATTR[name] ?? (name.includes("-") ? camel(name) : name);
        return `${jsxName}=${JSON.stringify(value)}`;
      })
      .join(" ");
    const selfClosing = VOID_TAGS.has(tag) || raw.endsWith("/>");
    push(`<${tag}${written ? ` ${written}` : ""}${selfClosing ? " />" : ">"}`);
    i = gt + 1;
  }
  return out.split("\n").map((l) => indent + l).join("\n").trim();
}

/** The `>` that closes a tag, skipping any inside quoted attribute values. */
function findTagEnd(html: string, from: number): number {
  let quote: string | null = null;
  for (let i = from + 1; i < html.length; i++) {
    const c = html[i]!;
    if (quote) {
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") quote = c;
    else if (c === ">") return i;
  }
  return html.length - 1;
}

function parseAttrs(s: string): { name: string; value: string }[] {
  const out: { name: string; value: string }[] = [];
  const re = /([:\w-]+)\s*=\s*"([^"]*)"|([:\w-]+)\s*=\s*'([^']*)'|([:\w-]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const name = m[1] ?? m[3] ?? m[5]!;
    const value = m[2] ?? m[4] ?? "";
    out.push({ name, value: decode(value) });
  }
  return out;
}

const decode = (s: string) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* ------------------------------------------------------------------ */
/* Names                                                               */
/* ------------------------------------------------------------------ */

/** A React component name from a part's label, unique by its id. */
export function componentName(part: ScaffoldPart): string {
  const words = part.label.replace(/[^A-Za-z0-9 ]+/g, " ").split(/\s+/).filter(Boolean);
  const base = words.map((w) => w[0]!.toUpperCase() + w.slice(1).toLowerCase()).join("") || "Part";
  const tail = part.id.replace(/[^A-Za-z0-9]/g, "").slice(-4).toUpperCase();
  return /^[0-9]/.test(base) ? `Part${base}${tail}` : `${base}${tail}`;
}

/** A line cut to length at a word, with a mark to say it was cut. */
export const trim = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(" ", max) > max * 0.6 ? s.lastIndexOf(" ", max) : max)}…`);

export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "page";

/* ------------------------------------------------------------------ */
/* The files                                                           */
/* ------------------------------------------------------------------ */
