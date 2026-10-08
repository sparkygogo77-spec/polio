/**
 * A SITE READ FROM ITS SOURCE, not from a render of it.
 *
 * HIS RULING: this is a repository we have full access to, so it should
 * import as easily as any other site, and reading the deployed page with
 * the renderer is the wrong instrument. A v0 or Next app keeps its page in
 * `app/page.tsx` and the pieces it is made of in components beside it: the
 * text, the classes, the images, the structure. This reads those and
 * writes a plain page out of them, banded as the source is banded, which
 * the files route then opens and carries exactly as it does any page.
 *
 * WHAT IT READS. The page's default export and the components it imports
 * from the same repository, a few levels down. JSX becomes markup:
 * strings stay, `{"words"}` stay, a ternary keeps its first branch (the
 * landing state, before anything is connected), `a && b` is left out, a
 * `.map` over a constant array in the same file is unrolled with each
 * item's fields, a component is opened in place, an icon becomes a small
 * mark, and handlers are dropped. Tailwind classes become inline style for
 * the subset that decides how a thing looks: colours, type, spacing,
 * flex and grid, borders, radius, shadow, width and alignment. Theme
 * colours come from the app's own `globals.css`.
 *
 * WHAT IT CANNOT READ, said rather than guessed: anything computed at run
 * time, data fetched from a server, and state-driven views past the first
 * branch. Those are counted, and the render path stays the fallback for a
 * site whose sources we cannot see.
 *
 * Pure: no fetch, no browser. `tests/source-site.mjs` holds it against
 * his own repository's real source.
 */

export interface SourceFile { path: string; text: string }

export interface SourceNotes {
  /** Components opened in place, by name. */
  opened: string[];
  /** Components the repository does not hold, left as their name. */
  unknown: string[];
  /** Expressions left out: state, fetched data, handlers. */
  dropped: number;
  /** Arrays unrolled from constants in the same file. */
  unrolled: number;
  /** Bands the page is made of, by tag. */
  bands: string[];
  /** Pictures referenced from `public/`, by path. */
  pictures: string[];
  /** Icons drawn from the small set this knows, by name. */
  icons: string[];
  /** Components that render nothing on a first view (a popup that opens closed, a wallet panel before a wallet). */
  closed: string[];
}

export interface SourcePage {
  entry: string;
  html: string;
  notes: SourceNotes;
}

const PAGE_CANDIDATES = ["app/page.tsx", "app/page.jsx", "src/app/page.tsx", "src/app/page.jsx", "pages/index.tsx", "pages/index.jsx", "src/pages/index.tsx", "src/pages/index.jsx"];

/** The page a Next or v0 app opens at its root, if the repository holds one. */
export function findPage(paths: readonly string[]): string | null {
  return PAGE_CANDIDATES.find((p) => paths.includes(p)) ?? null;
}

/** The files a source read wants: the page, everything under app/, components/, lib/, styles, and public/. */
export const SOURCE_WANTED = /^(src\/)?(app|components|lib|styles)\/.*\.(tsx|jsx|ts|js|css)$|^(src\/)?app\/globals\.css$|^public\/.*\.(png|jpe?g|webp|svg|gif|ico)$/i;
export const MAX_SOURCE_FILES = 60;
export const MAX_SOURCE_BYTES = 3 * 1024 * 1024;

/* ------------------------------------------------------------------ */
/* Resolving imports                                                   */
/* ------------------------------------------------------------------ */

function resolveImport(from: string, spec: string, have: ReadonlySet<string>): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = spec.slice(2);
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    const dir = from.split("/").slice(0, -1);
    for (const seg of spec.split("/")) {
      if (seg === ".") continue;
      if (seg === "..") dir.pop(); else dir.push(seg);
    }
    base = dir.join("/");
  } else return null;
  for (const b of [base, `src/${base}`]) {
    for (const ext of ["", ".tsx", ".jsx", ".ts", ".js", "/index.tsx", "/index.jsx", "/index.ts"]) {
      if (have.has(b + ext)) return b + ext;
    }
  }
  return null;
}

