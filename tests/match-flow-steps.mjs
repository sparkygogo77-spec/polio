#!/usr/bin/env node
/**
 * A PART'S STEPS FOLLOW THE SITE'S FLOW, AND EACH DRAWS WITH THE PAGE'S LAYOUT.
 *
 * J (2026-10-05), on PonsStars' match states in the Builder against the live
 * page: the chart row's steps were "tv-row", "scoreboard" and "one step" (the
 * tour floating over it); the match panel had "practice" and
 * "chart-generated" as steps and no "you lost"; and a picked step stacked
 * the scoreboard over the TV's top and the trade buttons inside its screen,
 * over the lines below. Pure, on a small stand-in of that page:
 *
 *   1. the site's screens name their step of the flow (`step`): a part goes
 *      through them in that order, one each, named by the step; a screen
 *      with no step (the tour) is not one of its steps;
 *   2. steps drawing the same parts saying different words (you won, you
 *      lost) are two; steps in a row drawing the same, word for word, are
 *      one, named by the screen most about the part;
 *   3. a block hidden inside it that its screens draw (the scoreboard) is not
 *      a step of its own; what it opens with is named by the flow's step,
 *      never a hook's stub ("tv-row");
 *   4. picked, a step draws every part where the screen has it from the
 *      part's corner (the TV under the scoreboard and narrower, the trade
 *      panel beside it), and what is under the part moves down by as much
 *      as it grew, what holds it growing with it;
 *   5. a site brought in from a repository is called by its name, not
 *      "Site 10"; a name someone gave it is kept.
 *
 *   node tests/match-flow-steps.mjs
 *
 * Covers: src/features/studio/boardStates.ts, src/features/builds/siteName.ts, src/features/builds/store.ts, src/app/api/studio/zip/route.ts
 */
import { partSteps, steppedParts } from "../src/features/studio/boardStates.ts";
import { stateFrames } from "../src/features/studio/stateFrames.ts";
import { siteName } from "../src/features/builds/siteName.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ROW = "body > main > div";
const part = (id, hook, sel, box, extra = {}) => ({ id, pageId: "p", hooks: { "data-hook": hook }, from: { selector: sel }, x: box[0], y: box[1], w: box[2], h: box[3], ...extra });
const hidden = (g) => ({ state: { group: `hidden:${g}`, option: 1 } });
const nodes = [
  part("main", "main", "body > main", [0, 0, 1000, 1200]),
  part("row", "chart-row", ROW, [100, 100, 800, 600]),
  part("score", "scoreboard", `${ROW} > section`, [100, 100, 800, 100], hidden("scoreboard")),
  part("score-t", "score-time", `${ROW} > section > p`, [110, 110, 200, 30], hidden("scoreboard")),
  part("tvrow", "chart-tv-row", `${ROW} > div`, [100, 100, 800, 600]),
  part("tv", "chart-tv", `${ROW} > div > div`, [100, 100, 800, 600]),
  part("body", "chart-tv-body", `${ROW} > div > div > div`, [100, 150, 800, 500]),
  part("screen", "chart-tv-screen", `${ROW} > div > div > div > div`, [140, 190, 600, 400]),
  part("loading", "chart-tv-loading", `${ROW} > div > div > div > div > div:nth-of-type(1)`, [300, 300, 300, 80]),
  part("idlebox", "chart-tv-idle", `${ROW} > div > div > div > div > div:nth-of-type(2)`, [300, 300, 300, 80], hidden("chart-tv-idle")),
  part("headline", "chart-tv-result", `${ROW} > div > div > div > div > p`, [300, 300, 300, 40], hidden("chart-tv-result")),
  part("trade", "trade-panel", `${ROW} > div > aside`, [740, 100, 160, 500], hidden("trade-panel")),
  part("note", "chart-note", "body > main > p", [100, 720, 800, 60]),
  part("side", "balance-panel", "body > aside", [920, 100, 80, 900]),
];
/* What each screen draws, as its own page draws it: the TV 140 below the row's top once the scoreboard is in, 640 wide, the trade panel beside it. */
const match = { "chart-row": [0, 0, 800, 740], scoreboard: [0, 0, 800, 100], "score-time": [10, 10, 200, 30], "chart-tv-row": [0, 140, 800, 600], "chart-tv": [0, 140, 640, 600], "chart-tv-body": [0, 190, 640, 500], "chart-tv-screen": [40, 230, 480, 400], "trade-panel": [660, 140, 140, 560], "chart-note": [0, 760, 800, 60] };
const idle = { "chart-row": [0, 0, 800, 600], "chart-tv-row": [0, 0, 800, 600], "chart-tv": [0, 0, 800, 600], "chart-tv-body": [0, 50, 800, 500], "chart-tv-screen": [40, 90, 600, 400], "chart-note": [0, 620, 800, 60] };
const frame = ["chart-row", "chart-tv-row", "chart-tv", "chart-tv-body", "chart-tv-screen", "chart-note"];
const opens = [...frame, "chart-tv-loading"];
const between = [...frame, "chart-tv-idle"];
const screen = (name, label, step, shows, boxes, words = {}) => ({ name, label, page: "web/index.html", shows, boxes, words, ...(step ? { step } : {}) });
const screens = [
  screen("connecting", "Loading: connecting", "connecting", opens, idle),
  screen("lobby", "Signed in: play money and Find a match", "between matches", [...between, "balance-panel"], idle, { "chart-tv-screen": "a" }),
  screen("tv-idle", "Chart TV: between matches, a sample chart plays", "between matches", between, idle, { "chart-tv-screen": "a" }),
  screen("before-queue", "Pop-up: the rules to confirm", "rules to confirm", between, idle, { "chart-tv-screen": "a" }),
  screen("queue-waiting", "Waiting in the queue", "in the queue", between, idle, { "chart-tv-screen": "b" }),
  screen("mid-match", "Match in progress", "match live", [...frame, "scoreboard", "score-time", "trade-panel"], match, { "score-time": "0:18" }),
  screen("result-win", "Result: you won", "you won", [...frame, "scoreboard", "score-time", "trade-panel", "chart-tv-result"], match, { "chart-tv-result": "won" }),
  screen("result-loss", "Result: you lost", "you lost", [...frame, "scoreboard", "score-time", "trade-panel", "chart-tv-result"], match, { "chart-tv-result": "lost" }),
  screen("tour", "Intro tour: one step", null, [...between, "scoreboard"], idle),
];
const frames = stateFrames(nodes);
const fr = frames.byFrame.get("row");
const row = nodes.find((n) => n.id === "row");
const steps = fr ? partSteps(nodes, row, fr.steps, screens, "web/index.html") : [];
const labels = steps.map((s) => s.label);

