#!/usr/bin/env node
/**
 * RESET ON LOOK > COLOURS PUTS EVERY PART BACK (J, 2026-10-09).
 *
 * J rolled a theme on PonsStars, pressed Reset, and the board no longer
 * matched the site: black bars across the page, words on highlighted
 * backgrounds. Reset put the six roles back and left every part the roll had
 * repainted in its rolled colour. Held here, on the saved PST board:
 *
 *   1. a theme roll repaints parts;
 *   2. after two rolls, Reset puts every part's colours back to the import's
 *      (slots, runs, edges, art, aura) and the roles to the site's own;
 *   3. the board draws what it drew before the rolls;
 *   4. Reset is one undo step, and after it the button can go away.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/colours-reset.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/SiteColours.tsx, src/features/studio/look/siteColours.ts, src/features/studio/board/store/view.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
/* Key order is not a colour: compare with keys sorted, undefined left out. */
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().filter((k) => x[k] !== undefined).map((k) => [k, x[k]])) : x));
const colours = (n) => canon({ colour: n.colour ?? null, edge: n.edge ?? null, art: n.art ?? null, aura: n.aura ?? null, content: Array.isArray(n.content) ? n.content : null });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => r.abort());
await openBoard(page, URL_BASE, "pst");
await page.evaluate(() => window.__studioSetLeftPanel?.("look"));
await page.waitForSelector("[data-site-colours]", { timeout: 30000 });
const state = () => page.evaluate(() => window.__studioPublishDoc());
const press = (sel) => page.locator(sel).first().evaluate((b) => b.click());
/* What the board draws: every part's own fill, words and edge colour. */
const drawn = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-studio-pane] [data-node-id]")].map((e) => {
  const s = getComputedStyle(e);
  return [e.getAttribute("data-node-id"), `${s.backgroundColor}|${s.color}|${s.borderTopColor}`];
})));

const s0 = await state();
const d0 = await drawn();
const want = Object.fromEntries(Object.entries(s0.look.paletteFrom ?? {}).map(([r, v]) => [r, v.colour]));

/* 1. */
await press("[data-randomize-theme] button");
await page.waitForTimeout(600);
await press("[data-randomize-theme] button");
await page.waitForTimeout(600);
const rolled = await state();
const before = new Map(s0.nodes.map((n) => [n.id, colours(n)]));
const moved = rolled.nodes.filter((n) => before.get(n.id) !== colours(n)).length;
check("1. two theme rolls repaint the site's parts", moved >= 20, `${moved} parts`);

/* 2. */
const depth = await page.evaluate(() => window.__studioUndoDepth());
await press("[data-colours-reset]");
await page.waitForTimeout(800);
const reset = await state();
const off = reset.nodes.filter((n) => before.get(n.id) !== colours(n));
check("2. Reset puts every part's colours back to the import's", off.length === 0, `${off.length} parts still off${off[0] ? `, e.g. ${off[0].id}: ${colours(off[0])} was ${before.get(off[0].id)}` : ""}`);
check("…and the roles to the site's own", canon(reset.look.palette) === canon(want), canon(reset.look.palette));

/* 3. */
const d1 = await drawn();
const diff = Object.keys(d0).filter((id) => id in d1 && d0[id] !== d1[id]);
check("3. the board draws what it drew before the rolls", Object.keys(d0).length > 100 && diff.length === 0, `${diff.length} of ${Object.keys(d0).length} drawn parts differ${diff[0] ? `, e.g. ${diff[0]}: ${d1[diff[0]]} was ${d0[diff[0]]}` : ""}`);

/* 4. */
check("4. Reset is one undo step", (await page.evaluate(() => window.__studioUndoDepth())) === depth + 1);
await page.evaluate(() => document.activeElement?.blur?.());
await page.keyboard.press("Control+z");
await page.waitForTimeout(600);
const undone = await state();
check("…and one Undo brings the second roll back", canon(undone.nodes.map(colours)) === canon(rolled.nodes.map(colours)));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
