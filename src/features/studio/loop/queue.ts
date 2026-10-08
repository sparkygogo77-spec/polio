"use client";
/**
 * The make-real queue: drawings waiting to be read, one at a time.
 *
 * Pressing **Make real** used to hold the board open while Claude read the
 * drawing — thirty seconds of a disc you could not draw on and a menu you
 * could not leave. A drawing is a request, not a modal: it goes on a queue,
 * the board closes, and the board is yours again while the queue works.
 *
 * One at a time, on purpose. Two reads at once cost twice as much, race each
 * other onto the same board, and land two threads whose parents are each
 * other's guess. The counter in the toolbar says how many are waiting and
 * how many have landed, and that is the whole of the machinery a person has
 * to think about.
 *
 * The job carries everything the run needs — the drawing, its picture, the
 * frame it was drawn against, the part it belongs to — because by the time
 * it runs the board is gone and the menu that opened it is gone with it.
 */
import type { Sketch } from "../pictures";
import type { DrawKind } from "../board/store";

export type JobStatus = "waiting" | "asking" | "running" | "done" | "failed";

export interface DrawJob {
  id: string;
  /** The part being reshaped, or null when the drawing makes a new one. */
  nodeId: string | null;
  /** Where a new part lands, in canvas space. Only read when there is no part. */
  at: { x: number; y: number } | null;
  frameWidth: number;
  sketch: Sketch;
  /** The drawing as a PNG for the reader, base64, without the data-URL head. */
  picture: string | null;
  /**
   * What he said it was BEFORE he drew it, from the drawing row.
   *
   * Carried on the job rather than read from the store when the answer comes
   * back, because the row can be changed while a drawing is in the queue and
   * the thing that lands must be the thing he asked for when he drew it.
   */
  want?: DrawKind | null;
  /**
   * How big the drawing actually was on the board, in canvas units.
   *
   * The strokes in `sketch` are fractions of their own box, so they say the
   * shape and lose the size: a stroke drawn eighty pixels wide and one drawn
   * across the whole page look identical by the time they get here. This is
   * the size a person drew, and a part lands at it.
   *
   * Absent from the drawing disc, where the ink is drawn on a disc rather
   * than on the page and there is no size to keep.
   */
  drawn?: { w: number; h: number } | null;
  /**
   * The one question the run asked before spending, and the answer once
   * there is one (`oddness.ts`). A job with a question and no answer is
   * `asking`: it waits on the person, not on the queue, and other drawings
   * go past it.
   */
  question?: {
    ask: string; choices: readonly string[]; answer?: string; why?: "cube" | "kind";
    /** The part's own words when the question was asked: only words typed after it count as an answer (`typedSince`). */
    prompt?: string;
    /** Whether the drawing stood alone when it was asked (`loneDrawing`): a later look at it judges the same drawing the same way. */
    lone?: boolean;
  } | null;
  /**
   * The iteration this job is making, landed the moment it was queued.
   *
   * The box on the timeline is the job: it exists from the press of Make
   * real, forms as the job works (`formation.ts`), and is complete when the
   * job is. Before this the thread was created when the read came back, so
   * nothing could form until most of the work was already done — and every
   * step's progress before that landed on the *previous* iteration's box,
   * because there was nothing else to write it on.
   */
  threadId?: string;
  /**
   * The part the drawing was made on, when it lands as a new part over it
   * rather than changing it (`drawTarget.ts`). Said in the message that
   * tells him where it landed.
   */
  over?: string | null;
  /**
   * The drawing is meant to change the part it was made on, said by the
   * door itself: only "draw it again" on the timeline, which redraws a part
   * a drawing made. Every other door changes a part only when the words
   * typed with the drawing ask for it.
   */
  reshape?: boolean;
  /**
   * A space's Generate: the surface forming on the board is the message, so
   * the queue does not say each landing out loud (`tests/create-flow.mjs`).
   */
  quiet?: boolean;
  /** What the counter and the book call it. */
  label: string;
  status: JobStatus;
  /** What it is doing right now, for the counter's tooltip: "attempt 2 of 3 · 0.71 overlap". */
  step?: string;
  /** What came of it, in a line. */
  note?: string;
  /** The part it made or reshaped. */
  madeId?: string;
  queued: number;
  started?: number;
  ended?: number;
}

/** Waiting, asking and running: what the counter calls pending. */
export const pendingJobs = (q: DrawJob[]): DrawJob[] => q.filter((j) => j.status === "waiting" || j.status === "asking" || j.status === "running");
/** The one with a question nobody has answered, if there is one. */
export const askingJob = (q: DrawJob[]): DrawJob | null => q.find((j) => j.status === "asking" && !!j.question && j.question.answer === undefined) ?? null;
export const doneJobs = (q: DrawJob[]): DrawJob[] => q.filter((j) => j.status === "done");
export const failedJobs = (q: DrawJob[]): DrawJob[] => q.filter((j) => j.status === "failed");

/** The next job to run, or nothing — never while one is already running. */
export function nextJob(q: DrawJob[]): DrawJob | null {
  if (q.some((j) => j.status === "running")) return null;
  return q.find((j) => j.status === "waiting") ?? null;
}

/** How many jobs are kept once they are over. Enough to see what happened, not a log. */
export const QUEUE_KEEP = 12;

/** Drop the oldest finished jobs, keeping every pending one. */
export function trimQueue(q: DrawJob[]): DrawJob[] {
  const over = q.filter((j) => j.status === "done" || j.status === "failed");
  if (over.length <= QUEUE_KEEP) return q;
  const cut = new Set(over.slice(0, over.length - QUEUE_KEEP).map((j) => j.id));
  return q.filter((j) => !cut.has(j.id));
}

/**
 * What was typed on the part since the question was asked, or nothing.
 *
 * A part's saved words are not an answer: every part sink captures says
 * "…The box, the words…", and reading that as something said withdrew the
 * question the moment it was asked, and the drawing asked it again, for
 * ever (`tests/draw-on-captured-part.mjs`). Only a change to the words
 * after the question is someone answering it in words.
 */
export function typedSince(question: DrawJob["question"], prompt: string | null | undefined): string {
  const now = prompt ?? "";
  return question && now !== (question.prompt ?? "") ? now : "";
}
