/**
 * THE DESIGN, SENT BACK AS A STYLE LAYER FOR THE CODE IT CAME FROM.
 *
 * The owner's ruling: a site that came from a code repository (PonsStars,
 * sparkygogo77-spec/PST: plain HTML driven by scripts that find every
 * element by its `data-hook`) is redesigned on the board, and the design
 * goes back to that repository as a layer over its existing code — never as
 * a fresh page, which would drop its scripts and everything they do.
 *
 * So the export is CSS keyed by the names the code already uses:
 * `[data-hook="balance-note"]`, `#refresh`. For each part that kept a hook,
 * only what the owner changed is written (its colours, type, spacing, edges,
 * shadow, rounding, and its size and offset where he moved or resized it):
 * a part he left alone writes nothing, so the page stays exactly as its own
 * code draws it. A CSS variable the source defines (PST's `--pons-candle-up`
 * and the rest, listed in its web/HOOKS.md) is set when he set it, or when
 * every part that wore its colour now wears another. Words are changed only
 * where the source has them as plain text in the HTML and nothing writes
 * them at run time, and only where they appear once. Nothing else is
 * touched: no script, no behaviour, no markup but one `<link>` per page,
 * and no rule that can hide anything (`display`, `visibility`, `content`).
 *
 * THE HOOK CHECK says, before anything is written, what becomes of each hook
 * the source carries: covered (the layer styles it), untouched (on the
 * board, nothing changed), or missing (its part was deleted, or renamed on
 * the board: the layer keeps the source's name). It warns in words; it never
 * drops a hook quietly.
 *
 * Pure: no store, no browser, no React. `tests/style-layer.mjs` holds it.
 */
import type { SourceHook, SourceVar } from "./sourceHooks.ts";

/** A part's look in the terms CSS writes it in. Every field optional: absent is "the page's own". */
export interface CssLook {
  color?: string;
  background?: string;
  borderWidth?: number;
  borderStyle?: string;
  borderColor?: string;
  shadow?: string;
  radius?: number;
  pad?: [number, number, number, number];
  fontSize?: number;
  fontWeight?: number;
  fontFamily?: string;
  /** As a multiple of the size. */
  lineHeight?: number;
  letterSpacing?: number;
  opacity?: number;
  align?: string;
  transform?: string;
  /** What else it wears, by CSS property, as written (`artCss`): a gradient or pattern, a mask, a turn and its point, filters, blend, clip, uneven corners, glowing or outlined type, its animation and easing. */
  art?: Record<string, string>;
  /** Its own hover, press and focus, by state (`hover`, `active`, `focus-visible`…): the declarations, as written (`statesCss`). */
  states?: Record<string, string>;
  box: { x: number; y: number; w: number; h: number };
  words: string;
}

/** Where a part sits in its source, and how it looked as it was brought in. */
export interface NodeSource {
  file: string;
  line?: number;
  /** The hook the code finds it by, as the source wrote it. Null: it has none. */
  hook?: { attr: "data-hook" | "id"; value: string } | null;
  /** True when its words are plain text in the HTML that nothing writes at run time. */
  staticWords?: boolean;
  was: CssLook;
  /** All the code tied to it, read only (`codeRefs.ts`): its markup, the CSS rules that style it, and every script that touches it. */
  code?: PartCode | null;
  /** A shape inside an inline svg (a circle, a path): its fill and stroke are what the layer writes, never a box's background or edge. */
  svg?: boolean;
  /** The ::before or ::after of the element it was read from (PST's antenna balls): it has no hook of its own. */
  pseudo?: "::before" | "::after";
  /** Look from capture: what it wears that no field of the builder's sets yet, drawn as the page computed it (`pageParts.ts#lookFromCapture`). */
  look?: string[];
  /** Hooks on elements inside it that are not parts of their own (a list's options): carried by this part. */
  inner?: { attr: "data-hook" | "id"; value: string }[];
}

/** A box's declarations as an svg shape's: fill for the ground, stroke for the edge; what a shape has no use for (padding, rounding, a box's place) is left out. */
export function svgDeclarations(decl: string[]): string[] {
  const out: string[] = [];
  for (const d of decl) {
    const [prop, ...rest] = d.split(":");
    const v = rest.join(":").trim();
    if (prop === "background-color") out.push(`fill: ${v === "transparent" ? "none" : v}`);
    else if (prop === "border") {
      const m = /^([\d.]+)px\s+\w+\s*(.*)$/.exec(v);
      if (v === "none" || !m) out.push("stroke: none");
      else { out.push(`stroke-width: ${m[1]}`); if (m[2]) out.push(`stroke: ${m[2]}`); }
    }
    else if (/^(opacity|color|font-size|font-weight|font-family|letter-spacing)$/.test(prop!)) out.push(d);
  }
  return out;
}

/** A part's ties to its code, for the part panel's code view. */
export interface PartCode {
  markup: { file: string; line?: number } | null;
  css: { file: string; line: number; selector: string }[];
  refs: import("./codeRefs.ts").CodeRef[];
  /** Filled by code at run time: the first place that builds or writes it. */
  built: import("./codeRefs.ts").CodeRef | null;
  /** Where the references came from: the repository's hooks.json, or a reading of its scripts. */
  from: "hooks.json" | "scan" | "none";
  /** Made by a script from a template rather than written in the HTML (hooks.json `scriptBuilt`), and which template, and whether it repeats (a row per item). */
  scriptBuilt?: boolean;
  template?: string | null;
  repeats?: boolean;
  /** The CSS variables its styles use (hooks.json). */
  vars?: string[];
}

