import { TEXTURE_KINDS } from "./texture.ts";
import type { TextureTarget } from "./texture.ts";
import { withAlpha } from "./textureCss.ts";
import { defaultLight } from "./light.ts";
import type { Light, Look } from "./light.ts";
import { css, parseColor, ROLES, ROLE_LABEL } from "./colour.ts";
import type { Palette } from "./colour.ts";

/**
 * How a part arrives: which way, how fast, after how long, with what ease.
 *
 * The entrance itself is a CSS animation name (`el-rise` and the rest, in
 * `globals.css`). Speed and delay are **numbers** — a multiplier on the usual
 * length, and a wait in milliseconds — because they come off sliders; the
 * named stops below are what the blueprint calls them and where the slider's
 * ends and middle are. Easing stays a word: there are three, and they are
 * keys, not a scale.
 */
export type AnimSpeed = "slow" | "normal" | "fast" | "faster" | "instant";
export type AnimDelay = "none" | "short" | "long";
export type AnimEase = "smooth" | "snappy" | "bouncy";
export const ANIM_SPEED: { id: AnimSpeed; label: string; k: number }[] = [
  { id: "slow", label: "Slow", k: 1.8 },
  { id: "normal", label: "Normal", k: 1 },
  { id: "fast", label: "Fast", k: 0.55 },
  { id: "faster", label: "Faster", k: 0.32 },
  { id: "instant", label: "Instant", k: 0.14 },
];
export const ANIM_DELAY: { id: AnimDelay; label: string; ms: number }[] = [
  { id: "none", label: "No wait", ms: 0 },
  { id: "short", label: "A beat", ms: 180 },
  { id: "long", label: "A moment", ms: 480 },
];
export const ANIM_EASE: { id: AnimEase; label: string; css: string }[] = [
  { id: "smooth", label: "Smooth", css: "cubic-bezier(0.2, 0.8, 0.2, 1)" },
  { id: "snappy", label: "Snappy", css: "cubic-bezier(0.3, 0, 0.1, 1)" },
  { id: "bouncy", label: "Bouncy", css: "cubic-bezier(0.34, 1.56, 0.64, 1)" },
];
/** The usual length of an entrance; the speed multiplies it. */
export const ENTRANCE_MS = 420;
/** The speed slider's two ends: the slowest named stop to the fastest. */
export const SPEED_K: [number, number] = [1.8, 0.14];
/** The delay slider's far end, in milliseconds. */
export const DELAY_MS = 900;

/** A speed as its multiplier, from a number or from one of the old words. */
export function speedK(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(SPEED_K[0], Math.max(SPEED_K[1], v));
  return ANIM_SPEED.find((s) => s.id === v)?.k ?? 1;
}
/** A delay in milliseconds, from a number or from one of the old words. */
export function delayMs(v: number | string | null | undefined): number {
  if (typeof v === "number" && Number.isFinite(v)) return Math.min(DELAY_MS, Math.max(0, Math.round(v)));
  return ANIM_DELAY.find((d) => d.id === v)?.ms ?? 0;
}
/** The nearest named speed — compared on a log scale, which is how speed is felt. */
export function speedWord(k: number): AnimSpeed {
  let best = ANIM_SPEED[1]!;
  for (const s of ANIM_SPEED) if (Math.abs(Math.log(s.k) - Math.log(k)) < Math.abs(Math.log(best.k) - Math.log(k))) best = s;
  return best.id;
}
/** 0..1 along the speed slider to the multiplier, on a log scale so the middle of the slider is the middle speed. */
export function speedFromSlider(f: number): number {
  const t = Math.min(1, Math.max(0, f));
  return Math.round(SPEED_K[0] * Math.pow(SPEED_K[1] / SPEED_K[0], t) * 100) / 100;
}
export function sliderFromSpeed(k: number): number {
  return Math.log(speedK(k) / SPEED_K[0]) / Math.log(SPEED_K[1] / SPEED_K[0]);
}

/** The `animation` shorthand for a part's entrance, or nothing if it has none. */
export function entranceCss(anim: string | null | undefined, speed: number | AnimSpeed = 1, delay: number | AnimDelay = 0, ease: AnimEase = "smooth"): string | undefined {
  if (!anim) return undefined;
  const k = speedK(speed);
  const ms = delayMs(delay);
  const curve = ANIM_EASE.find((e) => e.id === ease)?.css ?? ANIM_EASE[0]!.css;
  return `${anim} ${Math.round(ENTRANCE_MS * k)}ms ${curve} ${ms}ms both`;
}

/**
 * The aura: a colour round an element's edge.
 *
 * An aura is a colour — a palette role, so it follows the site, or a colour
 * of its own off the spectrum — a size, and a style: a soft **glow**, a hard
 * **ring**, or a glow that **pulses**.
 */
