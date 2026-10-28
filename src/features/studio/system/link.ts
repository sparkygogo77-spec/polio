/**
 * Changing a System, and what its parts point at: pure steps the store runs.
 *
 *   · a token's value, name, a new token, a token taken out;
 *   · a part's field pointed at a token (and drawn with its value), let go
 *     of it ("change just this one": the part keeps the value it shows), or
 *     a part taken out of the System altogether (`detach`);
 *   · a whole System copied to diverge (`fork`), and a site's parts moved
 *     onto the copy (`onSystem`);
 *   · a component's variant: a state's look (hover, pressed, focus,
 *     disabled), a slot pointed at another token or value, a new variant, a
 *     component made from one part. Instances follow a slot's change in the
 *     same step (`bind.ts#rebind`); a token's value change reaches them, as
 *     it reaches every part pointing at it.
 *
 * Every step that changes a System hands back a new one with `rev` bumped
 * and `editedAt` stamped, so whatever drew the old one draws the new one.
 *
 * Pure. `tests/system-take.mjs`.
 */
import { colourKey } from "../look/index.ts";
import type { ComponentKind } from "../components.ts";
import {
  ID_PREFIX, kindOfField, kindOfToken, newSystemId, tokenById, valueOf,
  type ColourToken, type CssToken, type FaceToken, type FieldPath, type LookRef, type LookRefs, type LookSlot, type NodeSys, type SizeToken, type StateLook, type StateName,
  type System, type SystemComponent, type TokenKind, type TokenValue, type Variant,
} from "./model.ts";
import { fieldValue, sameValue, withField, type SysNode } from "./resolve.ts";

type AnyToken = ColourToken | SizeToken | CssToken | FaceToken;

const stamp = (s: System, at = Date.now()): System => ({ ...s, rev: s.rev + 1, editedAt: Math.max(at, s.editedAt + 1) });

/** The System with one token's list replaced through `fn`. */
function mapTokens(s: System, kind: TokenKind, fn: (list: AnyToken[]) => AnyToken[]): System {
  const t = s.tokens;
  const tokens =
    kind === "colour" ? { ...t, colour: fn(t.colour) as ColourToken[] }
      : kind === "type" ? { ...t, type: { ...t.type, steps: fn(t.type.steps) as SizeToken[] } }
        : kind === "face" ? { ...t, type: { ...t.type, faces: fn(t.type.faces) as FaceToken[] } }
          : kind === "space" ? { ...t, space: fn(t.space) as SizeToken[] }
            : kind === "radius" ? { ...t, radius: fn(t.radius) as SizeToken[] }
              : kind === "shadow" ? { ...t, shadow: fn(t.shadow) as CssToken[] }
                : kind === "duration" ? { ...t, motion: { ...t.motion, durations: fn(t.motion.durations) as CssToken[] } }
                  : { ...t, motion: { ...t.motion, easings: fn(t.motion.easings) as CssToken[] } };
  return { ...s, tokens };
}

