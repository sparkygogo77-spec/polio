/**
 * SMALL ACCENT COLOURS ARE A DOT, NOT A PANEL (J, 2026-10-11, on sunkcoin):
 * "Bars 2", the orange of the legend's little dots, the table's progress bars
 * and the stripes down its rows' edges, got a box in the theme preview as big
 * as "Bars". A kind is an accent by how much of the site it covers, not by
 * how many parts wear it:
 *
 *   1. 47 small orange dots, bars and stripes are drawn small (a dot or a bar), though worn by more parts than the panels;
 *   2. the table's rows and the cards, covering real area, are not;
 *   3. a legend's dots are "Dots", a stripe standing up is a bar;
 *   4. an accent is never the main fill; buttons and tabs are never accents;
 *   5. short bars with words on them are label bars, not accents, and are not named after their words;
 *   6. a painted piece is never named after the capture's "div · 8 inside".
 *
 *   node tests/theme-accents.mjs
 */
import { previewPlan, siteKinds, shapeOf } from "../src/features/studio/themeKinds.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const NAVY = "rgb(16, 38, 66)", ORANGE = "rgb(255, 90, 31)", BLUE = "rgb(80, 150, 200)", BROWN = "rgb(107, 63, 29)", YELLOW = "rgb(250, 220, 20)", INK = "rgb(240, 240, 240)", PAGE = "rgb(6, 14, 30)";
const nodes = [];
const add = (n) => nodes.push({ pageId: "p", featureId: "box", ...n });
add({ id: "page", x: 0, y: 0, w: 1440, h: 4000, colour: { text: INK } });
for (let i = 0; i < 20; i++) {
  const y = 1000 + i * 52, hot = i % 3 !== 2;
  add({ id: `row${i}`, x: 10, y, w: 1100, h: 50, colour: { text: INK, bg: NAVY } });
  if (i < 6) add({ id: `stripe${i}`, x: 10, y, w: 4, h: 50, colour: { bg: hot ? ORANGE : BLUE } });
  add({ id: `bar${i}`, x: 900, y: y + 19, w: 110, h: 10, colour: { bg: hot ? ORANGE : BLUE } });
}
for (let i = 0; i < 3; i++) add({ id: `dot${i}`, x: 1200, y: 100 + i * 30, w: 12, h: 12, radius: 6, colour: { bg: ORANGE } });
for (let i = 0; i < 4; i++) add({ id: `pay${i}`, x: 300, y: 300 + i * 30, w: 90, h: 14, content: "LATEST PAYDAY", colour: { text: PAGE, bg: YELLOW } });
for (let i = 0; i < 6; i++) add({ id: `card${i}`, x: (i % 3) * 370, y: 2400 + (i / 3 | 0) * 260, w: 350, h: 240, colour: { text: INK, bg: BROWN }, content: "" });
for (let i = 0; i < 3; i++) add({ id: `buy${i}`, featureId: "cta-primary", x: 100 + i * 200, y: 3200, w: 160, h: 40, content: "Buy", colour: { text: INK, bg: ORANGE } });
add({ id: "tv", label: "div · 8 inside", x: 0, y: 3400, w: 400, h: 300, art: { background: "linear-gradient(rgb(240, 236, 226), rgb(220, 214, 200))" }, colour: { bg: "rgb(220, 214, 200)" } });
add({ id: "tv2", label: "div · 8 inside", x: 500, y: 3400, w: 300, h: 300, art: { background: "linear-gradient(rgb(240, 236, 226), rgb(220, 214, 200))" }, colour: { bg: "rgb(220, 214, 200)" } });

const r = siteKinds(nodes, { bg: PAGE });
const list = r.kinds.map((k) => `${k.name}:${k.parts}${k.accent ? "·accent" : ""}`).join(", ");
const by = (fill, button = false) => r.kinds.find((k) => k.fill === fill && k.button === button);
const orange = by(ORANGE), blue = by(BLUE), rows = by(NAVY), cards = by(BROWN), buy = by(ORANGE, true), pay = by(YELLOW);
/* Drawn small, as a dot or a bar, never a box as big as a panel: by what each part is, the dots one kind and the bars and stripes another (J, 2026-10-11). */
const plan = previewPlan(r);
const small = (fill) => r.kinds.filter((k) => k.fill === fill && !k.button);
check("1. the orange dots, bars and stripes are drawn small, never a box", small(ORANGE).length > 0 && small(ORANGE).every((k) => (k.accent || k.strip) && !plan.surfaces.includes(k)), list);
check("…and so are the blue ones", small(BLUE).length > 0 && small(BLUE).every((k) => (k.accent || k.strip) && !plan.surfaces.includes(k)), list);
check("…they cover a speck of the site", small(ORANGE).reduce((a, k) => a + k.cover, 0) < 0.015 * 1440 * 4000, list);
check("2. the table's rows are no accent", rows?.accent === false);
check("…nor the cards", cards?.accent === false);
check("3. a legend's dots are Dots", shapeOf(nodes.filter((n) => n.id.startsWith("dot"))) === "dots");
check("…a stripe standing up is a bar", shapeOf(nodes.filter((n) => n.id.startsWith("stripe"))) === "bars");
check("4. an accent is never the main fill", !r.kinds.some((k) => k.accent && k.name === "Main fill"));
check("…buttons are never accents", buy?.button === true && buy.accent === false, buy?.name);
/* Short bars with words on them are label bars, drawn as a strip with their words, never a dot, and never named after their words ("Bars: Latest payday" read as one bar's name; J, 2026-10-11). */
check("5. short bars with words on them are a label bar, not an accent", pay?.tab === true && pay.accent === false && pay.name === "Label bars", list);
check("…and two accents that look alike keep a number, their dots telling them apart", /^Bars \d$/.test(blue?.name ?? "") || /^Bars \d$/.test(orange?.name ?? ""), list);
const tv = r.kinds.find((k) => k.piece);
check("6. a painted piece is not named after div · 8 inside", !!tv && tv.name === "Painted panel", tv?.name);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
