/**
 * What a drawing costs, where the person paying for it can see it.
 *
 * Nothing anywhere said what a call cost or how long it took. The card named
 * the model and stopped; the only place the number existed was the bench.
 *
 *   · every paid call is priced from one list, Claude per token and the
 *     renderer per press;
 *   · a real sub-cent call is not written as "$0.00";
 *   · the wait is measured, not estimated;
 *   · the bill says who was paid, which is the only way to tell from the
 *     outside whether a drawing reached the renderer at all;
 *   · and it lands on the iteration card and in the toast.
 *
 *   node tests/bill.mjs [url]        # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import {
  NOTHING, RENDER_PRICE, TOKEN_PRICE, add, claudeSpend, priceRender, priceTokens,
  renderSpend, sayBill, saySpend, sayWhere, spent, timed, took,
} from "../src/features/studio/spend.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. One price list                                                   */
/* ------------------------------------------------------------------ */

check("the renderer's prices are the ones already in use",
  RENDER_PRICE.vector === 0.08 && RENDER_PRICE.raster === 0.04 && RENDER_PRICE.vectorize === 0.08);
check("a cache read is a tenth of an input token", TOKEN_PRICE.cached === TOKEN_PRICE.input / 10);
check("a cache write is a quarter more than one", TOKEN_PRICE.written === TOKEN_PRICE.input * 1.25);
check("output costs more than input", TOKEN_PRICE.output > TOKEN_PRICE.input);

check("a million input tokens costs the input rate", priceTokens({ input: 1_000_000 }) === TOKEN_PRICE.input);
check("tokens of every kind are added", (() => {
  const p = priceTokens({ input: 1000, output: 1000, cached: 1000, written: 1000 });
  const want = (TOKEN_PRICE.input + TOKEN_PRICE.output + TOKEN_PRICE.cached + TOKEN_PRICE.written) / 1000;
  return Math.abs(p - want) < 1e-12;
})());
check("no tokens is no money", priceTokens(undefined) === 0 && priceTokens({}) === 0);
check("two renderer presses cost twice one", priceRender("vector", 2) === 0.16);

/* ------------------------------------------------------------------ */
/* 2. Added up, and split by who was paid                              */
/* ------------------------------------------------------------------ */

const c = claudeSpend({ input: 20_000, output: 2_000 }, 4200);
check("a Claude call is one call, priced and timed", c.calls === 1 && c.ms === 4200 && c.dollars > 0);
check("and it is charged to Claude, not the renderer", c.claude === c.dollars && c.renderer === undefined);

const r = renderSpend("vectorize", 6100, 2);
check("a renderer press is charged to the renderer", r.renderer === 0.16 && r.claude === undefined, `${r.dollars}`);
check("and each press counts as a call", r.calls === 2);

const both = add(c, r);
check("two spends add up", Math.abs(both.dollars - (c.dollars + r.dollars)) < 1e-12);
check("the wait adds up too, because the person waited for both", both.ms === 4200 + 6100);
check("and each side keeps its own share", both.claude === c.claude && both.renderer === r.renderer);
check("nothing plus nothing is nothing", add(NOTHING, undefined).dollars === 0);

/* ------------------------------------------------------------------ */
/* 3. Written at the size it actually is                               */
/* ------------------------------------------------------------------ */

check("free is said as free, not as a price", spent(0) === "free");
check("a real sub-cent call is not written as $0.00", spent(0.004) === "$0.004");
check("something smaller than that still says it is not nothing", spent(0.0002) === "<$0.001");
check("an ordinary price is two places", spent(0.126) === "$0.13");

check("under a second is milliseconds", took(420) === "420ms");
check("seconds are one place", took(8400) === "8.4s");
check("a long wait is minutes and seconds", took(72_000) === "1m 12s");
check("no time is said at all rather than as zero", took(0) === "");

check("the line is the price, the wait and the calls", saySpend({ dollars: 0.12, ms: 8400, calls: 3 }) === "$0.12 · 8.4s · 3 calls");
check("one call says one call", saySpend({ dollars: 0.08, ms: 1000, calls: 1 }).endsWith("1 call"));
check("who was paid is said", sayWhere({ claude: 0.03, renderer: 0.08 }) === "Claude $0.03, renderer $0.08");
check("a drawing that never reached the renderer says so by omission",
  sayWhere({ claude: 0.03 }) === "Claude $0.03");
check("the whole bill reads in one line",
  sayBill({ dollars: 0.11, ms: 8400, calls: 2, claude: 0.03, renderer: 0.08 }) === "$0.11 · 8.4s · 2 calls · Claude $0.03, renderer $0.08");
