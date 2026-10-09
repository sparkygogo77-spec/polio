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

/* Texture is given from the Colours preview: press the page there and pick a kind; the kind shows pressed (there is no stack of layers any more). */
const pickTexture = async (pg, kind) => {
  if (!(await pg.locator("[data-kind-texture]").count())) await pg.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
  await pg.waitForTimeout(300);
  await pg.locator(`[data-kind-texture] [data-texture-sample="${kind}"]`).first().click({ force: true });
  await pg.waitForTimeout(600);
};
await page.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
await page.waitForTimeout(400);
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
 * HIS WORDS, the first time: the colour selector "should make it apparent
 * what is about to change before he changes it ... so he is never picking a
 * colour blind". So each role drew what it paints.
 *
 * HIS WORDS, the second time, asked for three times: six examples shown one
 * at a time is redundant. He wants ONE example with all six roles in it at
 * once, background, surface, text, muted text, accent and highlight, so the
 * whole palette is seen together instead of flipped through role by role.
 * A correction is a rule (DESIGN.md 4.3): this section used to require six
 * DIFFERENT examples, and it now requires the opposite, one example that
 * does not change when the role does, except for the mark on what the
 * picked role paints.
 *
 * Every colour below is read off the six swatches the panel itself paints,
 * never written in here.
 */
const ROLE_NAMES = ["Background", "Surface", "Text", "Muted text", "Accent", "Highlight"];
const ROLE_ID = { Background: "bg", Surface: "surface", Text: "text", "Muted text": "muted", Accent: "accent", Highlight: "highlight" };
const swatch = (name) => page.locator("[data-look-colour]").getByRole("button", { name, exact: true }).first();
const roleColour = {};
for (const name of ROLE_NAMES) roleColour[name] = await swatch(name).evaluate((e) => getComputedStyle(e).backgroundColor);
const readExample = () => page.evaluate(() => {
  const all = document.querySelectorAll("[data-look-colour] [data-role-example]");
  const e = all[0];
  if (!e) return { count: 0 };
  const nodes = [e, ...e.querySelectorAll("*")];
  const paints = new Set();
  for (const n of nodes) { const cs = getComputedStyle(n); paints.add(cs.color); paints.add(cs.backgroundColor); }
  // What is DRAWN, less the mark: words, and every element's colour, fill and opacity. Outlines are the mark.
  const drawn = nodes.map((n) => { const cs = getComputedStyle(n); return `${cs.color}|${cs.backgroundColor}|${cs.opacity}`; }).join(" ") + "::" + e.innerText;
  const picked = nodes.filter((n) => n.hasAttribute("data-picked")).map((n) => {
    const cs = getComputedStyle(n);
    return { part: n.getAttribute("data-role-part"), color: cs.color, fill: cs.backgroundColor };
  });
  return { count: all.length, paints: [...paints], drawn, picked };
});
const drawnSeen = new Set();
for (const name of ROLE_NAMES) {
  await swatch(name).click({ force: true });
  await page.waitForTimeout(350);
  const ex = await readExample();
  const missing = ROLE_NAMES.filter((r) => !(ex.paints ?? []).includes(roleColour[r]));
  check(`with ${name} picked there is one example, and all six roles are painted in it`, ex.count === 1 && missing.length === 0,
    ex.count !== 1 ? `${ex.count} examples` : missing.length ? `not painted: ${missing.map((r) => `${r} ${roleColour[r]}`).join(", ")}` : "");
  const want = ROLE_ID[name];
  const marked = ex.picked ?? [];
  check(`…with what ${name} paints marked in it, and nothing else`,
    marked.length > 0 && marked.every((m) => m.part === want && (m.color === roleColour[name] || m.fill === roleColour[name])),
    marked.length ? marked.map((m) => m.part).join(", ") : "nothing marked");
  drawnSeen.add(ex.drawn ?? "");
}
check("and it is the same example whichever role is picked, the palette seen whole rather than role by role",
  drawnSeen.size === 1, `${drawnSeen.size} different drawings over six picks`);

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
await pickTexture(page, "stripes");
await page.waitForTimeout(700);
const over = await page.evaluate(() => ({
  img: getComputedStyle(document.querySelector("[data-frame]")).backgroundImage,
  layers: document.querySelectorAll('[data-kind-texture] [data-texture-sample="stripes"][aria-pressed="true"]').length,
}));
check("a texture on the page goes OVER the fill rather than deleting it",
  over.layers > 0 && /radial-gradient/.test(over.img),
  over.layers ? `${over.layers} layer up, page paints: ${over.img.slice(0, 90)}` : "no layer was added, so this measured nothing");

