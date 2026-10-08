/**
 * Changing a thing from the timeline changes that thing.
 *
 * Going back to an iteration and drawing again made a second part, because
 * nothing on the thread said which part on the board it was about. Now:
 *
 *   · an iteration remembers what it made, on every road it can take;
 *   · the card offers to change that part, by drawing or by writing;
 *   · it offers nothing when the part has since been deleted, because then
 *     there is nothing to change and the offer would be to make a new one;
 *   · and the board opens on that part, so what comes back reshapes it.
 *
 *   node tests/change-made.mjs [url]      # default http://localhost:3000
 */
import { readFileSync, readdirSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The thread remembers                                             */
/* ------------------------------------------------------------------ */

const threads = readFileSync("src/features/studio/threads.ts", "utf8");
check("a thread has somewhere to keep what it made", /madeId\?: string;/.test(threads));

const store = ["board/store.ts", ...readdirSync("src/features/studio/board/store").filter((f) => f.endsWith(".ts")).map((f) => `board/store/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n");
/* That `madeId` is one of the things a landing thread is given, rather than
   the whole parameter list in that order. Pinned to all eight names, this
   broke the first time somebody added a ninth — the id a forming box fills
   in — while what it claims was untouched. */
check("it can be set as the thread lands", /landThread: \(\{[^}]*\bmadeId\b[^}]*\}\)/.test(store));
check("and afterwards, for a road that only knows later", /noteMade: \(threadId, madeId\)/.test(store));

const run = readFileSync("src/features/studio/reshapeRun.ts", "utf8");
check("the catalogue road records it", /madeId: made\.id,/.test(run));
check("the reader road records it", (run.match(/noteMade\(landed, made\.id\)/g) ?? []).length >= 1);
check("and the no-reader road does too", (run.match(/noteMade\(landed, made\.id\)/g) ?? []).length >= 2,
  `${(run.match(/noteMade\(landed, made\.id\)/g) ?? []).length} of 2`);

/* ------------------------------------------------------------------ */
/* 2. The card offers to change that part                              */
/* ------------------------------------------------------------------ */

const detail = readFileSync("src/features/studio/TimelineDetail.tsx", "utf8");
check("there is a way to draw more on it", /Draw more on it/.test(detail));
check("and a way to write more about it", /Write more about it/.test(detail));
check("both name the part rather than saying \"it\" and hoping", /\$\{madeLabel\}/.test(detail));
check("neither is offered when the part has gone",
  /nodes\.find\(\(n\) => n\.id === thread\.madeId\) \?\? null/.test(detail) && /\{made \? \(/.test(detail));
check("it goes to the board, to that page, with that part picked",
  /setMode\("design"\)/.test(detail) && /setActivePage\(made\.pageId\)/.test(detail) && /setSelection\(\[made\.id\]\)/.test(detail));
check("and waits a frame, because the board has to exist first", /requestAnimationFrame/.test(detail));

/* ------------------------------------------------------------------ */
/* 3. The board opens on the part                                      */
/* ------------------------------------------------------------------ */

const radial = ["RadialMenu.tsx", ...["open.ts", "choices.ts", "RadialMenu.tsx", "ring.tsx"].map((f) => `radial/${f}`)].map((f) => `src/features/studio/${f}`).map((f) => readFileSync(f, "utf8")).join("\n");
check("the wheel can be opened straight onto one slot", /slot\?: SlotId \| null;/.test(radial));
check("drawing on a part is one call", /export function drawOnPart/.test(radial));
check("writing on it is the other", /export function writeOnPart/.test(radial));
check("the slot survives the open rather than being reset to the wheel",
  /setPicked\(open\?\.slot \?\? null\)/.test(radial));

const board = readFileSync("src/features/studio/DrawBoard.tsx", "utf8");
check("a drawing made on a part reshapes that part", /nodeId: node\?\.id \?\? null/.test(board));
check("and says so rather than saying it is making one", /Reshaping \$\{label\}/.test(board));

/* ------------------------------------------------------------------ */
/* 4. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers (a liveness probe: this suite has no live half, the wiring above is held by source pins)", live, live ? url : `${url} did not answer`);

const passed = results.filter(Boolean).length;
/* Says what happened. It read "all good" whatever the count was, so a run
   with a failure in it announced itself as a clean one. */
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
