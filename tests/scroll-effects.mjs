#!/usr/bin/env node
/**
 * SMOOTH, SNAP AND DEPTH SCROLLING DO SOMETHING YOU CAN SEE.
 *
 * J (2026-10-10): "smooth scrolling depth scrolling and snap scrolling still
 * do nothing, i expected where i set my part (smooth scrolling) to act as a
 * stop for a single scroll wheel to glide to".
 *
 *   1. The published page's script (library/siteMotion.ts): one wheel notch
 *      glides to the part given Smooth scrolling, however far; Snap goes to
 *      the next section; a Depth layer moves slower than the page.
 *   2. The kit's vendor/builder-motion.js does the same from the style
 *      layer's `--builder-scroll` on a hook, and Publish writes it there.
 *   3. A Smooth scrolling card dropped on a part keeps that part as its stop.
 *   4. The Preview on the saved PonsStars board: one notch glides to the
 *      stop; a Depth part lags behind the scroll.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/scroll-effects.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/shelf/library/scrollMotionJs.ts, src/features/studio/shelf/library/siteMotion.ts, src/features/studio/live/LiveShell.tsx, src/features/studio/live/behaviours.ts, src/features/studio/send-out/kitMotion.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/ShelfCards.tsx, kit/starter/vendor/builder-motion.js
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
const { scrollRoleValue, siteMotionValue } = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));
const KIT = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* One notch over a point: where the page is two frames on, and once it has settled. */
async function notch(page, x, y, read, dy = 100) {
  await page.mouse.move(x, y);
  const before = await page.evaluate(read);
  await page.mouse.wheel(0, dy);
  const soon = await page.evaluate(async (r) => { await new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(ok)))); return (0, eval)(r)(); }, read.toString());
  await page.waitForTimeout(1500);
  const after = await page.evaluate(read);
  return { before: Math.round(before), soon: Math.round(soon), after: Math.round(after) };
}
const winY = () => window.scrollY;

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* 1. The published page: five 500px blocks; the fourth is the stop. */
  const blocks = [0, 1, 2, 3, 4].map((i) => `<div id="p${i}" style="height:500px;margin:0;background:hsl(${i * 60} 60% 80%)"></div>`).join("");
  const site = async (settings) => {
    const p = await browser.newPage({ viewport: { width: 800, height: 600 } });
    await p.setContent(`<!doctype html><html><body style="margin:0">${blocks}<div id="deep" style="height:200px;width:200px;position:absolute;top:1400px;left:20px;background:#000"></div>
      <script>window.siteMotionSettings = Object.assign({ accent: "red", surface: "#fff", parts: ["p0","p1","p2","p3","p4"] }, ${JSON.stringify(settings)});</script>
      <script>(function () { ${SITE_MOTION_JS} })();</script></body></html>`);
    return p;
  };
  let p = await site({ smooth: true, smoothStrength: "light", stops: ["p3"] });
  let r = await notch(p, 400, 300, winY);
  check("1. Smooth: one notch glides from the top to the part given it (1500px down)", r.after === 1500 && r.soon > 0 && r.soon < 1500, JSON.stringify(r));
  r = await notch(p, 400, 300, winY, -100);
  check("…one notch up glides back toward the top (no stop between: the top)", r.after < 1500, JSON.stringify(r));
  await p.close();
  p = await site({ smooth: true, smoothStrength: "light" });
  r = await notch(p, 400, 300, winY);
  check("…with no stop, a notch glides its own distance", r.after === 100 && r.soon > 0 && r.soon < 100, JSON.stringify(r));
  await p.close();
  p = await site({ smooth: false, snap: "vertical" });
  r = await notch(p, 400, 300, winY);
  check("…Snap: one notch goes to the next section, not 100px", r.after === 500, JSON.stringify(r));
  r = await notch(p, 400, 300, winY);
  check("…and the next notch to the one after", r.after === 1000, JSON.stringify(r));
  await p.close();
  p = await site({ smooth: false, parallax: 0.18, depthParts: ["deep"] });
  const lag = await p.evaluate(async () => {
    const el = document.getElementById("deep"), at = () => el.getBoundingClientRect().top;
    const frame = () => new Promise((ok) => requestAnimationFrame(() => requestAnimationFrame(ok)));
    await new Promise((ok) => setTimeout(ok, 500));
    window.scrollTo(0, 900); await frame(); const a = at();
    window.scrollTo(0, 1300); await frame(); const b = at();
    return { moved: Math.round(a - b), translate: el.style.translate };
  });
  check("…Depth: the layer moves slower than the page (400px scrolled)", lag.moved > 280 && lag.moved < 380, JSON.stringify(lag));
  await p.close();

  /* 2. The kit's file, told by the style layer. */
  check("2. Publish names the part's role on its hook", scrollRoleValue([{ featureId: "smooth-scroll", options: { parts: "n1,n2" } }, { featureId: "parallax", options: { parts: "n2" } }], "n2") === '"stop depth"');
  check("…and Snap scrolling runs in the kit's file", siteMotionValue([{ featureId: "scroll-snap", options: {} }]) === '"scroll-snap"');
  p = await browser.newPage({ viewport: { width: 800, height: 600 } });
  await p.setContent(`<!doctype html><html><head><style>:root{--builder-site-motion:"smooth-scroll"} [data-hook="b3"]{--builder-scroll:"stop"}</style></head>
    <body data-hook="app" style="margin:0">${[0, 1, 2, 3, 4].map((i) => `<div data-hook="b${i}" style="height:500px"></div>`).join("")}<script>${KIT}</script></body></html>`);
  r = await notch(p, 400, 300, winY);
  check("…a page loading the kit's file glides to the hook named a stop", r.after === 1500, JSON.stringify(r));
  await p.close();

  /* 3 and 4. The saved PonsStars board. */
  const board = structuredClone(readBoard("pst"));
  const doc = boardDoc(board);
  const home = doc.pages[0];
  const byHook = (h) => doc.nodes.find((n) => n.pageId === home.id && !n.state && n.source?.hook?.value === h);
  /* The stop: the panel under the TV, below the first screen. The Depth layer: the TV's body, with all it holds. */
  const low = byHook("queue-panel"), deep = byHook("chart-tv-body");
  const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  ui.on("pageerror", (e) => errors.push(e.message));
  await ui.route("https://api.github.com/**", (q) => q.abort());
  await openBoard(ui, URL_BASE, board);
  /* 3. The cards carried off the shelf and let go on a part, as he does. */
  if (await ui.locator('[aria-label="Open the parts shelf"]').count()) await ui.locator('[aria-label="Open the parts shelf"]').first().click();
  await ui.waitForTimeout(800);
  if (!(await ui.locator('[data-category-open="motion"]').count())) await ui.locator('[data-category="motion"]').first().click();
  await ui.waitForTimeout(800);
  async function drop(card, nodeId) {
    /* A point the card itself is under (not the shelf's sticky bar), and a point on the board where the part is the top thing. */
    const from = await ui.evaluate((card) => {
      const c = document.querySelector(`[data-shelf-card="${card}"]`);
      if (!c) return null;
      c.scrollIntoView({ block: "center" });
      const r = c.getBoundingClientRect();
      for (let y = r.top + 8; y < r.bottom - 4; y += 8) {
        const e = document.elementFromPoint(r.left + r.width / 2, y);
        if (e && c.contains(e) && !e.closest("[role=switch],a,input,label,button:not([data-carry-ok])")) return { x: r.left + r.width / 2, y };
      }
      return null;
    }, card);
    const aim = (id) => ui.evaluate((id) => {
      const n = [...document.querySelectorAll(`[data-node-id="${id}"]`)].find((x) => x.getBoundingClientRect().width > 20);
      if (!n) return null;
      if (n.getBoundingClientRect().top > window.innerHeight - 300) n.scrollIntoView({ block: "center" });
      const r = n.getBoundingClientRect();
      for (let y = r.top + 6; y < r.bottom; y += 10) for (let x = r.left + 6; x < r.right; x += 20) {
        if (y < 60 || y > window.innerHeight - 60) continue;
        if (document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") === id) return { x, y };
      }
      return null;
    }, id);
    const to = await aim(nodeId);
    if (!from || !to) return { from, to };
    await ui.mouse.move(from.x, from.y);
    await ui.mouse.down();
    for (let i = 1; i <= 14; i++) { await ui.mouse.move(from.x + ((to.x - from.x) * i) / 14, from.y + ((to.y - from.y) * i) / 14); await ui.waitForTimeout(16); }
    await ui.waitForTimeout(250);
    /* The shelf lowers while carrying, which moves the board: aim again at the part. */
    const at = await aim(nodeId);
    if (at) { await ui.mouse.move(at.x, at.y, { steps: 4 }); await ui.waitForTimeout(150); }
    await ui.mouse.up();
    await ui.waitForTimeout(500);
    return { from, to };
  }
  const d1 = await drop("smooth-scroll", low.id);
  const d2 = await drop("parallax", deep.id);
  const chips = await ui.evaluate(() => [...document.querySelectorAll("[data-site-wide-chip]")].map((c) => c.getAttribute("data-site-wide-chip")));
  check("3. Smooth and Depth dropped on parts turn on for the site (chips over the page)", chips.includes("smooth-scroll") && chips.includes("parallax"), JSON.stringify({ chips, d1, d2 }));
  await ui.locator('[aria-label="Preview"]').first().click();
  await ui.waitForTimeout(2500);
  const box = await ui.evaluate(() => { const r = document.querySelector("[data-live-shell]")?.closest("[data-live-scroller]")?.getBoundingClientRect(); return r ? { x: r.left + r.width / 2, y: r.top + 200 } : null; });
  const scrollTop = () => document.querySelector("[data-live-shell]").closest("[data-live-scroller]").scrollTop;
  const want = await ui.evaluate((id) => {
    const sc = document.querySelector("[data-live-shell]").closest("[data-live-scroller]");
    const el = sc.querySelector(`[data-live-node="${id}"]`), b = sc.getBoundingClientRect();
    if (!el) return null;
    const k = sc.clientHeight / b.height;
    return { y: Math.round(Math.min(sc.scrollHeight - sc.clientHeight, sc.scrollTop + (el.getBoundingClientRect().top - b.top) * k)), room: sc.scrollHeight - sc.clientHeight };
  }, low.id);
  const depthAt = (id) => document.querySelector(`[data-live-node="${id}"]`)?.style.translate ?? "";
  const t0 = await ui.evaluate(depthAt, deep.id);
  const prev = await notch(ui, box.x, box.y, scrollTop);
  check(`4. Preview: one notch glides to the stop, “${low.label}” (${want?.y}px down)`, !!want && want.y > 150 && Math.abs(prev.after - want.y) <= 3 && prev.soon > 0 && prev.soon < want.y, JSON.stringify({ ...prev, want }));
  const t1 = await ui.evaluate(depthAt, deep.id);
  check(`…the Depth part, “${deep.label}”, is moved against the scroll and moves again as it scrolls`, !!t1 && t1 !== t0, JSON.stringify({ t0, t1 }));
  check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
