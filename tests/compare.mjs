#!/usr/bin/env node
/**
 * COMPARE PUTS TWO SITES AT THE SAME WIDTH, SIDE BY SIDE FIRST, SCROLLING AS ONE.
 *
 * J (2026-10-23): "both side by side and a slider, side by side first". The
 * view is /builder/compare?a=<site>&b=<site> (src/features/studio/compare/),
 * two SitePreviews of two stored documents. Held here on the sol face (800
 * parts, 1440 wide) and the copy Duplicate makes of it:
 *
 *   0. the sums: the query string both ways, the wipe from a pointer, the
 *      pane width, the page that stands for another site's page;
 *   1. reached from the card: a copy's card has a Compare control that goes to
 *      the original beside it, and a site with no original goes to a page that
 *      asks for the other one;
 *   2. side by side is how it opens, A is the original and B the copy, each
 *      pane draws its own site's parts, and the two are the same width;
 *   3. the scroll lock holds both ways, and lets go when it is turned off;
 *   4. told apart (the copy given a veil): the pane of the copy has it and
 *      the original's does not, so a pane is not showing the wrong site;
 *   5. the slider: A is to the left of the handle and B to the right, at
 *      the middle, at the far right (all A) and the far left (all B), by pixels;
 *      it follows the pointer, and one scroll moves both.
 *
 *   npm run build && npx next start -p 3071
 *   node tests/compare.mjs http://127.0.0.1:3071
 *
 * Covers: src/features/studio/compare/model.ts, src/features/studio/compare/ComparePage.tsx, src/features/studio/compare/Wipe.tsx, src/features/studio/compare/scrollLock.ts, src/features/studio/compare/useDocs.ts, src/features/builds/store.ts, src/features/builds/BuildsPage.tsx, src/features/builds/index.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { openBoard } from "./lib/board.mjs";
import { compareHref, matchPage, paneWidth, readSides, wipeAt, writeSides } from "../src/features/studio/compare/model.ts";

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:3071";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* 0. */
check("0. the query string reads and writes both ways", JSON.stringify(readSides("?a=x&b=y&mode=slider")) === '{"a":"x","b":"y","mode":"slider"}' && JSON.stringify(readSides("")) === '{"a":null,"b":null,"mode":"side"}' && writeSides({ a: "x", b: "y", mode: "side" }) === "?a=x&b=y" && writeSides({ a: "x", b: null, mode: "slider" }) === "?a=x&mode=slider");
check("…a link to a pair", compareHref("s1", "s2") === "/builder/compare?a=s1&b=s2" && compareHref("s1") === "/builder/compare?a=s1");
check("…the wipe follows the pointer and stays in the box", wipeAt(150, 100, 200) === 25 && wipeAt(0, 100, 200) === 0 && wipeAt(999, 100, 200) === 100 && wipeAt(5, 0, 0) === 50);
check("…each pane is half the room less the gap side by side, all of it for the slider", paneWidth(1000, "side", 16) === 492 && paneWidth(1000, "slider", 16) === 1000);
const pages = { pages: [{ id: "p1", name: "Home" }, { id: "p2", name: "About" }] };
check("…the page that stands for another site's page: same id, same name, same place, else the first", matchPage(pages, { id: "p2", name: "x", index: 0 }) === "p2" && matchPage(pages, { id: "q", name: "About", index: 0 }) === "p2" && matchPage(pages, { id: "q", name: "z", index: 1 }) === "p2" && matchPage(pages, { id: "q", name: "z", index: 9 }) === "p1");

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());

/* 1. */
await openBoard(ui, URL_BASE, "solface", { path: "/builds" });
await ui.waitForSelector("[data-builds-list] li");
const sol = await ui.evaluate(() => JSON.parse(localStorage.getItem("builder.builds")).state.activeId);
const plain = await ui.$eval("[data-builds-list] li [data-card-compare]", (a) => a.getAttribute("href"));
check("1. the original's card links to a page that asks for the other site", plain === `/builder/compare?a=${sol}`, plain);
await ui.click('[aria-label="Duplicate this site"]');
await ui.waitForFunction(() => document.querySelectorAll("[data-builds-list] li").length === 2, null, { timeout: 30_000 });
const copy = await ui.evaluate((sol) => JSON.parse(localStorage.getItem("builder.builds")).state.projects.find((p) => p.id !== sol).id, sol);
const versionOf = await ui.evaluate((copy) => JSON.parse(localStorage.getItem("builder.builds")).state.projects.find((p) => p.id === copy).versionOf, copy);
check("…Duplicate records which site the copy came from", versionOf?.project === sol && versionOf.made > 0, JSON.stringify(versionOf));
const href = await ui.$eval(`[data-builds-list] li [href*="b=${copy}"]`, (a) => a.getAttribute("href"));
check("…the copy's card links to the original beside it", href === `/builder/compare?a=${sol}&b=${copy}`, href);
await ui.click(`[data-builds-list] li [href*="b=${copy}"]`);
await ui.waitForSelector("[data-compare-pane=b] [data-compare-scroll], [data-compare-pane=b]", { timeout: 30_000 });

