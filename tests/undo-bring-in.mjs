#!/usr/bin/env node
/**
 * ONE UNDO TAKES A BRING-IN BACK WHOLE (audit, 2026-10-11; dissect #20).
 *
 * J brought a site in on a board drawn at Desktop 1440, captured at another
 * width, and pressed Ctrl+Z: his old parts came back, but drawn at the
 * imported site's width, with its parts still on the shelf under "From your
 * sites", and its learned record, stand-in, sweep mark and states kept. On
 * the real board store, the import landed as the importer lands it (the
 * spaces cleared, `landAsBrought`, the record, `bringIn`, all folded into
 * one step by `oneStepSince`):
 *
 *   1. one undo puts back the old parts and, with them, the frame width, the
 *      shelf and its catalogue, the learned record, the stand-in, the
 *      sweep's mark and the states shown;
 *   2. redo brings all of the import's back, and undo takes them away again;
 *   3. a jump through the history list (`travel`) does the same both ways;
 *   4. the undo of an ordinary edit leaves a width picked from the bar alone,
 *      and an undo of the import after it puts back the width before it;
 *   5. a site's parts sent back off the shelf come back with an undo;
 *   6. the importer still lands an import as one step (source read);
 *   7. Clear everything is kept the same way: one undo, redo or step in the
 *      history puts back or takes again the parts, the shelf, the timeline,
 *      the import record and the edit branch.
 *
 *   node tests/undo-bring-in.mjs
 *
 * Covers: src/features/studio/board/store/history.ts, src/features/studio/board/store/create.ts, src/features/studio/board/store/threads.ts, src/features/studio/board/store/view.ts, src/features/studio/board/store/state.ts
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const studio = join(here, "..", "src", "features", "studio");
const { useStudio } = await jiti.import(join(studio, "board", "store.ts"));
const { landAsBrought } = await jiti.import(join(studio, "bring-in", "fromasite", "bring.tsx"));
const { allCategories, allFeatures } = await jiti.import(join(studio, "shelf", "catalog.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const st = useStudio.getState;
const ids = () => st().nodes.map((n) => n.id).join();
const part = (id) => ({ id, featureId: "text", label: id, pageId: "page_home", x: 0, y: 0, w: 200, h: 40, prompt: "", content: id });
const onShelf = () => allCategories().some((c) => c.id === "repo_pst") || allFeatures().some((f) => f.category === "repo_pst");

/* His board before: Desktop 1440, two parts, one state shown, a learned record and a stand-in of its own, swept. */
const home = st().pages[0];
const learn0 = { ...st().learn, supported: false };
const standIn0 = { reads: [], streams: [] };
useStudio.setState({ pages: [home], nodes: [part("his_1"), part("his_2")], activePageId: home.id, frameWidth: 1440, statesOn: ["menu-open"], learn: learn0, standIn: standIn0, swept: 7, brought: [], broughtParts: [], past: [], future: [] });
const before = { ids: ids(), frameWidth: 1440, statesOn: J(["menu-open"]) };

/* The import, as the importer runs it (FromASite.tsx `copySite`). */
const repo = { id: "repo_pst", label: "PST", hue: 200, from: "owner/pst", page: "index.html", at: 1 };
const shelfParts = [{ id: "repo_pst:1", categoryId: "repo_pst", label: "Hero", basedOn: "text", blurb: "", w: 200, h: 40, content: "Hero", options: {}, colour: null, font: null, prompt: "" }];
const bring = () => {
  const mark = st().historyMark();
  st().removeSpaces(st().spaces.map((sp) => sp.id));
  landAsBrought({ pages: [home], nodes: [part("pst_1"), part("pst_2"), part("pst_3")], frameWidth: 390, capturer: { learn: true } });
  useStudio.setState({ taken: null });
  st().bringIn(repo, shelfParts);
  st().oneStepSince(mark);
};
bring();
const brought = { ids: ids(), frameWidth: st().frameWidth, learn: st().learn, standIn: st().standIn, swept: st().swept, statesOn: J(st().statesOn) };
check("0. the import landed: its parts, its width, its parts on the shelf", brought.ids === "pst_1,pst_2,pst_3" && brought.frameWidth === 390 && onShelf() && st().learn !== learn0 && st().standIn === null, J(brought));

/* 1 */
const depth = st().past.length;
st().undo();
check("1. one undo: his parts are back", ids() === before.ids && st().past.length === depth - 1, ids());
check("1. …at his width, not the imported site's", st().frameWidth === 1440, String(st().frameWidth));
check("1. …and the site's parts are off the shelf", st().brought.length === 0 && st().broughtParts.length === 0 && !onShelf());
check("1. …his learned record, stand-in, sweep mark and states as they were", st().learn === learn0 && st().standIn === standIn0 && st().swept === 7 && J(st().statesOn) === before.statesOn, `${st().swept} ${J(st().statesOn)}`);

