/**
 * The bar says where you are, not which screen of the editor you are on.
 *
 * It used to open on a Design / Preview / Book switch: three names for three
 * screens, one of which ("Design") was a button for the screen you were
 * already looking at, and none of which said *which site* was open. It reads
 * as a place now, left to right — out to **Builds**, the site's own **mark**
 * and **build**, then its **pages**, with the way to add one on the same
 * control — and the two ways out are at the far end: **Preview**, then
 * **Finish**, a green flag with a tick that carries the make-real queue and
 * opens the timeline.
 *
 * And on the timeline: a piece is a prompt on the board that the next call
 * can carry. It is never off, so it never goes grey, and it is not an
 * iteration, so it is not drawn the size of one.
 *
 *   node tests/header.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const doc = JSON.stringify({ state: {
  pages: [
    { id: "page_home", name: "Home", path: "/", prompt: "One scroll.", scroll: "inherit" },
    { id: "page_work", name: "Work", path: "/work", prompt: "", scroll: "inherit" },
  ],
  nodes: [{ id: "n_cta", pageId: "page_home", featureId: "cta-primary", label: "Join", prompt: "Say the thing.", content: "", data: "", x: 560, y: 460, w: 320, h: 64, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null }],
  groups: [], shapes: [], format: {},
  brief: { name: "BLACKORB", gimmick: "Power in the dark.", master: "A community token site." },
  frameWidth: 1440, activePageId: "page_home", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1100);

/* ------------------------------------------------------------------ */
/* 1. What is gone                                                     */
/* ------------------------------------------------------------------ */

check("Design is not a button for the screen you are on", (await page.getByRole("radio", { name: "Design" }).count()) === 0);
check("the Book tab has left the top left", (await page.getByRole("radio", { name: /^Book/ }).count()) === 0);
check("and so has the Builder nav tab the site's build replaces", (await page.getByRole("link", { name: /^Builder$/ }).count()) === 0);

/* ------------------------------------------------------------------ */
/* 2. What it reads, in order                                          */
/* ------------------------------------------------------------------ */

