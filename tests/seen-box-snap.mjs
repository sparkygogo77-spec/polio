/**
 * SNAP GUIDES, THE MARQUEE AND A GROUP'S FRAME USE THE BOX YOU SEE (EDIT-ISSUES #36).
 *
 * The board stands a part its own translate shifts where it is drawn (sol face's
 * frog: stored at x 1049, drawn 345px to the left; #35, `tests/boxes-hug.mjs`),
 * but the snap guides, the marquee and a held group's frame read the stored box,
 * so the frog snapped, was caught and was framed by edges nobody could see.
 *
 * Held here, on a "frog" stored at 1049 and shifted -345 by its own transform:
 *   · a part dragged to 3px off the frog's drawn left edge snaps onto it;
 *   · a marquee round the frog as drawn picks it;
 *   · a locked group of the frog and a box is framed round what is drawn.
 *
 *   npx next start -p 3590
 *   node tests/seen-box-snap.mjs http://localhost:3590
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
const SHIFT = -345;
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("frog", "picture", "", 1049, 200, 200, 120, { colour: { bg: "#40a060" }, art: { transform: `matrix(1, 0, 0, 1, ${SHIFT}, 0)` } }),
    node("box", "picture", "", 150, 520, 120, 90, { colour: { bg: "#a04060" } }),
    node("mate", "picture", "", 760, 520, 100, 80, { colour: { bg: "#4060a0" }, groupId: "g1" }),
    node("frog2", "picture", "", 1100, 700, 160, 80, { colour: { bg: "#60a040" }, groupId: "g1", art: { transform: `matrix(1, 0, 0, 1, ${SHIFT}, 0)` } }),
  ],
  groups: [{ id: "g1", pageId: "p0", label: "Pair", prompt: "", hue: 200, locked: true }], shapes: [], format: {}, brief: { name: "SEEN", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(/\s+/).filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="frog"]', { timeout: 30000 });
await page.waitForTimeout(1500);
const rect = (id) => page.locator(`[data-node-id="${id}"]`).boundingBox();
const part = (id) => page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id), id);
const away = async () => { await page.keyboard.press("Escape"); await page.evaluate(() => window.__studioHistory.act("setSelection", [])); await page.waitForTimeout(300); };
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id][data-picked]")].map((n) => n.getAttribute("data-node-id")));
const frame = await page.locator("[data-frame]").boundingBox();
const zoom = frame.width / 1440;

/* 1. Snap onto the frog's drawn left edge. */
const f = await rect("frog");
check("the frog is drawn at its box plus its own shift", Math.abs((f.x - frame.x) / zoom - (1049 + SHIFT)) < 1.5, `${((f.x - frame.x) / zoom).toFixed(1)} on the page`);
await away();
const b = await rect("box");
const from = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
const want = f.x + 3 * zoom - b.x; /* 3 page px off the drawn edge */
await page.mouse.move(from.x, from.y);
await page.mouse.down();
for (let i = 1; i <= 12; i++) await page.mouse.move(from.x + (want * i) / 12, from.y + 4 * i, { steps: 1 });
await page.waitForTimeout(150);
await page.mouse.up();
await page.waitForTimeout(500);
const box = await part("box");
check("a part dragged 3px off the frog's drawn left edge snaps onto it", box.x === 1049 + SHIFT, `box.x ${box.x}, drawn edge ${1049 + SHIFT}`);
await page.evaluate(() => window.__studioHistory.act("undo"));
await page.waitForTimeout(400);

/* 2. A marquee round the frog as drawn. */
await away();
const f2 = await rect("frog");
const pad = 8 * zoom;
await page.mouse.move(f2.x - pad, f2.y - pad);
await page.mouse.down();
for (let i = 1; i <= 10; i++) await page.mouse.move(f2.x - pad + ((f2.width + 2 * pad) * i) / 10, f2.y - pad + ((f2.height + 2 * pad) * i) / 10);
await page.mouse.up();
await page.waitForTimeout(400);
check("a marquee round the frog as drawn picks it", JSON.stringify(await selection()) === '["frog"]', JSON.stringify(await selection()));

/* 3. A locked group's frame. */
await away();
await page.evaluate(() => window.__studioHistory.act("setSelection", ["mate", "frog2"]));
await page.waitForTimeout(500);
const drawn = await page.evaluate(() => { const rs = ["mate", "frog2"].map((id) => document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect()); return { l: Math.min(...rs.map((r) => r.left)), r: Math.max(...rs.map((r) => r.right)) }; });
const handles = await page.evaluate(() => [...document.querySelectorAll("[data-group-resize]")].map((h) => { const r = h.getBoundingClientRect(); return r.left + r.width / 2; }));
const fl = handles.length ? Math.min(...handles) : NaN, fr = handles.length ? Math.max(...handles) : NaN;
check("a locked group's frame stands round what is drawn", handles.length > 0 && Math.abs(fl - drawn.l) < 6 && Math.abs(fr - drawn.r) < 6, `frame ${fl?.toFixed?.(0)}–${fr?.toFixed?.(0)}, drawn ${drawn.l.toFixed(0)}–${drawn.r.toFixed(0)}`);

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
