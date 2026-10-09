#!/usr/bin/env node
/**
 * A PART POINTED AT GLOWS IN ITS OWN SHAPE, AND IT COSTS NEXT TO NOTHING.
 *
 * J (2026-10-09): hovering a row in the Elements list or a swatch on the
 * Colours preview drew a grey square frame round each part on the board;
 * round buttons got square rings, and parts close together got frames on
 * top of each other. Now the part itself glows neon blue round what it
 * paints (`board/pointed.ts`, globals.css `[data-point-mark]`).
 *
 * On the saved PST board (tests/lib/board.mjs), with 40 parts pointed at:
 *   1. each of them glows, the glow is on the part itself (a drop-shadow on
 *      what it paints), and nothing new is added to the page (no frames, no
 *      copies);
 *   2. a rounded part's glow follows its corners: just past the corner of
 *      its box, on the diagonal, the board is as it was;
 *   3. while the hand rests nothing runs: no more frames are asked for than
 *      with nothing pointed at;
 *   4. pointing and letting go are quick, and letting go takes the glow off;
 *   5. hovering a row in the Elements list makes that part glow.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/point-glow.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/pointed.ts, src/features/studio/board/NodeView.tsx, src/features/studio/SiteColours.tsx, src/app/globals.css
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => r.abort());
await openBoard(page, URL_BASE, "pst");
await page.waitForTimeout(1500);

/* Frames asked for, counted from here on. */
await page.evaluate(() => {
  window.__frames = 0;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => { window.__frames++; return raf(cb); };
});
const point = (ids) => page.evaluate((ids) => window.dispatchEvent(new CustomEvent("studio:point-at", { detail: ids })), ids);
const framesOver = (ms) => page.evaluate(async (ms) => { const a = window.__frames; await new Promise((r) => setTimeout(r, ms)); return window.__frames - a; }, ms);

/* 40 drawn parts on the page, buttons first, close neighbours included. */
const ids = await page.evaluate(() => {
  const drawn = [...document.querySelectorAll("[data-studio-pane] [data-node-id]")].filter((el) => el.getClientRects().length && el.getBoundingClientRect().width > 0);
  const button = (el) => /button|btn|link|pill/i.test(`${(window.__studioNodes?.() ?? []).find((n) => n.id === el.dataset.nodeId)?.hooks?.["data-hook"] ?? ""} ${el.dataset.nodeId}`);
  return [...drawn.filter(button), ...drawn.filter((el) => !button(el))].slice(0, 40).map((el) => el.dataset.nodeId);
});
check("there are 40 parts on PST's board to point at", ids.length === 40, `${ids.length}`);

const idle0 = await framesOver(1000);
const before = await page.evaluate(() => document.getElementsByTagName("*").length);

/* 1. */
const t0 = Date.now();
await point(ids);
const took = await page.evaluate(() => new Promise((r) => { const t = performance.now(); requestAnimationFrame(() => requestAnimationFrame(() => r(performance.now() - t))); }));
const pointMs = Date.now() - t0;
await page.waitForTimeout(400);
const s = await page.evaluate((ids) => {
  const marks = [...document.querySelectorAll("[data-point-mark]")];
  const glow = (id) => getComputedStyle(document.querySelector(`[data-node-id="${CSS.escape(id)}"] > [data-part-drawn]`)).filter;
  return {
    marks: marks.length,
    onParts: marks.every((m) => m.hasAttribute("data-node-id")),
    glowing: ids.filter((id) => /drop-shadow/.test(glow(id)) && /0, 205, 255/.test(glow(id))).length,
    all: document.getElementsByTagName("*").length,
  };
}, ids);
check("1. all 40 glow", s.marks === 40 && s.glowing === 40, JSON.stringify({ marks: s.marks, glowing: s.glowing }));
check("…the glow is on each part itself, not a frame drawn over the board", s.onParts);
check("…and nothing was added to the page for it", s.all === before, `${before} elements before, ${s.all} with 40 glowing`);

