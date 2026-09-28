/**
 * A BAND WIDER THAN THE PAGE STAYS WIDER THAN THE PAGE.
 *
 * trumpmorty.fun's two ticker ribbons are 1586px wide at x -73 in a 1440px
 * page, turned 2.5° and -2°, so their ends run off both edges. The fluid
 * export (`fluidSite.ts`) read each one as a centred box with a max-width it
 * could not see and wrote `width: min(1586px, 100%)`: at every window the
 * ribbon was exactly the window's width, and its turned ends stopped short of
 * the edges, a wedge of page showing at each corner. The hero's backdrop
 * layers (1555 and 1584 wide) were squeezed the same way. A centred part no
 * wider than its parent's inside is still read that way; one wider than it
 * overhangs both sides and grows with its parent, keeping its overhang.
 *
 *   node tests/fluid-overhang.mjs
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

/* A length at a window width: the CSS evaluated with 100% the window's width. */
const at = (expr, win) => {
  const js = expr.replace(/calc\(/g, "(").replace(/min\(/g, "Math.min(").replace(/max\(/g, "Math.max(").replace(/(-?[\d.]+)px/g, "$1").replace(/100%/g, String(win));
  return Function(`return ${js}`)();
};

const W = 1440;
const ribbon = { id: "ribbon", x: -73, y: 823, w: 1586, h: 141, selector: "body > main > div > div:nth-of-type(1)" };
const k = fluid.fluidParts([ribbon], W).get("ribbon");
const l = (win) => at(fluid.css(k.left, W), win), w = (win) => at(fluid.css(k.width, W), win);
check("at the capture's width the ribbon is where it was captured, 1586 wide at -73", Math.abs(l(1440) + 73) < 0.01 && Math.abs(w(1440) - 1586) < 0.01, `${l(1440)} ${w(1440)}`);
check("…at 1920 it still runs off both edges by the same 73px", Math.abs(l(1920) + 73) < 0.01 && Math.abs(w(1920) - 2066) < 0.01, `${l(1920)} ${w(1920)}`);
check("…and at 1280 too, never squeezed to the window", Math.abs(l(1280) + 73) < 0.01 && Math.abs(w(1280) - 1426) < 0.01, `${l(1280)} ${w(1280)}`);

/* Control: a centred box narrower than the page keeps its inferred max-width. */
const row = { id: "row", x: 80, y: 0, w: 1280, h: 60, selector: "body > header" };
const r = fluid.fluidParts([row], W).get("row");
const rl = (win) => at(fluid.css(r.left, W), win), rw = (win) => at(fluid.css(r.width, W), win);
check("control: a centred 1280 row stays 1280 and centred at 1920 (its max-width, inferred)", Math.abs(rw(1920) - 1280) < 0.01 && Math.abs(rl(1920) - 320) < 0.01, `${rl(1920)} ${rw(1920)}`);
check("control: …and shrinks to the window below it", Math.abs(rw(1200) - 1200) < 0.01 && Math.abs(rl(1200)) < 0.01, `${rl(1200)} ${rw(1200)}`);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
