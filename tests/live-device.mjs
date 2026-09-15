/**
 * The board's own Preview: its right-click menu does what it says.
 *
 * Flip the board to Preview and right-press the site: the menu offers
 * Device (Desktop, Tablet, Phone) and Back to the board. Device called a
 * window hook that only the /builder/preview page installs, so on the
 * board it was undefined and the three entries did nothing; Back navigated
 * to /builder, the address you were already at, and the mode stayed
 * Preview. Both do their job now.
 *
 *   node tests/live-device.mjs [url]
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
/** Source without its comments, so a pin never matches the sentence explaining a removal. */
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
const node = (id, pageId) => ({ id, pageId, featureId: "cta", label: "Join", prompt: "", content: "", x: 200, y: 200, w: 320, h: 120, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "out", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null });
const seedOnePart = async (page) => {
  await page.evaluate((mk) => {
    const doc = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    const st = doc.state ?? {};
    const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
    st.nodes = [new Function("id", "pageId", `return (${mk})(id, pageId)`)("n1", pageId)];
    st.selection = [];
    doc.state = st;
    localStorage.setItem("builder.studio", JSON.stringify(doc));
  }, node.toString());
};
await seedOnePart(page);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

await page.keyboard.press("p");
await page.waitForTimeout(900);
const scroller = page.locator("[data-live-scroller]");
check("p flips the board to Preview", (await scroller.count()) === 1);
const siteWidth = () => page.locator("[data-live-scroller] > div > div").first().evaluate((el) => el.style.width);
check("which shows the site at the desktop width", (await siteWidth()) === "1440px", await siteWidth());

const pick = async (name) => {
  await scroller.click({ button: "right", position: { x: 40, y: 40 } });
  await page.waitForTimeout(400);
  const item = page.getByRole("menuitem", { name });
  if ((await item.count()) === 0) { await page.keyboard.press("Escape"); return false; }
  await item.first().click();
  await page.waitForTimeout(500);
  return true;
};

await scroller.click({ button: "right", position: { x: 40, y: 40 } });
await page.waitForTimeout(400);
check("the menu offers Device", (await page.getByRole("menuitem", { name: "Device" }).count()) === 1);
await page.getByRole("menuitem", { name: "Device" }).hover();
await page.waitForTimeout(400);
const phone = page.getByRole("menuitemcheckbox", { name: "Phone" });
check("with Phone under it", (await phone.count()) === 1);
if (await phone.count()) await phone.click();
await page.waitForTimeout(700);
check("choosing Phone shows the site at the phone width", (await siteWidth()) === "390px", await siteWidth());

const went = await pick("Back to the board");
check("Back to the board is offered", went);
check("and takes the board back to Design", (await scroller.count()) === 0 && (await page.locator("[data-frame]").count()) === 1, `${await scroller.count()} scrollers, ${await page.locator("[data-frame]").count()} frames`);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
