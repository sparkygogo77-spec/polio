/**
 * THE BOARD DRAWS A SITE'S THEME (J, 2026-10-11). What an import keeps of a
 * site's look is drawn on the board, for any site:
 *
 *   · a part's individual transforms (`rotate: -8deg` on a seal) turn it;
 *   · a part's inline svg (a dial's dashed ticks, curved labels, hands) is
 *     drawn as svg, cleaned of anything that runs, and not again as a flat
 *     picture under it;
 *   · the page's background layers (html, body, ::before / ::after) are
 *     drawn behind the parts, or over them when the page put them over, and
 *     a fixed layer rides with the view;
 *   · fixed and sticky parts ride down with the view (`--view-top`), never
 *     past the page's foot or their holder's;
 *   · one switch holds every animation still, and starts still for a person
 *     who asked for less motion.
 *
 *   node tests/board-theme.mjs
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
const studio = join(here, "..", "src", "features", "studio");
const { Block } = await jiti.import(join(studio, "blocks.tsx"));
const { themeFrom, resolvePalette, boxStyle } = await jiti.import(join(studio, "shelf", "parts", "theme.ts"));
const draw = await jiti.import(join(studio, "board", "themeDraw.tsx"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (extra) => ({
  id: "seal", pageId: "p0", featureId: "box", label: "seal", prompt: "", content: "", data: "", x: 100, y: 200, w: 120, h: 120, groupId: null,
  options: {}, priority: "must", custom: false, locked: false, link: null, colour: { text: "rgb(0, 0, 0)" }, font: null, texture: null,
  from: { url: "zip:index.html", host: "index.html", selector: "body > main > div" }, ...extra,
});

/* 1. Individual transforms. */
const turned = boxStyle(node({ art: { rotate: "-8deg", translate: "4px 2px", scale: "1.1" } }), t, palette);
check("rotate: -8deg turns the part", turned.rotate === "-8deg", JSON.stringify(turned));
check("…translate and scale too", turned.translate === "4px 2px" && turned.scale === "1.1");
const none = boxStyle(node({ art: { rotate: "none", transform: "matrix(1, 0, 0, 1, 0, 0)" } }), t, palette);
check("control: rotate none and an identity matrix draw nothing", !("rotate" in none) && !("transform" in none), JSON.stringify(none));
const html = renderToStaticMarkup(React.createElement(Block, { node: node({ art: { rotate: "-8deg" } }), t, palette, mode: "live", size: { w: 120, h: 120 } }));
check("…and the drawn box carries it", /rotate:\s*-8deg/.test(html), html.slice(0, 300));

/* 2. Inline svg: the part draws its own svg, not the flat picture of it. */
const markup = `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="#c33" stroke-dasharray="2 6"/><text x="50" y="20">12</text><script>alert(1)</script></svg>`;
check("the svg a part carries is read", draw.svgMarkupOf({ svg: { markup } }) === markup && draw.svgMarkupOf({ svg: { markup: "<div/>" } }) === null);
const pic = `url("data:image/svg+xml;base64,AAAA")`;
const svgHtml = renderToStaticMarkup(React.createElement(Block, { node: node({ svg: { markup }, art: { background: pic, backgroundOptions: ["100% 100%", "0% 0%", "no-repeat"] } }), t, palette, mode: "live", size: { w: 120, h: 120 } }));
check("a part with svg markup does not paint its flat picture as well", !svgHtml.includes("data:image/svg+xml"), svgHtml.slice(0, 300));

/* 3. Page layers. */
const layers = draw.groundLayersOf({ ground: { layers: [
  { which: "body", color: "rgb(245, 238, 220)", background: "radial-gradient(circle, rgb(0,0,0) 1px, transparent 1px), repeating-conic-gradient(rgb(240,0,0) 0deg 10deg, transparent 10deg 20deg)", size: "12px 12px, auto" },
  { which: "body::before", background: "linear-gradient(red, blue)", fixed: true, inset: { top: "0px", right: "0px", bottom: "0px", left: "0px" }, z: -1, opacity: 0.5 },
  { which: "html::after", background: "repeating-linear-gradient(0deg, rgba(0,0,0,.1) 0 1px, transparent 1px 3px)", z: 10, inset: { top: "0px", left: "0px", right: "0px", bottom: "0px" } },
  { which: "html", background: "url(javascript:alert(1))" },
] } });
const under = renderToStaticMarkup(React.createElement(draw.PageGroundLayers, { layers, width: 1440, height: 3000 }));
const over = renderToStaticMarkup(React.createElement(draw.PageGroundLayers, { layers, width: 1440, height: 3000, over: true }));
check("the body's multi-layer background is drawn under the parts", under.includes("repeating-conic-gradient") && under.includes("radial-gradient") && under.includes("rgb(245, 238, 220)"), under.slice(0, 400));
check("…a fixed ::before rides with the view", /top:\s*calc\(var\(--view-top, 0px\) \+ 0px\)/.test(under) && under.includes("--view-h"), under.slice(0, 600));
check("…and a layer the page put over its content is drawn over the parts", over.includes("repeating-linear-gradient") && !under.includes("repeating-linear-gradient"));
check("…and nothing that runs is drawn", !under.includes("javascript") && !over.includes("javascript"));

