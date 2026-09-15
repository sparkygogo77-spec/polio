/**
 * Every route that asks Claude has a deadline at both ends.
 *
 * Rule 8b: a call that can hang must have a deadline at both ends, and the
 * spinner must always stop with a sentence. The generate route had it: a
 * budget of its own inside `maxDuration`, one SDK try with a timeout
 * inside that, an answer with a reason and the seconds it took whatever
 * went wrong, and a longer deadline in the browser for when nothing
 * arrives at all. The body and reshape routes, the two behind a drawing,
 * had none of it: a slow call was killed by the platform with no reply,
 * and their callers waited forever.
 *
 *   node tests/route-deadlines.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

for (const r of ["generate", "body", "reshape"]) {
  const src = bare(`src/app/api/studio/${r}/route.ts`);
  const max = Number(/export const maxDuration = (\d+);/.exec(src)?.[1] ?? 0);
  check(`${r}: keeps a budget of its own inside its ${max}s`, max > 0 && /ANSWER_BUDGET_MS/.test(src) && /budget - 5_000/.test(src));
  check(`${r}: the SDK gets one try with a timeout inside the budget`, /timeout: UPSTREAM_TIMEOUT_MS, maxRetries: 0/.test(src));
  check(`${r}: the call is cut at the budget`, /setTimeout\(\(\) => deadline\.abort\(\), ANSWER_BUDGET_MS\)/.test(src) && /\{ signal: deadline\.signal \}/.test(src));
  check(`${r}: a cut answers with a reason and the seconds it took`, /deadline\.signal\.aborted/.test(src) && /reason: "timeout"/.test(src) && /seconds/.test(src));
  check(`${r}: an API error carries the request id`, /requestID/.test(src));
  check(`${r}: the timer is cleared however it ends`, /clearTimeout\(ran\)/.test(src));
}
for (const f of ["bodyRun.ts", "reshapeRun.ts"]) {
  const src = bare(`src/features/studio/${f}`);
  check(`${f}: the browser keeps a longer deadline of its own`, /signal: AbortSignal\.timeout\(CALL_DEADLINE_MS\)/.test(src));
}
const effort = bare("src/features/studio/effort.ts");
const ms = Number(/CALL_DEADLINE_MS = ([\d_]+);/.exec(effort)?.[1]?.replace(/_/g, "") ?? 0);
check("and that deadline is longer than any route's budget (180s), so it fires only when nothing arrives", ms > 180_000, `${ms}ms`);

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
