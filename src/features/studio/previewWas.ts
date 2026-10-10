"use client";
/**
 * WHAT COLOURS' RESET PUTS BACK, BEYOND THE COLOURS.
 *
 * The Colours preview's editors change more than colours: a kind's Corners,
 * the glow on its words, its font, its texture (and the site's own dots).
 * Reset only put the colours back (`look.coloursWas`), so the rest stayed
 * (polio/next-issues.md item 6, J 2026-10-10: "next"). Each editor now calls
 * `keepBefore` with the parts it is about to change: the first time a part
 * is touched, its look as it was is kept (`look.lookWas`, and its colours in
 * `look.coloursWas` if they were not kept yet), and the texture stack as it
 * was before the first texture change (`look.textureWas`). Reset puts all of
 * it back in one undo step (`SiteColours.tsx#resetColours`).
 */
import { useStudio, type StudioNode } from "./board/store";
import { coloursOf } from "./look";

/** The look fields the preview's editors write on a part. */
export const LOOK_KEYS = ["colour", "content", "edge", "art", "aura", "radius", "radii", "radiiY", "font", "texture"] as const;

type Kept = Partial<Record<(typeof LOOK_KEYS)[number], unknown>>;

/** A part's look as it is now: every key, an absent one as undefined so putting it back clears it. */
export function lookOfPart(n: StudioNode): Kept {
  const r = n as unknown as Record<string, unknown>;
  return Object.fromEntries(LOOK_KEYS.map((k) => [k, r[k] === undefined ? undefined : JSON.parse(JSON.stringify(r[k]))])) as Kept;
}

/** Keep these parts' look before their first change here, and the texture stack before its first change. No undo step of its own. */
export function keepBefore(ids: readonly string[], opts: { textures?: boolean } = {}): void {
  const st = useStudio.getState();
  const look = st.look;
  const lookWas = (look.lookWas ?? {}) as Record<string, Kept>;
  const coloursWas = look.coloursWas ?? {};
  const want = new Set(ids.filter((id) => !lookWas[id]));
  const keepTex = opts.textures && look.textureWas === undefined;
  if (!want.size && !keepTex) return;
  const nextLook: Record<string, Kept> = { ...lookWas };
  const nextColours = { ...coloursWas };
  for (const n of st.nodes) {
    if (!want.has(n.id)) continue;
    nextLook[n.id] = lookOfPart(n);
    if (!nextColours[n.id]) nextColours[n.id] = coloursOf(n as never);
  }
  useStudio.setState((s) => ({ look: { ...s.look, lookWas: nextLook, coloursWas: nextColours, ...(keepTex ? { textureWas: JSON.parse(JSON.stringify(s.look.texture ?? [])) } : {}) } }));
}

/** Anything kept to put back. */
export function hasKept(look: unknown): boolean {
  const l = look as { lookWas?: Record<string, unknown>; textureWas?: unknown } | null;
  return !!l && (Object.keys(l.lookWas ?? {}).length > 0 || l.textureWas !== undefined);
}
