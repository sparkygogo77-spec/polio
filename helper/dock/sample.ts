/**
 * Sample rows for the dock until the helper reads real ones: other lanes in
 * other states, the PC's processes, and an earlier request paid on J's plan,
 * so the two meters have something to compare. Every lane, merge and spend
 * here is a good contract message (the dock test checks). `?demo=0` leaves
 * them out and shows only what the fake runner says.
 *
 * "On your PC now" is not in the contract: the helper reads it from Windows
 * every 5 seconds, not from what the agents say, so it has its own shape.
 */
import { CONTRACT_VERSION as v, STEPS, type Lane, type MergeLine, type Spend } from "../contract.ts";

const requestId = "req-sample-0";
const lane = (name: string, where: Lane["where"], stepsDone: number, state: Lane["state"], note: string, etaSeconds: number | null): Lane => ({
  v, kind: "lane", requestId, lane: name, where, stepsDone,
  stepNow: STEPS[stepsDone] ?? null,
  etaSeconds, state, note,
});

export const SAMPLE_LANES: Lane[] = [
  lane("hero-calm", "pc", 2, "working", "lifting heading contrast, 6 of 9 parts done", 720),
  lane("wrap-in-column", "cloud", 5, "working", "waiting for CI, tests 16/16", 300),
  lane("capture-frog", "pc", 3, "paused", "paused by you at 14:02", null),
  lane("boxes-hug", "cloud", 8, "done", "live and checked", 0),
];

export const SAMPLE_MERGES: MergeLine[] = [
  { v, kind: "merge", lane: "boxes-hug", p: 1, generality: 5, status: "checked", pr: 405,
    line: "Selection boxes sit on the part as drawn", shots: { before: "shots/boxes-hug-before.png", after: "shots/boxes-hug-after.png" }, undo: true },
  { v, kind: "merge", lane: "wrap-in-column", p: 2, generality: 4, status: "waiting-ci", pr: 411,
    line: "Wrap in column keeps the row's gap", shots: null, undo: false },
];

/** A PC lane counts its tokens; a cloud lane's can't be read (null). No dollars anywhere. */
export const SAMPLE_SPEND: Spend[] = [
  { v, kind: "spend", requestId, tokens: { in: 210_000, out: 18_000 }, lanes: [
    { lane: "hero-calm", pays: "plan", tokens: { in: 210_000, out: 18_000 }, seconds: 720 },
    { lane: "boxes-hug", pays: "cloud", tokens: null, seconds: 1500 },
  ], plan: { used: 0.31, resetsAt: Math.floor(Date.UTC(2026, 9, 25, 23, 0) / 1000), status: "allowed", window: "five_hour" } },
];

export type PcRow = { what: string; lane: string | null; age: string; cpu: string; mem: string; mine: boolean };
export const PC_MEMORY = { usedGb: 19.2, totalGb: 32 };
export const PC_NOW: PcRow[] = [
  { what: "claude agent", lane: "hero-calm", age: "12m", cpu: "3%", mem: "410 MB", mine: true },
  { what: "claude agent", lane: "capture-frog", age: "31m", cpu: "0%", mem: "380 MB", mine: true },
  { what: "node next build", lane: "hero-calm", age: "2m", cpu: "88%", mem: "3.1 GB", mine: true },
  { what: "chrome headless", lane: "hero-calm", age: "1m", cpu: "22%", mem: "640 MB", mine: true },
  { what: "node :3061", lane: null, age: "3h", cpu: "1%", mem: "520 MB", mine: false },
  { what: "Claude desktop", lane: null, age: "5h", cpu: "2%", mem: "900 MB", mine: false },
];
