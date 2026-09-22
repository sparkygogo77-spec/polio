/**
 * A button in the Builder is pressable in the Builder.
 *
 * HIS WORDS: a button should be pressable here and take him to the page it
 * links to, and he should be able to press a button and assign it a page.
 * His captured sidebar carries nine pages he could only reach from the tab
 * bar, which is what makes a correct import feel dead.
 *
 * THE SAME GESTURE AS OPENING A SOLID, deliberately. One press selects and
 * moves, like every part on the board; two say "I mean this one". A cube
 * opens for handling, a part that points somewhere goes there. He is one
 * person learning one tool, and a second way to press things would cost him
 * more than it buys.
 *
 * Why his entries did nothing is measured here too rather than assumed:
 * `box` is registered with neither `linkable` nor `linkWhole`, so a link on
 * one is inert on every surface. A `cta-primary` carrying the same link
 * navigates. That is the reclassification, held as a fact so it cannot
 * quietly stop being true.
 *
 *   npx next start -p 3013
 *   node tests/press-in-builder.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
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

const TO = { kind: "page", target: "p1" };
const doc = JSON.stringify({ state: {
  pages: [
    { id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" },
    { id: "p1", name: "Docs", path: "/docs", prompt: "", scroll: "inherit" },
  ],
  nodes: [
    /* His sidebar entry, once Fable reclassifies it from a box. */
    node("entry", "cta-primary", "Portfolio", 80, 120, 240, 44, { link: TO }),
    /* The same words as a box, which is how they arrive today. */
    node("as-box", "box", "Portfolio", 80, 220, 240, 44, { link: TO }),
    /* A button pointing nowhere: two presses must still leave it alone. */
    node("nowhere", "cta-primary", "Nothing", 80, 320, 240, 44),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const saved = async () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {});
const where = async () => (await saved()).activePageId ?? "?";
const at = async (id) => { const s = await saved(); const n = (s.nodes ?? []).find((x) => x.id === id); return n ? `${n.x},${n.y}` : "?"; };
const boxOf = async (id) => page.locator(`[data-node-id="${id}"]`).first().boundingBox();
/* Back to Home between sections. Written into the saved document and
   reloaded rather than hunted for in the chrome: which control switches
   pages is not what this suite is about, and a helper that quietly fails to
   find one would make every check after it meaningless. */
const home = async () => {
  await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("builder.studio") || "{}");
    if (raw?.state) { raw.state.activePageId = "p0"; localStorage.setItem("builder.studio", JSON.stringify(raw)); }
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
};

check("the board opens on Home", (await where()) === "p0", await where());

/* ------------------------------------------------------------------ */
/* 1. One press is still one press                                     */
/* ------------------------------------------------------------------ */

let b = await boxOf("entry");
await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(600);
check("one press selects it and goes nowhere", (await where()) === "p0", await where());
/* Selection is transient and never saved, so it is read where a person
   reads it: the Element tab names the part in hand. */
const elementTab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
if (await elementTab.count()) await elementTab.click().catch(() => {});
await page.waitForTimeout(500);
const reads = async () => (await page.locator("[data-side-panel]").first().innerText().catch(() => ""));
const onEntry = await reads();
/* Differential, so it cannot pass on a panel that happens to contain the
   word: pressing the other part must swap which one is named. */
const other = await boxOf("nowhere");
await page.mouse.click(other.x + other.width / 2, other.y + other.height / 2);
await page.waitForTimeout(600);
const onNowhere = await reads();
check("…and it is the part in hand, and only that one",
  /entry/i.test(onEntry) && !/nowhere/i.test(onEntry) && /nowhere/i.test(onNowhere) && !/\bentry\b/i.test(onNowhere),
  `pressing entry named ${/entry/i.test(onEntry) ? "entry" : "nothing"}, pressing nowhere named ${/nowhere/i.test(onNowhere) ? "nowhere" : "nothing"}`);
/* Back to the one the rest of this section is about. */
{ const again = await boxOf("entry"); await page.mouse.click(again.x + again.width / 2, again.y + again.height / 2); await page.waitForTimeout(500); }

