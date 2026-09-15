/**
 * The backend's effort rides with every ask.
 *
 * The backend surface has an effort setting, low, medium or high, kept
 * across a close. It reached one route, the one that asks about the whole
 * site. The two routes behind a drawing, the reader that says what a
 * drawing is and the writer that gives a part a body, each decided "medium"
 * for themselves and never read what was asked. So the one setting was
 * three settings, two of them nobody could see or change. Every call reads
 * the same held value now, and both routes honour it with the same
 * allow-list the first one has.
 *
 *   node tests/effort-rides.mjs [url]
 */
import { readFileSync } from "node:fs";
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
const bare = (file) => readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* 1. Every route that asks Claude passes the effort it was sent, through one allow-list. */
for (const r of ["generate", "body", "reshape"]) {
  const src = bare(`src/app/api/studio/${r}/route.ts`);
  check(`${r}: the effort is whatever was asked for`, /output_config: \{ effort[,\s]/.test(src), src.match(/output_config: \{[^}]*\}/)?.[0]?.slice(0, 60) ?? "no output_config");
  check(`${r}: and only low, medium or high is accepted`, /\["low", "medium", "high"\] as const/.test(src) && /EFFORTS\.includes\(body\.effort as never\)/.test(src));
}
/* 2. And every call sends the one held value. */
check("the body call sends the held effort", /effort: heldEffort\(\)/.test(bare("src/features/studio/bodyRun.ts")));
check("the reshape call sends the held effort", /effort: heldEffort\(\)/.test(bare("src/features/studio/reshapeRun.ts")));
check("the backend surface holds it under the same key", /EFFORT_KEY/.test(bare("src/features/studio/Backend.tsx")) && /from "\.\/effort"/.test(readFileSync("src/features/studio/Backend.tsx", "utf8")));

/* 3. In the browser: set the backend to low, draw, and read what left. */
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
const asked = { reshape: [], body: [] };
await page.route("**/api/studio/reshape", (route) => {
  asked.reshape.push(JSON.parse(route.request().postData() ?? "{}"));
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, patch: { featureId: "custom-idea", label: "Drawn", w: 320, h: 320, note: "an idea, drawn" }, usage: { model: "stub" } }) });
});
await page.route("**/api/studio/body", (route) => {
  asked.body.push(JSON.parse(route.request().postData() ?? "{}"));
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="7" fill="#b8ff24"/></svg>`, note: "written", stripped: [] }) });
});
// No tracer: the writer is asked instead, which is the second route under test.
await page.route("**/api/studio/image", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "no token" }) }));
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, set: { ANTHROPIC_API_KEY: true } }) }));

await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.clear();
  localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 }));
  localStorage.setItem("builder.backend.effort", "low");
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(900);

await page.keyboard.press("Control+k");
await page.waitForTimeout(350);
await page.keyboard.type("drop a new idea");
await page.waitForTimeout(400);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
const part = page.locator("[data-node-id]").last();
check("a part is on the board to draw on", (await part.count()) === 1);
const pb = await part.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
await page.waitForTimeout(650);
await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
await page.waitForTimeout(1200);
const bb = await page.locator("[data-draw-board]").boundingBox();
check("the drawing board opens", !!bb);
const circle = Array.from({ length: 33 }, (_, i) => { const a = (i / 32) * Math.PI * 2; return [0.5 + 0.25 * Math.cos(a), 0.5 + 0.25 * Math.sin(a)]; });
await page.mouse.move(bb.x + circle[0][0] * bb.width, bb.y + circle[0][1] * bb.height);
await page.mouse.down();
for (const [x, y] of circle) { await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height); await page.waitForTimeout(4); }
await page.mouse.up();
await page.waitForTimeout(400);
await page.locator("[data-draw-words]").fill("a card of one claim");
await page.keyboard.press("Enter");
for (let i = 0; i < 40 && (asked.reshape.length === 0 || asked.body.length === 0); i++) await page.waitForTimeout(500);

check("the reader was asked", asked.reshape.length >= 1, `${asked.reshape.length} asks`);
check("and its ask carries the held effort", asked.reshape[0]?.effort === "low", String(asked.reshape[0]?.effort));
check("the writer was asked", asked.body.length >= 1, `${asked.body.length} asks`);
check("and its ask carries the held effort too", asked.body[0]?.effort === "low", String(asked.body[0]?.effort));
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
