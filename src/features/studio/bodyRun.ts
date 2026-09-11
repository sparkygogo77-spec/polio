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
import { cleanSnippet, RENDER_LIMIT, type PartCode } from "./snippet";
import { money, RENDER_COST, type RenderKind } from "./renderer";
import { keyHeader } from "./agent";
import type { OutlineClip } from "./sketch";

/** How much of the drawing a body has to cover before it is left alone. */
export const GOOD_ENOUGH = 0.72;
/** How many goes at it, including the first. */
export const MAX_ATTEMPTS = 3;
/** The grid the two silhouettes are compared on. Coarse on purpose: this is a shape, not a pixel diff. */
const GRID = 96;
/** How much alpha counts as "painted". */
const INK = 24;

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
}

export interface BodyResult {
  ok: boolean;
  code: PartCode | null;
  attempts: Attempt[];
  message: string;
  reason?: string;
  /** What the renderer cost, in dollars. Zero when it was never reached. */
  cost: number;
  /** Why the renderer was not used, when it was not. Shown, not swallowed. */
  rendererSays?: string;
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

/** A grid of what a path fills: true where the drawing is. */
function targetMask(outline: OutlineClip | null): boolean[] {
  const mask = new Array<boolean>(GRID * GRID).fill(false);
  if (typeof document === "undefined") return mask;
  const el = document.createElement("canvas");
  el.width = GRID;
  el.height = GRID;
  const c = el.getContext("2d");
  if (!c) return mask;
  if (!outline) {
    // No line worth cutting to: the whole box is the shape.
    return mask.fill(true);
  }
  c.setTransform(GRID, 0, 0, GRID, 0, 0);
  c.fillStyle = "#000";
  try {
    c.fill(new Path2D(outline.cut));
  } catch {
    return mask.fill(true);
  }
  const data = c.getImageData(0, 0, GRID, GRID).data;
  for (let i = 0; i < GRID * GRID; i++) mask[i] = data[i * 4 + 3]! > INK;
  return mask;
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

/** Intersection over union, and where the render falls short. */
export function compare(target: boolean[], got: boolean[]): { overlap: number; says: string } {
  let both = 0;
  let either = 0;
  let missed = 0;
  let spilled = 0;
  // Which quarter of the shape is emptiest: enough to say "it is short at
  // the bottom" rather than only "it is short".
  const short = [0, 0, 0, 0];
  const want = [0, 0, 0, 0];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const i = y * GRID + x;
      const t = target[i]!;
      const g = got[i]!;
      if (t && g) both++;
      if (t || g) either++;
      if (t && !g) missed++;
      if (!t && g) spilled++;
      if (t) {
        const q = (y < GRID / 2 ? 0 : 2) + (x < GRID / 2 ? 0 : 1);
        want[q]!++;
        if (!g) short[q]!++;
      }
    }
  }
  const overlap = either ? both / either : 0;
  const worst = short.map((s, i) => (want[i] ? s / want[i]! : 0));
  const names = ["the top left", "the top right", "the bottom left", "the bottom right"];
  const emptiest = worst.indexOf(Math.max(...worst));
  const says = [
    `Your render covered ${(overlap * 100).toFixed(0)}% of the drawn shape (intersection over union).`,
    missed > both * 0.25 ? `It leaves ${((missed / Math.max(1, missed + both)) * 100).toFixed(0)}% of the shape empty, draw bigger, into the outline's own edges.` : "",
    worst[emptiest]! > 0.4 ? `The emptiest part is ${names[emptiest]}.` : "",
    spilled > both ? "Much of what you drew falls outside the outline, where it is clipped away; keep it inside." : "",
  ].filter(Boolean).join(" ");
  return { overlap, says };
}

/* ------------------------------------------------------------------ */
/* The loop                                                            */
/* ------------------------------------------------------------------ */

async function askForBody(input: BodyInput, prev?: { html: string; says: string; shot: string | null }): Promise<{ ok: boolean; html?: string; note?: string; message?: string; reason?: string }> {
  const res = await fetch("/api/studio/body", {
    method: "POST",
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
      ...(prev ? { previous: prev.html, critique: prev.says, shot: prev.shot?.split(",")[1] ?? null } : {}),
    }),
  });
  return (await res.json()) as { ok: boolean; html?: string; note?: string; message?: string; reason?: string };
}

/**
 * Ask the renderer to draw it.
 *
 * No key header: this route reads the token from the server's environment
 * and takes one from nowhere else, which is the promise the keys panel
 * makes about it. Without a token the answer is `unavailable` at HTTP 200,
 * so this is never a failure, only a fork.
 */
