#!/usr/bin/env node
/**
 * WORDS IN A DRAWN SVG KEEP THE FACE THE PAGE SET THEM IN.
 *
 * An inline svg is read whole as a data: picture, each shape's computed
 * fill and stroke written on it so the picture draws as the page did. Its
 * <text>s got no such care: the stylesheet's `font: 700 8px "Gill Sans"`
 * and `letter-spacing` stayed in the page, and the picture set its words
 * in the svg default (a 16px serif), so PonsStars' dial labels drew wrong
 * and too big (J, 2026-10-11). The face, size, weight, spacing and anchor
 * now travel with the words.
 *
 *   node tests/svg-text-faces.mjs
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(`<!doctype html><head><style>
  [data-hook="dial-labels"] { font: 700 8px Arial, sans-serif; letter-spacing: .12em; text-anchor: middle; text-transform: uppercase; fill: #2b1d12; }
</style></head><body style="margin:0;font:16px Georgia">
  <svg data-hook="dial" viewBox="0 0 120 120" width="120" height="120" style="display:block">
    <circle cx="60" cy="60" r="56" fill="#e8c56a"/>
    <text data-hook="dial-labels" x="60" y="21">play</text>
  </svg></body>`);
const read = await page.evaluate(PARTS, 1500);
const dial = read.parts.find((p) => p.hooks?.["data-hook"] === "dial");
const svg = decodeURIComponent((dial?.style.image ?? "").replace(/^url\("data:image\/svg\+xml;charset=utf-8,/, "").replace(/"\)$/, ""));
const textStyle = /<text[^>]*style="([^"]*)"/.exec(svg)?.[1] ?? "";
check("the picture's text carries its font family", /font-family:\s*Arial/.test(textStyle), textStyle.slice(0, 200));
check("and its size and weight", /font-size:\s*8px/.test(textStyle) && /font-weight:\s*700/.test(textStyle), "");
check("and its letter-spacing", /letter-spacing:\s*0\.96px/.test(textStyle), "");
check("and its anchor and transform", /text-anchor:\s*middle/.test(textStyle) && /text-transform:\s*uppercase/.test(textStyle), "");
/* Drawn as the picture, the words are the size the page drew them. */
const drawn = await page.evaluate(async (src) => { const img = new Image(); img.src = src; await img.decode(); const c = document.createElement("canvas"); c.width = 120; c.height = 120; const g = c.getContext("2d"); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, 120, 40).data; let minX = 120, maxX = 0, minY = 40, maxY = 0; for (let y = 0; y < 40; y++) for (let x = 0; x < 120; x++) { const i = (y * 120 + x) * 4; if (d[i] < 100 && d[i + 1] < 80 && d[i + 3] > 128) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y); } } return { w: maxX - minX + 1, h: maxY - minY + 1, y: minY }; }, (dial?.style.image ?? "").replace(/^url\("/, "").replace(/"\)$/, ""));
const real = await page.evaluate(() => { const r = document.querySelector('[data-hook="dial-labels"]').getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; });
check("drawn from the picture, the word is as wide as on the page (within 3px)", Math.abs(drawn.w - real.w) <= 3 && drawn.h <= 12, JSON.stringify({ drawn, real }));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
