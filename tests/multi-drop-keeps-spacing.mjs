#!/usr/bin/env node
/**
 * SEVERAL PARTS LET GO TOGETHER KEEP THEIR SPACING, AND A LOCKED ONE STAYS.
 *
 * THE FAULT. When no guide caught a drop, the grid snap ran part by part:
 * each one's x and y rounded to the 8px grid on its own. Two parts 10px
 * apart, as a captured site has them, landed 8 or 16 apart, so every
 * multi-part move bent the layout further from the live site. A control and
 * its words already snapped as one (the lead's step, taken by all); a plain
 * pick did not, because its list of riders is empty. And that per-part snap
 * had no locked check, so a locked part in the pick, which stood still for
 * the whole drag, jumped up to 4px on release.
 *
 * WHAT IS CHECKED. Three parts in one (unlocked) group, the third locked,
 * placed so the dragged pick meets no guide (no other part; page edges,
 * middle and foot well away). A press on the first picks the group and
 * drags it by an odd distance. After release:
 *
 *   1. the lead is on the grid (the drop still snaps);
 *   2. the second part is exactly as far from it as before (10, 100);
 *   3. the locked part has not moved at all.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/multi-drop-keeps-spacing.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/board/DesktopCanvas.tsx, src/features/studio/board/pressRead.ts
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, content, x, y, extra = {}) => ({
  id, pageId: "p0", featureId: "value-prop", label: id, prompt: "", content, data: "", x, y, w: 100, h: 40, groupId: "g1", options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/*
 * Off the grid on purpose (203, 213: 10 apart), and nowhere near a guide:
 * the page is 1440 wide (guides at 0, 720, 1440) and 900 tall (0, 450, 900),
 * and the pick's own edges, moved by about 37,53, sit at x 240/690/1140 and
 * y 254/324/394.
 */
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("a", "A", 203, 201),
    node("b", "B", 213, 301),
    node("c", "C", 1003, 205, { locked: true }),
  ],
  groups: [{ id: "g1", pageId: "p0", label: "Row", prompt: "", hue: 40 }],
  shapes: [], format: {}, brief: { name: "SPACING", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
await context.route("**/api/studio/**", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
const page = await context.newPage();
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

const at = () => page.evaluate(() => Object.fromEntries(window.__studioNodes().map((n) => [n.id, { x: n.x, y: n.y }])));
const onGrid = (v) => v % 8 === 0;

const before = await at();
check("the three parts are on the board where they were put", before.a?.x === 203 && before.b?.x === 213 && before.c?.x === 1003, JSON.stringify(before));

/* Board → screen off a part's own width (100 on the board). */
const box = await page.locator('[data-node-id="a"]').boundingBox();
const k = box.width / 100 || 1;
const from = [box.x + box.width / 2, box.y + box.height / 2];
await page.mouse.move(...from);
await page.mouse.down();
for (let i = 1; i <= 10; i++) {
  await page.mouse.move(from[0] + (37 * k * i) / 10, from[1] + (53 * k * i) / 10);
  await page.waitForTimeout(30);
}
await page.mouse.up();
await page.waitForTimeout(600);

const after = await at();
check("the pick moved", after.a && (after.a.x !== 203 || after.a.y !== 201), `${JSON.stringify(before.a)} → ${JSON.stringify(after.a)}`);
check("the lead landed on the grid", onGrid(after.a?.x) && onGrid(after.a?.y), JSON.stringify(after.a));
check("the second part kept its spacing from the lead", after.b?.x - after.a?.x === 10 && after.b?.y - after.a?.y === 100, `${after.b?.x - after.a?.x}, ${after.b?.y - after.a?.y} (was 10, 100)`);
check("the locked part did not move", after.c?.x === 1003 && after.c?.y === 205, JSON.stringify(after.c));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
