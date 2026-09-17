/**
 * No control on the light panel is dead.
 *
 * "Dead" has one meaning here and it is measured, not argued: move the
 * control from one end to the other and read the board back as PIXELS. A
 * control that changes none of them does nothing, whatever the code says it
 * does.
 *
 * WHAT WAS DEAD, WHEN THIS WAS WRITTEN, named one by one:
 *
 *   · How high it hangs — 0.0% of pixels either way. The shadow's whole
 *     range across the control was 2.27px long at the bottom and 0.21px at
 *     the top, because the length was `min(3, dist * reach) * lift` and
 *     `dist` is a fraction of the page: `dist * reach` ran 0.23 to 0.02 and
 *     never came near the 3 it was being held under.
 *   · Warmth — 0.0% everywhere, including on a call-to-action button, which
 *     was the one and only thing in the app that painted the lit face at
 *     all. And it was painted `oklch(1 0.02 …)`, at which chroma a hue
 *     cannot be read: white is white whatever angle you take it from.
 *
 * And one I called dead and had to take back: the on/off toggle. It is a
 * plain checkbox, not a switch, and my first probe clicked `[role=switch]`
 * and found nothing. That was my instrument, not the panel.
 *
 * The others were alive: how far things stand off, shadow strength, and
 * light on the page.
 *
 *     npx next start -p 3013
 *     node tests/light-alive.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
import { castFrom } from "../src/features/studio/look.ts";

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
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The arithmetic, with no browser in it                                */
/* ------------------------------------------------------------------ */

const L = { on: true, x: 0.3, y: 0.2, height: 0.55, strength: 0.45, lift: 10, warmth: 80, wash: 0 };
/* A card at 80,120 600x260 on a 1440-wide page: near the lamp, which is the
   case the old sum collapsed on. */
const cx = (80 + 300) / 1440, cy = (120 + 130) / 900;
const raking = castFrom({ ...L, height: 0 }, cx, cy);
const overhead = castFrom({ ...L, height: 1 }, cx, cy);
const span = Math.hypot(raking.dx - overhead.dx, raking.dy - overhead.dy);
check("the lamp's height is worth more than a pixel or two of shadow", span > 12,
  `raking ${raking.dx},${raking.dy} blur ${raking.blur} · overhead ${overhead.dx},${overhead.dy} blur ${overhead.blur} — ${span.toFixed(0)}px apart`);
check("and a raking lamp throws down and away, an overhead one almost straight down",
  Math.abs(raking.dx) > Math.abs(overhead.dx) + 4 && raking.dy > overhead.dy + 8,
  `dx ${raking.dx} vs ${overhead.dx}, dy ${raking.dy} vs ${overhead.dy}`);
check("nothing is thrown when the lamp is off", castFrom({ ...L, on: false }, cx, cy) === null);

/* ------------------------------------------------------------------ */
/* And on the board, control by control                                 */
/* ------------------------------------------------------------------ */

const node = (id, f, l, x, y, w, h) => ({
  id, pageId: "p0", featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("a", "card-grid", "Cards", 80, 120, 600, 260), node("b", "cta-primary", "Join", 760, 200, 300, 90)],
  groups: [], shapes: [], format: {}, look: { light: L },
  brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], threads: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();

const openLook = async () => {
  const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Look" }).first();
  if (await tab.count()) await tab.click().catch(() => {});
  await page.waitForTimeout(700);
};
const reset = async () => {
  await page.evaluate((l) => {
    const raw = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    raw.state.look = { ...(raw.state.look ?? {}), light: l };
    localStorage.setItem("builder.studio", JSON.stringify(raw));
  }, L).catch(() => {});
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  await openLook();
};
/** The part and the room round it, as pixels the page decoded itself. */
const pixels = async () => {
  const box = await page.locator("[data-node-id='a']").first().boundingBox();
  const png = await page.screenshot({ clip: { x: Math.round(box.x - 90), y: Math.round(box.y - 90), width: Math.round(box.width + 180), height: Math.round(box.height + 180) } });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext("2d"); ctx.drawImage(img, 0, 0);
    return [...ctx.getImageData(0, 0, cv.width, cv.height).data];
  }, png.toString("base64"));
};
const moved = (a, z) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    if (Math.abs(a[i] - z[i]) + Math.abs(a[i + 1] - z[i + 1]) + Math.abs(a[i + 2] - z[i + 2]) > 6) n++;
  }
  return Math.round((n / (a.length / 4)) * 1000) / 10;
};

await reset();
check("the light panel is in the Look tab", (await page.locator("[data-look-light]").count()) === 1);

/*
 * Measured, and then held to well under what was measured, because this is
 * a screenshot in a container: what it is for is telling "it moves" from
 * "it does nothing", not pinning a number.
 */
const SLIDERS = [
  { name: "How high it hangs", at: 0, least: 0.8 },
  { name: "How far things stand off", at: 1, least: 4 },
  { name: "Shadow strength", at: 2, least: 8 },
  { name: "Warmth", at: 3, least: 6 },
  { name: "Light on the page", at: 4, least: 20 },
];
for (const s of SLIDERS) {
  await reset();
  const slider = page.locator("[data-look-light]").first().locator('[role="slider"]').nth(s.at);
  const start = await pixels();
  await slider.focus();
  for (let k = 0; k < 120; k++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(600);
  const up = moved(start, await pixels());
  for (let k = 0; k < 240; k++) await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(600);
  const down = moved(start, await pixels());
  check(`“${s.name}” changes the board`, Math.max(up, down) >= s.least,
    `${up}% of pixels to the top, ${down}% to the bottom`);
}

await reset();
{
  const start = await pixels();
  const box = page.locator("[data-look-light]").first().locator('input[type="checkbox"]').first();
  await box.uncheck().catch(async () => { await box.click({ force: true }); });
  await page.waitForTimeout(700);
  const off = moved(start, await pixels());
  const on = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.look?.light?.on);
  check("the on/off toggle turns the lamp off, and the board says so", on === false && off >= 8, `${off}% of pixels, light.on now ${on}`);
}

await reset();
{
  check("“Place the light” hands the board over", (await page.locator("[data-place-light]").count()) === 1);
  await page.locator("[data-place-light]").click();
  await page.waitForTimeout(700);
  const placing = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.placingLight ?? null);
  const dim = await page.locator("[data-light-dim], [data-placing]").count();
  check("…and the board goes into placing", placing === true || dim > 0, `placingLight ${placing}, ${dim} dimmed surfaces`);
}

/* The lit face is painted on the part itself now, not only on one button. */
await reset();
{
  const faces = await page.locator("[data-lit-face]").count();
  check("every part wears the lit face, not just a call-to-action button", faces >= 2, `${faces} parts with one`);
}

await page.screenshot({ path: ".screenshots/light-alive.png" });
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
console.log(".screenshots/light-alive.png");
process.exit(bad ? 1 : 0);
