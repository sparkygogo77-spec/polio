/**
 * ONLY A PART'S OWN WORDS WIDEN IT: NEVER ITS NAME TAG.
 *
 * After `size-widens` (#375), mochi's hero heading, "Create your own AI
 * trading agent." (two lines that wrap, 874 wide), made 1.5 times bigger in
 * the panel, went 874 -> 2751 wide (the hand-edit pass, 2026-10-22). The
 * words were not held on a row at all; the measure read every line of text
 * inside the part's element on the board, and that holds the part's name tag
 * (`heading "Create your own AI trading agent."`, one row, nowrap) and its
 * note. Only the part's drawing (`[data-part-drawn]`) is its words.
 *
 *   · a wrapping heading made bigger keeps its width (its words wrap);
 *   · a one-row label made bigger still widens to its words (control).
 *
 *   npx next start -p 3013
 *   node tests/held-rows-own-words.mjs http://127.0.0.1:3013
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
    node("hero", "value-prop", "Create your own AI trading agent.", 200, 100, 874, 157, { label: "heading “Create your own AI trading agent.”", font: { face: "Arial", stack: "Arial, sans-serif", size: 3.125, px: 80, weight: 600, leading: 0.98 }, colour: { text: "rgb(245, 245, 246)" }, text: { align: "center", wrap: "balance" }, ...from("body > main > section > h1") }),
    node("label", "prose", "JOIN THE WAVE", 200, 500, 150, 24, { font: { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 16, weight: 500, leading: 1.4 }, colour: { text: "rgb(240, 240, 240)" }, ...from("body > header > a > span") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "OWN", gimmick: "", master: "" },
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
await page.waitForTimeout(2500);
const nodeOf = async (id) => (await page.evaluate(() => window.__studioHistory?.doc().nodes ?? [])).find((n) => n.id === id);
const bigger = async (id) => {
  const n = await nodeOf(id);
  /* Picked, as in the panel: its name tag is on the board. */
  await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), id);
  await page.waitForTimeout(300);
  await page.evaluate(({ id, font }) => window.__studioHistory.act("updateNode", id, { font }), { id, font: { ...n.font, size: n.font.size * 1.5 } });
  await page.waitForTimeout(1500);
  return [n, await nodeOf(id)];
};
const [h0, h1] = await bigger("hero");
check("a wrapping heading made 1.5 times bigger keeps its width: its words wrap", h1.w === h0.w, `${h0.w} → ${h1.w}`);
const [l0, l1] = await bigger("label");
check("a one-row label made 1.5 times bigger still widens to its words (control)", l1.w > l0.w, `${l0.w} → ${l1.w}`);
check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
