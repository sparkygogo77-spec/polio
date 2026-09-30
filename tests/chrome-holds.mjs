/**
 * The Builder's own furniture does not change colour with his site.
 *
 * HIS REPORT, with two screenshots of the same shelf: he set Surface to a
 * blue and the band behind the category icons went gold; he set it to a grey
 * and the band went coloured again. Nothing else was touched.
 *
 * The shelf is the Builder, not the page. A role is about the page. What the
 * shelf was doing was taking the site's SURFACE, dimming it and spinning it
 * half a turn round the wheel to use as the field its previews float on, so
 * the band was a complement of whatever he chose — by definition the one
 * colour furthest from it. The better he picked, the louder the shelf
 * answered back.
 *
 * MEASURED before the fix, the field's own background:
 *
 *   surface hue 263.6, a blue   →  field hue 83.6, a gold
 *   surface a flat grey         →  field hue 180
 *
 * TWO HALVES, and the second is what keeps this honest. The Builder's
 * surfaces must hold; and the part previews must still follow, because they
 * are pictures of his site and following is their job. A check that only
 * asked for stillness would be satisfied by freezing the previews too, which
 * would be a worse bug than the one it was written for.
 *
 *   node tests/chrome-holds.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);
/* A category open, so the shelf's field and its previews are both on screen. */
await page.getByText("Layout", { exact: true }).first().click({ force: true });
await page.waitForTimeout(1000);

/** Everything the Builder paints itself with, and one preview for contrast. */
const read = () => page.evaluate(() => {
  const paint = (sel) => { const e = document.querySelector(sel); if (!e) return "missing"; const cs = getComputedStyle(e); return `${cs.backgroundColor}|${cs.borderColor}`; };
  return {
    "the shelf's field": paint("[data-parts-field]"),
    "the shelf's band": paint("[data-drawer]"),
    "the side panel": paint("[data-side-panel]"),
    "the top bar": paint("[data-studio-bar]"),
    /* Not chrome: a picture of his site, which is meant to follow it. */
    preview: (() => { const e = document.querySelector("[data-tile] div[style*=background]"); return e ? getComputedStyle(e).backgroundColor : "none"; })(),
  };
});

const setRole = async (role, hex) => {
  await page.getByRole("tab", { name: "Look" }).first().click({ force: true })
    .catch(async () => { await page.getByText("Look", { exact: true }).first().click({ force: true }); });
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: role, exact: true }).first().click({ force: true });
  await page.waitForTimeout(400);
  const input = page.locator(`[aria-label="${role} colour"]`).first();
  await input.fill(hex);
  await input.press("Enter");
  await page.waitForTimeout(1100);
};

/* His two screenshots: a blue, then a grey. */
await setRole("Surface", "#2b5fd9");
const blue = await read();
await setRole("Surface", "#8a8a8a");
const grey = await read();

const CHROME = ["the shelf's field", "the shelf's band", "the side panel", "the top bar"];
check("the Builder's surfaces are on screen to be measured",
  CHROME.every((k) => blue[k] !== "missing"),
  CHROME.map((k) => `${k}: ${blue[k] === "missing" ? "missing" : "found"}`).join(", "));

const moved = CHROME.filter((k) => blue[k] !== grey[k]);
check("and not one of them moves when a site role changes",
  moved.length === 0,
  moved.length ? moved.map((k) => `${k}: ${blue[k]} then ${grey[k]}`).join("; ") : `${CHROME.length} held, the field at ${grey["the shelf's field"].split("|")[0]}`);

/* The other half, which is what stops the check above being satisfied by a
   Builder that has stopped showing him his own site at all. */
/* A shelf preview stands on his page's own colour now (`PartPreview`, ground "page"), so it follows the Background role. */
await setRole("Background", "#1d3a2a");
const green = await read();
check("while the part previews do follow it, because they are pictures of his site",
  grey.preview !== "none" && green.preview !== grey.preview,
  grey.preview === "none" ? "no preview found to measure" : `${grey.preview} then ${green.preview}`);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
