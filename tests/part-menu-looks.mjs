/**
 * THE PART'S MENU CHANGES EVERY LOOK A CAPTURED PART WEARS, FOR THE
 * SELECTION, AND "EVERY PART LIKE IT".
 *
 * A right press on a part opens the wheel. BEFORE this, its Looks held Hue
 * (the six colours the part paints: words, fill, …), Texture and Aura; its
 * Edit held Name, Options and Font (size, weight, letter spacing, line
 * height, family); its tray Preview here, Forward, Backward, Copy looks and
 * Paste looks. There was no border colour or width, no shadow, it changed
 * the one part it was opened on, and nothing reached the parts that shared
 * its colour or face.
 *
 * NOW: Looks has Edge (border colour and width, and the shadow: none, hard
 * offset, soft, glow, its size and colour); an edit on a part in a
 * multi-selection changes the same thing on every picked part and nothing
 * else about them; and the tray has "All with this colour" and "All in this
 * font", which swap what this part moved from, across the site, with the
 * Look panel's swap-all (`siteColours.ts`).
 *
 *   node tests/part-menu-looks.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const bare = (f) => readFileSync(join(here, "..", f), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/* ------------------------------------------------------------ the source */
const radial = ["RadialMenu.tsx", ...["open.ts", "choices.ts", "RadialMenu.tsx", "ring.tsx"].map((f) => `radial/${f}`)].map((f) => `src/features/studio/${f}`).map(bare).join("\n");
const editors = bare("src/features/studio/RingEditors.tsx");
check("Looks offers Edge beside Hue, Texture and Aura", /case "look":[\s\S]{0,400}id: "edge"/.test(radial));
check("Font still sets size, weight, letter spacing and family", ["Size", "Weight", "Letter spacing", "Family"].every((l) => editors.includes(`label="${l}"`)));

/* ------------------------------------------------------------ the pure half */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const C = await jiti.import(join(here, "..", "src", "features", "studio", "look", "siteColours.ts"));
const E = await jiti.import(join(here, "..", "src", "features", "studio", "RingEditors.tsx"));
const INK = "rgb(26, 15, 11)", RED = "rgb(210, 60, 52)";
const mv = C.movedColours({ id: "a", colour: { text: INK }, edge: { width: 4, style: "solid", colour: INK } }, { id: "a", colour: { text: "#ffffff" }, edge: { width: 4, style: "solid", colour: INK } });
check("what one part moved: its words from ink to white, and not its border", mv.length === 1 && mv[0].use === "text" && C.colourKey(mv[0].from) === INK && mv[0].to === "#ffffff", JSON.stringify(mv));
const mf = C.movedFont({ id: "a", font: { face: "VT323", size: 1.5 } }, { id: "a", font: { face: "Fredoka", size: 1.5, weight: 700 } });
check("…and its face from VT323 to Fredoka, bold", mf?.from === "VT323" && mf.to.face === "Fredoka" && mf.patch.weight === 700 && !("size" in mf.patch), JSON.stringify(mf));
check("a shadow is read as the four kinds, and written back", E.readShadow(`${INK} 5px 5px 0px 0px`).kind === "hard" && E.readShadow("rgb(255, 75, 62) 0px 0px 10px 0px").kind === "glow"
  && E.writeShadow("hard", 5, INK) === `${INK} 5px 5px 0px 0px`);

