/**
 * A Claude call that failed after it ran still says what it cost.
 *
 * Claude charges for every call that came back, usable or not. The body and
 * reshape routes only reported their tokens on success: a drawing read that
 * ran out of room at 16k output tokens, an answer that wasn't a shape, a
 * refusal, or a body stripped to nothing all came back with no usage, so the
 * iteration's bill and the running spend left out the costliest calls. And
 * the reshape client only noted the read's cost on its success path.
 *
 * This reads the sources; it needs no server and no key.
 *
 *   node tests/paid-failure-usage.mjs
 *
 * Covers: src/app/api/studio/body/route.ts, src/app/api/studio/reshape/route.ts, src/app/api/studio/generate/route.ts, src/features/studio/reshapeRun.ts, src/features/studio/spend.ts
 */
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** Every NextResponse.json call between finalMessage() and the catch, with its argument. */
const answersAfterTheCall = (src) => {
  const from = src.indexOf("await stream.finalMessage()");
  const to = src.indexOf("} catch", from);
  if (from < 0 || to < 0) return [];
  const slice = src.slice(from, to);
  const out = [];
  let at = 0;
  while ((at = slice.indexOf("NextResponse.json(", at)) >= 0) {
    let depth = 0;
    let end = at + "NextResponse.json".length;
    for (; end < slice.length; end++) {
      if (slice[end] === "(") depth++;
      else if (slice[end] === ")" && --depth === 0) break;
    }
    out.push(slice.slice(at, end + 1));
    at = end;
  }
  return out;
};

for (const [r, least] of [["reshape", 3], ["body", 4]]) {
  const src = bare(`src/app/api/studio/${r}/route.ts`);
  const answers = answersAfterTheCall(src);
  check(`${r}: every answer after the paid call is found (${least}+)`, answers.length >= least, `${answers.length}`);
  const bare_ = answers.filter((a) => !/\busage\b/.test(a));
  check(`${r}: every one of them carries usage, failures included`, answers.length > 0 && bare_.length === 0, bare_.map((a) => a.slice(0, 90).replace(/\s+/g, " ")).join(" | "));
  check(`${r}: the usage counts cache writes too`, /written: message\.usage\.cache_creation_input_tokens/.test(src));
}

{
  const src = bare("src/app/api/studio/generate/route.ts");
  const refusal = answersAfterTheCall(src).find((a) => /reason: "refusal"/.test(a)) ?? "";
  check("generate: a refusal carries usage", /\busage\b/.test(refusal));
}

{
  const src = bare("src/features/studio/reshapeRun.ts");
  const noted = src.match(/noteSpend\(readCost/g)?.length ?? 0;
  check("reshapeRun: the read's cost is noted on both the landed and the fallback path", noted >= 2, `${noted}`);
  // The fallback is what follows the landed path's return: the first
  // applyProportion after `if (data.ok && data.patch)`.
  const fallback = src.indexOf("applyProportion(drawn, node, job);", src.indexOf("if (data.ok && data.patch)"));
  const after = src.indexOf("noteSpend(readCost", fallback);
  const body = src.indexOf("bodyFor(", fallback);
  check("reshapeRun: the fallback notes it before the body pass starts", fallback > 0 && after > fallback && after < body);
}

{
  const { priceTokens } = await import("../src/features/studio/spend.ts").catch(() => ({}));
  if (priceTokens) {
    check("a truncated read (1k in, 16k out) is priced above nothing", priceTokens({ input: 1000, output: 16000 }) > 0);
  }
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
