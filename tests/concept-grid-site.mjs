#!/usr/bin/env node
/**
 * THE GRID, THROUGH THE REAL DOORS.
 *
 * No Claude call. Held here:
 *
 *   1. Make opens on the grid: a column per concept, a row per section,
 *      Header first; cells of a row are the same height; an empty cell
 *      where a concept lacks the section; the header row draws its menu
 *      (words in it, not a smear);
 *   2. a tick on a cell; one per row (a second tick in the row moves it);
 *      the Your page column shows the ticked section;
 *   3. Whole ticks a column; the ticks line counts them;
 *   4. hover a cell: the other concepts' versions slide out as cards; a
 *      card ticks its concept;
 *   5. keys: with a row under the pointer, 2 ticks the second concept;
 *   6. Again this row changes that section on the concepts and leaves the
 *      other rows byte for byte;
 *   7. See whole page shows the concept whole; Escape closes it;
 *   8. right-press a part in a cell: the Builder opens on that concept with
 *      that part picked;
 *   9. Build the ticked page: a new site with the ticked sections, open in
 *      the Builder; the concepts stay.
 *
 *   npm run build && npx next start -p 3531
 *   node tests/concept-grid-site.mjs http://localhost:3531
 *   SHOTS=<dir>  also saves grid-lantern.png, grid-ticked.png, grid-whole.png there.
 *
 * Covers: src/features/studio/concepts/GridView.tsx, src/features/studio/concepts/grid.ts, src/features/studio/concepts/run.ts, src/features/studio/concepts/ConceptsPage.tsx
 */
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://localhost:3531").replace(/\/$/, "");
const SHOTS = process.env.SHOTS || null;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const finish = async () => { await browser.close(); const failed = results.filter((r) => !r).length; console.log(`\n${results.length - failed}/${results.length} passed`); process.exit(failed ? 1 : 0); };
const PROMPT = "three concepts for a lantern shop landing page";
const hook = (p, what, ...args) => p.evaluate(([w, a]) => { const h = window.__polioConcepts; return h ? h[w](...a) : null; }, [what, args]);
const builds = (p) => p.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state ?? {});
const waitFor = async (p, fn, ms = 60000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await fn()) return true; await p.waitForTimeout(250); } return false; };
const shot = async (p, name) => { if (SHOTS) await p.screenshot({ path: join(SHOTS, name) }); };
const errors = [];

const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => r.abort());
await page.goto(`${BASE}/api/version`, { waitUntil: "load" });
await page.evaluate(() => { const e = (s) => JSON.stringify({ state: s, version: 0 }); for (const k of Object.keys(localStorage)) if (k.startsWith("builder.")) localStorage.removeItem(k); localStorage.setItem("builder.builds", e({ projects: [{ id: "s1", name: "Site 1", updatedAt: Date.now() }], activeId: "s1" })); localStorage.setItem("builder.studio", e({ nodes: [], pages: [{ id: "page_home", name: "Home", path: "/" }] })); });
await page.goto(`${BASE}/builder/concepts`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-concepts-prompt]");
for (let i = 0; i < 20; i++) { await page.fill("[data-concepts-prompt]", ""); await page.locator("[data-concepts-prompt]").pressSequentially(PROMPT, { delay: 2 }); if (await page.locator("[data-concepts-make]:not([disabled])").count()) break; await page.waitForTimeout(500); }
await page.click("[data-concepts-make]");
await waitFor(page, async () => (await page.locator("[data-grid-col]").count()) === 3 && (await page.locator("[data-grid-row]").count()) >= 6 && (await page.locator("[data-grid-cell]:not([data-empty]) *").count()) > 30, 90000);
await page.waitForTimeout(1200);

/* 1. */
const g = Object.values((await hook(page, "groups")) ?? {})[0];
const rowNames = await page.locator("[data-grid-row] span").allTextContents();
const cols = await page.locator("[data-grid-col]").count();
check("1. Make opens on the grid: a column per concept, a row per section, Header first, Footer last", cols === 3 && rowNames[0] === "Header" && rowNames[rowNames.length - 1] === "Footer" && rowNames.length >= 6, rowNames.join(" > "));
const rowKeys = await page.locator("[data-grid-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-grid-row")));
const heights = await page.locator("[data-grid-cell]").evaluateAll((els) => els.map((e) => ({ key: e.getAttribute("data-grid-cell").split(":")[0], h: Math.round(e.getBoundingClientRect().height), empty: e.hasAttribute("data-empty") })));
const byRow = rowKeys.map((k) => heights.filter((h) => h.key === k));
check("…the cells of a row are the same height, and every row has three cells", byRow.every((cells) => cells.length === 3 && new Set(cells.map((c) => c.h)).size === 1), byRow.map((c) => c.map((x) => x.h).join("=")).join(" | "));
check("…an empty cell where a concept lacks the section", heights.some((h) => h.empty) && heights.filter((h) => h.empty).length < heights.length, `${heights.filter((h) => h.empty).length} empty of ${heights.length}`);
const headerWords = await page.locator('[data-grid-cell^="header:"]').evaluateAll((els) => els.map((e) => (e.innerText ?? "").replace(/\s+/g, " ").trim()));
check("…the header row draws its menu: words in every header cell", headerWords.every((w) => w.length >= 8), headerWords.map((w) => w.slice(0, 30)).join(" | "));
await shot(page, "grid-lantern.png");

