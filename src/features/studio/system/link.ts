/**
 * Changing a System, and what its parts point at: pure steps the store runs.
 *
 *   · a token's value, name, a new token, a token taken out;
 *   · a part's field pointed at a token (and drawn with its value), let go
 *     of it ("change just this one": the part keeps the value it shows), or
 *     a part taken out of the System altogether (`detach`);
 *   · a whole System copied to diverge (`fork`), and a site's parts moved
 *     onto the copy (`onSystem`).
 *
 * Every step that changes a System hands back a new one with `rev` bumped
 * and `editedAt` stamped, so whatever drew the old one draws the new one.
 *
 * Pure. `tests/system-take.mjs`.
 */
import { colourKey } from "../look/index.ts";
import {
  ID_PREFIX, kindOfField, kindOfToken, newSystemId, tokenById, valueOf,
  type ColourToken, type CssToken, type FaceToken, type FieldPath, type NodeSys, type SizeToken, type System, type TokenKind, type TokenValue,
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
/* Copies                                                              */
/* ------------------------------------------------------------------ */

/** A copy to diverge: its own id, the same tokens and components (same ids, so the parts' pointers carry over), saying whose copy it is. */
export function fork(s: System, name?: string, at = Date.now()): System {
  return { ...structuredClone(s), id: newSystemId(), name: (name ?? `${s.name} (own copy)`).trim().slice(0, 120), from: "copied", forkOf: s.id, rev: 1, editedAt: at };
}

/** Parts that pointed at one System, pointing at another (a fork of it): the same tokens by id. */
export function onSystem<N extends SysNode>(nodes: readonly N[], from: string, to: string): N[] {
  return nodes.map((n) => (n.sys?.s === from ? { ...n, sys: { ...n.sys, s: to } } : n));
}
