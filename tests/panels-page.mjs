#!/usr/bin/env node
/**
 * THE PANELS PAGE: EVERY DATA PANEL, ITS STATES, AND ONLY WHAT EACH STATE SHOWS.
 *
 * J (2026-10-06), checking #57 on a fresh PonsStars import: the panels
 * library found 3 of about 8 panels, and balance-panel drew its hidden help
 * text and deposit confirmation over its contents. Pure, on a small page any
 * site could have:
 *
 *   1. a panel is a hooked block of three or more hooked parts that changes
 *      between screens; one that never changes is not listed, nor the page's
 *      frame; a side column whose panels take turns is not one, its panels are;
 *   2. a panel's states are the sets of parts it draws; screens drawing the
 *      same parts with other words (won, lost) are samples of one state;
 *   3. a state draws only what is visible in it: nothing inside a shut
 *      <details>, nothing inside a hidden block;
 *   4. a block whose script swaps faces (loading, idle, result) has them as
 *      states even with no screen captured;
 *   5. "See states" finds the panel round any part inside it.
 *
 *   node tests/panels-page.mjs
 *
 * Covers: src/features/studio/states/panels.ts, src/features/studio/states/PanelsPage.tsx
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const P = await jiti.import(join(here, "..", "src", "features", "studio", "states", "panels.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const M = "body > main";
const SIDE = "body > aside";
const n = (id, hook, sel, box, extra = {}) => ({ id, pageId: "p", hooks: hook ? { "data-hook": hook } : {}, from: { selector: sel }, x: box[0], y: box[1], w: box[2], h: box[3], ...extra });
const hid = (g) => ({ state: { group: `hidden:${g}`, option: 1 } });
const BAL = `${SIDE} > section:nth-of-type(1)`;
const RES = `${M} > section:nth-of-type(2)`;
const nodes = [
  n("main", "app", M, [0, 0, 1200, 900]),
  n("side", "side", SIDE, [1200, 0, 300, 900]),
  /* A panel that never changes. */
  n("nav", "nav", `${M} > nav`, [0, 0, 1200, 40]),
  n("nav-a", "nav-a", `${M} > nav > a:nth-of-type(1)`, [0, 0, 100, 40]),
  n("nav-b", "nav-b", `${M} > nav > a:nth-of-type(2)`, [100, 0, 100, 40]),
  n("nav-c", "nav-c", `${M} > nav > a:nth-of-type(3)`, [200, 0, 100, 40]),
  /* The balance panel: a "?" help box, shut, and a hidden deposit confirmation. */
  n("bal", "balance-panel", BAL, [1210, 10, 280, 400]),
  n("bal-t", "balance-title", `${BAL} > h2`, [1220, 20, 200, 30]),
  n("bal-line", "balance-line", `${BAL} > p`, [1220, 60, 260, 30], { content: "0 SOL" }),
  n("help", "balance-help", `${BAL} > details`, [1220, 100, 260, 30]),
  n("help-s", null, `${BAL} > details > summary`, [1220, 100, 30, 30]),
  n("help-t", "balance-help-text", `${BAL} > details > p`, [1220, 100, 260, 200]),
  n("confirm", "deposit-confirm", `${BAL} > div`, [1220, 140, 260, 120], hid("deposit-confirm")),
  n("confirm-l", null, `${BAL} > div > p`, [1220, 150, 260, 30]),
  n("confirm-b", "deposit-ok", `${BAL} > div > button`, [1220, 190, 100, 40]),
  n("deposit", "deposit-panel", `${BAL} > form`, [1220, 140, 260, 120]),
  n("deposit-t", "deposit-title", `${BAL} > form > h3`, [1220, 140, 260, 30]),
  /* The result panel: shown at the end, saying won, lost or draw, a draw adding its rematch offer. */
  n("res", "result-panel", RES, [10, 500, 900, 300], hid("result-panel")),
  n("res-t", "result-title", `${RES} > h2`, [20, 510, 200, 30], hid("result-panel")),
  n("res-h", "result-headline", `${RES} > p`, [20, 550, 600, 40], { content: "You won", ...hid("result-panel") }),
  n("rematch", "rematch-panel", `${RES} > div`, [20, 600, 600, 100], hid("rematch-panel")),
  n("rematch-y", "rematch-yes", `${RES} > div > button:nth-of-type(1)`, [20, 610, 100, 40], hid("rematch-panel")),
  n("rematch-n", "rematch-no", `${RES} > div > button:nth-of-type(2)`, [130, 610, 100, 40], hid("rematch-panel")),
  n("rematch-l", "rematch-line", `${RES} > div > p`, [20, 660, 300, 30], hid("rematch-panel")),
  /* The TV box: faces its script swaps, no screen captured for it. */
  n("tv", "tv-box", `${M} > div`, [10, 100, 400, 200], { hooks: { "data-hook": "tv-box", "data-state": "loading" } }),
  n("tv-load", "tv-loading", `${M} > div > div:nth-of-type(1)`, [20, 110, 380, 100]),
  n("tv-load-t", "tv-loading-title", `${M} > div > div:nth-of-type(1) > p`, [20, 110, 380, 30], { content: "Tuning in" }),
  n("tv-idle", "tv-idle", `${M} > div > div:nth-of-type(2)`, [20, 110, 380, 100], hid("tv-idle")),
  n("tv-idle-t", "tv-idle-title", `${M} > div > div:nth-of-type(2) > p`, [20, 110, 380, 30], { content: "Find a match", ...hid("tv-idle") }),
];
const base = ["app", "side", "nav", "nav-a", "nav-b", "nav-c", "balance-panel", "balance-title", "balance-line", "balance-help", "deposit-panel", "deposit-title", "tv-box", "tv-loading", "tv-loading-title"];
const res = ["result-panel", "result-title", "result-headline"];
const scr = (name, step, shows, texts = {}) => ({ name, step, label: name, page: "", shows, texts, boxes: {} });
const screens = [
  scr("lobby", "between matches", base, { "balance-line": "1 SOL" }),
  scr("confirm", "deposit", [...base.filter((h) => h !== "deposit-panel" && h !== "deposit-title"), "deposit-confirm", "deposit-ok"], { "balance-line": "1 SOL" }),
  scr("won", "you won", [...base, ...res], { "result-headline": "You won" }),
  scr("lost", "you lost", [...base, ...res], { "result-headline": "You lost" }),
  scr("draw", "draw", [...base, ...res, "rematch-panel", "rematch-yes", "rematch-no", "rematch-line"], { "result-headline": "Draw" }),
];
const panels = P.pagePanels(nodes, "p", screens);
const hooks = panels.map((p) => p.hook);
check("1. the panels that change are listed, top to bottom, one inside another its own", J(hooks) === J(["balance-panel", "tv-box", "result-panel", "rematch-panel"]), J(hooks));
check("1. a block that never changes, and the page's frame, are not panels", !hooks.includes("nav") && !hooks.includes("app") && !hooks.includes("side"));

