/**
 * LOADING BARS ARE ONE ELEMENT (J, 2026-10-11, on sunkcoin's ranked list):
 * "the bars also should have been, since they're all the same thing,
 * recognized as loading bars within the builder as an element that will
 * likely have that data hook". Its rows each hold a dark track with an
 * orange or a blue level bar in it; the Colours preview showed them as
 * "Bars", "Bars 2", "Bars 3".
 *
 *   1. a track holding a level bar from its left edge is one Loading bar, the level its fill;
 *   2. a lone stripe or dot is no loading bar;
 *   3. the Colours kinds: the tracks are "Loading bars", each level colour a "Loading bar level";
 *   4. they are not "Bars"; the preview draws them as one chip;
 *   5. Export for code hooks them loading-bar and loading-bar-level where the site gave none.
 *
 *   node tests/loading-bars.mjs
 */
import { readComponents } from "../src/features/studio/components.ts";
import { previewPlan, siteKinds } from "../src/features/studio/themeKinds.ts";
import { partRoles } from "../src/features/studio/partRoles.ts";
import { toKit } from "../src/features/studio/kitExport.ts";
import { readFileSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const NAVY = "rgb(16, 38, 66)", TRACK = "rgb(10, 22, 40)", ORANGE = "rgb(255, 90, 31)", BLUE = "rgb(80, 150, 200)", INK = "rgb(240, 240, 240)", PAGE = "rgb(6, 14, 30)";
const nodes = [];
const add = (n) => nodes.push({ pageId: "p", featureId: "box", ...n });
add({ id: "page", x: 0, y: 0, w: 1440, h: 3000, colour: { text: INK } });
for (let i = 0; i < 12; i++) {
  const y = 400 + i * 52, hot = i % 3 !== 2;
  add({ id: `row${i}`, x: 10, y, w: 1100, h: 50, colour: { text: INK, bg: NAVY } });
  add({ id: `stripe${i}`, x: 10, y, w: 4, h: 50, colour: { bg: hot ? ORANGE : BLUE } });
  add({ id: `track${i}`, x: 900, y: y + 19, w: 120, h: 10, colour: { bg: TRACK } });
  add({ id: `level${i}`, x: 900, y: y + 19, w: 40 + i * 6, h: 10, colour: { bg: hot ? ORANGE : BLUE } });
}
for (let i = 0; i < 3; i++) add({ id: `dot${i}`, x: 1200, y: 100 + i * 30, w: 12, h: 12, radius: 6, colour: { bg: ORANGE } });

const comps = readComponents(nodes);
const t0 = comps.byId.get("track0");
check("1. a track holding a level bar is one Loading bar", t0?.kind === "progress", t0?.kind);
check("…its level bar is its fill", t0?.layers.some((l) => l.id === "level0" && l.role === "fill"), JSON.stringify(t0?.layers));
check("…every row's is", comps.list.filter((c) => c.kind === "progress").length === 12);
check("2. a stripe on a row's edge is no loading bar", comps.byId.get("stripe0")?.kind !== "progress" && !comps.byId.get("row0")?.layers.some((l) => l.id === "track0"));
check("…nor a dot", comps.byId.get("dot0")?.kind !== "progress");

const r = siteKinds(nodes, { bg: PAGE });
const list = r.kinds.map((k) => `${k.name}:${k.parts}${k.progress ? `·${k.progress}` : ""}`).join(", ");
const by = (fill) => r.kinds.find((k) => k.fill === fill);
check("3. the tracks are Loading bars", by(TRACK)?.name === "Loading bars" && by(TRACK)?.progress === "track", list);
check("…the orange level is a loading bar's level", by(ORANGE)?.progress === "level" && /^Loading bar level/.test(by(ORANGE)?.name), list);
check("…and so is the blue", by(BLUE)?.progress === "level", list);
check("4. none is named Bars", !r.kinds.some((k) => k.progress && /^Bars/.test(k.name)), list);
check("…all are drawn small, not as a panel's box", r.kinds.filter((k) => k.progress).every((k) => k.accent));
const ui = readFileSync(new URL("../src/features/studio/SiteColours.tsx", import.meta.url), "utf8");
const plan = previewPlan(r);
check("…and the preview draws every loading-bar colour in one chip", /data-preview-part="loading-bars"/.test(ui) && r.kinds.filter((k) => k.progress).every((k) => plan.bars.includes(k) && !plan.accents.includes(k)));

const roles = partRoles(nodes);
check("5. the hook names: track loading-bar, level loading-bar-level", roles.get("track3") === "loading-bar" && roles.get("level3") === "loading-bar-level" && !roles.has("stripe3"));
const html = `<!doctype html><html><head><title>A</title></head><body><main><div id="track0"><div id="level0"></div></div><div id="track1"><div id="level1"></div></div><div id="row0" data-hook="ranked-row">x</div></main></body></html>`;
const parts = Object.fromEntries(["track0", "level0", "track1", "level1"].map((id) => [id, { label: "div · 1 inside", role: roles.get(id) }]));
const out = toKit({ files: [{ path: "index.html", content: html }], name: "A", pages: [{ file: "index.html", title: "Home" }], parts }).files.find((f) => f.path.endsWith("index.html"))?.content ?? "";
check("…Export for code hooks them by it", /id="track0"[^>]*data-hook="loading-bar"/.test(out) && /id="level0"[^>]*data-hook="loading-bar-level"/.test(out) && /data-hook="loading-bar-2"/.test(out), out.match(/<div[^>]*>/g)?.slice(0, 5).join(" "));
check("…and a hook the site gave stays", /data-hook="ranked-row"/.test(out));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
