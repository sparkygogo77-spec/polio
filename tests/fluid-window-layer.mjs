#!/usr/bin/env node
/**
 * A LAYER THAT FILLS THE WINDOW KEEPS BOTH EDGES.
 *
 * sunkcoin.fun (J, 2026-10-11): "the water ceases just below the first page
 * and becomes a static view". The sea is a fixed canvas, `inset: 0`, the
 * window's size, under the whole page. Anchored at the top alone, the
 * band-at-the-top rule (`fluidSite.ts`) cut it to the space above the first
 * part of the page: 10px of water, then nothing under the page. A fixed
 * layer touching both the top and the foot of the window keeps both edges
 * and runs the window's height at every scroll, as the page draws it.
 *
 *   1. `fluidParts`: such a layer is `fixed: "both"`, with no height trim.
 *   2. The Preview, on a seeded page: the layer's box is the Preview's whole
 *      view as the page opens and scrolled 2000px down, and the sections
 *      written after it paint over it (its first pixel is a section's).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/fluid-window-layer.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/fluidSite.ts, src/features/studio/live/previewWindow.ts, src/features/studio/send-out/exportSite.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, openPreview, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { fluidParts } = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const parts = [
  part("n_sea", 0, 0, 1440, 900, { ...captured("body > main > canvas", "fixed"), colour: { bg: "rgb(20, 60, 160)" } }),
  part("n_s1", 120, 10, 1200, 700, { ...captured("body > main > section:nth-of-type(1)"), colour: { bg: "rgb(240, 240, 240)" } }),
  part("n_s2", 120, 1100, 1200, 700, { ...captured("body > main > section:nth-of-type(2)"), colour: { bg: "rgb(240, 240, 240)" } }),
  part("n_s3", 120, 2100, 1200, 900, { ...captured("body > main > section:nth-of-type(3)"), colour: { bg: "rgb(240, 240, 240)" } }),
];
/* 1. */
const fluid = fluidParts(parts.map((p) => ({ id: p.id, x: p.x, y: p.y, w: p.w, h: p.h, selector: p.from.selector, position: p.from.position })), 1440);
const k = fluid.get("n_sea");
check("1. A fixed layer touching the top and the foot of the window is anchored at both, with no height trim", k?.fixed === "both" && !k.height, JSON.stringify(k));
const bar = fluidParts([{ id: "n_bar", x: 0, y: 0, w: 1440, h: 80, selector: "body > header", position: "fixed" }, { id: "n_main", x: 0, y: 70, w: 1440, h: 2000, selector: "body > main" }], 1440).get("n_bar");
check("…a band at the top alone keeps its one edge and the trim to the page below it (70)", bar?.fixed === "top" && bar.height === 70, JSON.stringify(bar));

/* 2. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, boardWith(parts));
  await openPreview(ui, URL_BASE);
  const seen = await ui.evaluate(async () => {
    const el = document.querySelector('[data-live-node="n_sea"]');
    const scroller = el?.closest("[data-live-scroller]");
    if (!el || !scroller) return { found: false };
    const out = [];
    for (const to of [0, 2000]) {
      scroller.scrollTop = to;
      await new Promise((r) => setTimeout(r, 150));
      const r = el.getBoundingClientRect(), s = scroller.getBoundingClientRect();
      const over = document.elementFromPoint(s.left + 720, s.top + s.height / 2);
      out.push({ to, at: scroller.scrollTop, top: Math.round(r.top - s.top), bottom: Math.round(s.bottom - r.bottom), tall: Math.round(r.height), view: Math.round(s.height), pos: getComputedStyle(el).position, overSea: !!over && !el.contains(over) && !!over.closest("[data-live-node]") });
    }
    return { found: true, out };
  });
  check("2. The Preview draws the layer fixed", seen.found === true && seen.out.every((o) => o.pos === "fixed"), JSON.stringify(seen));
  check("…as the page opens it is the view's whole height, top to foot", seen.out?.[0] && seen.out[0].top === 0 && seen.out[0].bottom === 0 && seen.out[0].tall === seen.out[0].view, JSON.stringify(seen.out?.[0]));
  check("…and 2000px down it still is: the water under the whole page", seen.out?.[1] && seen.out[1].at >= 1900 && seen.out[1].top === 0 && seen.out[1].bottom === 0, JSON.stringify(seen.out?.[1]));
  check("…with the sections written after it painted over it", seen.out?.every((o) => o.overSea), JSON.stringify(seen.out));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
