/**
 * WHAT SINK NOW RECORDS, DRAWN (sink claude/trumpmorty-2000-fixes, 47637d6).
 *
 *   · font size exact: "Renewed for S2" is 30px on the page, 228.14px of words
 *     in a 227px box, and wraps. Sink stores 1.171875 (× the heading's 1.6 =
 *     30); rounding the part's size to a tenth drew 30.08 and a tenth either
 *     way changes a wrap;
 *   · font.stack: the whole stack the page set, so a glyph the face lacks falls
 *     back as the page's did (the remote's ✈ in VT323, "Courier New",
 *     monospace, not in the site's sans);
 *   · radii: the remote's corners, 48 48 70 70, not one 70 all round;
 *   · inert: the grain over the whole page, and the decorations, never take a
 *     press in Preview or the export;
 *   · vh: the hero is min-height 100svh (900 at the capture); in a taller
 *     window everything under it moves down by the difference, and what is in
 *     it by its share of the difference (`fluidSite.ts#vhShift`).
 *
 *   node tests/sink-fields.mjs
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
const S = join(here, "..", "src", "features", "studio");
const { Block } = await jiti.import(join(S, "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(S, "shelf", "parts", "theme.ts"));
const { LiveSite } = await jiti.import(join(S, "live", "LiveSite.tsx"));
const fluid = await jiti.import(join(S, "fluidSite.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (id, featureId, content, extra = {}) => ({
  id, pageId: "page_home", featureId, label: id, prompt: "", content, data: "", x: 100, y: 100, w: 227, h: 60, groupId: null, options: {},
  priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null,
  from: { url: "https://trumpmorty.fun/", host: "trumpmorty.fun", selector: `body > main > div#${id}` }, ...extra,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h } }));

const renewed = draw(node("renewed", "value-prop", "Renewed for S2", { font: { face: "Luckiest Guy", size: 1.171875, px: 30, stack: "\"Luckiest Guy\", Impact, \"Arial Black\", sans-serif", weight: 400, leading: 1 } }));
check("the roadmap title is drawn at exactly 30px", /font-size:30px/.test(renewed), (renewed.match(/font-size:[^;"]*/g) ?? []).join(" "));
check("…in the page's own stack", /font-family:"Luckiest Guy", Impact, "Arial Black", sans-serif/.test(renewed) || /font-family:&quot;Luckiest Guy&quot;, Impact, &quot;Arial Black&quot;, sans-serif/.test(renewed), (renewed.match(/font-family:[^;]*;/) ?? [""])[0]);
const plane = draw(node("plane", "prose", "✈", { w: 16, h: 26, font: { face: "VT323", size: 1.625, px: 26, stack: "VT323, \"Courier New\", monospace", weight: 400, leading: 1 } }));
check("the remote's ✈ falls back as the page's did, to monospace", /monospace/.test(plane) && !/Avenir/.test(plane), (plane.match(/font-family:[^;]*;/) ?? [""])[0]);

const remote = draw(node("remote", "box", "", { w: 620, h: 552, radii: [48, 48, 70, 70], edge: { width: 5, style: "solid", colour: "rgb(26, 15, 11)" }, colour: { bg: "rgb(41, 47, 68)" } }));
check("the remote's corners are 48 48 70 70", /border-radius:48px 48px 70px 70px/.test(remote), (remote.match(/border-radius:[^;"]*/) ?? ["none"])[0]);

const page = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const site = renderToStaticMarkup(React.createElement(LiveSite, {
  pages: [page], pageId: "page_home", device: "desktop", frameWidth: 1440, format, look: undefined, published: true,
  nodes: [node("grain", "box", "", { x: 0, y: 0, w: 1440, h: 900, inert: true, opacity: 0.05, art: { blend: "multiply" } }), node("card", "box", "", { x: 10, y: 10, w: 100, h: 100, colour: { bg: "rgb(1, 2, 3)" } })],
}));
const tagOf = (id) => (site.match(new RegExp(`<[^>]*data-live-node="${id}"[^>]*>`)) ?? [""])[0];
check("the grain never takes a press: pointer-events none on its part", /pointer-events:none/.test(tagOf("grain")), tagOf("grain").slice(0, 200));
check("control: an ordinary part still does", !/pointer-events:none/.test(tagOf("card")), tagOf("card").slice(0, 160));

/* The hero's height. */
const hero = { x: 0, y: 0, w: 1440, h: 900 };
const at = (expr, vh) => Function(`return ${expr.replace(/calc\(/g, "(").replace(/max\(/g, "Math.max(").replace(/min\(/g, "Math.min(").replace(/(-?[\d.]+)px/g, "$1").replace(/100svh/g, String(vh))}`)();
const below = fluid.vhShift({ y: 1050, h: 500 }, hero, 900), inside = fluid.vhShift({ y: 440, h: 20 }, hero, 900), foot = fluid.vhShift({ y: 850, h: 50 }, hero, 900);
check("in a 1100-tall window a part under the hero moves down 200", !!below && Math.abs(at(below, 1100) - 1250) < 0.01, below);
check("…one halfway down the hero moves by half of it", !!inside && Math.abs(at(inside, 1100) - 540) < 0.01, inside);
check("…one at the hero's foot moves by nearly all of it", !!foot && Math.abs(at(foot, 1100) - (850 + 200 * (875 / 900))) < 0.01, foot);
check("…and in a window shorter than the capture nothing moves (min-height)", Math.abs(at(below, 700) - 1050) < 0.01);
/* The TV's parts move with the column that holds them (y 156, 578 tall), not each by its own centre, or the TV comes apart (its antenna 1 share, its body another). */
const col = { y: 156, h: 578 };
const rod = fluid.vhShift({ y: 150, h: 90 }, hero, 900, col), body = fluid.vhShift({ y: 197, h: 462 }, hero, 900, col);
check("the TV's antenna and body move by the same amount (their column's share)", !!rod && !!body && Math.abs((at(rod, 1100) - 150) - (at(body, 1100) - 197)) < 0.01, `${rod} | ${body}`);
check("control: a part above the hero's top is not moved", fluid.vhShift({ y: -60, h: 20 }, { ...hero, y: 0 }, 900) === null);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
