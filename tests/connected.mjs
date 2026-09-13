/**
 * The timeline is one chain in the order things landed. Nothing else.
 *
 * It used to draw the tree `parentId` makes — a thread hung off whatever
 * was being worked in — which fanned it into branches and gave some boxes
 * several vines into them. What a person wants from a timeline is what
 * happened, in the order it happened. So:
 *
 *   · every iteration but the earliest is joined to the one before it;
 *   · a named parent is kept on the thread and is not what the vine draws;
 *   · nothing hangs off itself, nothing off the future, nothing off two
 *     things — no branches, no forks, ever;
 *   · and the list's own order is the order, not the clocks.
 *
 *   node tests/connected.mjs [url]     # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { chainOf } from "../src/features/studio/threads.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/*
 * `at` is still on a thread — the passes generator and the book read it — but
 * nothing about the chain does, so these fixtures pass whatever and the
 * checks below hold to the list's own order.
 */
const th = (id, at, parentId = null, mode = "plan") => ({
  id, at, parentId, mode, state: "done", ask: "", answer: "", changes: [],
});

/* ------------------------------------------------------------------ */
/* 1. One chain, in the order it happened                              */
/* ------------------------------------------------------------------ */

const chain = [th("a", 1), th("b", 2, "a"), th("c", 3, "b")];
const j1 = chainOf(chain);
check("the earliest has nothing before it", j1.get("a") === null);
check("each of the rest is joined to the one before it", j1.get("b") === "a" && j1.get("c") === "b");

/* ------------------------------------------------------------------ */
/* 2. parentId is kept, and is not what the vine draws                 */
/* ------------------------------------------------------------------ */

/*
 * Three iterations, the third worked in the first. That is true and it is
 * still on the thread; the panel's tree reads it. The timeline draws the
 * record: the third landed after the second, so it hangs off the second.
 */
const worked = [th("a", 1), th("b", 2, "a"), th("c", 3, "a")];
const j2 = chainOf(worked);
check("a thread worked in an older iteration still hangs off the one that landed before it",
  j2.get("c") === "b", `c → ${j2.get("c")}`);
check("so no box ever has two vines into it, and no vine ever forks", (() => {
  const into = new Map();
  for (const [, p] of j2) if (p) into.set(p, (into.get(p) ?? 0) + 1);
  return [...into.values()].every((n) => n === 1);
})());
check("and parentId is untouched on the thread", worked[2].parentId === "a");

/* ------------------------------------------------------------------ */
/* 3. Nothing impossible                                               */
/* ------------------------------------------------------------------ */

const silly = [th("a", 1, "a"), th("b", 2, "c"), th("c", 3)];
const j3 = chainOf(silly);
check("nothing hangs off itself", [...j3.entries()].every(([id, p]) => p !== id));
check("nothing hangs off something that came after it", (() => {
  const place = new Map(silly.map((t, i) => [t.id, i]));
  return [...j3.entries()].every(([id, p]) => !p || place.get(p) < place.get(id));
})(), JSON.stringify([...j3]));
check("every thread gets an answer", j3.size === silly.length);
check("a dropped parent changes nothing, because the vine never read it",
  chainOf([th("b", 2, "gone"), th("c", 3, "b")]).get("b") === null);
check("nothing at all is nothing", chainOf([]).size === 0);

/* ------------------------------------------------------------------ */
/* 4. The list's own order is what happened                            */
/* ------------------------------------------------------------------ */

/*
 * Not the clock on each thread. Time is irrelevant on the timeline: the
 * chain says what came after what and the first board says where it began by
 * being first, so nothing here reads a timestamp — which also means the
 * chain does not depend on the machine's clock having been right.
 */
const shuffled = [th("c", 999), th("a", 1), th("b", 2)];
const j4 = chainOf(shuffled);
check("the list's own order is what happened, whatever the clocks say",
  j4.get("c") === null && j4.get("a") === "c" && j4.get("b") === "a",
  JSON.stringify([...j4]));
check("and nothing in it reads a timestamp or a parent", (() => {
  const src = readFileSync("src/features/studio/threads.ts", "utf8");
  const fn = /export function chainOf[\s\S]*?\n\}/.exec(src)?.[0] ?? "";
  return fn.length > 0 && !/\.at\b/.test(fn) && !/parentId/.test(fn);
})());

check("no clock is printed on a board or under one",
  !/toLocaleTimeString/.test(readFileSync("src/features/studio/Timeline.tsx", "utf8"))
  && !/toLocaleTimeString/.test(readFileSync("src/features/studio/TimelineDetail.tsx", "utf8")));

/* ------------------------------------------------------------------ */
/* 5. …and the store still records what was worked in                  */
/* ------------------------------------------------------------------ */

const store = readFileSync("src/features/studio/store.ts", "utf8");
check("a new iteration falls back to the newest there is",
  /parentId: s\.currentThreadId \?\? s\.liveThreadId \?\? \(s\.threads\.length/.test(store));
check("dropping the oldest re-hangs whoever hung off them",
  /t\.parentId && !here\.has\(t\.parentId\)/.test(store));

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
check("the timeline draws the chain, not the tree", /chainOf\(threads\)/.test(timeline) && !/threadTree\(/.test(timeline));
check("and lays the boxes out as one chain rather than by depth", !/n\.depth \* DRIFT/.test(timeline));
check("and never draws a strand from something that is not there", /byId\.has\(c\.from\)/.test(timeline));

/* ------------------------------------------------------------------ */
/* 6. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
