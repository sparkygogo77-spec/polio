#!/usr/bin/env node
/**
 * THE SCROLL PROGRESS BAR STAYS AT THE TOP AND KEEPS UP.
 *
 * J (2026-10-10): "scroll progress bar also doesnt stay at the top ... if i
 * scroll up fast enough or down it lags behind heavily". The Preview drew the
 * bar inside the page at `top: scrollTop`, moved after each scroll event
 * (and by the frame's scale in a desktop frame), and the fill eased toward
 * each new width over 90ms. Now the Preview's bar sits in a sticky strip
 * that is the scroller's own first child, and every fill is written with no
 * easing (the published page's follows the scroll itself where it can).
 *
 *   1. The site's own motion script (library/siteMotion.ts, also in the
 *      kit's vendor/builder-motion.js): a jump to half way, one frame later
 *      the bar is at the top and half full.
 *   2. The Preview, on the saved PST board with a scroll progress bar:
 *      after jumps down and back up, one frame later the bar is at the top
 *      of the window and its fill matches the scroll.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/scroll-progress-pinned.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/LiveShell.tsx, src/features/studio/shelf/library/siteMotion.ts, src/features/studio/scaffolding/shell.ts, kit/starter/vendor/builder-motion.js
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { boardDoc, openBoard, readBoard } from "./lib/board.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { SITE_MOTION_JS } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "library", "siteMotion.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* 1. */
  const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await p.setContent(`<!doctype html><html><body style="margin:0"><div style="height:4000px"></div>
    <script>window.siteMotionSettings = { progress: true, accent: "red", surface: "#fff", parts: [] };</script>
    <script>(function () { ${SITE_MOTION_JS} })();</script></body></html>`);
  const site = await p.evaluate(async () => {
    const bar = document.querySelector('[role="progressbar"]');
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo(0, max / 2);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const b = bar.getBoundingClientRect(), f = bar.firstChild.getBoundingClientRect();
    return { top: b.top, part: f.width / b.width };
  });
  check("1. The site's script: half way down, one frame later the bar is at the top and half full", site.top === 0 && Math.abs(site.part - 0.5) < 0.02, JSON.stringify(site));

  /* 2. */
  const board = structuredClone(readBoard("pst"));
  const doc = boardDoc(board);
  const home = doc.pages[0];
  const bar = { id: "n_progress", pageId: home.id, featureId: "scroll-progress", label: "Scroll progress bar", content: "", prompt: "", x: 0, y: 0, w: 420, h: 64 };
  const put = (raw) => { const v = JSON.parse(raw); v.state.nodes = [...v.state.nodes, bar]; return JSON.stringify(v); };
  if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.nodes) board.local["builder.studio"] = put(board.local["builder.studio"]);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (row) row.value = put(row.value);

  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, board);
  await ui.locator('[aria-label="Preview"]').first().click();
  await ui.waitForTimeout(2500);
  const seen = await ui.evaluate(async () => {
    const shell = document.querySelector("[data-live-shell]");
    const scroller = shell?.closest("[data-live-scroller]");
    const bar = scroller?.querySelector('[data-live-pinned] [role="progressbar"]');
    if (!bar) return { found: false };
    const max = scroller.scrollHeight - scroller.clientHeight;
    const out = [];
    for (const to of [max, max * 0.25, max * 0.75, 0]) {
      scroller.scrollTop = to;
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      const s = scroller.getBoundingClientRect(), b = bar.getBoundingClientRect(), f = bar.firstChild.getBoundingClientRect();
      out.push({ off: Math.round(b.top - s.top), part: +(f.width / b.width).toFixed(3), want: +(scroller.scrollTop / max).toFixed(3) });
    }
    return { found: true, max, out };
  });
  /* PST's Home scrolls about 500px since the page ends at its last panel (tests/smooth-scroll-site.mjs). */
  check("2. The Preview draws the bar in a strip pinned to its window", seen.found === true && seen.max > 300, JSON.stringify({ found: seen.found, max: seen.max }));
  check("…after fast jumps down and up, one frame later it is at the top of the window", seen.out?.every((o) => o.off === 0), JSON.stringify(seen.out));
  check("…and its fill matches how far down the page is", seen.out?.every((o) => Math.abs(o.part - o.want) < 0.02), JSON.stringify(seen.out));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
