#!/usr/bin/env node
/**
 * ON A SETTLED BOARD, PARTS FAR FROM THE VIEW ARE NOT DRAWN, AND NOTHING MOVES.
 *
 * Every part on sol face's board was drawn: 13,572 elements, most of them
 * screens below the view. Once the board has settled (`textFit.ts`: the last
 * settle had nothing to write, none is due, no import is tidying), a part
 * more than a view and a half away is left to the browser to skip
 * (`board/skipFar.ts`, `content-visibility: auto`) at the size it was drawn
 * at. Any settle or tidy draws everything again first.
 *
 *   1. soon after opening, far parts are undrawn: under 6,000 elements live;
 *   2. it moves nothing: over 10 s the document is the same, no part's box
 *      moves, and the board does not flip between drawn and undrawn;
 *   3. a drawn part stands exactly where it stands with everything drawn,
 *      and an undrawn one within 0.05 px of its drawn box;
 *   4. a drag asks for a settle: everything is drawn again before it reads,
 *      and far parts are left undrawn again once it has settled;
 *   5. scrolled to the foot, every part in view is drawn;
 *   6. twenty wheel steps restyle under 140,000 elements (172,000 before,
 *      measured on this board).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-skip-far.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/skipFar.ts, src/features/studio/textFit.ts, src/features/studio/board/DesktopCanvas.tsx
 */
import { heavyBoard } from "./lib/heavy.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const h = await heavyBoard(URL_BASE);
const { page } = h;
const pane = page.locator("[data-studio-pane]").first();
await page.evaluate(() => {
  window.__flips = [];
  new MutationObserver(() => { const n = document.querySelectorAll("[data-skip]").length; const last = window.__flips.at(-1); if (!last || (last.n > 0) !== (n > 0)) window.__flips.push({ t: Math.round(performance.now()), n }); }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-skip"] });
});
const live = () => page.evaluate(() => { let n = 0; const walk = (e) => { n++; if (e.hasAttribute?.("data-skip")) return; for (const c of e.children) walk(c); }; walk(document.documentElement); return { live: n, all: document.getElementsByTagName("*").length, skipped: document.querySelectorAll("[data-skip]").length }; });
const boxes = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-node-id]")].map((e) => { const r = e.getBoundingClientRect(); return [e.getAttribute("data-node-id"), { r: [r.left, r.top, r.width, r.height], skip: e.hasAttribute("data-skip") }]; })));
const doc = () => page.evaluate(() => JSON.stringify((window.__studioNodes?.() ?? []).map((n) => [n.id, n.x, n.y, n.w, n.h])));

/* 1. */
for (let i = 0; i < 60 && !(await page.evaluate(() => document.querySelectorAll("[data-skip]").length > 0)); i++) await page.waitForTimeout(250);
const l1 = await live();
check("1. soon after opening, far parts are left undrawn", l1.skipped > 0 && l1.live < 6000, `${l1.skipped} parts undrawn, ${l1.live} of ${l1.all} elements live`);

/* 2. */
const d0 = await doc(), b0 = await boxes();
const f0 = (await page.evaluate(() => window.__flips.length));
await page.waitForTimeout(10000);
const d1 = await doc(), b1 = await boxes();
const movedIdle = Object.keys(b0).filter((k) => b0[k].r.some((v, i) => v !== b1[k]?.r[i]));
const flips = (await page.evaluate(() => window.__flips.length)) - f0;
check("2. over 10 s the document is the same and no part's box moves", d0 === d1 && movedIdle.length === 0, `${movedIdle.length} moved${movedIdle.length ? `: ${movedIdle.slice(0, 3).join(" ")}` : ""}`);
check("…and it does not flip between drawn and undrawn", flips === 0, `${flips} flips`);

/* 3. Everything drawn by hand, and compared. */
const before = await boxes();
await page.evaluate(() => { for (const e of document.querySelectorAll("[data-skip]")) { e.style.removeProperty("content-visibility"); e.style.removeProperty("contain-intrinsic-size"); } });
await page.waitForTimeout(300);
const drawn = await boxes();
let drawnMoved = 0, worst = 0;
for (const [k, v] of Object.entries(before)) {
  const d = Math.max(...v.r.map((x, i) => Math.abs(x - drawn[k].r[i])));
  if (!v.skip && d > 0) drawnMoved++;
  if (v.skip) worst = Math.max(worst, d);
}
check("3. every drawn part stands exactly where it does with everything drawn", drawnMoved === 0, `${drawnMoved} differ`);
check("…and every undrawn one within 0.05 px of its drawn box", worst <= 0.05, `worst ${worst.toFixed(3)} px`);
/* Back to the board's own way: reopen leaves it to the hook. */
await page.reload({ waitUntil: "load" });
for (let i = 0; i < 60 && !(await page.evaluate(() => document.querySelectorAll("[data-skip]").length > 0)); i++) await page.waitForTimeout(250);

/* 4. */
await page.evaluate(() => {
  window.__flips = [];
  new MutationObserver(() => { const n = document.querySelectorAll("[data-skip]").length; const last = window.__flips.at(-1); if (!last || (last.n > 0) !== (n > 0)) window.__flips.push({ t: Math.round(performance.now()), n }); }).observe(document, { subtree: true, attributes: true, attributeFilter: ["data-skip"] });
});
const t = await h.grabbable();
await page.mouse.move(t.x, t.y);
await page.mouse.down();
for (let i = 1; i <= 8; i++) await page.mouse.move(t.x + i * 5, t.y);
await page.mouse.up();
let back = false;
for (let i = 0; i < 60 && !back; i++) { await page.waitForTimeout(250); back = await page.evaluate(() => window.__flips.some((f) => f.n === 0) && document.querySelectorAll("[data-skip]").length > 0); }
const seq = await page.evaluate(() => window.__flips.map((f) => f.n));
check("4. a drag draws everything again, then far parts are left undrawn once settled", back, `drawn/undrawn: ${seq.join(" → ")}`);
await page.keyboard.press("Control+z");
await page.waitForTimeout(1500);

/* 5. */
await pane.evaluate((el) => { el.scrollTop = el.scrollHeight; });
await page.waitForTimeout(1200);
const inView = await page.evaluate(() => { const v = document.querySelector("[data-studio-pane]").getBoundingClientRect(); return [...document.querySelectorAll("[data-node-id]")].filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > v.top && r.top < v.bottom && r.width > 0; }).map((e) => e.hasAttribute("data-skip")); });
check("5. at the foot, every part in view is drawn", inView.length > 0 && inView.every((s) => !s), `${inView.filter(Boolean).length} of ${inView.length} in view undrawn`);

/* 6. */
await pane.evaluate((el) => { el.scrollTop = 0; });
await page.mouse.move(700, 450);
await page.waitForTimeout(1200);
const { events } = await h.trace(async () => { for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 120); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); } });
const restyled = events.filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X").reduce((a, e) => a + (e.args?.elementCount ?? 0), 0);
check("6. twenty wheel steps restyle under 140,000 elements", restyled < 140000, `${restyled}`);
check("…and nothing threw", h.errors.length === 0, h.errors[0] ?? "");

await h.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
