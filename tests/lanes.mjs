/**
 * The lanes: three offers hanging off the end of the timeline.
 *
 * Two halves. The first reads the typed structure off the disk and checks
 * that everything a lane box prints comes from the item's own numbers in
 * one direction: difficulty picks the model, the model and the tokens give
 * the cost, the cost sets the colour, and time is a figure. The second
 * opens the Builder's timeline with real iterations on it and checks what
 * a person sees: three lane boxes past the last real box, moving along
 * when a box lands; Refresh swapping in another offer of the same lane;
 * Take control turning a lane's work into a blue box in the normal run,
 * built from the same construct as the green ones and told from them by
 * hue alone; and the blue box, opened, explaining what the work changed.
 *
 *   node tests/lanes.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { BANDS, BAND_COLOUR, PICKS, RATES, bandOf, costOf, laneRects, nextIn, pickFor, saidMinutes, shown } from "../src/features/studio/lanes.ts";
import { SAMPLE } from "../src/features/studio/lanesSample.ts";
import { MOLTEN_MEANS, moltenClass } from "../src/core/ui/molten.ts";

const req = createRequire(import.meta.url);
const { chromium } = req(process.env.PLAYWRIGHT_MODULE ?? "/opt/node22/lib/node_modules/playwright");
const URL_ = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SHOTS = !!process.env.SHOTS;

const results = [];
const check = (name, ok, detail = "") => {
  results.push(!!ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The structure: one direction, no disagreement                     */
/* ------------------------------------------------------------------ */

const items = SAMPLE.flatMap((l) => l.items);
check("three lanes, three or four offers each", SAMPLE.length === 3 && SAMPLE.every((l) => l.items.length >= 3 && l.items.length <= 4), SAMPLE.map((l) => `${l.label}: ${l.items.length}`).join(", "));
check("every offer is an update or an improvement, with a difficulty from 1 to 5, tokens and minutes", items.every((it) => ["fix", "step"].includes(it.kind) && [1, 2, 3, 4, 5].includes(it.difficulty) && it.tokens.in > 0 && it.tokens.out > 0 && it.minutes > 0));
const rank = (model) => ["claude-haiku-4-5", "claude-sonnet-5", "claude-opus-5"].indexOf(model);
check("difficulty picks the model and the effort, and a harder job never gets a smaller model",
  [1, 2, 3, 4, 5].every((d, i, all) => i === 0 || rank(pickFor(all[i - 1]).model) <= rank(pickFor(d).model)), [1, 2, 3, 4, 5].map((d) => `${d}: ${PICKS[d].name} ${PICKS[d].effort}`).join(", "));
check("the model and the tokens give the cost, at the model's own rate", Math.abs(costOf({ difficulty: 4, tokens: { in: 1_000_000, out: 0 } }) - RATES["claude-opus-5"].in) < 1e-9 && Math.abs(costOf({ difficulty: 1, tokens: { in: 0, out: 1_000_000 } }) - RATES["claude-haiku-4-5"].out) < 1e-9);
check("the cost sets the band, and nothing else does", bandOf(BANDS.green - 0.001) === "green" && bandOf(BANDS.green) === "yellow" && bandOf(BANDS.yellow - 0.001) === "yellow" && bandOf(BANDS.yellow) === "red");
const cheapHard = shown({ ...items[0], difficulty: 5, tokens: { in: 1_000, out: 100 } });
const cheapEasy = shown({ ...items[0], difficulty: 1, tokens: { in: 5_000, out: 500 } });
check("a hard job that costs little is green, the same as an easy one that costs little", cheapHard.band === "green" && cheapEasy.band === "green", `${cheapHard.costSaid} on ${cheapHard.pick.name}, ${cheapEasy.costSaid} on ${cheapEasy.pick.name}`);
check("the sample spreads across all three bands, so all three colours can be judged", new Set(items.map((it) => shown(it).band)).size === 3);
check("time is a figure: minutes under an hour, hours and minutes past it", saidMinutes(4) === "4 min" && saidMinutes(60) === "1 h" && saidMinutes(90) === "1 h 30 min");
check("a fix carries what failed and a step carries a recommendation", items.every((it) => (it.kind === "fix" ? /FAIL|\.mjs/.test(it.detail) : !/FAIL/.test(it.detail))));
check("Refresh goes to the next offer of the same lane and round the end, never the same one", SAMPLE.every((l) => l.items.every((it) => { const n = nextIn(l, it.id); return n.id !== it.id && l.items.includes(n); })));
check("what a carried-out offer changed is written from the work, and only where the work was done", items.filter((it) => it.did).length >= 3 && items.filter((it) => it.did).every((it) => it.did.length > 120 && !/\{|\}|template/i.test(it.did)), `${items.filter((it) => it.did).length} of ${items.length} carried out`);
check("no em dash in anything a lane prints", items.every((it) => !/—/.test(it.title) && !/—/.test(it.detail) && !/—/.test(it.did ?? "")));
/* His drawing: a fan off the latest box to its right. Middle level with it, top up and to the right, bottom down and to the right. */
const rects = laneRects({ x: 100, y: 200, w: 620, h: 234 }, { w: 620, h: 208 }, { x: 20, y: 54 });
const cyOf = (r) => r.y + r.h / 2;
check("the middle lane is beside the latest box, level: its vertical centre is the box's own", rects[1].x === 740 && cyOf(rects[1]) === 200 + 234 / 2, `${cyOf(rects[1])} against ${200 + 234 / 2}`);
check("the top lane is diagonally above, up and to the right; the bottom diagonally below, down and to the right",
  rects[0].x > rects[1].x && cyOf(rects[0]) < cyOf(rects[1]) && rects[2].x > rects[1].x && cyOf(rects[2]) > cyOf(rects[1]) && rects[0].x === rects[2].x, `top at ${rects[0].x},${cyOf(rects[0])} · middle at ${rects[1].x},${cyOf(rects[1])} · bottom at ${rects[2].x},${cyOf(rects[2])}`);
