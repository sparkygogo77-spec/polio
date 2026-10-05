#!/usr/bin/env node
/**
 * A PART'S STEPS, KEPT TO THE PART.
 *
 * J (2026-10-05): "some parts problematically shift the whole board or
 * aren't limited to just the one panel its supposed to … element specific
 * states that don't include elements outside the one i want to move
 * through", and "if some elements only come in at certain states of the
 * board that should be shown by states of the board". So a part's step
 * changes only what is inside it, and what comes in on the page as a whole
 * is the page's (its screens):
 *
 *   1. a screen kept to a part decides the parts inside it and nothing
 *      outside, and does not move the part;
 *   2. a face that shows one at a time (`data-state`) shows that face alone;
 *   3. a face the page adds (the balance panel's play-money note) shows
 *      with what the part opens with, in its flow: the lines under it move
 *      down, the part grows; a hidden block inside what it opens with stays
 *      hidden; nothing outside moves;
 *   4. the page's states list: its screens, and a row per part, a screen
 *      that is a step of the part round it not listed again inside it
 *      (source read: the panel imports the client store);
 *   5. the step bar is docked in one strip above the board, not floating
 *      over it (J, 2026-10-05), with Finish at the end (source read).
 *
 *   node tests/part-steps.mjs
 *
 * Covers: src/features/studio/boardStates.ts, src/features/studio/StatesTimeline.tsx, src/features/studio/Canvas.tsx, src/features/studio/StudioPage.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const B = await jiti.import(join(here, "..", "src", "features", "studio", "boardStates.ts"));
const F = await jiti.import(join(here, "..", "src", "features", "studio", "stateFrames.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const S = "body > main > aside > section";
const part = (id, hook, sel, box, extra = {}) => ({ id, pageId: "p", hooks: hook ? { "data-hook": hook } : {}, from: { selector: sel }, x: box[0], y: box[1], w: box[2], h: box[3], ...extra });
const hidden = (g) => ({ state: { group: `hidden:${g}`, option: 1 } });
/* A balance panel: a title, two lines, a note the page adds between them, a hidden confirm block inside; and, outside it, a wallet panel. */
const nodes = [
  part("wallet", "wallet-panel", "body > main > div > section", [0, 0, 200, 300]),
  part("wallet-t", "wallet-title", "body > main > div > section > h2", [10, 10, 180, 30]),
  part("panel", "balance-panel", S, [400, 0, 200, 300]),
  part("title", "balance-title", `${S} > h2`, [410, 10, 180, 30]),
  part("line1", "balance-wallet", `${S} > p:nth-of-type(1)`, [410, 50, 180, 20]),
  part("note", "balance-play-money", `${S} > p:nth-of-type(2)`, [410, 80, 180, 40], hidden("balance-play-money")),
  part("line2", "balance-escrow", `${S} > p:nth-of-type(3)`, [410, 80, 180, 20]),
  part("button", "balance-refresh", `${S} > button`, [410, 110, 180, 30]),
  part("confirm", "withdraw-confirm", `${S} > div`, [410, 260, 180, 30], hidden("withdraw-confirm")),
];
const screens = [
  { name: "first-visit", label: "connect a wallet", page: "web/index.html", shows: ["wallet-panel", "balance-panel", "balance-title", "balance-escrow", "balance-refresh"] },
  { name: "lobby", label: "play money", page: "web/index.html", shows: ["wallet-panel", "wallet-title", "balance-panel", "balance-title", "balance-wallet", "balance-play-money", "balance-escrow", "balance-refresh"] },
];
const fileOf = () => "web/index.html";
const frames = F.stateFrames(nodes);
const fr = frames.byFrame.get("panel");
check("the panel is a part with states: as it opens, then its play-money note", fr?.steps[0]?.key === "open" && fr.steps[1]?.key === "hidden:balance-play-money", J(fr?.steps.map((s) => s.key)));

