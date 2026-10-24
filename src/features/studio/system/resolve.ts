/**
 * A PART THAT POINTS AT A TOKEN DRAWS THE TOKEN'S VALUE.
 *
 * `resolveNode(node, system)` hands back the node with every field that
 * points at a token holding that token's value, and the same node, the very
 * same object, when nothing differs. The part renderers never learn that
 * tokens exist: `Block` asks this first (`useResolved`, `api.ts`), and every
 * other reader of a part's fields (the word fitting, the export, the
 * blueprint) reads the same values because a token change also writes them
 * into the document (`materialise`), in the same undo step.
 *
 * EXACT, NEVER ROUNDED. A field whose value already equals its token's
 * (colours compared as one colour, `#fff` and `rgb(255, 255, 255)` alike)
 * is left as it is, string and all, so taking a System from a site, which
 * only adds the pointers, cannot move a pixel.
 *
 * Pure: no React, no store, every import ends in .ts.
 */
import { colourKey, type Palette, type RoleId } from "../look/index.ts";
import { kindOfField, tokenById, valueOf, type FieldPath, type NodeSys, type System, type TokenKind, type TokenValue } from "./model.ts";

/** A part as far as the System reads and writes it. */
export interface SysNode {
  id: string;
  sys?: NodeSys | null;
  colour?: Partial<Record<string, string>> | null;
  edge?: { width?: number; style?: string; colour?: string; shadow?: string } | null;
  radius?: number | null;
  pad?: { top?: number; right?: number; bottom?: number; left?: number } | null;
  layout?: { gap?: number } | null;
  font?: { px?: number; size?: number; stack?: string; face?: string } | null;
  motion?: { transition?: { property: string; duration?: string; timing?: string; delay?: string }[] } | null;
}

const css = (v: string) => v.trim().replace(/\s+/g, " ");

/** Two values of one kind are the same value when they draw the same. */
export function sameValue(kind: TokenKind, a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (kind === "colour") return typeof a === "string" && typeof b === "string" && !!colourKey(a) && colourKey(a) === colourKey(b);
  if (kind === "type" || kind === "space" || kind === "radius") return typeof a === "number" && typeof b === "number" && a === b;
  return typeof a === "string" && typeof b === "string" && css(a) === css(b);
}

const motionAt = (f: string) => /^motion\.transition\.(\d+)\.(duration|timing)$/.exec(f);

/** The value a part's field holds now, or undefined when it holds none. */
export function fieldValue(n: SysNode, f: FieldPath | string): TokenValue | undefined {
  const [head, tail] = f.split(".") as [string, string | undefined];
  if (head === "colour") return n.colour?.[tail!] ?? undefined;
  if (f === "edge.colour") return n.edge?.colour ?? undefined;
  if (f === "edge.shadow") return n.edge?.shadow ?? undefined;
  if (f === "radius") return typeof n.radius === "number" ? n.radius : undefined;
  if (head === "pad") return n.pad?.[tail as "top"] ?? undefined;
  if (f === "layout.gap") return typeof n.layout?.gap === "number" ? n.layout.gap : undefined;
  if (f === "font.px") return typeof n.font?.px === "number" ? n.font.px : undefined;
  if (f === "font.stack") return n.font?.stack ?? undefined;
  const m = motionAt(f);
  if (m) { const t = n.motion?.transition?.[Number(m[1])]; return (m[2] === "duration" ? t?.duration : t?.timing) ?? undefined; }
  return undefined;
}

/**
 * The part with one field set to a value. A size in `font.px` keeps
 * `font.size` (the multiple of the site's base it is drawn beside) in step;
 * a face sets the face's name with its stack.
 */