/** What a brought-in site's code is written against (`look.styleSource`). */
export interface StyleSource {
  /** The repository and branch it was read from, and the folder its pages are in. */
  repo: string;
  ref: string;
  dir: string;
  files: { file: string; pageId: string; hooks: (SourceHook & { imported: boolean })[]; vars: SourceVar[] }[];
  /** Variables the owner set by hand, by name. */
  varsSet?: Record<string, string>;
  /** What the repository was when last read (`kitRun.ts`): the baseline each design round is compared with. */
  seen?: import("./kitRun.ts").KitSeen;
  /** Its `builder.json`, when it is builder-ready: the design then goes back by the kit's contract. */
  kit?: import("./kitRun.ts").KitManifest | null;
  /** Where the layer is written, when the repository says (builder.json); else `<dir>style-layer.css`. */
  layerFile?: string | null;
  /** The design-tokens file the repository names or keeps (`tokens.css`). */
  tokensFile?: string | null;
  /** What the repository's hooks.json says reads each variable. */
  varsRead?: Record<string, import("./codeRefs.ts").CodeRef[]>;
  /** The repository's builder.json, when it has one: what was read from it. */
  manifest?: { file: string; kit?: string | null; previews?: string[]; gallery?: string | null } | null;
  /** Every data-hook on the board as it was brought in (`designBranch.ts#hooksOnBoard`): what Export for code to a branch keeps, and says the changes against. */
  onBoard?: string[];
  /** Its preview screens, read at import as its code builds them: the States control shows one on the board (`boardStates.ts`). */
  screens?: import("./boardStates.ts").ScreenRead[];
}

/**
 * A PART'S SCRIPT SETTINGS: the tokens it uses, for the part panel. The
 * variables its own styles use (hooks.json `vars`), and every token a script
 * reads in a function that also uses this part (`varsRead`, by file and
 * function): the numbers, colours and words the code takes from tokens.css or
 * tokens.js. Each is edited as the style layer edits a token (`varsSet`), so
 * it goes back with Send the design back as a token change, never as code.
 */
export function partTokens(code: { refs: { file: string; fn: string | null }[]; vars?: string[] } | null | undefined, source: Pick<StyleSource, "files" | "varsRead">): { name: string; value: string; file: string; line: number; token?: boolean; why: "styles" | "script" }[] {
  if (!code) return [];
  const known = new Map<string, { name: string; value: string; file: string; line: number; token?: boolean }>();
  for (const f of source.files) for (const v of f.vars) if (!known.has(v.name) || (v.token && !known.get(v.name)!.token)) known.set(v.name, v);
  const here = new Set(code.refs.filter((r) => r.fn).map((r) => `${r.file}#${r.fn}`));
  const out = new Map<string, { name: string; value: string; file: string; line: number; token?: boolean; why: "styles" | "script" }>();
  for (const name of code.vars ?? []) { const v = known.get(name); if (v) out.set(name, { ...v, why: "styles" }); }
  for (const [name, by] of Object.entries(source.varsRead ?? {})) {
    const v = known.get(name);
    if (v && !out.has(name) && by.some((r) => r.fn && here.has(`${r.file}#${r.fn}`))) out.set(name, { ...v, why: "script" });
  }
  return [...out.values()];
}

/**
 * The slots builder.json lists for a part (BUILDER-RULES.md rule 4): settings its code asked the
 * builder to learn, each a token, shown by label first in the part's Settings, with what the code
 * found for it besides.
 */
export function partSlots(hook: string, source: Pick<StyleSource, "files" | "kit">): { name: string; value: string; file: string; line: number; token?: boolean; why: "slot"; label: string; kind?: string; options?: string[]; about?: string }[] {
  const slots = (source.kit?.rules?.slots ?? []).filter((s) => s && s.hook === hook && typeof s.token === "string");
  if (!slots.length) return [];
  const known = new Map<string, { name: string; value: string; file: string; line: number; token?: boolean }>();
  for (const f of source.files) for (const v of f.vars) if (!known.has(v.name) || (v.token && !known.get(v.name)!.token)) known.set(v.name, v);
  return slots.flatMap((s) => {
    const v = known.get(s.token);
    return v ? [{ ...v, why: "slot" as const, label: s.label || s.token, kind: s.kind, options: s.options, about: s.why }] : [];
  });
}

/** The shape of a node this reads: a board part, loosely. */
export interface LayerNode {
  id: string;
  pageId: string;
  featureId: string;
  x: number; y: number; w: number; h: number;
  content?: unknown;
  colour?: Record<string, string | undefined> | null;
  font?: { size?: number; px?: number; weight?: number; stack?: string; face?: string; family?: string; leading?: number; spacing?: number } | null;
  pad?: { top?: number; right?: number; bottom?: number; left?: number } | null;
  edge?: { width?: number; style?: string; colour?: string; shadow?: string } | null;
  radius?: number | null;
  opacity?: number | null;
  text?: { align?: string; transform?: string } | null;
  art?: { background?: string; backgroundOptions?: string[]; backgroundClip?: string; mask?: string; maskOptions?: string[]; transform?: string; origin?: string; filter?: string; backdrop?: string; blend?: string; clipPath?: string; textShadow?: string; textStroke?: { w: number; color: string }; paintOrder?: string } | null;
  radii?: readonly number[] | null;
  radiiY?: readonly number[] | null;
  motion?: { animation?: { name: string; duration?: string; timing?: string; delay?: string; iterations?: string; direction?: string; fill?: string }[]; transition?: { property: string; duration?: string; timing?: string; delay?: string }[]; hover?: LayerState[]; active?: LayerState[]; focus?: LayerState[] } | null;
  hooks?: Record<string, string> | null;
  state?: unknown;
  from?: { selector?: string } | null;
  source?: NodeSource | null;
  /** He moved or resized it himself (`StudioNode.byHand`): only then is its size or place his design rather than the board's own tidying. */
  byHand?: boolean;
}

