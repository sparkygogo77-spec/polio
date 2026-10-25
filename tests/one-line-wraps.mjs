/**
 * LONG WORDS IN A ONE-LINE PART WRAP INSIDE ITS COLUMN (EDIT-ISSUES #29).
 *
 * gotchi.gg's hero heading "your bag keeps it alive." (189, 537 wide, one line
 * of 48px type, a picture column beside it at 766) given a long sentence on
 * the canvas widened to 2,366px, off the page and over the picture. J
 * (2026-10-23): it wraps inside its column, as the page would; a short label
 * still widens while it fits (`growToWords.ts#widenInColumn`). Held here:
 *   · the heading stays left of the picture column and inside the page, and its words wrap with no ink past its box;
 *   · it is drawn taller, the parts under it move down clear of it, and the section grows to hold them;
 *   · the published page draws the heading at the board's box;
 *   · Ctrl+Z puts back the words and the width;
 *   · a short label in the same column given a few more words widens on one line.
 *
 *   npx next start -p 3013
 *   node tests/one-line-wraps.mjs http://127.0.0.1:3013
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
    node("sec", "box", "", 130, 67, 1180, 489, { colour: { bg: "rgb(255, 252, 245)" }, from: from("body > main > section") }),
    node("head", "value-prop", "your bag keeps it alive.", 189, 306, 537, 53, { font: { px: 48, size: 3, weight: 700, leading: 1.1 }, colour: { text: "rgb(43, 29, 46)" }, from: from("body > main > section > div > h1") }),
    node("para", "prose", "A short line under the heading.", 189, 380, 537, 28, { font: { px: 18, size: 1.125, weight: 400, leading: 1.5 }, colour: { text: "rgb(43, 29, 46)" }, from: from("body > main > section > div > p") }),
    node("tag", "value-prop", "Sign in", 189, 470, 90, 24, { font: { px: 16, size: 1, weight: 500, leading: 1.25 }, colour: { text: "rgb(43, 29, 46)" }, from: from("body > main > section > div > a") }),
    node("pic", "box", "", 766, 170, 485, 360, { colour: { bg: "rgb(200, 120, 160)" }, from: from("body > main > section > figure") }),
    node("next", "box", "", 0, 600, 1440, 300, { colour: { bg: "rgb(30, 30, 40)" }, from: from("body > footer") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "WRAP", gimmick: "", master: "" },
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
const past = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`); const box = el.getBoundingClientRect(); let right = box.right;
  /* The part's own words only: the board's hint under the hand ("One-line pitch") is not the part. */
  const tw = document.createTreeWalker(el.querySelector(":scope > [data-part-drawn]") ?? el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) right = Math.max(right, q.right); }
  return Math.round(right - box.right);
}, id);
const lines = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-part]`) ?? document.querySelector(`[data-node-id="${id}"]`);
  const tops = []; const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) { if (!t.textContent.trim()) continue; const r = document.createRange(); r.selectNodeContents(t); for (const q of r.getClientRects()) if (q.width > 0 && !tops.some((y) => Math.abs(y - q.top) < q.height / 2)) tops.push(q.top); }
  return tops.length;
}, id);
const typeInto = async (id, text) => {
  const b = await page.locator(`[data-node-id="${id}"]`).boundingBox();
  await page.mouse.click(1420, 880);
  await page.mouse.dblclick(b.x + Math.min(b.width / 2, 60), b.y + b.height / 2);
  await page.waitForTimeout(500);
  const open = (await page.locator(`[data-words-in-place="${id}"]`).count()) === 1;
  await page.keyboard.press("Control+a");
  await page.keyboard.type(text);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape"); await page.keyboard.press("Escape");
  return open;
};

const before = Object.fromEntries((await page.evaluate(() => window.__studioHistory.doc().nodes)).map((n) => [n.id, n]));
const LONG = "your bag keeps it alive, so feed it every single day and it will grow into something wonderful.";
check("head: two presses open its words on the canvas", await typeInto("head", LONG));
const h1 = await nodeOf("head");
check("head: the long words are kept", words(h1.content) === LONG, words(h1.content));
check("head: it stays left of the picture column beside it, inside the page", h1.x + h1.w <= 766 && h1.x + h1.w <= 1440, `x ${h1.x}, w ${before.head.w} → ${h1.w}`);
check("head: its words wrap onto more lines", (await lines("head")) > 1, `${await lines("head")} lines`);
check("head: no ink runs past its box (2px for rounding)", (await past("head")) <= 2, `${await past("head")}px past`);
const drawnH = await page.evaluate(() => { const el = document.querySelector('[data-node-id="head"]'); const f = document.querySelector("[data-frame]"); return el.getBoundingClientRect().height * (1440 / f.getBoundingClientRect().width); });
check("head: its stored height holds the lines it draws", h1.h >= drawnH - 2 && h1.h > before.head.h, `stored ${h1.h}, drawn ${Math.round(drawnH)}, was ${before.head.h}`);
const p1 = await nodeOf("para"), s1 = await nodeOf("sec"), t1 = await nodeOf("tag"), n1 = await nodeOf("next");
check("the paragraph under it moves down clear of it", p1.y >= h1.y + h1.h - 1, `para ${p1.y}, head ends ${h1.y + h1.h}`);
check("…and so does the label under that", t1.y >= p1.y + p1.h - 1, `tag ${t1.y}, para ends ${p1.y + p1.h}`);
check("the section grows to hold them, and what follows is not overlapped", s1.y + s1.h >= t1.y + t1.h - 1 && n1.y >= s1.y + s1.h - 1, `sec ends ${s1.y + s1.h}, tag ends ${t1.y + t1.h}, next ${n1.y}`);

/* The published page draws the heading as the board does. */
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path.replace(/^\/+/, ""), content: f.content, encoding: f.encoding })));
const byPath = new Map(files.map((f) => [f.path, f]));
const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await out.route("http://site.test/**", (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
  const f = byPath.get(path);
  if (!f) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html", body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
await out.goto("http://site.test/index.html", { waitUntil: "load" });
await out.waitForTimeout(1200);
const pub = await out.evaluate(() => { const el = document.getElementById("head"); if (!el) return null; const r = el.getBoundingClientRect(); return { x: Math.round(r.left), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) }; });
check("the published page draws the heading at the board's box", !!pub && Math.abs(pub.x - h1.x) <= 2 && Math.abs(pub.w - h1.w) <= 2 && Math.abs(pub.h - h1.h) <= 3, `${JSON.stringify(pub)} vs ${h1.x},${h1.y},${h1.w},${h1.h}`);
await out.close();

/* One press: the widening, the wrap and the settle's taller height are the typing's own step. */
await page.keyboard.press("Control+z"); await page.waitForTimeout(700);
const back = await nodeOf("head");
check("one Ctrl+Z puts back the heading's words, width and height", words(back.content) === words(before.head.content) && back.w === before.head.w && back.h === before.head.h, `${words(back.content)} / ${back.w} x ${back.h}`);

check("tag: two presses open its words", await typeInto("tag", "Sign in to your bag"));
const t2 = await nodeOf("tag");
check("tag: a short label given a few more words widens, inside its column", t2.w > before.tag.w && t2.x + t2.w <= 766, `${before.tag.w} → ${t2.w}`);
check("tag: …and stays one line", (await lines("tag")) === 1 && t2.h === before.tag.h, `${await lines("tag")} lines, h ${t2.h}`);
check("tag: no ink runs past its box", (await past("tag")) <= 2, `${await past("tag")}px past`);

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
