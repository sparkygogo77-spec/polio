/**
 * A WHEEL INSIDE AN OPEN CATEGORY SCROLLS IT.
 *
 * The owner's report on trunk 229677c: an open category could not be
 * scrolled. The wheel over the shelf first grows the shelf, up to a third
 * of the canvas, and then scrolls the cards; but it measured the card list,
 * which sits under the search row and is always shorter than the band, so
 * every notch was read as a resize that changed nothing, and every wheel
 * came back `defaultPrevented`. Held here, with real wheel notches:
 *
 *   · wheeling down over a card in an open category moves the list;
 *   · the wheel is never swallowed once the shelf is at its cap;
 *   · the side panel's own scroller still scrolls under the wheel;
 *   · the board still takes a horizontal wheel as a pan (its one gesture).
 *
 *   npx next start -p 3013
 *   node tests/shelf-wheel.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
mkdirSync(".screenshots", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(() => { if (!sessionStorage.getItem("seeded")) { localStorage.removeItem("builder.shelf.folded"); sessionStorage.setItem("seeded", "1"); } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-planets] [data-category]", { timeout: 20000 });
await page.waitForTimeout(1200);

/* Open the category with the most in it. */
const cats = await page.locator("[data-planets] [data-category]").evaluateAll((els) => els.map((e) => e.getAttribute("data-category")).filter((c) => c && c !== "custom-idea"));
let opened = null;
for (const c of cats) {
  await page.locator(`[data-planets] [data-category="${c}"]`).click();
  await page.waitForTimeout(500);
  const tall = await page.evaluate(() => { const s = document.querySelector("[data-shelf]"); return s ? s.scrollHeight - s.clientHeight : 0; });
  if (tall > 200) { opened = c; break; }
}
check("an open category holds more than its box shows", !!opened, opened ?? "none long enough");

const list = () => page.evaluate(() => { const s = document.querySelector("[data-shelf]"); return { top: Math.round(s.scrollTop), h: s.clientHeight, sh: s.scrollHeight }; });
/* Aim at a card inside the open category, as a person would. */
const target = await page.evaluate(() => {
  const sec = document.querySelector("[data-category-open]");
  const shelf = document.querySelector("[data-shelf]").getBoundingClientRect();
  const el = [...(sec?.querySelectorAll("*") ?? [])].find((e) => { const r = e.getBoundingClientRect(); return r.width > 60 && r.height > 40 && r.top > shelf.top + 40 && r.bottom < shelf.bottom; });
  const r = (el ?? sec).getBoundingClientRect();
  return { x: r.left + Math.min(r.width / 2, 200), y: r.top + Math.min(r.height / 2, 40) };
});
await page.mouse.move(target.x, target.y);
const before = await list();
/* Is the wheel handed to the list, or swallowed? */
const swallowed = await page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y);
  const ev = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: x, clientY: y });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}, target);
for (let i = 0; i < 8; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(90); }
await page.waitForTimeout(400);
const after = await list();
check("wheeling down over a card scrolls the open category", after.top > before.top + 100, `${before.top} -> ${after.top} of ${after.sh - after.h}`);
const band = await page.evaluate(() => Math.round(document.querySelector("[data-studio-band]").getBoundingClientRect().height));
/* The canvas: the board and the shelf under it (the shelf is the pane's sibling). */
const pane = await page.evaluate(() => document.querySelector("[data-studio-pane]").parentElement.clientHeight);
check("…while the shelf stays at no more than a third of the canvas", band <= Math.round(pane * 0.36), `${band} of ${pane}`);
await page.waitForTimeout(400);
const swallowedAtCap = await page.evaluate(({ x, y }) => {
  const el = document.elementFromPoint(x, y);
  const ev = new WheelEvent("wheel", { deltaY: 100, bubbles: true, cancelable: true, clientX: x, clientY: y });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}, target);
check("at its cap, a wheel over the cards is never swallowed", swallowedAtCap === false, `first notch ${swallowed}, at the cap ${swallowedAtCap}`);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -120); await page.waitForTimeout(90); }
await page.waitForTimeout(400);
check("…and wheeling up scrolls it back", (await list()).top < after.top, `${after.top} -> ${(await list()).top}`);
await page.screenshot({ path: ".screenshots/shelf-wheel.png" });

/* The side panel's scroller: whichever is scrollable, it moves under the wheel. */
const side = await page.evaluate(() => {
  const root = document.querySelector("[data-side-panel]");
  const sc = root && [...root.querySelectorAll("*")].find((e) => { const c = getComputedStyle(e); return /(auto|scroll)/.test(c.overflowY) && e.scrollHeight > e.clientHeight + 40; });
  if (!sc) return null;
  sc.setAttribute("data-test-scroller", "");
  const r = sc.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + Math.min(r.height / 2, 120) };
});
if (side) {
  await page.mouse.move(side.x, side.y);
  const t0 = await page.evaluate(() => document.querySelector("[data-test-scroller]").scrollTop);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(80); }
  await page.waitForTimeout(300);
  const t1 = await page.evaluate(() => document.querySelector("[data-test-scroller]").scrollTop);
  check("the side panel scrolls under the wheel", t1 > t0, `${t0} -> ${t1}`);
} else check("the side panel scrolls under the wheel", true, "nothing in it long enough to scroll on an empty board");

/* The bare board still pans across with a sideways wheel. */
const frame = await page.locator("[data-frame]").boundingBox();
const panBefore = await page.evaluate(() => document.querySelector("[data-page-window]").getBoundingClientRect().left);
await page.mouse.move(frame.x + 40, frame.y + 60);
await page.mouse.wheel(120, 0);
await page.waitForTimeout(300);
const panAfter = await page.evaluate(() => document.querySelector("[data-page-window]").getBoundingClientRect().left);
check("a sideways wheel over the board still pans it", panAfter !== panBefore, `${panBefore} -> ${panAfter}`);

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
