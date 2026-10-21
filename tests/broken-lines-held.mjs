/**
 * A CAPTURED HEADING WHOSE BOX HOLDS EXACTLY ITS BROKEN LINES KEEPS EACH ON ONE LINE.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, 2026-10-21). Its roadmap title is "ROADMAP", a `<br>`,
 * "TO THE TOP.": 92.16px, two lines of 91.24, a box 550 by 182. On the page
 * "TO THE TOP." is 550px wide, exactly its box. On the board it was a hair
 * wider and wrapped, the title stood 274 tall, and the roadmap section and
 * everything under it moved down 92.
 *
 * `ValueProp` already holds a captured heading one line tall to one line (a
 * box the capture rounded down, `tests/captured-words.mjs`). A heading the
 * page broke with `<br>`s is the same case once per line: when its box is
 * shorter than one line more than its breaks make, every line was one line
 * on the page, and each is held so. A box with room for more lines than its
 * breaks make (the page wrapped inside a line too) still wraps.
 *
 *   node tests/broken-lines-held.mjs
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
const { ValueProp } = await jiti.import(join(parts$, "Hero.tsx"));
const { themeFrom, applyFont, applyCaptured } = await jiti.import(join(parts$, "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const t = themeFrom({ "palette.mode": "dark" });
const font = { family: "display", face: "Archivo Black", size: 3.6, px: 92.16, stack: "\"Archivo Black\", \"Arial Black\", Impact, sans-serif", weight: 900, spacing: -0.08, leading: 0.99 };
const from = { url: "https://thesolface.site/", host: "thesolface.site", selector: "body > main > section:nth-of-type(5) > div:nth-of-type(2) > div:nth-of-type(2) > div > h2" };
const parts = [
  /* The roadmap title as the converter writes it, in a box exactly its two lines. */
  { id: "held", w: 550, h: 182, content: "ROADMAP\nTO THE TOP." },
  /* Control: the same words in a box with room for a third line: the page wrapped inside one, so it still wraps. */
  { id: "room", w: 550, h: 274, content: "ROADMAP\nTO THE TOP." },
];
const draw = (n) => renderToStaticMarkup(React.createElement(ValueProp, {
  id: "value-prop", content: n.content, options: {}, w: n.w, h: n.h, mode: "live",
  theme: applyCaptured(applyFont(t, font, { captured: true }), { from, h: n.h }),
}));

const AT = process.env.CHROMIUM ?? process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const extra = (process.env.CHROMIUM_ARGS ?? "").trim().split(/\s+/).filter(Boolean);
const browser = await chromium.launch({ args: ["--no-sandbox", ...extra], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${parts.map((n) => `<div id="${n.id}" style="position:relative;width:${n.w}px;height:${n.h}px;display:flex;flex-direction:column">${draw(n)}</div>`).join("")}</body>`);
const read = await page.evaluate(() => Object.fromEntries(["held", "room"].map((id) => {
  const p = document.getElementById(id).querySelector("p");
  const cs = getComputedStyle(p);
  return [id, { h: Math.round(p.getBoundingClientRect().height), lines: Math.round(p.getBoundingClientRect().height / parseFloat(cs.lineHeight)), ws: cs.whiteSpace }];
})));
await browser.close();

check("the roadmap title in its 182 box draws its two lines and no more", read.held.lines === 2, JSON.stringify(read.held));
check("…each held to one line", read.held.ws === "nowrap", JSON.stringify(read.held));
check("control: the same words in a box with room for three still wrap", read.room.ws !== "nowrap" && read.room.lines >= 3, JSON.stringify(read.room));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
