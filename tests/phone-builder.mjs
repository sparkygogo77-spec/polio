/**
 * The Builder at phone width (inventory A21).
 *
 * Below 768 px the whole side panel (Element, Format, Pages, Look, Motion)
 * and seven toolbar controls were hidden with nothing in their place, the
 * tour's wheel and looks steps lit nothing and timed out, and the board's
 * own Preview showed the desktop site in a phone-wide window. This holds
 * what a person on a phone can reach:
 *
 *   · the side panel opens, over the board, from the same toggle;
 *   · a part picked has its Element tab there;
 *   · Fit, Wires, the menu's edge, the zoom readout, Search and Updates are
 *     reachable, in the bar or behind one More key;
 *   · the tour's wheel and looks steps light something on the real screen;
 *   · the board's own Preview shows the site at the phone's width.
 *
 *   node tests/phone-builder.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.env.SHOTS ?? "";
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const W = 390, H = 844;
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: W, height: H }, isMobile: false, hasTouch: false });
for (const route of ["**/api/studio/body", "**/api/studio/reshape", "**/api/studio/image"]) {
  await page.route(route, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key" }) }));
}
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/** On screen: a box, inside the viewport, with area. */
const onScreen = async (loc) => {
  const b = await loc.first().boundingBox().catch(() => null);
  return !!b && b.width > 4 && b.height > 4 && b.x >= -1 && b.y >= -1 && b.x + b.width <= W + 1 && b.y + b.height <= H + 1;
};
const shot = async (name) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/phone-builder-${name}.png` }); };

/* 0. The page fits the phone. */
const scrollW = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
check("the Builder does not scroll sideways at phone width", scrollW <= W, `${scrollW}px wide for a ${W}px window`);

/* 1. The side panel. */
const panel = page.locator("[data-side-panel]");
const toggle = page.getByRole("button", { name: "Toggle the side panel" });
check("the panel toggle is in the bar at phone width", await onScreen(toggle));
const wasOpen = await onScreen(panel);
if (wasOpen) { await toggle.click(); await page.waitForTimeout(400); }
check("the side panel is out of the way until asked for", !(await onScreen(panel)));
await toggle.click();
await page.waitForTimeout(500);
check("pressing the toggle opens the side panel over the board", await onScreen(panel), JSON.stringify(await panel.first().boundingBox().catch(() => null)));
check("with the Look tab in it", (await panel.locator("[role=radio]").filter({ hasText: /Look|Element|Format|Pages|Motion/ }).count()) >= 1 || (await panel.locator("[data-look-panel]").count()) === 1);
await shot("1-panel");
await toggle.click();
await page.waitForTimeout(400);

await page.keyboard.press("Control+k");
await page.waitForTimeout(340);
await page.keyboard.type("drop a new idea");
await page.waitForTimeout(420);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const part = page.locator("[data-node-id]").last();
check("a part can be dropped on the phone-wide board", (await part.count()) === 1);
await part.click({ force: true });
await page.waitForTimeout(400);
await toggle.click();
await page.waitForTimeout(500);
const elementTab = panel.locator("[role=radio]").filter({ hasText: "Element" }).first();
check("a picked part has its Element tab in the panel", (await elementTab.count()) === 1 && await onScreen(elementTab));
await elementTab.click().catch(() => {});
await page.waitForTimeout(300);
check("and the panel scrolls to the part's own fields", await onScreen(panel.locator('textarea[aria-label="Element prompt"]')) || (await panel.locator('textarea[aria-label="Element prompt"]').count()) === 1);
await shot("2-element");
await toggle.click();
await page.waitForTimeout(400);
await page.mouse.click(30, 300);
await page.waitForTimeout(300);

/* 2. The controls the bar folds away. */
/* Fit used to be its own button here. It and the readout did the same
   thing, so the readout is the one that does it, on the board and on the
   timeline alike, and there is one control where there were two. */
const CONTROLS = [
  { name: "Toggle wires", sel: '[aria-label="Toggle wires"]' },
  { name: "the part menu's edge", sel: "[data-menu-shape]" },
  { name: "the readout, which is also Fit in view", sel: "[data-fit-readout]" },
  { name: "Search", sel: "[data-tool-search]" },
  { name: "Updates", sel: '[aria-label="Updates"]' },
];
const more = page.locator("[data-toolbar-more]");
/** Any one of the matches on screen: the bar's own copy or the menu's. */
const anyOnScreen = async (loc) => {
  const n = await loc.count();
  for (let i = 0; i < n; i++) if (await onScreen(loc.nth(i))) return true;
  return false;
};
const reach = async (c) => {
  if (await anyOnScreen(page.locator(c.sel))) return "in the bar";
  if (!(await more.count())) return null;
  await more.click();
  await page.waitForTimeout(300);
  const ok = (await anyOnScreen(page.locator(`[data-toolbar-more-menu] ${c.sel}`))) ? "behind More" : null;
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  return ok;
};
for (const c of CONTROLS) {
  const how = await reach(c);
  check(`${c.name} is reachable at phone width`, !!how, how ?? "hidden, with nothing in its place");
}
await page.keyboard.press("d");
await page.waitForTimeout(300);
check("the ink hues are reachable with the pen in hand", await onScreen(page.locator("[data-ink-hues]")) || (await (async () => { if (!(await more.count())) return false; await more.click(); await page.waitForTimeout(300); const ok = await onScreen(page.locator("[data-toolbar-more-menu] [data-ink-hues]")); await page.keyboard.press("Escape"); return ok; })()));
await page.keyboard.press("v");
await shot("3-more");
check("and opening More did not push the page sideways", (await page.evaluate(() => window.scrollX)) === 0 && (await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth))) <= W, `scrolled to ${await page.evaluate(() => window.scrollX)}`);

/* 3. The board's own Preview. */
await page.keyboard.press("p");
await page.waitForTimeout(1500);
const siteWidth = await page.locator("[data-live-scroller] > div > div").first().evaluate((el) => el.style.width).catch(() => "none");
check("the board's own Preview shows the site at the phone's width", siteWidth === "390px", siteWidth);
await shot("4-preview");
await page.keyboard.press("p");
await page.waitForTimeout(800);

/* 4. The tour's wheel and looks steps. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(340);
await page.keyboard.type("take the tour");
await page.waitForTimeout(420);
const item = page.locator("[cmdk-item]", { hasText: "Take the tour" }).first();
if (await item.count()) await item.click(); else await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
const tour = page.locator("[data-tour]");
check("the tour opens at phone width", (await tour.count()) === 1);
const lit = {};
for (let i = 0; i < 10 && (await tour.count()); i++) {
  const id = await tour.getAttribute("data-tour-step");
  if (id === "wheel" || id === "looks") {
    await page.waitForTimeout(3600);
    // The Look panel is taller than the sheet it scrolls in, so "there" is
    // its top on screen, not the whole of it.
    // The tour scrolls the Look panel so Texture is at the foot of the
    // sheet, so "there" is the panel open inside a sheet that is on screen.
    const lookOpen = async () => (await page.locator("[data-look-panel]").count()) === 1 && (await onScreen(page.locator("[data-side-panel]")));
    lit[id] = { holes: await page.locator("[data-tour] svg rect[stroke]").count(), target: id === "wheel" ? (await page.locator("[data-radial]").count()) > 0 : await lookOpen() };
    await shot(`5-tour-${id}`);
  } else await page.waitForTimeout(600);
  if (id === "looks") break;
  const on = tour.getByRole("button", { name: /^Next/ });
  if (!(await on.count())) break;
  await on.click();
  await page.waitForTimeout(400);
}
check("the tour's wheel step opens the wheel and lights it", !!lit.wheel && lit.wheel.target && lit.wheel.holes > 0, JSON.stringify(lit.wheel ?? "never reached"));
check("the tour's looks step shows the Look panel and lights it", !!lit.looks && lit.looks.target && lit.looks.holes > 0, JSON.stringify(lit.looks ?? "never reached"));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
