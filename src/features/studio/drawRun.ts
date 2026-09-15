"use client";
/**
 * Making a drawing real, with no model that writes anywhere near it.
 *
 * The old path went: rasterise the strokes, hand the picture and a
 * description to Claude, and ask it to *write* SVG that looks like what was
 * drawn. Two translations — line to words, words to code — and the drawing
 * was the thing that got lost in both. A helix came back as a box with the
 * word "helix" in it often enough to be the rule rather than the exception.
 *
 * There is a model that does exactly this job. `recraft-ai/recraft-vectorize`
 * takes a picture and returns the SVG of what is in it, so the drawing
 * drives the vector instead of a description of it. This is the whole path:
 *
 * 1. Rasterise the strokes (`pictureOf`).
 * 2. Trace them (`/api/studio/image`, kind `vectorize`).
 * 3. Sanitise what comes back (`cleanSnippet`), exactly as a written body is.
 * 4. Cut it to the line that was drawn round it (`outline.cut`) and
 *    photograph it, so the silhouette scored is the silhouette the board
 *    will show.
 * 5. Score it against that outline, the same intersection over union at the
 *    same `GOOD_ENOUGH`.
 *
 * Under the bar it goes again **on the picture, not on words**: there is
 * nothing to argue with, so the thing that changes is what the tracer was
 * given. Crop to the ink so the drawing fills the frame, thicken the line so
 * the trace covers area rather than hairlines, harden the contrast so there
 * is no grey ghost beside every stroke, and on the last go drop the ground
 * so nothing is traced under it. Three goes, the best kept, every score
 * stored.
 *
 * No Claude call happens here. `bodyRun.writeBody` still exists, for a part
 * that genuinely wants words, and is reached only when nothing was traced at
 * all.
 */
import { GOOD_ENOUGH, judge, targetFor, type Attempt, type BodyResult } from "./bodyRun";
import { pictureOf, type PictureOpts } from "./reshapeRun";
import { money, RENDER_COST, RENDER_MODELS } from "./renderer";
import { readVector } from "./vector";
import { noRendererKeyMessage, rendererHeader } from "./agent";
import { cleanSnippet, RENDER_LIMIT, type PartCode } from "./snippet";
import { isTap, TAP_SIZE, type OutlineClip, type SketchPoint } from "./sketch";

/** How many goes at it. One per rung of the ladder. */
export const MAX_TRACES = 3;

/**
 * The ladder, one rung per go.
 *
 * Every rung crops to the ink, and that is not a tuning knob: the part's
 * box *is* the drawing's box, so a trace of the whole board stretched into
 * the part lands the ink in the middle of it rather than on it. Comparing
 * like with like means the two frames have to be the same frame. The rim
 * goes for the same reason a ground does: a tracer would trace it.
 *
 * What the rungs actually turn is how easy the ink is to trace: thicker,
 * then harder edged, then with nothing behind it at all.
 */
export const LADDER: PictureOpts[] = [
  { px: 640, width: 8, crop: true },
  { px: 768, width: 16, crop: true, contrast: true },
  { px: 768, width: 26, crop: true, contrast: true, ground: false },
];

/** What each rung did, in a word, for the note and the bench. */
export const RUNGS = ["as drawn", "thickened", "thicker still, no ground"] as const;

export interface DrawInput {
  label: string;
  w: number;
  h: number;
  outline: OutlineClip | null;
  strokes: SketchPoint[][];
}

/**
 * Trace one drawing until it looks like itself or the goes run out.
 *
 * The best is kept, never the last: a thicker line can cover more of the
 * outline and still be a worse drawing, and the number says which it was.
 */
