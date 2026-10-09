/**
 * The side panel on a captured site, as the walk-through found it and as it
 * should be. A made-up captured page is put on the board (a yellow comic
 * page, a display face, rounded cards, near-copies of one yellow) and each
 * surface is checked and photographed into .screenshots/:
 *
 *   Element, nothing picked   a page summary leads (parts, pages, links,
 *                             parts needing a decision); the page's prompt
 *                             and its picture route are folded away.
 *   Element, a part picked    the picture settings are under a closed
 *                             "Make a picture"; the prompt says "From
 *                             comic.example, …" with no element path; the
 *                             name is readable; one Delete, not two; words
 *                             in a link are a label, with no measure.
 *   Format                    the page colour, accent, fonts and corners are
 *                             the site's, the stack and the rest that change
 *                             nothing are folded away, and a hint is never
 *                             squeezed to a word per line. Settings > This
 *                             site says the same.
 *   Look                      "On this site" leads; hovering a part's name
 *                             outlines it on the board; Randomize theme is
 *                             one undo step; no role-pair "text 1.2"
 *                             alarm; the role numbers are explained.
 *   Width                     the panel starts at 300px, its edge drags from
 *                             228px to about half the window, is kept in this
 *                             browser, and the tabs always say their names.
 *
 * Parts are picked from the panel's own list of parts, never by a click on
 * the board: how the board selects is another lane's.
 *
 *   npx next start -p 3013
 *   node tests/side-panel.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { SWEEP } from "../src/features/studio/reassemble.ts";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const SHOTS = ".screenshots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const HOST = "comic.example";
const at = (sel) => ({ url: `https://${HOST}/`, host: HOST, selector: sel, at: 1 });
const PATH = "body > main > section:nth-of-type(1) > div";
const YELLOWS = ["rgb(243, 212, 64)", "rgb(242, 226, 129)", "rgb(240, 223, 123)", "rgb(241, 214, 70)", "rgb(244, 216, 72)"];

const nodes = [
  node("n_box_1", "box", "", 0, 0, 1440, 900, { label: "section · 4 inside", colour: { bg: YELLOWS[0] }, radius: 24, from: at("body > main > section:nth-of-type(1)") }),
  node("n_box_2", "prose", "Meet the Crew", 100, 40, 700, 90, { label: "h2 · 0 inside", font: { face: "Bangers", size: 64 }, colour: { text: "rgb(20, 20, 20)" }, from: at("body > main > section:nth-of-type(1) > h2") }),
  node("n_box_3", "box", "", 100, 200, 400, 300, { label: "div · 1 inside", colour: { bg: YELLOWS[1] }, radius: 24, prompt: `Captured from ${HOST}/ as ${PATH}. The box, the words, the colours and the type are the ones measured on the page.`, from: at(PATH) }),
  node("n_box_4", "box", "", 120, 220, 40, 40, { label: "::after · 0 inside", colour: { bg: YELLOWS[2] }, radius: 24, from: at(`${PATH}::after`) }),
  node("n_box_5", "prose", "Buy the comic", 600, 300, 180, 44, { label: "span", font: { face: "Comic Neue", size: 16 }, colour: { text: "rgb(20, 20, 20)", bg: YELLOWS[3] }, radius: 12, link: { kind: "url", url: "https://comic.example/buy" }, from: at("body > main > section:nth-of-type(1) > a > span") }),
  node("n_box_6", "prose", "A weekly strip about a crew of misfits.", 120, 280, 360, 40, { label: "p · 0 inside", font: { face: "Comic Neue", size: 16 }, colour: { text: "rgb(20, 20, 20)" }, from: at(`${PATH} > p`) }),
  node("n_box_7", "box", "", 900, 200, 300, 300, { label: "div · 0 inside", colour: { bg: YELLOWS[4] }, radius: 24, from: at("body > main > section:nth-of-type(1) > div:nth-of-type(2)") }),
];
/* A face on 27 parts, on the second page: labels in links, machine names, the same words twice over. Pressing it lists all 27. */
const PIXEL = Array.from({ length: 27 }, (_, i) => node(`n_px_${i}`, i % 3 ? "prose" : "box", i % 4 ? `Score ${i}` : "Play", 40, 40 + i * 30, 200, 26, {
  pageId: "p1", label: i % 2 ? "span" : "a · 1 inside", font: { face: "Pixel Mono", size: 14 },
  from: at(i % 2 ? `body > main > a:nth-of-type(${i}) > span` : `body > main > div:nth-of-type(${i})`),
}));
nodes.push(...PIXEL);
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }, { id: "p1", name: "Archive", path: "/archive", prompt: "", scroll: "inherit" }],
  nodes, groups: [], shapes: [], format: {}, brief: { name: "COMIC", gimmick: "", master: "" },
  look: { palette: { bg: YELLOWS[0], text: "rgb(20, 20, 20)" }, texture: [], paletteFrom: { bg: { colour: YELLOWS[0], parts: 3 }, text: { colour: "rgb(20, 20, 20)", parts: 3 }, muted: { colour: "rgb(20, 20, 20)", parts: 0, shows: "text" } } },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1992, height: 1100 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); localStorage.removeItem("builder.sidePanelWidth"); /* The Element tab leads with a flat list now; this picks a holding box, which the tree ("Show nesting") lists. */ localStorage.setItem("builder.elementsNesting", "1"); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await context.newPage();
