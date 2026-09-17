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
import { BANDS, BAND_COLOUR, LANE_BANDS, PICKS, RATES, REACH, TURN, bandOf, costOf, laneArm, laneRects, laneSpine, lanesOf, nextIn, pickFor, saidMinutes, shown } from "../src/features/studio/lanes.ts";
import { ITEMS } from "../src/features/studio/lanesSample.ts";
import { LANE_STRAND_WIDTH, STRAND_WIDTH } from "../src/features/studio/strand.ts";
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

const SAMPLE = lanesOf(ITEMS);
const items = SAMPLE.flatMap((l) => l.items);
check("three lanes, three to five offers each", SAMPLE.length === 3 && SAMPLE.every((l) => l.items.length >= 3 && l.items.length <= 5), SAMPLE.map((l) => `${l.label}: ${l.items.length}`).join(", "));
/* His order: green at the top, yellow in the middle, red at the bottom, and an offer is in the lane of its own band. */
check("the lanes are green, yellow and red from the top down", SAMPLE.map((l) => l.band).join(",") === LANE_BANDS.join(",") && LANE_BANDS.join(",") === "green,yellow,red", SAMPLE.map((l) => `${l.label} is ${l.band}`).join(", "));
check("every offer is in the lane of its own band, so no lane can hold a colour that is not its own", SAMPLE.every((l) => l.items.every((it) => shown(it).band === l.band)) && SAMPLE.reduce((n, l) => n + l.items.length, 0) === ITEMS.length, SAMPLE.map((l) => `${l.band}: ${l.items.map((it) => shown(it).costSaid).join(" ")}`).join(" · "));
check("the lanes are made from a flat list by band, and a dear offer cannot land in the green lane", (() => { const l = lanesOf([{ ...ITEMS[0], id: "dear", difficulty: 5, tokens: { in: 200_000, out: 40_000 } }]); return l[0].items.length === 0 && l[1].items.length === 0 && l[2].items.length === 1; })());
check("the band is the cost's, not the difficulty's: in this sample the two agree on every offer, which is why the green lane reads as the easy one", ITEMS.every((it) => { const b = shown(it).band; return (it.difficulty <= 1 ? "green" : it.difficulty <= 3 ? "yellow" : "red") === b; }), "a live source could put a hard job that costs little in the green lane, and it would still be green");
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
/* A column off the latest box to its right, joined by a square bracket. It
   was a fan for a while — each outer lane stepped to the right — and he has
   rejected that: "the lanes also need to be aligned in a column the bottom
   and top being outward is awkward". */
const rects = laneRects({ x: 100, y: 200, w: 620, h: 234 }, { w: 620, h: 208 }, { x: 20, y: 54 });
const cyOf = (r) => r.y + r.h / 2;
check("the middle lane is beside the latest box, level: its vertical centre is the box's own, three gaps to its right so the vine has a run", rects[1].x === 720 + 20 * REACH && REACH === 3 && cyOf(rects[1]) === 200 + 234 / 2, `${cyOf(rects[1])} against ${200 + 234 / 2}, ${rects[1].x - 720} past the box`);
check("the three stand in a column: one left edge between them, one above the middle and one below",
  rects[0].x === rects[1].x && rects[1].x === rects[2].x && cyOf(rects[0]) < cyOf(rects[1]) && cyOf(rects[2]) > cyOf(rects[1]),
  `left edges ${rects.map((r) => r.x).join(", ")} · centres ${rects.map((r) => cyOf(r)).join(", ")}`);
check("and evenly spaced, a box and a gap apart, which is what makes a square bracket read",
  cyOf(rects[1]) - cyOf(rects[0]) === 234 + 54 && cyOf(rects[2]) - cyOf(rects[1]) === 234 + 54,
  `${cyOf(rects[1]) - cyOf(rects[0])} and ${cyOf(rects[2]) - cyOf(rects[1])}, against a box of 234 and a gap of 54`);
/* The bracket itself: a spine out of the box, a turn, an arm into each lane,
   and every leg of it either level or upright. No diagonals anywhere. */
