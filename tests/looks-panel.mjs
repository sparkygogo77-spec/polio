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

/* ------------------------------------------------------------------ */
/* 5. PICKING A COLOUR IS NEVER DONE BLIND                             */
/* ------------------------------------------------------------------ */

/*
 * HIS WORDS: the colour selector "should make it apparent what is about to
 * change before he changes it ... so he is never picking a colour blind" —
 * a font example for the text roles, a square for background and surface,
 * and for highlight whatever it actually affects.
 *
 * What stood there was the role's NAME. So this asks two things a name
 * cannot pass: that every one of the six draws something, and that what it
 * draws is different from role to role. A single shared example would sail
 * through the first and fail the second, which is the point of the second.
 */
const ROLE_NAMES = ["Background", "Surface", "Text", "Muted text", "Accent", "Highlight"];
const seen = [];
for (const name of ROLE_NAMES) {
  await page.getByRole("button", { name, exact: true }).first().click({ force: true });
  await page.waitForTimeout(350);
  /*
   * FINGERPRINTED ON WHAT IS DRAWN, never on the role's own id.
   *
   * The first version of this put the role id in the fingerprint, which
   * made the "six different things" check below unfailable: two roles
   * drawing an identical example would still have had two different ids
   * and sailed past. Text and Muted text share their words on purpose —
   * they are the same two lines with the emphasis moved between them — so
   * the id was carrying exactly the pair the check needed to catch. What
   * is read now is the words plus every mark's own colour and opacity,
   * which is the thing his eye is actually being shown.
   */
  const ex = await page.evaluate(() => {
    const e = document.querySelector("[data-role-example]");
    if (!e) return null;
    const paint = [...e.querySelectorAll("*")].map((n) => {
      const cs = getComputedStyle(n);
      return `${cs.color}|${cs.backgroundColor}|${cs.opacity}|${cs.textDecorationLine}`;
    });
    return { role: e.getAttribute("data-role-example"), text: e.innerText.trim(), marks: paint.length, paint: paint.join(" ") };
  });
  check(`picking ${name} shows what it paints, not its name`, !!ex && (ex.text.length > 0 || ex.marks > 0),
    ex ? `${ex.role}: "${ex.text.replace(/\n+/g, " / ")}"` : "nothing drawn");
  seen.push(ex ? `${ex.text}::${ex.paint}` : "");
}
check("and the six examples are six different things, not one example relabelled",
  new Set(seen).size === ROLE_NAMES.length, `${new Set(seen).size} distinct of ${ROLE_NAMES.length}, read off the words and every mark's own colour`);

/* ------------------------------------------------------------------ */
/* 6. ONE PLACE PAINTS THE PAGE                                        */
/* ------------------------------------------------------------------ */

/*
 * His words again: the fill options "may be redundant against the Texture
 * section at the bottom; merge them in some way rather than leaving two
 * places that paint the page."
 */
const places = await page.evaluate(() => ({
  fill: document.querySelectorAll("[data-look-fill] button").length,
  oldFill: document.querySelectorAll('[aria-label="Background fill"]').length,
  oldSwitches: document.querySelectorAll('[data-background-inspector] [aria-label^="Texture "]').length,
}));
check("the fill sits in the stack it belongs to, as painted swatches", places.fill === 4, `${places.fill} swatches`);
check("and the second place that painted the page is gone", places.oldFill === 0 && places.oldSwitches === 0,
  `${places.oldFill} old fill control, ${places.oldSwitches} duplicate layer switches`);

/*
 * AND THE FILL IS STILL THERE UNDER A TEXTURE, which is what made the two
 * worse than redundant. The stack used to REPLACE the fill rather than sit
 * on it: switch on any page layer and a mesh gradient was dropped, in
 * silence. MEASURED before the fix, the page's own background-image with a
 * mesh set and one layer on: the layer alone, no radial-gradient anywhere.
 */
await page.locator('[data-look-fill] button[aria-label="Mesh"]').first().click({ force: true });
await page.waitForTimeout(700);
const bare = await page.evaluate(() => getComputedStyle(document.querySelector("[data-frame]")).backgroundImage);
check("choosing a fill paints it on the page", /radial-gradient/.test(bare), bare.slice(0, 70));
const kinds = page.locator("[data-look-texture] button");
const n = await kinds.count();
for (let i = 4; i < n; i++) {
  await kinds.nth(i).click({ force: true });
  await page.waitForTimeout(800);
  if (await page.locator('[data-look-texture] [aria-label="Remove layer"]').count()) break;
}
await page.waitForTimeout(700);
const over = await page.evaluate(() => ({
  img: getComputedStyle(document.querySelector("[data-frame]")).backgroundImage,
  layers: document.querySelectorAll('[data-look-texture] [aria-label="Remove layer"]').length,
}));
check("a texture on the page goes OVER the fill rather than deleting it",
  over.layers > 0 && /radial-gradient/.test(over.img),
  over.layers ? `${over.layers} layer up, page paints: ${over.img.slice(0, 90)}` : "no layer was added, so this measured nothing");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
