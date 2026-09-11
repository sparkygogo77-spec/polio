/**
 * Frame interpolation — the crate, in numbers.
 *
 * You give it a handful of keyframes and it works out every frame in between.
 * The keyframes are checkpoints the motion passes through exactly; the gaps
 * between them are filled by easing from one to the next, which is what makes
 * five drawings into a second and a half of movement.
 *
 * Nothing here touches the DOM or a canvas: this file only decides *which*
 * two keyframes each output frame sits between, and how far along it is.
 * `MotionPanel` draws that, and `motionBrief` writes it down for whoever —
 * or whatever — has to reproduce it properly later.
 *
 * The numbers and their reasons live in `docs/MOTION.md`; the defaults here
 * are that table.
 */

export type MotionLoop = "wrap" | "ping-pong" | "once";
export type MotionEase = "ease" | "linear";

export interface MotionAsset {
  id: string;
  name: string;
  /**
   * The sleeves. A slot can be empty while you are still filling the crate —
   * everything downstream works off the filled ones, in order.
   */
  frames: (string | null)[];
  /** Seconds for the whole sequence. */
  duration: number;
  fps: number;
  loop: MotionLoop;
  /** Frames each keyframe is held for before it moves on. */
  hold: number;
  /**
   * How long each gap is, relative to the others. A gap set to 2 takes twice
   * as many frames as a gap set to 1 — that is how a motion pauses somewhere
   * without you redrawing it.
   */
  gaps: number[];
  ease: MotionEase;
  /** What wears it, in the reader's words. Goes straight into the brief. */
  use: string;
}

export const SLEEVES = 5;

export function newMotion(name = "Motion 1"): MotionAsset {
  return {
    id: `mo_${Math.random().toString(36).slice(2, 8)}`,
    name,
    frames: Array.from({ length: SLEEVES }, () => null),
    duration: 1.5,
    fps: 30,
    loop: "wrap",
    hold: 2,
    gaps: Array.from({ length: SLEEVES }, () => 1),
    ease: "ease",
    use: "background layer",
  };
}

/** The filled sleeves, in order, with their slot numbers kept. */
export function filled(asset: MotionAsset): { at: number; src: string }[] {
  return asset.frames
    .map((src, at) => ({ at, src }))
    .filter((f): f is { at: number; src: string } => !!f.src);
}

/** How many gaps this asset has: one per pair, plus the one that wraps home. */
export function gapCount(asset: MotionAsset): number {
  const n = filled(asset).length;
  if (n < 2) return 0;
  return asset.loop === "wrap" ? n : n - 1;
}

export function totalFrames(asset: MotionAsset): number {
  return Math.max(1, Math.round(asset.duration * asset.fps));
}

