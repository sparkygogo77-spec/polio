/**
 * The board is as tall as the site, and the pane is what moves.
 *
 * J measured this himself rather than passing on the complaint, and the
 * numbers he came back with are what this file asserts. At a 1267×1278
 * window with six parts on the page:
 *
 *   · the board's root was `size-full` — 943px tall, holding 1841px of
 *     site, with `overflow: hidden`. 898px of the page that no gesture
 *     could reach.
 *   · the pane it stood in had scrollHeight equal to clientHeight, so it
 *     did not scroll at all; what moved was the board *inside* the root.
 *
 * Which is a scrollbox with the bar turned off, twice over. His words for
 * what it should be instead, stated as measurements: the board is as tall
 * as the scaled site plus its gutters, not the pane's height; the pane's
 * scrollHeight is that plus the shelf; no ancestor of the site frame hides
 * anything; and one wheel sequence from the top reaches the shelf's search
 * box.
 *
 * The suite this replaces passed while every one of those was false,
 * because it measured the pan — how far the board had moved — rather than
 * the layout. These are the numbers instead.
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

/** Ground above the page and the same again below it: `FRAME_GUTTER`. */
const GUTTER = 128;
/** The shelf band: `BAND_H` is clamp(132px, 32vh, 248px). */
const bandOf = (h) => Math.min(248, Math.max(132, Math.round(h * 0.32)));

/** A page with n parts down it. Six is several screens; one is a new project. */
const page_ = (n = 6) => ({
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

/** The four numbers, read off the live DOM. */
const LAYOUT = () => {
  const frame = document.querySelector("[data-frame]");
  const board = document.querySelector("[data-studio-pane] > [data-ctx-id]") ?? frame?.closest("[data-studio-pane]")?.firstElementChild;
  const pane = document.querySelector("[data-studio-pane]");
  const search = document.querySelector("[data-parts-search]");
  /* Every element between the site frame and the document, and whether it is
     hiding any of what is inside it. A clip is only a clip when there is
     something past the edge: hidden with scroll === client hides nothing. */
  const hiders = [];
  for (let el = frame; el; el = el.parentElement) {
    const oy = getComputedStyle(el).overflowY;
    if ((oy === "hidden" || oy === "clip") && el.scrollHeight > el.clientHeight + 1) {
      hiders.push(`${el.getAttribute("data-page-window") !== null ? "[data-page-window]" : el.className.toString().slice(0, 40)}: ${el.scrollHeight - el.clientHeight}px hidden`);
    }
  }
  return {
    siteH: frame ? Math.round(frame.getBoundingClientRect().height) : -1,
    boardH: board ? Math.round(board.getBoundingClientRect().height) : -1,
    boardHidden: board ? board.scrollHeight - board.clientHeight : -1,
    paneH: pane ? pane.clientHeight : -1,
    paneReach: pane ? pane.scrollHeight : -1,
    paneTop: pane ? Math.round(pane.scrollTop) : -1,
    hiders,
    searchY: search ? Math.round(search.getBoundingClientRect().y) : null,
    groundY: Math.round(document.querySelector("[data-workspace-ground]")?.getBoundingClientRect().y ?? -1),
    groundInPane: !!document.querySelector("[data-studio-pane] [data-workspace-ground]"),
  };
};

const browser = await chromium.launch({ headless: true });
const seat = async (view, parts) => {
  const p = await browser.newPage({ viewport: view });
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), page_(parts));
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1700);
  return p;
};

/* ------------------------------------------------------------------ */
/* 1. The four numbers, at J's own window                              */
/* ------------------------------------------------------------------ */

const W = { width: 1267, height: 1278 };
const page = await seat(W, 6);
const band = bandOf(W.height);
let m = await page.evaluate(LAYOUT);

/* One. The board is the scaled site plus its gutters — not the pane's
   height, which is the whole of the fault. */
check("the board is as tall as the site it is showing",
  Math.abs(m.boardH - (m.siteH + GUTTER)) <= 4,
  `${m.boardH}px of board for ${m.siteH}px of site + ${GUTTER} of ground`);
check("and it is not just the pane's height",
  m.boardH > m.paneH + 100, `board ${m.boardH}, pane ${m.paneH}`);
check("and it hides none of it", m.boardHidden === 0, `${m.boardHidden}px past the edge`);