export type AuraStyle = "glow" | "ring" | "pulse";
export const AURA_STYLES: { id: AuraStyle; label: string }[] = [
  { id: "glow", label: "Soft glow" },
  { id: "ring", label: "Hard ring" },
  { id: "pulse", label: "Pulse" },
];
export const AURA_WORD: Record<AuraStyle, string> = { glow: "glowing softly", ring: "as a hard ring", pulse: "pulsing" };

/** The colour an aura resolves to: a role's colour, or the colour itself. */
export function auraColour(aura: string | null | undefined, palette: Palette | undefined): string | null {
  if (!aura) return null;
  const named = palette ? (palette as Record<string, string>)[aura] : undefined;
  if (named) return named;
  return aura.includes("(") ? aura : null;
}

/**
 * The line that says a part is picked, in a colour that is not the app's.
 *
 * It used to be two solid pixels of the accent — the same blue as every
 * button in the shell — drawn round whatever you had selected. Two things
 * were wrong with that. It was the loudest thing on the board, so a part
 * being *edited* was the one part you could not see; and it sat on top of
 * the aura, which is the one thing you are most often editing when the mark
 * is up, so turning an aura on and off changed nothing you could see.
 *
 * The mark is the part's own colour, turned to the far side of the wheel:
 * a hue that cannot be confused with what it is drawn around, at a lightness
 * and chroma that read on both a dark page and a light one. A part with an
 * aura is marked against its aura; a part with a fill of its own is marked
 * against that; a part that has said nothing takes the site's accent, turned.
 *
 * It is one line, and thin, and offset inwards so the aura's own hairline is
 * still outside it and still visible.
 */
export function complementOf(colour: string | null | undefined): string {
  const c = colour ? parseColor(colour) : null;
  // Nothing to answer: a warm yellow, which is nobody's accent here.
  if (!c) return "oklch(0.82 0.19 90)";
  // The far side, lifted to something that reads: a complement borrowed at
  // the part's own lightness would vanish into a dark part.
  return css({ l: 0.82, c: Math.max(0.16, Math.min(0.2, c.c + 0.05)), h: (c.h + 180) % 360 });
}

export function markColour(
  node: { aura?: string | null; colour?: Record<string, string> | null },
  palette: Palette | undefined,
): string {
  const own =
    auraColour(node.aura, palette)
    ?? (node.colour ? Object.values(node.colour).map((v) => (palette as Record<string, string> | undefined)?.[v] ?? v).find((v) => !!parseColor(v)) : undefined)
    ?? palette?.accent
    ?? "oklch(0.72 0.16 205)";
  return complementOf(own);
}

/**
 * The shadow that draws it.
 *
 * A glow is two shadows — a hairline that reads as a border and a wide soft
 * one that reads as light coming off it — so it works on a dark page and a
 * light one without a second setting. A ring is one hard band. `size` scales
 * how far either reaches.
 */
export function auraShadow(aura: string | null | undefined, palette: Palette | undefined, size = 1, style: AuraStyle = "glow"): string | null {
  const colour = auraColour(aura, palette);
  if (!colour) return null;
  const k = Math.max(0.3, Math.min(2.5, size || 1));
  if (style === "ring") {
    return `0 0 0 ${(2.5 * k).toFixed(1)}px ${withAlpha(colour, 0.95)}, 0 0 ${(6 * k).toFixed(1)}px 0 ${withAlpha(colour, 0.35)}`;
  }
  return `0 0 0 1px ${withAlpha(colour, 0.75)}, 0 0 ${(14 * k).toFixed(1)}px ${(2 * k).toFixed(1)}px ${withAlpha(colour, 0.5)}, 0 0 ${(36 * k).toFixed(1)}px ${(6 * k).toFixed(1)}px ${withAlpha(colour, 0.22)}`;
}

/**
 * Everything an element wears for its aura, as style.
 *
 * The shadow, and for a pulse the animation that breathes it: `aura-pulse`
 * in `globals.css` animates the shadow between two reaches off two custom
 * properties, so the one keyframe serves every colour and size.
 */
export function auraStyle(aura: string | null | undefined, palette: Palette | undefined, size = 1, style: AuraStyle = "glow"): Record<string, string | number> | null {
  const shadow = auraShadow(aura, palette, size, style);
  if (!shadow) return null;
  if (style !== "pulse") return { boxShadow: shadow };
  const colour = auraColour(aura, palette)!;
  return {
    boxShadow: shadow,
    animation: "aura-pulse 1.8s ease-in-out infinite",
    "--aura": withAlpha(colour, 0.6),
    "--aura-k": Math.max(0.3, Math.min(2.5, size || 1)),
  };
}

