/**
 * A CAPTURED PAGE AT A PHONE'S WIDTH: A PART THE SITE MOVES WITH A
 * TRANSFORM IS NOT MOVED TWICE.
 *
 * thesolface.site's hero frog is placed with `translateX(-50%)`: at 1440 the
 * capture keeps it as the part's own drawing, `matrix(1, 0, 0, 1, -345, 0)`.
 * Its box at 390 (`widths.phone`) is where the phone shows it, transform
 * and all; the site's own layout (`smallCss.ts`, "site" mode) placed the box
 * there and the drawing still moved 345 px left inside it, off the page: the
 * frog was gone from the phone. A rotation (a tilted card) is kept.
 *
 * A stand-in page with a picture moved by -345 px and a card turned 6 deg,
 * each with its box at 390:
 *   (1) the picture's drawing lies over its phone box, on the board and
 *       published;
 *   (2) the card is still turned.
 *
 *   npx next start -p 3013
 *   node tests/small-site-transform.mjs http://127.0.0.1:3013
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
  node("band", "box", "", 0, 0, 1440, 100, { ...from("body > header"), widths: { phone: { x: 0, y: 0, w: 390, h: 80 } } }),
  node("title", "prose", "STANDIN heading", 120, 160, 900, 80, { ...from("body > main > h1"), widths: { phone: { x: 16, y: 120, w: 358, h: 120 } } }),
  node("moved", "box", "", 1049, 145, 690, 400, { ...from("body > main > div"), colour: { bg: "rgb(0, 200, 0)" }, art: { transform: "matrix(1, 0, 0, 1, -345, 0)", origin: "345px 200px" }, widths: { phone: { x: 5, y: 300, w: 380, h: 220 } } }),
  node("card", "box", "", 200, 700, 300, 200, { ...from("body > main > aside"), colour: { bg: "rgb(200, 0, 0)" }, art: { transform: "matrix(0.9945, 0.1045, -0.1045, 0.9945, 0, 0)" }, widths: { phone: { x: 40, y: 600, w: 300, h: 200 } } }),
  node("foot", "box", "", 0, 1000, 1440, 200, { ...from("body > footer"), widths: { phone: { x: 0, y: 900, w: 390, h: 200 } } }),
];
const doc = {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], activePageId: "p0", hiddenFeatures: [], frameWidth: 1440, capturedWidths: [1440, 390],
  format: { "type.headingFamily": "system sans", "type.bodyFamily": "system sans", "type.baseSize": 16, "layout.radius": 0, "palette.mode": "light" },
  brief: { name: "STANDIN", gimmick: "", master: "" }, look: { palette: { bg: "#ffffff", text: "#111111" }, texture: [], target: "page" }, motion: [],
};

/* Where a part's own drawing is (its widest painted box inside it), and whether anything in it is turned. */
const DRAWN = ([sel, k, ox, oy]) => {
  const el = document.querySelector(sel);
  if (!el) return null;
  /* The element the part's own transform is on (the drawing), else the part. */
  const moved = [el, ...el.querySelectorAll("*")].find((e) => { const t = getComputedStyle(e).transform; return t && t !== "none"; }) ?? el;
  const t = getComputedStyle(moved).transform;
  const m = /matrix\(([^)]+)\)/.exec(t ?? "");
  const turned = !!m && Math.abs(Number(m[1].split(",")[1])) > 0.05;
  const r = moved.getBoundingClientRect();
  return { x: Math.round((r.left - ox) / k), y: Math.round((r.top - oy) / k + (k === 1 ? scrollY : 0)), w: Math.round(r.width / k), turned, t };
};
const browser = await chromium.launch({ ...(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {}), args: process.env.CHROMIUM_ARGS ? process.env.CHROMIUM_ARGS.trim().split(/\s+/) : ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1500, height: 1200 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", JSON.stringify({ state: { ...d, view: "desktop" }, version: 0 })); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector("[data-device-switch]", { timeout: 30000 });
await page.waitForTimeout(1000);

/* The board's Phone view. */
await page.locator('[data-device="phone"]').click();
await page.waitForSelector('[data-small-frame="phone"]', { timeout: 10000 });
await page.waitForTimeout(800);
const frame = await page.evaluate(() => { const r = document.querySelector('[data-small-frame="phone"] [data-small-page]').getBoundingClientRect(); return { k: r.width / 390, x: r.left, y: r.top }; });
const bMoved = await page.evaluate(DRAWN, ['[data-small-frame="phone"] [data-live-node="moved"]', frame.k, frame.x, frame.y]);
const bCard = await page.evaluate(DRAWN, ['[data-small-frame="phone"] [data-live-node="card"]', frame.k, frame.x, frame.y]);
check("(1) on the board's Phone view, the moved picture drawn over its phone box (x 5)", !!bMoved && Math.abs(bMoved.x - 5) <= 3 && Math.abs(bMoved.y - 300) <= 3, JSON.stringify(bMoved));
check("(2) on the board's Phone view, the card still turned", !!bCard?.turned, JSON.stringify(bCard));

/* Published, at 390. */
const files = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
const byPath = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f]));
const out = await browser.newPage({ viewport: { width: 390, height: 844 } });
await out.route("http://site.test/**", (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
  const f = byPath.get(path);
  if (!f) return r.fulfill({ status: 404, body: "" });
  return r.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html", body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
await out.goto("http://site.test/index.html", { waitUntil: "load" });
await out.waitForTimeout(800);
const pMoved = await out.evaluate(DRAWN, ["#moved", 1, 0, 0]);
const pCard = await out.evaluate(DRAWN, ["#card", 1, 0, 0]);
check("(1) published at 390, the moved picture drawn over its phone box (x 5)", !!pMoved && Math.abs(pMoved.x - 5) <= 3 && Math.abs(pMoved.y - 300) <= 3, JSON.stringify(pMoved));
check("(2) published at 390, the card still turned", !!pCard?.turned, JSON.stringify(pCard));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
