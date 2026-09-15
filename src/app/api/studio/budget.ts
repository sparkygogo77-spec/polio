/**
 * How long a Claude route may wait before it must answer.
 *
 * `maxDuration` is what the platform grants and, when the wall clock
 * reaches it, the function is killed where it stands: no response, no
 * status, nothing for the browser to show. So every route keeps a budget
 * of its own a few seconds short of a ceiling and answers itself when it
 * runs out (docs/DESIGN.md, rule 8b). The ceiling was `maxDuration` and
 * nothing else, and the file's own comment admitted that a Vercel hobby
 * deployment stops a function at 60 s whatever the file asks for: on the
 * plan most sites start on, a 295 s budget never got to fire (inventory
 * B12). The rule is one function now, read by every route:
 *
 *   1. STUDIO_ANSWER_BUDGET_MS, when it is set and means something, is the
 *      ceiling. A plan with more than the hobby's minute says so here.
 *   2. On Vercel with nothing asked, the ceiling is the hobby's minute or
 *      `maxDuration`, whichever is less: the safe one, because the plan is
 *      not in the environment and a budget above the real ceiling is a
 *      spinner that never stops.
 *   3. Anywhere else, `maxDuration`.
 *
 * Pure, and tested by `tests/answer-budget.mjs`.
 */

/** What a Vercel hobby deployment stops a function at, in milliseconds. */
export const HOBBY_CEILING_MS = 60_000;

/** The least a budget can be and still be a budget. */
export const FLOOR_MS = 5_000;

/** What the routes hand in: `process.env`, or a test's own few names. */
type Env = { [name: string]: string | undefined };

/** The ceiling a route works under, in milliseconds. */
export function answerCeiling(env: Env, maxDuration: number): number {
  const asked = Number(env.STUDIO_ANSWER_BUDGET_MS);
  if (Number.isFinite(asked) && asked > FLOOR_MS) return asked;
  const granted = maxDuration * 1000;
  return env.VERCEL ? Math.min(granted, HOBBY_CEILING_MS) : granted;
}

/** The budget itself: five seconds short of the ceiling, never under the floor. */
export function answerBudget(env: Env, maxDuration: number): number {
  return Math.max(FLOOR_MS, answerCeiling(env, maxDuration) - FLOOR_MS);
}
