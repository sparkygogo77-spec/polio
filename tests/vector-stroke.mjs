/**
 * A CAPTURED ICON'S OUTLINES ARE DRAWN AT ITS OWN WIDTH, CAPS AND JOINS, AND ITS
 * PIXEL EDGES STAY HARD.
 *
 * Sink carries a one-colour line icon as strokes for the drawn icon (the
 * Builder can recolour it), and, since check-svg-paint.mjs, how its outlines
 * were drawn when that was not 2 wide and round: `vector.stroke` (a 3-wide
 * square-capped menu), and `vector.crisp` for one drawn on the pixel grid.
 * The drawn icon and a button's glyph draw with them; an
 * icon without it keeps the drawn icon's own 2 and round; and only values SVG
 * takes are written, since they come from a document.
 *
 *   node tests/vector-stroke.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const v = await jiti.import(join(here, "..", "src", "features", "studio", "vector.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const menu = { viewBox: "0 0 24 24", paths: [{ d: "M4 6h16M4 12h16M4 18h16", share: 0.3 }] };
const attrs = (m) => /stroke-width="([^"]+)" stroke-linecap="([^"]+)" stroke-linejoin="([^"]+)"/.exec(m)?.slice(1) ?? null;

const own = v.vectorMarkup({ ...menu, stroke: { width: 3, cap: "square", join: "miter" } }, { stroke: true, width: 2 });
check("a captured 3-wide square-capped outline is drawn 3 wide, square, mitred", JSON.stringify(attrs(own)) === JSON.stringify(["3", "square", "miter"]), JSON.stringify(attrs(own)));
const plain = v.vectorMarkup(menu, { stroke: true, width: 2 });
check("control: an icon that says nothing is drawn 2 wide and round", JSON.stringify(attrs(plain)) === JSON.stringify(["2", "round", "round"]), JSON.stringify(attrs(plain)));
const odd = v.vectorMarkup({ ...menu, stroke: { width: "3\" onload=\"x", cap: "wiggly", join: "<b>" } }, { stroke: true, width: 2 });
check("only values SVG takes are written: a width that is no number, a cap or join SVG has not, fall back", JSON.stringify(attrs(odd)) === JSON.stringify(["2", "round", "round"]) && !/onload|wiggly|<b>/.test(odd), JSON.stringify(attrs(odd)));
const kept = v.simplify({ ...menu, stroke: { width: 3, cap: "square", join: "miter" } }, 6);
check("simplifying keeps how it is drawn", kept.stroke?.width === 3 && kept.stroke?.cap === "square", JSON.stringify(kept.stroke));
const solid = v.vectorMarkup({ ...menu, stroke: { width: 3, cap: "square" } }, { stroke: false });
check("a solid icon is still fills, whatever its outlines were", /fill="currentColor"\/>/.test(solid) && !/stroke-width/.test(solid));

const crisp = v.vectorMarkup({ ...menu, crisp: true }, { stroke: false });
check("a captured pixel icon keeps its hard edges (shape-rendering crispEdges)", /shape-rendering="crispEdges"/.test(crisp) && !/shape-rendering/.test(v.vectorMarkup(menu, { stroke: false })), crisp.slice(0, 160));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
