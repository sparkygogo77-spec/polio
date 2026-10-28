/**
 * CSS AS TAILWIND CLASSES, TOKENS FIRST (create-system "(d) Export").
 *
 * The clean-code export writes no inline styles: every declaration a part
 * wears becomes a Tailwind class. Where the value is one of the System's
 * tokens, the class names the token (`bg-accent`, `text-heading-1`,
 * `p-space-4`, `rounded-small`, `shadow-low`, `font-geist`), so a person
 * reading the code sees the design's own words and a token change in
 * `tokens.css` reaches the part. A value that is no token keeps its exact
 * value as an arbitrary class (`text-[13.5px]`, `bg-[rgb(9,9,10)]`), and a
 * property Tailwind has no utility for is an arbitrary property
 * (`[mask-image:…]`). Nothing is dropped except declarations that only
 * restate what Tailwind's base styles already do (`box-sizing: border-box`,
 * `border-style: none`).
 *
 * The page's colour roles (`var(--accent)`, `var(--text)`) are written as
 * the role's token class where the System has the role.
 *
 * Pure: no React, no store, every import ends in .ts.
 */
import type { System } from "../system/model.ts";
import { cssColour, tokenNames, topLevel } from "./tokensOut.ts";

/** What a value looks up to find its token's Tailwind name. */
export interface TwContext {
  colour: Map<string, string>;
  type: Map<number, string>;
  space: Map<number, string>;
  radius: Map<number, string>;
  shadow: Map<string, string>;
  face: Map<string, string>;
  /** A palette role's CSS variable (`--accent`) → its colour token's Tailwind name. */
  roles: Map<string, string>;
  /** A palette role's CSS variable → its colour, for a role the System has no token for: written as the value. */
  palette: Map<string, string>;
}

