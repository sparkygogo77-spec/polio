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
/* 2. The panels are outside the middle, whatever the middle does      */
/* ------------------------------------------------------------------ */

/*
 * The other half of what J asked for — scrolling down past the design box
 * and on into the categories and the prompt sections — is not in, and this
 * says so rather than passing quietly.
 *
 * It works: the middle becomes a scroller, the pane takes a whole screen,
 * and the panels hold still on their own because they are siblings of it
 * rather than children. It was taken out again because it reverses a
 * decision that sixteen checks in `tests/board-layout.mjs` deliberately
 * hold — "the workspace itself never needs scrolling", "the parts shelf is
 * on screen without going looking for it" — and because a full-screen pane
 * makes the board's fit width-held rather than height-held, which grows the
 * frame until there is almost no ground left to pan on. Both are decisions
 * to take on purpose.
 *
 * What can be checked today is the part that makes the rest free when it
 * does land: the panels are not inside the middle, so nothing the middle
 * does can move them.
 */
const outside = await page.evaluate(() => {
  const mid = document.querySelector("[data-studio-scroll]");
  const asides = [...document.querySelectorAll("[data-side-panel]")];
  return { n: asides.length, all: !!mid && asides.every((a) => !mid.contains(a)) };
});
check("the side panels sit outside the middle column", outside.n > 0 && outside.all,
  `${outside.n} panel${outside.n === 1 ? "" : "s"}, none of them inside it`);
console.log("  --   not in: scrolling down past the design box into the categories — it reverses board-layout's sixteen checks, so it is a decision rather than a fix");

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
