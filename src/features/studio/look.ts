import type { CarriedFont } from "./fonts";
import type { CapturedKeyframes } from "./parts/capturedMotion";
import type { Group, SiteTheme } from "./siteTheme";
/**
 * Colour and texture: the site's look, as data.
 *
 * Colour lives in OKLCH because that is what the whole app already speaks and
 * because it is perceptually even — nudging lightness by the same amount looks
 * like the same amount of change at every hue, which is what makes a palette
 * generator produce usable results rather than muddy ones.
 *
 * Texture is a stack of layers, each one a generator with a few numbers. Every
 * layer compiles to plain CSS backgrounds, so a texture costs nothing to load,
 * tiles seamlessly, and a generated site can ship it as a stylesheet.
 */

/* ------------------------------------------------------------------ */
/* Colour                                                              */
/* ------------------------------------------------------------------ */

export interface Oklch {
  l: number; // 0..1
  c: number; // 0..~0.37
  h: number; // 0..360
}

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const srgb = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055);
const linear = (v: number) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));

export function oklchToRgb({ l, c, h }: Oklch): [number, number, number] {
  const hr = (h * Math.PI) / 180;
  const a = Math.cos(hr) * c;
  const b = Math.sin(hr) * c;
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    clamp(srgb(4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_), 0, 1),
    clamp(srgb(-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_), 0, 1),
    clamp(srgb(-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_), 0, 1),
  ];
}

