#!/usr/bin/env node
/**
 * A SCREEN IS DRAWN WHERE ITS CODE DRAWS IT, AND A COVERED PART CAN BE PICKED.
 *
 *   1. `screenPlaces`: PonsStars' balance panel shows the practice note above
 *      the wallet line in a screen; the board kept both where the page first
 *      drew them, on top of each other. With the screen's own boxes (read at
 *      import), lined up with the page's parts by their median offset and
 *      scale, each shown part is drawn where the screen drew it, and a part
 *      with no hook moves with the hooked part that holds it.
 *   2. `partUnder`: two presses on a part that holds others (the TV, whose
 *      still covers its duel circles) pick the smallest part under the hand,
 *      inside it.
 *
 *   node tests/screen-places.mjs
 *
 * Covers: src/features/studio/boardStates.ts, src/features/studio/Canvas.tsx, src/features/studio/Inspector.tsx, src/app/api/studio/zip/route.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const B = await jiti.import(join(here, "..", "src", "features", "studio", "boardStates.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const node = (id, hook, x, y, w, h, extra = {}) => ({ id, pageId: "p", hooks: hook ? { "data-hook": hook } : {}, x, y, w, h, ...extra });
/* The board, as the page first drew it (offset 100,50 from the screen's corner). */
const nodes = [
  node("panel", "balance-panel", 1100, 300, 200, 300),
  node("title", "balance-title", 1110, 310, 180, 20),
  node("head", "page-title", 100, 60, 400, 40),
  node("nav", "nav", 100, 20, 600, 20),
  node("wallet", "balance-wallet-line", 1110, 400, 180, 20),
  node("money", "balance-play-money", 1110, 400, 180, 60, { state: { group: "hidden:balance-play-money", option: 1 } }),
  node("money-words", null, 1115, 405, 170, 50, { state: { group: "hidden:balance-play-money", option: 1 } }),
  node("pending", "balance-pending", 1110, 430, 180, 20),
];
const screens = [{ name: "lobby", page: "web/index.html", shows: ["balance-panel", "balance-title", "page-title", "nav", "balance-play-money", "balance-wallet-line", "balance-pending"], boxes: {
  "balance-panel": [1000, 250, 200, 360], "balance-title": [1010, 260, 180, 20], "page-title": [0, 10, 400, 40], nav: [0, -30, 600, 20],
  "balance-play-money": [1010, 350, 180, 60], "balance-wallet-line": [1010, 420, 180, 20], "balance-pending": [1010, 450, 180, 20],
} }];
const on = ["screen:lobby"];
const shows = B.boardShows(on, screens, () => "p");
const placed = B.screenPlaces(nodes, on, screens, () => "p", shows);
const at = (id) => placed.get(id) ?? nodes.find((n) => n.id === id);
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
check("as first drawn, the two states sit on top of each other", overlap(nodes.find((n) => n.id === "money"), nodes.find((n) => n.id === "wallet")));
check("with the screen on, the note and the wallet line are where the screen drew them, apart", !overlap(at("money"), at("wallet")) && at("wallet").y === 470 && at("money").y === 400, J([at("money"), at("wallet")]));
check("a part with no hook moves with the hooked part that holds it", at("money-words").y === 405 && at("money-words").x === 1115, J(at("money-words")));
check("a part already where the screen drew it is left alone", !placed.has("head") && !placed.has("title"), J([...placed.keys()]));
check("no screen on, nothing moves", B.screenPlaces(nodes, [], screens, () => "p", shows).size === 0);
check("a screen read before boxes were kept moves nothing", B.screenPlaces(nodes, on, [{ ...screens[0], boxes: undefined }], () => "p", shows).size === 0);
const scaled = { ...screens[0], boxes: Object.fromEntries(Object.entries(screens[0].boxes).map(([k, b]) => [k, b.map((v) => v / 2)])) };
const half = B.screenPlaces(nodes, on, [scaled], () => "p", shows);
check("a screen read at another width is scaled to the board", (half.get("wallet") ?? {}).y === 470, J(half.get("wallet")));

/* 2. the part under the hand */
const tv = node("tv", "chart-tv-match", 330, 335, 702, 480);
const still = node("canvas", "chart-canvas", 330, 335, 702, 480);
const circle = node("me", "duel-circle-me", 600, 500, 40, 40);
const elsewhere = node("far", "balance-panel", 1100, 300, 200, 300);
const all = [tv, circle, elsewhere];
check("two presses on the TV pick the duel circle under the hand", B.partUnder(all, tv, { x: 620, y: 520 }, () => true)?.id === "me");
check("a part of the same size is not 'inside'", B.partUnder([tv, still], tv, { x: 400, y: 400 }, () => true) === null);
check("a part not shown is not picked", B.partUnder(all, tv, { x: 620, y: 520 }, (n) => n.id !== "me") === null);
check("nothing under the hand, nothing picked", B.partUnder(all, tv, { x: 340, y: 800 }, () => true) === null);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