/**
 * The same aura, following the shape rather than the box round it.
 *
 * `box-shadow` can only glow a rectangle, so a part cut to a drawn diagonal
 * got a glowing rectangle — the aura started at the selection edges, which
 * is the loudest way a drawn part reads as a picture in a frame rather than
 * as the thing that was drawn.
 *
 * `drop-shadow` follows the alpha of what is actually painted, and a drawn
 * part is already clipped to its outline, so the glow lands on the line.
 * Three of them stacked stand in for the three reaches of the box-shadow:
 * the hairline at the edge, the near glow, the far one. They are dearer than
 * a box-shadow — a filter rasterises what it is given — which is why this is
 * only used where a rectangle would be wrong.
 *
 * A ring is one tight shadow, as it is in the box version.
 */
export function auraFilter(aura: string | null | undefined, palette: Palette | undefined, size = 1, style: AuraStyle = "glow"): Record<string, string | number> | null {
  const colour = auraColour(aura, palette);
  if (!colour) return null;
  const k = Math.max(0.3, Math.min(2.5, size || 1));
  const drops = style === "ring"
    ? [`drop-shadow(0 0 ${(1.5 * k).toFixed(1)}px ${withAlpha(colour, 0.95)})`, `drop-shadow(0 0 ${(4 * k).toFixed(1)}px ${withAlpha(colour, 0.4)})`]
    : [
        `drop-shadow(0 0 1px ${withAlpha(colour, 0.75)})`,
        `drop-shadow(0 0 ${(7 * k).toFixed(1)}px ${withAlpha(colour, 0.5)})`,
        `drop-shadow(0 0 ${(18 * k).toFixed(1)}px ${withAlpha(colour, 0.22)})`,
      ];
  const filter = drops.join(" ");
  if (style !== "pulse") return { filter };
  return {
    filter,
    animation: "aura-pulse-shape 1.8s ease-in-out infinite",
    "--aura": withAlpha(colour, 0.6),
    "--aura-k": k,
  };
}

/** Describe the lamp for the blueprint. */
export function describeLight(light: Light): string[] {
  if (!light.on) return [];
  const where = `${Math.round(light.x * 100)}% across, ${Math.round(light.y * 100)}% down`;
  const hang = light.height > 0.75 ? "high overhead" : light.height > 0.4 ? "at an angle" : "low and raking";
  return [
    "Light and depth:",
    `  - One light source at ${where} of the page, ${hang}.`,
    `  - Surfaces stand ${light.lift}px off the page; shadows point away from the light and lengthen with distance from it.`,
    `  - Shadow strength ${Math.round(light.strength * 100)}%. The lit edge of every raised surface faces the light.`,
    "  - Implement as CSS box-shadows computed per element from its position, not one shadow for everything.",
  ];
}

const WHERE: Record<TextureTarget, string> = {
  page: "in the background only",
  panels: "on panels (the parts other parts sit in)",
  fields: "on fields (the boxes with nothing inside them)",
  surfaces: "on surfaces (panels and fields)",
  "page+panels": "in the background and on panels",
  "page+fields": "in the background and on fields",
  both: "in the background and on its surfaces",
  over: "washed over the finished page",
};

/** Describe the look in words, for the blueprint. */
export function describeLook(look: Look, resolved: Palette): string[] {
  const lines: string[] = [];
  if (look.fonts?.length) {
    lines.push("Faces carried with the site (use these files, at the sizes the parts say):");
    const seen = new Set<string>();
    for (const f of look.fonts) {
      if (seen.has(f.family)) continue;
      seen.add(f.family);
      lines.push(`  - ${f.family}: ${f.carried ? (f.source.kind === "link" ? `loaded from ${f.source.href}` : "the file is in the document") : `not carried — ${f.says ?? "no file"}`}; ${f.licence}`);
    }
  }
  const roles = ROLES.filter((r) => look.palette[r]);
  if (roles.length) {
    lines.push("Colour roles (use these exactly):");
    for (const r of ROLES) lines.push(`  - ${ROLE_LABEL[r]}: ${resolved[r]}${look.palette[r] ? "" : " (derived)"}`);
  }
  lines.push(...describeLight(look.light ?? defaultLight()));
  if (look.veil && look.veil > 0.01) {
    lines.push(`A dark veil dims the whole page by ${Math.round(look.veil * 100)}%: paint everything, then lay black at that opacity over all of it.`);
  }
  const on = look.texture.filter((l) => l.on);
  if (on.length) {
    lines.push("Texture, bottom layer first:");
    for (const l of on) {
      const kind = TEXTURE_KINDS.find((k) => k.id === l.kind);
      lines.push(
        `  - ${kind?.label ?? l.kind} in ${ROLE_LABEL[l.role].toLowerCase()}, ${WHERE[l.target ?? "page"]}, ${l.scale}px tile, ${l.angle}°, ${Math.round(l.opacity * 100)}% solid, ${l.blend} blend${l.src ? " (your image)" : ""}`,
      );
    }
    lines.push("  A background layer is a floor: every section, card and bar is opaque over it, so it shows in the gutters and margins only.");
    lines.push("  Every layer above is plain CSS, no image files unless one is named.");
  }
  return lines;
}