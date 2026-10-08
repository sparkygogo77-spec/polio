/**
 * EXPORT FOR CODE: THE SITE AS A BUILDER-READY REPOSITORY.
 *
 * kit/PIPELINE.md, route 1 (builder first): J designs a site here, and a
 * code chat adds the logic. The chat can only build on it safely if the
 * export keeps the builder contract (kit/BUILDER-CONTRACT.md), so the design
 * can come back later as a style layer. The regular export (`exportSite.ts`)
 * is the site as the preview draws it; this takes those very files and
 * rewrites them into the kit's layout, changing nothing a person sees:
 *
 *   · every element in every page's body gets a `data-hook`, named for a
 *     person (a part's hook from the code it came from, else its words, its
 *     label, its class, then what kind of element it is), unique across the
 *     site, so one rule fits one thing;
 *   · every inline `style="..."` becomes a rule keyed by that hook, and every
 *     `<style>` block moves to a stylesheet, both into `base.css`;
 *   · selectors keep their meaning without classes or ids: `.x` is written
 *     `[class~="x"]` and `#x` is `[id="x"]` (the same elements, the same
 *     weight for a class), so the runtime's own classes still work;
 *   · every colour is a token in `tokens.css`: the palette by its role names
 *     (`--accent`), any other colour `--color-<n>`; a value whose quoted or
 *     url() text the check would read as a colour moves whole to a
 *     `--value-<n>` token;
 *   · stylesheets load `tokens.css` first and an empty `style-layer.css`
 *     last; inline scripts move to files; the Builder's own runtime under
 *     `site/assets/` is listed in `builder.json` `scripts.ignore`;
 *   · `builder.json` names the pages, a preview screen per page, the
 *     gallery, and the site's link rules (`offsiteToKitLinks`), and the
 *     kit's tools, contract, CLAUDE.md, AGENTS.md, PIPELINE.md and CI go
 *     along, so `npm run kit:check` passes on what lands.
 *
 * `hooks.json` is made by the kit's own check (`kitMap.ts`, on our server,
 * or in a test), which also says whether the export passes.
 *
 * Pure: strings in, strings out. `tests/export-for-code.mjs` holds it.
 */
import { KIT_FILES, KIT_RULES, KIT_VERSION } from "./kitFiles.ts";
import { offsiteToKitLinks } from "./shelf/index.ts";
import { colourKey } from "./send-out/index.ts";

export interface KitFile { path: string; content: string; encoding?: "base64" }

export interface KitExportInput {
  /** The regular export's files (`exportSite`). */
  files: KitFile[];
  name: string;
  /** Each page as exported: its file (index.html, about/index.html) and title. */
  pages: { file: string; title: string }[];
  /**
   * Board parts by element id: a label, the hook it came in with from code,
   * and for a part made in the Builder (`fresh`), the name of what it is
   * (its feature), so its hook reads as what it is.
   */
  parts?: Record<string, KitPart>;
  /** The site's link list (Format, "Links off the site"). */
  links?: string | null;
}

export interface KitPart { label?: string; hook?: string; fresh?: boolean; kind?: string }

export interface KitExport {
  files: KitFile[];
  hooks: number;
  /** The hooks the site came in with (its parts' and their words'), every one written exactly as it was. */
  kept: string[];
  /** A part made in the Builder: the readable hook it was given, for the code to wire. */
  fresh: { part: string; hook: string; label: string; page: string }[];
  /** Hooks the site came in with that had to change: one used twice on a page. */
  renamed: { was: string; now: string; page: string }[];
  pages: number;
  says: string;
}

