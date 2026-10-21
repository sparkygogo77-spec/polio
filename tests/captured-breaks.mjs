/**
 * A CAPTURED PART'S LINE BREAKS ARE LINES, NOT PARAGRAPHS.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, 2026-10-21). Its footer wordmark is one link, "THE SOL",
 * a `<br>`, "FACE." in green: 144px at a 0.86 leading, 248 tall on the page
 * (two lines of 123.84). The capture writes the `<br>` as a "\n" in the
 * words. `Prose` reads a "\n" as a paragraph break, as it should for words
 * typed here, and set each one apart by 0.7em, 100.8px at 144px; and it drew
 * every paragraph after the first in the muted ink. On the board the
 * wordmark stood 472 tall and pushed the footer 224px longer, and its second
 * line, where it carried no ink of its own, came out grey.
 *
 * A captured part's words are the page's own, broken where the page broke
 * them: its lines stand one under the other with no gap and in the same
 * ink. Words typed here keep their paragraphs.
 *
 *   node tests/captured-breaks.mjs
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
const { Prose } = await jiti.import(join(parts$, "Text.tsx"));
const { themeFrom, applyFont, applyCaptured } = await jiti.import(join(parts$, "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const t = themeFrom({ "palette.mode": "dark" });
const font = { family: "display", face: "Archivo Black", size: 9, px: 144, stack: "\"Archivo Black\", \"Arial Black\", Impact, sans-serif", weight: 900, spacing: -0.095, leading: 0.86 };
const from = { url: "https://thesolface.site/", host: "thesolface.site", selector: "body > footer > div:nth-of-type(1) > a" };
const parts = [
  /* The wordmark as the converter writes it: two runs, the break in the first. */
  { id: "mark", w: 600, h: 248, from, font, content: "THE SOL\nFACE.", spans: [{ text: "THE SOL\n" }, { text: "FACE.", colour: "rgb(76, 255, 131)" }] },
  /* The same words as a plain string, no runs. */
  { id: "plain", w: 600, h: 248, from, font, content: "THE SOL\nFACE." },
  /* Control: two paragraphs typed here keep their gap. */
  { id: "typed", w: 600, h: 100, from: null, font: { size: 1, leading: 1.5 }, content: "First paragraph.\nSecond paragraph." },
];
const draw = (n) => renderToStaticMarkup(React.createElement(Prose, {
  id: "prose", content: n.content, spans: n.spans, options: {}, w: n.w, h: n.h, mode: "live",
  theme: applyCaptured(applyFont(t, n.font, { captured: !!n.from }), { from: n.from, h: n.h }),
}));

const AT = process.env.CHROMIUM ?? process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const extra = (process.env.CHROMIUM_ARGS ?? "").trim().split(/\s+/).filter(Boolean);
const browser = await chromium.launch({ args: ["--no-sandbox", ...extra], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${parts.map((n) => `<div id="${n.id}" style="position:relative;width:${n.w}px;display:flex;flex-direction:column">${draw(n)}</div>`).join("")}</body>`);
/* Each line's top, height and ink, read off the drawn words. */
const read = await page.evaluate(() => Object.fromEntries(["mark", "plain", "typed"].map((id) => {
  const ps = [...document.getElementById(id).querySelectorAll("p")];
  return [id, ps.map((p) => { const r = p.getBoundingClientRect(); return { top: Math.round(r.top), h: Math.round(r.height), ink: getComputedStyle(p).color }; })];
})));
await browser.close();

const gap = (ls) => ls.length > 1 ? ls[1].top - (ls[0].top + ls[0].h) : null;
const tall = (ls) => ls.length ? ls[ls.length - 1].top + ls[ls.length - 1].h - ls[0].top : 0;
check("the wordmark's two lines stand with no gap between them", gap(read.mark) === 0, JSON.stringify(read.mark));
/* Its lines' own heights depend on whether this browser has Archivo Black (without it "THE SOL" wraps): only the room between them is checked. */
check("…and stand exactly as tall as their lines, nothing between", tall(read.mark) === read.mark.reduce((n, l) => n + l.h, 0), `${tall(read.mark)} tall`);
check("…and its second line is in the part's own ink, not the muted one", read.mark.length > 1 && read.mark[1].ink === read.mark[0].ink, JSON.stringify(read.mark.map((l) => l.ink)));
check("the same words as a plain string: no gap either, and one ink", gap(read.plain) === 0 && read.plain[1]?.ink === read.plain[0]?.ink, JSON.stringify(read.plain));
check("control: paragraphs typed here keep the gap between them", gap(read.typed) > 0, JSON.stringify(read.typed));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
