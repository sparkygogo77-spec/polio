#!/usr/bin/env node
/**
 * SMOOTH SCROLLING IS A SITE SETTING, AND THE PREVIEW GLIDES.
 *
 * J (2026-10-10), dropping the shelf's Smooth scrolling on PST: "the smooth
 * scroll box should attach to something ... i want everything to work in the
 * preview which the scroll affect does nothing ... it just extended the page
 * for no reason as you can see the dots dont even extend with it".
 *
 *   1. The site's own motion script (library/siteMotion.ts, also in the kit's
 *      vendor/builder-motion.js): a wheel notch glides. A frame after it the
 *      page has moved part of the way, and it comes to rest where the notch
 *      said. The kit's file is told about it, heavy included.
 *   2. The board, with Smooth scrolling on: no box of its own on the page, a
 *      chip in the row over the page, and a press on the chip picks it.
 *   3. The Preview: a wheel notch glides there too, and the page ends at its
 *      last panel (no length left over from parts a press shows).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/smooth-scroll-site.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/library/smoothWheelJs.ts, src/features/studio/live/LiveShell.tsx, src/features/studio/live/layout.ts, src/features/studio/board/SiteWideRow.tsx, src/features/studio/board/DesktopCanvas.tsx, src/features/studio/send-out/kitMotion.ts, kit/starter/vendor/builder-motion.js
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { SITE_MOTION_JS } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "library", "siteMotion.ts"));
const { siteMotionValue } = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* Wheel one notch over a point, then read where the page is one frame on and once it has settled. */
async function glide(page, x, y, read) {
  await page.mouse.move(x, y);
  const before = await page.evaluate(read);
  await page.mouse.wheel(0, 400);
  const soon = await page.evaluate(async (r) => { await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok))); return (0, eval)(r)(); }, read.toString());
  await page.waitForTimeout(1200);
  const after = await page.evaluate(read);
  return { moved: Math.round(after - before), soon: Math.round(soon - before) };
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* 1. */
  const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await p.setContent(`<!doctype html><html><body style="margin:0"><div style="height:4000px"></div>
    <script>window.siteMotionSettings = { smooth: true, smoothStrength: "light", accent: "red", surface: "#fff", parts: [] };</script>
    <script>(function () { ${SITE_MOTION_JS} })();</script></body></html>`);
  const site = await glide(p, 400, 300, () => window.scrollY);
  check("1. The site's script: a wheel notch glides (part way a frame later) and rests where it said", site.soon > 0 && site.soon < 380 && Math.abs(site.moved - 400) <= 2, JSON.stringify(site));
  const kit = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
  const said = siteMotionValue([{ featureId: "smooth-scroll", options: { strength: "heavy" } }]);
  check("…the kit's file runs it, told by the style layer, heavy included", kit.includes("function smoothWheel(") && kit.includes('m.id === "smooth-scroll"') && said === '"smooth-scroll?strength=heavy"', said);

  /* 2. */
  const board = structuredClone(readBoard("pst"));
  const doc = boardDoc(board);
  const home = doc.pages[0];
  const smooth = { id: "n_smooth", pageId: home.id, featureId: "smooth-scroll", label: "Smooth scrolling", content: "", prompt: "", options: { strength: "light" }, x: 300, y: 1100, w: 420, h: 64 };
  const put = (raw) => { const v = JSON.parse(raw); v.state.nodes = [...v.state.nodes, smooth]; return JSON.stringify(v); };
  if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.nodes) board.local["builder.studio"] = put(board.local["builder.studio"]);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (row) row.value = put(row.value);

  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  const onBoard = await ui.evaluate(() => ({
    box: !!document.querySelector('[data-node-id="n_smooth"]'),
    chip: !!document.querySelector('[data-site-wide-chip="smooth-scroll"]'),
  }));
  check("2. The board draws no box for it on the page", onBoard.box === false, JSON.stringify(onBoard));
  check("…it is a chip in the row over the page", onBoard.chip === true, JSON.stringify(onBoard));
  await ui.locator('[data-site-wide-chip="smooth-scroll"]').dispatchEvent("pointerdown");
  const picked = await ui.evaluate(() => document.querySelector('[data-site-wide-chip="smooth-scroll"]')?.hasAttribute("data-selected"));
  check("…a press on the chip picks it, so its settings show", picked === true);

  /* 3. */
  await ui.locator('[aria-label="Preview"]').first().click();
  await ui.waitForTimeout(2500);
  const len = await ui.evaluate(() => {
    const scroller = document.querySelector("[data-live-shell]")?.closest("[data-live-scroller]");
    const root = scroller?.querySelector("[data-live-root]");
    if (!root) return null;
    const g = root.getBoundingClientRect(), k = root.offsetHeight / g.height;
    let foot = 0;
    for (const n of root.querySelectorAll("[data-live-node]")) { const r = n.getBoundingClientRect(); if (r.height > 0) foot = Math.max(foot, (r.bottom - g.top) * k); }
    return { page: root.offsetHeight, foot: Math.round(foot) };
  });
  check("3. The Preview's page ends at its last panel", !!len && len.page - len.foot <= 24 && len.page >= len.foot - 1, JSON.stringify(len));
  const box = await ui.evaluate(() => { const r = document.querySelector("[data-live-shell]")?.closest("[data-live-scroller]")?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + 200 } : null; });
  const prev = await glide(ui, box.x, box.y, () => document.querySelector("[data-live-shell]").closest("[data-live-scroller]").scrollTop);
  check("…and a wheel notch glides there too, and rests where it said", prev.soon > 0 && prev.soon < 380 && Math.abs(prev.moved - 400) <= 2, JSON.stringify(prev));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
