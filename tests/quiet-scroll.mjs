/**
 * The middle scrolls, the panels hold still, and nothing shows a bar.
 *
 * J's three, exactly: no scrollbar on the website page or on the design
 * background at the right; able to scroll down past the design box and on
 * into the categories and the prompt sections below; and doing that must not
 * move the side panels.
 *
 * The scroll and the wider gutter went in together, as one decision: a
 * full-screen pane makes the board's fit width-held rather than height-held,
 * which grew the frame until there was almost no ground left to take hold of
 * — and dragging bare ground is how the board is panned.
 *
 * The bar is the awkward half to check. This container's browser draws
 * overlay scrollbars, so measuring `offsetWidth - clientWidth` reads zero on
 * every surface whether a bar is suppressed or not — it would pass with the
 * rule deleted. So the rule itself is what is checked, on the surfaces that
 * actually scroll, which is the thing that differs between a machine that
 * shows bars and this one.
 *
 *   node tests/quiet-scroll.mjs [url]
 */
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

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2000);

/* ------------------------------------------------------------------ */
/* 1. Every surface that scrolls is silent about it                    */
/* ------------------------------------------------------------------ */

const loud = await page.evaluate(() => {
  const out = [];
  for (const e of document.querySelectorAll("*")) {
    const cs = getComputedStyle(e);
    if (!/(auto|scroll)/.test(cs.overflowY) && !/(auto|scroll)/.test(cs.overflowX)) continue;
    if (e.clientWidth < 40 || e.clientHeight < 30) continue;
    const canScroll = e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1;
    if (!canScroll) continue;
    /* `scrollbar-width: none` is the standard rule; the webkit
       pseudo-element cannot be read from script, so the computed standard
       property is the one that can be checked and both are set together. */
    if (cs.scrollbarWidth === "none") continue;
    const tag = `${e.tagName.toLowerCase()}${[...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("")}`;
    out.push(`${tag} ${e.clientWidth}x${e.clientHeight}`);
  }
  return out;
});
check("nothing that scrolls shows a bar", loud.length === 0,
  loud.length ? loud.join(", ") : "every scrolling surface asks for no bar");

/* ------------------------------------------------------------------ */
/* 2. The middle scrolls past the design box                           */
/* ------------------------------------------------------------------ */

const mid = page.locator("[data-studio-scroll]");
const room = await mid.evaluate((e) => ({ view: e.clientHeight, content: e.scrollHeight }));
check("there is more below the design box than one screen", room.content > room.view + 40,
  `${room.content} of content in ${room.view} of window`);

const before = await page.evaluate(() => ({
  top: document.querySelector("[data-studio-scroll]").scrollTop,
  panels: [...document.querySelectorAll("[data-side-panel]")].map((a) => Math.round(a.getBoundingClientRect().top)),
}));
await mid.evaluate((e) => { e.scrollTop = e.scrollHeight; });
await page.waitForTimeout(500);
const after = await page.evaluate(() => ({
  top: document.querySelector("[data-studio-scroll]").scrollTop,
  panels: [...document.querySelectorAll("[data-side-panel]")].map((a) => Math.round(a.getBoundingClientRect().top)),
  shelf: document.querySelector("[data-shelf]")?.getBoundingClientRect().height ?? 0,
}));
check("scrolling carries you down past it", after.top > before.top + 40, `${before.top} → ${after.top}`);
check("and the categories are what you land in", after.shelf > 100, `${Math.round(after.shelf)}px of shelf`);

/* ------------------------------------------------------------------ */
/* 3. The side panels hold still while it moves                        */
/* ------------------------------------------------------------------ */

check("the side panels do not move with it",
  before.panels.length > 0 && before.panels.every((t, i) => t === after.panels[i]),
  before.panels.length ? `${before.panels.join(",")} → ${after.panels.join(",")}` : "no side panel was open");
/* Which is why, rather than a rule holding them: they are not in it. */
check("because they are outside the scroller, not held still by hand",
  await page.evaluate(() => [...document.querySelectorAll("[data-side-panel]")]
    .every((a) => !document.querySelector("[data-studio-scroll]")?.contains(a))));

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
