#!/usr/bin/env node
/**
 * "THIS STATE ONLY" NEVER GOES OUT AS THE PART'S OWN LOOK, AND AN UNDO KEEPS THE STATE'S EDITS.
 *
 * With Show > "This state only" on, the parts wear the state on the board
 * itself. Publish built the style layer from those parts, so the TV's live
 * look went out as its look in every state while the live rule kept the old
 * one; the save and the undo history kept the worn parts too, and an undo
 * past the moment the switch went on, then the switch off, deleted the live
 * state's saved edits and brought an undone edit back. Now what keeps or
 * sends the document reads the parts checked in, and a document put back
 * while a state is worn is worn again. On the real store, with a TV panel
 * whose live state is already half see-through:
 *
 *   1. Publish while worn: the base rule has none of the live edit, the live
 *      rule has it, and the board still wears it;
 *   2. the save and every step of the undo history hold the parts checked
 *      in, and asking twice gives the same parts (nothing new to save);
 *   3. undo, undo past the switch going on, redo, steps in the history (a
 *      step jumped over kept as it was), a thread stood on, Reset and
 *      another site opened each come back wearing the state; switched off
 *      after, the live state keeps its edits and nothing undone is back;
 *   4. switched off, an undo of an edit made while it was on takes back the
 *      state's edit, not the part's own look; with nothing worn, the parts
 *      go out as they are;
 *   5. wiring: the Show switch and the Panels page wear through
 *      `stateEdits.ts`, and Publish, Send the design back and the asks read
 *      the parts checked in;
 *   6. so do Go live (its pages, document and contract, and Build's code it
 *      carries for a site Build made), Export for code and the pictures they
 *      carry (`persist.ts#sentBoard`).
 *
 *   node tests/state-only-checked-in.mjs
 *
 * Covers: src/features/studio/states/stateEdits.ts, src/features/studio/states/ShowSwitch.tsx, src/features/studio/states/PanelsPage.tsx, src/features/studio/board/store/history.ts, src/features/studio/board/store/persist.ts, src/features/studio/board/store/create.ts, src/features/studio/board/store/load.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/StyleLayerPanel.tsx, src/features/studio/publishAsks.ts, src/features/studio/send-out/exportSite.ts, src/features/studio/send-out/goLive.ts, src/features/studio/exportForCode.ts, src/features/studio/staticSite.ts, src/features/studio/scaffoldRun.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const studio = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const E = await studio("states/stateEdits.ts");
const L = await studio("send-out/styleLayer.ts");
const P = await studio("board/store/persist.ts");
const { swapDoc, useStudio } = await studio("board/store.ts");
const read = (f) => readFileSync(join(here, "..", "src", "features", "studio", f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* A TV panel with an idle and a live state; live already makes it half see-through. */
const KEY = "tv=live";
const was = { file: "web/index.html", hook: { attr: "data-hook", value: "tv" }, was: { box: { x: 0, y: 0, w: 100, h: 40 }, words: "" } };
const tv = { id: "tv", pageId: "p", featureId: "box", label: "TV", content: "", x: 0, y: 0, w: 100, h: 40, hooks: { "data-hook": "tv", "data-panel": "tv", "data-states": "idle live", "data-state": "idle" }, source: was, byState: { [KEY]: { opacity: 0.5 } } };
const st = () => useStudio.getState();
const TV = () => st().nodes.find((n) => n.id === "tv");
const look = (n) => J({ opacity: n?.opacity ?? null, radius: n?.radius ?? null, byState: n?.byState ?? null });
const rules = (nodes) => L.buildLayer(nodes, null, { repo: "o/r", ref: "main", dir: "web/", files: [] }, { kit: true }).rules.filter((r) => r.nodeId === "tv").map((r) => `${r.selector} { ${r.declarations.join("; ")} }`);
/* As the Show switch puts it on and takes it off (`ShowSwitch.tsx`). */
const on = () => useStudio.setState((s) => ({ nodes: E.wearStates("show", s.nodes, [{ key: KEY, ids: ["tv"] }]) }));
const off = () => useStudio.setState((s) => ({ nodes: E.takeOffStates("show", s.nodes) }));
const start = () => { if (E.wears("show")) off(); useStudio.setState({ pages: [{ id: "p", name: "Play", path: "/", prompt: "", scroll: "inherit" }], activePageId: "p", nodes: [structuredClone(tv)], past: [], future: [], threads: [] }); };
/* Its corners rounded (the part's own), then This state only, then live made fainter still (the state's). */
const edited = () => { start(); st().updateNode("tv", { radius: 4 }); on(); st().updateNode("tv", { opacity: 0.2 }); };

/* 1. */
edited();
const sent = rules(E.checkedIn(st().nodes));
check("1a. the board wears the live state, with the edit on it", TV().opacity === 0.2 && TV().radius === 4 && E.wears("show"), look(TV()));
check("1b. Publish while it is on: the TV's own rule has its corners and none of the live edit", sent.some((r) => r.startsWith('[data-hook="tv"] {') && /border-radius: 4px/.test(r) && !/opacity/.test(r)), J(sent));
check("1c. and the live rule carries the edit", sent.some((r) => r.startsWith('[data-hook="tv"][data-state="live"] {') && /opacity: 0\.2/.test(r)) && !sent.some((r) => /opacity: 0\.5/.test(r)), J(sent));
check("1d. sending took nothing off the board", TV().opacity === 0.2 && E.wears("show"), look(TV()));

