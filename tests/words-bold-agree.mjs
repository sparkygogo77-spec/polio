/**
 * CTRL+B AND THE BAR'S B AGREE, AND BOTH READ THE WORDS AS TYPED.
 *
 * Highlighting words in place brings a bar with B and I, and Ctrl+B / Ctrl+I
 * do the same from the keys. They used to read the look two ways: the keys
 * called only weight 700 bold (so a 900 run went to 700 by the keys and to
 * plain by the B), and both read the look from the words as stored, at
 * offsets counted in the words as typed, so after typing before the
 * highlight they read the wrong stretch: B lit on plain words, and Ctrl+B
 * turned nothing on. Now both read the typed words and call 600 and up bold.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/words-bold-agree.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/WordsInPlace.tsx, src/features/studio/shelf/parts/spans.ts
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
    node("typed", "prose", [{ text: "Hello " }, { text: "World", weight: 700 }], 60, 80, 520, 60),
    node("keys", "prose", [{ text: "Big " }, { text: "Heavy", weight: 900 }], 60, 200, 520, 60),
    node("bar", "prose", [{ text: "Big " }, { text: "Heavy", weight: 900 }], 60, 320, 520, 60),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Bold", gimmick: "", master: "" },
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

const bold = () => page.getByRole("button", { name: "Bold", exact: true }).getAttribute("aria-pressed");

/* 1. Words typed before the highlight: the bar and Ctrl+B read the words as typed. */
const box = await open("typed");
check("two presses open the words on the board", await box.count() === 1);
await page.evaluate(() => {
  const el = document.querySelector('[data-words-in-place="typed"]');
  const r = document.createRange(); r.setStart(el, 0); r.collapse(true);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r); el.focus();
});
await page.keyboard.type("XXXXXX"); await page.waitForTimeout(150);
check("…the typed words go in before the rest", await highlight("typed", "Hello ") === "ok", await box.innerText());
check("the B is not lit on plain words after typing before them", await bold() === "false", await bold());
await page.keyboard.press("Control+b"); await page.waitForTimeout(250);
check("…and the B lights once Ctrl+B made them bold", await bold() === "true", await bold());
await box.press("Enter"); await page.waitForTimeout(700);
const typed = await stored("typed");
const hello = Array.isArray(typed) ? typed.find((s) => s.text.includes("Hello")) : null;
const xs = Array.isArray(typed) ? typed.find((s) => s.text.includes("XXXXXX")) : null;
check("Ctrl+B after typing makes the highlighted words bold, not the ones before them", plain(typed) === "XXXXXXHello World" && hello?.weight === 700 && xs && !xs.weight, J(typed));

/* 2. A run heavier than 700: the keys and the B both take the weight off. */
const box2 = await open("keys");
check("…a 900 run opens", await box2.count() === 1 && await highlight("keys", "Heavy") === "ok");
check("the B is lit on a 900 run", await bold() === "true", await bold());
await page.keyboard.press("Control+b"); await page.waitForTimeout(250);
await box2.press("Enter"); await page.waitForTimeout(700);
const keys = await stored("keys");
const keysHeavy = typeof keys === "string" ? {} : (keys ?? []).find((s) => s.text.includes("Heavy"));
check("Ctrl+B on a 900 run takes the weight off", plain(keys) === "Big Heavy" && keysHeavy && keysHeavy.weight === undefined, J(keys));

const box3 = await open("bar");
check("…the same run opens in a second part", await box3.count() === 1 && await highlight("bar", "Heavy") === "ok");
await page.getByRole("button", { name: "Bold", exact: true }).click(); await page.waitForTimeout(250);
await box3.press("Enter"); await page.waitForTimeout(700);
const barred = await stored("bar");
check("the bar's B on the same run does the same as Ctrl+B", J(barred) === J(keys), `${J(barred)} vs ${J(keys)}`);

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
