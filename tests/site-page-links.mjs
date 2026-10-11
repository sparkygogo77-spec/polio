#!/usr/bin/env node
/**
 * A PAGE LINK ON THE PUBLISHED SITE STAYS ON THE SITE.
 *
 * /site is the page visitors get ("/" redirects there once a document is
 * published) and the author's "what publishing would show". It is the live
 * preview with its bar hidden, and its page links went through the
 * preview's own `goPage`, which always pushed `/builder/preview/<page>`:
 * a visitor pressing the nav's "About" landed in the Builder's preview, with
 * Board, the page chips and the device switch showing.
 *
 *   1. `livePath` takes a base: the preview's by default, "/site" on the
 *      site; Home has no suffix on either.
 *   2. On /site, a button linked to the second page goes to /site/about,
 *      draws that page, and the preview bar stays hidden.
 *   3. In the preview the same button still goes to /builder/preview/about.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/site-page-links.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/live/PreviewPage.tsx, src/features/studio/live/PublishedPage.tsx, src/features/studio/board/store/load.ts
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const PAGES = [
  { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
  { id: "p1", name: "About", path: "/about", prompt: "", scroll: "inherit" },
];

/* 1. */
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { livePath, useStudio } = await jiti.import(join(here, "..", "src/features/studio/board/store.ts"));
useStudio.setState({ pages: PAGES, activePageId: "p0" });
const paths = [livePath("p0"), livePath("p1"), livePath("p0", "/site"), livePath("p1", "/site")];
check("1. livePath: the preview's addresses by default, the site's with its base", paths.join(" ") === "/builder/preview /builder/preview/about /site /site/about", paths.join(" "));

/* 2. */
const node = (id, pageId, f, content, x, y, w, h, extra = {}) => ({
  id, pageId, featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const doc = JSON.stringify({ state: {
  pages: PAGES,
  nodes: [
    node("to-about", "p0", "cta-primary", "About us", 80, 80, 260, 56, { link: { kind: "page", target: "p1" } }),
    node("about-words", "p1", "cta-primary", "On the about page", 80, 80, 260, 56),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Links", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const press = async () => {
  const b = await page.locator('[data-live-node="to-about"] button').first().boundingBox();
  if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  for (let i = 0; i < 20 && !/\/about$/.test(new URL(page.url()).pathname); i++) await page.waitForTimeout(200);
  await page.waitForTimeout(800);
  return !!b;
};
const shown = () => page.evaluate(() => ({
  page: document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "",
  bar: (() => { const b = document.querySelector("[data-live-bar]"); return b ? getComputedStyle(b).display : "none"; })(),
  board: [...document.querySelectorAll('[aria-label="Back to board"]')].some((e) => e.getClientRects().length > 0),
}));

await page.goto(`${URL_}/site`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const pressedSite = await press();
const onSite = await shown();
const sitePath = new URL(page.url()).pathname;
check("2. on /site the link is there to press", pressedSite);
check("…and goes to /site/about, not into the Builder's preview", sitePath === "/site/about", sitePath);
check("…drawing the About page", onSite.page === "p1", onSite.page || "nothing");
check("…with no preview bar and no Board button", onSite.bar === "none" && !onSite.board, JSON.stringify(onSite));

/* 3. */
await page.goto(`${URL_}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await press();
const inPreview = await shown();
const previewPath = new URL(page.url()).pathname;
check("3. in the preview the same link still goes to /builder/preview/about", previewPath === "/builder/preview/about" && inPreview.page === "p1", `${previewPath} ${inPreview.page}`);
check("…with its bar", inPreview.bar !== "none", inPreview.bar);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