/** A value fit for a token of this kind, or null: a colour that is a colour, a size that is a finite px, a CSS value with nothing that could leave its declaration. */
export function checkValue(kind: TokenKind, v: unknown): TokenValue | null {
  if (kind === "type" || kind === "space" || kind === "radius") {
    const n = typeof v === "string" ? Number(v) : v;
    return typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 100000 ? n : null;
  }
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s || s.length > 600 || /[{};<>\\]|\/\*|expression\s*\(|javascript:/i.test(s)) return null;
  if (kind === "colour") return colourKey(s) || /^(oklch|hsla?|color)\(/i.test(s) ? s : null;
  return s;
}

/** The System with a token's value changed; the same System when the value is the one it holds, null when the value is not one. */
export function setTokenValue(s: System, id: string, value: unknown, face?: string): System | null {
  const kind = kindOfToken(id);
  const t = tokenById(s, id);
  if (!kind || !t) return null;
  const v = checkValue(kind, value);
  if (v === null) return null;
  if (sameValue(kind, valueOf(t), v) && (kind !== "face" || face === undefined || (t as FaceToken).face === face)) return s;
  return stamp(mapTokens(s, kind, (list) => list.map((x) => {
    if (x.id !== id) return x;
    if ("px" in x) return { ...x, px: v as number };
    if ("css" in x) return { ...x, css: v as string };
    if ("stack" in x) return { ...x, stack: v as string, ...(face !== undefined ? { face } : {}) };
    return { ...x, value: v as string };
  })));
}

export function renameToken(s: System, id: string, name: string): System | null {
  const kind = kindOfToken(id);
  const n = name.trim().slice(0, 80);
  if (!kind || !n || !tokenById(s, id)) return null;
  return stamp(mapTokens(s, kind, (list) => list.map((x) => (x.id === id ? { ...x, name: n } : x))));
}

/** A new token of a kind: its id is the next free one of that kind. */
export function addToken(s: System, kind: TokenKind, name: string, value: unknown, more: { role?: ColourToken["role"]; face?: string } = {}): { system: System; id: string } | null {
  const v = checkValue(kind, value);
  if (v === null) return null;
  const pre = ID_PREFIX[kind];
  const ids = new Set<string>();
  mapTokens(s, kind, (list) => { for (const x of list) ids.add(x.id); return list; });
  let k = ids.size + 1;
  while (ids.has(`${pre}_${k}`)) k++;
  const id = `${pre}_${k}`;
  const nm = name.trim().slice(0, 80) || id;
  const token: AnyToken =
    kind === "colour" ? { id, name: nm, value: v as string, ...(more.role ? { role: more.role } : {}) }
      : kind === "face" ? { id, name: nm, stack: v as string, ...(more.face ? { face: more.face } : {}) }
        : kind === "shadow" || kind === "duration" || kind === "easing" ? { id, name: nm, css: v as string }
          : { id, name: nm, px: v as number };
  return { system: stamp(mapTokens(s, kind, (list) => [...list, token])), id };
}

/** The System without a token. The parts pointing at it keep the value they show (`unlinkToken`). */
export function removeToken(s: System, id: string): System | null {
  const kind = kindOfToken(id);
  if (!kind || !tokenById(s, id)) return null;
  return stamp(mapTokens(s, kind, (list) => list.filter((x) => x.id !== id)));
}

/* ------------------------------------------------------------------ */
/* Parts                                                               */
/* ------------------------------------------------------------------ */

const withRefs = <N extends SysNode>(n: N, sys: NodeSys | null): N => {
  if (!sys || (!sys.f && !sys.c)) { if (!n.sys) return n; const { sys: _s, ...rest } = n; void _s; return rest as N; }
  return { ...n, sys };
};

/** Point a part's field at a token, and draw it with the token's value. Null when the field cannot take that kind of token. */
export function linkField<N extends SysNode>(n: N, s: System, field: FieldPath, tokenId: string): N | null {
  const kind = kindOfField(field);
  const t = tokenById(s, tokenId);
  if (!kind || !t || kindOfToken(tokenId) !== kind) return null;
  const now = n.sys?.s === s.id ? n.sys : { s: s.id };
  const linked = withRefs(n, { ...now, f: { ...(now.f ?? {}), [field]: tokenId }, v: { ...(now.v ?? {}), [field]: valueOf(t) } });
  return withField(linked, field, valueOf(t), "stack" in t ? t.face : undefined);
}

/** Let a field go of its token: it keeps the value it shows, as its own. */
export function unlinkField<N extends SysNode>(n: N, field: FieldPath): N {
  if (!n.sys?.f?.[field]) return n;
  const f = { ...n.sys.f };
  delete f[field];
  const v = { ...(n.sys.v ?? {}) };
  delete v[field];
  return withRefs(n, { ...n.sys, f: Object.keys(f).length ? f : undefined, v: Object.keys(v).length ? v : undefined });
}

/** Every part pointing at a token lets go of it. */
export function unlinkToken<N extends SysNode>(nodes: readonly N[], tokenId: string): N[] {
  return nodes.map((n) => {
    let out = n;
    for (const [f, id] of Object.entries(n.sys?.f ?? {})) if (id === tokenId) out = unlinkField(out, f as FieldPath);
    return out;
  });
}

/** Out of the System altogether: every field keeps the value it shows, and no component claims it. */
export function detach<N extends SysNode>(n: N): N { return withRefs(n, null); }

/** The ids of the parts pointing at a token (or, for a component id, its instances). */
export function usedBy(nodes: readonly SysNode[], id: string): string[] {
  return nodes.filter((n) => (id.startsWith("cmp_") ? n.sys?.c?.component === id : Object.values(n.sys?.f ?? {}).includes(id))).map((n) => n.id);
}

/** How many fields point at each token, across these parts. */
export function pointerCounts(nodes: readonly SysNode[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const n of nodes) for (const id of Object.values(n.sys?.f ?? {})) if (id) out.set(id, (out.get(id) ?? 0) + 1);
  return out;
}

/** Is this field's value the one its token holds? False is an override drawn over by the token, which `resolve` fixes at draw time. */
export function holds(n: SysNode, s: System, field: FieldPath): boolean {
  const id = n.sys?.f?.[field];
  const t = id ? tokenById(s, id) : null;
  const kind = kindOfField(field);
  return !!t && !!kind && sameValue(kind, fieldValue(n, field), valueOf(t));
}

/* ------------------------------------------------------------------ */
/* Components                                                          */
/* ------------------------------------------------------------------ */

/** The System with one component's variant replaced through `fn`; null when there is no such variant. */
function mapVariant(s: System, component: string, variant: string, fn: (v: Variant) => Variant): System | null {
  const c = s.components.find((x) => x.id === component);
  const v = c?.variants.find((x) => x.id === variant);
  if (!c || !v) return null;
  const next = fn(v);
  if (next === v) return s;
  return stamp({
    ...s,
    components: s.components.map((x) => (x.id !== component ? x : {
      ...x,
      variants: x.variants.map((y) => (y.id === variant ? next : y)),
      /* The most-used variant's look is the component's base: it follows. */
      base: x.variants[0]?.id === variant ? next.look : x.base,
    })),
  });
}

const STATE_LIMIT = { dx: 400, dy: 400, rotate: 360, scale: 4 };

/** A state's look as a person may set it: finite moves within reason, a shadow that is a CSS value. Null for anything else. */
export function checkState(v: unknown): StateLook | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (k: keyof typeof STATE_LIMIT, rest: number) => {
    const x = o[k] === undefined ? rest : o[k];
    return typeof x === "number" && Number.isFinite(x) && Math.abs(x) <= STATE_LIMIT[k] ? x : null;
  };
  const dx = n("dx", 0), dy = n("dy", 0), rotate = n("rotate", 0), scale = n("scale", 1);
  if (dx === null || dy === null || rotate === null || scale === null || scale <= 0) return null;
  const sh = o.shadow === undefined || o.shadow === null || o.shadow === "" ? null : checkValue("shadow", o.shadow);
  if (o.shadow && sh === null) return null;
  return { dx, dy, rotate, scale, shadow: sh as string | null };
}