export async function drawBody(input: DrawInput, deps: { onStep?: (s: string) => void } = {}): Promise<BodyResult> {
  // Like against like: a closed drawing is an area and is scored as one, an
  // open one is a line and is scored against the line with a tolerance the
  // width of the stroke that was drawn.
  const attempts: Attempt[] = [];
  let spent = 0;
  let says: string | undefined;
  // The wait, measured. Every rung of the ladder is part of it, because
  // every rung is time the person spent looking at a spinner.
  const from = Date.now();
  // A tap is not a drawing. Before this it was traced three times, paid
  // for, and scored against the whole box at about 1% a go.
  if (isTap(input.strokes)) {
    says = `A tap is not a shape: nothing wider than ${TAP_SIZE * 100}% of the board was drawn, so there is nothing to trace.`;
    return { ok: false, code: null, attempts, cost: 0, ms: Date.now() - from, calls: 0, renderer: 0, rendererSays: says, message: says, reason: "no-drawing" };
  }
  const { mask: target, mode } = targetFor(input.outline, input.strokes);

  for (let n = 1; n <= MAX_TRACES; n++) {
    const rung = LADDER[n - 1]!;
    deps.onStep?.(n === 1 ? "Tracing the drawing…" : `Trace ${n} of ${MAX_TRACES}, ${RUNGS[n - 1]}${attempts.length ? ` · best ${(best(attempts).overlap * 100).toFixed(0)}%` : ""}…`);
    const picture = pictureOf(input.strokes, rung);
    if (!picture) {
      says = "The drawing could not be turned into a picture in this browser.";
      break;
    }
    let drew: Traced;
    try {
      drew = await trace(picture, input);
    } catch (err) {
      drew = { ok: false, message: err instanceof Error ? err.message : "The tracer could not be reached." };
    }
    if (!drew.ok || !drew.html) {
      says = (drew.reason === "unavailable" ? noRendererKeyMessage("") : drew.message ?? "Nothing came back from the tracer.").trim();
      break;
    }
    spent += drew.cost ?? RENDER_COST.vectorize;
    const { html } = cleanSnippet(drew.html, RENDER_LIMIT);
    // The drawing itself, kept before anything decides what it is for.
    // Every go replaces it, so what is kept belongs to the trace that won.
    const vector = readVector(html, RENDER_MODELS.vectorize);
    deps.onStep?.(`Looking at trace ${n}…`);
    const scored = await judge(html, { w: input.w, h: input.h, clip: input.outline?.cut ?? "" }, target, mode);
    attempts.push({ n, source: "renderer", overlap: scored.overlap, says: scored.says, html, note: `traced, ${RUNGS[n - 1]}`, shot: scored.shot, vector });
    if (scored.overlap < 0 || scored.overlap >= GOOD_ENOUGH) break;
  }

  if (!attempts.length) {
    return { ok: false, code: null, attempts, cost: spent, ms: Date.now() - from, calls: 0, renderer: spent, rendererSays: says, message: says ?? "Nothing was traced.", reason: "no-trace" };
  }
  const kept = best(attempts);
  const code: PartCode = {
    html: kept.html,
    overlap: Math.max(0, kept.overlap),
    attempts: attempts.length,
    scores: attempts.map((a) => Math.round(Math.max(0, a.overlap) * 100) / 100),
    at: Date.now(),
    note: kept.note,
    source: "renderer",
    kind: "vectorize",
    ...(spent ? { cost: spent } : {}),
  };
  const each = attempts.map((a) => `${RUNGS[a.n - 1]} ${a.overlap < 0 ? "not compared" : a.overlap.toFixed(2)}`).join(", ");
  const against = mode.closed ? "of the shape it drew" : "of the line it drew";
  return {
    ok: true,
    code,
    // His lines, off the trace that won, for whatever role it takes.
    vector: kept.vector ?? null,
    attempts,
    cost: spent,
    ms: Date.now() - from,
    // Every go is a press, and every press is charged for.
    calls: attempts.length,
    renderer: spent,
    rendererSays: says,
    message:
      kept.overlap < 0
        ? `The drawing was traced; the server could not render it to check the shape (${attempts.length} go${attempts.length === 1 ? "" : "es"}, ${money(spent)}).`
        : `The drawing was traced and it matched ${(kept.overlap * 100).toFixed(0)}% ${against} (${attempts.length} go${attempts.length === 1 ? "" : "es"}: ${each}, ${money(spent)}).`,
  };
}

interface Traced {
  ok: boolean;
  html?: string;
  cost?: number;
  message?: string;
  reason?: string;
}

/** One call to the tracer. The picture goes; nothing that describes it does. */
async function trace(picture: string, input: DrawInput): Promise<Traced> {
  const res = await fetch("/api/studio/image", {
    method: "POST",
    headers: { "content-type": "application/json", ...rendererHeader() },
    body: JSON.stringify({ kind: "vectorize", picture, label: input.label, w: input.w, h: input.h }),
  });
  return (await res.json()) as Traced;
}

function best(attempts: Attempt[]): Attempt {
  return attempts.reduce((a, b) => (b.overlap > a.overlap ? b : a));
}