page.on("pageerror", (e) => console.log("  page error:", e.message));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const side = page.locator("[data-side-panel]");
const tab = async (name) => { await side.getByRole("radio", { name }).first().click({ force: true }); await page.waitForTimeout(500); };

/* ------------------------------------------------ width */
const width = async () => Math.round((await side.boundingBox()).width);
check("the panel starts about 300px wide (tests/side-panel-g.mjs)", Math.abs((await width()) - 300) <= 1, `${await width()}px`);
const edge = page.locator("[data-side-edge]");
check("its edge can be taken hold of", (await edge.count()) === 1);
const drag = async (dx) => {
  const b = await edge.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + 300);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + b.width / 2 + (dx * i) / 8, b.y + 300); await page.waitForTimeout(30); }
  await page.mouse.up();
  await page.waitForTimeout(400);
};
await drag(300);
check("dragging the edge widens it", Math.abs((await width()) - 600) <= 4, `${await width()}px`);
await drag(3000);
check("…never past about half the window", (await width()) <= 996 && (await width()) >= 990, `${await width()}px of 1992`);
await drag(-3000);
check("…nor under 228px", Math.abs((await width()) - 228) <= 1, `${await width()}px`);
await drag(252);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
check("the width is kept in this browser", Math.abs((await width()) - 480) <= 4, `${await width()}px after a reload`);
const words = await side.locator("[data-tab-word]").evaluateAll((els) => els.filter((e) => !e.classList.contains("sr-only")).length);
check("every tab says its name", words === 6, `${words} of 6 named`);

/* ------------------------------------------------ Element, nothing picked */
await tab("Element");
check("with nothing picked, a page summary leads", (await side.locator("[data-page-summary]").count()) === 1);
const stat = async (k) => (await side.locator(`[data-summary="${k}"]`).innerText()).replace(/\s+/g, " ");
check("…it counts the parts, the pages and the links", /^7 parts/.test(await stat("parts")) && /^2 pages/.test(await stat("pages")) && /^1 link/.test(await stat("links")), `${await stat("parts")} | ${await stat("pages")} | ${await stat("links")}`);
check("…and the parts still needing a decision", (await side.locator('[data-summary="open"]').count()) === 1, await stat("open"));
const pageFold = side.locator('[data-fold="page-prompt"]');
check("the page's prompt is folded away", (await pageFold.count()) === 1 && !(await pageFold.evaluate((d) => d.open)));
check("…and nothing about a picture route shows", !(await side.innerText()).includes("The route would send"));
await page.screenshot({ path: `${SHOTS}/side-panel-summary.png` });

