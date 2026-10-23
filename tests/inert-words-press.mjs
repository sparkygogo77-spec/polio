/**
 * WORDS THE PAGE MADE INERT ARE STILL PRESSED AND OPENED ON THE BOARD.
 *
 * mochi.trade's hero heading, "Create your own AI trading agent.", is
 * `pointer-events: none` on the page so its canvas of creatures takes the
 * pointer. The import keeps that as `inert`, and the board let a press on any
 * inert part through to what is under it, which is right for a grain sheet over
 * the window (`tests/board-inert.mjs`) and wrong for words: a press on the
 * heading picked the canvas, and two presses never opened its words (the
 * hand-edit pass on a fresh import, 2026-10-22).
 *
 * Held here, on a canvas picture with an inert heading over it and an inert
 * grain box over both:
 *   · a press on the heading picks the heading;
 *   · two presses open its words;
 *   · a press on bare canvas still picks the canvas (the grain lets it through).
 *
 *   npx next start -p 3013
 *   node tests/inert-words-press.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("canvas", "picture", "", 100, 100, 1000, 600, { colour: { bg: "#203040" } }),
    node("hero", "value-prop", "Create your own agent.", 300, 300, 600, 80, { inert: true, colour: { text: "rgb(245, 245, 246)" } }),
    node("grain", "box", "", 0, 0, 1440, 900, { inert: true, opacity: 0.05, colour: { bg: "#ffffff" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "INERT", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="hero"]', { timeout: 20000 });
await page.waitForTimeout(1500);
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const away = async () => { await page.keyboard.press("Escape"); await page.evaluate(() => window.__studioHistory.act("setSelection", [])); await page.waitForTimeout(300); };
const words = await page.evaluate(() => { const el = document.querySelector('[data-node-id="hero"]'); const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); for (let t = tw.nextNode(); t; t = tw.nextNode()) if (t.textContent.trim()) { const r = document.createRange(); r.selectNodeContents(t); const q = r.getClientRects()[0]; return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; } return null; });

await away();
await page.mouse.click(words.x, words.y); await page.waitForTimeout(400);
check("a press on the inert heading's words picks the heading", JSON.stringify(await selection()) === '["hero"]', JSON.stringify(await selection()));
await away();
await page.mouse.dblclick(words.x, words.y); await page.waitForTimeout(500);
check("two presses open its words", await page.locator('[data-words-in-place="hero"]').count() === 1);
await away();
const c = await page.locator('[data-node-id="canvas"]').boundingBox();
await page.mouse.click(c.x + 30, c.y + c.height - 30); await page.waitForTimeout(400);
check("a press on bare canvas picks the canvas: the inert grain still lets it through", JSON.stringify(await selection()) === '["canvas"]', JSON.stringify(await selection()));

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
