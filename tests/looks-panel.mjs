/**
 * The Looks panel: the light is placed, the sliders are folded away, and the
 * textures are shown rather than described.
 *
 * HIS WORDS: "this panel is kind of ugly, pressing the place the light button
 * does nothing but create a bleeding aura through categories around the web
 * box which needs to be fixed. these settings should atleast be a dropdown
 * for the light section which shouldnt always be open like this, the texture
 * part too toward the bottom should be more exemplary and display the types
 * of textures it can create."
 *
 * Measured first, and he was exactly right: pressing the button put a
 * 26px-blur 6px-spread glow around the page and did nothing else — no light
 * in the hand, and a press on the page left the lamp off at its old place
 * with the mode still running. The only way to place one was to press and
 * DRAG off the button, which nothing on screen said.
 *
 * Judged against his own benchmark, the right-click wheel: everything
 * reachable fast, a control showing what it does rather than naming it, and
 * colour doing real work.
 *
 *   node tests/looks-panel.mjs [url]
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
await page.waitForTimeout(1400);

await page.locator('[aria-label="Side panel"] button', { hasText: /Look/i }).first().click({ force: true });
await page.waitForTimeout(700);
check("the Looks panel opens", (await page.locator("[data-look-panel]").count()) === 1);

/* ------------------------------------------------------------------ */
/* 1. THE LIGHT SECTION IS FOLDED AWAY                                 */
/* ------------------------------------------------------------------ */

/*
 * Scoped to the section the button lives in rather than to a marker I was
 * about to add: a selector for something that does not exist yet answers
 * zero and passes, which is a check agreeing with itself. This counts the
 * five that are on screen today.
 */
const sliders = () => page.locator('[data-look-panel] section:has([data-place-light]) [role=slider]').count();
check("the light's settings are not all sitting open", (await sliders()) === 0, `${await sliders()} sliders on screen`);
check("and there is something to open them with", (await page.locator("[data-light-open]").count()) === 1);

await page.locator("[data-light-open]").first().click({ force: true });
await page.waitForTimeout(500);
check("opening it shows them", (await sliders()) >= 4, `${await sliders()} sliders`);
await page.locator("[data-light-open]").first().click({ force: true });
await page.waitForTimeout(400);
check("and it folds away again", (await sliders()) === 0, `${await sliders()} sliders`);

/* ------------------------------------------------------------------ */
/* 2. PRESSING IT PLACES A LIGHT                                       */
/* ------------------------------------------------------------------ */

const lamp = () => page.evaluate(() => {
  const l = JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.look?.light;
  return l ? { on: !!l.on, x: Math.round((l.x ?? 0) * 100), y: Math.round((l.y ?? 0) * 100) } : null;
});
const was = await lamp();
await page.locator("[data-place-light]").first().click({ force: true });
await page.waitForTimeout(600);
check("pressing it starts placing a light", (await page.locator("[data-light-dim]").count()) === 1);

const frame = await page.locator("[data-frame]").first().boundingBox();
const spot = { x: frame.x + frame.width * 0.3, y: frame.y + 260 };
await page.mouse.move(spot.x, spot.y);
await page.waitForTimeout(400);
check("the light is in his hand while he looks for where to put it",
  (await page.locator("[data-light-ball]").count()) === 1,
  `${await page.locator("[data-light-ball]").count()} in hand`);

await page.mouse.click(spot.x, spot.y);
await page.waitForTimeout(700);
const now = await lamp();
check("pressing a place on the page puts the light there and turns it on",
  !!now?.on && (now.x !== was?.x || now.y !== was?.y),
  `was ${was?.on ? "on" : "off"} at ${was?.x}%, ${was?.y}% — now ${now?.on ? "on" : "off"} at ${now?.x}%, ${now?.y}%`);
check("and placing it is over", (await page.locator("[data-light-dim]").count()) === 0,
  `${await page.locator("[data-light-dim]").count()} still placing`);

/* ------------------------------------------------------------------ */
/* 3. NOTHING BLEEDS OVER THE PANELS                                   */
/* ------------------------------------------------------------------ */

await page.locator("[data-place-light]").first().click({ force: true });
await page.waitForTimeout(500);
const bleed = await page.evaluate(() => {
  const ring = document.querySelector("[data-light-dim]");
  if (!ring) return null;
  const panel = document.querySelector("[data-look-panel]")?.getBoundingClientRect();
  /* What the ring actually PAINTS: its own box grown by the blur and spread
     of every shadow on it, which is the aura he is seeing. */
  const inner = ring.firstElementChild;
  const cs = inner ? getComputedStyle(inner) : null;
  /* An INSET shadow paints inward and reaches nothing outside the box it is
     on, so summing its blur and spread as outward reach — which is what this
     did at first — reports a bleed that is not there. Only an outward shadow
     counts. */
  const shadow = cs?.boxShadow ?? "";
  const m = /(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px\s+(-?\d+(?:\.\d+)?)px/.exec(shadow);
  const reach = m && !/inset/.test(shadow) ? Number(m[3]) + Number(m[4]) : 0;
  const box = ring.getBoundingClientRect();
  const painted = { left: box.left - reach, right: box.right + reach, top: box.top - reach, bottom: box.bottom + reach };
  const over = panel && painted.left < panel.right && painted.right > panel.left && painted.top < panel.bottom && painted.bottom > panel.top;
  return { reach, over: !!over, inset: /inset/.test(shadow) };
});
check("the aura does not bleed over the panel and its categories", bleed && !bleed.over,
  bleed ? `it reaches ${bleed.reach}px past the page${bleed.inset ? ", the mark being drawn inside it" : ""}` : "no ring to measure");
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* 4. THE TEXTURES ARE SHOWN, NOT DESCRIBED                            */
/* ------------------------------------------------------------------ */

const shown = await page.evaluate(() => ({
  samples: document.querySelectorAll("[data-texture-sample]").length,
  words: [...document.querySelectorAll("[data-texture-section] p")].map((p) => p.textContent.trim().length).reduce((a, b) => a + b, 0),
}));
check("the textures it can make are shown as examples", shown.samples >= 3, `${shown.samples} samples`);
check("rather than as a paragraph about them", shown.words < 160, `${shown.words} characters of prose`);

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
