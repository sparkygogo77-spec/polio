/**
 * The shape button draws a shape, and the shape you drew is the space.
 *
 * HIS WORDS, both halves:
 *
 *   "the circle button shouldnt just open a circle like 'draw' does it should
 *    allow me to create the shape, make it a triangle with dashes lines"
 *   "'this space' should be for the shape i drew and it should skip having to
 *    press that buutton once i draw it"
 *
 * So the tool wears a dashed TRIANGLE rather than a dashed ring — a ring says
 * the thing it makes is a circle, and it is whatever you draw — the line is
 * drawn as a dashed outline while your hand is on it, so it reads as a
 * boundary being made rather than as ink being laid down, and letting go is
 * the whole action: the space is made AND it is the selected thing, so the
 * "This space" button is not a second press standing between him and the
 * panel.
 *
 * Measured in the DOM, not reasoned: the icon's own path data, the live
 * line's own dash, and whether that button is on screen afterwards.
 *
 *   node tests/shape-tool.mjs [url]
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

/* ------------------------------------------------------------------ */
/* 1. The button itself                                                */
/* ------------------------------------------------------------------ */

/*
 * A dashed ring and a dashed triangle are told apart by their geometry, not
 * by a name in the markup: a ring has to be drawn with arcs, and a triangle
 * is straight lines only. So the icon's own path data answers it.
 */
await page.keyboard.press("s");
await page.waitForTimeout(350);
const icon = await page.evaluate(() => {
  /* The tools live under one picker, and the picker wears the mark of the
     tool that is chosen — which is the mark he is talking about. */
  const btn = document.querySelector("[data-tool-picker]");
  if (!btn || !/Draw a space/.test(btn.getAttribute("aria-label") ?? "")) return { found: false, name: btn?.getAttribute("aria-label") ?? "no picker" };
  const svg = btn.querySelector("svg");
  if (!svg) return { found: true, svg: false };
  const ds = [...svg.querySelectorAll("path")].map((p) => p.getAttribute("d") ?? "");
  return {
    found: true, svg: true,
    circles: svg.querySelectorAll("circle").length,
    pieces: ds.length,
    arcs: ds.filter((d) => /[aA]/.test(d)).length,
  };
});

check("the shape tool is in the bar and can be chosen", !!icon?.found, icon?.found ? "Tool: Draw a space" : icon?.name ?? "not there");
if (icon?.svg) {
    /*
   * A ring is drawn ENTIRELY with arcs; a triangle is straight sides with
   * the corners rounded off, so it has arcs too and counting them at all
   * was the wrong question — it called a perfectly good triangle a ring.
   * What tells them apart is which kind of piece the shape is mostly made
   * of. Measured: the dashed ring was 8 arcs and 0 straight pieces.
   */
  check("its mark is mostly straight sides, so it is a triangle and not a ring",
    icon.circles === 0 && icon.pieces - icon.arcs > icon.arcs,
    `${icon.pieces - icon.arcs} straight pieces against ${icon.arcs} arcs, ${icon.circles} circles`);
  check("and it is drawn in dashes: several pieces rather than one closed line",
    icon.pieces >= 3, `${icon.pieces} pieces`);
}

/* ------------------------------------------------------------------ */
/* 2. Drawing with it                                                  */
/* ------------------------------------------------------------------ */

const frame = page.locator("[data-frame]").first();
const box = await frame.boundingBox();
const cx = box.x + box.width * 0.45;
const cy = box.y + 320;
const R = 130;

/* Halfway round, with the hand still down, the line on screen is read. */
await page.mouse.move(cx + R, cy);
await page.mouse.down();
for (let i = 1; i <= 36; i++) {
  const a = (i / 72) * Math.PI * 2;
  await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
}
await page.waitForTimeout(120);
const live = await page.evaluate(() => {
  const el = document.querySelector('[data-shape-id="live"]');
  if (!el) return null;
  const dash = (el.getAttribute("stroke-dasharray") ?? getComputedStyle(el).strokeDasharray ?? "").trim();
  return { dash: dash === "none" ? "" : dash };
});
check("while the hand is down the line is a dashed outline", !!live && live.dash.length > 0,
  live ? (live.dash || "no dash on it") : "no live line to read");

/* …and round to where it started, which closes it. */
for (let i = 37; i <= 72; i++) {
  const a = (i / 72) * Math.PI * 2;
  await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
}
await page.mouse.up();
await page.waitForTimeout(900);

const made = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.spaces ?? []).length);
check("letting go makes the space", made === 1, `${made} space`);

/* ------------------------------------------------------------------ */
/* 3. No second press                                                  */
/* ------------------------------------------------------------------ */

/*
 * The "This space" button is the second press he is complaining about. It
 * shows only while the space is NOT the picked one, so a space that picks
 * itself the moment it is drawn never puts it in his way. Read after the
 * hole has finished consuming, which is when that button would appear.
 */
await page.waitForTimeout(2600);
const after = await page.evaluate(() => ({
  fill: document.querySelectorAll("[data-space-fill]").length,
  panel: document.querySelectorAll("[data-space-name]").length,
}));
check("the shape he drew is already the one being worked on: no 'This space' to press",
  after.fill === 0, `${after.fill} of them on screen`);
check("and its own panel is open on it", after.panel >= 1, `${after.panel} panels`);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
