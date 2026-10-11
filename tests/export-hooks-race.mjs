#!/usr/bin/env node
/**
 * GO LIVE AND PUBLISH AT ONCE: EACH EXPORT KEEPS ITS OWN HOOKS SETTING.
 *
 * Go live writes the site with no `data-hook` on it; the kit Publish (and
 * Export for code) writes it with every hook kept. Both run `exportSite`,
 * and J can press one while the other is still writing pictures. The
 * setting was one shared flag set as each export started, so the second
 * one to start decided it for both: Go live went up with every hook, or the
 * kit's pages lost theirs and kit:check failed. On the saved PST board:
 *
 *   1. the plain export alone carries no hook; the kit export alone does;
 *   2. both started together, plain first: each comes out as it did alone;
 *   3. the kit export started first, the plain one a moment later, at a
 *      few different moments: the same.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/export-hooks-race.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/send-out/exportSite.ts, src/features/studio/exportForCode.ts
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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.route("https://api.github.com/**", (r) => r.abort());
await openBoard(page, URL_BASE, "pst");
await page.waitForFunction(() => typeof window.__studioExport === "function" && typeof window.__studioKitExport === "function", null, { timeout: 60000 });

const out = await page.evaluate(async () => {
  /* Hooks written on the exported pages (the .html files), counted. */
  const hooks = (files) => (files ?? []).filter((f) => /\.html$/.test(f.path) && typeof f.content === "string").reduce((a, f) => a + (f.content.match(/\sdata-hook=/g)?.length ?? 0), 0);
  const plain = await window.__studioExport();
  const kit = await window.__studioKitExport();
  const res = { plain: hooks(plain), plainFiles: plain.length, kit: hooks(kit.files), kitOk: kit.ok, runs: [] };
  {
    const [p, k] = await Promise.all([window.__studioExport(), window.__studioKitExport()]);
    res.runs.push({ order: "plain first", plain: hooks(p), kit: hooks(k.files), kitOk: k.ok });
  }
  for (const wait of [0, 5, 30]) {
    const kp = window.__studioKitExport();
    await new Promise((r) => setTimeout(r, wait));
    const p = await window.__studioExport();
    const k = await kp;
    res.runs.push({ order: `kit first, plain ${wait} ms later`, plain: hooks(p), kit: hooks(k.files), kitOk: k.ok });
  }
  return res;
});

/* 1. */
check("1. the plain export alone carries no data-hook", out.plainFiles > 0 && out.plain === 0, `${out.plain} hooks`);
check("…and the kit export alone keeps them", out.kit > 0, `${out.kit} hooks, kit:check ${out.kitOk ? "passes" : "fails"}`);
/* 2. and 3. */
for (const r of out.runs) {
  check(`${r.order === "plain first" ? "2" : "3"}. together (${r.order}): Go live's pages still carry no hook`, r.plain === 0, `${r.plain} hooks`);
  check(`…and the kit's pages keep every hook, kit:check as it was alone`, r.kit === out.kit && r.kitOk === out.kitOk, `${r.kit} hooks against ${out.kit}`);
}

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
