#!/usr/bin/env node
/**
 * A PUBLISH GITHUB REFUSES SAYS WHY, IN GITHUB'S WORDS, AND AT WHICH STEP.
 *
 * gotchi's Update live site staged every file (the key could write them) and
 * then answered only "The token is not allowed to write here.": a rule on
 * `main` and a key with no access read the same, and GitHub's own reason was
 * thrown away. Against a stand-in GitHub that makes the blobs, the tree and
 * the commit and then refuses moving `main`:
 *   · with a ruleset's refusal: the answer names the step ("moving main"),
 *     GitHub's words ("Repository rule violations") and the way out;
 *   · with a workflow-file refusal: the same, and the Workflows permission;
 *   · neither ever carries the key, even when GitHub's message echoes it.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/publish-refused.mjs http://127.0.0.1:3013
 */
import http from "node:http";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const KEY = "github_pat_STANDIN_not_a_real_key_0123456789abcdef";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });

let refuse = null;
const seen = [];
const gh = http.createServer(async (req, res) => {
  await readBody(req);
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const u = new URL(req.url, "http://x");
  seen.push(`${req.method} ${u.pathname}`);
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi") return send(200, { default_branch: "main", full_name: "owner/gotchi" });
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi/git/ref/heads/main") return send(200, { object: { sha: "base0" } });
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi/git/commits/base0") return send(200, { sha: "base0", tree: { sha: "tree0" } });
  if (req.method === "POST" && u.pathname === "/repos/owner/gotchi/git/blobs") return send(201, { sha: `blob${seen.length}` });
  if (req.method === "POST" && u.pathname === "/repos/owner/gotchi/git/trees") return send(201, { sha: "tree1" });
  if (req.method === "POST" && u.pathname === "/repos/owner/gotchi/git/commits") return send(201, { sha: "commit1", html_url: "https://github.example/commit1" });
  if (req.method === "PATCH" && u.pathname === "/repos/owner/gotchi/git/refs/heads/main") return refuse ? send(refuse.status, refuse.body) : send(200, { object: { sha: "commit1" } });
  return send(404, { message: "Not Found" });
});
await new Promise((r) => gh.listen(GH_PORT, "127.0.0.1", r));

const publish = async () => {
  const r = await fetch(`${BASE}/api/studio/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": KEY },
    body: JSON.stringify({ files: [{ path: "index.html", content: "<p>gotchi</p>" }], message: "Update the site", deploy: false, repo: "owner/gotchi", branch: "main" }),
  });
  return { status: r.status, text: await r.text() };
};

/* A ruleset on main, GitHub's own message echoing the key back. */
refuse = { status: 403, body: { message: `Repository rule violations found for refs/heads/main. Changes must be made through a pull request. (${KEY})`, documentation_url: "https://docs.github.com/rest/git/refs#update-a-reference" } };
const rule = await publish();
const r1 = JSON.parse(rule.text || "{}");
check("the files are made and GitHub is asked to move main", seen.some((s) => s === "POST /repos/owner/gotchi/git/commits") && seen.some((s) => s === "PATCH /repos/owner/gotchi/git/refs/heads/main"), seen.join(", "));
check("a refused move of main says the step, in plain words", r1.ok === false && r1.step === "ref" && /GitHub refused moving main/.test(r1.message ?? ""), rule.text);
check("…in GitHub's own words", /Repository rule violations/.test(r1.message ?? ""), r1.message);
check("…with the way out: allow pushes to main, or another branch", /allow pushes to main, or publish to another branch/.test(r1.message ?? ""), r1.message);
check("…and never the key, even where GitHub echoed it", !rule.text.includes(KEY) && !/github_pat_/.test(rule.text), rule.text);

/* A workflow file the key may not write. */
seen.length = 0;
refuse = { status: 403, body: { message: "refusing to allow a Personal Access Token to create or update workflow `.github/workflows/deploy.yml` without `workflow` scope" } };
const wf = await publish();
const r2 = JSON.parse(wf.text || "{}");
check("a workflow-file refusal says the step and GitHub's words", r2.ok === false && r2.step === "ref" && /GitHub refused moving main: refusing to allow a Personal Access Token to create or update workflow/.test(r2.message ?? ""), wf.text);
check("…and names the Workflows permission", /Workflows permission/.test(r2.message ?? ""), r2.message);
check("…and never the key", !wf.text.includes(KEY), wf.text);

/* Control: nothing refused, the publish goes through. */
refuse = null;
const fine = JSON.parse((await publish()).text || "{}");
check("control: with nothing refused the publish lands", fine.ok === true, JSON.stringify(fine).slice(0, 200));

gh.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
