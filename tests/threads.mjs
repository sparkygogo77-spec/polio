/**
 * Threads: the tree, the cut, and what changed.
 *
 * A thread is an iteration an API call landed, not an update, and the rules
 * that make it worth keeping are the ones that are easy to get wrong: the
 * tree is built from parents, a cut takes one node and re-hangs its children
 * on that node's parent rather than dropping them, and the board is left
 * standing on something that still exists. `diffDocs` is what a thread shows
 * when it is opened, so it has to say what actually moved.
 *
 *   node tests/threads.mjs
 */
import { diffDocs, flatten, liveAfterPrune, pruneThread, threadsToMarkdown, threadTitle, threadTree } from "../src/features/studio/threads.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const th = (id, parentId, at, extra = {}) => ({
  id, parentId, at, mode: extra.mode ?? "critique", ask: extra.ask ?? "", answer: extra.answer ?? "",
  changes: extra.changes ?? [], doc: extra.doc,
});

/*
 *  a
 *  ├── b
 *  │   ├── d
 *  │   └── e
 *  └── c
 */
const TREE = [th("a", null, 1), th("b", "a", 2), th("c", "a", 3), th("d", "b", 4), th("e", "b", 5)];

/* 1. The tree. */
{
  const roots = threadTree(TREE);
  check("one root", roots.length === 1 && roots[0].thread.id === "a");
  check("children hang off their parent, oldest first", roots[0].children.map((c) => c.thread.id).join("") === "bc");
  check("depth is how far from the root", flatten(roots).map((n) => `${n.thread.id}${n.depth}`).join(" ") === "a0 b1 d2 e2 c1", flatten(roots).map((n) => `${n.thread.id}${n.depth}`).join(" "));
  const orphan = threadTree([th("x", "gone", 1)]);
  check("a thread whose parent is gone is a root", orphan.length === 1 && orphan[0].depth === 0);
}

/* 2. The cut: one node only, and its children re-hang from its parent. */
{
  const after = pruneThread(TREE, "b");
  check("the cut thread is gone", !after.some((t) => t.id === "b"));
  check("nothing else is", after.length === TREE.length - 1);
  check("its children re-hang from its parent", after.filter((t) => ["d", "e"].includes(t.id)).every((t) => t.parentId === "a"));
  check("a cut root leaves its children as roots", pruneThread(TREE, "a").filter((t) => ["b", "c"].includes(t.id)).every((t) => t.parentId === null));
  check("cutting something that is not there changes nothing", pruneThread(TREE, "zzz") === TREE);
  const twice = pruneThread(pruneThread(TREE, "b"), "d");
  check("two cuts leave the rest hanging correctly", twice.map((t) => `${t.id}:${t.parentId}`).join(" ") === "a:null c:a e:a", twice.map((t) => `${t.id}:${t.parentId}`).join(" "));
}

/* 3. Where the board stands after a cut. */
{
  check("cutting a thread the board is not on leaves it where it is", liveAfterPrune(TREE, "c", "e") === "e");
  check("cutting the live thread stands on its parent", liveAfterPrune(TREE, "e", "e") === "b");
  check("cutting a live root stands on the newest that is left", liveAfterPrune(TREE, "a", "a") === "e");
  check("cutting the only thread leaves nothing to stand on", liveAfterPrune([th("solo", null, 1)], "solo", "solo") === null);
  check("a live id that no longer exists falls back to the newest", liveAfterPrune(TREE, "c", "ghost") === "e");
}

/* 4. What changed, between the board a thread inherited and the board it left. */
{
  const before = { nodes: [{ id: "n1", label: "Hero", prompt: "one", w: 100, h: 50, featureId: "hero-split" }, { id: "n2", label: "Footer", prompt: "", w: 200, h: 60, featureId: "footer" }], pages: [{}], brief: { master: "a" } };
  const after = { nodes: [{ id: "n1", label: "Hero", prompt: "two", w: 140, h: 50, featureId: "hero-gradient" }, { id: "n3", label: "Orb", prompt: "", w: 400, h: 400, featureId: "orb-css" }], pages: [{}, {}], brief: { master: "b" } };
  const d = diffDocs(before, after);
  const has = (s) => d.some((line) => line.includes(s));
  check("a part that arrived is named", has("+ Orb placed"), d.join(" | "));
  check("a part that left is named", has("− Footer removed"));
  check("a rewritten prompt is named", has("~ Hero: prompt rewritten"));
  check("a resize says both sizes", has("100×50 → 140×50"));
  check("a part that changed kind says so", has("~ Hero: now a hero-gradient"));
  check("the site's own prompt counts", has("the site's own prompt rewritten"));
  check("pages counted", has("1 pages → 2"));
  check("nothing to compare gives nothing", diffDocs(undefined, after).length === 0 && diffDocs(before, undefined).length === 0);
}

/* 5. The one line a collapsed thread shows. */
{
  const t = th("x", null, 1, { mode: "critique", ask: "Look at the hero\nsecond line", changes: ["3 findings", "took the prompt for Hero"] });
  const title = threadTitle(t);
  check("the title says what was asked", title.startsWith("Asked for a critique: Look at the hero"), title);
  check("and what it did, without listing everything", title.endsWith("3 findings and 1 more"), title);
  check("a thread that did nothing says so", threadTitle(th("y", null, 1, { mode: "ideas" })).includes("nothing taken yet"));
  const md = threadsToMarkdown(TREE);
  check("the markdown is a nested list", md.includes("- **") && md.includes("  - **"), md.split("\\n").slice(4, 6).join(" / "));
  check("an empty tree still says something", threadsToMarkdown([]).includes("Nothing has been asked yet"));
}

const ok = results.every(Boolean);
console.log(ok ? "\nall good" : "\nsomething failed");
process.exit(ok ? 0 : 1);
