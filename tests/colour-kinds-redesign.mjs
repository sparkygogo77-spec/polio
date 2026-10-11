/**
 * COLOURS ON A BIG MULTI-PAGE SITE (J, 2026-10-11, on the PonsStars redesign):
 * the 31 worded wood bars came out a tiny "Bars" dot, the 116 brass screws a
 * big striped box named after the one ruler painted the same brass, the paper
 * forms and wood boards had no box at all, and the names ("Panels: Last
 * audited", "Panels 2", "Main fill") told nothing. Each came from a rule that
 * judged a kind by the wrong number: its share of every page added together,
 * its biggest part, how many parts wear it. On six tall pages shaped like the
 * redesign's:
 *
 *   1. short bars with words on them are drawn as label bars, never a dot;
 *   2. screws are one small round swatch, no piece, sitting in the board they are on;
 *   3. the paper forms and the wood boards each get a box, though small labels are worn by more parts;
 *   4. kinds are named by their parts' hooks ("Drawer labels", "Screws"), never by the words on one part;
 *   5. on the saved redesign board, when there is one: no worded kind is a dot,
 *      every panel worn twice or more has a box, and no name is one part's words.
 *
 *   node tests/colour-kinds-redesign.mjs
 */
import { existsSync } from "node:fs";
import { previewPlan, siteKinds, PANEL_W, PANEL_H } from "../src/features/studio/themeKinds.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const PAGE = "rgb(236, 220, 186)", DARK = "rgb(43, 29, 18)", CREAM = "rgb(255, 248, 236)", WOOD = "rgb(90, 42, 26)", PAPER = "rgb(246, 239, 220)", BRASS = "rgb(201, 162, 72)";
const BRASS_PAINT = "linear-gradient(rgb(243, 210, 122), rgb(138, 106, 31))";
const nodes = [];
const add = (n) => nodes.push({ featureId: "box", ...n });
const pages = ["play", "profile", "match", "board", "library", "lab"];
let n = 0;
for (const [pi, pageId] of pages.entries()) {
  add({ id: `${pageId}-top`, pageId, x: 0, y: 0, w: 2327, h: 3000, colour: { text: DARK } });
  /* Two wood boards a page, each with four screws on its corners and a few words on it. */
  for (let b = 0; b < 2; b++) {
    const x = 300 + b * 700 + pi * 37, y = 400 + pi * 53;
    add({ id: `${pageId}-board${b}`, pageId, x, y, w: 520, h: 300, hooks: { "data-hook": `${pageId}-${["admin-key", "recordings"][b]}-board` }, colour: { bg: WOOD } });
    add({ id: `${pageId}-board${b}-words`, pageId, x: x + 20, y: y + 60, w: 300, h: 20, content: "Enter the admin key", colour: { text: CREAM } });
    for (const [cx, cy] of [[6, 6], [504, 6], [6, 284], [504, 284]]) add({ id: `s${n}`, pageId, x: x + cx, y: y + cy, w: 10, h: 10, radius: 5, hooks: { "data-hook": `${pageId}-screw-${n++}` }, art: { background: BRASS_PAINT }, colour: { bg: BRASS } });
  }
  /* Five worded drawer labels a page (31 on the site), dark wood, 16 tall. */
  for (let l = 0; l < (pi === 0 ? 6 : 5); l++) add({ id: `${pageId}-label${l}`, pageId, x: 40 + pi * 11, y: 900 + l * 40 + pi * 7, w: 200, h: 16, hooks: { "data-hook": `${pageId}-drawer-label-${l}` }, content: `DRAWER ${l + 1} · A TO Z`, colour: { text: CREAM, bg: DARK } });
  /* Lots of small tags in four colours: worn by more parts than the boards and forms. */
  for (const [ti, tag] of ["rgb(30, 90, 60)", "rgb(120, 30, 30)", "rgb(30, 50, 120)", "rgb(90, 90, 20)"].entries()) {
    for (let t = 0; t < 12; t++) add({ id: `${pageId}-tag${ti}-${t}`, pageId, x: 1500 + t * 60 + pi * 5, y: 1200 + ti * 40 + pi * 9, w: 56, h: 22, content: `T${t}`, hooks: { "data-hook": `${pageId}-case-tag-${ti}-${t}` }, colour: { text: CREAM, bg: tag } });
  }
}
/* One paper form on four of the pages, ruled like a notebook. */
for (const [pi, pageId] of pages.slice(0, 4).entries()) add({ id: `${pageId}-form`, pageId, x: 1300 + pi * 21, y: 300 + pi * 17, w: 560, h: 340, hooks: { "data-hook": `${pageId}-record-coin-form` }, art: { background: "repeating-linear-gradient(rgb(246, 239, 220) 0px, rgb(246, 239, 220) 23px, rgb(180, 200, 220) 24px)" }, colour: { bg: PAPER } });
/* The lab bench ruler, painted the same brass as the screws. */
add({ id: "ruler", pageId: "lab", x: 200, y: 2000, w: 420, h: 36, hooks: { "data-hook": "lab-bench-ruler" }, art: { background: BRASS_PAINT }, colour: { bg: BRASS } });

