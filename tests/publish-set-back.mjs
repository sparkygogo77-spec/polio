#!/usr/bin/env node
/**
 * A PART SET BACK TO HOW IT CAME IN LEAVES THE CODE'S STYLE LAYER ON THE NEXT PUBLISH.
 *
 * Audit 2026-10-11 (kit-revert-never-leaves-layer, dissect #15): on a
 * builder-ready repository (PonsStars), J made balance-note red and
 * published, then set it back to how it came in and published again. With
 * nothing else changed, Publish said "Nothing to publish: the code already
 * has this design"; with other parts still restyled it sent nothing ("There
 * is nothing to send"). The merge only replaced a block the round wrote
 * again, so the red block stayed in web/style-layer.css and the live site
 * stayed red. Now a merged Publish keeps the blocks it wrote
 * (`styleSource.sentBlocks`) and the next send takes out the ones the board
 * no longer writes, keeping what the layer held when the board came in; and
 * an empty layer after a Publish is still something to publish
 * (`layerEmpty`), on any site from code. GitHub and the kit's check are
 * stand-ins here.
 *
 *   node tests/publish-set-back.mjs
 *
 * Covers: src/features/studio/styleLayerRun.ts, src/features/studio/send-out/codePublish.ts, src/features/studio/codeSend.ts, src/features/studio/CodeSiteButtons.tsx, src/features/studio/send-out/styleLayer.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const R = await jiti.import(join(here, "..", "src", "features", "studio", "styleLayerRun.ts"));
const L = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "styleLayer.ts"));
const C = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "codePublish.ts"));
const src = (...p) => readFileSync(join(here, "..", "src", "features", "studio", ...p), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* A builder-ready repository on main, GitHub stood in over it. Its layer already holds queue-join's green from an earlier round, which the board came in with. */
const LAYER = "web/style-layer.css";
const PAGE = '<!doctype html><html><head><link rel="stylesheet" href="style-layer.css"></head><body><p data-hook="balance-note">Balance</p><button data-hook="next-step">Next</button><p data-hook="queue-join">Join</p></body></html>';
const HEAD = "/*\n * Style layer for j/site (main), from the Builder, 2026-10-04.\n */\n";
const repo = {
  "builder.json": JSON.stringify({ kit: "1", pages: [{ file: "web/index.html" }], hooks: "web/hooks.json", tokens: "web/tokens.css", styleLayer: LAYER }),
  "web/index.html": PAGE,
  "web/hooks.json": "{}",
  "web/tokens.css": ":root { --gap: 4px; }",
  [LAYER]: `${HEAD}\n/* From the Builder, 2026-10-04: this round's rules, after the ones already here, so they win. */\n[data-hook="queue-join"] {\n  --queue-join-color: #00aa00;\n  color: var(--queue-join-color);\n}\n`,
};
const b64 = (s) => Buffer.from(s, "utf8").toString("base64");
const standOver = (files) => async (url) => {
  const p = new URL(url).pathname.replace("/repos/j/site", "");
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status });
  if (p === "") return j({ default_branch: "main" });
  if (p.startsWith("/contents/")) { const f = decodeURIComponent(p.slice(10)); return f in files ? j({ content: b64(files[f]) }) : j({ message: "Not Found" }, 404); }
  if (p.startsWith("/git/trees/")) return j({ tree: Object.keys(files).map((path) => ({ path, type: "blob", sha: encodeURIComponent(path) })) });
  if (p.startsWith("/git/blobs/")) return j({ content: b64(files[decodeURIComponent(p.slice(11))]) });
  return j({ message: "Not Found" }, 404);
};
const kitMap = async () => ({ problems: [], made: {} });

/* The board as it came in: three parts, each measured as it landed (`baselineAsLanded`); queue-join already green from the layer. */
const part = (id, hook, colour, y) => ({ id, pageId: "p", featureId: "text", x: 0, y, w: 200, h: 24, content: hook, colour, source: { file: "web/index.html", hook: { attr: "data-hook", value: hook }, was: {} } });
const landed = L.baselineAsLanded([part("n1", "balance-note", { text: "#e5e7eb" }, 0), part("n2", "next-step", { bg: "#ff7a00", text: "#111111" }, 40), part("n3", "queue-join", { text: "#00aa00" }, 80)]);
const hooks = ["balance-note", "next-step", "queue-join"].map((value, i) => ({ attr: "data-hook", value, line: i + 1, imported: true }));
let source = { repo: "j/site", ref: "main", dir: "web/", files: [{ file: "web/index.html", pageId: "p", hooks, vars: [] }], sent: null };
const restyle = (nodes, id, colour) => nodes.map((n) => (n.id === id ? { ...n, colour: { ...n.colour, ...colour } } : n));
const setBack = (nodes, id) => nodes.map((n) => (n.id === id ? landed.find((x) => x.id === id) : n));
const prepare = (nodes, when, files = repo) => R.prepareLayer(nodes, null, source, "STANDIN_TOKEN", { fetch: standOver(files), when, kitMap });
const layerOut = (p) => (p.ok ? p.files.find((f) => f.path === LAYER)?.content ?? null : null);
/* Publish, merged: the code holds the file, and the board keeps what it published, as CodeSiteButtons does with sendDesign's `print` and `blocks`. */
const merge = (p) => { const css = layerOut(p); if (css !== null) repo[LAYER] = css; source = { ...source, sent: C.layerPrint(p.layer.css), sentBlocks: R.layerBlocks(p.layer.css) }; };
/* What the toolbar's Publish reads before it goes on. */
const standing = (p) => { const print = C.layerPrint(p.layer.css); const empty = C.layerEmpty(p.layer, print, source.sent); return { empty, pending: C.codeStatus(source, "c1", print, empty).pending }; };
const has = (css, hook) => new RegExp(`\\[data-hook="${hook}"\\] \\{`).test(css ?? "");
/* What a layer file holds, in one line, for the report. */
const said = (p) => (!p.ok ? p.says : layerOut(p) === null ? "no layer file" : R.topBlocks(layerOut(p)).map((b) => b.selector).join(", ") || "no rule");