/** A hover, press or focus rule, as a capture carries it (`parts/capturedMotion.ts#MotionState`). */
export interface LayerState { selector?: string; self?: boolean; state?: string; style?: Record<string, string> }

/** What a part wears besides the fields `lookOf` names, by CSS property, as written: the slots of the part's Page look. */
export function artCss(n: Pick<LayerNode, "art" | "radii" | "radiiY" | "motion">): Record<string, string> {
  const a = n.art ?? {};
  const out: Record<string, string> = {};
  const opts = (prefix: string, o: readonly string[] | undefined) => { if (o?.[0]) out[`${prefix}-size`] = o[0]; if (o?.[1]) out[`${prefix}-position`] = o[1]; if (o?.[2]) out[`${prefix}-repeat`] = o[2]; };
  if (a.background) { out["background-image"] = a.background; opts("background", a.backgroundOptions); if (a.backgroundClip) out["background-clip"] = a.backgroundClip; }
  if (a.mask) { out["mask-image"] = a.mask; opts("mask", a.maskOptions); }
  if (a.transform && a.transform !== "none") out.transform = a.transform;
  if (a.origin) out["transform-origin"] = a.origin;
  if (a.filter) out.filter = a.filter;
  if (a.backdrop) out["backdrop-filter"] = a.backdrop;
  if (a.blend) out["mix-blend-mode"] = a.blend;
  if (a.clipPath) out["clip-path"] = a.clipPath;
  if (a.textShadow) out["text-shadow"] = a.textShadow;
  if (a.textStroke && a.textStroke.w > 0) out["-webkit-text-stroke"] = `${a.textStroke.w}px ${a.textStroke.color}`;
  if (a.paintOrder) out["paint-order"] = a.paintOrder;
  const four = (r: unknown): r is number[] => Array.isArray(r) && r.length === 4 && r.every((v) => typeof v === "number");
  if (four(n.radii) && n.radii.some((r) => r > 0)) out["border-radius"] = n.radii.map((r) => `${r}px`).join(" ") + (four(n.radiiY) ? ` / ${n.radiiY.map((r) => `${r}px`).join(" ")}` : "");
  const anim = n.motion?.animation ?? [];
  if (anim.length) out.animation = anim.map((x) => [x.name, x.duration, x.timing, x.delay, x.iterations, x.direction, x.fill].filter(Boolean).join(" ")).join(", ");
  const tr = n.motion?.transition ?? [];
  if (tr.length) out.transition = tr.map((t) => [t.property, t.duration, t.timing, t.delay].filter(Boolean).join(" ")).join(", ");
  return out;
}

/** Its own hover, press and focus (not an ancestor's), by state: the declarations of every such rule, in order. */
export function statesCss(n: Pick<LayerNode, "motion">): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of [...(n.motion?.hover ?? []), ...(n.motion?.active ?? []), ...(n.motion?.focus ?? [])]) {
    if (r.self === false || !r.style) continue;
    const state = r.state || "hover";
    const decl = Object.entries(r.style).map(([k, v]) => `${k}: ${v}`).join("; ");
    if (decl) out[state] = out[state] ? `${out[state]}; ${decl}` : decl;
  }
  return out;
}

/** What a property is when nothing sets it, for a slot emptied on the board. */
const UNSET: Record<string, string> = { "background-image": "none", "mask-image": "none", transform: "none", filter: "none", "backdrop-filter": "none", "mix-blend-mode": "normal", "clip-path": "none", "text-shadow": "none", "-webkit-text-stroke": "0", "paint-order": "normal", "border-radius": "0", animation: "none", transition: "none" };

const ROLES = ["bg", "surface", "text", "muted", "accent", "highlight"];

/** A colour as written, with a palette role resolved to its colour. */
function resolve(v: string | undefined, palette: Record<string, string> | null | undefined): string | undefined {
  if (!v) return undefined;
  const t = v.trim();
  if (ROLES.includes(t)) return palette?.[t] || undefined;
  return t;
}

/** The words of a part, plain. */
export function wordsOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((s) => (s && typeof s === "object" && typeof (s as { text?: unknown }).text === "string" ? (s as { text: string }).text : "")).join("").replace(/​/g, "");
  return "";
}

const n2 = (v: number) => Math.round(v * 100) / 100;

/**
 * A part's look, as CSS would write it. `base` is the size a font's `size`
 * multiplies (16 for a page read at the browser's default); `family` turns
 * the Builder's family names into a stack.
 */
/**
 * THE BOARD AS LANDED IS THE BASELINE. An import reads each part's look from
 * the code (`source.was`), then the board's own clean-up (the sweep's
 * repaint and refit, the palette's role names) runs over what landed. None
 * of that is a design: re-read every part's baseline from the board as it
 * landed, so the style layer holds only what the owner changes after.
 */
