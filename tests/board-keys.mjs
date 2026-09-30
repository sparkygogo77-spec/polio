/**
 * THE BOARD'S KEYS: ESCAPE STEPS OUT, THE ARROWS NUDGE, COPY AND PASTE.
 *
 * Escape did nothing with a part picked, and Draw a space stayed in the hand
 * after it. The arrows scrolled the page under a picked part, and there was
 * cut and paste but no copy. Held here:
 *
 *   · Escape puts a drawing tool down and takes Select back;
 *   · Escape steps out one level at a time: from the words to the button
 *     that holds them, from the button to nothing picked;
 *   · an arrow moves what is picked one pixel, ten with Shift, and a run of
 *     nudges is one step of undo;
 *   · Ctrl+C holds a copy and leaves the part where it is, Ctrl+V puts the
 *     copy down, and a button is copied with the words it holds.
 *
 * The document is made here: a button with words over it.
 *
 *   npx next start -p 3013
 *   node tests/board-keys.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
mkdirSync(".screenshots", { recursive: true });
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
    node("go", "box", "", 200, 200, 320, 72, { data: "button, named GO", colour: { bg: "#2f7de1" } }),
    node("go_words", "value-prop", "GO", 216, 212, 288, 48),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "KEYS", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="go_words"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const nodes = async () => (await saved()).nodes ?? [];
const nodeOf = async (id) => (await nodes()).find((n) => n.id === id);
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
/* The tool in hand, as the board wears it. */
const tool = () => page.evaluate(() => document.querySelector("[data-board-tool]")?.getAttribute("data-board-tool") ?? "none");
const centre = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const press = async (k) => { await page.keyboard.press(k); await page.waitForTimeout(250); };

/* Escape puts a drawing tool down */
await page.mouse.click(1420, 880);
await press("s");
check("S takes up Draw a space", (await tool()) === "space", await tool());
await press("Escape");
check("Escape puts it down: Select is back in hand", (await tool()) === "select", await tool());
await press("d");
await press("Escape");
check("…and the same for Draw", (await tool()) === "select", await tool());

/* Escape steps out one level at a time */
const c = await centre("go_words");
await page.mouse.dblclick(c.x, c.y);
await page.waitForTimeout(500);
check("two presses open the words", await page.locator('[data-words-in-place="go_words"]').count() === 1);
await press("Escape");
check("Escape leaves the words: they stay picked", JSON.stringify(await selection()) === '["go_words"]' && await page.locator("[data-words-in-place]").count() === 0, JSON.stringify(await selection()));
await press("Escape");
check("Escape again picks the button that holds them", JSON.stringify(await selection()) === '["go"]', JSON.stringify(await selection()));
await press("Escape");
check("Escape again picks nothing", (await selection()).length === 0, JSON.stringify(await selection()));

/* the arrows nudge */
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(300);
const at0 = { b: await nodeOf("go"), w: await nodeOf("go_words") };
await press("ArrowRight");
await press("ArrowRight");
await press("Shift+ArrowDown");
const at1 = { b: await nodeOf("go"), w: await nodeOf("go_words") };
check("two rights and a Shift+down move the button 2 across and 10 down", at1.b.x - at0.b.x === 2 && at1.b.y - at0.b.y === 10, `${at1.b.x - at0.b.x}, ${at1.b.y - at0.b.y}`);
check("…and its words go with it", at1.w.x - at0.w.x === 2 && at1.w.y - at0.w.y === 10, `${at1.w.x - at0.w.x}, ${at1.w.y - at0.w.y}`);
await press("Control+z");
const at2 = await nodeOf("go");
check("one undo takes the run of nudges back", at2.x === at0.b.x && at2.y === at0.b.y, `${at2.x},${at2.y} vs ${at0.b.x},${at0.b.y}`);

/* copy and paste */
await page.mouse.click(1420, 880);
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(300);
check("the button is picked to copy", JSON.stringify(await selection()) === '["go"]', JSON.stringify(await selection()));
const n0 = (await nodes()).length;
await press("Control+c");
check("Ctrl+C leaves the parts where they are", (await nodes()).length === n0 && !!(await nodeOf("go")));
await press("Control+v");
const after = await nodes();
check("Ctrl+V puts down a copy of the button and its words", after.length === n0 + 2, `${n0} -> ${after.length}`);
const copies = after.filter((n) => !["go", "go_words"].includes(n.id));
const words = (n) => (typeof n.content === "string" ? n.content : (n.content ?? []).map((s) => s.text).join(""));
check("…the copied words read the same", copies.some((n) => words(n) === "GO"), copies.map(words).join(","));
await press("Control+v");
check("…and a second paste puts down another", (await nodes()).length === n0 + 4, `${(await nodes()).length}`);
await page.screenshot({ path: ".screenshots/board-keys-pasted.png" });

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
