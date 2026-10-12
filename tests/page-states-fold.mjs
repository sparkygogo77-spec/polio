#!/usr/bin/env node
/**
 * A PAGE STATE CHANGES MORE THAN ONE PART (rule 31, J, 2026-10-06).
 *
 * J: the Chart TV had several inaccurate states in Panels and six accurate
 * whole-page states; a page state should exist only when more than one part
 * of the page changes at once. Pure, on a small page any game site could have
 * (a TV with duel circles inside it, a trade panel, a note):
 *
 *   1. a scene that changes one part against a page state before it is that
 *      part's state, not a page state; one that changes nothing is the same
 *      page state twice; one that changes two parts stays a page state;
 *   2. a scene that names its part folds into it when all it changes is inside
 *      that part, and stays a page state when it changes another part too;
 *   3. the part's state on the Panels page is drawn from its own folded scene's
 *      capture (the accurate one), not from the first page state that has it;
 *      two folded scenes of one state are two chips;
 *   4. a one-state part that only a folded scene shows is listed as a panel;
 *   5. the kit says so: rule 31 in BUILDER-RULES.md and builder.json, and
 *      kit:check refuses a "part" that is not one;
 *   6. rule 31's exception (J, 2026-10-12): a scene that only hides one part
 *      stays a page state, so the page without it can still be stepped to,
 *      and the rule's text says so.
 *
 *   node tests/page-states-fold.mjs
 *
 * Covers: src/features/studio/states/stateRules.ts, src/features/studio/states/sceneStep.ts, kit/tools/kit-check.mjs, kit/BUILDER-RULES.md
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const R = await jiti.import(join(here, "..", "src", "features", "studio", "states", "stateRules.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const M = "body > main", TV = `${M} > div:nth-of-type(1)`, TR = `${M} > aside`, NOTE = `${M} > p`;
const n = (id, hooks, sel) => ({ id, pageId: "p", hooks, from: { selector: sel }, x: 0, y: 0, w: 100, h: 40 });
const nodes = [
  n("main", { "data-hook": "app" }, M),
  n("tv", { "data-hook": "tv", "data-panel": "tv", "data-states": "idle live warning done", "data-state": "idle" }, TV),
  n("tv-screen", { "data-hook": "tv-screen" }, `${TV} > canvas`),
  n("duel", { "data-hook": "duel", "data-panel": "duel", "data-states": "off level ahead", "data-state": "off" }, `${TV} > div`),
  n("trade", { "data-hook": "trade", "data-panel": "trade", "data-states": "off on", "data-state": "off" }, TR),
  n("note", { "data-hook": "note", "data-panel": "note", "data-states": "off on", "data-state": "off" }, NOTE),
];
const files = [{ file: "web/index.html", pageId: "p" }];
const scene = (name, panels, part) => ({ name, label: `TV: ${name}`, page: "index.html", screen: name, panels, ...(part ? { part } : {}) });
const scenes = R.readScenes(J({ scenes: [
  scene("lobby", { tv: "idle" }),
  scene("note-up", { tv: "idle", note: "on" }),
  scene("match", { tv: "live", duel: "level", trade: "on" }),
  scene("last", { tv: "warning", duel: "level", trade: "on" }),
  scene("again", { tv: "idle" }),
  scene("tv-idle", { tv: "idle" }, "tv"),
  scene("tv-match", { tv: "live", duel: "ahead", trade: "on" }, "tv"),
  scene("tv-wide", { tv: "done", duel: "ahead", trade: "on", note: "on" }, "tv"),
  scene("tv-quiet", { tv: "idle", note: "on" }, "tv"),
] }), "web/");
const box = (w) => ({ tv: [0, 0, w, 300] });
const live = scenes.map((s) => ({ name: s.name, page: "web/index.html", shows: [], boxes: box(s.name.startsWith("tv-") ? 640 : 320) }));
const ss = R.sceneScreens(nodes, files, scenes, live);
const by = Object.fromEntries(ss.map((s) => [s.name, s]));

/* 1. */
check("1. one part changed is that part's state; nothing changed is the same page state; two parts stay a page state",
  scenes[5].part === "tv" && by["note-up"].part === "note" && by.last.part === "tv" && by.again.sameAs === "lobby" && R.isPageState(by.lobby) && R.isPageState(by.match)
  && J(ss.filter(R.isPageState).map((s) => s.name)) === J(["lobby", "match", "tv-wide"]), J(ss.map((s) => [s.name, s.part ?? s.sameAs ?? "page"])));