export function baselineAsLanded<T extends LayerNode>(nodes: readonly T[], palette?: Record<string, string> | null, opts: { family?: (name: string) => string | undefined } = {}): T[] {
  /* Measured exactly as the panel measures "now" (`buildLayer`'s `lookOf`, base 16, the same faces), or every rounding is a restyle. */
  return nodes.map((n) => (n.source?.was ? { ...n, source: { ...n.source, was: lookOf(n, palette, { family: opts.family }) } } : n));
}

export function lookOf(n: LayerNode, palette?: Record<string, string> | null, opts: { base?: number; family?: (name: string) => string | undefined } = {}): CssLook {
  const base = opts.base ?? 16;
  const c = n.colour ?? {};
  const f = n.font ?? null;
  const px = f ? (typeof f.size === "number" && Number.isFinite(f.size) ? n2(f.size * base) : f.px) : undefined;
  const fam = f ? (f.stack?.trim() || [f.face ? `'${f.face.replace(/['"]/g, "")}'` : null, f.family ? opts.family?.(f.family) ?? f.family : null].filter(Boolean).join(", ") || undefined) : undefined;
  const e = n.edge ?? null;
  const p = n.pad ?? null;
  const look: CssLook = { box: { x: n2(n.x), y: n2(n.y), w: n2(n.w), h: n2(n.h) }, words: wordsOf(n.content) };
  const color = resolve(c.text, palette);
  if (color) look.color = color;
  const bg = resolve(c.bg, palette);
  if (bg) look.background = bg;
  if (e && (e.width ?? 0) > 0 && e.style !== "none") {
    look.borderWidth = n2(e.width ?? 0);
    look.borderStyle = e.style || "solid";
    const ec = resolve(e.colour, palette) ?? resolve(c.accent, palette);
    if (ec) look.borderColor = ec;
  }
  if (e?.shadow) look.shadow = e.shadow;
  if (typeof n.radius === "number" && n.radius > 0) look.radius = n2(n.radius);
  if (p) look.pad = [p.top ?? 0, p.right ?? 0, p.bottom ?? 0, p.left ?? 0].map(n2) as [number, number, number, number];
  if (px) look.fontSize = px;
  if (f?.weight) look.fontWeight = f.weight;
  if (fam) look.fontFamily = fam;
  /* As a share of the size: a bigger size at the same leading is the page's own line height, grown with it. */
  if (f?.leading) look.lineHeight = n2(f.leading);
  if (typeof f?.spacing === "number" && f.spacing) look.letterSpacing = f.spacing;
  if (typeof n.opacity === "number" && n.opacity < 1) look.opacity = n.opacity;
  if (n.text?.align) look.align = n.text.align;
  if (n.text?.transform) look.transform = n.text.transform;
  const art = artCss(n);
  if (Object.keys(art).length) look.art = art;
  const states = statesCss(n);
  if (Object.keys(states).length) look.states = states;
  return look;
}

/** A colour in one spelling, so `#16a34a` and `rgb(22, 163, 74)` are the same colour. */
export function colourKey(v: string | undefined | null): string {
  if (!v) return "";
  const s = v.trim().toLowerCase();
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(s);
  if (hex) {
    const h = hex[1]!.length === 3 ? hex[1]!.split("").map((x) => x + x).join("") : hex[1]!;
    return `${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)}`;
  }
  const rgb = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,/\s]+([\d.]+))?\s*\)$/.exec(s);
  if (rgb) return `${Math.round(+rgb[1]!)},${Math.round(+rgb[2]!)},${Math.round(+rgb[3]!)}${rgb[4] !== undefined && +rgb[4] < 1 ? `,${rgb[4]}` : ""}`;
  return s.replace(/\s+/g, "");
}

/** Is this value a colour (as `colourKey` reads one: three channels), not a font stack with commas in it? */
export function isColour(v: string | undefined | null): boolean {
  return /^\d+,\d+,\d+(,[\d.]+)?$/.test(colourKey(v));
}

