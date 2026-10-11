/**
 * ESCAPE PUTS THE WORDS BACK, EVEN AFTER THE BAR WAS USED.
 *
 * Words edited in place say "Escape puts the words back as they were". But
 * the bar over highlighted words (Font, size, colour, B, I, Plain) and
 * Ctrl+B/I write their look into the part as they go, together with what
 * was typed so far, and Escape only closed the box: the heading kept the
 * new font and the half-typed words, on the board, in Preview and in the
 * next Publish. Now Escape takes all of it back, and the part stays picked.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/words-escape.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/WordsInPlace.tsx
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

const TITLE = "The coin that pays your sunk cost.";
const PAY = "When the chart dips the pot buys the dip and hands it out.";
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("title", "prose", TITLE, 60, 80, 520, 60),
    node("pay", "prose", PAY, 60, 200, 520, 60),
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
const picked = () => page.evaluate(() => [...document.querySelectorAll("[data-node-id][data-picked]")].map((e) => e.getAttribute("data-node-id")));
const slanted = (id) => page.evaluate((id) => [...document.querySelectorAll(`[data-node-id="${id}"] [data-part] span`)].filter((s) => getComputedStyle(s).fontStyle === "italic").map((s) => s.textContent), id);

/** The words of a part opened on the board (as tests/words-styled.mjs). */
async function open(id) {
  const part = page.locator(`[data-node-id="${id}"]`).first();
  await part.scrollIntoViewIfNeeded();
  await part.click(); await page.waitForTimeout(600);
  await part.dblclick(); await page.waitForTimeout(600);
  return page.locator(`[data-words-in-place="${id}"]`);
}
/** A stretch of the open words highlighted by what it says. */
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

/* 1. Italic and a font from the bar, then Escape: the title is as it was. */
const box = await open("title");
check("two presses open the words on the board", await box.count() === 1);
check("…a stretch highlighted", await highlight("title", "your sunk cost.") === "ok");
await page.getByRole("button", { name: "Italic" }).click(); await page.waitForTimeout(250);
await page.getByLabel("Font of the highlighted words").selectOption("serif"); await page.waitForTimeout(250);
await box.focus(); await box.press("Escape"); await page.waitForTimeout(700);
check("Escape closes the box", await box.count() === 0);
check("…and the title's words are back exactly as they were", await stored("title") === TITLE, J(await stored("title")));
check("…the board draws nothing slanted in it", (await slanted("title")).length === 0, J(await slanted("title")));
check("…and the title is still picked", (await picked()).includes("title"), J(await picked()));

/* 2. Words typed before the bar was used go back too. */
const box2 = await open("title");
await highlight("title", "pays");
await page.keyboard.type("X"); await page.waitForTimeout(100);
await highlight("title", "your");
await page.getByRole("button", { name: "Italic" }).click(); await page.waitForTimeout(250);
await box2.focus(); await box2.press("Escape"); await page.waitForTimeout(700);
check("typing, then the bar, then Escape leaves the words as they were", await stored("title") === TITLE, J(await stored("title")));

/* 3. Ctrl+B, then Escape. */
const box3 = await open("pay");
await highlight("pay", "buys the dip");
await page.keyboard.press("Control+b"); await page.waitForTimeout(250);
await box3.press("Escape"); await page.waitForTimeout(700);
check("Ctrl+B, then Escape, leaves the words plain", await stored("pay") === PAY, J(await stored("pay")));

/* 4. The control: typing alone, then Escape, as before. */
const box4 = await open("pay");
await highlight("pay", "the dip");
await page.keyboard.type("nothing"); await page.waitForTimeout(100);
await box4.press("Escape"); await page.waitForTimeout(700);
check("typing alone, then Escape, still leaves the words as they were", await stored("pay") === PAY, J(await stored("pay")));

/* 5. Enter still keeps what the bar set. */
const box5 = await open("title");
await highlight("title", "your sunk cost.");
await page.getByRole("button", { name: "Italic" }).click(); await page.waitForTimeout(250);
await box5.focus(); await box5.press("Enter"); await page.waitForTimeout(700);
const kept = await stored("title");
check("Enter after the bar still keeps the look", Array.isArray(kept) && kept.find((s) => s.text === "your sunk cost.")?.italic === true, J(kept));

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
