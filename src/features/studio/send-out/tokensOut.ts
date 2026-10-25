/**
 * THE SYSTEM AS FILES (create-system "(d) Export", "Tokens as files").
 *
 * A site's System (`system/model.ts`) written as the four token files every
 * export carries, whichever way the code is written (exact look or clean):
 *
 *   · `tokens/tokens.json`: the W3C Design Tokens format (the 2025.10 stable
 *     report: colours as colour-space objects, sizes as `{ value, unit }`),
 *     which design tools read. Each token also keeps its System id and its
 *     exact CSS under `$extensions["app.polio"]`, so reading the file back
 *     (`../tokensJson.ts`) gives the very value the board draws;
 *   · `tokens/tokens.css`: one CSS variable per token, `--colour-accent`,
 *     `--space-4`, `--radius-small`, `--shadow-low`, `--text-heading-1`,
 *     `--font-dm-mono`, `--duration-quick`, `--ease-1`;
 *   · `tokens/tailwind.css`: a Tailwind v4 `@theme inline` block naming the
 *     same variables, so `bg-accent`, `p-space-4`, `rounded-small`,
 *     `shadow-low`, `text-heading-1` and `font-dm-mono` exist. It points at
 *     the variables rather than copying values, so tokens.css stays the one
 *     place a value lives. Spaces are `space-N` so Tailwind's own `p-4` keeps
 *     meaning 1rem;
 *   · `tokens/tokens.ts`: the same values as a typed object.
 *
 * Every file says it is Polio's: it is written again on each export (tokens
 * always are, `exportSync.ts`), so a colour changed in the Builder reaches the
 * code without touching a page.
 *
 * `tokenNames` is the one place a token's CSS and Tailwind names are made;
 * the library and the pages ask it, so a class always names a real token.
 *
 * Pure: no React, no store, every import ends in .ts, so node tests load it.
 */
import { allTokens, valueOf, type System, type TokenKind, type ColourToken, type SizeToken, type CssToken, type FaceToken } from "../system/model.ts";

/** The header line on every file Polio owns: the sync reads it (`exportSync.ts`). */
export const POLIO_HEADER = "Made by Polio. Edits here are replaced on the next export.";

export const TOKENS_DIR = "tokens";
export const TOKEN_FILES = {
  json: `${TOKENS_DIR}/tokens.json`,
  css: `${TOKENS_DIR}/tokens.css`,
  tailwind: `${TOKENS_DIR}/tailwind.css`,
  ts: `${TOKENS_DIR}/tokens.ts`,
} as const;

/** Each kind's CSS variable prefix, its tokens.json group, and its Tailwind theme namespace (null: Tailwind has none). */
export const KIND_OUT: Record<TokenKind, { css: string; group: string; tw: string | null; word: RegExp }> = {
  colour: { css: "colour", group: "colour", tw: "color", word: /^colou?r-/ },
  type: { css: "text", group: "type", tw: "text", word: /^(text|size)-/ },
  face: { css: "font", group: "font", tw: "font", word: /^(font|face)-/ },
  space: { css: "space", group: "space", tw: "spacing", word: /^space-/ },
  radius: { css: "radius", group: "radius", tw: "radius", word: /^(radius|corner)-/ },
  shadow: { css: "shadow", group: "shadow", tw: "shadow", word: /^shadow-/ },
  duration: { css: "duration", group: "duration", tw: null, word: /^(duration|speed)-/ },
  easing: { css: "ease", group: "easing", tw: "ease", word: /^(easing|ease)-/ },
};

/** A token's names in the files: its key in its group, its CSS variable, and the Tailwind word after the utility (`accent` in `bg-accent`), or null. */
export interface TokenName { id: string; kind: TokenKind; key: string; css: string; tw: string | null }

/** A name a person wrote ("Words, light grey"), as a key: lower case, words joined by "-". */
export function slug(name: string): string {
  const s = name.normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return s || "token";
}

/**
 * Every token's names, unique within its kind ("Words" and "Words!" are
 * `words` and `words-2`), the kind's own word taken off the front where
 * something is left ("Space 4" is `--space-4`, not `--space-space-4`).
 * Spaces are `space-N` in Tailwind so its own numeric scale stays as it is.
 */
export function tokenNames(system: System): Map<string, TokenName> {
  const out = new Map<string, TokenName>();
  const used: Record<string, Set<string>> = {};
  for (const { kind, token } of allTokens(system)) {
    const k = KIND_OUT[kind];
    let key = slug(token.name);
    if (k.word.test(key) && key.replace(k.word, "")) key = key.replace(k.word, "");
    const seen = (used[kind] ??= new Set());
    let unique = key;
    for (let i = 2; seen.has(unique); i++) unique = `${key}-${i}`;
    seen.add(unique);
    out.set(token.id, { id: token.id, kind, key: unique, css: `--${k.css}-${unique}`, tw: k.tw ? (kind === "space" ? `space-${unique}` : unique) : null });
  }
  return out;
}