/* 1. The flow, in order, named by its steps; the tour is not one. */
check("the chart row is a part with steps", !!fr, fr ? fr.steps.map((s) => s.key).join(", ") : "none");
const want = ["connecting", "between matches", "in the queue", "match live", "you won", "you lost"];
check("its steps are the site's flow, in order, each named by its step", JSON.stringify(labels) === JSON.stringify(want), labels.join(" → "));
check("a screen with no step (the tour floating over it) is not one of its steps", !steps.some((s) => s.screen === "tour" || s.label === "one step"));

/* 2. Words tell won from lost; the same drawing in a row is one step, named by the screen most about it. */
check("you won and you lost are two steps: the same parts, other words", labels.includes("you won") && labels.includes("you lost"));
check("between matches and the rules to confirm draw the same here: one step, from the chart's own screen", steps.filter((s) => s.label === "between matches").length === 1 && !labels.includes("rules to confirm") && steps.find((s) => s.label === "between matches")?.screen === "tv-idle", steps.map((s) => s.screen ?? s.key).join(", "));

/* 3. The scoreboard comes in with the match; what it opens with has a plain name. */
check("the scoreboard, hidden in it and drawn by its screens, is not a step of its own", !steps.some((s) => s.key === "hidden:scoreboard"));
check("what it opens with is named by the flow, not by a hook's stub", steps[0]?.key === "open" && steps[0]?.label === "connecting" && !labels.includes("tv-row"), steps[0]?.label);

/* 4. Picked, the match draws with the page's layout. */
const live = steppedParts(nodes, ["step:row=screen:mid-match"], screens, () => "web/index.html", frames);
const at = (id) => live.places.get(id) ?? (() => { const n = nodes.find((x) => x.id === id); return { x: n.x, y: n.y, w: n.w, h: n.h }; })();
const score = at("score"), tv = at("tv"), trade = at("trade"), rowAt = at("row"), note = at("note");
check("the scoreboard sits on top, the TV under it, not over it", score.y === 100 && tv.y === 240 && score.y + score.h <= tv.y, JSON.stringify({ score, tv }));
check("the TV is as narrow as the page draws it, with its screen inside it", tv.w === 640 && at("screen").x + at("screen").w <= tv.x + tv.w, JSON.stringify({ tv, screen: at("screen") }));
check("the trade panel is beside the TV, outside its screen", trade.x >= tv.x + tv.w && trade.y === tv.y, JSON.stringify(trade));
check("the row grows to hold it", rowAt.h === 740, JSON.stringify(rowAt));
check("what is under the row moves down by as much, and what holds it grows", note.y === 720 + 140 && at("main").h === 1200 + 140, JSON.stringify({ note, main: at("main") }));
check("a part beside the row is left where it is", !live.places.has("side"));
const shown = (id) => live.decide.get(id);
check("the match shows its own parts only: no result headline from another step", shown("score") === true && shown("trade") === true && shown("headline") === false);

/* 5. The site's name. */
const src = { owner: "him", name: "PonsStars", branch: "main" };
check("a site brought in from a repository is called by its name, not \"Site 10\"", siteName("Site 10", src) === "PonsStars", siteName("Site 10", src));
check("a name someone gave it, or a blank site's number, is kept", siteName("My shop", src) === "My shop" && siteName("Site 3", null) === "Site 3");

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