/** The declarations that differ between how a part was brought in and how it is now. */
export function changedDeclarations(was: CssLook, now: CssLook, move: { dx: number; dy: number }): string[] {
  const out: string[] = [];
  const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const colourSame = (a?: string, b?: string) => colourKey(a) === colourKey(b);
  if (!colourSame(was.color, now.color) && now.color) out.push(`color: ${now.color}`);
  if (!colourSame(was.background, now.background)) {
    out.push(`background-color: ${now.background ?? "transparent"}`);
    /*
     * A FILL PICKED ON THE BOARD IS THE FILL ON THE PAGE. The board draws a
     * picked fill alone; the page's code may paint a background image over
     * its colour (PonsStars' next-step: a linear-gradient in base.css), and
     * a colour under an image never shows. So the image the code painted
     * goes, unless the image itself was changed here (the slots below say).
     */
    const img = (l: CssLook) => (l.art?.["background-image"] ?? "").replace(/\s+/g, " ").trim();
    if (now.background && img(was) && img(was) !== "none" && img(was) === img(now)) out.push("background-image: none");
  }
  const edgeWas = `${was.borderWidth ?? 0}|${was.borderStyle ?? ""}|${colourKey(was.borderColor)}`;
  const edgeNow = `${now.borderWidth ?? 0}|${now.borderStyle ?? ""}|${colourKey(now.borderColor)}`;
  if (edgeWas !== edgeNow) out.push(now.borderWidth ? `border: ${now.borderWidth}px ${now.borderStyle ?? "solid"}${now.borderColor ? ` ${now.borderColor}` : ""}` : "border: none");
  if (!same(was.shadow, now.shadow)) out.push(`box-shadow: ${now.shadow ?? "none"}`);
  if (!same(was.radius, now.radius)) out.push(`border-radius: ${now.radius ?? 0}px`);
  if (!same(was.pad, now.pad)) out.push(`padding: ${(now.pad ?? [0, 0, 0, 0]).map((v) => `${v}px`).join(" ")}`);
  if (!same(was.fontSize, now.fontSize) && now.fontSize) out.push(`font-size: ${now.fontSize}px`);
  if (!same(was.fontWeight, now.fontWeight) && now.fontWeight) out.push(`font-weight: ${now.fontWeight}`);
  if (!same(was.fontFamily, now.fontFamily) && now.fontFamily) out.push(`font-family: ${now.fontFamily}`);
  if (!same(was.lineHeight, now.lineHeight) && now.lineHeight) out.push(`line-height: ${now.lineHeight}`);
  if (!same(was.letterSpacing, now.letterSpacing)) out.push(`letter-spacing: ${now.letterSpacing ? `${now.letterSpacing}em` : "normal"}`);
  if (!same(was.opacity, now.opacity)) out.push(`opacity: ${now.opacity ?? 1}`);
  if (!same(was.align, now.align)) out.push(`text-align: ${now.align ?? "start"}`);
  if (!same(was.transform, now.transform)) out.push(`text-transform: ${now.transform ?? "none"}`);
  /* The Page look's slots: each one changed on the board, as written; one emptied, back to nothing. */
  for (const k of new Set([...Object.keys(was.art ?? {}), ...Object.keys(now.art ?? {})])) {
    const a = was.art?.[k], b = now.art?.[k];
    if ((a ?? "").replace(/\s+/g, " ").trim() !== (b ?? "").replace(/\s+/g, " ").trim()) out.push(`${k}: ${b ?? UNSET[k] ?? "initial"}`);
  }
  /* Where it is layout: a size he gave it, and an offset from where the page put it, which keeps it in the page's flow. */
  if (Math.abs(was.box.w - now.box.w) >= 1) out.push(`width: ${now.box.w}px`, "box-sizing: border-box", "max-width: 100%");
  if (Math.abs(was.box.h - now.box.h) >= 1) out.push(`min-height: ${now.box.h}px`);
  if (Math.abs(move.dx) >= 1 || Math.abs(move.dy) >= 1) out.push("position: relative", `left: ${n2(move.dx)}px`, `top: ${n2(move.dy)}px`);
  return out;
}

/** A CSS selector for a hook, exactly as the source names it. */
export function selectorFor(h: { attr: "data-hook" | "id"; value: string }): string {
  const v = h.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return h.attr === "id" && /^[A-Za-z][\w-]*$/.test(h.value) ? `#${h.value}` : `[${h.attr}="${v}"]`;
}

export type HookFate = "covered" | "untouched" | "missing";

export interface HookCheck {
  file: string;
  attr: "data-hook" | "id";
  value: string;
  line: number;
  fate: HookFate;
  /** In words, for the owner: why it is what it is. */
  why: string;
}

export interface TextEdit { nodeId: string; file: string; line?: number; from: string; to: string }

export interface Layer {
  /** The stylesheet, whole. Empty rules are never written. */
  css: string;
  rules: { selector: string; declarations: string[]; nodeId: string; file: string }[];
  vars: { name: string; value: string; was: string; why: "set" | "followed"; token?: boolean }[];
  /** Every design token the source defines (`tokens.css`), and what the layer sets it to, if anything. */
  tokens: { name: string; value: string; file: string; line: number; now?: string }[];
  check: HookCheck[];
  text: TextEdit[];
  /** The plain summary he reads before anything is published. */
  says: string;
  /** For a builder-ready repository: changes the contract keeps out of the layer, in words. */
  held?: string[];
}

/** A colour as `kit-check` finds one (kit/tools/kit-check.mjs, COLOR). */
export const KIT_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\b(?:white|black|red|green|blue|yellow|orange|purple|pink|gray|grey|silver|navy|teal|maroon|olive|lime|aqua|cyan|magenta|fuchsia|gold|crimson|indigo|violet|brown|tan|beige)\b/;

/**
 * Declarations as the builder contract has them: a colour lives only in a
 * custom property, so `color: #c00` on `hero-button` becomes
 * `--hero-button-color: #c00; color: var(--hero-button-color)`. The style
 * layer may declare custom properties with colours; no other rule may hold one.
 */
export function kitDeclarations(hook: string, decl: string[]): string[] {
  const out: string[] = [];
  for (const d of decl) {
    const at = d.indexOf(":");
    const prop = d.slice(0, at).trim();
    const value = d.slice(at + 1).trim();
    if (prop.startsWith("--") || !KIT_COLOUR.test(value)) { out.push(d); continue; }
    const name = `--${hook}-${prop}`;
    out.push(`${name}: ${value}`, `${prop}: var(${name})`);
  }
  return out;
}