export function withField<N extends SysNode>(n: N, f: FieldPath | string, v: TokenValue, face?: string): N {
  const [head, tail] = f.split(".") as [string, string | undefined];
  if (head === "colour" && typeof v === "string") return { ...n, colour: { ...(n.colour ?? {}), [tail!]: v } };
  if (f === "edge.colour" && typeof v === "string") return { ...n, edge: { ...(n.edge ?? {}), colour: v } };
  if (f === "edge.shadow" && typeof v === "string") return { ...n, edge: { ...(n.edge ?? {}), shadow: v } };
  if (f === "radius" && typeof v === "number") return { ...n, radius: v };
  if (head === "pad" && typeof v === "number") return { ...n, pad: { ...(n.pad ?? {}), [tail!]: v } };
  if (f === "layout.gap" && typeof v === "number") return { ...n, layout: { ...(n.layout ?? {}), gap: v } };
  if (f === "font.px" && typeof v === "number") {
    const was = n.font?.px;
    const size = typeof n.font?.size === "number" && typeof was === "number" && was > 0 ? +(n.font.size * (v / was)).toFixed(6) : n.font?.size;
    return { ...n, font: { ...(n.font ?? {}), px: v, ...(size !== undefined ? { size } : {}) } };
  }
  if (f === "font.stack" && typeof v === "string") return { ...n, font: { ...(n.font ?? {}), stack: v, ...(face ? { face } : {}) } };
  const m = motionAt(f);
  if (m && typeof v === "string" && n.motion?.transition?.[Number(m[1])]) {
    const i = Number(m[1]);
    const transition = n.motion.transition.map((t, k) => (k === i ? { ...t, [m[2] === "duration" ? "duration" : "timing"]: v } : t));
    return { ...n, motion: { ...n.motion, transition } };
  }
  return n;
}

/** What a token puts in a field: its value, and for a face its name. */
function tokenFor(s: System, id: string): { kind: TokenKind; value: TokenValue; face?: string } | null {
  const t = tokenById(s, id);
  if (!t) return null;
  const kind = id.startsWith("col_") ? "colour" : id.startsWith("typ_") ? "type" : id.startsWith("fac_") ? "face" : id.startsWith("spc_") ? "space" : id.startsWith("rad_") ? "radius" : id.startsWith("shd_") ? "shadow" : id.startsWith("dur_") ? "duration" : "easing";
  return { kind, value: valueOf(t), ...("stack" in t && t.face ? { face: t.face } : {}) };
}

/** The node with its token fields as the System has them; the same object when nothing differs. */
export function resolveWith<N extends SysNode>(n: N, s: System | null | undefined): N {
  const sys = n.sys;
  if (!sys?.f || !s || s.id !== sys.s) return n;
  let out = n;
  const wrote: Record<string, TokenValue> = {};
  for (const [f, id] of Object.entries(sys.f)) {
    if (!id) continue;
    const kind = kindOfField(f);
    const tok = tokenFor(s, id);
    if (!kind || !tok || tok.kind !== kind) continue;
    const now = fieldValue(out, f);
    const held = sys.v?.[f as FieldPath];
    /* Set apart from the System since it was written (an override, or a value worked out where it is drawn): left as it is. */
    if (held !== undefined && !sameValue(kind, now, held)) continue;
    if (sameValue(kind, now, tok.value) && (kind !== "face" || !tok.face || out.font?.face === tok.face)) continue;
    out = withField(out, f, tok.value, tok.face);
    wrote[f] = tok.value;
  }
  if (out === n) return n;
  return { ...out, sys: { ...sys, v: { ...(sys.v ?? {}), ...wrote } } };
}

/* One answer per part per System version: a board draws a part many times, and a System changes rarely. */
const memo = new WeakMap<object, { s: System; out: object }>();
export function resolveNode<N extends SysNode>(n: N, s: System | null | undefined): N {
  if (!n.sys?.f || !s) return n;
  const had = memo.get(n);
  if (had && had.s === s) return had.out as N;
  const out = resolveWith(n, s);
  memo.set(n, { s, out });
  return out;
}

/**
 * Every part of a document as its System has it: the parts that changed, by
 * id, and the whole list (the same array when nothing did).
 */
export function materialise<N extends SysNode>(nodes: readonly N[], s: System | null | undefined): { nodes: readonly N[]; changed: string[] } {
  if (!s) return { nodes, changed: [] };
  const changed: string[] = [];
  const out = nodes.map((n) => {
    const r = resolveWith(n, s);
    if (r !== n) changed.push(n.id);
    return r;
  });
  return { nodes: changed.length ? out : nodes, changed };
}

/** The palette roles the System's colour tokens hold, for the site's `look.palette`. */
export function rolesOf(s: System): Partial<Palette> {
  const out: Partial<Palette> = {};
  for (const t of s.tokens.colour) if (t.role && !out[t.role]) out[t.role] = t.value;
  return out;
}

/** The site's palette with every role a token holds set to it; the same object when each already is. */
export function paletteWith(palette: Partial<Palette> | undefined, s: System): Partial<Palette> | undefined {
  const want = rolesOf(s);
  let out = palette;
  for (const [r, v] of Object.entries(want) as [RoleId, string][]) {
    if (out && sameValue("colour", out[r], v)) continue;
    out = { ...(out ?? {}), [r]: v };
  }
  return out;
}
