#!/usr/bin/env node
/**
 * THE STATE RULES, READ BY THE BUILDER (J, 2026-10-06).
 *
 * A site that declares its panels (data-panel, data-states, data-show) and
 * lists its scenes is read from that, never guessed from captures. Pure, on
 * a small page any site could have (a queue panel with two states, a result
 * panel that can be off, a rematch panel inside it):
 *
 *   1. the scene and samples files are read, paths from builder.json's folder;
 *   2. each panel has exactly its declared states; a part shows only in the
 *      states it lists, and a panel left out of a scene is off;
 *   3. a scene is a screen of the board; its live capture only lends places
 *      and words, and says where live differs;
 *   4. the Panels page lists declared panels with every state but off, and
 *      samples as chips, not states;
 *   5. a site with no panel says it does not follow the rules; one with an
 *      undeclared state, a panel in another's state or a scene naming an
 *      unknown panel says so;
 *   6. right-click States switches one panel on the board, over the scene;
 *   7. an edit to one state is kept apart (checked out, then back in) and the
 *      style layer writes it keyed [data-panel][data-state];
 *   8. the kit the Builder writes carries the rules, the starter scene and
 *      samples files and kit:check (polio is the source);
 *   9. the builder labels: a panel's plain name, a part's kind, and a style
 *      group edited once.
 *
 *   node tests/state-rules.mjs
 *
 * Covers: src/features/studio/states/stateRules.ts, src/features/studio/states/stateEdits.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/kitFiles.ts, src/features/studio/kitExport.ts, src/features/studio/states/PanelsPage.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const studio = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const R = await studio("states/stateRules.ts");
const E = await studio("states/stateEdits.ts");
const L = await studio("send-out/styleLayer.ts");
const K = await studio("kitFiles.ts");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const M = "body > main";
const Q = `${M} > section:nth-of-type(1)`;
const RES = `${M} > section:nth-of-type(2)`;
const n = (id, hooks, sel, extra = {}) => ({ id, pageId: "p", hooks, from: { selector: sel }, x: 0, y: 0, w: 100, h: 40, ...extra });
const hid = (g) => ({ state: { group: `hidden:${g}`, option: 1 } });
const nodes = [
  n("main", { "data-hook": "app" }, M),
  n("q", { "data-hook": "queue-panel", "data-panel": "queue-panel", "data-states": "join waiting", "data-state": "join" }, Q),
  n("q-title", { "data-hook": "queue-title" }, `${Q} > h2`),
  n("q-join", { "data-hook": "queue-join", "data-show": "join" }, `${Q} > button:nth-of-type(1)`),
  n("q-leave", { "data-hook": "queue-leave", "data-show": "waiting" }, `${Q} > button:nth-of-type(2)`, hid("queue-leave")),
  n("q-count", { "data-hook": "queue-count", "data-show": "waiting" }, `${Q} > p`, hid("queue-count")),
  n("r", { "data-hook": "result-panel", "data-panel": "result-panel", "data-states": "off won lost", "data-state": "off" }, RES, hid("result-panel")),
  n("r-won", { "data-hook": "result-won", "data-show": "won" }, `${RES} > h2:nth-of-type(1)`),
  n("r-lost", { "data-hook": "result-lost", "data-show": "lost" }, `${RES} > h2:nth-of-type(2)`),
  n("r-line", null, `${RES} > h2:nth-of-type(2) ::line(1)`),
  n("rm", { "data-hook": "rematch-panel", "data-panel": "rematch-panel", "data-states": "off on", "data-state": "off" }, `${RES} > div`),
  n("rm-yes", { "data-hook": "rematch-yes" }, `${RES} > div > button`),
];
const files = [{ file: "web/index.html", pageId: "p" }];

/* 1. */
const scenes = R.readScenes(J({ scenes: [
  { name: "lobby", label: "Lobby", page: "index.html", panels: { "queue-panel": "join" } },
  { name: "queue", label: "Waiting", page: "index.html", screen: "queued", panels: { "queue-panel": "waiting" } },
  { name: "lost-rematch", label: "Lost, rematch offered", page: "index.html", panels: { "queue-panel": "join", "result-panel": "lost", "rematch-panel": "on" } },
] }), "web/");
const samples = R.readSamples(J({ hooks: { "queue-count": ["1 waiting", "12 waiting"], "nowhere": [] } }));
check("1. scenes and samples are read, pages from builder.json's folder", scenes?.length === 3 && scenes[0].page === "web/index.html" && scenes[1].screen === "queued" && J(samples) === J({ "queue-count": ["1 waiting", "12 waiting"] }) && R.readScenes("not json") === null);

