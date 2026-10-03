/**
 * THE SHELF GIVES THE CANVAS BACK, AND SEARCH FINDS WHAT IS ON THE PAGE.
 *
 * The shelf was always open, 248px of the screen; opening a category took
 * half the canvas; Escape did not close it; its close button sat at the far
 * right end of the row. And "Search parts…" searched only the catalogue, so
 * typing "copy" with a COPY button on the page found nothing on the page.
 * Held here:
 *
 *   · the shelf folds to a thin strip and opens again, and the choice is
 *     kept across a reload;
 *   · an open category opens at about a third of the canvas and fills the
 *     shelf; dragging its top edge takes it taller, up to most of the
 *     canvas, and the height is kept across a reload; the list scrolls under
 *     the search, which stays at the top;
 *   · Escape closes the open category, and its close button sits beside its
 *     name;
 *   · a search lists this page's parts first (by words, name and kind), a
 *     press on one picks it and brings it on screen, and the shelf's own
 *     parts follow under "Add from the shelf".
 *
 *   npx next start -p 3013
 *   node tests/shelf-strip.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
mkdirSync(".screenshots", { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const rows = Array.from({ length: 24 }, (_, i) => node(`row${i}`, "value-prop", `Row ${i + 1}`, 120, 60 + i * 150, 600, 90));
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [...rows, node("copybtn", "value-prop", "COPY", 300, 3200, 200, 60, { data: "button, named COPY" })],
  groups: [], shapes: [], format: {}, brief: { name: "SHELF", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); localStorage.removeItem("builder.shelf.folded"); localStorage.removeItem("builder.shelf.height"); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="row0"]', { timeout: 20000 });
await page.waitForTimeout(1500);

const bandH = () => page.evaluate(() => Math.round(document.querySelector("[data-studio-band]").getBoundingClientRect().height));
/* The canvas: the board and the shelf under it (the shelf is the pane's sibling; the board stops above it). */
const paneH = () => page.evaluate(() => document.querySelector("[data-studio-pane]").parentElement.clientHeight);

