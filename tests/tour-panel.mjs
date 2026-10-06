#!/usr/bin/env node
/**
 * THE INTRO TOUR ON THE PANELS PAGE (J, 2026-10-06): "i dont understand the
 * 2 states of intro tour". A tour is one state ("on") with its steps as
 * sample chips, and its ring sits on the part a step points at:
 *
 *   1. a one-state panel with sample chips stays on the Panels page, even
 *      though a page scene shows it;
 *   2. the samples go row by row: chip 4 is step 4's own count, title and
 *      text, not thinned to the step the scene happens to show;
 *   3. a panel as wide as the page (the dimmed screen and its ring), picked,
 *      is drawn over the page its scene shows: the part the ring points at
 *      is drawn, under the ring.
 *
 *   node tests/tour-panel.mjs
 *
 * Covers: src/features/studio/stateRules.ts, src/features/studio/canvas/helpers.ts, src/features/studio/panels.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const studio = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const R = await studio("stateRules.ts");
const P = await studio("panelsOf.ts");
const H = await studio("canvas/helpers.ts");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const M = "body > main", T = "body > div";
const n = (id, hooks, sel, box) => ({ id, pageId: "p", hooks, from: { selector: sel }, x: box[0], y: box[1], w: box[2], h: box[3] });
const nodes = [
  n("main", { "data-hook": "app" }, M, [0, 0, 1920, 900]),
  n("q", { "data-hook": "queue-panel" }, `${M} > section`, [100, 300, 800, 200]),
  n("t", { "data-hook": "tour", "data-panel": "tour", "data-states": "off on", "data-state": "off" }, T, [0, 0, 1920, 900]),
  n("t-ring", { "data-hook": "tour-highlight" }, `${T} > div:nth-of-type(1)`, [0, 0, 10, 10]),
  n("t-card", { "data-hook": "tour-card" }, `${T} > div:nth-of-type(2)`, [700, 400, 500, 300]),
  n("t-step", { "data-hook": "tour-progress" }, `${T} > div:nth-of-type(2) > p:nth-of-type(1)`, [716, 416, 400, 20]),
  n("t-title", { "data-hook": "tour-title" }, `${T} > div:nth-of-type(2) > h2`, [716, 446, 400, 30]),
];
const files = [{ file: "web/index.html", pageId: "p" }];
const scenes = R.readScenes(J({ scenes: [
  { name: "lobby", label: "Lobby", page: "web/index.html", panels: {} },
  { name: "tour", label: "Intro tour: one step", page: "web/index.html", panels: { tour: "on" } },
] }), "");
const live = [{ name: "tour", page: "web/index.html", shows: ["app", "queue-panel", "tour", "tour-highlight", "tour-card", "tour-progress", "tour-title"],
  boxes: { app: [0, 0, 1920, 900], "queue-panel": [100, 300, 800, 200], tour: [0, 0, 1920, 900], "tour-highlight": [100, 300, 800, 200], "tour-card": [700, 520, 500, 300], "tour-progress": [716, 536, 400, 20], "tour-title": [716, 566, 400, 30] },
  texts: { "tour-progress": "Step 2 of 3", "tour-title": "Connect a wallet" } }];
const samples = R.readSamples(J({ hooks: { "tour-progress": ["Step 1 of 3", "Step 2 of 3", "Step 3 of 3"], "tour-title": ["How it works", "Connect a wallet", "Deposit once"] } }));
const screens = R.sceneScreens(nodes, files, scenes, live);

/* 1. and 2. */
const panels = R.declaredPagePanels(nodes, "p", "web/index.html", screens, samples);
const tour = panels.find((p) => p.hook === "tour");
check("1. the tour is one state on the Panels page, with its steps as chips", J(tour?.states.map((s) => s.key)) === J(["on"]) && tour.states[0].samples.length === 3, J(panels.map((p) => [p.hook, p.states.map((s) => [s.key, s.samples.length])])));
const chip = (i) => tour.states[0].samples[i].screen.texts;
check("2. chips go row by row: each step's own count and title", J([0, 1, 2].map((i) => [chip(i)["tour-progress"], chip(i)["tour-title"]])) === J([["Step 1 of 3", "How it works"], ["Step 2 of 3", "Connect a wallet"], ["Step 3 of 3", "Deposit once"]]), J([0, 1, 2].map(chip)));
/* The scoreboard's case still thins: a lead whose samples do not all fit keeps only the ones that do. */
check("2b. a state still keeps only the samples that fit it", J(R.samplesFor(["Ahead by 1", "Level", "Ahead by 2"], "Ahead by 0.5")) === J(["Ahead by 1", "Ahead by 2"]));

/* 3. */
const st = { statesOn: [P.isolateKey("t", "on", "on:1")], look: { styleSource: { files, screens, scenes, samples } }, nodes, frameWidth: 1920 };
const iso = H.isolatedOnBoard(st);
const ring = iso?.places.get("t-ring"), q = iso?.places.get("q") ?? (iso?.shows.has("q") ? { x: 100, y: 300, w: 800, h: 200 } : null);
check("3. a page-wide panel is drawn over its scene's page, the ring on its part", !!iso && iso.shows.has("q") && iso.shows.has("t-ring") && !!ring && !!q && ring.x === q.x && ring.y === q.y && ring.w === q.w && ring.h === q.h, J({ shows: [...(iso?.shows ?? [])], ring, q }));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
