/**
 * WHICH OF THE BUILDER'S TEST HOOKS A PAGE MAY HAVE.
 *
 * The checks in `tests/` drive the Builder through `window.__studio*`. On
 * J's live page those same hooks are one call away for any script on it:
 * publish, put a whole document on the board, clear everything. So the hooks
 * that write are there only on this PC's own addresses, where the checks run.
 *
 * The address is the gate, not a flag: `location` can't be changed by a script
 * without leaving the page, and a flag a test could set, a script could set
 * too. Nothing in the Builder's own UI goes through a hook, and neither does
 * the paired helper: the bridge (`features/agents/bridge.ts`) calls the store
 * itself and has no step for publishing, loading or clearing.
 *
 * What is left on the live page only reads (`__studioNodes`, `__studioHistory.doc`
 * and the like), which is what a live check needs. This takes the one-call hooks
 * away; it is not a wall. A script on this origin can still reach storage and
 * the routes. `tests/test-hooks-locked.mjs`.
 */

/** Hooks that change the board, keep a copy or send something out, by name on `window`. */
export const WRITE_HOOKS = [
  "__studioPublish", "__studioLoadDoc", "__studioKitBranch", "__studioGiveWork", "__studioPutComponent", "__studioPutLearned",
  "__studioRollTheme", "__studioStartNewSite", "__studioNotePass", "__studioSetFormat", "__studioDraw",
  "__studioLightStart", "__studioLightTo", "__studioLightEnd",
] as const;

/** True on this PC's own addresses, where the checks run; false on the live site. */
export function testHooksOpen(host: string = typeof location === "undefined" ? "" : location.hostname): boolean {
  return host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");
}
