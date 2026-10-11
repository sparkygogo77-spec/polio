#!/usr/bin/env node
/**
 * THE BOARD'S PREVIEW PINS WHAT THE PAGE PINS.
 *
 * J (2026-10-11), PonsStars' redesign beside its Preview: "Preview must look
 * and behave exactly like the live site: fixed and sticky parts stay pinned
 * while scrolling (today a left nav rail scrolls away and its bottom
 * clock/nameplate float mid-page)". The board's Preview drew a brought-in
 * page in a scaled frame that scrolled as one. It now opens as the window
 * view does (`live/LiveStage.tsx`, `live/previewWindow.ts`), and a sticky
 * rail as tall as the window, read down to the page's foot for the board,
 * is a window tall again so it sticks (`fluidSite.ts#windowTallBands`).
 *
 * A seeded page: a sticky rail (read 3000 tall) with a link at its top and a
 * clock low in it, a main column, and a badge fixed to the window. Through
 * the board's own Preview switch, scrolled 0 → 1500 → 0:
 *   · the rail stays at the top of the view, one view tall;
 *   · its link stays where it was from its top, and its clock, low in the
 *     window it was read in (the badge fixed at 640–680 says how tall), as
 *     far over the view's foot as it was over that window's;
 *   · the fixed badge stays where it was in the view;
 *   · the main column scrolls;
 *   · the page's own background layers (`page.ground.layers`) are drawn,
 *     the one it fixed to the window staying in the view.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/preview-pins.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/LiveStage.tsx, src/features/studio/live/LiveSite.tsx, src/features/studio/send-out/exportSite.ts, src/features/studio/fluidSite.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";
import { boardWith, captured, part } from "./lib/seeded.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const parts = [
  part("n_main", 240, 0, 1200, 3000, { ...captured("body > div.shell > main"), colour: { bg: "rgb(240, 236, 220)" } }),
  part("n_rail", 0, 0, 220, 3000, { ...captured("body > div.shell > nav", "sticky", { top: 0 }), colour: { bg: "rgb(20, 24, 40)" } }),
  part("n_link", 24, 40, 170, 24, { featureId: "prose", content: "Play", ...captured("body > div.shell > nav > a"), colour: { text: "rgb(250, 250, 250)" } }),
  part("n_clock", 24, 600, 170, 40, { featureId: "prose", content: "12:00", ...captured("body > div.shell > nav > div"), colour: { text: "rgb(250, 200, 80)" } }),
  part("n_badge", 1300, 640, 120, 40, { featureId: "prose", content: "Live", ...captured("body > aside", "fixed"), colour: { bg: "rgb(200, 40, 40)", text: "rgb(255, 255, 255)" } }),
];

/* The page's own layers (`page.ground.layers`): a sunburst under the parts, and a grain the page fixed over everything. */
const LAYERS = [
  { which: "body", background: "repeating-conic-gradient(from -90deg at 50% -160px, rgba(216, 178, 60, 0.16) 0deg 6deg, rgba(0, 0, 0, 0) 6deg 12deg)" },
  { which: "body::after", background: "radial-gradient(rgba(0, 0, 0, 0.2) 1px, rgba(0, 0, 0, 0) 1px)", size: "4px 4px", fixed: true, z: 1, box: { x: 0, y: 0, w: 1440, h: 900 } },
];
function withLayers(board) {
  const put = (raw) => { const v = JSON.parse(raw); v.state.pages = v.state.pages.map((p) => (p.id === "page_home" ? { ...p, ground: { layers: LAYERS } } : p)); return JSON.stringify(v); };
  if (board.local["builder.studio"] && JSON.parse(board.local["builder.studio"]).state?.pages) board.local["builder.studio"] = put(board.local["builder.studio"]);
  const row = board.idb["builder.docs"]?.stores?.docs?.find((r) => r.key === "builder.studio");
  if (row) row.value = put(row.value);
  return board;
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  const ui = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(ui, URL_BASE, withLayers(boardWith(parts)));
  await ui.click("[data-preview-toggle]");
  for (let i = 0; i < 40; i++) {
    if (await ui.evaluate(() => !!document.querySelector('[data-studio-pane] [data-live-scroller] [data-live-node="n_rail"]'))) break;
    await ui.waitForTimeout(250);
  }
  await ui.waitForTimeout(1000);
  const seen = await ui.evaluate(async () => {
    const at = (id) => document.querySelector(`[data-studio-pane] [data-live-node="${id}"]`);
    const rail = at("n_rail");
    const scroller = rail?.closest("[data-live-scroller]");
    if (!rail || !scroller) return { found: false };
    const out = [];
    for (const to of [0, 1500, 0]) {
      scroller.scrollTop = to;
      await new Promise((r) => setTimeout(r, 200));
      const s = scroller.getBoundingClientRect();
      const row = { to, at: Math.round(scroller.scrollTop), view: scroller.clientHeight };
      for (const id of ["n_rail", "n_link", "n_clock", "n_badge", "n_main"]) {
        const r = at(id).getBoundingClientRect();
        row[id] = { top: Math.round(r.top - s.top), left: Math.round(r.left - s.left), h: Math.round(r.height) };
      }
      const under = scroller.querySelector('[data-live-ground-layers="under"] [data-ground-layer="body"]');
      const over = scroller.querySelector('[data-live-ground-layers="over"] [data-ground-layer="body::after"]');
      row.layers = { under: under ? { top: Math.round(under.getBoundingClientRect().top - s.top), bg: /conic/.test(getComputedStyle(under).backgroundImage) } : null, over: over ? { top: Math.round(over.getBoundingClientRect().top - s.top), bg: /radial/.test(getComputedStyle(over).backgroundImage) } : null };
      out.push(row);
    }
    return { found: true, view: scroller.dataset.liveView ?? null, out };
  });
  const [a, b, c] = seen.out ?? [];
  check("the board's Preview draws the brought-in page in the window view", seen.found === true && seen.view === "window", JSON.stringify({ found: seen.found, view: seen.view }));
  check("as it opens, the rail is at the top, one view tall, its link 40px down and its clock as far over the view's foot as over the window's it was read in (80px)", a?.n_rail.top === 0 && Math.abs(a.n_rail.h - a.view) <= 1 && a.n_link.top === 40 && a.n_clock.top === a.view - 80, JSON.stringify(a));
  check("scrolled 1500px, the main column has gone up the view", b?.at >= 1400 && b.n_main.top === a.n_main.top - b.at, JSON.stringify(b));
  check("…the rail is still at the top of the view, with its link and clock where they were", b?.n_rail.top === 0 && b.n_link.top === 40 && b.n_clock.top === b.view - 80 && b.n_link.left === a.n_link.left, JSON.stringify(b));
  check("…and the link and clock stand 24px into the rail, as the page has them", a?.n_link.left === 24 && b?.n_link.left === 24 && b?.n_clock.left === 24, JSON.stringify({ a: a?.n_link, b: b?.n_link, clock: b?.n_clock }));
  check("…and the badge fixed to the window is where it was in the view", b?.n_badge.top === a.n_badge.top && b.n_badge.left === a.n_badge.left, JSON.stringify({ a: a?.n_badge, b: b?.n_badge }));
  check("back at the top, the same as it opened", c?.n_rail.top === 0 && c.n_clock.top === c.view - 80 && c.n_badge.top === a?.n_badge.top && c.n_main.top === a?.n_main.top, JSON.stringify(c));
  check("the page's own background layers are drawn, the sunburst under the parts and the grain over them", a?.layers.under?.bg === true && a.layers.over?.bg === true, JSON.stringify(a?.layers));
  check("scrolled 1500px, the sunburst went up with the page and the grain the page fixed stayed in the view", b?.layers.under?.top === a?.layers.under?.top - b?.at && b?.layers.over?.top === 0 && a?.layers.over?.top === 0, JSON.stringify({ a: a?.layers, b: b?.layers }));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