const site = siteKinds(nodes, { bg: PAGE });
const plan = previewPlan(site);
const list = site.kinds.map((k) => `${k.name}:${k.parts}${k.accent ? "·small" : k.tab ? "·label" : k.strip ? "·strip" : k.piece ? "·piece" : ""}`).join(", ");
const by = (fill) => site.kinds.find((k) => k.fill === fill && !k.button);
const labels = by(DARK), screws = by(BRASS), wood = by(WOOD), paper = by(PAPER);

check("1. worded drawer labels are not a dot", !!labels && labels.accent === false, list);
check("…they are drawn as label bars", plan.tabs.includes(labels), plan.tabs.map((k) => k.name).join(", "));
check("2. the screws are a small accent, not a piece named after the ruler", !!screws && screws.accent === true && screws.piece === false, list);
check("…round, like their parts", screws?.round === true);
check("…sitting in the wood boards' box", screws && wood && screws.inside === site.kinds.indexOf(wood), `inside ${screws?.inside}, wood ${site.kinds.indexOf(wood)}`);
check("…and drawn as a swatch", plan.accents.includes(screws));
check("3. the wood boards get a box", plan.surfaces.includes(wood), plan.surfaces.map((k) => k.name).join(", "));
check("…and the paper forms", plan.surfaces.includes(paper), plan.surfaces.map((k) => k.name).join(", "));
check("4. kinds are named by their hooks", labels?.name === "Drawer labels" && screws?.name === "Screws", list);
check("…and the boards and forms by what they are", /boards$/i.test(wood?.name ?? "") && /forms$/i.test(paper?.name ?? ""), list);
check("…never by the words on one part", !site.kinds.some((k) => k.name.includes(":")), list);

/* 5. The saved redesign board, when this checkout has one (`npm run board -- refresh redesign`). */
const saved = new URL("./fixtures/boards/redesign.json.gz", import.meta.url);
if (existsSync(saved)) {
  const { boardSite } = await import("../scripts/colour-kinds.mjs").catch(() => ({}));
  const real = boardSite ? boardSite("redesign") : null;
  if (real) {
    const rp = previewPlan(real);
    const worded = real.kinds.filter((k) => !k.button && k.wordsParts * 2 >= k.parts && rp.accents.includes(k));
    check("5. on the redesign, no kind with words on it is a dot", !worded.length, worded.map((k) => k.name).join(", "));
    const panels = real.kinds.filter((k) => !k.button && !k.accent && !k.tab && !k.strip && !k.progress && k.w >= PANEL_W && k.h >= PANEL_H && k.parts >= 2);
    const missing = panels.filter((k) => !rp.surfaces.includes(k)).slice(0, 6 - Math.min(6, rp.surfaces.length));
    check("…every panel worn twice or more has a box", !missing.length, missing.map((k) => k.name).join(", "));
    check("…no name is one part's words", !real.kinds.some((k) => k.name.includes(":")), real.kinds.map((k) => k.name).join(", "));
  } else console.log("  --   no saved redesign board reader (scripts/colour-kinds.mjs#boardSite): 5 skipped");
} else console.log("  --   no saved redesign board: 5 skipped");

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
