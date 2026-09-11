/**
 * A drawing, kept as vector, before anyone decides what it is for.
 *
 * The drawn path used to end in one place: a fragment stored on the part
 * and clipped to the line. That is one use of a drawing out of several,
 * and it is the least interesting one. What a person draws is a *shape
 * they own* — their bird, not a stranger's — and the same shape should be
 * able to be an icon on a button, the frame of something that holds
 * content, or a path another part moves along.
 *
 * So the trace lands here first, as the drawing itself: the paths, the box
 * they were drawn in, and nothing about what they are for. A **role** is
 * chosen after, and never invented — from the words when the words say
 * one, and otherwise by being asked.
 *
 * Normalising is done by wrapping rather than by rewriting. The path data
 * that comes back from the vectorizer is the author's line, to the
 * coordinate; rescaling it by hand is a second chance to lose the drawing.
 * An outer `<svg>` with the original `viewBox` and `preserveAspectRatio`
 * puts it in any box at any size without touching a number.
 *
 * Pure, and tested by `tests/vector.mjs`.
 */

export type VectorRole = "icon" | "surface" | "motion";

export interface VectorPath {
  d: string;
  /** How much of the drawing's box this path covers, 0..1. Noise is small. */
  share: number;
}

export interface DrawnVector {
  /** The box the paths are drawn in, as it came back. */
  viewBox: string;
  paths: VectorPath[];
  /** When it was traced. Absent on one handed straight to a part. */
  at?: number;
  /** Where it came from, for the record: the model, or the hand. */
  from?: string;
}

/** How small a path has to be before it is noise rather than a line. */
const NOISE = 0.0015;
/** How many paths an icon keeps. Fewer is crisper at 16px. */
export const ICON_PATHS = 6;

/* ------------------------------------------------------------------ */
/* Reading what came back                                              */
/* ------------------------------------------------------------------ */

/** The four numbers of a viewBox, or null. */
export function readViewBox(svg: string): [number, number, number, number] | null {
  const m = /viewBox\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(svg);
  if (!m) return null;
  const n = (m[1] ?? m[2] ?? "").trim().split(/[\s,]+/).map(Number);
  return n.length === 4 && n.every((v) => Number.isFinite(v)) ? [n[0]!, n[1]!, n[2]!, n[3]!] : null;
}

/**
 * How much room a path takes up.
 *
 * This decides what counts as noise, so it has to be right: the first
 * version paired every number in the data as an x and a y, which is only
 * true if the path never uses `h` or `v`. A horizontal run then measured
 * zero wide and a real line was thrown away as a speck.
 *
 * So the pen is actually walked. `h` and `v` move one axis, `z` returns to
 * the start of the subpath, and the curve commands are read as points —
 * control points included, which overstates a curve's box slightly and
 * never loses one.
 */
function extent(d: string): { w: number; h: number } {
  let x = 0, y = 0, sx = 0, sy = 0;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const see = (px: number, py: number) => {
    if (px < x0) x0 = px;
    if (py < y0) y0 = py;
    if (px > x1) x1 = px;
    if (py > y1) y1 = py;
  };
  for (const m of d.matchAll(/([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)/g)) {
    const cmd = m[1]!;
    const n = (m[2]!.match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M":
      case "L":
      case "T":
        for (let i = 0; i + 1 < n.length; i += 2) {
          x = rel ? x + n[i]! : n[i]!;
          y = rel ? y + n[i + 1]! : n[i + 1]!;
          if (cmd.toUpperCase() === "M" && i === 0) { sx = x; sy = y; }
          see(x, y);
        }
        break;
      case "H":
        for (const v of n) { x = rel ? x + v : v; see(x, y); }
        break;
      case "V":
        for (const v of n) { y = rel ? y + v : v; see(x, y); }
        break;
      case "Z":
        x = sx; y = sy;
        see(x, y);
        break;
      default: {
        // C, S, Q, A: pairs, and the last pair is where the pen ends up.
        for (let i = 0; i + 1 < n.length; i += 2) {
          const px = rel ? x + n[i]! : n[i]!;
          const py = rel ? y + n[i + 1]! : n[i + 1]!;
          see(px, py);
          if (i + 2 >= n.length) { x = px; y = py; }
        }
        break;
      }
    }
  }
  return Number.isFinite(x0) ? { w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) } : { w: 0, h: 0 };
}

/**
 * The vector inside a fragment.
 *
 * Anything that is not a path is left behind, because the roles all need
 * outlines: a `<rect>` the tracer found under the drawing is a ground, and
 * an icon made of it is a filled square.
 */