/** A variant's state set (or, for null, back to doing nothing). `rest` is the look itself and is not a state here. */
export function setVariantState(s: System, component: string, variant: string, state: Exclude<StateName, "rest">, look: unknown): System | null {
  const next = look === null ? null : checkState(look);
  if (look !== null && !next) return null;
  return mapVariant(s, component, variant, (v) => (JSON.stringify(v.states[state]) === JSON.stringify(next) ? v : { ...v, states: { ...v.states, [state]: next } }));
}

/**
 * A variant's slot pointed at a token, or given a value of its own. A value
 * some token of the slot's kind already holds points at that token, so the
 * System stays one set of values. The instances follow in the same step
 * (`bind.ts#rebind`). Null for a token of another kind or a value that is
 * not one; the same System when the slot already holds it.
 */
export function setVariantSlot(s: System, component: string, variant: string, slot: LookSlot, to: { token: string } | { value: unknown }, kind: TokenKind): System | null {
  let ref: LookRef;
  if ("token" in to) {
    if (!tokenById(s, to.token) || kindOfToken(to.token) !== kind) return null;
    ref = { token: to.token };
  } else {
    const v = checkValue(kind, to.value);
    if (v === null) return null;
    const held = allOfKind(s, kind).find((t) => sameValue(kind, valueOf(t), v));
    ref = held ? { token: held.id } : { value: v };
  }
  return mapVariant(s, component, variant, (x) => (JSON.stringify(x.look[slot] ?? null) === JSON.stringify(ref) ? x : { ...x, look: { ...x.look, [slot]: ref } }));
}

