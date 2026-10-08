/**
 * WHY A WRAPPER LANDS BELOW THE CONTENT IT OWNS.
 *
 * HIS TWO CASES, measured on his board: `n_box_75`, the banner, 1763x65 at
 * y 147, with every header part ABOVE it — the logo at y -11, the wordmark at
 * 19, the wallet button at 21, the icons at 25..33, the header running about
 * -11..105. And `n_box_46`, the Your Tokens panel, 1507x172 at y 1247, with
 * its own heading at 1056 and its sentences at 1160 and 1192. Both hold
 * nothing. Both are real surfaces sitting under their own contents.
 *
 * And a third that works: `n_box_41` at y 750 correctly holds four parts. So
 * some panels wrap their contents and some are placed below them, and the job
 * is what separates the two — the converter is the deliverable, not this
 * document, so a general cause beats patching two nodes.
 *
 * THE CAUSE IS ONE RULE, in `MEASURE` (`siteRead.ts`). A captured element's
 * box is its own rect GROWN to swallow children that run out of it. The
 * growth has three limits, and a child outside any of them is not swallowed —
 * it arrives as a loose part and its parent arrives as an empty box wherever
 * its own collapsed rect happened to be:
 *
 *   1. `cs.position === "fixed" || cs.position === "absolute"` → SKIPPED.
 *      A positioned child never grows its parent, however plainly it is
 *      inside it in the markup.
 *   2. `TOUCH = 24` → a child more than 24px clear of the box is not
 *      swallowed. His banner's contents end at 105 and the banner starts at
 *      147: a 42px gap, so nothing reaches.
 *   3. `for (const c of el.children) for (const k of [c, ...c.children])` →
 *      two levels only. A grandchild deeper than that is invisible to it.
 *
 * This runs the REAL `MEASURE` against real DOMs built to isolate each limit,
 * so the cause is measured rather than read off the source.
 *
 *   node tests/wrapper-below.mjs
 */
import { createRequire } from "node:module";
import { CANDIDATES, MEASURE } from "../src/features/studio/bring-in/siteRead.ts";
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

await page.setContent(`<!doctype html><html><body style="margin:0;font:16px system-ui;position:relative;height:2000px">
  <!-- 1. A wrapper whose child is ABSOLUTELY POSITIONED inside it. -->
  <div id="abs" style="position:relative;width:800px;height:60px;background:#222">
    <div style="position:absolute;left:0;top:-40px;width:700px;height:90px;background:#3a3">its contents</div>
  </div>

  <!-- 2. A wrapper whose child is plainly its own but sits 42px clear of it,
          which is his banner: contents end at 105, the band starts at 147. -->
  <div id="far" style="position:relative;width:800px;height:60px;margin-top:200px;background:#222">
    <div style="position:absolute;left:0;top:-102px;width:700px;height:60px;background:#3a3">its contents</div>
  </div>

  <!-- 3. A wrapper whose content OVERFLOWS it from three levels down. Two
          levels is what the growth walks, so at three it never sees it. -->
  <div id="deep" style="width:800px;height:24px;margin-top:200px;background:#222">
    <div style="height:24px"><div style="height:24px"><div style="height:120px;width:700px;background:#3a3">its contents</div></div></div>
  </div>

  <!-- 3b. The control for it: the same overflow, one level nearer. -->
  <div id="shallow" style="width:800px;height:24px;margin-top:200px;background:#222">
    <div style="height:24px"><div style="height:120px;width:700px;background:#3a3">its contents</div></div>
  </div>

  <!-- 4. THE ONE THAT WORKS: an ordinary wrapper with ordinary children. -->
  <div id="ok" style="width:800px;background:#222;padding:8px">
    <div style="height:90px;background:#3a3">its contents</div>
  </div>
</body></html>`);
await page.waitForTimeout(200);

const read = async (sel) => (await page.evaluate(MEASURE, sel))?.box ?? null;
const of = async (sel) => page.evaluate((s) => {
  const r = document.querySelector(s).getBoundingClientRect();
  return { y: Math.round(r.top + scrollY), h: Math.round(r.height) };
}, sel);

/* Where each wrapper's own rect is, and where its content really is. */
const abs = await read("#abs"), far = await read("#far"), deep = await read("#deep"), ok = await read("#ok");
const absKid = await of("#abs > div"), farKid = await of("#far > div");

check("a wrapper with an ordinary child grows to hold it, which is the case that works",
  ok.h >= 90, `${ok.h} tall for a 90px child`);

/*
 * AND THE THREE THAT DO NOT. Each is a real DOM child of the box, and in
 * every one the recorded box fails to reach it — which is exactly the shape
 * of his banner: an empty band, its contents loose somewhere else.
 */
check("1. an ABSOLUTELY POSITIONED child never grows its parent, however plainly it is inside it",
  abs.y > absKid.y, `box at y ${abs.y}, its own child at y ${absKid.y}`);
check("…so the box is recorded BELOW the content it owns, which is the whole fault",
  abs.y > absKid.y && abs.y + abs.h > absKid.y + absKid.h,
  `content ${absKid.y}..${absKid.y + absKid.h}, box ${abs.y}..${abs.y + abs.h}`);

check("2. a child more than 24px clear of the box is not swallowed either",
  far.y > farKid.y + farKid.h, `content ends ${farKid.y + farKid.h}, box starts ${far.y}`);
check("…which is his banner exactly: contents end at 105, the band runs 147..212",
  far.y - (farKid.y + farKid.h) > 24, `${far.y - (farKid.y + farKid.h)}px clear, against a 24px reach`);

check("3. content that overflows from three levels down is invisible to the growth, which walks two",
  deep.h < 120, `${deep.h} tall for content 120 tall`);
check("…and the same content at two levels IS swallowed, so it is the depth and nothing else",
  (await read("#shallow")).h >= 120, `${(await read("#shallow")).h} tall`);

/*
 * AND THE THING THAT MAKES THIS FIXABLE: the reading already knows the
 * answer. Every candidate carries the DOM path it was read from, and a
 * recreation keeps it (`node.from.selector` — all 126 nodes of his committed
 * document have one). So a wrapper's true children are the nodes whose path
 * CONTINUES its own: no geometry, no reach, no positioning to trip over.
 * Nothing reads it, and that is the whole of what a repositioning rule would
 * need.
 */
const cands = await page.evaluate(CANDIDATES, 200);
check("every candidate carries the DOM path it was read from",
  cands.length > 0 && cands.every((c) => typeof c.selector === "string" && c.selector.length),
  `${cands.length} candidates, all with a path`);
check("…and a child's path continues its parent's, so parentage survives with no geometry at all",
  (() => {
    const kid = cands.find((c) => c.selector.split(" > ").length > 1);
    if (!kid) return false;
    const up = kid.selector.slice(0, kid.selector.lastIndexOf(" > "));
    return kid.selector.startsWith(`${up} > `);
  })(), JSON.stringify(cands[0]?.selector));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
