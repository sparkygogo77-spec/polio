/**
 * The site is a full-length page on a surface that moves.
 *
 * Three of J's reports that turned out to be one thing, and the one thing is
 * worth stating exactly because the distinction is the whole point:
 *
 *   · the preview took the whole board on opening, edge to edge, with
 *     nothing else to see;
 *   · the categories and the search had gone, on the board and in the
 *     timeline;
 *   · and inside the frame the site scrolled in a box.
 *
 * All three came of treating the frame as a fixed viewport — a window the
 * site slides behind — and of the whole column scrolling rather than the
 * pane. His words on the third: not within a boundary, all of it should be
 * rendered, not scrolling within the same web frame.
 *
 * So: the frame is as tall as the site, the pane it stands in is what moves,
 * and the shelf is a band beside the pane rather than something below the
 * page. The window it replaced existed for a reason that still has to hold —
 * a site growing downwards used to push the shelf below the horizon — so
 * that is checked at every width rather than assumed.
 *
 *   node tests/full-page.mjs [url]
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

/** A page with six parts down it, so the site is several screens deep. */
const tall = (n = 6) => ({
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", shapes: [], groups: [], spaces: [], selection: [], threads: [],
    nodes: Array.from({ length: n }, (_, i) => ({
      id: `n${i}`, pageId: "page_home", featureId: "custom-idea", label: `part ${i}`, prompt: "", content: "", data: "",
      x: 120, y: 80 + i * 420, w: 900, h: 320, groupId: null, options: {}, priority: "must", custom: true,
      glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
      animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
      cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
    })),
  },
  version: 0,
});

const browser = await chromium.launch({ headless: true });

/* ------------------------------------------------------------------ */
/* 1. The shelf survives at every width — on the board and in Updates  */
/* ------------------------------------------------------------------ */

for (const [w, h] of [[1500, 950], [1280, 720], [1100, 800], [980, 820]]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), tall());
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);

  const board = await page.evaluate((h) => {
    const g = (s) => document.querySelector(s)?.getBoundingClientRect() ?? null;
    const shelf = g("[data-drawer]"), search = g("[data-parts-search]"), pane = g("[data-studio-pane]"), frame = g("[data-frame]");
    return {
      shelf: shelf && shelf.height > 100 && shelf.y + shelf.height <= h + 1,
      shelfBox: shelf ? `${Math.round(shelf.height)}px at y ${Math.round(shelf.y)}` : "gone",
      search: !!search && search.y + search.height <= h + 1,
      across: frame && pane ? Math.round((frame.width / pane.width) * 100) : 0,
    };
  }, h);
  check(`${w}×${h}: the categories are on screen`, board.shelf, board.shelfBox);
  check(`${w}×${h}: and the search with them`, board.search);
  /* Edge to edge is what J saw. A frame that leaves no ground is a frame
     with nothing else to look at. */
  check(`${w}×${h}: the preview does not take the whole board`, board.across > 0 && board.across <= 94, `${board.across}% across`);

  await page.locator('[aria-label^="Finish"]').first().click({ force: true });
  await page.waitForTimeout(1300);
  const band = await page.evaluate((h) => {
    const b = document.querySelector("[data-timeline-detail]")?.getBoundingClientRect();
    return b ? { on: b.y + b.height <= h + 1 && b.height > 100, box: `${Math.round(b.height)}px at y ${Math.round(b.y)}` } : { on: false, box: "gone" };
  }, h);
  check(`${w}×${h}: Updates keeps its band too`, band.on, band.box);
  await page.close();
}

/* ------------------------------------------------------------------ */
/* 2. The whole site is rendered, and the surface is what moves        */
/* ------------------------------------------------------------------ */

const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), tall());
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

const look = () => page.evaluate(() => {
  const f = document.querySelector("[data-frame]").getBoundingClientRect();
  const win = document.querySelector("[data-page-window]");
  const last = [...document.querySelectorAll("[data-node-id]")].pop()?.getBoundingClientRect() ?? null;
  const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
  return {
    frameTop: Math.round(f.y), frameH: Math.round(f.height), paneH: Math.round(pane.height),
    inner: win ? win.scrollHeight - win.clientHeight : -1,
    lastBottom: last ? Math.round(last.bottom) : null,
    lastSeen: !!last && last.bottom <= pane.y + pane.height + 1 && last.top >= pane.y - 1,
  };
});

const start = await look();
/* The frame is the site, not a screen of it: six parts 420 apart is well
   past any one viewport. */
check("the frame is as tall as the site", start.frameH > start.paneH * 1.5,
  `${start.frameH}px of page in a ${start.paneH}px pane`);
check("and nothing scrolls inside it", start.inner === 0, `${start.inner}px of inner scroll`);

const pane = await page.locator("[data-studio-pane]").boundingBox();
await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(35); }
await page.waitForTimeout(500);
const moved = await look();
check("wheeling over the site moves the surface", moved.frameTop < start.frameTop - 200,
  `the frame's top went ${start.frameTop} → ${moved.frameTop}`);
check("and carries you to the foot of the page", moved.lastSeen,
  `the last part's foot is at ${moved.lastBottom}`);

/* It ends rather than running on into empty space. */
for (let i = 0; i < 20; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(25); }
await page.waitForTimeout(400);
const end = await look();
check("and it stops there rather than running into the void", Math.abs(end.frameTop - moved.frameTop) < 4,
  `${moved.frameTop} → ${end.frameTop}`);

/* And the shelf never went anywhere while all that happened. */
const after = await page.evaluate(() => {
  const d = document.querySelector("[data-drawer]")?.getBoundingClientRect();
  return d ? `${Math.round(d.height)}px at y ${Math.round(d.y)}` : "gone";
});
check("the categories stayed put through all of it", after !== "gone", after);

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
