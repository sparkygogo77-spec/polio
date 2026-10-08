/**
 * A LIVING PICTURE, AND SHAPES THAT MOVE.
 *
 * J (2026-10-08): generated pictures and drawn shapes sat still, and making
 * one move took a prompt in a code chat. Now a part picks a motion by name
 * and it moves: on the board, in the preview, and on the site through Send
 * the design back.
 *
 * Eight motions, none needing words:
 *   - for pictures: drift, breathe, shimmer, glow pulse, parallax on scroll;
 *   - for shapes: draw on, trace glow, wobble.
 *
 * A picture can also be cut into 2 to 4 layers (`livingCut.ts`): its bright
 * parts lift off the back as their own see-through layers, and drift and
 * parallax move each layer at its own depth, the front one most.
 *
 * Everything goes out as CSS: tokens (`--live-seconds`, `--live-amount`,
 * `--live-colour`, `--live-layers`) read by fixed keyframes
 * (`LIVE_KEYFRAMES`, named `polio-live-*`). The keyframes never change, so
 * a code chat or the site's own CSS can retune a motion by its tokens alone,
 * and no script runs on the site. Moving parts use the `translate`, `scale`
 * and `rotate` properties, which stack with a part's own `transform`
 * instead of replacing it.
 *
 * Pure: no store, no browser. `tests/living-picture.mjs` holds it.
 */

export type LivePreset = "drift" | "breathe" | "shimmer" | "glow" | "parallax" | "draw" | "trace" | "wobble";

export interface LivingPicture {
  preset: LivePreset;
  /** Seconds one round of the motion takes. */
  seconds: number;
  /** How much it moves, 0.1 (barely) to 1 (a lot). */
  amount: number;
  /** The light of a glow, a shimmer or a trace. */
  colour: string;
  /** The picture cut into layers, as data URLs, FRONT FIRST (the order CSS stacks backgrounds in). Empty: the part moves as one. */
  layers?: string[];
}

export const LIVE_PRESETS: { id: LivePreset; label: string; for: "picture" | "shape"; about: string }[] = [
  { id: "drift", label: "Drift", for: "picture", about: "floats slowly; cut into layers, each layer drifts at its own depth" },
  { id: "breathe", label: "Breathe", for: "picture", about: "swells and settles" },
  { id: "shimmer", label: "Shimmer", for: "picture", about: "a band of light sweeps across" },
  { id: "glow", label: "Glow pulse", for: "picture", about: "its light grows and fades" },
  { id: "parallax", label: "Parallax", for: "picture", about: "moves as the page scrolls; layers move at their own depth" },
  { id: "draw", label: "Draw on", for: "shape", about: "draws itself in from one side" },
  { id: "trace", label: "Trace glow", for: "shape", about: "a glow travels round its edge" },
  { id: "wobble", label: "Wobble", for: "shape", about: "rocks gently" },
];

export const LIVE_WORD: Record<LivePreset, string> = Object.fromEntries(LIVE_PRESETS.map((p) => [p.id, p.about])) as Record<LivePreset, string>;

/** How fast each motion goes round by default, in seconds. */
const DEFAULT_SECONDS: Record<LivePreset, number> = { drift: 8, breathe: 4, shimmer: 3, glow: 2.4, parallax: 1, draw: 3, trace: 2.4, wobble: 2 };
export const MIN_SECONDS = 0.5;
export const MAX_SECONDS = 20;
export const MAX_LAYERS = 4;

/** How far back each layer sits: the front moves all the way, the back barely. */
const DEPTH = [1, 0.6, 0.35, 0.15];

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Number.isFinite(v) ? v : lo));
const r2 = (v: number) => Math.round(v * 100) / 100;

export function newLiving(preset: LivePreset = "drift"): LivingPicture {
  return { preset, seconds: DEFAULT_SECONDS[preset], amount: 0.5, colour: "#77eeff" };
}

