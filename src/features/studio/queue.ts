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
import type { Sketch } from "./sketch";

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
  question?: { ask: string; choices: readonly string[]; answer?: string } | null;
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
