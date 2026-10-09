import { oklchToRgb, css, parseColor, ROLES, contrast } from "./colour.ts";
import type { Palette, RoleId } from "./colour.ts";

export type TextureKind =
  | "flat" | "noise" | "grain" | "paper" | "scanlines" | "halftone" | "hatch"
  | "stripes" | "checks" | "grid" | "dots" | "blobs" | "mesh" | "image";

export const TEXTURE_KINDS: { id: TextureKind; label: string; hint: string }[] = [
  { id: "flat", label: "Flat colour", hint: "One colour, at any opacity. Turn Contrast up to fade it along the angle." },
  { id: "noise", label: "Noise", hint: "Fine random speckle" },
  { id: "grain", label: "Grain", hint: "Coarser film grain" },
  { id: "paper", label: "Paper", hint: "Soft fibrous wash" },
  { id: "scanlines", label: "Scan lines", hint: "Horizontal CRT lines" },
  { id: "halftone", label: "Halftone", hint: "Print dots on a grid" },
  { id: "hatch", label: "Cross-hatch", hint: "Crossed pen strokes" },
  { id: "stripes", label: "Stripes", hint: "Straight bands at any angle" },
  { id: "checks", label: "Checks", hint: "Two-tone squares" },
  { id: "grid", label: "Grid", hint: "Thin ruled lines" },
  { id: "dots", label: "Dots", hint: "Evenly spaced points" },
  { id: "blobs", label: "Blobs", hint: "Soft overlapping colour fields" },
  { id: "mesh", label: "Mesh gradient", hint: "Several colours bled together" },
  { id: "image", label: "Your image", hint: "A picture you dropped in, tiled and tinted" },
];

export type BlendMode = "normal" | "multiply" | "screen" | "overlay" | "soft-light" | "difference";

/** A rectangle on a picture, in fractions of it. */
export interface Crop { x: number; y: number; w: number; h: number }

/** How long a drifting layer takes to come back to where it started. */
export const DRIFT_CYCLE = 90;

export interface TextureLayer {
  id: string;
  kind: TextureKind;
  /** Which palette role the layer is drawn in. */
  role: RoleId;
  /** Tile size in px. */
  scale: number;
  angle: number;
  opacity: number;
  /** How hard the edges are, 0..1. */
  contrast: number;
  blend: BlendMode;
  /** For "image": the picture as dropped in. */
  src?: string;
  /**
   * For "image": which part of the picture the texture is taken from.
   *
   * In fractions of the picture, so it survives the picture being replaced by
   * a bigger copy of itself. Absent means the whole thing — which is almost
   * never what a photograph of a surface wants: the useful part is a patch in
   * the middle of it, and everything round that patch is a lamp, a hand, or a
   * corner of the table.
   */
  crop?: Crop;
  /**
   * The baked tile's width divided by its height.
   *
   * Written down because CSS can work it out and a drift cannot: a tile of
   * `Npx auto` moves by a whole tile across and by nobody-knows-how-much
   * down, and a drift that is not a whole tile jumps when it loops.
   */
  aspect?: number;
  /**
   * How fast the layer drifts, 0..1. Still, at 0.
   *
   * Every cycle carries the tile a whole number of tiles along its own angle,
   * so the loop has no seam in it, and a stack of layers at different speeds
   * and angles reads as depth the way the add-disc's clouds do — near cloud
   * you can watch pass, far cloud that only turns.
   */
  drift?: number;
  /**
   * For "image": the cooked tile — background keyed out, reduced to a tintable
   * pattern, rotated. `texture.ts` bakes it; everything downstream just uses it.
   */
  baked?: string;
  /** For "image": key out whatever colour the edges sit on. */
  cutout?: boolean;
  /** How much of that colour goes, 0..1. */
  tolerance?: number;
  /** For "image": reduce to a mask so the role colour paints it. */
  pattern?: boolean;
  /**
   * 0 tiles the picture as a grid. Turning it up grows the tile and draws the
   * edges back into the background colour, until at 1 there is one picture,
   * covering, concentrated in the middle — coherent rather than repeated.
   */
  weave?: number;
  /** Degrees to turn the colour, -180..180. Zero leaves the role alone. */
  hue?: number;
  /**
   * A colour of this layer's own, off the spectrum, instead of a palette role.
   *
   * Six roles is the right answer for a texture that should follow the site.
   * It is the wrong answer for the one people reach for first — a flat ground
   * in a colour they have in mind — which had no way to be said at all.
   */
  colour?: string;
  /**
   * Where this layer lands. Per layer, not per stack: one texture on the page
   * and a different one on the cards is the normal case, and a single switch
   * for the whole stack cannot say that.
   */
  target?: TextureTarget;
  on: boolean;
}

