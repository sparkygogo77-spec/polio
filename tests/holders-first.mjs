/**
 * A PART PAINTS BENEATH WHAT IT HOLDS.
 *
 * J (2026-10-21), thesolface.site on a fresh import: live, the hero sits on a
 * blue and purple splash (its picture, `n_box_1`, at cover); on the board and
 * in the Preview the hero's left half was plain dark. The splash was drawn.
 * The hero's own fill, rgb(9, 13, 27), was drawn over it: the capture lists
 * the section after its background layers (its pictures and ::after come
 * first in the document), and the board and the published page paint in the
 * document's order. On the page a box's background is always beneath what is
 * in it.
 *
 * `holdersFirst` keeps the document's order but moves each part's holder (by
 * the page path the capture recorded) to just before the first part it
 * holds. Parts that hold nothing of each other keep their order.
 *
 *   node tests/holders-first.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { holdersFirst } = await jiti.import(join(here, "..", "src", "features", "studio", "paintOrder.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const H = "body > main > section:nth-of-type(1)";
const p = (id, selector, extra = {}) => ({ id, pageId: "home", from: selector ? { selector } : null, ...extra });
/* thesolface's top, in the order the document lists it. */
const nodes = [
  p("art", `${H} > div:nth-of-type(1)`),
  p("fade", `${H} > div:nth-of-type(1)::after`),
  p("grid", `${H} > div:nth-of-type(2)`),
  p("glows", `${H} > div:nth-of-type(3)`),
  p("main", "body > main"),
  p("hero", H),
  p("title", `${H} > div:nth-of-type(4) > h1`),
  p("lore", "body > main > section:nth-of-type(2)"),
  p("drawn", null),
  p("heroPressed", H, { state: { group: "g0", option: 0 } }),
];
const ids = (list) => list.map((n) => n.id).join(",");
const out = holdersFirst(nodes);
check("the hero (and main, which holds it) paint beneath the hero's background layers", ids(out) === "main,hero,art,fade,grid,glows,title,lore,drawn,heroPressed", ids(out));
check("nothing is lost or doubled", out.length === nodes.length && new Set(out).size === nodes.length);
check("control: an order already right is kept as it is", holdersFirst(out) === out || ids(holdersFirst(out)) === ids(out));
check("control: parts on another page are not each other's holders", ids(holdersFirst([p("a", `${H} > div`), { ...p("h", H), pageId: "other" }])) === "a,h");

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
