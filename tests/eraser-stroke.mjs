/**
 * Dragging the eraser erases what the stroke passes over.
 *
 * HIS WORDS: "dragging with eraser should allow multiple erasures not having
 * to click on each". And the three things that were ruled about it:
 *
 *   1. IT IS ONE ACTION, SO IT IS ONE UNDO.
 *   2. IT ERASES WHAT THE STROKE PASSES OVER — the stroke, not the handful of
 *      points a quick hand happens to report.
 *   3. THE SAME GENEROSITY AS THE VINE.
 *
 * The sweep existed and met the first. It missed the second two ways: it
 * asked where the pointer WAS on each move and never about the ground between
 * moves, so a quick scribble left most of a drawing standing; and it took the
 * NEAREST one drawing, so a stroke laid across three took one. And it gave ten
 * pixels of reach where a vine gives twenty-two.
 *
 * So the stroke here is deliberately quick — a few long jumps, the way a real
 * hand reports — and what is counted is what is left.
 *
 *   node tests/eraser-stroke.mjs [url]
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
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

const shapes = () => page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.shapes ?? []).length);
const board = page.locator("[data-frame]").first();
const box = await board.boundingBox();

/** Draw a short vertical stroke with the pen, at x. */
const drawAt = async (x) => {
  await page.keyboard.press("d");
  await page.waitForTimeout(150);
  await page.mouse.move(x, box.y + 120);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(x, box.y + 120 + i * 20);
  await page.mouse.up();
  await page.waitForTimeout(250);
};

/*
 * Placed off the frame's own width rather than at fixed offsets: the board
 * zooms to fit, so a pixel that is inside the page on one screen is off it on
 * another. The first draft put the third stroke past the edge and drew two.
 */
const xs = [0.25, 0.45, 0.65].map((f) => box.x + box.width * f);
for (const x of xs) await drawAt(x);
const drawn = await shapes();
check("three strokes on the board to erase", drawn === 3, `${drawn} shapes at x ${xs.map((x) => Math.round(x - box.x)).join(", ")} of ${Math.round(box.width)}`);

/* ------------------------------------------------------------------ */
/* One quick sweep across all three                                    */
/* ------------------------------------------------------------------ */

await page.keyboard.press("e");
await page.waitForTimeout(200);
/*
 * Three moves for six hundred pixels, which is what a hand moving at speed
 * actually reports — and it steps clean over the gaps between the strokes.
 */
await page.mouse.move(box.x + box.width * 0.15, box.y + 180);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.45, box.y + 180);
await page.mouse.move(box.x + box.width * 0.75, box.y + 180);
await page.mouse.up();
await page.waitForTimeout(500);

const left = await shapes();
check(
  "one quick stroke across three drawings takes all three",
  left === drawn - 3,
  `${drawn} before, ${left} after — ${drawn - left} taken`,
);

/* ------------------------------------------------------------------ */
/* One action, one undo                                                */
/* ------------------------------------------------------------------ */

await page.keyboard.press("Control+z");
await page.waitForTimeout(600);
const back = await shapes();
check(
  "and one undo brings all three back, because it was one action",
  back === drawn,
  `${back} back of ${drawn}`,
);

/* ------------------------------------------------------------------ */
/* The vine's generosity                                               */
/* ------------------------------------------------------------------ */

const { readFileSync, readdirSync } = await import("node:fs");
const src = ["Canvas.tsx", ...readdirSync("src/features/studio/canvas").map((f) => `canvas/${f}`)].map((f) => readFileSync(`src/features/studio/${f}`, "utf8")).join("\n");
check(
  "the eraser reaches as far as a vine does, rather than a number of its own",
  /const ERASE_REACH = REACH_WIDTH \/ 2;/.test(src),
  /ERASE_REACH/.test(src) ? "half of REACH_WIDTH, the same as a vine" : "still a number of its own",
);
check(
  "and it asks about the stroke rather than the point the hand stopped at",
  /hitAlong\(live, was, \[p\.x, p\.y\]/.test(src),
  /hitAlong/.test(src) ? "the segment from where it was to where it is" : "still the point it is at",
);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
