/**
 * A drawn part answers the palette, like every other part.
 *
 * A body that came back from the renderer or from the writer has its colours
 * baked into it: `fill="#8FE04A"`, and that is that. So a part made from a
 * drawing sat on the board ignoring every colour role — select it, change the
 * accent, nothing happens — which is the single loudest way a made real part
 * reads as a picture somebody pasted in rather than as a part.
 *
 * This reads the colours a body baked and hands each one to the role it is
 * plainly standing in for, without a model and without rewriting what is
 * stored: every colour becomes `var(--role, <the original>)`, so
 *
 * - the frame supplies the roles from the live theme, and the part repaints
 *   whenever the palette changes rather than only at the moment it was made;
 * - and a frame with no roles at all still renders exactly what came back,
 *   because the original is the fallback. Nothing is lost by trying.
 *
 * Which role a colour gets is decided by what the colour *is*, in the two
 * terms that matter: how light it is and how much colour is in it. Near white
 * is the ground, near black is the ink, the strongest colour in the body is
 * the accent, and whatever is left over is muted. That is the same reading a
 * person does at a glance, and it is deterministic, so a body does not
 * repaint differently on a second look.
 */

/** The roles a baked colour can be handed to, as the frame names them. */
export type PaintRole = "bg" | "text" | "accent" | "muted";

export interface Ink {
  /** The colour exactly as the body wrote it. */
  raw: string;
  /** 0..1 */
  light: number;
  /** 0..1, how much colour is in it. */
  colour: number;
  /** How many times the body uses it. */
  uses: number;
}

/** Above this it is the ground rather than a colour. */
const LIGHT = 0.86;
/** Below this it is ink rather than a colour. */
const DARK = 0.26;
/** Below this there is no colour in it at all. */
const GREY = 0.12;

/**
 * Colours as they are actually written in a body: #rgb, #rrggbb, rgb(),
 * rgba(), hsl(), hsla(), oklch() and the CSS names. `currentColor` is not
 * one, it is whatever the part inherits, so it is left alone.
 */
