#!/usr/bin/env node
/**
 * THE BOARD FOLLOWS A HOVERED ROW.
 *
 * J (2026-10-09): hovering a row in the Element tab's list outlined its part,
 * but "as it goes lower the page does not move to keep up". Every side-panel
 * row that points at a part goes through `pointAt` (SiteColours.tsx), and it
 * now scrolls the board's pane to the part when it is out of view.
 *
 *   1. hovering the row of a part far down the page scrolls the board until
 *      the part is in view, and outlines it;
 *   2. hovering a part already in view does not move the board;
 *   3. hovering back to the top part brings the board back up to it;
 *   4. a hand sweeping past a row (leaving it at once) does not move the board.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/board-follows-hover.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/SiteColours.tsx, src/features/studio/panels/PartTreePanel.tsx
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, words, x, y, w, h) => ({
  id, pageId: "page_home", featureId: "prose", label: id, prompt: "", content: words, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("top", "Words at the top", 100, 100, 600, 60), node("near", "Words near the top", 100, 220, 600, 60), node("middle", "Words in the middle", 100, 1500, 600, 60), node("low", "Words far down", 100, 3200, 600, 60)],
  groups: [], shapes: [], format: {}, brief: { name: "FOLLOW", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); localStorage.setItem("builder.elementsNesting", "0"); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const side = page.locator("[data-side-panel]");
await side.getByRole("radio", { name: "Element" }).first().click({ force: true });
await page.waitForTimeout(700);

const row = (id) => side.locator(`[data-list-row="${id}"]`).first();
const where = (id) => page.evaluate((id) => {
  const pane = document.querySelector("[data-studio-pane]");
  const el = document.querySelector(`[data-studio-scroll] [data-node-id="${id}"]`);
  const p = pane.getBoundingClientRect(), r = el.getBoundingClientRect();
  return { scroll: Math.round(pane.scrollTop), inView: r.top >= p.top && r.bottom <= p.bottom, marks: [...document.querySelectorAll("[data-point-mark]")].map((m) => m.getAttribute("data-point-mark")) };
}, id);
const settle = () => page.waitForTimeout(900);

const rows = await side.locator("[data-list-row]").count();
check("the list shows the page's words", rows === 4, `${rows} rows`);

/* 1. */
const before = await where("low");
await row("low").hover();
await settle();
const low = await where("low");
check("1. hovering a part far down scrolls the board to it", !before.inView && low.inView && low.scroll > before.scroll, JSON.stringify({ before, low }));
check("…and outlines it", low.marks.includes("low"), JSON.stringify(low.marks));

/* 2. */
await row("top").hover();
await settle();
const top = await where("top");
check("3. hovering back to the top brings the board back up", top.inView && top.scroll < low.scroll, JSON.stringify(top));
await row("near").hover();
await settle();
const near = await where("near");
check("2. a part already in view does not move the board", near.scroll === top.scroll, JSON.stringify({ top, near }));

/* 4. */
await row("low").hover();
await page.mouse.move(5, 5);
await settle();
const swept = await where("top");
check("4. sweeping past a row does not move the board", swept.scroll === near.scroll, JSON.stringify({ near, swept }));

check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
