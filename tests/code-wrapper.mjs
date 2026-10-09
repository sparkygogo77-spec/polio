#!/usr/bin/env node
/**
 * THE SITE'S OWN WRAPPER IS THE CODE'S, NOT THE BOARD'S.
 *
 * J (2026-10-09): PonsStars sits inside one "app" box that its code made.
 * On the board it could be picked and edited (place, size, look) and its
 * Words box showed the chart's help text. It "should be in the backend and
 * not for me to mess with"; to move everything he selects everything.
 *
 *   1. the app box lets a press through: a press on bare page inside it
 *      picks nothing, never the app box;
 *   2. a box that only holds words (the wallet panel) shows no other
 *      part's words in its Words box;
 *   3. Select everything takes every part but the app box, and a drag of
 *      them carries the app box along.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/code-wrapper.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/owner.ts, src/features/studio/board/pressRead.ts, src/features/studio/board/NodeView.tsx, src/features/studio/board/DesktopCanvas.tsx, src/features/studio/board/store/board.ts, src/features/studio/panels/inspector/Panel.tsx
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
const ui = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");

const nodes = await ui.evaluate(() => window.__studioNodes());
const app = nodes.find((n) => n.hooks?.["data-hook"] === "app");
const wallet = nodes.find((n) => n.hooks?.["data-hook"] === "wallet-panel") ?? nodes.find((n) => n.pageId === app?.pageId && /wallet/i.test(n.label) && n.featureId === "box");
const picked = () => ui.evaluate(() => [...document.querySelectorAll("[data-node-id][data-picked]")].map((e) => e.getAttribute("data-node-id")));
/* A point inside `id`'s box where the press lands on `want` (a part id, or null for bare page). */
const spot = (id, want) => ui.evaluate(({ id, want }) => {
  const r = document.querySelector(`[data-node-id="${id}"]`)?.getBoundingClientRect();
  if (!r) return null;
  for (let y = r.top + 4; y < Math.min(r.bottom, innerHeight) - 2; y += 6) for (let x = r.left + 4; x < Math.min(r.right, innerWidth) - 2; x += 6) {
    const top = document.elementFromPoint(x, y);
    if (!top || (want === null && !top.closest("[data-frame]"))) continue;
    if ((top.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null) === want) return { x, y };
  }
  return null;
}, { id, want });

/* 1. */
check("the saved PST board has its app box", !!app, app?.id);
const bare = app && await spot(app.id, null);
check("1. a press inside the app box, on no part, reaches the page", !!bare, JSON.stringify(bare));
if (bare) {
  await ui.mouse.click(bare.x, bare.y);
  await ui.waitForTimeout(300);
  const sel = await picked();
  check("…and does not pick the app box", !sel.includes(app.id), JSON.stringify(sel));
}

/* 2. */
const inWallet = wallet && await spot(wallet.id, wallet.id);
if (inWallet) {
  await ui.mouse.click(inWallet.x, inWallet.y);
  await ui.waitForTimeout(500);
}
const box = await ui.locator('textarea[aria-label="Words"]').first().inputValue().catch(() => null);
const inner = nodes.filter((n) => n.id !== wallet?.id && n.pageId === wallet?.pageId && n.from?.selector?.startsWith(`${wallet?.from?.selector} >`)).map((n) => (Array.isArray(n.content) ? n.content.map((r) => r.text).join("") : n.content)).filter((t) => t && t.trim());
check("2. the wallet panel's Words box shows none of the words inside it", !!inWallet && (box === null || !inner.some((t) => box.includes(t.trim()))), JSON.stringify({ at: inWallet, box: box?.slice(0, 60) }));
await ui.keyboard.press("Escape");
await ui.keyboard.press("Escape");
await ui.waitForTimeout(300);

/* 3. */
await ui.keyboard.press("Escape");
await ui.locator("[data-frame]").first().click({ position: { x: 2, y: 2 }, force: true }).catch(() => {});
await ui.keyboard.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
await ui.waitForTimeout(400);
const all = await picked();
check("3. Select everything leaves the app box out", all.length > 50 && !all.includes(app.id), `${all.length} picked, app ${all.includes(app.id) ? "in" : "out"}`);
const grab = await ui.evaluate((skip) => {
  for (const el of document.querySelectorAll("[data-node-id][data-picked]")) {
    if (el.getAttribute("data-node-id") === skip) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 20 || r.height < 12 || r.top < 0 || r.bottom > innerHeight) continue;
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (document.elementFromPoint(x, y)?.closest("[data-node-id]") === el) return { x, y, id: el.getAttribute("data-node-id") };
  }
  return null;
}, app.id);
if (grab) {
  await ui.mouse.move(grab.x, grab.y);
  await ui.mouse.down();
  for (let i = 1; i <= 6; i++) await ui.mouse.move(grab.x + i * 5, grab.y + i * 3);
  await ui.mouse.up();
  await ui.waitForTimeout(300);
}
const [moved, held] = await ui.evaluate(([a, b]) => [a, b].map((id) => window.__studioNodes().find((n) => n.id === id)), [app.id, grab?.id]);
const was = nodes.find((n) => n.id === grab?.id);
const dx = held && was ? held.x - was.x : 0, dy = held && was ? held.y - was.y : 0;
check("…and dragging them all carries the app box along", !!grab && (dx || dy) && moved.x === app.x + dx && moved.y === app.y + dy, JSON.stringify({ part: [dx, dy], app: [moved?.x - app.x, moved?.y - app.y] }));
await ui.keyboard.press("Control+z");
await ui.keyboard.press("Escape");
await ui.waitForTimeout(300);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