const x = async (sel) => (await page.locator(sel).first().boundingBox())?.x ?? NaN;
const builds = await page.getByRole("button", { name: "Builds" }).first().boundingBox();
const mark = await page.locator("[data-site-mark]").boundingBox();
const build = await page.locator("[data-site-build]").boundingBox();
const pages = await page.locator("[data-page-strip]").boundingBox();
check(
  "it reads Builds, the site's mark, its build, then its pages",
  builds && mark && build && pages && builds.x < mark.x && mark.x < build.x && build.x < pages.x,
  [builds?.x, mark?.x, build?.x, pages?.x].map((n) => Math.round(n ?? -1)).join(" < "),
);
check("the mark is the site's own initial", (await page.locator("[data-site-mark]").innerText()).trim() === "B");
check("and the build is the site's name", (await page.locator("[data-site-build]").innerText()).trim() === "BLACKORB");
check(
  "the mark wears the site's accent, not the app's",
  await page.locator("[data-site-mark]").evaluate((el) => {
    const bg = getComputedStyle(el).backgroundColor;
    return bg !== "rgba(0, 0, 0, 0)" && !/var\(/.test(bg);
  }),
  await page.locator("[data-site-mark]").evaluate((el) => getComputedStyle(el).backgroundColor),
);
const strip = await page.locator("[data-page-strip] button").evaluateAll((els) => els.map((e) => (e.getAttribute("aria-label") ?? e.innerText).trim().split("\n")[0]));
check("every page is on the strip", strip.filter((t) => !/^Add page$/.test(t)).length === 2, strip.join(" · "));
check(
  "and adding one is on the same control, not loose beside it",
  (await page.locator("[data-page-strip]").getByRole("button", { name: "Add page" }).count()) === 1,
);

/* ------------------------------------------------------------------ */
/* 3. The two ways out, at the far end                                 */
/* ------------------------------------------------------------------ */

const prev = await page.locator("[data-preview-toggle]").first().boundingBox();
const fin = await page.locator("[data-finish]").first().boundingBox();
check("Preview and Finish are at the end, Preview first", prev && fin && prev.x < fin.x, `${Math.round(prev?.x ?? -1)} < ${Math.round(fin?.x ?? -1)}`);
check("Finish is last on the bar", fin && fin.x + fin.width > (await x("[data-page-strip]")) + 900, `${Math.round(fin?.x ?? -1)}`);
check("Finish says nothing: it is an icon and the queue", !/finish/i.test((await page.locator("[data-finish]").innerText()).trim()), (await page.locator("[data-finish]").innerText()).replace(/\n/g, " "));
check("with a flag on it, and a tick on the flag", (await page.locator("[data-finish] svg path").count()) >= 3, `${await page.locator("[data-finish] svg path").count()} strokes`);
check("and it carries the make-real queue", /\d+\s*\/\s*\d+/.test((await page.locator("[data-finish]").innerText()).replace(/\s+/g, " ")), (await page.locator("[data-finish]").innerText()).replace(/\n/g, " "));
// Chromium serialises an oklch into `lab(L a b)` (and a gradient's stops
// with it), so the hue is worked out from that: green is the quadrant with a
// negative a* and a positive b*.
const hue = await page.locator("[data-finish]").evaluate((el) => {
  const s = getComputedStyle(el);
  const lab = /lab\(\s*[-\d.]+\s+([-\d.]+)\s+([-\d.]+)/.exec(s.backgroundImage) ?? /lab\(\s*[-\d.]+\s+([-\d.]+)\s+([-\d.]+)/.exec(s.borderColor);
  if (lab) return (Math.atan2(+lab[2], +lab[1]) * 180 / Math.PI + 360) % 360;
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s.backgroundImage) ?? /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s.borderColor);
  if (!m) return NaN;
  const [r, g, b] = [+m[1] / 255, +m[2] / 255, +m[3] / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return NaN;
  return ((max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60);
});
check("Finish is green — it ends the work rather than changing it", Number.isFinite(hue) && hue > 100 && hue < 180, `hue ${Math.round(hue)}°`);

/* Preview goes there and comes back. */
await page.locator("[data-preview-toggle]").click();
await page.waitForTimeout(700);
check("Preview goes to the site", (await page.locator("[data-preview-toggle]").getAttribute("aria-pressed")) === "true");
await page.locator("[data-preview-toggle]").click();
await page.waitForTimeout(700);
check("and pressing it again comes back to the board", (await page.locator("[data-preview-toggle]").getAttribute("aria-pressed")) === "false");

/* Finish opens the timeline, and comes back. */
await page.locator("[data-finish]").click();
await page.waitForTimeout(1100);
check("Finish opens the timeline", (await page.locator("[data-timeline]").count()) === 1);
check("and says so while it is open", (await page.locator("[data-finish]").getAttribute("aria-pressed")) === "true");

/* ------------------------------------------------------------------ */
/* 4. The pieces on it                                                 */
/* ------------------------------------------------------------------ */

// Pieces are the trail (ThreadTree), and the book's page shape — what
// Finish opens onto the timeline — deliberately drops the trail there: the
// timeline above it is already that history, and drawing it twice was the
// wall that shape replaced. The dialog and panel shapes keep the Trail
// tab, so that is where a piece is checked, via the hook that opens one —
// back to the board first, since the dialog does not open over the timeline.
await page.locator("[data-finish]").click();
await page.waitForTimeout(700);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(600);
await page.getByRole("radiogroup", { name: "View" }).getByRole("radio", { name: /^Trail/ }).click();
await page.waitForTimeout(400);

const pieces = await page.locator("[data-piece]").evaluateAll((els) => els.map((e) => {
  const s = getComputedStyle(e);
  const r = e.getBoundingClientRect();
  const c = /oklch\(([\d.]+) ([\d.]+) ([\d.]+)/.exec(s.color);
  return { pressed: e.getAttribute("aria-pressed"), chroma: c ? +c[2] : 0, hue: c ? +c[3] : NaN, w: Math.round(r.width), h: Math.round(r.height) };
}));
check("the board's pieces float on the timeline", pieces.length >= 2, `${pieces.length}`);
const unvined = pieces.filter((p) => p.pressed !== "true");
check(
  "a piece nobody has vined is still purple, not greyed out",
  unvined.length > 0 && unvined.every((p) => p.chroma > 0.03 && Math.abs(p.hue - 300) < 60),
  unvined.map((p) => `c${p.chroma} h${Math.round(p.hue)}`).join(" "),
);
const draft = await page.locator("[data-draft]").boundingBox();
check(
  "and it is smaller than an iteration box, because it is not one",
  draft && pieces.every((p) => p.w < draft.width * 0.75 && p.h < draft.height * 0.6),
  `piece ${pieces[0]?.w}×${pieces[0]?.h} vs box ${Math.round(draft?.width ?? 0)}×${Math.round(draft?.height ?? 0)}`,
);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