check("every lane is as tall as the box it hangs off, so the centres can agree", rects.every((r) => r.h === 234 && r.w === 620));
check("azure is a kind the construct knows, and it means a lane's work", moltenClass("azure") === "molten molten-azure" && /lane/.test(MOLTEN_MEANS.azure));

/* ------------------------------------------------------------------ */
/* 2. The timeline: what a person sees                                  */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
/* Two real iterations on the timeline, the way the other timeline suites seed them. */
await page.evaluate(() => {
  /* A fresh browser has written nothing yet: the store merges a partial document over its defaults. */
  const doc = JSON.parse(localStorage.getItem("builder.studio") ?? '{"state":{},"version":0}');
  const st = doc.state;
  const pageId = st.activePageId ?? st.pages?.[0]?.id ?? "page_home";
  st.nodes = [{ id: "d1", pageId, featureId: "custom-idea", label: "a peak", prompt: "a peak", content: "", x: 200, y: 200, w: 200, h: 120, groupId: null, options: {}, priority: "p2", custom: true, glyph: null, hue: null, locked: false, link: null, data: "", colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "ease", shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null, role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null }];
  st.threads = [
    { id: "g0", at: 1, mode: "plan", state: "done", ask: "Lay out the home page", answer: "Done.", changes: ["laid out the home page"], parentId: null },
    { id: "e1", at: 2, mode: "drawing", state: "done", ask: "a peak", answer: "drew a peak", changes: ["drew a peak at 200 × 120"], parentId: "g0", madeId: "d1", sketch: { strokes: [[[0.05, 0.95], [0.5, 0.1], [0.95, 0.95]]], words: "a peak" } },
    { id: "g1", at: 3, mode: "build", state: "done", ask: "Build the pricing band", answer: "Built.", changes: ["built the pricing band"], parentId: "e1" },
  ];
  st.threadSpots = {};
  st.openThreadId = null;
  localStorage.setItem("builder.studio", JSON.stringify(doc));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-finish]").first().click();
await page.waitForTimeout(1500);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `docs/shots/lanes-${n}.png` }); };

