/**
 * A PART INSIDE A SECTION WITH NO HEADING IS NAMED BY THAT SECTION'S ID.
 *
 * thesolface.site's `#community` has stickers and buttons but no heading. The
 * section itself is named by its id, Section “Community” (section-ids.mjs),
 * but a picture inside it was "Picture in “THE SOL FACE”": no holder up to
 * the page body had a heading, so the name came from the hero's title above
 * it, a section away. Now, holder by holder from the smallest, a holder's own
 * heading names its parts, and where it has none its id does: "Picture in
 * “Community”". A holder with a heading still wins over a larger one with an
 * id, and a page with no headings at all can still name a part by its
 * section's id.
 *
 *   node tests/parts-in-id.mjs
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

const M = "body > main", H = `${M} > section:nth-of-type(1)`, C = `${M} > section:nth-of-type(8)`;
const part = (id, featureId, label, selector, x, y, w, h, extra = {}) => ({ id, pageId: "home", featureId, label, prompt: `Captured from thesolface.site/ as ${selector}.`, content: "", x, y, w, h, from: { selector, ...(extra.htmlId ? { id: extra.htmlId } : {}) }, ...extra });
const nodes = [
  part("main", "box", "main · 3 inside", M, 0, 0, 1440, 10000),
  /* The hero, with the page's title. */
  part("hero", "box", "section · 2 inside", H, 0, 0, 1440, 991, { htmlId: "top" }),
  part("title", "heading", "THE SOL FACE", `${H} > h1`, 100, 200, 800, 200, { content: "THE SOL FACE" }),
  /* #community: no heading of its own. */
  part("community", "box", "section · 3 inside", C, 0, 9106, 1440, 791, { htmlId: "community" }),
  part("sticker", "picture", "img", `${C} > div > img`, 80, 9200, 200, 200, { picture: {} }),
];
/* A card inside #community with its own heading: it names what it holds. */
const withCard = [
  ...nodes,
  part("card", "box", "div · 2 inside", `${C} > div:nth-of-type(2)`, 600, 9200, 400, 400),
  part("cardTitle", "heading", "JOIN US", `${C} > div:nth-of-type(2) > h3`, 620, 9220, 300, 40, { content: "JOIN US" }),
  part("cardPic", "picture", "img", `${C} > div:nth-of-type(2) > img`, 620, 9300, 200, 200, { picture: {} }),
];
const name = (id, list = nodes) => partName(list.find((n) => n.id === id), list);

check("a picture in a section with no heading is named by the section's id", name("sticker") === "Picture in “Community”", name("sticker"));
check("control: a smaller holder's own heading wins over the section's id", name("cardPic", withCard) === "Picture in “JOIN US”", name("cardPic", withCard));
check("control: a part in a headed section keeps that heading", (() => { const l = [...nodes, part("heroPic", "picture", "img", `${H} > img`, 1000, 300, 200, 200, { picture: {} })]; return name("heroPic", l) === "Picture in “THE SOL FACE”"; })());
const bare = nodes.filter((n) => n.featureId !== "heading");
check("a page with no headings still names a part by its section's id", name("sticker", bare) === "Picture in “Community”", name("sticker", bare));
check("control: a part with no holder that has a heading or id is its kind alone", name("sticker", bare.map((n) => n.id === "community" ? { ...n, from: { selector: n.from.selector } } : n)) === "Picture", name("sticker", bare.map((n) => n.id === "community" ? { ...n, from: { selector: n.from.selector } } : n)));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
