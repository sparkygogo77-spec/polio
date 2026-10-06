#!/usr/bin/env node
/**
 * A PAGE'S SCENES: ONE CAPTURE EACH, IN THE ORDER OF THE GAME.
 *
 * J (2026-10-06): PonsStars came into the builder with 22 page states for
 * about seven real moments, some drawing one moment's words at another
 * moment's places (the balance panel's in-match lines over the Deposit
 * heading), the tour and the phone menu among them, and "Amount (SOL)"
 * drawn twice. So:
 *
 *   1. `pageScenes` gathers the screens into scenes in the game's order
 *      (connecting, sign in, lobby, queue, match, result), folds two
 *      captures of the same step drawing the same parts into one variant,
 *      and puts the tour and the menu in an "on top" row.
 *   2. `screenPlaces` draws a whole scene from its one capture: every part
 *      at the capture's box, size included, never one kept at another
 *      moment's place, and a line of words with its word.
 *   3. `boardShows` keeps what sits inside a shut <details> hidden.
 *   4. `linedParts` / `stepLook`: a label whose words are drawn by its own
 *      line does not draw them again.
 *   5. `followsPage`: the grid's cell for a scene is the part's state for
 *      that step of the flow, even when it was read off another capture.
 *
 *   node tests/page-scenes.mjs
 *
 * Covers: src/features/studio/scenes.ts, src/features/studio/boardStates.ts, src/features/studio/StatesTimeline.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const S = await jiti.import(join(here, "..", "src", "features", "studio", "scenes.ts"));
const B = await jiti.import(join(here, "..", "src", "features", "studio", "boardStates.ts"));
const results = [];
const quiet = process.argv.includes("--quiet");
const check = (name, ok, detail = "") => { results.push(ok === true); if (!quiet || ok !== true) console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* 1. Scenes, in game order, from PonsStars' screen list as its preview lists it. */
const scr = (name, step, label, shows) => ({ name, step, label, page: "web/index.html", shows, boxes: {} });
const list = [
  scr("connecting", "connecting", "Connecting to the game server", ["tv-connecting", "wallet"]),
  scr("server-offline", "connecting", "Error: the game server is offline", ["tv-offline", "wallet"]),
  scr("first-visit", null, "First visit: connect a wallet", ["wallet"]),
  scr("lobby", "between matches", "Lobby", ["tv-idle", "wallet", "balance"]),
  scr("before-queue", "rules to confirm", "Before the queue", ["rules", "balance"]),
  scr("queue-waiting", "in the queue", "In the queue", ["queue", "balance"]),
  scr("match-starting", "match starting", "Match starting", ["tv-match", "scoreboard"]),
  scr("mid-match", "match live", "Mid match", ["tv-match", "scoreboard", "trades"]),
  scr("result-win", "you won", "Result: won", ["tv-result"]),
  scr("result-loss", "you lost", "Result: lost", ["tv-result", "log"]),
  scr("tie-rematch", "draw", "Result: draw", ["tv-result", "rematch"]),
  scr("tour", null, "Intro tour: one step", ["tour-card"]),
  scr("phone-menu", null, "Phone menu, open (390 wide)", ["menu"]),
  scr("tv-connecting", "connecting", "TV: waking the server", ["tv-connecting", "wallet"]),
  scr("tv-offline", "connecting", "TV: offline", ["wallet", "tv-offline"]),
  scr("tv-match", "match live", "TV: a match on screen", ["tv-match", "scoreboard", "trades"]),
];
const ps = S.pageScenes(list, "web/index.html");
check("scenes come in the game's order", J(ps.scenes.map((s) => s.key)) === J(["connecting", "sign-in", "lobby", "queue", "match", "result"]), J(ps.scenes.map((s) => s.key)));
const con = ps.scenes[0];
check("connecting has two variants, then offline", con.variants.length === 2 && con.variants[1].screen.name === "server-offline", J(con.variants.map((v) => v.screen.name)));
check("a second capture of the same step and parts is folded into the first", J(con.variants[0].same) === J(["tv-connecting"]) && J(con.variants[1].same) === J(["tv-offline"]), J(con.variants.map((v) => v.same)));
check("the queue is rules, then waiting", J(ps.scenes[3].variants.map((v) => v.label)) === J(["rules to confirm", "in the queue"]), J(ps.scenes[3].variants.map((v) => v.label)));
check("the result is won, lost, draw", J(ps.scenes[5].variants.map((v) => v.label)) === J(["you won", "you lost", "draw"]), J(ps.scenes[5].variants.map((v) => v.label)));
check("the tour and the phone menu go on top, not among the scenes", J(ps.onTop.map((v) => [v.label, v.key])) === J([["Intro tour", "top:tour"], ["Phone menu", "top:phone-menu"]]), J(ps.onTop.map((v) => [v.label, v.key])));
check("every variant is a screen key", ps.scenes.every((s) => s.variants.every((v) => v.key === `screen:${v.screen.name}`)));

