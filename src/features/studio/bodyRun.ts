"use client";
/**
 * Writing a part's body, and judging it against the drawing.
 *
 * An Idea part is the one part with nothing in it: it is what a drawing
 * becomes when the library has no entry for what was drawn. Cutting it to
 * the outline made a helix-shaped empty box, which is worse than a
 * rectangle because it looks deliberate. So the drawing is sent to be
 * *written* (`/api/studio/body`), and what comes back is checked the only
 * way a shape can be checked: render it and look.
 *
 * The loop:
 *
 * 0. The **renderer** goes first (`/api/studio/image`). A thing that has to
 *    look like something is better drawn than written, so Replicate is
 *    asked for an SVG before Claude is asked for one. It is scored on the
 *    same bar as everything else, and when the server has no token the
 *    route says so and the loop carries on to the written body.
 * 1. The **target** is the silhouette the author drew — the clip path,
 *    filled, at a coarse grid. That is the shape the body has to be.
 * 2. The body is rendered on its own, at the part's real size, with
 *    nothing behind it (`/api/studio/render`), and its own silhouette is
 *    every pixel it painted.
 * 3. The two are compared: intersection over union. One number, and it is
 *    the one number that says whether the thing on the board is the thing
 *    that was drawn.
 * 4. Under the bar, it goes back with the number, a picture of what it
 *    actually rendered, and what is short — up to three goes in all, and
 *    the best is kept, never the last.
 *
 * Every attempt's number is reported, so the counter says "attempt 2 of 3 ·
 * 0.71" while it works and the queue's note says how it ended. The best of
 * everything is kept, and the renderer's attempt is in "everything": a
 * drawing that scored 0.68 beats a written body that scored 0.44.
 *
 * The drawing itself is the reference on both paths. The written body has
 * always been given the picture of the strokes, and it still is; when the
 * renderer went first and fell short, its render is what the first written
 * attempt is asked to beat, with the drawn picture beside it.
 */
import { CALL_DEADLINE_MS, heldEffort } from "./effort";
import { cleanSnippet, RENDER_LIMIT, type PartCode } from "./snippet";
import { money, RENDER_COST, type RenderKind } from "./renderer";
import { keyHeader, noRendererKeyMessage, rendererHeader } from "./agent";
import { CLIP_STROKE, type OutlineClip, type SketchPoint } from "./sketch";
import type { DrawnVector } from "./vector";
import { priceTokens, type TokenUse } from "./spend";

/** How much of the drawing a body has to cover before it is left alone. */
export const GOOD_ENOUGH = 0.72;
/** How many goes at it, including the first. */
export const MAX_ATTEMPTS = 3;
export interface Attempt {
  n: number;
  /** Who made this one. The renderer's attempt is always the first. */
  source: "renderer" | "written";
  overlap: number;
  /** What was short, in words, if anything. */
  says: string;
  html: string;
  note: string;
  /** The render, as a PNG data URL, for the next attempt to look at. */
  shot: string | null;
  /** The drawing as vector, when this attempt traced one. */
  vector?: DrawnVector | null;
}

export interface BodyResult {
  ok: boolean;
  code: PartCode | null;
  attempts: Attempt[];
  message: string;
  reason?: string;
  /** What it cost, in dollars: the renderer per press and Claude per token. */
  cost: number;
  /** How long the person waited, measured rather than estimated. */
  ms?: number;
  /** How many paid calls it took. */
  calls?: number;
  /** Of the cost, what went to the renderer per press… */
  renderer?: number;
  /** …and what to Claude per token. */
  claude?: number;
  /** Why the renderer was not used, when it was not. Shown, not swallowed. */
  rendererSays?: string;
  /** The drawing itself, as vector, when one was traced. */
  vector?: DrawnVector | null;
}

export interface BodyInput {
  label: string;
  prompt: string;
  w: number;
  h: number;
  outline: OutlineClip | null;
  /** The drawing as a PNG, base64, no data-URL head. */
  picture: string | null;
  palette?: { bg?: string; text?: string; accent?: string; muted?: string };
  /** Which renderer to try first. `false` skips it and writes the body. */
  renderer?: RenderKind | false;
}

/* ------------------------------------------------------------------ */
/* Silhouettes                                                         */
/* ------------------------------------------------------------------ */

