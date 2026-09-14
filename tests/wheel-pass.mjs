/**
 * The page's wheel, after J went through it button by button.
 *
 * Four of his, and each one is a slot earning its place or losing it:
 *
 *   · Scissors went — Cut and Strip were the same thing twice, both taking
 *     the background bare and holding it for a paste. Picture took the slot.
 *   · The three-dot More went — it was the tray's own two items in a second
 *     place, and the tray is under the wheel already.
 *   · Edit went — it held the frame's width and a placeholder, and the width
 *     is the third copy of one control: the bar's Desktop / Tablet / Phone
 *     keys set it, and so does Frame width on the canvas menu.
 *   · The pencil stayed and was given more than one box to open.
 *
 * And the key in the corner of the bar stopped wearing the construct
 * surface: a material whose point is a slow drift across a surface has no
 * surface to drift across at 28px.
 *
 *   node tests/wheel-pass.mjs [url]
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

/* ------------------------------------------------------------------ */
/* 1. The width was a third copy, and still is not on the wheel        */
/* ------------------------------------------------------------------ */

/* The reason Edit went, stated as a count rather than an opinion: if the
   width ever stops being set in two other places, it has earned a slab. */
const sets = ["src/features/studio/StudioPage.tsx", "src/features/studio/index.ts", "src/features/studio/BackgroundEditors.tsx"]
  .filter((f) => /setFrameWidth\(/.test(readFileSync(f, "utf8")));
check("the frame's width is still set somewhere other than the wheel", sets.length >= 2,
  `${sets.length} places: ${sets.map((f) => f.split("/").pop()).join(", ")}`);

/* ------------------------------------------------------------------ */
/* 2. The wheel itself                                                  */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);

const frame = await page.locator("[data-frame]").first().boundingBox();
const bare = await page.evaluate(() => {
  const f = document.querySelector("[data-frame]").getBoundingClientRect();
  const mid = document.querySelector("[data-studio-scroll]").getBoundingClientRect();
  return { x: Math.round((mid.x + f.x) / 2), y: Math.round(f.y + f.height / 2) };
});
void frame;
/* On the frame, which is the page's own wheel. */
await page.mouse.click(bare.x + 80, bare.y, { button: "right" });
await page.waitForTimeout(700);
const wheel = page.locator("[data-radial]");
check("the page's wheel opens", (await wheel.count()) === 1);

const slabs = await wheel.locator("[data-shard]").evaluateAll((els) =>
  els.map((e) => ({ id: e.getAttribute("data-shard"), label: e.getAttribute("aria-label") })));
const has = (id) => slabs.some((s) => s.id === id);
check("the three-dot More has gone", !has("more"), slabs.map((s) => s.label).join(" · "));
check("and Edit with it", !has("edit"));
check("Draw and Create are both there", has("draw") && has("create"));
check("Picture is there, where Cut was", has("duplicate") && slabs.find((s) => s.id === "duplicate")?.label === "Picture",
  slabs.find((s) => s.id === "duplicate")?.label ?? "not there");
check("and Strip is still the one red thing", has("delete"));

/* Nothing is left as a sliver: taking two slabs out has to re-cut the bands
   rather than leave gaps where they were. */
const sizes = await wheel.locator("[data-shard]").evaluateAll((els) => els.map((e) => {
  const n = 24, len = e.getTotalLength ? e.getTotalLength() : 0;
  if (!len) return 0;
  return Math.round(len);
}));
check("every slab is a slab, not a sliver", sizes.every((n) => n > 80), sizes.join(", "));

/* ------------------------------------------------------------------ */
/* 3. The pencil opens more than one box                                */
/* ------------------------------------------------------------------ */

await wheel.locator('[data-shard="write"]').click({ force: true });
await page.waitForTimeout(700);
const choices = await wheel.locator("[data-shard]").evaluateAll((els) =>
  els.map((e) => e.getAttribute("aria-label")).filter(Boolean));
const written = ["Words", "Name", "Address"].filter((w) => choices.includes(w));
check("the pencil holds everything written about the page", written.length === 3,
  written.join(", ") || choices.join(" · "));
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* 4. The key in the corner is plain                                    */
/* ------------------------------------------------------------------ */

const key = page.locator('[aria-label^="Finish"]').first();
const dressed = await key.evaluate((e) => {
  /* Through a canvas, because a computed colour comes back in whatever
     space the author wrote — `lab(...)` here, which a regex for `rgb(` or
     `oklch(` reads as no colour at all. Asking the canvas gives channels. */
  const cv = document.createElement("canvas");
  cv.width = cv.height = 1;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.fillStyle = getComputedStyle(e).backgroundColor;
  cx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
  return {
    molten: e.className.includes("molten"),
    inner: e.querySelector("[data-molten]") !== null,
    bg: getComputedStyle(e).backgroundImage,
    colour: getComputedStyle(e).backgroundColor,
    rgb: { r, g, b, a },
  };
});
check("the key in the corner wears no construct surface", !dressed.molten && !dressed.inner,
  dressed.molten ? "still molten" : "plain");
check("and nothing is drifting across it", dressed.bg === "none", dressed.bg.slice(0, 48));
const { r, g, b, a } = dressed.rgb;
check("but it is still green, and solid", a > 250 && g > r + 20 && g > b + 20,
  `${dressed.colour} — rgb ${r},${g},${b}`);

await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
