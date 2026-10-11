#!/usr/bin/env node
/**
 * THE WHEEL'S TRAY OPENS INSIDE THE WINDOW, AND TAB REACHES IT.
 *
 * The tab under the wheel opened, on hover only, into one row that never
 * wrapped, centred under the wheel: twelve to fifteen actions came to well
 * over a thousand pixels, so a part near either side of a 1366 px laptop
 * window had its last actions ("All like this", "All in this font", "Lock
 * the grid") off screen. The tab was a plain span, so Tab never reached it
 * and nothing but hover opened it (dissect #30). Now the row wraps, is moved
 * back inside the window when it opens, and the tab takes focus.
 *
 *   1. At 1366 × 768, the wheel on the leftmost card, a middle part and the
 *      rightmost card (a grid card, so "Lock the grid" makes the tray its
 *      widest): hovered, every action lies inside the window.
 *   2. Opened again, Tab alone reaches the tab, which opens it; Tab walks
 *      on into the actions; Enter on Forward moves the part forward.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/tray-on-screen.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/RingConsole.tsx, src/features/studio/radial/RadialMenu.tsx, src/features/studio/radial/open.ts
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const W = 1366, H = 768;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, x, y, extra = {}) => ({
  id, pageId: "page_home", featureId: "prose", label: id, prompt: "", content: `Words of ${id}`, data: "", x, y, w: 260, h: 90, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0,
  animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1,
  auraStyle: "glow", texture: null, sketch: null, ...extra,
});
/* Four like cards on two rows and two columns are a grid (gridOf.ts): their tray carries "Lock the grid". The odd one in the middle is not. */
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("g1", 10, 80), node("g2", 1170, 80), node("g3", 10, 420), node("g4", 1170, 420),
    node("mid", 560, 240, { w: 320, h: 140, featureId: "hero" }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "TRAY", gimmick: "", master: "" }, activePageId: "page_home", frameWidth: 1440,
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: W, height: H } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
/* The Builder keeps a socket or two open, so "network idle" may never come on a busy machine: wait for its load hook instead. */
await page.goto(`${URL_}/builder`, { waitUntil: "load", timeout: 90_000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "load", timeout: 90_000 });
await page.waitForFunction(() => typeof window.__studioLoadDoc === "function", null, { timeout: 90_000 });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1200);

const close = async () => {
  for (let i = 0; i < 4 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(250); }
};
/* Right press on the part's visible middle, clamped into the window so a card half off the board still opens. */
const openOn = async (id) => {
  await close();
  const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  const x = Math.max(4, Math.min(W - 4, b.x + b.width / 2)), y = Math.max(70, Math.min(H - 4, b.y + b.height / 2));
  await page.mouse.click(x, y, { button: "right" });
  await page.waitForTimeout(700);
  await page.mouse.move(x, Math.max(4, y - 400));
  await page.waitForTimeout(150);
};
const items = () => page.evaluate(() => [...document.querySelectorAll('[data-tray="part"] [data-tray-item]')].map((b) => {
  const r = b.getBoundingClientRect();
  return { id: b.dataset.trayItem, l: Math.round(r.left), r: Math.round(r.right), t: Math.round(r.top), b: Math.round(r.bottom), w: r.width };
}));

/* ------------------------------------------------------------ 1. inside the window */
const ids = ["g1", "mid", "g4"];
for (const id of ids) {
  await openOn(id);
  const tray = page.locator('[data-tray="part"]').first();
  if (!(await tray.count())) { check(`the wheel on ${id} has its tray`, false); continue; }
  await tray.hover();
  await page.waitForTimeout(400);
  const its = await items();
  const off = its.filter((i) => i.w === 0 || i.l < 0 || i.r > W || i.t < 0 || i.b > H).map((i) => `${i.id} ${i.l}..${i.r}×${i.t}..${i.b}`);
  check(`on ${id}, hovered, all ${its.length} actions are inside the ${W} × ${H} window`, its.length >= 8 && off.length === 0, off.join(" · "));
  if (id !== "mid") check(`…and a grid card's tray carries Lock the grid`, its.some((i) => i.id === "grid-lock"), its.map((i) => i.id).join(" "));
}

/* ------------------------------------------------------------ 2. by keyboard */
await openOn("g1");
const before = (await page.evaluate(() => window.__studioPublishDoc().nodes)).map((n) => n.id);
let reached = false;
for (let i = 0; i < 400 && !reached; i++) {
  await page.keyboard.press("Tab");
  reached = await page.evaluate(() => !!document.activeElement?.closest?.('[data-tray="part"]'));
}
check("Tab alone reaches the tray under the wheel", reached);
await page.waitForTimeout(250);
const open = await items();
check("…and focus opens it: its actions are showing", open.length > 0 && open.every((i) => i.w > 0), `${open.filter((i) => i.w > 0).length}/${open.length} showing`);
let at = null;
for (let i = 0; i < 6 && at !== "forward"; i++) {
  await page.keyboard.press("Tab");
  at = await page.evaluate(() => document.activeElement?.getAttribute?.("data-tray-item") ?? null);
}
check("Tab walks on into the actions, as far as Forward", at === "forward", `focus on ${at}`);
if (at === "forward") {
  await page.keyboard.press("Enter");
  await page.waitForTimeout(400);
  const after = (await page.evaluate(() => window.__studioPublishDoc().nodes)).map((n) => n.id);
  check("Enter on Forward brings the part forward", after.indexOf("g1") > before.indexOf("g1"), `${before.join(" ")} → ${after.join(" ")}`);
}
await close();

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