/**
 * What the render is being compared against, and how.
 *
 * The two things a person draws are not the same kind of thing and cannot
 * be scored the same way, which is what capped every run on the bench: a
 * traced line is thin ink, and scoring thin ink against a filled area tops
 * out at the ink's own share of the shape however good the trace is.
 *
 * The test that decides is the one `outlinePath` already made:
 *
 * - **Closed.** The person drew the *edge of a thing*, so the thing is the
 *   area inside it. Both sides are filled — the target is the outline
 *   filled, and the render has its holes filled, so a traced edge becomes
 *   the region it encloses — and the score is plain area against area.
 * - **Open.** The person drew *the line*, so the line is the thing. Both
 *   sides stay as ink and the score is ink against ink with a tolerance
 *   band about the drawn stroke's width, so a line a couple of pixels off
 *   still counts and a line that is not there does not.
 *
 * Never thin ink against a filled area.
 */
/**
 * How much of its own box a closed line must enclose to be an area.
 *
 * Closed is not the same as "the edge of a thing". A helix ends where it
 * began and encloses 0.00 of its box; a star encloses 0.35. The first is a
 * line that happens to close and is scored as ink; the second is a shape
 * and is scored as area. Without this the helix is thin ink against a
 * filled ribbon, which is the one comparison that is never allowed.
 */
export const ENCLOSES_ENOUGH = 0.1;

export interface Compare {
  /** Closed: areas. Open: ink, within `tolerance`. */
  closed: boolean;
  /** How far off, in grid cells, still counts. Zero for an area. */
  tolerance: number;
}

/** The grid the two silhouettes are compared on. Coarse on purpose: this is a shape, not a pixel diff. */
const GRID = 96;
/** How much alpha counts as "painted". */
const INK = 24;

/** Fill a path on the grid: true where it covers. */
function fillPath(d: string): boolean[] | null {
  const mask = new Array<boolean>(GRID * GRID).fill(false);
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = GRID;
  el.height = GRID;
  const c = el.getContext("2d");
  if (!c) return null;
  c.setTransform(GRID, 0, 0, GRID, 0, 0);
  c.fillStyle = "#000";
  try {
    c.fill(new Path2D(d));
  } catch {
    return null;
  }
  const data = c.getImageData(0, 0, GRID, GRID).data;
  for (let i = 0; i < GRID * GRID; i++) mask[i] = data[i * 4 + 3]! > INK;
  return mask;
}

/**
 * The drawn ink, at the drawn stroke's width, in the part's own box.
 *
 * Every stroke, not only the one the clip was taken from: a drawing of
 * three bars is three bars, and scoring it against the longest of them
 * would be scoring it against a third of itself.
 */