/** A token's value as CSS: px for sizes, the text as written for the rest. */
export function tokenCss(kind: TokenKind, token: ColourToken | SizeToken | CssToken | FaceToken): string {
  const v = valueOf(token);
  return typeof v === "number" ? `${num(v)}px` : v;
}

const num = (n: number) => String(Math.round(n * 1000) / 1000);

/* ------------------------------------------------------------------ */
/* CSS to W3C values                                                   */
/* ------------------------------------------------------------------ */

export type W3cColour = { colorSpace: "srgb" | "oklch"; components: number[]; alpha?: number; hex?: string };
export type W3cDimension = { value: number; unit: "px" | "rem" };
export type W3cDuration = { value: number; unit: "ms" | "s" };
export type W3cShadow = { color: W3cColour; offsetX: W3cDimension; offsetY: W3cDimension; blur: W3cDimension; spread: W3cDimension; inset?: boolean };

const NAMED: Record<string, [number, number, number, number]> = {
  transparent: [0, 0, 0, 0], black: [0, 0, 0, 1], white: [255, 255, 255, 1], red: [255, 0, 0, 1], green: [0, 128, 0, 1], blue: [0, 0, 255, 1],
  gray: [128, 128, 128, 1], grey: [128, 128, 128, 1], silver: [192, 192, 192, 1], yellow: [255, 255, 0, 1], orange: [255, 165, 0, 1],
};
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const hex2 = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0");

function srgb(r: number, g: number, b: number, a: number): W3cColour {
  return { colorSpace: "srgb", components: [r4(r / 255), r4(g / 255), r4(b / 255)], ...(a < 1 ? { alpha: r4(a) } : {}), hex: `#${hex2(r)}${hex2(g)}${hex2(b)}` };
}
const part = (s: string, pct = 255) => (s.endsWith("%") ? (parseFloat(s) / 100) * pct : parseFloat(s));

