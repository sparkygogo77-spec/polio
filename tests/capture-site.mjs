/**
 * "Capture a site": an address typed into the Builder is captured by the
 * sink repository's workflow and lands as sites/<name>/ on captures/<name>,
 * beside every other site, ready to bring in.
 *
 * GitHub is a stand-in here: a fetch that records what was asked and
 * answers with what the Actions API answers. No token exists; the string
 * that stands for one is plainly a stand-in and reaches no network.
 *
 *   node --experimental-strip-types tests/capture-site.mjs
 */
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const { captureName, nameFrom, capturePlace, startCapture, watchCapture, readRun, WORKFLOW } = await import("../src/features/studio/captureSite.ts");

const TOKEN = "stand-in-for-his-token";
const repo = { owner: "someone", name: "sink" };

/* A GitHub that remembers. */
const asked = [];
const runs = [];
let polls = 0;
const github = {
  fetch: async (url, init = {}) => {
    asked.push({ url: String(url), method: init.method ?? "GET", headers: init.headers ?? {}, body: init.body ? JSON.parse(init.body) : null });
    const u = String(url);
    const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    if (u.endsWith("/repos/someone/sink")) return json(200, { default_branch: "main" });
    if (u.includes(`/actions/workflows/${WORKFLOW}/dispatches`)) { runs.push({ id: 77, status: "queued", conclusion: null, html_url: "https://github.test/run/77", created_at: new Date().toISOString(), event: "workflow_dispatch" }); return new Response(null, { status: 204 }); }
    if (u.includes(`/actions/workflows/${WORKFLOW}/runs`)) return json(200, { workflow_runs: runs });
    if (u.endsWith("/actions/runs/77/jobs")) return json(200, { jobs: [{ status: polls < 2 ? "in_progress" : "completed", steps: [{ name: "Install the browser", status: "completed" }, { name: "Capture", status: polls < 2 ? "in_progress" : "completed" }, { name: "Commit to captures/<name>", status: polls < 2 ? "queued" : "completed" }] }] });
    if (u.endsWith("/actions/runs/77")) { polls++; const done = polls > 2; return json(200, { id: 77, status: done ? "completed" : "in_progress", conclusion: done ? "success" : null, html_url: "https://github.test/run/77" }); }
    return json(404, { message: "not here" });
  },
  sleep: async () => {},
};

/* Names. */
check("a name is a folder name: lowered, dashed, never a path", captureName("My Site!") === "my-site" && captureName("../x") === null && captureName("site") === null);
check("a name comes from the address when none is typed", nameFrom("https://www.example.com/docs") === "example");
check("a capture is read from captures/<name>, at sites/<name>", JSON.stringify(capturePlace("example")) === JSON.stringify({ ref: "captures/example", path: "sites/example" }));

/* Starting one. */
const bad = await startCapture({ repo, token: TOKEN, url: "not an address", name: "x", pages: "/", ...github });
check("an address that is not one is refused before GitHub is asked", bad.ok === false && /address/.test(bad.says) && asked.length === 0);
const noToken = await startCapture({ repo, token: "", url: "https://example.com", name: "example", pages: "/", ...github });
check("no token, no capture, and it says so", noToken.ok === false && /token/i.test(noToken.says) && asked.length === 0);

const started = await startCapture({ repo, token: TOKEN, url: "https://example.com", name: "example", pages: "/, /docs", ...github });
check("the workflow is dispatched on the repository's own branch", started.ok === true, started.says);
const dispatch = asked.find((a) => a.url.includes("/dispatches"));
check("with the address, the name and the pages as its inputs", !!dispatch && dispatch.method === "POST" && dispatch.body.ref === "main" && dispatch.body.inputs.url === "https://example.com" && dispatch.body.inputs.name === "example" && dispatch.body.inputs.pages === "/, /docs");
check("the token rides in the header of every call and in no address", asked.every((a) => a.headers.Authorization === `Bearer ${TOKEN}` && !a.url.includes(TOKEN)));
check("the run it started is found, and where to watch it", started.ok && started.runId === 77 && started.htmlUrl === "https://github.test/run/77");

