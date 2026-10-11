#!/usr/bin/env node
/**
 * /SITE SHOWS WHAT WAS PUBLISHED, EVERY VISIT, AND KEEPS NO COPY.
 *
 * The published site (`live/PublishedPage.tsx`) loaded the published
 * document only into a browser that had none, and saved it there. Every
 * later visit showed that saved copy, so what Go live deployed after a
 * visitor's first visit never reached them; and on the Builder's own origin
 * /site wrote the published document over an empty working board.
 *
 *   1. a fresh browser opens /site: the published words are there, and
 *      nothing was saved (no `builder.studio` in localStorage or IndexedDB);
 *   2. a browser holding an older copy (a stored document with one text
 *      changed to a marker) opens /site: the published words, not the marker;
 *   3. …and the stored copy is exactly as it was: /site wrote nothing over it.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-shows-published.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/PublishedPage.tsx, src/features/studio/board/store/create.ts, src/features/studio/board/store/history.ts, site/document.json
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The published document as the build bundles it. */
const doc = JSON.parse(readFileSync(new URL("../site/document.json", import.meta.url), "utf8"));
if (!doc.nodes?.length) { console.log("  skip  site/document.json has no parts: nothing is published"); process.exit(0); }

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const open = async () => {
  await page.goto(`${URL_BASE}/site`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForSelector("[data-published-site]", { timeout: 30_000 });
  await page.waitForTimeout(1500);
  return page.evaluate(() => document.querySelector("[data-published-site]")?.innerText ?? "");
};
const saved = () => page.evaluate(async () => {
  const local = localStorage.getItem("builder.studio");
  const idb = await new Promise((done) => {
    const q = indexedDB.open("builder.docs");
    q.onerror = () => done(null);
    q.onsuccess = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains("docs")) { db.close(); return done(null); }
      const g = db.transaction("docs", "readonly").objectStore("docs").get("builder.studio");
      g.onsuccess = () => { db.close(); done(g.result ?? null); };
      g.onerror = () => { db.close(); done(null); };
    };
  });
  return { local, idb: idb == null ? null : String(idb).length };
});

/* A text the page draws: the first drawn words of the published site that also appear in the document. */
const shown = await open();
const word = (shown.split("\n").map((l) => l.trim()).filter((l) => l.length >= 12 && JSON.stringify(doc).includes(JSON.stringify(l).slice(1, -1)))[0]) ?? null;

/* 1. */
const first = await saved();
check("1. a fresh browser shows the published words", word !== null, word ?? shown.slice(0, 120));
check("…and saves nothing of it", first.local === null && first.idb === null, `localStorage ${first.local?.length ?? 0} chars, IndexedDB ${first.idb ?? 0}`);

/* 2. An older copy in the browser: the same document with that text changed. */
const MARK = "OLD-COPY-FROM-AN-EARLIER-DEPLOY";
const older = JSON.stringify({ state: JSON.parse(JSON.stringify(doc).split(JSON.stringify(word ?? "\u0000").slice(1, -1)).join(MARK)), version: 0 });
await page.evaluate((v) => localStorage.setItem("builder.studio", v), older);
const again = await open();
check("2. a browser with an older copy shows the published words", word !== null && again.includes(word) && !again.includes(MARK), again.includes(MARK) ? "the older copy was shown" : "");

/* 3. */
const after = await saved();
check("3. the stored copy is as it was: /site wrote nothing over it", after.local === older, after.local === null ? "removed" : `${after.local.length} chars, was ${older.length}`);

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