/** A CSS colour as the W3C colour object, or null for one this does not read (a `color-mix`, a `var`). */
export function cssColour(css: string): W3cColour | null {
  const s = css.trim().toLowerCase();
  if (NAMED[s]) return srgb(...NAMED[s]);
  let m = /^#([0-9a-f]{3,8})$/.exec(s);
  if (m) {
    const h = m[1]!;
    const full = h.length <= 4 ? h.split("").map((c) => c + c).join("") : h;
    if (full.length !== 6 && full.length !== 8) return null;
    const n = (i: number) => parseInt(full.slice(i, i + 2), 16);
    return srgb(n(0), n(2), n(4), full.length === 8 ? n(6) / 255 : 1);
  }
  m = /^rgba?\((.*)\)$/.exec(s);
  if (m) {
    const bits = m[1]!.replace(/\//g, " ").split(/[\s,]+/).filter(Boolean);
    if (bits.length < 3 || bits.slice(0, 3).some((b) => Number.isNaN(parseFloat(b)))) return null;
    return srgb(part(bits[0]!), part(bits[1]!), part(bits[2]!), bits[3] !== undefined ? part(bits[3], 1) : 1);
  }
  m = /^oklch\((.*)\)$/.exec(s);
  if (m) {
    const bits = m[1]!.replace(/\//g, " ").split(/\s+/).filter(Boolean);
    if (bits.length < 3) return null;
    const l = part(bits[0]!, 1), c = parseFloat(bits[1]!), h = parseFloat(bits[2]!);
    if ([l, c, h].some(Number.isNaN)) return null;
    const a = bits[3] !== undefined ? part(bits[3], 1) : 1;
    return { colorSpace: "oklch", components: [r4(l), r4(c), r4(h)], ...(a < 1 ? { alpha: r4(a) } : {}) };
  }
  return null;
}

/** The W3C colour back as CSS: `rgb(…)`/`rgba(…)` with 0–255 channels as captured pages write them, or `oklch(…)`. */
export function colourCss(c: W3cColour): string {
  const a = c.alpha ?? 1;
  if (c.colorSpace === "oklch") return `oklch(${num(c.components[0]!)} ${num(c.components[1]!)} ${num(c.components[2]!)}${a < 1 ? ` / ${num(a)}` : ""})`;
  const [r, g, b] = c.components.map((x) => Math.round(x * 255));
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${num(a)})` : `rgb(${r}, ${g}, ${b})`;
}

/** Splits at commas outside brackets. */
export function topLevel(css: string, by = ","): string[] {
  const out: string[] = [];
  let depth = 0, at = 0;
  for (let i = 0; i < css.length; i++) {
    const c = css[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (depth === 0 && (by === " " ? /\s/.test(c!) : c === by)) { out.push(css.slice(at, i)); at = i + 1; }
  }
  out.push(css.slice(at));
  return out.map((s) => s.trim()).filter(Boolean);
}

const LEN = /^(-?\d*\.?\d+)(px)?$/;
/** A CSS box shadow as W3C shadow layers, or null for one this does not read (ems, a `var`). */
export function cssShadow(css: string): W3cShadow[] | null {
  if (css.trim() === "none") return [];
  const layers: W3cShadow[] = [];
  for (const layer of topLevel(css)) {
    const bits = topLevel(layer, " ");
    let inset = false, colour: W3cColour | null = null;
    const lens: number[] = [];
    for (const b of bits) {
      if (b === "inset") { inset = true; continue; }
      const l = LEN.exec(b);
      if (l && (l[2] || parseFloat(l[1]!) === 0)) { lens.push(parseFloat(l[1]!)); continue; }
      const c = cssColour(b);
      if (!c || colour) return null;
      colour = c;
    }
    if (lens.length < 2 || lens.length > 4) return null;
    const px = (v = 0): W3cDimension => ({ value: v, unit: "px" });
    layers.push({ color: colour ?? srgb(0, 0, 0, 1), offsetX: px(lens[0]), offsetY: px(lens[1]), blur: px(lens[2]), spread: px(lens[3]), ...(inset ? { inset } : {}) });
  }
  return layers;
}

export function shadowCss(layers: W3cShadow[]): string {
  if (!layers.length) return "none";
  const px = (d: W3cDimension) => (d.value === 0 ? "0px" : `${num(d.value)}${d.unit}`);
  return layers.map((l) => `${colourCss(l.color)} ${px(l.offsetX)} ${px(l.offsetY)} ${px(l.blur)} ${px(l.spread)}${l.inset ? " inset" : ""}`).join(", ");
}

/** A CSS duration (`0.3s`, `150ms`) as W3C, in ms. */
export function cssDuration(css: string): W3cDuration | null {
  const m = /^(\d*\.?\d+)(ms|s)$/.exec(css.trim());
  return m ? { value: r4(parseFloat(m[1]!) * (m[2] === "s" ? 1000 : 1)), unit: "ms" } : null;
}
export const durationCss = (d: W3cDuration) => (d.unit === "s" ? `${num(d.value)}s` : `${num(d.value)}ms`);

const EASE: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1], ease: [0.25, 0.1, 0.25, 1], "ease-in": [0.42, 0, 1, 1], "ease-out": [0, 0, 0.58, 1], "ease-in-out": [0.42, 0, 0.58, 1],
};
/** A CSS easing as the W3C four numbers, or null for `steps()` and the like. */
export function cssEasing(css: string): [number, number, number, number] | null {
  const s = css.trim();
  if (EASE[s]) return EASE[s];
  const m = /^cubic-bezier\(([^)]*)\)$/.exec(s);
  if (!m) return null;
  const n = m[1]!.split(",").map((x) => parseFloat(x));
  return n.length === 4 && n.every((x) => Number.isFinite(x)) ? (n as [number, number, number, number]) : null;
}
export const easingCss = (b: number[]) => `cubic-bezier(${b.map(num).join(", ")})`;

/** A font stack as the W3C list of names, quotes off. */
export function cssFaces(stack: string): string[] {
  return topLevel(stack).map((f) => f.replace(/^["']|["']$/g, ""));
}
export const facesCss = (names: string[]) => names.map((n) => (/^[a-z-]+$/i.test(n) ? n : `"${n}"`)).join(", ");

/* ------------------------------------------------------------------ */
/* The four files                                                      */
/* ------------------------------------------------------------------ */

const W3C_TYPE: Record<TokenKind, string> = { colour: "color", type: "dimension", face: "fontFamily", space: "dimension", radius: "dimension", shadow: "shadow", duration: "duration", easing: "cubicBezier" };

/** A token as W3C: its `$type` and `$value`, or the CSS text where the value is one the format has no shape for (kept, never dropped). */
export function w3cValue(kind: TokenKind, css: string): { $type: string; $value: unknown } {
  const t = W3C_TYPE[kind];
  const v: unknown =
    kind === "colour" ? cssColour(css)
      : kind === "type" || kind === "space" || kind === "radius" ? (LEN.test(css) ? { value: parseFloat(css), unit: "px" } : null)
        : kind === "face" ? cssFaces(css)
          : kind === "shadow" ? cssShadow(css)
            : kind === "duration" ? cssDuration(css)
              : cssEasing(css);
  return v === null ? { $type: t, $value: css } : { $type: t, $value: v };
}

export interface TokenFile { path: string; content: string }

export function tokensJson(system: System, names = tokenNames(system)): string {
  const doc: Record<string, unknown> = {
    $description: `${POLIO_HEADER} The design tokens of "${system.name}", in the W3C Design Tokens format. Each token's exact CSS and its id in the Polio System are under $extensions["app.polio"].`,
  };
  for (const { kind, token } of allTokens(system)) {
    const n = names.get(token.id)!;
    const group = (doc[KIND_OUT[kind].group] ??= {}) as Record<string, unknown>;
    const css = tokenCss(kind, token);
    const ext: Record<string, unknown> = { id: token.id, name: token.name, css };
    if ("role" in token && token.role) ext.role = token.role;
    if ("use" in token && token.use) ext.use = token.use;
    group[n.key] = { ...w3cValue(kind, css), ...("use" in token && token.use ? { $description: token.use } : {}), $extensions: { "app.polio": ext } };
  }
  if (system.tokens.type.scale) doc.$extensions = { "app.polio": { system: system.id, rev: system.rev, typeScale: system.tokens.type.scale } };
  else doc.$extensions = { "app.polio": { system: system.id, rev: system.rev } };
  return `${JSON.stringify(doc, null, 2)}\n`;
}

