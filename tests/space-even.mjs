/**
 * The inside of a drawn space is one even fill.
 *
 * HIS WORDS: "can you see the iner lines in that space i drew the layers
 * getting brighter toward the center are weird."
 *
 * Two painters lay anything inside the line — the horizon shadow, which takes
 * the surface down to black as it nears the edge, and the one hair of light
 * just inside the line. The shadow was eight hand-picked strokes and was
 * changed to forty-eight off a curve, but that was only ever measured on a
 * SYNTHETIC disc. This measures the real space, on the real board, which is
 * the only thing that answers him.
 *
 * A ring is a plateau followed by a step: the eye reads the step, and reads
 * it as a LINE only because the ground either side of it is flat.
 *
 *   node tests/space-even.mjs [url]
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
await page.waitForTimeout(1200);

/* A circle, drawn with the space tool, so the walk in from the edge is the
   same on every approach and what it finds is banding, not shape. */
const frame = page.locator("[data-frame]").first();
const box = await frame.boundingBox();
const cx = box.x + box.width * 0.45;
const cy = box.y + 330;
const R = 150;
await page.keyboard.press("s");
await page.waitForTimeout(250);
await page.mouse.move(cx + R, cy);
await page.mouse.down();
for (let i = 1; i <= 72; i++) {
  const a = (i / 72) * Math.PI * 2;
  await page.mouse.move(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
}
await page.mouse.up();
/* The hole eats out to the line it was drawn as; the walk waits for that. */
await page.waitForTimeout(4500);

const made = await page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.spaces ?? []).length);
check("a space was drawn", made === 1, `${made} spaces`);

/**
 * In from the line along four radii, and every ring any of them finds.
 *
 * Four rather than one because a drawn space is not a perfect circle and a
 * single approach could cross a band at a glancing angle and miss its step.
 */
/*
 * WHAT IS ON THE SCREEN, not what one canvas holds. The hole is drawn by
 * more than one canvas now, one of them WebGL, which reads back as black to
 * a copy; and the first canvas under the middle is the board's ground. So the
 * circle is photographed as a person sees it and the walk is made on that.
 */
const shotB64 = (await page.screenshot({ clip: { x: cx - R, y: cy - R, width: R * 2, height: R * 2 } })).toString("base64");
const rings = await page.evaluate(async ({ b64, R }) => {
  const img = new Image();
  await new Promise((ok) => { img.onload = ok; img.src = `data:image/png;base64,${b64}`; });
  const shot = document.createElement("canvas");
  shot.width = img.width; shot.height = img.height;
  const g = shot.getContext("2d", { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const k = img.width / (R * 2);
  const at = (x, y) => {
    const d = g.getImageData(Math.round(x * k), Math.round(y * k), 1, 1).data;
    return 0.2126 * d[0] + 0.7152 * d[1] + 0.0722 * d[2];
  };
  const out = { rings: 0, worst: 0, walks: [] };
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const walk = [];
    /* In from past the lit rim, which is the edge and meant to be there. */
    for (let d = 16; d < R - 10; d++) walk.push(at(R + Math.cos(a) * (R - d), R + Math.sin(a) * (R - d)));
    let run = 0;
    for (let i = 1; i < walk.length; i++) {
      const step = Math.abs(walk[i] - walk[i - 1]);
      if (step < 0.5) { run++; continue; }
      if (run >= 3 && step >= 3 && i < walk.length - 20) { out.rings++; out.worst = Math.max(out.worst, step); }
      run = 0;
    }
    out.walks.push(Math.round(walk[0]) + "→" + Math.round(walk[walk.length - 1]));
  }
  return out;
}, { b64: shotB64, R });

check("the space was photographed and walked", !!rings, rings ? `edge→centre on four radii: ${rings.walks.join(", ")}` : "nothing to walk");
if (rings) {
  check(
    "the inside of a drawn space has no rings in it",
    rings.rings === 0,
    rings.rings ? `${rings.rings} rings across four radii, the worst a step of ${rings.worst.toFixed(1)} in 255` : "none on any of the four radii",
  );
}

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
