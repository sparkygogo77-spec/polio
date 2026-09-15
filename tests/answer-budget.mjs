/**
 * A route answers before the platform kills it (inventory B12).
 *
 * Every Claude route keeps a budget of its own a few seconds short of its
 * `maxDuration`, so it can answer "this took too long" instead of being
 * killed mid-call with no response. The default was `maxDuration − 5 s`,
 * 295 s on the generate route, and the file's own comment admitted a
 * Vercel hobby deployment stops a function at 60 s whatever the file asks
 * for: on the plan most sites start on, the default never got to fire.
 *
 * This holds the budget to one rule, in one place:
 *
 *   · asked for in STUDIO_ANSWER_BUDGET_MS, it is what was asked;
 *   · on Vercel with nothing asked, it fits under the hobby ceiling, and a
 *     plan with more says so with the variable;
 *   · anywhere else with nothing asked, it is `maxDuration − 5 s`;
 *   · and the three routes derive theirs from the one rule (a source read,
 *     named as one).
 *
 *   node tests/answer-budget.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let budget = null;
let HOBBY = null;
try { ({ answerBudget: budget, HOBBY_CEILING_MS: HOBBY } = await import("../src/app/api/studio/budget.ts")); } catch { /* not there yet */ }
check("the budget is one rule in one module", typeof budget === "function" && typeof HOBBY === "number");
if (budget) {
  check("nothing asked, off Vercel: maxDuration less five seconds", budget({}, 300) === 295_000, String(budget({}, 300)));
  check("nothing asked, on Vercel: under the hobby ceiling, five seconds short of it", budget({ VERCEL: "1" }, 300) === HOBBY - 5_000 && HOBBY === 60_000, `${budget({ VERCEL: "1" }, 300)} of a ${HOBBY} ceiling`);
  check("a shorter route on Vercel keeps its own, smaller figure", budget({ VERCEL: "1" }, 30) === 25_000, String(budget({ VERCEL: "1" }, 30)));
  check("asked for, the ask wins, on Vercel or off", budget({ VERCEL: "1", STUDIO_ANSWER_BUDGET_MS: "120000" }, 300) === 115_000 && budget({ STUDIO_ANSWER_BUDGET_MS: "120000" }, 300) === 115_000);
  check("an ask that is not a number, or too small to mean anything, is ignored", budget({ STUDIO_ANSWER_BUDGET_MS: "soon" }, 300) === 295_000 && budget({ STUDIO_ANSWER_BUDGET_MS: "10" }, 300) === 295_000);
  check("and the floor is five seconds whatever was asked", budget({ STUDIO_ANSWER_BUDGET_MS: "6000" }, 300) === 5_000);
}

for (const r of ["generate", "body", "reshape"]) {
  const src = readFileSync(`src/app/api/studio/${r}/route.ts`, "utf8");
  check(`the ${r} route takes its ceiling from the rule rather than working one out (source read)`, /answerCeiling\(process\.env, maxDuration\)/.test(src) && !/maxDuration \* 1000/.test(src));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
