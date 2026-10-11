#!/usr/bin/env node
/**
 * A HIDDEN BLOCK IS READ IN THE DISPLAY ITS OWN RULES GIVE IT, NOT AS A BLOCK (J, 2026-10-11).
 *
 * PST's scoreboard, chart TV, trade panel and replay are flex or grid and its
 * result stamps inline-grid, all hidden until a state class goes on. The read
 * showed each one as display:block, so the cells stacked in a column and the
 * stamps ran the whole line: every one in the wrong place when J switched the
 * state on. Each is now shown with the display its own rules say.
 *
 *   1. a grid hidden by a state rule keeps its two columns, 200px apart;
 *   2. a flex row hidden by a class keeps its gap;
 *   3. an inline-grid stamp is as wide as its words, not the line;
 *   4. a plain hidden div still reads as a block, a hidden row as a row;
 *   5. the page's own inline styles are put back as they were.
 *
 *   node tests/revealed-in-own-display.mjs
 *
 * Covers: src/features/studio/bring-in/siteread/parts.ts
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
/* Rules in a <style> block, so the read can see them (a file:// sheet it could not). */
await page.setContent(`<!doctype html><html><head><style>
  body { margin: 0; font: 16px sans-serif; }
  [data-hook=board] { display: grid; grid-template-columns: 200px 200px; }
  body:not(.live) [data-hook=board] { display: none; }
  .row { display: flex; gap: 10px; }
  .off { display: none; }
  .stamp { display: inline-grid; padding: 2px 6px; }
  body:not(.live) .stamp { display: none; }
</style></head><body>
  <h1 data-hook="title">Duel</h1>
  <section data-hook="board"><div data-hook="cell-a">Left cell</div><div data-hook="cell-b">Right cell</div></section>
  <div data-hook="bar" class="row off"><button data-hook="btn-a">Buy</button><button data-hook="btn-b">Sell</button></div>
  <p data-hook="line">Result <span data-hook="stamp" class="stamp">WIN</span> for you</p>
  <div data-hook="plain" hidden>A plain hidden block of words</div>
  <table data-hook="tbl"><tbody><tr data-hook="shown-row"><td>shown</td></tr><tr data-hook="trow" hidden><td data-hook="tcell">hidden row</td></tr></tbody></table>
</body></html>`);

const styles = () => page.evaluate(() => Array.from(document.querySelectorAll("*")).map((e) => `${e.tagName}:${e.getAttribute("style")}:${e.hasAttribute("hidden")}`).join("|"));
const before = await styles();
const read = await page.evaluate(PARTS, 500);
const after = await styles();

/* The page as it is with the state on: the real boxes the read should match. */
const real = await page.evaluate(() => {
  document.body.classList.add("live");
  document.querySelector("[data-hook=bar]").classList.remove("off");
  const r = (h) => { const b = document.querySelector(`[data-hook=${h}]`).getBoundingClientRect(); return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) }; };
  return { cellA: r("cell-a"), cellB: r("cell-b"), btnA: r("btn-a"), btnB: r("btn-b"), stamp: r("stamp") };
});
await browser.close();

const part = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);
const near = (a, b) => Math.abs(a - b) <= 1;

const a = part("cell-a")?.box, b = part("cell-b")?.box;
check("1. the grid's two cells share a line", !!a && !!b && near(a.y, b.y), J({ a, b }));
check("1. and sit 200px apart, as the page shows them", !!a && !!b && near(b.x - a.x, 200) && near(b.x - a.x, real.cellB.x - real.cellA.x), J({ a, b, real: [real.cellA, real.cellB] }));

const ba = part("btn-a")?.box, bb = part("btn-b")?.box;
check("2. the flex row's buttons share a line", !!ba && !!bb && near(ba.y, bb.y), J({ ba, bb }));
check("2. the second button sits where the page puts it, gap kept", !!bb && near(bb.x, real.btnB.x), J({ bb, real: real.btnB }));

const st = part("stamp")?.box;
check("3. the stamp is as wide as its own inline-grid box, not the line", !!st && near(st.w, real.stamp.w) && st.w < 200, J({ st, real: real.stamp }));

const plain = part("plain")?.box;
check("4. a plain hidden div still reads as a block, the full width", !!plain && near(plain.w, 800), J(plain));
const tcell = part("tcell")?.box ?? part("trow")?.box;
const shownRow = part("shown-row")?.box;
check("4. a hidden table row still reads, as a row of its table", !!tcell && tcell.w > 0 && tcell.h > 0 && (!shownRow || near(tcell.x, shownRow.x)), J({ tcell, shownRow }));

check("5. the page's inline styles and hidden flags are back as they were", before === after);

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