const some = <T,>(xs: readonly T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
const between = (a: number, b: number) => a + Math.random() * (b - a);

/**
 * A patch of a picture, rolled the way the add disc rolls its sparks.
 *
 * A photograph of a surface is not one texture, it is thirty: the weave in
 * the corner, the grain across the middle, the shadow under the fold. What
 * makes a re-roll worth pressing twice is that each press lands somewhere
 * genuinely else, and that is a property of *how* the number is drawn, not
 * of drawing one at all — which is the hub's lesson. Its embers are not
 * sixteen copies of one random walk: they come in kinds that behave
 * differently, they are lit evenly across the disc rather than clumped in
 * the middle, and where one dies another is lit somewhere new.
 *
 * So a patch is rolled in kinds — a **close** crop reads as weave, a
 * **middling** one as grain, a **wide** one as the whole surface with its
 * lighting, and a **strip** takes a long thin bite that tiles quite unlike
 * any of them — with a shape drawn per kind, and a place that is required to
 * be a real distance from the patch before it. Ten tries at the spacing, and
 * then it takes what it has: better a near repeat than a hang.
 */
export function rollPatch(prev?: Crop): Crop {
  const kind = some(["close", "close", "middle", "middle", "middle", "wide", "strip"] as const);
  const w =
    kind === "close" ? between(0.1, 0.24)
    : kind === "middle" ? between(0.24, 0.48)
    : kind === "wide" ? between(0.5, 0.86)
    : between(0.45, 0.95);
  // Square-ish for the crops that are about the surface; long for a strip,
  // either way up, because a strip's whole point is that it does not tile
  // like the others.
  const ratio = kind === "strip" ? (Math.random() < 0.5 ? between(0.18, 0.4) : between(2.5, 5.5)) : between(0.8, 1.25);
  const h = Math.min(0.95, w * ratio);
  const fit = (v: number) => Math.max(0.02, Math.min(0.95, v));
  const cw = fit(w);
  const ch = fit(h);

  // Somewhere else than last time. The distance asked for is a share of what
  // is left to move in — on a patch that nearly fills the picture there is
  // nowhere to go, and asking anyway would spin.
  const roomX = Math.max(0, 1 - cw);
  const roomY = Math.max(0, 1 - ch);
  const want = Math.hypot(roomX, roomY) * 0.32;
  let x = 0;
  let y = 0;
  for (let i = 0; i < 10; i++) {
    x = Math.random() * roomX;
    y = Math.random() * roomY;
    if (!prev) break;
    const dx = x + cw / 2 - (prev.x + prev.w / 2);
    const dy = y + ch / 2 - (prev.y + prev.h / 2);
    if (Math.hypot(dx, dy) >= want) break;
  }
  const round = (v: number) => Number(v.toFixed(3));
  return { x: round(x), y: round(y), w: round(cw), h: round(ch) };
}

/**
 * One thing about a layer, changed at random.
 *
 * Not everything at once: a re-roll that changes every number gives a
 * different texture each press and you never learn what any of the controls
 * do. Changing one thing is a step sideways — you can see what moved, keep
 * pressing while it is interesting, and stop where you like. It is the way
 * anyone actually finds a texture they did not already have in mind.
 *
 * On a picture the one thing is **the patch**. Nothing else in the list
 * comes close: a photograph carries more textures than the whole of the
 * generated set, and moving the window over it is what gets at them, where
 * turning the tint or the scale only dresses the same square differently. It
 * is set drifting at the same time if it was still, because a patch of a
 * picture is a thing that wants to pass rather than sit — and that is the one
 * exception to one-thing-at-a-time, paid for once, on the first press.
 */
export function reiterate(l: TextureLayer): Partial<TextureLayer> {
  if (l.kind === "image" && l.src) {
    const crop = rollPatch(l.crop);
    // Still layers are set going; a layer already drifting keeps its speed,
    // so pressing on does not fight the speed you settled on.
    return l.drift ? { crop } : { crop, drift: Number(between(0.2, 0.6).toFixed(2)) };
  }
  switch (some(["scale", "angle", "contrast", "opacity", "hue", "weave", "drift", "role"] as const)) {
    case "scale": return { scale: Math.round(between(10, 260)) };
    case "angle": return { angle: Math.round(between(0, 359)) };
    case "contrast": return { contrast: Number(between(0, 1).toFixed(2)) };
    case "opacity": return { opacity: Number(between(0.2, 1).toFixed(2)) };
    case "hue": return { hue: Math.round(between(-180, 180)) };
    case "weave": return { weave: Number(between(0, 0.9).toFixed(2)) };
    // Still, half the time: a texture that always moves is as tiring as one
    // that never can.
    case "drift": return { drift: Math.random() < 0.5 ? 0 : Number(between(0.15, 1).toFixed(2)) };
    default: return { role: some(ROLES) };
  }
}

/**
 * Where a layer lands.
 *
 * "page" is the ground the site stands on, the spaces between everything:
 * every part paints an opaque floor over it, so the texture shows in the
 * margins and the gaps and nowhere else. Panels are the parts other parts
 * sit in (a section, a card holding words and buttons); fields are the boxes
 * with nothing inside them (an input, a tile, a tour step). "surfaces" is
 * both of those. "over" ignores all of that and washes across the finished
 * page, which is what you want for a grain or a fog and nothing else.
 */
export type TextureTarget = "page" | "surfaces" | "both" | "over" | "panels" | "fields" | "page+panels" | "page+fields";

/** The three places a person can point at, plus the wash over everything. */
export type TextureSpot = "page" | "panels" | "fields" | "over";

const SPOTS: Record<TextureTarget, readonly TextureSpot[]> = {
  page: ["page"],
  panels: ["panels"],
  fields: ["fields"],
  surfaces: ["panels", "fields"],
  "page+panels": ["page", "panels"],
  "page+fields": ["page", "fields"],
  both: ["page", "panels", "fields"],
  over: ["over"],
};

/** Which spots a target covers. */
export const spotsOfTarget = (t: TextureTarget | undefined): readonly TextureSpot[] => SPOTS[t ?? "page"] ?? SPOTS.page;

/** The target that covers exactly these spots ("over" stands alone); null for none. */
export function targetOfSpots(spots: readonly TextureSpot[]): TextureTarget | null {
  if (spots.includes("over")) return "over";
  const has = (x: TextureSpot) => spots.includes(x);
  const key = `${has("page") ? "p" : ""}${has("panels") ? "a" : ""}${has("fields") ? "f" : ""}`;
  const by: Record<string, TextureTarget> = { p: "page", a: "panels", f: "fields", af: "surfaces", pa: "page+panels", pf: "page+fields", paf: "both" };
  return by[key] ?? null;
}

export const TEXTURE_TARGETS: { value: TextureTarget; label: string }[] = [
  { value: "page", label: "Spaces" },
  { value: "panels", label: "Panels" },
  { value: "fields", label: "Fields" },
  { value: "surfaces", label: "Panels and fields" },
  { value: "page+panels", label: "Spaces and panels" },
  { value: "page+fields", label: "Spaces and fields" },
  { value: "both", label: "Spaces, panels and fields" },
  { value: "over", label: "Over everything" },
];

/**
 * Does this layer land on the given spot? "surfaces" asks for either kind of
 * part, for a swatch that only knows it is showing a part.
 */
export function lands(layer: TextureLayer, on: TextureSpot | "surfaces"): boolean {
  const spots = spotsOfTarget(layer.target);
  if (on === "surfaces") return spots.includes("panels") || spots.includes("fields");
  return spots.includes(on);
}

/** Turn a colour's hue, leaving its lightness and chroma alone. */
export function shiftHue(colour: string, degrees: number): string {
  if (!degrees) return colour;
  const c = parseColor(colour);
  if (!c) return colour;
  return css({ ...c, h: (((c.h + degrees) % 360) + 360) % 360 });
}


/** Grain-like layers cover every pixel, so they start faint and blended; shapes start bolder. */
export const GRAINY = new Set<TextureKind>(["noise", "grain", "paper"]);

export function newLayer(kind: TextureKind = "noise"): TextureLayer {
  const grainy = GRAINY.has(kind);
  const picture = kind === "image";
  const flat = kind === "flat";
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    // A flat layer is a ground, so it starts as one of the neutral roles
    // rather than as the accent.
    role: flat ? "surface" : "accent",
    scale: flat ? 60 : grainy ? 160 : picture ? 60 : 24,
    angle: picture || flat ? 0 : 45,
    // Flat starts fully solid and completely even: that is the static
    // background people reach for, and everything else is a turn away.
    opacity: flat ? 1 : grainy ? 0.05 : picture ? 0.5 : 0.14,
    contrast: flat ? 0 : grainy ? 0.3 : picture ? 0.45 : 0.5,
    blend: grainy ? "overlay" : "normal",
    hue: 0,
    target: "page",
    // A picture arrives as a pattern by default: that is what makes the colour
    // roles, the scale and the background colour all mean something.
    ...(picture ? { pattern: true, cutout: false, tolerance: 0.35, weave: 0 } : {}),
    on: true,
  };
}

