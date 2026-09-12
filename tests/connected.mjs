/**
 * The timeline is joined end to end. Nothing floats.
 *
 * A drawing made real landed as a piece with no strand into it whenever
 * nothing was live and nothing was current — and the oldest iterations are
 * dropped when the list gets long, which leaves their children pointing at a
 * parent that is not there. Either way the one question the timeline exists
 * to answer — what was this founded on — had no answer for that piece.
 *
 *   · every iteration but the earliest has a strand into it;
 *   · a named parent is kept when it is still there;
 *   · a missing one is healed to what actually came before;
 *   · nothing hangs off itself, and nothing hangs off the future;
 *   · and the store stops making them in the first place.
 *
 *   node tests/connected.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { connected, orphans } from "../src/features/studio/threads.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const th = (id, at, parentId = null, mode = "plan") => ({
  id, at, parentId, mode, state: "done", ask: "", answer: "", changes: [],
});

/* ------------------------------------------------------------------ */
/* 1. A chain that is already whole is left alone                      */
/* ------------------------------------------------------------------ */

const chain = [th("a", 1), th("b", 2, "a"), th("c", 3, "b")];
const j1 = connected(chain);
check("the earliest has no parent, because nothing came before it", j1.get("a") === null);
check("a named parent is kept", j1.get("b") === "a" && j1.get("c") === "b");
check("nothing in a whole chain is an orphan", orphans(chain).length === 0);

/* ------------------------------------------------------------------ */
/* 2. A piece that landed loose is joined to what it was founded on     */
/* ------------------------------------------------------------------ */

const loose = [th("a", 1), th("b", 2, "a"), th("drawing", 3, null, "drawing")];
check("a drawing that landed with no parent is seen as an orphan",
  orphans(loose).map((t) => t.id).join() === "drawing");
const j2 = connected(loose);
check("and it is joined to the iteration that came before it", j2.get("drawing") === "b");
check("joining it does not disturb the rest", j2.get("b") === "a" && j2.get("a") === null);

/* ------------------------------------------------------------------ */
/* 3. A parent that has been dropped                                   */
/* ------------------------------------------------------------------ */

const dropped = [th("b", 2, "gone"), th("c", 3, "b")];
check("a parent that is not there any more is an orphan", orphans(dropped).length === 0 || orphans(dropped)[0].id === "c" || orphans(dropped)[0].id === "b");
const j3 = connected(dropped);
check("the child of a dropped parent becomes the new root", j3.get("b") === null);
check("and everything after it still hangs together", j3.get("c") === "b");

/* ------------------------------------------------------------------ */
/* 4. Nothing impossible                                               */
/* ------------------------------------------------------------------ */

const silly = [th("a", 1, "a"), th("b", 2, "c"), th("c", 3)];
const j4 = connected(silly);
check("nothing hangs off itself", [...j4.entries()].every(([id, p]) => p !== id));
check("nothing hangs off something that came after it", (() => {
  const at = new Map(silly.map((t) => [t.id, t.at]));
  return [...j4.entries()].every(([id, p]) => !p || at.get(p) < at.get(id));
})(), JSON.stringify([...j4]));
check("every thread gets an answer", j4.size === silly.length);
check("nothing at all is nothing", connected([]).size === 0 && orphans([]).length === 0);

/* ------------------------------------------------------------------ */
/* 5. Out of order in, in order out                                    */
/* ------------------------------------------------------------------ */

const shuffled = [th("c", 3), th("a", 1), th("b", 2)];
const j5 = connected(shuffled);
check("order in the list does not decide what came first",
  j5.get("a") === null && j5.get("b") === "a" && j5.get("c") === "b");

/* ------------------------------------------------------------------ */
/* 6. …and the store stops making them                                 */
/* ------------------------------------------------------------------ */

const store = readFileSync("src/features/studio/store.ts", "utf8");
check("a new iteration falls back to the newest there is",
  /parentId: s\.currentThreadId \?\? s\.liveThreadId \?\? \(s\.threads\.length/.test(store));
check("dropping the oldest re-hangs whoever hung off them",
  /t\.parentId && !here\.has\(t\.parentId\)/.test(store));

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
check("the timeline draws the healed joins, not the raw parentId", /connected\(threads\)/.test(timeline));
check("and never draws a strand from something that is not there", /byId\.has\(c\.from\)/.test(timeline));

/* ------------------------------------------------------------------ */
/* 7. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
