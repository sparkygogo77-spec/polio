#!/usr/bin/env node
/**
 * A SITE'S BOARD OPENS WITH ITS PAGE ACROSS THE PANE.
 *
 * THE OWNER, 2026-10-03: after importing PST the board opened at 37 to 48%,
 * not fitting the 1440-wide page ("fix fit-to-page to frame the page
 * itself"). The fit also fitted the frame's first screen above the parts
 * shelf (19741fa), which on a 1440x900 window held the zoom to 49%. Now
 * the zoom is the pane's WIDTH alone: the page fills it across, and runs
 * down under the shelf (stuck to the pane's foot) to be scrolled.
 *
 * Held here, at 1920×1080, 1536×864, 1366×768 and 1280×720, on a new site:
 *   · the frame is across the pane: inside it left and right, filling it
 *     less its gutter, its top under the top bars, nothing scrolled;
 *   · the zoom keys still work after the fit (in, and back out);
 *   · a window made smaller fits again;
 *   · and the page's height never binds: a site with a tall page opens at the
 *     same zoom as an empty one.
 *
 *   node tests/board-fits-window.mjs http://127.0.0.1:3012
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3012").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

const measure = (p) => p.evaluate(() => {
  const r = (e) => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
  const bars = [...document.querySelectorAll("header, [data-studio-toolbar], [role=toolbar]")].map(r).filter(Boolean);
  return {
    frame: r(document.querySelector("[data-frame]")),
    pane: r(document.querySelector("[data-studio-pane]")),
    shelf: r(document.querySelector("[data-studio-band]")),
    barsFoot: Math.max(0, ...bars.filter((b) => b.t < 200).map((b) => b.b)),
    scrolled: document.scrollingElement.scrollTop,
    paneTop: document.querySelector("[data-studio-pane]")?.scrollTop ?? 0,
    zoom: document.body.innerText.match(/(\d+)%/)?.[1] ?? null,
  };
});
/* Across the pane: inside it, and as wide as it less the gutter (128) or at full size. */
const whole = (m) => !!m.frame && !!m.pane
  && m.frame.t >= m.pane.t - 0.5 && m.frame.t >= m.barsFoot - 0.5
  && m.frame.l >= m.pane.l - 0.5 && m.frame.r <= m.pane.r + 0.5
  && (m.frame.r - m.frame.l >= m.pane.r - m.pane.l - 128 - 2 || m.zoom === "100")
  && m.scrolled === 0;
const fmt = (m) => m.frame ? `frame ${Math.round(m.frame.l)},${Math.round(m.frame.t)}–${Math.round(m.frame.r)},${Math.round(m.frame.b)} · pane ${Math.round(m.pane?.l)},${Math.round(m.pane?.t)}–${Math.round(m.pane?.r)} · shelf from ${Math.round(m.shelf?.t)} · bars to ${Math.round(m.barsFoot)} · ${m.zoom}%` : "no frame";

async function open(w, h, nodes = null) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await p.evaluate((nodes) => {
    localStorage.clear();
    if (nodes) {
      const env = (s) => JSON.stringify({ state: s, version: 0 });
      localStorage.setItem("builder.builds", env({ projects: [{ id: "t1", name: "Tall", updatedAt: Date.now() }], activeId: "t1" }));
      localStorage.setItem("builder.studio", env({ pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes }));
    }
  }, nodes);
  await p.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  return { ctx, p };
}

const zooms = {};
for (const [w, h] of [[1920, 1080], [1536, 864], [1366, 768], [1280, 720]]) {
  const { ctx, p } = await open(w, h);
  const m = await measure(p);
  zooms[`${w}`] = m.zoom;
  check(`${w}×${h}: a new site's frame fills the pane across, under the bars`, whole(m), fmt(m));
  if (w === 1920) {
    const zin = p.getByRole("button", { name: /zoom in/i }).first();
    const zout = p.getByRole("button", { name: /zoom out/i }).first();
    await zin.click().catch(() => {});
    await p.waitForTimeout(300);
    const bigger = await measure(p);
    check("…and zooming in still makes it bigger", !!bigger.frame && bigger.frame.r - bigger.frame.l > m.frame.r - m.frame.l + 10, `${Math.round(m.frame.r - m.frame.l)} → ${Math.round(bigger.frame.r - bigger.frame.l)}`);
    await zout.click().catch(() => {});
    await p.waitForTimeout(300);
    const back = await measure(p);
    check("…and zooming out brings it back", !!back.frame && Math.abs((back.frame.r - back.frame.l) - (m.frame.r - m.frame.l)) < 40, `${Math.round(back.frame.r - back.frame.l)}`);
    await p.setViewportSize({ width: 1280, height: 720 });
    await p.waitForTimeout(1200);
    const smaller = await measure(p);
    check("…and a window made smaller fits it again", whole(smaller), fmt(smaller));
  }
  await ctx.close();
}

{
  const tall = Array.from({ length: 6 }, (_, i) => ({ id: `n${i}`, pageId: "page_home", featureId: "prose", label: "words", prompt: "", content: `Row ${i}`, data: "", x: 100, y: 200 + i * 600, w: 400, h: 60, groupId: null, options: {}, priority: "must", custom: false }));
  /* Against a short page with the same chrome (no new-site offer on either), so only the page's height differs. */
  const short = await open(1920, 1080, tall.slice(0, 1));
  const s1 = await measure(short.p);
  check("…a short page's frame fills the pane across too", whole(s1), fmt(s1));
  await short.ctx.close();
  const { ctx, p } = await open(1920, 1080, tall);
  const m = await measure(p);
  check("a tall page opens at the same zoom as a short one: its height never binds", m.zoom === s1.zoom, `${m.zoom}% against ${s1.zoom}%`);
  check("…its top on show, the rest below to scroll to", whole(m) && m.frame.b > m.shelf.t, fmt(m));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