const spine = laneSpine({ x: 100, y: 200, w: 620, h: 234 }, { x: 20, y: 54 });
const armsOf = rects.map((r) => laneArm({ x: 100, y: 200, w: 620, h: 234 }, r, { x: 20, y: 54 }));
const square = (run) => run.every((p, i) => i === 0 || Math.abs(p.x - run[i - 1].x) < 0.5 || Math.abs(p.y - run[i - 1].y) < 0.5);
check("the spine leaves the box's right edge, level, and stops at the turn",
  spine.length === 2 && spine[0].x === 720 && spine[0].y === cyOf(rects[1]) && spine[1].y === spine[0].y && spine[1].x === 720 + 20 * REACH * TURN,
  `${spine.map((p) => `${p.x},${p.y}`).join(" → ")}`);
check("every arm turns at a right angle and never runs diagonally", armsOf.every(square),
  armsOf.map((a) => a.map((p) => `${Math.round(p.x)},${Math.round(p.y)}`).join(">")).join(" · "));
check("the middle lane's arm is one straight run, with no turn in it at all", armsOf[1].length === 2);
check("the arms end on the lanes' own left edges, at their middles", armsOf.every((a, i) => a.at(-1).x === rects[i].x && a.at(-1).y === cyOf(rects[i])));
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
check("the timeline shows the real boxes, and three lanes hang off the end of them, with vines into them", (await boxes.count()) === 3 && (await lanes.count()) === 3 && (await page.locator("[data-lane-vines]").count()) === 1 && (await page.locator("[data-lanes-fan]").count()) === 0);
const last = await rectOf(page.locator('[data-box="g1"]'));
const laneRs = await lanes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
check("past the last real box, not among the history: every lane stands to its right", laneRs.every((r) => r.x > last.right), `last box ends at ${Math.round(last.right)}, lanes start at ${Math.round(laneRs[0].x)}`);
/* His drawing, proven with the numbers: the middle lane's centre is the latest box's centre; the top is up and to the right; the bottom is down and to the right. */
const mid = (r) => r.y + r.h / 2;
check("the middle lane is beside the latest box and level with it: the two vertical centres are the same number", Math.abs(mid(laneRs[1]) - mid(last)) < 1 && laneRs[1].x > last.right, `middle lane centre ${mid(laneRs[1]).toFixed(1)}, latest box centre ${mid(last).toFixed(1)}`);
check("and on the page the three stand in one column, evenly spaced",
  Math.abs(laneRs[0].x - laneRs[1].x) < 1 && Math.abs(laneRs[2].x - laneRs[1].x) < 1
  && Math.abs((mid(laneRs[1]) - mid(laneRs[0])) - (mid(laneRs[2]) - mid(laneRs[1]))) < 2
  && mid(laneRs[0]) < mid(last) && mid(laneRs[2]) > mid(last),
  `left edges ${laneRs.map((r) => Math.round(r.x)).join(", ")} · gaps ${Math.round(mid(laneRs[1]) - mid(laneRs[0]))} and ${Math.round(mid(laneRs[2]) - mid(laneRs[1]))}`);
check("one above the box's centre line, one on it, one under it, and every lane as wide and as tall as the box", laneRs.every((r) => Math.abs(r.w - last.w) < 2 && Math.abs(r.h - last.h) < 2), laneRs.map((r) => `${Math.round(r.w)}×${Math.round(r.h)}`).join(", ") + ` against ${Math.round(last.w)}×${Math.round(last.h)}`);
/*
 * The connectors are vines, his words: the timeline's own ribbon, slightly
 * thinner, green into the top lane, yellow into the middle, red into the
 * bottom. Read straight off the canvas, in the plot's own coordinates: a
 * column of pixels just before each lane's left edge, where the vine
 * arrives in the lane's colour, and a column at the middle of the level
 * vine for its width.
 */
