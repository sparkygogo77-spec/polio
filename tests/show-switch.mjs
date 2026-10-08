#!/usr/bin/env node
/**
 * THE SHOW SWITCH: STATES ARE A PREVIEW, NOT A PLACE (J, 2026-10-08).
 *
 * "I have to go through too many pages to simply reformat the structure of
 * pst." Pure, on PonsStars' play page as its kit/scenes.json lists it (the
 * same scenes, the panels each one shows):
 *
 *   1. the page's states come to at most six previews, one per moment of the
 *      flow (connecting, sign in, lobby, queue, match, result), the match
 *      starting and live one preview with two chips, won and lost another;
 *   2. what comes over the page and changes one part (the tour, the pop-ups,
 *      the banners) is "on top", and the TV's and the menu's own states are
 *      not: they stay the TV's and the menu's;
 *   3. an edit made in a preview changes the part in every preview: the style
 *      layer writes it once, by hook, with no state in it;
 *   4. with "This state only" ticked, the panels on show wear this preview's
 *      state (each part with the innermost panel round it), and the same edit
 *      is kept as that state's look: a rule keyed by the panel and state, the
 *      part's own look untouched.
 *
 *   node tests/show-switch.mjs
 *
 * Covers: src/features/studio/states/show.ts, src/features/studio/states/sceneStep.ts, src/features/studio/states/ShowSwitch.tsx, src/features/studio/states/stateEdits.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const studio = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const R = await studio("states/stateRules.ts");
const SH = await studio("states/show.ts");
const E = await studio("states/stateEdits.ts");
const L = await studio("send-out/styleLayer.ts");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* PonsStars' play page: its panels, the TV holding the duel circles and the break-even line. */
const M = "body > main", TV = `${M} > section:nth-of-type(2)`;
const PANELS = {
  "nav": "links open", "next-step": "action plain", "wallet-panel": "found", "balance-panel": "new practice", "market-panel": "live practice",
  "queue-panel": "join pick waiting", "chart-tv": "offline ready idle match warning result watch", "player-card": "off on", "profile-panel": "off on",
  "match-panel": "off generated", "trade-panel": "off on", "scoreboard": "off level winning losing", "result-panel": "off generated rematch",
  "reference-panel": "off none", "replay": "off idle", "server-offline": "off on", "network-banner": "off on", "newwallet-panel": "off start",
  "no-trade-warning": "off on", "tour": "off on",
};
const INSIDE_TV = { duel: "off level winning losing", "break-even": "off on" };
const LABEL = { tour: "Intro tour", "server-offline": "Server offline note" };
const was = (hook) => ({ file: "web/index.html", hook: { attr: "data-hook", value: hook }, was: { box: { x: 0, y: 0, w: 100, h: 40 }, words: "" } });
const node = (id, hook, sel, states) => ({ id, pageId: "play", featureId: "box", label: hook, x: 0, y: 0, w: 100, h: 40, hooks: { "data-hook": hook, ...(states ? { "data-panel": hook, "data-states": states } : {}), ...(LABEL[hook] ? { "data-label": LABEL[hook] } : {}) }, from: { selector: sel }, source: was(hook) });
let i = 0;
const nodes = [
  node("main", "play-main", M),
  ...Object.entries(PANELS).map(([hook, st]) => (hook === "chart-tv" ? node("tv", hook, TV, st) : node(hook, hook, `${M} > div:nth-of-type(${++i})`, st))),
  node("tv-frame", "tv-frame", `${TV} > div`),
  node("duel", "duel", `${TV} > aside:nth-of-type(1)`, INSIDE_TV.duel),
  node("duel-dot", "duel-dot", `${TV} > aside:nth-of-type(1) > span`),
  node("break-even", "break-even", `${TV} > aside:nth-of-type(2)`, INSIDE_TV["break-even"]),
  node("watch-box", "watch-box", `${TV} > aside:nth-of-type(3)`, "off live idle"),
  /* The tour's highlight sits inside the tour, as on the live page. */
  node("tour-highlight", "tour-highlight", `${M} > div:nth-of-type(${i}) > div`, "off on"),
];
const sc = (name, label, panels, part) => ({ name, label, page: "index.html", screen: name, panels, ...(part ? { part } : {}) });
const base = { "balance-panel": "practice", "chart-tv": "idle", "market-panel": "practice", nav: "links", "next-step": "plain", "player-card": "on", "profile-panel": "on", "queue-panel": "pick", "wallet-panel": "found" };
const off = { "balance-panel": "new", "chart-tv": "offline", "market-panel": "live", nav: "links", "next-step": "action", "queue-panel": "join", "wallet-panel": "found" };
const match = { ...base, "chart-tv": "match", duel: "level", "match-panel": "generated", "next-step": "action", scoreboard: "level", "trade-panel": "on" };
const result = { ...match, "chart-tv": "result", duel: "winning", scoreboard: "winning", "reference-panel": "none", replay: "idle", "result-panel": "generated" };
const scenes = R.readScenes(J({ scenes: [
  sc("connecting", "Loading: connecting to the game server", off),
  sc("server-offline", "Error: the game server is offline", { ...off, "server-offline": "on" }),
  sc("first-visit", "First visit: connect a wallet", { ...off, "balance-panel": "practice", "chart-tv": "ready", "market-panel": "practice", "queue-panel": "pick" }),
  sc("lobby", "Signed in: play money and Find a match", base),
  sc("devnet-banner", "Devnet banner: test SOL only", { ...base, "network-banner": "on" }),
  sc("new-wallet", "Pop-up: create a new wallet", { ...base, "newwallet-panel": "start" }),
  sc("before-queue", "Pop-up: the rules to confirm before you queue", { ...base, "no-trade-warning": "on" }),
  sc("queue-waiting", "Waiting in the queue", { ...base, "chart-tv": "ready", "next-step": "action", "queue-panel": "waiting" }),
  sc("match-starting", "Match starting: trading starts in 5", match),
  sc("mid-match", "Match in progress: you are ahead", { ...match, duel: "winning", scoreboard: "winning" }),
  sc("last-seconds", "The last seconds of a match", { ...match, "chart-tv": "warning", duel: "winning", scoreboard: "winning" }),
  sc("result-win", "Result: you won", result),
  sc("result-loss", "Result: you lost", { ...result, duel: "losing", scoreboard: "losing" }),
  sc("tie-rematch", "Result: a draw (tie), rematch offered", { ...match, "result-panel": "rematch" }),
  sc("tour", "Intro tour: one step", { ...base, tour: "on", "tour-highlight": "on" }),
  sc("phone-menu", "Phone menu, open (at desktop width the links show in a row)", { ...base, nav: "open" }),
  sc("tv-connecting", "Chart TV: waking the game server", off, "chart-tv"),
  sc("tv-idle", "Chart TV: between matches, a sample chart plays", base, "chart-tv"),
  sc("tv-match", "Chart TV: a match on screen", { ...match, "break-even": "on", duel: "winning", scoreboard: "winning" }, "chart-tv"),
  sc("tv-watch", "Chart TV: watching another live duel", { ...base, "chart-tv": "watch", "watch-box": "live" }, "chart-tv"),
] }), "web/");
const screens = R.sceneScreens(nodes, [{ file: "web/index.html", pageId: "play" }], scenes, []);
const { previews, onTop } = SH.showPreviews(screens, nodes);

