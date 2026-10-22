/**
 * A CHIP IN A SENTENCE IS DRAWN WITH ITS FILL.
 *
 * parasiteonsol.fun's "HOST" tag is a run of its heading (sink folds it
 * back in) with a dark fill and padding: `{ text, colour, bg, pad, radius }`.
 * Drawn with its ink alone it was white words on the cream page, gone. The
 * run wears its fill, padding and rounding, and is never merged into the
 * words beside it.
 *
 *   node tests/run-chip.mjs
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
const { merged } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "spans.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "light" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const chip = { text: "HOST", colour: "rgb(255, 255, 255)", face: "Silkscreen", bg: "rgb(43, 24, 56)", pad: [6, 8, 6, 8], radius: 3 };
const node = { id: "h", pageId: "p0", featureId: "value-prop", label: "HOST Hosts", prompt: "", content: [chip, { text: " Hosts" }], data: "", x: 0, y: 0, w: 400, h: 40, groupId: null, options: {}, priority: "must", custom: false, locked: false, link: null, colour: { text: "rgb(43, 24, 56)" }, font: { face: "Pixelify Sans", px: 28, size: 1.09375, weight: 400 }, texture: null, from: { url: "https://parasiteonsol.fun/stats", host: "parasiteonsol.fun", selector: "body > main > h2" } };
const html = renderToStaticMarkup(React.createElement(Block, { node, t, palette, mode: "live", size: { w: 400, h: 40 } }));
const span = (html.match(/<span[^>]*>HOST<\/span>/) ?? [""])[0];
check("the chip's run is drawn on its dark fill", /background(-color)?:\s*rgb\(43, 24, 56\)/.test(span), span);
check("…with its padding and rounding", /padding:\s*6px 8px( 6px 8px)?/.test(span) && /border-radius:\s*3px/.test(span), span);
check("…and its white words", /color:\s*rgb\(255, 255, 255\)/.test(span), span);
check("a chip is never merged into the words beside it, even in the same ink", merged([{ text: "HOST ", colour: "rgb(1, 1, 1)", bg: "rgb(43, 24, 56)" }, { text: "Hosts", colour: "rgb(1, 1, 1)" }]).length === 2);

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
