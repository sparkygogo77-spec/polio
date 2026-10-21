/**
 * A CAPTURED HEADING SIZED WITH THE WINDOW IS SPACED AT THE SIZE ITS WORDS ARE DRAWN.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, 2026-10-21). Its section titles are set with the window,
 * `clamp(3.7rem, 6.4vw, 6.5rem)`, 92.16px at 1440, letter-spacing -0.08em:
 * -7.37px on the page. A size set with the window keeps its spacing in em
 * (`applyFont`, so it grows with the size), and the em is set on the part's
 * box, at the box's size. A value-prop draws its words at 1.6 × that size,
 * so they inherited -0.08 × 57.6 = -4.61px: every line 2.8px a letter wider,
 * and "HE DOESN'T / CHASE / THE CANDLE. / HE IS IT." took five lines in a box
 * the page filled with four. The lore, story and gallery titles each grew a
 * line (364 → 456, 183 → 276, 228 → 342) and pushed the page down; the
 * manifesto and community titles, captured without a fluid size and so
 * spaced in px, came out exactly. `tests/captured-spacing.mjs` is the px half.
 *
 *   node tests/fluid-spacing.mjs
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
const { Prose } = await jiti.import(join(parts$, "Text.tsx"));
const { themeFrom, applyFont, applyCaptured } = await jiti.import(join(parts$, "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format);
const node = (id, featureId, extra = {}) => ({
  id, pageId: "p0", featureId, label: id, prompt: "", content: "HE DOESN'T\nCHASE\nTHE CANDLE.\nHE IS IT.", data: "", x: 778, y: 1342, w: 612, h: 364, groupId: null,
  options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, texture: null, ...extra,
});
const from = { url: "https://thesolface.site/", host: "thesolface.site", selector: "body > main > section:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > h2" };
const face = { family: "display", face: "Archivo Black", stack: "\"Archivo Black\", \"Arial Black\", Impact, sans-serif", weight: 900, leading: 0.99 };
const parts = [
  /* The lore title as the converter writes it: sized with the window. */
  node("fluid", "value-prop", { from, font: { ...face, size: 3.6, px: 92.16, fluid: "clamp(3.7rem, 6.4vw, 6.5rem)", spacing: -0.08 } }),
  /* Control: the manifesto title, a fixed size, spaced in px. */
  node("fixed", "value-prop", { from, font: { ...face, size: 3.43125, px: 87.84, spacing: -0.085, leading: 0.96 } }),
  /* Control: a paragraph sized with the window, drawn at its box's own size. */
  node("para", "prose", { from, content: "Some watch the market.", h: 36, font: { face: "Space Grotesk", size: 1.8, px: 28.8, fluid: "clamp(21px, 2vw, 31px)", spacing: -0.04, leading: 1.24 } }),
];
/* The part drawn with the theme `blocks.tsx` hands it (its font, then what a capture sets); drawing through `Block` itself needs the store, which a checkout on a case-blind disk cannot load. */
const draw = (n) => renderToStaticMarkup(React.createElement(n.featureId === "prose" ? Prose : ValueProp, {
  id: n.featureId, content: n.content, options: n.options, w: n.w, h: n.h, mode: "live",
  theme: applyCaptured(applyFont(t, n.font, { captured: true }), { from: n.from, h: n.h }),
}));

const AT = process.env.CHROMIUM ?? process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const extra = (process.env.CHROMIUM_ARGS ?? "").trim().split(/\s+/).filter(Boolean);
const browser = await chromium.launch({ args: ["--no-sandbox", ...extra], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${parts.map((n) => `<div id="${n.id}" style="position:relative;width:${n.w}px;height:${n.h}px">${draw(n)}</div>`).join("")}</body>`);
/* The element holding the first words: its size and spacing as computed. */
const read = await page.evaluate(() => Object.fromEntries(["fluid", "fixed", "para"].map((id) => {
  const w = document.createTreeWalker(document.getElementById(id), NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) if (n.textContent.trim()) break;
  const s = n ? getComputedStyle(n.parentElement) : null;
  return [id, s && { size: parseFloat(s.fontSize), ls: parseFloat(s.letterSpacing) }];
})));
await browser.close();

check("the fluid 92.16px title's words are spaced -7.37px, as the page spaced them", read.fluid?.size === 92.16 && Math.abs(read.fluid.ls + 7.3728) < 0.01, JSON.stringify(read.fluid));
check("control: the fixed-size 87.84px title keeps -7.47px", read.fixed?.size === 87.84 && Math.abs(read.fixed.ls + 7.4664) < 0.01, JSON.stringify(read.fixed));
check("control: a fluid paragraph drawn at its box's own size keeps -1.15px", read.para?.size === 28.8 && Math.abs(read.para.ls + 1.152) < 0.01, JSON.stringify(read.para));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
