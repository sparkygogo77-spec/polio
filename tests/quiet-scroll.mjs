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
/*
 * Whatever travel there is, the wheel spends it — and where there is none,
 * nothing moving is the right answer rather than a broken one.
 *
 * This read `before.head - after.head > 40` flat, which was true only while
 * the site was always taller than the room it stood in. Now that content
 * sets the page and the pane sets the zoom, a site that fits its pane has
 * no travel at all: the frame's head stays put, the categories are already
 * up, and demanding 40px of movement fails a board that is behaving. The
 * rule underneath is the one held here, and `full-page` states the same
 * thing the same way: the shelf is there, or the gesture brings it.
 */
const travel = await pane.evaluate((e) => e.scrollHeight - e.clientHeight);
check(travel > 0 ? "wheeling over the site moves the surface down it" : "with nothing hidden, wheeling leaves the surface where it is",
  travel > 0 ? before.head - after.head > 40 : before.head === after.head,
  `${travel}px of travel · the frame's head went ${before.head} → ${after.head}`);

/* ------------------------------------------------------------------ */
/* 3. The categories come with it; nothing beside it moves at all      */
/* ------------------------------------------------------------------ */

/*
 * This check used to read "the categories stay exactly where they are",
 * and it was pinning an arrangement rather than a rule. J's sentence is
 * "scroll all the way into the categories and the prompt sections below
 * the timeline, and doing that must not move or affect the side panels":
 * the thing that must hold still is the *panels*, and the categories are
 * what the gesture goes into. They were a band beside the pane, so they
 * could not be gone into; they are under the board in the same scroller
 * now, so they rise with it.
 */
check(travel > 0 ? "the categories come up with the gesture, in the same scroller" : "the categories are already up, because nothing is hidden",
  travel > 0 ? before.shelf - after.shelf > 40 : before.shelf > 0 && before.shelf === after.shelf,
  `${before.shelf} → ${after.shelf}, ${travel}px of travel`);
check("and they are in the pane, which is why", await page.evaluate(() =>
  !!document.querySelector("[data-studio-pane]")?.contains(document.querySelector("[data-drawer]"))));
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