const NAMED: Record<string, [number, number, number]> = {
  black: [0, 0, 0], silver: [192, 192, 192], gray: [128, 128, 128], grey: [128, 128, 128], white: [255, 255, 255], maroon: [128, 0, 0], red: [255, 0, 0],
  purple: [128, 0, 128], fuchsia: [255, 0, 255], magenta: [255, 0, 255], green: [0, 128, 0], lime: [0, 255, 0], olive: [128, 128, 0], yellow: [255, 255, 0],
  navy: [0, 0, 128], blue: [0, 0, 255], teal: [0, 128, 128], aqua: [0, 255, 255], cyan: [0, 255, 255], orange: [255, 165, 0], aliceblue: [240, 248, 255],
  antiquewhite: [250, 235, 215], aquamarine: [127, 255, 212], azure: [240, 255, 255], beige: [245, 245, 220], bisque: [255, 228, 196], blanchedalmond: [255, 235, 205],
  blueviolet: [138, 43, 226], brown: [165, 42, 42], burlywood: [222, 184, 135], cadetblue: [95, 158, 160], chartreuse: [127, 255, 0], chocolate: [210, 105, 30],
  coral: [255, 127, 80], cornflowerblue: [100, 149, 237], cornsilk: [255, 248, 220], crimson: [220, 20, 60], darkblue: [0, 0, 139], darkcyan: [0, 139, 139],
  darkgoldenrod: [184, 134, 11], darkgray: [169, 169, 169], darkgrey: [169, 169, 169], darkgreen: [0, 100, 0], darkkhaki: [189, 183, 107], darkmagenta: [139, 0, 139],
  darkolivegreen: [85, 107, 47], darkorange: [255, 140, 0], darkorchid: [153, 50, 204], darkred: [139, 0, 0], darksalmon: [233, 150, 122], darkseagreen: [143, 188, 143],
  darkslateblue: [72, 61, 139], darkslategray: [47, 79, 79], darkslategrey: [47, 79, 79], darkturquoise: [0, 206, 209], darkviolet: [148, 0, 211], deeppink: [255, 20, 147],
  deepskyblue: [0, 191, 255], dimgray: [105, 105, 105], dimgrey: [105, 105, 105], dodgerblue: [30, 144, 255], firebrick: [178, 34, 34], floralwhite: [255, 250, 240],
  forestgreen: [34, 139, 34], gainsboro: [220, 220, 220], ghostwhite: [248, 248, 255], gold: [255, 215, 0], goldenrod: [218, 165, 32], greenyellow: [173, 255, 47],
  honeydew: [240, 255, 240], hotpink: [255, 105, 180], indianred: [205, 92, 92], indigo: [75, 0, 130], ivory: [255, 255, 240], khaki: [240, 230, 140], lavender: [230, 230, 250],
  lavenderblush: [255, 240, 245], lawngreen: [124, 252, 0], lemonchiffon: [255, 250, 205], lightblue: [173, 216, 230], lightcoral: [240, 128, 128], lightcyan: [224, 255, 255],
  lightgoldenrodyellow: [250, 250, 210], lightgray: [211, 211, 211], lightgrey: [211, 211, 211], lightgreen: [144, 238, 144], lightpink: [255, 182, 193], lightsalmon: [255, 160, 122],
  lightseagreen: [32, 178, 170], lightskyblue: [135, 206, 250], lightslategray: [119, 136, 153], lightslategrey: [119, 136, 153], lightsteelblue: [176, 196, 222], lightyellow: [255, 255, 224],
  limegreen: [50, 205, 50], linen: [250, 240, 230], mediumaquamarine: [102, 205, 170], mediumblue: [0, 0, 205], mediumorchid: [186, 85, 211], mediumpurple: [147, 112, 219],
  mediumseagreen: [60, 179, 113], mediumslateblue: [123, 104, 238], mediumspringgreen: [0, 250, 154], mediumturquoise: [72, 209, 204], mediumvioletred: [199, 21, 133], midnightblue: [25, 25, 112],
  mintcream: [245, 255, 250], mistyrose: [255, 228, 225], moccasin: [255, 228, 181], navajowhite: [255, 222, 173], oldlace: [253, 245, 230], olivedrab: [107, 142, 35], orangered: [255, 69, 0],
  orchid: [218, 112, 214], palegoldenrod: [238, 232, 170], palegreen: [152, 251, 152], paleturquoise: [175, 238, 238], palevioletred: [219, 112, 147], papayawhip: [255, 239, 213],
  peachpuff: [255, 218, 185], peru: [205, 133, 63], pink: [255, 192, 203], plum: [221, 160, 221], powderblue: [176, 224, 230], rebeccapurple: [102, 51, 153], rosybrown: [188, 143, 143],
  royalblue: [65, 105, 225], saddlebrown: [139, 69, 19], salmon: [250, 128, 114], sandybrown: [244, 164, 96], seagreen: [46, 139, 87], seashell: [255, 245, 238], sienna: [160, 82, 45],
  skyblue: [135, 206, 235], slateblue: [106, 90, 205], slategray: [112, 128, 144], slategrey: [112, 128, 144], snow: [255, 250, 250], springgreen: [0, 255, 127], steelblue: [70, 130, 180],
  tan: [210, 180, 140], thistle: [216, 191, 216], tomato: [255, 99, 71], turquoise: [64, 224, 208], violet: [238, 130, 238], wheat: [245, 222, 179], whitesmoke: [245, 245, 245],
  yellowgreen: [154, 205, 50],
};
const NAME_RE = Object.keys(NAMED).sort((a, b) => b.length - a.length).join("|");
const COLOUR = new RegExp(
  `#[0-9a-fA-F]{3,8}\\b|\\b(?:rgba?|hsla?|oklch)\\(\\s*[\\d.]+(?:deg|%)?\\s*[, ]\\s*[\\d.]+%?\\s*[, ]\\s*[\\d.]+(?:deg|%)?\\s*(?:[,/]\\s*[\\d.%]+\\s*)?\\)|(?<![\\w-])(?:${NAME_RE})(?![\\w-])`,
  "gi",
);

const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [(r + m) * 255, (g + m) * 255, (b + m) * 255];
};

/** OKLCH to sRGB, clipped to the gamut: the standard matrices, nothing clever. */
const oklchToRgb = (L: number, C: number, hDeg: number): [number, number, number] => {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h), b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3, m = m_ ** 3, s = s_ ** 3;
  const lin = [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
  const srgb = (v: number) => { const c = Math.min(1, Math.max(0, v)); return (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055) * 255; };
  return [srgb(lin[0]!), srgb(lin[1]!), srgb(lin[2]!)];
};

