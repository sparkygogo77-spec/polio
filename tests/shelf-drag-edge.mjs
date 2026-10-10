#!/usr/bin/env node
/**
 * A CARD CARRIED OFF THE SHELF LOWERS IT, AND EVERY DRAG SCROLLS AT THE EDGES.
 *
 * J (2026-10-10): "when dragging something from the shelf off the shelf
 * should drop back down and the site should scroll like when pressing down
 * a scroll wheel and you reach the edges to scroll up and down". On the
 * saved PST board, at 1440:
 *
 *   1. a Motion card lifted and carried up off the shelf lowers the shelf to
 *      its strip, and the board takes the room;
 *   2. held at the board's foot the page scrolls down, faster the further
 *      past the edge, and held at its head it scrolls up;
 *   3. let go, the shelf comes back up as it was, its category still open;
 *   4. a part moved, and the selection box drawn, scroll at the edges too,
 *      faster past the edge than inside it;
 *   5. the shelf's own lowering does not throw the page back to its top,
 *      and the carry selects no words (a part pressed after it would drag
 *      the words and the browser would cancel the move).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/shelf-drag-edge.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/cardCarry.ts, src/features/studio/board/edgeScroll.ts, src/features/studio/board/DesktopCanvas.tsx, src/features/studio/page/StudioPage.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());

const saved = readBoard("pst");
saved.local["builder.shelf.folded"] = "0";
await openBoard(ui, URL_BASE, saved);
const wait = (ms) => ui.waitForTimeout(ms);

const pane = () => ui.evaluate(() => {
  const p = document.querySelector("[data-studio-pane]");
  const b = p.getBoundingClientRect();
  return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, scroll: p.scrollTop, room: p.scrollHeight - p.clientHeight };
});
const setScroll = (y) => ui.evaluate((y) => { document.querySelector("[data-studio-pane]").scrollTop = y; }, y);
const band = () => ui.evaluate(() => {
  const b = document.querySelector("[data-studio-band]");
  return { lowered: b.hasAttribute("data-band-lowered"), h: Math.round(b.getBoundingClientRect().height) };
});
/** How far the pane scrolls in `ms` with the hand held still at y. */
const speedAt = async (x, y, ms = 500) => {
  await ui.mouse.move(x, y);
  await wait(150);
  const a = (await pane()).scroll;
  await wait(ms);
  return (await pane()).scroll - a;
};

/* 1. */
if (!(await ui.locator('[data-category-open="motion"]').count())) await ui.locator('[data-category="motion"]').first().click();
await wait(1000);
const up = await band();
/* A point that is a Motion card's own, inside the shelf's visible band (not under its sticky bar). */
const from = await ui.evaluate(() => {
  const shelf = document.querySelector("[data-shelf]");
  const first = shelf.querySelector("[data-shelf-card]");
  shelf.scrollTop += first.getBoundingClientRect().top - shelf.getBoundingClientRect().top - 40;
  const b = shelf.getBoundingClientRect();
  for (const c of document.querySelectorAll("[data-shelf-card]")) {
    const r = c.getBoundingClientRect();
    for (let y = Math.max(r.top, b.top) + 8; y < Math.min(r.bottom, b.bottom) - 4; y += 8) {
      const e = document.elementFromPoint(r.left + r.width / 2, y);
      if (e && c.contains(e) && !e.closest("[role=switch],a,input,label")) return { x: r.left + r.width / 2, y, card: c.getAttribute("data-shelf-card") };
    }
  }
  return null;
});
check("a Motion card is on the shelf to lift", !!from, from?.card);
/* Zoomed in, as he works close up, so the page has room to scroll both ways. */
for (let i = 0; i < 6 && (await pane()).room < 1500; i++) { await ui.locator('[aria-label="Zoom in"]').first().click({ force: true }); await wait(150); }
const p0 = await pane();
check("the page is long enough to scroll", p0.room > 600, `${Math.round(p0.room)}px of travel`);
const mid = Math.round(p0.room / 2);
await setScroll(mid);
await wait(200);
const x = (p0.left + p0.right) / 2;
await ui.mouse.move(from.x, from.y);
await ui.mouse.down();
for (let i = 1; i <= 12; i++) { await ui.mouse.move(from.x + ((x - from.x) * i) / 12, from.y + ((p0.top + 300 - from.y) * i) / 12); await wait(16); }
await wait(300);
const low = await band();
const p1 = await pane();
check("1. carried off the shelf, the shelf lowers to its strip", low.lowered && low.h <= 32 && up.h > 100, `band ${up.h}px -> ${low.h}px`);
check("…and the board takes the room", p1.bottom - p1.top > p0.bottom - p0.top + 60, `pane ${Math.round(p0.bottom - p0.top)} -> ${Math.round(p1.bottom - p1.top)} tall`);
/* The hand crosses the foot's band on its way up, which may scroll a little; a re-fit would throw it to 0. */
check("5. the shelf lowering leaves the page where it was", Math.abs(p1.scroll - mid) < 60, `scroll ${mid} -> ${Math.round(p1.scroll)}`);
check("…and the hand sweeping over the Builder selects no words", (await ui.evaluate(() => String(window.getSelection()).trim())) === "");