const boxes = page.locator("[data-box]");
const lanes = page.locator("[data-lane-box]");
const rectOf = async (loc) => loc.evaluate((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, right: r.right }; });
check("the timeline shows the real boxes, and three lanes hang off the end of them", (await boxes.count()) === 3 && (await lanes.count()) === 3 && (await page.locator("[data-lanes-fan]").count()) === 1);
const last = await rectOf(page.locator('[data-box="g1"]'));
const laneRs = await lanes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
check("past the last real box, not among the history: every lane stands to its right", laneRs.every((r) => r.x > last.right), `last box ends at ${Math.round(last.right)}, lanes start at ${Math.round(laneRs[0].x)}`);
/* His drawing, proven with the numbers: the middle lane's centre is the latest box's centre; the top is up and to the right; the bottom is down and to the right. */
const mid = (r) => r.y + r.h / 2;
check("the middle lane is beside the latest box and level with it: the two vertical centres are the same number", Math.abs(mid(laneRs[1]) - mid(last)) < 1 && laneRs[1].x > last.right, `middle lane centre ${mid(laneRs[1]).toFixed(1)}, latest box centre ${mid(last).toFixed(1)}`);
check("the top lane is diagonally above, up and to the right of the middle; the bottom diagonally below, down and to the right", mid(laneRs[0]) < mid(last) && laneRs[0].x > laneRs[1].x && mid(laneRs[2]) > mid(last) && laneRs[2].x > laneRs[1].x, `top centre ${Math.round(mid(laneRs[0]))} at x ${Math.round(laneRs[0].x)} · middle ${Math.round(mid(laneRs[1]))} at x ${Math.round(laneRs[1].x)} · bottom ${Math.round(mid(laneRs[2]))} at x ${Math.round(laneRs[2].x)}`);
check("one above the box's centre line, one on it, one under it, and every lane as wide and as tall as the box", laneRs.every((r) => Math.abs(r.w - last.w) < 2 && Math.abs(r.h - last.h) < 2), laneRs.map((r) => `${Math.round(r.w)}×${Math.round(r.h)}`).join(", ") + ` against ${Math.round(last.w)}×${Math.round(last.h)}`);
/* The connector reads as a bracket opening to the right: a level stub out of the box, one bar, a stub into each lane at its own centre. */
const fan = await page.locator("[data-lanes-fan]").evaluate((svg) => {
  const box = svg.getBoundingClientRect();
  const path = (sel) => { const b = svg.querySelector(sel)?.getBBox(); return b ? { x: b.x, y: b.y, width: b.width, height: b.height } : null; };
  return { stub: path("[data-fan-stub]"), bar: path("[data-fan-bar]"), into: [0, 1, 2].map((i) => path(`[data-fan-into="${i}"]`)), left: box.left, scale: box.width / svg.viewBox.baseVal.width };
});
check("the connector is a bracket opening to the right: a level stub, a bar between the box and the lanes, and a stub into each lane at its centre",
  !!fan.stub && fan.stub.height === 0 && !!fan.bar && fan.bar.width === 0 && fan.into.every((p) => p && p.height === 0) && fan.into[0].y < fan.into[1].y && fan.into[1].y < fan.into[2].y && Math.abs(fan.into[0].width - fan.into[2].width) < 1 && fan.into[0].width > fan.into[1].width,
  fan.stub ? `stub ${Math.round(fan.stub.width)} across, bar ${Math.round(fan.bar.height)} tall, stubs into the lanes ${fan.into.map((p) => Math.round(p.width)).join(", ")} across` : "no bracket");
