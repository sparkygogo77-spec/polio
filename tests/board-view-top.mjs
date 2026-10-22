#!/usr/bin/env node
/**
 * SCROLLING THE BOARD RESTYLES WHAT RIDES THE VIEW, NOT THE WHOLE BOARD.
 *
 * A part the page pins to the window (`position: fixed` or `sticky`) and a
 * pinned ground layer ride down the board as it scrolls, on `--view-top`
 * and `--view-h` (`themeDraw.tsx#useViewTop`). Those were written on the
 * board's own element, and a custom property is inherited by everything
 * inside: every scroll frame restyled the whole board. On sol face's board,
 * twenty wheel steps restyled 172,000 elements; with the two held still,
 * 18,000. They are written now on the elements that read them.
 *
 *   1. the board's element carries neither; every element whose own style
 *      reads them carries both, and nothing else does;
 *   2. at the top, a third, two thirds and the foot, every part stands
 *      exactly where it stands with them written on the board as before;
 *   3. twenty wheel steps restyle under 40,000 elements.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-view-top.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/themeDraw.tsx, src/features/studio/board/DesktopCanvas.tsx
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
await page.mouse.move(2, 798);

/* 1. */
const where = await page.evaluate(() => {
  const carriers = [...document.querySelectorAll("*")].filter((e) => e.style?.getPropertyValue("--view-top"));
  const readers = [...document.querySelectorAll("[style]")].filter((e) => /var\(--view-(top|h)/.test(e.getAttribute("style") ?? ""));
  return { carriers: carriers.length, readers: readers.length, readersCarry: readers.filter((e) => e.style.getPropertyValue("--view-top")).length, boardCarries: carriers.some((e) => e.querySelector("[data-node-id]")) };
});
check("1. the board's element carries no --view-top; each reader carries its own", where.readers > 0 && !where.boardCarries && where.readersCarry === where.readers && where.carriers === where.readers, JSON.stringify(where));

/* 2. The same page, the variables written the old way for a moment, compared. */
const boxes = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].map((e) => { const r = e.getBoundingClientRect(); return `${e.getAttribute("data-node-id")}:${r.left},${r.top},${r.width},${r.height}`; }).join("|"));
let alike = 0;
const differ = [];
for (const f of [0, 1 / 3, 2 / 3, 1]) {
  await pane.evaluate((el, f) => { el.scrollTop = Math.round((el.scrollHeight - el.clientHeight) * f); }, f);
  await page.waitForTimeout(500);
  const now = await boxes();
  const old = await page.evaluate(() => {
    const readers = [...document.querySelectorAll("[style]")].filter((e) => e.style.getPropertyValue("--view-top"));
    const top = readers[0]?.style.getPropertyValue("--view-top"), hh = readers[0]?.style.getPropertyValue("--view-h");
    const board = document.querySelector("[data-node-id]")?.closest("[data-board-zoom]") ?? document.querySelector("[data-board-zoom]");
    for (const r of readers) { r.style.removeProperty("--view-top"); r.style.removeProperty("--view-h"); }
    board.style.setProperty("--view-top", top); board.style.setProperty("--view-h", hh);
    const out = [...document.querySelectorAll("[data-node-id]")].map((e) => { const r = e.getBoundingClientRect(); return `${e.getAttribute("data-node-id")}:${r.left},${r.top},${r.width},${r.height}`; }).join("|");
    board.style.removeProperty("--view-top"); board.style.removeProperty("--view-h");
    for (const r of readers) { r.style.setProperty("--view-top", top); r.style.setProperty("--view-h", hh); }
    return out;
  });
  if (now === old) alike++; else differ.push(f.toFixed(2));
}
check("2. at four scroll places every part stands where it does with the variables on the board", alike === 4, `${alike} of 4 alike${differ.length ? `; differ at ${differ.join(" ")}` : ""}`);

/* 3. */
await pane.evaluate((el) => { el.scrollTop = 0; });
await page.mouse.move(700, 450);
await page.waitForTimeout(1200);
const { events } = await h.trace(async () => { for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 120); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); } });
const restyled = events.filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X").reduce((a, e) => a + (e.args?.elementCount ?? 0), 0);
check("3. twenty wheel steps restyle under 40,000 elements", restyled < 40000, `${restyled}`);
check("…and nothing threw", h.errors.length === 0, h.errors[0] ?? "");

await h.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
