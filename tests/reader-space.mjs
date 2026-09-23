/**
 * The space that separated two runs survives the reading.
 *
 * HIS HEADER reads "A SolWorks project" — "SolWorks" is the name, so one
 * boundary takes a space and the other does not. Both are letter against
 * letter, and the boxes butt, because the space lives INSIDE a text node
 * rather than between two boxes. So nothing downstream can tell those two
 * boundaries apart: not the words, not the geometry. Only the page knows,
 * and the reader was throwing it away — `raw.replace(/\s+/g," ").trim()`.
 *
 * This runs the real reader (`MEASURE`, the same function the element route
 * hands to a browser) over a real DOM, so the fix is measured rather than
 * reasoned about.
 *
 *   node tests/reader-space.mjs
 */
import { createRequire } from "node:module";
import { MEASURE } from "../src/features/studio/siteRead.ts";
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
const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });

/*
 * HIS ACTUAL CASE: the fragments are separate ELEMENTS, each read by its own
 * MEASURE call, and the space between them lives inside one of their text
 * nodes. That is the path that pushes a NEW run — the one the fix changed.
 *
 * The first version of this test used inline spans in ONE block, where the
 * reader's older glue logic already joined them correctly. It passed with
 * the fix reverted, which made it worthless. Separate elements are the case.
 */
await page.setContent(`<!doctype html><html><body style="margin:0;font:16px system-ui">
  <div style="padding:8px"><span id="a">A Sol</span><span id="b" style="color:#22c55e">Works</span><span id="c"> project</span></div>
  <div style="padding:8px"><b id="d">$118.35</b><span id="e"> </span><span id="f" style="color:#ef4444">-0.46%</span></div>
  <div style="padding:8px"><span id="g1">Sold out </span><span id="g2">today</span></div>
  <div style="padding:8px"><span id="j1">Price</span> <span id="j2">rose</span></div>
  <h1 id="k" style="margin:0;padding:8px">
    Everything arrives somewhere
  </h1>
  <div style="padding:8px"><span id="m1">right</span> <span id="m2">now</span></div>
</body></html>`);
await page.waitForTimeout(200);

const read = async (sel) => (await page.evaluate(MEASURE, sel))?.text?.map((t) => t.words) ?? [];
const a = await read("#a"), b = await read("#b"), c = await read("#c");
const d = await read("#d"), f = await read("#f");
const g1 = await read("#g1"), g2 = await read("#g2");
const j1 = await read("#j1"), j2 = await read("#j2");
const k = await read("#k"), m = await read("#m1").then(async (x) => [x, await read("#m2")]);

check("each fragment is read on its own", a.length === 1 && b.length === 1 && c.length === 1, JSON.stringify([a, b, c]));
check("the brand's two halves carry NO space, because the page had none",
  a[0] === "A Sol" && b[0] === "Works", JSON.stringify([a[0], b[0]]));
check("and the run after it KEEPS its leading space, which is the whole fix",
  c[0] === " project", JSON.stringify(c[0]));
check("so the three rejoin exactly as his site reads them",
  `${a[0]}${b[0]}${c[0]}` === "A SolWorks project", JSON.stringify(`${a[0]}${b[0]}${c[0]}`));
check("the price line's figure keeps its edges clean and the fall carries the space between them",
  d[0] === "$118.35" && f[0] === " -0.46%", JSON.stringify([d[0], f[0]]));
check("…so it too rejoins as the page reads it", `${d[0]}${f[0]}` === "$118.35 -0.46%", JSON.stringify(`${d[0]}${f[0]}`));
check("and nothing anywhere doubled a space", !/  /.test(`${a[0]}${b[0]}${c[0]}${d[0]}${f[0]}`));

/*
 * THE SPACE GOES TO THE RUN AFTER IT, NEVER TO THE ONE BEFORE, so it is
 * written down exactly once and two fragments cannot each claim it. Here the
 * whitespace sits at the END of the first element's text, and the reading
 * still puts it on the second — because that is the only arrangement in
 * which rejoining gives back one space rather than two.
 */
check("a space at the end of one fragment is carried by the fragment after it",
  g1[0] === "Sold out" && g2[0] === " today", JSON.stringify([g1[0], g2[0]]));
check("…so that pair rejoins with exactly one space", `${g1[0]}${g2[0]}` === "Sold out today", JSON.stringify(`${g1[0]}${g2[0]}`));

/*
 * AND A SPACE THAT BELONGS TO NEITHER FRAGMENT, living in a text node of its
 * own between them. Reading either element alone cannot see it, so the
 * reader asks the LINE rather than the element — which is the whole reason
 * the question is not answered from inside the reading.
 */
check("a space living between two fragments is found by asking the line, not the fragment",
  j1[0] === "Price" && j2[0] === " rose", JSON.stringify([j1[0], j2[0]]));
check("…and that pair rejoins with exactly one space too", `${j1[0]}${j2[0]}` === "Price rose", JSON.stringify(`${j1[0]}${j2[0]}`));

/*
 * WHAT MUST NOT GAIN A SPACE. A headline indented in the markup has
 * whitespace at both ends of its text node and the browser draws none of it,
 * because whitespace at the edge of a line is collapsed away. A reader that
 * kept edges blindly would put a space in front of every heading on every
 * hand-written page on the web.
 */
check("a headline indented in the markup gains nothing at either end",
  k.length === 1 && k[0] === "Everything arrives somewhere", JSON.stringify(k));
check("…and the first fragment on a line never gains one either",
  m[0][0] === "right" && m[1][0] === " now", JSON.stringify([m[0][0], m[1][0]]));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
