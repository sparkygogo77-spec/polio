#!/usr/bin/env node
/**
 * THE LAB TAB: five experiments on a page, each one press and one undo.
 *
 * J (2026-10-10) asked for new test features behind one temporary side
 * panel option. Held here, in the real Builder, on a page of six boxes laid
 * with one uneven gap, one part a little off its column and a two-column
 * row:
 *
 *   · the side panel has a sixth tab, Lab, and it opens on five cards;
 *   · Rhythm names the usual gap and the gap that breaks it; Even out makes
 *     every gap that size, as one undo, and undo puts it back;
 *   · Density spreads the page by the slider's factor, sizes untouched;
 *   · Mirror flips every part inside the frame, twice is where it started;
 *   · Columns names the left edges the page uses and snaps the stray part;
 *   · Reading order lists the parts top-down then left-right and marks the
 *     one drawn out of that order; pressing a row selects the part;
 *   · the Preview draws the parts where the Lab moved them.
 *
 * The rules are also loaded straight from lab/index.ts, with no browser.
 *
 *   node --experimental-strip-types tests/lab-tab.mjs [url]
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { columnsOf, evenOut, mirror, outOfOrder, readingOrder, rhythmOf, scaleRhythm, snapToColumns } from "../src/features/studio/lab/index.ts";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ the rules, with no browser */
const boxes = [
  { id: "a", x: 100, y: 100, w: 600, h: 100 },
  { id: "b", x: 100, y: 240, w: 600, h: 100 },   // 40 below a
  { id: "c", x: 100, y: 380, w: 280, h: 100 },   // 40 below b, left column
  { id: "d", x: 420, y: 380, w: 280, h: 100 },   // same row as c
  { id: "e", x: 100, y: 600, w: 600, h: 100 },   // 120 below c/d: the odd gap
  { id: "f", x: 112, y: 740, w: 600, h: 100 },   // 40 below e, 12 off the column
];
const r = rhythmOf(boxes);
check("rhythm: the usual gap is 40 and one gap breaks it", r.usual === 40 && r.off.length === 1 && r.off[0].below === "e" && r.off[0].gap === 120, JSON.stringify(r.off));
const evened = evenOut(boxes, 40);
check("even out: e and f move up by 80, the rest stay", evened.length === 2 && evened.find((m) => m.id === "e")?.y === 520 && evened.find((m) => m.id === "f")?.y === 660, JSON.stringify(evened));
const spread = scaleRhythm(boxes, 1.5);
check("density 150%: b moves to 260, the row keeps its row, e to 560", spread.find((m) => m.id === "b")?.y === 260 && spread.find((m) => m.id === "c")?.y === spread.find((m) => m.id === "d")?.y && spread.find((m) => m.id === "e")?.y === 420 + 100 + 180, JSON.stringify(spread));
const flipped = mirror(boxes, 1440);
check("mirror: a goes to 740, c to 1060 and d to 740", flipped.find((m) => m.id === "a")?.x === 740 && flipped.find((m) => m.id === "c")?.x === 1060 && flipped.find((m) => m.id === "d")?.x === 740, JSON.stringify(flipped));
const cols = columnsOf(boxes);
check("columns: 100 is the page's one column; 112 and 420 stand alone", cols.length === 1 && cols[0] === 100, JSON.stringify(cols));
const snapped = snapToColumns(boxes, [100, 420]);
check("snap: only f moves, onto 100", snapped.length === 1 && snapped[0].id === "f" && snapped[0].x === 100, JSON.stringify(snapped));
const order = readingOrder(boxes);
check("reading order: top down, c before d on the shared row", order.join("") === "abcdef", order.join(","));
check("out of order: a part drawn before the one above it is named", outOfOrder(["a", "b", "d", "c", "e", "f"], order).join() === "c" && outOfOrder(order, order).length === 0);