/* 2. */
const d = R.readDeclared(nodes);
const show = (scene) => R.sceneScreens(nodes, files, [scene])[0].shows.sort();
check("2a. each panel has exactly its declared states", J([...d.panels.values()].map((p) => [p.id, p.states.join(" "), p.start])) === J([["queue-panel", "join waiting", "join"], ["result-panel", "off won lost", "off"], ["rematch-panel", "off on", "off"]]));
check("2b. a part shows only in the states it lists; a panel left out is off", J(show(scenes[0])) === J(["app", "queue-join", "queue-panel", "queue-title"]) && J(show(scenes[1])) === J(["app", "queue-count", "queue-leave", "queue-panel", "queue-title"]), J(show(scenes[1])));
check("2c. a panel inside another comes with it, in its own state", J(show(scenes[2]).filter((h) => h.startsWith("re"))) === J(["rematch-panel", "rematch-yes", "result-lost", "result-panel"]), J(show(scenes[2])));
check("2d. a part says which states it shows in", J(R.statesOfPart(d, "q-leave")) === J({ panel: "queue-panel", states: ["waiting"] }) && J(R.statesOfPart(d, "q-title")) === J({ panel: "queue-panel", states: ["join", "waiting"] }) && R.statesOfPart(d, "main") === null);

/* 3. */
const live = [{ name: "queued", page: "web/index.html", shows: ["app", "queue-panel", "queue-title", "queue-leave", "queue-count", "queue-spinner"], boxes: { "queue-panel": [0, 0, 300, 120] }, texts: { "queue-count": "3 waiting" } }];
const ss = R.sceneScreens(nodes, files, scenes, live);
check("3. a scene is a screen; its capture lends places and words and says where live differs", ss.length === 3 && ss.every((s) => s.declared) && ss[1].boxes?.["queue-panel"]?.[2] === 300 && ss[1].texts?.["queue-count"] === "3 waiting" && J(ss[1].differs) === J({ extra: ["queue-spinner"], missing: [] }) && !ss[0].differs && !ss[1].shows.includes("queue-spinner"));

/* 3b. J (2026-10-06): the TV's static, which the site shows only while offline, sat over the chart in "Match starting". A part the rules say nothing about, which the live screen does not draw inside a part it does draw, is not drawn; one the rules show stays. */
const quietHid = R.sceneScreens(nodes, files, [scenes[1]], [{ ...live[0], shows: ["app", "queue-panel", "queue-count"] }])[0];
check("3b. a part with no rule of its own, hidden live inside a drawn part, is hidden; a ruled part stays", !quietHid.shows.includes("queue-title") && quietHid.shows.includes("queue-leave") && J(quietHid.differs?.missing) === J(["queue-leave"]), J(quietHid));

/* 4. */
const panels = R.declaredPagePanels(nodes, "p", "web/index.html", ss, samples);
const qp = panels.find((p) => p.hook === "queue-panel");
check("4a. the Panels page lists each declared panel with every state but off", J(panels.map((p) => [p.hook, p.states.map((s) => s.key)])) === J([["queue-panel", ["join", "waiting"]], ["result-panel", ["won", "lost"]]]), J(panels.map((p) => [p.hook, p.states.map((s) => s.key)])));
/* J: one state that a whole-page scene shows is no panel (edited on its page); a pop-up no scene shows stays. */
const popup = R.declaredPagePanels(nodes, "p", "web/index.html", ss.filter((x) => !x.panels["rematch-panel"]), samples);
check("4c. a single state is a panel only when no scene shows it (a pop-up)", !panels.some((p) => p.hook === "rematch-panel") && J(popup.find((p) => p.hook === "rematch-panel")?.states.map((s) => s.key)) === J(["on"]));
check("4b. a state draws its own parts; samples are chips with other words, not states", qp.states[1].samples.length === 2 && qp.states[1].samples[1].screen.texts["queue-count"] === "12 waiting" && qp.states[1].samples[0].screen.shows.includes("queue-leave") && !qp.states[1].samples[0].screen.shows.includes("queue-join") && qp.states[1].samples[0].screen.boxes?.["queue-panel"]?.[2] === 300);

