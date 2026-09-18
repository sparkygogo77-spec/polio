/**
 * Carrying a part to an edge: the page scrolls, the bottom holds, and the
 * bottom snaps.
 *
 * HIS WORDS: "when i move an element up the website it should scroll for me
 * as i reach the boundary as well as downward… i also should somehow be able
 * to place things at the bottom of the site because it seems to extend the
 * page whenever i do, i should be able to snap to bottom like i can the top
 * and sides."
 *
 * Three things, and the last two are one fault. The page's height is the
 * lowest thing on it plus a margin, so putting something near the bottom
 * moves the bottom — there is nothing to snap to because the end of the page
 * runs away from whatever is put near it.
 *
 * Every check drives the drag rather than reading the resting state: a part
 * is picked up, carried, and put down, and what is measured is what moved.
 *
 *   node tests/carry-to-edge.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 900 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1400);

/** One part on the page, from the shelf, so the node is whole. */
await page.locator('input[placeholder*="Search parts"]').first().fill("main button");
await page.waitForTimeout(800);
const tile = page.getByText("Main button", { exact: true }).first();
check("there is a part to carry", (await tile.count()) === 1);
await tile.click({ force: true });
await page.waitForTimeout(1100);

const node = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const n = (s.nodes ?? [])[0];
  return n ? { id: n.id, x: n.x, y: n.y, w: n.w, h: n.h } : null;
});
const seed = await node();
check("it landed on the page", !!seed, seed ? `${seed.w}×${seed.h} at ${seed.x},${seed.y}` : "nothing");
if (!seed) { await browser.close(); process.exit(1); }

const pane = page.locator("[data-studio-pane]").first();
const paneTop = () => pane.evaluate((el) => el.scrollTop);
const paneRoom = () => pane.evaluate((el) => el.scrollHeight - el.clientHeight);
const frame = page.locator("[data-frame]").first();
const frameH = () => frame.evaluate((el) => el.getBoundingClientRect().height);

/* ------------------------------------------------------------------ */
/* 1. Carrying to an edge scrolls the page, both ways                  */
/* ------------------------------------------------------------------ */

/** Pick the part up and hold it at a point, without letting go. */
const carryTo = async (cx, cy, holdMs = 1500) => {
  const el = page.locator(`[data-node-id="${seed.id}"]`).first();
  const box = await el.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  for (let s = 1; s <= 12; s++) {
    await page.mouse.move(box.x + box.width / 2 + ((cx - box.x - box.width / 2) * s) / 12, box.y + box.height / 2 + ((cy - box.y - box.height / 2) * s) / 12);
  }
  /*
   * Held at the edge, and read TWICE.
   *
   * The first draft read the pane once after the carry and called any
   * difference a scroll \u2014 which passed on the way up, because picking a part
   * up resets the pane, and a reset is a jump, not a scroll. An edge scroll
   * is a thing that goes on happening while the hand is still, so what is
   * measured is how far it travels between two readings taken while nothing
   * is moving.
   */
  await page.waitForTimeout(Math.round(holdMs / 3));
  const early = await paneTop();
  await page.waitForTimeout(holdMs);
  const late = await paneTop();
  return { early, late };
};
const letGo = async () => { await page.mouse.up(); await page.waitForTimeout(500); };

/* Down first: the page has to have somewhere to go. */
const view = page.viewportSize();
await page.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); if (p) p.scrollTop = 0; });
await page.waitForTimeout(300);
const room = await paneRoom();
check("the page is taller than the window, so there is somewhere to scroll", room > 40, `${Math.round(room)}px of travel`);

const paneBox = await pane.boundingBox();
const down = await carryTo(paneBox.x + paneBox.width / 2, paneBox.y + paneBox.height - 6);
await letGo();
check(
  "carrying a part to the bottom edge scrolls the page down under it, and keeps scrolling",
  down.late - down.early > 20,
  `held still at the foot, the pane went ${Math.round(down.early)} \u2192 ${Math.round(down.late)}`,
);

