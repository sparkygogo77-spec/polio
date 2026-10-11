#!/usr/bin/env node
/**
 * WORDS INSIDE A DRAWN SVG ARE DRAWN ONCE, BY THE PICTURE.
 *
 * PonsStars' redesign has a dial in its nav: an inline svg whose hooked
 * <text>s ("PLAY", "FILE", "REC", "RANK") run round it, two of them turned
 * up its sides. The svg is read whole as a picture, words included; each
 * hooked <text> was then read again as a part with those words, drawn
 * upright over the picture in this machine's face, three letters in a
 * 10px box — 20px tall where the page's were 15. The board's settle took
 * the dial for 5px taller and moved the whole page down by 5 (J,
 * 2026-10-11, "sizing seems to be off").
 *
 * A hooked <text> in a drawn svg keeps its hook and its box and says no
 * words of its own; the picture carries them. A <text> in an svg that is
 * not drawn (one whose shapes are parts of their own) keeps its words as
 * before.
 *
 *   node tests/svg-words-once.mjs
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/bring-in/pageParts.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(`<!doctype html><body style="margin:0;font:16px Arial">
<nav data-hook="nav" style="width:176px;display:grid;justify-items:center;gap:8px;padding:16px 0">
  <svg data-hook="dial" viewBox="0 0 120 120" width="120" height="120" style="display:block;font:700 8px Arial;letter-spacing:.1em">
    <circle cx="60" cy="60" r="56" fill="#e8c56a" stroke="#2b1d12" stroke-width="3"/>
    <text data-hook="dial-labels" x="60" y="21" text-anchor="middle" fill="#2b1d12"><tspan data-hook="dial-label-play">PLAY</tspan><tspan x="60" y="106">FILE</tspan></text>
    <text data-hook="dial-labels-left" transform="rotate(-90 17 60)" x="17" y="60" text-anchor="middle" fill="#2b1d12">REC</text>
  </svg>
  <a data-hook="nav-play" href="#" style="display:block;width:140px;padding:10px;background:#e8c56a">Play</a>
</nav></body>`);
const real = await page.evaluate(() => Object.fromEntries(["dial", "dial-labels-left", "nav-play"].map((h) => { const r = document.querySelector(`[data-hook="${h}"]`).getBoundingClientRect(); return [h, [r.left, r.top, r.width, r.height].map(Math.round)]; })));
const read = await page.evaluate(PARTS, 1500);
const by = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);
const dial = by("dial"), left = by("dial-labels-left"), labels = by("dial-labels");
check("the svg is read as one drawn picture holding its words", !!dial && /url\("data:image\/svg\+xml/.test(dial.style.image ?? "") && /REC/.test(decodeURIComponent(dial.style.image ?? "")), (dial?.style.image ?? "").slice(0, 40));
check("the turned label keeps its hook and its box", !!left && Math.abs(left.box.w - real["dial-labels-left"][2]) <= 2 && Math.abs(left.box.h - real["dial-labels-left"][3]) <= 2, JSON.stringify({ read: left?.box, real: real["dial-labels-left"] }));
check("it says no words of its own: the picture has them", !!left && left.words === "", JSON.stringify(left?.words));
check("nor does the upright label", !!labels && labels.words === "", JSON.stringify(labels?.words));
const { doc } = pagesToDoc([{ file: "index.html", read }], { byHook: true });
const node = (h) => doc.nodes.find((n) => n.hooks?.["data-hook"] === h);
check("on the board the label is a hooked box with no content to draw", !!node("dial-labels-left") && !(typeof node("dial-labels-left").content === "string" && node("dial-labels-left").content.trim()), JSON.stringify(node("dial-labels-left")?.content));
check("the link under the dial keeps its words", node("nav-play")?.content === "Play" || JSON.stringify(node("nav-play")?.content).includes("Play"), JSON.stringify(node("nav-play")?.content));
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
