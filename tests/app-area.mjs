#!/usr/bin/env node
/**
 * AN APP AREA MOVES AS ONE (kit rule 34).
 *
 * J (2026-10-10): the TV screen PonsStars' game draws in is "an element I
 * can move that the game server would follow", and such boxes should be kept
 * and placeable on every site. PST marks it `data-app-area="Game"`
 * (`chart-tv-screen`). On the saved PST board:
 *
 *   1. the screen is an app area, and picked it says so on its chip;
 *   2. a press on a part inside it picks the screen;
 *   3. a drag on a part inside moves the screen and everything inside by
 *      the same distance;
 *   4. a part inside, picked exactly (Shift), has no resize handles.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/app-area.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/owner.ts, src/features/studio/board/pressRead.ts, src/features/studio/board/NodeView.tsx, src/features/studio/board/DesktopCanvas.tsx
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
const screen = nodes.find((n) => n.hooks?.["data-hook"] === "chart-tv-screen");
const under = (n) => !!screen && (n.from?.selector ?? "").startsWith(`${screen.from?.selector} > `);
const inside = nodes.filter(under);
const picked = () => ui.evaluate(() => [...document.querySelectorAll("[data-node-id][data-picked]")].map((e) => e.getAttribute("data-node-id")));
/* A visible point where the press lands on a part inside the screen. */
const spotInside = () => ui.evaluate((ids) => {
  for (const id of ids) {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    const r = el?.getBoundingClientRect();
    if (!r || r.width < 8 || r.height < 8 || r.top < 0 || r.bottom > innerHeight) continue;
    for (let y = r.top + 3; y < r.bottom - 2; y += 4) for (let x = r.left + 3; x < r.right - 2; x += 4) {
      if (document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") === id) return { x, y, id };
    }
  }
  return null;
}, inside.map((n) => n.id));

/* 1. */
check("1. the saved board's TV screen is an app area", screen?.hooks?.["data-app-area"] === "Game" && inside.length > 3, `${inside.length} parts inside`);
if (!screen) { await browser.close(); process.exit(1); }
await ui.evaluate((id) => document.querySelector(`[data-node-id="${id}"]`)?.scrollIntoView({ block: "center" }), screen.id);
await ui.waitForTimeout(400);

/* 2. */
const at = await spotInside();
if (at) { await ui.mouse.click(at.x, at.y); await ui.waitForTimeout(300); }
const sel = await picked();
check("2. a press on a part inside picks the screen", !!at && sel.length === 1 && sel[0] === screen.id, JSON.stringify({ pressed: at?.id, sel }));
const chip = await ui.locator(`[data-node-id="${screen.id}"] [data-app-area-chip]`).first().textContent().catch(() => null);
check("…and its chip says it is the game area", /^Game area/.test(chip ?? ""), chip ?? "no chip");

/* 3. */
await ui.keyboard.press("Escape");
const from = await spotInside();
if (from) {
  await ui.mouse.move(from.x, from.y);
  await ui.mouse.down();
  for (let i = 1; i <= 6; i++) await ui.mouse.move(from.x + i * 6, from.y + i * 4);
  await ui.mouse.up();
  await ui.waitForTimeout(300);
}
const now = await ui.evaluate(() => window.__studioNodes());
const was = new Map(nodes.map((n) => [n.id, n]));
const sNow = now.find((n) => n.id === screen.id);
const dx = sNow.x - screen.x, dy = sNow.y - screen.y;
const lagging = now.filter((n) => under(n) && !n.state).filter((n) => n.x - was.get(n.id).x !== dx || n.y - was.get(n.id).y !== dy);
check("3. a drag on a part inside moves the screen and everything inside together", !!from && (dx !== 0 || dy !== 0) && lagging.length === 0, JSON.stringify({ moved: [dx, dy], lagging: lagging.slice(0, 3).map((n) => n.hooks?.["data-hook"] ?? n.id) }));
await ui.keyboard.press("Control+z");
await ui.waitForTimeout(300);

/* 4. */
await ui.keyboard.press("Escape");
const one = await spotInside();
if (one) { await ui.keyboard.down("Shift"); await ui.mouse.click(one.x, one.y); await ui.keyboard.up("Shift"); await ui.waitForTimeout(300); }
const handles = one ? await ui.locator(`[data-node-id="${one.id}"] [data-resize]`).count() : -1;
check("4. a part inside, picked exactly, has no resize handles", !!one && (await picked()).includes(one.id) && handles === 0, JSON.stringify({ part: one?.id, handles }));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