/** What is drawn in a pane: its parts, its veil, its width. */
const paneInfo = (which) => ui.evaluate((which) => {
  const pane = document.querySelector(`[data-compare-pane=${which}]`);
  const scroller = pane?.querySelector("[data-compare-scroll]") ?? pane?.closest("[data-compare-scroll]") ?? document.querySelector("[data-compare-scroll]");
  return {
    id: pane?.getAttribute("data-site-id") ?? null,
    parts: pane?.querySelectorAll("[inert] > div.absolute.overflow-hidden").length ?? 0,
    veil: !!pane?.querySelector('[inert] > div[style*="0.37"]'),
    width: scroller?.clientWidth ?? 0,
  };
}, which);
const ready = async () => {
  for (let i = 0; i < 80; i++) { const [a, b] = [await paneInfo("a"), await paneInfo("b")]; if (a.parts > 100 && b.parts > 100) return; await ui.waitForTimeout(250); }
};
await ready();

/* 2. */
const A = await paneInfo("a");
const B = await paneInfo("b");
const mode = await ui.$eval("[data-compare]", (e) => e.getAttribute("data-compare-mode"));
check("2. it opens side by side", mode === "side" && (await ui.$$("[data-compare-stage=side]")).length === 1, mode);
check("…A is the original and B is the copy", A.id === sol && B.id === copy, `${A.id} ${B.id}`);
check("…each pane draws its own site's parts (the sol face, 800)", A.parts > 700 && A.parts === B.parts, `${A.parts} ${B.parts}`);
check("…at the same width, half the room each", A.width === B.width && A.width > 500 && A.width < 740, `${A.width} ${B.width}`);
const names = await ui.$$eval("[data-compare-name]", (e) => e.map((x) => x.textContent));
check("…each is named", names.length === 2 && /SOL FACE/.test(names[0]) && /copy$/.test(names[1]), names.join(" | "));
const drawn = await ui.$eval("[data-compare-width]", (e) => e.textContent);
check("…it says it is drawn at 1440, as captured", /1440/.test(drawn) && /as captured/.test(drawn), drawn);

/* 3. */
const tops = () => ui.evaluate(() => [...document.querySelectorAll("[data-compare-scroll]")].map((e) => Math.round(e.scrollTop)));
const scrollTo = (i, y) => ui.evaluate(({ i, y }) => { document.querySelectorAll("[data-compare-scroll]")[i].scrollTop = y; }, { i, y });
const settle = async (want) => { for (let i = 0; i < 20; i++) { const t = await tops(); if (want(t)) return t; await ui.waitForTimeout(100); } return tops(); };
const room = await ui.evaluate(() => { const e = document.querySelector("[data-compare-scroll]"); return e.scrollHeight - e.clientHeight; });
check("3. the panes have a page to scroll", room > 1500, String(room));
await scrollTo(0, 700);
const t1 = await settle(([a, b]) => b === 700);
check("…scrolling A moves B to the same place", t1[0] === 700 && t1[1] === 700, t1.join());
await scrollTo(1, 300);
const t2 = await settle(([a]) => a === 300);
check("…scrolling B moves A", t2[0] === 300 && t2[1] === 300, t2.join());
await ui.click("[data-compare-lock]");
await scrollTo(0, 900);
await ui.waitForTimeout(400);
const t3 = await tops();
check("…with Scroll together off, they part", t3[0] === 900 && t3[1] === 300, t3.join());
await ui.click("[data-compare-lock]");
const t4 = await settle(([a, b]) => a === b);
check("…and turned back on they meet again", t4[0] === t4[1], t4.join());

