/**
 * ONE PRESS PICKS THE BUTTON; TWO PRESSES TYPE ITS WORDS WHERE THEY ARE.
 *
 * A button on a captured page is two parts: the button, and the words drawn
 * over it. A press on the words picked the words, so a drag slid the label
 * off its button and the button could only be reached round its edge. Now:
 *
 *   · one press on the words picks the control that owns them (a button, a
 *     link, a card), and dragging it moves the button with its words;
 *   · a second press goes into the words and they are typed on the canvas,
 *     in the part's own face, over the words they replace;
 *   · Enter keeps what was typed, Escape puts the words back, a press
 *     elsewhere keeps them, and the whole edit is one step of undo;
 *   · Enter on a picked button goes into its words too.
 *
 * The document is made here, not read from any site: a button and a card,
 * each with words over it, and a heading that stands alone.
 *
 *   npx next start -p 3013
 *   node tests/select-owner.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SHOTS = ".screenshots";
mkdirSync(SHOTS, { recursive: true });
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
    node("buy", "box", "", 200, 200, 320, 72, { data: "button, named BUY NOW", colour: { bg: "#e0306a" } }),
    node("buy_words", "value-prop", "BUY NOW", 216, 212, 288, 48),
    node("card", "box", "", 700, 160, 420, 300, { data: "article" }),
    node("card_words", "value-prop", "A card title", 720, 190, 380, 60),
    node("alone", "value-prop", "Standing alone", 200, 600, 420, 80),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "OWNERS", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="buy_words"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
/* Selection is not saved with the document: a picked part is one wearing its resize handles. */
const selection = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector(":scope > [data-resize]")).map((n) => n.getAttribute("data-node-id")));
const nodeOf = async (id) => ((await saved()).nodes ?? []).find((n) => n.id === id);
const words = (n) => (typeof n?.content === "string" ? n.content : (n?.content ?? []).map((s) => s.text).join(""));
const centre = async (id) => { const b = await page.locator(`[data-node-id="${id}"]`).boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
const ground = async () => { await page.mouse.click(1420, 880); await page.waitForTimeout(300); };

/* 1. one press on a button's words picks the button */
let c = await centre("buy_words");
await page.locator('[data-node-id="buy_words"]').scrollIntoViewIfNeeded();
c = await centre("buy_words");
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(400);
check("one press on a button's words picks the button", JSON.stringify(await selection()) === '["buy"]', JSON.stringify(await selection()));
await page.screenshot({ path: `${SHOTS}/select-owner-1-button.png` });

/* a drag from the words moves the button and its words together */
const before = { b: await nodeOf("buy"), w: await nodeOf("buy_words") };
await page.mouse.move(c.x, c.y);
await page.mouse.down();
await page.mouse.move(c.x + 40, c.y + 30, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(500);
const after = { b: await nodeOf("buy"), w: await nodeOf("buy_words") };
const moved = (a, z) => [z.x - a.x, z.y - a.y];
const mb = moved(before.b, after.b), mw = moved(before.w, after.w);
check("dragging from the words moves the button", mb[0] !== 0 || mb[1] !== 0, JSON.stringify(mb));
check("…and its words ride with it, keeping their place on it", mb[0] === mw[0] && mb[1] === mw[1], `button ${mb} words ${mw}`);
await page.keyboard.press("Control+z");
await page.waitForTimeout(300);

/* a card owns what is on it */
await ground();
c = await centre("card_words");
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(400);
check("one press on a card's title picks the card", JSON.stringify(await selection()) === '["card"]', JSON.stringify(await selection()));

/* a part nothing owns is picked itself */
await ground();
await page.locator('[data-node-id="alone"]').scrollIntoViewIfNeeded();
c = await centre("alone");
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(400);
check("a part nothing owns is picked itself", JSON.stringify(await selection()) === '["alone"]', JSON.stringify(await selection()));

/* 2. two presses: the words, typed on the canvas */
await ground();
await page.locator('[data-node-id="buy_words"]').scrollIntoViewIfNeeded();
c = await centre("buy_words");
await page.mouse.dblclick(c.x, c.y);
await page.waitForTimeout(500);
const editor = page.locator('[data-words-in-place="buy_words"]');
check("two presses open the words on the canvas", await editor.count() === 1);
check("…with the caret in them", await page.evaluate(() => document.activeElement?.hasAttribute("data-words-in-place") ?? false));
check("…and the side panel's words box is not where the caret went", await page.evaluate(() => document.activeElement?.tagName !== "TEXTAREA"));
const edBox = await editor.boundingBox({ timeout: 2000 }).catch(() => null);
const wBox = await page.locator('[data-node-id="buy_words"]').boundingBox();
check("the editor sits over the words it replaces", !!edBox && edBox.x >= wBox.x - 2 && edBox.y >= wBox.y - 2 && edBox.x < wBox.x + wBox.width && edBox.y < wBox.y + wBox.height, JSON.stringify({ edBox, wBox }));
await page.screenshot({ path: `${SHOTS}/select-owner-2-typing.png` });
await page.keyboard.press("End");
await page.keyboard.type(" TODAY");
check("typing a letter fires no shortcut: the select tool is still in hand", ((await saved()).tool ?? "select") === "select");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
check("Enter keeps what was typed", words(await nodeOf("buy_words")) === "BUY NOW TODAY", words(await nodeOf("buy_words")));
check("…and closes the editor", await page.locator("[data-words-in-place]").count() === 0);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
check("one undo takes the whole edit back", words(await nodeOf("buy_words")) === "BUY NOW", words(await nodeOf("buy_words")));

/* Escape puts the words back as they were */
c = await centre("buy_words");
await page.mouse.dblclick(c.x, c.y);
await page.waitForTimeout(500);
await page.keyboard.type("gone");
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("Escape puts the words back", words(await nodeOf("buy_words")) === "BUY NOW", words(await nodeOf("buy_words")));
check("…and leaves the words picked", JSON.stringify(await selection()) === '["buy_words"]', JSON.stringify(await selection()));

/* a press elsewhere keeps them */
c = await centre("alone");
await page.locator('[data-node-id="alone"]').scrollIntoViewIfNeeded();
c = await centre("alone");
await page.mouse.dblclick(c.x, c.y);
await page.waitForTimeout(500);
await page.keyboard.press("End");
await page.keyboard.type("!");
await ground();
await page.waitForTimeout(300);
check("a press elsewhere keeps what was typed", words(await nodeOf("alone")) === "Standing alone!", words(await nodeOf("alone")));

/* Enter on a picked button goes into its words */
await page.locator('[data-node-id="buy_words"]').scrollIntoViewIfNeeded();
c = await centre("buy_words");
await page.mouse.click(c.x, c.y);
await page.waitForTimeout(400);
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
check("Enter on a picked button opens the words it holds", await page.locator('[data-words-in-place="buy_words"]').count() === 1);
await page.keyboard.press("Escape");

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
