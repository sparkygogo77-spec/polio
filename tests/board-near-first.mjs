#!/usr/bin/env node
/**
 * A BIG BOARD DRAWS WHAT IS IN VIEW FIRST, AND MOVES NOTHING FOR IT.
 *
 * Sol face's board (800 parts) waited on React drawing every part, and on
 * the words' measuring pass over all of them, before its first frame. Now
 * the first frame holds the parts near the view and the rest are drawn the
 * frame after (`board/drawNear.ts`); the settle waits for all of them.
 *
 *   1. the first frame draws every part in view and none that stands more
 *      than two views below it (sol face: 225 of 800 drawn first);
 *   2. every part is drawn within ten seconds;
 *   3. a board opened once and left to settle, opened again, moves nothing:
 *      the store's x, y, w, h are as it was left, and no part's drawn box
 *      changes from the moment all are drawn to the end;
 *   4. (printed) a hash of where the first opening settled every part, the
 *      same on a base server as here.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-near-first.mjs http://127.0.0.1:3013 [board]   # default solface
 *
 * Covers: src/features/studio/board/drawNear.ts, src/features/studio/board/DesktopCanvas.tsx, src/features/studio/textFit.ts
 */
import { chromium } from "playwright-core";
import { readBoard, seedBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const NAME = process.argv[3] ?? "solface";
const board = readBoard(NAME);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto(`${URL_BASE}/api/version`, { waitUntil: "load" });
await seedBoard(page, board);
/* The parts in the first frame: the ids in the page the first time any part is. */
await page.addInitScript(() => {
  window.__first = null;
  new MutationObserver(() => {
    if (window.__first) return;
    const els = document.querySelectorAll("[data-node-id]");
    if (els.length) window.__first = [...els].map((e) => e.getAttribute("data-node-id"));
  }).observe(document, { childList: true, subtree: true });
});

const geometry = () => page.evaluate(() => {
  const nodes = window.__studioNodes?.() ?? [];
  return nodes.map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`).sort().join("|");
});
const boxes = () => page.evaluate(() => {
  const board = document.querySelector("[data-board-zoom]")?.getBoundingClientRect();
  const out = {};
  for (const el of document.querySelectorAll("[data-node-id]")) { const r = el.getBoundingClientRect(); out[el.getAttribute("data-node-id")] = [r.left - (board?.left ?? 0), r.top - (board?.top ?? 0), r.width, r.height].map((v) => Math.round(v * 100) / 100).join(","); }
  return out;
});
const drawnCount = () => page.evaluate(() => document.querySelectorAll("[data-node-id]").length);

/* Open, wait for every part to be drawn (the count stops growing), then for the store to settle (unchanged for three seconds). */
async function open() {
  await page.goto(`${URL_BASE}/builder`, { waitUntil: "commit" });
  let all = 0, t0 = Date.now(), last = -1, still = 0;
  while (Date.now() - t0 < 30_000) {
    all = await drawnCount();
    if (all > 0 && all === last) still++; else still = 0;
    last = all;
    if (all > 0 && still >= 4) break;
    await page.waitForTimeout(250);
  }
  const drawnAfter = Date.now() - t0;
  const first = await page.evaluate(() => window.__first ?? []);
  const atAll = await boxes();
  let g = await geometry(), same = 0;
  for (let i = 0; i < 120 && same < 12; i++) { await page.waitForTimeout(250); const now = await geometry(); same = now === g ? same + 1 : 0; g = now; }
  /* What the board saved as it settled has reached the browser's storage. */
  await page.waitForTimeout(1500);
  return { all, drawnAfter, first, atAll, g, atEnd: await boxes() };
}
const once = await open();
const { createHash } = await import("node:crypto");
console.log(`  first opening settled to ${createHash("sha1").update(once.g).digest("hex").slice(0, 12)} (${once.g.split("|").length} parts)`);
const { all, drawnAfter, first, atAll, g, atEnd } = await open();
/* Where each part stands against the view, read at the top, where the board opens. */
const { inView, far } = await page.evaluate(() => {
  const pane = document.querySelector("[data-studio-pane]");
  if (pane) pane.scrollTop = 0;
  const p = pane?.getBoundingClientRect();
  const els = [...document.querySelectorAll("[data-node-id]")].map((el) => ({ id: el.getAttribute("data-node-id"), r: el.getBoundingClientRect() }));
  return {
    inView: els.filter(({ r }) => p && r.bottom > p.top && r.top < p.bottom && r.width > 0).map((e) => e.id),
    far: els.filter(({ r }) => p && r.top > p.bottom + 2 * p.height).map((e) => e.id),
  };
});

const farFirst = far.filter((id) => first.includes(id));
check("the first frame draws no part more than two views below the view", first.length > 0 && farFirst.length === 0, `${first.length} of ${all} drawn first; ${far.length} far${farFirst.length ? `, ${farFirst.length} of them drawn first` : ""}`);
const missing = inView.filter((id) => !first.includes(id));
check("every part in view is in the first frame", inView.length > 0 && missing.length === 0, `${inView.length} in view${missing.length ? `, missing ${missing.slice(0, 3).join(", ")}` : ""}`);
check("every part is drawn within ten seconds", all > 0 && drawnAfter < 10_000, `${all} parts in ${(drawnAfter / 1000).toFixed(1)} s`);
const left = new Set(once.g.split("|"));
const moved = g.split("|").filter((x) => !left.has(x));
check("the settled board, opened again, moves no part in the store", moved.length === 0, moved.length ? `${moved.length} moved, e.g. ${moved[0]}` : `${left.size} parts as left`);
const shifted = Object.keys(atAll).filter((id) => atEnd[id] !== atAll[id]);
check("no drawn box changed from all drawn to settled", shifted.length === 0, shifted.length ? `${shifted.length}, e.g. ${shifted[0]} ${atAll[shifted[0]]} → ${atEnd[shifted[0]]}` : `${Object.keys(atAll).length} boxes`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
