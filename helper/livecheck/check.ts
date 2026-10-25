/**
 * The live check after a merge (AGENTS-PANEL-PROPOSAL.md, section 3):
 *
 * 1. Wait for https://polio-two.vercel.app/api/version to show the merged
 *    commit.
 * 2. Read the board on a saved board, in a fresh profile, never J's: once on
 *    the old live commit's reading (taken before the merge), once now. Each
 *    reading waits for the board to hold still (pictures arrive late on big
 *    sites).
 * 3. Run the lane's own check, if it has one.
 * 4. A failure is repeated once before it is reported.
 *
 * The result is a merge line: `checked` with the before and after shots, or
 * `check-failed` with the parts that moved, and Undo (a revert PR) offered.
 * `read`, `shoot`, `ownCheck` and `version` are passed in, so the tests run
 * without a browser or the network; measure.ts is the real browser.
 */
import { CONTRACT_VERSION, type MergeLine } from "../contract.ts";
import { holdsStill, movedParts, type Moved, type Reading } from "./compare.ts";

export const LIVE = "https://polio-two.vercel.app";

export type LiveDeps = {
  /** The live commit's short or full sha. */
  version: () => Promise<string | null>;
  /** One reading of the board; the browser is fresh each time. */
  read: () => Promise<Reading>;
  /** A screenshot at 1440; answers its path. */
  shoot: (name: string) => Promise<string>;
  /** The lane's own check: null when it passed, else what failed. */
  ownCheck?: () => Promise<string | null>;
  sleep?: (ms: number) => Promise<void>;
};

export type LiveJob = { lane: string; p: 1 | 2 | 3; generality: 1 | 2 | 3 | 4 | 5; pr: number | null; sha: string; fixes: string };

const nap = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function waitForCommit(d: LiveDeps, sha: string, { tries = 60, everyMs = 30000 } = {}): Promise<boolean> {
  const sleep = d.sleep ?? nap;
  for (let i = 0; i < tries; i++) {
    const v = await d.version().catch(() => null);
    if (v && (sha.startsWith(v) || v.startsWith(sha))) return true;
    await sleep(everyMs);
  }
  return false;
}

/** Read until two readings in a row agree, at most `tries` times. */
export async function stillReading(d: LiveDeps, tries = 6, gapMs = 1500): Promise<Reading> {
  const sleep = d.sleep ?? nap;
  let last = await d.read();
  for (let i = 1; i < tries; i++) {
    await sleep(gapMs);
    const next = await d.read();
    if (holdsStill(last, next)) return next;
    last = next;
  }
  return last;
}

async function once(d: LiveDeps, before: Reading): Promise<{ moved: Moved[]; own: string | null }> {
  const after = await stillReading(d);
  const moved = movedParts(before, after);
  const own = d.ownCheck ? await d.ownCheck() : null;
  return { moved, own };
}

const words = (m: Moved[]) => m.slice(0, 3).map((x) => (Number.isFinite(x.by) ? `${x.id} by ${Math.round(x.by)}px` : `${x.id} ${x.now ? "appeared" : "went missing"}`)).join(", ");

/** `before` is the reading taken on the old live commit, before the merge. */
export async function liveCheck(job: LiveJob, d: LiveDeps, before: Reading, beforeShot: string | null): Promise<MergeLine> {
  const base = { v: CONTRACT_VERSION, kind: "merge" as const, lane: job.lane, p: job.p, generality: job.generality, pr: job.pr };
  if (!(await waitForCommit(d, job.sha))) {
    return { ...base, status: "merged", line: `Merged, but ${job.sha.slice(0, 7)} isn't live yet; checking later`, shots: null, undo: false };
  }
  let r = await once(d, before);
  if (r.moved.length || r.own) r = await once(d, before); // a failure is repeated once
  const after = await d.shoot(`${job.lane}-after`);
  const shots = beforeShot ? { before: beforeShot, after } : null;
  if (!r.moved.length && !r.own) return { ...base, status: "checked", line: `Live and checked: ${job.fixes}`, shots, undo: true };
  const what = [r.moved.length ? `${r.moved.length} part${r.moved.length > 1 ? "s" : ""} moved (${words(r.moved)})` : "", r.own ?? ""].filter(Boolean).join("; ");
  return { ...base, status: "check-failed", line: `Live check failed: ${what}`, shots, undo: true };
}