/* ------------------------------------------------------------ in the Builder */
const node = (id, label, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId: "box", label, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (rt) => rt.fulfill({ status: 404, body: "" }));
await page.route("**/api/studio/**", (rt) => rt.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
const doc = {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  /* d is drawn before c: the one part out of reading order. */
  nodes: [
    node("a", "Title", 100, 100, 600, 100), node("b", "Line", 100, 240, 600, 100),
    node("d", "Right card", 420, 380, 280, 100), node("c", "Left card", 100, 380, 280, 100),
    node("e", "Story", 100, 600, 600, 100), node("f", "Footer", 112, 740, 600, 100),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "LAB", gimmick: "", master: "" }, motion: [],
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
};
await page.evaluate((d) => { localStorage.clear(); localStorage.setItem("builder.studio", JSON.stringify({ state: d, version: 0 })); }, doc);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const nodeOf = async (id) => (await saved()).nodes?.find((n) => n.id === id);
const depth = () => page.evaluate(() => window.__studioUndoDepth?.() ?? -1);
const wait = (ms) => page.waitForTimeout(ms);
const undo = async () => { await page.keyboard.press("Control+z"); await wait(400); };

const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Lab" });
check("the side panel has a Lab tab", (await tab.count()) === 1);
await tab.first().click();
await wait(500);
const panel = page.locator("[data-lab-panel]");
check("…and it opens on five cards", (await panel.locator("[data-lab-card]").count()) === 5, `${await panel.locator("[data-lab-card]").count()}`);

/* Rhythm */
const rhythmSays = await panel.locator('[data-lab-card="rhythm"] [data-lab-says]').innerText();
check("Rhythm names the usual gap and the one that breaks it", /40px/.test(rhythmSays) && /1 gap breaks/.test(rhythmSays), rhythmSays);
let d0 = await depth();
await panel.locator("[data-lab-even]").click();
await wait(400);
check("Even out moves the story and the footer up", (await nodeOf("e"))?.y === 520 && (await nodeOf("f"))?.y === 660, `${(await nodeOf("e"))?.y}, ${(await nodeOf("f"))?.y}`);
check("…as one undo step", (await depth()) === d0 + 1, `${d0} → ${await depth()}`);
check("…and the card now says the page keeps its rhythm", /keeps its rhythm/.test(await panel.locator('[data-lab-card="rhythm"] [data-lab-says]').innerText()));
await undo();
check("undo puts the gap back", (await nodeOf("e"))?.y === 600);

/* Density: the hand takes the slider to its far end (150%) and lets go there: one change, one undo */
const box = await panel.locator('[data-lab-card="density"] [data-lab-density]').boundingBox();
const d1 = await depth();
await page.mouse.move(box.x + 8, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.6, box.y + box.height / 2, { steps: 6 });
await page.mouse.move(box.x + box.width + 40, box.y + box.height / 2, { steps: 6 });
await wait(200);
check("Density: while the hand holds it, the slider reads 150%", /150%/.test(await panel.locator('[data-lab-card="density"]').innerText()), await panel.locator('[data-lab-card="density"]').innerText());
await page.mouse.up();
await wait(500);
const bAfter = await nodeOf("b");
check("…let go, the page spreads: the line sits 60 below the title, its size kept", bAfter?.y === 260 && bAfter?.h === 100, `${bAfter?.y}, ${bAfter?.h}`);
check("…as one undo step, and the slider rests at 100 again", (await depth()) === d1 + 1 && /100%/.test(await panel.locator('[data-lab-card="density"]').innerText()), `${d1} → ${await depth()}`);
await undo();
check("…undo brings it back", (await nodeOf("b"))?.y === 240);

/* Mirror */
await panel.locator("[data-lab-mirror]").click();
await wait(400);
check("Mirror flips the title inside the frame", (await nodeOf("a"))?.x === 740 && (await nodeOf("c"))?.x === 1060, `${(await nodeOf("a"))?.x}, ${(await nodeOf("c"))?.x}`);
await panel.locator("[data-lab-mirror]").click();
await wait(400);
check("…twice is where it started", (await nodeOf("a"))?.x === 100 && (await nodeOf("c"))?.x === 100);

/* Columns */
check("Columns says one part is a little off", /1 part is a little off/.test(await panel.locator('[data-lab-card="columns"] [data-lab-says]').innerText()), await panel.locator('[data-lab-card="columns"] [data-lab-says]').innerText());
await panel.locator("[data-lab-snap]").click();
await wait(400);
check("Snap puts the footer on the column", (await nodeOf("f"))?.x === 100, `${(await nodeOf("f"))?.x}`);
check("…and the button goes away", (await panel.locator("[data-lab-snap]").count()) === 0);

/* Reading order */
const read = await panel.locator("[data-lab-read]").evaluateAll((els) => els.map((e) => e.getAttribute("data-lab-read")));
check("Reading order lists the parts top down, left card before right card", read.join("") === "abcdef", read.join(","));
check("…and marks the one drawn out of that order", (await panel.locator("[data-lab-astray]").count()) === 1 && (await panel.locator("[data-lab-astray]").getAttribute("data-lab-read")) === "c");
await panel.locator('[data-lab-read="e"]').click();
await wait(600);
check("pressing a row selects the part on the board", (await panel.locator('[data-lab-read="e"]').getAttribute("data-lab-picked")) === "" && (await panel.locator("[data-lab-picked]").count()) === 1);

/* The Preview draws the parts where the Lab left them. */
await page.locator("[data-preview-toggle]").click();
await wait(1200);
const live = await page.evaluate(() => {
  const e = document.querySelector('[data-live-node="e"]'), f = document.querySelector('[data-live-node="f"]');
  return e && f ? { e: parseFloat(e.style.top), f: f.style.left, ftop: parseFloat(f.style.top) } : null;
});
check("the Preview draws the footer on the column, below the story", !!live && live.f === "100px" && live.ftop > live.e, JSON.stringify(live));

check("no page error", errors.length === 0, errors.join(" | "));
await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
