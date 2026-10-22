/**
 * A CAPTURED BUTTON'S LABEL IS DRAWN WHOLE, IN THE CASE AND SPACING IT WAS SET IN.
 *
 * MEASURED against share.xyz itself, its event page at 1440 and 2000 wide:
 *
 *   · the outcome rows are buttons reading "June 30, 2027" and "December 31,
 *     2026", and the part drew "June 30" and "December 31": its words were
 *     read as a list by their commas (`items`), and the first item kept;
 *   · the YES / NO keys set their words in capitals (`text-transform:
 *     uppercase`, carried as `text.transform`) and read "Yes" / "No": the part
 *     draws its words in a <button>, and the browser's own stylesheet gives a
 *     button `text-transform: none` and `letter-spacing: normal`, so the case
 *     and the spacing set round it never reached the words.
 *
 * A captured control's words are one label, commas and all, and its button
 * takes the case and spacing of its part. A hand-placed button is unchanged.
 * Drawn the way the live page draws it, then read in a browser.
 *
 *   node tests/button-label-whole.mjs
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
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const { Block } = await jiti.import(join(here, "..", "src", "features", "studio", "blocks.tsx"));
const { themeFrom, resolvePalette } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const format = { "palette.mode": "light" };
const t = themeFrom(format), palette = resolvePalette(format, undefined);
const node = (id, content, extra = {}) => ({
  id, pageId: "p0", featureId: "cta-primary", label: id, prompt: "", content, data: "", x: 0, y: 0, w: 400, h: 40, groupId: null,
  options: { shape: "rounded", variant: "solid", size: "medium" }, priority: "must", custom: false, locked: false, link: null, colour: null, font: null, texture: null, ...extra,
});
const draw = (n) => renderToStaticMarkup(React.createElement(Block, { node: n, t, palette, mode: "live", size: { w: n.w, h: n.h } }));
const from = (selector) => ({ url: "https://share.xyz/event/ai-bubble-burst-by/85299", host: "share.xyz", selector });

/* share.xyz's outcome row, as the converter writes it. */
const row = node("row", "June 30, 2027", {
  x: 76, y: 626, w: 400, h: 20, from: from("body > div > main > ul > li:nth-of-type(1) > button"),
  colour: { text: "rgb(0, 0, 0)" }, font: { face: "interLatin", px: 16, size: 1, weight: 600, leading: 1.25 }, text: { align: "left" },
});
/* Its YES key: capitals, 0.15px apart, the words beside a price bar. */
const yes = node("yes", "Yes", {
  x: 704, y: 626, w: 136, h: 40, from: from("body > div > main > ul > li:nth-of-type(1) > div > button:nth-of-type(1)"),
  colour: { bg: "rgb(4, 210, 79)", text: "rgb(255, 255, 255)" }, font: { face: "interLatin", px: 12, size: 0.75, weight: 600, spacing: 0.0125, leading: 1.33 },
  text: { align: "center", transform: "uppercase" }, pad: { top: 1, right: 72, bottom: 1, left: 36 }, radius: 9,
});
/* Control: a button placed by hand, typed as a list by its commas, still takes the first. */
const plain = node("plain", "Get started, Learn more", { w: 160, h: 44 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
await page.setContent(`<!doctype html><body style="margin:0">${[row, yes, plain].map((n) => `<div id="${n.id}" style="position:relative;width:${n.w}px;height:${n.h}px">${draw(n)}</div>`).join("")}</body>`);
const read = await page.evaluate(() => Object.fromEntries(["row", "yes", "plain"].map((id) => {
  const b = document.querySelector(`#${id} button`);
  if (!b) return [id, null];
  let up = b.parentElement; while (up && getComputedStyle(up).textTransform === "none" && up.id !== id) up = up.parentElement;
  const s = getComputedStyle(b);
  return [id, { words: b.textContent, shown: b.innerText, tt: s.textTransform, ls: s.letterSpacing, partTt: up ? getComputedStyle(up).textTransform : null }];
})));
await browser.close();

check("an outcome row reads its whole label, commas and all", read.row?.words === "June 30, 2027", JSON.stringify(read.row?.words));
check("the YES key sets its words in capitals, as the page did", read.yes?.tt === "uppercase" && read.yes?.shown === "YES", `${read.yes?.tt}: ${JSON.stringify(read.yes?.shown)}`);
check("…and 0.15px apart, as the page did", Math.abs(parseFloat(read.yes?.ls) - 0.15) < 0.01, read.yes?.ls);
check("control: a hand-placed button typed as a list still draws its first item", read.plain?.words === "Get started", JSON.stringify(read.plain?.words));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
