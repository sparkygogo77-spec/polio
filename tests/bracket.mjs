/**
 * The bracket: what the latest box on the timeline could become next.
 *
 * Two halves. The first reads the typed structure off the disk and checks
 * that everything a box prints comes from the item's own numbers in one
 * direction: difficulty picks the model, the model and the tokens give the
 * cost, the cost sets the colour, and time is a figure. The second opens
 * the page and checks what a person sees: three boxes on one blue rim,
 * each the same shape whatever it holds, the band line inside, the time
 * printed, the model along the bottom edge, a fix in mono, Refresh
 * swapping in another item of the same row, and Take control.
 *
 *   node tests/bracket.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { BANDS, BAND_COLOUR, PICKS, RATES, RIM, bandOf, costOf, nextIn, pickFor, saidMinutes, shown } from "../src/features/bracket/model.ts";
import { SAMPLE } from "../src/features/bracket/sample.ts";

const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright");
const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The structure: one direction, no disagreement                     */
/* ------------------------------------------------------------------ */

const items = SAMPLE.lanes.flatMap((l) => l.items);
check("three lanes, three or four items each", SAMPLE.lanes.length === 3 && SAMPLE.lanes.every((l) => l.items.length >= 3 && l.items.length <= 4), SAMPLE.lanes.map((l) => `${l.label}: ${l.items.length}`).join(", "));
check("every item has a difficulty from 1 to 5, tokens and minutes", items.every((it) => [1, 2, 3, 4, 5].includes(it.difficulty) && it.tokens.in > 0 && it.tokens.out > 0 && it.minutes > 0));
check("difficulty picks the model and the effort, and a harder job never gets a smaller model",
  [1, 2, 3, 4, 5].every((d, i, all) => i === 0 || rank(pickFor(all[i - 1]).model) <= rank(pickFor(d).model)), [1, 2, 3, 4, 5].map((d) => `${d}: ${PICKS[d].name} ${PICKS[d].effort}`).join(", "));
