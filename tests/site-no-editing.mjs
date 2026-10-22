#!/usr/bin/env node
/**
 * THE PUBLISHED PAGE LOADS NO GO LIVE AND NO IMPORTER.
 *
 * Two barrels pulled the Builder's editing code into /site:
 *   · the preview's layout (`live/previewWindow.ts`) took one function,
 *     `fluidPage`, from `send-out/run.ts`, and with it Go live, the publish
 *     runs and the kit (`goLive.ts`, `kitPublish.ts`, the loop's agent);
 *   · the store's document taker (`docTake.ts`) took one test, `isTaken`,
 *     from `bring-in/index.ts`, and with it the importer (`pageParts.ts`,
 *     `sourceSite.ts`, the send-out style layer).
 * Each now imports the file its function lives in.
 *
 *   1. `/site` loads under 1,950 KB of script (2,101 before, 1,884 after),
 *      none of Go live and none of the importer (a string only each holds);
 *   2. `/builder` still loads both;
 *   3. `/site` still draws its parts, and no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-no-editing.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/previewWindow.ts, src/features/studio/docTake.ts
 */
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const BUDGET_KB = 1950;
const MARKS = { "Go live": "The pages could not be written out", importer: "The page sets no styles of its own" };

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const errors = [];
async function load(route) {
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

const site = await load("/site");
check(`/site loads under ${BUDGET_KB} KB of script`, site.kb < BUDGET_KB, `${site.kb} KB in ${site.texts.length} files`);
for (const [what, mark] of Object.entries(MARKS)) check(`/site loads none of ${what}`, !site.texts.some((t) => t.includes(mark)));
const parts = await site.page.locator("[data-live-node]").count();
check("/site draws its parts", parts > 0, `${parts} parts`);
await site.ctx.close();

const builder = await load("/builder");
for (const [what, mark] of Object.entries(MARKS)) check(`/builder still loads ${what}`, builder.texts.some((t) => t.includes(mark)));
await builder.ctx.close();

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
