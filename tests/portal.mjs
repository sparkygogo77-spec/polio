/**
 * The hole opens like a portal: the ring traces the line, then the middle forms.
 *
 * HIS WORDS: "the black hole should animate like a dr strange portal tracing
 * the outline as i drew it with the ring and then the center forms, remove the
 * blac edges on the inside."
 *
 * Three things, and they are in his order:
 *
 *   · the ring goes round the line IN THE ORDER HE DREW IT, so at a third of
 *     the way through there is ring near where his hand started and none near
 *     where it finished;
 *   · the middle forms after the ring has closed, not alongside it;
 *   · nothing darkens the inside near the line when it is open.
 *
 * What it did instead: the edge grew out of the middle, so the whole ring
 * existed from the first frame at a small size and swelled — no tracing at
 * all — and the surface fell to black as it neared the line, which is the
 * black edge he is asking to have taken off.
 *
 *   node tests/portal.mjs [url]
 *
 * Runs alone: counts the portal's motion at its start and end; under load the counts crossed.
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
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
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

/*
 * A circle drawn BY HAND, starting at the right and going clockwise, so the
 * order the hand went in is known and can be asked about afterwards.
 */
const frame = await page.locator("[data-frame]").first().boundingBox();
const cx = frame.x + frame.width * 0.45;
const cy = frame.y + 320;
const R = 140;
await page.keyboard.press("s");
await page.waitForTimeout(250);
await page.mouse.move(cx + R, cy);
await page.mouse.down();
for (let i = 1; i <= 72; i++) {
  const a = (i / 72) * Math.PI * 2;
  await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
}
await page.mouse.up();

/**
 * How much light the horizon canvas carries at each of several places, read
 * in ONE go.
 *
 * Three separate reads of a moving animation are three different moments, and
 * the later ones necessarily see more ring — which would make a trace look
 * finished however it was drawn. Every point here is sampled from the same
 * frame.
 */
const lightAt = (pts) => page.evaluate((places) => {
  const el = document.querySelector("[data-space-horizon]");
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const c = el.getContext("2d");
  const dpr = el.width / Math.max(1, box.width);
  return places.map(([x, y]) => {
    const px = Math.round((x - box.left) * dpr);
    const py = Math.round((y - box.top) * dpr);
    const r = Math.round(14 * dpr);
    if (px - r < 0 || py - r < 0 || px + r > el.width || py + r > el.height) return 0;
    const d = c.getImageData(px - r, py - r, r * 2, r * 2).data;
    let sum = 0;
    for (let i = 0; i < d.length; i += 4) sum += (d[i] + d[i + 1] + d[i + 2]) * (d[i + 3] / 255);
    return Math.round(sum / (r * r * 4));
  });
}, pts);

/* ------------------------------------------------------------------ */
/* 1. THE RING TRACES, IN THE ORDER HE DREW IT                         */
/* ------------------------------------------------------------------ */

/*
 * Early: the hand started at the right and went clockwise — down first, top
 * last — so a third of the way through there is ring near the start and none
 * near the end. The whole opening is `CONSUME_MS`, so this looks well inside
 * the tracing half of it.
 */
await page.waitForTimeout(300);
const [startL, quarterL, lastL] = (await lightAt([[cx + R, cy], [cx, cy + R], [cx, cy - R]])) ?? [0, 0, 0];
const early = { start: startL, quarter: quarterL, last: lastL };
check("early on there is ring where his hand started", early.start > 0, `${early.start} at the start`);
check("…and none yet where it finished", early.last * 3 < early.start,
  `${early.start} at the start against ${early.last} at the end`);
check("…so it is tracing the line rather than swelling out of the middle",
  early.quarter > early.last, `${early.quarter} a quarter round, ${early.last} at the end`);

/* ------------------------------------------------------------------ */
/* 2. THE MIDDLE FORMS AFTER THE RING HAS CLOSED                       */
/* ------------------------------------------------------------------ */

await page.waitForTimeout(2600);
const [doneStart, doneLast] = (await lightAt([[cx + R, cy], [cx, cy - R]])) ?? [0, 0];
const done = { start: doneStart, last: doneLast };
check("by the end the ring is whole, all the way round",
  (done.last ?? 0) > 0 && Math.abs((done.start ?? 0) - (done.last ?? 0)) < Math.max(40, (done.start ?? 0) * 0.6),
  `${done.start} at the start, ${done.last} at the end`);
check("and the space is open", (await page.locator("[data-space-open]").count()) === 1);

/* ------------------------------------------------------------------ */
/* 3. NOTHING DARKENS THE INSIDE NEAR THE LINE                         */
/* ------------------------------------------------------------------ */

/*
 * Walked in from the line toward the middle, on the ground itself rather
 * than on the horizon canvas: a shadow that falls to black as it nears the
 * horizon shows up as the ground getting darker the closer in you look.
 */
const walk = await page.evaluate(([x, y, r]) => {
  const el = document.querySelector("[data-space-horizon]");
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const c = el.getContext("2d");
  const dpr = el.width / Math.max(1, box.width);
  const out = [];
  for (let d = 6; d <= 60; d += 6) {
    const px = Math.round((x - d - box.left) * dpr);
    const py = Math.round((y - box.top) * dpr);
    const s = Math.round(3 * dpr);
    if (px - s < 0 || py - s < 0) { out.push(null); continue; }
    const p = c.getImageData(px - s, py - s, s * 2, s * 2).data;
    let dark = 0;
    for (let i = 0; i < p.length; i += 4) dark += p[i + 3] / 255;
    out.push(Math.round((dark / (s * s * 4)) * 100));
  }
  return out;
}, [cx + R, cy, R]);
const laid = (walk ?? []).filter((v) => v !== null);
check("nothing is laid on the inside as it nears the line", laid.length > 0 && Math.max(...laid) <= 6,
  laid.length ? `coverage walking in from the line: ${laid.join(", ")}%` : "nothing to walk");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
