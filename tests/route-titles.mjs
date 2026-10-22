#!/usr/bin/env node
/**
 * EACH ROUTE'S TAB SAYS WHAT IT IS, ONCE.
 *
 * The Builder's routes had two titles: Next's "Builder" from the layout, and
 * the route's own, set by an effect in `RouteView.tsx`. Whichever landed
 * last won: on a load Next's, so every route read "Builder"; on a move
 * inside the app the route's, and the board's route is titled as the app
 * is, so `/` → `/builder` read "Builder · Builder". Now the route's page
 * draws the only <title> (server-rendered), and a route named as the app
 * is gets the name once.
 *
 *   1. `/` reads "Builds · Builder", `/builder` "Builder", `/account`
 *      "Account · Builder", `/site` "Site · Builder", each still so two
 *      seconds after the page is up;
 *   2. going `/` → `/builder` inside the app, the tab reads "Builder".
 *
 *   npm run build && npx next start -p 3013
 *   node tests/route-titles.mjs http://127.0.0.1:3013
 *
 * Covers: src/core/shell/RouteView.tsx, src/app/(builder)/layout.tsx
 */
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const WANT = { "/": "Builds · Builder", "/builder": "Builder", "/account": "Account · Builder", "/site": "Site · Builder" };

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
for (const [route, want] of Object.entries(WANT)) {
  const page = await browser.newPage();
  await page.goto(URL_BASE + route, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(2000);
  const title = await page.title();
  check(`${route} reads "${want}"`, title === want, `"${title}"`);
  if (route === "/") {
    await page.evaluate(() => window.next?.router?.push?.("/builder"));
    await page.waitForSelector("[data-studio-pane]", { timeout: 60_000 }).catch(() => null);
    await page.waitForTimeout(2000);
    const after = await page.title();
    check(`/ → /builder in the app reads "${WANT["/builder"]}"`, after === WANT["/builder"], `"${after}"`);
  }
  await page.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