export const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** A colour as three 0..1 channels, for an SVG filter matrix. */
export function channels(colour: string): [string, string, string] {
  const parsed = parseColor(colour);
  const rgb = parsed ? oklchToRgb(parsed) : ([1, 1, 1] as [number, number, number]);
  return rgb.map((v) => v.toFixed(4)) as [string, string, string];
}

/**
 * The palette colour a new texture is drawn in: the accent, unless it barely
 * shows on the ground it lands on. On PonsStars the accent is a pale lime on
 * a cream page, and stripes in it at the page's own zoom were not there at
 * all; the highlight, else the words' colour, is.
 */
export function seenOn(ground: string, palette: Palette): RoleId {
  const g = parseColor(ground);
  if (!g) return "accent";
  const how = (r: RoleId) => { const c = parseColor(palette[r]); return c ? contrast(c, g) : 1; };
  for (const r of ["accent", "highlight"] as RoleId[]) if (how(r) >= 2) return r;
  return how("text") >= how("muted") ? "text" : "muted";
}

/** A new layer as a press adds it, and as its sample shows it: strong enough to see, in a colour that shows on its ground. */
export function pickedLayer(kind: TextureKind, ground: string, palette: Palette): TextureLayer {
  const base = newLayer(kind);
  return { ...base, role: base.role === "accent" ? seenOn(ground, palette) : base.role, opacity: Math.max(base.opacity, 0.45) };
}

