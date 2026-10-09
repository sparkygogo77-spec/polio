/**
 * Saved palettes, texture on spaces, panels or fields, and Light & depth in
 * three groups.
 *
 * HIS WORDS: "i also should be able to save color palletes", "light and
 * depth also need better sections, texture should exist for panels or fields
 * or spaces and i can hardly see them in this format".
 *
 * On a page with a card holding a smaller card (a panel and a field):
 *   1. Saving the colours keeps them under a name; after the colours move,
 *      pressing the saved one puts all six back.
 *   2. A texture added to Panels only lands on the outer card and not on the
 *      inner one; switched to Fields, it is the other way round.
 *   3. The light's five dials sit in three named groups.
 *
 *   node tests/look-palettes-texture.mjs [url]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));

const part = (id, featureId, x, y, w, h, words) => ({
  id, pageId: "p0", featureId, label: id, prompt: "", content: words, data: "", x, y, w, h,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const seed = {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [part("outer", "captcha", 100, 100, 600, 400, "A panel"), part("inner", "captcha", 160, 200, 240, 160, "A field")],
  groups: [], shapes: [], format: {}, brief: { name: "Site", gimmick: "", master: "" }, frameWidth: 1400, activePageId: "p0", trail: [],
};
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(async (d) => {
  localStorage.clear();
  for (const x of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(x.name);
  localStorage.setItem("builder.studio", JSON.stringify({ state: d, version: 0 }));
}, seed);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
await page.waitForTimeout(700);

const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.look ?? {});

/* 1. SAVED PALETTES */
const box = page.locator("[data-saved-palettes]");
check("there is a saved palettes section", (await box.count()) === 1);
await box.locator("[data-palette-save]").click();
await box.getByLabel("Palette name").fill("Night");
await box.getByRole("button", { name: "Save", exact: true }).click();
await page.waitForTimeout(500);
const kept = (await stored()).palettes ?? [];
check("saving keeps the six colours under the name", kept.length === 1 && kept[0].name === "Night" && Object.keys(kept[0].colours).length === 6,
  JSON.stringify(kept.map((p) => p.name)));

// Move the colours behind its back, then put the saved ones back.
await page.evaluate(() => {
  const all = JSON.parse(localStorage.getItem("builder.studio"));
  all.state.look.palette = { bg: "#ff0000", surface: "#00ff00", text: "#0000ff", muted: "#888888", accent: "#ffff00", highlight: "#00ffff" };
  localStorage.setItem("builder.studio", JSON.stringify(all));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator('[aria-label="Side panel"] button', { hasText: /^Look$/ }).first().click({ force: true });
await page.waitForTimeout(700);
await page.locator("[data-saved-palettes]").getByRole("button", { name: "Use Night" }).click();
await page.waitForTimeout(500);
const back = await stored();
const want = kept[0]?.colours ?? {};
check("pressing it puts all six back", Object.keys(want).length === 6 && Object.keys(want).every((r) => back.palette?.[r] === want[r]),
  JSON.stringify(back.palette));

/* 2. TEXTURE ON PANELS OR FIELDS */
const tex = page.locator("[data-look-texture]");
const add = tex.locator("[data-texture-add]");
check("a new texture can be pointed at spaces, panels and fields",
  (await add.locator("[data-texture-spot]").count()) === 4, `${await add.locator("[data-texture-spot]").count()} places`);
await add.locator('[data-texture-spot="panels"]').click();
await add.locator('[data-texture-spot="page"]').click(); // panels only
await page.waitForTimeout(200);
const heights = await tex.locator("[data-texture-sample] > span:first-child").evaluateAll((els) => els.map((e) => e.getBoundingClientRect().height));
check("the samples are big enough to see", heights.length >= 3 && heights.every((h) => h >= 56), heights.join(", "));
await tex.locator('[data-texture-sample="stripes"]').click();
await page.waitForTimeout(800);
const lay = (await stored()).texture ?? [];
check("the layer lands on panels only", lay[0]?.target === "panels", lay[0]?.target);

/** Does anything inside a part paint the stripes? */
const striped = (id) => page.evaluate((id) => {
  const n = document.querySelector(`[data-node-id="${id}"]`);
  if (!n) return null;
  const inner = document.querySelector(`[data-node-id="inner"]`);
  return [n, ...n.querySelectorAll("*")].some((e) => (id !== "outer" || !inner?.contains(e)) && /gradient/.test(getComputedStyle(e).backgroundImage));
}, id);
check("on panels: the card holding the other wears it", (await striped("outer")) === true);
check("and the card holding nothing does not", (await striped("inner")) === false);

const spots = tex.locator('[data-texture-spots][aria-label="Where this layer lands"]').first();
await spots.locator('[data-texture-spot="fields"]').click();
await spots.locator('[data-texture-spot="panels"]').click();
await page.waitForTimeout(800);
check("switched to fields, the layer says so", ((await stored()).texture ?? [])[0]?.target === "fields");
check("now the card holding nothing wears it", (await striped("inner")) === true);
check("and the panel does not", (await striped("outer")) === false);

/* 3. LIGHT & DEPTH IN THREE GROUPS */
await page.locator("[data-light-open]").click();
await page.waitForTimeout(300);
const groups = await page.locator("[data-light-dials] [data-light-group]").evaluateAll((els) => els.map((e) => [e.dataset.lightGroup, e.querySelectorAll("[role=slider]").length]));
check("the light's dials sit in three named groups", groups.length === 3 && groups.reduce((n, g) => n + g[1], 0) === 5, JSON.stringify(groups));

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
