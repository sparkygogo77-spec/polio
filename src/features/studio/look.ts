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
  return light
    ? {
        bg: css({ l: 0.975, c: 0.006, h: hue }),
        surface: css({ l: 1, c: 0, h: hue }),
        text: css({ l: 0.25, c: 0.02, h: hue }),
        muted: css({ l: 0.6, c: 0.015, h: hue }),
        accent: css({ l: 0.55, c: 0.16, h: hue }),
        highlight: css({ l: 0.72, c: 0.14, h: (hue + 40) % 360 }),
      }
    : {
        bg: css({ l: 0.17, c: 0.01, h: hue }),
        surface: css({ l: 0.22, c: 0.012, h: hue }),
        text: css({ l: 0.93, c: 0.01, h: hue }),
        muted: css({ l: 0.64, c: 0.016, h: hue }),
        accent: css({ l: 0.75, c: 0.15, h: hue }),
        highlight: css({ l: 0.8, c: 0.14, h: (hue + 40) % 360 }),
      };
}

export type Harmony = "complementary" | "analogous" | "triadic" | "split" | "monochrome";

export const HARMONIES: { id: Harmony; label: string; hint: string }[] = [
  { id: "analogous", label: "Analogous", hint: "Neighbours on the wheel — calm, cohesive" },
  { id: "complementary", label: "Complementary", hint: "Opposite hues — maximum pop" },
  { id: "triadic", label: "Triadic", hint: "Three evenly spaced — lively, balanced" },
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
  | "noise" | "grain" | "paper" | "scanlines" | "halftone" | "hatch"
  | "stripes" | "checks" | "grid" | "dots" | "blobs" | "mesh" | "image";

export const TEXTURE_KINDS: { id: TextureKind; label: string; hint: string }[] = [
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
   * Where this layer lands. Per layer, not per stack: one texture on the page
   * and a different one on the cards is the normal case, and a single switch
   * for the whole stack cannot say that.
   */
  target?: TextureTarget;
  on: boolean;
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

/**
 * Which controls actually do something for a given kind. A slider that moves
 * and changes nothing is worse than a slider that is not there, so the panel
 * asks before it draws one.
 */
export function affects(kind: TextureKind): { angle: boolean; contrast: boolean } {
  switch (kind) {
    // Turbulence has no direction, and a scan line is horizontal by definition.
    case "noise":
    case "grain":
    case "paper":
    case "scanlines":
      return { angle: false, contrast: true };
    // Radial and conic gradients cannot be rotated.
    case "dots":
    case "halftone":
      return { angle: false, contrast: true };
    case "checks":
      return { angle: false, contrast: false };
    case "blobs":
    case "mesh":
      return { angle: false, contrast: false };
    default:
      return { angle: true, contrast: true };
  }
}

/** Grain-like layers cover every pixel, so they start faint and blended; shapes start bolder. */
const GRAINY = new Set<TextureKind>(["noise", "grain", "paper"]);

export function newLayer(kind: TextureKind = "noise"): TextureLayer {
  const grainy = GRAINY.has(kind);
  const picture = kind === "image";
  return {
    id: `tx_${Math.random().toString(36).slice(2, 8)}`,
    kind,
    role: "accent",
    scale: grainy ? 160 : picture ? 60 : 24,
    angle: picture ? 0 : 45,
    opacity: grainy ? 0.05 : picture ? 0.5 : 0.14,
    contrast: grainy ? 0.3 : picture ? 0.45 : 0.5,
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

/** One layer as a CSS background image, plus how it is laid out. */
export function layerCss(layer: TextureLayer, colour: string): { image: string; size: string; repeat?: string } | null {
  const { kind, scale, angle, contrast: k } = layer;
  const s = Math.max(2, scale);
  const half = s / 2;
  const line = Math.max(0.5, s * (0.02 + k * 0.12));

  switch (kind) {
    case "noise":
    case "grain":
    case "paper": {
      // Opacity lands in the SVG itself, since a grain layer has no colour to fade.
      const freq = kind === "noise" ? 0.9 : kind === "grain" ? 0.42 : 0.02;
      const octaves = kind === "paper" ? 4 : 2;
      const alpha = ((0.25 + k * 0.75) * Math.max(0.02, layer.opacity) * 4).toFixed(3);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><filter id="f"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="${octaves}" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(%23f)" opacity="${alpha}"/></svg>`;
      return { image: svgUrl(svg.replace("%23f", "#f")), size: `${s}px ${s}px` };
    }
    case "scanlines":
      return { image: `repeating-linear-gradient(0deg, ${colour} 0 ${line}px, transparent ${line}px ${Math.max(line + 1, s / 4)}px)`, size: "auto" };
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
    case "checks":
      return {
        image: `conic-gradient(${colour} 0 25%, transparent 0 50%, ${colour} 0 75%, transparent 0)`,
        size: `${s}px ${s}px`,
      };
    case "dots":
    case "halftone": {
      const r = Math.max(0.6, s * (kind === "halftone" ? 0.08 + k * 0.22 : 0.05 + k * 0.1));
      const img = `radial-gradient(${colour} ${r}px, transparent ${r + 0.6}px)`;
      return kind === "halftone"
        ? { image: `${img}, ${img}`, size: `${s}px ${s}px, ${s}px ${s}px` }
        : { image: img, size: `${s}px ${s}px` };
    }
    case "blobs":
      return {
        image: `radial-gradient(50% 60% at 20% 25%, ${colour}, transparent 70%), radial-gradient(45% 55% at 80% 70%, ${colour}, transparent 70%), radial-gradient(60% 50% at 50% 100%, ${colour}, transparent 70%)`,
        size: `${s * 8}px ${s * 8}px`,
      };
    case "mesh":
      return {
        image: `radial-gradient(80% 80% at 10% 10%, ${colour}, transparent 60%), radial-gradient(70% 70% at 90% 20%, ${colour}, transparent 60%), radial-gradient(90% 90% at 50% 95%, ${colour}, transparent 60%)`,
        size: "cover",
      };
    case "image": {
      const src = layer.baked ?? layer.src;
      if (!src) return null;
      const woven = Math.max(0, Math.min(1, layer.weave ?? 0));
      // Turned all the way up there is one picture covering the surface;
      // below that the tile simply grows, so the repeat gets harder to read.
      if (woven >= 0.98) return { image: `url(${JSON.stringify(src)})`, size: "cover", repeat: "no-repeat" };
      return { image: `url(${JSON.stringify(src)})`, size: `${Math.round(s * (1 + woven * 9))}px auto`, repeat: "repeat" };
    }
    default:
      return null;
  }
}

/**
 * The whole stack as one set of CSS properties, painted over `base`.
 *
 * The background colour is never replaced — it is the bottom of the stack and
 * every layer sits over it. A picture layer is veiled with that same colour to
 * carry its opacity, and, when it is woven, to draw its edges back down into
 * the background so the middle is where the texture concentrates.
 */
export function textureCss(layers: TextureLayer[], palette: Palette, base: string): React.CSSProperties {
  const on = layers.filter((l) => l.on);
  if (!on.length) return { background: base };

  const images: string[] = [];
  const sizes: string[] = [];
  const repeats: string[] = [];
  const blends: string[] = [];

  const push = (image: string, size: string, repeat: string, blend: string) => {
    const parts = splitLayers(image);
    const sizeParts = splitLayers(size);
    parts.forEach((part, i) => {
      images.push(part.trim());
      sizes.push((sizeParts[i] ?? sizeParts[0]!).trim());
      repeats.push(repeat);
      blends.push(blend);
    });
  };

  for (const l of on) {
    // A generated pattern carries its opacity in its own colour; a picture
    // cannot, so it gets a veil of the background colour instead.
    const picture = l.kind === "image";
    const role = shiftHue(palette[l.role], l.hue ?? 0);
    const colour = withAlpha(role, GRAINY.has(l.kind) || picture ? 1 : l.opacity);
    const built = layerCss(l, colour);
    if (!built) continue;
    // Earlier in the list is nearer the front, so the veil goes in first: it
    // has to sit over its own picture to fade it, not behind it.
    if (picture) {
      const veil = veilFor(l, base);
      if (veil) push(veil, "cover", "no-repeat", "normal");
    }
    push(built.image, built.size, built.repeat ?? "repeat", l.blend);
  }

  if (!images.length) return { background: base };
  return {
    backgroundImage: images.join(", "),
    backgroundSize: sizes.join(", "),
    backgroundRepeat: repeats.join(", "),
    backgroundPosition: "center",
    backgroundBlendMode: blends.join(", "),
    backgroundColor: base,
  };
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

/**
 * The background colour, drawn back over a picture toward its rim the more it
 * is woven, so the picture gathers in the middle.
 *
 * It used to carry the layer's opacity too, as a flat wash of the background
 * colour — which meant a half-faded picture painted half a page of solid
 * colour over anything beneath it, and two picture layers could never be seen
 * at once. Opacity is baked into the tile's own alpha now (see `texture.ts`),
 * so what is left here is only the weave, and layers stack.
 */
function veilFor(layer: TextureLayer, base: string): string | null {
  const woven = Math.max(0, Math.min(1, layer.weave ?? 0));
  // A layer painted over the finished page has nothing to fade back into.
  if (woven <= 0.001 || base === "transparent") return null;
  // The hole in the middle closes as the weave goes up, so the picture ends up
  // gathered in the centre with the background taking the edges.
  const clear = withAlpha(base, 0);
  const hole = Math.round(70 - woven * 62);
  return `radial-gradient(circle at 50% 50%, ${clear} 0%, ${clear} ${hole}%, ${withAlpha(base, 0.92)} 100%)`;
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
}

export const defaultLight = (): Light => ({ on: false, x: 0.5, y: 0.12, height: 0.55, strength: 0.45, lift: 10, warmth: 80 });

export interface Look {
  /** Empty strings mean "derive it from the accent hue", as before. */
  palette: Partial<Palette>;
  texture: TextureLayer[];
  /** Where the texture is painted. */
  target: "page" | "surfaces" | "both";
  /** The lamp, and the depth it gives everything under it. */
  light: Light;
}

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
  // Straight overhead the shadow is directly under the box; low and to one
  // side it rakes across the page.
  const reach = (1 - Math.max(0, Math.min(1, light.height))) * 2.4 + 0.25;
  const len = Math.min(3, dist * reach) * light.lift;
  return {
    dx: Math.round((ox / dist) * len),
    dy: Math.round((oy / dist) * len + light.lift * 0.4),
    blur: Math.round(light.lift * 1.6 + len * 0.9),
    spread: 0,
  };
}

/**
 * The aura: a role's colour glowing round an element's edge.
 *
 * Two shadows — a hairline that reads as a border and a wide soft one that
 * reads as light coming off it — so it works on a dark page and a light one
 * without a second setting.
 */
export function auraShadow(role: string | null | undefined, palette: Palette | undefined): string | null {
  if (!role || !palette) return null;
  const colour = (palette as Record<string, string>)[role];
  if (!colour) return null;
  return `0 0 0 1px ${withAlpha(colour, 0.75)}, 0 0 14px 2px ${withAlpha(colour, 0.5)}, 0 0 36px 6px ${withAlpha(colour, 0.22)}`;
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
  const roles = ROLES.filter((r) => look.palette[r]);
  if (roles.length) {
    lines.push("Colour roles (use these exactly):");
    for (const r of ROLES) lines.push(`  - ${ROLE_LABEL[r]}: ${resolved[r]}${look.palette[r] ? "" : " (derived)"}`);
  }
  lines.push(...describeLight(look.light ?? defaultLight()));
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
    lines.push("  Every layer above is plain CSS — no image files unless one is named.");
  }
  return lines;
}