export function rgbToOklch(r: number, g: number, b: number): Oklch {
  const lr = linear(r);
  const lg = linear(g);
  const lb = linear(b);
  const l_ = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m_ = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s_ = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const l = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  const c = Math.hypot(a, bb);
  let h = (Math.atan2(bb, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l, c, h: c < 0.0002 ? 0 : h };
}

export const toHex = (col: Oklch): string => {
  const [r, g, b] = oklchToRgb(col);
  const hx = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${hx(r)}${hx(g)}${hx(b)}`;
};

export function fromHex(hex: string): Oklch | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let s = m[1]!;
  if (s.length === 3) s = s.split("").map((ch) => ch + ch).join("");
  return rgbToOklch(parseInt(s.slice(0, 2), 16) / 255, parseInt(s.slice(2, 4), 16) / 255, parseInt(s.slice(4, 6), 16) / 255);
}

/** The CSS the rest of the app consumes. */
export const css = ({ l, c, h }: Oklch, alpha = 1): string =>
  alpha >= 1 ? `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)})` : `oklch(${l.toFixed(4)} ${c.toFixed(4)} ${h.toFixed(2)} / ${alpha})`;

export function parseColor(v: string): Oklch | null {
  const s = v.trim();
  if (!s) return null;
  if (s.startsWith("#")) return fromHex(s);
  /* The browser's own form. A colour measured off a live page arrives as
     `rgb(48, 56, 70)`, which is what getComputedStyle reports, and a
     parser that knew hex and oklch alone dropped every one of them: a
     part recreated from a page carried the page's colours on the node and
     drew the site's own, and a white bar drew dark. */
  const rgb = /^rgba?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)\s*[,\s]\s*([\d.]+)/i.exec(s);
  if (rgb) return rgbToOklch(Number(rgb[1]) / 255, Number(rgb[2]) / 255, Number(rgb[3]) / 255);
  const m = /^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)/i.exec(s);
  if (m) {
    const l = Number(m[1]);
    return { l: l > 1.5 ? l / 100 : l, c: Number(m[2]), h: Number(m[3]) };
  }
  return null;
}

/** WCAG relative luminance, for the contrast readout. */
function luminance(col: Oklch): number {
  const [r, g, b] = oklchToRgb(col);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

export function contrast(a: Oklch, b: Oklch): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/* ------------------------------------------------------------------ */
/* Roles                                                               */
/* ------------------------------------------------------------------ */

export const ROLES = ["bg", "surface", "text", "muted", "accent", "highlight"] as const;
export type RoleId = (typeof ROLES)[number];

export const ROLE_LABEL: Record<RoleId, string> = {
  bg: "Background",
  surface: "Surface",
  text: "Text",
  muted: "Muted text",
  accent: "Accent",
  highlight: "Highlight",
};

export type Palette = Record<RoleId, string>;

/** A palette built the way the app has always derived one, so nothing jumps when you first open the mixer. */
export function paletteFromHue(hue: number, light: boolean): Palette {
  /*
   * Six roles anyone can tell apart, without lying about what they are for.
   *
   * They used to be one hue at six lightnesses with almost no colour in five of
   * them, and two of those five — the page and the cards on it — were four
   * hundredths apart. Six chips of it in a row read as one colour repeated,
   * which is no use when the row is how you pick between them.
   *
   * So: the ground and the surface are pulled apart until a card is plainly a
   * card, the muted role carries real colour instead of a rumour of it, and the
   * highlight sits far enough round the wheel from the accent to be a second
   * colour rather than a shade of the first.
   *
   * What is *not* done is making the ground bright and the text some other
   * colour entirely. A page's background and its body text are near-neutral in
   * every site worth reading, and a palette that starts elsewhere makes every
   * site built on it worse. Distinct is the ask; garish is not the same ask.
   */
  const away = (hue + 62) % 360;
  return light
    ? {
        bg: css({ l: 0.955, c: 0.012, h: hue }),
        surface: css({ l: 1, c: 0, h: hue }),
        text: css({ l: 0.22, c: 0.024, h: hue }),
        muted: css({ l: 0.56, c: 0.038, h: hue }),
        accent: css({ l: 0.55, c: 0.17, h: hue }),
        highlight: css({ l: 0.68, c: 0.16, h: away }),
      }
    : {
        bg: css({ l: 0.145, c: 0.014, h: hue }),
        surface: css({ l: 0.26, c: 0.022, h: hue }),
        text: css({ l: 0.95, c: 0.012, h: hue }),
        muted: css({ l: 0.62, c: 0.042, h: hue }),
        accent: css({ l: 0.76, c: 0.16, h: hue }),
        highlight: css({ l: 0.82, c: 0.155, h: away }),
      };
}

export type Harmony = "complementary" | "analogous" | "triadic" | "split" | "monochrome";

export const HARMONIES: { id: Harmony; label: string; hint: string }[] = [
  { id: "analogous", label: "Analogous", hint: "Neighbours on the wheel, calm, cohesive" },
  { id: "complementary", label: "Complementary", hint: "Opposite hues, maximum pop" },
  { id: "triadic", label: "Triadic", hint: "Three evenly spaced, lively, balanced" },
  { id: "split", label: "Split", hint: "One hue against two near its opposite" },
  { id: "monochrome", label: "Monochrome", hint: "One hue, many lightnesses" },
];

/** Build a whole palette from one colour. */
export function harmonise(seed: Oklch, kind: Harmony, light: boolean): Palette {
  const h = seed.h;
  const shift =
    kind === "complementary" ? 180 : kind === "analogous" ? 30 : kind === "triadic" ? 120 : kind === "split" ? 150 : 0;
  const hi = (h + shift) % 360;
  const chroma = Math.max(0.02, Math.min(0.2, seed.c));
  return light
    ? {
        bg: css({ l: 0.975, c: chroma * 0.05, h }),
        surface: css({ l: 1, c: 0, h }),
        text: css({ l: 0.22, c: chroma * 0.15, h }),
        muted: css({ l: 0.58, c: chroma * 0.12, h }),
        accent: css({ l: clamp(seed.l, 0.4, 0.65), c: chroma, h }),
        highlight: css({ l: 0.6, c: chroma * 0.95, h: hi }),
      }
    : {
        bg: css({ l: 0.16, c: chroma * 0.08, h }),
        surface: css({ l: 0.21, c: chroma * 0.1, h }),
        text: css({ l: 0.94, c: chroma * 0.06, h }),
        muted: css({ l: 0.65, c: chroma * 0.1, h }),
        accent: css({ l: clamp(seed.l, 0.62, 0.82), c: chroma, h }),
        highlight: css({ l: 0.78, c: chroma * 0.95, h: hi }),
      };
}

/* ------------------------------------------------------------------ */
/* Texture                                                             */
/* ------------------------------------------------------------------ */

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
 * "page" is the ground the site stands on: every part paints an opaque floor
 * over it, so the texture shows in the margins and the gaps and nowhere else.
 * "surfaces" is the cards, bars and panels themselves. "over" is the one that
 * ignores all of that and washes across the finished page, which is what you
 * want for a grain or a fog and nothing else.
 */
export type TextureTarget = "page" | "surfaces" | "both" | "over";

export const TEXTURE_TARGETS: { value: TextureTarget; label: string }[] = [
  { value: "page", label: "The background" },
  { value: "surfaces", label: "On surfaces" },
  { value: "both", label: "Background and surfaces" },
  { value: "over", label: "Over everything" },
];

/** Does this layer land on the given surface? */
export function lands(layer: TextureLayer, on: "page" | "surfaces" | "over"): boolean {
  const t = layer.target ?? "page";
  if (on === "over") return t === "over";
  return t === "both" || t === on;
}

/** Turn a colour's hue, leaving its lightness and chroma alone. */
export function shiftHue(colour: string, degrees: number): string {
  if (!degrees) return colour;
  const c = parseColor(colour);
  if (!c) return colour;
  return css({ ...c, h: (((c.h + degrees) % 360) + 360) % 360 });
}


/** Grain-like layers cover every pixel, so they start faint and blended; shapes start bolder. */
const GRAINY = new Set<TextureKind>(["noise", "grain", "paper"]);

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

const svgUrl = (svg: string) => `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;

