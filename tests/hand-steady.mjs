/**
 * Moving a part says where the part is, and nothing else.
 *
 * J's report: dragging the preview around forces the categories to move,
 * and dragging must never resize the preview box. He added the clue that
 * narrowed it — it does not happen on the timeline, only the builder.
 *
 * Both symptoms were one cause. The page's height is "the lowest thing on
 * it, plus 160", which shrink-wraps the content with no slack, so every
 * pixel of downward drag is a pixel of page. The board is as tall as the
 * page, and the shelf sits under the board in the same scroller — so the
 * page grew, the board grew, and the categories were pushed down, live,
 * while the button was still held. The timeline is in that same pane and
 * does not do it because it is `h-full`: it never grows, so the band below
 * it never moves.
 *
 * Measured before the fix, a 1267x1354 window, one part dragged 240px down,
 * everything read while the hand was still down:
 *
 *     the page       1960 → 2197
 *     the preview    1240 → 1390 on screen
 *     the board      1368 → 1518
 *     the shelf      top 1456 → 1606
 *     the pane       349 → 499 of travel
 *
 * The page settles when the hand comes off instead. What this holds is the
 * live half: under the hand, only the part moves.
 *
 *   node tests/hand-steady.mjs [url]
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

/*
 * The part starts low enough that the board plus the shelf overruns the
 * pane. That matters: with slack left, `mt-auto` holds the shelf on the
 * bottom edge and it cannot move, so a shorter page would have reported
 * this fixed while it was broken. The first run of this measurement did
 * exactly that — the shelf read 1107 either side — and only a page with
 * travel in it showed the fault.
 */
const doc = (y) => ({
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [],
    /*
     * The one being pulled, and a second far below it that is only there to
     * make the page long.
     *
     * The board fits the pane in both directions now, so a page of 1800 no
     * longer overruns anything and "the shelf did not move" would be a claim
     * about a shelf that had nowhere to move to. Past the zoom floor it does
     * again, so the part is put at 3600 rather than 1600: 3800 of page
     * against 999 of room wants 0.229 and is given the floor's 0.25, so the
     * board is 1170 in a 1267 pane and the shelf has 151px of travel behind
     * it. That is the state this was written to hold still.
     *
     * And the pane is scrolled to the end before the part is taken hold of,
     * because at the top of a page that long the foot of it is behind the
     * shelf — which is stuck to the pane's bottom so the categories are
     * never off screen. Scrolling to the end is how a person would reach it
     * too.
     */
    nodes: [{
      id: "n0", pageId: "page_home", featureId: "custom-idea", label: "part", prompt: "", content: "", data: "",
      x: 200, y, w: 600, h: 200, groupId: null, options: {}, priority: "must", custom: true,
      glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
      animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
      cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
    }],
  },
  version: 0,
});

const LOOK = () => {
  const pane = document.querySelector("[data-studio-pane]");
  const board = pane.firstElementChild;
  const frame = document.querySelector("[data-frame]");
  const shelf = document.querySelector("[data-drawer]");
  const raw = localStorage.getItem("builder.studio");
  const d = raw ? JSON.parse(raw) : null;
  return {
    page: frame.clientHeight,
    preview: Math.round(frame.getBoundingClientRect().height),
    board: Math.round(board.getBoundingClientRect().height),
    shelf: shelf ? Math.round(shelf.getBoundingClientRect().top) : null,
    travel: pane.scrollHeight - pane.clientHeight,
    y: d?.state?.nodes?.find((n) => n.id === "n0")?.y ?? null,
  };
};

const browser = await chromium.launch({ headless: true });
const W = { width: 1267, height: 1354 };

/* ------------------------------------------------------------------ */
/* Under the hand, only the part moves                                 */
/* ------------------------------------------------------------------ */

const page = await browser.newPage({ viewport: W });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc(3600));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const rest = await page.evaluate(LOOK);
check("the page is long enough for the shelf to be pushable", rest.travel > 100,
  `${rest.travel}px of travel, shelf at ${rest.shelf}`);

await page.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); p.scrollTop = p.scrollHeight; });
await page.waitForTimeout(400);
const nb = await page.locator('[data-node-id="n0"]').boundingBox();
await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
await page.mouse.down();
/* Sampled at several points through the drag, not only at the end of it:
   a thing that moves and comes back would pass a single reading. */
const during = [];
for (let i = 1; i <= 6; i++) {
  await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2 + i * 40);
  await page.waitForTimeout(60);
  during.push(await page.evaluate(LOOK));
}
const moved = during[during.length - 1];
check("the part moved, which is the point of the gesture", moved.y > rest.y + 100,
  `y ${rest.y} → ${moved.y}`);
for (const [what, key] of [["the preview box", "preview"], ["the page", "page"], ["the board", "board"], ["the categories", "shelf"], ["the pane's travel", "travel"]])
  check(`and ${what} did not move under the hand`,
    during.every((d) => d[key] === rest[key]),
    `${rest[key]} → ${[...new Set(during.map((d) => d[key]))].join(", ")}`);

await page.mouse.up();
await page.waitForTimeout(700);
const after = await page.evaluate(LOOK);
/* And it settles, rather than staying wrong: the site really is taller now,
   so the page holds the part it was given. This is the half that is not
   suppressed, and it is on the record as a number. */
check("the page settles to hold the part once the hand comes off",
  after.page > rest.page, `${rest.page} → ${after.page} for a part ending at ${after.y + 200}`);
/* Within a grid step, because letting go snaps to the 8px grid: the part
   read 1979 under the hand and 1976 at rest, and demanding they be equal
   called a correct snap a failure. */
check("and the part is where it was put, give or take the grid",
  Math.abs(after.y - moved.y) <= 8, `y ${moved.y} under the hand, ${after.y} at rest`);
await page.close();

/* ------------------------------------------------------------------ */
/* Resizing is the same gesture, so it holds the same way              */
/* ------------------------------------------------------------------ */

const two = await browser.newPage({ viewport: W });
await two.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await two.evaluate((d) => localStorage.setItem("builder.studio", JSON.stringify(d)), doc(3600));
await two.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await two.waitForTimeout(1800);
await two.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); p.scrollTop = p.scrollHeight; });
await two.waitForTimeout(400);
await two.locator('[data-node-id="n0"]').click();
await two.waitForTimeout(400);
const before2 = await two.evaluate(LOOK);
const handles = two.locator("[data-resize]");
if (await handles.count() === 0) check("a part has a handle to pull", false, "no handles");
else {
  /* The bottom edge: the one that makes the site taller. */
  const boxes = await handles.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }));
  const low = boxes.reduce((m, b) => (b.y > m.y ? b : m), boxes[0]);
  await two.mouse.move(low.x, low.y);
  await two.mouse.down();
  const pulled = [];
  for (let i = 1; i <= 5; i++) { await two.mouse.move(low.x, low.y + i * 40); await two.waitForTimeout(60); pulled.push(await two.evaluate(LOOK)); }
  check("pulling a part taller does not move the categories either",
    pulled.every((d) => d.shelf === before2.shelf),
    `${before2.shelf} → ${[...new Set(pulled.map((d) => d.shelf))].join(", ")}`);
  check("nor resize the preview while it is being pulled",
    pulled.every((d) => d.preview === before2.preview),
    `${before2.preview} → ${[...new Set(pulled.map((d) => d.preview))].join(", ")}`);
  await two.mouse.up();
}
await two.close();

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