/* ------------------------------------------------ Element, a part picked */
const pickRow = async (text) => { await side.locator("[data-element-row]", { hasText: text }).first().click(); await page.waitForTimeout(600); };
check("the list of parts names them readably", !(await side.locator("[data-element-row]").allInnerTexts()).some((t) => /inside|n_box|::/.test(t)), (await side.locator("[data-element-row]").allInnerTexts()).join(" | "));
await pickRow("Box “A weekly strip");
check("picked from the list, the header names it readably", (await side.locator("[data-element-name]").innerText()) === "Box “A weekly strip about a crew of misfits.”", await side.locator("[data-element-name]").innerText().catch(() => "none"));
{ const more = side.locator('[data-part-section="more"]:not([data-open]) > [data-section-head]'); if (await more.count()) { await more.first().click(); await new Promise((r) => setTimeout(r, 300)); } } /* Name, prompt, saving and Make a picture sit under More. */
const fold = side.locator('[data-part-section="make-picture"]');
check("the picture settings are under a closed \"Make a picture\"", (await fold.count()) === 1 && (await fold.getAttribute("data-open")) === null && !(await side.locator("[data-audit-panel]").isVisible()));
/* The prompt is a folded section of the part's panel (tests/side-panel-g.mjs): opened to read it. */
await side.locator('[data-part-section="prompt"] [data-section-head]').click();
await page.waitForTimeout(300);
const said = await side.locator("[data-captured-from]").innerText().catch(() => "");
check("the prompt says where the part came from, plainly", said === "From comic.example, the “Meet the Crew” section", said);
const promptValue = await side.getByLabel("Element prompt").inputValue();
check("…and shows no element path", !/body|nth-of-type|>/.test(`${said} ${promptValue}`), promptValue.slice(0, 80));
await side.getByLabel("Element prompt").fill("Tilt it a little.");
await page.waitForTimeout(300);
const kept = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.id === "n_box_3").prompt);
check("…while the document keeps the capture's record whole", kept.startsWith(`Captured from ${"comic.example"}/ as body > main`) && kept.endsWith("Tilt it a little."), kept);
check("one Delete, not two", (await side.getByRole("button", { name: "Delete", exact: true }).count()) === 1, `${await side.getByRole("button", { name: "Delete", exact: true }).count()} Delete buttons`);
await fold.locator("[data-section-head]").click();
await page.waitForTimeout(300);
check("opened, \"Make a picture\" holds the model's options", await side.locator("[data-audit-panel]").isVisible());
/* The model's own prompt field says where the part came from in the same plain words, never the path. */
const modelPrompt = side.locator('[data-audit-panel] [data-model-field="prompt"] textarea').first();
const modelSays = await modelPrompt.inputValue().catch(() => "");
check("the picture prompt says where from in plain words, with no element path", modelSays.startsWith("From comic.example, the “Meet the Crew” section.") && !/body|nth-of-type|Captured from/.test(modelSays), modelSays.slice(0, 90));
await modelPrompt.fill(`${modelSays} Bold outlines.`);
await page.waitForTimeout(300);
const planned = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.id === "n_box_3").plan?.options?.prompt ?? "");
check("…and written, what the model is sent keeps the capture's sentence whole", planned.startsWith("Captured from comic.example/ as body > main") && planned.endsWith("Bold outlines.") && !planned.includes("From comic.example,"), planned.slice(0, 120));
await page.screenshot({ path: `${SHOTS}/side-panel-picture-prompt.png` });
await page.screenshot({ path: `${SHOTS}/side-panel-element.png` });
await fold.locator("[data-section-head]").click();
await side.locator('[data-part-section="prompt"] [data-section-head]').click();

/* A fresh visit has nothing picked: the summary's list is there again. */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await tab("Element");
await pickRow("Buy the comic");
check("words inside a link are a label", /Label on a link/.test(await side.locator("[data-element-kind]").innerText()), await side.locator("[data-element-kind]").innerText());
check("…with no measure and no \"long-form text\"", !(await side.getByLabel("Measure").count()) && !/Long-form/i.test(await side.innerText()));
const wordsHint = await side.getByLabel("Words", { exact: true }).first().locator("xpath=ancestor::label[1]").innerText();
check("…and its Words box says it is a one-line label, not paragraphs", /one line/.test(wordsHint) && !/Paragraphs/.test(wordsHint), wordsHint.replace(/\s+/g, " ").slice(0, 120));
await page.screenshot({ path: `${SHOTS}/side-panel-label.png` });

