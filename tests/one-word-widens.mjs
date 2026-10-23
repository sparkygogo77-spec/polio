/**
 * ONE WORD MADE BIGGER GROWS ITS PART, HELD ON ITS ROW OR NOT.
 *
 * share.xyz's wordmark "Share" (64×28, a fresh import, the hand-edit pass on
 * a fourth site, 2026-10-23): made 1.5 times bigger in the panel, it ran 32px
 * past its box. `heldRowsGrow` widened only words held on their row
 * (nowrap); a box far shorter than the words now are is no longer read as one
 * line, so nothing was held, and one word has nowhere to break.
 *
 *   · one word, made 1.5 times bigger, draws no ink past its part;
 *   · a two-line paragraph made bigger keeps its width: it wraps (control).
 *
 *   npx next start -p 3013
 *   node tests/one-word-widens.mjs http://127.0.0.1:3013
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
    node("word", "prose", "Share", 124, 22, 64, 28, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1.4375, px: 23, weight: 700, spacing: -0.01, leading: 1.22 }, colour: { text: "rgb(0, 0, 0)" }, ...from("body > header > a > span") }),
    node("para", "prose", "A paragraph that wraps over two lines in its box here", 124, 200, 300, 52, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 16, weight: 400, leading: 1.5 }, colour: { text: "rgb(0, 0, 0)" }, ...from("body > main > p") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "WORD", gimmick: "", master: "" },
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
await page.waitForSelector('[data-node-id="word"]', { timeout: 20000 });
await page.waitForTimeout(2500);
const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);
const past = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`); const b = el.getBoundingClientRect(); const words = el.querySelector("[data-part-drawn]") ?? el; let l = b.left, r = b.right, rows = new Set();
  const tw = document.createTreeWalker(words, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const g = document.createRange(); g.selectNodeContents(t); for (const q of g.getClientRects()) { if (!q.width) continue; l = Math.min(l, q.left); r = Math.max(r, q.right); if (![...rows].some((y) => Math.abs(y - q.top) < q.height / 2)) rows.add(q.top); } }
  return { over: Math.round(Math.max(0, b.left - l) + Math.max(0, r - b.right)), rows: rows.size };
}, id);

for (const [id, rowsWant] of [["word", 1]]) {
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
{
  const p0 = await nodeOf("para");
  await page.evaluate(({ font }) => window.__studioHistory.act("updateNode", "para", { font }), { font: { ...p0.font, size: p0.font.size * 1.5 } });
  await page.waitForTimeout(1500);
  const p1 = await nodeOf("para");
  check("control: a two-line paragraph made bigger keeps its width (it wraps)", p1.w === p0.w, `${p0.w} → ${p1.w}`);
}
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
