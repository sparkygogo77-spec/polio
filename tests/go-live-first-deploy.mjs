#!/usr/bin/env node
/**
 * THE FIRST DEPLOYMENT OF A NEW PROJECT CARRIES ITS SETTINGS.
 *
 * With a full-account token the project was made (solcinerator, 0
 * deployments), and the deployment was refused with Vercel's 400: "The
 * `projectSettings` object is required for new projects, but is missing in
 * the deployment payload." The published site is static HTML, so a new
 * project's first deployment says so: no framework, no build, no install,
 * served from the root.
 *
 * Held here, against stand-ins for GitHub and Vercel (the Vercel one answers
 * that exact 400 for a project with no deployments and no projectSettings):
 *   · a site with no project: one is made, and its first deployment starts;
 *   · a project named, not connected to the repository, with 0
 *     deployments (as prj_s6ief… was): reused, no second project, and its
 *     deployment starts; and a rerun reuses it again;
 *   · one that has deployed before and has its own framework: its
 *     deployment carries no settings over its own.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/go-live-first-deploy.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "not-a-token-placeholder-xxxx";
const VC_TOKEN = "not-a-vercel-token-placeholder";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ghSeen = [];
const gh = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const path = new URL(req.url, "http://x").pathname;
  ghSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (path === "/user/repos" && req.method === "POST") return send(201, { full_name: `someone/${JSON.parse(body || "{}").name}` });
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m) return send(404, { message: "Not Found" });
  const rest = m[2] ?? "";
  if (!rest) return send(200, { default_branch: "main" });
  if (rest.startsWith("/contents/site/capture")) return send(404, { message: "Not Found" });
  if (rest.startsWith("/git/ref/heads/")) return send(200, { object: { sha: "tip0" } });
  if (rest.startsWith("/git/commits/")) return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs") return send(201, { sha: `b${ghSeen.length}` });
  if (rest === "/git/trees") return send(201, { sha: "tree1" });
  if (rest === "/git/commits") return send(201, { sha: "commit1", html_url: "https://example.invalid/c" });
  if (rest.startsWith("/git/refs")) return send(200, { object: { sha: "commit1" } });
  return send(404, { message: "Not Found" });
});

const vcSeen = [];
/*
 * On the account already: one made and never deployed, and one that has
 * deployed with its own framework. Neither is connected to the repository:
 * a connected project deploys each push by itself and is never asked for a
 * deployment (tests/go-live-linked.mjs), so the deploy API, and the settings
 * it needs for a first deployment, are for a project named that is not.
 */
const projects = [
  { id: "prj_made_earlier", name: "solcinerator", framework: null, deployments: 0 },
  { id: "prj_framed", name: "framed", framework: "nextjs", deployments: 3 },
];
const deployments = [];
const MISSING = "The `projectSettings` object is required for new projects, but is missing in the deployment payload. If you want to use automatic framework detection, you can use the `skipAutoDetectionConfirmation=1` query parameter.";
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  const parsed = body ? JSON.parse(body) : null;
  vcSeen.push({ line: `${req.method} ${path}`, body: parsed });
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  if (path === "/v9/projects" && req.method === "GET") return send(200, { projects: projects.map(({ deployments: _d, ...p }) => p), pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    const [org, name] = String(parsed?.gitRepository?.repo ?? "").split("/");
    const p = { id: `prj_new_${projects.length + 1}`, name: parsed?.name, framework: null, link: { type: "github", org, repo: name, repoId: 1000 + projects.length }, deployments: 0 };
    projects.push(p);
    const { deployments: _d, ...shown } = p;
    return send(200, shown);
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    const p = projects.find((x) => x.id === parsed?.project);
    if (!p) return send(404, { error: { code: "not_found", message: "Project not found" } });
    if (p.deployments === 0 && !parsed?.projectSettings && url.searchParams.get("skipAutoDetectionConfirmation") !== "1") {
      return send(400, { error: { code: "missing_project_settings", message: MISSING } });
    }
    p.deployments++;
    const id = `dpl_${deployments.length + 1}`;
    deployments.push({ id, project: p.id, settings: parsed?.projectSettings ?? null });
    return send(200, { id, readyState: "QUEUED", url: `${p.name}-${id}.vercel.app` });
  }
  const d = path.match(/^\/v13\/deployments\/(dpl_\d+)$/);
  if (d && req.method === "GET") {
    const dep = deployments.find((x) => x.id === d[1]);
    if (!dep) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    return send(200, { readyState: "READY", url: `${dep.id}.vercel.app`, alias: [`${projects.find((p) => p.id === dep.project)?.name}.vercel.app`] });
  }
  /* Opening a project to visitors: Vercel Authentication and any password taken off. */
  const pm = path.match(/^\/v9\/projects\/([^/]+)$/);
  if (pm && req.method === "PATCH") {
    const p = projects.find((x) => x.id === decodeURIComponent(pm[1]));
    if (!p) return send(404, { error: { code: "not_found", message: "Project not found" } });
    p.ssoProtection = parsed?.ssoProtection;
    return send(200, { id: p.id, name: p.name, ssoProtection: p.ssoProtection ?? null });
  }
  if (path === "/v13/deployments/probe") return send(404, { error: { code: "not_found", message: "Deployment not found" } });
  return send(404, { error: { code: "not_found", message: "Not found" } });
});
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));
await new Promise((ok) => vc.listen(VC_PORT, "127.0.0.1", ok));
const stop = () => { gh.close(); vc.close(); };

