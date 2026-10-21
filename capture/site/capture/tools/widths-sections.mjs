#!/usr/bin/env node
/**
 * WHERE EACH SECTION IS, LIVE AND ON THE BOARD, AT A SMALL WIDTH.
 *
 * Reads the live site's own sections (by CSS selector) at a window width, as
 * a page-absolute box, and writes them as JSON. The board side is read by
 * `tests/responsive-sections.mjs`; this is the live side, so the two can be
 * put in one table.
 *
 *   node capture/site/capture/tools/widths-sections.mjs <url> [--width 390] [--height 844]
 *        [--sections "#top,#lore,footer"] [--out file.json] [--shots dir]
 *
 * `--shots dir`: a picture of each section as the live site shows it,
 * <dir>/live-<section>.png, to lay beside the board's.
 *
 * Observe only: nothing is pressed, a gate is hidden, never agreed to.
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scrollThrough } from "../sweep.mjs";
import { HIDE_GATE } from "../held.mjs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 && args[i + 1] != null ? args[i + 1] : d; };
const url = args.find((a) => /^https?:/.test(a));
if (!url) { console.error("usage: widths-sections.mjs <url> [--width 390] [--sections a,b] [--out f]"); process.exit(2); }
const W = Number(opt("--width", 390)), H = Number(opt("--height", 844));
const SECTIONS = String(opt("--sections", "#top,#lore,#story,#manifesto,#roadmap,#chart,#gallery,#community,footer")).split(",").map((s) => s.trim()).filter(Boolean);

/** The page-absolute box of each section, and the path the capture would record for it. */
export function READ_SECTIONS(sels) {
  const pathOf = (el) => { const out = []; for (let n = el; n && n !== document.body && n.parentElement; n = n.parentElement) { let i = 1; for (let q = n.previousElementSibling; q; q = q.previousElementSibling) if (q.localName === n.localName) i++; out.unshift(`${n.localName}:${i}`); } return `body>${out.join(">")}`; };
  const out = {};
  for (const s of sels) {
    const el = document.querySelector(s);
    if (!el) { out[s] = null; continue; }
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    out[s] = { p: pathOf(el), x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height), hidden: cs.display === "none" || r.height < 1 };
  }
  return { sections: out, pageHeight: document.documentElement.scrollHeight, width: document.documentElement.clientWidth };
}

if (import.meta.url.endsWith(process.argv[1]?.replace(/\\/g, "/").split("/").pop() ?? "")) {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM, headless: true, ...(process.env.CHROMIUM_ARGS ? { args: process.env.CHROMIUM_ARGS.trim().split(/\s+/) } : {}) });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, ...(W < 600 ? { isMobile: true, hasTouch: true } : {}) });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: "load", timeout: 60000 });
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(1500);
  await page.evaluate(HIDE_GATE).catch(() => {});
  /* Scrolled through as the capture is (sweep.mjs), so what reveals itself has; then back at the top at once. */
  await scrollThrough(page);
  await page.evaluate(async () => { const root = document.documentElement; root.style.scrollBehavior = "auto"; for (let i = 0; i < 40 && (scrollY !== 0 || i === 0); i++) { scrollTo({ top: 0, behavior: "instant" }); await new Promise((r) => setTimeout(r, 50)); } root.style.scrollBehavior = ""; });
  await page.waitForTimeout(800);
  const read = await page.evaluate(READ_SECTIONS, SECTIONS);
  const shots = opt("--shots", null);
  if (shots) {
    mkdirSync(shots, { recursive: true });
    for (const sel of SECTIONS) await page.locator(sel).first().screenshot({ path: join(shots, `live-${sel.replace(/[^a-z0-9]+/gi, "")}.png`), timeout: 20000 }).catch((e) => console.error(`no picture of ${sel}: ${String(e.message).split("\n")[0]}`));
  }
  await browser.close();
  const out = { url, width: W, height: H, ...read };
  const file = opt("--out", null);
  if (file) writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(JSON.stringify(out, null, 1));
}
