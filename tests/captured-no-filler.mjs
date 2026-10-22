/**
 * A CAPTURED PART WITH NO WORDS DRAWS NONE, NEVER THE BOARD'S FILLER.
 *
 * On the board, a part a person adds shows sample prose until they write it
 * ("Warm harbour wide ledger…", `parts/sample.ts`), so a layout can be read.
 * A part brought in from a page is the page's: where it holds no words, the
 * page had none there. thesolface's lore sign-off is a flex row whose own
 * words became a part of their own, which left its holder a prose part with
 * no words; the board filled it with "Plain thread soft thread open signal…"
 * on top of the real "NO CRYSTAL BALL." beside it, and the "100%" stat's
 * holder became a tall green column of filler beside the frog (J's board,
 * 2026-10-21). A captured part now draws its own words or nothing.
 *
 *   node tests/captured-no-filler.mjs
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
const parts = join(here, "..", "src", "features", "studio", "shelf", "parts");
const { Prose } = await jiti.import(join(parts, "Text.tsx"));
const { themeFrom } = await jiti.import(join(parts, "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const NOUNS = /\b(signal|harbour|ledger|orbit|meadow|compass|lantern|thread|summit|canvas)\b/i;
const words = (html) => html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
const base = themeFrom({});
const draw = (t, content) => words(renderToStaticMarkup(React.createElement(Prose, { id: "prose", content, theme: t, mode: "board", w: 612, h: 60 })));

const captured = draw({ ...base, captured: true }, "");
check("a captured prose part with no words draws no filler", !NOUNS.test(captured) && captured === "", JSON.stringify(captured.slice(0, 120)));
const own = draw({ ...base, captured: true }, "NO CRYSTAL BALL.");
check("control: a captured part draws its own words", /NO CRYSTAL BALL\./.test(own), JSON.stringify(own.slice(0, 120)));
const added = draw(base, "");
check("control: a part a person added still shows sample prose on the board", NOUNS.test(added) || added.split(" ").length > 6, JSON.stringify(added.slice(0, 120)));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
