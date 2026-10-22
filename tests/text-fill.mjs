/**
 * WORDS PAINTED WITH A GRADIENT ARE LETTERS, NOT A BOX.
 *
 * trendtrader.pro/ttp's title "TTP" is a teal gradient seen only through its
 * letters (`background-clip: text`, the words transparent). sink carries the
 * gradient as `art.background` and, now, the clip as `art.backgroundClip`;
 * drawn without the clip the export showed a teal rectangle where the word
 * was. The part keeps the clip (and the webkit spelling Chrome still wants).
 *
 *   node tests/text-fill.mjs
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
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (art) => ({
  id: "ttp", pageId: "p0", featureId: "value-prop", label: "TTP", prompt: "", content: "TTP", data: "", x: 100, y: 208, w: 164, h: 108, groupId: null,
  options: {}, priority: "must", custom: false, locked: false, link: null, colour: { text: "rgba(0, 0, 0, 0)" }, font: { face: "DM Sans", px: 108, size: 4.21875, weight: 500 }, texture: null,
  from: { url: "https://trendtrader.pro/ttp/", host: "trendtrader.pro", selector: "body > main > section > div > h1" }, art,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h } }));
const grad = "linear-gradient(92deg, rgb(52, 211, 153), rgb(34, 211, 238))";
const html = draw(node({ background: grad, backgroundOptions: ["auto", "0% 0%", "repeat"], backgroundClip: "text" }));
const styleWith = (h) => ([...h.matchAll(/style="([^"]*)"/g)].map((m) => m[1]).find((s) => s.includes("linear-gradient")) ?? "");
const s = styleWith(html);
check("the gradient is drawn", s.includes("linear-gradient(92deg"), s.slice(0, 200));
check("…clipped to the letters (background-clip: text, and -webkit-)", /(^|;)\s*background-clip:\s*text/.test(s) && /-webkit-background-clip:\s*text/.test(s), s.slice(0, 300));
const plain = styleWith(draw(node({ background: grad })));
check("control: a gradient box with no clip is a box", plain.includes("linear-gradient") && !/background-clip/.test(plain), plain.slice(0, 200));

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
