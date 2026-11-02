#!/usr/bin/env node
/**
 * A CAPTURED WINDOW KEEPS ITS HEIGHT, AND THE BOARD STANDS WHERE THE PAGE DID.
 *
 * The import checkup (2026-11-01) brought every captured site in at 1440 and
 * read the board against the capture. gotchi.gg's activity card, a 440px box
 * the page cuts its rows to (`art.overflow: auto`), arrived 582 tall: the
 * import grows every captured wrapper until it holds what it owns
 * (`owns.ts#grownTo`), and the 142px of rows the page never showed counted as
 * fallen out. The three sections under it moved down 88 to 142px. Nothing
 * asked the board to move.
 *
 * So, on every repo fixture brought in through the real door and left to
 * settle:
 *   1. every captured box the page cuts (`art.overflow` hidden, clip, auto or
 *      scroll) whose captured contents run past its foot keeps the height
 *      the capture measured (2px either way): the overhang was scrolled or
 *      cut out of sight, not fallen out. (A clipped box whose words grow
 *      inside it may still grow by those words: that is the marquee's case,
 *      `tests/ribbon-one-line.mjs`, not this one.)
 *   2. the number of parts whose box differs from the capture does not grow
 *      past what the base build left (the checkup's count per site), so a
 *      fix that keeps one box from growing moves nothing else.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/clipped-box-keeps-height.mjs http://127.0.0.1:3013 [fixture,fixture,…]
 *
 * Covers: src/features/studio/owns.ts, src/features/studio/board/store/nodes.ts
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
/* Parts whose box differed from the capture on base 0da6737 (the checkup, handovers/open/import-checkup-report.md). */
const MOVED_ON_BASE = { "share-xyz": 10, "trumpmorty-fun": 4, "gotchi-gg": 7, "stonkfun-xyz": 91, "parasiteonsol-fun": 60, "trendtrader-pro": 272 };

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const geo = (n) => [n.x, n.y, n.w, n.h].map(Math.round).join(",");
const off = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y), Math.abs(a.w - b.w), Math.abs(a.h - b.h));

for (const site of SITES) {
  const SINK = join(ROOT, "sites", site);
  if (!existsSync(join(SINK, "site/document.json"))) { console.log(`  skip  ${site}: no capture at ${SINK} (node capture/fixtures/unpack.mjs)`); continue; }
  const doc = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
  const { browser, page, errors } = await bringSink(BASE, SINK);
  /* The store, not localStorage: a big site's document lives in IndexedDB. */
  const store = () => page.evaluate(() => window.__studioHistory?.doc?.()?.nodes ?? []);
  for (let i = 0; i < 120 && (await store()).length < 50; i++) await page.waitForTimeout(1000);
  /* The first settle: words measured, boxes grown, what is below moved. */
  await page.waitForTimeout(Number(process.env.SETTLE ?? 15000));
  const nodes = await store();
  const byId = new Map(nodes.map((n) => [n.id, n]));
  /* A window: a captured clipping box whose in-flow contents (by the recorded path, as `owns.ts` reads it) run past its foot. */
  const under = (p, k) => k.startsWith(p) && k.slice(p.length).startsWith(" > ");
  const cut = doc.nodes.filter((n) => !n.state && n.featureId === "box" && n.from?.selector && /hidden|clip|auto|scroll/.test(n.art?.overflow ?? ""))
    .map((n) => ({ ...n, over: Math.max(0, ...doc.nodes.filter((k) => k.pageId === n.pageId && !k.state && k.from?.selector && under(n.from.selector, k.from.selector) && k.from.position !== "absolute" && k.from.position !== "fixed").map((k) => k.y + k.h - (n.y + n.h))) }))
    .filter((n) => n.over > 2);
  const grown = cut.filter((d) => { const n = byId.get(d.id); return n && Math.abs(n.h - d.h) > 2; });
  check(`${site}: every captured window keeps its height (${cut.length} windows)`, grown.length === 0, grown.slice(0, 5).map((d) => `${d.id} ${d.h}→${byId.get(d.id).h} (contents run ${d.over} past its foot)`).join(", "));
  const moved = doc.nodes.filter((d) => { const n = byId.get(d.id); return n && !d.state && off(d, n) > 3; });
  check(`${site}: parts off the capture ${moved.length}, not more than base's ${MOVED_ON_BASE[site] ?? "?"}`, moved.length <= (MOVED_ON_BASE[site] ?? Infinity), moved.slice(0, 6).map((d) => `${d.id} ${geo(d)}→${geo(byId.get(d.id))}`).join("; "));
  check(`${site}: no page errors`, errors.length === 0, errors[0]);
  await browser.close();
}
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
