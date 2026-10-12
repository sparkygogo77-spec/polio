import { homeFor, homeOf, routeOf } from "../homePage.ts";
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
  /* The route the page is written to, not the path as typed: the two differ for "", "/index", "/about/" and a repeat. */
  return page ? { href: `/${routeOf(homeFor(pages), page)}`, newTab: false } : null;
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
  minlength: "minLength",
  spellcheck: "spellCheck",
  inputmode: "inputMode",
  enterkeyhint: "enterKeyHint",
  accesskey: "accessKey",
  autoplay: "autoPlay",
  playsinline: "playsInline",
  allowfullscreen: "allowFullScreen",
  referrerpolicy: "referrerPolicy",
  fetchpriority: "fetchPriority",
  frameborder: "frameBorder",
  srcdoc: "srcDoc",
  datetime: "dateTime",
  formnovalidate: "formNoValidate",
  usemap: "useMap",
  charset: "charSet",
  nomodule: "noModule",
  itemscope: "itemScope",
  "xlink:href": "xlinkHref",
  "xml:lang": "xmlLang",
};

/**
 * Attributes React types as booleans. The DOM writes them as `disabled=""`,
 * and a string there fails the export's typecheck, so they are written
 * bare, which JSX reads as true. Keyed by the HTML name.
 */
const BOOL = new Set([
  "disabled", "readonly", "checked", "selected", "hidden", "required", "multiple", "autofocus", "autoplay",
  "playsinline", "loop", "muted", "controls", "open", "novalidate", "formnovalidate", "allowfullscreen",
  "default", "defer", "async", "reversed", "itemscope", "inert", "nomodule",
]);

/** Attributes React types as numbers: `tabindex="0"` is written `tabIndex={0}`. */
const NUM = new Set(["tabindex", "rows", "cols", "colspan", "rowspan", "maxlength", "minlength", "size", "span", "start"]);

/** Form controls whose value the markup only seeds: a `value` with no onChange would lock them. */
const CONTROL = new Set(["input", "select", "textarea"]);

/** Elements whose text is raw, not markup: `a > b` in a style is not escaped by the DOM, and JSX would read it as a tag. */
const RAW_TEXT = new Set(["style", "script"]);

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
 * An attribute's value as JSX writes it. A quoted JSX attribute has no
 * escapes: `title="a \"b\""` ends at the second quote and the file no
 * longer parses, so a value with a quote, a backslash or a line break in it
 * goes in braces, as the string it is.
 */
export function jsxAttr(value: string): string {
  const lit = JSON.stringify(value);
  return lit.includes("\\") ? `{${lit}}` : lit;
}

/**
 * The markup a part rendered, as JSX.
 *
 * Not a general HTML parser: the input is React's own output, so tags are
 * balanced, attributes are quoted, and there is nothing exotic in it. What
 * it has to get right is the handful of names React spells differently,
 * the attributes React types as numbers or booleans (the DOM writes every
 * one as a string, and the export has to typecheck), inline styles (which
 * is where every part keeps its looks), braces in text, and the raw text
 * of a style or script.
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
        if (/^(data|aria)-/.test(name)) return `${name}=${jsxAttr(value)}`;
        if (name === "style") return `style={${styleToObject(value)}}`;
        // Looked up lower-cased: the DOM writes `readonly`, React's server `readOnly`.
        const key = name.toLowerCase();
        if (CONTROL.has(tag) && key === "value") return `defaultValue=${jsxAttr(value)}`;
        if (CONTROL.has(tag) && key === "checked") return "defaultChecked";
        const jsxName = ATTR[key] ?? (name.includes("-") ? camel(name) : name);
        if (BOOL.has(key)) return jsxName;
        if (NUM.has(key) && /^-?\d+$/.test(value.trim())) return `${jsxName}={${Number(value)}}`;
        return `${jsxName}=${jsxAttr(value)}`;
      })
      .join(" ");
    const selfClosing = VOID_TAGS.has(tag) || raw.endsWith("/>");
    push(`<${tag}${written ? ` ${written}` : ""}${selfClosing ? " />" : ">"}`);
    i = gt + 1;
    // A style's or script's text goes in whole, as one string.
    if (!selfClosing && RAW_TEXT.has(tag)) {
      const close = html.indexOf(`</${tag}`, i);
      const end = close < 0 ? html.length : close;
      const text = html.slice(i, end);
      if (text) push(`{${JSON.stringify(text)}}`);
      i = end;
    }
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

/** Words written into a generated comment: a star then a slash in a label or a prompt would end the comment there and break the file. */
export const inComment = (s: string) => s.replace(/\*\//g, "* /");

/** A line cut to length at a word, with a mark to say it was cut. */
export const trim = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, s.lastIndexOf(" ", max) > max * 0.6 ? s.lastIndexOf(" ", max) : max)}…`);

/* ------------------------------------------------------------------ */
/* The files                                                           */
/* ------------------------------------------------------------------ */
