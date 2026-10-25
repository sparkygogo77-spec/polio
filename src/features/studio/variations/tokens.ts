/**
 * A VARIATION'S TOKENS: the original System's tokens moved onto a spec's
 * choices, inside rules that keep the site tidy.
 *
 *   · colours: each colour keeps its lightness (what the eye reads), so a
 *     dark page stays dark and words that read still read. Its hue turns by
 *     as much as the site's accent turns, and lands on the nearest hue of
 *     the new harmony; its strength goes to the chosen chroma (greys stay
 *     grey, tinted toward the new hue). Words (`text`, `muted`, and colours
 *     the site uses for words) are then held at 4.5 to 1 on the page;
 *   · type: every size is read as a step n on the original's scale and
 *     drawn at base × ratio^n of the new one, so many near sizes become few;
 *     the faces become the pairing's (the largest face is the heading's);
 *   · space and corners: every space becomes a whole number of the chosen
 *     step (density folded in, nothing below one step, 0 stays 0); corners
 *     go to the chosen family by size, pills stay pills, square stays square;
 *   · motion: durations scaled to the style, easings set to its curve.
 *
 * A layer whose choice is null is left exactly as the original has it: its
 * tokens are not touched at all.
 *
 * Pure. Every step goes through `system/link.ts#setTokenValue`, the one
 * gate a token's value passes, so nothing written here is a value a token
 * cannot hold.
 */
import { setTokenValue } from "../system/link.ts";
import type { ColourToken, CssToken, FaceToken, SizeToken, System } from "../system/model.ts";
import { contrast, cssOf, fit, harmonyHues, motionOf, oklchOf, pairingOf, readableOn, READABLE, type Oklch, type SiteTheme } from "../siteTheme.ts";
import type { ColourChoice, MotionChoice, SpaceChoice, Spec, TypeChoice } from "./model.ts";

/** Which faces head the page: the face tokens worn at the largest size. Worked out from the parts (`make.ts`). */
export type FaceRoles = Map<string, "heading" | "body">;

const hueGap = (a: number, b: number) => { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); };

/** The site's accent hue: the accent role's, else the most chromatic colour token's. */
export function accentHue(s: System): number | null {
  const all = s.tokens.colour.map((t) => ({ t, o: oklchOf(t.value) })).filter((x) => x.o);
  const acc = all.find((x) => x.t.role === "accent" && x.o!.c > 0.03) ?? [...all].sort((a, b) => b.o!.c - a.o!.c)[0];
  return acc && acc.o!.c > 0.03 ? Math.round(acc.o!.h) : null;
}

const isWords = (t: ColourToken) => t.role === "text" || t.role === "muted" || t.use === "Words" || t.use === "Default ink";

export function colourValue(value: string, c: ColourChoice, fromHue: number): string | null {
  const o = oklchOf(value);
  if (!o) return null;
  const hues = harmonyHues(c.hue, c.harmony);
  const turned = (o.h + (c.hue - fromHue) + 360) % 360;
  let h = hues.reduce((best, x) => (hueGap(x, turned) < hueGap(best, turned) ? x : best), hues[0]!);
  /* Greys stay grey: a breath of the new hue, never colour. */
  const grey = o.c < 0.03;
  if (grey) h = c.hue;
  const chroma = grey ? Math.min(o.c, 0.012) : Math.max(0.03, Math.min(c.chroma * (o.c / 0.14), c.chroma * 1.3));
  return cssOf(fit({ l: o.l, c: chroma, h }), o.alpha);
}

function colours(s: System, c: ColourChoice): System {
  const from = accentHue(s) ?? c.hue;
  let out = s;
  const next = new Map<string, string>();
  for (const t of s.tokens.colour) { const v = colourValue(t.value, c, from); if (v) next.set(t.id, v); }
  /* Words held at 4.5 to 1 on the page and on its surface. */
  const bgTok = s.tokens.colour.find((t) => t.role === "bg");
  const surfTok = s.tokens.colour.find((t) => t.role === "surface");
  const bg = bgTok ? oklchOf(next.get(bgTok.id) ?? bgTok.value) : null;
  const surf = surfTok ? oklchOf(next.get(surfTok.id) ?? surfTok.value) : null;
  for (const t of s.tokens.colour) {
    if (!isWords(t) || !bg) continue;
    const v = oklchOf(next.get(t.id) ?? t.value);
    if (!v || v.alpha < 0.999) continue;
    const dark = v.l < bg.l;
    let held: Oklch = v;
    if (contrast(held, bg) < READABLE) held = readableOn(held, bg, dark);
    if (surf && contrast(held, surf) < READABLE && dark === v.l < surf.l) held = readableOn(held, surf, dark);
    next.set(t.id, cssOf(held));
  }
  for (const [id, v] of next) out = setTokenValue(out, id, v) ?? out;
  return out;
}

