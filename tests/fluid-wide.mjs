/**
 * AT A WIDE WINDOW, DECORATIONS STAY WITH WHAT THEY SIT ON, AND A CUT
 * WINDOW AS WIDE AS THE PAGE STAYS AS WIDE AS THE PAGE.
 *
 * THE OWNER'S REPORT, trumpmorty.fun published, at 1968 and 2000 wide:
 *   · the ringed planet drifted from above the TV to behind the title. It is
 *     placed absolutely in the hero (the site's `right: 36%`), and the fluid
 *     export kept its captured left at every width while the TV beside it
 *     moved with the centred column. An absolutely placed part now moves by
 *     where it stood across what holds it (its centre's share), so at 1920 it
 *     moves 0.536 of the 480 more, as the TV (half) nearly does;
 *   · the ribbons' marquee text stopped about 1440px across. Each track is cut
 *     to its ribbon's window (`art.clipPath`, in px, in the track's own
 *     frame), and the window was the capture's 1440 whatever the width. A cut
 *     whose right edge falls on the page's right edge moves with that edge.
 *
 *   node tests/fluid-wide.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const fluid = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const at = (expr, win) => Function(`return ${expr.replace(/calc\(/g, "(").replace(/min\(/g, "Math.min(").replace(/max\(/g, "Math.max(").replace(/(-?[\d.]+)px/g, "$1").replace(/100vw/g, String(win)).replace(/100%/g, String(win))}`)();

const W = 1440;
const S = "body > main > section:nth-of-type(1)";
const parts = [
  { id: "hero", x: 0, y: 0, w: 1440, h: 900, selector: S },
  { id: "ring", x: 622, y: 68, w: 300, h: 300, selector: `${S} > img:nth-of-type(2)`, position: "absolute" },
  { id: "corner", x: 1300, y: 20, w: 100, h: 40, selector: `${S} > img:nth-of-type(3)`, position: "absolute" },
];
const k = fluid.fluidParts(parts, W);
const left = (id, win) => at(fluid.css(k.get(id).left, W), win);
check("at the capture's width the ringed planet is where it was", Math.abs(left("ring", 1440) - 622) < 0.01, String(left("ring", 1440)));
const moved = left("ring", 1920) - 622;
check("at 1920 it moves with where it stood across the hero, not pinned left (the TV moves 240)", moved > 200 && moved < 320, String(moved));
check("control: a part placed flush against no edge in normal flow is not moved by this (only placed parts)", (() => {
  const k2 = fluid.fluidParts([parts[0], { ...parts[1], id: "flow", position: null }], W);
  return Math.abs(at(fluid.css(k2.get("flow").left, W), 1920) - 622) < 0.01;
})());

/* The cut windows. */
const track = { x: -72, w: 5660 };
const cut = fluid.fluidClip("inset(0px 2816px 0px 1399px)", track, -1330.44, W);
const rightAt = (win) => at(/inset\(0px (.*) 0px 1399px\)/.exec(cut)?.[1] ?? "NaN", win);
check("the red track's window reaches the page's right edge at 2000 (2816 less the 560 more)", Math.abs(rightAt(2000) - 2256) < 0.5, cut);
check("…and is as captured at 1440", Math.abs(rightAt(1440) - 2816) < 0.5, String(rightAt(1440)));
check("control: a cut that stops short of the page's edge is left as it was",
  fluid.fluidClip("inset(4px 4px 4px 4px)", { x: 815, w: 398 }, 0, W) === null);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