/** The same motion, switched to another preset: its own usual speed, the rest kept. */
export function switchPreset(l: LivingPicture, preset: LivePreset): LivingPicture {
  return { ...l, preset, seconds: DEFAULT_SECONDS[preset] };
}

export function isLiving(l: unknown): l is LivingPicture {
  const x = l as LivingPicture | null;
  return !!x && LIVE_PRESETS.some((p) => p.id === x.preset) && typeof x.seconds === "number" && typeof x.amount === "number";
}

/** Its layers, at most four and only real pictures. One layer is no cut. */
export function liveLayers(l: LivingPicture): string[] {
  const out = (l.layers ?? []).filter((s) => typeof s === "string" && !!s).slice(0, MAX_LAYERS);
  return out.length >= 2 ? out : [];
}

/** Its own layers replace the part's picture. */
export function livingLayered(l: unknown): boolean {
  return isLiving(l) && liveLayers(l).length > 0;
}

/** The keyframe name a motion plays: drift and parallax have one per layer count. */
export function liveName(l: LivingPicture): string {
  const n = liveLayers(l).length;
  return (l.preset === "drift" || l.preset === "parallax") && n ? `polio-live-${l.preset}-${n}` : `polio-live-${l.preset}`;
}

const TIMING: Record<LivePreset, string> = {
  drift: "ease-in-out infinite alternate",
  breathe: "ease-in-out infinite alternate",
  shimmer: "linear infinite",
  glow: "ease-in-out infinite alternate",
  parallax: "linear both",
  draw: "cubic-bezier(0.3, 0, 0.2, 1) infinite",
  trace: "linear infinite",
  wobble: "ease-in-out infinite alternate",
};

/** The `animation` it plays, reading the tokens. */
export function liveAnimation(l: LivingPicture): string {
  return l.preset === "parallax" ? `${liveName(l)} ${TIMING.parallax}` : `${liveName(l)} var(--live-seconds) ${TIMING[l.preset]}`;
}

/**
 * The motion as CSS declarations, by property: the tokens, then the slots
 * that read them. `animation` is written here; a part that already plays a
 * captured animation gets the two joined (`styleLayer.ts#artCss`).
 */
export function liveCss(l: LivingPicture): Record<string, string> {
  const layers = liveLayers(l);
  const out: Record<string, string> = {
    "--live-seconds": `${r2(clamp(l.seconds, MIN_SECONDS, MAX_SECONDS))}s`,
    "--live-amount": `${r2(clamp(l.amount, 0.1, 1))}`,
    "--live-colour": l.colour || "#77eeff",
  };
  if (layers.length) {
    out["--live-layers"] = layers.map((s) => `url("${s.replace(/"/g, "%22")}")`).join(", ");
    out["background-image"] = "var(--live-layers)";
    /* A little bigger than the part, so a layer drifting never shows its edge. */
    out["background-size"] = layers.map(() => "120% 120%").join(", ");
    out["background-position"] = layers.map(() => "50% 50%").join(", ");
    out["background-repeat"] = "no-repeat";
  }
  out.animation = liveAnimation(l);
  if (l.preset === "parallax") out["animation-timeline"] = "view()";
  return out;
}

/** The same, as a React style object, for the board and the published page. */
export function liveStyle(l: LivingPicture): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(liveDeclarations(l))) out[k.startsWith("--") ? k : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return out;
}

/** What a motion's slots are when it is taken off again. */
export const LIVE_UNSET: Record<string, string> = { "animation-timeline": "auto", "background-size": "auto", "background-position": "0% 0%", "background-repeat": "repeat" };

/* ------------------------------------------------------------------ */
/* The keyframes                                                       */
/* ------------------------------------------------------------------ */

const A = "var(--live-amount)";

/** Each layer's place, front first, `t` from -1 to 1 along the motion. */
function layerPositions(n: number, x: number, y: number): string {
  return Array.from({ length: n }, (_, i) => `calc(50% + ${A} * ${r2(x * DEPTH[i]!)}%) calc(50% + ${A} * ${r2(y * DEPTH[i]!)}%)`).join(", ");
}