/** The step a size is on a scale, from its base. */
const stepOf = (px: number, base: number, ratio: number) => Math.round(Math.log(px / base) / Math.log(ratio));

export function typeSizes(sizes: readonly number[], from: { ratio: number; base: number }, to: TypeChoice): number[] {
  return sizes.map((px) => (px > 0 ? Math.max(10, Math.round(to.base * to.ratio ** stepOf(px, from.base, from.ratio))) : px));
}

const firstFamily = (stack: string) => stack.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "");

function type(s: System, t: TypeChoice, faceRoles: FaceRoles): System {
  const steps = s.tokens.type.steps;
  const from = s.tokens.type.scale ?? { ratio: 1.25, base: 16 };
  const sizes = typeSizes(steps.map((x) => x.px), from, t);
  let out = s;
  steps.forEach((x, i) => { out = setTokenValue(out, x.id, sizes[i]!) ?? out; });
  const p = pairingOf(t.pairing);
  for (const f of s.tokens.type.faces) {
    const stack = faceRoles.get(f.id) === "heading" ? p.heading : p.body;
    out = setTokenValue(out, f.id, stack, firstFamily(stack)) ?? out;
  }
  return out;
}

/** A space on the chosen step: density folded in, at least one step, 0 kept. */
export function snapSpace(px: number, c: SpaceChoice): number {
  if (!(px > 0)) return 0;
  return Math.max(c.step, Math.round((px * c.density) / c.step) * c.step);
}

/** A corner in the chosen family: by how big it was. */
export function snapCorner(px: number, c: SpaceChoice): number {
  if (!(px > 0)) return 0;
  if (px >= 500) return px;
  const big = px > 10;
  switch (c.corner) {
    case "square": return 0;
    case "soft": return big ? 8 : 4;
    case "round": return big ? 20 : 10;
    case "pill": return big ? 28 : 999;
  }
}

function space(s: System, c: SpaceChoice): System {
  let out = s;
  for (const x of s.tokens.space) out = setTokenValue(out, x.id, snapSpace(x.px, c)) ?? out;
  for (const x of s.tokens.radius) out = setTokenValue(out, x.id, snapCorner(x.px, c)) ?? out;
  return out;
}

const SPEED: Record<MotionChoice["style"], number> = { calm: 1.4, bouncy: 1.1, snappy: 0.5 };
/** A duration (`0.3s`, `300ms`, or several) scaled; null for one that is not a duration. */
export function scaleDuration(css: string, k: number): string | null {
  const parts = css.split(",").map((p) => p.trim());
  const out = parts.map((p) => {
    const m = /^([\d.]+)(ms|s)$/.exec(p);
    if (!m) return null;
    const ms = Number(m[1]) * (m[2] === "s" ? 1000 : 1);
    return ms === 0 ? "0s" : `${Math.max(40, Math.round(ms * k)) / 1000}s`;
  });
  return out.every((x) => x) ? out.join(", ") : null;
}

function motion(s: System, m: MotionChoice): System {
  let out = s;
  for (const d of s.tokens.motion.durations) { const v = scaleDuration(d.css, SPEED[m.style]); if (v) out = setTokenValue(out, d.id, v) ?? out; }
  const curve = motionOf({ motion: { style: m.style } } as SiteTheme).timing;
  for (const e of s.tokens.motion.easings) out = setTokenValue(out, e.id, curve) ?? out;
  return out;
}

/** The System as the spec has it; layers whose choice is null untouched. */
export function systemFor(s: System, spec: Spec, faceRoles: FaceRoles = new Map()): System {
  let out = s;
  if (spec.colours) out = colours(out, spec.colours);
  if (spec.type) out = type(out, spec.type, faceRoles);
  if (spec.space) out = space(out, spec.space);
  if (spec.motion) out = motion(out, spec.motion);
  return out;
}

/** Every token's value, by kind, in the System's order: what the checks compare. */
export function tokenValues(s: System): Record<"colour" | "type" | "face" | "space" | "radius" | "shadow" | "duration" | "easing", (string | number)[]> {
  const v = (t: ColourToken | SizeToken | CssToken | FaceToken) => ("px" in t ? t.px : "css" in t ? t.css : "stack" in t ? t.stack : t.value);
  const T = s.tokens;
  return {
    colour: T.colour.map(v), type: T.type.steps.map(v), face: T.type.faces.map(v), space: T.space.map(v),
    radius: T.radius.map(v), shadow: T.shadow.map(v), duration: T.motion.durations.map(v), easing: T.motion.easings.map(v),
  };
}
