/**
 * OUTLINED AND GRADIENT WORDS ARE DRAWN, NOT LEFT TRANSPARENT.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, 2026-10-21). Six words of its titles — "CHASE",
 * "TRENCHES", "STARS.", "MAP", "TO THE TOP.", "FROG" — are drawn by the page
 * in transparent ink with something else showing: an outline
 * (`-webkit-text-stroke: 1.8px rgb(220, 233, 237)`, class `stroke-word`) or a
 * gradient clipped to the letters (`background-clip: text`, class
 * `gradient-text`). The capture kept only the ink, so on the board all six
 * were invisible.
 *
 * The contract agreed with the capture (coordinator, 2026-10-21): an outline
 * travels on the existing `Span.textStroke: { w, color }`, now on ordinary
 * runs as well as a title's letters; a gradient on a new
 * `Span.fill: { image, clip: "text" }`, `image` being the computed
 * background-image verbatim. `colour` stays the transparent ink. This draws
 * them; a run carrying neither still draws with no style of its own.
 *
 *   node tests/run-fill.mjs
 *   (CHROMIUM / PLAYWRIGHT_CHROMIUM names the browser; CHROMIUM_ARGS adds switches a machine needs)
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") }, jsx: true });
const parts$ = join(here, "..", "src", "features", "studio", "shelf", "parts");
const { Runs } = await jiti.import(join(parts$, "Runs.tsx"));
const { themeFrom } = await jiti.import(join(parts$, "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const t = themeFrom({ "palette.mode": "dark" });
const GRADIENT = "linear-gradient(90deg, rgb(76, 255, 131), rgb(22, 134, 85))";
/* The roadmap title's runs as the agreed contract writes them, and the lore title's outlined word. */
const spans = [
  { text: "ROAD" },
  { text: "MAP", colour: "rgba(0, 0, 0, 0)", fill: { image: GRADIENT, clip: "text" } },
  { text: "\n" },
  { text: "TO THE TOP.", colour: "rgba(0, 0, 0, 0)", textStroke: { w: 1.8, color: "rgb(220, 233, 237)" } },
];
const html = renderToStaticMarkup(React.createElement("p", { id: "title", style: { fontSize: 92, color: "rgb(246, 245, 239)", width: 550 } }, React.createElement(Runs, { spans, t, mode: "live" })));

const AT = process.env.CHROMIUM ?? process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const extra = (process.env.CHROMIUM_ARGS ?? "").trim().split(/\s+/).filter(Boolean);
const browser = await chromium.launch({ args: ["--no-sandbox", ...extra], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${html}</body>`);
const read = await page.evaluate(() => {
  const at = (word) => {
    const w = document.createTreeWalker(document.getElementById("title"), NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) if (n.textContent.includes(word)) break;
    const el = n?.parentElement, s = el && getComputedStyle(el);
    return s && { tag: el.tagName, own: el.id === "title" ? "the title" : "a run", colour: s.color, image: s.backgroundImage, clip: s.webkitBackgroundClip || s.backgroundClip, stroke: s.webkitTextStrokeWidth, strokeColour: s.webkitTextStrokeColor };
  };
  return { road: at("ROAD"), map: at("MAP"), top: at("TO THE TOP.") };
});
await browser.close();

check("the gradient word is painted with its gradient", read.map?.image === "linear-gradient(90deg, rgb(76, 255, 131), rgb(22, 134, 85))", JSON.stringify(read.map));
check("…clipped to its letters", read.map?.clip === "text", JSON.stringify(read.map));
check("…over its transparent ink", read.map?.colour === "rgba(0, 0, 0, 0)", read.map?.colour);
check("the outlined word on an ordinary run is drawn with its 1.8px outline", read.top?.stroke === "1.8px" && read.top?.strokeColour === "rgb(220, 233, 237)", JSON.stringify(read.top));
check("control: a run carrying nothing is drawn in the title's own type, with no element of its own", read.road?.own === "the title" && read.road?.image === "none", JSON.stringify(read.road));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
