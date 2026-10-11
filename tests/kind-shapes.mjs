/**
 * A KIND IS NAMED BY HOW ITS PARTS LIE (J, 2026-10-11, on sunkcoin): the
 * wallet table's rows came out "Panels 6", its orange loading bars "Panels",
 * the eight rule cards one more "Panels", and the Copy buttons "Buttons 2".
 *
 *   1. a table's rows are "Rows"; 2. thin loading bars are "Bars", not tabs;
 *   3. cards in columns and rows are "Grid", and the part menu finds its cards (`gridOf`);
 *   4. buttons that all say one thing are named by it ("Copy buttons");
 *   5. a Copy button that does nothing copies the address beside it (`copyBySense`).
 *
 *   node tests/kind-shapes.mjs
 */
import { siteKinds, shapeOf } from "../src/features/studio/themeKinds.ts";
import { gridOf } from "../src/features/studio/gridOf.ts";
import { attachCaptured } from "../src/features/studio/shelf/library/captured.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const NAVY = "rgb(16, 38, 66)", ORANGE = "rgb(255, 90, 31)", BROWN = "rgb(107, 63, 29)", INK = "rgb(240, 240, 240)", PAGE = "rgb(6, 14, 30)";
const nodes = [];
const add = (n) => nodes.push({ pageId: "p", featureId: "box", ...n });
add({ id: "table", x: 0, y: 0, w: 1200, h: 1000, colour: { text: INK, bg: "rgb(12, 30, 52)" } });
for (let i = 0; i < 12; i++) {
  const y = 100 + i * 52;
  add({ id: `row${i}`, x: 10, y, w: 1100, h: 50, colour: { text: INK, bg: NAVY } });
  add({ id: `bar${i}`, x: 440, y: y + 19, w: 110, h: 12, colour: { bg: ORANGE } });
  add({ id: `addr${i}`, featureId: "prose", x: 60, y: y + 15, w: 90, h: 20, content: [{ text: "6aoZ…AE1w", link: { kind: "url", target: `https://solscan.io/account/6aoZ${"x".repeat(36)}AE1w` } }], colour: { text: ORANGE } });
  add({ id: `copy${i}`, featureId: "cta-primary", x: 160, y: y + 15, w: 40, h: 20, content: "COPY", colour: { text: ORANGE, bg: "rgb(20, 44, 72)" } });
}
for (let i = 0; i < 8; i++) add({ id: `card${i}`, x: 2000 + (i % 3) * 370, y: (i / 3 | 0) * 260, w: 350, h: 240, colour: { text: INK, bg: BROWN }, content: "" });

const r = siteKinds(nodes, { bg: PAGE });
const by = (fill) => r.kinds.find((k) => k.fill === fill);
const rows = by(NAVY), bars = by(ORANGE), grid = by(BROWN), copies = r.kinds.find((k) => k.button);
check("1. a table's rows are Rows", rows?.name === "Rows" && rows.shape === "rows", r.kinds.map((k) => `${k.name}:${k.parts}`).join(", "));
check("2. thin loading bars are Bars", bars?.name === "Bars" && bars.shape === "bars", bars?.name);
check("…and not drawn as tabs", bars?.tab === false);
check("3. cards in three columns and three rows are a Grid", grid?.name === "Grid" && grid.shape === "grid", grid?.name);
check("…a grid, rows and bars are never the main fill", !["Rows", "Bars", "Grid"].some((n) => r.kinds.find((k) => k.name === "Main fill")?.shape) && r.kinds.find((k) => k.name === "Main fill")?.fill !== BROWN);
check("…the part menu finds all eight cards from any one", gridOf(nodes, nodes.find((n) => n.id === "card4")).length === 8);
check("…but not from a row of the table", gridOf(nodes, nodes.find((n) => n.id === "row3")).length === 0);
check("…and three cards in a line are no grid", shapeOf([0, 1, 2].map((i) => ({ x: i * 370, y: 0, w: 350, h: 240 }))) === null);
check("4. buttons that all say Copy are Copy buttons", copies?.name === "Copy buttons", copies?.name);

const taken = attachCaptured(nodes.map((n) => ({ ...n })), { version: 1 });
const c0 = taken.find((n) => n.id === "copy0"), c5 = taken.find((n) => n.id === "copy5");
check("5. a Copy button copies the whole address beside it", c0?.work?.id === "copy-toast" && c0.work.inputs.text === `6aoZ${"x".repeat(36)}AE1w`, JSON.stringify(c0?.work));
check("…the one on its own row", c5?.work?.inputs?.text === c0?.work?.inputs?.text && taken.filter((n) => n.work?.id === "copy-toast").length === 12);
const lone = attachCaptured([{ id: "b", pageId: "p", featureId: "cta-primary", x: 0, y: 0, w: 40, h: 20, content: "Copy" }], { version: 1 });
check("…and nothing is given when no value sits beside it", !lone[0].work);
const own = attachCaptured([{ id: "b", pageId: "p", x: 0, y: 0, w: 40, h: 20, content: "Copy", work: { id: "copy-toast", inputs: { text: "mine" } } }, { id: "a", pageId: "p", x: 50, y: 0, w: 90, h: 20, content: "6aoZ…AE1w" }], { version: 1 });
check("…nor where it already copies something", own[0].work.inputs.text === "mine");

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
