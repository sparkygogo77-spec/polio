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
 *   1. `pageScenes` gathers the screens into states, one per layout (the
 *      same hooks at the same boxes, whatever their words), in the game's
 *      order; their words are samples of data; the tour and the menu go
 *      on top (J, 2026-10-06: ~90 controls down to ~8).
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

/* 1. States only where the layout changes (J, 2026-10-06): the same parts at the same places are one state, whatever their words say. */
const scr = (name, step, label, shows, texts = {}, boxes = {}) => ({ name, step, label, page: "web/index.html", shows, boxes, texts });
const at0 = { tv: [400, 100, 880, 600], wallet: [1500, 100, 300, 60], "tv-status": [600, 300, 400, 40], balance: [1500, 200, 300, 400], rules: [600, 200, 400, 300], queue: [600, 200, 400, 120], scoreboard: [400, 40, 880, 50], trades: [1300, 100, 180, 600], "tv-result": [600, 260, 400, 160] };
const bx = (hooks, moved = {}) => Object.fromEntries(hooks.map((h) => [h, moved[h] ?? at0[h]]));
const list = [
  scr("connecting", "connecting", "Connecting to the game server", ["tv", "tv-status", "wallet"], { "tv-status": "Connecting…" }, bx(["tv", "tv-status", "wallet"])),
  scr("server-offline", "connecting", "Error: the game server is offline", ["tv", "tv-status", "wallet"], { "tv-status": "The game server is offline, try again soon" }, bx(["tv", "tv-status", "wallet"], { "tv-status": [520, 300, 560, 40] })),
  scr("lobby", "between matches", "Lobby", ["tv", "wallet", "balance"], {}, bx(["tv", "wallet", "balance"])),
  scr("before-queue", "rules to confirm", "Before the queue", ["tv", "rules", "balance"], {}, bx(["tv", "rules", "balance"])),
  scr("match-starting", "match starting", "Match starting", ["tv", "scoreboard", "balance"], { scoreboard: "3" }, bx(["tv", "scoreboard", "balance"])),
  scr("mid-match", "match live", "Mid match", ["tv", "scoreboard", "trades", "balance"], { scoreboard: "+2.1% you lead" }, bx(["tv", "scoreboard", "trades", "balance"])),
  scr("mid-match-behind", "match behind", "Mid match, behind", ["tv", "scoreboard", "trades", "balance"], { scoreboard: "-0.4% behind" }, bx(["tv", "scoreboard", "trades", "balance"], { balance: [1503, 204, 300, 404] })),
  scr("result-win", "you won", "Result: won", ["tv", "tv-result", "balance"], { "tv-result": "You won" }, bx(["tv", "tv-result", "balance"])),
  scr("result-loss", "you lost", "Result: lost", ["tv", "tv-result", "balance"], { "tv-result": "You lost, better luck next time" }, bx(["tv", "tv-result", "balance"], { "tv-result": [560, 260, 480, 190] })),
  scr("tie-rematch", "draw", "Result: draw", ["tv", "tv-result", "balance"], { "tv-result": "Draw" }, bx(["tv", "tv-result", "balance"])),
  scr("tour", null, "Intro tour: one step", ["tour-card"]),
  scr("phone-menu", null, "Phone menu, open (390 wide)", ["menu"]),
  scr("tv-connecting", "connecting", "TV: waking the server", ["tv", "tv-status", "wallet"], { "tv-status": "Connecting…" }, bx(["tv", "tv-status", "wallet"])),
  scr("tv-moved", "match live", "TV: the trades panel moved", ["tv", "scoreboard", "trades", "balance"], { scoreboard: "+2.1% you lead" }, bx(["tv", "scoreboard", "trades", "balance"], { trades: [100, 100, 180, 600] })),
];
const ps = S.pageScenes(list, "web/index.html");
check("states come in the game's order, one per layout", J(ps.scenes.map((s) => s.key)) === J(["connecting", "lobby", "queue", "match", "match-2", "result"]), J(ps.scenes.map((s) => s.key)));
const con = ps.scenes[0];
check("connecting and offline differ only in words: one state, two samples", con.variants.length === 2 && con.variants[1].screen.name === "server-offline", J(con.variants.map((v) => v.screen.name)));
check("the same words in the same layout twice is folded into the first", J(con.variants[0].same) === J(["tv-connecting"]), J(con.variants.map((v) => v.same)));
check("the scoreboard and trades panel arriving is a new state", ps.scenes[3].variants.length === 1 && ps.scenes[4].variants[0].screen.name === "mid-match", J(ps.scenes.map((s) => s.variants.map((v) => v.screen.name))));
check("ahead and behind (a 4px nudge) are samples of one state", J(ps.scenes[4].variants.map((v) => v.screen.name)) === J(["mid-match", "mid-match-behind"]), J(ps.scenes[4].variants.map((v) => v.screen.name)));
check("a panel moved within one moment is a sample of it, drawn from its own capture", J(ps.scenes[4].variants.map((v) => [v.screen.name, v.same])) === J([["mid-match", ["tv-moved"]], ["mid-match-behind", []]]), J(ps.scenes[4].variants.map((v) => [v.screen.name, v.same])));
check("two layouts of one moment are named apart", ps.scenes[3].name === "Match: match starting" && ps.scenes[4].name === "Match: match live", J(ps.scenes.map((s) => s.name)));
check("won, lost and draw are one result state with three samples", J(ps.scenes[5].variants.map((v) => v.label)) === J(["you won", "you lost", "draw"]), J(ps.scenes[5].variants.map((v) => v.label)));
check("the tour and the phone menu go on top, not among the states", J(ps.onTop.map((v) => [v.label, v.key])) === J([["Intro tour", "top:tour"], ["Phone menu", "top:phone-menu"]]), J(ps.onTop.map((v) => [v.label, v.key])));
check("every sample is a screen key, none dropped", ps.scenes.every((s) => s.variants.every((v) => v.key === `screen:${v.screen.name}`)) && ps.scenes.flatMap((s) => s.variants.flatMap((v) => [v.screen.name, ...v.same])).length + ps.onTop.length === list.length);
check("the states strip holds about 8 controls, not ~90", 1 + ps.scenes.length + ps.onTop.length <= 10, String(1 + ps.scenes.length + ps.onTop.length));
/* J (2026-10-06, on #57): won, lost and draw were still three states (the draw adds its rematch offer, the win its coin), connecting and offline two; a "Devnet banner" and a "Pop-up: create a new wallet" sat among the states. */
const many = (n, extra = []) => [...Array.from({ length: n }, (_, i) => `p${i}`), ...extra];
const real = [
  scr("connecting", "connecting", "Loading: connecting", many(40, ["tv-loading"])),
  scr("server-offline", "connecting", "Error: offline", many(40, ["tv-loading", "tv-error"]), { "tv-error": "offline" }),
  scr("tv-connecting", "connecting", "Chart TV: waking the server", []),
  scr("lobby", "between matches", "Signed in", many(60)),
  scr("devnet-banner", null, "Devnet banner: test SOL only", many(60, ["devnet"])),
  scr("new-wallet", null, "Pop-up: create a new wallet", many(60, ["newwallet"])),
  scr("result-win", "you won", "Result: you won", many(80, ["coin", "reference"])),
  scr("result-loss", "you lost", "Result: you lost", many(80, ["coin", "reference"]), { p1: "lost" }),
  scr("tie-rematch", "draw", "Result: a draw, rematch offered", many(80, ["rematch", "rematch-offer"])),
];
const rs = S.pageScenes(real, "web/index.html");
check("won, lost and draw are one state even when the draw adds a panel", J(rs.scenes.map((s) => [s.key, s.variants.map((v) => v.screen.name)])) === J([["connecting", ["connecting", "server-offline"]], ["lobby", ["lobby"]], ["result", ["result-win", "result-loss", "tie-rematch"]]]), J(rs.scenes.map((s) => [s.key, s.variants.map((v) => v.screen.name)])));
check("a capture that drew nothing is folded into its moment", J(rs.scenes[0].variants[0].same) === J(["tv-connecting"]));
check("a banner and a pop-up with no step go on top", J(rs.onTop.map((v) => v.screen.name)) === J(["devnet-banner", "new-wallet"]), J(rs.onTop.map((v) => v.screen.name)));

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
