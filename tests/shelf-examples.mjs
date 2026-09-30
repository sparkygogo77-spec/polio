/**
 * Every element in the shelf shows what it is.
 *
 * HIS WORDS: a category of grey rectangles is the reason he cannot tell what
 * any element is. The shelf does not show icons — it renders the real part,
 * small, in the site's own theme — so an element that reads as a grey
 * rectangle is a part that draws nothing until it is given something to draw.
 *
 * So this counts ink. Each tile is photographed and its pixels compared
 * against the panel it stands on: a tile whose picture is all one colour is
 * showing nothing, whatever it is called. It names every one it finds, so the
 * fix is a list rather than a hunt.
 *
 *   node tests/shelf-examples.mjs [url]      # default http://localhost:3000
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

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } });
const STATUS = { github: { configured: false, token: null, repo: null, branch: "main", missing: ["GITHUB_TOKEN"], allow: null }, vercel: { hook: false } };
await page.route("**/api/studio/**", (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(what === "publish" ? STATUS : {}) });
});
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const cats = await page.locator("[data-category]").evaluateAll((els) => els.map((e) => e.getAttribute("data-category")).filter((c) => c && c !== "custom-idea"));
check("the shelf offers its categories", cats.length >= 10, `${cats.length}: ${cats.join(", ")}`);

/**
 * How much of a tile's picture is not the panel behind it.
 *
 * Measured in the page from a screenshot, because a preview is a real part
 * and what it paints may be canvas, gradient or text — counting DOM nodes
 * would call a part that renders one empty box "drawn".
 */
const inkOf = async (clip) => {
  const shot = await page.screenshot({ clip });
  return page.evaluate(async (b64) => {
    const img = new Image();
    await new Promise((r) => { img.onload = r; img.src = `data:image/png;base64,${b64}`; });
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const { data } = g.getImageData(0, 0, c.width, c.height);
    /* The commonest colour is the ground the part stands on. Anything a
       noticeable step away from it is something the part drew. */
    const tally = new Map();
    for (let i = 0; i < data.length; i += 4) {
      const k = `${data[i] >> 3},${data[i + 1] >> 3},${data[i + 2] >> 3}`;
      tally.set(k, (tally.get(k) ?? 0) + 1);
    }
    let ground = null, most = 0;
    for (const [k, n] of tally) if (n > most) { most = n; ground = k; }
    const [gr, gg, gb] = ground.split(",").map((n) => Number(n) * 8);
    let ink = 0, total = 0;
    for (let i = 0; i < data.length; i += 4) {
      total++;
      if (Math.abs(data[i] - gr) + Math.abs(data[i + 1] - gg) + Math.abs(data[i + 2] - gb) > 24) ink++;
    }
    return { share: ink / Math.max(1, total), colours: tally.size };
  }, shot.toString("base64"));
};

/** Enough of the tile is not its own background that something is drawn on it. */
const BLANK = 0.02;

const blank = [];
const every = [];
let seen = 0;
for (const id of cats) {
  await page.locator(`[data-category="${id}"]`).first().click({ force: true });
  await page.waitForTimeout(700);
  const open = page.locator(`[data-category-open="${id}"]`);
  if (!(await open.count())) continue;
  const tiles = open.locator("[data-tile]");
  const n = await tiles.count();
  for (let i = 0; i < n; i++) {
    const t = tiles.nth(i);
    await t.scrollIntoViewIfNeeded().catch(() => {});
    await page.waitForTimeout(90);
    const box = await t.boundingBox();
    if (!box || box.width < 8 || box.height < 8) continue;
    /* The picture only: the name under it is text and would count as ink. */
    const clip = { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.max(8, Math.round(box.height - 14)) };
    const { share } = await inkOf(clip);
    seen++;
    const tid = await t.getAttribute("data-tile");
    every.push({ id: tid, cat: id, share });
    if (share < BLANK) blank.push({ id: tid, cat: id, share });
  }
  await page.locator(`[data-category="${id}"]`).first().click({ force: true });
  await page.waitForTimeout(250);
}

/* One card per thing since Lane I (its near-copies are versions on its detail card): every catalogue card on the shelf. */
check("every tile in the shelf was looked at", seen >= 150, `${seen} tiles across ${cats.length} categories`);
check(
  "every element in the shelf shows what it is, rather than a grey rectangle",
  blank.length === 0,
  blank.length
    ? `${blank.length} of ${seen} draw nothing: ${blank.slice(0, 20).map((b) => `${b.cat}/${b.id} ${(b.share * 100).toFixed(1)}%`).join(", ")}${blank.length > 20 ? ` …and ${blank.length - 20} more` : ""}`
    : `all ${seen} draw something`,
);

/* The spread, because "draws something" is a low bar and the interesting
   question is how much. */
every.sort((a, b) => a.share - b.share);
const band = (lo, hi) => every.filter((e) => e.share >= lo && e.share < hi).length;
console.log(`\n       ink on a tile: under 5% \u2014 ${band(0, 0.05)}, 5-15% \u2014 ${band(0.05, 0.15)}, 15-30% \u2014 ${band(0.15, 0.3)}, over 30% \u2014 ${band(0.3, 2)}`);
console.log(`       the ten faintest: ${every.slice(0, 10).map((e) => `${e.id} ${(e.share * 100).toFixed(1)}%`).join(", ")}`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
