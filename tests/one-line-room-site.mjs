/**
 * A CAPTURED SITE'S ONE-LINE BUTTONS ARRIVE AT THE HEIGHT THE PAGE DREW THEM (the site half of `tests/one-line-room.mjs`).
 *
 * trendtrader-pro's "Markets" tab (n_ctaprimary_644) is 55 tall on the page,
 * 13px words at a recorded leading of 1.6 between 18 and 22 of padding. The
 * board drew its line at 20.8 and grew the tab to 61, its row (n_box_642,
 * n_box_643) to 61, and the panel round them (n_box_537, 1299) to 1305, so the
 * 272 parts under it stood 6px lower than on the page (EDIT-ISSUES #58). Taken
 * in, the tab's line is the room it has (`docTake.ts#fitLeading`), and nothing
 * grows.
 *
 * Held here, given the capture: the tab, its row, its tablist and the panel
 * draw at their captured heights (within a pixel), and every part of the
 * capture is on the board where the capture put it, within a pixel, on the
 * tab's page.
 *
 *   npx next start -p 3013
 *   node tests/one-line-room-site.mjs http://127.0.0.1:3013 <folder with site/document.json of trendtrader-pro>
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { captureParts, importSink } from "./lib/sink.mjs";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3];
if (!SINK) { console.log("usage: node tests/one-line-room-site.mjs <builder url> <capture folder>"); process.exit(2); }
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const want = captureParts(SINK);
const n = await importSink(page, BASE, SINK, { atLeast: Math.floor(want.size * 0.8), settle: 15000 });
check(`the capture arrives (${n} parts of ${want.size})`, n >= want.size * 0.8, `${n}`);

const TAB = "n_ctaprimary_644", ROW = ["n_box_642", "n_box_643", "n_box_537"];
const tab = want.get(TAB);
if (!tab) { console.log("  (this capture has no n_ctaprimary_644: not trendtrader-pro)"); }
else {
  await page.evaluate((id) => window.__studioHistory.act("setActivePage", id), tab.pageId);
  await page.waitForTimeout(12000);
  const store = await page.evaluate(() => Object.fromEntries(window.__studioHistory.doc().nodes.map((m) => [m.id, { x: m.x, y: m.y, w: m.w, h: m.h, pageId: m.pageId, leading: m.font?.leading ?? null }])));
  const drawn = await page.evaluate((ids) => Object.fromEntries(ids.map((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); if (!el) return [id, null]; const fr = document.querySelector("[data-frame]").getBoundingClientRect(); const z = fr.width / 1440; const r = el.getBoundingClientRect(); return [id, Math.round(r.height / z)]; })), [TAB, ...ROW]);
  check(`the tab's leading is the room it has (${store[TAB]?.leading})`, store[TAB]?.leading !== null && store[TAB].leading < 1.2, `${store[TAB]?.leading}`);
  check(`the tab draws at its captured ${tab.h}, not 61`, drawn[TAB] !== null && Math.abs(drawn[TAB] - tab.h) <= 1, `drawn ${drawn[TAB]}`);
  for (const id of ROW) check(`${id} draws at its captured ${want.get(id).h}`, drawn[id] !== null && Math.abs(drawn[id] - want.get(id).h) <= 1, `drawn ${drawn[id]}`);
  /* The panel round the tab and everything in it: the 272 parts the grown tab pushed down. (The page's cookie paragraph, elsewhere, grows to its own words; not this row's.) */
  const panel = want.get("n_box_537");
  const inside = (c) => c.pageId === tab.pageId && !c.state && c.y >= panel.y && c.y + c.h <= panel.y + panel.h + 1;
  const moved = [];
  for (const [id, c] of want) { const s = store[id]; if (!s || !inside(c)) continue; if (Math.abs(s.y - c.y) > 1 || Math.abs(s.h - c.h) > 1) moved.push(`${id} ${c.y},${c.h}→${s.y},${s.h}`); }
  check(`every part in the tab's panel stands where the capture put it (${moved.length} moved of ${[...want.values()].filter(inside).length})`, moved.length === 0, moved.slice(0, 8).join("; "));
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
