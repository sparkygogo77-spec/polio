/**
 * A COPY LANDS ON THE PAGE, NOT PAST ITS EDGE.
 *
 * Ctrl+D put every copy 24px down and 24px to the right of the original, so
 * a part near the right edge copied past it: PST's withdraw field (x 1179,
 * 256 wide) copied to 1203 on a 1440 page, and sunkcoin's wallet strip the
 * same (the hand-edit audit, 2026-10-25). The copy was there, off the page
 * and under the panel, and read as "nothing happened".
 *
 * Held here, on a page 1440 wide:
 *   · a part near the right edge copies to the LEFT, 24px down, inside the page;
 *   · a part with room copies to the right, as it did;
 *   · a part as wide as the page copies straight down, at x 0;
 *   · the copies are what is picked, and one Ctrl+Z takes them away.
 *
 *   npx next start -p 3013
 *   node tests/copy-stays-on-page.mjs http://127.0.0.1:3013
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
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("band", "box", "", 0, 0, 1440, 160, { colour: { bg: "#1b2233" } }),
    node("edge", "box", "", 1200, 300, 220, 60, { data: "button, named EDGE", colour: { bg: "#2f7de1" } }),
    node("edge_words", "value-prop", "EDGE", 1212, 306, 196, 48),
    node("roomy", "prose", "A line with room to its right", 100, 500, 400, 40),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "COPY", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="edge_words"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const nodes = () => page.evaluate(() => window.__studioHistory?.doc().nodes ?? []);
const press = async (k, wait = 500) => { await page.keyboard.press(k); await page.waitForTimeout(wait); };
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const pick = async (id) => { await page.evaluate((id) => { window.__studioHistory.act("clearSelection"); window.__studioHistory.act("setSelection", [id]); }, id); await page.waitForTimeout(400); return selection(); };
const words = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));

/* Near the right edge: the copy steps left and down, and stays inside. */
check("the button at the edge is picked", JSON.stringify(await pick("edge")) === '["edge"]', JSON.stringify(await selection()));
let before = await nodes();
await press("Control+d");
let after = await nodes();
let made = after.filter((n) => !before.some((b) => b.id === n.id));
const copy = made.find((n) => n.featureId === "box");
check("Ctrl+D copies the button with its words", made.length === 2 && !!copy && made.some((n) => words(n) === "EDGE"), made.map((n) => `${n.id}:${n.featureId}`).join(", "));
check("the copy stays inside the page", !!copy && copy.x + copy.w <= 1440, copy ? `x ${copy.x} + w ${copy.w} = ${copy.x + copy.w} on 1440` : "no copy");
check("…24px down and 24px to the left", !!copy && copy.x === 1200 - 24 && copy.y === 300 + 24, copy ? `${copy.x},${copy.y}` : "");
const copyWords = made.find((n) => n.featureId === "value-prop");
check("…and its words step the same way", !!copyWords && copyWords.x === 1212 - 24 && copyWords.y === 306 + 24, copyWords ? `${copyWords.x},${copyWords.y}` : "");
check("the copy is what is picked", (await selection()).length === 1 && (await selection())[0] === copy?.id, JSON.stringify(await selection()));
await press("Escape", 200);
await press("Control+z");
check("one Ctrl+Z takes the copies away", (await nodes()).length === before.length, `${(await nodes()).length} of ${before.length}`);

/* With room: to the right, as before. */
check("the roomy line is picked", JSON.stringify(await pick("roomy")) === '["roomy"]');
before = await nodes();
await press("Control+d");
after = await nodes();
made = after.filter((n) => !before.some((b) => b.id === n.id));
check("a part with room copies 24px right and down", made.length === 1 && made[0].x === 124 && made[0].y === 524, made.map((n) => `${n.x},${n.y}`).join(", "));
await press("Escape", 200);
await press("Control+z");

/* As wide as the page: straight down. */
check("the band is picked", JSON.stringify(await pick("band")) === '["band"]');
before = await nodes();
await press("Control+d");
after = await nodes();
made = after.filter((n) => !before.some((b) => b.id === n.id));
check("a page-wide band copies straight down, at x 0", made.length === 1 && made[0].x === 0 && made[0].y === 24, made.map((n) => `${n.x},${n.y},${n.w}`).join(", "));
await press("Escape", 200);
await press("Control+z");

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
