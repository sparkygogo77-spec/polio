#!/usr/bin/env node
/**
 * THE PHONE COMPANION NEVER PLAYS A LOADER OVER THE BUILDER.
 *
 * A loader (the CRT, the loader film) puts its screen over the whole window
 * and holds the page still. The little phone preview beside the board ran
 * every feature of the page, so a part with a loader covered the entire
 * Builder for seconds each time the companion opened, the page changed or
 * the loader's inputs did; with Preview on as well, each preview's cleanup
 * took the other's loader away.
 *
 *   1. a part on the PST board is given the CRT loader; the companion is
 *      opened: no loader screen, the Builder's page is not held still;
 *   2. the companion is closed and opened again: still none;
 *   3. Preview is switched on: the loader does play there, the page as
 *      published, and the companion beside it does not take it away.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/companion-no-loader.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/Preview.tsx, src/features/studio/live/LiveSite.tsx, src/features/studio/live/runWorks.ts
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
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.waitForTimeout(1000);

const loader = () => ui.evaluate(() => ({
  crt: !!document.querySelector("[data-crt]"),
  film: !!document.querySelector("[data-loader-film]"),
  overflow: document.documentElement.style.overflow,
}));
const companionOpen = () => ui.evaluate(() => !!document.querySelector("[data-companion-page]"));
const toggle = async () => { await ui.locator('[aria-label="Toggle companion"]').first().click(); await ui.waitForTimeout(600); };

/* 1. A part on the first page the companion shows, given the CRT loader. */
const id = await ui.evaluate(() => (window.__studioNodes?.() ?? []).find((n) => n.type !== "page" && n.pageId)?.id ?? null);
check("a part to give the loader to", !!id, String(id));
await ui.evaluate((id) => window.__studioGiveWork(id, "crt-loader"), id);
await ui.waitForTimeout(300);
if (!(await companionOpen())) await toggle();
check("1. the companion is open on the page", await companionOpen());
const one = await loader();
check("…and plays no loader over the Builder", !one.crt && !one.film && one.overflow !== "hidden", JSON.stringify(one));

/* 2. */
await toggle();
await toggle();
const two = await loader();
check("2. closed and opened again: still no loader", (await companionOpen()) && !two.crt && !two.film && two.overflow !== "hidden", JSON.stringify(two));

/* 3. */
await ui.locator('[aria-label="Preview"]').first().click();
let seen = null;
for (let i = 0; i < 20 && !seen?.crt; i++) { await ui.waitForTimeout(150); seen = await loader(); }
check("3. Preview plays the loader, as the page will", !!seen?.crt, JSON.stringify(seen));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
