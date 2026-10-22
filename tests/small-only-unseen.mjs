/**
 * A PART THE PAGE SHOWS ON A PHONE ONLY IS NOT SEEN ON THE DESKTOP.
 *
 * thesolface.site's menu button ("Open navigation") shows at a tablet and a
 * phone only. The capture makes it a part of its own with no box on the
 * desktop, 0 × 0 at 0, 0, and its boxes at the small widths
 * (`capture-to-document.mjs`, `n_ctaprimary_small_*`). A box 0 wide still
 * drew its words: on the desktop board "Open navigation" ran across the top
 * left over the header (the board grew it to 33 tall to hold them), and on
 * the published page at 1440 it stood half off the left edge at y 7.
 *
 * A captured part with no width where it is drawn shows nothing there: the
 * board leaves it out, and the published page clips it to its box, which
 * the small widths' rules open to the button's own.
 *
 *   npx next start -p 3013
 *   node tests/small-only-unseen.mjs http://127.0.0.1:3013
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
  node("band", "box", "", 0, 0, 1440, 100, { ...from("body > header"), colour: { bg: "#ffffff" }, widths: { phone: { x: 0, y: 0, w: 390, h: 80 } } }),
  node("title", "prose", "STANDIN heading", 120, 160, 900, 80, { ...from("body > main > h1"), widths: { phone: { x: 16, y: 120, w: 358, h: 80 } } }),
  node("menu", "cta-primary", "Open navigation", 0, 0, 0, 0, { ...from("body > header > div > button"), label: "button “Open navigation”", widths: { phone: { x: 260, y: 18, w: 110, h: 45 } } }),
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
await page.waitForTimeout(1500);

/* Words seen: a line of them whose middle the page shows (what is under that point is the words' own element). */
const SEEN = (root, id) => {
  const el = root.querySelector(`[data-node-id="${id}"], [data-live-node="${id}"], #${id}`);
  if (!el) return { found: false, seen: 0 };
  let seen = 0;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let t = tw.nextNode(); t; t = tw.nextNode()) {
    if (!t.textContent.trim()) continue;
    const g = document.createRange(); g.selectNodeContents(t);
    for (const q of g.getClientRects()) {
      for (const fx of [0.25, 0.5, 0.75]) {
        const x = q.left + q.width * fx, y = q.top + q.height / 2;
        if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
        const hit = document.elementFromPoint(x, y);
        if (hit && (t.parentElement === hit || t.parentElement.contains(hit) || hit.contains(t.parentElement))) seen++;
      }
    }
  }
  return { found: true, seen };
};

const board = await page.evaluate(`(${SEEN})(document, "menu")`);
check("on the desktop board, the phone-only menu button's words are not seen", board.seen === 0, JSON.stringify(board));
const grown = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.id === "menu"));
check("…and the board does not grow it to hold them", (grown?.h ?? 0) === 0, `h ${grown?.h}`);

const files = (await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null))) ?? [];
const byPath = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f]));
const open = async (width) => {
  const out = await browser.newPage({ viewport: { width, height: 844 } });
  await out.route("http://site.test/**", (r) => {
    const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
    const f = byPath.get(path);
    if (!f) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ status: 200, contentType: path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html", body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await out.goto("http://site.test/index.html", { waitUntil: "load" });
  await out.waitForTimeout(900);
  return out;
};
const wide = await open(1440);
const atWide = await wide.evaluate(`(${SEEN})(document, "menu")`);
check("published at 1440, its words are not seen", atWide.found && atWide.seen === 0, JSON.stringify(atWide));
const phone = await open(390);
const atPhone = await phone.evaluate(`(${SEEN})(document, "menu")`);
check("control: published at 390, the menu button's words are seen", atPhone.found && atPhone.seen > 0, JSON.stringify(atPhone));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
