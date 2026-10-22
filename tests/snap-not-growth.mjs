/**
 * A PIXEL OF ROUNDING IS NOT GROWTH.
 *
 * The capture snaps each box's edges to whole pixels (dump.mjs `edges`), and
 * the board reads what a part drew as a whole number (`offsetHeight`). So a
 * box the page drew 364.95 tall can be recorded 364 and read back 365.
 * thesolface's lore heading (four lines of 91.24) was exactly that, and so
 * were the story heading (183, drew 184) and a manifesto paragraph (41, drew
 * 42). Each was taken as words that needed one more pixel, and every section
 * under them moved down by 1, 3 in all.
 *
 * Now a part's words grow it only when they drew more than a pixel over
 * its height. Real growth (a line more) moves the page as before.
 *
 *   node tests/snap-not-growth.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { fitRows } = await jiti.import(join(here, "..", "src", "features", "studio", "textFit.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* thesolface's #lore and #story as the capture recorded them, with the drawn heights the board read. */
const box = (id, path, x, y, w, h, extra = {}) => ({ id, path, x, y, w, h, drew: h, words: false, ...extra });
const M = "body > main", L = `${M} > section:nth-of-type(2)`, S = `${M} > section:nth-of-type(3)`;
const page = (loreDrew, storyDrew) => [
  box("main", M, 0, 0, 1440, 9897),
  box("lore", L, 0, 1080, 1440, 1103),
  box("loreTitle", `${L} > div > h2`, 778, 1377, 612, 364, { words: true, drew: loreDrew }),
  box("loreText", `${L} > div > p`, 778, 1780, 612, 120, { words: true, drew: 120 }),
  box("story", S, 0, 2183, 1440, 1350),
  box("storyTitle", `${S} > div > h2`, 100, 2432, 900, 183, { words: true, drew: storyDrew }),
  box("footer", "body > footer", 0, 9897, 1440, 485),
];
const run = (boxes) => { const fit = new Map(fitRows(boxes, undefined, 1440).map((f) => [f.id, f])); return { at: (id) => fit.get(id)?.y ?? boxes.find((b) => b.id === id).y, tall: (id) => fit.get(id)?.h ?? boxes.find((b) => b.id === id).h }; };

const snapped = run(page(365, 184));
check("a heading that drew a pixel over its height moves nothing: the paragraph under it stays at 1780", snapped.at("loreText") === 1780, `at ${snapped.at("loreText")}`);
check("…its section keeps its 1103", snapped.tall("lore") === 1103, `${snapped.tall("lore")} tall`);
check("…and the footer stays at 9897", snapped.at("footer") === 9897, `at ${snapped.at("footer")}`);
const grown = run(page(364 + 91, 183));
check("control: a heading that drew a line more still pushes the paragraph down by it", grown.at("loreText") === 1780 + 91, `at ${grown.at("loreText")}`);
check("control: …and the footer by the same", grown.at("footer") === 9897 + 91, `at ${grown.at("footer")}`);
const two = run(page(366, 183));
check("control: two pixels over is growth", two.at("footer") === 9897 + 2, `at ${two.at("footer")}`);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
