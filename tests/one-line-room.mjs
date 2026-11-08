/**
 * A CAPTURED ONE-LINE PART WHOSE LEADING DOES NOT FIT ITS BOX TAKES THE LINE ITS BOX HAS.
 *
 * MEASURED on trendtrader-pro (the import checkup, 2026-11-01, EDIT-ISSUES
 * #58). Its "Markets" tab is a 13px button the page drew 55 tall with 18px
 * of padding above its words and 22 below: 15px of room, one line at the
 * face's normal line. The capture recorded the leading the page's stylesheet
 * gave buttons, 1.6, so the board set the line at 20.8px, the button grew to
 * 61 to hold it, its row to 61, and the 272 parts under it moved down 6px;
 * the published page kept 55, so board and page differed by the same.
 *
 * As a document is taken in (`docTake.ts#fitLeading`), a captured part whose
 * box (less its padding) cannot hold even one line at its recorded leading
 * takes that room as its line: it was one line on the page, drawn in the
 * room it had. A box with room for its line keeps its leading; so does a
 * part placed here, and a part with no leading of its own (`tests/normal-leading.mjs`
 * sets those). The line the board then draws is read through the theme, as
 * the board reads it.
 *
 *   node tests/one-line-room.mjs
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { fitLeading } = await jiti.import(join(here, "..", "src", "features", "studio", "docTake.ts"));
const { themeFrom, applyFont, applyPad, applyCaptured } = await jiti.import(join(here, "..", "src", "features", "studio", "shelf", "parts", "theme.ts"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const t = themeFrom({ "palette.mode": "dark" });
const sans = (px, extra = {}) => ({ family: "system sans", face: "DM Sans", size: px / 16, px, stack: "\"DM Sans\", Arial, sans-serif", weight: 400, ...extra });
const from = (selector) => ({ url: "https://trendtrader.pro/", host: "trendtrader.pro", selector });
/** The height one line draws at for a part once taken in, as the board would set it. */
const line = (n) => { const [m] = fitLeading([n]); const th = applyCaptured(applyPad(applyFont(t, m.font, { captured: !!m.from }), m.pad), m); return Math.round(th.fontPx * th.lineHeight * 100) / 100; };
const taken = (n) => fitLeading([n])[0];

const markets = { id: "n_ctaprimary_644", from: from("body > main > section:nth-of-type(11) > div:nth-of-type(2) > div:nth-of-type(3) > div > button:nth-of-type(1)"), h: 55, pad: { top: 18, right: 0, bottom: 22, left: 0 }, font: sans(13, { leading: 1.6 }) };
check("the 13px “Markets” tab, 55 tall padded 18 and 22, takes the 15 between as its line: leading 1.1538", taken(markets).font.leading === 1.1538, `${taken(markets).font.leading}`);
check("…and draws its line 15, not 20.8", line(markets) === 15, `${line(markets)}`);
const tight = { from: from("body > main > p"), h: 14, font: sans(13, { leading: 1.6 }) };
check("a 13px line in a 14px box with no padding draws 14", line(tight) === 14, `${line(tight)}`);
const fits = { from: from("body > main > section > button:nth-of-type(2)"), h: 61, pad: { top: 18, right: 0, bottom: 22, left: 0 }, font: sans(13, { leading: 1.6 }) };
check("control: a tab with room for its 20.8 line keeps the 1.6 the capture recorded", taken(fits) === fits && line(fits) === 20.8, `${line(fits)}`);
const two = { from: from("body > main > section > p:nth-of-type(2)"), h: 42, font: sans(13, { leading: 1.6 }) };
check("control: two lines at 1.6 in a 42px box keep their 20.8", taken(two) === two && line(two) === 20.8, `${line(two)}`);
const hand = { from: null, h: 14, font: { size: 13 / 16, leading: 1.6 } };
check("control: a part placed here keeps its leading", taken(hand) === hand && line(hand) === 20.8, `${line(hand)}`);
const normal = { from: from("body > main > p > span:nth-of-type(2)"), h: 14, font: sans(11) };
check("control: a part with no leading of its own is left for the theme to read (14)", taken(normal) === normal && line(normal) === 14, `${line(normal)}`);
const list = [markets, fits];
check("a list with nothing to fit is handed back as it was", fitLeading([fits, two]) !== list && fitLeading([fits, two]).length === 2 && fitLeading([fits, two])[0] === fits, "");

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
