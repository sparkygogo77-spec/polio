/**
 * CAPTURED WORDS DRAW AT THE SIZE THE CAPTURE MEASURED, SO NOTHING BELOW THEM MOVES.
 *
 * MEASURED on trunk c76d112, a fresh import of sink with all nine pages
 * opened: 356 of 637 parts sat 4 to 163px lower than sink's document put
 * them. Every run traced to words the board drew taller than the live page
 * did, which the settle (`useSettleToWords`) then treated as growth:
 *
 *   A. a captured heading (value-prop) padded itself 0.5em a side, which the
 *      capture never had: +5..+19 on one line, and wrapped where the box
 *      was exactly as wide as its words (+33, +55);
 *   B. captured text was held to the 541px reading measure however wide the
 *      capture was: the Documentation paragraph drew 5 lines against 3;
 *   C. a tagline captured from an inline span (12px tall, the glyph box)
 *      drew a whole line box (16px), and the header grew by 4.
 *
 * The ruling: fix all three for captured parts only. A heading and a
 * paragraph placed by hand keep today's defaults, checked here by their
 * computed styles (and a pixel hash, to compare across builds by eye).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/captured-words.mjs http://127.0.0.1:3013 <the capture folder>
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { bringSink } from "./fixtures/bring-sink.mjs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3];
if (!SINK || !existsSync(SINK)) { console.error("usage: node tests/captured-words.mjs <url> <capture folder>"); process.exit(2); }
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const raw = JSON.parse(readFileSync(join(SINK, "site/document.json"), "utf8"));
const sinkDoc = raw;
const docY = new Map((raw.state ?? raw).nodes.map((n) => [n.id, n.y]));

const { browser, page, state } = await bringSink(BASE, SINK);
await page.waitForTimeout(4000);
let s = await state();
for (const pg of s.pages) {
  if (pg.id === s.activePageId) continue;
  await page.locator("[data-page-current]").click();
  await page.waitForTimeout(300);
  await page.locator("[data-page-menu] [data-ctx='studio-page']").filter({ hasText: pg.name }).first().click();
  await page.waitForTimeout(3500);
}
s = await state();
const kinds = {};
for (const n of s.nodes) kinds[n.featureId] = (kinds[n.featureId] ?? 0) + 1;
/*
 * The contract, read from the capture: every picture, icon, button and
 * value-prop part in sink's document lands as that kind, and the boxes and
 * words together land 354 (the import folds a word into its neighbour and
 * leaves an empty wrapper out; SOLCINERATOR, taken on 2026-09-22 or re-taken
 * on 2026-09-30, lands 637 either way).
 */
const docKinds = {};
for (const n of (sinkDoc.state ?? sinkDoc).nodes) docKinds[n.featureId] = (docKinds[n.featureId] ?? 0) + 1;
const want = Object.fromEntries(Object.entries(docKinds).filter(([k]) => k !== "box" && k !== "prose"));
check("sink lands whole: 637 parts", s.nodes.length === 637 && (kinds.box ?? 0) + (kinds.prose ?? 0) === 354 && Object.entries(want).every(([k, v]) => kinds[k] === v), `${s.nodes.length} ${JSON.stringify(kinds)}`);
const off = s.nodes.filter((n) => docY.has(n.id) && Math.abs(n.y - docY.get(n.id)) > 1);
const per = {};
for (const n of off) per[n.pageId] = (per[n.pageId] ?? 0) + 1;
check("with all nine pages opened, no part sits more than 1px off its document y", off.length === 0, `${off.length} off ${JSON.stringify(per)}${off.length ? ` e.g. ${off.slice(0, 4).map((n) => `${n.id} ${docY.get(n.id)}→${n.y}`).join(", ")}` : ""}`);
await browser.close();

/* A heading and a paragraph placed by hand: today's defaults, untouched. */
const node = (id, featureId, content, x, y, w, h) => ({
  id, pageId: "p", featureId, label: id, prompt: "", content, data: "", x, y, w, h, byHand: true,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const words = "A paragraph placed by hand, long enough to run past the reading measure so the cap it has always had can be seen holding it, line after line, well short of the box it sits in.";
const doc = JSON.stringify({ state: {
  pages: [{ id: "p", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("h_head", "value-prop", "A heading placed by hand", 40, 40, 300, 90), node("h_para", "prose", words, 40, 200, 900, 160)],
  groups: [], shapes: [], format: {}, brief: { name: "HAND", gimmick: "", master: "" }, frameWidth: 1440, activePageId: "p", trail: [],
}, version: 0 });
const b2 = await (await import("playwright-core")).chromium.launch({ args: ["--no-sandbox"], executablePath: "/opt/pw-browsers/chromium" });
const ctx = await b2.newContext({ viewport: { width: 1500, height: 1000 } });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); localStorage.setItem("builder.builds", JSON.stringify({ state: { projects: [{ id: "h", name: "HAND", updatedAt: 1 }], activeId: "h" }, version: 0 })); sessionStorage.setItem("seeded", "1"); } }, doc);
const p2 = await ctx.newPage();
await p2.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await p2.waitForTimeout(2500);
const read = (id) => p2.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"]`);
  const part = el.querySelector("[data-part]");
  const p = el.querySelector("p");
  const box = p.parentElement === part ? p : p.parentElement;
  const cp = getComputedStyle(part), ct = getComputedStyle(p), cb = getComputedStyle(box);
  return { h: el.offsetHeight, pad: cp.paddingTop, fs: parseFloat(ct.fontSize), lh: parseFloat(ct.lineHeight), measure: cb.maxWidth, textW: box.offsetWidth, family: ct.fontFamily };
}, id);
const head = await read("h_head");
const para = await read("h_para");
check("a hand-built heading still pads itself half its type size", Math.abs(parseFloat(head.pad) - head.fs / 1.6 / 2) < 0.1 && parseFloat(head.pad) > 0, JSON.stringify(head));
check("and sets its line at 1.2, held to the 541px measure", Math.abs(head.lh / head.fs - 1.2) < 0.01 && head.measure === "541px");
check("a hand-built paragraph is still held to the 541px measure", para.measure === "541px" && para.textW <= 541, JSON.stringify(para));
const hash = async (id) => createHash("sha1").update(await p2.locator(`[data-node-id="${id}"]`).screenshot()).digest("hex").slice(0, 12);
console.log(`   pixels: heading ${await hash("h_head")}, paragraph ${await hash("h_para")}`);
await b2.close();

console.log(results.every(Boolean) ? "\nall passed" : `\n${results.filter((r) => !r).length} failed`);
process.exit(results.every(Boolean) ? 0 : 1);
