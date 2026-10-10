#!/usr/bin/env node
/**
 * THE PAGE'S TEXTURE RUNS ONCE, UNDER EVERYTHING, AND HAS ONE PLACE.
 *
 * J (2026-10-10): "since i can customize background which goes under
 * everything this bottom portion of look should be removed", and with PST's
 * "Lines 2" on the page "the header bar still doubles up on the texture";
 * then "the lines 2 texture never left the top of the board either, the 2
 * boxes". Every part as wide as the page wore its own copy from its own
 * corner, and Original put back only the part the site painted.
 *
 *   1. the Look panel has no "Spaces fill" row; the page's Texture row has a Gradient tile;
 *   2. Lines 2 on the page is worn by the part that paints the page, not by the bare header bar or title row;
 *   3. Original takes Lines 2 off every page part;
 *   4. a page texture picked sets the old fill back to flat, one undo, and Gradient lays a fading flat layer.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/page-texture-once.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/PieceTexture.tsx, src/features/studio/look/LookPanel.tsx
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
await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForTimeout(1500);

/* 1. */
check("1. the Look panel has no Spaces fill row", (await ui.locator("[data-look-fill]").count()) === 0 && !/Spaces fill/i.test(await ui.locator("[data-look-panel]").innerText()));
await ui.locator('[data-theme-preview] [data-preview-part="heading"]').first().evaluate((e) => e.click());
await ui.waitForTimeout(600);
const ed = ui.locator('[data-kind-editor="The page"]');
check("…the page's Texture row has a Gradient tile", (await ed.locator('[data-texture-sample="flat"][aria-label="Gradient"]').count()) === 1);

/* 2. */
const wearing = () => ui.evaluate(() => window.__studioNodes().filter((n) => n.pageId === "page_home" && /repeating-linear-gradient/.test(n.art?.background ?? "") && n.source?.hook?.value && !/^chart-tv/.test(n.source.hook.value)).map((n) => n.source.hook.value).sort());
await ed.locator('[data-texture-sample="site:Lines 2"]').click();
await ui.waitForTimeout(800);
const on = await wearing();
check("2. Lines 2 on the page is worn by the part painting the page", on.includes("app"), on.join(" "));
check("…not again by the header bar or the title row", !on.includes("nav") && !on.includes("page-title") && !on.includes("play-layout"), on.join(" "));

/* 3. */
await ed.locator('[data-texture-sample="original"]').click();
await ui.waitForTimeout(800);
const left = await wearing();
check("3. Original takes Lines 2 off every page part", left.length === 0, left.join(" "));

/* 4. */
await ui.evaluate(() => window.__studioSetFormat("palette.background", "grid"));
await ui.waitForTimeout(300);
const u0 = await ui.evaluate(() => window.__studioUndoDepth());
await ed.locator('[data-texture-sample="flat"]').click();
await ui.waitForTimeout(800);
const doc = await ui.evaluate(() => { const d = window.__studioPublishDoc(); return { fill: d.format?.["palette.background"], layer: (d.look?.texture ?? []).find((l) => l.on && l.target === "page") }; });
check("4. a page texture picked sets the old fill back to flat", doc.fill === "flat", String(doc.fill));
check("…Gradient lays a fading flat layer on the page", doc.layer?.kind === "flat" && doc.layer.contrast > 0 && doc.layer.opacity < 1, JSON.stringify(doc.layer && { kind: doc.layer.kind, contrast: doc.layer.contrast, opacity: doc.layer.opacity }));
check("…one undo", (await ui.evaluate(() => window.__studioUndoDepth())) === u0 + 1);

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