/**
 * The dials that change a kind, by name, and only those.
 *
 * Every kind used to get Angle and Drift whatever it was (J, 2026-10-09:
 * "drift did neither for either of them ... ensure that each texture has the
 * proper dedicated setting sliders"). A flat colour has no direction until it
 * fades, a mesh is laid once across the page and cannot travel, and the
 * one-number shape each kind does have (how thick a line, how big a dot)
 * lives on `contrast` and had no dial at all.
 */
export interface KindDials {
  /** What `contrast` is called on this kind; absent when it has no shape dial. */
  shape?: string;
  /** Angle turns it. `whenShaped`: only once the shape dial is above nothing (a flat colour's fade). */
  angle: boolean | "whenShaped";
  /** Drift moves it. */
  drift: boolean;
}

const DIALS: Partial<Record<TextureKind, KindDials>> = {
  flat: { shape: "Fade", angle: "whenShaped", drift: false },
  noise: { shape: "Speckle", angle: true, drift: true },
  grain: { shape: "Speckle", angle: true, drift: true },
  paper: { shape: "Speckle", angle: true, drift: true },
  stripes: { shape: "Line width", angle: true, drift: true },
  scanlines: { shape: "Line width", angle: true, drift: true },
  grid: { shape: "Line width", angle: true, drift: true },
  hatch: { shape: "Line width", angle: true, drift: true },
  dots: { shape: "Dot size", angle: true, drift: true },
  halftone: { shape: "Dot size", angle: true, drift: true },
  checks: { shape: "Square size", angle: true, drift: true },
  blobs: { shape: "Edges", angle: true, drift: true },
  mesh: { shape: "Edges", angle: true, drift: false },
  image: { angle: true, drift: true },
};

export function dialsOf(kind: TextureKind): KindDials {
  return DIALS[kind] ?? { angle: true, drift: true };
}