/** Where one output frame sits: between two keyframes, this far along. */
export interface Tween {
  /** Index into `filled(asset)`. */
  from: number;
  to: number;
  /** 0..1, already eased. 0 means "this frame is the keyframe itself". */
  t: number;
  /** True while the keyframe is being held, so a scrubber can say so. */
  holding: boolean;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * The whole timeline, one entry per output frame.
 *
 * Each keyframe is held for `hold` frames so it registers as a checkpoint,
 * and whatever is left over is shared between the gaps by their weights. A
 * gap that ends up with no frames at all still cuts to the next keyframe,
 * which is a legitimate thing to ask for and not an error.
 */
export function planFrames(asset: MotionAsset): Tween[] {
  const keys = filled(asset);
  if (keys.length === 0) return [];
  if (keys.length === 1) return [{ from: 0, to: 0, t: 0, holding: true }];

  const gaps = gapCount(asset);
  const total = totalFrames(asset);
  const held = Math.min(asset.hold * keys.length, Math.max(0, total - gaps));
  const perKey = keys.length ? Math.floor(held / keys.length) : 0;
  const spare = Math.max(0, total - perKey * keys.length);

  const weights = Array.from({ length: gaps }, (_, i) => Math.max(0.01, asset.gaps[i] ?? 1));
  const sum = weights.reduce((a, b) => a + b, 0);
  const lengths = weights.map((w) => Math.max(0, Math.round((w / sum) * spare)));
  // Rounding leaves a frame or two unaccounted for; the last gap absorbs it so
  // the sequence is exactly as long as it says it is.
  const drift = spare - lengths.reduce((a, b) => a + b, 0);
  if (lengths.length) lengths[lengths.length - 1] = Math.max(0, lengths[lengths.length - 1]! + drift);

  const out: Tween[] = [];
  for (let g = 0; g < gaps; g++) {
    const from = g;
    const to = (g + 1) % keys.length;
    for (let h = 0; h < perKey; h++) out.push({ from, to, t: 0, holding: true });
    const len = lengths[g] ?? 0;
    for (let i = 0; i < len; i++) {
      const raw = (i + 1) / (len + 1);
      out.push({ from, to, t: asset.ease === "linear" ? raw : easeInOut(raw), holding: false });
    }
  }
  // "once" and "ping-pong" end on the last keyframe rather than on the way
  // back to the first, so the last checkpoint is actually seen.
  if (asset.loop !== "wrap") {
    const last = keys.length - 1;
    for (let h = 0; h < Math.max(1, perKey); h++) out.push({ from: last, to: last, t: 0, holding: true });
  }
  return out.length ? out : [{ from: 0, to: 1, t: 0, holding: true }];
}

/**
 * Ping-pong plays the plan forward and then back, so the motion returns the
 * way it came instead of cutting. The turn-round frames are not repeated.
 */
export function playOrder(asset: MotionAsset, plan: Tween[]): Tween[] {
  if (asset.loop !== "ping-pong" || plan.length < 3) return plan;
  return [...plan, ...plan.slice(1, -1).reverse()];
}

/* ------------------------------------------------------------------ */
/* The brief                                                           */
/* ------------------------------------------------------------------ */

const LOOP_WORD: Record<MotionLoop, string> = {
  wrap: "wrap (the last gap returns to keyframe 1, seamless)",
  "ping-pong": "ping-pong (plays forward then back)",
  once: "once (stops on the last keyframe)",
};

/**
 * What an AI is handed so it can produce these in-betweens properly.
 *
 * The Builder's own interpolation is a cross-dissolve: honest, instant, and
 * exactly right for a fade or a colour turn — and not what a shape morphing
 * along its shortest path looks like. So the brief says what the frames must
 * be, in the terms `docs/MOTION.md` set out, and a generator fills the gaps
 * to the same timing the crate is already playing.
 */
export function motionBrief(asset: MotionAsset, size?: { w: number; h: number }): string {
  const keys = filled(asset);
  const gaps = gapCount(asset);
  const total = totalFrames(asset);
  const dims = size ? `${size.w}×${size.h}` : "the size they were drawn at";
  const weights = asset.gaps.slice(0, gaps);
  const even = weights.every((w) => w === weights[0]);
  return [
    `MOTION ASSET BRIEF, ${asset.name}`,
    `Keyframes: ${keys.length} images in order at ${dims}. Each is a checkpoint the animation passes`,
    `through exactly (pixel-faithful on its frame). Duration ${asset.duration}s at ${asset.fps} fps = ${total} frames.`,
    `Loop: ${LOOP_WORD[asset.loop]}.`,
    `Timing: ${gaps} gap${gaps === 1 ? "" : "s"}${even ? " of equal length" : ` weighted ${weights.join(":")}`}; hold each keyframe ${asset.hold} frames;`,
    `${asset.ease === "linear" ? "linear" : "ease-in-out"} per gap.`,
    "In-between frames must: keep one continuous subject; introduce nothing absent from both",
    "neighbouring keyframes; morph shapes along the shortest path; interpolate colour in OKLCH;",
    "keep edges crisp (no ghosting or double exposure); move each background layer at its own",
    "parallax speed; match the style of the keyframes in line weight, palette, grain and lighting.",
    `Used as: ${asset.use}.`,
    "Output: WebM (VP9, alpha if the keyframes carry alpha) + MP4 fallback + a one-row sprite",
    "sheet for hover states; poster = keyframe 1.",
    "Quality gate: reject any frame with artifacts, drift from its keyframe above 2% of pixels, or",
    "flicker between consecutive frames; regenerate that gap only.",
    "",
    "The Builder already plays this sequence as a cross-dissolve on the same timing, that is the",
    "floor, not the target. Match the timing exactly and replace the dissolve with real motion.",
  ].join("\n");
}