/* Watching it. */
const seen = [];
const end = await watchCapture({ repo, token: TOKEN, runId: 77, name: "example", ...github, onProgress: (s) => seen.push(s) });
check("progress names the step the run is on", seen.some((s) => /Capture/.test(s.step)) && seen[0].done === false);
check("it ends when the run has, with where the site landed", end.done === true && end.ok === true && end.ref === "captures/example" && end.path === "sites/example");
check("a run read once says its state", (await readRun({ repo, token: TOKEN, runId: 77, ...github })).status === "completed");

/* A run that failed. */
polls = 0;
const failing = { ...github, fetch: async (url, init) => { const u = String(url); if (u.endsWith("/actions/runs/78")) return new Response(JSON.stringify({ id: 78, status: "completed", conclusion: "failure", html_url: "https://github.test/run/78" }), { status: 200 }); if (u.endsWith("/actions/runs/78/jobs")) return new Response(JSON.stringify({ jobs: [] }), { status: 200 }); return github.fetch(url, init); } };
const lost = await watchCapture({ repo, token: TOKEN, runId: 78, name: "example", ...failing, onProgress: () => {} });
check("a failed run is said, with the link to its log", lost.done === true && lost.ok === false && /failed/.test(lost.says) && lost.htmlUrl === "https://github.test/run/78");

/* When GitHub says no: each refusal said as what it is, not all as "scope". */
const refusing = (dispatch, repoAnswer = null) => ({ sleep: async () => {}, fetch: async (url, init = {}) => {
  const u = String(url);
  if (u.endsWith("/repos/someone/sink")) return repoAnswer ?? new Response(JSON.stringify({ default_branch: "main" }), { status: 200 });
  if (u.includes("/dispatches")) return dispatch();
  return new Response("{}", { status: 404 });
} });
const say = async (pipes, ref = "main") => (await startCapture({ repo, token: TOKEN, url: "https://example.com", name: "example", pages: "/", ref, ...pipes })).says ?? "";
const answer = (status, message, headers = {}) => () => new Response(JSON.stringify({ message }), { status, headers: { "content-type": "application/json", ...headers } });

const scope = await say(refusing(answer(403, "Resource not accessible by personal access token")));
check("a token without the permission is told the exact one: Actions read and write on the repository, or a classic token's repo scope",
  /Actions/.test(scope) && /read and write/i.test(scope) && /someone\/sink/.test(scope) && /\brepo\b.*scope/.test(scope) && !/workflow\) scope/.test(scope), scope);
const limited = await say(refusing(answer(403, "API rate limit exceeded for user.", { "x-ratelimit-remaining": "0", "x-ratelimit-reset": "2000000000" })));
check("a spent rate limit is said as one, not as a missing permission", /rate limit/i.test(limited) && !/permission|scope/i.test(limited), limited);
const off = await say(refusing(answer(403, "Actions has been disabled for this repository.")));
check("Actions turned off on the repository is said as that", /Actions/.test(off) && /(off|disabled)/i.test(off) && !/scope/i.test(off), off);
const other403 = await say(refusing(answer(403, "Something new GitHub says")));
check("any other refusal carries GitHub's own words", /Something new GitHub says/.test(other403), other403);
const unseen = await say(refusing(() => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }), new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })));
check("a typed branch and a repository the token cannot see is not called a missing workflow", /cannot see|can.t see/i.test(unseen) && !/has no capture\.yml/.test(unseen), unseen);
const noWorkflow = await say(refusing(() => new Response(JSON.stringify({ message: "Not Found" }), { status: 404 })));
check("a repository it sees without the workflow is still said as a missing workflow", /has no capture\.yml/.test(noWorkflow), noWorkflow);
const noRef = await say(refusing(answer(422, "No ref found for: mian")), "mian");
check("a branch that does not exist is said as that", /mian/.test(noRef) && /branch/i.test(noRef), noRef);
const noTrigger = await say(refusing(answer(422, "Workflow does not have 'workflow_dispatch' trigger")));
check("a workflow without its dispatch trigger is said as that", /workflow_dispatch/.test(noTrigger), noTrigger);
const expired = await say(refusing(answer(401, "Bad credentials")));
check("a token GitHub does not know is said as expired or wrong", /expired|revoked|wrong|not a token/i.test(expired), expired);

const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed` : "\nall green");
process.exit(failed ? 1 : 0);
