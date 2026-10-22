/**
 * A SECTION WITH NO HEADING IS NAMED BY THE PAGE'S OWN ID FOR IT.
 *
 * thesolface.site names its sections `#top`, `#lore`, `#community`, and its
 * menu links to them. The capture did not record ids, so a section with no
 * heading was named by its first words ("Section “X”, a sticker's caption")
 * or only "Section". The capture now records the id (`from.id`,
 * capture/site/capture/check-art.mjs), and a part with no heading of its own
 * is named by it: Section “Community”. A heading still wins, and an id a
 * machine made (`radix-:r1:`, `w-node-4f2a`) or a framework's wrapper
 * (`__next`) is no name.
 *
 *   node tests/section-ids.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { partName, idWords } = await jiti.import(join(here, "..", "src", "features", "studio", "partNames.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const C = "body > main > section:nth-of-type(8)", L = "body > main > section:nth-of-type(2)";
const part = (id, featureId, label, selector, x, y, w, h, extra = {}) => ({ id, pageId: "home", featureId, label, prompt: `Captured from thesolface.site/ as ${selector}.`, content: "", x, y, w, h, from: { selector, ...(extra.htmlId ? { id: extra.htmlId } : {}) }, ...extra });
const nodes = [
  /* #community: a grid of stickers, words but no heading. */
  part("community", "box", "section · 2 inside", C, 0, 9106, 1440, 900, { htmlId: "community" }),
  part("sticker", "prose", "gm frens", `${C} > div > p`, 80, 9200, 200, 30, { content: "gm frens" }),
  /* #lore: has its own heading, which wins. */
  part("lore", "box", "section · 2 inside", L, 0, 1080, 1440, 1103, { htmlId: "lore" }),
  part("loreTitle", "heading", "HE IS IT.", `${L} > div > h2`, 778, 1342, 612, 364, { content: "HE IS IT." }),
  /* An empty band with an id of its own: named by it. */
  part("top", "box", "section", "body > main > section:nth-of-type(1)", 0, 0, 1440, 40, { htmlId: "top" }),
  /* Controls: a machine's id and a framework's wrapper say nothing. */
  part("radix", "box", "div", "body > div:nth-of-type(3)", 0, 3000, 400, 40, { htmlId: "radix-:r1:" }),
  part("next", "box", "div", "body > div:nth-of-type(4)", 0, 3100, 400, 40, { htmlId: "__next" }),
];
const name = (id) => partName(nodes.find((n) => n.id === id), nodes);

check("a section with no heading is named by its id", name("community") === "Section “Community”", name("community"));
check("an empty band is named by its id", name("top") === "Section “Top”", name("top"));
check("control: a section's own heading wins over its id", name("lore") === "Section “HE IS IT.”", name("lore"));
check("control: a machine's id is no name", !/radix|r1/i.test(name("radix")), name("radix"));
check("control: a framework's wrapper id is no name", !/next/i.test(name("next")), name("next"));
check("ids read as words", idWords("lore-section") === "Lore section" && idWords("howToBuy") === "How to buy" && idWords("w-node-4f2a") === null, `${idWords("lore-section")} | ${idWords("howToBuy")} | ${idWords("w-node-4f2a")}`);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