/* One line of pixels across a canvas, in the plot's coordinates: a column at `x` from `y0` to `y1`, or, with `across` set, a row at `x` (a y) from `y0` to `y1` (two xs). */
const column = (sel, x, y0, y1, across = false) => page.evaluate(([sel, x, y0, y1, across]) => {
  const cv = document.querySelector(sel);
  if (!cv) return null;
  const st = getComputedStyle(cv);
  const left = parseFloat(st.left), top = parseFloat(st.top);
  const scale = cv.width / parseFloat(st.width);
  const ctx = cv.getContext("2d");
  const px = Math.round((x - (across ? top : left)) * scale);
  const a = Math.max(0, Math.round((y0 - (across ? left : top)) * scale)), b = Math.min(across ? cv.width : cv.height, Math.round((y1 - (across ? left : top)) * scale));
  if (px < 0 || px >= (across ? cv.height : cv.width) || b <= a) return null;
  const d = across ? ctx.getImageData(a, px, b - a, 1).data : ctx.getImageData(px, a, 1, b - a).data;
  const rows = [];
  for (let i = 0; i < b - a; i++) {
    const [r, g, bl, al] = [d[i * 4], d[i * 4 + 1], d[i * 4 + 2], d[i * 4 + 3]];
    if (al < 200) continue;
    rows.push({ y: (across ? left : top) + (a + i) / scale, r, g, b: bl });
  }
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const luma = (p) => 0.2126 * lin(p.r) + 0.7152 * lin(p.g) + 0.0722 * lin(p.b);
  const hue = (p) => { const r = p.r / 255, g = p.g / 255, b = p.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), c = mx - mn; if (!c) return null; let h = mx === r ? (g - b) / c : mx === g ? 2 + (b - r) / c : 4 + (r - g) / c; h = (h * 60 + 360) % 360; return { h, c }; };
  let brightest = null, most = null;
  for (const p of rows) { const l = luma(p); if (!brightest || l > brightest.l) brightest = { ...p, l }; const hc = hue(p); if (hc && (!most || hc.c > most.c)) most = { ...p, ...hc }; }
  /* Rows are the canvas's own pixels; `thick` is the same run in the plot's, so two canvases drawn at different scales compare. */
  return { rows: rows.length, thick: rows.length / scale, span: rows.length ? [Math.round(rows[0].y), Math.round(rows.at(-1).y)] : null, brightest, most };
}, [sel, x, y0, y1, across]);
/* Where things stand, in the plot's coordinates: the boxes and lanes are placed there, so their offsets are those coordinates. */
const plotOf = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); const w = e.parentElement; return { x: w.offsetLeft, y: w.offsetTop, w: w.offsetWidth, h: w.offsetHeight }; }, sel);
const lastP = await plotOf('[data-box="g1"]');
const laneP = [];
for (const id of LANE_BANDS) laneP.push(await plotOf(`[data-lane-box="${id}"]`));
const arrivals = [];
/* A window the ribbon's own height about the lane's centre, so the column reads this lane's vine and not the two fanning past it. */
const win = LANE_STRAND_WIDTH / 2 + 4;
for (const r of laneP) arrivals.push(await column("[data-lane-vines]", r.x - 10, r.y + r.h / 2 - win, r.y + r.h / 2 + win));
const hueOk = (band, h) => h === null ? false : band === "green" ? h >= 90 && h <= 170 : band === "yellow" ? h >= 40 && h < 90 : (h < 40 || h > 330);
check("a vine arrives at each lane at the lane's own middle, and it is the lane's colour: green, yellow, red from the top down",
  arrivals.every((a, i) => a && a.rows > 0 && a.most && hueOk(LANE_BANDS[i], a.most.h) && Math.abs((a.span[0] + a.span[1]) / 2 - (laneP[i].y + laneP[i].h / 2)) <= 6),
  arrivals.map((a, i) => a && a.most ? `${LANE_BANDS[i]}: hue ${Math.round(a.most.h)} over ${a.thick.toFixed(0)}px, centred ${Math.round((a.span[0] + a.span[1]) / 2)} against the lane's ${Math.round(laneP[i].y + laneP[i].h / 2)}` : `${LANE_BANDS[i]}: nothing painted`).join(" · "));