/* 0. A board that never published takes nothing out. */
const quiet = await prepare(landed, "2026-10-11");
check("a board as it came in, never published: nothing to publish, and the layer left as it is", quiet.ok && layerOut(quiet) === null && standing(quiet).empty === true, said(quiet));

/* 1. balance-note red and next-step blue, published and merged. */
let board = restyle(restyle(landed, "n1", { text: "#ff0000" }), "n2", { bg: "#2563eb" });
const one = await prepare(board, "2026-10-11");
check("the first Publish writes both parts after the layer's earlier round", has(layerOut(one), "balance-note") && has(layerOut(one), "next-step") && has(layerOut(one), "queue-join"), said(one));
merge(one);
check("…and the board keeps the blocks it wrote", JSON.stringify(source.sentBlocks) === JSON.stringify(['[data-hook="balance-note"]', '[data-hook="next-step"]']), JSON.stringify(source.sentBlocks));
check("the same design sent again changes nothing", layerOut(await prepare(board, "2026-10-12")) === null);

/* 2. balance-note set back, next-step still blue: this sent nothing before. */
board = setBack(board, "n1");
const two = await prepare(board, "2026-10-12");
check("with balance-note set back, Publish is still pending", standing(two).pending === true && standing(two).empty === false);
check("the layer goes out without balance-note's red", layerOut(two) !== null && !has(layerOut(two), "balance-note") && !/#ff0000/.test(layerOut(two)), said(two));
check("…with next-step's blue kept once, and the earlier round's queue-join kept", (layerOut(two)?.match(/\[data-hook="next-step"\] \{/g) ?? []).length === 1 && has(layerOut(two), "queue-join"));
merge(two);

/* 3. next-step set back too: the board holds nothing, and Publish said the code already had this design. */
board = setBack(board, "n2");
const three = await prepare(board, "2026-10-13");
check("with every part set back, the board's layer is empty", three.ok && three.layer.rules.length === 0 && three.layer.vars.length === 0);
check("…yet it is not 'nothing to publish': the code still has next-step blue", standing(three).empty === false && standing(three).pending === true);
check("…and the layer goes out with next-step's rule taken out", layerOut(three) !== null && !has(layerOut(three), "next-step") && !has(layerOut(three), "balance-note"), said(three));
check("what the layer held when the board came in stays: queue-join, at its landed look on the board, keeps its green", has(layerOut(three), "queue-join") && /--queue-join-color: #00aa00/.test(layerOut(three) ?? ""));
check("a round's note left with no rule under it goes too", layerOut(three) !== null && !/2026-10-11/.test(layerOut(three)));
merge(three);
check("once that is merged there is nothing left to publish", standing(three).empty === true && standing(three).pending === false && JSON.stringify(source.sentBlocks) === "[]");
check("and the next send leaves the file as it is", layerOut(await prepare(board, "2026-10-14")) === null);
check("a cut that finds none of its blocks leaves the layer byte for byte", R.dropBlocks(repo[LAYER], ['[data-hook="nowhere"]']) === repo[LAYER]);

/* 4. A site without builder.json writes its whole layer: set back, it goes out without the rule, now that Publish does not stop first. */
const plain = { "web/index.html": PAGE, [LAYER]: `${HEAD}\n[data-hook="balance-note"] {\n  color: #ff0000;\n}\n` };
source = { ...source, sent: C.layerPrint(`${HEAD}\n[data-hook="balance-note"] {\n  color: #ff0000;\n}\n`), sentBlocks: ['[data-hook="balance-note"]'] };
const flat = await prepare(landed, "2026-10-14", plain);
check("a site from code without builder.json, set back after a Publish: pending, and its layer written without the red", flat.ok && !flat.kit && standing(flat).empty === false && layerOut(flat) !== null && !has(layerOut(flat), "balance-note"), said(flat));

/* 5. The Builder's wiring, read. */
const buttons = src("CodeSiteButtons.tsx"), send = src("codeSend.ts"), panel = src("StyleLayerPanel.tsx");
check("Publish asks layerEmpty, with the print it last published, before it says there is nothing to publish", /const empty = layerEmpty\(layer, print, source\.sent\);/.test(buttons) && !/const empty = !layer\.rules\.length && !layer\.vars\.length;/.test(buttons));
check("sendDesign hands back the blocks it sent", /blocks: layerBlocks\(prepared\.layer\.css\)/.test(send));
const kept = buttons.indexOf("sent: sent.print, sentBlocks: sent.blocks");
check("Publish keeps them with the print, and only once the merge is done", kept > buttons.indexOf("await mergePull(") && buttons.indexOf("await mergePull(") > 0);
check("the repo menu's pull request, merged later or never, keeps nothing", !/sentBlocks/.test(panel));
check("the Publish dialog says what comes out", /from the last Publish taken out/.test(buttons) && /source\.sentBlocks \?\? \[\]\)\.filter\(\(s\) => !now\.has\(s\)\)/.test(buttons));

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