const cssComment = (s: string) => s.replace(/\*\//g, "* /");

export function tokensCssFile(system: System, names = tokenNames(system)): string {
  const lines: string[] = [];
  let kindWas: TokenKind | null = null;
  for (const { kind, token } of allTokens(system)) {
    if (kind !== kindWas) { if (kindWas) lines.push(""); lines.push(`  /* ${KIND_OUT[kind].group} */`); kindWas = kind; }
    lines.push(`  ${names.get(token.id)!.css}: ${tokenCss(kind, token)};${token.name !== names.get(token.id)!.key ? ` /* ${cssComment(token.name)} */` : ""}`);
  }
  return `/* ${POLIO_HEADER}
 * The design tokens of ${cssComment(JSON.stringify(system.name))}, one variable each. Change a value in the
 * Builder's System tab and export again; this file is always written again.
 */
:root {
${lines.join("\n")}
}
`;
}

export function tailwindCss(system: System, names = tokenNames(system)): string {
  const lines: string[] = [];
  for (const { kind, token } of allTokens(system)) {
    const n = names.get(token.id)!;
    if (!n.tw) continue;
    lines.push(`  --${KIND_OUT[kind].tw}-${n.tw}: var(${n.css});`);
  }
  return `/* ${POLIO_HEADER}
 * Tailwind v4 theme from tokens.css: bg-accent, text-heading-1, p-space-4,
 * rounded-small, shadow-low, font-dm-mono. Import after "tailwindcss" and
 * tokens.css. Durations have no Tailwind namespace: duration-(--duration-quick).
 */
@theme inline {
${lines.join("\n")}
}
`;
}

const tsKey = (k: string) => (/^[a-z_$][a-z0-9_$]*$/i.test(k) ? k : JSON.stringify(k));

export function tokensTs(system: System, names = tokenNames(system)): string {
  const groups = new Map<string, string[]>();
  const vars: string[] = [];
  for (const { kind, token } of allTokens(system)) {
    const n = names.get(token.id)!;
    const g = KIND_OUT[kind].group;
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g)!.push(`    ${tsKey(n.key)}: ${JSON.stringify(tokenCss(kind, token))},`);
    vars.push(`  ${JSON.stringify(token.id)}: ${JSON.stringify(n.css)},`);
  }
  const body = [...groups].map(([g, ls]) => `  ${tsKey(g)}: {\n${ls.join("\n")}\n  },`).join("\n");
  return `/* ${POLIO_HEADER}
 * The design tokens as values, for code that needs a number or a colour
 * rather than a class. tokens.css holds the same, as CSS variables.
 */
export const tokens = {
${body}
} as const;

export type Tokens = typeof tokens;

/** Each token's CSS variable, by its id in the Polio System. */
export const tokenVar = {
${vars.join("\n")}
} as const;
`;
}

/** The four token files of a System. */
export function tokensOut(system: System): TokenFile[] {
  const names = tokenNames(system);
  return [
    { path: TOKEN_FILES.json, content: tokensJson(system, names) },
    { path: TOKEN_FILES.css, content: tokensCssFile(system, names) },
    { path: TOKEN_FILES.tailwind, content: tailwindCss(system, names) },
    { path: TOKEN_FILES.ts, content: tokensTs(system, names) },
  ];
}
