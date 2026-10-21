/**
 * A CAPTURED LINE THE PAGE SET AT `line-height: normal` IS AS TALL AS ITS BOX SAYS.
 *
 * MEASURED on thesolface.site brought in through the Capture a site door
 * (run 39670562970, 2026-10-21). Its eyebrows ("/ THE STORY THEY DIDN'T
 * CHART", "A SOLANA-BORN MEME PHENOMENON", 11px DM Mono), its footer tag
 * (12px) and its glyphs (a 76px "✳", a 27px "➤") are set at
 * `line-height: normal`: 14, 16 and 106 tall on the page. The capture reads
 * no number for `normal`, and for a block element records no line box to
 * read one from, so the part carries no `font.leading`, and the board set it
 * at the theme's 1.55: 17, 19 and 118 tall. Every label on the page grew
 * 3 to 13px and pushed what was under it.
 *
 * A captured part with no leading of its own takes its line from its box:
 * the box's room (less its padding), divided into the whole lines a normal
 * line (about 1.25 of its size) would make, at least one. A leading the
 * capture recorded, and a part placed here, keep theirs.
 *
 *   node tests/normal-leading.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { themeFrom, applyFont, applyCaptured } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const t = themeFrom({ "palette.mode": "dark" });
const mono = (px, extra = {}) => ({ family: "monospace", face: "DM Mono", size: px / 16, px, stack: "\"DM Mono\", \"Courier New\", monospace", weight: 500, ...extra });
const black = (px, extra = {}) => ({ family: "display", face: "Archivo Black", size: px / 16, px, stack: "\"Archivo Black\", \"Arial Black\", Impact, sans-serif", weight: 400, ...extra });
const from = (selector) => ({ url: "https://thesolface.site/", host: "thesolface.site", selector });
/** The height one line draws at for a part, as the board would set it. */
const line = (n) => { const th = applyCaptured(applyFont(t, n.font, { captured: !!n.from }), n); return Math.round(th.fontPx * th.lineHeight * 100) / 100; };

const eyebrow = { from: from("body > main > section:nth-of-type(2) > div > div:nth-of-type(2) > div:nth-of-type(2) > p:nth-of-type(1)"), h: 14, font: mono(11) };
check("an 11px eyebrow set at normal draws its line 14 tall, as the page did", line(eyebrow) === 14, `${line(eyebrow)}`);
const tag = { from: from("body > footer > div:nth-of-type(1) > div > p"), h: 16, font: mono(12, { weight: 400 }) };
check("the 12px footer tag draws 16", line(tag) === 16, `${line(tag)}`);
const star = { from: from("body > main > section:nth-of-type(5) > div:nth-of-type(2) > div:nth-of-type(3) > article:nth-of-type(1) > div:nth-of-type(2)"), h: 106, font: black(76) };
check("the 76px ✳ draws 106, not the theme's 118", line(star) === 106, `${line(star)}`);
const arrow = { from: from("body > main > section:nth-of-type(8) > div:nth-of-type(3) > div > div > a:nth-of-type(1) > span:nth-of-type(1)"), h: 35, pad: { top: 4, right: 0, bottom: 4, left: 0 }, font: black(27) };
check("the 27px ➤ in a 35 box padded 4 and 4 draws its line in the 27 between", line(arrow) === 27, `${line(arrow)}`);
const two = { from: eyebrow.from, h: 28, font: mono(11) };
check("two lines of the same at normal, 28 tall, draw 14 each", line(two) === 14, `${line(two)}`);
/* A value-prop draws its words at 1.6 × its box's size: its line is a multiple of the size the page drew them at, `font.px`. */
const trench = { from: from("body > main > section:nth-of-type(3) > div > div:nth-of-type(3) > div:nth-of-type(2) > div:nth-of-type(2) > div:nth-of-type(1) > h3"), h: 39, font: black(29, { size: 1.1328125, spacing: -0.06 }) };
const drawnLine = (n) => { const th = applyCaptured(applyFont(t, n.font, { captured: true }), n); return Math.round(n.font.px * th.lineHeight * 100) / 100; };
check("a 29px heading drawn at 1.6 × its box's size takes its 39 line at the size it is drawn", drawnLine(trench) === 39, `${drawnLine(trench)}`);
const set = { from: from("body > main > section:nth-of-type(1) > div:nth-of-type(6) > div:nth-of-type(1) > div:nth-of-type(3) > span:nth-of-type(1)"), h: 41, font: mono(23, { leading: 1.7 }) };
check("control: a leading the capture recorded (1.7 at 23px) is kept: 39.1", line(set) === 39.1, `${line(set)}`);
const hand = { from: null, h: 14, font: { size: 11 / 16 } };
check("control: a part placed here keeps the theme's leading", Math.abs(line(hand) / (16 * (11 / 16)) - t.lineHeight) < 0.01, `${line(hand)}`);

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