/* 2. */
const saved = P.docOnly(st()).nodes;
check("2a. the save holds the TV's own look, the edit kept as the live state's", look(saved[0]) === J({ opacity: null, radius: 4, byState: { [KEY]: { opacity: 0.2 } } }), look(saved[0]));
check("2b. asked again, the same parts: nothing new to write", P.docOnly(st()).nodes === saved && E.checkedIn(st().nodes) === saved);
check("2c. every step of the undo history holds the parts checked in", st().past.length === 2 && st().past.every((d) => d.nodes[0].opacity === undefined && d.nodes[0].byState?.[KEY]?.opacity === 0.5), J(st().past.map((d) => look(d.nodes[0]))));

/* 3. The board from before the switch went on: worn, and taken off. */
const wornAtStart = J({ opacity: 0.5, radius: null, byState: { [KEY]: { opacity: 0.5 } } });
const atStart = J({ opacity: null, radius: null, byState: { [KEY]: { opacity: 0.5 } } });
st().undo();
check("3a. undo: the live state worn again, as it was before the edit", look(TV()) === J({ opacity: 0.5, radius: 4, byState: { [KEY]: { opacity: 0.5 } } }) && E.wears("show"), look(TV()));
st().undo();
check("3b. undo past the switch going on: still worn, the corners taken back", look(TV()) === wornAtStart, look(TV()));
st().redo();
st().travel(1);
check("3c. redo and a step forward in the history: worn, with the edit", TV().opacity === 0.2 && TV().radius === 4, look(TV()));
st().travel(-2);
st().travel(1);
check("3c. …two steps back, then one forward: the step gone over still holds the live state's look of then", look(TV()) === J({ opacity: 0.5, radius: 4, byState: { [KEY]: { opacity: 0.5 } } }), look(TV()));
st().travel(-1);
off();
check("3d. back to the start and switched off: the live state keeps its edit, the undone corners stay undone", look(TV()) === atStart, look(TV()));
for (const [n, door, put] of [["3e", "a thread stood on", () => st().standOn(st().threads.at(-1).id)], ["3f", "Reset", () => st().restoreDoc(st().past[0])]]) {
  edited();
  put();
  const worn = look(TV());
  off();
  check(`${n}. ${door} puts that board back wearing it; switched off, the live state keeps its edit`, worn === wornAtStart && look(TV()) === atStart, `${worn} then ${look(TV())}`);
}
/* A copy of the site (the same part ids) opened from the top bar while it is on: its own TV, its own live look. */
edited();
const copy = { ...structuredClone(tv), radius: 9, byState: { [KEY]: { opacity: 0.7 } } };
swapDoc(J({ state: { pages: [{ id: "p", name: "Play", path: "/", prompt: "", scroll: "inherit" }], activePageId: "p", nodes: [copy] }, version: 0 }));
const swapped = look(TV());
off();
check("3g. another site opened while it is on: worn on its own parts, and switched off it keeps its own looks", swapped === J({ opacity: 0.7, radius: 9, byState: { [KEY]: { opacity: 0.7 } } }) && look(TV()) === J({ opacity: null, radius: 9, byState: { [KEY]: { opacity: 0.7 } } }), `${swapped} then ${look(TV())}`);

/* 4. */
edited();
off();
check("4a. switched off: the edit is the live state's, the TV's own look untouched", look(TV()) === J({ opacity: null, radius: 4, byState: { [KEY]: { opacity: 0.2 } } }), look(TV()));
st().undo();
check("4b. undo takes back the live state's edit, and never makes the live look the TV's own", look(TV()) === J({ opacity: null, radius: 4, byState: { [KEY]: { opacity: 0.5 } } }), look(TV()));
check("4c. with nothing worn, the save and Publish take the parts as they are", !E.wears("show") && E.checkedIn(st().nodes) === st().nodes && P.docOnly(st()).nodes === st().nodes);

/* 5. */
const show = read("states/ShowSwitch.tsx"), panels = read("states/PanelsPage.tsx");
check("5a. the Show switch and the Panels page wear through stateEdits.ts, with no record of their own",
  /wearStates\("show"/.test(show) && /takeOffStates\("show"/.test(show) && /wearStates\("panels"/.test(panels) && /takeOffStates\("panels"/.test(panels) && !/checkOut\(|checkIn\(|CheckedOut/.test(show + panels));
check("5b. Publish and Send the design back build from the parts checked in",
  /useSteady\(useStudio\(\(s\) => checkedIn\(s\.nodes\)\)\)/.test(read("CodeSiteButtons.tsx")) && /const own = useStudio\(\(s\) => checkedIn\(s\.nodes\)\)/.test(read("StyleLayerPanel.tsx")));
check("5c. and so do the NEXT.md asks", /nodes: checkedIn\(st\.nodes\)/.test(read("publishAsks.ts")));

/* 6. */
edited();
const out = P.sentBoard(st());
check("6a. the board as it goes out: the TV's own look, the edit kept as the live state's, and the board still wears it", look(out.nodes[0]) === J({ opacity: null, radius: 4, byState: { [KEY]: { opacity: 0.2 } } }) && TV().opacity === 0.2 && E.wears("show"), look(out.nodes[0]));
off();
check("6b. with nothing worn, it is the board itself", P.sentBoard(st()) === st());
const sends = { "send-out/exportSite.ts": 1, "send-out/goLive.ts": 2, "exportForCode.ts": 3, "staticSite.ts": 1, "scaffoldRun.ts": 1 };
const reads = Object.fromEntries(Object.keys(sends).map((f) => [f, (read(f).match(/sentBoard\(useStudio\.getState\(\)\)/g) ?? []).length]));
check("6c. Go live's pages, document, contract and Build's code, Export for code and the pictures they carry read the board that way", Object.entries(sends).every(([f, n]) => reads[f] === n), J(reads));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
