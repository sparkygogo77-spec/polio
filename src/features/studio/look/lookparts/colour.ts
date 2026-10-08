

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

