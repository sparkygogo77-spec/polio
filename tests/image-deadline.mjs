/**
 * The picture and element routes answer before the platform kills them.
 *
 * Rule 8b: a call that can hang must have a deadline at both ends, and the
 * spinner must always stop with a sentence. The image route waited on
 * Replicate with no timer at all: a slow model ran past the platform's
 * ceiling, the function was killed with no answer, and the prediction went
 * on at Replicate, finished and was charged for a picture nobody collected.
 * The element route fetched a page's font faces one after another, eight
 * seconds each, on a 60 s route: two stalling font hosts took it past its
 * minute and nothing answered.
 *
 * So:
 *   · image: the budget is the one rule in `budget.ts`, every prediction is
 *     raced against it (and the asker leaving), a cut cancels the
 *     prediction at Replicate, the timer is cleared however it ends, and
 *     both passes answer `timeout` with the seconds it took (source read);
 *   · element: the budget is the same rule, the page load and every font
 *     wait are cut to what is left of it (source read);
 *   · and, for real: `carryFaces` fed by the route's own font fetcher, with
 *     every font host stalling, comes back inside the budget with every
 *     face kept by its address, "out of time", where it used to take eight
 *     seconds a face.
 *
 *   node tests/image-deadline.mjs
 *
 * Covers: src/app/api/studio/image/route.ts, src/app/api/studio/element/route.ts, src/app/api/studio/fontFile.ts, src/app/api/studio/budget.ts
 */
import { readFileSync } from "node:fs";
import { carryFaces } from "../src/features/studio/look/fonts.ts";
import { fetchFont, FONT_WAIT_MS } from "../src/app/api/studio/fontFile.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------ image (source read) */
const image = bare("src/app/api/studio/image/route.ts");
const predict = /async function predict\([\s\S]*?\n\}/.exec(image)?.[0] ?? "";
check("image: keeps the one budget rule inside its maxDuration", /import \{ answerBudget \} from "\.\.\/budget"/.test(image) && /answerBudget\(process\.env, maxDuration\)/.test(image));
check("image: the budget runs from when the request arrived", /const until = Date\.now\(\) \+ ANSWER_BUDGET_MS/.test(image));
check("image: every prediction is waited on against the budget and the asker leaving",
  /until: number, signal\?: AbortSignal/.test(predict) && /Promise\.race\(\[replicate\.wait\(/.test(predict) && /setTimeout\(quit, Math\.max\(0, until - Date\.now\(\)\)\)/.test(predict) && /addEventListener\("abort", quit/.test(predict),
);
const calls = (image.match(/await predict\(/g) ?? []).length;
const handed = (image.match(/(?<!token), until, (request\.)?signal\);/g) ?? []).length;
check("image: …and every call site hands both in", calls >= 4 && handed === calls, `${handed} of ${calls} calls`);
check("image: the polling stops when the wait is cut", /replicate\.wait\(started, \{ interval: 700 \}, async \(\) => cut\)/.test(predict));
check("image: a cut cancels the prediction at Replicate, so it is not charged past it", /if \(cut\) await replicate\.predictions\.cancel\(started\.id/.test(predict));
check("image: the timer is cleared however it ends", /finally \{\s*clearTimeout\(ran\);/.test(predict));
check("image: both passes answer a cut with `timeout` and the seconds it took",
  (image.match(/if \(cutShort\(error\)\) \{\s*const seconds = Math\.round\(\(Date\.now\(\) - began\) \/ 1000\);\s*return NextResponse\.json\(\{ ok: false,( stage: 2,)? reason: "timeout"[^}]*seconds \}\);/g) ?? []).length === 2);

/* ------------------------------------------------------------ element (source read) */
const element = bare("src/app/api/studio/element/route.ts");
check("element: keeps the one budget rule inside its maxDuration", /const until = began \+ answerBudget\(process\.env, maxDuration\)/.test(element));
check("element: the page load is cut to what is left", /timeout: Math\.max\(1_000, Math\.min\(READ_BUDGET_MS, until - Date\.now\(\)\)\)/.test(element));
check("element: the faces are fetched against the same budget", /carryFaces\(read, used, gate\.url, \(url\) => fetchFont\(url, until\)\)/.test(element) && !/async function fetchFont/.test(element));
const fontFile = bare("src/app/api/studio/fontFile.ts");
check("fontFile: each font wait is the least of eight seconds and what is left", /Math\.min\(FONT_WAIT_MS, until - Date\.now\(\)\)/.test(fontFile) && FONT_WAIT_MS === 8_000);

/* ------------------------------------------------------------ for real: every font host stalls */
const realFetch = globalThis.fetch;
let asked = 0;
// A host that takes the request and never answers: only an abort ends it, as with a real fetch.
globalThis.fetch = (_url, init) => {
  asked++;
  return new Promise((_, reject) => {
    init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("This operation was aborted"), { name: "AbortError" })), { once: true });
  });
};
const families = ["Alpha Sans", "Beta Serif", "Gamma Mono"];
const read = {
  faces: families.flatMap((family) => ["400", "700"].map((weight) => ({
    family, weight, style: "normal", sheet: null,
    sources: [{ url: `https://fonts.stall.example/${family.replace(/\s/g, "")}-${weight}.woff2`, format: "woff2" }],
  }))),
  links: [],
};
try {
  const t0 = Date.now();
  const until = t0 + 1_500;
  const carried = await carryFaces(read, families, "https://site.example/", (url) => fetchFont(url, until));
  const took = Date.now() - t0;
  const fonts = carried.fonts ?? [];
  check("six stalling faces come back inside the budget, not at eight seconds each", took < 2_500, `${took}ms for ${fonts.length} faces, ${asked} fetched`);
  check("every face is kept by its address, not carried", fonts.length === 6 && fonts.every((f) => f.carried === false), fonts.map((f) => f.carried).join(","));
  check("and each says it ran out of time", fonts.every((f) => /out of time/.test(f.says ?? "")), fonts.map((f) => f.says).filter((s) => !/out of time/.test(s ?? ""))[0] ?? "");
  check("once less than a second was left, the rest were not even asked for", asked === 1, `${asked} fetched`);

  asked = 0;
  const t1 = Date.now();
  const none = await carryFaces(read, families, "https://site.example/", (url) => fetchFont(url, t1 + 50));
  check("with the budget all but gone, nothing is fetched and the read answers at once", asked === 0 && Date.now() - t1 < 1_000 && none.fonts.every((f) => f.carried === false && /out of time/.test(f.says ?? "")), `${Date.now() - t1}ms, ${asked} fetched`);
} finally {
  globalThis.fetch = realFetch;
}

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
