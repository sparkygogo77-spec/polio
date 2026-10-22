#!/usr/bin/env node
/**
 * AN EDIT ON THE WHEEL IS AN EDIT TO THE SELECTION, PLATES TOO.
 *
 * With several parts picked, the wheel's colour, edge and font changed all
 * of them, but the plates (Options, Shape, Links, Priority) changed only the
 * part the wheel was opened on, and Behaviour copied that part's whole
 * options onto the rest: a ticker's speed set on a ticker and a slideshow
 * left the slideshow with the ticker's options and without its autoplay.
 * Pure, on the store, no page:
 *
 *   1. two card grids picked: columns = 2 on one sets it on both, and each
 *      keeps its own other options;
 *   2. a ticker and a slideshow picked: the ticker's speed changes the
 *      ticker; the slideshow keeps its autoplay and gets no speed;
 *   3. shape, link and priority reach every picked part; the words a part
 *      says are not sent through the selection, and the plates say so;
 *   4. one undo takes the whole change back;
 *   5. with one part picked, only that part changes.
 *
 *   node tests/wheel-selection-edits.mjs
 *
 * Covers: src/features/studio/radial/selectionEdit.ts, src/features/studio/radial/ring.tsx, src/features/studio/PlateEditors.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
await jiti.import("@/features/studio/board/store"); // the store door first: through jiti on Windows its create/builds/heldView cycle only forms when this loads first
const studio = join(here, "..", "src", "features", "studio");
const { applyToSelection, spreadEdit } = await jiti.import(join(studio, "radial", "selectionEdit.ts"));
const { useStudio } = await jiti.import(join(studio, "board", "store.ts"));

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const st = () => useStudio.getState();
const node = (id) => st().nodes.find((n) => n.id === id);
const add = (featureId, options) => {
  const before = new Set(st().nodes.map((n) => n.id));
  st().addNode(featureId, 0, 0);
  const id = st().nodes.find((n) => !before.has(n.id)).id;
  useStudio.setState({ nodes: st().nodes.map((n) => (n.id === id ? { ...n, options } : n)) });
  return id;
};
const pick = (ids) => useStudio.setState({ selection: ids });

/* 1 */
const gridA = add("card-grid", { columns: "3", card: "ruled" });
const gridB = add("card-grid", { columns: "4", card: "plain" });
pick([gridA, gridB]);
applyToSelection(node(gridA), { options: { ...node(gridA).options, columns: "2" } });
check("1. columns reach both grids", node(gridA).options.columns === "2" && node(gridB).options.columns === "2", J([node(gridA).options, node(gridB).options]));
check("1. each grid keeps its own card", node(gridA).options.card === "ruled" && node(gridB).options.card === "plain", J(node(gridB).options));

/* 2 */
const ticker = add("marquee", { speed: "slow" });
const slides = add("carousel", { autoplay: "on" });
pick([ticker, slides]);
applyToSelection(node(ticker), { options: { ...node(ticker).options, speed: "fast" } });
check("2. the ticker's speed changes", node(ticker).options.speed === "fast", J(node(ticker).options));
check("2. the slideshow keeps its autoplay, and gets no speed", J(node(slides).options) === J({ autoplay: "on" }), J(node(slides).options));
const taken = spreadEdit(node(ticker), { options: {} })(node(slides));
check("2. clearing the ticker's options leaves the slideshow's", J(taken.options) === J({ autoplay: "on" }), J(taken));

/* 3 + 4 */
pick([gridA, gridB]);
const labels = [node(gridA).label, node(gridB).label];
const was = J([node(gridA), node(gridB)].map((n) => [n.shape ?? null, n.link ?? null, n.priority]));
applyToSelection(node(gridA), { shape: "circle", link: { kind: "url", target: "https://example.com" }, priority: "idea" });
const after = [node(gridA), node(gridB)].map((n) => [n.shape, n.link?.target, n.priority]);
check("3. shape, link and priority reach both", J(after) === J([["circle", "https://example.com", "idea"], ["circle", "https://example.com", "idea"]]), J(after));
check("3. names are untouched by it", node(gridA).label === labels[0] && node(gridB).label === labels[1]);
st().undo();
check("4. one undo takes it all back", J([node(gridA), node(gridB)].map((n) => [n.shape ?? null, n.link ?? null, n.priority])) === was);

const plates = readFileSync(join(studio, "PlateEditors.tsx"), "utf8");
check("3. the plate's settings go through the selection (source read)",
  /spread\(\{ priority: v \}\)/.test(plates) && /spread\(\{ shape: /.test(plates) && /spread\(\{ link: null \}\)/.test(plates) && (plates.match(/spread\(\{ options: \{ \.\.\.node\.options/g) ?? []).length === 3);
check("3. its words stay on the one part, and say so (source read)",
  /update\(\{ label: e\.target\.value \}\)/.test(plates) && /update\(\{ prompt: e\.target\.value \}\)/.test(plates) && /update\(\{ data: e\.target\.value \}\)/.test(plates) && /this part only/.test(plates));
const ring = readFileSync(join(studio, "radial", "ring.tsx"), "utf8");
check("2. Behaviour goes through the selection (source read)", /onChange=\{\(id, value\) => update\(\{ options: \{ \.\.\.node\.options, \[id\]: value \} \}\)\}/.test(ring) && /const update = \(patch: Partial<StudioNode>\) => applyToSelection\(node, patch\)/.test(ring));

/* 5 */
pick([gridA]);
applyToSelection(node(gridA), { priority: "nice", options: { ...node(gridA).options, columns: "auto" } });
check("5. one part picked: only it changes", node(gridA).priority === "nice" && node(gridA).options.columns === "auto" && node(gridB).priority !== "nice" && node(gridB).options.columns === "2");

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
