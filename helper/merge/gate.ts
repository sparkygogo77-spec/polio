/**
 * Which merges wait for J (J's Q3, 2026-10-25):
 *
 * - P2 and P3 merge on their own once CI is green and there are no conflicts.
 * - These wait for J's Approve:
 *   - a P1;
 *   - a lane marked only-you (it adds a Builder control);
 *   - a lane touching keys, accounts or saving;
 *   - a lane touching the capture or export engine.
 *
 * Pure, no imports beyond the contract's types: the tests import it straight.
 */

export type GateInput = {
  p: 1 | 2 | 3;
  onlyYou: boolean;
  /** Every path the branch changes, repo-relative, forward slashes. */
  files: string[];
};

/** Paths whose change J sees before it merges, with the words the dock shows. */
export const ASK_FIRST: { test: RegExp; why: string }[] = [
  { test: /(^|\/)(keys?|keyring|credential|secrets?)[^/]*(\/|\.|$)/i, why: "touches keys" },
  { test: /(^|\/)features\/account\/|(^|\/)api\/account\//i, why: "touches the Account" },
  { test: /(^|\/)board\/store\/(persist|history)\.ts$|(^|\/)account\/sync\.ts$|(^|\/)saves?\//i, why: "touches saving" },
  { test: /^capture\/|(^|\/)capture\/|(^|\/)reassemble\.ts$/i, why: "changes the capture engine" },
  { test: /(^|\/)send-out\/|(^|\/)scaffolding\//i, why: "changes the export engine" },
];

/** Null when the merge may go on its own; otherwise the reason it waits for J. */
export function waitsForJ(x: GateInput): string | null {
  if (x.p === 1) return "a P1 merge";
  if (x.onlyYou) return "it adds a Builder control";
  for (const f of x.files) {
    const hit = ASK_FIRST.find((a) => a.test.test(f));
    if (hit) return `${hit.why} (${f})`;
  }
  return null;
}