/* 2. A rounded part, alone: the glow hugs its corner. */
const round = await page.evaluate((ids) => {
  const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
  const inView = (r) => r.left > pane.left + 40 && r.top > pane.top + 40 && r.right < pane.right - 40 && r.bottom < pane.bottom - 40;
  for (const id of ids) {
    const part = document.querySelector(`[data-node-id="${CSS.escape(id)}"] > [data-part-drawn]`);
    const painted = [part, ...part.querySelectorAll("*")].find((e) => parseFloat(getComputedStyle(e).borderTopLeftRadius) >= 12 && e.getBoundingClientRect().width > 60 && inView(e.getBoundingClientRect()));
    if (painted) { const r = painted.getBoundingClientRect(); return { id, x: r.left, y: r.top, w: r.width, h: r.height, rad: Math.min(parseFloat(getComputedStyle(painted).borderTopLeftRadius), r.width / 2, r.height / 2) }; }
  }
  return null;
}, ids);
if (round) {
  await point([round.id]);
  await page.waitForTimeout(400);
  const clip = { x: Math.round(round.x - 30), y: Math.round(round.y - 30), width: 60 + Math.ceil(round.rad) + 10, height: 60 };
  const lit = await page.screenshot({ clip });
  await point(null);
  await page.waitForTimeout(150);
  const bare = await page.screenshot({ clip });
  const px = await page.evaluate(async ({ a, b, rad }) => {
    const load = (b64) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = `data:image/png;base64,${b64}`; });
    const read = async (b64) => { const i = await load(b64); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d"); g.drawImage(i, 0, 0); return g; };
    const [ga, gb] = [await read(a), await read(b)];
    const diff = (x, y) => { const p = ga.getImageData(x, y, 1, 1).data, q = gb.getImageData(x, y, 1, 1).data; return Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]); };
    /* The box's corner is at (30,30). 3px out from its top edge the glow is
       3px from the part; 3px out from the corner on the diagonal, a frame
       would be just as lit, but the rounded part is much further away. */
    return { corner: diff(27, 27), edge: diff(Math.round(30 + rad + 6), 27) };
  }, { a: lit.toString("base64"), b: bare.toString("base64"), rad: round.rad });
  check("2. a rounded part's glow follows its corner, not a square round it", px.edge > 60 && px.corner < px.edge * 0.6, JSON.stringify({ ...px, radius: round.rad }));
} else check("2. a rounded part to look at", false, "none among the 40");

/* 3. */
await point(ids);
await page.waitForTimeout(400);
const idle40 = await framesOver(1000);
check("3. with 40 glowing and the hand still, no more frames are asked for than with none", idle40 <= idle0 + 2, `${idle0} frames a second idle, ${idle40} with 40 glowing`);

/* 4. */
await point(null);
await page.waitForTimeout(100);
const off = await page.evaluate(() => ({ marks: document.querySelectorAll("[data-point-mark]").length, lit: [...document.querySelectorAll("[data-part-drawn]")].filter((e) => /0, 205, 255/.test(getComputedStyle(e).filter)).length }));
check("4. pointing at 40 is quick", pointMs < 500 && took < 250, `${pointMs}ms to point, next frames in ${Math.round(took)}ms`);
check("…and letting go takes every glow off", off.marks === 0 && off.lit === 0, JSON.stringify(off));

/* 5. */
const side = page.locator("[data-side-panel]");
await side.getByRole("radio", { name: "Element" }).first().click({ force: true });
await page.waitForTimeout(700);
const row = side.locator('[data-element-list="flat"] [data-list-row]:not([data-list-after])').nth(2);
const rowId = await row.getAttribute("data-list-row").catch(() => null);
await row.hover().catch(() => {});
await page.waitForTimeout(400);
const glowsRow = rowId && await page.evaluate((id) => { const e = document.querySelector(`[data-point-mark="${CSS.escape(id)}"] > [data-part-drawn]`); return !!e && /drop-shadow/.test(getComputedStyle(e).filter); }, rowId);
check("5. hovering a row in the Elements list makes its part glow", glowsRow === true, `${rowId}`);

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