function layeredKeyframes(): string[] {
  const out: string[] = [];
  for (let n = 2; n <= MAX_LAYERS; n++) {
    out.push(`@keyframes polio-live-drift-${n} { from { background-position: ${layerPositions(n, -45, -12)}; } to { background-position: ${layerPositions(n, 45, 12)}; } }`);
    out.push(`@keyframes polio-live-parallax-${n} { from { background-position: ${layerPositions(n, 0, -50)}; } to { background-position: ${layerPositions(n, 0, 50)}; } }`);
  }
  return out;
}

const shadow = (x: string, y: string, blur: string) => `drop-shadow(${x} ${y} ${blur} var(--live-colour))`;

/**
 * Every keyframe a motion can name. Fixed text: the tokens on each part say
 * how far and how fast, so one copy serves every part on a page.
 */
export const LIVE_KEYFRAMES = [
  `@keyframes polio-live-drift { from { translate: calc(${A} * -8px) calc(${A} * 4px); } to { translate: calc(${A} * 8px) calc(${A} * -4px); } }`,
  `@keyframes polio-live-breathe { from { scale: 1; } to { scale: calc(1 + ${A} * 0.06); } }`,
  `@keyframes polio-live-shimmer { from { mask-position: 100% 0; -webkit-mask-position: 100% 0; } to { mask-position: 0% 0; -webkit-mask-position: 0% 0; } }`,
  `@keyframes polio-live-glow { from { filter: ${shadow("0", "0", `calc(${A} * 3px)`)}; } to { filter: ${shadow("0", "0", `calc(${A} * 18px)`)}; } }`,
  `@keyframes polio-live-parallax { from { translate: 0 calc(${A} * 40px); } to { translate: 0 calc(${A} * -40px); } }`,
  `@keyframes polio-live-draw { 0% { clip-path: inset(0 100% 0 0); } 60%, 100% { clip-path: inset(0 0 0 0); } }`,
  `@keyframes polio-live-trace { ${[["1", "0"], ["0", "1"], ["-1", "0"], ["0", "-1"], ["1", "0"]].map(([x, y], i) => `${i * 25}% { filter: ${shadow(`calc(${A} * ${x} * 6px)`, `calc(${A} * ${y} * 6px)`, `calc(${A} * 8px)`)}; }`).join(" ")} }`,
  `@keyframes polio-live-wobble { from { rotate: calc(${A} * -3deg); } to { rotate: calc(${A} * 3deg); } }`,
  ...layeredKeyframes(),
].join("\n");

/**
 * The shimmer's band of light is a mask: the part dims a little everywhere
 * but where the band is, so the sweep reads on a picture, a shape or words
 * alike, over whatever the part draws inside it.
 */
export function shimmerMask(): Record<string, string> {
  const dim = `rgb(0 0 0 / calc(1 - ${A} * 0.45))`;
  const g = `linear-gradient(105deg, ${dim} 35%, #000 50%, ${dim} 65%)`;
  return { "mask-image": g, "-webkit-mask-image": g, "mask-size": "300% 100%", "-webkit-mask-size": "300% 100%" };
}

/** The motion with everything it wears, shimmer's mask included. */
export function liveDeclarations(l: LivingPicture): Record<string, string> {
  return l.preset === "shimmer" ? { ...liveCss(l), ...shimmerMask() } : liveCss(l);
}

/** In words, for the brief. */
export function describeLiving(l: LivingPicture): string {
  const n = liveLayers(l).length;
  return `moves with no script (CSS keyframes ${liveName(l)}): it ${LIVE_WORD[l.preset]}, one round every ${r2(clamp(l.seconds, MIN_SECONDS, MAX_SECONDS))}s at strength ${r2(clamp(l.amount, 0.1, 1))}${n ? `, its picture cut into ${n} layers` : ""}; still for visitors who ask for reduced motion`;
}