/* Both stand-ins answer for the server, or nothing is pressed. */
{
  const headers = { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN };
  await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers, body: JSON.stringify({ files: [{ path: "index.html", content: "x" }], repo: "stand-in/probe", branch: "main", deploy: false }) }).catch(() => null);
  await fetch(`${BASE}/api/studio/deploy?id=probe`, { headers }).catch(() => null);
  if (!ghSeen.some((l) => l.includes("/repos/stand-in/probe")) || !vcSeen.some((c) => c.line === "GET /v13/deployments/probe")) {
    console.error(`The server at ${BASE} is not pointed at the stand-ins on ${GH_PORT} and ${VC_PORT}. Start it with GITHUB_API and VERCEL_API set and no tokens of its own.`);
    stop();
    process.exit(2);
  }
  ghSeen.length = 0;
  vcSeen.length = 0;
}

const route = async (body, headers = {}) => (await fetch(`${BASE}/api/studio/deploy`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN, ...headers },
  body: JSON.stringify(body),
})).json();

const made = () => vcSeen.filter((c) => /^POST \/v\d+\/projects$/.test(c.line)).length;
const STATIC = { framework: null, buildCommand: null, installCommand: null, outputDirectory: null };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log("1. A site with no project");
{
  const n = made();
  const r = await route({ repo: "someone/fresh", branch: "main", name: "Fresh" });
  const dep = deployments.at(-1);
  check("one project is made and its first deployment starts", r.ok === true && made() === n + 1 && dep?.project === projects.at(-1).id, JSON.stringify({ ok: r.ok, reason: r.reason, message: r.message }));
  check("…as static HTML: no framework, no build, no install, served from the root", r.ok === true && same(dep?.settings, STATIC), JSON.stringify(dep?.settings ?? null));
}
console.log("2. A project not connected to the repository, never deployed (as prj_s6ief… was)");
for (const press of ["first", "a rerun"]) {
  const n = made();
  const r = await route({ repo: "someone/solcinerator", branch: "main", name: "SOLCINERATOR", project: "solcinerator" });
  const dep = deployments.at(-1);
  check(`${press}: reused, no second project, and its deployment starts`, r.ok === true && made() === n && dep?.project === "prj_made_earlier" && r.project === "solcinerator",
    JSON.stringify({ ok: r.ok, project: r.project, reason: r.reason, status: r.status, message: r.message, made: made() - n }));
}
console.log("3. A project with its own framework that has deployed before");
{
  const r = await route({ repo: "someone/framed", branch: "main", name: "Framed", project: "framed" });
  const dep = deployments.at(-1);
  check("its deployment starts, carrying no settings over its own", r.ok === true && dep?.project === "prj_framed" && dep?.settings === null, JSON.stringify({ ok: r.ok, settings: dep?.settings, message: r.message }));
}
/* Only a project Go live made has the lock taken off; one it found is left as its owner set it (tests/go-live-protected.mjs). */
const patched = vcSeen.filter((c) => /^PATCH \/v9\/projects\//.test(c.line)).map((c) => decodeURIComponent(c.line.split("/").pop()));
const madeHere = projects.filter((p) => p.link);
check("the project Go live made is open to visitors: Vercel's sign-in taken off it", madeHere.length === 1 && madeHere[0].ssoProtection === null && JSON.stringify(patched) === JSON.stringify([madeHere[0].id]),
  `patched: ${patched.join(", ") || "none"}; ${madeHere.map((p) => `${p.id}:${p.ssoProtection === null ? "open" : "locked"}`).join(", ")}`);
check("the projects it found are left as they were: nothing sent to change their protection", !patched.includes("prj_made_earlier") && !patched.includes("prj_framed"), `patched: ${patched.join(", ") || "none"}`);
check("one project made in all, never a second for the same repository", projects.length === 3 && projects.filter((p) => p.link).length === 1, projects.map((p) => `${p.id}:${p.link?.repo ?? "not connected"}`).join(", "));

stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
