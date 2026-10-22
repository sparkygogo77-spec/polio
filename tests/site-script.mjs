#!/usr/bin/env node
/**
 * THE PUBLISHED SITE LOADS THE PAGE, NOT THE BUILDER.
 *
 * `/site` rendered inside the Builder's shell with the shell hidden, so a
 * visitor's browser fetched and parsed every line of the Builder: 4,265 KB
 * of script in 18 files, the same as `/builder`. It has its own root layout
 * now (`src/app/(site)`), and loads only what the page draws with.
 *
 *   1. `/site` loads under 2,600 KB of script (4,265 before, 2,091 after);
 *   2. none of it is the Builder's: the board, the command palette, the keys
 *      panel (each found by a string only it holds);
 *   3. `/builder` still loads all three, so the strings are the right ones;
 *   4. the published page still draws: its parts are on the page, and no
 *      Builder bar or board is.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-script.mjs http://127.0.0.1:3013
 *
 * Covers: src/app/(site)/layout.tsx, src/app/(site)/SiteShell.tsx, src/app/(site)/site/[[...slug]]/page.tsx, src/app/(builder)/layout.tsx
 */
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const BUDGET_KB = 2600;
/* A string each Builder-only module holds and nothing the published page draws with does. */
const BUILDER_ONLY = {
  board: "data-board-motion-css",
  "command palette": "Type a command, page or setting",
  "keys panel": "Choose a four-digit PIN",
};

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });

/** Every script a route loads on its own: its text, and the bytes it decoded to. */
async function load(route) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const scripts = [];
  page.on("response", (r) => { if (r.request().resourceType() === "script" && r.url().startsWith(URL_BASE)) scripts.push(r.text().catch(() => "")); });
  await page.goto(URL_BASE + route, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);
  const texts = await Promise.all(scripts);
  return { ctx, page, texts, kb: Math.round(texts.reduce((t, s) => t + Buffer.byteLength(s), 0) / 1024) };
}

const site = await load("/site");
check(`/site loads under ${BUDGET_KB} KB of script`, site.kb < BUDGET_KB, `${site.kb} KB in ${site.texts.length} files`);
for (const [what, mark] of Object.entries(BUILDER_ONLY)) {
  check(`/site loads none of the ${what}`, !site.texts.some((t) => t.includes(mark)));
}
const drawn = await site.page.evaluate(() => ({
  parts: document.querySelectorAll("[data-live-node]").length,
  bars: [...document.querySelectorAll("header, [data-live-bar]")].filter((el) => el.getBoundingClientRect().height > 0).length,
  board: document.querySelectorAll("[data-studio-pane]").length,
}));
check("/site draws its parts and no Builder bar or board", drawn.parts > 0 && drawn.bars === 0 && drawn.board === 0, JSON.stringify(drawn));
await site.ctx.close();

const builder = await load("/builder");
for (const [what, mark] of Object.entries(BUILDER_ONLY)) {
  check(`/builder still loads the ${what}`, builder.texts.some((t) => t.includes(mark)));
}
await builder.ctx.close();

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
