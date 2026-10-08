/* The loop module's pure door: threads and their strands, the lanes and their sample, and the build queue. No React, no store, every import ends in .ts, so node tests load it.
 * The agent and the timeline's vines (bundler imports) are behind ./run.ts; the Timeline and Lanes screens behind ./ui.ts. Named re-exports (not export *) so an import cycle still sees every name. See README.md. */
export { ITEMS } from "./lanesSample.ts";
export { GENERATION, PROCESS, THREAD_LIMIT, chainOf, diffDocs, flatten, liveAfterPrune, pieceOwners, pieceToText, piecesFrom, piecesToSend, processDone, pruneThread, threadTitle, threadTree, threadsToMarkdown } from "./threads.ts";
export type { Piece, ProcessState, Thread, ThreadDoc, ThreadNode } from "./threads.ts";
export { BANDS, BAND_COLOUR, LANE_BANDS, LANE_H, LANE_LABEL, LANE_MODE, PICKS, RATES, REACH, TURN, bandOf, costOf, laneArm, laneRects, laneSpine, lanesOf, nextIn, pickFor, saidCost, saidMinutes, shown } from "./lanes.ts";
export type { Band, Choice, Difficulty, Effort, Item, Lane, Lanes, ModelId, Rect, Shown } from "./lanes.ts";
export { QUEUE_KEEP, askingJob, doneJobs, failedJobs, nextJob, pendingJobs, trimQueue, typedSince } from "./queue.ts";
export type { DrawJob, JobStatus } from "./queue.ts";
export { LANE_STRAND_WIDTH, REACH_WIDTH, SEAM_WIDTH, STRAND_WIDTH, VINE, along, bracketBounds, bracketEnvelope, dusk, lch, paintBracket, paintStrand, section, strandBounds, strandEnvelope, strandMiddle, strandPath, strandReach, strandSeam } from "./strand.ts";
export type { Point, StrandTone, VineEnd } from "./strand.ts";