/** Every token of one kind. */
function allOfKind(s: System, kind: TokenKind): AnyToken[] {
  let out: AnyToken[] = [];
  mapTokens(s, kind, (list) => { out = list; return list; });
  return out;
}

/** A new variant of a component, a copy of one it has: its own id, no instances yet. */
export function addVariant(s: System, component: string, from: string, name: string): { system: System; id: string } | null {
  const c = s.components.find((x) => x.id === component);
  const v = c?.variants.find((x) => x.id === from);
  if (!c || !v) return null;
  const ids = new Set(c.variants.map((x) => x.id));
  let k = c.variants.length + 1;
  while (ids.has(`var_${k}`)) k++;
  const id = `var_${k}`;
  const taken = new Set(c.variants.map((x) => x.name.toLowerCase()));
  let nm = name.trim().slice(0, 80) || `${c.name} ${k}`;
  for (let j = 2; taken.has(nm.toLowerCase()); j++) nm = `${name.trim() || c.name} ${j}`;
  const copy: Variant = { ...structuredClone(v), id, name: nm, count: 0 };
  return { system: stamp({ ...s, components: s.components.map((x) => (x.id === component ? { ...x, variants: [...x.variants, copy] } : x)) }), id };
}

/** The look a part wears, as a component's slots: each from the field's token where it points at one, else its own value. */
export function lookOfPart(n: SysNode): LookRefs {
  const out: LookRefs = {};
  const put = (slot: LookSlot, field: FieldPath) => {
    const id = n.sys?.f?.[field];
    const v = fieldValue(n, field);
    if (id) out[slot] = { token: id };
    else if (v !== undefined && v !== "") out[slot] = { value: v };
  };
  put("fill", "colour.bg");
  put("words", "colour.text");
  put("outline", "edge.colour");
  put("shadow", "edge.shadow");
  put("radius", "radius");
  put("face", "font.stack");
  put("size", "font.px");
  return out;
}

/** A component made from one part: its look is the part's, and the part is its first instance. Null when the System already has a component of this kind and name. */
export function componentFromPart<N extends SysNode>(s: System, n: N, kind: ComponentKind, name: string): { system: System; node: N; id: string } | null {
  const ids = new Set(s.components.map((c) => c.id));
  let id = `cmp_${kind}`;
  for (let k = 2; ids.has(id); k++) id = `cmp_${kind}_${k}`;
  const look = lookOfPart(n);
  const variant: Variant = { id: "var_1", name: "Main", look, states: { hover: null, pressed: null, focus: null, disabled: null }, count: 1 };
  const comp: SystemComponent = { id, name: name.trim().slice(0, 80) || id, kind, base: look, variants: [variant], parts: [] };
  const system = stamp({ ...s, components: [...s.components, comp] });
  const now = n.sys?.s === s.id ? n.sys : { s: s.id };
  return { system, node: withRefs(n, { ...now, c: { component: id, variant: "var_1" } }), id };
}

/** The part as an instance of a component's variant (or, for null, of none). */
export function setInstance<N extends SysNode>(n: N, s: System, c: { component: string; variant: string } | null): N | null {
  if (c && !s.components.find((x) => x.id === c.component)?.variants.some((v) => v.id === c.variant)) return null;
  const now = n.sys?.s === s.id ? n.sys : { s: s.id };
  return withRefs(n, { ...now, c });
}

/* ------------------------------------------------------------------ */
/* Copies                                                              */
/* ------------------------------------------------------------------ */

/** A copy to diverge: its own id, the same tokens and components (same ids, so the parts' pointers carry over), saying whose copy it is. Never the house style itself. */
export function fork(s: System, name?: string, at = Date.now()): System {
  const { house: _h, ...copy } = structuredClone(s);
  void _h;
  return { ...copy, id: newSystemId(), name: (name ?? `${s.name} (own copy)`).trim().slice(0, 120), from: "copied", forkOf: s.id, rev: 1, editedAt: at };
}

/** Parts that pointed at one System, pointing at another (a fork of it): the same tokens by id. */
export function onSystem<N extends SysNode>(nodes: readonly N[], from: string, to: string): N[] {
  return nodes.map((n) => (n.sys?.s === from ? { ...n, sys: { ...n.sys, s: to } } : n));
}
