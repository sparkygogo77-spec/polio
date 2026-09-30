#!/usr/bin/env node
/**
 * A GIT-CONNECTED PROJECT IS NEVER ASKED FOR A DEPLOYMENT (2026-09-30).
 *
 * The owner's Vercel Hobby plan hit its hundred deployments a day: every
 * published site's repository is connected to its Vercel project, so each
 * Update live site's push deployed on its own, and the Builder then asked
 * the deploy API for another; 8627a05's own came back "Deployment rate
 * limited". Held here against stand-ins for Vercel and GitHub (STANDIN
 * tokens, nothing real), by the route itself:
 *
 *   (1) a connected project whose push deploys a moment later: that
 *       deployment is found by its commit and followed to READY and its
 *       address; the deploy API is never called;
 *   (2) a connected project whose push has not deployed when the route
 *       answers (rate limited, or slow): still no deploy API; the Builder is
 *       handed the commit to poll, which becomes the deployment once Vercel
 *       makes one, and, when none comes for five minutes, says why it may not;
 *   (3) a project that is not connected to the repository: one deployment,
 *       asked for, as before;
 *   (4) a site with no project: the project is made after the push, so one
 *       deployment is asked for, as before;
 *   (5) polio's own vercel.json deploys trunk from Git and no lane branch;
 *   (6) a project the Builder makes holds the static-site settings itself,
 *       not only the first deployment request, so Vercel's later Git builds
 *       read them (the 30 September check of the Git path against the old
 *       direct deploy);
 *   (7) a connected site that publishes to a branch Vercel does not build to
 *       production asks for a production deployment, as the direct deploy
 *       did, rather than following a preview and calling it the live site.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4343 VERCEL_API=http://127.0.0.1:4344 npx next start -p 3013
 *   node tests/go-live-linked.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { readFileSync } from "node:fs";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4343);
const VC_PORT = Number(process.env.VC_PORT ?? 4344);
const HEADERS = { "content-type": "application/json", "x-vercel-token": "STANDIN_VERCEL_TOKEN", "x-github-token": "STANDIN_GITHUB_TOKEN" };
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`); };
const J = (x) => JSON.stringify(x);
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
const sha = (n) => n.toString(16).padStart(40, "0");

/* ------------------------------------------------------------ Vercel */
const projects = [
  { id: "prj_linked", name: "linked", link: { type: "github", org: "standin", repo: "linked", repoId: 1 } },
  { id: "prj_loose", name: "loose" },
];
const deployments = [];
const asked = [];
const made = [];
const targets = [];
const shown = (d) => { const ready = d.polls >= 2; return { uid: d.id, id: d.id, readyState: ready ? "READY" : "BUILDING", url: `${d.project}-${d.id}.vercel.app`, created: d.at, meta: { githubCommitSha: d.sha, githubCommitRef: "main" }, ...(ready ? { alias: [`${d.project}.vercel.app`] } : {}) }; };
const add = (project, s, by) => { const d = { id: `dpl_${deployments.length + 1}`, project, sha: s, by, polls: 0, at: Date.now() }; deployments.push(d); return d; };
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer STANDIN_/.test(req.headers.authorization ?? "")) return send(403, { error: { message: "Not authorized" } });
  if (url.pathname === "/v9/projects") return send(200, { projects, pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(url.pathname) && req.method === "POST") {
    const p = JSON.parse(body);
    made.push(p);
    const [org, repo] = p.gitRepository.repo.split("/");
    const made = { id: `prj_${p.name}`, name: p.name, link: { type: "github", org, repo, repoId: 9 } };
    projects.push(made);
    return send(200, made);
  }
  if (/^\/v\d+\/deployments$/.test(url.pathname) && req.method === "GET") return send(200, { deployments: deployments.filter((d) => d.project === url.searchParams.get("projectId")).map(shown) });
  if (url.pathname === "/v13/deployments" && req.method === "POST") {
    const p = JSON.parse(body);
    asked.push(p.project);
    targets.push(p.target);
    const d = add(p.project, p.gitSource?.sha ?? "head", "api");
    return send(200, { id: d.id, readyState: "QUEUED", url: `${d.project}-${d.id}.vercel.app` });
  }
  const one = url.pathname.match(/^\/v13\/deployments\/([^/]+)$/);
  if (one) { const d = deployments.find((x) => x.id === one[1]); if (!d) return send(404, { error: { message: "Deployment not found" } }); d.polls++; return send(200, shown(d)); }
  return send(404, { error: { message: "Not found" } });
});
/* ------------------------------------------------------------ GitHub: only what the capture check asks (nothing there is a capture). */
const gh = http.createServer((req, res) => { res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ message: "Not Found" })); });
await new Promise((ok) => vc.listen(VC_PORT, "127.0.0.1", ok));
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));

