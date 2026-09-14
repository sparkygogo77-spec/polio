/**
 * The middle scrolls, the panels hold still, and nothing shows a bar.
 *
 * J's three, exactly: no scrollbar on the website page or on the design
 * background at the right; able to scroll down past the design box and on
 * into the categories and the prompt sections below; and doing that must not
 * move the side panels.
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
/* 2. The pane moves down a full-length page                           */
/* ------------------------------------------------------------------ */

/*
 * It was the whole column that scrolled, with the shelf below the fold. J
 * found three things wrong with that at once — the preview took the board
 * edge to edge, the categories had gone, and the site scrolled in a box —
 * and they were one thing: the frame was a fixed viewport. The frame is the
 * whole site now, the pane it stands in is what moves, and the shelf is a
 * band beside the pane that never goes anywhere.
 */
const pane = page.locator("[data-studio-pane]");
check("the pane is what the site stands in", (await pane.count()) === 1);
const win = await page.locator("[data-page-window]").evaluate((e) => e.scrollHeight - e.clientHeight);
check("and nothing scrolls inside the frame", win === 0, `${win}px of inner scroll`);

const before = await page.evaluate(() => ({
  head: Math.round(document.querySelector("[data-frame]").getBoundingClientRect().y),
  shelf: Math.round(document.querySelector("[data-drawer]")?.getBoundingClientRect().y ?? -1),
  panels: [...document.querySelectorAll("[data-side-panel]")].map((a) => Math.round(a.getBoundingClientRect().top)),
}));
const box = await pane.boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
for (let i = 0; i < 25; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(25); }
await page.waitForTimeout(400);
const after = await page.evaluate(() => ({
  head: Math.round(document.querySelector("[data-frame]").getBoundingClientRect().y),
  shelf: Math.round(document.querySelector("[data-drawer]")?.getBoundingClientRect().y ?? -1),
  panels: [...document.querySelectorAll("[data-side-panel]")].map((a) => Math.round(a.getBoundingClientRect().top)),
}));
check("wheeling over the site moves the surface down it", before.head - after.head > 40,
  `the frame's head went ${before.head} → ${after.head}`);

/* ------------------------------------------------------------------ */
/* 3. And nothing beside it moves at all                               */
/* ------------------------------------------------------------------ */

check("the categories stay exactly where they are", Math.abs(after.shelf - before.shelf) < 2,
  `${before.shelf} → ${after.shelf}`);
check("and the side panels do not move either",
  before.panels.length > 0 && before.panels.every((t, i) => t === after.panels[i]),
  before.panels.length ? `${before.panels.join(",")} → ${after.panels.join(",")}` : "no side panel was open");
/* Which is why, rather than a rule holding them: they are not in it. */
check("because they are outside the pane, not held still by hand",
  await page.evaluate(() => [...document.querySelectorAll("[data-side-panel]")]
    .every((a) => !document.querySelector("[data-studio-pane]")?.contains(a))));

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
