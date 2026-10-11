#!/usr/bin/env node
/**
 * AN ARROW PRESS SAVES THE DOCUMENT ONCE.
 *
 * The audit (2026-10-11): on the PST board each arrow-key nudge set the
 * board twice (the move, then marking the part as placed by hand), and each
 * set saved the whole 3 MB document: about 150 ms a press, so a held arrow
 * lurched and keys queued up. The nudge is one write now, and a document too
 * big to mirror even packed no longer packs on every save
 * (`tests/mirror-skips-pack.mjs`).
 *
 * Counted, not timed: `localStorage.setItem` for `builder.studio` is wrapped
 * before the page loads. On the saved PST board, a part picked and nudged
 * right once moves by 1, is marked as placed by hand, and the document is
 * written exactly once.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/nudge-saves-once.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx, src/features/studio/docStore.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => r.abort());
await page.addInitScript(() => {
  window.__writes = 0;
  const set = Storage.prototype.setItem;
  Storage.prototype.setItem = function (k, v) { if (this === window.localStorage && k === "builder.studio") window.__writes++; return set.call(this, k, v); };
});
await openBoard(page, URL_BASE, "pst");

/* A part in view, small enough to be a part of its own and not the page around it. */
const at = await page.evaluate(() => {
  const fits = [...document.querySelectorAll("[data-node-id]")].map((el) => ({ id: el.getAttribute("data-node-id"), r: el.getBoundingClientRect() }))
    .filter(({ r }) => r.width > 30 && r.height > 20 && r.width < 500 && r.left > 300 && r.top > 120 && r.right < 1100 && r.bottom < 800);
  const one = fits[0];
  return one ? { x: one.r.left + one.r.width / 2, y: one.r.top + one.r.height / 2 } : null;
});
check("a part is in view to pick", !!at);
if (at) {
  await page.mouse.click(at.x, at.y);
  await page.waitForTimeout(1200);
  const before = new Map((await page.evaluate(() => window.__studioNodes())).map((n) => [n.id, n]));
  await page.evaluate(() => { window.__writes = 0; });
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(400);
  const writes = await page.evaluate(() => window.__writes);
  const after = await page.evaluate(() => window.__studioNodes());
  const moved = after.filter((n) => before.get(n.id) && n.x !== before.get(n.id).x);
  check("the picked part moves right by 1", moved.length > 0 && moved.every((n) => n.x === before.get(n.id).x + 1 && n.y === before.get(n.id).y), `${moved.length} moved`);
  check("…and is marked as placed by hand", moved.length > 0 && moved.every((n) => n.byHand === true && !!n.handFrom), moved.map((n) => `${n.id} ${n.byHand}`).join(", "));
  check("the document is written once for the press", writes === 1, `${writes} writes (was two a press)`);
}
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? "FAILED" : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