/* 1. */
check("1a. at most six previews, one per moment, in the game's order",
  previews.length <= 6 && J(previews.map((p) => p.key)) === J(["connecting", "sign-in", "lobby", "queue", "match", "result"]), J(previews.map((p) => [p.key, p.scenes.map((s) => s.name)])));
check("1b. the match starting and live are one preview, won and lost another", J(previews.find((p) => p.key === "match")?.scenes.map((s) => s.name)) === J(["match-starting", "mid-match"]) && J(previews.find((p) => p.key === "result")?.scenes.map((s) => s.name)) === J(["result-win", "result-loss"]), J(previews.map((p) => p.scenes.map((s) => s.name))));
check("1c. every page state is in one preview, none twice", J(previews.flatMap((p) => p.scenes.map((s) => s.name)).sort()) === J(screens.filter(R.isPageState).map((s) => s.name).sort()));

/* 2. */
const tops = onTop.map((t) => t.panel).sort();
check("2a. the tour, the pop-ups and the banners go on top, each in the state it comes in",
  J(tops) === J(["network-banner", "newwallet-panel", "no-trade-warning", "server-offline", "tour"]) && onTop.find((t) => t.panel === "newwallet-panel").state === "start", J(onTop));
check("2b. the TV's and the menu's own states are not on top", !tops.includes("chart-tv") && !tops.includes("nav") && !tops.includes("result-panel"));
check("2c. an on-top item is named by its panel's own label, else its scene's lead", onTop.find((t) => t.panel === "tour")?.label === "Intro tour" && onTop.find((t) => t.panel === "server-offline")?.label === "Server offline note" && onTop.find((t) => t.panel === "network-banner")?.label === "Devnet banner", J(onTop.map((t) => t.label)));

