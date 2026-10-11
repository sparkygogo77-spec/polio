#!/usr/bin/env node
/**
 * CUTTING AN OLD UPDATE LEAVES THE BOARD ALONE (audit, 2026-10-11).
 *
 * Pruning an update on the timeline that the board is not standing on used
 * to put the board back to the live update's saved copy, so every edit made
 * since it landed vanished, and every prune or "Stand on it" jumped to the
 * first page. On the real board store, with two pages:
 *
 *   1. cutting an older update keeps the parts, the open page and what is live;
 *   2. with nothing live, cutting one changes nothing on the board, and what
 *      is live is never the update that was just cut;
 *   3. cutting the live update moves the board to its parent's copy and stays
 *      on the open page, because that copy has it;
 *   4. "Stand on it" stays on the open page when the update has it;
 *   5. and falls back to the first page when it does not.
 *
 *   node tests/thread-prune-board.mjs
 *
 * Covers: src/features/studio/board/store/threads.ts, src/features/studio/board/store/history.ts, src/features/studio/loop/threads.ts
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { jsx: true, alias: { "@": join(here, "..", "src"), "@site": join(here, "..", "site.config.ts") } });
const { useStudio } = await jiti.import(join(here, "..", "src", "features", "studio", "board", "store.ts"));
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail && ok !== true ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const st = useStudio.getState;
const ids = () => st().nodes.map((n) => n.id);
const part = (id) => ({ id, label: id, pageId: "page_two", x: 0, y: 0, w: 10, h: 10, prompt: "" });

/* Two pages, then two updates land: A, then B on top of it (B is live). */
const home = st().pages[0];
const two = { ...home, id: "page_two", name: "Two" };
useStudio.setState({ pages: [home, two], nodes: [], activePageId: home.id });
const A = st().landThread({ mode: "draw", ask: "a", answer: "a" });
const B = st().landThread({ mode: "draw", ask: "b", answer: "b" });
const fresh = () => useStudio.setState({ activePageId: "page_two", nodes: [...st().nodes, part(`n_${st().nodes.length}`)] });

/* 1 */
const C = st().landThread({ mode: "draw", ask: "c", answer: "c" });
useStudio.setState({ liveThreadId: B });
fresh();
const before1 = ids();
st().pruneThread(C);
check("1. cutting an older update keeps every part", J(ids()) === J(before1) && before1.length === 1, J(ids()));
check("1. and the open page", st().activePageId === "page_two", st().activePageId);
check("1. and what is live", st().liveThreadId === B, String(st().liveThreadId));

/* 2 */
const D = st().landThread({ mode: "draw", ask: "d", answer: "d" });
useStudio.setState({ liveThreadId: null });
fresh();
const before2 = ids();
st().pruneThread(D);
check("2. with nothing live, cutting changes nothing on the board", J(ids()) === J(before2) && st().activePageId === "page_two", `${J(ids())} ${st().activePageId}`);
check("2. and what is live is never the cut update", st().liveThreadId !== D && st().threads.every((t) => t.id !== D), String(st().liveThreadId));

/* 3 */
useStudio.setState({ liveThreadId: B });
fresh();
st().pruneThread(B);
check("3. cutting the live update stands on its parent", st().liveThreadId === A, String(st().liveThreadId));
check("3. whose copy the board now shows", ids().length === 0, J(ids()));
check("3. on the page that was open, which that copy has", st().activePageId === "page_two", st().activePageId);

/* 4 */
fresh();
st().standOn(A);
check("4. standing on an update that has the open page stays on it", st().activePageId === "page_two" && ids().length === 0, `${st().activePageId} ${J(ids())}`);

/* 5 */
useStudio.setState({ pages: [home], activePageId: home.id });
const E = st().landThread({ mode: "draw", ask: "e", answer: "e" });
useStudio.setState({ pages: [home, two], activePageId: "page_two" });
st().standOn(E);
check("5. one that lacks the open page goes to its first page", st().activePageId === home.id, st().activePageId);

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