/* And back up. */
await page.evaluate(() => { const p = document.querySelector("[data-studio-pane]"); if (p) p.scrollTop = Math.round((p.scrollHeight - p.clientHeight) / 2); });
await page.waitForTimeout(400);
const up = await carryTo(paneBox.x + paneBox.width / 2, paneBox.y + 6);
await letGo();
check(
  "and carrying it to the top edge scrolls the page up under it, and keeps scrolling",
  up.early - up.late > 20,
  `held still at the head, the pane went ${Math.round(up.early)} \u2192 ${Math.round(up.late)}`,
);

/* ------------------------------------------------------------------ */
/* 2. The bottom of the page stays where it is                         */
/* ------------------------------------------------------------------ */

/** Put the part flush against the bottom of the page, in document terms. */
const putAt = async (y) => {
  await page.evaluate(({ id, y }) => {
    const d = JSON.parse(localStorage.getItem("builder.studio"));
    d.state.nodes = d.state.nodes.map((n) => (n.id === id ? { ...n, y } : n));
    localStorage.setItem("builder.studio", JSON.stringify(d));
  }, { id: seed.id, y });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
};

/**
 * The page's own height, in the document's own numbers.
 *
 * The frame is drawn inside a layer the board zooms, so its box on screen is
 * the page times the zoom. The first draft divided by a custom property that
 * does not exist, got 1, and put the part hundreds of pixels from the foot
 * while reporting the page had not grown \u2014 true, and about nothing.
 */
const pageTall = async () => page.evaluate(() => {
  const f = document.querySelector("[data-frame]");
  /* `offsetHeight`, not the box on screen divided by a zoom: layout height is
     already in the document's own numbers, and dividing a drawn box by a
     transform read off one ancestor missed a second one \u2014 it reported a
     1616px page as 1284 and had the page shrinking when a part was added. */
  return f ? f.offsetHeight : 0;
});

/*
 * Past the floor first.
 *
 * A page is at least a screen deep whatever is on it, so a part put at the
 * foot of a page that is already at its shortest cannot make it any shorter
 * or taller, and a check that only tries that is green about the floor rather
 * than about the fault. So the part is carried well below the floor, the page
 * grows to hold it \u2014 which is right \u2014 and THEN it is put flush with that new
 * foot. That is the move he is describing, and the foot must not run away
 * from him a second time.
 */
await putAt(1400);
const deep = await pageTall();
check("a part below the page makes the page grow to hold it", deep > 1400, `${deep} deep with a part at 1400`);
await putAt(Math.max(0, deep - seed.h));
const flush = await pageTall();
check(
  "and a part put flush with that foot does not move the foot again",
  Math.abs(flush - deep) < 4,
  `the page was ${deep} deep and is ${flush} after a part was put flush with its foot \u2014 it ran on by ${flush - deep}px`,
);

/* ------------------------------------------------------------------ */
/* 3. The bottom is a snap target, like the top and the sides          */
/* ------------------------------------------------------------------ */

/* Measured rather than read: carried to within a few pixels of the foot and
   let go, the part should land exactly on it. */
await putAt(200);
const frameBox = await frame.boundingBox();
const zoom = await page.evaluate(() => {
  const f = document.querySelector("[data-frame]");
  const m = new DOMMatrixReadOnly(getComputedStyle(f.parentElement).transform);
  return m.a || 1;
});
const el = page.locator(`[data-node-id="${seed.id}"]`).first();
const nb = await el.boundingBox();
/* Aim its foot five screen pixels above the page's foot: close enough that a
   snap should claim it, far enough that no snap leaves it short. */
const aimY = frameBox.y + frameBox.height - nb.height - 5;
await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2);
await page.mouse.down();
for (let s = 1; s <= 14; s++) await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2 + ((aimY + nb.height / 2 - nb.y - nb.height / 2) * s) / 14);
await page.mouse.up();
await page.waitForTimeout(700);

const landed = await node();
const pageBottom = await pageTall();
const gap = pageBottom - (landed.y + landed.h);
check(
  "let go near the foot of the page, a part snaps flush to it",
  Math.abs(gap) <= 1,
  `its foot came to rest ${gap}px from the page's, at y ${landed.y} of a ${pageBottom}px page`,
);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