const ROOT = "site/";
const NO_HOOK = new Set(["script", "br", "wbr"]);
const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
/* The hooks the export's own preview and gallery pages use: never given to a part. */
const RESERVED = ["page-preview", "page-gallery", "page-main", "page-title", "page-intro", "preview-screens", "template-preview-screen", "preview-screen", "preview-frame", "preview-caption"];
const VAGUE = /^(div|span|el|element|item|box|wrap|wrapper|container|block|section|hook|thing|x)(-?\d+)?$/;
const NAMED = "white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|navy|teal|maroon|olive|lime|aqua|cyan|magenta|fuchsia|gold|crimson|indigo|violet|brown|tan|beige";
/** What `kit-check` reads as a colour (its COLOR). */
const IS_COLOUR = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(|\\b(?:${NAMED})\\b`);
/** A whole colour literal, to be replaced by its token. */
const COLOUR_LITERAL = new RegExp(`#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\((?:[^()]|\\([^()]*\\))*\\)|\\b(?:${NAMED})\\b`, "gi");

const KIND: Record<string, string> = {
  a: "link", button: "button", img: "picture", picture: "picture", svg: "drawing", path: "shape", circle: "shape", rect: "shape", g: "shapes", line: "shape",
  polygon: "shape", polyline: "shape", ellipse: "shape", use: "shape", defs: "defs", lineargradient: "gradient", radialgradient: "gradient", stop: "stop", clippath: "clip", mask: "mask",
  h1: "heading", h2: "heading", h3: "heading", h4: "heading", h5: "heading", h6: "heading", p: "text", span: "words", strong: "strong", em: "emphasis", b: "bold", i: "italic",
  label: "label", input: "input", select: "select", option: "option", textarea: "input", ul: "list", ol: "list", li: "row", nav: "nav", header: "header", footer: "footer", main: "main",
  section: "band", article: "card", aside: "aside", form: "form", video: "video", audio: "audio", iframe: "embed", figure: "figure", figcaption: "caption", table: "table", tr: "row",
  td: "cell", th: "cell", thead: "head", tbody: "rows", body: "page", canvas: "canvas", template: "template", small: "small", code: "code", pre: "code", hr: "rule", blockquote: "quote",
};

const slugWords = (s: string, most = 4) => s.toLowerCase().replace(/&[a-z#0-9]+;/g, " ").replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, most).join("-");
const decode = (s: string) => s.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

/* ------------------------------------------------------------------ CSS */

/** Where the block opened at `open` closes, strings and comments skipped. */
function closeOf(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    const c = text[i];
    if (c === '"' || c === "'") { const e = text.indexOf(c, i + 1); i = e < 0 ? text.length : e; continue; }
    if (c === "/" && text[i + 1] === "*") { const e = text.indexOf("*/", i + 2); i = e < 0 ? text.length : e + 1; continue; }
    if (c === "{") depth++;
    else if (c === "}" && --depth === 0) return i;
  }
  return text.length;
}

/** Declarations split at their semicolons, never inside a string or brackets (a data url holds one). */
function splitDecls(body: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'") { const e = body.indexOf(c, i + 1); i = e < 0 ? body.length : e; continue; }
    if (c === "(") depth++;
    else if (c === ")") depth = Math.max(0, depth - 1);
    else if (c === ";" && depth === 0) { out.push(body.slice(start, i)); start = i + 1; }
  }
  out.push(body.slice(start));
  return out.map((d) => d.trim()).filter(Boolean);
}

/** A selector without classes or ids: the same elements, read by attribute. */
export function selectorWithoutClasses(sel: string): string {
  let out = "";
  for (let i = 0; i < sel.length; ) {
    const c = sel[i]!;
    if (c === "[") { const e = sel.indexOf("]", i); const end = e < 0 ? sel.length : e + 1; out += sel.slice(i, end); i = end; continue; }
    if (c === '"' || c === "'") { const e = sel.indexOf(c, i + 1); const end = e < 0 ? sel.length : e + 1; out += sel.slice(i, end); i = end; continue; }
    if ((c === "." || c === "#") && /[-_a-zA-Z\\]/.test(sel[i + 1] ?? "")) {
      const m = /^(-?[_a-zA-Z\\][\w\\-]*)/.exec(sel.slice(i + 1).replace(/\\(.)/g, "$1"));
      const name = m ? m[1]! : "";
      /* The raw length, escapes and all, of what was read. */
      let j = i + 1;
      while (j < sel.length && /[\w\\-]/.test(sel[j]!)) j += sel[j] === "\\" ? 2 : 1;
      out += c === "." ? `[class~="${name}"]` : `[id="${name}"]`;
      i = j;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Colours and other values the contract keeps in tokens.css. */
class Tokens {
  /** colourKey → token name. */
  byColour = new Map<string, string>();
  decls: { name: string; value: string; why?: string }[] = [];
  values = new Map<string, string>();
  colourN = 0;
  valueN = 0;
  role(name: string, value: string) {
    this.decls.push({ name, value });
    const k = colourKey(value);
    if (!this.byColour.has(k)) this.byColour.set(k, name);
  }
  colour(literal: string): string {
    const k = colourKey(literal);
    let name = this.byColour.get(k);
    if (!name) {
      name = `--color-${++this.colourN}`;
      this.byColour.set(k, name);
      this.decls.push({ name, value: literal });
    }
    return `var(${name})`;
  }
  whole(value: string): string {
    let name = this.values.get(value);
    if (!name) {
      name = `--value-${++this.valueN}`;
      this.values.set(value, name);
      this.decls.push({ name, value, why: "a value the check would read as a colour" });
    }
    return `var(${name})`;
  }
  /** A declaration's value with every colour in it a token. */
  value(v: string, prop = ""): string {
    if (!IS_COLOUR.test(v)) return v;
    /* Quoted text and url()s are not colours, but the check reads their words: then the whole value goes to a token. */
    const kept = /url\((?:[^()"']|"[^"]*"|'[^']*')*\)|"[^"]*"|'[^']*'/g;
    if ([...v.matchAll(kept)].some((m) => IS_COLOUR.test(m[0]))) return this.whole(v);
    const masked = v.replace(kept, (m) => "\u0000".repeat(m.length));
    /* A colour's name is a colour only where a colour goes: in a font's name it is a word. */
    const colourProp = /^(--|color$|background|border|outline|fill$|stroke$|box-shadow$|text-shadow$|caret-color$|accent-color$|column-rule|text-decoration|text-emphasis|scrollbar-color$|stop-color$|flood-color$|lighting-color$)/i.test(prop);
    let out = "";
    let last = 0;
    for (const m of masked.matchAll(COLOUR_LITERAL)) {
      if (/^[a-z]+$/i.test(m[0]) && !colourProp) return this.whole(v);
      out += v.slice(last, m.index!) + this.colour(v.slice(m.index!, m.index! + m[0].length));
      last = m.index! + m[0].length;
    }
    out += v.slice(last);
    return IS_COLOUR.test(out.replace(/var\([^)]*\)/g, "")) ? this.whole(v) : out;
  }
}

/** Declarations with their colours made tokens. */
function declsOut(body: string, tokens: Tokens): string[] {
  return splitDecls(body).map((d) => {
    const at = d.indexOf(":");
    if (at < 0) return d;
    const prop = d.slice(0, at).trim();
    return `${prop}: ${tokens.value(d.slice(at + 1).trim(), prop)}`;
  });
}

/**
 * A stylesheet in the contract's terms. `@font-face` and `@page` are
 * declarations about a face or a page, not rules on elements: copied as
 * they are. `:root` palette roles go to tokens.css.
 */
export function cssForKit(css: string, tokens: Tokens, opts: { roles?: boolean } = {}): string {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  let out = "";
  let i = 0;
  while (i < text.length) {
    const open = text.indexOf("{", i);
    const semi = text.indexOf(";", i);
    if (open < 0) { out += text.slice(i); break; }
    /* A statement (`@import`, `@charset`) before the next block. */
    if (semi >= 0 && semi < open && text.slice(i, semi).trim().startsWith("@")) { out += text.slice(i, semi + 1); i = semi + 1; continue; }
    const prelude = text.slice(i, open).trim();
    const close = closeOf(text, open);
    const inner = text.slice(open + 1, close);
    if (/^@(font-face|page|property|counter-style)\b/i.test(prelude)) out += `\n${prelude}{${inner}}`;
    else if (prelude.startsWith("@")) out += `\n${prelude} {${cssForKit(inner, tokens)}\n}`;
    else if (opts.roles && prelude === ":root") {
      const rest: string[] = [];
      for (const d of splitDecls(inner)) {
        const at = d.indexOf(":");
        const prop = d.slice(0, at).trim();
        const value = d.slice(at + 1).trim();
        if (prop.startsWith("--") && IS_COLOUR.test(value)) tokens.role(prop, value);
        else rest.push(d);
      }
      if (rest.length) out += `\n:root {\n  ${declsOut(rest.join(";"), tokens).join(";\n  ")};\n}`;
    } else if (prelude) {
      const decls = declsOut(inner, tokens);
      out += `\n${selectorWithoutClasses(prelude)} {${decls.length ? `\n  ${decls.join(";\n  ")};\n` : ""}}`;
    }
    i = close + 1;
  }
  return out.trim();
}

/** Every `var(--x)` a stylesheet uses, and every `--x` it declares. */
const usedVars = (css: string) => new Set([...css.matchAll(/var\(\s*(--[a-zA-Z0-9-]+)/g)].map((m) => m[1]!));
const declaredVars = (css: string) => new Set([...css.matchAll(/(?:^|[{;\s])(--[a-zA-Z0-9-]+)\s*:/g)].map((m) => m[1]!));

/* ------------------------------------------------------------------ HTML */

/**
 * THE NAMES. A hook the site came in with (`keep`: its parts' hooks, and the
 * hooks on their words) is written exactly as it was, wherever it is; only
 * one used twice on one page changes. Every name the export makes avoids
 * them all, and is unique across the site.
 */
interface Namer {
  used: Set<string>;
  keep: Set<string>;
  /** The hooks on the page being written. */
  page: Set<string>;
  /** The hooks already written inside the page as exported (a list, a field, a word): a part's own hook there is left to it, not given to the box round it too. */
  present: Set<string>;
  pageName: string;
  parts: Record<string, KitPart>;
  fresh: KitExport["fresh"];
  renamed: KitExport["renamed"];
}

/** A unique, readable hook for an element. */
function nameFor(n: Namer, tag: string, attrs: string, words: string, parent: string | null, page: string): string {
  const attr = (k: string) => new RegExp(`\\s${k}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(attrs);
  const id = attr("id");
  const part = id ? n.parts[(id[1] ?? id[2])!] : undefined;
  const kind = KIND[tag] ?? (tag.includes("-") ? slugWords(tag, 2) : "area");
  if (tag === "body") return claim(n, `page-${page}`);
  if (part?.hook && /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(part.hook) && !part.hook.startsWith("template-") && !n.present.has(part.hook)) {
    if (!n.page.has(part.hook)) { n.page.add(part.hook); n.used.add(part.hook); return part.hook; }
    const now = claim(n, part.hook);
    n.renamed.push({ was: part.hook, now, page: n.pageName });
    return now;
  }
  /* A part made in the Builder: named for what it is called (its name, else what kind of part it is), with no kind on the end: chart-main. */
  if (part?.fresh && id) {
    const base = slugWords(part.label ?? "", 4) || slugWords(part.kind ?? "", 3) || "part";
    const hook = claim(n, VAGUE.test(base) ? `${page}-${base}` : base);
    n.fresh.push({ part: (id[1] ?? id[2])!, hook, label: part.label ?? "", page: n.pageName });
    return hook;
  }
  const label = part?.label && !/·|\binside\b/.test(part.label) ? part.label : "";
  const aria = attr("aria-label") ?? attr("alt") ?? attr("title") ?? attr("placeholder");
  const cls = attr("class");
  const firstClass = cls ? ((cls[1] ?? cls[2]) ?? "").split(/\s+/).map((c) => c.replace(/^sm-/, "").replace(/\d+/g, "")).find((c) => /^[a-z]{3,}/i.test(c) && !/^(p|gi|g|o)$/.test(c)) : undefined;
  const base = slugWords(decode(words), 3) || slugWords(label, 3) || slugWords(decode(aria ? (aria[1] ?? aria[2])! : ""), 3) || (firstClass ? slugWords(firstClass, 2) : "") || (parent ? parent.replace(/-\d+$/, "") : page);
  const name = base.endsWith(`-${kind}`) || base === kind ? base : `${base}-${kind}`;
  return claim(n, VAGUE.test(name) ? `${page}-${name}` : name);
}

function claim(n: Namer, want: string): string {
  let name = want.replace(/^-+|-+$/g, "") || "part";
  if (/^\d/.test(name)) name = `n${name}`;
  if (name.startsWith("template-")) name = `t-${name}`;
  const free = (x: string) => !n.used.has(x) && !n.keep.has(x) && !n.page.has(x);
  let got = name;
  for (let k = 2; !free(got); k++) got = `${name}-${k}`;
  n.used.add(got);
  n.page.add(got);
  return got;
}

/** Its own words, else the first words inside it (a box named for what it holds), never past its own end. */
function firstWords(html: string, from: number): string {
  const re = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)[^>]*?(\/?)>|([^<]+)/g;
  re.lastIndex = from;
  let depth = 0;
  for (let m = re.exec(html), n = 0; m && n < 400; m = re.exec(html), n++) {
    if (m[4] !== undefined) { if (/[a-z]{2,}/i.test(m[4])) return m[4].trim(); continue; }
    const tag = m[2]!.toLowerCase();
    if (m[1]) { if (--depth < 0) return ""; continue; }
    if (tag === "script" || tag === "style") { const e = html.toLowerCase().indexOf(`</${tag}>`, re.lastIndex); re.lastIndex = e < 0 ? html.length : e + tag.length + 3; continue; }
    if (!VOID.has(tag) && !m[3]) depth++;
  }
  return "";
}

interface PageOut { html: string; inlineCss: string[]; rules: string[]; scripts: KitFile[]; hooks: number }

/**
 * One page in the contract's terms. `up` is the way back to the site's
 * root from the page ("" or "../"), `slug` its name.
 */
function pageForKit(html: string, file: string, slug: string, up: string, namer: Namer, tokens: Tokens): PageOut {
  const out: string[] = [];
  const rules: string[] = [];
  const inlineCss: string[] = [];
  const scripts: KitFile[] = [];
  const stack: { tag: string; hook: string | null; as?: string }[] = [];
  let inBody = false;
  let hooks = 0;
  let lastSheetEnd = -1;
  let firstSheetAt = -1;
  const tagRe = /<!--[\s\S]*?-->|<!doctype[^>]*>|<\/?([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^\s=>/]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/gi;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    out.push(html.slice(last, m.index));
    last = tagRe.lastIndex;
    if (!m[1]) { out.push(m[0]); continue; }
    const tag = m[1].toLowerCase();
    if (m[0].startsWith("</")) {
      const at = stack.map((e) => e.tag).lastIndexOf(tag);
      const as = at >= 0 ? stack[at]!.as : undefined;
      if (at >= 0) stack.length = at;
      if (tag === "body") inBody = false;
      out.push(as ? `</${as}>` : m[0]);
      continue;
    }
    let attrs = m[2] ?? "";
    if (tag === "style" || tag === "script") {
      const end = html.toLowerCase().indexOf(`</${tag}>`, tagRe.lastIndex);
      const body = html.slice(tagRe.lastIndex, end < 0 ? html.length : end);
      tagRe.lastIndex = last = end < 0 ? html.length : end + tag.length + 3;
      if (tag === "style") { inlineCss.push(body); continue; }
      const type = /\stype\s*=\s*["']?([^"'\s>]+)/i.exec(attrs)?.[1];
      if (body.trim() && type !== "application/json" && !/\ssrc\s*=/.test(attrs)) {
        const path = `assets/inline/${slug}-${scripts.length + 1}.js`;
        scripts.push({ path: `${ROOT}${path}`, content: `${body.trim()}\n` });
        out.push(`<script${attrs} src="${up}${path}"></script>`);
      } else out.push(`<script${attrs}>${body}</script>`);
      continue;
    }
    if (tag === "link" && /\brel\s*=\s*["']?stylesheet/i.test(attrs)) {
      if (firstSheetAt < 0) firstSheetAt = out.length;
      out.push(m[0]);
      lastSheetEnd = out.length;
      continue;
    }
    if (tag === "body") inBody = true;
    if (inBody && !NO_HOOK.has(tag)) {
      const style = /\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs);
      attrs = attrs.replace(/\sstyle\s*=\s*(?:"[^"]*"|'[^']*')/i, "");
      let hook = /\sdata-hook\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(attrs)?.slice(1).find((x) => x !== undefined) ?? null;
      if (!hook) {
        /* Its own words: the text up to its first child tag. */
        const words = VOID.has(tag) ? "" : firstWords(html, tagRe.lastIndex);
        hook = nameFor(namer, tag, attrs, words, [...stack].reverse().find((e) => e.hook)?.hook ?? null, slug);
        attrs = `${attrs} data-hook="${hook}"`;
      } else if (!namer.page.has(hook)) { namer.page.add(hook); namer.used.add(hook); }
      else {
        /* The same hook twice on one page (the words of two parts that came in with one): the second is told apart. */
        const was = hook;
        hook = claim(namer, was);
        namer.renamed.push({ was, now: hook, page: namer.pageName });
        attrs = attrs.replace(/\sdata-hook\s*=\s*(?:"[^"]*"|'[^']*')/i, ` data-hook="${hook}"`);
      }
      hooks++;
      if (style) {
        const decls = declsOut(decode((style[1] ?? style[2])!), tokens);
        if (decls.length) rules.push(`[data-hook="${hook}"] {\n  ${decls.join(";\n  ")};\n}`);
      }
      /* A part that came in as a page's <template> (its hook starts template-, as the code clones it by): a <template> again, with the hook it had. */
      const as = hook.startsWith("template-") && tag !== "template" && !VOID.has(tag) && !m[3] ? "template" : undefined;
      out.push(`<${as ?? m[1]}${attrs}${m[3] ? " /" : ""}>`);
      if (!VOID.has(tag) && !m[3]) stack.push({ tag, hook, ...(as ? { as } : {}) });
      continue;
    }
    out.push(m[0]);
    if (!VOID.has(tag) && !m[3]) stack.push({ tag, hook: null });
  }
  out.push(html.slice(last));
  /* tokens.css first; base.css and the style layer after every sheet the page had, the layer last; the page's screens declared. */
  const sheet = (href: string) => `<link rel="stylesheet" href="${up}${href}">`;
  const tail = `\n${sheet("base.css")}\n${sheet("style-layer.css")}\n<script type="module" src="${up}js/screens/${slug}.js"></script>`;
  if (lastSheetEnd >= 0) out.splice(lastSheetEnd, 0, tail);
  else { const head = out.findIndex((s) => /<\/head>/i.test(s)); out.splice(head >= 0 ? head : 0, 0, `${tail}\n`); }
  if (firstSheetAt >= 0) out.splice(firstSheetAt, 0, `${sheet("tokens.css")}\n`);
  else { const at = out.findIndex((s) => s.includes(`href="${up}base.css"`)); out.splice(at, 0, `\n${sheet("tokens.css")}`); }
  void file;
  return { html: out.join(""), inlineCss, rules, scripts, hooks };
}

/* ------------------------------------------------------------------ the repo */

const HELPERS = { hook: 0, hooks: 0, fromTemplate: 0, part: 1 };

export function toKit(input: KitExportInput): KitExport {
  const tokens = new Tokens();
  /* The hooks the site came in with: its parts', and those on the words inside them, already on the pages. */
  const keep = new Set<string>(Object.values(input.parts ?? {}).map((p) => p.hook).filter((h): h is string => !!h));
  for (const f of input.files) if (f.path.endsWith(".html") && f.encoding !== "base64") for (const m of f.content.matchAll(/\sdata-hook\s*=\s*"([^"]+)"/g)) keep.add(m[1]!);
  const namer: Namer = { used: new Set(RESERVED), keep, page: new Set(), present: new Set(), pageName: "", parts: input.parts ?? {}, fresh: [], renamed: [] };
  const files: KitFile[] = [];
  const base: string[] = [];
  const pageSet = new Set(input.pages.map((p) => p.file));
  const screens: { name: string; page: string }[] = [];
  const screenNames = new Set<string>();
  let hooks = 0;
  /* Stylesheets first: the palette's roles become the tokens that colours on the pages are matched to. */
  const sheets = input.files.filter((f) => f.path.endsWith(".css") && f.encoding !== "base64");
  const sheetOut = new Map<string, string>();
  for (const f of [...sheets].sort((a, b) => (a.path === "assets/site.css" ? -1 : b.path === "assets/site.css" ? 1 : 0))) sheetOut.set(f.path, cssForKit(f.content, tokens, { roles: true }));
  for (const f of input.files) {
    if (sheetOut.has(f.path)) { files.push({ path: `${ROOT}${f.path}`, content: `${sheetOut.get(f.path)}\n` }); continue; }
    if (!pageSet.has(f.path) || f.encoding === "base64") { files.push({ ...f, path: `${ROOT}${f.path}` }); continue; }
    const depth = f.path.split("/").length - 1;
    const up = "../".repeat(depth);
    let slug = slugWords(f.path.replace(/(^|\/)index\.html$/, "$1").replace(/\.html$/, "").replace(/\//g, " ") || "home", 4) || "home";
    for (let k = 2; screenNames.has(slug); k++) slug = `${slug.replace(/-\d+$/, "")}-${k}`;
    screenNames.add(slug);
    namer.page = new Set();
    namer.present = new Set([...f.content.matchAll(/\sdata-hook\s*=\s*"([^"]+)"/g)].map((m) => m[1]!));
    namer.pageName = `${ROOT}${f.path}`;
    const page = pageForKit(f.content, f.path, slug, up, namer, tokens);
    hooks += page.hooks;
    for (const css of page.inlineCss) base.push(`/* From ${f.path}'s own style block. */\n${cssForKit(css, tokens)}`);
    if (page.rules.length) base.push(`/* ${f.path}: what its elements carried as inline styles, each keyed by its hook. */\n${page.rules.join("\n")}`);
    files.push({ path: `${ROOT}${f.path}`, content: page.html }, ...page.scripts);
    files.push({ path: `${ROOT}js/screens/${slug}.js`, content: `// The preview screens of ${f.path} (builder.json preview.screens). The page as exported is its one state.\nimport { screens } from '../hooks.js';\n\nscreens({ '${slug}': () => {} });\n` });
    screens.push({ name: slug, page: `${ROOT}${f.path}` });
  }
  /* A variable a script sets at run time is declared with no value, so the check knows it and the page reads it as unset. */
  const allCss = [...files.filter((f) => f.path.endsWith(".css")).map((f) => f.content), ...base].join("\n");
  const declared = declaredVars(allCss);
  for (const d of tokens.decls) declared.add(d.name);
  const unset = [...usedVars(allCss)].filter((v) => !declared.has(v)).sort();

  const tokensCss = [
    "/* Design tokens: every colour the site uses, by name, and a few values the check would read as colours.",
    "   Made by the Builder's Export for code. The palette keeps its role names (--accent); the style layer may redefine any of these. */",
    ":root {",
    ...tokens.decls.map((d) => `  ${d.name}: ${d.value};`),
    ...(unset.length ? ["", "  /* Set by the site's scripts as it runs; unset until then. */", ...unset.map((v) => `  ${v}: initial;`)] : []),
    "}",
    "",
  ].join("\n");
  const layout = (title: string, hook: string, inside: string, script = "") => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} · ${input.name.replace(/</g, "")}</title>
<link rel="stylesheet" href="tokens.css">
<link rel="stylesheet" href="base.css">
<link rel="stylesheet" href="style-layer.css">${script ? `\n<script type="module" src="${script}"></script>` : ""}
</head>
<body data-hook="${hook}">
${inside}
</body>
</html>
`;
  /* The kit's own preview and gallery name their parts with the hooks it reserves; where the site came in with one of those names (PonsStars' page-title), the site keeps it and the kit's page takes kit-<name>, in its page and its script alike. */
  const kitHooks = (text: string) => text.replace(new RegExp(`(["'])(template-)?(${RESERVED.join("|")})\\1`, "g"), (all, q: string, t: string | undefined, h: string) => (keep.has(`${t ?? ""}${h}`) ? `${q}${t ?? ""}kit-${h}${q}` : all));
  files.push(
    { path: `${ROOT}tokens.css`, content: tokensCss },
    { path: `${ROOT}base.css`, content: `/* What the pages need to look as the Builder drew them: their own style blocks, then each element's own look keyed by its hook.\n   Made by the Builder's Export for code; a code chat may change it. The design goes in style-layer.css, which loads after it. */\n\n${base.join("\n\n")}\n` },
    { path: `${ROOT}style-layer.css`, content: "" },
    { path: `${ROOT}js/hooks.js`, content: KIT_FILES["starter/js/hooks.js"]! },
    { path: `${ROOT}js/preview.js`, content: kitHooks(KIT_FILES["starter/js/preview.js"]!) },
    {
      path: `${ROOT}preview.html`,
      content: kitHooks(layout("Preview", "page-preview", `<main data-hook="page-main">
  <h1 data-hook="page-title">Preview</h1>
  <p data-hook="page-intro">Every screen from builder.json, frozen with ?still=1.</p>
  <div data-hook="preview-screens"></div>
  <template data-hook="template-preview-screen">
    <figure data-hook="preview-screen">
      <iframe data-hook="preview-frame" title="Screen" loading="lazy"></iframe>
      <figcaption data-hook="preview-caption">screen</figcaption>
    </figure>
  </template>
</main>`, "js/preview.js")),
    },
    {
      path: `${ROOT}gallery.html`,
      content: kitHooks(layout("Gallery", "page-gallery", `<main data-hook="page-main">
  <h1 data-hook="page-title">Gallery</h1>
  <p data-hook="page-intro">Every reusable part on one page, so one style can be judged everywhere at once. The Builder's export starts it empty: add the site's buttons, fields and cards here, with the same hooks as the pages.</p>
</main>`)),
    },
  );
  const slugName = slugWords(input.name, 6) || "site";
  const manifest = {
    kit: KIT_VERSION,
    name: input.name,
    about: "Read first by the Polio builder. Every path is relative to this file. See BUILDER-CONTRACT.md. Made by the Builder's Export for code.",
    pages: input.pages.map((p) => ({ file: `${ROOT}${p.file}`, title: p.title })),
    hooks: `${ROOT}hooks.json`,
    tokens: `${ROOT}tokens.css`,
    styleLayer: `${ROOT}style-layer.css`,
    preview: { page: `${ROOT}preview.html`, query: "?still=1&screen=<name>", screens },
    gallery: `${ROOT}gallery.html`,
    scripts: { hookCalls: HELPERS, helperFiles: [`${ROOT}js/hooks.js`], ignore: [`/${ROOT}assets/`, "/vendor/", "/node_modules/"] },
    links: offsiteToKitLinks(input.links),
    /* The state rules' files (BUILDER-RULES.md, rules 12 to 20): one scene per page to start, no samples yet; a code chat adds panels and scenes as the pages change. */
    scenes: "scenes.json",
    samples: "samples.json",
    /* The design and build rules every code chat follows; the full text is BUILDER-RULES.md beside it. No slots yet: the starter's are its own. */
    rules: { ...KIT_RULES, slots: [], outsideParts: [] },
  };
  files.push(
    { path: "builder.json", content: `${JSON.stringify(manifest, null, 2)}\n` },
    {
      path: "scenes.json",
      content: `${JSON.stringify({ about: "Each scene a person meets, in order: its page, the preview screen that shows it, and every panel present with its state. A panel left out is absent (its \"off\" state). BUILDER-RULES.md, rule 17. Made by the Builder's Export for code with one scene per page.", scenes: screens.map((x) => ({ name: x.name, label: x.name, page: x.page, screen: x.name, panels: {} })) }, null, 2)}\n`,
    },
    { path: "samples.json", content: `${JSON.stringify({ about: "Sample values for text a script fills in, by hook. The builder shows them as sample chips. Data is not a state (BUILDER-RULES.md, rule 15).", hooks: {} }, null, 2)}\n` },
    {
      path: "package.json",
      content: `${JSON.stringify({
        name: slugName, version: "0.1.0", private: true, type: "module",
        description: `${input.name}: a builder-ready site (kit ${KIT_VERSION}), exported from the Polio builder.`,
        engines: { node: ">=18" },
        scripts: { "kit:check": "node tools/kit-check.mjs builder.json", "kit:hooks": "node tools/kit-check.mjs builder.json --write", "kit:diff": "node tools/kit-diff.mjs builder.json", "kit:notes": "node tools/code-notes.mjs builder.json", test: "node tools/kit-check.mjs builder.json", serve: "python3 -m http.server 8080" },
      }, null, 2)}\n`,
    },
    {
      path: "README.md",
      content: `# ${input.name}\n\nExported from J's Polio builder with **Export for code**: a builder-ready repo (kit ${KIT_VERSION}). The site is in \`site/\`; \`builder.json\` is what the builder reads first.\n\n- Read \`CLAUDE.md\`, \`AGENTS.md\`, \`BUILDER-CONTRACT.md\`, \`BUILDER-RULES.md\` and \`PIPELINE.md\` before changing anything. \`BUILDER-RULES.md\` (also \`rules\` in \`builder.json\`) is what every code chat follows: anything a script shows later is a state inside a part the builder can see.\n- \`npm run kit:check\` must pass; \`npm run kit:hooks\` remakes \`site/hooks.json\` after a page, stylesheet or script changes.\n- \`site/assets/\` is the builder's own runtime (motion, features, pictures): the check skips its scripts (\`builder.json\` \`scripts.ignore\`). Replace them with hooked code as the site grows.\n- \`site/style-layer.css\` is empty: it is the design's file, sent back by the builder as a pull request from a \`style/...\` branch.\n- Serve \`site/\` as the web root (\`npm run serve\`, then open http://localhost:8080/site/).\n`,
    },
    ...["BUILDER-CONTRACT.md", "BUILDER-RULES.md", "PIPELINE.md", "AGENTS.md", "CLAUDE.md", "RETROFIT.md", "tools/kit-check.mjs", "tools/kit-diff.mjs", "tools/state-frames.mjs", "tools/record-diff.mjs", "tools/code-notes.mjs", ".github/workflows/kit-check.yml"].map((p) => ({ path: p, content: KIT_FILES[p]! })),
  );
  const says = `Export for code: ${input.pages.length} page${input.pages.length === 1 ? "" : "s"}, ${hooks} elements each with a data-hook, ${tokens.decls.length} tokens in site/tokens.css, an empty style layer, builder.json with ${screens.length} preview screen${screens.length === 1 ? "" : "s"}, and the kit's check, contract and CI.`;
  /* Every hook it came in with that is on a page as written. */
  const written = new Set(files.filter((f) => f.path.endsWith(".html") && f.encoding !== "base64").flatMap((f) => [...f.content.matchAll(/\sdata-hook="([^"]+)"/g)].map((m) => m[1]!)));
  const kept = [...keep].filter((h) => written.has(h)).sort();
  return { files, hooks, pages: input.pages.length, says, kept, fresh: namer.fresh, renamed: namer.renamed };
}

/**
 * Adds `hooks.json`, made by the kit's own check, which also says whether
 * the export keeps the contract (`kitMap.ts`, run on our server).
 */
/**
 * PICTURES OUT OF THE TEXT. A page brought in from code carries its pictures
 * as `data:` addresses inside its HTML and CSS (backgrounds, masks, a still
 * of a chart), which made PonsStars' export megabytes of text: too big for
 * the kit's check on our server (413) and for a code chat to read. Each one
 * over `min` characters becomes a file of its own under
 * `site/assets/pictures/`, named by its bytes, and the text points at it.
 */
export function pullPictures(files: KitFile[], min = 2048): { files: KitFile[]; pulled: number } {
  const EXT: Record<string, string> = { png: "png", jpeg: "jpg", jpg: "jpg", gif: "gif", webp: "webp", avif: "avif", "svg+xml": "svg", "x-icon": "ico" };
  const made = new Map<string, string>();
  const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return `${(h >>> 0).toString(36)}${s.length.toString(36)}`; };
  const rel = (from: string, to: string) => {
    const a = from.split("/").slice(0, -1);
    const b = to.split("/");
    let i = 0;
    while (i < a.length && i < b.length - 1 && a[i] === b[i]) i++;
    return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/");
  };
  let pulled = 0;
  const out = files.map((f) => {
    if (f.encoding === "base64" || !/\.(html|css)$/.test(f.path) || !f.content.includes("data:image/")) return f;
    const content = f.content.replace(/data:image\/([a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/gi, (whole, type: string, data: string) => {
      if (whole.length < min) return whole;
      const ext = EXT[type.toLowerCase()];
      if (!ext) return whole;
      const path = `${ROOT}assets/pictures/p-${hash(data)}.${ext}`;
      if (!made.has(path)) made.set(path, data);
      pulled++;
      return rel(f.path, path);
    });
    return content === f.content ? f : { ...f, content };
  });
  return { files: [...out, ...[...made].map(([path, content]) => ({ path, content, encoding: "base64" as const }))], pulled };
}

export async function finishKit(kit: KitExport, map: (files: Record<string, string>) => Promise<{ problems: string[]; made: Record<string, string> }>): Promise<KitExport & { problems: string[] }> {
  const text = Object.fromEntries(kit.files.filter((f) => f.encoding !== "base64").map((f) => [f.path, f.content]));
  const got = await map(text);
  const files = [...kit.files.filter((f) => !(f.path in got.made)), ...Object.entries(got.made).map(([path, content]) => ({ path, content }))];
  return { ...kit, files, problems: got.problems };
}
