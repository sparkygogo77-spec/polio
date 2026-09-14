/**
 * What landed, as something you can read in a minute.
 *
 * The shape here is the history's own shape, not a changelog's: a **pass** is
 * one merge into the branch (or one day's worth of commits that landed
 * straight on it), and a **change** is one commit inside it. Nobody writes
 * these lines; `npm run passes` reads them out of git into
 * `passes.generated.ts`, because the deployed build has no .git.
 *
 * What the panel does with them is the other half of the rule: lead with what
 * you can now do, keep the specifics folded until asked.
 */
import { PASSES, GENERATED_AT } from "./passes.generated.ts";

/** Four kinds, as fine as a subject line can honestly be cut. */
export type ChangeKind = "new" | "better" | "fixed" | "under";

export interface Change {
  /** The short sha, so a line can be traced back. */
  id: string;
  /** The commit subject: one line that says what it is. */
  says: string;
  when: string;
  /** The body, folded away until asked for. */
  detail: string[];
  /** Which corners it touched, in names a person uses. */
  areas: string[];
  kind: ChangeKind;
}

export interface Pass {
  id: string;
  when: string;
  /** "11 September" — the day it landed. */
  day: string;
  changes: Change[];
  /** How many were cut from this pass to keep it readable. */
  more: number;
}

export { PASSES, GENERATED_AT };

/** What each kind is called where a person reads it. */
export const KIND_MEANS: Record<ChangeKind, string> = {
  new: "New",
  better: "Better",
  fixed: "Fixed",
  under: "Under it",
};

/**
 * The line a pass leads with: the first thing in it you can now do.
 *
 * A pass headed "three commits" tells you nothing. Headed by its own biggest
 * new thing, the rest reads as the detail of that.
 */
export function leadOf(pass: Pass): Change | null {
  const order: ChangeKind[] = ["new", "better", "fixed", "under"];
  const sorted = [...pass.changes].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  return sorted[0] ?? null;
}

/**
 * WHICH ONE THIS IS, RATHER THAN WHEN IT HAPPENED.
 *
 * A box led with the day it landed, and a date is the wrong axis for a
 * timeline: a person reading one wants to know which iteration they are
 * looking at and how far along it is, not what o'clock it was. So the boxes
 * are numbered instead, oldest first — the first pass this project ever made
 * is v0.1 and they count up from there, ten to the point, so v0.9 is
 * followed by v1.0.
 *
 * It is a position in the history, not a release: nothing here is published
 * or tagged, and the number's whole job is to be an ordinal a person can
 * hold in their head and refer to. The day itself is not deleted — a pass
 * still carries `day` and a change still carries `when`, and the sha is on
 * every folded line — it is simply not the thing a box leads with.
 *
 * Built once, because a lookup per box while scrolling is a lookup per box
 * while scrolling.
 */
const VERSIONS = new Map(PASSES.map((p, i) => [p.id, PASSES.length - i]));

export function versionOf(pass: Pass): string {
  const n = VERSIONS.get(pass.id);
  if (!n) return "v0.0";
  return `v${Math.floor(n / 10)}.${n % 10}`;
}

/** "Four things" — what a pass carried, said in words rather than a count. */
export function sizeOf(pass: Pass): string {
  const n = pass.changes.length + pass.more;
  const words = ["nothing", "one thing", "two things", "three things", "four things", "five things", "six things", "seven things", "eight things", "nine things", "ten things"];
  return words[n] ?? `${n} things`;
}

/** Reading time, so "a minute" is a claim we can check rather than a hope. */
export function minutes(passes: Pass[]): number {
  const words = passes.reduce((n, p) => n + p.changes.reduce((m, c) => m + c.says.split(/\s+/).length, 0), 0);
  return Math.max(1, Math.round(words / 200));
}

/** Only the passes that carried something you can use, when asked for that. */
export function onlyUsable(passes: Pass[]): Pass[] {
  return passes
    .map((p) => ({ ...p, changes: p.changes.filter((c) => c.kind !== "under") }))
    .filter((p) => p.changes.length);
}