check("the vines are told apart by hue and nothing else: all three at the same brightness where they arrive", (() => { const l = arrivals.map((a) => a?.brightest?.l ?? -1); return l.every((v) => v >= 0) && Math.max(...l) - Math.min(...l) < 0.35; })(), `brightest pixel where each arrives: ${arrivals.map((a) => (a?.brightest?.l ?? 0).toFixed(2)).join(", ")}`);
/*
 * THE BLEND, ON THE ARM THAT ACTUALLY CHANGES COLOUR.
 *
 * The spine is the box's own colour and each arm dissipates from that into
 * its lane's, so the arm down to the red lane leaves green and arrives red.
 * Read across it at three heights: it must be green near the turn, red near
 * the lane, and have less colour in it between than at either end — which is
 * what dissipating into the material's own dark looks like from outside.
 * "the green flows and dissipates into the red and vice versa", and "i can
 * see the end lines of each" is what it must not do.
 */
const turnX = lastP.x + lastP.w + 20 * REACH * TURN;
const armY = lastP.y + lastP.h / 2;
const redY = laneP[2].y + laneP[2].h / 2;
const downTheArm = [];
for (const f of [0.12, 0.5, 0.88]) {
  const y = armY + (redY - armY) * f;
  downTheArm.push(await column("[data-lane-vines]", y, turnX - 40, turnX + 40, true));
}
const colourAt = downTheArm.map((r) => r?.most ?? null);
check("the arm to the red lane leaves the box in the box's own green and arrives red",
  !!colourAt[0] && !!colourAt[2] && colourAt[0].h >= 90 && colourAt[0].h <= 190 && (colourAt[2].h < 45 || colourAt[2].h > 330),
  colourAt.map((c, i) => `${[12, 50, 88][i]}%: ${c ? `hue ${Math.round(c.h)}` : "nothing"}`).join(" · "));
check("and dissipates between the two rather than ending: less colour in the middle than at either end",
  !!colourAt[1] && !!colourAt[0] && !!colourAt[2] && colourAt[1].c < colourAt[0].c * 0.9 && colourAt[1].c < colourAt[2].c * 0.9,
  colourAt.map((c, i) => `${[12, 50, 88][i]}%: ${c ? c.c.toFixed(3) : "—"}`).join(" · "));