/* 2. */
const cellOf = (row, col) => page.locator(`[data-grid-cell="${row}:${g.ids[col]}"]`);
await cellOf("first screen", 1).click();
await page.waitForTimeout(300);
check("2. a tick on a cell", (await cellOf("first screen", 1).getAttribute("aria-pressed")) === "true" && (await page.locator("[data-grid-cell][data-ticked]").count()) === 1);
await cellOf("first screen", 2).click();
await page.waitForTimeout(300);
check("…one tick a row: a second tick in the row moves it", (await cellOf("first screen", 2).getAttribute("aria-pressed")) === "true" && (await cellOf("first screen", 1).getAttribute("aria-pressed")) === "false" && (await page.locator("[data-grid-cell][data-ticked]").count()) === 1);
check("…the Your page column shows the ticked section, and nothing for rows without a tick", (await page.locator('[data-grid-yourpage="first screen"]:not([data-empty]) *').count()) > 0 && (await page.locator('[data-grid-yourpage="header"][data-empty]').count()) === 1);

/* 3. */
await page.locator(`[data-grid-col="${g.ids[0]}"] [data-grid-whole]`).click();
await page.waitForTimeout(300);
const c0rows = rowKeys.filter((k) => heights.some((h) => h.key === k && !h.empty && true));
const ticked0 = await page.locator(`[data-grid-cell$=":${g.ids[0]}"][data-ticked]`).count();
const cells0 = await page.locator(`[data-grid-cell$=":${g.ids[0]}"]:not([data-empty])`).count();
check("3. Whole ticks every cell of the column", ticked0 === cells0 && ticked0 >= 5, `${ticked0} of ${cells0}; rows ${c0rows.length}`);
const line = await page.locator("[data-grid-ticks]").textContent();
check("…the ticks line counts them", /Ticks: \d+ from /.test(line ?? ""), line ?? "");
await shot(page, "grid-ticked.png");

/* 4. */
await cellOf("first screen", 1).hover();
await page.waitForTimeout(400);
const cards = await page.locator("[data-grid-cards] [data-grid-card]").count();
check("4. hover a cell: the other concepts' versions slide out as cards", cards === 2, `${cards} cards`);
if (cards) { await page.locator(`[data-grid-card="${g.ids[2]}"]`).click(); await page.waitForTimeout(300); }
check("…a card ticks its concept", (await cellOf("first screen", 2).getAttribute("aria-pressed")) === "true");

/* 5. */
await cellOf("footer", 0).hover();
await page.waitForTimeout(200);
await page.keyboard.press("2");
await page.waitForTimeout(300);
check("5. with a row under the pointer, 2 ticks the second concept", (await cellOf("footer", 1).getAttribute("aria-pressed")) === "true", await cellOf("footer", 1).getAttribute("aria-pressed"));

/* 6. */
const docsBefore = {};
for (const id of g.ids) docsBefore[id] = await hook(page, "doc", id);
const rowAgain = rowKeys.find((k) => !/header|footer|first screen/.test(k) && heights.filter((h) => h.key === k && !h.empty).length >= 2);
const rowName = await page.locator(`[data-grid-row="${rowAgain}"] span`).first().textContent();
await page.locator(`[data-grid-row="${rowAgain}"] [data-grid-again-row]`).click();
await waitFor(page, async () => J(await hook(page, "doc", g.ids[0])) !== J(docsBefore[g.ids[0]]) || J(await hook(page, "doc", g.ids[1])) !== J(docsBefore[g.ids[1]]), 30000);
await page.waitForTimeout(800);
const sec = (label) => { const l = label ?? ""; const at = l.indexOf(": "); if (at < 0) return l.trim(); const head = l.slice(0, at).trim(); return head === "Section" ? l.slice(at + 2).trim() : head; };
let changed = 0, kept = 0;
for (const id of g.ids) {
  const was = docsBefore[id], now = await hook(page, "doc", id);
  const inRow = (ns) => ns.filter((n) => sec(n.label).toLowerCase() === rowAgain);
  /* Order-blind: a redraft may list the parts in another order; what matters is the same parts with the same words at the same x. */
  const outRow = (ns) => ns.filter((n) => sec(n.label).toLowerCase() !== rowAgain).map((n) => `${n.id}|${n.content}|${n.x}`).sort().join(";");
  if (inRow(was.nodes).length && J(inRow(was.nodes).map((n) => n.id).sort()) !== J(inRow(now.nodes).map((n) => n.id).sort())) changed++;
  if (outRow(was.nodes) === outRow(now.nodes)) kept++;
}
check(`6. Again this row ("${rowName}") changes that section on the concepts that have it`, changed >= 2, `${changed} changed; row key ${rowAgain}; c0 in-row before ${J(docsBefore[g.ids[0]].nodes.filter((n) => sec(n.label).toLowerCase() === rowAgain).map((n) => n.id))} after ${J((await hook(page, "doc", g.ids[0])).nodes.filter((n) => sec(n.label).toLowerCase() === rowAgain).map((n) => n.id))}`);
check("…and leaves the other rows as they were (same parts, words and x)", kept === g.ids.length, `${kept} of ${g.ids.length}`);