check("every lane wears the same azure construct, and no lane is a thread", (await lanes.evaluateAll((els) => els.every((e) => e.classList.contains("molten-azure") && !e.hasAttribute("data-box")))));
const bands = await lanes.evaluateAll((els) => els.map((e) => ({ band: e.getAttribute("data-lane-band"), line: getComputedStyle(e.querySelector("[data-lane-band-line]")).borderTopColor })));
check("inside each rim is one line in the cost band's colour, and nothing else is coloured by cost", bands.every((b) => b.line === BAND_COLOUR[b.band]) && new Set(bands.map((b) => b.line)).size === new Set(bands.map((b) => b.band)).size, bands.map((b) => `${b.band}`).join(", "));
const times = await page.locator("[data-lane-time]").allInnerTexts();
check("time is printed as a figure in every lane", times.length === 3 && times.every((t) => /^\d+ min$|^\d+ h( \d+ min)?$/.test(t.trim())), times.join(", "));
const models = await page.locator("[data-lane-model]").evaluateAll((els) => els.map((e) => ({ text: e.innerText, gap: e.closest("[data-lane-box]").getBoundingClientRect().bottom - e.getBoundingClientRect().bottom })));
check("the model and its effort sit along the bottom edge of every lane", models.every((m) => /Haiku 4\.5|Sonnet 5|Opus 5/.test(m.text) && /low|medium|high|xhigh/.test(m.text) && m.gap < 24), models.map((m) => `${m.text.trim()} ${Math.round(m.gap)}px up`).join(" | "));
const fixDetail = page.locator('[data-lane-box][data-lane-kind="fix"] [data-lane-detail]').first();
check("an update prints the error as it was seen, in mono", (await fixDetail.count()) === 1 && /mono/i.test(await fixDetail.evaluate((e) => getComputedStyle(e).fontFamily)) && /FAIL/.test(await fixDetail.innerText()));
/* Legibility: the body line sits on a calm ground, bigger and heavier, and the contrast holds on green, red and blue alike. */
/* The type as it is set, in CSS pixels: the computed size is unscaled by the plot's zoom. */
const typeOf = (loc) => loc.evaluate((e) => { const cs = getComputedStyle(e); return { px: parseFloat(cs.fontSize), weight: cs.fontWeight, color: cs.color }; });
const groundOf = (loc) => loc.evaluate((e) => { let n = e; while (n && getComputedStyle(n).backgroundColor === "rgba(0, 0, 0, 0)") n = n.parentElement; return n ? getComputedStyle(n).backgroundColor : "none"; });
const laneBody = await typeOf(lanes.first().locator("[data-lane-detail]"));
const greenBody = await typeOf(page.locator('[data-box="g1"] [data-headline]'));
const redBody = await typeOf(page.locator('[data-box="e1"] [data-headline]'));
check("the body line on a lane is up toward the title: 12px or more and medium, where it was 10px and regular", laneBody.px >= 12 && Number(laneBody.weight) >= 500, `${laneBody.px.toFixed(1)}px, weight ${laneBody.weight}`);
check("and on a green box: 12px medium where it was 10px regular", greenBody.px >= 12 && Number(greenBody.weight) >= 500, `${greenBody.px.toFixed(1)}px, weight ${greenBody.weight}`);
check("the title on a green box is where it was, 13px", (await typeOf(page.locator('[data-box="g1"] [data-asked-said]'))).px === 13);
/* Contrast, measured off the screen: the body words' colour against the ground they sit on, as the pixels came out, on all three surfaces. */
const luma = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { v = Number(v) / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
/* Any colour the browser reports, as the rgb it paints: drawn on a canvas and read back. */
const asRgb = (colour) => page.evaluate((c) => { const cv = document.createElement("canvas"); cv.width = cv.height = 1; const ctx = cv.getContext("2d"); ctx.fillStyle = c; ctx.fillRect(0, 0, 1, 1); const d = ctx.getImageData(0, 0, 1, 1).data; return `rgb(${d[0]}, ${d[1]}, ${d[2]})`; }, colour);
const contrastOf = async (loc) => {
  const box = await loc.boundingBox();
  const text = await asRgb(await loc.evaluate((e) => getComputedStyle(e).color));
  /* The ground as it came out on screen: a strip along the top edge of the words' own ground, where no letter reaches. */
  const png = await page.screenshot({ clip: { x: Math.round(box.x), y: Math.round(box.y) - 2, width: Math.max(8, Math.round(box.width)), height: 2 } });
  /* Decoded by the browser itself: the strip drawn on a canvas and averaged. */
  const ground = await page.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
    const ctx = c.getContext("2d"); ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return `rgb(${r / n}, ${g / n}, ${b / n})`;
  }, png.toString("base64"));
  const [l1, l2] = [luma(text), luma(ground)].sort((a, b2) => b2 - a);
  return { ratio: (l1 + 0.05) / (l2 + 0.05), ground };
};
let contrast = null;
try {
  contrast = { blue: await contrastOf(lanes.first().locator("[data-lane-detail]")), green: await contrastOf(page.locator('[data-box="g1"] [data-headline]')), red: await contrastOf(page.locator('[data-box="e1"] [data-headline]')) };
} catch (e) { contrast = null; console.log(`note  contrast could not be read off the screen: ${String(e.message ?? e).slice(0, 80)}`); }
if (contrast) check("the body words hold 4.5 to 1 or better against their ground on the blue, the green and the red surface", Object.values(contrast).every((c) => c.ratio >= 4.5), Object.entries(contrast).map(([k, c]) => `${k} ${c.ratio.toFixed(1)}:1`).join(", "));
await shot("hanging");

/* Refresh on the middle lane: another offer of the same lane, the box the same shape. */
const middle = lanes.nth(1);
const before = await middle.getAttribute("data-lane-item");
await middle.locator("[data-lane-refresh]").click();
await page.waitForTimeout(250);
const after = await middle.getAttribute("data-lane-item");
check("Refresh swaps in a different offer from that same lane", before !== after && after === nextIn(SAMPLE[1], before).id, `${before} -> ${after}`);
const mid2 = await rectOf(middle);
check("and the lane keeps its shape and its place", Math.abs(mid2.w - laneRs[1].w) < 1 && Math.abs(mid2.h - laneRs[1].h) < 1 && Math.abs(mid2.y - laneRs[1].y) < 1);