/** A colour as three 0..1 channels, for an SVG filter matrix. */
function channels(colour: string): [string, string, string] {
  const parsed = parseColor(colour);
  const rgb = parsed ? oklchToRgb(parsed) : ([1, 1, 1] as [number, number, number]);
  return rgb.map((v) => v.toFixed(4)) as [string, string, string];
}

/** One layer as a CSS background image, plus how it is laid out. */
export function layerCss(layer: TextureLayer, colour: string): { image: string; size: string; repeat?: string } | null {
  const { kind, scale, angle, contrast: k } = layer;
  const s = Math.max(2, scale);
  const half = s / 2;
  const line = Math.max(0.5, s * (0.02 + k * 0.12));

  switch (kind) {
    /**
     * A flat colour. At contrast 0 it is exactly that — the static background
     * this stack was missing — and as contrast comes up it fades away along
     * the angle, over a distance the scale sets. So the two controls that
     * mean nothing to a solid fill are given something honest to do.
     */
    case "flat": {
      if (k < 0.02) return { image: `linear-gradient(${colour}, ${colour})`, size: "cover", repeat: "no-repeat" };
      const reach = Math.round(30 + (1 - k) * 170 + s);
      return {
        image: `linear-gradient(${angle}deg, ${colour} 0, ${withAlpha(colour, 0)} ${reach}%)`,
        size: "cover",
        repeat: "no-repeat",
      };
    }
    /**
     * Grain, in the layer's own colour.
     *
     * This used to desaturate the turbulence and lay the grey down as-is,
     * which meant three of the fourteen kinds quietly ignored the colour role
     * — a grain was always grey, and turned up it was an opaque grey lid over
     * whatever was under it. Now the noise's brightness becomes the *alpha*
     * and the role colour becomes the colour, so a grain is a scatter of holes
     * in the palette: it tints, and the layers beneath it still read.
     */
    case "noise":
    case "grain":
    case "paper": {
      const freq = kind === "noise" ? 0.9 : kind === "grain" ? 0.42 : 0.02;
      const octaves = kind === "paper" ? 4 : 2;
      const [r, g, b] = channels(colour);
      // Low contrast keeps the soft middle of the noise, so it reads as a
      // wash; high keeps only the peaks, so it reads as specks.
      const gamma = (0.5 + k * 2.5).toFixed(3);
      // Opacity lands on the tile rather than in the colour, because the
      // colour is already carrying the grain's own shape. The curve is steep
      // at the bottom, where a grain lives, and still reaches 1 — a straight
      // multiplier either made the useful end unusable or flattened out
      // halfway up, so the top half of the slider did nothing.
      const alpha = Math.pow(Math.max(0.01, Math.min(1, layer.opacity)), 0.7).toFixed(3);
      // Turbulence has no direction of its own, so the tile is turned instead —
      // which does change the grain, because the field is not symmetric.
      const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">` +
        `<filter id="f" color-interpolation-filters="sRGB">` +
        `<feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" stitchTiles="stitch"/>` +
        `<feColorMatrix type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0.2126 0.7152 0.0722 0 0"/>` +
        `<feComponentTransfer><feFuncA type="gamma" exponent="${gamma}" amplitude="1" offset="0"/></feComponentTransfer>` +
        `</filter>` +
        `<g transform="rotate(${angle} ${s / 2} ${s / 2})">` +
        `<rect x="${-s}" y="${-s}" width="${s * 3}" height="${s * 3}" filter="url(#f)" opacity="${alpha}"/>` +
        `</g></svg>`;
      return { image: svgUrl(svg), size: `${s}px ${s}px` };
    }
    case "scanlines":
      return { image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${Math.max(line + 1, s / 4)}px)`, size: "auto" };
    case "stripes":
      return { image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${half}px)`, size: "auto" };
    case "grid":
      return {
        image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${s}px), repeating-linear-gradient(${angle + 90}deg, ${colour} 0 ${line}px, transparent ${line}px ${s}px)`,
        size: "auto",
      };
    case "hatch":
      return {
        image: `repeating-linear-gradient(${angle}deg, ${colour} 0 ${line}px, transparent ${line}px ${half}px), repeating-linear-gradient(${angle + 90}deg, ${colour} 0 ${line}px, transparent ${line}px ${half}px)`,
        size: "auto",
      };
    case "checks": {
      // Drawn as a tile rather than a conic gradient, so it can be turned; the
      // squares shrink inside their cells as contrast comes down, which is
      // what softens a check pattern without blurring it.
      const inset = (1 - (0.35 + k * 0.65)) * (s / 4);
      const q = s / 2;
      const sq = (x: number, y: number) =>
        `<rect x="${(x + inset).toFixed(2)}" y="${(y + inset).toFixed(2)}" width="${(q - inset * 2).toFixed(2)}" height="${(q - inset * 2).toFixed(2)}" fill="${colour}" rx="${(inset * 0.6).toFixed(2)}"/>`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g transform="rotate(${angle} ${s / 2} ${s / 2})">${sq(0, 0)}${sq(q, q)}${sq(-s, 0)}${sq(s, 0)}${sq(0, -s)}${sq(0, s)}</g></svg>`;
      return { image: svgUrl(svg), size: `${s}px ${s}px` };
    }
    case "dots":
    case "halftone": {
      const r = Math.max(0.6, s * (kind === "halftone" ? 0.08 + k * 0.22 : 0.05 + k * 0.1));
      const half = kind === "halftone";
      const dot = (x: number, y: number, rr: number) =>
        `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${rr.toFixed(2)}" fill="${colour}"/>`;
      // Nine of them, so the corners of the turned tile are still filled.
      const points: string[] = [];
      for (let gx = -1; gx <= 1; gx++) {
        for (let gy = -1; gy <= 1; gy++) {
          points.push(dot(s / 2 + gx * s, s / 2 + gy * s, r));
          if (half) points.push(dot(gx * s, gy * s, r * 0.62));
        }
      }
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g transform="rotate(${angle} ${s / 2} ${s / 2})">${points.join("")}</g></svg>`;
      return { image: svgUrl(svg), size: `${s}px ${s}px` };
    }
    case "blobs": {
      // Three fields on a circle: the angle turns the circle, contrast pulls
      // their edges in, so both controls read on a shape that has no edges.
      const stop = Math.round(80 - k * 45);
      const at = (i: number) => {
        const a = ((angle + i * 120) * Math.PI) / 180;
        return `${(50 + Math.cos(a) * 30).toFixed(1)}% ${(50 + Math.sin(a) * 30).toFixed(1)}%`;
      };
      return {
        image: [0, 1, 2].map((i) => `radial-gradient(50% 58% at ${at(i)}, ${colour}, transparent ${stop}%)`).join(", "),
        size: `${s * 8}px ${s * 8}px`,
      };
    }
    case "mesh": {
      const stop = Math.round(75 - k * 35);
      const at = (i: number) => {
        const a = ((angle + i * 137) * Math.PI) / 180;
        return `${(50 + Math.cos(a) * 44).toFixed(1)}% ${(50 + Math.sin(a) * 44).toFixed(1)}%`;
      };
      return {
        image: [0, 1, 2].map((i) => `radial-gradient(80% 80% at ${at(i)}, ${colour}, transparent ${stop}%)`).join(", "),
        size: "cover",
      };
    }
    case "image": {
      const src = layer.baked ?? layer.src;
      if (!src) return null;
      const woven = Math.max(0, Math.min(1, layer.weave ?? 0));
      // Weave used to grow the tile as well as soften it, which meant it and
      // Size were two controls fighting over one number and neither of them
      // did what it said. Size sets the tile. Weave thins its edges so the
      // tiles bleed into each other (baked into the tile's alpha — see
      // `texture.ts`), and only at the very top does it become one picture
      // covering the whole surface.
      // (`texture.ts` bakes such a picture at its own size for this, `COVERS_AT`.)
      if (woven >= 0.98) return { image: `url(${JSON.stringify(src)})`, size: "cover", repeat: "no-repeat" };
      // An explicit height where the tile's shape is known: the same number
      // `auto` would work out, said out loud so a drift can move by a tile.
      const h = layer.aspect ? `${Math.max(1, Math.round(s / layer.aspect))}px` : "auto";
      return { image: `url(${JSON.stringify(src)})`, size: `${Math.round(s)}px ${h}`, repeat: "repeat" };
    }
    default:
      return null;
  }
}

/**
 * The whole stack as one set of CSS properties, painted over `base`.
 *
 * The background colour is never replaced — it is the bottom of the stack and
 * every layer sits over it.
 *
 * Nothing a layer emits is allowed to be an opaque wash of that background
 * colour. It used to be: a picture was veiled with it to carry its opacity and
 * its weave, which worked on a single layer over a flat page and destroyed
 * every stack, because the veil covered the layers underneath as surely as it
 * faded the picture. Opacity and weave are cut into the tile's own alpha now
 * (`texture.ts`), so what is under a half-solid layer is the layer below it,
 * not the page colour painted over the top of it.
 */
export function textureCss(
  layers: TextureLayer[],
  palette: Palette,
  base: string,
  /* The page's fill, each layer with the size it is laid down at — structural
     rather than the `FillLayer` type itself, which lives in `parts/theme.ts`
     and imports this file. */
  under: { image: string; size: string }[] = [],
): React.CSSProperties {
  const on = layers.filter((l) => l.on);
  /*
   * `under` is the page's own FILL, and it is painted beneath the stack
   * rather than replaced by it.
   *
   * It used to be replaced, and in silence. The fill and the texture stack
   * are two different controls that paint the same page, and the moment any
   * page layer was switched on the fill was dropped on the floor — set a
   * mesh gradient, add a grain over it, and the mesh is gone with nothing
   * said. A control that stops doing anything without saying so is worse
   * than one that is not there.
   *
   * CSS paints background images front to back, so the fill goes on the END
   * of the list and everything else sits over it, which is what "before any
   * texture" always meant.
   *
   * The size comes in with the layer. It used to be forced to `auto` here,
   * on the reasoning that a fill is a gradient across the page rather than a
   * tile — true of the gradients, false of Grid, and the reason a grid with
   * a grain over it was a hairline with a grain over it.
   */
  const bed = under.map(({ image, size }) => ({ image, size, repeat: "repeat", blend: "normal", dx: 0, dy: 0 }));
  if (!on.length) return bed.length ? flat(bed, base) : { background: base };

  const parts = [...compose(on, palette), ...bed];
  if (!parts.length) return { background: base };
  const moving = parts.some((p) => p.dx || p.dy);
  return {
    backgroundImage: parts.map((p) => p.image).join(", "),
    backgroundSize: parts.map((p) => p.size).join(", "),
    backgroundRepeat: parts.map((p) => p.repeat).join(", "),
    backgroundPosition: parts.map(() => "center").join(", "),
    backgroundBlendMode: parts.map((p) => p.blend).join(", "),
    backgroundColor: base,
    ...(moving ? { animation: `${driftName(parts)} ${DRIFT_CYCLE}s linear infinite` } : {}),
  };
}

/** The fill on its own, with no texture over it. */
function flat(bed: Part[], base: string): React.CSSProperties {
  return {
    backgroundImage: bed.map((p) => p.image).join(", "),
    backgroundSize: bed.map((p) => p.size).join(", "),
    backgroundRepeat: bed.map((p) => p.repeat).join(", "),
    backgroundPosition: bed.map(() => "center").join(", "),
    backgroundColor: base,
  };
}

/** One background layer as CSS, and how far it travels in a cycle. */
interface Part { image: string; size: string; repeat: string; blend: string; dx: number; dy: number }

/**
 * The stack, walked once.
 *
 * Both the style and the keyframes that move it have to agree on the order and
 * the count of the background layers — a layer can push more than one — so
 * there is one walk and they both read it.
 */
function compose(on: TextureLayer[], palette: Palette): Part[] {
  const parts: Part[] = [];
  for (const l of on) {
    // A generated pattern carries its opacity in its own colour; a picture and
    // a grain carry theirs in the tile, because there is no single colour to
    // fade — see `texture.ts` and the grain case in `layerCss`.
    const picture = l.kind === "image";
    const role = shiftHue(l.colour ?? palette[l.role], l.hue ?? 0);
    const colour = withAlpha(role, GRAINY.has(l.kind) || picture ? 1 : l.opacity);
    const built = layerCss(l, colour);
    if (!built) continue;
    const repeat = built.repeat ?? "repeat";
    const images = splitLayers(built.image);
    const sizes = splitLayers(built.size);
    images.forEach((image, i) => {
      const size = (sizes[i] ?? sizes[0]!).trim();
      parts.push({ image: image.trim(), size, repeat, blend: l.blend, ...travel(l, size, repeat) });
    });
  }
  return parts;
}

/**
 * How far a layer moves in one cycle: a whole number of its own tiles, along
 * its own angle.
 *
 * Whole tiles, because a repeating background that has moved by exactly one
 * tile is the picture it started as — so the loop has no seam. A layer whose
 * tile is not a known size in both directions (one picture stretched to cover,
 * a tile with no shape written down) cannot be moved by a whole tile, so it
 * stays where it is rather than jumping once a cycle.
 */
function travel(l: TextureLayer, size: string, repeat: string): { dx: number; dy: number } {
  const drift = Math.max(0, Math.min(1, l.drift ?? 0));
  if (!drift || repeat !== "repeat") return { dx: 0, dy: 0 };
  const [w, h] = size.split(/\s+/).map((v) => (/^-?[\d.]+px$/.test(v) ? parseFloat(v) : NaN));
  if (!w || !h || !Number.isFinite(w) || !Number.isFinite(h)) return { dx: 0, dy: 0 };
  const tiles = Math.max(1, Math.round(drift * 6));
  const a = ((l.angle ?? 0) * Math.PI) / 180;
  return { dx: Math.round(Math.cos(a) * tiles) * w, dy: Math.round(Math.sin(a) * tiles) * h };
}

/** A name that changes when the movement does, so the keyframes are replaced with it. */
function driftName(parts: Part[]): string {
  let hash = 0;
  for (const p of parts) hash = (hash * 31 + p.dx * 7 + p.dy * 13) | 0;
  return `tex-drift-${(hash >>> 0).toString(36)}`;
}

/**
 * The keyframes a drifting stack needs, or nothing when it is still.
 *
 * Written out rather than kept in the stylesheet because there is one set per
 * stack: every layer has its own distance and they all have to be listed in
 * the one `background-position` the browser animates.
 */
export function driftKeyframes(layers: TextureLayer[], palette: Palette): { name: string; css: string } | null {
  const parts = compose(layers.filter((l) => l.on), palette);
  if (!parts.some((p) => p.dx || p.dy)) return null;
  const to = parts.map((p) => `calc(50% + ${p.dx}px) calc(50% + ${p.dy}px)`).join(", ");
  const name = driftName(parts);
  return { name, css: `@keyframes ${name}{to{background-position:${to}}}` };
}

/**
 * Split a background list on the commas that separate whole layers.
 *
 * A regex cannot do this: `linear-gradient(oklch(…), oklch(…))` has a comma at
 * depth two, and any lookahead cheap enough to write splits the gradient in
 * half — which then shifts every size and repeat one place along, so a tiled
 * texture silently comes out as `cover`. Count the brackets instead.
 */
function splitLayers(value: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      out.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  out.push(value.slice(start).trim());
  return out.filter(Boolean);
}

/** Put an alpha on a colour however it was written. */
export function withAlpha(colour: string, alpha: number): string {
  const parsed = parseColor(colour);
  if (parsed) return css(parsed, alpha);
  return colour;
}

/* ------------------------------------------------------------------ */
/* The whole look                                                      */
/* ------------------------------------------------------------------ */

/**
 * One lamp, somewhere over the page.
 *
 * A flat site has every shadow pointing the same way, which is to say it has
 * no shadows at all — just a soft grey smear under everything. Put the light
 * somewhere and each part knows where it is standing relative to it: a card on
 * the left throws its shadow left, one under the lamp throws almost none, and
 * the lit edge of every button faces the same way across the whole page.
 *
 * `x` and `y` are fractions of the page, so the lamp stays where it was put
 * when the frame changes width. `height` is how high above the page it hangs:
 * low means long raking shadows, high means short ones straight down.
 */
export interface Light {
  on: boolean;
  x: number;
  y: number;
  /** 0 = at the page's own level, 1 = straight overhead. */
  height: number;
  /** How dark the shadows are, 0..1. */
  strength: number;
  /** How far a lit surface stands off the page, in px. Also the blur. */
  lift: number;
  /** Warmth of the lit face, in degrees around the wheel. */
  warmth: number;
  /**
   * How much of the lamp lands on the page itself, 0..1. None, by default.
   *
   * A lamp that throws shadows and a lamp that pools light on the background
   * are two different wants, and asking for the first almost never means
   * asking for the second: a pool of warm light under a page's own colour is
   * the fastest way to make a careful palette look like a mistake. So the
   * shadows come with the lamp and this comes only when it is asked for.
   */
  wash?: number;
}

export const defaultLight = (): Light => ({ on: false, x: 0.5, y: 0.12, height: 0.55, strength: 0.45, lift: 10, warmth: 80, wash: 0 });

/**
 * The pool of light the lamp puts on the page itself, or nothing.
 *
 * Painted under the parts, never over them, because a lamp lights a table and
 * the things on the table cast their shadows on to it. A high lamp pools wide
 * and soft; a low one throws a tighter spot.
 */
export function washCss(light: Light | undefined): string | null {
  const w = light?.wash ?? 0;
  if (!light?.on || w <= 0.005) return null;
  const r = Math.round(45 + light.height * 75);
  const a = (w * 0.5).toFixed(3);
  return `radial-gradient(${r}% ${r}% at ${(light.x * 100).toFixed(1)}% ${(light.y * 100).toFixed(1)}%, oklch(0.97 0.06 ${Math.round(light.warmth)} / ${a}), transparent 72%)`;
}

export interface Look {
  /** Empty strings mean "derive it from the accent hue", as before. */
  palette: Partial<Palette>;
  /** A site brought in from a code repository: what its code is written against, for the style layer sent back to it (`styleLayer.ts`). */
  styleSource?: import("./styleLayer").StyleSource | null;
  texture: TextureLayer[];
  /** Where the texture is painted. */
  target: "page" | "surfaces" | "both";
  /** The lamp, and the depth it gives everything under it. */
  light: Light;
  /** A dark veil over the whole page, 0..0.85. Nothing, when absent. */
  veil?: number;
  /**
   * The faces carried with the site, one to one (`fonts.ts`): the file as
   * bytes, or the link that loads it, beside the textures. A part names a
   * face by name (`NodeFont.face`), so a carried face stays swappable.
   * Absent on every site that carried none, and nothing is drawn for it.
   */
  fonts?: CarriedFont[];
  /**
   * Where each role came from, on a site brought in (`paletteFrom.ts`): the
   * colour the rule picked off the site's own parts and how many parts
   * follow it, or the role it shows because the site gave none. Absent on a
   * site made here, and the panel says nothing about sources then.
   */
  paletteFrom?: Partial<Record<RoleId, { colour: string; parts: number; shows?: RoleId }>>;
  /**
   * The page's own `@keyframes`, as a capture read them (sink `doc.keyframes`),
   * for the parts whose `node.motion` names them. Kept with the look so they
   * travel with the document; drawn under a prefixed name
   * (`parts/capturedMotion.ts`). Absent on a site made here.
   */
  keyframes?: CapturedKeyframes[];
  /**
   * A new site's theme (`siteTheme.ts`): the one record its colours, fonts,
   * shapes, layout and motion were rolled from, and how the next roll is to
   * be made (what is locked, how original, the philosophy, Try these).
   * Absent on a site brought in or made before themes existed.
   */
  theme?: SiteTheme | null;
  themeRoll?: ThemeRollSettings | null;
}

/** How the next roll is made, kept with the site. */
export interface ThemeRollSettings {
  locks: Group[];
  /** 0 Familiar … 1 Original. */
  originality: number;
  philosophy: string;
  tryThese: boolean;
}

/** A new site rolls in the middle of the slider, nothing locked, with parts to try. */
export const defaultRoll = (): ThemeRollSettings => ({ locks: [], originality: 0.5, philosophy: "", tryThese: true });

export const emptyLook = (): Look => ({ palette: {}, texture: [], target: "page", light: defaultLight() });

/**
 * Where a box at `(cx, cy)` on the page sits relative to the lamp, and what
 * that means for its shadow: a direction away from the light, a length that
 * grows with distance and with how low the lamp hangs, and a blur that grows
 * with both.
 */
export function castFrom(light: Light, cx: number, cy: number): { dx: number; dy: number; blur: number; spread: number } | null {
  if (!light.on) return null;
  const ox = cx - light.x;
  const oy = cy - light.y;
  const dist = Math.hypot(ox, oy) || 0.0001;
  const h = Math.max(0, Math.min(1, light.height));
  /*
   * HOW LONG THE SHADOW IS, and why this was rewritten.
   *
   * "How high it hangs" was dead, measured: moving it end to end changed
   * 0% of the pixels on a card. The length was `min(3, dist * reach) *
   * lift`, and `dist` is a fraction of the page — about 0.09 for a part
   * near the lamp — so `dist * reach` ran from 0.23 to 0.02 and the whole
   * control was worth 2.27px of shadow at the bottom and 0.21px at the
   * top. The `min(3, …)` was written as though `dist` were in pixels; it
   * never came near 3, and what was left was `lift * a small number`, so
   * lift was the only thing that moved.
   *
   * A shadow's length is a multiple of how far the thing stands off the
   * page, so that is what this is: `reach` runs from about 3.5 lifts with
   * the lamp raking to about a tenth of one overhead. Distance from the
   * lamp leans it a little further — the page is one unit across, so it is
   * a lean and not the whole of it — and the whole thing is capped so a
   * part in the far corner does not throw a shadow off the page.
   */
  const reach = (1 - h) ** 1.5 * 3.4 + 0.12;
  const away = 0.5 + Math.min(1, dist / 0.45) * 0.8;
  const len = Math.min(light.lift * 4.2, light.lift * reach * away);
  return {
    dx: Math.round((ox / dist) * len),
    // Overhead, most of what there is sits straight under the box; raking,
    // almost none of it does and the length carries the direction instead.
    dy: Math.round((oy / dist) * len + light.lift * (0.18 + 0.32 * h)),
    blur: Math.round(light.lift * (0.8 + 0.8 * h) + len * 0.55),
    spread: 0,
  };
}


/**
 * The two strings a lit surface wears: the shadow it throws and the wash on
 * the face turned toward the lamp.
 *
 * ONE COPY, and the reason for saying so. There were two — `liftVars` for
 * the board and `liftTheme` for the parts — and they had drifted: fixing
 * the lit face in one of them left "Warmth" dead on the board, because the
 * board reads the other. Both call this now.
 */
export function liftCss(light: Light, cx: number, cy: number): { shadow: string; sheen: string } | null {
  const cast = castFrom(light, cx, cy);
  if (!cast) return null;
  const dark = Math.max(0, Math.min(0.9, light.strength));
  const away = Math.hypot(cx - light.x, cy - light.y) || 0.0001;
  const from = { x: (light.x - cx) / away, y: (light.y - cy) / away };
  // Two shadows: a tight one that seats the box on the page, and a long one
  // that carries the direction. Both point away from the lamp.
  const near = `${Math.round(cast.dx * 0.35)}px ${Math.round(cast.dy * 0.35)}px ${Math.round(cast.blur * 0.4)}px oklch(0 0 0 / ${(dark * 0.5).toFixed(3)})`;
  const far = `${cast.dx}px ${cast.dy}px ${cast.blur}px oklch(0 0 0 / ${(dark * 0.55).toFixed(3)})`;
  /*
   * The lit face. It used to be `oklch(1 0.02 …)`, and at that chroma a hue
   * cannot be read at all — white is white whatever angle you take it
   * from — which is why "Warmth" measured as doing nothing even where the
   * wash was painted. Enough chroma to carry a colour now, and the alpha
   * still small: this is the light catching an edge, not a tint over the
   * page.
   */
  const deg = Math.round((Math.atan2(from.x, from.y) * 180) / Math.PI + 180);
  return {
    shadow: `${near}, ${far}`,
    sheen: `linear-gradient(${deg}deg, oklch(0.96 0.13 ${Math.round(light.warmth)} / ${(0.07 + dark * 0.13).toFixed(3)}), transparent 58%)`,
  };
}

/* ------------------------------------------------------------------ */
/* Entrances                                                           */
/* ------------------------------------------------------------------ */

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
  surfaces: "on surfaces (cards, bars, panels)",
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
