/**
 * HIGHLIGHT WORDS INSIDE A SENTENCE AND CHANGE ONLY THOSE: FONT, SIZE,
 * COLOUR, BOLD, ITALIC — LIKE A DOCUMENT, NOT LIKE BOXES.
 *
 * J's ask (2026-10-11): sunkcoin.fun's title "The coin that pays / your sunk
 * cost." has its second line in the same serif slanted and orange, and the
 * builder had it as two text boxes laid over each other. It should work
 * like any document: highlight the text within a sentence and change just
 * that text into a different font, so it does not have to be different
 * boxes. So the words open on the board as their runs, highlighting some
 * brings a bar over them (Font, px, colour, B, I, Plain), and each sets
 * that look on the highlighted stretch only: one part, runs inside it,
 * drawn the same on the board and the live page.
 *
 *   npx next start -p 3013
 *   node tests/words-styled.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();
import { existsSync } from "node:fs";

const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("title", "prose", "The coin that pays your sunk cost.", 60, 80, 520, 60),
    node("pay", "prose", "When the chart dips the pot buys the dip and hands it out.", 60, 200, 520, 60),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Sunk", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const stored = (id) => page.evaluate((id) => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).find((n) => n.id === id)?.content, id);
const plain = (c) => (typeof c === "string" ? c : (c ?? []).map((s) => s.text).join(""));

/** The words of a part opened on the board, and a stretch of them highlighted by what it says. */
async function open(id) {
  const part = page.locator(`[data-node-id="${id}"]`).first();
  await part.scrollIntoViewIfNeeded();
  /* One press picks it; a clear pause, then two presses open its words (a press within 400 ms of the first would itself be the second). */
  await part.click(); await page.waitForTimeout(600);
  await part.dblclick(); await page.waitForTimeout(600);
  return page.locator(`[data-words-in-place="${id}"]`);
}
async function highlight(id, words) {
  const ok = await page.evaluate(({ id, words }) => {
    const el = document.querySelector(`[data-words-in-place="${id}"]`);
    if (!el) return "no box";
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let at = 0; const nodes = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push({ n, at }); at += n.textContent.length; }
    const text = nodes.map((x) => x.n.textContent).join("");
    const i = text.indexOf(words);
    if (i < 0) return `not in ${JSON.stringify(text)}`;
    const point = (want) => { for (const { n, at } of nodes) if (want <= at + n.textContent.length) return [n, want - at]; return [el, el.childNodes.length]; };
    const r = document.createRange();
    const [sn, so] = point(i), [en, eo] = point(i + words.length);
    r.setStart(sn, so); r.setEnd(en, eo);
    const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
    el.focus();
    return "ok";
  }, { id, words });
  await page.waitForTimeout(250);
  return ok;
}

/* ------------------------------------------------------------------ */
/* 1. The title: its second half slanted, in another face, bigger      */
/* ------------------------------------------------------------------ */

const box = await open("title");
check("two presses open the words on the board", await box.count() === 1);
check("highlighting words inside the sentence brings the bar over them", await highlight("title", "your sunk cost.") === "ok" && await page.locator('[data-words-bar="title"]').count() === 1, await page.locator('[data-words-bar="title"]').count());
await page.getByRole("button", { name: "Italic" }).click(); await page.waitForTimeout(250);
const faceSelect = page.getByLabel("Font of the highlighted words");
const faceOptions = await faceSelect.evaluate((s) => [...s.options].map((o) => o.value));
check("the bar offers the app's families (serif, monospace, …) beside the site's faces", faceOptions.includes("serif") && faceOptions.includes("monospace") && faceOptions[0] === "", faceOptions.join(", "));
await faceSelect.selectOption("serif"); await page.waitForTimeout(250);
await page.getByLabel("Size of the highlighted words in pixels").fill("40"); await page.waitForTimeout(250);
await page.getByLabel("Size of the highlighted words in pixels").press("Enter"); await page.waitForTimeout(250);
/* The box still holds the whole sentence as one piece, the runs inside it. */
const inBox = await page.evaluate(() => { const el = document.querySelector('[data-words-in-place="title"]'); return { text: el?.innerText, runs: [...(el?.querySelectorAll("[data-run]") ?? [])].map((s) => ({ text: s.textContent, style: s.getAttribute("style") })) }; });
check("…the words stay one piece while they are styled", inBox.text === "The coin that pays your sunk cost.", J(inBox.text));
check("…and the highlighted stretch alone wears the look in the box", inBox.runs.length === 1 && inBox.runs[0].text === "your sunk cost." && /italic/.test(inBox.runs[0].style) && /40px/.test(inBox.runs[0].style), J(inBox.runs));
await box.press("Enter"); await page.waitForTimeout(700);
const title = await stored("title");
check("the part keeps ONE sentence, the rest of it plain", Array.isArray(title) && plain(title) === "The coin that pays your sunk cost." && Object.keys(title[0]).length === 1 && title[0].text === "The coin that pays ", J(title));
const cost = Array.isArray(title) ? title.find((s) => s.text === "your sunk cost.") : null;
check("…and the highlighted words carry italic, the face and the size", cost?.italic === true && cost?.face === "serif" && cost?.size === 40, J(cost));
const drawn = await page.evaluate(() => {
  const el = document.querySelector('[data-node-id="title"] [data-part]');
  const spans = [...(el?.querySelectorAll("span") ?? [])].map((s) => ({ text: s.textContent, style: getComputedStyle(s).fontStyle, px: getComputedStyle(s).fontSize, face: getComputedStyle(s).fontFamily }));
  return { text: (el?.innerText ?? "").replace(/\s+/g, " ").trim(), spans, blocks: [...(el?.querySelectorAll("span") ?? [])].filter((c) => getComputedStyle(c).display === "block").length };
});
const slant = drawn.spans.find((s) => s.text === "your sunk cost.");
check("the board draws the sentence as one part with the slanted run inside it", drawn.text === "The coin that pays your sunk cost." && slant?.style === "italic" && slant?.px === "40px" && /Georgia/.test(slant?.face ?? ""), J(drawn));
check("…no run a block, so the browser sets the line", drawn.blocks === 0, `${drawn.blocks} blocks`);

