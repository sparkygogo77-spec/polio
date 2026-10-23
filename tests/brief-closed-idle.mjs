/**
 * A CLOSED BOOK OF UPDATES COMPILES NOTHING.
 *
 * The book's dialog stays mounted on the board for the live run it resumes,
 * and it compiled the whole blueprint on every change to the board, for a
 * description nobody could see while it was closed: about 18ms of every
 * edit on a fresh sol face import (the editable-imports pass, 2026-10-23).
 *
 *   · with the book closed, three edits compile the blueprint no times;
 *   · opened (Ctrl+Enter), it compiles it and shows the site's counts.
 *
 *   npx next start -p 3013
 *   node tests/brief-closed-idle.mjs http://127.0.0.1:3013
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
  nodes: [node("head", "value-prop", "A HEADING", 200, 200, 400, 80), node("card", "box", "", 200, 400, 300, 200, { colour: { bg: "#2f7de1" } })],
  groups: [], shapes: [], format: {}, brief: { name: "IDLE", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="card"]', { timeout: 20000 });
await page.waitForTimeout(2000);
const compiled = () => page.evaluate(() => window.__studioCompiled ?? 0);

const c0 = await compiled();
for (let i = 0; i < 3; i++) {
  await page.evaluate((i) => window.__studioHistory.act("updateNode", "card", { x: 200 + (i + 1) * 10 }), i);
  await page.waitForTimeout(400);
}
const c1 = await compiled();
check("with the book closed, three edits compile the blueprint no times", c1 === c0, `${c0} → ${c1}`);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1000);
const c2 = await compiled();
const said = await page.evaluate(() => [...document.querySelectorAll("[role=dialog], [data-book-panel]")].map((d) => d.textContent).join(" ").match(/\d+ pages? · \d+ elements?/)?.[0] ?? null);
check("opened, the book compiles it and shows the site's counts", c2 > c1 && !!said, `${c1} → ${c2}; ${said}`);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