/* 7. */
await page.locator(`[data-grid-col="${g.ids[1]}"] [data-grid-see-whole]`).click();
await page.waitForTimeout(600);
check("7. See whole page shows the concept whole", (await page.locator(`[data-grid-wholepage="${g.ids[1]}"]`).count()) === 1 && (await page.locator(`[data-grid-wholepage="${g.ids[1]}"] *`).count()) > 20);
await shot(page, "grid-whole.png");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("…Escape closes it", (await page.locator("[data-grid-wholepage]").count()) === 0);

/* 8. */
const target = cellOf("first screen", 0);
await target.scrollIntoViewIfNeeded();
await page.waitForTimeout(200);
const box = await target.boundingBox();
const d0 = await hook(page, "doc", g.ids[0]);
const scale = box.width / 1440;
const h0 = d0.nodes.find((n) => /First screen: heading/.test(n.label));
const firstTop = Math.min(...d0.nodes.filter((n) => sec(n.label) === "First screen").map((n) => n.y));
const px = Math.min(box.width - 2, Math.max(1, (h0.x + 10) * scale)), py = Math.min(box.height - 2, Math.max(1, (h0.y - firstTop + 6) * scale));
await target.click({ button: "right", position: { x: px, y: py } });
await page.waitForURL(/\/builder(#|\?|$)/, { timeout: 30000 });
await waitFor(page, async () => (await page.evaluate(() => (window.__studioHistory?.doc()?.selection ?? window.__studioHistory?.doc()?.nodes?.length) ? true : false)), 30000);
const picked = await waitFor(page, async () => page.evaluate((id) => !!document.querySelector(`[data-node-id="${id}"][data-picked], [data-node-id="${id}"][data-just-shown]`), h0.id), 20000);
const sel = await page.evaluate(() => { try { return window.__studioHistory?.doc()?.selection ?? null; } catch { return null; } });
const b1 = await builds(page);
check("8. right-press a part in a cell: the Builder opens on that concept", b1.activeId === g.ids[0] && (await page.locator("[data-node-id]").count()) > 0);
check("…with that part picked", picked || (Array.isArray(sel) && sel.includes(h0.id)), J({ picked, sel }));
await page.locator("[data-concepts-back]").click();
await page.waitForURL(/\/builder\/concepts/, { timeout: 30000 });
await waitFor(page, async () => (await page.locator("[data-grid-col]").count()) === 3, 30000);
await page.waitForTimeout(800);

/* 9. */
await cellOf("header", 0).click();
await cellOf("first screen", 1).click();
await cellOf("footer", 2).click();
await page.waitForTimeout(300);
const d = {}; for (const id of g.ids) d[id] = await hook(page, "doc", id);
const want = [["Header", 0], ["First screen", 1], ["Footer", 2]].reduce((n, [s, i]) => n + d[g.ids[i]].nodes.filter((x) => sec(x.label) === s).length, 0);
await page.locator("[data-grid-build]").click();
await page.waitForURL(/\/builder(#|\?|$)/, { timeout: 30000 });
await waitFor(page, async () => (await page.evaluate(() => window.__studioHistory?.doc()?.nodes?.length ?? 0)) > 0, 30000);
await page.waitForTimeout(800);
const b2 = await builds(page);
const onBoard = await page.evaluate(() => window.__studioHistory?.doc()?.nodes?.length ?? 0);
const rec = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.concepts") ?? "{}").state ?? {});
check("9. Build the ticked page: a new site with the ticked sections, open in the Builder", b2.activeId && !g.ids.includes(b2.activeId) && onBoard === want && /: Mix$/.test(b2.projects.find((p) => p.id === b2.activeId)?.name ?? ""), J({ onBoard, want, name: b2.projects.find((p) => p.id === b2.activeId)?.name, labels: d[g.ids[0]].nodes.slice(0, 4).map((n) => n.label) }));
check("…the concepts stay, and the built page is no concept", g.ids.every((id) => rec.byId?.[id] && b2.projects.some((p) => p.id === id)) && !rec.byId?.[b2.activeId]);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
await finish();
