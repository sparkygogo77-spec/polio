/**
 * A CAPTURED PAGE PUBLISHED AT A PHONE'S WIDTH: WHAT A MOVING BOX CARRIES
 * STAYS WHERE THE SITE PUT IT.
 *
 * thesolface.site, captured at 1440, 834 and 390 and published: the
 * community links lift on hover, so the export carries each link's words
 * inside the link's element (`exportSite.ts`, `carryOwned`). The site's own
 * phone layout (`smallCss.ts`, "site" mode) placed every part against the
 * page, so the words, now inside the link, were placed from the link's
 * corner by the page's distance: 10 000 px further down, and the phone page
 * ran to 20 404 px where the site is 10 836.
 *
 * A stand-in page: a band, a heading and a link that lifts on hover with its
 * words in it, each with its box at 390 (`widths.phone`). Published and
 * opened at 390:
 *   (1) the link's words are carried inside the link's element (the case);
 *   (2) the words stand where the phone box says, against the page;
 *   (3) the page is as tall as the site's phone page, not more.
 * And the board's Phone view puts them in the same place.
 *
 *   npx next start -p 3013
 *   node tests/small-site-carried.mjs http://127.0.0.1:3013
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
const LIFT = { transition: [{ property: "transform", duration: "0.25s", timing: "ease", delay: "0s" }], hover: [{ selector: ".link:hover", self: true, style: { transform: "translateY(-5px)" } }] };
const nodes = [
  node("band", "box", "", 0, 0, 1440, 100, { ...from("body > header"), widths: { phone: { x: 0, y: 0, w: 390, h: 80 } } }),
  node("title", "prose", "STANDIN heading", 120, 160, 900, 80, { ...from("body > main > h1"), font: { size: 3 }, widths: { phone: { x: 16, y: 120, w: 358, h: 120, px: 32 } } }),
  node("words", "prose", "STANDIN words under the heading", 120, 260, 900, 40, { ...from("body > main > p"), widths: { phone: { x: 16, y: 260, w: 358, h: 60 } } }),
  node("link", "box", "", 600, 400, 300, 80, { ...from("body > main > a"), motion: LIFT, link: { kind: "url", target: "https://standin.test/x" }, widths: { phone: { x: 20, y: 900, w: 350, h: 60 } } }),
  node("link_words", "prose", "STANDIN join", 620, 420, 200, 40, { ...from("body > main > a > span"), widths: { phone: { x: 40, y: 910, w: 200, h: 40 } } }),
  node("foot", "box", "", 0, 600, 1440, 200, { ...from("body > footer"), widths: { phone: { x: 0, y: 1000, w: 390, h: 200 } } }),
];
const doc = {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], activePageId: "p0", hiddenFeatures: [], frameWidth: 1440, capturedWidths: [1440, 390],
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
await page.waitForTimeout(1000);

/* The board's Phone view. */
await page.locator('[data-device="phone"]').click();
await page.waitForSelector('[data-small-frame="phone"]', { timeout: 10000 });
await page.waitForTimeout(800);
const onBoard = await page.evaluate(() => {
  const root = document.querySelector('[data-small-frame="phone"] [data-small-page]');
  const el = root?.querySelector('[data-live-node="link_words"]');
  if (!root || !el) return null;
  const R = root.getBoundingClientRect(), k = R.width / 390, r = el.getBoundingClientRect();
  return { x: Math.round((r.left - R.left) / k), y: Math.round((r.top - R.top) / k) };
});
check("on the board's Phone view, the link's words where the site put them (40, 910)", !!onBoard && Math.abs(onBoard.x - 40) <= 2 && Math.abs(onBoard.y - 910) <= 2, JSON.stringify(onBoard));

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
const pub = await out.evaluate(() => {
  const el = document.getElementById("link_words"), host = document.getElementById("link");
  if (!el || !host) return null;
  const r = el.getBoundingClientRect();
  return { inside: host.contains(el), x: Math.round(r.left), y: Math.round(r.top + scrollY), height: document.documentElement.scrollHeight };
});
check("(1) published, the link's words are carried inside the link's element", !!pub?.inside, JSON.stringify(pub));
check("(2) published at 390, the link's words where the site put them (40, 910)", !!pub && Math.abs(pub.x - 40) <= 2 && Math.abs(pub.y - 910) <= 2, JSON.stringify(pub));
check("(3) published at 390, the page as tall as the site's phone page (1200)", !!pub && pub.height <= 1200 + 2, JSON.stringify(pub));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
