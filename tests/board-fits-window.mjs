#!/usr/bin/env node
/**
 * A NEW SITE'S BOARD OPENS WHOLE.
 *
 * THE OWNER'S COMPLAINT: on a new, empty site the 1440×900 frame ran off the
 * window, and there was no way to see all of it at once. Measured on
 * 19741fa: the fit read the pane's WIDTH only, so the frame's first screen
 * ran 150 to 290px under the parts shelf, which is stuck to the foot of the
 * pane, at every window from 1280×720 to 1920×1080.
 *
 * Held here, at 1920×1080, 1536×864, 1366×768 and 1280×720, on a new site:
 *   · the whole frame is on screen: below the top bars, above the shelf,
 *     inside the pane left and right;
 *   · the zoom keys still work after the fit (in, and back out);
 *   · a window made smaller fits again;
 *   · and the page's height never binds: a site with a tall page opens at the
 *     same zoom as an empty one, its first screen fitted, the rest below.
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
const whole = (m) => !!m.frame && !!m.pane && !!m.shelf
  && m.frame.t >= m.pane.t - 0.5 && m.frame.t >= m.barsFoot - 0.5
  && m.frame.b <= m.shelf.t + 0.5
  && m.frame.l >= m.pane.l - 0.5 && m.frame.r <= m.pane.r + 0.5
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
  check(`${w}×${h}: a new site's whole frame is on screen, under the bars and above the shelf`, whole(m), fmt(m));
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
  const { ctx, p } = await open(1920, 1080, tall);
  const m = await measure(p);
  check("a tall page opens at the same zoom as an empty one: its height never binds", m.zoom === zooms["1920"], `${m.zoom}% against ${zooms["1920"]}%`);
  check("…its first screen on show from the top, the rest below to scroll to", !!m.frame && m.frame.t >= m.barsFoot - 0.5 && m.frame.b > m.shelf.t, fmt(m));
  await ctx.close();
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