/* …and it still drags, which is the gesture two presses must not have taken. */
const wasAt = await at("entry");
b = await boxOf("entry");
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(b.x + b.width / 2 + i * 9, b.y + b.height / 2 + i * 5); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(700);
check("…and a selected button still drags, rather than pressing itself", (await at("entry")) !== wasAt, `${wasAt} → ${await at("entry")}`);
check("…and dragging it went nowhere either", (await where()) === "p0", await where());

/* ------------------------------------------------------------------ */
/* 2. Two presses follow the link                                      */
/* ------------------------------------------------------------------ */

b = await boxOf("entry");
await page.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
await page.waitForTimeout(900);
check("two presses take him to the page it links to", (await where()) === "p1", `p0 → ${await where()}`);

await home();
check("back on Home for the rest", (await where()) === "p0", await where());

const nowhereBox = await boxOf("nowhere");
if (nowhereBox) {
  const before = await at("nowhere");
  await page.mouse.dblclick(nowhereBox.x + nowhereBox.width / 2, nowhereBox.y + nowhereBox.height / 2);
  await page.waitForTimeout(800);
  check("a button pointing nowhere is not taken anywhere by two presses", (await where()) === "p0", await where());
  check("…and is not disturbed by them either", (await at("nowhere")) === before, `${before} → ${await at("nowhere")}`);
}

/* ------------------------------------------------------------------ */
/* 3. Why his entries did nothing, held as a fact                      */
/* ------------------------------------------------------------------ */

await home();
const boxEl = await boxOf("as-box");
if (boxEl) {
  await page.mouse.dblclick(boxEl.x + boxEl.width / 2, boxEl.y + boxEl.height / 2);
  await page.waitForTimeout(800);
  check("a box carrying the same link goes nowhere, which is why his sidebar was dead", (await where()) === "p0", await where());
}
await home();

/* ------------------------------------------------------------------ */
/* 4. …and in the live preview, the same two facts                     */
/* ------------------------------------------------------------------ */

await page.goto(`${URL_}/builder/preview/`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const livePage = async () => page.evaluate(() => document.querySelector("[data-live-page]")?.getAttribute("data-live-page") ?? "");
const start = await livePage();
const bb = await page.locator('[data-live-node="as-box"]').first().boundingBox();
if (bb) { await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await page.waitForTimeout(1000); }
check("live, the box goes nowhere too: it is not linkable at all", (await livePage()) === start, `${start} → ${await livePage()}`);
const eb = await page.locator('[data-live-node="entry"] button').first().boundingBox();
if (eb) { await page.mouse.click(eb.x + eb.width / 2, eb.y + eb.height / 2); await page.waitForTimeout(1000); }
check("live, the reclassified button goes where it points", (await livePage()) === "p1", `${start} → ${await livePage()}`);

/* ------------------------------------------------------------------ */
/* 5. And a page can be assigned to one                                */
/* ------------------------------------------------------------------ */

await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const nb = await boxOf("nowhere");
await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
await page.waitForTimeout(600);
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(500);
const linkMark = page.locator('[data-mark="link"], button#link, [id="link"]').first();
if (await linkMark.count()) { await linkMark.click().catch(() => {}); await page.waitForTimeout(500); }
const field = page.locator("[data-link-field]");
check("a button offers somewhere to point it", (await field.count()) === 1, `${await field.count()} link fields`);
/* A Radix select, so it is opened and read the way a person does rather
   than through `<option>`s that do not exist. */
let offered = [];
if ((await field.count()) === 1) {
  await field.getByRole("combobox").first().click().catch(() => {});
  await page.waitForTimeout(450);
  offered = await page.getByRole("option").allTextContents().catch(() => []);
}
check("…and every page of the site is on offer", offered.some((t) => /Docs/i.test(t)), offered.join(" | ") || "no options");
if ((await field.count()) === 1) {
  await page.getByRole("option", { name: /Docs/i }).first().click().catch(() => {});
  await page.waitForTimeout(700);
  const now = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio") || "{}")?.state ?? {}; const n = (s.nodes ?? []).find((x) => x.id === "nowhere"); return n?.link ? `${n.link.kind}:${n.link.target}` : "none"; });
  check("…and choosing one assigns it", now === "page:p1", now);
  const after = await boxOf("nowhere");
  await page.mouse.dblclick(after.x + after.width / 2, after.y + after.height / 2);
  await page.waitForTimeout(900);
  check("…and the button he just pointed goes there on two presses", (await where()) === "p1", await where());
}

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