/* 1. A screen kept to the part */
const scr = B.steppedParts(nodes, ["step:panel=screen:first-visit"], screens, fileOf, frames);
check("a screen kept to the part decides only the parts inside it", [...scr.decide.keys()].every((id) => !["wallet", "wallet-t", "panel"].includes(id)) && scr.decide.size > 0, J([...scr.decide]));
check("…what that screen draws inside it, and not what it does not", scr.decide.get("line2") === true && scr.decide.get("line1") === false && scr.decide.get("title") === true, J([...scr.decide]));
const shows = B.boardShows(["step:panel=screen:first-visit"], screens, () => "p", frames, scr.decide);
check("outside the part the page is as it opens: the wallet's title stays though the screen hides it", shows(nodes[1]) && shows(nodes[0]));
check("the part itself is not moved", !scr.places.has("panel") || (scr.places.get("panel").x === 400 && scr.places.get("panel").y === 0), J(scr.places.get("panel")));

/* 2. A face of a part that shows one at a time */
const tv = [
  part("box", "chart-tv-box", "body > main > div > div", [0, 0, 400, 160], { hooks: { "data-hook": "chart-tv-box", "data-state": "offline" } }),
  part("load", "chart-tv-loading", "body > main > div > div > div:nth-of-type(1)", [10, 10, 380, 120]),
  part("idle", "chart-tv-idle", "body > main > div > div > div:nth-of-type(2)", [10, 10, 380, 80], hidden("chart-tv-idle")),
];
const tvr = F.stateFrames(tv);
const one = B.steppedParts(tv, ["step:box=hidden:chart-tv-idle"], [], fileOf, tvr);
check("a face of a part that shows one at a time shows alone", one.decide.get("idle") === true && one.decide.get("load") === false && one.places.size === 0, J([...one.decide]));

/* 3. A face the page adds, in the part's flow */
const add = B.steppedParts(nodes, ["step:panel=hidden:balance-play-money"], screens, fileOf, frames);
check("a face the page adds shows with what the part opens with", add.decide.get("note") === true && add.decide.get("line1") === true && add.decide.get("line2") === true && add.decide.get("title") === true, J([...add.decide]));
check("a hidden block inside what it opens with stays hidden", add.decide.get("confirm") !== true, J(add.decide.get("confirm")));
const by = add.places.get("line2")?.y - 80;
check("the lines under the note move down by its height and the column's gap; the lines above stay", by >= 40 && by <= 60 && add.places.get("button")?.y === 110 + by && !add.places.has("line1") && !add.places.has("title"), J([...add.places]));
check("the part grows by as much, where it stands", J(add.places.get("panel")) === J({ x: 400, y: 0, w: 200, h: 300 + by }), J(add.places.get("panel")));
check("nothing outside the part is decided or moved", !add.decide.has("wallet") && !add.decide.has("wallet-t") && !add.places.has("wallet") && !add.places.has("wallet-t"));

/* 4. The page's states (the panel imports the client store, so its source is read) */
const tl = readFileSync(join(here, "..", "src", "features", "studio", "StatesTimeline.tsx"), "utf8");
check("the page's states: its screens, then a row per part, step 1 as it opens (source read)", /export function pageStates/.test(tl) && /\{ key: null, label: open\?\.label \?\? "as it opens"/.test(tl));
check("a screen that is a step of the part round it is not listed again inside it (source read)", /!\(s\.screen && above\.has\(s\.screen\)\)/.test(tl));
check("picking the whole page's state puts its parts back to follow it (source read)", /The page as a whole: its parts follow it/.test(tl));

/* 5. On the board */
const page = readFileSync(join(here, "..", "src", "features", "studio", "StudioPage.tsx"), "utf8");
check("the step bar is docked above the board, not over it, with Finish at the end (source read)", /\{design \? <StepBar \/> : null\}\s*<Workspace \/>/.test(page) && !/sticky bottom-3/.test(tl) && /data-step-finish/.test(tl) && /data-step-next/.test(tl));
check("the states in the shelf are plain cards, not shrunk pictures of the part (source read)", !/data-state-thumb/.test(tl) && !/moltenClass/.test(tl));

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