/* 2. */
const inBand = await speedAt(x, p1.bottom - 50);
const atEdge = await speedAt(x, p1.bottom - 2);
check("2. held near the foot, the page scrolls down", inBand > 5, `${Math.round(inBand)}px in 0.5s`);
check("…faster the nearer the edge, like a middle-click scroll", atEdge > inBand * 1.5, `${Math.round(inBand)} -> ${Math.round(atEdge)}px in 0.5s`);
await setScroll(mid);
const upward = await speedAt(x, p1.top + 6);
check("…and held at the head it scrolls up", upward < -10, `${Math.round(upward)}px in 0.5s`);

/* 3. Let go over the top bar: nothing there takes it, so it flies back. */
await ui.mouse.move(x, Math.max(4, p1.top - 20));
await ui.mouse.up();
await wait(700);
const back = await band();
check("3. let go, the shelf comes back up as it was", !back.lowered && Math.abs(back.h - up.h) <= 1, `${back.h}px, was ${up.h}px`);
check("…with Motion still open", (await ui.locator('[data-category-open="motion"]').count()) > 0);
check("…and the carried card is gone", (await ui.locator("[data-card-carried]").count()) === 0);

/* 4. A part moved to the edge, and the selection box. */
const p2 = await pane();
await setScroll(mid);
await wait(200);
const part = await ui.evaluate((pn) => {
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const r = el.getBoundingClientRect();
    if (r.width < 40 || r.width > 500 || r.height < 20 || r.top < pn.top + 120 || r.bottom > pn.bottom - 120) continue;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    if (document.elementFromPoint(cx, cy)?.closest("[data-node-id]") !== el) continue;
    return { x: cx, y: cy, id: el.getAttribute("data-node-id") };
  }
  return null;
}, p2);
check("a part is in view to move", !!part, JSON.stringify(part));
if (part) {
  await ui.mouse.move(part.x, part.y);
  await ui.mouse.down();
  for (let i = 1; i <= 10; i++) { await ui.mouse.move(part.x, part.y + ((p2.bottom - 40 - part.y) * i) / 10); await wait(16); }
  const inside = await speedAt(part.x, p2.bottom - 40);
  const past = await speedAt(part.x, p2.bottom + 100);
  await setScroll(mid);
  const head = await speedAt(part.x, p2.top + 8);
  await ui.mouse.up();
  await wait(300);
  await ui.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z");
  check("4. a part held near the foot scrolls the page down", inside > 5, `${Math.round(inside)}px in 0.5s`);
  check("…faster with the hand past the edge", past > inside * 1.5, `${Math.round(inside)} -> ${Math.round(past)}px in 0.5s`);
  check("…and up at the head", head < -10, `${Math.round(head)}px in 0.5s`);
}

/* The selection box: Ctrl drag across a section (a part that holds others), the way he draws it over a full page. */
await setScroll(mid);
await wait(200);
const across = await ui.evaluate((pn) => {
  for (let y = pn.top + 40; y < pn.bottom - 150; y += 10) for (let x = pn.left + 60; x < pn.right - 60; x += 20) {
    const id = document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? "";
    if (/_section_/.test(id)) return { x, y, id };
  }
  return null;
}, p2);
check("there is a section to draw the box across", !!across, JSON.stringify(across));
if (across) {
  await ui.keyboard.down("Control");
  await ui.mouse.move(across.x, across.y);
  await ui.mouse.down();
  for (let i = 1; i <= 8; i++) { await ui.mouse.move(across.x + 10 * i, across.y + ((p2.bottom + 60 - across.y) * i) / 8); await wait(16); }
  const boxDown = await speedAt(across.x + 80, p2.bottom + 60);
  const drawn = await ui.locator("[data-marquee]").count();
  await ui.mouse.up();
  await ui.keyboard.up("Control");
  check("…and so does the selection box", boxDown > 20 && drawn > 0, `${Math.round(boxDown)}px in 0.5s${drawn ? "" : " (no box drawn)"}`);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
