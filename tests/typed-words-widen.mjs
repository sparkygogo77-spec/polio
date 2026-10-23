/**
 * WORDS TYPED ON THE CANVAS STAY INSIDE THEIR PART.
 *
 * Found in the hand-edit pass on a fresh mochi import: the heading "Pick a
 * creature", the "Sign in" link and the "See who's winning" button are one
 * line tall. Opened with two presses and given longer words, the words ran
 * 200-300px past the part's right edge, over whatever stood there, while the
 * part kept its old width. The panel's WORDS box already grows a one-line
 * part to hold what was typed (`growToWords.ts`, tests/edit-widen.mjs); the
 * words typed where they are drawn (`WordsInPlace.tsx`) never asked it.
 *
 * Held here, on two captured-style one-line headings:
 *   · after typing longer words and Enter, no ink runs past the part's box;
 *   · the part is no taller (one line stays one line);
 *   · one Ctrl+Z takes back the words and the width together.
 *
 *   npx next start -p 3013
 *   node tests/typed-words-widen.mjs http://127.0.0.1:3013
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
const from = (selector) => ({ url: "https://example.test/", host: "example.test", selector, at: 1 });
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("head", "value-prop", "Pick a creature", 200, 200, 320, 32, { font: { px: 26, size: 1.625, weight: 600, leading: 1.2 }, colour: { text: "rgb(240, 240, 240)" }, from: from("body > main > h2") }),
    node("note", "value-prop", "Sign in", 200, 400, 120, 24, { font: { px: 16, size: 1, weight: 500, leading: 1.25 }, colour: { text: "rgb(240, 240, 240)" }, from: from("body > main > a") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "WIDEN", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="head"]', { timeout: 20000 });
await page.waitForTimeout(2500);

const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);
const words = (c) => (typeof c === "string" ? c : (c ?? []).map((s) => s.text ?? "").join(""));
/* How far the drawn words run past the part's own box, on screen. */
const past = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`); const box = el.getBoundingClientRect(); let right = box.right;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) right = Math.max(right, q.right); }
  return Math.round(right - box.right);
}, id);

for (const id of ["head", "note"]) {
  const before = await nodeOf(id);
  check(`${id}: its words fit before the edit`, (await past(id)) <= 1, `${await past(id)}px past`);
  const b = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  await page.mouse.click(1420, 880);
  await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(500);
  check(`${id}: two presses open its words on the canvas`, await page.locator(`[data-words-in-place="${id}"]`).count() === 1);
  await page.keyboard.press("Control+a");
  await page.keyboard.type(`${words(before.content)} and a few more words`);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const after = await nodeOf(id);
  check(`${id}: the typed words are kept`, words(after.content).endsWith("a few more words"), words(after.content));
  const over = await past(id);
  check(`${id}: no ink runs past the part's box (2px for the board's rounding)`, over <= 2, `${over}px past its right edge; width ${before.w} → ${after.w}`);
  check(`${id}: one line stays one line (no taller)`, after.h === before.h, `${before.h} → ${after.h}`);
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(800);
  const back = await nodeOf(id);
  check(`${id}: one Ctrl+Z takes back the words and the width together`, words(back.content) === words(before.content) && back.w === before.w, `${words(back.content)} / ${back.w}`);
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