function inkMask(strokes: SketchPoint[][]): boolean[] | null {
  if (typeof document === "undefined") return null;
  const live = strokes.filter((s) => s.length >= 2);
  if (!live.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of live) for (const [x, y] of s) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  const w = x1 - x0;
  const h = y1 - y0;
  if (!(w > 1e-4) || !(h > 1e-4)) return null;
  const el = document.createElement("canvas");
  el.width = GRID;
  el.height = GRID;
  const c = el.getContext("2d");
  if (!c) return null;
  c.strokeStyle = "#000";
  c.lineCap = "round";
  c.lineJoin = "round";
  c.lineWidth = CLIP_STROKE * GRID;
  for (const s of live) {
    c.beginPath();
    for (let i = 0; i < s.length; i++) {
      const x = ((s[i]![0] - x0) / w) * GRID;
      const y = ((s[i]![1] - y0) / h) * GRID;
      if (i === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  const data = c.getImageData(0, 0, GRID, GRID).data;
  const mask = new Array<boolean>(GRID * GRID).fill(false);
  for (let i = 0; i < GRID * GRID; i++) mask[i] = data[i * 4 + 3]! > INK;
  return mask;
}

/**
 * What to compare against, and how, for one drawing.
 *
 * `strokes` is what was actually drawn; the outline is what it was reduced
 * to. A drawing with no outline at all closed nothing, so it is ink.
 */
export function targetFor(outline: OutlineClip | null, strokes: SketchPoint[][] = []): { mask: boolean[]; mode: Compare } {
  if (outline?.closed && (outline.encloses ?? 1) >= ENCLOSES_ENOUGH) {
    const filled = fillPath(outline.cut);
    if (filled) return { mask: filled, mode: { closed: true, tolerance: 0 } };
  }
  const ink = inkMask(strokes) ?? (outline ? fillPath(outline.cut) : null);
  const tolerance = (CLIP_STROKE / 2) * GRID;
  if (ink) return { mask: ink, mode: { closed: false, tolerance } };
  // Nothing to compare against: the whole box is the shape, as it always
  // was when a drawing said nothing a box does not.
  return { mask: new Array<boolean>(GRID * GRID).fill(true), mode: { closed: true, tolerance: 0 } };
}

/** The old shape of the question, kept for the written-body loop. */
export function targetMask(outline: OutlineClip | null): boolean[] {
  return targetFor(outline).mask;
}

/** A grid of what an image actually painted. */
async function shotMask(dataUrl: string): Promise<boolean[]> {
  const mask = new Array<boolean>(GRID * GRID).fill(false);
  if (typeof document === "undefined") return mask;
  const img = new Image();
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("the render could not be read"));
    img.src = dataUrl;
  });
  const el = document.createElement("canvas");
  el.width = GRID;
  el.height = GRID;
  const c = el.getContext("2d", { willReadFrequently: true });
  if (!c) return mask;
  c.clearRect(0, 0, GRID, GRID);
  c.drawImage(img, 0, 0, GRID, GRID);
  const data = c.getImageData(0, 0, GRID, GRID).data;
  for (let i = 0; i < GRID * GRID; i++) mask[i] = data[i * 4 + 3]! > INK;
  return mask;
}

/**
 * Everything a traced edge encloses.
 *
 * A closed drawing is the area inside the line, and a trace of it is the
 * line. Flooding the outside from the border and taking what the flood
 * never reached turns one into the other. A trace with a gap in it leaks,
 * fills nothing, and scores badly, which is correct: a broken edge is a
 * broken shape.
 */
