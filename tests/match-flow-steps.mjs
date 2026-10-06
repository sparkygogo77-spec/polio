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
 *   4b. a step shows its own words and chart ("You lost.", FINAL); a part
 *      the page hides (the match panel) has steps only where it is drawn;
 *      an overlay pinned to the window (the tour) is kept on the page, and a
 *      window-wide one shades the whole page;
 *
 *   node tests/match-flow-steps.mjs
 *
 * Covers: src/features/studio/boardStates.ts, src/app/api/studio/zip/route.ts
 */
import { partSteps, screenPlaces, stepLook, steppedParts } from "../src/features/studio/boardStates.ts";
import { stateFrames } from "../src/features/studio/stateFrames.ts";

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
  part("headline", "chart-tv-result", `${ROW} > div > div > div > div > p`, [300, 300, 300, 40], { ...hidden("chart-tv-result"), content: "-" }),
  part("chan", "chart-tv-channel", `${ROW} > div > div > div > div > p:nth-of-type(2)`, [150, 200, 200, 30], { content: [{ text: "CH 47 " }, { text: "OFF AIR", hooks: { "data-hook": "chart-tv-channel-state" } }] }),
  part("trade", "trade-panel", `${ROW} > div > aside`, [740, 100, 160, 500], hidden("trade-panel")),
  part("note", "chart-note", "body > main > p", [100, 720, 800, 60]),
  part("side", "balance-panel", "body > aside", [920, 100, 80, 900]),
];
/* What each screen draws, as its own page draws it: the TV 140 below the row's top once the scoreboard is in, 640 wide, the trade panel beside it. */
const match = { "chart-row": [0, 0, 800, 740], scoreboard: [0, 0, 800, 100], "score-time": [10, 10, 200, 30], "chart-tv-row": [0, 140, 800, 600], "chart-tv": [0, 140, 640, 600], "chart-tv-body": [0, 190, 640, 500], "chart-tv-screen": [40, 230, 480, 400], "trade-panel": [660, 140, 140, 560], "chart-note": [0, 760, 800, 60] };
const idle = { "chart-row": [0, 0, 800, 600], "chart-tv-row": [0, 0, 800, 600], "chart-tv": [0, 0, 800, 600], "chart-tv-body": [0, 50, 800, 500], "chart-tv-screen": [40, 90, 600, 400], "chart-note": [0, 620, 800, 60] };
const frame = ["chart-row", "chart-tv-row", "chart-tv", "chart-tv-body", "chart-tv-screen", "chart-tv-channel", "chart-tv-channel-state", "chart-note"];
const opens = [...frame, "chart-tv-loading"];
const between = [...frame, "chart-tv-idle"];
const screen = (name, label, step, shows, boxes, texts = {}) => ({ name, label, page: "web/index.html", shows, boxes, texts, ...(step ? { step } : {}) });
const screens = [
  screen("connecting", "Loading: connecting", "connecting", opens, idle),
  screen("lobby", "Signed in: play money and Find a match", "between matches", [...between, "balance-panel"], idle, { "chart-tv-screen": "a" }),
  screen("tv-idle", "Chart TV: between matches, a sample chart plays", "between matches", between, idle, { "chart-tv-screen": "a" }),
  screen("before-queue", "Pop-up: the rules to confirm", "rules to confirm", between, idle, { "chart-tv-screen": "a" }),
  screen("queue-waiting", "Waiting in the queue", "in the queue", between, idle, { "chart-tv-screen": "b" }),
  screen("mid-match", "Match in progress", "match live", [...frame, "scoreboard", "score-time", "trade-panel"], match, { "score-time": "0:18" }),
  screen("result-win", "Result: you won", "you won", [...frame, "scoreboard", "score-time", "trade-panel", "chart-tv-result"], match, { "chart-tv-result": "You won." }),
  screen("result-loss", "Result: you lost", "you lost", [...frame, "scoreboard", "score-time", "trade-panel", "chart-tv-result"], match, { "chart-tv-result": "You lost.", "chart-tv-channel-state": "FINAL" }),
  screen("tour", "Intro tour: one step", null, [...between, "scoreboard"], idle),
];
screens.find((x) => x.name === "result-loss").stills = { "chart-tv-screen": { id: "pic-lost" } };
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

/* 4b. Each step's own words and picture; a part the page hides has steps only where it is drawn. */
const lost = steppedParts(nodes, ["step:row=screen:result-loss"], screens, () => "web/index.html", frames);
check("the result step says what the page says there: \"You lost.\", FINAL", lost.looks.get("headline")?.content === "You lost." && lost.looks.get("chan")?.content?.[1]?.text === "FINAL" && lost.looks.get("chan")?.content?.[0]?.text === "CH 47 ", JSON.stringify([lost.looks.get("headline"), lost.looks.get("chan")]));
check("and shows that step's own chart", lost.looks.get("screen")?.picture?.id === "pic-lost");
const emptyReason = { ...part("why", "trade-reason", `${ROW} > div > aside > p`, [740, 500, 160, 1]), content: "", font: null };
check("a part left empty as the page opens takes the step's words at the step's size", JSON.stringify(stepLook(emptyReason, { ...screens[0], texts: { "trade-reason": "The match is over" }, sizes: { "trade-reason": 11 } })) === JSON.stringify({ content: "The match is over", font: { px: 11 } }));
check("a part keeps its own words where the step says the same", stepLook(nodes.find((n) => n.id === "chan"), screens[0]) === null);
const panel = part("panel", "match-panel", "body > main > section", [100, 800, 800, 300], hidden("match-panel"));
const panelSteps = partSteps([...nodes, panel], panel, [], screens.map((x) => (x.step?.startsWith("you") || x.step === "match live" ? { ...x, shows: [...x.shows, "match-panel"], boxes: { ...x.boxes, "match-panel": [0, 900, 800, 300] } } : x)), "web/index.html").filter((x) => x.screen);
check("the match panel, hidden until the match, has steps only where it is drawn", panelSteps.every((x) => ["match live", "you won", "you lost"].includes(x.label)), panelSteps.map((x) => x.label).join(", ") || "none");

