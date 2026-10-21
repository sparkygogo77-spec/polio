/**
 * A SECTION IS NAMED FOR ITS OWN HEADING, NEVER FOR A BUTTON IT DOES NOT HOLD.
 *
 * J (2026-10-21), on thesolface.site brought in: the hero was named
 * Section "JOIN THE WAVE ↗" (in the board's label, in Elements, in Layers):
 * the header's button. The header is fixed at y 14, so its parts lie inside
 * the hero's box, and `partNames.ts` read "inside" by the box alone. The hero
 * has no part that reads as a heading by itself (its title is an h1 of two
 * spans, "THE" and "SOL FACE"), so the name fell to the first words inside
 * its box, top first: the header's button. The header was named after the
 * same button.
 *
 * Now, between two parts that both carry the page path the capture recorded,
 * one holds the other only when its path continues the holder's; words inside
 * an h1–h4 element are a heading, read across its pieces; and a part's first
 * words never come from a button. The hero is Section "THE SOL FACE", the
 * header Header "THE SOL FACE" (its logo), and every other section keeps the
 * name of its own heading.
 *
 *   node tests/section-names.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { partName } = await jiti.import(join(here, "..", "src", "features", "studio", "partNames.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* thesolface's top as the import leaves it: the parts' own paths, boxes, kinds and words, labels as the capture writes them. */
const H = "body > main > section:nth-of-type(1)", L = "body > main > section:nth-of-type(2)";
const at = (selector, position) => ({ selector, ...(position ? { position } : {}) });
const part = (id, featureId, label, selector, x, y, w, h, extra = {}) => ({ id, pageId: "home", featureId, label, prompt: `Captured from thesolface.site/ as ${selector}.`, content: "", x, y, w, h, from: at(selector, extra.position), ...extra });
const nodes = [
  part("header", "box", "banner · 1 inside", "body > header", 0, 14, 1440, 78, { position: "fixed" }),
  part("bar", "box", "div · 3 inside", "body > header > div", 35, 14, 1370, 78),
  part("logoLink", "box", "link · 2 inside", "body > header > div > a", 56, 28, 170, 51),
  part("logo", "prose", "THE SOL FACE", "body > header > div > a > span:nth-of-type(2) > b", 118, 35, 108, 21, { content: "THE SOL FACE" }),
  part("nav", "prose", "THE LORE", "body > header > div > nav > a:nth-of-type(1)", 526, 47, 48, 13, { content: "THE LORE" }),
  part("join", "cta-primary", "link “JOIN THE WAVE ↗”: JOIN THE WAVE", "body > header > div > div > a", 1258, 27, 136, 52, { content: "JOIN THE WAVE ↗" }),
  part("hero", "box", "section · 5 inside", H, 0, 0, 1440, 991),
  part("eyebrow", "prose", "THE OFFICIAL FACE OF SEEING GREEN ///", `${H} > div:nth-of-type(4) > div:nth-of-type(1) > div:nth-of-type(1)`, 50, 185, 319, 35, { content: "THE OFFICIAL FACE OF SEEING GREEN ///" }),
  part("h1", "box", "heading · 2 inside", `${H} > div:nth-of-type(4) > div:nth-of-type(1) > h1`, 50, 297, 708, 267),
  part("the", "prose", "THE", `${H} > div:nth-of-type(4) > div:nth-of-type(1) > h1 > span:nth-of-type(1)`, 50, 297, 708, 134, { content: "THE", font: { size: 9.72, px: 155.52 } }),
  part("solface", "prose", "SOL FACE", `${H} > div:nth-of-type(4) > div:nth-of-type(1) > h1 > span:nth-of-type(2)`, 50, 431, 736, 133, { content: "SOL FACE", font: { size: 9.72, px: 155.52 } }),
  part("meet", "cta-primary", "link “MEET THE LEGEND ↗”", `${H} > div:nth-of-type(4) > div:nth-of-type(1) > div:nth-of-type(2) > a:nth-of-type(1)`, 50, 785, 192, 58, { content: "MEET THE LEGEND ↗" }),
  part("lore", "box", "section · 3 inside", L, 0, 1080, 1440, 1103),
  part("loreTitle", "value-prop", "HE DOESN'T CHASE THE CANDLE. HE IS IT.", `${L} > div > div:nth-of-type(2) > div:nth-of-type(2) > h2`, 778, 1342, 612, 364, { content: "HE DOESN'T\nCHASE\nTHE CANDLE.\nHE IS IT." }),
  /* A card whose title is the second h3 in its column, in two pieces: read whole. */
  part("card", "box", "article · 3 inside", `${L} > div > div:nth-of-type(3) > article`, 778, 1800, 470, 200),
  part("cardT1", "prose", "THE", `${L} > div > div:nth-of-type(3) > article > h3:nth-of-type(2) > span:nth-of-type(1)`, 800, 1820, 60, 39, { content: "THE" }),
  part("cardT2", "prose", "TRENCH", `${L} > div > div:nth-of-type(3) > article > h3:nth-of-type(2) > span:nth-of-type(2)`, 870, 1820, 120, 39, { content: "TRENCH" }),
  /* Control: a box placed here by hand, no path, over the hero's title: named by what its box holds, as before. */
  part("frame", "box", "div · 2 inside", "", 40, 280, 760, 300, { from: null }),
];
const name = (id) => partName(nodes.find((n) => n.id === id), nodes);

check("the hero is named for its own title, not the header's button", name("hero") === "Section “THE SOL FACE”", name("hero"));
check("the header is named for its logo, not its button", name("header") === "Header “THE SOL FACE”", name("header"));
check("the lore section keeps the name of its own heading", name("lore") === "Section “HE DOESN'T CHASE THE CANDLE. HE IS IT.”", name("lore"));
check("a heading of pieces is named whole", name("h1") === "Heading “THE SOL FACE”" || name("h1") === "Box “THE SOL FACE”", name("h1"));
check("a card whose title is an h3:nth-of-type(2) in pieces is named for the whole title", name("card") === "Box “THE TRENCH”" || name("card") === "Article “THE TRENCH”", name("card"));
check("control: a box placed by hand over the title is named by what its box holds", /THE SOL FACE|THE|SOL FACE/.test(name("frame")), name("frame"));
check("control: a part with words of its own keeps them", name("join").includes("JOIN THE WAVE"), name("join"));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
