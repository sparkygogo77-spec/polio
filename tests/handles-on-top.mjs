/**
 * A PICKED PART'S HANDLES ARE OVER EVERYTHING: A DRAG ON THE CORNER RESIZES IT.
 *
 * sol face's "ENTER THE TRENCHES" heading has its card's sticker over its right
 * end. Picked, its corner handle was drawn under the sticker, and a drag on the
 * corner a person could see moved the card (the hand-edit pass on a fresh
 * import, 2026-10-22). The handles are drawn inside the part, so any part drawn
 * after it covered them.
 *
 * Held here, a heading with a picture drawn over its bottom-right corner:
 *   · picked, the element under its corner handle is the handle;
 *   · a drag on the corner resizes the heading, and the picture stays where it was.
 *
 *   npx next start -p 3013
 *   node tests/handles-on-top.mjs http://127.0.0.1:3013
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
    node("head", "value-prop", "ENTER THE TRENCHES", 200, 300, 400, 80),
    node("sticker", "picture", "", 520, 320, 200, 150, { colour: { bg: "#40a060" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "HANDLES", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="sticker"]', { timeout: 20000 });
await page.waitForTimeout(1500);
const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);

const hb = await page.locator('[data-node-id="head"]').boundingBox();
await page.mouse.click(hb.x + 20, hb.y + 20); await page.waitForTimeout(400);
const handle = page.locator('[data-node-id="head"] > [data-resize="se"]');
const b = await handle.boundingBox();
const x0 = b.x + b.width / 2, y0 = b.y + b.height / 2;
const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e?.getAttribute("data-resize") ? `handle ${e.getAttribute("data-resize")} of ${e.closest("[data-node-id]")?.getAttribute("data-node-id")}` : e?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? e?.tagName; }, [x0, y0]);
check("picked, the heading's corner handle is what lies under the pointer there", top === "handle se of head", top);
const h0 = await nodeOf("head"), s0 = await nodeOf("sticker");
await page.mouse.move(x0, y0); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(x0 + 5 * i, y0 + 4 * i); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(500);
const h1 = await nodeOf("head"), s1 = await nodeOf("sticker");
check("a drag on the corner resizes the heading", h1.w > h0.w && h1.h > h0.h && h1.x === h0.x, `${h0.x},${h0.y} ${h0.w}x${h0.h} -> ${h1.x},${h1.y} ${h1.w}x${h1.h}`);
check("…and the picture over it stays where it was", s1.x === s0.x && s1.y === s0.y && s1.w === s0.w, `${s0.x},${s0.y} -> ${s1.x},${s1.y}`);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