/* ------------------------------------------------ Format */
/* Format is This site, Whole-site features and a folded brief (tests/side-panel-g.mjs). */
await tab("Format");
const reads = async (id) => (await side.locator(`[data-site-row="${id}"] [data-site-reads]`).innerText().catch(() => "")).trim();
check("the page's colour is the site's: light yellow, not dark", (await reads("page-colour")) === "light yellow", await reads("page-colour"));
check("the heading font is the site's face", (await reads("type.headingFamily")) === "Bangers", await reads("type.headingFamily"));
check("the corner radius is the site's", (await reads("layout.radius")) === "24px", await reads("layout.radius"));
check("the accent is the site's yellow, not violet", /yellow/.test(await reads("accent")), await reads("accent"));
check("the stack is folded away with the brief, and the fold says it changes nothing here", (await side.locator('[data-format-field="build.stack"]').count()) === 0 && /changes the captured page/.test(await side.locator("[data-brief-fold]").innerText()));
await side.locator("[data-brief-fold]").click();
await page.waitForTimeout(300);
const row = (id) => side.locator(`[data-format-field="${id}"]`);
await side.getByLabel("Search format options").fill("line length");
await page.waitForTimeout(300);
const hint = await row("type.measure").evaluate((li) => Math.round(li.firstElementChild.getBoundingClientRect().width));
check("a hint keeps a readable width, never a word per line", hint >= 140, `${hint}px wide`);
await side.getByLabel("Search format options").fill("");
await page.waitForTimeout(200);
await drag(-3000);
await side.getByLabel("Search format options").fill("routing");
await page.waitForTimeout(300);
const narrowHint = await row("pages.routing").evaluate((li) => Math.round(li.firstElementChild.getBoundingClientRect().width));
check("…even at 228px, where the control goes under the words", narrowHint >= 140, `${narrowHint}px wide at 228px`);
await page.screenshot({ path: `${SHOTS}/side-panel-format-narrow.png` });
await side.getByLabel("Search format options").fill("");
await drag(252);
await page.screenshot({ path: `${SHOTS}/side-panel-format.png` });

/* Settings > This site says the same. */
await page.getByRole("button", { name: "Settings", exact: true }).first().click();
await page.waitForTimeout(700);
const setting = (id) => page.locator(`[data-setting="${id}"] [data-setting-reads]`);
check("Settings > This site: the corner radius is the site's", ((await setting("site.layout.radius").innerText().catch(() => "")).trim()) === "24px", await setting("site.layout.radius").innerText().catch(() => "not there"));
check("…and so is the heading font", ((await setting("site.type.headingFamily").innerText().catch(() => "")).trim()) === "Bangers");
await page.screenshot({ path: `${SHOTS}/side-panel-settings.png` });
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Settings", exact: true }).first().click({ trial: false }).catch(() => {});
await page.waitForTimeout(300);
if (await page.locator('[data-setting="site.layout.radius"]').isVisible().catch(() => false)) { await page.getByRole("button", { name: "Settings", exact: true }).first().click(); await page.waitForTimeout(300); }

/* ------------------------------------------------ Look */
await tab("Look");
const first = await side.locator("[data-look-panel] > section").first().getAttribute("data-site-colours");
check("on a captured site, Look leads with \"On this site\"", first === "", String(first));
/* Colours shows only the theme: no "More colours" fold, no unmerged list; the six for new parts stand open (J, 2026-10-09). */
check("Colours has no More colours fold and no colour-by-use list", (await side.locator("[data-role-more], [data-site-group]").count()) === 0);
check("…and the colours for new parts are shown", (await side.locator("[data-for-new-parts]").count()) === 1);
check("no role-pair \"text 1.2\" alarm on a captured site", !/\btext \d+\.\d\b/.test(await side.locator("[data-look-colour]").innerText()));
check("the numbers under the roles are explained", (await side.locator("[data-role-legend]").count()) === 1 && (await side.locator('[data-role-source="muted"]').innerText()) === "not used");
/* The "Words: N are hard to read" line is gone from Look (owner: it flagged harmless parts and fixed nothing). */
check("Look has no hard-to-read words line", (await side.locator("[data-words-readable]").count()) === 0, `${await side.locator("[data-words-readable]").count()} lines`);