/* 2 */
st().redo();
check("2. redo: the import is back, all of it", ids() === brought.ids && st().frameWidth === 390 && onShelf() && st().learn === brought.learn && st().standIn === brought.standIn && st().swept === brought.swept && J(st().statesOn) === brought.statesOn, `${ids()} ${st().frameWidth}`);
st().undo();
check("2. …and undo takes it away again", ids() === before.ids && st().frameWidth === 1440 && !onShelf() && st().learn === learn0 && st().swept === 7);

/* 3 */
st().redo();
st().updateNode("pst_1", { content: "edited" });
st().travel(-2);
check("3. back two steps from the history list: his board, width and shelf", ids() === before.ids && st().frameWidth === 1440 && !onShelf() && st().standIn === standIn0 && J(st().statesOn) === before.statesOn, `${ids()} ${st().frameWidth}`);
st().travel(2);
check("3. …and forward two: the import and the edit on it", st().nodes.find((n) => n.id === "pst_1")?.content === "edited" && st().frameWidth === 390 && onShelf() && st().learn === brought.learn, `${st().frameWidth}`);

/* 4 */
st().setFrameWidth(834);
st().updateNode("pst_2", { content: "again" });
st().undo();
check("4. undoing an ordinary edit leaves the width he picked from the bar", st().frameWidth === 834 && st().nodes.find((n) => n.id === "pst_2")?.content === "pst_2", String(st().frameWidth));
st().undo();
st().undo();
check("4. undoing the import after it puts back the width before the import", ids() === before.ids && st().frameWidth === 1440, `${ids()} ${st().frameWidth}`);
st().redo();
check("4. …and redoing it, the width he had picked on it", st().frameWidth === 834 && onShelf(), String(st().frameWidth));

/* 5 */
st().sendBack("repo_pst");
check("5. a site's parts sent back off the shelf are gone from it", !onShelf() && st().brought.length === 0);
st().undo();
check("5. …and come back with an undo", onShelf() && st().brought.some((r) => r.id === "repo_pst") && st().broughtParts.length === 1);

/* 6 */
const from = readFileSync(join(studio, "bring-in", "fromasite", "FromASite.tsx"), "utf8");
const copySite = from.slice(from.indexOf("const copySite"), from.indexOf("keepLastBring()", from.indexOf("const copySite")));
check("6. the importer still lands a repository's copy as one step", /historyMark\(\)/.test(copySite) && /landAsBrought\(copy\.document\)/.test(copySite) && /oneStepSince\(mark\)/.test(copySite), copySite.length ? "" : "copySite not found");
const files = from.slice(from.indexOf("landAsBrought({"), from.indexOf("keepLastBring()", from.indexOf("landAsBrought({")));
check("6. …and a site's files the same way, its parts onto the shelf inside that step", files.includes(".bringIn(") && files.indexOf(".bringIn(") < files.indexOf("oneStepSince(mark)"));

/* 7. Clear everything keeps what it takes beside the document the same way. */
const thread = { id: "th_seen", parentId: null, at: 1, mode: "start", ask: "", answer: "the site before the first change", changes: [], doc: null, state: "done", pieces: [] };
useStudio.setState({ threads: [thread], liveThreadId: thread.id, trail: [{ id: "tr_1" }], siteBranch: "edit/pst-2026-10-11", swept: 3 });
const full = { ids: ids(), threads: st().threads, trail: st().trail, learn: st().learn, standIn: st().standIn, brought: st().brought, broughtParts: st().broughtParts, siteBranch: st().siteBranch, frameWidth: st().frameWidth };
const all = () => ids() === full.ids && st().threads === full.threads && st().liveThreadId === thread.id && st().trail === full.trail && st().learn === full.learn && st().standIn === full.standIn && st().brought === full.brought && st().broughtParts === full.broughtParts && st().siteBranch === full.siteBranch && st().swept === 3 && onShelf();
const none = () => !st().nodes.length && !st().threads.length && !st().trail.length && !st().brought.length && !st().broughtParts.length && st().siteBranch === null && st().swept === undefined && !onShelf();
st().resetAll();
check("7. Clear everything takes the parts, the shelf, the timeline, the import record and the branch", none(), `${ids()} ${st().threads.length} ${st().brought.length}`);
st().undo();
check("7. …one undo puts every one of them back", all(), `${ids()} ${st().threads.length} ${st().brought.length} ${st().siteBranch}`);
check("7. …and leaves the frame width alone", st().frameWidth === full.frameWidth, String(st().frameWidth));
st().redo();
check("7. …redo clears them all again", none());
st().travel(-1);
check("7. …and a step back in the history list puts them back too", all());

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