/* ------------------------------------------------------------------ */
/* 7. THE SECTIONS STACK, RATHER THAN SHARING A BAND                   */
/* ------------------------------------------------------------------ */

/*
 * A LIVE ONE, off the surface he works on. The Background block kept the
 * shape it was born with, from when it was the whole of the Element tab:
 * `h-full` outside and `flex-1 overflow-y-auto` on its body, which is how a
 * panel fills its pane. Moved into the Look column — itself a flex column
 * that scrolls — `h-full` had nothing to measure against and the block
 * collapsed to 9px while its own contents ran on for another 28.
 *
 * MEASURED at a 227px panel, before the fix: the block stood from y 119 to
 * y 128 with its heading at 127 and the Colour heading at 140, two headings
 * inside a 15px band, and the line "The page behind every part" laid across
 * the row of swatches under it.
 *
 * TWO QUESTIONS, because one of them is the fault and the other is the
 * shape of it. No two headings may share a band, which is what he saw. And
 * no section may be shorter than what it holds, which is what was actually
 * wrong — a margin was never going to fix a box of the wrong height, and
 * the second question is the one that catches the next block dropped into
 * this column with a panel's shape still on it.
 */
const laid = await page.evaluate(() => {
  const panel = document.querySelector("[data-look-panel]");
  if (!panel) return null;
  const heads = [...panel.querySelectorAll("[data-look-heading]")].map((e) => {
    const r = e.getBoundingClientRect();
    return { name: e.textContent.trim(), top: Math.round(r.top), bottom: Math.round(r.bottom) };
  });
  const spill = [...panel.querySelectorAll("[data-background-inspector], [data-look-colour], [data-look-texture]")].map((sec) => {
    const r = sec.getBoundingClientRect();
    let low = r.bottom;
    for (const kid of sec.children) low = Math.max(low, kid.getBoundingClientRect().bottom);
    return { name: sec.dataset.backgroundInspector !== undefined ? "background" : sec.dataset.lookColour !== undefined ? "colour" : "texture",
      h: Math.round(r.height), over: Math.round(low - r.bottom) };
  });
  return { heads, spill };
});
check("the panel's sections each carry a heading", !!laid && laid.heads.length >= 3,
  laid ? `${laid.heads.length}: ${laid.heads.map((h) => `${h.name} at ${h.top}`).join(", ")}` : "no panel");
const shared = !laid ? [] : laid.heads.flatMap((a, i) =>
  laid.heads.slice(i + 1).filter((b) => a.top < b.bottom && a.bottom > b.top).map((b) => `${a.name} at ${a.top}-${a.bottom} and ${b.name} at ${b.top}-${b.bottom}`));
check("and no two of them share a band", shared.length === 0, shared.join("; ") || "every heading has its own");
const burst = !laid ? [] : laid.spill.filter((x) => x.over > 1);
check("and no section is shorter than what it holds", burst.length === 0,
  burst.map((x) => `${x.name} is ${x.h}px with ${x.over}px hanging out of it`).join("; ")
    || (laid ? laid.spill.map((x) => `${x.name} ${x.h}px`).join(", ") : "-"));

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
console.log("");
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