await side.locator('[data-site-font="Pixel Mono"]').click();
await page.waitForTimeout(300);
const listed = await side.locator("[data-site-font-detail] [data-site-part]").evaluateAll((els) => els.map((e) => e.getAttribute("data-site-part")));
check("pressing a face lists every part set in it, labels in links and repeated words among them", listed.length === 27 && new Set(listed).size === 27, `${listed.length} of 27`);
await side.locator('[data-site-font="Pixel Mono"]').click();
await page.waitForTimeout(200);

const fills = side.locator("[data-role-palette]");
await fills.locator("[data-role-swatch]").first().scrollIntoViewIfNeeded();
await fills.locator("[data-role-swatch]").first().click();
await page.waitForTimeout(400);
const partRow = side.locator("[data-site-part]:not([data-site-part=\"@page\"])").first();
check("a colour's part list names parts readably", !(await side.locator("[data-site-part]").allInnerTexts()).some((t) => /inside|n_box|::/.test(t)), (await side.locator("[data-site-part]").allInnerTexts()).join(" | "));
await partRow.hover();
await page.waitForTimeout(300);
const mark = page.locator("[data-point-mark]");
const partId = await partRow.getAttribute("data-site-part");
check("hovering a part's name outlines it on the board", (await mark.count()) === 1 && (await mark.getAttribute("data-point-mark")) === partId);
await page.screenshot({ path: `${SHOTS}/side-panel-look-hover.png` });
await page.mouse.move(1500, 1050);
await page.waitForTimeout(300);
/* An open theme swatch keeps its own parts outlined (`RoleDetail`); the hover's single outline gives way to them. */
check("…and the hover outline gives way when the hand leaves", (await mark.count()) !== 1, `${await mark.count()} outlined`);
const selectedBefore = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.selection ?? null);
void selectedBefore;

/* Randomize theme: a new palette in one step, one undo takes it back. */
const nodes0 = await page.evaluate(() => JSON.stringify(window.__studioPublishDoc().nodes));
check("Colours leads with a preview frame of the site's own surfaces (tests/theme-kinds.mjs holds what is in it)", (await side.locator("[data-theme-preview] [data-preview-part=\"heading\"]").count()) === 1);
const look0 = await side.locator("[data-theme-preview]").evaluate((el) => [...el.querySelectorAll("*")].map((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).color).join("|") + getComputedStyle(el).backgroundColor);
const depth0 = await page.evaluate(() => window.__studioUndoDepth());
await side.locator("[data-randomize-theme] button").first().click();
await page.waitForTimeout(600);
const look1 = await side.locator("[data-theme-preview]").evaluate((el) => [...el.querySelectorAll("*")].map((e) => getComputedStyle(e).backgroundColor + getComputedStyle(e).color).join("|") + getComputedStyle(el).backgroundColor);
check("…and Randomize theme repaints the preview", look1 !== look0);
await side.locator("[data-theme-preview]").screenshot({ path: `${SHOTS}/theme-preview-rolled.png` });
const depth1 = await page.evaluate(() => window.__studioUndoDepth());
check("Randomize theme recolours the parts", /New theme on \d+ parts?/.test(await side.locator("[data-theme-rolled]").innerText()) && (await page.evaluate(() => JSON.stringify(window.__studioPublishDoc().nodes))) !== nodes0, await side.locator("[data-theme-rolled]").innerText());
check("…in one undo step", depth1 - depth0 === 1, `${depth1 - depth0} steps`);
await page.screenshot({ path: `${SHOTS}/side-panel-randomized.png` });
await side.locator("[data-theme-rolled] button").click();
await page.waitForTimeout(400);
check("…which one undo takes back whole", (await page.evaluate(() => JSON.stringify(window.__studioPublishDoc().nodes))) === nodes0);
await page.screenshot({ path: `${SHOTS}/side-panel-look.png` });

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