async function askRenderer(input: BodyInput, kind: RenderKind): Promise<{ ok: boolean; html?: string; cost?: number; message?: string; reason?: string }> {
  const res = await fetch("/api/studio/image", {
    method: "POST",
    headers: { "content-type": "application/json" },
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
async function renderBody(html: string, w: number, h: number): Promise<{ shot: string | null; mask: boolean[] | null }> {
  const res = await fetch("/api/studio/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html, w, h }),
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
  const target = targetMask(input.outline);
  const attempts: Attempt[] = [];
  let prev: { html: string; says: string; shot: string | null } | undefined;
  let spent = 0;
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
      spent += drew.cost ?? RENDER_COST[kind];
      const { html } = cleanSnippet(drew.html, RENDER_LIMIT);
      deps.onStep?.("Looking at what the renderer drew…");
      const judged = await judge(html, input, target);
      attempts.push({ n: 0, source: "renderer", overlap: judged.overlap, says: judged.says, html, note: `drawn by the renderer, ${kind}`, shot: judged.shot });
      // Short of the bar, the renderer's own render is what the first
      // written attempt is given to beat, with the drawing beside it.
      if (judged.overlap >= 0 && judged.overlap < GOOD_ENOUGH) prev = { html, says: judged.says, shot: judged.shot };
    } else {
      rendererSays = drew.message ?? "The renderer drew nothing.";
    }
  }

  const drawnWell = attempts.some((a) => a.overlap < 0 || a.overlap >= GOOD_ENOUGH);

  for (let n = 1; !drawnWell && n <= MAX_ATTEMPTS; n++) {
    deps.onStep?.(n === 1 ? "Claude is writing the body…" : `Attempt ${n} of ${MAX_ATTEMPTS}${attempts.length ? ` · best ${(bestOf(attempts).overlap * 100).toFixed(0)}%` : ""}…`);
    const answer = await askForBody(input, prev);
    if (!answer.ok || !answer.html) {
      // Nothing to judge. If an earlier attempt landed, that one stands.
      if (attempts.length) break;
      return { ok: false, code: null, attempts, cost: spent, rendererSays, message: answer.message ?? "No body came back.", reason: answer.reason };
    }
    const { html } = cleanSnippet(answer.html);
    deps.onStep?.(`Looking at attempt ${n}…`);
    const { overlap, says, shot } = await judge(html, input, target);
    attempts.push({ n, source: "written", overlap, says, html, note: answer.note ?? "", shot });
    if (overlap < 0 || overlap >= GOOD_ENOUGH) break;
    prev = { html, says, shot };
  }

  if (!attempts.length) return { ok: false, code: null, attempts, cost: spent, rendererSays, message: rendererSays ?? "No body came back.", reason: "empty" };
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
  const price = spent ? `, ${money(spent)} at the renderer` : "";
  // Why the renderer was not used is part of what happened, so it is said
  // rather than left for someone to notice the absence of.
  const skipped = rendererSays ? ` ${rendererSays.split(".")[0]!.trim()}.` : "";
  return {
    ok: true,
    code,
    attempts,
    cost: spent,
    rendererSays,
    message:
      best.overlap < 0
        ? `${made}; the server could not render it to check the shape (${attempts.length} attempt${attempts.length === 1 ? "" : "s"}${price}).${skipped}`
        : `${made} and it matched ${(best.overlap * 100).toFixed(0)}% of the drawing (${attempts.length} attempt${attempts.length === 1 ? "" : "s"}: ${scored}${price}).${skipped}`,
  };
}

/** Render one body and score it against the drawing. The one place a number comes from. */
async function judge(html: string, input: BodyInput, target: boolean[]): Promise<{ overlap: number; says: string; shot: string | null }> {
  try {
    const rendered = await renderBody(html, input.w, input.h);
    if (!rendered.mask) {
      // No headless browser here: the body is kept as it is, and the loop
      // says so rather than pretending to have judged it.
      return { overlap: -1, says: "The server could not render it, so nothing was compared.", shot: rendered.shot };
    }
    const judged = compare(target, rendered.mask);
    return { overlap: judged.overlap, says: judged.says, shot: rendered.shot };
  } catch (err) {
    return { overlap: -1, says: err instanceof Error ? err.message : "The render could not be read.", shot: null };
  }
}

function bestOf(attempts: Attempt[]): Attempt {
  return attempts.reduce((a, b) => (b.overlap > a.overlap ? b : a));
}
