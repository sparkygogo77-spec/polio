/**
 * Agents panel, merging (helper/merge/*).
 *
 * - The way: with a GitHub token held, the GitHub API; without one, the
 *   project-chat lines, ready to copy.
 * - A branch J's own agents didn't make waits for him (the repo is public),
 *   and GitHub never merges a fork's PR or a PR for another branch.
 * - J's gate (Q3): a P1, an only-you lane, or a lane touching keys, the
 *   Account, saving, or the capture or export engine waits for Approve;
 *   a plain P2 or P3 goes on its own.
 * - GitHub merges only on green checks and a clean merge: never on a failed
 *   or pending check, never on a conflict, and always as a "merge".
 *
 * GitHub is a stand-in here: no real PRs or merges.
 *
 *   node tests/agents-merge.mjs
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};

let G = null, R = null, C = null, problems = null;
try {
  G = await import("../helper/merge/gate.ts");
  R = await import("../helper/merge/route.ts");
  C = await import("../helper/merge/chat.ts");
  ({ problems } = await import("../helper/contract.ts"));
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the merge modules load", !!(G && R && C && problems));
if (!G || !R || !C) done();

// ---- the gate -------------------------------------------------------------
const plain = { ours: true, p: 2, onlyYou: false, files: ["src/features/studio/panels/inspector/Panel.tsx", "tests/x.mjs"] };
check("a plain P2 goes on its own", G.waitsForJ(plain) === null);
check("a branch your agents didn't make waits for you", /didn't make/.test(G.waitsForJ({ ...plain, ours: false }) ?? ""));
check("ours must be said, not assumed", /didn't make/.test(G.waitsForJ({ p: 2, onlyYou: false, files: [] }) ?? ""));
check("a P3 goes on its own", G.waitsForJ({ ...plain, p: 3 }) === null);
check("a P1 waits for J", /P1/.test(G.waitsForJ({ ...plain, p: 1 }) ?? ""));
check("an only-you lane waits for J", /control/.test(G.waitsForJ({ ...plain, onlyYou: true }) ?? ""));
for (const [f, word] of [
  ["src/features/studio/KeysPanel/keys.ts", "keys"],
  ["src/features/account/sync.ts", "Account"],
  ["src/features/studio/board/store/persist.ts", "saving"],
  ["capture/site/capture/capture-site.mjs", "capture"],
  ["src/features/studio/send-out/pagesOut.ts", "export"],
]) check(`touching ${f} waits for J`, (G.waitsForJ({ ...plain, files: [f] }) ?? "").includes(word), G.waitsForJ({ ...plain, files: [f] }) ?? "null");
check("a helper/ file alone goes on its own", G.waitsForJ({ ...plain, files: ["helper/merge/gate.ts"] }) === null);

// ---- the way ---------------------------------------------------------------
check("no token: the project chat", R.wayFor(null) === "chat");
check("a token: GitHub", R.wayFor("t") === "github");

const job = {
  ...plain, lane: "hover-calm", branch: "claude/hover-calm", commit: "abcdef1234567890", generality: 4,
  fixes: "The hero's hover is calmer", before: "hover-calm 6/6, red on base", after: "sol face hover, nothing moved",
  prTitle: "P2: calmer hero hover", prBody: "body",
};
const chat = await R.mergeStep(job, { token: null, approved: false });
check("without a token, the dock gets the chat lines to copy", !!chat.copy && /^PR: open from claude\/hover-calm \(abcdef12\)/.test(chat.copy), chat.copy?.split("\n")[0]);
check("the chat lines are labelled, one per field", ["PR:", "Fixes:", "Before:", "After merge:", "Ask:"].every((l) => chat.copy.includes(`\n${l}`) || chat.copy.startsWith(l)));
check("the chat line is a valid contract message", problems(chat.line).length === 0, problems(chat.line).join("; "));
const stackedChat = C.chatLines({ ...job, after_branch: "claude/agents-dock" });
check("a stacked branch says what to merge after", /Order: merge after claude\/agents-dock/.test(stackedChat));

const p1 = await R.mergeStep({ ...job, p: 1 }, { token: "t", approved: false, github: { fetch: async () => { throw new Error("must not call GitHub"); } } });
check("a P1 waits for Approve and calls nothing", p1.waitsFor === "a P1 merge" && p1.line.status === "stacked" && p1.line.pr === null);
check("its line says it waits for Approve", /Waits for your Approve/.test(p1.line.line));

// ---- GitHub, stood in ------------------------------------------------------
function github({ checks, mergeable = true, state = "clean", existing = null, headRepo = "sparkygogo77-spec/polio", headRef = "claude/hover-calm" }) {
  const calls = [];
  const fetch = async (url, init = {}) => {
    const path = url.replace("https://api.github.com", "");
    const method = init.method ?? "GET";
    calls.push({ method, path, body: init.body ? JSON.parse(init.body) : null, auth: init.headers?.Authorization });
    const ok = (data, status = 200) => ({ ok: status < 300, status, json: async () => data });
    if (method === "GET" && path.startsWith("/repos/sparkygogo77-spec/polio/pulls?state=open")) return ok(existing ? [{ number: existing }] : []);
    if (method === "POST" && path === "/repos/sparkygogo77-spec/polio/pulls") return ok({ number: 501 }, 201);
    if (method === "GET" && /\/pulls\/\d+$/.test(path)) return ok({ head: { sha: "headsha", ref: headRef, repo: { full_name: headRepo } }, mergeable, mergeable_state: state });
    if (method === "GET" && path.includes("/check-runs")) return ok({ check_runs: checks });
    if (method === "PUT" && path.endsWith("/merge")) return ok({ sha: "mergesha", merged: true });
    return ok({}, 404);
  };
  return { fetch, calls };
}
const green = [{ name: "tests", status: "completed", conclusion: "success" }, { name: "build", status: "completed", conclusion: "success" }];

let gh = github({ checks: green });
let out = await R.mergeStep(job, { token: "secret-token", approved: false, github: { fetch: gh.fetch } });
const put = gh.calls.find((c) => c.method === "PUT");
check("green and clean: it opens the PR and merges", out.line.status === "merged" && out.line.pr === 501 && !!put, JSON.stringify(out.line));
check("the merge is a plain merge, pinned to the head it checked", put?.body?.merge_method === "merge" && put?.body?.sha === "headsha");
check("the PR goes into the base branch", gh.calls.find((c) => c.method === "POST")?.body?.base === "claude/template-ui-website-builder-11bfgl");
check("the token only travels in the Authorization header", gh.calls.every((c) => !c.path.includes("secret-token")) && !JSON.stringify(out).includes("secret-token"));

gh = github({ checks: green, existing: 77 });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("an open PR for the branch is reused, not doubled", out.line.pr === 77 && !gh.calls.some((c) => c.method === "POST"));

gh = github({ checks: [...green.slice(0, 1), { name: "build", status: "completed", conclusion: "failure" }] });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("a failed check: held, never merged", out.line.status === "stacked" && /build/.test(out.line.line) && !gh.calls.some((c) => c.method === "PUT"), out.line.line);

gh = github({ checks: [{ name: "tests", status: "in_progress", conclusion: null }] });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("a check still running: waiting, not merged", out.line.status === "waiting-ci" && !gh.calls.some((c) => c.method === "PUT"));

gh = github({ checks: [] });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("no checks at all: waiting, not merged", out.line.status === "waiting-ci" && !gh.calls.some((c) => c.method === "PUT"));

gh = github({ checks: green, mergeable: false, state: "dirty" });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("a conflict: held, never forced", out.line.status === "stacked" && /conflicts/.test(out.line.line) && !gh.calls.some((c) => c.method === "PUT"));

gh = github({ checks: green });
out = await R.mergeStep({ ...job, onlyYou: true }, { token: "t", approved: true, github: { fetch: gh.fetch } });
check("after J's Approve, an only-you lane merges on green", out.line.status === "merged");

const stranger = await R.mergeStep({ ...job, ours: false }, { token: "t", approved: false, github: { fetch: async () => { throw new Error("must not call GitHub"); } } });
check("a stranger's branch waits for Approve and calls nothing", stranger.line.status === "stacked" && /didn't make/.test(stranger.line.line) && stranger.copy === null);

gh = github({ checks: green, existing: 88, headRepo: "someone/polio-fork" });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("a PR from a fork is held, never merged", out.line.status === "stacked" && /isn't claude\/hover-calm in sparkygogo77-spec\/polio/.test(out.line.line) && !gh.calls.some((c) => c.method === "PUT"), out.line.line);

gh = github({ checks: green, existing: 89, headRef: "claude/something-else" });
out = await R.mergeStep(job, { token: "t", approved: false, github: { fetch: gh.fetch } });
check("a PR for another branch is held, never merged", out.line.status === "stacked" && !gh.calls.some((c) => c.method === "PUT"));

done();