/** The part whose source path this one continues: the section it sits in. */
function ownerOf(n: LayerNode, all: LayerNode[]): LayerNode | null {
  const me = (n.from?.selector ?? "").trim();
  let best: LayerNode | null = null;
  for (const o of all) {
    if (o === n || o.pageId !== n.pageId) continue;
    const p = (o.from?.selector ?? "").trim();
    if (!p || !me.startsWith(p) || me.length <= p.length || !/[\s>]/.test(me[p.length]!)) continue;
    if (!best || p.length > (best.from?.selector ?? "").length) best = o;
  }
  return best;
}

/**
 * The layer for a board, against the source it came from.
 *
 * `nodes` are the board's parts, every page; `palette` resolves role
 * colours; `source` is the inventory written at import.
 */
export function buildLayer(nodes: LayerNode[], palette: Record<string, string> | null | undefined, source: StyleSource, opts: { base?: number; family?: (name: string) => string | undefined; when?: string; kit?: boolean } = {}): Layer {
  const sourced = nodes.filter((n) => n.source?.was);
  const rules: Layer["rules"] = [];
  const text: TextEdit[] = [];
  /* How far each part moved, and so how far it moved within its section: a section moved carries its parts, and they are not moved twice. */
  const moved = new Map<string, { dx: number; dy: number }>();
  for (const n of sourced) moved.set(n.id, { dx: n.x - n.source!.was.box.x, dy: n.y - n.source!.was.box.y });
  /* Its move less the move of the nearest section holding it that has a rule of its own to carry it. */
  const own = (n: LayerNode) => {
    const m = moved.get(n.id) ?? { dx: 0, dy: 0 };
    for (let o = ownerOf(n, sourced); o; o = ownerOf(o, sourced)) {
      const om = moved.get(o.id);
      if (o.source?.hook && om) return { dx: m.dx - om.dx, dy: m.dy - om.dy };
    }
    return m;
  };
  const styled = new Set<string>();
  const kitHeld: string[] = [];
  for (const n of sourced) {
    const src = n.source!;
    const now = lookOf(n, palette, opts);
    if (src.hook) {
      /* Size and place are written only where he set them: the board grows and shifts boxes to fit its own type, and that is not a design. */
      const boxed = changedDeclarations(src.was, n.byHand ? now : { ...now, box: src.was.box }, n.byHand ? own(n) : { dx: 0, dy: 0 });
      /* A shape in a drawing is recoloured by its fill and stroke. */
      let decl = src.svg ? svgDeclarations(boxed) : boxed;
      /* A builder-ready repository keys rules by data-hook only, and keeps colours in custom properties (`kitDeclarations`). */
      if (opts.kit && decl.length && src.hook.attr !== "data-hook") { kitHeld.push(`${src.file}: #${src.hook.value} has only an id, and a builder-ready repository keys its rules by data-hook, so it keeps its own look.`); decl = []; }
      if (opts.kit) decl = kitDeclarations(src.hook.value, decl);
      if (decl.length) {
        rules.push({ selector: selectorFor(src.hook), declarations: decl, nodeId: n.id, file: src.file });
        styled.add(`${src.file}|${src.hook.attr}=${src.hook.value}`);
      }
      /* Its own hover, press and focus, where they changed on the board: a rule of their own, the declarations that are new or different. */
      for (const state of new Set([...Object.keys(src.was.states ?? {}), ...Object.keys(now.states ?? {})])) {
        const split = (t: string | undefined) => new Map((t ?? "").split(/;(?![^(]*\))/).map((d) => { const i = d.indexOf(":"); return [d.slice(0, i).trim(), d.slice(i + 1).trim()] as const; }).filter(([k, v]) => k && v));
        const a = split(src.was.states?.[state]), b = split(now.states?.[state]);
        let sd = [...b].filter(([k, v]) => a.get(k) !== v).map(([k, v]) => `${k}: ${v}`);
        if (opts.kit && src.hook.attr !== "data-hook") sd = [];
        if (opts.kit) sd = kitDeclarations(src.hook.value, sd);
        if (sd.length) { rules.push({ selector: `${selectorFor(src.hook)}:${state}`, declarations: sd, nodeId: n.id, file: src.file }); styled.add(`${src.file}|${src.hook.attr}=${src.hook.value}`); }
      }
    }
    /* Words, where the source holds them as plain text and nothing writes them. */
    if (src.staticWords && now.words.trim() && now.words.replace(/\s+/g, " ").trim() !== src.was.words.replace(/\s+/g, " ").trim()) {
      /* A list item's bullet is the browser's, not the file's. */
      const mark = /^(• |◦ |▪ |\d+\. )/.exec(src.was.words)?.[0] ?? "";
      const strip = (w: string) => (mark && w.startsWith(mark) ? w.slice(mark.length) : w);
      text.push({ nodeId: n.id, file: src.file, ...(src.line ? { line: src.line } : {}), from: strip(src.was.words), to: strip(now.words) });
    }
  }

  /* A builder-ready repository's design changes only its style layer: words are the code's, changed by a code chat. */
  if (opts.kit) for (const e of text.splice(0)) kitHeld.push(`${e.file}: the words “${e.from.slice(0, 40)}” became “${e.to.slice(0, 40)}” on the board, but a design never changes a page's words here; ask a code chat to change them.`);

  /* The variables: set by hand, else followed when every part wearing a variable's colour now wears one other colour. */
  const vars: Layer["vars"] = [];
  /* A token's definition wins over a plain variable of the same name: it is the one the design is meant to change. */
  const defined = new Map<string, SourceVar>();
  for (const f of source.files) for (const v of f.vars) if (!defined.has(v.name) || (v.token && !defined.get(v.name)!.token)) defined.set(v.name, v);
  const sameValue = (a: string, b: string) => (isColour(a) ? colourKey(a) === colourKey(b) : fontKey(a) === fontKey(b));
  for (const [name, value] of Object.entries(source.varsSet ?? {})) {
    const had = defined.get(name);
    if (had && value.trim() && !sameValue(value, had.value)) vars.push({ name, value: value.trim(), was: had.value, why: "set", ...(had.token ? { token: true } : {}) });
  }
  for (const v of defined.values()) {
    if (vars.some((x) => x.name === v.name)) continue;
    /* A colour is followed by every colour a part wore; a face by every face. */
    const colour = isColour(v.value);
    if (!colour && !looksLikeFace(v.value)) continue;
    const key = colour ? colourKey(v.value) : fontKey(v.value);
    const nows = new Set<string>();
    let wore = 0;
    for (const n of sourced) {
      const was = n.source!.was;
      const now = lookOf(n, palette, opts);
      const pairs = colour ? ([[was.color, now.color], [was.background, now.background], [was.borderColor, now.borderColor]] as const) : ([[was.fontFamily, now.fontFamily]] as const);
      for (const [a, b] of pairs) {
        if ((colour ? colourKey(a) : fontKey(a)) !== key) continue;
        wore++;
        nows.add(b ?? "");
      }
    }
    const [only] = [...nows];
    if (wore > 0 && nows.size === 1 && only && (colour ? colourKey(only) : fontKey(only)) !== key) vars.push({ name: v.name, value: only, was: v.value, why: "followed", ...(v.token ? { token: true } : {}) });
  }
  /* The design tokens, listed whether or not the layer changes them. */
  const tokens: Layer["tokens"] = [...defined.values()].filter((v) => v.token).map((v) => ({ name: v.name, value: v.value, file: v.file, line: v.line, ...(vars.find((x) => x.name === v.name) ? { now: vars.find((x) => x.name === v.name)!.value } : {}) }));

  /* The hook check: every hook the source carries, and what becomes of it. */
  const check: HookCheck[] = [];
  const carried = new Map<string, LayerNode>();
  const inRuns = new Set<string>();
  const innerOf = new Map<string, LayerNode>();
  for (const n of nodes) {
    for (const h of n.source?.inner ?? []) if (n.source?.file) innerOf.set(`${n.source.file}|${h.attr}=${h.value}`, n);
    const f = n.source?.file;
    if (n.source?.hook && f) carried.set(`${f}|${n.source.hook.attr}=${n.source.hook.value}`, n);
    if (f && Array.isArray(n.content)) for (const s of n.content as { hooks?: Record<string, string> }[]) {
      if (s?.hooks?.["data-hook"]) inRuns.add(`${f}|data-hook=${s.hooks["data-hook"]}`);
      if (s?.hooks?.id) inRuns.add(`${f}|id=${s.hooks.id}`);
    }
  }
  for (const f of source.files) {
    for (const h of f.hooks) {
      const key = `${f.file}|${h.attr}=${h.value}`;
      const name = h.attr === "id" ? `#${h.value}` : `“${h.value}”`;
      const on = carried.get(key);
      if (styled.has(key)) { check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "covered", why: `${name} is restyled by the layer.` }); continue; }
      if (on) {
        const named = on.hooks?.[h.attr];
        if (named !== undefined && named !== h.value) { check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "missing", why: `${name} was renamed on the board to “${named}”. The code still looks for ${name}, so the layer keeps that name and the page keeps working; rename it in the code too if you meant it.` }); continue; }
        check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "untouched", why: `${name} is on the board and unchanged: the page keeps its own look for it.` });
        continue;
      }
      const host = innerOf.get(key);
      if (host) { check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "untouched", why: `${name} is inside the part “${host.source?.hook?.value ?? host.id}” (a list's option, a button's words): it keeps the page's look.` }); continue; }
      if (inRuns.has(key)) { check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "untouched", why: `${name} is a value inside a line of words: it keeps the line's look.` }); continue; }
      if (h.imported) { check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "missing", why: `${name} was on the board and its part has been deleted. The layer leaves its look alone; the pull request lists it as removed, for the code to delete.` }); continue; }
      check.push({ file: f.file, attr: h.attr, value: h.value, line: h.line, fate: "untouched", why: `${name} did not come onto the board (an element inside a control, or one the page fills itself): the page keeps its own look for it.` });
    }
  }

  const when = opts.when ?? "";
  const css = [
    `/*`,
    ` * Style layer for ${source.repo}${source.ref ? ` (${source.ref})` : ""}, from the Builder${when ? `, ${when}` : ""}.`,
    ` * Only the look: every rule is keyed by a hook the page's code already uses,`,
    ` * and nothing here hides, adds or removes anything. Delete this file and its`,
    ` * <link> to go back to the page as it was.`,
    ` */`,
    /* `:root:root`: one step more particular than the source's own `:root`, so the layer's value wins wherever tokens.css sits among the page's stylesheets. */
    ...(vars.length ? ["", ":root:root {", ...vars.map((v) => `  ${v.name}: ${v.value}; /* ${v.token ? "token, " : ""}was ${v.was} */`), "}"] : []),
    ...rules.map((r) => ["", `${r.selector} {`, ...r.declarations.map((d) => `  ${d};`), "}"].join("\n")),
    "",
  ].join("\n");

  const count = (f: HookFate) => check.filter((c) => c.fate === f).length;
  const missing = check.filter((c) => c.fate === "missing");
  const says = [
    `${rules.length} part${rules.length === 1 ? "" : "s"} restyled by hook, ${vars.length} CSS variable${vars.length === 1 ? "" : "s"} set, ${text.length} line${text.length === 1 ? "" : "s"} of plain words changed.`,
    `Hooks: ${count("covered")} restyled, ${count("untouched")} untouched, ${count("missing")} missing.`,
    ...(tokens.length ? [`Design tokens in ${[...new Set(tokens.map((t) => t.file))].join(", ")}: ${tokens.length}, ${tokens.filter((t) => t.now).length} set by the layer${tokens.some((t) => t.now) ? ` (${tokens.filter((t) => t.now).map((t) => `${t.name} ${t.value} to ${t.now}`).join("; ")})` : ""}. The tokens file itself is left as it is.`] : []),
    ...missing.map((m) => `Warning: ${m.why} (${m.file} line ${m.line})`),
    ...kitHeld.map((h) => `Held back: ${h}`),
    opts.kit ? "Scripts, pages and every hook stay as they are: only the style layer changes." : "Scripts, behaviour and every hook stay as they are; each page gains one <link> line.",
  ].join("\n");
  return { css, rules, vars, tokens, check, text, says, held: kitHeld };
}