/* 4c. An overlay pinned to the window stays on the page. */
const tourNodes = [
  part("page", "app", "body > div", [0, 0, 1000, 1000]),
  part("shade", "tour", "body > aside", [0, 0, 1000, 600], { ...hidden("tour"), from: { selector: "body > aside", position: "fixed" } }),
  part("card", "tour-card", "body > aside > div", [300, 100, 400, 300], { ...hidden("tour"), from: { selector: "body > aside > div", position: "fixed" } }),
  part("a", "nav", "body > div > nav", [0, 0, 1000, 40]), part("b", "intro", "body > div > p", [0, 50, 1000, 40]), part("c", "foot", "body > div > footer", [0, 940, 1000, 60]),
];
const tour = { name: "tour", label: "Tour", page: "web/index.html", shows: ["app", "nav", "intro", "foot", "tour", "tour-card"], boxes: { app: [0, 0, 1000, 1000], nav: [0, 0, 1000, 40], intro: [0, 50, 1000, 40], foot: [0, 940, 1000, 60], tour: [0, 900, 1000, 600], "tour-card": [300, 1100, 400, 300] } };
const tp = screenPlaces(tourNodes, ["screen:tour"], [tour], () => "p", () => true);
const cardAt = tp.get("card") ?? tourNodes[2], shadeAt = tp.get("shade") ?? tourNodes[1];
check("the tour, read where the window had scrolled, is drawn on the page, not under it", shadeAt.y + shadeAt.h <= 1000 && cardAt.y + cardAt.h <= 1000 && cardAt.y === 700, JSON.stringify({ shadeAt, cardAt }));
/* J (2026-10-06): the tour's dim stopped at the top of the window it was read in; a window-wide overlay shades the whole page. */
check("a window-wide overlay shades the whole page, top to foot", shadeAt.y === 0 && shadeAt.h === 1000 && shadeAt.w === 1000, JSON.stringify(shadeAt));
/* J (2026-10-06, page state 15 again): a part off to the side of the page, the ring left on the part it points at, the card kept off the ring. */
const wide = [
  part("page", "app", "body > div", [0, 0, 1000, 1400]),
  part("q", "queue-panel", "body > div > section", [100, 500, 800, 300]), part("side", "phone", "body > div > i", [1200, 10, 600, 20]),
  part("shade", "tour", "body > aside", [0, 0, 1000, 600], { ...hidden("tour"), from: { selector: "body > aside", position: "fixed" } }),
  part("ring", "tour-highlight", "body > aside > div:nth-of-type(1)", [0, 0, 10, 10], { ...hidden("tour"), from: { selector: "body > aside > div:nth-of-type(1)", position: "fixed" } }),
  part("card", "tour-card", "body > aside > div:nth-of-type(2)", [300, 100, 400, 300], { ...hidden("tour"), from: { selector: "body > aside > div:nth-of-type(2)", position: "fixed" } }),
  part("title", "tour-title", "body > aside > div:nth-of-type(2) > h2", [316, 116, 368, 30], { ...hidden("tour"), from: { selector: "body > aside > div:nth-of-type(2) > h2" } }),
];
const wideCap = { name: "tour", label: "Tour", page: "web/index.html", shows: ["app", "queue-panel", "phone", "tour", "tour-highlight", "tour-card", "tour-title"], boxes: { app: [0, 0, 1000, 1400], "queue-panel": [100, 500, 800, 300], phone: [1200, 10, 600, 20], tour: [0, 480, 1000, 600], "tour-highlight": [94, 494, 812, 312], "tour-card": [300, 760, 400, 300], "tour-title": [316, 776, 368, 30] } };
const wp = screenPlaces(wide, ["screen:tour"], [wideCap], () => "p", () => true);
const wat = (id) => wp.get(id) ?? wide.find((x) => x.id === id);
const ring = wat("ring"), wcard = wat("card"), wq = wat("q"), wshade = wat("shade"), wtitle = wat("title");
check("a window-wide overlay still shades the whole page with a part off to the side", wshade.y === 0 && wshade.h === 1400, JSON.stringify(wshade));
check("its ring stays on the part it points at, the card below it, not over it", Math.abs(ring.x - (wq.x - 6)) <= 1 && Math.abs(ring.y - (wq.y - 6)) <= 1 && wcard.y >= ring.y + ring.h && wtitle.y - wcard.y === 16, JSON.stringify({ ring, wq, wcard, wtitle }));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