/* 3. An edit in a preview, "This state only" off: the part's own look, one rule by hook. */
const ctx = [null, { repo: "o/r", ref: "main", dir: "web/", files: [] }, { kit: true }];
const plainEdit = nodes.map((n) => (n.id === "tv-frame" ? { ...n, radius: 12 } : n));
const l3 = L.buildLayer(plainEdit, ...ctx).rules.filter((r) => r.nodeId === "tv-frame");
check("3. an edit in one preview is the part's own: written once, with no state in its selector", l3.length === 1 && !/data-state|data-panel/.test(l3[0].selector) && !plainEdit.find((n) => n.id === "tv-frame").byState, J(l3));

/* 4. "This state only": the result preview's panels wear their states; the edit stays the result's. */
const resultScene = screens.find((s) => s.name === "result-win");
const groups = SH.stateLooksIn(nodes, "play", resultScene);
const keyOf = (id) => groups.find((g) => g.ids.includes(id))?.key;
check("4a. each part wears the state of the innermost panel round it, and an off panel is not worn",
  keyOf("tv") === "chart-tv=result" && keyOf("tv-frame") === "chart-tv=result" && keyOf("duel-dot") === "duel=winning" && !keyOf("break-even") && !keyOf("main") && !keyOf("wallet-panel"), J(groups));
let worn = nodes, outs = [];
for (const g of groups) { const got = E.checkOut(worn, g.key, g.ids); worn = got.nodes; outs.push(got.out); }
worn = worn.map((n) => (n.id === "tv-frame" ? { ...n, radius: 12 } : n));
for (const out of [...outs].reverse()) worn = E.checkIn(worn, out);
const frame = worn.find((n) => n.id === "tv-frame");
check("4b. the edit is kept as the result's look, the part's own look untouched", J(frame.byState) === J({ "chart-tv=result": { radius: 12 } }) && frame.radius === undefined, J(frame));
const l4 = L.buildLayer(worn, ...ctx).rules.filter((r) => r.nodeId === "tv-frame");
check("4c. the style layer writes it keyed by the TV and its result state only", l4.length === 1 && /data-panel="chart-tv"/.test(l4[0].selector) && /data-state="result"/.test(l4[0].selector), J(l4));
const bare = ({ byState, ...n }) => J(byState ? { ...n, byState } : n);
check("4d. nothing else changed", worn.every((n) => n.id === "tv-frame" || bare(n) === bare(nodes.find((x) => x.id === n.id))), J(worn.filter((n) => n.id !== "tv-frame" && bare(n) !== bare(nodes.find((x) => x.id === n.id))).map((n) => n.id)));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