/* 5. */
const plain = nodes.map((x) => ({ ...x, hooks: x.hooks ? { "data-hook": x.hooks["data-hook"] } : null }));
const bad = [...nodes, n("q-x", { "data-hook": "queue-x", "data-show": "gone" }, `${Q} > span`), n("deep", { "data-hook": "deep", "data-panel": "deep", "data-states": "off on", "data-state": "off" }, `${Q} > button:nth-of-type(1) > i`)];
const notes = R.stateRuleNotes(bad, "p", [...scenes, { name: "x", label: "x", page: "web/index.html", panels: { ghost: "on", "queue-panel": "nap" } }], "web/index.html");
check("5a. a site with no panel says it does not follow the state rules", !R.followsStateRules(plain) && /doesn't|does not|No part/.test(R.stateRuleNotes(plain, "p", null, null)[0]) && R.followsStateRules(nodes, "p"));
check("5b. undeclared states, a panel inside another's state and unknown scene panels are said", notes.some((x) => /"gone"/.test(x)) && notes.some((x) => /deep.*inside a state/.test(x)) && notes.some((x) => /ghost/.test(x)) && notes.some((x) => /"nap"/.test(x)) && R.stateRuleNotes(nodes, "p", scenes, "web/index.html").length === 0, J(notes));

/* 6. */
const dec = R.panelDecides(nodes, ["screen:lobby", R.panelKey("queue-panel", "waiting")], scenes[0]);
check("6. right-click States switches one panel on the board, over the scene", dec.get("q-leave") === true && dec.get("q-join") === false && dec.get("q") === true && !dec.has("r-won") && J(R.readPanelKey(R.panelKey("a-b", "c-d"))) === J({ panel: "a-b", state: "c-d" }));

/* 7. */
const parts = [{ id: "a", colour: { bg: "#111" }, font: null, x: 1, hooks: { "data-hook": "queue-leave" } }, { id: "b", colour: null }];
const key = E.stateEditKey("queue-panel", "waiting");
const out = E.checkOut(parts, key, ["a"]);
const edited = out.nodes.map((p) => (p.id === "a" ? { ...p, colour: { bg: "#e00" }, x: 5 } : p));
const back = E.checkIn(edited, out.out);
const again = E.checkOut(back, key, ["a"]);
const undone = E.checkIn(again.nodes.map((p) => (p.id === "a" ? { ...p, colour: { bg: "#111" } } : p)), again.out);
check("7a. an edit to one state is kept apart: the part keeps its own look, place moves for all", J(back[0].colour) === J({ bg: "#111" }) && J(back[0].byState) === J({ [key]: { colour: { bg: "#e00" } } }) && back[0].x === 5 && J(again.nodes[0].colour) === J({ bg: "#e00" }) && undone[0].byState === null);
const src = (hook) => ({ file: "web/index.html", hook: { attr: "data-hook", value: hook }, was: { box: { x: 0, y: 0, w: 100, h: 40 }, words: "" } });
const layerNodes = [
  { id: "a", pageId: "p", featureId: "button", x: 0, y: 0, w: 100, h: 40, hooks: { "data-hook": "queue-leave" }, source: src("queue-leave"), byState: { [key]: { opacity: 0.5 } } },
  { id: "q", pageId: "p", featureId: "box", x: 0, y: 0, w: 100, h: 40, hooks: { "data-hook": "queue-panel", "data-panel": "queue-panel" }, source: src("queue-panel"), byState: { [key]: { opacity: 0.8 } } },
];
const layer = L.buildLayer(layerNodes, null, { repo: "o/r", ref: "main", dir: "web/", files: [] }, { kit: true });
check("7b. the style layer writes it keyed [data-panel][data-state]", layer.css.includes('[data-panel="queue-panel"][data-state="waiting"] [data-hook="queue-leave"] {') && layer.css.includes('[data-hook="queue-panel"][data-state="waiting"] {') && /opacity: 0\.5/.test(layer.css), layer.css);

/* 8. */
check("8a. the kit the Builder writes carries the state rules and their starter files", /## State rules/.test(K.KIT_FILES["BUILDER-RULES.md"]) && /data-panel/.test(K.KIT_FILES["CLAUDE.md"]) && /kit:check/.test(K.KIT_FILES["CLAUDE.md"]) && !!K.KIT_FILES["starter/scenes.json"] && !!K.KIT_FILES["starter/samples.json"] && /kit:panels/.test(K.KIT_FILES["tools/kit-check.mjs"]) && K.KIT_RULES.list.some((r) => r.id === "panels-declare-states"));
const X = await studio("kitExport.ts");
const ex = X.toKit({ files: [{ path: "index.html", content: "<!doctype html><html><head><title>A</title></head><body><main><h1>Hi</h1></main></body></html>" }], name: "A site", pages: [{ file: "index.html", title: "Home" }] });
const { kitMap } = await studio("kitMap.ts");
const checked = kitMap(Object.fromEntries(ex.files.filter((f) => !f.encoding).map((f) => [f.path, f.content])));
const man = JSON.parse(ex.files.find((f) => f.path === "builder.json").content);
const sc = JSON.parse(ex.files.find((f) => f.path === "scenes.json").content);
check("8b. Export for code writes scenes.json and samples.json and names them in builder.json", man.scenes === "scenes.json" && man.samples === "samples.json" && sc.scenes.length === 1 && sc.scenes[0].page === "site/index.html" && !!ex.files.find((f) => f.path === "samples.json") && checked.problems.length === 0, J(checked.problems));

/* 9. The builder labels (rules 21 to 24). */
const labelled = nodes.map((x) => (x.id === "q" ? { ...x, hooks: { ...x.hooks, "data-label": "Find a match box" } } : x.id === "q-count" ? { ...x, hooks: { ...x.hooks, "data-kind": "number", "data-group": "panel-note" } } : x.id === "rm-yes" ? { ...x, hooks: { ...x.hooks, "data-group": "panel-note" } } : x));
const lp = R.declaredPagePanels(labelled, "p", "web/index.html", ss, null);
const tw = E.groupTwins(labelled, "q-count", { colour: { fg: "#fff" }, x: 9, content: "no" });
check("9. plain names, kinds and groups are read; a group's look is edited once", lp.find((p) => p.hook === "queue-panel")?.label === "Find a match box" && J(R.labelsOf(labelled.find((x) => x.id === "q-count"))) === J({ kind: "number", group: "panel-note" }) && J(tw) === J({ ids: ["rm-yes"], patch: { colour: { fg: "#fff" } } }) && E.groupTwins(labelled, "q-title", { colour: {} }) === null, J(tw));

/* 10. J: "Behind by 1.83 points" ran over "Time left": longer words push what follows on their line along. */
const RW = await studio("roomForWords.ts");
const sb = (id, x, w, text) => ({ id, pageId: "p", x, y: 10, w, h: 22, content: text, from: { selector: `body > section > p:nth-of-type(${id})` } });
const row = [sb(1, 0, 50, "Level"), sb(2, 60, 100, "Time left 1:00"), sb(3, 170, 100, "Trades left 10"), { id: 4, pageId: "p", x: 0, y: 60, w: 300, h: 22, content: "Legend", from: { selector: "body > section > p:nth-of-type(4)" } }];
const room = RW.roomForWords(row, "p", () => true, new Map(), new Map([[1, { content: "Behind by 1.83 points" }]]));
check("10. longer words widen their part and push what follows on its line, not the line below", room.get(1).w === 210 && room.get(2).x === 220 && room.get(3).x === 330 && !room.has(4), J([...room]));

/* 10b. J (2026-10-06, page state 9): a place read off a capture already holds that capture's words, so "-" becoming "Go to the match" does not stretch the button fifteen times over. */
const btn = [{ id: 7, pageId: "p", x: 400, y: 10, w: 20, h: 40, content: "-", from: { selector: "body > section > button" } }];
const kept = RW.roomForWords(btn, "p", () => true, new Map([[7, { x: 870, y: 10, w: 169, h: 43 }]]), new Map([[7, { content: "Go to the match" }]]), new Map([[7, "Go to the match"]]));
check("10b. a captured place grows only past the words it was read with", kept.get(7).w === 169, J([...kept]));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
