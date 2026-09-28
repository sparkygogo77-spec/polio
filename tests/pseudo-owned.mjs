/**
 * A PSEUDO-ELEMENT IS ITS ELEMENT'S, AND MOVES WITH IT.
 *
 * Sink's capture now draws `::before` and `::after` as parts of their own,
 * with a path that ends on the element they belong to: trumpmorty.fun's remote
 * key `… > a:nth-of-type(1)` has its gloss at `… > a:nth-of-type(1)::before`.
 * `owns.ts#under` read ownership only through " > ", so the gloss was nobody's
 * child: the word fit (`textFit.ts#fitRows`) placed it as a sibling standing
 * under the key and pushed it down by the key's move AND its growth (4848
 * against the captured 4835, the key itself moving 4), over the key's new
 * number line. Owned, it is carried by exactly the key's move and keeps the
 * offset the capture recorded.
 *
 *   node tests/pseudo-owned.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { under } = await jiti.import(join(here, "..", "src", "features", "studio", "owns.ts"));
const { fitRows } = await jiti.import(join(here, "..", "src", "features", "studio", "textFit.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const K = "body > main > section:nth-of-type(6) > div > div:nth-of-type(2) > div:nth-of-type(2)";
check("a ::before is under the element it belongs to", under(`${K} > a:nth-of-type(1)`, `${K} > a:nth-of-type(1)::before`));
check("…and an ::after", under(`${K} > a:nth-of-type(1)`, `${K} > a:nth-of-type(1)::after`));
check("control: a sibling's ::before is not", !under(`${K} > a:nth-of-type(1)`, `${K} > a:nth-of-type(2)::before`));
check("control: nor is a longer name that merely starts the same", !under(`${K} > a:nth-of-type(1)`, `${K} > a:nth-of-type(11)::before`));

/* The first row of the remote, as captured; the section above it grew 4, and the key's words drew 9 taller. */
const b = (id, path, x, y, w, h, extra = {}) => ({ id, path, x, y, w, h, drew: h, ...extra });
const S = "body > main > section:nth-of-type(6)";
const boxes = [
  b("head", `${S} > div > div:nth-of-type(1)`, 130, 4628, 1180, 52, { words: true, drew: 56 }),
  b("grid", K, 445, 4825, 550, 320),
  b("key", `${K} > a:nth-of-type(1)`, 445, 4825, 173, 96, { words: true, drew: 105 }),
  b("num", `${K} > a:nth-of-type(1) > small`, 520, 4850, 22, 26, { words: true }),
  b("gloss", `${K} > a:nth-of-type(1)::before`, 457, 4835, 149, 25),
];
const put = new Map(fitRows(boxes, undefined, 1440).map((f) => [f.id, f]));
const at = (id) => put.get(id)?.y ?? boxes.find((x) => x.id === id).y;
const keyMoved = at("key") - 4825, glossMoved = at("gloss") - 4835;
check("the key's gloss moves exactly as far as the key", glossMoved === keyMoved, `key ${keyMoved}, gloss ${glossMoved}`);
check("…so it stays 10px inside the key's top, as captured", at("gloss") - at("key") === 10, `${at("key")} ${at("gloss")}`);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
