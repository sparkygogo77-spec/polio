/**
 * A HEADING'S WORDS ARE ALL DRAWN, COMMAS AND ALL.
 *
 * trendtrader.pro/ttp: "50% · $5,000 in market buys" was drawn "50% · $5";
 * "one allocation, illustrated." as "one allocation". A captured heading
 * lands as a value-prop, and the part took the first item of its content
 * read as a comma list (`items`), a rule for lists of names. A value-prop is
 * one sentence: it breaks only where its words have a line of their own.
 * gotchi.gg and stonkfun.xyz each had two headings cut the same way.
 * And a captured heading the page broke with a `<br>` (sink writes it as
 * a line break in its words) draws each of its lines, broken there.
 *
 *   node tests/heading-commas.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (id, content, extra = {}) => ({
  id, pageId: "p0", featureId: "value-prop", label: id, prompt: "", content, data: "", x: 0, y: 0, w: 420, h: 22, groupId: null,
  options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, ...extra,
});
const words = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h } })).replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'");
const captured = { from: { url: "https://trendtrader.pro/ttp/", host: "trendtrader.pro", selector: "body > main > section > div > h4" }, font: { face: "DM Sans", px: 16, size: 0.625, weight: 500 } };

for (const s of ["50% · $5,000 in market buys", "one allocation, illustrated.", "a company treasury, from the business half."]) {
  const got = words(node("h", s, captured));
  check(`the captured heading "${s}" is drawn whole`, got.includes(s), got);
}
const typed = words(node("v", "Fast, private, yours"));
check("a heading typed by hand with commas is drawn whole too", typed.includes("Fast, private, yours"), typed);
const broken = renderToStaticMarkup(React.createElement(Block, { node: node("b", "What’s next for\nTrendTrader Pro & TTP.", captured), t, palette, mode: "live", size: { w: 750, h: 112 } }));
check("a captured heading broken by the page (a <br>, \\n in its words) draws both lines, broken there", /What’s next for<br\/>TrendTrader Pro &amp; TTP\./.test(broken), broken.replace(/style="[^"]*"/g, "").slice(0, 300));
const lines = words(node("l", "The first line\nThe second line"));
check("control: words typed on lines of their own still draw their first line as the sentence", lines.includes("The first line") && !lines.includes("The second line"), lines);
check("control: an empty value-prop shows its placeholder sentence", /One sentence/.test(words(node("e", ""))));

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
