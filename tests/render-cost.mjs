/**
 * The renderer's first pass reports what was measured (inventory B2).
 *
 * The first pass used `replicate.run`, which hands back the output alone
 * and throws the prediction away with its metrics, and then wrote a
 * constant on the answer as its cost: a number copied by hand into four
 * places and never measured. This holds the pass to one meter:
 *
 *   · the pass is a prediction that is created and waited on, so its
 *     metrics come back (a source read, named as one: the vendor is not
 *     called from a test);
 *   · the answer's seconds are measured, the longer of the model's own
 *     time and the wall;
 *   · the cost is what the prediction reported when it reported one, and
 *     the model's published rate when it did not, and the answer says
 *     which;
 *   · the rate is written once: the keys panel's card, the Try it message
 *     and .env.example read it rather than repeating it.
 *
 *   node tests/render-cost.mjs
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const route = readFileSync("src/app/api/studio/image/route.ts", "utf8");
const first = (route.split("export async function POST")[1] ?? "");
check("the first pass creates a prediction and waits on it, rather than running blind (source read)", !/replicate\.run\(/.test(route) && /predict\(replicate, model/.test(first), `${(route.match(/replicate\.run\(/g) ?? []).length} run() calls`);
check("and meters the answer off the prediction (source read)", /meterFirst\(/.test(first));

const { RENDER_COST } = await import("../src/features/studio/renderer.ts");
let meter = null;
try { ({ meterFirst: meter } = await import("../src/features/studio/renderMeter.ts")); } catch { /* not there yet */ }
check("the meter exists as a pure module", typeof meter === "function");
if (meter) {
  const a = meter("vectorize", { predict_time: 3.2 }, 1800);
  check("seconds are the model's own time when that is the longer", a.ms === 3200, `${a.ms}ms`);
  const b = meter("vectorize", { predict_time: 0.9 }, 2400);
  check("and the wall when the queue was the longer", b.ms === 2400, `${b.ms}ms`);
  check("a cost the prediction did not report is the model's published rate, and says so", a.cost === RENDER_COST.vectorize && a.priced === "card", `${a.cost} ${a.priced}`);
  const c = meter("raster", { predict_time: 1, cost: 0.031 }, 500);
  check("a cost the prediction did report wins, and says so", c.cost === 0.031 && c.priced === "reported", `${c.cost} ${c.priced}`);
  const d = meter("vector", null, 700);
  check("no metrics at all is still an answer: the wall and the rate", d.ms === 700 && d.cost === RENDER_COST.vector && d.priced === "card");
}

/* The rate is written once. */
const keysStore = readFileSync("src/features/keys/store.ts", "utf8");
const keysTest = readFileSync("src/app/api/keys/test/route.ts", "utf8");
const env = readFileSync(".env.example", "utf8");
check("the keys panel's card reads the rate rather than repeating it", !/\$0\.0[48]/.test(keysStore) && /rateCardSays\(|RENDER_COST|money\(/.test(keysStore));
check("so does the Try it message", !/\$0\.0[48]/.test(keysTest) && /rateCardSays\(|RENDER_COST|money\(/.test(keysTest));
{
  const said = [...env.matchAll(/\$0\.(\d\d)/g)].map((m) => Number(`0.${m[1]}`));
  const card = new Set(Object.values(RENDER_COST));
  check(".env.example names only the rates on the card", said.length > 0 && said.every((v) => card.has(v)), said.join(", "));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
