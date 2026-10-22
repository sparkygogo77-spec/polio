/**
 * A FACE'S AXES THE PAGE SET ARE DRAWN, ON THE BOARD AND PUBLISHED.
 *
 * sunkcoin.fun's payday heading is Fraunces at `font-variation-settings:
 * "opsz" 144`. The capture now carries it (`font.variation`,
 * capture/site/capture/check-font-variation.mjs); drawn without it the
 * heading ran a tenth wider, wrapped to a sixth line and grew 61px. The
 * part's box sets it, so whatever the part draws its words with inherits it.
 *
 *   npx next start -p 3013
 *   node tests/font-variation.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
import { node } from "./fixtures/small-sites.mjs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const from = (selector) => ({ from: { selector, url: "https://standin.test/", host: "standin.test", at: 0 } });
const nodes = [
  node("head", "value-prop", "STANDIN when the chart dips", 120, 100, 462, 306, { ...from("body > main > h2"), font: { face: "Georgia", px: 60, size: 2.34375, leading: 1.02, variation: '"opsz" 144' } }),
  node("para", "prose", "STANDIN plain words", 120, 500, 400, 24, { ...from("body > main > p"), font: { face: "Georgia", px: 16, size: 1, leading: 1.5, variation: '"wght" 650' } }),
  node("plain", "prose", "STANDIN no axes", 120, 600, 400, 24, { ...from("body > main > p:nth-of-type(2)"), font: { face: "Georgia", px: 16, size: 1, leading: 1.5 } }),
];
const doc = {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], activePageId: "p0", hiddenFeatures: [], frameWidth: 1440,
  format: { "type.headingFamily": "system sans", "type.bodyFamily": "system sans", "type.baseSize": 16, "layout.radius": 0, "palette.mode": "light" },
  brief: { name: "STANDIN", gimmick: "", master: "" }, look: { palette: { bg: "#ffffff", text: "#111111" }, texture: [], target: "page" }, motion: [],
};

const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.trim().split(/\s+/) : ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, view: "desktop" }, version: 0 })); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-device-switch]", { timeout: 30000 });
await page.waitForTimeout(1200);

/* The axes the words are drawn with: on the deepest element holding the text. */
const AXES = (root, id) => {
  const el = root.querySelector(`[data-node-id="${id}"], #${id}`);
  if (!el) return null;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) if (/STANDIN/.test(t.textContent)) return getComputedStyle(t.parentElement).fontVariationSettings;
  return null;
};
const on = (id) => page.evaluate(`(${AXES})(document, ${JSON.stringify(id)})`);
check("on the board, the heading's words are drawn at \"opsz\" 144", /"opsz" 144/.test((await on("head")) ?? ""), await on("head"));
check("on the board, a paragraph's words are drawn at its own axes", /"wght" 650/.test((await on("para")) ?? ""), await on("para"));
check("control: a part with no axes is drawn at normal", (await on("plain")) === "normal", await on("plain"));

const files = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
const byPath = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f]));
const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await out.route("http://site.test/**", (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
  const f = byPath.get(path);
  if (!f) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html", body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
await out.goto("http://site.test/index.html", { waitUntil: "load" });
await out.waitForTimeout(800);
const pub = await out.evaluate(`(${AXES})(document, "head")`);
check("published, the heading's words are drawn at \"opsz\" 144", /"opsz" 144/.test(pub ?? ""), pub);
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