/** A colour as red, green and blue in 0..255, or nothing when it cannot be read. */
export function rgbOf(raw: string): [number, number, number] | null {
  const s = raw.trim();
  if (s.startsWith("#")) {
    const hex = s.slice(1);
    const wide = hex.length >= 6;
    const part = (i: number) => {
      const at = wide ? hex.slice(i * 2, i * 2 + 2) : hex[i]!.repeat(2);
      const n = parseInt(at, 16);
      return Number.isFinite(n) ? n : null;
    };
    if (hex.length !== 3 && hex.length !== 4 && hex.length !== 6 && hex.length !== 8) return null;
    const r = part(0), g = part(1), b = part(2);
    return r === null || g === null || b === null ? null : [r, g, b];
  }
  const named = NAMED[s.toLowerCase()];
  if (named) return named;
  const nums = s.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  const [a, b, c] = nums.slice(0, 3).map(Number) as [number, number, number];
  if (![a, b, c].every((n) => Number.isFinite(n))) return null;
  const fn = s.slice(0, s.indexOf("(")).toLowerCase();
  if (fn === "hsl" || fn === "hsla") return hslToRgb(((a % 360) + 360) % 360, Math.min(1, b / 100), Math.min(1, c / 100));
  if (fn === "oklch") return oklchToRgb(a > 1 ? a / 100 : a, b > 0.5 && /%/.test(nums[1] ?? "") ? (b / 100) * 0.4 : b, c);
  return [a, b, c];
}

/** How light it is and how much colour is in it, both 0..1. */
export function readInk(raw: string): { light: number; colour: number } | null {
  const rgb = rgbOf(raw);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((n) => Math.min(255, Math.max(0, n)) / 255) as [number, number, number];
  const hi = Math.max(r, g, b);
  const lo = Math.min(r, g, b);
  // Perceived lightness, not the average: yellow is light and blue is not.
  return { light: 0.299 * r + 0.587 * g + 0.114 * b, colour: hi - lo };
}

/** Every colour a body bakes in, in the order it first uses them. */
export function inksOf(html: string): Ink[] {
  const seen = new Map<string, Ink>();
  for (const raw of html.match(COLOUR) ?? []) {
    const key = raw.toLowerCase();
    const had = seen.get(key);
    if (had) { had.uses++; continue; }
    const read = readInk(raw);
    if (!read) continue;
    seen.set(key, { raw, uses: 1, ...read });
  }
  return [...seen.values()];
}

/**
 * Which role each baked colour stands in for.
 *
 * The accent is the one colour in the body with the most colour in it — the
 * thing a person would point at and call "the colour of it". Everything else
 * chromatic is muted, so a body with two colours does not claim two accents.
 */
export function rolesFor(inks: Ink[]): Map<string, PaintRole> {
  const out = new Map<string, PaintRole>();
  const chromatic = inks.filter((i) => i.colour >= GREY);
  const accent = chromatic.slice().sort((a, b) => b.colour - a.colour || b.uses - a.uses)[0] ?? null;
  for (const ink of inks) {
    const key = ink.raw.toLowerCase();
    if (accent && key === accent.raw.toLowerCase()) { out.set(key, "accent"); continue; }
    if (ink.colour < GREY && ink.light >= LIGHT) { out.set(key, "bg"); continue; }
    if (ink.colour < GREY && ink.light <= DARK) { out.set(key, "text"); continue; }
    out.set(key, "muted");
  }
  return out;
}

/**
 * The body, painted in roles instead of in colours.
 *
 * The original stays as the fallback, so this is safe to run on anything: a
 * body with no colours at all comes back unchanged, and a frame that supplies
 * no roles renders exactly what the renderer drew.
 */
export function paintRoles(html: string, opts: { prefer?: readonly PaintRole[] } = {}): string {
  if (!html) return html;
  // Painting twice would nest a role inside its own fallback, so anything
  // already painted is taken back to the colour it fell back to first.
  const plain = unpaint(html);
  const inks = inksOf(plain);
  const roles = rolesFor(inks);
  /*
   * A body with one colour in it follows whichever colour the person set.
   *
   * A traced drawing is one ink — the line, in near-black — and the reading
   * above calls near-black "text", which is right for a body with several
   * colours and wrong for a diagonal: a person who picks up a drawn line
   * and turns its colour to red means the line, and "the colour" on the
   * wheel is the accent, so the line went on ignoring them. When there is
   * only one ink there is nothing else it could be but the colour of the
   * thing, so it takes the first role the person has actually set on this
   * part, and reads as before when they have set none.
   */
  if (inks.length === 1 && opts.prefer?.length) roles.set(inks[0]!.raw.toLowerCase(), opts.prefer[0]!);
  if (!roles.size) return plain;
  return plain.replace(COLOUR, (raw) => {
    const role = roles.get(raw.toLowerCase());
    return role ? `var(--part-${role}, ${raw})` : raw;
  });
}

/** A painted body back as the colours it was drawn in. Painting is reversible. */
export function unpaint(html: string): string {
  return html.replace(/var\(--part-(?:bg|text|accent|muted),\s*([^()]*?)\s*\)/g, "$1");
}

/** The roles a frame declares, from the theme the part is standing in. */
export function roleVars(t: { bg: string; text: string; accent: string; muted: string }): string {
  return `--part-bg:${t.bg};--part-text:${t.text};--part-accent:${t.accent};--part-muted:${t.muted};`;
}
