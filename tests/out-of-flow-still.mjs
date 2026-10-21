/**
 * A PART OUT OF THE FLOW NEITHER PUSHES NOR IS PUSHED BY THE HEALING.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, a new site, 2026-10-21). The capture is right: its
 * header is fixed at 14, 78 tall, and its page is 10382 tall. The board was
 * not. The healing (`fitRows`, `textFit.ts`) read every top-level part as a
 * sibling standing in a column, whatever the capture said about its position:
 *   · the fixed header (y 14) stood "under" `body > main` (y 0), so it was
 *     carried down by all of main's word growth and landed at y 662, in the
 *     middle of the hero;
 *   · the skip link, fixed at y -90 off the top of the window, grew 4px, and
 *     `body > main` stood under it, so the whole page moved down 4px.
 * A part the capture records as `position: fixed` or `absolute` (carried as
 * `from.position`) takes no room in the flow: on the page, nothing above it
 * moves it and its own growth moves nothing beside it. It still travels with
 * the box that holds it (rule 2), and it still grows to its own words.
 *
 *   node tests/out-of-flow-still.mjs
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

/* The shape of thesolface's top level, as the capture recorded it: the parts and paths are its own, the sizes rounded. */
const box = (id, path, x, y, w, h, extra = {}) => ({ id, path, x, y, w, h, drew: h, words: false, ...extra });
const boxes = [
  box("skip", "body > a", 12, -90, 148, 49, { words: true, drew: 53, out: true }),
  box("bar", "body > div:nth-of-type(1)", 0, 0, 1440, 3, { out: true }),
  box("main", "body > main", 0, 0, 1440, 9897),
  box("hero", "body > main > section:nth-of-type(1)", 0, 0, 1440, 991),
  box("title", "body > main > section:nth-of-type(1) > h1", 50, 297, 708, 267, { words: true, drew: 267 + 41 }),
  box("glow", "body > main > section:nth-of-type(1) > div", 910, 179, 680, 680, { out: true }),
  box("lore", "body > main > section:nth-of-type(2)", 0, 1080, 1440, 1103),
  box("header", "body > header", 0, 14, 1440, 78, { out: true }),
  box("nav", "body > header > nav", 526, 47, 325, 13, { words: true, drew: 13 }),
  box("footer", "body > footer", 0, 9897, 1440, 485),
];
const fit = new Map(fitRows(boxes, undefined, 1440).map((f) => [f.id, f]));
const at = (id) => fit.get(id)?.y ?? boxes.find((b) => b.id === id).y;
const tall = (id) => fit.get(id)?.h ?? boxes.find((b) => b.id === id).h;

check("the fixed header stays at the 14 the capture recorded, though main grew under it", at("header") === 14, `header at ${at("header")}`);
check("…and its nav stays inside it, at 47", at("nav") === 47, `nav at ${at("nav")}`);
check("the skip link growing 4px off the top of the window moves nothing: main stays at 0", at("main") === 0, `main at ${at("main")}`);
check("…and the hero inside main stays at 0", at("hero") === 0, `hero at ${at("hero")}`);
check("the skip link still grows to its own words", tall("skip") === 53, `skip ${tall("skip")} tall`);
check("an absolute part in the hero is not pushed by the title's growth: the glow stays at 179", at("glow") === 179, `glow at ${at("glow")}`);
check("control: words that grew still push what follows in the flow — lore moves down by the title's 41", at("lore") === 1080 + 41, `lore at ${at("lore")}`);
check("control: and the footer below main moves by main's growth", at("footer") === 9897 + 41, `footer at ${at("footer")}`);
check("control: main grows by the 41 its words needed, not by the glow or the header", tall("main") === 9897 + 41, `main ${tall("main")} tall`);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