export function readVector(svg: string, from?: string): DrawnVector | null {
  const box = readViewBox(svg) ?? [0, 0, 100, 100];
  const area = Math.max(1e-6, box[2] * box[3]);
  const paths: VectorPath[] = [];
  for (const m of svg.matchAll(/<path\b[^>]*\bd\s*=\s*(?:"([^"]+)"|'([^']+)')[^>]*>/gi)) {
    const d = (m[1] ?? m[2] ?? "").trim();
    if (!d) continue;
    const e = extent(d);
    // A line is thin by nature, so a path that is long counts even when
    // the box round it has almost no area. Noise is short *and* small.
    const span = Math.max(e.w, e.h) / Math.max(1e-6, Math.max(box[2], box[3]));
    paths.push({ d, share: Math.min(1, Math.max((e.w * e.h) / area, span * span * 0.25)) });
  }
  if (!paths.length) return null;
  return { viewBox: box.join(" "), paths, at: Date.now(), ...(from ? { from } : {}) };
}

/* ------------------------------------------------------------------ */
/* Making it an icon                                                   */
/* ------------------------------------------------------------------ */

/**
 * The same drawing, cut down until it survives being small.
 *
 * Two things kill a traced drawing at 16px: hundreds of paths, and hair
 * that was never part of the line. Both go. What is left is the few paths
 * that carry the shape, in the order they were drawn, and no colour at
 * all — an icon takes the colour of whatever it sits on, or it is a
 * sticker rather than an icon.
 */
export function simplify(v: DrawnVector, most = ICON_PATHS): DrawnVector {
  const real = v.paths.filter((p) => p.share >= NOISE);
  const kept = real.length ? real : v.paths;
  if (kept.length <= most) return { ...v, paths: kept };
  /*
   * Fewer paths, not less drawing.
   *
   * The first version of this kept the biggest few and threw the rest
   * away, which on a trace whose paths are arbitrary fragments — a row
   * band, a run of pixels — deletes most of the bird. Path data in one
   * coordinate system concatenates: two `d` strings joined are one path
   * drawing both. So the paths are merged in the order they were drawn
   * until there are few enough, and every line the person drew is still
   * in there. Only true noise is dropped, and that is dropped for being
   * noise rather than for being small.
   */
  const per = Math.ceil(kept.length / most);
  const merged: VectorPath[] = [];
  for (let i = 0; i < kept.length; i += per) {
    const group = kept.slice(i, i + per);
    merged.push({ d: group.map((p) => p.d).join(" "), share: group.reduce((n, p) => n + p.share, 0) });
  }
  return { ...v, paths: merged };
}

/** How many paths it has, and how many of those are more than noise. */
export function weigh(v: DrawnVector): { paths: number; real: number; bytes: number } {
  return {
    paths: v.paths.length,
    real: v.paths.filter((p) => p.share >= NOISE).length,
    bytes: v.paths.reduce((n, p) => n + p.d.length, 0),
  };
}

/**
 * The drawing as markup, at any size, in whatever colour it is standing in.
 *
 * `currentColor` and no `fill` of its own is the whole of "colour taken
 * from the theme": the part it sits in sets a colour and this takes it, on
 * a button, in a heading, anywhere.
 */
export function vectorMarkup(v: DrawnVector, opts: { stroke?: boolean; width?: number } = {}): string {
  const inner = v.paths
    .map((p) => (opts.stroke
      ? `<path d="${p.d}" fill="none" stroke="currentColor" stroke-width="${opts.width ?? 2}" stroke-linecap="round" stroke-linejoin="round"/>`
      : `<path d="${p.d}" fill="currentColor"/>`))
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${v.viewBox}" preserveAspectRatio="xMidYMid meet" fill="currentColor" aria-hidden="true" focusable="false">${inner}</svg>`;
}

/* ------------------------------------------------------------------ */
/* What it is for                                                      */
/* ------------------------------------------------------------------ */

export const ROLE_MEANS: Record<VectorRole, string> = {
  icon: "an icon: the drawing, small, in whatever colour it sits on, and it drops onto a button",
  surface: "a surface: the drawn outline is the frame, and what is placed inside it is held by it",
  motion: "motion: another part follows this line, orbits it, or arrives along it",
};

const SAYS: Record<VectorRole, RegExp> = {
  icon: /\b(icon|glyph|mark|logo|favicon|symbol|badge)\b/i,
  surface: /\b(surface|frame|card|panel|container|holds|holding|window)\b/i,
  motion: /\b(motion|path|flies|fly|follow|follows|orbit|orbits|animate|animated|along)\b/i,
};

/**
 * The role the words asked for, or nothing.
 *
 * Nothing is a real answer and is the common one. A drawing whose words
 * say nothing about what it is for has not chosen, and the panel asks
 * rather than guessing: a bird that silently became an icon when it was
 * meant to be a frame is worse than a bird with no role yet.
 */
export function roleFromWords(words: string): VectorRole | null {
  const said = (words ?? "").trim();
  if (!said) return null;
  const hits = (Object.keys(SAYS) as VectorRole[]).filter((r) => SAYS[r]!.test(said));
  // Two roles named at once is not an answer either.
  return hits.length === 1 ? hits[0]! : null;
}

/** The parts a drawing may become, in the order the panel offers them. */
export const ROLES: VectorRole[] = ["icon", "surface", "motion"];
