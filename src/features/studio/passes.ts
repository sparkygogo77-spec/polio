/**
 * What changed about the website, as something you can read in a minute.
 *
 * A **pass** is a run of work and a **change** is one thing in it that a
 * person can see on the website. Nobody writes these lines; `npm run passes`
 * reads them out of the history into `passes.generated.ts`, because the
 * deployed build cannot read the history itself.
 *
 * Everything else that used to ride along is gone, under the one absolute
 * rule in `aboutTheSite.ts`: the website in its entirety never mentions him,
 * me, the chats, the models, or how the work is made. Only the changes to
 * the website itself. So a change is a line and a kind, with no body folded
 * under it, no name for where it landed, and no corner of the tree it
 * touched — 10,075 words became 916, and the panel's own claim of five
 * minutes to read became true instead of being out by a factor of ten.
 */
import { PASSES, GENERATED_AT } from "./passes.generated.ts";

/**
 * Three kinds, as fine as one line can honestly be cut.
 *
 * There was a fourth — the work under the floor — and it was never a change
 * to the website: rulings recorded, notes carried, checks added. It is gone,
 * and with it the toggle that used to hide it, because a filter that removes
 * nothing is a control that lies.
 */
export type ChangeKind = "new" | "better" | "fixed";

export interface Change {
  /**
   * What it came from, so a line can be proved to be real rather than
   * invented. It is a key and an audit trail; it is never shown.
   */
  id: string;
  /** The one line: what changed about the website. */
  says: string;
  when: string;
  kind: ChangeKind;
}

export interface Pass {
  id: string;
  when: string;
  /** "11 September" — the day it landed. */
  day: string;
  changes: Change[];
  /**
   * How many lines this pass carried that the panel does not show — over the
   * per-pass limit, or about the making rather than about the website. A
   * count is not a mention, and nothing goes without being counted.
   */
  more: number;
}

export { PASSES, GENERATED_AT };

/** What each kind is called where a person reads it. */
export const KIND_MEANS: Record<ChangeKind, string> = {
  new: "New",
  better: "Better",
  fixed: "Fixed",
};

/**
 * The line a pass leads with: the first thing in it you can now do.
 *
 * A pass headed by a count tells you nothing. Headed by its own biggest new
 * thing, the rest reads as the detail of that.
 */
export function leadOf(pass: Pass): Change | null {
  const order: ChangeKind[] = ["new", "better", "fixed"];
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

/**
 * Reading time, over every word the panel shows.
 *
 * It counted only the lines while the folded bodies carried nine tenths of
 * the words, so it read "about 5 minutes" over a fifty-minute panel. There
 * is nothing folded now, so the count and the panel are the same thing.
 */
export function minutes(passes: Pass[]): number {
  const words = passes.reduce((n, p) => n + p.changes.reduce((m, c) => m + c.says.split(/\s+/).length, 0), 0);
  return Math.max(1, Math.round(words / 200));
}