/* Two. The pane's travel is the site and the shelf, so the wheel has
   somewhere to go. */
check("the pane's reach is the site plus the shelf",
  Math.abs(m.paneReach - (m.boardH + band)) <= 4,
  `${m.paneReach} against ${m.boardH} + ${band}`);

/* Three. Nothing between the site and the document is holding anything back. */
check("nothing above the site clips it", m.hiders.length === 0, m.hiders.join("; ") || "no clip anywhere");

/* Four. One gesture, from the head of the page to the search box. */
const box = await page.locator("[data-studio-pane]").boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + 80);
check("the search box starts below the window", m.searchY > W.height, `at y ${m.searchY}`);
for (let i = 0; i < 40 && (await page.evaluate(() => {
  const s = document.querySelector("[data-parts-search]");
  return !s || s.getBoundingClientRect().bottom > window.innerHeight;
})); i++) { await page.mouse.wheel(0, 240); await page.waitForTimeout(30); }
await page.waitForTimeout(400);
const after = await page.evaluate(LAYOUT);
/* The gesture has to have *done* something: with the shelf outside the pane
   this passed while the search box had never left the screen, so the travel
   is part of the claim. */
check("one wheel gesture carries you from the site into the categories",
  after.searchY !== null && after.searchY + 37 <= W.height + 1 && after.paneTop > 400,
  `the search box came to y ${after.searchY} after ${after.paneTop}px of pane`);

/* And on the way, the whole page went by rather than a window over it. */
const foot = await page.evaluate(() => {
  const last = [...document.querySelectorAll("[data-node-id]")].pop();
  return last ? Math.round(last.getBoundingClientRect().bottom) : null;
});
check("the foot of the page was passed on the way", foot !== null && foot < W.height, `the last part ends at y ${foot}`);

/* The ground is not in the scroller, so the sky does not run out. */
check("the ground held still while all that happened",
  !after.groundInPane && after.groundY === m.groundY,
  after.groundInPane ? "it is inside the scroller, so it runs out" : `y ${m.groundY} → ${after.groundY}`);

await page.close();

/* ------------------------------------------------------------------ */
/* 2. The same holds at another zoom, and on a page that fits          */
/* ------------------------------------------------------------------ */

const zoomed = await seat(W, 6);
const zbox = await zoomed.locator("[data-studio-pane]").boundingBox();
await zoomed.mouse.move(zbox.x + zbox.width / 2, zbox.y + 200);
await zoomed.keyboard.down("Control");
for (let i = 0; i < 6; i++) { await zoomed.mouse.wheel(0, -120); await zoomed.waitForTimeout(40); }
await zoomed.keyboard.up("Control");
await zoomed.waitForTimeout(500);
const z = await zoomed.evaluate(LAYOUT);
check("zoomed in, the board is still exactly the site",
  Math.abs(z.boardH - (z.siteH + GUTTER)) <= 4, `${z.boardH}px for ${z.siteH}px of site`);
check("and the pane's reach grew with it",
  Math.abs(z.paneReach - (z.boardH + band)) <= 4 && z.boardH > m.boardH,
  `${m.boardH} → ${z.boardH}, reach ${z.paneReach}`);
check("and still nothing clips", z.hiders.length === 0, z.hiders.join("; ") || "no clip anywhere");
await zoomed.close();

/* A new project is one part on a stock page: short enough that the shelf is
   simply there, which is the other half of what J reported. */
const small = await seat(W, 1);
const s = await small.evaluate(LAYOUT);
check("a short page still reads as a page, not a full-screen box",
  Math.abs(s.boardH - (s.siteH + GUTTER)) <= 4 && s.boardH < s.paneH,
  `${s.boardH}px of board in a ${s.paneH}px pane`);
check("and the categories are simply on screen, no scrolling needed",
  s.searchY !== null && s.searchY + 37 <= W.height + 1 && s.paneReach <= s.paneH + 1,
  `the search box at y ${s.searchY}, ${s.paneReach} of reach in ${s.paneH}`);
await small.close();

/* ------------------------------------------------------------------ */
/* 2b. Updates hands the wheel over rather than sharing it             */
/* ------------------------------------------------------------------ */

