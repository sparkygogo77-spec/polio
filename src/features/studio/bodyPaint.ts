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

/** Colours as they are actually written in a body: #rgb, #rrggbb, rgb(), rgba(). */
const COLOUR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*[\d.]+\s*[, ]\s*[\d.]+\s*[, ]\s*[\d.]+\s*(?:[,/]\s*[\d.%]+\s*)?\)/g;

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
  const nums = s.match(/[\d.]+/g);
  if (!nums || nums.length < 3) return null;
  const [r, g, b] = nums.slice(0, 3).map(Number);
  return [r!, g!, b!].every((n) => Number.isFinite(n)) ? [r!, g!, b!] : null;
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