check("an iteration that spent nothing still says how long it took",
  sayBill({ dollars: 0, ms: 2000, calls: 0 }) === "free · 2.0s · nothing was paid for");
check("an iteration with no bill at all says nothing", sayBill(undefined) === "");

/* ------------------------------------------------------------------ */
/* 4. The wait is measured                                             */
/* ------------------------------------------------------------------ */

const timedRun = await timed(async () => { await new Promise((r) => setTimeout(r, 60)); return "done"; });
check("timed hands the value back untouched", timedRun.value === "done");
check("and says how long it really took", timedRun.ms >= 55, `${timedRun.ms}ms`);
check("a call that failed still reports its time", await (async () => {
  try { await timed(async () => { await new Promise((r) => setTimeout(r, 40)); throw new Error("no"); }); }
  catch (err) { return err.ms >= 35; }
  return false;
})());

/* ------------------------------------------------------------------ */
/* 5. Every call goes through it                                       */
/* ------------------------------------------------------------------ */

const run = readFileSync("src/features/studio/reshapeRun.ts", "utf8");
check("the reader's call is priced and timed", /claudeSpend\(data\.usage, Date\.now\(\) - readFrom\)/.test(run));
/* The cost is what is asserted, not the argument list. This was pinned to
   `noteSpend(readCost)` exactly and broke when the call grew the thread it
   belongs to — `noteSpend(readCost, job.threadId)` — which is the check's
   own claim becoming *more* true than it was. */
check("and noted on the iteration it belongs to", /noteSpend\(\s*readCost\s*(?:,[^)]*)?\)/.test(run));
check("the body's whole bill is noted, renderer and Claude both",
  /noteSpend\(\{\s*dollars: written\.cost/.test(run) && /renderer: written\.renderer/.test(run) && /claude: written\.claude/.test(run));

const draw = readFileSync("src/features/studio/drawRun.ts", "utf8");
check("the tracer times itself", /ms: Date\.now\(\) - from/.test(draw));
check("and counts every go as a press", /calls: attempts\.length/.test(draw));

const body = readFileSync("src/features/studio/bodyRun.ts", "utf8");
check("the writer prices its tokens whether or not the answer was usable",
  /const tokens = priceTokens\(answer\.usage\)/.test(body));
check("and keeps the two halves apart", /toClaude/.test(body) && /toRenderer/.test(body));

const brief = readFileSync("src/features/studio/BriefDialog.tsx", "utf8");
check("the generate path is priced too, vined or not", /noteSpend\(claudeSpend\(/.test(brief));

const store = readFileSync("src/features/studio/store.ts", "utf8");
check("the bill accumulates rather than replacing", /calls: \(had\?\.calls \?\? 0\) \+ spend\.calls/.test(store));
check("it is kept to the tenth of a cent, so a small call is not rounded to free",
  /Math\.round\(\(a \+ b\) \* 10000\) \/ 10000/.test(store));
check("recording what was sent does not wipe what it cost",
  /usage: \{ \.\.\.\(t\.usage \?\? \{\}\), \.\.\.usage \}/.test(store));

/* ------------------------------------------------------------------ */
/* 6. Where a person looks                                             */
/* ------------------------------------------------------------------ */

const timeline = readFileSync("src/features/studio/Timeline.tsx", "utf8");
check("the iteration card carries the bill", /data-bill=\{thread\.id\}/.test(timeline));
check("it says what it cost and who was paid", /saySpend\(/.test(timeline) && /sayWhere\(/.test(timeline));
check("the model is still named, under it", /\{thread\.model\}/.test(timeline));

const detail = readFileSync("src/features/studio/TimelineDetail.tsx", "utf8");
check("the section under the timeline says the same thing", /sayBill\(/.test(detail));
check("nothing still calls the renderer the whole bill", !/at the renderer` : ""/.test(detail));
check("the toast says it too", /title: "What that cost"/.test(run));
check("and replaces itself rather than stacking", /:bill`/.test(run));

/* ------------------------------------------------------------------ */
/* 7. In the browser                                                   */
/* ------------------------------------------------------------------ */

const url = process.argv[2] || "http://localhost:3000";
let live = false;
try { live = (await fetch(`${url}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? url : `${url} — skipped the live half`);

const passed = results.filter(Boolean).length;
/* Says what happened. It read "all good" whatever the count was, so a run
   with a failure in it announced itself as a clean one. */
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
