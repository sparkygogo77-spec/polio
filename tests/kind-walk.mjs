#!/usr/bin/env node
/**
 * WALKING A KIND'S PARTS FROM THE THEME PREVIEW (J, 2026-10-11): "add a
 * button near the panel hover so when I click I could scroll to the next one
 * ... use the scroll wheel to move through them ... when I stop hovering I
 * want to be back at the beginning, if I clicked of course it should stay."
 *
 * On the saved PST board, Colours open:
 *   1. the wheel over a piece moves the board to its kind's parts, and the panel does not scroll;
 *   2. leaving the preview puts the board back where it was;
 *   3. a piece's Next button moves the board, and leaving after it, the board stays.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/kind-walk.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/SiteColours.tsx
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
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);
await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForTimeout(1500);

const state = () => ui.evaluate(() => ({ top: Math.round(document.querySelector("[data-studio-pane]")?.scrollTop ?? -1), panel: Math.round(document.querySelector("[data-theme-preview]")?.closest("[class*='overflow-y']")?.scrollTop ?? 0) }));
/* The most-worn surface: its parts run down the whole page. */
const piece = ui.locator('[data-theme-preview] [data-preview-part="surface"]').first();
await piece.scrollIntoViewIfNeeded();
const before = await state();
await piece.hover();
await ui.waitForTimeout(400);
for (let i = 0; i < 4; i++) { await ui.mouse.wheel(0, 120); await ui.waitForTimeout(450); }
await ui.waitForTimeout(600);
const walked = await state();
check("1. the wheel over a piece moves the board to its parts", walked.top !== before.top, `${before.top} -> ${walked.top}`);
check("…and the panel under the hand does not scroll", walked.panel === before.panel, `${before.panel} -> ${walked.panel}`);

await ui.mouse.move(1000, 880);
await ui.waitForTimeout(1200);
const back = await state();
check("2. leaving the preview puts the board back", Math.abs(back.top - before.top) <= 2, `${before.top} -> ${back.top}`);

await piece.hover();
await ui.waitForTimeout(300);
const next = piece.locator("[data-preview-next]").first();
check("3. a piece shows a Next button", (await next.count()) === 1);
await next.click();
await ui.waitForTimeout(1200);
const stepped = await state();
await ui.mouse.move(1000, 880);
await ui.waitForTimeout(1200);
const stayed = await state();
check("…which moves the board", stepped.top !== back.top, `${back.top} -> ${stepped.top}`);
check("…and after a press the board stays where it was taken", Math.abs(stayed.top - stepped.top) <= 2, `${stepped.top} -> ${stayed.top}`);
check("no page errors", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