/* 4. Fixed and sticky parts. */
const nodes = [
  { id: "main", x: 0, y: 0, w: 1440, h: 3000, from: { selector: "body > main" } },
  { id: "rail", x: 0, y: 0, w: 120, h: 900, from: { selector: "body > nav", position: "fixed" } },
  { id: "head", x: 120, y: 400, w: 1320, h: 60, from: { selector: "body > main > section", position: "sticky", inset: { top: 10 } } },
  { id: "sec", x: 120, y: 300, w: 1320, h: 1000, from: { selector: "body > main > section" } },
  { id: "bar", x: 120, y: 350, w: 1320, h: 40, from: { selector: "body > main > section > div", position: "sticky", inset: { top: "0px" } } },
  { id: "plain", x: 0, y: 0, w: 10, h: 10, from: { selector: "body > p" } },
];
const pins = draw.pinsOf(nodes, 3000);
check("a fixed part rides down with the view, to the page's foot", pins.get("rail") === "0 clamp(0px, var(--view-top, 0px), 2100px)", pins.get("rail"));
check("a sticky part rides from its top offset to its holder's foot", pins.get("bar") === "0 clamp(0px, calc(var(--view-top, 0px) + -350px), 910px)", pins.get("bar"));
check("…to the page's foot when nothing holds it", pins.get("head") === "0 clamp(0px, calc(var(--view-top, 0px) + -390px), 2540px)", pins.get("head"));
check("control: a part the page did not pin stays", !pins.has("plain") && !pins.has("main"));

/* 5. One switch for motion. */
check("still holds every animation and transition", /\[data-board-motion="still"\] \.mo\b/.test(draw.STILL_CSS) && /animation: none !important/.test(draw.STILL_CSS) && /transition: none !important/.test(draw.STILL_CSS));
globalThis.window = {};
globalThis.matchMedia = (q) => ({ matches: q.includes("reduce") });
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
const fresh = await jiti.import(join(studio, "board", "themeDraw.tsx") + "?reduced");
check("…and it starts still for a person who asked for less motion", fresh.boardMotion() === "still", fresh.boardMotion());

/* 6. The svg is cleaned of what runs, in a real browser. */
let chromium = null;
try { ({ chromium } = require("playwright")); } catch { try { ({ chromium } = require("@playwright/test")); } catch { /* no browser here */ } }
if (chromium) {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined }).catch(() => chromium.launch({ executablePath: "/opt/pw-browsers/chromium" }).catch(() => null));
  if (browser) {
    const page = await browser.newPage();
    const src = (await import("node:fs")).readFileSync(join(studio, "board", "themeDraw.tsx"), "utf8");
    const body = src.slice(src.indexOf("const RUNS"), src.indexOf("/** The svg a part carries"));
    const js = body.replace(/export /g, "").replace(/: string/g, "").replace(/new Map<string, string>\(\)/, "new Map()");
    const out = await page.evaluate(`(() => { ${js}; return cleanSvg(${JSON.stringify(markup.replace("<circle", "<circle onclick=\"alert(1)\""))}); })()`);
    check("the svg keeps its dashed stroke and its words", out.includes('stroke-dasharray="2 6"') && out.includes(">12</text>"), out.slice(0, 200));
    check("…and loses its script and handlers", !/script|onclick/i.test(out), out);
    check("…and fills its box", /width="100%"/.test(out) && /height="100%"/.test(out));
    await browser.close();
  } else console.log("  --   no browser here: svg cleaning not checked");
}

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
