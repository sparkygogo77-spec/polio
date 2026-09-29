/**
 * A HERO SIZED IN THE WINDOW'S HEIGHT IS AS TALL AS THE PAGE WROTE.
 *
 * parasiteonsol.fun's hero is `height: clamp(520px, -168px + 100svh, 900px)`:
 * 732px in the capture's 900px window. The export sized every window-height
 * hero `max(100svh, 732px)` (trumpmorty's `min-height: 100svh` rule), 900px,
 * so its frame and everything in it stood 84px low and the page under it
 * 168px low. The hero takes what the page wrote (`node.vh.height`, or
 * `vh.minHeight`), never under what it holds where the page wrote a
 * minimum; and what is in it and under it moves by the difference from the
 * captured px, which is none in the window it was captured in. A box whose
 * content made it taller than its minimum (stonkfun.xyz's page wrapper,
 * min-height 100vh, 1995 tall at 900) is measured from the height it had.
 *
 *   node tests/hero-height.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { chromium } = require("playwright-core");
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const fluid = await jiti.import(join(here, "..", "src", "features", "studio", "fluidSite.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const H = typeof fluid.heroHeight === "function" ? fluid.heroHeight : () => "max(100svh, 732px)";
const clampHero = H({ height: "clamp(520px, -168px + 100svh, 900px)", px: 732 }, null);
const minHero = H({ minHeight: "100svh", px: 900, content: 640 }, null);
const grownHero = H({ minHeight: "100svh", px: 900, content: 640 }, "14px");
/* Measured as a browser sizes them, in windows 900 and 1200 tall. */
const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: "/opt/pw-browsers/chromium" });
const px = async (h, css) => { const p = await browser.newPage({ viewport: { width: 1000, height: h } }); await p.setContent(`<div id="d" style="height:${css}"></div>`); const v = await p.evaluate(() => document.getElementById("d").getBoundingClientRect().height); await p.close(); return v; };
check("parasite's hero is 732px in the 900px window it was captured in", (await px(900, clampHero)) === 732, clampHero);
check("…and 900px (its clamp's top) in a 1200px window", (await px(1200, clampHero)) === 900, clampHero);
check("…so what is inside it does not move in the capture's window", fluid.vhShift({ y: 97, h: 702 }, { y: 82, h: 732 }, 732, { y: 95, h: 706 }, clampHero)?.includes(clampHero) && (await px(900, `calc(${clampHero} - 732px)`)) === 0);
check("control: trumpmorty's min-height 100svh hero fills a 1200px window", (await px(1200, minHero)) === 1200, minHero);
check("control: …and never under what it holds (640) in a shorter window", (await px(500, minHero)) === 640, minHero);
check("control: …with its type's growth added to what it holds", (await px(500, grownHero)) === 654, grownHero);
/* stonkfun.xyz's page wrapper: min-height 100vh, but its content made it 1995 tall at the capture's 900px window. It is a page, not a hero: as tall as it was, and nothing in it moves. */
const page = H({ minHeight: "100vh", px: 900 }, null, 1995);
check("a min-height 100vh wrapper its content made 1995 tall stays 1995 in a 900 window", (await px(900, page)) === 1995, page);
check("…and in a 1200 window", (await px(1200, page)) === 1995, page);
const moved = fluid.vhShift({ y: 310, h: 14 }, { y: 0, h: 1995 }, 1995, { y: 0, h: 1995 }, page);
const top = async (h, css) => { const p = await browser.newPage({ viewport: { width: 1000, height: h } }); await p.setContent(`<div style="position:relative"><div id="d" style="position:absolute;top:${css}"></div></div>`); const v = await p.evaluate(() => document.getElementById("d").offsetTop); await p.close(); return v; };
check("…so nothing inside it moves in the capture's window", (await top(900, moved ?? "310px")) === 310, `${moved} → ${await top(900, moved ?? "310px")}`);
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
