/**
 * What a brought-in page's own code is written against, read off its source.
 *
 * A page brought in from a code repository (PST's web/index.html) is driven
 * by scripts that find its elements by `data-hook` (and sometimes `id`), and
 * styled by CSS variables its scripts read back (`--pons-candle-up`). The
 * style layer sent back to that repository (`styleLayer.ts`) is keyed by
 * exactly these, so they are written down as the page is read: every hook
 * the HTML carries with the line it is on, every CSS variable its styles
 * define, and for each part read off the page the line its hook (or its
 * words) is on, which the part panel shows as the part's place in the code.
 *
 * Read off the text, not the DOM: a line is a property of the file. Hooks a
 * script makes at run time (PST's `wallet-option`) are in no file, and are
 * not here; the style layer never claims to style them.
 *
 * Pure. `tests/style-layer.mjs` holds it.
 */
import type { PageRead } from "./bring-in/index.ts";

export interface SourceHook {
  attr: "data-hook" | "id";
  value: string;
  /** 1-based. */
  line: number;
}

export interface SourceVar {
  /** With its dashes: `--pons-candle-up`. */
  name: string;
  value: string;
  file: string;
  line: number;
  /** Defined in the design-tokens file (`tokens.css`, or the one builder.json names): a token the owner edits as a variable. */
  token?: boolean;
}

/** Is this the design-tokens file? `tokens.css` anywhere, or the path a builder.json names. */
export const isTokensFile = (file: string, named?: string | null) => (named ? file.replace(/^\//, "") === named.replace(/^\//, "") : /(^|\/)(design-)?tokens\.css$/i.test(file));

export interface PageSource {
  file: string;
  hooks: SourceHook[];
  vars: SourceVar[];
}

/** The ranges of a file that are code, not markup: a hook written inside a script is not an element's. */
function codeRanges(html: string): [number, number][] {
  const out: [number, number][] = [];
  const re = /<(script|style)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) out.push([m.index + m[0].indexOf(">") + 1, m.index + m[0].length]);
  return out;
}

const lineAt = (text: string, index: number) => text.slice(0, index).split("\n").length;

/** Every `data-hook` and `id` an element in this HTML carries, with its line. */
export function hooksIn(html: string): SourceHook[] {
  const code = codeRanges(html);
  const inCode = (i: number) => code.some(([a, b]) => i >= a && i < b);
  const out: SourceHook[] = [];
  /* An attribute inside a tag: whitespace before it, a quoted value after. `[data-hook="x"]` in a stylesheet has a bracket before it, and is in a style block anyway. */
  const re = /<[a-zA-Z][^<>]*?\s(data-hook|id)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let i = 0; i < html.length; ) {
    re.lastIndex = i;
    const m = re.exec(html);
    if (!m) break;
    const at = m.index + m[0].lastIndexOf(m[1]!);
    if (!inCode(m.index)) out.push({ attr: m[1] as "data-hook" | "id", value: (m[2] ?? m[3] ?? "").trim(), line: lineAt(html, at) });
    /* The same tag may carry both: carry on just past this attribute. */
    i = at + m[1]!.length;
  }
  return out.filter((h) => h.value);
}

/** Every CSS variable a stylesheet defines (`--name: value`), with its line. */
export function varsIn(css: string, file: string, offsetLine = 0): SourceVar[] {
  const out: SourceVar[] = [];
  const re = /(^|[{;\s])(--[\w-]+)\s*:\s*([^;}]+)/g;
  let m: RegExpExecArray | null;
  const token = isTokensFile(file);
  while ((m = re.exec(css))) out.push({ name: m[2]!, value: m[3]!.trim(), file, line: offsetLine + lineAt(css, m.index + m[1]!.length), ...(token ? { token: true } : {}) });
  return out;
}

/**
 * One page's source: its hooks, and the variables defined in its own style
 * blocks and in each stylesheet it links (`open` gives a linked file's text).
 */
