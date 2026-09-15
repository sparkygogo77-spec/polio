/**
 * A stroke dragged off the disc stays on it (inventory C4).
 *
 * The drawing disc captures the pointer, so a stroke that leaves the disc
 * keeps recording: points below 0 or above 1, ink the person cannot see
 * (the disc is clipped round) and the reader's picture does not draw, while
 * the drawing's words still print it ("120% of the board"). Now every point
 * is held to the disc as it is recorded, so what is kept is what was seen.
 *
 *   · a box dragged a fifth of the disc past its right edge is recorded
 *     inside 0..1, read off the thread the drawing landed on (the draw
 *     shard on a part's wheel opens the disc; the drawing is a request on
 *     the queue, so no key is needed for the thread to carry it);
 *   · the words the reader gets print no point past the disc's edge.
 *
 *   node tests/ink-on-disc.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { sketchToText } from "../src/features/studio/sketch.ts";

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
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ set: { REPLICATE_API_TOKEN: false }, repo: null, branch: "main" }) }));
for (const route of ["**/api/studio/body", "**/api/studio/reshape", "**/api/studio/image"]) {
  await page.route(route, (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key", message: "no key" }) }));
}
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.removeItem("builder.studio"); localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "snap" }, advanced: false }, version: 0 })); });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A part to draw on, and its disc. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(340);
await page.keyboard.type("drop a new idea");
await page.waitForTimeout(400);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const part = page.locator("[data-node-id]").last();
const pb = await part.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
await page.waitForTimeout(650);
await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
await page.waitForTimeout(1200);
const disc = page.locator("[data-draw-board]").first();
check("the disc is open", (await disc.count()) === 1);
const bb = await disc.boundingBox();

/* A box whose right side is a fifth of the disc past the edge, drawn without letting go. */
const at = (fx, fy) => [bb.x + fx * bb.width, bb.y + fy * bb.height];
const corners = [[0.25, 0.3], [1.2, 0.3], [1.2, 0.7], [0.25, 0.7], [0.25, 0.3]];
await page.mouse.move(...at(...corners[0]));
await page.mouse.down();
for (const [fx, fy] of corners) { for (let i = 1; i <= 8; i++) { await page.mouse.move(...at(fx, fy)); await page.waitForTimeout(5); } }
await page.mouse.up();
await page.waitForTimeout(400);
await page.locator("[data-draw-words]").fill("a wide card");
await page.keyboard.press("Enter");
await page.waitForTimeout(2500);

const strokes = await page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const t = (s.threads ?? []).filter((x) => x.sketch?.strokes?.length).at(-1);
  return t?.sketch?.strokes ?? null;
});
const pts = (strokes ?? []).flat();
const maxX = Math.max(...pts.map((p) => p[0]));
const minX = Math.min(...pts.map((p) => p[0]));
const maxY = Math.max(...pts.map((p) => p[1]));
check("the drawing landed on a thread with its strokes", !!strokes && pts.length > 4, `${pts.length} points`);
check("every recorded point is on the disc, 0..1 both ways", pts.length > 0 && maxX <= 1 && minX >= 0 && maxY <= 1, `x ${minX.toFixed(3)}..${maxX.toFixed(3)}, y to ${maxY.toFixed(3)}`);
check("and the drag past the edge reached the edge, not short of it", maxX >= 0.97, `right side at ${maxX.toFixed(3)}`);
const words = strokes ? sketchToText({ strokes, words: "" }) : "";
const printed = [...words.matchAll(/(\d+),(\d+)/g)].flatMap((m) => [Number(m[1]), Number(m[2])]);
check("the words the reader gets print no point the disc could not show, none past 100", printed.length > 0 && Math.max(...printed) <= 100, words.match(/stroke 1[^\n]*/)?.[0]?.slice(0, 80) ?? words.slice(0, 80));

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