export function fillHoles(mask: boolean[]): boolean[] {
  const out = mask.slice();
  const seen = new Uint8Array(GRID * GRID);
  const stack: number[] = [];
  for (let i = 0; i < GRID; i++) {
    for (const j of [i, i + GRID * (GRID - 1), i * GRID, i * GRID + GRID - 1]) {
      if (!mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
    }
  }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % GRID;
    const y = (i / GRID) | 0;
    if (x > 0) { const j = i - 1; if (!mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (x < GRID - 1) { const j = i + 1; if (!mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (y > 0) { const j = i - GRID; if (!mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
    if (y < GRID - 1) { const j = i + GRID; if (!mask[j] && !seen[j]) { seen[j] = 1; stack.push(j); } }
  }
  for (let i = 0; i < out.length; i++) if (!out[i] && !seen[i]) out[i] = true;
  return out;
}

/**
 * How far every cell is from the nearest inked one, in cells.
 *
 * Two passes of a chamfer transform: near enough to Euclidean at this size,
 * and linear where measuring each cell against every other would not be.
 */
function distances(mask: boolean[]): Float32Array {
  const BIG = 1e6;
  const d = new Float32Array(GRID * GRID);
  for (let i = 0; i < d.length; i++) d[i] = mask[i] ? 0 : BIG;
  const step = (i: number, j: number, w: number) => { const v = d[j]! + w; if (v < d[i]!) d[i] = v; };
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      if (x > 0) step(i, i - 1, 1);
      if (y > 0) step(i, i - GRID, 1);
      if (x > 0 && y > 0) step(i, i - GRID - 1, 1.4142);
      if (x < GRID - 1 && y > 0) step(i, i - GRID + 1, 1.4142);
    }
  }
  for (let y = GRID - 1; y >= 0; y--) {
    for (let x = GRID - 1; x >= 0; x--) {
      const i = y * GRID + x;
      if (x < GRID - 1) step(i, i + 1, 1);
      if (y < GRID - 1) step(i, i + GRID, 1);
      if (x < GRID - 1 && y < GRID - 1) step(i, i + GRID + 1, 1.4142);
      if (x > 0 && y < GRID - 1) step(i, i + GRID - 1, 1.4142);
    }
  }
  return d;
}

/**
 * The score, and where the render falls short.
 *
 * Closed: intersection over union of two filled areas. Open: how much of
 * each side's ink lies within the tolerance of the other's, which is the
 * same number when the tolerance is zero and the two agree, and forgives
 * a line drawn a stroke's width off without forgiving a line that is not
 * there at all.
 */
export function compare(target: boolean[], got: boolean[], mode: Compare = { closed: true, tolerance: 0 }): { overlap: number; says: string } {
  const mine = mode.closed ? fillHoles(got) : got;
  let both = 0;
  let either = 0;
  let missed = 0;
  let spilled = 0;
  // Which quarter of the shape is emptiest: enough to say "it is short at
  // the bottom" rather than only "it is short".
  const short = [0, 0, 0, 0];
  const want = [0, 0, 0, 0];
  const near = mode.tolerance > 0 ? { toMine: distances(mine), toTarget: distances(target) } : null;
  let matchedTarget = 0;
  let matchedMine = 0;
  let inTarget = 0;
  let inMine = 0;
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      const t = target[i]!;
      const g = mine[i]!;
      if (t && g) both++;
      if (t || g) either++;
      if (t && !g) missed++;
      if (!t && g) spilled++;
      if (t) {
        inTarget++;
        const q = (y < GRID / 2 ? 0 : 2) + (x < GRID / 2 ? 0 : 1);
        want[q]!++;
        if (near ? near.toMine[i]! <= mode.tolerance : g) matchedTarget++;
        else short[q]!++;
      }
      if (g) {
        inMine++;
        if (near ? near.toTarget[i]! <= mode.tolerance : t) matchedMine++;
      }
    }
  }
  const overlap = near
    ? inTarget + inMine ? (matchedTarget + matchedMine) / (inTarget + inMine) : 0
    : either ? both / either : 0;
  const worst = short.map((s, i) => (want[i] ? s / want[i]! : 0));
  const names = ["the top left", "the top right", "the bottom left", "the bottom right"];
  const emptiest = worst.indexOf(Math.max(...worst));
  const says = [
    `Your render covered ${(overlap * 100).toFixed(0)}% of the drawn ${mode.closed ? "shape" : "line"} (${mode.closed ? "area against area" : "ink against ink, within a stroke's width"}).`,
    !mode.closed && inTarget && matchedTarget / inTarget < 0.75 ? `${(100 - (matchedTarget / inTarget) * 100).toFixed(0)}% of the line drawn has nothing near it; follow the whole of it.` : "",
    mode.closed && missed > both * 0.25 ? `It leaves ${((missed / Math.max(1, missed + both)) * 100).toFixed(0)}% of the shape empty, draw bigger, into the outline's own edges.` : "",
    worst[emptiest]! > 0.4 ? `The emptiest part is ${names[emptiest]}.` : "",
    mode.closed && spilled > both ? "Much of what you drew falls outside the outline, where it is clipped away; keep it inside." : "",
  ].filter(Boolean).join(" ");
  return { overlap, says };
}

/* ------------------------------------------------------------------ */
/* The loop                                                            */
/* ------------------------------------------------------------------ */

async function askForBody(input: BodyInput, prev?: { html: string; says: string; shot: string | null }): Promise<{ ok: boolean; html?: string; note?: string; message?: string; reason?: string; usage?: TokenUse }> {
  // The browser's own deadline, longer than the route's budget: for the
  // case where nothing arrives at all, so the spinner still stops with a
  // sentence rather than running until a reload.
  const res = await fetch("/api/studio/body", {
    method: "POST",
    signal: AbortSignal.timeout(CALL_DEADLINE_MS),
    headers: { "content-type": "application/json", ...keyHeader() },
    body: JSON.stringify({
      label: input.label,
      prompt: input.prompt,
      path: input.outline?.cut ?? "",
      closed: input.outline?.closed ?? true,
      w: input.w,
      h: input.h,
      picture: input.picture,
      palette: input.palette,
      effort: heldEffort(),
      ...(prev ? { previous: prev.html, critique: prev.says, shot: prev.shot?.split(",")[1] ?? null } : {}),
    }),
  });
  return (await res.json()) as { ok: boolean; html?: string; note?: string; message?: string; reason?: string; usage?: TokenUse };
}

/**
 * Ask the renderer to draw it.
 *
 * The token rides on the request, out of the same keys panel the Claude key
 * comes from, and no Claude key rides with it: this route has no use for
 * one. Without a token the answer is `unavailable` at HTTP 200, so this is
 * never a failure, only a fork.
 */
async function askRenderer(input: BodyInput, kind: RenderKind): Promise<{ ok: boolean; html?: string; cost?: number; message?: string; reason?: string }> {
  const res = await fetch("/api/studio/image", {
    method: "POST",
    headers: { "content-type": "application/json", ...rendererHeader() },
    body: JSON.stringify({
      kind,
      label: input.label,
      prompt: input.prompt,
      closed: input.outline?.closed ?? true,
      w: input.w,
      h: input.h,
      palette: input.palette,
    }),
  });
  return (await res.json()) as { ok: boolean; html?: string; cost?: number; message?: string; reason?: string };
}

/** Render one body on the server and read what it painted. */
async function renderBody(html: string, w: number, h: number, clip?: string): Promise<{ shot: string | null; mask: boolean[] | null }> {
  const res = await fetch("/api/studio/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html, w, h, ...(clip ? { clip } : {}) }),
  });
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return { shot: null, mask: null };
  const blob = await res.blob();
  const shot = await new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });
  return { shot, mask: await shotMask(shot) };
}