/** `import { A, B as C } from "x"` and `import D from "x"`: local name to file and exported name. */
function importsOf(text: string, from: string, have: ReadonlySet<string>): Map<string, { file: string; name: string }> {
  const out = new Map<string, { file: string; name: string }>();
  const re = /import\s+(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g;
  for (const m of text.matchAll(re)) {
    const file = resolveImport(from, m[3]!, have);
    if (!file) continue;
    if (m[1]) out.set(m[1], { file, name: "default" });
    if (m[2]) for (const part of m[2].split(",")) {
      const [orig, alias] = part.trim().split(/\s+as\s+/).map((s) => s.trim());
      if (orig) out.set(alias || orig, { file, name: orig });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Finding a component's JSX                                            */
/* ------------------------------------------------------------------ */

/** The text between a `(` at `at` and its match, or a JSX element starting at `at`. */
function balanced(text: string, at: number, open: string, close: string): string | null {
  let depth = 0;
  for (let i = at; i < text.length; i++) {
    const c = text[i];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return text.slice(at + 1, i); }
  }
  return null;
}

/** Where a component's declaration ends and its body or arrow starts. */
function findComponent(text: string, name: string): { at: number; brace: boolean }[] {
  const heads = name === "default"
    ? [/export\s+default\s+function\s*\w*\s*\([^)]*\)\s*\{/, /export\s+default\s+(?:async\s+)?(?:\([^)]*\)|\w+)\s*=>\s*/, /const\s+(\w+)\s*=\s*(?:\([^)]*\)|\w+)\s*=>[\s\S]*?export\s+default\s+\1\b/]
    : [new RegExp(`export\\s+(?:default\\s+)?function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`), new RegExp(`(?:export\\s+)?const\\s+${name}\\s*(?::[^=]+)?=\\s*(?:React\\.)?(?:memo\\()?(?:forwardRef\\()?\\s*(?:\\([^)]*\\)|\\w+)\\s*=>\\s*`), new RegExp(`function\\s+${name}\\s*\\([^)]*\\)\\s*\\{`)];
  const found: { at: number; brace: boolean }[] = [];
  for (const head of heads) {
    const m = head.exec(text);
    if (m) found.push({ at: m.index + m[0].length, brace: m[0].endsWith("{") });
  }
  return found;
}

/** A component's function body, for the early outs before its render. Null for an arrow that is only an expression. */
function bodyOf(text: string, name: string): string | null {
  for (const { at, brace } of findComponent(text, name)) {
    if (brace) return balanced(text, at - 1, "{", "}");
    let i = at;
    while (i < text.length && /\s/.test(text[i]!)) i++;
    if (text[i] === "{") return balanced(text, i, "{", "}");
  }
  return null;
}

/** The JSX a component returns: `return (…)` after its declaration, or the arrow body. */
function jsxOf(text: string, name: string): string | null {
  for (const { at: start, brace } of findComponent(text, name)) {
    let at = start;
    if (brace) {
      /* The last `return (` in the body is the render; earlier ones are early outs. */
      const body = balanced(text, at - 1, "{", "}") ?? "";
      let last = -1;
      const rr = /return\s*\(/g;
      for (const r of body.matchAll(rr)) last = r.index + r[0].length - 1;
      if (last < 0) continue;
      const inner = balanced(body, last, "(", ")");
      if (inner) return inner.trim();
      continue;
    }
    /* Arrow: `=> (` or `=> <`. */
    while (at < text.length && /\s/.test(text[at]!)) at++;
    if (text[at] === "(") { const inner = balanced(text, at, "(", ")"); if (inner) return inner.trim(); }
    if (text[at] === "<") return text.slice(at);
    if (text[at] === "{") {
      const body = balanced(text, at, "{", "}") ?? "";
      let last = -1;
      for (const r of body.matchAll(/return\s*\(/g)) last = r.index + r[0].length - 1;
      if (last >= 0) { const inner = balanced(body, last, "(", ")"); if (inner) return inner.trim(); }
    }
  }
  return null;
}

/**
 * The files a page reaches through its imports, from the ones the tree
 * holds: what a source read has to fetch. `texts` is what is fetched so
 * far; the answer is what is still wanted, so a caller fetches in rounds
 * until nothing is.
 */
export function neededBy(texts: ReadonlyMap<string, string>, have: ReadonlySet<string>): string[] {
  const want = new Set<string>();
  for (const [from, text] of texts) {
    /* Only a file that can hold markup is wanted: a `.ts` helper cannot render. */
    for (const { file } of importsOf(text, from, have).values()) if (!texts.has(file) && /\.(tsx|jsx)$/.test(file) && SOURCE_WANTED.test(file)) want.add(file);
  }
  return [...want];
}

/** `const items = [ {…}, {…} ]` in the same file: the objects, by field. */
function constArrays(text: string): Map<string, Record<string, string>[]> {
  const out = new Map<string, Record<string, string>[]>();
  const re = /const\s+(\w+)\s*(?::[^=]+)?=\s*\[/g;
  for (const m of text.matchAll(re)) {
    const inner = balanced(text, m.index + m[0].length - 1, "[", "]");
    if (!inner) continue;
    const items: Record<string, string>[] = [];
    const objRe = /\{([^{}]*)\}/g;
    for (const o of inner.matchAll(objRe)) {
      const item: Record<string, string> = {};
      for (const f of o[1]!.matchAll(/(\w+)\s*:\s*(?:"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'|`([^`]*)`)/g)) item[f[1]!] = (f[2] ?? f[3] ?? f[4] ?? "").replace(/\\(["'])/g, "$1");
      if (Object.keys(item).length) items.push(item);
    }
    if (items.length) out.set(m[1]!, items);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Tailwind, the part that decides how a thing looks                    */
/* ------------------------------------------------------------------ */

const SPACE = (n: string): string => {
  if (n === "px") return "1px";
  if (n === "auto") return "auto";
  if (n.startsWith("[")) return n.slice(1, -1);
  const v = Number(n);
  return Number.isFinite(v) ? `${v * 0.25}rem` : "";
};
const TEXT_SIZE: Record<string, string> = { xs: "12px/16px", sm: "14px/20px", base: "16px/24px", lg: "18px/28px", xl: "20px/28px", "2xl": "24px/32px", "3xl": "30px/36px", "4xl": "36px/40px", "5xl": "48px/48px", "6xl": "60px/60px", "7xl": "72px/72px" };
const PALETTE: Record<string, string> = {
  white: "#ffffff", black: "#000000", transparent: "transparent",
  "red-500": "#ef4444", "red-600": "#dc2626", "orange-500": "#f97316", "amber-500": "#f59e0b", "yellow-400": "#facc15", "green-500": "#22c55e", "green-400": "#4ade80",
  "blue-500": "#3b82f6", "purple-500": "#a855f7", "pink-500": "#ec4899",
  "gray-100": "#f3f4f6", "gray-200": "#e5e7eb", "gray-300": "#d1d5db", "gray-400": "#9ca3af", "gray-500": "#6b7280", "gray-600": "#4b5563", "gray-700": "#374151", "gray-800": "#1f2937", "gray-900": "#111827",
  "zinc-800": "#27272a", "zinc-900": "#18181b", "slate-800": "#1e293b", "slate-900": "#0f172a", "neutral-900": "#171717",
};
const ROUND: Record<string, string> = { "": "0.25rem", sm: "0.125rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem", full: "9999px", none: "0" };
const MAXW: Record<string, string> = { xs: "20rem", sm: "24rem", md: "28rem", lg: "32rem", xl: "36rem", "2xl": "42rem", "3xl": "48rem", "4xl": "56rem", "5xl": "64rem", "6xl": "72rem", "7xl": "80rem", full: "100%", none: "none" };

/** A colour class value: `[#hex]`, a palette name, or a theme token with an optional `/opacity`. */
function colourOf(v: string, theme: Record<string, string>): string | null {
  const [base, alpha] = v.split("/");
  let c: string | null = null;
  if (base!.startsWith("[")) c = base!.slice(1, -1);
  else if (PALETTE[base!]) c = PALETTE[base!]!;
  else if (theme[base!]) c = theme[base!]!;
  if (!c) return null;
  if (alpha && /^\d+$/.test(alpha)) {
    const a = Number(alpha) / 100;
    if (c.startsWith("#") && (c.length === 7)) return `${c}${Math.round(a * 255).toString(16).padStart(2, "0")}`;
    return `color-mix(in oklab, ${c} ${alpha}%, transparent)`;
  }
  return c;
}

/** An arbitrary value as Tailwind reads it: `_` is a space, and `calc(100vh-1px)` gets the spaces CSS needs. */
function arbitrary(v: string): string {
  return v.replace(/_/g, " ").replace(/calc\(([^)]*)\)/g, (_x, inner: string) => `calc(${inner.replace(/([\w%)])\s*([+-])\s*(?=[\d(])/g, "$1 $2 ")})`);
}

/** Tailwind classes to inline style, for the subset that decides how a thing looks. */
export function twToStyle(classes: string, theme: Record<string, string> = {}): string {
  const out: string[] = [];
  const put = (k: string, v: string) => { if (v) out.push(`${k}:${v}`); };
  /* The board is a wide screen: `sm:`, `md:`, `lg:` and `xl:` apply, after the base classes so they win. */
  const list = classes.split(/\s+/).filter(Boolean);
  const wide = (c: string): number => { const m = c.match(/^(sm|md|lg|xl):/); return m ? { sm: 1, md: 2, lg: 3, xl: 4 }[m[1]!]! : 0; };
  const ordered = [...list.filter((c) => !wide(c)), ...list.filter(wide).sort((a, b) => wide(a) - wide(b)).map((c) => c.replace(/^(sm|md|lg|xl):/, ""))];
  const scrolls = ordered.some((c) => /^overflow-(y-)?(auto|scroll)$/.test(c));
  let gradientTo = "";
  const stops: { from?: string; via?: string; to?: string } = {};
  for (const raw of ordered) {
    if (scrolls && /^max-h-/.test(raw)) continue;
    if (/^(hover|focus|active|group-hover|2xl|dark|supports-\[|disabled|first|last|peer|group|motion|print|focus-within|focus-visible):/.test(raw)) continue;
    const c = raw.replace(/^!/, "").replace(/\[([^\]]*)\]/g, (_x, v: string) => `[${arbitrary(v)}]`);
    let m: RegExpMatchArray | null;
    if ((m = c.match(/^text-\[(\d+(?:\.\d+)?(?:px|rem|em|%))\]$/))) { put("font-size", m[1]!); continue; }
    if ((m = c.match(/^leading-\[(.+)\]$/))) { put("line-height", m[1]!); continue; }
    if ((m = c.match(/^tracking-\[(.+)\]$/))) { put("letter-spacing", m[1]!); continue; }
    if (c === "inset-0") { put("top", "0"); put("right", "0"); put("bottom", "0"); put("left", "0"); continue; }
    if (c === "object-cover") { put("object-fit", "cover"); continue; }
    if (c === "object-contain") { put("object-fit", "contain"); continue; }
    if ((m = c.match(/^size-(.+)$/))) { const v = SPACE(m[1]!); if (v) { put("width", v); put("height", v); } continue; }
    if ((m = c.match(/^-(m|mx|my|mt|mb|ml|mr)-(.+)$/))) { const v = SPACE(m[2]!); if (!v) continue; const side = m[1]!.slice(1); const neg = `-${v}`; if (side === "") put("margin", neg); else if (side === "x") { put("margin-left", neg); put("margin-right", neg); } else if (side === "y") { put("margin-top", neg); put("margin-bottom", neg); } else put(`margin-${{ t: "top", b: "bottom", l: "left", r: "right" }[side]}`, neg); continue; }
    if ((m = c.match(/^space-x-(.+)$/))) { const v = SPACE(m[1]!); if (v) put("column-gap", v), put("display", "flex"); continue; }
    if ((m = c.match(/^aspect-(square|video)$/))) { put("aspect-ratio", m[1] === "square" ? "1 / 1" : "16 / 9"); continue; }
    if ((m = c.match(/^(w|h|min-w|min-h|max-w|max-h)-\[(.+)\]$/))) { put({ w: "width", h: "height", "min-w": "min-width", "min-h": "min-height", "max-w": "max-width", "max-h": "max-height" }[m[1]!]!, m[2]!); continue; }
    if ((m = c.match(/^grid-cols-\[(.+)\]$/))) { put("grid-template-columns", m[1]!); continue; }
    if ((m = c.match(/^bg-\[url\((.+)\)\]$/))) { put("background-image", `url(${m[1]})`); put("background-size", "cover"); continue; }
    if ((m = c.match(/^(?:bg|text|border)-\[(--[\w-]+)\]$/))) { const prop = c.startsWith("bg") ? "background-color" : c.startsWith("text") ? "color" : "border-color"; put(prop, `var(${m[1]})`); continue; }
    if (c === "sr-only") { put("display", "none"); continue; }
    if (c === "text-balance" || c === "text-pretty") { continue; }
    if (c === "antialiased") { continue; }
    if ((m = c.match(/^text-\[(#[0-9a-fA-F]{3,8}|rgba?\([^\]]*\))\]$/))) { put("color", m[1]!); continue; }
    if ((m = c.match(/^text-(.+)$/)) && TEXT_SIZE[m[1]!]) { const [fs, lh] = TEXT_SIZE[m[1]!]!.split("/"); put("font-size", fs!); put("line-height", lh!); continue; }
    if ((m = c.match(/^text-(left|center|right|justify)$/))) { put("text-align", m[1]!); continue; }
    if ((m = c.match(/^text-(.+)$/))) { const col = colourOf(m[1]!, theme); if (col) put("color", col); continue; }
    if ((m = c.match(/^bg-gradient-to-(r|l|t|b|tr|tl|br|bl)$/))) { gradientTo = { r: "to right", l: "to left", t: "to top", b: "to bottom", tr: "to top right", tl: "to top left", br: "to bottom right", bl: "to bottom left" }[m[1]!]!; continue; }
    if ((m = c.match(/^(from|via|to)-(.+)$/))) { const col = colourOf(m[2]!, theme); if (col) stops[m[1] as "from" | "via" | "to"] = col; continue; }
    if ((m = c.match(/^bg-(.+)$/))) { if (m[1] === "transparent") { put("background", "transparent"); continue; } if (/^gradient/.test(m[1]!)) continue; const col = colourOf(m[1]!, theme); if (col) put("background-color", col); continue; }
    if ((m = c.match(/^border-(t|b|l|r)(?:-(\d+))?$/))) { const side = { t: "top", b: "bottom", l: "left", r: "right" }[m[1] as "t" | "b" | "l" | "r"]; put(`border-${side}-width`, `${m[2] ?? 1}px`); put(`border-${side}-style`, "solid"); continue; }
    if ((m = c.match(/^border(?:-(\d+))?$/))) { put("border-width", `${m[1] ?? 1}px`); put("border-style", "solid"); continue; }
    if ((m = c.match(/^border-(.+)$/))) { const col = colourOf(m[1]!, theme); if (col) put("border-color", col); continue; }
    if ((m = c.match(/^rounded(?:-(.+))?$/))) { put("border-radius", ROUND[m[1] ?? ""] ?? ""); continue; }
    if ((m = c.match(/^shadow-\[(.+)\]$/))) { put("box-shadow", m[1]!.replace(/_/g, " ")); continue; }
    if (c === "shadow" || c === "shadow-md") { put("box-shadow", "0 4px 6px -1px rgb(0 0 0 / 0.1)"); continue; }
    if (c === "shadow-lg") { put("box-shadow", "0 10px 15px -3px rgb(0 0 0 / 0.1)"); continue; }
    if ((m = c.match(/^font-(bold|semibold|medium|normal|light|extrabold|black)$/))) { put("font-weight", { bold: "700", semibold: "600", medium: "500", normal: "400", light: "300", extrabold: "800", black: "900" }[m[1]!]!); continue; }
    if ((m = c.match(/^font-(mono|sans|serif|pixel)$/))) { put("font-family", m[1] === "mono" ? "ui-monospace, monospace" : m[1] === "pixel" ? (theme["font-pixel"] ?? "monospace") : m[1] === "serif" ? "serif" : (theme["font-sans"] ?? "system-ui, sans-serif")); continue; }
    if ((m = c.match(/^(p|px|py|pt|pb|pl|pr|m|mx|my|mt|mb|ml|mr)-(.+)$/))) {
      const v = SPACE(m[2]!); if (!v) continue;
      const prop = m[1]!.startsWith("p") ? "padding" : "margin";
      const side = m[1]!.slice(1);
      if (side === "") put(prop, v);
      else if (side === "x") { put(`${prop}-left`, v); put(`${prop}-right`, v); }
      else if (side === "y") { put(`${prop}-top`, v); put(`${prop}-bottom`, v); }
      else put(`${prop}-${{ t: "top", b: "bottom", l: "left", r: "right" }[side]}`, v);
      continue;
    }
    if ((m = c.match(/^gap(?:-(x|y))?-(.+)$/))) { const v = SPACE(m[2]!); if (v) put(m[1] === "x" ? "column-gap" : m[1] === "y" ? "row-gap" : "gap", v); continue; }
    if ((m = c.match(/^space-y-(.+)$/))) { const v = SPACE(m[1]!); if (v) put("row-gap", v), put("display", "flex"), put("flex-direction", "column"); continue; }
    if (c === "flex") { put("display", "flex"); continue; }
    if (c === "inline-flex") { put("display", "inline-flex"); continue; }
    if (c === "grid") { put("display", "grid"); continue; }
    if (c === "block") { put("display", "block"); continue; }
    if (c === "inline-block") { put("display", "inline-block"); continue; }
    if (c === "hidden") { put("display", "none"); continue; }
    if (c === "flex-col") { put("flex-direction", "column"); continue; }
    if (c === "flex-row") { put("flex-direction", "row"); continue; }
    if (c === "flex-wrap") { put("flex-wrap", "wrap"); continue; }
    if (c === "flex-1") { put("flex", "1 1 0%"); continue; }
    if (c === "flex-shrink-0" || c === "shrink-0") { put("flex-shrink", "0"); continue; }
    if ((m = c.match(/^items-(start|center|end|stretch|baseline)$/))) { put("align-items", m[1] === "start" ? "flex-start" : m[1] === "end" ? "flex-end" : m[1]!); continue; }
    if ((m = c.match(/^justify-(start|center|end|between|around|evenly)$/))) { put("justify-content", { start: "flex-start", center: "center", end: "flex-end", between: "space-between", around: "space-around", evenly: "space-evenly" }[m[1]!]!); continue; }
    if ((m = c.match(/^grid-cols-(\d+)$/))) { put("grid-template-columns", `repeat(${m[1]}, minmax(0, 1fr))`); continue; }
    if ((m = c.match(/^w-(.+)$/))) { const v = m[1] === "full" ? "100%" : m[1] === "auto" ? "auto" : m[1] === "screen" ? "100vw" : SPACE(m[1]!); if (v) put("width", v); continue; }
    if ((m = c.match(/^h-(.+)$/))) { const v = m[1] === "full" ? "100%" : m[1] === "auto" ? "auto" : m[1] === "screen" ? "100vh" : SPACE(m[1]!); if (v) put("height", v); continue; }
    if ((m = c.match(/^min-h-(.+)$/))) { const v = m[1]!.startsWith("[") ? m[1]!.slice(1, -1) : m[1] === "screen" ? "100vh" : SPACE(m[1]!); if (v) put("min-height", v); continue; }
    if ((m = c.match(/^max-w-(.+)$/))) { const v = MAXW[m[1]!] ?? (m[1]!.startsWith("[") ? m[1]!.slice(1, -1) : ""); if (v) put("max-width", v); continue; }
    if ((m = c.match(/^max-h-(.+)$/))) { const v = m[1]!.startsWith("[") ? m[1]!.slice(1, -1) : SPACE(m[1]!); if (v) put("max-height", v); continue; }
    if (c === "mx-auto") { put("margin-left", "auto"); put("margin-right", "auto"); continue; }
    if (c === "container") { put("width", "100%"); put("max-width", "80rem"); put("margin-left", "auto"); put("margin-right", "auto"); continue; }
    if (c === "uppercase" || c === "lowercase" || c === "capitalize") { put("text-transform", c); continue; }
    if ((m = c.match(/^tracking-(tighter|tight|normal|wide|wider|widest)$/))) { put("letter-spacing", { tighter: "-0.05em", tight: "-0.025em", normal: "0", wide: "0.025em", wider: "0.05em", widest: "0.1em" }[m[1]!]!); continue; }
    if ((m = c.match(/^leading-(none|tight|snug|normal|relaxed|loose)$/))) { put("line-height", { none: "1", tight: "1.25", snug: "1.375", normal: "1.5", relaxed: "1.625", loose: "2" }[m[1]!]!); continue; }
    if ((m = c.match(/^opacity-(\d+)$/))) { put("opacity", String(Number(m[1]) / 100)); continue; }
    if (c === "relative" || c === "absolute" || c === "sticky") { put("position", c); continue; }
    if (c === "fixed") { put("position", "relative"); continue; }
    if ((m = c.match(/^(top|left|right|bottom)-(.+)$/))) { const v = m[2] === "1/2" ? "50%" : SPACE(m[2]!); if (v) put(m[1]!, v); continue; }
    if (c === "overflow-hidden") { put("overflow", "hidden"); continue; }
    if (c === "overflow-y-auto" || c === "overflow-auto") { put("overflow", "visible"); continue; }
    if (c === "text-transparent") { put("color", "transparent"); continue; }
    if (c === "bg-clip-text") { put("-webkit-background-clip", "text"); put("background-clip", "text"); continue; }
    if (c === "cursor-pointer") { put("cursor", "pointer"); continue; }
    if (c === "text-ellipsis" || c === "truncate") { put("overflow", "hidden"); put("text-overflow", "ellipsis"); put("white-space", "nowrap"); continue; }
    if (c === "whitespace-nowrap") { put("white-space", "nowrap"); continue; }
    if (c === "italic") { put("font-style", "italic"); continue; }
    if (c === "underline") { put("text-decoration", "underline"); continue; }
  }
  if (gradientTo && (stops.from || stops.to)) put("background-image", `linear-gradient(${gradientTo}, ${[stops.from ?? "transparent", stops.via, stops.to ?? "transparent"].filter(Boolean).join(", ")})`);
  return out.join(";");
}

/** The app's theme, from `globals.css`: `--name: value` in `:root`, as `name` to value, plus font stacks. */
export function themeOf(css: string): Record<string, string> {
  const theme: Record<string, string> = {};
  const root = css.match(/:root\s*\{([^}]*)\}/);
  for (const m of (root?.[1] ?? "").matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) theme[m[1]!] = m[2]!.trim();
  /* `bg-background` reads `--color-background: var(--background)`: the token behind the alias. */
  for (const m of css.matchAll(/--color-([\w-]+)\s*:\s*var\(--([\w-]+)\)/g)) if (theme[m[2]!] && !theme[m[1]!]) theme[m[1]!] = theme[m[2]!]!;
  if (/font-jetbrains|JetBrains/i.test(css)) theme["font-sans"] = "'JetBrains Mono', ui-monospace, monospace";
  if (/press-start|Press Start/i.test(css)) theme["font-pixel"] = "'Press Start 2P', monospace";
  return theme;
}

/* ------------------------------------------------------------------ */
/* A first view: what is true before anything is clicked or connected   */
/* ------------------------------------------------------------------ */

/**
 * What each name in a file is when the page first opens. State starts at
 * its `useState` value; a `useEffect` that sets it to a literal straight
 * away counts, because that runs before anyone sees the page. Anything
 * else, a wallet, a fetch, a hook this cannot read, is false: the
 * landing state, before anything is connected.
 */
function stateOf(text: string): { truth: Record<string, boolean>; vals: Record<string, string> } {
  const truth: Record<string, boolean> = {};
  const vals: Record<string, string> = {};
  for (const m of text.matchAll(/const\s+\[\s*(\w+)\s*(?:,\s*\w+\s*)?\]\s*=\s*useState(?:<[^>]*>)?\(/g)) {
    const init = (balanced(text, m.index + m[0].length - 1, "(", ")") ?? "").trim();
    const lit = literalOf(init);
    if (lit !== null) vals[m[1]!] = lit.text;
    truth[m[1]!] = lit ? lit.truth : init !== "";
  }
  for (const m of text.matchAll(/useEffect\(\s*\(\)\s*=>\s*\{/g)) {
    const body = balanced(text, m.index + m[0].length - 1, "{", "}") ?? "";
    /* Only a set at the top of the effect runs straight away; one inside a handler or a branch waits for something. */
    const tops = new Set(topIndexes(body));
    for (const set of body.matchAll(/\bset([A-Z]\w*)\((true|false|"[^"]*"|'[^']*'|\d+)\)/g)) {
      if (!tops.has(set.index)) continue;
      const name = set[1]![0]!.toLowerCase() + set[1]!.slice(1);
      if (!(name in truth)) continue;
      const lit = literalOf(set[2]!)!;
      truth[name] = lit.truth;
      vals[name] = lit.text;
    }
  }
  return { truth, vals };
}

/** A literal's text and truth, or null when it is not one. */
function literalOf(e: string): { text: string; truth: boolean } | null {
  const t = e.trim();
  if (t === "true") return { text: "true", truth: true };
  if (t === "false" || t === "null" || t === "undefined" || t === "") return { text: t, truth: false };
  if (/^-?\d+(\.\d+)?$/.test(t)) return { text: t, truth: Number(t) !== 0 };
  const str = t.match(/^(?:"([^"]*)"|'([^']*)'|`([^`$]*)`)$/);
  if (str) { const v = str[1] ?? str[2] ?? str[3] ?? ""; return { text: v, truth: v !== "" }; }
  if (/^\[\s*\]$/.test(t)) return { text: "[]", truth: false };
  if (/^\{\s*\}$/.test(t)) return { text: "{}", truth: true };
  if (t.startsWith("[") || t.startsWith("{")) return { text: t, truth: true };
  return null;
}

/**
 * The indexes of `e` that are at the top level of the code: outside
 * strings, brackets and markup. Markup is walked as markup, so a `?` or
 * an apostrophe in a sentence on the page does not split an expression.
 */
function topIndexes(e: string): number[] {
  const top: number[] = [];
  const stack: ("js" | "tag" | "jsx")[] = [];
  let quote: string | null = null;
  for (let i = 0; i < e.length; i++) {
    const c = e[i]!;
    const mode = stack[stack.length - 1] ?? "js";
    if (quote) { if (c === "\\") i++; else if (c === quote) quote = null; continue; }
    if (mode === "jsx") {
      if (c === "{") { stack.push("js"); continue; }
      if (c === "<" && e[i + 1] === "/") { const close = e.indexOf(">", i); stack.pop(); i = close < 0 ? e.length : close; continue; }
      if (c === "<" && /[A-Za-z>]/.test(e[i + 1] ?? "")) { stack.push("tag"); continue; }
      continue;
    }
    if (mode === "tag") {
      if (c === '"' || c === "'") { quote = c; continue; }
      if (c === "{") { stack.push("js"); continue; }
      if (c === "/" && e[i + 1] === ">") { stack.pop(); i++; continue; }
      if (c === ">") { stack.pop(); stack.push("jsx"); continue; }
      continue;
    }
    if (stack.length === 0) top.push(i);
    if (c === '"' || c === "'" || c === "`") { quote = c; continue; }
    if (c === "/" && e[i + 1] === "*") { const close = e.indexOf("*/", i + 2); i = close < 0 ? e.length : close + 1; continue; }
    if (c === "/" && e[i + 1] === "/") { const close = e.indexOf("\n", i); i = close < 0 ? e.length : close; continue; }
    if (c === "(" || c === "[" || c === "{") { stack.push("js"); continue; }
    if (c === ")" || c === "]" || c === "}") { stack.pop(); continue; }
    if (c === "<" && /[A-Za-z>]/.test(e[i + 1] ?? "")) {
      let k = i - 1;
      while (k >= 0 && /\s/.test(e[k]!)) k--;
      const before = k >= 0 ? e[k]! : "";
      if (!/[\w)\]"'`]/.test(before)) { stack.push("tag"); continue; }
    }
  }
  return top;
}

/** Split at a top-level operator, outside parens, braces, brackets, strings and markup. */
function splitTop(e: string, op: string): string[] {
  const parts: string[] = [];
  let last = 0;
  let skipTo = -1;
  for (const i of topIndexes(e)) {
    if (i < skipTo || !e.startsWith(op, i)) continue;
    if (op === "?" && (e[i + 1] === "." || e[i + 1] === "?" || e[i - 1] === "?")) continue;
    if (op === "&&" || op === "||" || op === "??") { /* exact: `&&` never sits inside another operator */ }
    parts.push(e.slice(last, i));
    last = i + op.length;
    skipTo = last;
  }
  parts.push(e.slice(last));
  return parts;
}

/** `cond ? a : b` at the top level, or null. */
function splitTernary(e: string): { cond: string; a: string; b: string } | null {
  const q = splitTop(e, "?");
  if (q.length < 2) return null;
  const cond = q[0]!;
  const rest = q.slice(1).join("?");
  let nested = 0;
  for (const i of topIndexes(rest)) {
    const c = rest[i]!;
    if (c === "?" && rest[i + 1] !== "." && rest[i + 1] !== "?" && rest[i - 1] !== "?") nested++;
    else if (c === ":") {
      if (nested > 0) { nested--; continue; }
      return { cond: cond.trim(), a: rest.slice(0, i).trim(), b: rest.slice(i + 1).trim() };
    }
  }
  return null;
}

/** Whether a condition holds on a first view. Unknowns are false: nothing is loaded, connected or open yet. */
function truthOf(e: string, ctx: Ctx, scope: Record<string, string>): boolean {
  let t = e.trim();
  while (t.startsWith("(") && balanced(t, 0, "(", ")") === t.slice(1, -1)) t = t.slice(1, -1).trim();
  if (!t) return false;
  const or = splitTop(t, "||");
  if (or.length > 1) return or.some((p) => truthOf(p, ctx, scope));
  const and = splitTop(t, "&&");
  if (and.length > 1) return and.every((p) => truthOf(p, ctx, scope));
  const nn = splitTop(t, "??");
  if (nn.length > 1) return nn.some((p) => truthOf(p, ctx, scope));
  if (t.startsWith("!")) return !truthOf(t.slice(1), ctx, scope);
  const cmp = t.match(/^([\s\S]+?)\s*(===|!==|==|!=)\s*([\s\S]+)$/);
  if (cmp) {
    const l = valueOf(cmp[1]!, ctx, scope);
    const r = valueOf(cmp[3]!, ctx, scope);
    if (l === null || r === null) return false;
    const same = l === r;
    return cmp[2]!.startsWith("!") ? !same : same;
  }
  const lit = literalOf(t);
  if (lit) return lit.truth;
  if (/^\w+$/.test(t)) return ctx.truth[t] ?? (scope[t] !== undefined ? scope[t] !== "" : false);
  const field = t.match(/^(\w+)\.(\w+)$/);
  if (field) return scope[t] !== undefined ? scope[t] !== "" : false;
  const len = t.match(/^(\w+)\.length\s*(>|>=)\s*(\d+)$/);
  if (len) return ctx.truth[len[1]!] ?? false;
  return false;
}

/** A literal or known value as text, for a comparison; null when it cannot be known here. */
function valueOf(e: string, ctx: Ctx, scope: Record<string, string>): string | null {
  const t = e.trim();
  const lit = literalOf(t);
  if (lit) return lit.text;
  if (/^\w+$/.test(t)) return ctx.vals[t] ?? scope[t] ?? null;
  const field = t.match(/^(\w+)\.(\w+)$/);
  if (field) return scope[t] ?? null;
  return null;
}

/** A branch of a ternary or the right side of `&&`: parenthesised markup, an element, or an expression. */
function valueToHtml(v: string, ctx: Ctx, file: string, scope: Record<string, string>, arrays: Map<string, Record<string, string>[]>): string {
  const t = v.trim();
  if (!t) return "";
  if (t.startsWith("(")) { const inner = balanced(t, 0, "(", ")"); if (inner !== null && inner.length === t.length - 2) return valueToHtml(inner, ctx, file, scope, arrays); }
  if (t.startsWith("<")) return jsxToHtml(t, ctx, file, scope, arrays);
  return exprToHtml(t, ctx, file, scope, arrays);
}

/** A class expression's text: a literal, a template, a ternary, or `cn(…)` of those. */
function classText(expr: string, ctx: Ctx, scope: Record<string, string>): string {
  const t = expr.trim();
  const lit = t.match(/^(?:"([^"]*)"|'([^']*)')$/);
  if (lit) return lit[1] ?? lit[2] ?? "";
  if (t.startsWith("`")) return t.slice(1, -1).replace(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_x, inner: string) => classText(inner, ctx, scope));
  const tern = splitTernary(t);
  if (tern) return classText(truthOf(tern.cond, ctx, scope) ? tern.a : tern.b, ctx, scope);
  const and = splitTop(t, "&&");
  if (and.length > 1) return and.slice(0, -1).every((p) => truthOf(p, ctx, scope)) ? classText(and[and.length - 1]!, ctx, scope) : "";
  const call = t.match(/^(?:cn|clsx|classNames|twMerge)\(([\s\S]*)\)$/);
  if (call) return splitTop(call[1]!, ",").map((a) => classText(a, ctx, scope)).filter(Boolean).join(" ");
  if (/^\w+$/.test(t) && scope[t] !== undefined) return scope[t]!;
  const field = t.match(/^(\w+)\.(\w+)$/);
  if (field && scope[t] !== undefined) return scope[t]!;
  ctx.notes.dropped++;
  return "";
}

/** The truth of each prop handed to a component, under the caller's first view. */
function propsTruth(attrsText: string, ctx: Ctx, scope: Record<string, string>): { truth: Record<string, boolean>; vals: Record<string, string> } {
  const truth: Record<string, boolean> = {};
  const vals: Record<string, string> = {};
  const re = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|\{((?:[^{}]|\{[^{}]*\})*)\}))?/g;
  for (const m of attrsText.matchAll(re)) {
    const name = m[1]!;
    if (m[2] !== undefined || m[3] !== undefined) { truth[name] = true; vals[name] = m[2] ?? m[3] ?? ""; continue; }
    if (m[4] !== undefined) { truth[name] = truthOf(m[4], ctx, scope); const v = valueOf(m[4], ctx, scope); if (v !== null) vals[name] = v; continue; }
    truth[name] = true;
  }
  return { truth, vals };
}

/** Whether a component's early outs fire on a first view: `if (!isOpen) return null`. */
function gatedOff(body: string | null, ctx: Ctx): boolean {
  if (!body) return false;
  for (const m of body.matchAll(/\bif\s*\(/g)) {
    const cond = balanced(body, m.index + m[0].length - 1, "(", ")");
    if (cond === null) continue;
    const after = body.slice(m.index + m[0].length + cond.length + 1).trimStart();
    if (!/^\{?\s*return\s*(?:null|<>\s*<\/>|""|'')\s*;?/.test(after)) continue;
    if (truthOf(cond, ctx, {})) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/* JSX to markup                                                        */
/* ------------------------------------------------------------------ */

const VOID_TAGS = new Set(["img", "br", "hr", "input", "source", "meta", "link"]);
/** A plain tag with no children. `<Link>` is a component, not `<link>`. */
const isVoid = (name: string): boolean => VOID_TAGS.has(name) && name === name.toLowerCase();

/** The icons a v0 site reaches for most, as their strokes (Lucide, ISC), so a chevron is a chevron and not a box. */
const ICONS: Record<string, string> = {
  X: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  ChevronDown: '<path d="m6 9 6 6 6-6"/>',
  ChevronUp: '<path d="m18 15-6-6-6 6"/>',
  ChevronRight: '<path d="m9 18 6-6-6-6"/>',
  ChevronLeft: '<path d="m15 18-6-6 6-6"/>',
  ArrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  ArrowLeft: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  ArrowUpRight: '<path d="M7 7h10v10"/><path d="M7 17 17 7"/>',
  ArrowUp: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  ArrowDown: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
  Check: '<path d="M20 6 9 17l-5-5"/>',
  CheckCircle: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  CircleCheck: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
  Menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
  Search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  Flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  Twitter: '<path d="M22 4s-.7 2.1-2 3.4c1.6 10-9.4 17.3-18 11.6 2.2.1 4.4-.6 6-2C3 15.5.5 9.6 3 5c2.2 2.6 5.6 4.1 9 4-.9-4.2 4-6.6 7-3.8 1.1 0 3-1.2 3-1.2z"/>',
  MessageCircle: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
  Mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
  ExternalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  Github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"/><path d="M9 18c-4.51 2-5-2-7-2"/>',
  Zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  Shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  ShieldCheck: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  Star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z"/>',
  Globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  Wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  Copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  Info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  AlertTriangle: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  TriangleAlert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  AlertCircle: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
  Loader2: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  Plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  Minus: '<path d="M5 12h14"/>',
  Sparkles: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>',
  Lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  Home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  TrendingUp: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
  RefreshCw: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  Trash2: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
  Settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  User: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  Users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  Clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  Calendar: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
  MapPin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  Phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  Send: '<path d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"/><path d="m21.854 2.147-10.94 10.939"/>',
  Play: '<polygon points="6 3 20 12 6 21 6 3"/>',
  Eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  Coins: '<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  Download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
  Upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
  Rocket: '<path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>',
  Activity: '<path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/>',
  Layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"/><path d="M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"/><path d="M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"/>',
  Code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  Terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
  Heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
  Instagram: '<rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" x2="17.51" y1="6.5" y2="6.5"/>',
  Youtube: '<path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17"/><path d="m10 15 5-3-5-3z"/>',
  Database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
  BarChart3: '<path d="M3 3v16a2 2 0 0 0 2 2h16"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  HelpCircle: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  CircleHelp: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  Filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
  Image: '<rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/>',
  Link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  Bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  Sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
  Moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
};
const LIB_TAGS: Record<string, string> = { Link: "a", Image: "img", Button: "button", Card: "div", CardContent: "div", CardHeader: "div", CardTitle: "h3", CardDescription: "p", Badge: "span", Separator: "hr", Input: "input", Label: "label" };

interface Ctx {
  files: Map<string, string>;
  have: Set<string>;
  theme: Record<string, string>;
  notes: SourceNotes;
  depth: number;
  publicNames: Set<string>;
  /** What each name in this file is on a first view: state at its initial value, props as handed in, anything fetched or connected false. */
  truth: Record<string, boolean>;
  /** The literal a piece of state starts as, for `activeTab === "tokens"`. */
  vals: Record<string, string>;
}

function attrsOf(head: string, ctx: Ctx, scope: Record<string, string> = {}): { html: string; className: string } {
  const out: string[] = [];
  let className = "";
  let style = "";
  const re = /([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|\{((?:[^{}]|\{[^{}]*\})*)\})|(\{\.\.\.[^}]*\})/g;
  for (const m of head.matchAll(re)) {
    if (m[5]) { ctx.notes.dropped++; continue; }
    const name = m[1]!;
    let value: string | null = m[2] ?? m[3] ?? null;
    if (value === null && m[4] !== undefined) {
      const expr = m[4].trim();
      const lit = expr.match(/^(?:"([^"]*)"|'([^']*)')$/);
      if (lit) value = lit[1] ?? lit[2] ?? "";
      else if (name === "className" || name === "class") { value = classText(expr, ctx, scope).replace(/\s+/g, " ").trim(); }
      else if (expr.startsWith("`")) value = expr.slice(1, -1).replace(/\$\{((?:[^{}]|\{[^{}]*\})*)\}/g, (_x, inner: string) => classText(inner, ctx, scope)).replace(/\s+/g, " ").trim();
      else if (/^\w+$/.test(expr) && scope[expr] !== undefined) value = scope[expr]!;
      else if (/^\w+\.\w+$/.test(expr) && scope[expr] !== undefined) value = scope[expr]!;
      else if (/^\w+$/.test(expr) && ctx.vals[expr] !== undefined) value = ctx.vals[expr]!;
      else if (name === "size" && /^\d+$/.test(expr)) value = expr;
      else if (name === "style") { value = expr.replace(/^\{|\}$/g, "").split(",").map((kv) => { const [k, v] = kv.split(/:(.+)/); if (!k || !v) return ""; const key = k.trim().replace(/[A-Z]/g, (ch) => `-${ch.toLowerCase()}`); const val = v.trim().match(/^(?:"([^"]*)"|'([^']*)'|(\d+))$/); return val ? `${key}:${val[1] ?? val[2] ?? val[3]}` : ""; }).filter(Boolean).join(";"); }
      else { ctx.notes.dropped++; continue; }
    }
    if (value === null) { if (!/^on[A-Z]/.test(name)) out.push(name); continue; }
    if (/^on[A-Z]/.test(name) || name === "key" || name === "ref") continue;
    if (name === "className" || name === "class") { className = value; continue; }
    if (name === "style") { style = value; continue; }
    if (name === "src" && value.startsWith("/") && !value.startsWith("//")) { const p = `public${value}`; if (ctx.publicNames.has(p)) ctx.notes.pictures.push(p); }
    out.push(`${name}="${value.replace(/"/g, "&quot;")}"`);
  }
  const tw = className ? twToStyle(className, ctx.theme) : "";
  const merged = [tw, style].filter(Boolean).join(";");
  if (merged) out.push(`style="${merged.replace(/"/g, "&quot;")}"`);
  if (className) out.push(`class="${className.replace(/"/g, "&quot;")}"`);
  return { html: out.join(" "), className };
}

/** The end of the element opened by `<tag …` at `at`; null when unbalanced. */
function elementEnd(text: string, at: number): number | null {
  let i = at;
  let depth = 0;
  while (i < text.length) {
    if (text.startsWith("{/*", i)) { const e = text.indexOf("*/}", i); if (e < 0) return null; i = e + 3; continue; }
    if (text[i] === "{") { const inner = balanced(text, i, "{", "}"); if (inner === null) return null; i += inner.length + 2; continue; }
    if (text[i] === "<") {
      if (text[i + 1] === "/") { depth--; const e = text.indexOf(">", i); if (e < 0) return null; i = e + 1; if (depth === 0) return i; continue; }
      const e = tagHeadEnd(text, i);
      if (e === null) return null;
      const selfClosing = text[e - 1] === "/";
      const nameM = text.slice(i + 1, e).match(/^([\w.:-]*)/);
      const name = nameM?.[1] ?? "";
      if (!selfClosing && !isVoid(name)) depth++;
      i = e + 1;
      if (depth === 0) return i;
      continue;
    }
    i++;
  }
  return null;
}

/** The index of the `>` closing an opening tag that starts at `at`, honouring strings and `{}`. */
function tagHeadEnd(text: string, at: number): number | null {
  let i = at + 1;
  while (i < text.length) {
    const c = text[i];
    if (c === '"' || c === "'") { const e = text.indexOf(c, i + 1); if (e < 0) return null; i = e + 1; continue; }
    if (c === "{") { const inner = balanced(text, i, "{", "}"); if (inner === null) return null; i += inner.length + 2; continue; }
    if (c === ">") return i;
    i++;
  }
  return null;
}

function escapeText(s: string): string {
  return s.replace(/&(?!\w+;)/g, "&amp;").replace(/</g, "&lt;");
}

/** One expression child, `{…}`, as markup or nothing. */
function exprToHtml(expr: string, ctx: Ctx, file: string, scope: Record<string, string>, arrays: Map<string, Record<string, string>[]>): string {
  const e = expr.trim();
  if (!e || e.startsWith("/*")) return "";
  const lit = e.match(/^(?:"([^"]*)"|'([^']*)')$/);
  if (lit) return escapeText(lit[1] ?? lit[2] ?? "");
  if (e.startsWith("`") && !e.includes("${")) return escapeText(e.slice(1, -1));
  if (/^new Date\(\)\.getFullYear\(\)$/.test(e)) return String(new Date().getFullYear());
  const field = e.match(/^(\w+)\.(\w+)$/);
  if (field && scope[`${field[1]}.${field[2]}`] !== undefined) return escapeText(scope[`${field[1]}.${field[2]}`]!);
  if (/^\w+$/.test(e) && scope[e] !== undefined) return escapeText(scope[e]!);
  /* `cond ? (A) : (B)`: the branch a first view shows. */
  const tern = splitTernary(e);
  if (tern && !/^\w+\.map\(/.test(e)) return valueToHtml(truthOf(tern.cond, ctx, scope) ? tern.a : tern.b, ctx, file, scope, arrays);
  /* `list.map((item) => (<…/>))` over a constant in this file. */
  const map = e.match(/^(\w+)\.map\(\s*\(?\s*(\w+)(?:\s*,\s*\w+)?\s*\)?\s*=>\s*([\s\S]*)\)\s*$/);
  if (map) {
    const items = arrays.get(map[1]!);
    if (!items) { ctx.notes.dropped++; return ""; }
    let body = map[3]!.trim();
    if (body.startsWith("(")) body = balanced(body, 0, "(", ")") ?? body;
    ctx.notes.unrolled++;
    return items.map((item) => {
      const inner: Record<string, string> = { ...scope };
      for (const [k, v] of Object.entries(item)) inner[`${map[2]}.${k}`] = v;
      return jsxToHtml(body, ctx, file, inner, arrays);
    }).join("");
  }
  /* `a && b && (<…/>)`: shown when every condition holds on a first view. */
  const and = splitTop(e, "&&");
  if (and.length > 1) {
    if (and.slice(0, -1).every((c) => truthOf(c, ctx, scope))) return valueToHtml(and[and.length - 1]!, ctx, file, scope, arrays);
    ctx.notes.dropped++;
    return "";
  }
  if (/^\w+$/.test(e) && ctx.vals[e] !== undefined) return escapeText(ctx.vals[e]!);
  ctx.notes.dropped++;
  return "";
}

/** JSX text to markup. */
export function jsxToHtml(jsx: string, ctx: Ctx, file: string, scope: Record<string, string> = {}, arrays: Map<string, Record<string, string>[]> = new Map()): string {
  let out = "";
  let i = 0;
  const text = jsx;
  while (i < text.length) {
    if (text.startsWith("{/*", i)) { const e = text.indexOf("*/}", i); i = e < 0 ? text.length : e + 3; continue; }
    if (text[i] === "{") {
      const inner = balanced(text, i, "{", "}");
      if (inner === null) break;
      out += exprToHtml(inner, ctx, file, scope, arrays);
      i += inner.length + 2;
      continue;
    }
    if (text[i] === "<") {
      if (text.startsWith("<>", i)) { const e = text.indexOf("</>", i); const inner = text.slice(i + 2, e < 0 ? text.length : e); out += jsxToHtml(inner, ctx, file, scope, arrays); i = e < 0 ? text.length : e + 3; continue; }
      const headEnd = tagHeadEnd(text, i);
      if (headEnd === null) break;
      const head = text.slice(i + 1, headEnd);
      const selfClosing = head.endsWith("/");
      const nameM = head.match(/^([\w.:-]+)/);
      const name = nameM?.[1] ?? "div";
      const attrsText = head.slice(name.length, selfClosing ? -1 : undefined);
      let end = headEnd + 1;
      let children = "";
      if (!selfClosing && !isVoid(name)) {
        const close = elementEnd(text, i);
        if (close === null) break;
        const closeTagAt = text.lastIndexOf("</", close);
        children = text.slice(headEnd + 1, closeTagAt);
        end = close;
      }
      out += elementToHtml(name, attrsText, children, ctx, file, scope, arrays);
      i = end;
      continue;
    }
    /* Text: runs of characters up to the next tag or expression, whitespace collapsed. */
    let j = i;
    while (j < text.length && text[j] !== "<" && text[j] !== "{") j++;
    const raw = text.slice(i, j).replace(/\s+/g, " ");
    if (raw.trim()) out += escapeText(raw);
    else if (raw) out += " ";
    i = j;
  }
  return out;
}

function elementToHtml(name: string, attrsText: string, children: string, ctx: Ctx, file: string, scope: Record<string, string>, arrays: Map<string, Record<string, string>[]>): string {
  const lower = name.toLowerCase();
  const isComponent = /^[A-Z]/.test(name);
  if (!isComponent) {
    const { html } = attrsOf(attrsText, ctx, scope);
    const tag = lower;
    if (VOID_TAGS.has(tag)) return `<${tag}${html ? ` ${html}` : ""}>`;
    return `<${tag}${html ? ` ${html}` : ""}>${jsxToHtml(children, ctx, file, scope, arrays)}</${tag}>`;
  }
  /* A component from this repository: opened in place, its children handed in. */
  const imports = importsOf(ctx.files.get(file) ?? "", file, ctx.have);
  const target = imports.get(name.split(".")[0]!);
  if (target && ctx.depth < 4) {
    const src = ctx.files.get(target.file);
    const jsx = src ? jsxOf(src, target.name) : null;
    if (jsx) {
      /* Its first view: its own state at its start, and its props as this call hands them in. */
      const own_state = stateOf(src ?? "");
      const props = propsTruth(attrsText, ctx, scope);
      const inner: Ctx = { ...ctx, depth: ctx.depth + 1, truth: { ...own_state.truth, ...props.truth }, vals: { ...own_state.vals, ...props.vals } };
      if (gatedOff(bodyOf(src ?? "", target.name), inner)) { ctx.notes.closed.push(name); return ""; }
      ctx.notes.opened.push(name);
      const childHtml = jsxToHtml(children, ctx, file, scope, arrays);
      const own = constArrays(src ?? "");
      const html = jsxToHtml(jsx, inner, target.file, { ...scope, children: "\u0000children\u0000" }, own);
      ctx.notes.opened.push(...inner.notes.opened.filter((n) => !ctx.notes.opened.includes(n)));
      return html.split("\u0000children\u0000").join(childHtml);
    }
  }
  /* A library part with a plain tag behind it. */
  if (LIB_TAGS[name]) {
    const { html } = attrsOf(attrsText, ctx, scope);
    const tag = LIB_TAGS[name]!;
    if (VOID_TAGS.has(tag)) return `<${tag}${html ? ` ${html}` : ""}>`;
    return `<${tag}${html ? ` ${html}` : ""}>${jsxToHtml(children, ctx, file, scope, arrays)}</${tag}>`;
  }
  /* An icon, most likely: drawn when it is one this knows, else a small mark in the current colour, sized by its class. */
  const { className, html: attrHtml } = attrsOf(attrsText, ctx, scope);
  const size = className.match(/\b(?:w|h|size)-(\d+)\b/);
  const sizeAttr = attrHtml.match(/\bsize="(\d+)"/);
  const px = sizeAttr ? Number(sizeAttr[1]) : size ? Number(size[1]) * 4 : 16;
  const iconStyle = twToStyle(className.replace(/\b(?:w|h|size)-\d+\b/g, ""), ctx.theme);
  if (!children.trim()) {
    const known = ICONS[name] ?? ICONS[name.replace(/Icon$/, "")];
    if (known) ctx.notes.icons.push(name); else ctx.notes.unknown.push(name);
    return `<svg data-icon="${name}" width="${px}" height="${px}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;flex-shrink:0;${iconStyle}">${known ?? '<rect x="4" y="4" width="16" height="16" rx="3"/>'}</svg>`;
  }
  ctx.notes.unknown.push(name);
  return `<div data-component="${name}"${iconStyle ? ` style="${iconStyle}"` : ""}>${jsxToHtml(children, ctx, file, scope, arrays)}</div>`;
}

/* ------------------------------------------------------------------ */
/* The page                                                             */
/* ------------------------------------------------------------------ */

/**
 * The page, as plain markup, banded as the source is banded: each child
 * of the page's root element is one band, marked so the reader lands it
 * as one block.
 */
export function readSource(files: readonly SourceFile[], publicNames: readonly string[]): SourcePage | null {
  const map = new Map(files.map((f) => [f.path, f.text]));
  const have = new Set(map.keys());
  const entry = findPage([...have]);
  if (!entry) return null;
  const css = map.get("app/globals.css") ?? map.get("src/app/globals.css") ?? map.get("styles/globals.css") ?? "";
  const theme = themeOf(css);
  const notes: SourceNotes = { opened: [], unknown: [], dropped: 0, unrolled: 0, bands: [], pictures: [], icons: [], closed: [] };
  const page = map.get(entry)!;
  const first = stateOf(page);
  const ctx: Ctx = { files: map, have, theme, notes, depth: 0, publicNames: new Set(publicNames), truth: first.truth, vals: first.vals };
  const jsx = jsxOf(page, "default");
  if (!jsx) return null;
  const arrays = constArrays(page);

  /* The root element's children are the bands. */
  let bandsHtml = "";
  const headEnd = tagHeadEnd(jsx, 0);
  const rootEnd = headEnd !== null ? elementEnd(jsx, 0) : null;
  const rootHead = headEnd !== null ? jsx.slice(1, headEnd) : "";
  const rootName = (rootHead.match(/^([\w.:-]+)/)?.[1] ?? "div").toLowerCase();
  const rootAttrs = attrsOf(rootHead.slice(rootName.length), ctx).html;
  const inner = headEnd !== null && rootEnd !== null ? jsx.slice(headEnd + 1, jsx.lastIndexOf("</", rootEnd)) : jsx;
  /* Walk the root's direct children; each element becomes a band. */
  let i = 0;
  let n = 0;
  while (i < inner.length) {
    if (inner.startsWith("{/*", i)) { const e = inner.indexOf("*/}", i); i = e < 0 ? inner.length : e + 3; continue; }
    if (inner[i] === "{") {
      const ex = balanced(inner, i, "{", "}");
      if (ex === null) break;
      const html = exprToHtml(ex, ctx, entry, {}, arrays);
      if (html.trim()) { n++; notes.bands.push("expression"); bandsHtml += `<div data-band="${n}">${html}</div>`; }
      i += ex.length + 2;
      continue;
    }
    if (inner[i] === "<") {
      const end = elementEnd(inner, i);
      if (end === null) break;
      const piece = inner.slice(i, end);
      const tag = (piece.match(/^<([\w.:-]+)/)?.[1] ?? "div");
      const html = jsxToHtml(piece, ctx, entry, {}, arrays);
      if (html.trim()) {
        n++;
        notes.bands.push(tag);
        /* The band mark goes on the element itself when it is a plain tag. */
        bandsHtml += html.replace(/^<([\w-]+)/, `<$1 data-band="${n}"`);
      }
      i = end;
      continue;
    }
    i++;
  }
  const bg = theme.background ?? "#ffffff";
  const fg = theme.foreground ?? "#111111";
  const font = theme["font-sans"] ?? "system-ui, sans-serif";
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Read from source</title><style>
html,body{margin:0;padding:0}body{background:${bg};color:${fg};font-family:${font};-webkit-font-smoothing:antialiased}
*,*::before,*::after{box-sizing:border-box}img{max-width:100%;display:block}a{color:inherit;text-decoration:none}button{font:inherit;color:inherit;background:none;border:0;padding:0}
h1,h2,h3,h4,p{margin:0}svg{display:inline-block;vertical-align:middle}
</style></head><body><${rootName === "main" || rootName === "div" ? rootName : "div"} data-source-root="${entry}"${rootAttrs ? ` ${rootAttrs}` : ""}>${bandsHtml}</${rootName === "main" || rootName === "div" ? rootName : "div"}></body></html>`;
  notes.pictures = [...new Set(notes.pictures)];
  notes.icons = [...new Set(notes.icons)];
  notes.unknown = [...new Set(notes.unknown)];
  return { entry, html, notes };
}