const post = (o) => fetch(`${BASE}/api/studio/deploy`, { method: "POST", headers: HEADERS, body: J(o) }).then((r) => r.json());
const poll = (id) => fetch(`${BASE}/api/studio/deploy?id=${encodeURIComponent(id)}`, { headers: HEADERS }).then((r) => r.json());
const toEnd = async (id) => { for (let i = 0; i < 10; i++) { const s = await poll(id); if (s.done) return s; } return null; };

{
  const probe = await poll("probe").catch(() => null);
  if (!probe || probe.reason === "no-token") { console.error(`The server at ${BASE} does not answer, or is not pointed at the stand-ins (VERCEL_API=http://127.0.0.1:${VC_PORT}).`); vc.close(); gh.close(); process.exit(2); }
}

console.log("1. A connected project: the push deploys a moment later");
{
  setTimeout(() => add("prj_linked", sha(1), "git"), 1500);
  const start = await post({ repo: "standin/linked", branch: "main", sha: sha(1) });
  const end = start.ok ? await toEnd(start.id) : null;
  check("the push's own deployment is followed, by its commit", start.ok && start.followed === true && deployments.find((d) => d.id === start.id)?.by === "git", J(start));
  check("…to READY, with the address", end?.state === "READY" && end.url === "https://prj_linked.vercel.app", J(end));
  check("…and the deploy API was never called", asked.length === 0, J(asked));
}

console.log("2. A connected project whose push has not deployed (rate limited)");
{
  const start = await post({ repo: "standin/linked", branch: "main", sha: sha(2) });
  check("no deployment is asked for", asked.length === 0, J(asked));
  check("the Builder is handed the commit to follow", start.ok === true && /^commit:prj_linked:0+2:main:\d+$/.test(start.id) && start.waiting === true, J(start));
  const waiting = await poll(start.id);
  check("…which waits while Vercel has not started it", waiting.ok === true && waiting.done === false && waiting.state === null, J(waiting));
  add("prj_linked", sha(2), "git");
  const end = await toEnd(start.id);
  check("…and becomes the deployment once Vercel makes it, READY at its address", end?.state === "READY" && end.url === "https://prj_linked.vercel.app", J(end));
  const late = await poll(`commit:prj_linked:${sha(3)}:main:${Date.now() - 6 * 60_000}`);
  check("none after five minutes: it ends, saying Git deployments may be rate limited, and asks for none", late.done === true && late.state === "NOT_STARTED" && /rate limited/.test(late.message ?? "") && asked.length === 0, J(late));
}

console.log("3. A project not connected to the repository");
{
  const start = await post({ repo: "standin/loose", branch: "main", project: "loose", sha: sha(4) });
  check("one deployment is asked for, of the commit", start.ok && asked.length === 1 && asked[0] === "prj_loose" && deployments.at(-1)?.sha === sha(4), J({ start, asked }));
}

console.log("4. A site with no project yet");
{
  const start = await post({ repo: "standin/fresh", branch: "main", name: "fresh", sha: sha(5) });
  check("the project is made and one deployment asked for", start.ok && start.created === "fresh" && asked.length === 2 && asked[1] === "prj_fresh", J({ start, asked }));
}

console.log("6. A project the Builder makes holds the static-site settings");
{
  const p = made.find((x) => x.name === "fresh");
  check("the project is made with no framework, build, install or output setting of its own", !!p && "framework" in p && p.framework === null && p.buildCommand === null && p.installCommand === null && p.outputDirectory === null, J(p));
}

console.log("7. A connected site that publishes to a branch that is not production");
{
  const n = asked.length;
  const start = await post({ repo: "standin/linked", branch: "preview", project: "linked", sha: sha(7) });
  check("a production deployment of that branch is asked for, never a preview followed", start.ok && asked.length === n + 1 && asked.at(-1) === "prj_linked" && targets.at(-1) === "production" && !start.followed, J({ start, targets }));
}

console.log("5. polio's own Git deployments");
{
  const cfg = JSON.parse(readFileSync(new URL("../vercel.json", import.meta.url), "utf8"));
  const rules = cfg.git?.deploymentEnabled ?? {};
  /* As Vercel reads it (minimatch): `**` any path, `*` within one segment; a branch deploys when any pattern it matches is true, and one no pattern matches deploys. */
  const minimatch = (b, g) => new RegExp(`^${g.split("**").map((x) => x.split("*").map((y) => y.replace(/[.+?^${}()|[\]\\]/g, "\\$&")).join("[^/]*")).join(".*")}$`).test(b);
  const deploys = (b) => { const hit = Object.entries(rules).filter(([g]) => minimatch(b, g)); return !hit.length || hit.some(([, v]) => v === true); };
  check("trunk deploys from Git", deploys("claude/template-ui-website-builder-11bfgl"));
  check("a lane branch does not, nor main", !deploys("claude/eager-rubin-8asyo7") && !deploys("claude/some-lane") && !deploys("main"), J(rules));
}

vc.close();
gh.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
