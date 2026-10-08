#!/usr/bin/env node
/**
 * A TURNED BOX HIDDEN AS THE PAGE OPENS COMES IN TURNED, AND A CAPTURE NEVER UNTURNS IT (J, 2026-10-06).
 *
 * J: "antennas are fixed in some places but not everywhere". PST's chart TV
 * antennas came in right, the player card's did not: the card is a panel off
 * as the page opens, and a turned box is only measured unturned when it has
 * a layout, so its rods came in as the box round each lean, upright (19x31
 * for a 4x34 rod at 28deg). And a scene with a capture placed a rod at the
 * capture's box, again the box round the lean, then turned it once more.
 *
 *   1. a rod in a block hidden as the page opens is read at its own size
 *      (4x34), turned, as the same rod in a block that shows is;
 *   2. a turned part in a captured scene moves with the part round it at
 *      its own size; an unturned one still goes to the capture's box.
 *
 *   node tests/turns-hidden.mjs
 *
 * Covers: src/features/studio/bring-in/siteread/parts.ts, src/features/studio/states/boardStates.ts
 */
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { screenPlaces } from "../src/features/studio/states/boardStates.ts";
import { launch } from "./fixtures/look-sites.mjs";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* 1 */
const rodCss = "position:absolute;bottom:0;left:-2px;width:4px;height:34px;background:#1a0f0b;transform-origin:50% 100%;transform:rotate(28deg)";
const tv = (hook) => `<div data-hook="${hook}" style="position:relative;width:120px;height:120px;padding-top:34px;background:#f5a">
  <div data-hook="${hook}-antenna" style="position:absolute;left:50%;top:0;width:0;height:34px"><i data-hook="${hook}-rod" style="${rodCss}"></i></div><p>TV</p></div>`;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.setContent(`<!doctype html><body style="margin:0"><main>${tv("shown")}<section data-hook="card" hidden>${tv("hidden")}</section></main></body>`);
const read = await page.evaluate(PARTS, 500);
await browser.close();
const rod = (h) => read.parts.find((p) => p.hooks?.["data-hook"] === h);
const shown = rod("shown-rod"), hidden = rod("hidden-rod");
check("1. the shown rod is read 4x34, turned", shown?.box.w === 4 && shown?.box.h === 34 && !!shown?.turn, J(shown?.box));
check("1. the rod hidden as the page opens is read 4x34, turned, as the shown one", hidden?.box.w === 4 && hidden?.box.h === 34 && !!hidden?.turn, J({ box: hidden?.box, turn: hidden?.turn }));

/* 2 */
const n = (id, hook, sel, x, y, w, h, extra = {}) => ({ id, pageId: "p", hooks: { "data-hook": hook }, from: { selector: sel }, x, y, w, h, ...extra });
const nodes = [
  n("nav", "nav", "body > nav", 0, 0, 800, 40), n("title", "title", "body > h1", 0, 50, 800, 40), n("foot", "foot", "body > footer", 0, 500, 800, 40),
  n("ant", "ant", "body > div > div", 400, 100, 0, 34),
  n("rod", "rod", "body > div > div > i", 398, 100, 4, 34, { art: { transform: "matrix(0.8829, 0.4695, -0.4695, 0.8829, 0, 0)" } }),
  n("word", "word", "body > div > p", 300, 140, 100, 20),
];
const screen = { name: "s", page: "index.html", shows: nodes.map((x) => x.hooks["data-hook"]), boxes: { nav: [0, 0, 800, 40], title: [0, 50, 800, 40], foot: [0, 500, 800, 40], ant: [400, 120, 0, 34], rod: [400, 121, 19, 31], word: [320, 160, 100, 20] } };
const places = screenPlaces(nodes, ["screen:s"], [screen], () => "p", () => true);
check("2. a turned part goes with the part round it, at its own size", J(places.get("rod")) === J({ x: 398, y: 120, w: 4, h: 34 }), J(places.get("rod")));
check("2. an unturned part still goes to the capture's box", J(places.get("word")) === J({ x: 320, y: 160, w: 100, h: 20 }), J(places.get("word")));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
