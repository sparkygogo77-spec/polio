/**
 * WORDS HELD TO THEIR ROWS GROW THEIR PART WHEN THEIR SIZE GROWS.
 *
 * Found in the hand-edit pass on a fresh sol face import: a captured part
 * holds its words on their rows (a button's label, a heading the page broke
 * with <br>s: `white-space: nowrap`). Made bigger in the panel, "JOIN THE
 * WAVE ↗" ran 222px past its button and the heading "HE DOESN'T CHASE THE
 * CANDLE." 787px past its box, over whatever stood beside them; nothing
 * widened, since the board's own tidy leaves a part a person has touched.
 *
 * Held here, a captured one-line label and a captured button's label:
 *   · made 1.5 times bigger (its size, as the panel writes it), no ink runs
 *     past either part's box;
 *   · it stays on its rows (no taller than its rows);
 *   · one Ctrl+Z takes back the size and the width together.
 *
 *   npx next start -p 3013
 *   node tests/size-widens.mjs http://127.0.0.1:3013
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
const from = (selector) => ({ from: { url: "https://x.test/", host: "x.test", selector, at: 1 } });
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    /* A captured button's label, centred, held on its row. */
    node("mark", "cta-primary", "JOIN THE WAVE", 100, 600, 180, 52, { font: { face: "Arial", stack: "Arial, sans-serif", size: 0.625, px: 10, weight: 500, leading: 1.3 }, colour: { bg: "rgb(76, 255, 131)", text: "rgb(6, 18, 11)" }, ...from("body > header > a:nth-of-type(2)") }),
    node("label", "prose", "JOIN THE WAVE", 100, 400, 150, 24, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 16, weight: 500, leading: 1.4 }, colour: { text: "rgb(240, 240, 240)" }, ...from("body > header > a > span") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "SIZE", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="label"]', { timeout: 20000 });
await page.waitForTimeout(2500);
const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);
const past = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`); const b = el.getBoundingClientRect(); const words = el.querySelector("[data-part-drawn]") ?? el; let l = b.left, r = b.right, rows = new Set();
  const tw = document.createTreeWalker(words, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(t); for (const q of g.getClientRects()) { if (!q.width) continue; l = Math.min(l, q.left); r = Math.max(r, q.right); if (![...rows].some((y) => Math.abs(y - q.top) < q.height / 2)) rows.add(q.top); } }
  return { over: Math.round(Math.max(0, b.left - l) + Math.max(0, r - b.right)), rows: rows.size };
}, id);

for (const [id, rowsWant] of [["label", 1], ["mark", 1]]) {
  const before = await nodeOf(id);
  const p0 = await past(id);
  check(`${id}: its words fit before, on ${rowsWant} row(s)`, p0.over <= 1 && p0.rows === rowsWant, JSON.stringify(p0));
  /* As the panel's size field writes it: the font, bigger. */
  await page.evaluate(({ id, font }) => window.__studioHistory.act("updateNode", id, { font }), { id, font: { ...before.font, size: before.font.size * 1.5 } });
  await page.waitForTimeout(1500);
  const after = await nodeOf(id), p1 = await past(id);
  check(`${id}: 1.5 times bigger, no ink runs past its box`, p1.over <= 2, `${p1.over}px past; width ${before.w} → ${after.w}`);
  check(`${id}: still on its ${rowsWant} row(s)`, p1.rows === rowsWant, JSON.stringify(p1));
  await page.keyboard.press("Control+z"); await page.waitForTimeout(800);
  const back = await nodeOf(id);
  check(`${id}: one Ctrl+Z takes back the size and the width together`, back.w === before.w && back.font.size === before.font.size, `${back.w} / ${back.font.size}`);
}
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
