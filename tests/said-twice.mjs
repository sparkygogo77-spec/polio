/**
 * THE SAME WORDS EMITTED TWICE, WHICH IS NOT THE SAME BOX EMITTED TWICE.
 *
 * I PREDICTED WRONG. I said his duplicated button label — `n_ctaprimary_97`
 * reading "3G8S...EGjn 13s ago" with `n_prose_100` "3G8S...EGjn" and
 * `n_prose_101` "13s ago" sitting under it — was a div-to-button pair of the
 * same kind as the duplicated boxes, and that the one gap in `offered` would
 * subsume it. It did not. The dedupe took 24 near-duplicate pairs to 2 on his
 * board, 13 pixel-identical to zero and 9 off-by-one to zero, and the label
 * duplication is untouched.
 *
 * WHICH OF THE TWO IT IS, and it is the second: a different cause, not a gap
 * in the retrofit. Two parts inside one cannot both be box-identical to it,
 * so `twins` can never fire on them — and neither can the fix in `offered`,
 * which is also box-only. A new capture would get this wrong too.
 *
 * THE CAUSE. `CANDIDATES` has its own dedupe for exactly this, and its key
 * defeats it:
 *
 *     // One box inside another saying exactly the same thing is one thing to
 *     // point at, not two. The outer one is kept: it is what a person means.
 *     const key = `${w}x${h}:${words.slice(0, 60)}`;
 *
 * The key carries the SIZE, so it only catches boxes that are the same size —
 * which is precisely the case `pageBlocks` already catches by box alone. The
 * case the comment describes, a container and the control inside it saying
 * the same thing at different sizes, never matches the key and both are
 * emitted. Same shape of fault as `offered`: the intent is written down and
 * the test does not implement it.
 *
 * This is a MEASUREMENT. Nothing is fixed here: choosing which of the two to
 * drop decides whether his row or his button survives, and that is not mine
 * to pick.
 *
 *   node tests/said-twice.mjs
 */
import { createRequire } from "node:module";
import { CANDIDATES, MEASURE } from "../src/features/studio/siteRead.ts";
import { offered } from "../src/features/studio/zipImport.ts";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

/* ------------------------------------------------------------------ */
/* 1. His burn-feed row: the same words at two sizes                   */
/* ------------------------------------------------------------------ */

await page.setContent(`<!doctype html><html><body style="margin:0;font:16px system-ui;background:#0a0e1a;color:#fff">
  <div id="row" style="width:900px;padding:20px;background:#151922">
    <button id="burn" style="width:300px;height:44px;background:#132;border:1px solid #0f0;color:#0f0">
      <span>3G8S...EGjn</span> <span>13s ago</span>
    </button>
  </div>
</body></html>`);
await page.waitForTimeout(200);

const cands = await page.evaluate(CANDIDATES, 200);
const out = offered(cands);
const row = out.find((c) => c.selector.includes("row")), burn = out.find((c) => c.selector.includes("burn"));

check("the row and the button are BOTH offered", !!row && !!burn, out.map((c) => `${c.selector} ${c.box.w}x${c.box.h}`).join(" | "));
check("…saying the same words", !!row && !!burn && row.words.includes(burn.words), JSON.stringify([row?.words, burn?.words]));
check("…at different sizes, which is why no box rule can see it",
  !!row && !!burn && !(Math.abs(row.box.w - burn.box.w) <= 2 && Math.abs(row.box.h - burn.box.h) <= 2),
  `${row?.box.w}x${row?.box.h} against ${burn?.box.w}x${burn?.box.h}`);
/*
 * AND THAT IS THE WHOLE ANSWER TO "IS IT A GAP IN THE RETROFIT". It is not:
 * the box dedupe cannot reach a pair that is not the same box, on a stored
 * board or on a fresh capture. The words duplication is its own fault.
 */
check("the box dedupe leaves both, correctly — they are not the same box",
  out.filter((c) => (c.words ?? "").includes("3G8S")).length === 2);

/* And the dedupe that was MEANT to catch it, keyed on size as well as words. */
const key = (c) => `${c.box.w}x${c.box.h}:${(c.words ?? "").slice(0, 60)}`;
check("CANDIDATES' own same-words dedupe cannot fire, because its key carries the size",
  !!row && !!burn && key(row) !== key(burn), `${key(row)}  vs  ${key(burn)}`);

/* ------------------------------------------------------------------ */
/* 2. The split link, which is a THIRD thing again                     */
/* ------------------------------------------------------------------ */

/*
 * `n_prose_55` reads "Launch your first token on to see PnL tracking here" —
 * the words "pump.fun" gone from the middle — while `n_prose_56` is
 * "pump.fun" as its own node 703px right and 35px down. Nothing is
 * duplicated here; something is MISSING from one reading and present in
 * another, which is the opposite fault.
 *
 * Six markups put through the real reader. Only two produce his string, and
 * they are the two where the link is not being drawn AT THE MOMENT THE
 * SENTENCE IS READ: `display: none` and `visibility: hidden`. Inline, inline
 * block, absolutely positioned and `display: contents` all keep the words.
 *
 * So this is not a structural fault at all — it is the page being in a
 * different STATE for one read than for another, which is what a scroll
 * reveal or an animation does. It cannot be settled from here without his
 * page; what this records is which explanations are ruled OUT.
 */
const S = "Launch your first token on ", E = " to see PnL tracking here";
await page.setContent(`<!doctype html><html><body style="margin:0;font:16px system-ui">
  <p id="inline" style="width:600px">${S}<a href="/x">pump.fun</a>${E}</p>
  <p id="iblock" style="width:600px">${S}<a href="/x" style="display:inline-block">pump.fun</a>${E}</p>
  <p id="abs" style="width:600px;position:relative">${S}<a href="/x" style="position:absolute;left:700px;top:35px">pump.fun</a>${E}</p>
  <p id="contents" style="width:600px">${S}<a href="/x" style="display:contents">pump.fun</a>${E}</p>
  <p id="none" style="width:600px">${S}<a href="/x" style="display:none">pump.fun</a>${E}</p>
  <p id="hidden" style="width:600px">${S}<a href="/x" style="visibility:hidden">pump.fun</a>${E}</p>
</body></html>`);
await page.waitForTimeout(200);
const said = async (id) => ((await page.evaluate(MEASURE, `#${id}`))?.text ?? []).map((t) => t.words).join(" ").replace(/\s+/g, " ").trim();
const HIS = "Launch your first token on to see PnL tracking here";

check("an ordinary inline link keeps its words in the sentence", (await said("inline")).includes("pump.fun"));
check("…and so does an inline-block one", (await said("iblock")).includes("pump.fun"));
check("…and an absolutely positioned one, even parked 700px away", (await said("abs")).includes("pump.fun"));
check("…and `display: contents`", (await said("contents")).includes("pump.fun"));
check("a link that is NOT DRAWN when the sentence is read gives his string exactly",
  (await said("none")) === HIS, JSON.stringify(await said("none")));
check("…and so does a hidden one", (await said("hidden")) === HIS, JSON.stringify(await said("hidden")));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