/* fold and unfold, remembered */
const open0 = await bandH();
await page.getByRole("button", { name: "Fold the parts shelf away" }).click();
await page.waitForTimeout(400);
const folded = await bandH();
check("the shelf folds to a thin strip", folded <= 40, `${open0} -> ${folded}px`);
await page.screenshot({ path: ".screenshots/shelf-folded.png" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("…and stays folded after a reload", (await bandH()) <= 40, `${await bandH()}px`);
await page.getByRole("button", { name: "Open the parts shelf" }).click();
await page.waitForTimeout(400);
check("…and opens again with one press", (await bandH()) > 100, `${await bandH()}px`);

/* an open category: a third of the canvas by default, taller by the grip */
const first = page.locator("[data-planets] [data-category]").first();
const catName = await first.getAttribute("aria-label");
await first.click();
await page.waitForTimeout(600);
const cap = Math.round((await paneH()) * 0.36);
check("an open category opens at about a third of the canvas", (await bandH()) <= cap && (await bandH()) >= Math.round((await paneH()) * 0.25), `${await bandH()} of a ${await paneH()} canvas`);

/* The open category is the shelf's body: it reaches the shelf's foot. */
const fills = await page.evaluate(() => {
  const list = document.querySelector("[data-shelf]").getBoundingClientRect();
  const sec = document.querySelector("[data-category-open]").getBoundingClientRect();
  return { list: Math.round(list.bottom), sec: Math.round(sec.bottom), h: Math.round(sec.height) };
});
check("the open category fills the shelf's height", fills.sec >= fills.list - 2, `category ends at ${fills.sec}, the shelf at ${fills.list}`);
const grip = await page.locator("[data-shelf-grip]").boundingBox();
await page.mouse.move(grip.x + 200, grip.y + grip.height / 2);
await page.mouse.down();
await page.mouse.move(grip.x + 200, 60, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
const tall = await bandH();
check("dragging its top edge up makes it taller than a third", tall > cap + 40, `${tall} of ${await paneH()}`);
check("…up to most of the canvas, never all of it", tall <= Math.round((await paneH()) * 0.86), `${tall} of ${await paneH()}`);
const fillsTall = await page.evaluate(() => {
  const list = document.querySelector("[data-shelf]").getBoundingClientRect();
  const sec = document.querySelector("[data-category-open]").getBoundingClientRect();
  return { list: Math.round(list.bottom), sec: Math.round(sec.bottom) };
});
check("…and the open category grows with it to the shelf's foot", fillsTall.sec >= fillsTall.list - 2, `category ends at ${fillsTall.sec}, the shelf at ${fillsTall.list}`);
/* The owner's case: a SHORT category in a tall shelf. A sub-group chip is
   the way a category gets short, so the smallest one is chosen and measured:
   the category must still reach the shelf's foot. */
{
  const section = page.locator("[data-category-open]").first();
  const chips = section.locator("button[aria-pressed]");
  const n = await chips.count();
  let best = null;
  for (let i = 0; i < n; i++) {
    await chips.nth(i).click();
    await page.waitForTimeout(250);
    const m = await page.evaluate(() => {
      const sec = document.querySelector("[data-category-open]"); const list = document.querySelector("[data-shelf]");
      const content = [...sec.children].reduce((h, k) => h + k.getBoundingClientRect().height, 0);
      return { content: Math.round(content), room: list.clientHeight, secBottom: Math.round(sec.getBoundingClientRect().bottom), listBottom: Math.round(list.getBoundingClientRect().bottom) };
    });
    if (!best || m.content < best.content) best = { ...m, i };
    await chips.nth(i).click();   // and off again
    await page.waitForTimeout(150);
  }
  if (best) { await chips.nth(best.i).click(); await page.waitForTimeout(250); }
  const now = await page.evaluate(() => { const sec = document.querySelector("[data-category-open]"); const list = document.querySelector("[data-shelf]"); return { secBottom: Math.round(sec.getBoundingClientRect().bottom), listBottom: Math.round(list.getBoundingClientRect().bottom) }; });
  check("a short category in a tall shelf still fills it to the foot", !!best && best.content < best.room && now.secBottom >= now.listBottom - 2,
    best ? `its cards take ${best.content}px of ${best.room}; the category ends at ${now.secBottom}, the shelf at ${now.listBottom}` : "no sub-groups to narrow it");
  await page.screenshot({ path: ".screenshots/shelf-short-category-fills.png" });
  if (best) { await chips.nth(best.i).click(); await page.waitForTimeout(250); }
}
/* The list scrolls under the search, which stays where it is. */
const searchAt = async () => page.evaluate(() => { const r = document.querySelector("[data-parts-search]").getBoundingClientRect(); const b = document.querySelector("[data-studio-band]").getBoundingClientRect(); return { top: Math.round(r.top), inBand: r.top >= b.top - 1 && r.bottom <= b.bottom + 1 && r.height > 20 }; });
const s0 = await searchAt();
await page.evaluate(() => { const l = document.querySelector("[data-shelf]"); l.scrollTop = l.scrollHeight; });
await page.waitForTimeout(300);
const s1 = await searchAt();
const scrolled = await page.evaluate(() => document.querySelector("[data-shelf]").scrollTop);
check("scrolled to the end of the list, the search is still at the top of the shelf", scrolled > 0 && s1.inBand && s1.top === s0.top, `list at ${scrolled}, search at ${s0.top} then ${s1.top}`);
await page.screenshot({ path: ".screenshots/shelf-dragged-tall.png" });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator(`[data-planets] [data-category]`).first().click();
await page.waitForTimeout(600);
check("the height he dragged it to is kept across a reload", Math.abs((await bandH()) - tall) <= 2, `${tall} then ${await bandH()}`);
const g2 = await page.locator("[data-shelf-grip]").boundingBox();
await page.mouse.move(g2.x + 200, g2.y + g2.height / 2);
await page.mouse.down();
await page.mouse.move(g2.x + 200, g2.y + 80, { steps: 6 });
await page.mouse.up();
await page.waitForTimeout(300);
check("…and dragging it down makes it shorter", (await bandH()) < tall - 40, `${tall} then ${await bandH()}`);

/* the close button beside the name */
const section = page.locator("[data-category-open]").first();
const nameBox = await section.locator("span").filter({ hasText: catName }).first().boundingBox();
const closeBox = await section.getByRole("button", { name: `Close ${catName}` }).boundingBox();
check("the close button sits beside the category's name", !!nameBox && !!closeBox && closeBox.x - (nameBox.x + nameBox.width) < 24 && closeBox.x > nameBox.x, JSON.stringify({ nameBox, closeBox }));
await page.screenshot({ path: ".screenshots/shelf-category-third.png" });

/* Escape closes it */
/* A press on the open category's own header: the shelf is the last thing
   touched and nothing on the board is picked. (A fixed point low on the
   screen is inside the shelf now it can be tall, and may be a card, whose
   press opens its detail card: Escape then closes that first.) */
const head = await page.locator("[data-category-open] span").filter({ hasText: catName }).first().boundingBox();
await page.mouse.click(head.x + 4, head.y + head.height / 2);
await page.waitForTimeout(200);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);
check("Escape closes the open category", (await page.locator("[data-category-open]").count()) === 0);

/* search: this page first */
await page.getByLabel("Search parts").fill("copy");
await page.waitForTimeout(500);
const pageHits = await page.locator("[data-page-results] [data-page-hit]").evaluateAll((els) => els.map((e) => e.getAttribute("data-page-hit")));
check("searching \"copy\" finds the COPY button on this page", pageHits[0] === "copybtn", pageHits.join(","));
const order = await page.evaluate(() => {
  const a = document.querySelector("[data-page-results]")?.getBoundingClientRect().top ?? 1e9;
  const b = document.querySelector("[data-shelf-results]")?.getBoundingClientRect().top ?? -1;
  return { a, b, label: document.querySelector("[data-shelf-results]")?.textContent };
});
check("…and the shelf's parts follow, under \"Add from the shelf\"", order.b > order.a && order.label === "Add from the shelf", JSON.stringify(order));
await page.screenshot({ path: ".screenshots/search-page-first.png" });
await page.locator('[data-page-hit="copybtn"]').click();
await page.waitForTimeout(700);
const seen = await page.evaluate(() => {
  const el = document.querySelector('[data-node-id="copybtn"]');
  const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
  const band = document.querySelector("[data-studio-band]").getBoundingClientRect();
  const r = el.getBoundingClientRect();
  return { picked: !!el.querySelector(":scope > [data-resize]"), onScreen: r.top >= pane.top && r.bottom <= band.top };
});
check("choosing it picks it", seen.picked);
check("…and brings it on screen", seen.onScreen);
await page.screenshot({ path: ".screenshots/search-picked.png" });
await page.getByLabel("Search parts").fill("row 1");
await page.waitForTimeout(400);
const byWords = await page.locator("[data-page-hit]").evaluateAll((els) => els.map((e) => e.getAttribute("data-page-hit")));
check("words are searched as well as names", byWords.includes("row0"), byWords.slice(0, 5).join(","));

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