/*
 * The other half of "scroll all the way into the categories and the prompt
 * sections below the timeline". The timeline pans on the wheel, and with the
 * detail band in the same pane both wanted the same gesture: eight notches
 * ran the updates 1848px off the top *while* the band came up underneath.
 * So: one surface at a time, and the band is reachable.
 */
const book = await seat(W, 6);
await book.locator('[aria-label^="Finish"]').first().click({ force: true });
await book.waitForTimeout(1400);
const bookBox = await book.locator("[data-studio-pane]").boundingBox();
await book.mouse.move(bookBox.x + bookBox.width / 2, bookBox.y + bookBox.height / 2);
const bookRead = () => book.evaluate(() => {
  const pane = document.querySelector("[data-studio-pane]");
  const plot = document.querySelector("[data-timeline-plot]");
  const host = document.querySelector("[data-timeline]");
  const d = document.querySelector("[data-timeline-detail]");
  /* The plot's pan, in the timeline's own frame. Its `y` in the window also
     moves when the *pane* scrolls, because it is inside the pane — reading
     that would call one surface moving "both moved", which is the very
     thing this check exists to tell apart. */
  return {
    top: Math.round(pane.scrollTop), reach: pane.scrollHeight - pane.clientHeight,
    plot: plot && host ? Math.round(plot.getBoundingClientRect().y - host.getBoundingClientRect().y) : null,
    detailY: d ? Math.round(d.getBoundingClientRect().y) : null,
  };
});
const b0 = await bookRead();
/* One notch at a time, so "both moved at once" is a thing that can be seen
   rather than averaged away over a long gesture. */
let shared = 0;
let last = b0;
for (let i = 0; i < 14; i++) {
  await book.mouse.wheel(0, 200);
  await book.waitForTimeout(90);
  const now = await bookRead();
  if (Math.abs(now.plot - last.plot) > 2 && Math.abs(now.top - last.top) > 2) shared++;
  last = now;
}
check("the updates and the pane never take the same notch", shared === 0, `${shared} notches moved both`);
check("and the prompt section under the updates is reached by carrying on",
  last.detailY !== null && last.detailY + 100 < W.height && last.top >= b0.reach - 2,
  `the band came to y ${last.detailY}, pane at ${last.top} of ${b0.reach}`);
await book.close();

/* ------------------------------------------------------------------ */
/* 3. It holds at every width, and Updates has the same shape          */
/* ------------------------------------------------------------------ */

for (const [w, h] of [[1500, 950], [1280, 720], [1100, 800], [980, 820]]) {
  const p = await seat({ width: w, height: h }, 6);
  const b = bandOf(h);
  const r = await p.evaluate(LAYOUT);
  check(`${w}×${h}: the board is the site`, Math.abs(r.boardH - (r.siteH + GUTTER)) <= 4, `${r.boardH} for ${r.siteH}`);
  check(`${w}×${h}: the pane reaches past it to the shelf`, Math.abs(r.paneReach - (r.boardH + b)) <= 4, `${r.paneReach} against ${r.boardH} + ${b}`);
  check(`${w}×${h}: and nothing clips`, r.hiders.length === 0, r.hiders.join("; ") || "clean");
  /* Edge to edge is what J saw on opening. A frame that leaves no ground is
     a frame with nothing else to look at, and bare ground is what the board
     is dragged by. */
  const across = await p.evaluate(() => {
    const f = document.querySelector("[data-frame]").getBoundingClientRect();
    const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect();
    return Math.round((f.width / pane.width) * 100);
  });
  check(`${w}×${h}: the page does not take the whole board`, across > 0 && across <= 94, `${across}% across`);

  await p.locator('[aria-label^="Finish"]').first().click({ force: true });
  await p.waitForTimeout(1300);
  const detail = await p.evaluate(() => {
    const d = document.querySelector("[data-timeline-detail]");
    const pane = document.querySelector("[data-studio-pane]");
    return d && pane
      ? { inPane: pane.contains(d), reach: pane.scrollHeight - pane.clientHeight, h: Math.round(d.getBoundingClientRect().height) }
      : null;
  });
  check(`${w}×${h}: Updates keeps its band, in the same scroller`,
    !!detail && detail.inPane && detail.h > 100, detail ? `${detail.h}px, ${detail.reach}px of reach below the updates` : "gone");
  await p.close();
}

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