/* 4. */
/* The copy's document is too big for localStorage, so it is changed where it lives (IndexedDB) and the mirror left as a pointer to it. */
await ui.evaluate(async (copy) => {
  const open = await new Promise((done) => { const o = indexedDB.open("builder.docs"); o.onsuccess = () => done(o.result); });
  const store = (mode) => open.transaction("docs", mode).objectStore("docs");
  const text = await new Promise((done) => { const r = store("readonly").get(`builder.doc:${copy}`); r.onsuccess = () => done(r.result); });
  const v = JSON.parse(text);
  v.state.look = { ...(v.state.look ?? {}), veil: 0.37 };
  const out = JSON.stringify(v);
  await new Promise((done) => { const t = open.transaction("docs", "readwrite"); t.objectStore("docs").put(out, `builder.doc:${copy}`); t.oncomplete = done; });
  open.close();
  localStorage.setItem(`builder.doc:${copy}`, JSON.stringify({ idb: true, bytes: out.length, pages: v.state.pages.length, parts: v.state.nodes.length, siteRepo: null }));
}, copy);
await ui.goto(`${URL_BASE}/builder/compare?a=${sol}&b=${copy}`, { waitUntil: "networkidle" });
await ready();
const A2 = await paneInfo("a");
const B2 = await paneInfo("b");
check("4. the copy's pane has the copy's veil and the original's has none", B2.veil && !A2.veil && A2.id === sol && B2.id === copy, `${A2.veil} ${B2.veil}`);
await ui.goto(`${URL_BASE}/builder/compare?a=${copy}&b=${sol}`, { waitUntil: "networkidle" });
await ready();
const A3 = await paneInfo("a");
const B3 = await paneInfo("b");
check("…and chosen the other way round, the panes swap", A3.veil && !B3.veil && A3.id === copy && B3.id === sol, `${A3.veil} ${B3.veil}`);

/* 5. */
await ui.goto(`${URL_BASE}/builder/compare?a=${sol}&b=${copy}&mode=slider`, { waitUntil: "networkidle" });
await ready();
const handle = ui.locator("[data-compare-handle]");
const scroller = ui.locator("[data-compare-scroll]");
const box = await scroller.boundingBox();
const wipe = async () => Number(await handle.getAttribute("data-compare-wipe"));
check("5. the slider opens in the middle, one pane for both", (await wipe()) === 50 && (await ui.$$("[data-compare-scroll]")).length === 1);
const shot = async () => {
  const png = await scroller.screenshot();
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height, c: info.channels };
};
/** Mean absolute difference of two shots over the columns [x0, x1) (they are the same size). */
const diff = (p, q, x0, x1) => {
  let sum = 0, n = 0;
  for (let y = 0; y < p.h; y += 3) for (let x = x0; x < x1; x += 2) for (let k = 0; k < 3; k++) { sum += Math.abs(p.data[(y * p.w + x) * p.c + k] - q.data[(y * p.w + x) * p.c + k]); n++; }
  return sum / n;
};
await handle.focus();
await ui.keyboard.press("End");
const allA = await shot();
const atEnd = await wipe();
await ui.keyboard.press("Home");
const allB = await shot();
const atHome = await wipe();
check("…End puts the handle at the right (all A) and Home at the left (all B)", atEnd === 100 && atHome === 0, `${atEnd} ${atHome}`);
const W = allA.w;
const darker = diff(allA, allB, 20, W - 40);
check("…A and B look different here (B has its veil), so a pixel says which is showing", darker > 3, darker.toFixed(1));
/* A drag from the handle to a quarter of the way along. */
const hb = await handle.boundingBox();
await ui.mouse.move(hb.x + hb.width / 2, box.y + 200);
await ui.mouse.down();
await ui.mouse.move(box.x + box.width * 0.25, box.y + 200, { steps: 5 });
await ui.mouse.up();
const quarter = await wipe();
check("…dragging the handle follows the pointer", Math.abs(quarter - 25) < 2, String(quarter));
await handle.focus();
await ui.keyboard.press("Home");
for (let i = 0; i < 25; i++) await ui.keyboard.press("ArrowRight");
const mid = await wipe();
check("…the arrow keys move it", mid === 50, String(mid));
await ui.mouse.move(box.x + box.width / 2, box.y + 30);
const half = await shot();
const cut = Math.round(W / 2);
const leftIsA = diff(half, allA, 20, cut - 16);
const leftIsB = diff(half, allB, 20, cut - 16);
const rightIsB = diff(half, allB, cut + 16, W - 40);
const rightIsA = diff(half, allA, cut + 16, W - 40);
check("…at the middle, the left is A", leftIsA < 1 && leftIsB > 2, `${leftIsA.toFixed(2)} vs ${leftIsB.toFixed(2)}`);
check("…and the right is B", rightIsB < 1 && rightIsA > 2, `${rightIsB.toFixed(2)} vs ${rightIsA.toFixed(2)}`);
const before = await ui.evaluate(() => document.querySelector("[data-compare-scroll]").scrollTop);
await ui.evaluate(() => { document.querySelector("[data-compare-scroll]").scrollTop = 600; });
const afterShot = await shot();
check("…one scroll moves both layers (the wipe line stays where it is)", before === 0 && (await wipe()) === 50 && diff(afterShot, half, 20, cut - 16) > 1, "");

await browser.close();
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
