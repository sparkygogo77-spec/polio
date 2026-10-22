#!/usr/bin/env node
/**
 * THE PUBLISHED DOCUMENT REACHES /site AS DATA, NOT AS SCRIPT.
 *
 * `published.ts` imported `site/document.json`, so the bundler compiled the
 * whole document into /site's script and a visitor's browser parsed it as
 * code before drawing (sol face's: 1.3 MB of 3.4). The /site page reads it
 * on the server now and hands it to the page as data in the HTML, so there
 * is no fetch to wait for either.
 *
 *   1. no script /site loads holds the document (its longest words, found
 *      in the file at test time); the page's HTML does;
 *   2. the page draws its parts, and once drawn never drops to none (no
 *      empty flash while it starts), on `/site` and every other page of it;
 *   3. no page errors.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-doc-data.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/published.ts, src/features/studio/live/PublishedPage.tsx, src/app/(site)/site/[[...slug]]/page.tsx
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const doc = JSON.parse(readFileSync(new URL("../site/document.json", import.meta.url), "utf8"));
/* The document's longest run of words: text only it holds, the same in script or in data (JSON escapes only quotes and slashes). */
let mark = "";
(function walk(v) {
  if (typeof v === "string") { const t = v.match(/[A-Za-z][A-Za-z ,.]{20,}/g) ?? []; for (const s of t) if (s.length > mark.length) mark = s; }
  else if (v && typeof v === "object") for (const x of Object.values(v)) walk(x);
})(doc.nodes);
mark = mark.slice(0, 60);

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
check("the document has words to look for", mark.length >= 20, JSON.stringify(mark));

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const errors = [];
/* From the first byte: how many parts are drawn, each time that changes. */
const WATCH = () => {
  window.__counts = [];
  new MutationObserver(() => {
    const n = document.querySelectorAll("[data-live-node]").length;
    if (window.__counts.at(-1) !== n) window.__counts.push(n);
  }).observe(document, { childList: true, subtree: true });
};

for (const p of doc.pages ?? [{ path: "/" }]) {
  const route = "/site" + (p.path === "/" ? "" : p.path);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${route}: ${e}`));
  await page.addInitScript(WATCH);
  const scripts = [];
  let html = "";
  page.on("response", async (r) => {
    if (!r.url().startsWith(URL_BASE)) return;
    if (r.request().resourceType() === "script") scripts.push(r.text().catch(() => ""));
    if (r.request().resourceType() === "document") html = await r.text().catch(() => "");
  });
  await page.goto(URL_BASE + route, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(2000);
  if (route === "/site") {
    const texts = await Promise.all(scripts);
    check("no script /site loads holds the document", !texts.some((t) => t.includes(mark)), `${texts.length} scripts`);
    check("the page's HTML carries it", html.includes(mark));
  }
  const counts = await page.evaluate(() => window.__counts);
  const drawn = counts.at(-1) ?? 0;
  const first = counts.findIndex((n) => n > 0);
  const flash = first >= 0 && counts.slice(first).some((n) => n === 0);
  check(`${route} draws its parts, with no empty flash once drawn`, drawn > 0 && !flash, `counts ${counts.slice(0, 8).join(" → ")}${counts.length > 8 ? " …" : ""}`);
  await ctx.close();
}
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