/* ------------------------------------------------------------------ */
/* 2. Bold by the keys, a colour by the bar, and Plain takes it back   */
/* ------------------------------------------------------------------ */

const box2 = await open("pay");
check("the second part opens too", await box2.count() === 1);
check("…its words highlighted in the middle", await highlight("pay", "buys the dip") === "ok");
await page.keyboard.press("Control+b"); await page.waitForTimeout(250);
const colourInput = page.getByLabel("Colour of the highlighted words");
await colourInput.evaluate((i) => { i.value = "#ffb070"; i.dispatchEvent(new Event("input", { bubbles: true })); }); await page.waitForTimeout(250);
await box2.press("Enter"); await page.waitForTimeout(700);
const pay = await stored("pay");
const dip = Array.isArray(pay) ? pay.find((s) => s.text === "buys the dip") : null;
check("Ctrl+B makes the highlighted words bold, the bar gives them a colour", dip?.weight === 700 && dip?.colour === "#ffb070" && plain(pay) === "When the chart dips the pot buys the dip and hands it out.", J(pay));
check("…and the runs either side carry nothing of their own", Array.isArray(pay) && pay.length === 3 && Object.keys(pay[0]).length === 1 && Object.keys(pay[2]).length === 1, J(pay));

/* Typing inside the styled words keeps their look (`reword`): the run grows, it does not split. */
const box3 = await open("pay");
check("…opened again, the words come back as their runs", await page.evaluate(() => document.querySelectorAll('[data-words-in-place="pay"] [data-run]').length) === 1);
await highlight("pay", "the dip");
await page.keyboard.type("the DIP"); await page.waitForTimeout(100);
await box3.press("Enter"); await page.waitForTimeout(700);
const pay2 = await stored("pay");
check("typing over part of a styled run keeps its look", Array.isArray(pay2) && pay2.find((s) => s.text === "buys the DIP")?.weight === 700, J(pay2));

const box4 = await open("pay");
await highlight("pay", "buys the DIP");
await page.getByRole("button", { name: "Plain: the part's own look" }).click(); await page.waitForTimeout(250);
await box4.press("Enter"); await page.waitForTimeout(700);
const pay3 = await stored("pay");
check("Plain takes every look back, and the words are a plain sentence again", pay3 === "When the chart dips the pot buys the DIP and hands it out.", J(pay3));

/* ------------------------------------------------------------------ */
/* 3. The live page draws what was set                                 */
/* ------------------------------------------------------------------ */

/* The board as it stands now, opened as the live page in a fresh window (the first window's opening script would put the plain sentence back). */
const now = await page.evaluate(() => localStorage.getItem("builder.studio"));
const context2 = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context2.addInitScript((d) => localStorage.setItem("builder.studio", d), now);
const live2 = await context2.newPage();
live2.on("pageerror", (e) => errors.push(e.message));
await live2.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await live2.goto(`${URL_}/builder/preview/`, { waitUntil: "networkidle" });
await live2.waitForTimeout(1500);
const live = await live2.evaluate(() => {
  const el = document.querySelector('[data-live-node="title"]');
  const spans = [...(el?.querySelectorAll("span") ?? [])].map((s) => ({ text: s.textContent, style: getComputedStyle(s).fontStyle, px: getComputedStyle(s).fontSize }));
  return { text: (el?.innerText ?? "").replace(/\s+/g, " ").trim(), spans };
});
const liveSlant = live.spans.find((s) => s.text === "your sunk cost.");
check("the live page draws the same sentence with the same run inside it", live.text === "The coin that pays your sunk cost." && liveSlant?.style === "italic" && liveSlant?.px === "40px", J(live));

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