const result = panels.find((p) => p.hook === "result-panel");
check("2. won and lost are samples of one state; the draw's rematch offer is its own state", J(result.states.map((s) => [s.label, s.samples.map((x) => x.label)])) === J([["you won", ["you won", "you lost"]], ["draw", ["draw"]]]), J(result.states.map((s) => [s.label, s.samples.map((x) => x.label)])));
const bal = panels.find((p) => p.hook === "balance-panel");
check("2. the balance panel: as it opens (the lobby and the result its samples), then the deposit confirmation", J(bal.states.map((s) => [s.key, s.samples.map((x) => x.label)])) === J([["open", ["as the page opens", "between matches", "you won"]], ["screen:confirm", ["deposit"]]]), J(bal.states.map((s) => [s.key, s.samples.map((x) => x.label)])));

const drawn = (id, screen) => P.panelDrawing(nodes, id, screen).placed.map((x) => x.node.id);
const opens = drawn("bal", null);
check("3. as it opens, the help text in its shut <details> and the hidden confirmation are not drawn", !opens.includes("help-t") && !opens.includes("confirm") && !opens.includes("confirm-l") && !opens.includes("confirm-b") && opens.includes("help-s") && opens.includes("deposit-t"), J(opens));
const conf = drawn("bal", screens[1]);
check("3. in the confirmation, it is drawn with its unhooked line, and the deposit form is not", conf.includes("confirm") && conf.includes("confirm-l") && conf.includes("confirm-b") && !conf.includes("deposit") && !conf.includes("help-t"), J(conf));
check("3. a screen's words are drawn: the lobby says 1 SOL", P.panelDrawing(nodes, "bal", screens[0]).placed.find((x) => x.node.id === "bal-line")?.node.content === "1 SOL");
const won = drawn("res", screens[2]);
check("3. a panel the page hides is drawn in its own state, without the rematch offer it does not show", won.includes("res-h") && !won.includes("rematch") && !won.includes("rematch-y"), J(won));

const tv = panels.find((p) => p.hook === "tv-box");
check("4. a block whose script swaps faces has them as states with no screen", J(tv.states.map((s) => s.label)) === J(["As the page opens", "idle"]), J(tv.states.map((s) => [s.label, s.samples.map((x) => x.label)])));
const idle = drawn("tv", tv.states[1].samples[0].screen);
check("4. its idle face draws idle alone", idle.includes("tv-idle-t") && !idle.includes("tv-load-t"), J(idle));

const PP = await jiti.import(join(here, "..", "src", "features", "studio", "states", "PanelsPage.tsx"));
check("5. See states finds the panel round a part inside it", PP.panelOf(nodes, panels, "confirm-b")?.hook === "balance-panel" && PP.panelOf(nodes, panels, "res-h")?.hook === "result-panel" && PP.panelOf(nodes, panels, "rematch-y")?.hook === "rematch-panel" && PP.panelOf(nodes, panels, "nav-a") === null);

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
