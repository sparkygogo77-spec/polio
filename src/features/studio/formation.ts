/**
 * How an iteration forms, and from what.
 *
 * Every new iteration forms from nothing, driven by the real progress of its
 * task in the queue, finishing when it lands — and again whenever it is
 * updated. Not a fade-in on arrival: the thing you are watching is the work
 * being done, so the stages are tied to what the job is actually doing.
 *
 * THE ORDER, as a share of the whole:
 *
 *   0.00–0.30  the vine grows from the previous card
 *   0.30–0.55  where the vine arrives, the rim starts and is traced round
 *              the box in green while the work is running
 *   0.55–0.80  as the task nears completion the green closes in from the edges
 *   0.80–0.95  the nebula surface grows from zero
 *   0.95–1.00  the centre is the last thing to form
 *
 * THE SIGNAL. The queue has no number; it has the step the job is on, in
 * words, and those words are the milestones. `progressOf` reads them. A
 * thread lands `running` once the drawing has been read (0.15) and climbs as
 * the tracer takes its goes and the second pass runs; landing is 1.
 *
 * AGAIN ON UPDATE. A finished card that is updated — a pass added, a cost
 * noted, a line written on it — forms again: its `gen` goes up and the box
 * plays the sequence from nothing to where it stands. So the same sequence
 * is seen once per iteration and once per change to it, and never on a
 * reload of something that did not change.
 *
 * Pure. The store keeps the number, the timeline draws it, and
 * `tests/formation.mjs` holds the stages to the order above.
 */

export interface Form {
  /** Real progress, 0..1. One is landed. */
  p: number;
  /** Bumped on every update, so the box forms again. */
  gen: number;
}

/** The five bands, in order. Each ends where the next begins. */
export const FORM = {
  vine: [0, 0.3],
  rim: [0.3, 0.55],
  close: [0.55, 0.8],
  surface: [0.8, 0.95],
  core: [0.95, 1],
} as const;

export type FormStage = keyof typeof FORM;

/** Which band a value is in. */
export function stageOf(p: number): FormStage {
  if (p < FORM.rim[0]) return "vine";
  if (p < FORM.close[0]) return "rim";
  if (p < FORM.surface[0]) return "close";
  if (p < FORM.core[0]) return "surface";
  return "core";
}

/** How far through one band a value is, 0..1, clamped. */
export function within(p: number, stage: FormStage): number {
  const [a, z] = FORM[stage];
  return Math.max(0, Math.min(1, (p - a) / (z - a)));
}

/**
 * The step the job is on, as real progress.
 *
 * The strings are the ones the runs actually say (`reshapeRun`, `drawRun`,
 * `bodyRun`, `refineRun`); a step nobody here knows leaves the number where
 * it was rather than guessing. Reading is where a thread lands, so it is
 * the floor; the three trace goes climb through the middle; the second pass
 * is the last stretch before it lands.
 */
export function progressOf(step: string | undefined | null): number | null {
  const s = (step ?? "").trim();
  if (!s) return null;
  if (/^Reading the (drawing|shape)|^Claude is reading/.test(s)) return 0.15;
  if (/^Tracing the drawing/.test(s)) return 0.32;
  const go = /^Trace (\d) of (\d)/.exec(s);
  if (go) return 0.32 + (Number(go[1]) - 1) * 0.14;
  if (/^Looking at trace (\d)/.test(s)) return 0.42 + (Number(/(\d)/.exec(s)![1]) - 1) * 0.14;
  if (/^The renderer is drawing|^Claude is writing the body|^Nothing traced/.test(s)) return 0.4;
  const attempt = /^Attempt (\d) of/.exec(s);
  if (attempt) return 0.4 + (Number(attempt[1]) - 1) * 0.12;
  if (/^Looking at (what the renderer drew|attempt)/.test(s)) return 0.6;
  if (/^Refining the drawing/.test(s)) return 0.82;
  return null;
}

/** A thread's form, with the defaults a thread from before this existed gets. */
export function formOf(t: { state?: string; form?: Form | null }): Form {
  if (t.form) return t.form;
  return { p: (t.state ?? "done") === "running" ? 0.15 : 1, gen: 0 };
}

/**
 * The custom properties the stylesheet reads, worked out here so the CSS is
 * two numbers and no arithmetic: how much of the surface there is, and how
 * much of the centre.
 */
export function formVars(p: number): { "--form": number; "--form-close": number; "--form-rim": number; "--form-surface": number; "--form-core": number } {
  return {
    "--form": Math.max(0, Math.min(1, p)),
    /* The green closing in from the edges, on the box itself: nothing until
       the rim is traced, whole and gone by the time the surface comes. */
    "--form-close": within(p, "close"),
    /* The construct's own rim takes over from the traced one as the green
       closes in: nothing until then, whole by the time the surface comes. */
    "--form-rim": within(p, "close"),
    "--form-surface": within(p, "surface") * 0.999 + (p >= FORM.core[0] ? 0.001 : 0),
    "--form-core": within(p, "core"),
  };
}