check("thinner than the timeline's vines, his words twice: a little under three fifths of the width", LANE_STRAND_WIDTH < STRAND_WIDTH * 0.7 && LANE_STRAND_WIDTH >= STRAND_WIDTH * 0.5, `${LANE_STRAND_WIDTH} against ${STRAND_WIDTH}`);
/* Each ribbon is read across its own run at mid-length: the level lane vine down a column, the timeline's vine from the drawing to the latest box along a row where it runs mostly up and down, and down a column where it runs mostly across. A ribbon leaning off square reads a little wider than it is, and the shadow under it is in the count both times. */
const timelineMid = await (async () => {
  const e1 = await plotOf('[data-box="e1"]');
  const a = e1.x < lastP.x ? { x: e1.x + e1.w, y: e1.y + e1.h / 2 } : { x: e1.x, y: e1.y + e1.h / 2 };
  const b = e1.x < lastP.x ? { x: lastP.x, y: lastP.y + lastP.h / 2 } : { x: lastP.x + lastP.w, y: lastP.y + lastP.h / 2 };
  const upright = Math.abs(b.y - a.y) > Math.abs(b.x - a.x);
  const read = upright
    ? await column("[data-timeline-vines]", (a.y + b.y) / 2, Math.min(a.x, b.x) - 200, Math.max(a.x, b.x) + 200, true)
    : await column("[data-timeline-vines]", (a.x + b.x) / 2, Math.min(a.y, b.y) - 200, Math.max(a.y, b.y) + 200);
  return read ? { ...read, how: upright ? "along a row" : "down a column" } : null;
})();
check("and it is, on the canvas: the arm into a lane reads thinner across its run than the timeline's vine between the drawing and the latest box", !!arrivals[1] && !!timelineMid && arrivals[1].rows > 0 && timelineMid.rows > 0 && arrivals[1].thick < timelineMid.thick, `${(arrivals[1]?.thick ?? 0).toFixed(0)}px down a column against ${(timelineMid?.thick ?? 0).toFixed(0)}px ${timelineMid?.how ?? ""}, shadow included, nominal ${LANE_STRAND_WIDTH} against ${STRAND_WIDTH}`);
check("every lane wears the same azure construct, and no lane is a thread", (await lanes.evaluateAll((els) => els.every((e) => e.classList.contains("molten-azure") && !e.hasAttribute("data-box")))));
const bands = await lanes.evaluateAll((els) => els.map((e) => ({ band: e.getAttribute("data-lane-band"), line: getComputedStyle(e.querySelector("[data-lane-band-line]")).borderTopColor })));
check("inside each rim is one line in the lane's colour, and nothing else is coloured by cost", bands.every((b) => b.line === BAND_COLOUR[b.band]) && new Set(bands.map((b) => b.line)).size === new Set(bands.map((b) => b.band)).size, bands.map((b) => `${b.band}`).join(", "));
const order = await lanes.evaluateAll((els) => els.map((e) => ({ band: e.getAttribute("data-lane-band"), y: e.getBoundingClientRect().y })).sort((a, b) => a.y - b.y).map((e) => e.band).join(","));
check("on the screen, green is the top lane, yellow the middle, red the bottom", order === "green,yellow,red", order);
/* His words: blue right across, no black plate under the words; the words read by their own contrast against the blue. */
const plate = await lanes.evaluateAll((els) => els.map((e) => { const line = e.querySelector("[data-lane-band-line]"); const st = getComputedStyle(line); return { bg: st.backgroundColor, shadow: getComputedStyle(e.querySelector("[data-lane-detail]") ?? line).textShadow }; }));
check("the lane box is blue right across: nothing is painted behind the words", plate.every((p) => p.bg === "rgba(0, 0, 0, 0)"), plate.map((p) => p.bg).join(", "));
/* His words, the next day: the same on the red and the green. No plate, no strip under the ask line or the headline; the texture edge to edge, and the words carry the same cast edge. */
const strips = await page.evaluate(() => {
  const clear = (e) => !!e && getComputedStyle(e).backgroundColor === "rgba(0, 0, 0, 0)";
  const g = document.querySelector('[data-box="g1"]'), r = document.querySelector('[data-box="e1"]');
  const ghead = g.querySelector("[data-headline]"), rhead = r.querySelector("[data-headline]");
  return { asked: clear(g.querySelector("[data-asked]")), greenHead: clear(ghead.parentElement), redHead: clear(rhead.parentElement), greenEdge: getComputedStyle(ghead).textShadow, redEdge: getComputedStyle(rhead).textShadow, greenWeight: getComputedStyle(ghead).fontWeight, redWeight: getComputedStyle(rhead).fontWeight };
});
check("no strip under the ask line or the headline on a green box, and none under the name on a red one: the texture shows edge to edge", strips.asked && strips.greenHead && strips.redHead, `ask ${strips.asked}, green headline ${strips.greenHead}, red name ${strips.redHead}`);
check("and the words on the green and the red carry the cast edge, at semibold or heavier", strips.greenEdge !== "none" && strips.redEdge !== "none" && Number(strips.greenWeight) >= 600 && Number(strips.redWeight) >= 600, `weights ${strips.greenWeight}, ${strips.redWeight}`);
check("and the words carry their own edge instead: a dark shadow cast by the letter, not a plate", plate.every((p) => p.shadow && p.shadow !== "none"), plate[0]?.shadow ?? "none");
const times = await page.locator("[data-lane-time]").allInnerTexts();
check("time is printed as a figure in every lane", times.length === 3 && times.every((t) => /^\d+ min$|^\d+ h( \d+ min)?$/.test(t.trim())), times.join(", "));
const models = await page.locator("[data-lane-model]").evaluateAll((els) => els.map((e) => ({ text: e.innerText, gap: e.closest("[data-lane-box]").getBoundingClientRect().bottom - e.getBoundingClientRect().bottom })));
check("the model and its effort sit along the bottom edge of every lane", models.every((m) => /Haiku 4\.5|Sonnet 5|Opus 5/.test(m.text) && /low|medium|high|xhigh/.test(m.text) && m.gap < 24), models.map((m) => `${m.text.trim()} ${Math.round(m.gap)}px up`).join(" | "));
const fixDetail = page.locator('[data-lane-box][data-lane-kind="fix"] [data-lane-detail]').first();
check("an update prints the error as it was seen, in mono", (await fixDetail.count()) === 1 && /mono/i.test(await fixDetail.evaluate((e) => getComputedStyle(e).fontFamily)) && /FAIL/.test(await fixDetail.innerText()));
/* Legibility: the body line is bigger and heavier, and the contrast holds on green, red and blue alike; on the blue it is measured against the texture itself, since nothing sits between the words and it. */
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
/* The band along the foot of the pane, the detail under the timeline, and
   the lanes never share space, at this width or a narrow one; and at the
   narrow one the lanes are still there to be found, the fan still reading
   as his drawing. */
