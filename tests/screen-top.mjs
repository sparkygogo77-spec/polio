#!/usr/bin/env node
/**
 * A SCREEN KEEPS THE PAGE'S TOP ON THE PAGE.
 *
 * J (2026-10-06): with PonsStars' "game server is offline" screen on, the
 * board's name sat over the site. The screen adds a line high up ("Game
 * server offline."), which moves most parts down; lined up by their median
 * offset, the nav and the title were drawn above the page's top edge. The
 * screen's top now stays on the page's top, and what the line pushed down
 * is drawn lower instead.
 *
 *   node tests/screen-top.mjs
 *
 * Covers: src/features/studio/boardStates.ts
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

const node = (id, hook, x, y, w, h, extra = {}) => ({ id, pageId: "p", hooks: { "data-hook": hook }, x, y, w, h, ...extra });
const nodes = [
  node("nav", "nav", 100, 20, 600, 20),
  node("title", "page-title", 100, 60, 400, 40),
  node("notice", "test-note", 100, 120, 800, 20),
  node("offline", "server-offline", 100, 160, 300, 30, { state: { group: "hidden:server-offline", option: 1 } }),
  node("wallet", "wallet-panel", 100, 160, 300, 400),
  node("tv", "chart-tv-box", 500, 160, 800, 500),
  node("balance", "balance-panel", 1400, 160, 300, 400),
  node("wallet-title", "wallet-title", 110, 170, 200, 20),
  node("tv-title", "chart-tv-title", 510, 170, 200, 20),
  node("balance-title", "balance-title", 1410, 170, 200, 20),
  node("tour", "tour-card", 600, 300, 200, 100, { from: { position: "fixed" } }),
];
/* The screen drew the offline line where the panels stood and the panels 50px lower. */
const screens = [{ name: "offline", page: "web/index.html", shows: ["wallet-title", "chart-tv-title", "balance-title", "nav", "page-title", "test-note", "server-offline", "wallet-panel", "chart-tv-box", "balance-panel", "tour-card"], boxes: {
  nav: [0, 0, 600, 20], "page-title": [0, 40, 400, 40], "test-note": [0, 100, 800, 20], "server-offline": [0, 140, 300, 30],
  "wallet-panel": [0, 190, 300, 400], "chart-tv-box": [400, 190, 800, 500], "balance-panel": [1300, 190, 300, 400], "wallet-title": [10, 200, 200, 20], "chart-tv-title": [410, 200, 200, 20], "balance-title": [1310, 200, 200, 20], "tour-card": [500, -400, 200, 100],
} }];
const on = ["screen:offline"];
const shows = B.boardShows(on, screens, () => "p");
const placed = B.screenPlaces(nodes, on, screens, () => "p", shows);
const at = (id) => placed.get(id) ?? nodes.find((n) => n.id === id);
check("the nav stays at the page's top, not above it", at("nav").y === 20, J(at("nav")));
check("the title stays under the nav", at("title").y === 60, J(at("title")));
check("the offline line is drawn where the screen drew it", at("offline").y === 160, J(at("offline")));
check("the panels the line pushed down are drawn lower", at("wallet").y === 210 && at("tv").y === 210 && at("balance").y === 210, J([at("wallet"), at("tv"), at("balance")]));
check("a part pinned to the window does not set the page's top", at("nav").y >= 0, J(at("tour")));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