function rank(model) { return ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"].indexOf(model); }
check("the model and the tokens give the cost, at the model's own rate", Math.abs(costOf({ difficulty: 4, tokens: { in: 1_000_000, out: 0 } }) - RATES["claude-opus-5"].in) < 1e-9 && Math.abs(costOf({ difficulty: 1, tokens: { in: 0, out: 1_000_000 } }) - RATES["claude-haiku-4-5"].out) < 1e-9);
check("the cost sets the band, and nothing else does", bandOf(BANDS.green - 0.001) === "green" && bandOf(BANDS.green) === "yellow" && bandOf(BANDS.yellow - 0.001) === "yellow" && bandOf(BANDS.yellow) === "red");
/* Two items of the same cost wear the same colour whatever their difficulty:
   the colour follows the cost and never the difficulty on its own. */
const cheapHard = shown({ ...items[0], difficulty: 5, tokens: { in: 1_000, out: 100 } });
const cheapEasy = shown({ ...items[0], difficulty: 1, tokens: { in: 5_000, out: 500 } });
check("a hard job that costs little is green, the same as an easy one that costs little", cheapHard.band === "green" && cheapEasy.band === "green", `${cheapHard.costSaid} on ${cheapHard.pick.name}, ${cheapEasy.costSaid} on ${cheapEasy.pick.name}`);
const bands = new Set(items.map((it) => shown(it).band));
check("the sample spreads across all three bands, so all three colours can be judged", bands.size === 3, [...bands].join(", "));
check("time is a figure: minutes under an hour, hours and minutes past it", saidMinutes(4) === "4 min" && saidMinutes(60) === "1 h" && saidMinutes(90) === "1 h 30 min");
check("a fix carries what failed and a step carries a recommendation", items.every((it) => (it.kind === "fix" ? /FAIL|\.mjs/.test(it.detail) : !/FAIL/.test(it.detail))));
check("Refresh goes to the next item of the same lane and round the end, never the same one", SAMPLE.lanes.every((l) => l.items.every((it) => { const n = nextIn(l, it.id); return n.id !== it.id && l.items.includes(n); })) && nextIn(SAMPLE.lanes[0], SAMPLE.lanes[0].items.at(-1).id).id === SAMPLE.lanes[0].items[0].id);
check("no em dash in anything a box prints", items.every((it) => !/—/.test(it.title) && !/—/.test(it.detail)) && SAMPLE.lanes.every((l) => !/—/.test(l.label)));

/* ------------------------------------------------------------------ */
/* 2. The page: what a person sees                                      */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${URL_}/bracket`, { waitUntil: "networkidle" });
/* oklch as the browser reports it back, rgb(), read off a scratch element so the conversion is the browser's own. */
const RGB = await page.evaluate((colours) => Object.fromEntries(colours.map((c) => { const e = document.createElement("div"); e.style.color = c; document.body.appendChild(e); const v = getComputedStyle(e).color; e.remove(); return [c, v]; })), [RIM, ...Object.values(BAND_COLOUR)]);
const toRgb = (c) => RGB[c];
const boxes = page.locator("[data-bracket-box]");
check("the latest box on the timeline is there, and three boxes fan off it", (await page.locator("[data-bracket-from]").count()) === 1 && (await boxes.count()) === 3 && (await page.locator("[data-bracket-fan]").count()) === 1);

const rects = await boxes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
check("every box is the same shape: same width, same height, same left edge", rects.every((r) => Math.abs(r.w - rects[0].w) < 1 && Math.abs(r.h - rects[0].h) < 1 && Math.abs(r.x - rects[0].x) < 1), rects.map((r) => `${Math.round(r.w)}×${Math.round(r.h)}`).join(", "));
const from = await page.locator("[data-bracket-from]").boundingBox();
const stackMid = (rects[0].y + rects[2].y + rects[2].h) / 2;
check("and they are stacked on the latest box's own line, the middle one level with it", Math.abs(from.y + from.height / 2 - stackMid) < 2 && Math.abs(rects[1].y + rects[1].h / 2 - stackMid) < 2, `latest at ${Math.round(from.y + from.height / 2)}, stack middle ${Math.round(stackMid)}`);

const rims = await boxes.evaluateAll((els) => els.map((e) => getComputedStyle(e).borderTopColor));
check("every box wears the same outer rim, so the bracket reads as one generation", new Set(rims).size === 1, rims[0]);
const inner = await boxes.evaluateAll((els) => els.map((e) => ({ band: e.getAttribute("data-bracket-band"), colour: getComputedStyle(e.firstElementChild).borderTopColor, pad: getComputedStyle(e.firstElementChild).padding })));
check("inside the rim is a second line in the band's colour, one colour per band", inner.every((i) => i.colour === toRgb(BAND_COLOUR[i.band])) && new Set(inner.map((i) => i.colour)).size === new Set(inner.map((i) => i.band)).size, inner.map((i) => `${i.band}: ${i.colour}`).join(" | "));
check("and the same inner padding on every box", new Set(inner.map((i) => i.pad)).size === 1, inner[0].pad);
check("the rim is not any band's colour, so the two lines never read as one", !Object.values(BAND_COLOUR).map(toRgb).includes(rims[0]) && rims[0] === toRgb(RIM));

const times = await page.locator("[data-bracket-time]").allInnerTexts();
check("time is printed as a figure in every box", times.length === 3 && times.every((t) => /^\d+ min$|^\d+ h( \d+ min)?$/.test(t.trim())), times.join(", "));
const models = await page.locator("[data-bracket-model]").evaluateAll((els) => els.map((e) => ({ text: e.innerText, bottom: e.getBoundingClientRect().bottom, boxBottom: e.closest("[data-bracket-box]").getBoundingClientRect().bottom })));
check("the model and its effort sit along the bottom edge of every box", models.every((m) => /Haiku 4\.5|Sonnet 5|Opus 5/.test(m.text) && /low|medium|high|xhigh/.test(m.text) && m.boxBottom - m.bottom < 20), models.map((m) => `${m.text.split("·").slice(0, 2).join("·").trim()} at ${Math.round(m.boxBottom - m.bottom)}px from the edge`).join(" | "));
const fixDetail = page.locator('[data-bracket-box][data-bracket-kind="fix"] [data-bracket-detail]').first();
check("a fix prints the error as it was seen, in mono", (await fixDetail.count()) === 1 && /mono/i.test(await fixDetail.evaluate((e) => getComputedStyle(e).fontFamily)) && /FAIL/.test(await fixDetail.innerText()));
const stepDetail = page.locator('[data-bracket-box][data-bracket-kind="step"] [data-bracket-detail]').first();
check("a step prints a recommendation, not in mono", (await stepDetail.count()) === 1 && !/mono/i.test(await stepDetail.evaluate((e) => getComputedStyle(e).fontFamily)));
check("no em dash on the page", !/—/.test(await page.locator("[data-bracket]").innerText()));

/* Refresh on the first box: another item from the same lane, the box the same shape. */
const first = boxes.first();
const before = await first.getAttribute("data-bracket-item");
await first.locator("[data-bracket-refresh]").click();
await page.waitForTimeout(200);
const after = await first.getAttribute("data-bracket-item");
const lane = SAMPLE.lanes[0];
check("Refresh swaps in a different item from that same row", before !== after && lane.items.some((it) => it.id === after) && after === nextIn(lane, before).id, `${before} -> ${after}`);
const rect2 = await first.boundingBox();
check("and the box keeps its shape", Math.abs(rect2.width - rects[0].w) < 1 && Math.abs(rect2.height - rects[0].h) < 1, `${Math.round(rect2.width)}×${Math.round(rect2.height)}`);
const bandAfter = await first.getAttribute("data-bracket-band");
check("with the band read off the new item, not the old one", bandAfter === shown(lane.items.find((it) => it.id === after)).band, bandAfter);
/* Round the whole lane and back. */
for (let i = 0; i < lane.items.length - 1; i++) { await first.locator("[data-bracket-refresh]").click(); await page.waitForTimeout(120); }
check("and round the row it comes back to the first", (await first.getAttribute("data-bracket-item")) === before);

/* Take control on the second box: the key goes red, the box is marked, Refresh is off. */
const second = boxes.nth(1);
await second.locator("[data-bracket-take]").click();
await page.waitForTimeout(200);
const takeColour = await second.locator("[data-bracket-take]").evaluate((e) => getComputedStyle(e).backgroundColor);
check("Take control marks the box as yours: the key is the one that is on, and only it", (await second.getAttribute("data-taken")) === "" && (await second.locator("[data-bracket-take]").innerText()).trim() === "Yours" && (await boxes.evaluateAll((els) => els.filter((e) => e.hasAttribute("data-taken")).length)) === 1, takeColour);
check("and its Refresh is off while it is yours", await second.locator("[data-bracket-refresh]").isDisabled());
await second.locator("[data-bracket-take]").click();
await page.waitForTimeout(150);
check("pressing it again hands it back", (await second.getAttribute("data-taken")) === null && !(await second.locator("[data-bracket-refresh]").isDisabled()));

await page.screenshot({ path: "docs/shots/bracket.png" }).catch(() => undefined);
await browser.close();

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);

