/**
 * A MAX-WIDTH CONTAINER STAYS AT ITS WIDTH, CENTRED.
 *
 * stonkfun.xyz wraps its page in `max-width: 1440px; margin: 0 auto` (the
 * h1's ancestors: 1440 at x 322 in a 2084 window, the sections inside it
 * 1392 at x 346). The export stretched the hero, filters and card grid edge
 * to edge, and the hero's chart line ran past the hero. sink now carries a
 * px max-width (`node.maxw`); a part that sat centred at the capture holds
 * at most that width, centred, and what is inside it follows it; a full-bleed
 * band (the header) still stretches. Checked at 1440, 2000 and 2560.
 *
 *   node tests/fluid-maxwidth.mjs
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
const W = 1440;
const parts = [
  { id: "header", x: 0, y: 0, w: 1440, h: 64, selector: "body > div > header" },
  { id: "wrap", x: 0, y: 64, w: 1440, h: 900, selector: "body > div > div", maxw: 1440, pad: { left: 24, right: 24 } },
  { id: "hero", x: 24, y: 96, w: 1392, h: 400, selector: "body > div > div > section" },
  { id: "line", x: 700, y: 200, w: 716, h: 200, selector: "body > div > div > section > svg", position: "absolute" },
  { id: "grid", x: 24, y: 520, w: 1392, h: 300, selector: "body > div > div > div", layout: { display: "grid", columns: 4, gap: 16 } },
  { id: "card4", x: 1068, y: 520, w: 348, h: 300, selector: "body > div > div > div > a:nth-of-type(4)" },
];
const k = fluid.fluidParts(parts, W);
const browser = await chromium.launch({ args: ["--no-sandbox"], executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
for (const win of [1440, 2000, 2560]) {
  const page = await browser.newPage({ viewport: { width: win, height: 900 } });
  const html = parts.map((p) => { const f = k.get(p.id); return `<div id="${p.id}" style="position:absolute;top:${p.y}px;height:${p.h}px;left:${fluid.css(f.left, W)};width:${fluid.css(f.width, W)}"></div>`; }).join("");
  await page.setContent(`<body style="margin:0"><div style="position:relative;width:100%">${html}</div></body>`);
  const box = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[id]")].map((e) => { const r = e.getBoundingClientRect(); return [e.id, [Math.round(r.left), Math.round(r.width)]]; })));
  const off = (win - 1440) / 2;
  check(`${win}: the header still spans the window`, box.header[0] === 0 && box.header[1] === win, JSON.stringify(box.header));
  check(`${win}: the max-width container is 1440, centred (x ${off})`, box.wrap[0] === off && box.wrap[1] === 1440, JSON.stringify(box.wrap));
  check(`${win}: the hero is 1392 at x ${off + 24}, inside it`, box.hero[0] === off + 24 && box.hero[1] === 1392, JSON.stringify(box.hero));
  check(`${win}: the chart line stays inside the hero`, box.line[0] + box.line[1] <= box.hero[0] + box.hero[1] + 1, JSON.stringify([box.line, box.hero]));
  check(`${win}: the card grid's last card ends at the container's inner edge`, box.card4[0] + box.card4[1] === off + 1416, JSON.stringify(box.card4));
  await page.close();
}
{
  /* Narrower than the max-width, it shrinks with the window as before. */
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const f = k.get("wrap");
  await page.setContent(`<body style="margin:0"><div style="position:relative;width:100%"><div id="wrap" style="position:absolute;left:${fluid.css(f.left, W)};width:${fluid.css(f.width, W)};height:10px"></div></div></body>`);
  const b = await page.evaluate(() => { const r = document.getElementById("wrap").getBoundingClientRect(); return [Math.round(r.left), Math.round(r.width)]; });
  check("control: at 1280 the container is the window's width", b[0] === 0 && b[1] === 1280, JSON.stringify(b));
  await page.close();
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} FAILED — ${results.length - failed}/${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