/** A font stack in one spelling: no quotes, no spaces after commas, lower case. */
export function fontKey(v: string | undefined | null): string {
  return (v ?? "").toLowerCase().replace(/["']/g, "").replace(/\s*,\s*/g, ",").trim();
}

/** Does a value read as a font stack? */
function looksLikeFace(v: string): boolean {
  return /,|serif|sans|mono|system-ui|georgia|helvetica|arial|inter|times/i.test(v) && !/^\d|px$|rem$|em$/.test(v.trim());
}

/** The `<link>` a page gets: to the layer, relative to the page. */
export function linkHref(pageFile: string, layerFile: string): string {
  const from = pageFile.split("/").slice(0, -1);
  const to = layerFile.split("/");
  let i = 0;
  while (i < from.length && i < to.length - 1 && from[i] === to[i]) i++;
  return [...from.slice(i).map(() => ".."), ...to.slice(i)].join("/");
}

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * A page with the layer linked, and its plain words changed where they can
 * be changed exactly. Returns what was done and what was not, with why.
 */
export function applyToPage(html: string, opts: { href: string; edits: TextEdit[] }): { html: string; linked: boolean; done: TextEdit[]; skipped: (TextEdit & { why: string })[] } {
  let out = html;
  const done: TextEdit[] = [];
  const skipped: (TextEdit & { why: string })[] = [];
  /* Code is never touched: words inside a script or a style block do not count as the page's words. */
  const code: [number, number][] = [];
  const re = /<(script|style)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  for (let m = re.exec(out); m; m = re.exec(out)) code.push([m.index, m.index + m[0].length]);
  for (const e of opts.edits) {
    const words = e.from.replace(/\s+/g, " ").trim();
    if (!words) { skipped.push({ ...e, why: "it had no words of its own" }); continue; }
    /* The words as written, across lines and indentation, between tags and never across one. */
    const pattern = new RegExp(`(>[^<]*?)(${words.split(" ").map(escapeRe).join("\\s+")})(?=[^<>]*<)`, "g");
    const hits: RegExpExecArray[] = [];
    for (let m = pattern.exec(out); m; m = pattern.exec(out)) if (!code.some(([a, b]) => m!.index >= a && m!.index < b)) hits.push(m);
    if (hits.length !== 1) { skipped.push({ ...e, why: hits.length ? `its words are written ${hits.length} times in ${e.file}, so which one is meant cannot be told` : `its words are not written as one plain run in ${e.file}` }); continue; }
    const m = hits[0]!;
    const start = m.index + m[1]!.length;
    out = `${out.slice(0, start)}${escapeHtml(e.to.replace(/\s+/g, " ").trim())}${out.slice(start + m[2]!.length)}`;
    done.push(e);
  }
  const tag = `<link rel="stylesheet" href="${opts.href}" data-style-layer="">`;
  let linked = false;
  if (!out.includes(`href="${opts.href}"`)) {
    if (/<\/head\s*>/i.test(out)) out = out.replace(/(\n?)([ \t]*)<\/head\s*>/i, (all, nl: string, ind: string) => `${nl}${ind}${tag}\n${ind}</head>`);
    else if (/<html\b[^>]*>/i.test(out)) out = out.replace(/<html\b[^>]*>/i, (h) => `${h}\n${tag}`);
    else out = `${tag}\n${out}`;
    linked = true;
  }
  return { html: out, linked, done, skipped };
}

/** The branch the layer goes to: never the default, one per site and day. */
export function layerBranch(site: string, date: Date): string {
  const name = site.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "site";
  return `style/${name}-${date.toISOString().slice(0, 10)}`;
}

/** The hooks a page carries, counted the same way before and after: the layer must never lower any. */
export function hookCounts(html: string): Map<string, number> {
  const out = new Map<string, number>();
  const re = /\s(data-hook|id)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  for (let m = re.exec(html); m; m = re.exec(html)) {
    const k = `${m[1]}=${m[2] ?? m[3]}`;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}