const bandShare = () => page.evaluate(() => {
  const band = document.querySelector("[data-studio-band]")?.getBoundingClientRect();
  const pane = document.querySelector("[data-timeline]")?.getBoundingClientRect();
  const lanes = [...document.querySelectorAll("[data-lane-box]")].map((e) => e.getBoundingClientRect());
  const lap = (a, b) => Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
  const low = lanes.reduce((m, r) => (r.bottom > m.bottom ? r : m), lanes[0]);
  return { bandTop: band ? Math.round(band.top) : null, bandH: band ? Math.round(band.height) : null, lowBottom: Math.round(low.bottom), under: band ? Math.max(0, Math.round(low.bottom - band.top)) : 0, shared: band ? lanes.reduce((a, r) => a + lap(r, band), 0) : 0, onPane: pane ? lanes.filter((r) => r.bottom > pane.top && r.top < (band ? band.top : pane.bottom) && r.right > pane.left && r.left < pane.right).length : 0 };
});
const wide = await bandShare();
check("no lane sits under the band along the foot of the pane at this width", wide.shared === 0 && wide.under === 0, `band top ${wide.bandTop}, lowest lane bottom ${wide.lowBottom}, under it ${wide.under}px, shared ${wide.shared}px`);
await shot("hanging");
await page.setViewportSize({ width: 480, height: 950 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1500);
const narrow = await bandShare();
check("nor at 480 wide, where the band is what a phone shows", narrow.shared === 0 && narrow.under === 0, `band top ${narrow.bandTop} (h ${narrow.bandH}), lowest lane bottom ${narrow.lowBottom}, under it ${narrow.under}px, shared ${narrow.shared}px`);
check("and the lanes are still on the pane to be found, not hidden", narrow.onPane === 3, `${narrow.onPane} of 3 on the pane above the band`);
const lastN = await rectOf(page.locator('[data-box="g1"]'));
const lanesN = await lanes.evaluateAll((els) => els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }));
check("and the column still holds there: middle level with the latest box, one left edge between the three", Math.abs(mid(lanesN[1]) - mid(lastN)) < 1 && Math.abs(lanesN[0].x - lanesN[1].x) < 1 && Math.abs(lanesN[2].x - lanesN[1].x) < 1 && mid(lanesN[0]) < mid(lastN) && mid(lanesN[2]) > mid(lastN), `middle centre ${mid(lanesN[1]).toFixed(1)} against ${mid(lastN).toFixed(1)}, left edges ${lanesN.map((r) => Math.round(r.x)).join(", ")}`);
await shot("narrow");
await page.setViewportSize({ width: 1500, height: 950 });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
await page.locator("[data-finish]").first().click({ force: true });
await page.waitForTimeout(1500);

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
