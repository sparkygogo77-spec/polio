#!/usr/bin/env node
/**
 * A BUILDS CARD IS A PICTURE, AND THE LIVE RENDER IS ONE PRESS AWAY.
 *
 * From the owner's walk-through: every card drew its whole site live, 30,890
 * page elements and 470 keyboard stops on one page, Parasite's Connect and
 * Trade buttons and TrendTrader's cookie buttons among them. Now:
 *   1. each card's picture is one image, made once off screen and kept, and
 *      never a keyboard stop;
 *   2. the page carries a few hundred elements, not tens of thousands;
 *   3. a reload shows the kept pictures without drawing any site again;
 *   4. Preview opens the live render on demand, Escape closes it, and the
 *      page is light again.
 *
 * Seeded with four sites of 400 parts each (headers, heroes, calls to action, forms, cookie banners, tabs,
 * words), one kept the way a big site is (IndexedDB and a pointer). It prints
 * page elements and keyboard stops; `MEASURE_ONLY=1` measures without the
 * checks, which is how the numbers before this change were taken.
 *
 *   node tests/builds-thumbs.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const ONLY = !!process.env.MEASURE_ONLY;
const results = [];
const check = (name, ok, detail = "") => { if (ONLY) return; results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const kinds = ["sticky-header", "hero-split", "cta-primary", "newsletter", "cookie-consent", "contact-form", "tabs-panel", "prose"];
const docOf = (seed) => env({
  pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [],
  nodes: Array.from({ length: 400 }, (_, i) => ({ id: `n${seed}_${i}`, pageId: "page_home", featureId: kinds[(i + seed) % kinds.length], label: `part ${i}`, prompt: "", content: `Part ${i} of site ${seed}`, data: "", x: 40 + (i % 4) * 340, y: 40 + Math.floor(i / 4) * 260, w: 320, h: 240, groupId: null, options: {}, priority: "must", custom: false })),
});
const sites = ["Parasite", "TrendTrader", "Trump & Morty", "SOLCINERATOR"].map((name, i) => ({ id: `p${i}`, name, updatedAt: Date.now() - i * 1000 }));
await page.goto(`${BASE}/builds`, { waitUntil: "domcontentloaded" });
await page.evaluate(async ({ builds, docs }) => {
  localStorage.clear();
  localStorage.setItem("builder.builds", builds);
  localStorage.setItem("builder.studio", docs[0]);
  localStorage.setItem("builder.doc:p1", docs[1]);
  localStorage.setItem("builder.doc:p2", docs[2]);
  await new Promise((ok, no) => {
    const req = indexedDB.open("builder.docs", 1);
    req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains("docs")) req.result.createObjectStore("docs"); };
    req.onerror = () => no(req.error);
    req.onsuccess = () => { const tx = req.result.transaction("docs", "readwrite"); tx.objectStore("docs").put(docs[3], "builder.doc:p3"); tx.oncomplete = () => ok(); tx.onerror = () => no(tx.error); };
  });
  localStorage.setItem("builder.doc:p3", JSON.stringify({ idb: true, bytes: docs[3].length, pages: 1, parts: 400, siteRepo: null }));
  await new Promise((ok) => { const d = indexedDB.deleteDatabase("builder.thumbs"); d.onsuccess = d.onerror = d.onblocked = () => ok(); });
}, { builds: env({ projects: sites, activeId: "p0" }), docs: [0, 1, 2, 3].map(docOf) });

/** Page elements, and keyboard stops: everything Tab can reach (focusable, shown, not inert, not disabled). */
const measure = () => page.evaluate(() => {
  const sel = "a[href], button, input, select, textarea, [tabindex], [contenteditable='true'], summary, iframe";
  const stops = [...document.querySelectorAll(sel)].filter((e) => !e.closest("[inert]") && !e.disabled && e.getAttribute("tabindex") !== "-1" && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden");
  /* Focusable by markup, inert or not: what a count of the page's controls finds, and what an older browser without inert would Tab through. */
  const raw = document.querySelectorAll("a[href], button, input, select, textarea, [tabindex]:not([tabindex='-1']), [contenteditable='true']").length;
  return { elements: document.querySelectorAll("*").length, stops: stops.length, raw };
});
const t0 = Date.now();
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
if (ONLY) {
  await page.waitForTimeout(4000);
  console.log(`MEASURE ${JSON.stringify(await measure())}`);
  await browser.close();
  process.exit(0);
}
/* Every card's picture made. */
let made = 0;
for (let i = 0; i < 120; i++) { made = await page.locator("[data-builds-list] img[data-site-thumb]").count(); if (made >= 4) break; await page.waitForTimeout(500); }
const firstMs = Date.now() - t0;
await page.waitForTimeout(500);
const after = await measure();
console.log(`  after: ${after.elements} page elements, ${after.stops} keyboard stops, ${after.raw} focusable by markup (pictures made in ${(firstMs / 1000).toFixed(1)} s)`);
check("every card's picture is one image", made === 4, `${made} of 4`);
const imgs = await page.evaluate(() => [...document.querySelectorAll("img[data-site-thumb]")].map((i) => ({ w: i.naturalWidth, h: i.naturalHeight, src: i.src.slice(0, 15), tab: i.tabIndex, bytes: i.src.length })));
check("…a small WebP picture, made at twice the card's width", imgs.every((i) => i.src === "data:image/webp" && i.w === 720 && i.bytes < 400_000), JSON.stringify(imgs.map((i) => `${i.w}x${i.h} ${Math.round(i.bytes / 1024)} KB`)));
check("…and not a keyboard stop", imgs.every((i) => i.tab === -1));
check("nothing of any site's own parts is drawn on the page", (await page.locator("[data-builds-list] li button [data-feature], [data-thumb-maker]").count()) === 0);
check("the page is light: under 1,500 elements", after.elements < 1500, `${after.elements}`);
check("keyboard stops are the page's own controls only: under 60", after.stops < 60, `${after.stops}`);
await page.screenshot({ path: ".screenshots/builds-thumbs-cards.png", fullPage: true });

/* The pictures are kept: a reload draws no site to show them. */
await page.reload({ waitUntil: "domcontentloaded" });
let drew = false;
for (let i = 0; i < 20; i++) { if (await page.locator("[data-thumb-maker]").count()) drew = true; if ((await page.locator("[data-builds-list] img[data-site-thumb]").count()) >= 4) break; await page.waitForTimeout(150); }
check("a reload shows the kept pictures and draws no site again", !drew && (await page.locator("[data-builds-list] img[data-site-thumb]").count()) === 4, drew ? "a site was drawn again" : "");

/* Preview, on demand. */
await page.locator("li", { hasText: "Parasite" }).getByRole("button", { name: "Preview Parasite" }).click();
await page.waitForTimeout(1200);
const open = await page.evaluate(() => ({ live: document.querySelector("[data-site-preview-live]")?.querySelectorAll("*").length ?? 0, all: document.querySelectorAll("*").length }));
check("Preview opens the site drawn live", open.live > 400, `${open.live} elements in the preview`);
await page.screenshot({ path: ".screenshots/builds-thumbs-preview.png" });
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
const closed = await measure();
check("Escape closes it, and the page is light again", (await page.locator("[data-site-preview-live]").count()) === 0 && closed.elements < 1500, `${closed.elements}`);

check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
