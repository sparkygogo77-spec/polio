/**
 * A CAPTURED PART'S WORDS ARE SPACED AS THE PAGE SPACED THEM, AT THE SIZE THEY ARE DRAWN.
 *
 * MEASURED against stonkfun.xyz itself at 1440 and 2000 wide: its headline
 * "Launch coins paired with anything" (48px Sora, letter-spacing -2.64px,
 * -0.055em) came out 22px wider than the page's. The part's spacing is set on
 * its box in em, and an em resolves at the box's own size: the headline is a
 * value-prop, drawn at 1.6 × its box's 30px, so the words inherited -1.5px.
 * And the control's range stops at -0.05em, past which the page went.
 *
 * Captured with the size its words were drawn at (`font.px`), the spacing is
 * the page's own, set in px at that size. A part placed here keeps the
 * control's range, in em. Drawn the way the live page draws it, read in a
 * browser.
 *
 *   node tests/captured-spacing.mjs
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
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "dark" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const WORDS = "Launch coins paired with anything";
const node = (id, featureId, extra = {}) => ({
  id, pageId: "p0", featureId, label: id, prompt: "", content: WORDS, data: "", x: 73, y: 138, w: 544, h: 101, groupId: null,
  options: {}, priority: "must", custom: false, locked: false, link: null, colour: null, texture: null, ...extra,
});
const from = { url: "https://www.stonkfun.xyz/", host: "www.stonkfun.xyz", selector: "body > div > div > div > div > section > div > div:nth-of-type(2) > h1" };
const parts = [
  /* The headline as the converter writes it. */
  node("head", "value-prop", { from, colour: { text: "rgb(243, 248, 248)" }, font: { face: "Sora", size: 1.875, px: 48, weight: 800, spacing: -0.055, leading: 1.05 } }),
  /* A captured paragraph, drawn at its box's own size. */
  node("para", "prose", { from, h: 48, font: { face: "Sora", size: 1, px: 16, weight: 400, spacing: 0.02, leading: 1.5 } }),
  /* Control: one placed by hand, asking past the control's range. */
  node("hand", "prose", { h: 48, font: { size: 1, weight: 400, spacing: -0.2 } }),
];
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h } }));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${parts.map((n) => `<div id="${n.id}" style="position:relative;width:${n.w}px;height:${n.h}px">${draw(n)}</div>`).join("")}</body>`);
/* The element holding the words: its size and spacing as computed. */
const read = await page.evaluate((W) => Object.fromEntries(["head", "para", "hand"].map((id) => {
  const w = document.createTreeWalker(document.getElementById(id), NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) if (n.textContent.includes(W.split(" ")[0])) break;
  const s = n ? getComputedStyle(n.parentElement) : null;
  return [id, s && { size: parseFloat(s.fontSize), ls: s.letterSpacing }];
})), WORDS);
await browser.close();

const px = (v) => parseFloat(v);
check("the 48px headline's words are spaced -2.64px, as the page spaced them", read.head?.size === 48 && Math.abs(px(read.head?.ls) + 2.64) < 0.01, JSON.stringify(read.head));
check("a captured paragraph at its box's own size keeps its spacing (0.32px at 16px)", Math.abs(px(read.para?.ls) - 0.32) < 0.01, JSON.stringify(read.para));
check("control: a part placed by hand is held to the control's range (-0.05em)", Math.abs(px(read.hand?.ls) / (read.hand?.size ?? 1) + 0.05) < 0.002, JSON.stringify(read.hand));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
