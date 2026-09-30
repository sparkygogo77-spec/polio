/**
 * A CAPTURE LANDS ON A BRANCH OF ITS OWN, NEVER ON SINK'S MAIN BY DEFAULT.
 *
 * From the owner's walk-through: the Capture dialog's advanced defaults ran
 * the capture on sparkygogo77-spec/sink's main. Now the capture runs on a
 * new branch made for it, capture/<name>-<date>, cut from the default
 * branch where the workflow lives; the site is brought in from wherever it
 * landed; and the dialog says that changes to sink's main need the owner's
 * OK (a tick, never a default).
 *
 * GitHub is a stand-in fetch. The token is a stand-in string and reaches no
 * network.
 *
 *   node tests/capture-branch.mjs
 */
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const { captureBranch, isMainBranch, startCapture, watchCapture, captureWant, WORKFLOW } = await import("../src/features/studio/captureSite.ts");
const { readFileSync } = await import("node:fs");

const TOKEN = "STANDIN_GITHUB_TOKEN";
const repo = { owner: "someone", name: "sink" };
check("the default branch is capture/<name>-<date>", captureBranch("Example Site", new Date("2026-09-30T10:00:00Z")) === "capture/example-site-2026-09-30", captureBranch("Example Site", new Date("2026-09-30T10:00:00Z")));
check("main, master and the default branch are the owner's to agree to", isMainBranch("main") && isMainBranch("Master") && isMainBranch("") && isMainBranch("trunk", "trunk") && !isMainBranch("capture/x-2026-09-30", "main"));

const asked = [];
let refExists = false;
let landedOnOwn = true;
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const github = {
  fetch: async (url, init = {}) => {
    const u = String(url);
    asked.push({ u, method: init.method ?? "GET", body: init.body ? JSON.parse(init.body) : null });
    if (u.endsWith("/repos/someone/sink")) return json(200, { default_branch: "main" });
    if (u.endsWith("/git/ref/heads/main")) return json(200, { object: { sha: "f00d" } });
    if (u.endsWith("/git/refs") && init.method === "POST") return refExists ? json(422, { message: "Reference already exists" }) : json(201, { ref: "made" });
    if (u.includes(`/actions/workflows/${WORKFLOW}/dispatches`)) return new Response(null, { status: 204 });
    if (u.includes(`/actions/workflows/${WORKFLOW}/runs`)) return json(200, { workflow_runs: [{ id: 5, html_url: "https://github.test/run/5", created_at: new Date().toISOString() }] });
    if (u.endsWith("/actions/runs/5")) return json(200, { id: 5, status: "completed", conclusion: "success", html_url: "https://github.test/run/5" });
    if (u.includes("/contents/sites/example")) return landedOnOwn ? json(200, []) : json(404, {});
    return json(404, {});
  },
  sleep: async () => {},
};

const branch = "capture/example-2026-09-30";
const started = await startCapture({ repo, token: TOKEN, url: "https://example.com", name: "example", pages: "/", ref: branch, makeBranch: true, ...github });
const made = asked.find((a) => a.u.endsWith("/git/refs"));
const dispatch = asked.find((a) => a.u.includes("/dispatches"));
check("the capture's branch is made from the default branch's tip", !!made && made.body.ref === `refs/heads/${branch}` && made.body.sha === "f00d", JSON.stringify(made?.body));
check("the workflow runs on that branch, not main", dispatch?.body?.ref === branch, dispatch?.body?.ref);
check("no request writes to main", !asked.some((a) => a.method !== "GET" && JSON.stringify(a.body ?? {}).includes('"main"')));
check("it says which branch it ran on", started.ok && started.ref === branch && started.madeBranch === true, JSON.stringify(started));

asked.length = 0;
refExists = true;
const again = await startCapture({ repo, token: TOKEN, url: "https://example.com", name: "example", pages: "/", ref: branch, makeBranch: true, ...github });
check("a second capture the same day reuses the branch", again.ok && again.ref === branch && !again.madeBranch);

const end = await watchCapture({ repo, token: TOKEN, runId: 5, name: "example", ranOn: branch, onProgress: () => {}, ...github });
check("the site is brought in from the branch it landed on", end.ok && end.ref === branch && end.path === "sites/example", JSON.stringify(end));
landedOnOwn = false;
const elsewhere = await watchCapture({ repo, token: TOKEN, runId: 5, name: "example", ranOn: branch, onProgress: () => {}, ...github });
check("…or from captures/<name>, when the workflow committed there", elsewhere.ok && elsewhere.ref === "captures/example", JSON.stringify(elsewhere));
check("what Bring in reads names that branch", captureWant(repo, "example", branch) === `someone/sink@${branch}`);

const dialog = readFileSync("src/features/studio/CaptureSiteDialog.tsx", "utf8");
check("the dialog's branch starts as the capture's own branch", /setBranch\(captureBranch\(/.test(dialog) && /makeBranch: !onMain/.test(dialog));
check("the dialog says changes to sink's main need the owner's OK", /Changes to sink&apos;s main line need the owner&apos;s OK/.test(dialog));
check("capturing on main needs a tick, never a default", /disabled=\{[^}]*onMain && !mainOk/.test(dialog) && /useState\(false\)/.test(dialog));

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
