#!/usr/bin/env node
/**
 * A PART'S STATES, AND WHAT MOVES WITH IT.
 *
 * J (2026-10-04): "way too many states, i should select one like the TV and
 * a timeline should open of the states it goes through". And the antennas'
 * red balls stood still while the rods swung.
 *   1. `screensOfPart`: the screens that change what a part draws (the TV
 *      waking, offline, a match), each once, in order; a screen that draws
 *      the same inside it as the page opens with is not one of its states.
 *   2. `rideAnimations`: a part inside an animated, transformed part takes
 *      its animation and its pose, about the same point.
 *   3. The States menu lists parts and opens their timeline (source read).
 *
 *   node tests/states-by-part.mjs
 *
 * Covers: src/features/studio/boardStates.ts, src/features/studio/pageParts.ts, src/features/studio/StatesTimeline.tsx, src/features/studio/StudioPage.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const B = await jiti.import(join(here, "..", "src", "features", "studio", "boardStates.ts"));
const P = await jiti.import(join(here, "..", "src", "features", "studio", "pageParts.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const node = (id, hook, x, y, w, h, extra = {}) => ({ id, pageId: "p", hooks: { "data-hook": hook }, x, y, w, h, ...extra });
const tv = node("tv", "chart-tv", 300, 300, 700, 500);
const nodes = [tv, node("static", "chart-tv-static", 320, 320, 600, 400), node("loading", "chart-tv-loading", 400, 400, 300, 100),
  node("offline", "chart-tv-offline", 400, 400, 300, 100, { state: { group: "hidden:chart-tv-offline", option: 1 } }),
  node("chart", "chart", 320, 320, 600, 400, { state: { group: "hidden:chart", option: 1 } }),
  node("balance", "balance-panel", 1100, 300, 200, 300)];
const scr = (name, shows) => ({ name, label: name, page: "web/index.html", shows });
const screens = [
  scr("connecting", ["chart-tv", "chart-tv-static", "chart-tv-loading", "balance-panel"]),
  scr("lobby", ["chart-tv", "chart-tv-static", "chart-tv-loading", "balance-panel", "balance-extra"]),
  scr("tv-offline", ["chart-tv", "chart-tv-static", "chart-tv-offline", "balance-panel"]),
  scr("tv-match", ["chart-tv", "chart"]),
  scr("tv-match-again", ["chart-tv", "chart"]),
  { ...scr("other-page", ["chart-tv", "chart"]), page: "web/profile.html" },
];
const its = B.screensOfPart(nodes, tv, screens, "web/index.html").map((s) => s.name);
check("the TV's states are the screens that change what it draws, in order", J(its) === J(["tv-offline", "tv-match"]), J(its));
const wide = [scr("mid-match", ["chart-tv", "chart", "balance-panel", "nav", "page-title", "wallet"]), ...screens];
check("a state is named by the screen most about the part (tv-match over the page-wide mid-match)", J(B.screensOfPart(nodes, tv, wide, "web/index.html").map((s) => s.name)) === J(["tv-match", "tv-offline"]), J(B.screensOfPart(nodes, tv, wide, "web/index.html").map((s) => s.name)));
const copies = [scr("result-win", ["chart-tv", "chart", "balance-panel"]), { ...scr("tv-result", ["chart-tv", "chart", "balance-panel"]), label: "Chart TV: the result" }];
check("between whole-page copies, the one whose name says the part wins", J(B.screensOfPart(nodes, tv, copies, "web/index.html").map((s) => s.name)) === J(["tv-result"]), J(B.screensOfPart(nodes, tv, copies, "web/index.html").map((s) => s.name)));
check("a part no screen changes has none", B.screensOfPart(nodes, nodes[5], screens, "web/index.html").length === 0);

const parts = [
  { id: "rod", x: 717, y: 249, from: { selector: "div > i:nth-of-type(1)" }, motion: { animation: [{ name: "swing", duration: "3s" }] }, art: { transform: "matrix(0.85, -0.53, 0.53, 0.85, 0, 0)", origin: "3px 90px" } },
  { id: "ball", x: 709, y: 238, from: { selector: "div > i:nth-of-type(1) > i" }, art: { transform: "matrix(0.85, -0.53, 0.53, 0.85, -47.6, 13.6)" } },
  { id: "other", x: 0, y: 0, from: { selector: "div > p" } },
];
P.rideAnimations(parts);
check("the ball swings with its rod", parts[1].motion?.animation?.[0]?.name === "swing", J(parts[1].motion));
check("about the rod's foot, said from the ball's corner", parts[1].art.origin === "11px 101px", parts[1].art.origin);
check("and stands still as the rod stands it", parts[1].art.transform === parts[0].art.transform);
check("a part outside it is left alone", !parts[2].motion);

const page = ["StudioPage.tsx", ...["sizes.ts", "head.tsx", "toolbar.tsx", "side.tsx", "StudioPage.tsx"].map((f) => `page/${f}`)].map((f) => `src/features/studio/${f}`).map((f) => readFileSync(join(here, "..", f), "utf8")).join("\n");
check("the States menu lists parts, each opening its timeline (source read)", /data-states-frame=\{f\.frame\}/.test(page) && /openPanelsPage\(f\.frame\)/.test(page) && /data-states-more/.test(page));

const studio = readFileSync(join(here, "..", "src", "features", "studio", "page", "StudioPage.tsx"), "utf8");
check("the Panels shelf is gone: the shelf keeps its categories and the Panels page sits over the board (source read)", !/<StatesTimeline/.test(studio) && /<Palette \/>/.test(studio) && /\{design \? <PanelsPage \/> : null\}/.test(studio));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
