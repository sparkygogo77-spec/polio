/**
 * ON THE BOARD AN INERT PART LETS THE PRESS THROUGH.
 *
 * Sink marks a part the page never let take a press as `inert` (trumpmorty.fun's
 * grain, a fixed 1440×900 layer over everything at opacity .05). On the board it
 * lay over the whole first screen, so any press there picked the grain, not the
 * part the person was aiming at. A press on an inert part now reaches what is
 * under it; the inert part itself is left to be picked some other way.
 * Hit-testing only: nothing about how the board is drawn or scaled changes.
 *
 *   node tests/board-inert.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const node = (id, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("card", 500, 300, 300, 200, { colour: { bg: "rgb(200, 40, 40)" } }),
    node("grain", 0, 0, 1440, 900, { inert: true, opacity: 0.05, art: { blend: "multiply" }, colour: { bg: "rgb(0, 0, 0)" }, from: { selector: "body > div.grain", position: "fixed" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "INERT", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await ctx.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const hit = await page.evaluate(() => {
  const card = document.querySelector('[data-node-id="card"]')?.getBoundingClientRect();
  if (!card) return null;
  const top = document.elementFromPoint(card.left + card.width / 2, card.top + card.height / 2);
  return { on: top?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null, grain: !!document.querySelector('[data-node-id="grain"]') };
});
check("the grain is on the board", !!hit?.grain, JSON.stringify(hit));
check("a press on the card, under the grain, reaches the card", hit?.on === "card", JSON.stringify(hit));
if (hit?.on === "card") {
  const card = await page.locator('[data-node-id="card"]').boundingBox();
  await page.mouse.click(card.x + card.width / 2, card.y + card.height / 2);
  await page.waitForTimeout(400);
  const sel = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state?.selection ?? null);
  check("…and picks the card", Array.isArray(sel) ? sel.includes("card") && !sel.includes("grain") : true, JSON.stringify(sel));
}
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
