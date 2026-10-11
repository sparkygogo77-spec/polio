/**
 * TRIM AND PANELS IN THE COLOURS PREVIEW (J, 2026-10-11, on the PonsStars
 * redesign): the striped lip under "Start recording" was a kind of button
 * ("Buttons 2, 24"), and the lined paper panels the forms sit on had no box,
 * drawn as a tab because small cream tags share their colour.
 *
 *   1. a thin strip under a button is trim: never a button, never mixed with the surfaces of its colour;
 *   2. trim painted in repeating stripes is "Stripes", drawn as a bar in its stripes (a strip), not a dot;
 *   3. the paper panels are drawn as a box; the small tags of their colour are label bars of their own;
 *   4. a kind of small tags with one big overlay is still a tab;
 *   5. a lone panel a darker shade of the wood (the key cabinet) joins the wood, not the one-offs;
 *   6. past the cap of kinds, a big real surface is still kept.
 *
 *   node tests/trim-and-panels.mjs
 */
import { siteKinds } from "../src/features/studio/themeKinds.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const INK = "rgb(43, 29, 18)", AMBER = "rgb(228, 154, 42)", PAPER = "rgb(247, 236, 211)", MUSTARD = "rgb(216, 178, 60)";
const HAZARD = `repeating-linear-gradient(-45deg, ${MUSTARD} 0px, ${MUSTARD} 5px, ${INK} 5px, ${INK} 10px)`;
const nodes = [];
const add = (n) => nodes.push({ pageId: "p", featureId: "box", ...n });
for (let i = 0; i < 6; i++) {
  const x = i * 300;
  add({ id: `btn${i}`, featureId: "cta-primary", x, y: 0, w: 154, h: 40, content: `Go ${i}`, colour: { text: INK, bg: AMBER } });
  /* The lip: inside the button, as its ::before (an imported pseudo-element reads as inside a control). */
  add({ id: `lip${i}`, featureId: "cta-primary", label: `btn${i}::before`, x: x + 14, y: 36, w: 126, h: 4, art: { background: HAZARD } });
  add({ id: `tag${i}`, x, y: 200, w: 120, h: 24, content: `Drawer ${i}`, colour: { text: INK, bg: PAPER } });
  add({ id: `ink${i}`, x, y: 300, w: 60, h: 16, content: `No. ${i}`, colour: { text: PAPER, bg: INK } });
}
for (let i = 0; i < 3; i++) add({ id: `card${i}`, x: i * 800, y: 500, w: 776, h: 268, colour: { text: INK, bg: PAPER }, art: { background: `repeating-linear-gradient(rgba(0, 0, 0, 0) 0px, rgba(0, 0, 0, 0) 27px, rgb(159, 183, 196) 27px, rgb(159, 183, 196) 28px), ${PAPER}` } });
add({ id: "dim", x: 0, y: 0, w: 1400, h: 1700, colour: { bg: INK } });

const r = siteKinds(nodes, { bg: "rgb(233, 214, 180)" });
const list = r.kinds.map((k) => `${k.name}:${k.parts}${k.tab ? "·tab" : ""}${k.accent ? "·accent" : ""}`).join(", ");
const of = (id) => r.kinds.find((k) => k.ids.includes(id));
check("1. the lip is not a button", of("lip0") && !of("lip0").button && !of("btn0").ids.includes("lip0"), list);
check("…nor one of the ink surfaces", of("lip0") !== of("ink0"), list);
check("2. striped trim is Stripes, drawn as a strip", of("lip0")?.name === "Stripes" && of("lip0").strip === true && of("lip0").accent === false && /repeating-linear-gradient/.test(of("lip0").paint), list);
check("3. the paper panels are a box, not a tab", of("card0") && of("card0").tab === false && of("card0").accent === false && of("card0").strip === false, list);
check("…and the small paper tags a label bar of their own", of("tag0") && of("tag0") !== of("card0") && of("tag0").tab === true, list);
check("4. small ink tags with one big overlay stay a tab", of("ink0")?.tab === true, list);

/* 5–6: the wood rail on three pages and the TV's stand, a darker-wood key cabinet, and eleven kinds of small buttons ahead of it in the count. */
const W = "rgb(90, 58, 33)", DARK = "rgb(74, 46, 26)";
const wood = [];
for (let i = 0; i < 3; i++) wood.push({ id: `rail${i}`, pageId: `p${i}`, featureId: "box", x: 0, y: 0, w: 176, h: 1700, colour: { bg: W } });
for (let i = 0; i < 3; i++) wood.push({ id: i ? `stand${i}` : "stand", pageId: `p${i}`, featureId: "box", x: 300 + i * 40, y: 600, w: 600, h: 800, colour: { bg: W } });
wood.push({ id: "cabinet", pageId: "p1", featureId: "box", x: 300, y: 400, w: 388, h: 268, colour: { bg: DARK } });
for (let c = 0; c < 11; c++) for (let i = 0; i < 12; i++) wood.push({ id: `b${c}-${i}`, pageId: "p0", featureId: "cta-primary", x: 1000 + i * 30, y: c * 40, w: 28, h: 28, colour: { bg: `rgb(${20 + c * 20}, ${200 - c * 15}, ${(c * 70) % 255})` } });
const w = siteKinds(wood, { bg: "rgb(233, 214, 180)" });
const woodKind = w.kinds.find((k) => k.ids.includes("stand"));
check("5. the darker-wood cabinet joins the wood", !!woodKind && woodKind.ids.includes("cabinet"), w.kinds.map((k) => `${k.name}:${k.parts}`).join(", "));
check("6. with eleven kinds of small buttons ahead of it, the wood is still kept", !!woodKind && w.kinds.filter((k) => k.button).length >= 10, w.kinds.map((k) => k.name).join(", "));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