/**
 * Write a body for one part, and keep going until it looks like the
 * drawing or the attempts run out.
 *
 * The best attempt is kept, not the last: a second go that came back worse
 * is still a second go, and the part should have whichever of them actually
 * looked like the thing.
 */
export async function writeBody(input: BodyInput, deps: { onStep?: (s: string) => void } = {}): Promise<BodyResult> {
  const { mask: target, mode } = targetFor(input.outline);
  const attempts: Attempt[] = [];
  let prev: { html: string; says: string; shot: string | null } | undefined;
  let spent = 0;
  let toClaude = 0;
  let toRenderer = 0;
  let calls = 0;
  const from = Date.now();
  let rendererSays: string | undefined;
  const kind: RenderKind | false = input.renderer ?? "vector";

  /* 0. The renderer, first. */
  if (kind) {
    deps.onStep?.("The renderer is drawing it…");
    let drew: Awaited<ReturnType<typeof askRenderer>>;
    try {
      drew = await askRenderer(input, kind);
    } catch (err) {
      drew = { ok: false, message: err instanceof Error ? err.message : "The renderer could not be reached." };
    }
    if (drew.ok && drew.html) {
      const press = drew.cost ?? RENDER_COST[kind];
      spent += press;
      toRenderer += press;
      calls++;
      const { html } = cleanSnippet(drew.html, RENDER_LIMIT);
      deps.onStep?.("Looking at what the renderer drew…");
      const judged = await judge(html, input, target, mode);
      attempts.push({ n: 0, source: "renderer", overlap: judged.overlap, says: judged.says, html, note: `drawn by the renderer, ${kind}`, shot: judged.shot });
      // Short of the bar, the renderer's own render is what the first
      // written attempt is given to beat, with the drawing beside it.
      if (judged.overlap >= 0 && judged.overlap < GOOD_ENOUGH) prev = { html, says: judged.says, shot: judged.shot };
    } else {
      // A keys panel holding a token but locked is the usual reason, and "no
      // token" would be untrue; say what to press instead.
      rendererSays = (drew.reason === "unavailable" ? noRendererKeyMessage("") : drew.message ?? "The renderer drew nothing.").trim();
    }
  }

  const drawnWell = attempts.some((a) => a.overlap < 0 || a.overlap >= GOOD_ENOUGH);

  for (let n = 1; !drawnWell && n <= MAX_ATTEMPTS; n++) {
    deps.onStep?.(n === 1 ? "Claude is writing the body…" : `Attempt ${n} of ${MAX_ATTEMPTS}${attempts.length ? ` · best ${(bestOf(attempts).overlap * 100).toFixed(0)}%` : ""}…`);
    const answer = await askForBody(input, prev);
    // Claude charges per token whether or not the answer was usable, so it
    // is counted before the answer is judged rather than after.
    const tokens = priceTokens(answer.usage);
    if (tokens) { spent += tokens; toClaude += tokens; }
    if (answer.usage) calls++;
    if (!answer.ok || !answer.html) {
      // Nothing to judge. If an earlier attempt landed, that one stands.
      if (attempts.length) break;
      return { ok: false, code: null, attempts, cost: spent, ms: Date.now() - from, calls, renderer: toRenderer, claude: toClaude, rendererSays, message: answer.message ?? "No body came back.", reason: answer.reason };
    }
    const { html } = cleanSnippet(answer.html);
    deps.onStep?.(`Looking at attempt ${n}…`);
    const { overlap, says, shot } = await judge(html, input, target, mode);
    attempts.push({ n, source: "written", overlap, says, html, note: answer.note ?? "", shot });
    if (overlap < 0 || overlap >= GOOD_ENOUGH) break;
    prev = { html, says, shot };
  }

  if (!attempts.length) return { ok: false, code: null, attempts, cost: spent, ms: Date.now() - from, calls, renderer: toRenderer, claude: toClaude, rendererSays, message: rendererSays ?? "No body came back.", reason: "empty" };
  const best = bestOf(attempts);
  const code: PartCode = {
    html: best.html,
    overlap: Math.max(0, best.overlap),
    attempts: attempts.length,
    scores: attempts.map((a) => Math.round(Math.max(0, a.overlap) * 100) / 100),
    at: Date.now(),
    note: best.note,
    source: best.source,
    ...(best.source === "renderer" && kind ? { kind } : {}),
    ...(spent ? { cost: spent } : {}),
  };
  const scored = attempts.map((a) => `${a.source === "renderer" ? "drawn" : "written"} ${a.overlap < 0 ? "not compared" : a.overlap.toFixed(2)}`).join(", ");
  const made = best.source === "renderer" ? "The renderer drew the body" : "A body was written";
  // Who was paid, not just how much: the renderer per press and Claude per
  // token, which is the only way to tell from the outside which road a body
  // came down.
  const price = spent
    ? `, ${money(spent)}${[toRenderer ? `${money(toRenderer)} at the renderer` : "", toClaude ? `${money(toClaude)} in tokens` : ""].filter(Boolean).length > 1 ? ` (${[toRenderer ? `${money(toRenderer)} at the renderer` : "", toClaude ? `${money(toClaude)} in tokens` : ""].filter(Boolean).join(", ")})` : toRenderer ? " at the renderer" : " in tokens"}`
    : "";
  // Why the renderer was not used is part of what happened, so it is said
  // rather than left for someone to notice the absence of — whole, because
  // the useful half of "no token yet" is the half that says what to press.
  const skipped = rendererSays ? ` ${rendererSays.slice(0, 200)}` : "";
  return {
    ok: true,
    code,
    attempts,
    cost: spent,
    ms: Date.now() - from,
    calls,
    renderer: toRenderer,
    claude: toClaude,
    rendererSays,
    message:
      best.overlap < 0
        ? `${made}; the server could not render it to check the shape (${attempts.length} attempt${attempts.length === 1 ? "" : "s"}${price}).${skipped}`
        : `${made} and it matched ${(best.overlap * 100).toFixed(0)}% of the drawing (${attempts.length} attempt${attempts.length === 1 ? "" : "s"}: ${scored}${price}).${skipped}`,
  };
}

/** Render one body and score it against the drawing. The one place a number comes from. */
export async function judge(html: string, input: { w: number; h: number; clip?: string }, target: boolean[], mode?: Compare): Promise<{ overlap: number; says: string; shot: string | null }> {
  try {
    const rendered = await renderBody(html, input.w, input.h, input.clip);
    if (!rendered.mask) {
      // No headless browser here: the body is kept as it is, and the loop
      // says so rather than pretending to have judged it.
      return { overlap: -1, says: "The server could not render it, so nothing was compared.", shot: rendered.shot };
    }
    const judged = compare(target, rendered.mask, mode);
    return { overlap: judged.overlap, says: judged.says, shot: rendered.shot };
  } catch (err) {
    return { overlap: -1, says: err instanceof Error ? err.message : "The render could not be read.", shot: null };
  }
}

function bestOf(attempts: Attempt[]): Attempt {
  return attempts.reduce((a, b) => (b.overlap > a.overlap ? b : a));
}