const colourKey = (css: string) => {
  const c = cssColour(css);
  return c ? `${c.colorSpace}:${c.components.join(",")}:${c.alpha ?? 1}` : css.replace(/\s+/g, "").toLowerCase();
};
const faceKey = (stack: string) => topLevel(stack).map((f) => f.replace(/^["']|["']$/g, "").trim().toLowerCase()).join(",");
const shadowKey = (css: string) => css.replace(/\s+/g, " ").trim();

/** The lookups for a System (an empty context when there is none: every value is then written as itself). */
export function twContext(system: System | null, palette: Record<string, string> = {}): TwContext {
  const ctx: TwContext = { colour: new Map(), type: new Map(), space: new Map(), radius: new Map(), shadow: new Map(), face: new Map(), roles: new Map(), palette: new Map(Object.entries(palette).map(([k, v]) => [`--${k}`, v])) };
  if (!system) return ctx;
  const names = tokenNames(system);
  const tw = (id: string) => names.get(id)?.tw ?? null;
  const first = <K, V>(m: Map<K, V>, k: K, v: V | null) => { if (v !== null && !m.has(k)) m.set(k, v); };
  for (const c of system.tokens.colour) {
    first(ctx.colour, colourKey(c.value), tw(c.id));
    if (c.role) first(ctx.roles, `--${c.role}`, tw(c.id));
  }
  for (const s of system.tokens.type.steps) first(ctx.type, s.px, tw(s.id));
  for (const s of system.tokens.space) first(ctx.space, s.px, tw(s.id));
  for (const s of system.tokens.radius) first(ctx.radius, s.px, tw(s.id));
  for (const s of system.tokens.shadow) first(ctx.shadow, shadowKey(s.css), tw(s.id));
  for (const f of system.tokens.type.faces) first(ctx.face, faceKey(f.stack), tw(f.id));
  return ctx;
}

/** A style attribute's declarations, in order, as [property, value]. */
export function declarations(style: string): [string, string][] {
  return topLevel(style, ";").flatMap((d) => {
    const at = d.indexOf(":");
    if (at < 0) return [];
    const prop = d.slice(0, at).trim().toLowerCase();
    const value = d.slice(at + 1).trim().replace(/\s*!important$/, "");
    return prop && value ? [[prop, value] as [string, string]] : [];
  });
}

/** A value inside `[…]`: spaces are underscores, an underscore kept is escaped, double quotes become single (the class sits in a double-quoted attribute). */
export function arb(value: string): string {
  return value.trim().replace(/"/g, "'").replace(/_/g, "\\_").replace(/\s+/g, "_");
}

const PX = /^(-?\d*\.?\d+(?:e[+-]?\d+)?)px$/i;
const pxOf = (v: string): number | null => {
  const m = PX.exec(v.trim());
  if (m) return parseFloat(m[1]!);
  return v.trim() === "0" ? 0 : null;
};
const ROLE_VAR = /^var\((--[a-z]+)\)$/;
/** A role's variable inside a longer value (a background's colour): the palette's colour, since tokens.css names roles by their tokens, not as --bg. */
const rolesIn = (v: string, ctx: TwContext) => v.replace(/var\((--[a-z]+)\)/g, (m, name: string) => ctx.palette.get(name) ?? m);

/** A colour utility: the token or role name, else the value itself (a role the System has no token for, as the palette's colour). */
function colourClass(prefix: string, value: string, ctx: TwContext, prop: string): string {
  const role = ROLE_VAR.exec(value.trim());
  if (role && ctx.roles.has(role[1]!)) return `${prefix}-${ctx.roles.get(role[1]!)}`;
  if (role && ctx.palette.has(role[1]!)) value = ctx.palette.get(role[1]!)!;
  const named = ctx.colour.get(colourKey(value));
  if (named) return `${prefix}-${named}`;
  if (isClear(value)) return `${prefix}-transparent`;
  if (ROLE_VAR.test(value.trim())) return `[${prop}:${arb(value)}]`;
  return `${prefix}-[${arb(value)}]`;
}

/** A length utility: the space token, a Tailwind word, else the value. */
function lengthClass(prefix: string, value: string, ctx: TwContext, scale: "space" | "radius" | "none" = "space"): string {
  const v = value.trim();
  const px = pxOf(v);
  const neg = px !== null && px < 0;
  if (px !== null) {
    const map = scale === "space" ? ctx.space : scale === "radius" ? ctx.radius : null;
    const named = map?.get(Math.abs(px));
    if (named) return `${neg ? "-" : ""}${prefix}-${named}`;
    if (px === 0) return `${prefix}-0`;
  }
  if (v === "auto") return `${prefix}-auto`;
  return `${prefix}-[${arb(v)}]`;
}

const SIDES = ["t", "r", "b", "l"] as const;
/** padding / margin with one to four values, said as briefly as Tailwind can. */
function boxSides(p: "p" | "m", value: string, ctx: TwContext): string[] {
  const v = topLevel(value, " ");
  const [t, r = t, b = t, l = r] = v as [string, string?, string?, string?];
  if (!t) return [];
  if (t === r && r === b && b === l) return [lengthClass(p, t, ctx)];
  if (t === b && r === l) return [lengthClass(`${p}y`, t, ctx), lengthClass(`${p}x`, r!, ctx)];
  return [t, r!, b!, l!].map((x, i) => lengthClass(`${p}${SIDES[i]}`, x, ctx));
}

const WEIGHT: Record<string, string> = { "100": "thin", "200": "extralight", "300": "light", "400": "normal", "500": "medium", "600": "semibold", "700": "bold", "800": "extrabold", "900": "black", normal: "normal", bold: "bold" };
const ALIGN: Record<string, string> = { "flex-start": "start", start: "start", "flex-end": "end", end: "end", center: "center", stretch: "stretch", baseline: "baseline", normal: "normal" };
const JUSTIFY: Record<string, string> = { ...ALIGN, "space-between": "between", "space-around": "around", "space-evenly": "evenly" };
const DISPLAY: Record<string, string> = { flex: "flex", grid: "grid", block: "block", "inline-block": "inline-block", inline: "inline", "inline-flex": "inline-flex", "inline-grid": "inline-grid", none: "hidden", contents: "contents", table: "table" };
const SIZE_WORD: Record<string, string> = { "100%": "full", auto: "auto", "max-content": "max", "min-content": "min", "fit-content": "fit", "100vw": "screen", "100vh": "screen", "100dvh": "dvh", none: "none" };

/** Properties the words inherit anyway: `inherit` on one of these says nothing, so it is not written. */
const INHERITS = new Set(["color", "font-family", "font-size", "font-weight", "font-style", "line-height", "letter-spacing", "text-align", "text-transform", "white-space", "word-spacing", "visibility", "cursor", "direction"]);

/** Tailwind's own default font stacks (`font-sans`, `font-mono`): the published page's system stacks begin with them, so the class says it. */
const DEFAULT_FACE: [string, string][] = [["ui-sans-serif,system-ui,sans-serif", "sans"], ["ui-monospace,sfmono-regular,menlo,monaco,consolas,liberation mono,courier new,monospace", "mono"]];

/** A colour that draws nothing, in any of its spellings. */
const isClear = (v: string) => { const c = cssColour(v); return v.trim().toLowerCase() === "transparent" || (!!c && c.alpha === 0); };

/** Declarations that only restate Tailwind's base styles (preflight), or the default of a shorthand's expansion. */
function restates(prop: string, value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v === "inherit" && INHERITS.has(prop)) return true;
  if (prop === "box-sizing") return v === "border-box";
  if (prop === "border-style") return v === "none";
  if (prop === "border-width") return v === "medium" || v === "0px" || v === "0";
  if (prop === "border-color") return v === "currentcolor";
  if (prop === "border-image") return v === "none";
  if (prop === "font-feature-settings" || prop === "font-variation-settings") return v === "normal";
  if (prop === "-webkit-font-smoothing") return v === "auto";
  if (prop === "margin") return v === "0px" || v === "0";
  return false;
}

/**
 * One declaration as Tailwind classes. Tokens by name where the value is
 * one, a Tailwind word where one says it exactly, else the exact value.
 */
export function classOf(prop: string, value: string, ctx: TwContext): string[] {
  const v = value.trim();
  if (restates(prop, v)) return [];
  const px = pxOf(v);
  switch (prop) {
    case "color": return [colourClass("text", v, ctx, prop)];
    case "background-color": return [colourClass("bg", v, ctx, prop)];
    case "background":
      if (cssColour(v) || ROLE_VAR.test(v)) return [colourClass("bg", v, ctx, "background-color")];
      return [`[background:${arb(rolesIn(v, ctx))}]`];
    case "font-size": {
      const named = px !== null ? ctx.type.get(px) : undefined;
      return [named ? `text-${named}` : `text-[length:${arb(v)}]`];
    }
    case "font-family": {
      const named = ctx.face.get(faceKey(v));
      if (named) return [`font-${named}`];
      const key = faceKey(v);
      const own = DEFAULT_FACE.find(([stack]) => key === stack || key.startsWith(`${stack},`) || stack.startsWith(`${key},`));
      return [own ? `font-${own[1]}` : `font-[${arb(v)}]`];
    }
    case "font-weight": return [WEIGHT[v] ? `font-${WEIGHT[v]}` : `font-[${arb(v)}]`];
    case "font-style": return [v === "italic" ? "italic" : v === "normal" ? "not-italic" : `[font-style:${arb(v)}]`];
    case "line-height": return [`leading-[${arb(v)}]`];
    case "letter-spacing": return [v === "normal" ? "tracking-normal" : `tracking-[${arb(v)}]`];
    case "text-align": return [["left", "center", "right", "justify", "start", "end"].includes(v) ? `text-${v}` : `[text-align:${arb(v)}]`];
    case "text-transform": return [v === "uppercase" || v === "lowercase" || v === "capitalize" ? v : v === "none" ? "normal-case" : `[text-transform:${arb(v)}]`];
    case "text-decoration": case "text-decoration-line": return [v === "none" ? "no-underline" : v === "underline" ? "underline" : v === "line-through" ? "line-through" : `[${prop}:${arb(v)}]`];
    case "white-space": return [{ nowrap: "whitespace-nowrap", "pre-wrap": "whitespace-pre-wrap", pre: "whitespace-pre", normal: "whitespace-normal", "pre-line": "whitespace-pre-line" }[v] ?? `[white-space:${arb(v)}]`];
    case "overflow-wrap": case "word-wrap": return [v === "anywhere" ? "wrap-anywhere" : v === "break-word" ? "wrap-break-word" : v === "normal" ? "wrap-normal" : `[overflow-wrap:${arb(v)}]`];
    case "padding": return boxSides("p", v, ctx);
    case "padding-top": return [lengthClass("pt", v, ctx)];
    case "padding-right": return [lengthClass("pr", v, ctx)];
    case "padding-bottom": return [lengthClass("pb", v, ctx)];
    case "padding-left": return [lengthClass("pl", v, ctx)];
    case "margin": return boxSides("m", v, ctx);
    case "margin-top": return [lengthClass("mt", v, ctx)];
    case "margin-right": return [lengthClass("mr", v, ctx)];
    case "margin-bottom": return [lengthClass("mb", v, ctx)];
    case "margin-left": return [lengthClass("ml", v, ctx)];
    case "gap": {
      const [row, col] = topLevel(v, " ");
      return col && col !== row ? [lengthClass("gap-y", row!, ctx), lengthClass("gap-x", col, ctx)] : [lengthClass("gap", row!, ctx)];
    }
    case "row-gap": return [lengthClass("gap-y", v, ctx)];
    case "column-gap": return [lengthClass("gap-x", v, ctx)];
    case "border-radius": {
      if (px !== null && px >= 9999) return ["rounded-full"];
      if (px === 0) return ["rounded-none"];
      if (px !== null) return [lengthClass("rounded", v, ctx, "radius")];
      return [`rounded-[${arb(v)}]`];
    }
    case "box-shadow": {
      if (v === "none") return ["shadow-none"];
      const named = ctx.shadow.get(shadowKey(v));
      if (named) return [`shadow-${named}`];
      /* Layers that draw nothing (a clear colour at no offset, blur or spread: what a transition from no shadow leaves) are left out. */
      const drawn = topLevel(v).filter((l) => !/^rgba\(0,\s*0,\s*0,\s*0\)\s+0px\s+0px\s+0px\s+0px$/.test(l.trim()));
      return [drawn.length ? `shadow-[${arb(drawn.join(", "))}]` : "shadow-none"];
    }
    case "display": return [DISPLAY[v] ?? `[display:${arb(v)}]`];
    case "flex-direction": return [{ row: "flex-row", column: "flex-col", "row-reverse": "flex-row-reverse", "column-reverse": "flex-col-reverse" }[v] ?? `[flex-direction:${arb(v)}]`];
    case "flex-wrap": return [{ wrap: "flex-wrap", nowrap: "flex-nowrap", "wrap-reverse": "flex-wrap-reverse" }[v] ?? `[flex-wrap:${arb(v)}]`];
    case "align-items": return [ALIGN[v] ? `items-${ALIGN[v]}` : `[align-items:${arb(v)}]`];
    case "align-self": return [ALIGN[v] ? `self-${ALIGN[v]}` : v === "auto" ? "self-auto" : `[align-self:${arb(v)}]`];
    case "justify-content": return [JUSTIFY[v] ? `justify-${JUSTIFY[v]}` : `[justify-content:${arb(v)}]`];
    case "justify-items": return [ALIGN[v] ? `justify-items-${ALIGN[v]}` : `[justify-items:${arb(v)}]`];
    case "place-items": return [ALIGN[v] ? `place-items-${ALIGN[v]}` : `[place-items:${arb(v)}]`];
    case "place-content": return [JUSTIFY[v] ? `place-content-${JUSTIFY[v]}` : `[place-content:${arb(v)}]`];
    case "flex": return [v === "none" ? "flex-none" : v === "1 1 0%" || v === "1 1 0px" ? "flex-1" : v === "1 1 auto" ? "flex-auto" : `flex-[${arb(v)}]`];
    case "flex-grow": return [v === "0" ? "grow-0" : v === "1" ? "grow" : `grow-[${arb(v)}]`];
    case "flex-shrink": return [v === "0" ? "shrink-0" : v === "1" ? "shrink" : `shrink-[${arb(v)}]`];
    case "flex-basis": return [`basis-[${arb(v)}]`];
    case "grid-template-columns": return [`grid-cols-[${arb(v)}]`];
    case "position": return [["relative", "absolute", "sticky", "fixed", "static"].includes(v) ? v : `[position:${arb(v)}]`];
    case "top": case "left": case "right": case "bottom": return [v === "auto" ? `${prop}-auto` : px === 0 ? `${prop}-0` : `${prop}-[${arb(v)}]`];
    case "inset": return [px === 0 ? "inset-0" : `inset-[${arb(v)}]`];
    case "width": case "height": case "min-width": case "min-height": case "max-width": case "max-height": {
      const pre = { width: "w", height: "h", "min-width": "min-w", "min-height": "min-h", "max-width": "max-w", "max-height": "max-h" }[prop]!;
      const word = SIZE_WORD[v];
      if (word && !(word === "none" && !prop.startsWith("max")) && !(word === "auto" && prop.startsWith("max"))) return [`${pre}-${word}`];
      return [px === 0 ? `${pre}-0` : `${pre}-[${arb(v)}]`];
    }
    case "overflow": case "overflow-x": case "overflow-y": {
      const pre = prop === "overflow" ? "overflow" : prop;
      return [["hidden", "visible", "clip", "auto", "scroll"].includes(v) ? `${pre}-${v}` : `[${prop}:${arb(v)}]`];
    }
    case "opacity": return [`opacity-[${arb(v)}]`];
    case "z-index": return [v === "auto" ? "z-auto" : `z-[${arb(v)}]`];
    case "cursor": return [/^[a-z-]+$/.test(v) ? `cursor-${v}` : `[cursor:${arb(v)}]`];
    case "pointer-events": return [v === "none" ? "pointer-events-none" : v === "auto" ? "pointer-events-auto" : `[pointer-events:${arb(v)}]`];
    case "user-select": return [{ none: "select-none", text: "select-text", all: "select-all", auto: "select-auto" }[v] ?? `[user-select:${arb(v)}]`];
    case "backdrop-filter": {
      const m = /^blur\(([^)]+)\)$/.exec(v);
      return [m ? `backdrop-blur-[${arb(m[1]!)}]` : `backdrop-[${arb(v)}]`];
    }
    case "object-fit": return [["cover", "contain", "fill", "none", "scale-down"].includes(v) ? `object-${v}` : `[object-fit:${arb(v)}]`];
    case "visibility": return [v === "hidden" ? "invisible" : v === "visible" ? "visible" : `[visibility:${arb(v)}]`];
    default:
      return [`[${prop}:${arb(rolesIn(v, ctx))}]`];
  }
}

/** Every declaration of a style, as classes, in order, each once. */
export function classesOf(style: string | [string, string][], ctx: TwContext, drop: (prop: string, value: string) => boolean = () => false): string[] {
  const decls = typeof style === "string" ? declarations(style) : style;
  const out: string[] = [];
  for (const [p, v] of decls) {
    if (drop(p, v)) continue;
    for (const c of classOf(p, v, ctx)) if (!out.includes(c)) out.push(c);
  }
  return out;
}
