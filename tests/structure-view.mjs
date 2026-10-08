#!/usr/bin/env node
/**
 * THE STRUCTURE VIEW: ONE OUTLINE PER PAGE, A MOVE MADE ONCE FOR EVERY STATE.
 *
 * J (2026-10-08): "I have to go through too many pages to simply reformat the
 * structure of pst." Pure, on PonsStars' play page in small:
 *
 *   1. the outline lists the page's regions and what each holds, by hook:
 *      the three columns side by side, the centre's panels one under
 *      another; nothing inside a panel;
 *   2. moving the match panel to just below the chart gives every part of
 *      the centre an order, and restacks the board there, carrying what is
 *      inside each moved part;
 *   3. the style layer writes the move once, keyed by hook alone (no panel
 *      or state in the selector), as an order token;
 *   4. a move made while one state is being edited is not kept as that
 *      state's: it holds in every state.
 *
 *   node tests/structure-view.mjs
 *
 * Covers: src/features/studio/states/structure.ts, src/features/studio/states/StructureView.tsx, src/features/studio/styleLayer.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src") } });
const studio = (f) => jiti.import(join(here, "..", "src", "features", "studio", f));
const S = await studio("states/structure.ts");
const L = await studio("styleLayer.ts");
const E = await studio("states/stateEdits.ts");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);

const LAY = "body > div";
const C = `${LAY} > main`;
const src = (hook, x, y, w, h) => ({ file: "web/index.html", hook: { attr: "data-hook", value: hook }, was: { box: { x, y, w, h }, words: "" } });
const node = (id, hook, sel, x, y, w, h, extra = {}) => ({ id, pageId: "play", featureId: "box", label: hook, x, y, w, h, hooks: { "data-hook": hook, ...(extra.panel ? { "data-panel": hook, "data-states": "off on" } : {}) }, from: { selector: sel }, source: src(hook, x, y, w, h) });
const nodes = [
  node("lay", "play-layout", LAY, 0, 0, 1200, 1000),
  node("side", "play-side-player", `${LAY} > aside:nth-of-type(1)`, 0, 0, 200, 600),
  node("card", "player-card", `${LAY} > aside:nth-of-type(1) > section`, 0, 0, 200, 300, { panel: true }),
  node("ctr", "play-center", C, 220, 0, 760, 1000),
  node("next", "next-step", `${C} > section:nth-of-type(1)`, 220, 0, 760, 60, { panel: true }),
  node("stage", "chart-stage", `${C} > section:nth-of-type(2)`, 220, 80, 760, 400),
  node("tv", "chart-tv", `${C} > section:nth-of-type(2) > div`, 220, 80, 760, 400, { panel: true }),
  node("queue", "queue-panel", `${C} > section:nth-of-type(3)`, 220, 500, 760, 200, { panel: true }),
  node("match", "match-panel", `${C} > section:nth-of-type(4)`, 220, 720, 760, 260, { panel: true }),
  node("mtitle", "match-title", `${C} > section:nth-of-type(4) > h2`, 230, 730, 200, 30),
  node("money", "play-side-money", `${LAY} > aside:nth-of-type(2)`, 1000, 0, 200, 600),
  node("bal", "balance-panel", `${LAY} > aside:nth-of-type(2) > section`, 1000, 0, 200, 300, { panel: true }),
];

/* 1. The outline. */
const out = S.structureOf(nodes, "play");
const lay = out[0];
const ctr = lay?.children.find((x) => x.hook === "play-center");
check("1a. one region at the top, its three columns side by side", out.length === 1 && lay.hook === "play-layout" && lay.axis === "across" && J(lay.children.map((x) => x.hook)) === J(["play-side-player", "play-center", "play-side-money"]), J(out.map((x) => [x.hook, x.axis])));
check("1b. the centre lists its parts one under another, in order", ctr?.axis === "down" && J(ctr.children.map((x) => x.hook)) === J(["next-step", "chart-stage", "queue-panel", "match-panel"]), J(ctr?.children.map((x) => x.hook)));
const match = ctr?.children.find((x) => x.hook === "match-panel");
check("1c. a panel is one item: nothing inside it is listed", match?.panel === true && match.children.length === 0);

/* 2. Move the match panel to just below the chart. */
const order = S.reorder(ctr.children, 3, 2);
check("2a. every part of the centre gets an order, the match panel third", J([...order]) === J([["next", 1], ["stage", 2], ["match", 3], ["queue", 4]]), J([...order]));
const moves = S.restack(nodes, ctr.children, "down", order);
check("2b. the board restacks the centre: match panel under the chart, the queue under it", moves.get("match")?.y === 500 && moves.get("queue")?.y === 780 && !moves.has("next") && !moves.has("stage"), J([...moves]));
check("2c. what is inside a moved part goes with it", moves.get("mtitle")?.y === 510 && moves.get("mtitle")?.x === 230);
const after = nodes.map((n) => ({ ...n, ...(order.has(n.id) ? { place: { order: order.get(n.id) } } : {}), ...(moves.get(n.id) ?? {}) }));
check("2d. read again, the outline has the new order", J(S.structureOf(after, "play")[0].children[1].children.map((x) => x.hook)) === J(["next-step", "chart-stage", "match-panel", "queue-panel"]));

/* 3. The style layer writes it once, by hook, as a token. */
const layer = L.buildLayer(after, null, { repo: "o/r", ref: "main", dir: "web/", files: [] }, { kit: true });
const rule = layer.rules.filter((r) => r.nodeId === "match");
check("3a. one rule for the match panel, keyed by its hook alone, with an order token", rule.length === 1 && rule[0].selector === '[data-hook="match-panel"]' && J(rule[0].declarations) === J(["--match-panel-order: 3", "order: var(--match-panel-order)"]), J(rule));
check("3b. no rule names a panel or a state, and nothing writes a place on the board", layer.rules.every((r) => !/data-state|data-panel/.test(r.selector)) && !/\b(top|left|translate|margin)\b/.test(layer.css), layer.css);
check("3c. only the centre's parts are written", J(layer.rules.map((r) => r.nodeId).sort()) === J(["match", "next", "queue", "stage"]));
const before = L.buildLayer(nodes, null, { repo: "o/r", ref: "main", dir: "web/", files: [] }, { kit: true });
check("3d. before the move the layer holds nothing", before.rules.length === 0, J(before.rules));

/* 4. Moved while one state is being edited: kept for every state. */
const key = E.stateEditKey("match-panel", "on");
const took = E.checkOut(nodes, key, ["match"]);
const back = E.checkIn(took.nodes.map((n) => (n.id === "match" ? { ...n, place: { order: 3 } } : n)), took.out);
const m = back.find((n) => n.id === "match");
check("4a. a move during a state edit stays the part's own, not the state's", J(m.place) === J({ order: 3 }) && !m.byState, J(m));

const ok = results.filter(Boolean).length;
console.log(`\n${ok}/${results.length} passed`);
process.exit(ok === results.length ? 0 : 1);
