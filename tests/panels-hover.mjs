#!/usr/bin/env node
/**
 * THE PANELS RAIL: SAMPLES OF ONE STATE, AND A PANEL CENTRED WHEN ISOLATED (J, 2026-10-06).
 *
 * J: "ahead by 1.16 points and ahead by 1.83 points" are one state with other
 * data, and a panel picked from the rail hid behind it. Pure, on a small page
 * any site could have (a score panel with level, winning and losing states,
 * its lead line sampled):
 *
 *   1. numbers aside, words of one shape are one shape;
 *   2. each state's chips are only the samples that fit what its scene shows
 *      there ("Ahead by …" in winning), never another state's words;
 *   3. an isolated panel is moved to the middle of its page, wherever it sits;
 *   4. hovered, a panel some page state draws snaps the page state to it; one
 *      none draws (a pop-up) says so, so the rail pops it up alone instead.
 *
 *   node tests/panels-hover.mjs
 *
 * Covers: src/features/studio/states/stateRules.ts, src/features/studio/board/helpers.ts, src/features/studio/states/PanelsPage.tsx, src/features/studio/states/sceneStep.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const R = await jiti.import(join(here, "..", "src", "features", "studio", "states", "stateRules.ts"));
const H = await jiti.import(join(here, "..", "src", "features", "studio", "board", "helpers.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

/* 1 */
check("1. numbers aside, one shape", R.wordShape("Ahead by 1.16 points") === R.wordShape("Ahead by 1.83 points") && R.wordShape("Ahead by 1.83 points") !== R.wordShape("Behind by 1.83 points"));

/* 2 */
const P = "body > main > section";
const n = (id, hooks, sel, extra = {}) => ({ id, pageId: "p", hooks, from: { selector: sel }, x: 0, y: 0, w: 100, h: 40, ...extra });
const nodes = [
  n("score", { "data-hook": "score", "data-panel": "score", "data-states": "level winning losing", "data-state": "level" }, P, { x: 1500, y: 300, w: 300, h: 120 }),
  n("lead", { "data-hook": "score-lead" }, `${P} > p:nth-of-type(1)`),
  n("time", { "data-hook": "score-time" }, `${P} > p:nth-of-type(2)`),
];
const samples = { "score-lead": ["Level", "Ahead by 1.16 points", "Ahead by 1.83 points", "Behind by 1.83 points"] };
const scene = (name, state, lead) => ({ name, label: name, page: "index.html", shows: ["score", "score-lead", "score-time"], declared: true, panels: { score: state }, texts: { "score-lead": lead } });
const scenes = [scene("start", "level", "Level"), scene("mid", "winning", "Ahead by 0.5 points"), scene("loss", "losing", "Behind by 2 points")];
const [panel] = R.declaredPagePanels(nodes, "p", "index.html", scenes, samples);
const chips = Object.fromEntries((panel?.states ?? []).map((s) => [s.key, s.samples.map((x) => x.label)]));
check("2. three states, not one per sample", J(panel?.states.map((s) => s.key)) === J(["level", "winning", "losing"]), J(chips));
check("2. winning's chips are its two leads", J(chips.winning) === J(["Ahead by 1.16 points", "Ahead by 1.83 points"]), J(chips.winning));
check("2. level and losing keep their own", J(chips.level) === J(["Level"]) && J(chips.losing) === J(["Behind by 1.83 points"]), J(chips));
check("2. a state with nothing to go by keeps every sample", J(R.samplesFor(samples["score-lead"], undefined)) === J(samples["score-lead"]));

/* 3 */
const c = H.centreIsolated([{ x: 0, y: 0, w: 1920, h: 1300 }, ...nodes], { x: 1500, y: 300, w: 300, h: 120 }, 1920);
check("3. moved to the middle of the page", 1500 + c.dx === 810 && 300 + c.dy === 590, J(c));

/* 4 */
const PP = await jiti.import(join(here, "..", "src", "features", "studio", "states", "PanelsPage.tsx"));
const { useStudio } = await jiti.import(join(here, "..", "src", "features", "studio", "board", "store.ts"));
const sc = (name, shows) => ({ name, label: name, page: "index.html", shows, declared: true, panels: {} });
useStudio.setState({ activePageId: "p", statesOn: ["screen:start"], look: { ...(useStudio.getState().look ?? {}), styleSource: { files: [{ file: "index.html", pageId: "p" }], screens: [sc("start", ["intro"]), sc("mid", ["intro", "score"])] } } });
const toScore = PP.snapToSceneShowing("score", false);
check("4. a panel a page state draws snaps to it", toScore === true && J(useStudio.getState().statesOn) === J(["screen:mid"]), J(useStudio.getState().statesOn));
const toSign = PP.snapToSceneShowing("sign-panel", false);
check("4. a pop-up no page state draws says so, and the page state stays", toSign === false && J(useStudio.getState().statesOn) === J(["screen:mid"]), J(useStudio.getState().statesOn));
const src = (await import("node:fs")).readFileSync(join(here, "..", "src", "features", "studio", "states", "PanelsPage.tsx"), "utf8");
check("4. the rail pops such a panel up alone on hover, and lets it go after (source read)", /if \(!drawn && s0\)[\s\S]{0,200}isolateKey\(p\.id/.test(src) && /previewing\.current = false;\s*if \(was && !keep\) railGiveBack\(\)/.test(src) && /bringToView\(p\.id, !drawn\)/.test(src));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
