/**
 * A CARD TALLER THAN A WINDOW IS A SECTION: ONE PRESS INSIDE IT PICKS THE PART UNDER THE HAND.
 *
 * MEASURED on trendtrader-pro's tokenomics page (the import-gaps census,
 * 2026-11-08). The page's text sits in one 840 × 12544 `<article>` holding 11
 * parts, and an article is a card (`owner.ts#isCard`), so one press on any
 * heading, line, icon or picture in it picked the article, and everything in
 * it took two presses (7 of 36 sampled presses). A card is a thing a visitor
 * reads as one because it is in front of them whole; a part taller than a
 * window, or as wide as the page, is a section, and a press inside a section
 * picks the part under the hand.
 *
 * Held here, on a board with a tall article and a card-sized article, each
 * with a heading and a line in it:
 *   · one press on the tall article's heading picks the heading, not the article;
 *   · one press on its line picks the line, and two presses open it;
 *   · one press on the card's title still picks the card (`tests/select-owner.mjs`);
 *   · a press on the tall article's own bare ground picks the article;
 * and, given trendtrader-pro's capture, one press on a line in its tokenomics article picks the line (or the box round it), never the article.
 *
 *   npx next start -p 3013
 *   node tests/tall-card-press.mjs http://127.0.0.1:3013
 *   node tests/tall-card-press.mjs http://127.0.0.1:3013 <folder with site/document.json of trendtrader-pro>
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const FONT = { face: "Arial", stack: "Arial, sans-serif", size: 1, px: 16, weight: 500, leading: 1.4 };
const from = (selector) => ({ url: "https://x.test/", host: "x.test", selector, at: 1 });
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("page", "box", "", 0, 0, 1440, 3400, { colour: { bg: "#141820" }, from: from("body > main") }),
    /* The tall article: the whole page's text in one element. */
    node("tall", "box", "", 300, 100, 840, 3000, { colour: { bg: "#1c2230" }, from: from("body > main > article") }),
    node("tall_head", "value-prop", "Tokenomics", 340, 140, 760, 60, { font: { ...FONT, px: 40, size: 2.5 }, colour: { text: "#f0f0f0" }, from: from("body > main > article > h1") }),
    node("tall_line", "prose", "A line of the article, long enough to press on.", 340, 240, 760, 24, { font: FONT, colour: { text: "#d0d0d0" }, from: from("body > main > article > p:nth-of-type(1)") }),
    /* A card-sized article beside it. */
    node("card", "box", "", 40, 100, 220, 300, { colour: { bg: "#263040" }, from: from("body > main > aside > article") }),
    node("card_title", "value-prop", "A card title", 60, 130, 180, 60, { font: FONT, colour: { text: "#f0f0f0" }, from: from("body > main > aside > article > h2") }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "TALL", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const selection = () => page.evaluate(() => window.__studioSelection?.() ?? []);
const clear = async () => { await page.evaluate(() => window.__studioHistory.act("clearSelection")); await page.waitForTimeout(250); };
const centre = (id) => page.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const editor = () => page.locator("[data-words-in-place]").count();

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="tall_line"]', { timeout: 20000 });
await page.waitForTimeout(1500);

let at = await centre("tall_head");
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("one press on the tall article's heading picks the heading, not the article", JSON.stringify(await selection()) === '["tall_head"]', JSON.stringify(await selection()));
await clear();
at = await centre("tall_line");
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("one press on its line picks the line", JSON.stringify(await selection()) === '["tall_line"]', JSON.stringify(await selection()));
await page.mouse.dblclick(at[0], at[1]); await page.waitForTimeout(700);
check("two presses there open the line", (await editor()) === 1, `editor ${await editor()}`);
await page.keyboard.press("Escape"); await page.waitForTimeout(300); await clear();
at = await centre("card_title");
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("control: one press on a card-sized article's title still picks the card", JSON.stringify(await selection()) === '["card"]', JSON.stringify(await selection()));
await clear();
const bare = await page.evaluate(() => { const r = document.querySelector('[data-node-id="tall"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + 20]; });
await page.mouse.click(bare[0], bare[1]); await page.waitForTimeout(500);
check("a press on the tall article's own bare ground picks the article", JSON.stringify(await selection()) === '["tall"]', JSON.stringify(await selection()));
await clear();

if (SINK && existsSync(join(SINK, "site/document.json"))) {
  const { importSink, captureParts } = await import("./lib/sink.mjs");
  const want = captureParts(SINK);
  const ARTICLE = "n_box_991", LINES = ["n_prose_1015", "n_valueprop_997", "n_drawnicon_1039", "n_picture_1135"];
  if (!want.has(ARTICLE)) console.log("  (this capture has no n_box_991: not trendtrader-pro; the capture half is skipped)");
  else {
    const ctx2 = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
    const p2 = await ctx2.newPage();
    p2.on("pageerror", (e) => errors.push(e.message));
    await importSink(p2, BASE, SINK, { atLeast: Math.floor(want.size * 0.8), settle: 6000 });
    await p2.evaluate((id) => window.__studioHistory.act("setActivePage", id), want.get(ARTICLE).pageId);
    await p2.waitForTimeout(10000);
    for (const id of LINES) {
      /* Let go of the last pick outright: Escape climbs to the holder, and a picked holder its parts cover whole is kept by a press anywhere on it (`pressRead.ts#coveredHolder`, EDIT-ISSUES #17), which is another rule. */
      await p2.evaluate(() => window.__studioHistory.act("clearSelection")); await p2.waitForTimeout(150);
      await p2.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); const pane = document.querySelector("[data-studio-pane]"); const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect(); pane.scrollTop += r.top - p.top + Math.min(r.height, p.height - 160) / 2 - p.height / 2; }, id);
      await p2.waitForTimeout(900);
      const c = await p2.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect(); const x = r.left + r.width / 2, y = Math.min(Math.max(r.top + r.height / 2, pane.top + 8), pane.bottom - 8); return [x, y, document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null]; }, id);
      /* The board draws far parts as the view nears them: a point the browser does not yet hit the part at says nothing about who owns it. */
      if (c[2] !== id) { console.log(`  (trendtrader: the browser hits ${c[2]} at ${id}'s centre, not the part: not drawn yet there; skipped)`); continue; }
      await p2.mouse.click(c[0], c[1]); await p2.waitForTimeout(300);
      const picked = await p2.evaluate(() => window.__studioSelection?.() ?? []);
      const got = picked[0] ? want.get(picked[0]) : null;
      check(`trendtrader: one press on ${id} picks it or a box round it no taller than a window, never the article`, picked.length === 1 && picked[0] !== ARTICLE && (!got || got.h <= 900), `picked ${JSON.stringify(picked)}${got ? ` (${got.w}×${got.h})` : ""}`);
    }
    await ctx2.close();
  }
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
