/**
 * A part that is already selected is dragged by pressing it and moving.
 *
 * HIS WORDS: "also once i selected something i have to click off and then
 * clicck and hold to drag."
 *
 * It was true, and only of the two parts you handle on the board — the cube
 * and the mesh. Every other part is inert, so a press on it reaches the
 * board and the board moves it. Those two took the pointer the moment they
 * were selected, because a cube you cannot turn is a picture of a cube, and
 * having taken it they swallowed the press that would have moved them. So
 * the only way to move a selected cube was to let go of it first, which is
 * exactly what he described.
 *
 * Turning is still a drag, but it is a drag of a part you have OPENED:
 * double-press a cube and you are handling it, and the ground closes it
 * again. One press selects and moves, like every part on the board; two
 * presses say "I am turning this one".
 *
 * Measured, not reasoned: the part's own left/top before and after, and the
 * cube's own `data-cube-turn` before and after.
 *
 *   node tests/selected-drags.mjs [url]
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
/* The shelf opens folded to its "+ Add" strip (J, 2026-10-05); these checks use its search, so it is open. */
await page.addInitScript(() => { try { localStorage.setItem("builder.shelf.folded", "0"); } catch { /* private window */ } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/** Drop one part out of the shelf by its name, and hand back its node id. */
async function drop(search, name) {
  await page.evaluate(() => localStorage.removeItem("builder.studio"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.locator('input[placeholder*="Search parts"]').first().fill(search);
  await page.waitForTimeout(700);
  await page.getByText(name, { exact: true }).first().click({ force: true });
  await page.waitForTimeout(500);
  await page.locator("[data-part-detail] [data-add-to-page]").first().click({ force: true }); /* A press on a card opens its detail card; Add to page is what places it (ShelfCards.tsx). */
  await page.waitForTimeout(1300);
  return page.evaluate(() => document.querySelector("[data-node-id]")?.dataset.nodeId ?? null);
}

/** Where the part sits on the page, off its own box, in page pixels. */
const spot = (id) => page.evaluate((i) => {
  const el = document.querySelector(`[data-node-id="${i}"]`);
  return el ? `${parseFloat(el.style.left)},${parseFloat(el.style.top)}` : "gone";
}, id);

/** Which way the cube is facing, off the attribute it writes itself. */
const facing = (id) => page.evaluate((i) => document.querySelector(`[data-node-id="${i}"] [data-cube-turn]`)?.getAttribute("data-cube-turn") ?? "none", id);

/** One press-and-hold across the middle of the part. */
async function pressDrag(id, dx = 120, dy = 60) {
  const box = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) {
    await page.mouse.move(x + (dx * i) / 6, y + (dy * i) / 6);
    await page.waitForTimeout(30);
  }
  await page.mouse.up();
  await page.waitForTimeout(450);
}

/** Somewhere on the page with nothing on it: straight under the part. */
async function pressGround(id) {
  const box = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height + 120);
  await page.waitForTimeout(400);
}

/* ------------------------------------------------------------------ */
/* An ordinary part: the behaviour every other part already had.       */
/* ------------------------------------------------------------------ */

const btn = await drop("main button", "Main button");
check("an ordinary part is on the board", !!btn, btn ?? "none dropped");
if (btn) {
  const a = await spot(btn);
  await pressDrag(btn);
  const b = await spot(btn);
  check("it moves on the press that picks it up", a !== b, `${a} → ${b}`);
  await pressDrag(btn);
  const c = await spot(btn);
  check("and again while it is already the selected one", b !== c, `${b} → ${c}`);
}

/* ------------------------------------------------------------------ */
/* The cube: the part his words were about.                            */
/* ------------------------------------------------------------------ */

const cube = await drop("word cube", "Word cube"); /* `cube-3d`; a plain "Cube" is the picture-faced shape now */
check("a cube is on the board, and it is the selected one", !!cube, cube ?? "none dropped");
if (cube) {
  const a = await spot(cube);
  const face0 = await facing(cube);
  await pressDrag(cube);
  const b = await spot(cube);
  check("a freshly selected cube moves on a press and a hold", a !== b, `${a} → ${b}`);

  await pressDrag(cube);
  const c = await spot(cube);
  check("and it keeps moving, with no click off in between", b !== c, `${b} → ${c}`);

  /* Turning is not lost: it is what a part you have opened does. */
  const box = await page.locator(`[data-node-id="${cube}"]`).first().boundingBox();
  await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  const opened = await page.evaluate((i) => document.querySelector(`[data-node-id="${i}"] [data-handling]`) !== null, cube);
  check("two presses open the cube for handling", opened, opened ? "it says so on the part" : "nothing marks it as open");

  const d = await spot(cube);
  const face1 = await facing(cube);
  await pressDrag(cube, 140, 0);
  const e = await spot(cube);
  const face2 = await facing(cube);
  check("dragging an opened cube turns it", face1 !== face2, `${face1} → ${face2}`);
  check("and does not carry it across the page", d === e, `${d} → ${e}`);
  check("the cube was facing somewhere from the start", face0 !== "none", face0);

  /* And the ground closes it again, so the next press moves it. */
  await pressGround(cube);
  const shut = await page.evaluate((i) => document.querySelector(`[data-node-id="${i}"] [data-handling]`) === null, cube);
  check("the ground closes it again", shut, shut ? "the mark is gone" : "still open");
  const f = await spot(cube);
  await pressDrag(cube);
  const g = await spot(cube);
  check("and the part moves on the very next press", f !== g, `${f} → ${g}`);
}

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
