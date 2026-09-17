/**
 * A surface is a page.
 *
 * The ruling, in four words. A cube's side bound to a page stops being a
 * card with words on it and becomes that page: the page's own parts, drawn
 * at the face's size, under the site's own palette and lamp — on the board,
 * in the preview, and in what a publish writes. Live, a press on that side
 * goes there, because a page you can read and not open is not a page.
 *
 * Nothing here is measured at rest. The cube is dragged, released, and read
 * again after it has settled; the side is pressed; the page is checked for
 * the *other* page's parts by name, not for a box that happens to be there.
 *
 *     npx next start -p 3013
 *     node tests/surface-is-a-page.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, pageId, f, l, x, y, w, h, extra = {}) => ({
  id, pageId, featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/* Home holds the cube. About holds one part with a word on it nothing else
   on the site says, so finding that word inside the cube is proof the page
   itself is standing there and not a box that looks like one. */
const MARKER = "Thermosphere";
const doc = JSON.stringify({ state: {
  pages: [
    { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
    { id: "p1", name: "About", path: "/about", prompt: "", scroll: "inherit" },
  ],
  nodes: [
    node("box", "p0", "cube-3d", "The box", 420, 200, 480, 480, {
      cube: {
        faces: [
          { heading: "Front", body: "", colour: "" },
          { heading: "", body: "", colour: "", pageId: "p1" },
          { heading: "Back", body: "", colour: "" },
          { heading: "Left", body: "", colour: "" },
          { heading: "", body: "", colour: "" },
          { heading: "", body: "", colour: "" },
        ],
        turn: { x: -18, y: -32 },
      },
    }),
    node("about", "p1", "prose-block", "About", 40, 90, 1360, 300, { content: `${MARKER} is where the orbit begins.` }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

/* ------------------------------------------------------------------ */
/* On the board                                                         */
/* ------------------------------------------------------------------ */

const cube = page.locator("[data-cube]").first();
check("the cube is on the board", (await cube.count()) > 0);

const onBoard = await page.evaluate((word) => {
  const face = document.querySelector("[data-face-page]");
  return {
    faces: document.querySelectorAll("[data-face]").length,
    bound: !!face,
    page: face?.getAttribute("data-face-page") ?? "",
    says: (face?.textContent ?? "").includes(word),
    inside: !!face?.querySelector("[data-live-node]"),
  };
}, MARKER);
check("one of its sides is bound to a page", onBoard.bound, `page ${onBoard.page || "none"}`);
check("and that side is the page, drawn: the page's own parts stand on it", onBoard.inside);
check("with the other page's own words on it, not a box that looks like one", onBoard.says, MARKER);

/* ------------------------------------------------------------------ */
/* Exercised, not measured at rest                                      */
/* ------------------------------------------------------------------ */

const box = await cube.boundingBox();
const before = await cube.getAttribute("data-cube-turn");
/* Select it first: a cube on the board turns once it is the part in hand. */
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(500);
const held = await page.locator("[data-cube]").first().boundingBox();
await page.mouse.move(held.x + held.width / 2, held.y + held.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) {
  await page.mouse.move(held.x + held.width / 2 + i * 14, held.y + held.height / 2 + i * 2);
  await page.waitForTimeout(16);
}
await page.mouse.up();
await page.waitForTimeout(1800);
const after = await page.locator("[data-cube]").first().getAttribute("data-cube-turn");
check("dragging turns it, and it is somewhere else when it stops", before !== after, `${before} → ${after}`);

const stillThere = await page.evaluate((word) => {
  const face = document.querySelector("[data-face-page]");
  return !!face && (face.textContent ?? "").includes(word);
}, MARKER);
check("the page is still standing on the side after it has been turned", stillThere);

/* The panel offers the binding, and says what it means. The five side tabs
   are permanent and only a press moves them, so Element is asked for. */
await page.locator('[data-node-id="box"]').click({ force: true });
await page.waitForTimeout(500);
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(700);
const panel = await page.evaluate(() => {
  const list = document.querySelector("[data-face-list]");
  return {
    pickers: document.querySelectorAll("[data-face-pages]").length,
    chosen: [...document.querySelectorAll("[data-pick-page]")].filter((b) => b.getAttribute("aria-pressed") === "true").map((b) => b.getAttribute("data-pick-page")),
    said: (document.body.innerText || "").toLowerCase().includes("becomes that page"),
    listed: !!list,
  };
});
check("the panel offers a page for every side", panel.pickers === 6, `${panel.pickers} pickers`);
check("and shows which one this side already has", panel.chosen.includes("p1"), panel.chosen.join(", ") || "none");
check("and says, in words, what binding one means", panel.said);

/* ------------------------------------------------------------------ */
/* Live: a surface you can open                                         */
/* ------------------------------------------------------------------ */

await page.goto(`${URL_}/builder/preview/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const live = await page.evaluate((word) => {
  const face = document.querySelector("[data-face-page]");
  return { there: !!face, says: (face?.textContent ?? "").includes(word), page: document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "" };
}, MARKER);
check("the preview stands the page on the side too", live.there && live.says, live.page);

const target = await page.locator("[data-face-page]").first().boundingBox();
if (target) {
  await page.mouse.click(target.x + target.width / 2, target.y + target.height / 2);
  await page.waitForTimeout(1200);
}
const went = await page.evaluate(() => document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "");
check("and pressing it goes to that page", went === "p1", `${live.page} → ${went || "nowhere"}`);

await page.screenshot({ path: ".screenshots/surface-is-a-page.png" });
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/surface-is-a-page.png");
process.exit(bad ? 1 : 0);