export function sourceOfPage(file: string, html: string, open: (href: string) => { file: string; text: string } | null, opts: { tokens?: string | null } = {}): PageSource {
  const vars: SourceVar[] = [];
  const seen = new Set<string>();
  /* A stylesheet, and what it @imports (a tokens file is often imported from the base sheet), once each. */
  const sheet = (path: string, depth = 0) => {
    if (seen.has(path) || depth > 3) return;
    seen.add(path);
    const got = open(path);
    if (!got) return;
    vars.push(...varsIn(got.text, got.file).map((v) => (isTokensFile(got.file, opts.tokens) ? { ...v, token: true } : v)));
    const here = got.file.includes("/") ? got.file.slice(0, got.file.lastIndexOf("/") + 1) : "";
    const imp = /@import\s+(?:url\(\s*)?["']?([^"')\s;]+)["']?\s*\)?/gi;
    for (let i = imp.exec(got.text); i; i = imp.exec(got.text)) if (!/^[a-z]+:/i.test(i[1]!)) sheet(i[1]!.startsWith("/") ? i[1]!.slice(1) : `${here}${i[1]}`, depth + 1);
  };
  const style = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = style.exec(html))) {
    const start = m.index + m[0].indexOf(">") + 1;
    vars.push(...varsIn(m[1]!, file, lineAt(html, start) - 1));
  }
  const link = /<link\b[^>]*\brel\s*=\s*["']?stylesheet["']?[^>]*>/gi;
  while ((m = link.exec(html))) {
    const href = /\bhref\s*=\s*["']([^"']+)["']/i.exec(m[0])?.[1];
    if (!href || /^[a-z]+:/i.test(href)) continue;
    const dir = file.includes("/") ? file.slice(0, file.lastIndexOf("/") + 1) : "";
    sheet(href.startsWith("/") ? href.slice(1) : `${dir}${href}`);
  }
  /* The tokens file the repository names, linked or not. */
  if (opts.tokens) sheet(opts.tokens.replace(/^\//, ""));
  return { file, hooks: hooksIn(html), vars };
}

/** The line a selector is written on in a stylesheet's text, from `from` on: matched with its whitespace and quotes taken out, the way the browser writes it back. */
function selectorLine(text: string, selector: string, offset: number): number | null {
  const want = selector.replace(/\s+/g, "").replace(/'/g, '"');
  const first = want.split(",")[0]!;
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!.replace(/\s+/g, "").replace(/'/g, '"');
    if (l.includes(want) || (first && l.includes(first) && /\{|,$/.test(l))) return offset + i + 1;
  }
  return null;
}

/** Each part's line in the source: its hook's, else where its words begin; and the file and line of each CSS rule that reaches it. */
export function withLines(read: PageRead, source: PageSource, html: string, open?: (href: string) => { file: string; text: string } | null): PageRead {
  const blocks: { text: string; line: number }[] = [];
  const style = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
  for (let m = style.exec(html); m; m = style.exec(html)) blocks.push({ text: m[1]!, line: lineAt(html, m.index + m[0].indexOf(">") + 1) - 1 });
  const dir = source.file.includes("/") ? source.file.slice(0, source.file.lastIndexOf("/") + 1) : "";
  const sheets = new Map<string, { file: string; text: string } | null>();
  const sheet = (href: string) => {
    if (!sheets.has(href)) sheets.set(href, open ? open(href.startsWith("/") ? href.slice(1) : `${dir}${href}`) : null);
    return sheets.get(href) ?? null;
  };
  const cssOf = (rules: NonNullable<PageRead["parts"][number]["rules"]>) => rules.map((r) => {
    if (r.sheet !== null) {
      const got = sheet(r.sheet);
      return got ? { file: got.file, line: selectorLine(got.text, r.selector, 0) ?? 1, selector: r.selector } : null;
    }
    const b = blocks[r.block];
    return b ? { file: source.file, line: selectorLine(b.text, r.selector, b.line) ?? b.line + 1, selector: r.selector } : null;
  }).filter((x): x is { file: string; line: number; selector: string } => !!x);
  const byHook = new Map<string, number>();
  for (const h of source.hooks) {
    const key = `${h.attr}=${h.value}`;
    if (!byHook.has(key)) byHook.set(key, h.line);
  }
  const plain = html.replace(/\s+/g, " ");
  const parts = read.parts.map((p) => {
    const hook = p.hooks["data-hook"] ? `data-hook=${p.hooks["data-hook"]}` : p.hooks.id ? `id=${p.hooks.id}` : null;
    let line = hook ? byHook.get(hook) : undefined;
    if (!line && p.words.trim().length > 3) {
      /* Words are matched loosely, a few at the start: markup may sit between them in the file. */
      const lead = p.words.replace(/^[•◦▪]\s|^\d+\.\s/, "").trim().split(/\s+/).slice(0, 4).join(" ");
      const at = plain.indexOf(lead);
      if (at >= 0) {
        /* The collapsed index, walked back to the file's own. */
        let seen = 0, i = 0;
        for (; i < html.length && seen < at; i++) if (!(/\s/.test(html[i]!) && /\s/.test(html[i + 1] ?? ""))) seen++;
        line = lineAt(html, i);
      }
    }
    const css = p.rules?.length ? cssOf(p.rules) : [];
    return { ...p, ...(line ? { line } : {}), ...(css.length ? { css } : {}) };
  });
  return { ...read, parts };
}
