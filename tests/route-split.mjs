#!/usr/bin/env node
/**
 * A ROUTE'S PAGE LOADS WITH ITS ROUTE.
 *
 * Every route's page (the board, the preview, the Builds list, Account,
 * Showcase) was imported by its feature module, and the registry imports
 * every module, so each route loaded every page: `/` (the Builds list)
 * carried the whole board. The modules load their pages with `next/dynamic`
 * now, and the server still renders the page it serves, so its script is
 * named in the HTML as before.
 *
 *   1. `/` loads under 4,000 KB of script (4,266 before, 3,891 after) and
 *      none of the board (a string only `board/DesktopCanvas.tsx` holds);
 *   2. `/builder` still loads the board, and draws it;
 *   3. each route still draws its page: `/` the Builds list, `/account`,
 *      `/builder/preview` the live column;
 *   4. going from `/` to `/builder` inside the app (no reload) draws the board;
 *   5. no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/route-split.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/index.ts, src/features/builds/index.ts, src/features/account/index.ts, src/features/showcase/index.ts
 */
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const BUDGET_KB = 4000;
const BOARD_MARK = "data-board-motion-css";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const errors = [];

async function open(route) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${route}: ${e}`));
  const scripts = [];
  page.on("response", (r) => { if (r.request().resourceType() === "script" && r.url().startsWith(URL_BASE)) scripts.push(r.text().catch(() => "")); });
  await page.goto(URL_BASE + route, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);
  const texts = await Promise.all(scripts);
  return { ctx, page, texts, kb: Math.round(texts.reduce((t, s) => t + Buffer.byteLength(s), 0) / 1024) };
}
const has = (page, sel) => page.locator(sel).count().then((n) => n > 0);

const home = await open("/");
check(`/ loads under ${BUDGET_KB} KB of script`, home.kb < BUDGET_KB, `${home.kb} KB in ${home.texts.length} files`);
check("/ loads none of the board", !home.texts.some((t) => t.includes(BOARD_MARK)));
check("/ draws the Builds list", await home.page.getByText(/builds?/i).first().isVisible().catch(() => false));
/* Into the Builder without a reload: the page the module loads on demand. */
await home.page.evaluate(() => { window.__noReload = true; });
await home.page.evaluate(() => window.next?.router?.push?.("/builder"));
await home.page.waitForSelector("[data-studio-pane]", { timeout: 60_000 }).catch(() => null);
check("/ → /builder in the app draws the board, with no reload", (await has(home.page, "[data-studio-pane]")) && (await home.page.evaluate(() => window.__noReload === true)));
await home.ctx.close();

const builder = await open("/builder");
check("/builder loads the board", builder.texts.some((t) => t.includes(BOARD_MARK)), `${builder.kb} KB`);
check("/builder draws the board", await has(builder.page, "[data-studio-pane]"));
await builder.ctx.close();

const preview = await open("/builder/preview");
check("/builder/preview draws the live column", await has(preview.page, "[data-live-column]"));
await preview.ctx.close();

const account = await open("/account");
check("/account draws its page", (await account.page.locator("main").innerText()).trim().length > 0);
await account.ctx.close();

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
