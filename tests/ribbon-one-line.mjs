#!/usr/bin/env node
/**
 * A RUNNING LINE IS ONE LINE, WHATEVER SIZE IT IS GIVEN.
 *
 * The import checkup (2026-11-01) on trumpmorty.fun: the owner's ribbons
 * carry the marquee's "Text size" (red 36px, navy 42px, `tests/ribbon-band.mjs`).
 * At that size the navy ribbon's words no longer fit the track the capture
 * measured at 34px, so they wrapped to two lines on the board: the part grew
 * 65 → 84, its band 73 → 92, and everything under the hero moved down 19px.
 * A ribbon's words run; they never wrap.
 *
 * On every repo fixture brought in through the real door and settled:
 *   1. every part running a marquee draws its words on one line, and keeps
 *      the height the capture measured (2px either way);
 *   2. the number of parts off the capture does not grow past base's count.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/ribbon-one-line.mjs http://127.0.0.1:3013 [fixture,fixture,…]
 *
 * Covers: src/features/studio/blocks.tsx (bandOf), src/features/studio/shelf/parts/Text.tsx
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { bringSink } from "./fixtures/bring-sink.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const here = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.TESTS_ROOT ?? join(here, "..", "capture");
const ALL = ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"];
const SITES = (process.argv[3] ?? ALL.join(",")).split(",").filter(Boolean);
const MOVED_ON_BASE = { "share-xyz": 10, "trumpmorty-fun": 4, "gotchi-gg": 7, "stonkfun-xyz": 91, "parasiteonsol-fun": 60, "trendtrader-pro": 272 };

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const off = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));
const runsMarquee = (n) => !!n.work && (n.work.id === "marquee" || (n.work.also ?? []).some((u) => u.id === "marquee"));

for (const site of SITES) {
  const SINK = join(ROOT, "sites", site);
  if (!existsSync(join(SINK, "site/document.json"))) { console.log(`  skip  ${site}: no capture at ${SINK}`); continue; }
  const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
  const ribbons = doc.nodes.filter((n) => !n.state && runsMarquee(n) && n.from?.selector);
  if (!ribbons.length) { console.log(`  —     ${site}: no running line`); continue; }
  const { browser, page, errors } = await bringSink(BASE, SINK);
  const store = () => page.evaluate(() => window.__studioHistory?.doc?.()?.nodes ?? []);
  for (let i = 0; i < 120 && (await store()).length < 50; i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(Number(process.env.SETTLE ?? 15000));
  const nodes = await store();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const lines = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`); if (!el) return [id, null];
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let tn, host = null; while ((tn = tw.nextNode())) if (tn.textContent.trim()) { host = tn.parentElement; break; }
    if (!host) return [id, 0];
    const r = document.createRange(); r.selectNodeContents(host.closest("p, div") ?? host);
    const tops = [...new Set([...r.getClientRects()].filter((b) => b.height > 2).map((b) => Math.round(b.top / 4)))];
    return [id, tops.length];
  })), ribbons.map((n) => n.id));
  const wrapped = ribbons.filter((d) => (lines[d.id] ?? 0) > 1);
  const grown = ribbons.filter((d) => { const n = byId.get(d.id); return n && Math.abs(n.h - d.h) > 2; });
  check(`${site}: every running line is one line (${ribbons.length} ribbons)`, wrapped.length === 0, wrapped.map((d) => `${d.id} ${lines[d.id]} lines`).join(", "));
  check(`${site}: every running line keeps its height`, grown.length === 0, grown.map((d) => `${d.id} ${d.h}→${byId.get(d.id).h}`).join(", "));
  const moved = doc.nodes.filter((d) => { const n = byId.get(d.id); return n && !d.state && off(d, n) > 3; });
  check(`${site}: parts off the capture ${moved.length}, not more than base's ${MOVED_ON_BASE[site] ?? "?"}`, moved.length <= (MOVED_ON_BASE[site] ?? Infinity));
  check(`${site}: no page errors`, errors.length === 0, errors[0]);
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