/* 2. A whole scene from one capture: the balance panel's lines and the Deposit heading below them move together. */
const node = (id, hook, x, y, w, h, extra = {}) => ({ id, pageId: "p", hooks: hook ? { "data-hook": hook } : {}, x, y, w, h, ...extra });
const nodes = [
  node("nav", "nav", 0, 0, 600, 30),
  node("bal", "balance-panel", 1500, 100, 300, 500),
  node("money", "balance-play-money", 1510, 130, 280, 110, { state: { group: "hidden:balance-play-money", option: 1 } }),
  node("wal", "balance-wallet", 1510, 130, 280, 20),
  node("dep", "deposit-title", 1510, 300, 280, 26),
  node("tv", "chart-tv", 400, 100, 880, 600),
  node("cap", "chart-note", 400, 710, 1100, 60),
  node("capline", null, 400, 710, 1100, 20, { from: { selector: "#note ::line(1)" } }),
];
nodes.find((n) => n.id === "cap").from = { selector: "#note" };
/* The match-starting capture, 8px from the page's corner: the panel's play-money lines push Deposit down, the scoreboard pushes the TV down. */
const cap = { name: "match-starting", step: "match starting", page: "web/index.html", shows: ["nav", "balance-panel", "balance-play-money", "balance-wallet", "deposit-title", "chart-tv", "chart-note"], boxes: {
  nav: [8, 8, 600, 30], "balance-panel": [1508, 108, 300, 640], "balance-wallet": [1518, 138, 280, 20], "balance-play-money": [1518, 168, 280, 110], "deposit-title": [1518, 440, 280, 26], "chart-tv": [408, 267, 880, 600], "chart-note": [408, 877, 1100, 60],
} };
const on = ["screen:match-starting"];
const shows = B.boardShows(on, [cap], () => "p");
const placed = B.screenPlaces(nodes, on, [cap], () => "p", shows);
const at = (id) => placed.get(id) ?? nodes.find((n) => n.id === id);
const box = (id) => { const b = at(id); return [b.x, b.y, b.w, b.h]; };
check("every part takes the capture's box, size included", J(box("bal")) === J([1500, 100, 300, 640]) && J(box("money")) === J([1510, 160, 280, 110]) && J(box("tv")) === J([400, 259, 880, 600]), J([box("bal"), box("money"), box("tv")]));
check("Deposit moves down with the lines above it, never kept at another moment's top", at("dep").y === 432, J(at("dep")));
check("the caption follows the taller page under the TV", at("cap").y === 869, J(at("cap")));
check("a line of words goes with its part", at("capline").y === 869, J(at("capline")));
const words = ["wal", "money", "dep"].map(box);
const meets = (a, b) => a[0] < b[0] + b[2] && b[0] < a[0] + a[2] && a[1] < b[1] + b[3] && b[1] < a[1] + a[3];
check("no words land on other words in the panel", !meets(words[0], words[1]) && !meets(words[1], words[2]), J(words));

/* 3. What sits inside a shut <details> stays hidden in a scene, unless the capture opened it. */
const det = [
  node("d", "edit-profile", 0, 0, 300, 200, { from: { selector: "#profile > details" } }),
  node("sum", "edit-summary", 0, 0, 300, 20, { from: { selector: "#profile > details > summary" } }),
  node("in", "edit-name", 0, 30, 300, 20, { from: { selector: "#profile > details > input" } }),
];
const dScreens = [{ name: "lobby", page: "web/index.html", shows: ["edit-profile", "edit-summary", "edit-name"], boxes: {} }, { name: "open", page: "web/index.html", shows: ["edit-profile", "edit-summary", "edit-name"], opened: ["edit-profile"], boxes: {} }];
const dShut = B.boardShows(["screen:lobby"], dScreens, () => "p", null, null, det);
const dOpen = B.boardShows(["screen:open"], dScreens, () => "p", null, null, det);
check("a part inside a shut <details> stays hidden, its summary shows", dShut(det[1]) === true && dShut(det[2]) === false, J([dShut(det[1]), dShut(det[2])]));
check("the same part shows when the capture had it open", dOpen(det[2]) === true);

/* 4. "Amount (SOL)" once: a label whose words are its own line is not given them again. */
const lab = [
  node("label", "deposit-amount", 0, 0, 236, 50, { from: { selector: "#deposit label" }, content: "Amount (SOL)" }),
  node("labline", null, 0, 0, 90, 18, { from: { selector: "#deposit label ::line(1)" }, content: "Amount (SOL)" }),
];
const lined = B.linedParts(lab);
check("a label drawn by its own line is known", lined.has("label") && !lined.has("labline"), J([...lined]));
const sc = { name: "lobby", shows: ["deposit-amount"], boxes: {}, texts: { "deposit-amount": "Amount (SOL) 1" } };
check("its words are not drawn a second time", B.stepLook(lab[0], sc, lined) === null && B.stepLook(lab[0], sc) !== null, J(B.stepLook(lab[0], sc, lined)));

/* 5. The grid's cell for the lobby scene is the chart row's "between matches", read off "TV: between matches". */
const T = await jiti.import(join(here, "..", "src", "features", "studio", "StatesTimeline.tsx"));
const flow = [scr("connecting", "connecting", "", []), scr("lobby", "between matches", "", []), scr("tv-idle", "between matches", "", []), scr("match-starting", "match starting", "", []), scr("mid-match", "match live", "", []), scr("tv-match", "match live", "", [])];
const row = { steps: [{ key: null, label: "connecting" }, { key: "screen:tv-idle", label: "between matches", screen: "tv-idle" }, { key: "screen:match-starting", label: "match starting", screen: "match-starting" }, { key: "screen:tv-match", label: "match live", screen: "tv-match" }] };
const cell = (name) => row.steps[T.followsPage(row, flow.find((s) => s.name === name), flow)].label;
check("each scene's cell is the part's state for that step", J(flow.map((s) => cell(s.name))) === J(["connecting", "between matches", "between matches", "match starting", "match live", "match live"]), J(flow.map((s) => cell(s.name))));

const ok = results.filter(Boolean).length;
console.log(`${quiet ? "page-scenes: " : "\n"}${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
