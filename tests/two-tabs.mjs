#!/usr/bin/env node
/**
 * A SECOND BUILDER TAB NEVER SAVES OVER THE OTHER TAB'S WORK (audit, 2026-10-11).
 *
 * J had the Builder open in a tab from the morning, opened it again in a
 * second, worked there an hour, went back to the first and clicked another
 * page: the first tab saved its morning board over the hour, and nothing said
 * so. A preview opened earlier kept showing the old site. Now every document
 * saved carries a stamp naming the tab that wrote it (`docStore.ts`), and a tab
 * behind another's save writes nothing over it. On the real board store, with
 * a stand-in localStorage and the other tab played by its writes and the
 * storage event a browser sends:
 *
 *   1. the stamp: the last key of a document (which still opens `{"state"`), on
 *      its pointer and its packed form, replaced rather than stacked, and on
 *      nothing that is not a document; a write localStorage refuses is never
 *      taken for another tab's;
 *   2. the document saved again unchanged after it loads keeps the stamp it was
 *      read with, so opening a second tab is not newer work for the first;
 *   3. a change in the old tab before it has caught up is not written: the
 *      other tab's work stays saved, and the tab says so;
 *   4. "Load the newer work" takes it and the next click is saved on top of it;
 *      "Keep this tab's" saves this tab's board over it;
 *   5. a tab with nothing unsaved takes the newer work when it is shown again,
 *      not on every write while out of sight, and keeps the other tab's running
 *      update running; on screen (a preview beside the board) it takes it once
 *      the other tab has been quiet a moment;
 *   6. another tab opening a different site: nothing taken, nothing written,
 *      nothing kept over it, and the tab says to reload; opening a site in this
 *      tab clears that;
 *   7. the published page (/site) neither takes nor writes;
 *   8. left on a site another tab moved off, the tab writes no site list,
 *      and a site picked from its list (not the reload it was asked for)
 *      first catches up: the other tab's work goes into its own site's slot,
 *      never into the one this tab had open;
 *   9. wiring (source read): the preview and the board both hear the other
 *      tabs, and the save line shows both cases with their buttons.
 *
 *   node tests/two-tabs.mjs
 *
 * Covers: src/features/studio/docStore.ts, src/features/studio/board/store/create.ts, src/features/studio/board/store/load.ts, src/features/builds/store.ts, src/features/studio/SaveLine.tsx, src/features/studio/live/PreviewPage.tsx
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const studio = join(here, "..", "src", "features", "studio");
const D = await jiti.import(join(studio, "docStore.ts"));
const S = await jiti.import(join(studio, "board", "store.ts"));
const { pen } = await jiti.import(join(studio, "board", "store", "history.ts"));
const read = (f) => readFileSync(join(here, "..", f), "utf8");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/* The browser, stood in for: one localStorage, a window that hears storage events, a document that is shown or hidden. */
class Mem {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  key(i) { return [...this.m.keys()][i] ?? null; }
  get length() { return this.m.size; }
}
const ls = new Mem();
globalThis.localStorage = ls;
const win = new EventTarget();
globalThis.window = win;
const doc = new EventTarget();
doc.hidden = false;
globalThis.document = doc;
const show = () => { doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange")); };
const hide = () => { doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange")); };

const LIVE = "builder.studio";
const st = S.useStudio.getState;
const stored = () => JSON.parse(ls.getItem(LIVE));
const storedStamp = () => D.stampOf(ls.getItem(LIVE));
const page = (n, name) => ({ id: `page_${n}`, name, path: n === "home" ? "/" : `/${n}`, prompt: "", scroll: "inherit" });
const part = (id, pageId = "page_home") => ({ id, label: id, pageId, x: 0, y: 0, w: 10, h: 10, prompt: "" });
const PAGES = [page("home", "Home"), page("two", "Two"), page("three", "Three"), page("four", "Four"), page("five", "Five")];
/* The other tab saves: its document, stamped as its own write, then the storage event every other tab hears. */
let theirs = 0;
const otherSaves = (state, moved = false) => {
  ls.setItem(LIVE, D.stamped(JSON.stringify({ state, version: 0 }), `othertab:${++theirs}${moved ? ":moved" : ""}`));
  const e = new Event("storage");
  Object.defineProperty(e, "key", { value: LIVE });
  win.dispatchEvent(e);
};

/* 1 */
const env = JSON.stringify({ state: { pages: [], nodes: [] }, version: 0 });
const a = D.stamped(env, "t1:1");
check("1. a document carries its stamp as its last key, and still opens as one", a.startsWith('{"state"') && JSON.parse(a).by === "t1:1" && D.stampOf(a) === "t1:1", a);
const b = D.stamped(a, "t2:5");
check("1. a new stamp replaces the old one rather than stacking", D.stampOf(b) === "t2:5" && (b.match(/"by":/g) ?? []).length === 1, b);
check("1. …and none takes it off", D.stamped(b, null) === env);
check("1. anything that is not a document is left as it is", D.stamped('{"held":[]}', "t1:1") === '{"held":[]}');
const big = D.stamped(JSON.stringify({ state: { pages: [page("home", "Home")], nodes: Array.from({ length: 40 }, (_, i) => ({ ...part(`n${i}`), from: { selector: "body > div:nth-of-type(2) > span" } })) }, version: 0 }), "t3:2");
const ptr = D.mirrorText(big, 200);
check("1. the pointer left for a document too big for the mirror carries its stamp", ptr.kind === "pointer" && D.stampOf(ptr.text) === "t3:2" && D.pointerOf(ptr.text)?.by === "t3:2", ptr.text);
check("1. so does its packed form", D.stampOf(D.packDocText(big)) === "t3:2");
check("1. a document with no stamp has none", D.stampOf(env) === null && D.stampOf(null) === null);
check("1. a document moved in from another key (a switch of site) says so", D.movedIn("t1:3:moved") && !D.movedIn("t1:3") && !D.movedIn(null));
{
  ls.setItem("t.full", D.stamped(env, "x:1"));
  D.holdStamp("t.full", ls.getItem("t.full"));
  ls.setItem = () => { throw new Error("QuotaExceededError"); };
  D.writeDoc("t.full", env);
  delete ls.setItem;
  check("1. a write localStorage would not take is never read as another tab's", D.behind("t.full") === false && D.stampOf(ls.getItem("t.full")) === "x:1");
}

/* 2. The board as the morning tab saved it: two pages, one part. */
ls.setItem(LIVE, D.stamped(JSON.stringify({ state: { pages: PAGES.slice(0, 2), nodes: [part("n_1")], activePageId: "page_home" }, version: 0 }), "morning:7"));
await S.useStudio.persist.rehydrate();
S.watchOtherTabs();
check("2. this tab loaded the board", st().pages.length === 2 && st().nodes.length === 1, `${st().pages.length} pages`);
S.useStudio.setState({ zoom: 2 });
check("2. saved again unchanged after the load (filled in), it keeps the stamp it was read with", storedStamp() === "morning:7" && "learn" in stored().state, String(storedStamp()));

/* 3. Out of sight, the other tab saves an hour of work; a change here before this tab catches up. */
hide();
otherSaves({ ...stored().state, pages: PAGES.slice(0, 3), nodes: [part("n_1"), part("n_2")] });
check("3. this tab is behind the other tab's save", D.behind(LIVE) === true);
st().setActivePage("page_two");
check("3. a change in the old tab is not written over the other tab's work", storedStamp() === "othertab:1" && stored().state.pages.length === 3 && stored().state.nodes.length === 2, `${storedStamp()} ${stored().state.pages.length}`);
check("3. …and the tab says so", S.otherTab() === "newer", String(S.otherTab()));

/* 4 */
S.loadNewer();
check("4. Load the newer work: the tab shows the other tab's three pages and two parts", st().pages.length === 3 && st().nodes.length === 2 && S.otherTab() === null, `${st().pages.length} ${S.otherTab()}`);
check("4. …and its own unsaved click is let go", st().activePageId === "page_home", st().activePageId);
st().setActivePage("page_three");
check("4. its next click is saved on top of the newer work, as this tab's", stored().state.pages.length === 3 && stored().state.nodes.length === 2 && stored().state.activePageId === "page_three" && !/^othertab/.test(storedStamp()), `${storedStamp()}`);
otherSaves({ ...stored().state, nodes: [] });
st().setActivePage("page_two");
check("4. another save there, and a change here: the tab asks again", S.otherTab() === "newer" && stored().state.nodes.length === 0);
S.keepThisTab();
check("4. Keep this tab's: this tab's board is saved over the other tab's", stored().state.nodes.length === 2 && stored().state.activePageId === "page_two" && !/^othertab/.test(storedStamp()) && S.otherTab() === null, `${stored().state.nodes.length} ${storedStamp()}`);

/* 5 */
const running = { id: "th_there", parentId: null, at: 1, mode: "draw", ask: "a hero", answer: "", changes: [], state: "running", pieces: [] };
otherSaves({ ...stored().state, pages: PAGES.slice(0, 4), threads: [running] });
check("5. out of sight, nothing of this tab's unsaved: the board is not drawn again on every write there", st().pages.length === 3);
show();
check("5. shown again, it takes the newer work", st().pages.length === 4 && S.otherTab() === null && D.behind(LIVE) === false, `${st().pages.length} ${S.otherTab()}`);
check("5. …and the other tab's update stays running: it is running there", st().threads.some((t) => t.id === "th_there" && t.state === "running"));
st().setActivePage("page_four");
check("5. his click is then saved on top of it, not instead of it", stored().state.pages.length === 4 && stored().state.activePageId === "page_four" && !/^othertab/.test(storedStamp()));
otherSaves({ ...stored().state, pages: PAGES.slice(0, 5) });
check("5. on screen (the preview beside the board): not on every letter typed there", st().pages.length === 4);
await sleep(650);
check("5. …but once the other tab has been quiet a moment", st().pages.length === 5 && D.behind(LIVE) === false, String(st().pages.length));

/* 6 */
otherSaves({ pages: [page("home", "Home")], nodes: [part("elsewhere")], activePageId: "page_home" }, true);
check("6. another tab opened a different site: the tab says to reload", S.otherTab() === "moved", String(S.otherTab()));
show();
check("6. …takes nothing", st().pages.length === 5 && !st().nodes.some((n) => n.id === "elsewhere"));
st().setActivePage("page_two");
S.keepThisTab();
check("6. …writes nothing, and keeps nothing of this tab's over that site", /:moved$/.test(storedStamp()) && stored().state.nodes[0]?.id === "elsewhere" && S.otherTab() === "moved", String(storedStamp()));
await D.writeDocNow(LIVE, ls.getItem(LIVE));
S.swapDoc(ls.getItem(LIVE));
check("6. opening a site in this tab clears it", S.otherTab() === null && st().nodes[0]?.id === "elsewhere" && D.behind(LIVE) === false);

/* 7 */
pen.visitor = true;
const was = ls.getItem(LIVE);
otherSaves({ ...stored().state, pages: PAGES.slice(0, 2) });
show();
st().setActivePage("page_two");
check("7. the published page neither takes another tab's save nor writes", st().pages.length === 1 && S.otherTab() === null && storedStamp() !== D.stampOf(was) && /^othertab/.test(storedStamp()));
pen.visitor = false;

/* 8. Three sites; this tab is on X, the other tab leaves X for Y and works an hour there. */
const B = await jiti.import(join(here, "..", "src", "features", "builds", "store.ts"));
const LIST = "builder.builds";
const slot = (id) => `builder.doc:${id}`;
const heardWrite = (key) => { const e = new Event("storage"); Object.defineProperty(e, "key", { value: key }); win.dispatchEvent(e); };
const list = () => JSON.parse(ls.getItem(LIST)).state;
const ids = (key) => JSON.parse(ls.getItem(key)).state.nodes.map((n) => n.id).join();
S.loadNewer();
ls.setItem(LIST, JSON.stringify({ state: { projects: ["x", "y", "z"].map((id) => ({ id, name: id.toUpperCase(), updatedAt: 1 })), activeId: "x" }, version: 0 }));
await B.useBuilds.persist.rehydrate();
ls.setItem(slot("y"), D.stamped(JSON.stringify({ state: { pages: [page("home", "Why")], nodes: [part("y_1")] }, version: 0 }), "y:1"));
ls.setItem(slot("z"), D.stamped(JSON.stringify({ state: { pages: [page("home", "Zed")], nodes: [part("z_1")] }, version: 0 }), "z:1"));
const xIds = st().nodes.map((n) => n.id).join();
ls.setItem(slot("x"), D.stamped(ls.getItem(LIVE), `othertab:${++theirs}:moved`));
ls.setItem(LIVE, D.stamped(JSON.stringify({ state: { pages: [page("home", "Why")], nodes: [part("y_1"), part("y_hour")] }, version: 0 }), `othertab:${++theirs}:moved`));
heardWrite(LIVE);
ls.setItem(LIST, JSON.stringify({ state: { ...list(), activeId: "y" }, version: 0 }));
heardWrite(LIST);
check("8. this tab, still on X, is told another tab opened a different site", S.otherTab() === "moved" && B.useBuilds.getState().activeId === "x");
B.useBuilds.getState().setEdited("x", 5);
check("8. its list is not written: an edit here would have named X as open again", list().activeId === "y" && !list().projects.find((p) => p.id === "x").editedAt);
await B.useBuilds.getState().open("z");
check("8. Z picked from its list: the hour on Y goes into Y's slot, and X's slot keeps X", ids(slot("y")) === "y_1,y_hour" && ids(slot("x")) === xIds, `${ids(slot("y"))} | ${ids(slot("x"))}`);
check("8. …and this tab is on Z, with nothing in its way", st().pages[0]?.name === "Zed" && ids(LIVE) === "z_1" && list().activeId === "z" && S.otherTab() === null && D.behind(LIVE) === false);
/* The other tab, reloaded onto Z, opens X; here he picks X, the site that tab has open. */
ls.setItem(slot("z"), D.stamped(ls.getItem(LIVE), `othertab:${++theirs}:moved`));
const xLive = D.stamped(ls.getItem(slot("x")), `othertab:${++theirs}:moved`);
ls.setItem(LIVE, xLive);
heardWrite(LIVE);
ls.setItem(LIST, JSON.stringify({ state: { ...list(), activeId: "x" }, version: 0 }));
heardWrite(LIST);
await B.useBuilds.getState().open("x");
check("8. picking the site the other tab has open takes it, as a reload would, and writes nothing", ls.getItem(LIVE) === xLive && st().nodes.map((n) => n.id).join() === xIds && B.useBuilds.getState().activeId === "x" && S.otherTab() === null && D.behind(LIVE) === false);

/* 9. Wiring. */
const load = read("src/features/studio/board/store/load.ts");
const create = read("src/features/studio/board/store/create.ts");
const save = read("src/features/studio/SaveLine.tsx");
const docStore = read("src/features/studio/docStore.ts");
check("9. every surface that loads the board hears the other tabs once it has", /const sweep = \(\) => \{ useStudio\.getState\(\)\.sweepDocument\(\); watchOtherTabs\(\); \};/.test(load));
check("9. the preview loads it through that door, so it follows the board", /useStudioHydration\(\);/.test(read("src/features/studio/live/PreviewPage.tsx")) && /useStudioHydration\(\);/.test(read("src/features/studio/page/StudioPage.tsx")));
check("9. the save checks the key before it writes, not after", /if \(behind\(key\)\) \{[\s\S]{0,200}return;\s*\}[\s\S]{0,200}inner\.setItem\(key, value\)/.test(create));
check("9. a write of this tab's still on its way to IndexedDB is dropped when another tab wrote since", /if \(pending\.has\(key\) && behind\(key\)\) \{\s*pending\.delete\(key\);/.test(docStore));
check("9. the save line says both cases, on the preview too", /Not saved: this site changed in another tab/.test(save) && /Not saved: another tab opened a different site/.test(save) && /\/\\\/preview\\\/\/\.test\(path\) && !elsewhere/.test(save));
check("9. …with his choices: the newer work, this tab's, or a reload", /data-other-tab-load=""[^>]*onClick=\{loadNewer\}/.test(save) && /data-other-tab-keep=""[^>]*onClick=\{keepThisTab\}/.test(save) && /data-other-tab-reload=""[^\n]*window\.location\.reload\(\)/.test(save));

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