/* Take control on the first lane: its work becomes a blue box in the run, and the lanes move past it. */
const first = lanes.first();
const carried = await first.getAttribute("data-lane-item");
const carriedItem = items.find((it) => it.id === carried);
check("the first lane's offer has really been carried out, so Take control is on", !!carriedItem?.did && !(await first.locator("[data-lane-take]").isDisabled()), carried);
const disabled = page.locator('[data-lane-box] [data-lane-take][disabled]');
check("an offer nobody has carried out yet cannot pretend to have been", (await disabled.count()) >= 1, `${await disabled.count()} keys off`);
await first.locator("[data-lane-take]").click();
await page.waitForTimeout(1500);
check("a box lands in the normal run of boxes", (await boxes.count()) === 4);
const blue = page.locator("[data-box]").last();
const blueId = await blue.getAttribute("data-box");
const green = page.locator('[data-box="g1"]');
const look = async (loc) => loc.evaluate((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { w: Math.round(r.width), minH: cs.minHeight, pad: cs.padding, gap: cs.gap, radius: cs.borderTopLeftRadius, rimWidth: cs.getPropertyValue("--mo-rim-width").trim(), rim: cs.getPropertyValue("--mo-rim").trim(), cloud: cs.getPropertyValue("--mo-cloud").trim(), still: cs.getPropertyValue("--mo-cloud-still").trim(), classes: [...e.classList].filter((c) => c.startsWith("molten")).join(" "), glow: !!e.querySelector("[data-molten]"), rows: [...e.children].map((c) => c.tagName + (c.dataset.molten !== undefined ? "[molten]" : "")).join(","), hue: cs.getPropertyValue("--box-hue").trim() }; });
const [g, bl] = [await look(green), await look(blue)];
check("it is the same construct as the green boxes: same width, same floor, same corners, same padding, same rim weight, same cloud, same edge and glow layer, the same rows in the same order",
  bl.w === g.w && bl.minH === g.minH && bl.radius === g.radius && bl.pad === g.pad && bl.gap === g.gap && bl.rimWidth === g.rimWidth && bl.cloud === g.cloud && bl.still === g.still && bl.glow && g.glow && bl.rows === g.rows && bl.classes.startsWith("molten "),
  `green ${g.w} wide, floor ${g.minH}, ${g.radius}, pad ${g.pad}, rim ${g.rimWidth}, cloud ${g.cloud}/${g.still}, rows ${g.rows} · blue ${bl.w} wide, floor ${bl.minH}, ${bl.radius}, pad ${bl.pad}, rim ${bl.rimWidth}, cloud ${bl.cloud}/${bl.still}, rows ${bl.rows}`);
check("and only the hue differs: azure where the green is verdant, a blue rim image where the green's is green", bl.classes.includes("molten-azure") && g.classes.includes("molten-verdant") && /rim-blue/.test(bl.rim) && /rim-green/.test(g.rim) && bl.hue !== g.hue, `${bl.classes} · ${bl.rim}`);
const blueLabel = await blue.locator("span.uppercase").first().innerText();
check("it is labelled as a lane's work, in the same place the green box carries its label", /lane/i.test(blueLabel), blueLabel.trim());
const laneRs2 = await lanes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y }; }));
const blueR = await rectOf(blue);
check("the lanes move out past the new box and stay at the end", laneRs2.every((r) => r.x > blueR.right) && laneRs2[0].x > laneRs[0].x, `lanes were at ${Math.round(laneRs[0].x)}, the blue box is at ${Math.round(blueR.x)}, lanes now at ${Math.round(laneRs2[0].x)}`);
check("and the lane that was carried out offers the next thing", (await first.getAttribute("data-lane-item")) === nextIn(SAMPLE[0], carried).id);
await shot("carried");

/* Open the blue box: the explanation is what the work actually did. */
await blue.click({ force: true });
await page.waitForTimeout(600);
const card = page.locator(`[data-card="out"][data-card-of="${blueId}"]`);
check("pressing the blue box opens what it changed on the site", (await card.count()) === 1);
const said = await card.innerText();
check("and that explanation is the work's own account, not a template", said.includes(carriedItem.did.slice(0, 80)) && said.includes(carriedItem.did.split(/(?<=\.)\s/)[0]), said.replace(/\s+/g, " ").slice(0, 140));
const cardRim = await card.locator("[data-reading]").evaluate((e) => getComputedStyle(e).borderTopColor);
check("in the blue box's own family", /210\)/.test(cardRim) || /210 \//.test(cardRim), cardRim);
const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.threads.at(-1));
check("it is a real iteration in the record, in the lane's mode, with the account as its answer", stored?.mode === "lane" && stored?.answer === carriedItem.did && stored?.ask === carriedItem.title, stored?.mode);
await shot("opened");

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
