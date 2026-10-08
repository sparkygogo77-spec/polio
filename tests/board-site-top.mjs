/**
 * THE SITE'S TOP IS ON THE PAGE, UNDER ITS NAME, AND SCROLLS INTO VIEW.
 *
 * J (2026-10-06): the board's name ("Play / 1920 × …") sat over the site,
 * and scrolled down, the site's top (PST's nav pills) was cut by a line
 * across the board: the site reached a little above the page's top edge,
 * into the gutter the name stands in, where the pane's top cut it. The page
 * is drawn from the highest part in the site's flow now, the name above it.
 * A part the site placed itself (`position: absolute`) stays overhang.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-site-top.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg: "rgb(30, 20, 20)" }, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const docOf = (nodes) => JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "SITE TOP", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

async function walk(nodes) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, docOf(nodes));
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const read = () => page.evaluate(() => {
    const r = (q) => { const e = document.querySelector(q); if (!e) return null; const b = e.getBoundingClientRect(); return { y: b.top, b: b.bottom }; };
    return { frame: r("[data-frame]"), label: r("[data-page-label]"), nav: r('[data-node-id="nav"]'), pane: r("[data-studio-pane]"), scroll: document.querySelector("[data-studio-pane]").scrollTop };
  });
  const top = await read();
  await page.evaluate(() => { document.querySelector("[data-studio-pane]").scrollTop = 300; });
  await page.waitForTimeout(400);
  await page.evaluate(() => { document.querySelector("[data-studio-pane]").scrollTop = 0; });
  await page.waitForTimeout(400);
  const back = await read();
  await ctx.close();
  return { top, back, errors };
}

const nav = node("nav", 100, -30, 600, 44);
const body = node("body", 100, 60, 800, 1600, { colour: { bg: "rgb(200, 120, 60)" } });
const flow = await walk([nav, body]);
const t = flow.top;
check("the page is drawn from the site's top: the nav is on the page", t.nav.y >= t.frame.y - 0.5, `nav ${t.nav.y.toFixed(1)}, page ${t.frame.y.toFixed(1)}`);
check("the name sits above the nav, over none of it", t.label.b <= t.nav.y + 0.5, `name foot ${t.label.b.toFixed(1)}, nav ${t.nav.y.toFixed(1)}`);
check("scrolled back up, the whole nav is in the pane, not cut by its top", flow.back.nav.y >= flow.back.pane.y - 0.5, `nav ${flow.back.nav.y.toFixed(1)}, pane ${flow.back.pane.y.toFixed(1)}`);
const placed = await walk([{ ...nav, from: { position: "absolute" } }, body]);
check("a part the site placed itself above the page stays overhang: the page starts at 0", placed.top.nav.y < placed.top.frame.y - 1, `nav ${placed.top.nav.y.toFixed(1)}, page ${placed.top.frame.y.toFixed(1)}`);
check("no page error", [...flow.errors, ...placed.errors].length === 0, [...flow.errors, ...placed.errors].join(" / "));

await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