/* ------------------------------------------------------------ the wheel */
const node = (id, x, y, extra = {}) => ({
  id, pageId: "page_home", featureId: "prose", label: id, prompt: "", content: `Words of ${id}`, data: "", x, y, w: 260, h: 90, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0,
  animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null, cube: null, mesh: null, code: null, aura: null, auraSize: 1,
  auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("a", 300, 300, { colour: { text: INK, bg: "rgb(250, 250, 250)" }, font: { face: "Fredoka", size: 1.2 } }),
    node("b", 700, 300, { colour: { text: INK, bg: "rgb(137, 206, 188)" }, font: { face: "Fredoka", size: 1.2 } }),
    node("c", 300, 600, { colour: { text: RED }, font: { face: "VT323" } }),
    node("d", 700, 600, { colour: { text: INK }, font: { face: "Fredoka" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "MENU", gimmick: "", master: "" }, activePageId: "page_home", frameWidth: 1440,
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.evaluate((d) => window.__studioLoadDoc(d), doc);
await page.waitForTimeout(1200);
const nodesNow = async () => Object.fromEntries((await page.evaluate(() => window.__studioPublishDoc().nodes)).map((n) => [n.id, n]));
const radialEl = page.locator("[data-radial]");
/* A piece is found by its word, or by its name when it wears an icon only (Edit, on the inner band). */
const into = async (...words) => {
  for (const w of words) {
    let el = radialEl.getByText(new RegExp(`^${w}$`)).first();
    if (!(await el.count())) el = radialEl.locator(`[aria-label="${w}"]`).first();
    if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(600); }
  }
};
const chip = (label) => page.locator(`[data-arc-chip][aria-label="${label}"]`).first();
const openOn = async (id, ...words) => {
  const b = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2, { button: "right" });
  await page.waitForTimeout(700);
  await into(...words);
};
const close = async () => {
  for (let i = 0; i < 4 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); }
};

/* Edge: border width, shadow, their colours */
await openOn("c", "Looks", "Edge");
check("Looks → Edge opens the border and shadow editor", (await page.locator('[data-arc-slider="Border width"]').count()) === 1 && (await page.locator('[data-arc-slider="Shadow size"]').count()) === 1
  && (await chip("Hard offset").count()) === 1, `${await page.locator("[data-arc-slider]").count()} sliders`);
if (!process.env.NO_SHOT) await page.screenshot({ path: join(here, "..", ".scratch", "menu-edge.png") });
await page.locator('[data-arc-slider="Border width"]').first().focus();
for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowRight"); await page.waitForTimeout(40); }
await page.waitForTimeout(300);
let n = await nodesNow();
check("the border width slider gives the part a border", (n.c.edge?.width ?? 0) > 0 && n.c.edge.style === "solid", JSON.stringify(n.c.edge));
await chip("Hard offset").evaluate((b) => b.click());
await page.waitForTimeout(300);
n = await nodesNow();
check("Hard offset gives it the cartoon drop shadow", /\dpx \dpx 0px 0px$/.test(n.c.edge?.shadow ?? ""), n.c.edge?.shadow);
await chip("Paint the shadow").evaluate((b) => b.click());
await page.waitForTimeout(200);
await chip("The site's accent").evaluate((b) => b.click());
await page.waitForTimeout(300);
const n2 = await nodesNow();
check("the colour boxes paint the shadow when it is picked, and leave the border", n2.c.edge.shadow !== n.c.edge.shadow && n2.c.edge.colour === n.c.edge.colour, `${n.c.edge.shadow} → ${n2.c.edge.shadow}`);
await chip("Paint the border").evaluate((b) => b.click());
await page.waitForTimeout(200);
await chip("The site's highlight").evaluate((b) => b.click());
await page.waitForTimeout(300);
check("…and the border when that is picked", (await nodesNow()).c.edge.colour === "highlight", (await nodesNow()).c.edge.colour);
await close();

/* The selection: a and b picked, the wheel opened on a changes both, and only what changed */
await page.locator('[data-node-id="a"]').first().click();
await page.keyboard.down("Shift");
await page.locator('[data-node-id="b"]').first().click();
await page.keyboard.up("Shift");
await page.waitForTimeout(300);
const before = await nodesNow();
await openOn("a", "Looks", "Hue");
await chip("Text on this part").evaluate((b) => b.click());
await page.waitForTimeout(200);
await chip("Use the site's accent").evaluate((b) => b.click());
await page.waitForTimeout(400);
n = await nodesNow();
check("with two parts picked, the words of both take the colour", n.a.colour.text === "accent" && n.b.colour.text === "accent", `${n.a.colour.text} / ${n.b.colour.text}`);
check("…and each keeps its own fill", n.a.colour.bg === before.a.colour.bg && n.b.colour.bg === before.b.colour.bg, `${n.a.colour.bg} / ${n.b.colour.bg}`);
check("…and a part not picked is not touched", JSON.stringify(n.d) === JSON.stringify(before.d) && JSON.stringify(n.c) === JSON.stringify(before.c));
await close();
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
check("one undo takes the selection's edit back", JSON.stringify(await nodesNow()) === JSON.stringify(before));

/* All with this colour: a's words, ink → white, across the site */
await page.mouse.click(10, 990);
await page.locator('[data-node-id="a"]').first().click();
await page.waitForTimeout(200);
await openOn("a", "Looks", "Hue");
await chip("Text on this part").evaluate((b) => b.click());
await page.waitForTimeout(200);
await chip("Use the site's highlight").evaluate((b) => b.click());
await page.waitForTimeout(300);
const tray = page.locator('[data-tray-item="same-colour"]');
check("the tray offers All with this colour, lit once the part's colour has moved", (await tray.count()) === 1 && !(await tray.isDisabled()));
await tray.evaluate((b) => b.click());
await page.waitForTimeout(500);
n = await nodesNow();
const hi = await page.evaluate(() => window.__studioPublishDoc().look.palette.highlight);
const want = (v) => v === "highlight" || (hi && C.colourKey(v) === C.colourKey(hi));
check("every part whose words were the same ink now wears the same new colour", want(n.b.colour.text) && want(n.d.colour.text), `${n.b.colour.text} / ${n.d.colour.text}`);
check("…the red words are left red, and the fills are left", n.c.colour.text === RED && n.b.colour.bg === before.b.colour.bg);
await close();

/* All in this font: a from Fredoka to the next family on the readout, across the site */
await openOn("a", "Edit", "Font");
const fam = page.locator('[data-arc-stepper="Family"]').first();
check("Edit → Font has the family", (await fam.count()) === 1);
if (!(await fam.count())) await page.screenshot({ path: join(here, "..", ".scratch", "menu-font-missing.png") });
await page.locator('[aria-label="Next Family"]').first().evaluate((b) => b.click());
await page.waitForTimeout(400);
const aFont = (await nodesNow()).a.font ?? {};
const aKey = C.faceOf({ id: "a", font: aFont, content: "x" });
check("the family readout moves the part out of Fredoka", aKey !== "Fredoka" && !!aKey, JSON.stringify(aFont));
const fontTray = page.locator('[data-tray-item="same-font"]');
check("the tray offers All in this font once the part's face has moved", (await fontTray.count()) === 1 && !(await fontTray.isDisabled()));
await fontTray.evaluate((b) => b.click());
await page.waitForTimeout(500);
n = await nodesNow();
const keyOf = (id) => C.faceOf({ id, font: n[id].font, content: "x" });
check(`every other Fredoka part is now in ${aKey}, and VT323 stayed where it was`, keyOf("b") === aKey && keyOf("d") === aKey && n.c.font.face === "VT323" && n.b.font.size === 1.2,
  `${keyOf("b")} / ${keyOf("d")} / ${n.c.font.face}`);
if (!process.env.NO_SHOT) {
  await page.locator("[data-tray]").first().hover().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(here, "..", ".scratch", "menu-tray.png") });
}
await close();

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