/* 2. */
check("2. a scene naming its part folds into it when all it changes is inside it; a TV scene that changes the trade panel too stays a page state",
  by["tv-idle"].part === "tv" && by["tv-match"].part === "tv" && R.isPageState(by["tv-wide"]) && by["tv-quiet"].part === "tv", J([by["tv-match"], by["tv-wide"]].map((s) => s.part)));
/* 3. */
const panels = R.declaredPagePanels(nodes, "p", "web/index.html", ss, null);
const noWide = R.declaredPagePanels(nodes, "p", "web/index.html", ss.filter((s) => s.name !== "tv-wide"), null);
const tv = panels.find((p) => p.hook === "tv");
const idle = tv.states.find((s) => s.key === "idle");
const livest = tv.states.find((s) => s.key === "live");
const duel = panels.find((p) => p.hook === "duel");
check("3a. the TV's states are drawn from its own scenes' captures, not the first page state", livest.samples[0].screen.boxes.tv[2] === 640 && livest.samples[0].screen.shows.includes("duel") && duel.states.find((s) => s.key === "ahead").samples[0].screen.boxes.tv[2] === 640, J(livest.samples[0].screen));
check("3b. two folded scenes of one state are two chips, each named for its scene", idle.samples.length === 2 && J(idle.samples.map((x) => x.label)) === J(["tv-idle", "tv-quiet"]) && new Set(idle.samples.map((x) => x.key)).size === 2 && idle.samples.every((x) => x.screen.boxes.tv[2] === 640), J(idle.samples.map((x) => [x.key, x.label])));
check("3c. a state no scene of its own has falls back to the page state (the TV's warning from \"last\")", tv.states.find((s) => s.key === "warning").samples[0].screen.boxes.tv[2] === 320);
/* 4. */
check("4. a one-state part only a folded scene shows is listed as a panel; one a page state shows is not", noWide.some((p) => p.hook === "note") && !panels.some((p) => p.hook === "note") && !panels.some((p) => p.hook === "trade"), J(noWide.map((p) => p.hook)));

/* 5. */
const rules = readFileSync(join(here, "..", "kit", "BUILDER-RULES.md"), "utf8");
const kb = JSON.parse(readFileSync(join(here, "..", "kit", "builder.json"), "utf8"));
const kc = readFileSync(join(here, "..", "kit", "tools", "kit-check.mjs"), "utf8");
check("5. the kit carries rule 31 and kit:check reads \"part\"", /## 31\. A page state changes more than one part/.test(rules) && kb.rules.list.some((r) => r.id === "page-states-change-several-parts") && /sc\.part/.test(kc));

/* 6. The note shown, then the page without it: only the note changed, and it went off. */
const hid = R.sceneScreens(nodes, files, R.readScenes(J({ scenes: [scene("with-note", { tv: "idle", note: "on" }), scene("plain", { tv: "idle" })] }), "web/"), []);
check("6a. a scene that only hides one part stays a page state, so the page without it can be stepped to", hid.length === 2 && hid.every(R.isPageState), J(hid.map((s) => [s.name, s.part ?? s.sameAs ?? "page"])));
const r31 = kb.rules.list.find((r) => r.id === "page-states-change-several-parts")?.rule ?? "";
check("6b. and rule 31 says so, in BUILDER-RULES.md and builder.json", /only hides one part[\s\S]{0,80}stays a page state/.test(rules) && /only hides one part[^.;]*stays a page state/.test(r31), r31);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
