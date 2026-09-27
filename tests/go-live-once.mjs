#!/usr/bin/env node
/**
 * ONE PRESS, ONE PRODUCTION DEPLOYMENT.
 *
 * Each Go live / Update live site made two production deployments. Go live
 * pushes one commit and then asked Vercel for a deployment of it
 * (`POST /v13/deployments`, forceNew). Once the site's project exists and
 * is connected to its repository, Vercel's Git integration deploys that
 * same push by itself: two builds of one commit, every press after the
 * first.
 *
 * The stand-in for Vercel does what the Git integration does: a push to a
 * repository a project is connected to starts a production deployment of the
 * pushed commit, a moment later. Held here:
 *   · Go live on a site with no project: the project is made after the push,
 *     so nothing deployed it; one deployment, asked for;
 *   · Update live site, twice: one deployment each, the push's own, followed
 *     to READY, and the live link is the same address;
 *   · a project connected by an earlier press and never deployed: one.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/go-live-once.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "not-a-token-placeholder-xxxx";
const VC_TOKEN = "not-a-vercel-token-placeholder";
const ADDRESS = "https://once.vercel.app";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ------------------------------------------------------------ Vercel */
const vcSeen = [];
/** One made by an earlier press and never deployed, connected to someone/earlier. */
const projects = [{ id: "prj_earlier", name: "earlier", link: { type: "github", org: "someone", repo: "earlier", repoId: 900 } }];
/** Every production deployment, and what started it. */
const deployments = [];
const deployment = (p, sha, by) => {
  const d = { id: `dpl_${deployments.length + 1}`, project: p.id, sha, by, polls: 0, createdAt: Date.now() };
  deployments.push(d);
  return d;
};
const shown = (d) => {
  const name = projects.find((p) => p.id === d.project)?.name ?? "x";
  const ready = d.polls >= 2;
  return { uid: d.id, id: d.id, target: "production", readyState: ready ? "READY" : "BUILDING", state: ready ? "READY" : "BUILDING", url: `${name}-${d.id}.vercel.app`, created: d.createdAt, meta: { githubCommitSha: d.sha, githubCommitRef: "main" }, ...(ready ? { alias: [`${name}.vercel.app`] } : {}) };
};
/** What the Git integration does: a push to a connected repository deploys it, a moment later. */
const pushed = (repo, sha) => {
  const [org, name] = repo.split("/");
  const p = projects.find((x) => x.link.org === org && x.link.repo === name);
  if (p) setTimeout(() => deployment(p, sha, "git"), 1500);
};
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  const parsed = body ? JSON.parse(body) : null;
  vcSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  if (path === "/v9/projects" && req.method === "GET") return send(200, { projects, pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    const [org, name] = String(parsed?.gitRepository?.repo ?? "").split("/");
    const p = { id: `prj_${projects.length + 1}`, name: parsed?.name, link: { type: "github", org, repo: name, repoId: 1000 + projects.length } };
    projects.push(p);
    return send(200, p);
  }
  if (/^\/v\d+\/deployments$/.test(path) && req.method === "GET") {
    const pid = url.searchParams.get("projectId");
    const list = deployments.filter((d) => !pid || d.project === pid).sort((a, b) => b.createdAt - a.createdAt).map(shown);
    return send(200, { deployments: list, pagination: { next: null } });
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    const p = projects.find((x) => x.id === parsed?.project);
    if (!p) return send(404, { error: { code: "not_found", message: "Project not found" } });
    const d = deployment(p, parsed?.gitSource?.sha ?? `head-of-${parsed?.gitSource?.ref ?? "main"}`, "api");
    return send(200, { id: d.id, readyState: "QUEUED", url: `${p.name}-${d.id}.vercel.app` });
  }
  const one = path.match(/^\/v13\/deployments\/([^/]+)$/);
  if (one && req.method === "GET") {
    const d = deployments.find((x) => x.id === one[1]);
    if (!d) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    d.polls++;
    return send(200, shown(d));
  }
  return send(404, { error: { code: "not_found", message: "Not found" } });
});

/* ------------------------------------------------------------ GitHub */
const ghSeen = [];
let commits = 0;
/** A commit's sha, shaped as GitHub's are: forty hex characters. */
const shaOf = (n) => n.toString(16).padStart(40, "0");
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
  if (rest.startsWith("/contents/")) return send(404, { message: "Not Found" });
  if (rest.startsWith("/git/ref/heads/")) return send(200, { object: { sha: shaOf(commits) } });
  if (rest.startsWith("/git/commits/")) return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs") return send(201, { sha: `b${ghSeen.length}` });
  if (rest === "/git/trees") return send(201, { sha: "tree1" });
  if (rest === "/git/commits" && req.method === "POST") { commits++; return send(201, { sha: shaOf(commits), html_url: `https://example.invalid/${shaOf(commits)}` }); }
  /* The branch moves: that is the push the Git integration sees. */
  if (rest.startsWith("/git/refs")) { const sha = JSON.parse(body || "{}").sha; pushed(m[1], sha); return send(200, { object: { sha } }); }
  return send(404, { message: "Not Found" });
});
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));
await new Promise((ok) => vc.listen(VC_PORT, "127.0.0.1", ok));
const stop = () => { gh.close(); vc.close(); };

/* Both stand-ins answer for the server, or nothing is pressed. */
{
  const headers = { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN };
  await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers, body: JSON.stringify({ files: [{ path: "index.html", content: "x" }], repo: "stand-in/probe", branch: "main", deploy: false }) }).catch(() => null);
  await fetch(`${BASE}/api/studio/deploy?id=probe`, { headers }).catch(() => null);
  if (!ghSeen.some((l) => l.includes("/repos/stand-in/probe")) || !vcSeen.includes("GET /v13/deployments/probe")) {
    console.error(`The server at ${BASE} is not pointed at the stand-ins on ${GH_PORT} and ${VC_PORT}. Start it with GITHUB_API and VERCEL_API set and no tokens of its own.`);
    stop();
    process.exit(2);
  }
  ghSeen.length = 0;
  vcSeen.length = 0;
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);
const open = async (name) => {
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate((n) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    const was = JSON.parse(localStorage.getItem("builder.builds") || "null")?.state?.projects?.[0];
    localStorage.setItem("builder.builds", env({ projects: [{ ...(was?.name === n ? was : {}), id: "s1", name: n, updatedAt: Date.now() }], activeId: "s1" }));
    localStorage.setItem("builder.studio", env({
      pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
      activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [],
    }));
  }, name);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
};
await open("Once");
{
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill(GH_TOKEN);
  await keys.locator('[data-service="vercel"] input[type="password"]').first().fill(VC_TOKEN);
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(1200);
}
const bar = () => page.locator("header [data-go-live]").first();
/** Press the top-bar button, wait for it to finish, then give a late Git deployment time to show. */
const press = async () => {
  const n = deployments.length;
  await bar().click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 240 && (await bar().getAttribute("data-go-live-state")) === "busy"; i++) await page.waitForTimeout(250);
  await sleep(4000);
  return deployments.slice(n);
};
const label = async () => (await bar().innerText()).replace(/\s+/g, " ").trim();

console.log("1. Go live on a site with no Vercel project");
{
  const made = await press();
  const p = await project();
  check("one production deployment", made.length === 1, made.map((d) => `${d.id} by ${d.by} of ${d.sha}`).join(", ") || "none");
  check("the site is live at its address", p?.live?.url === ADDRESS, `live = ${p?.live?.url ?? null}`);
}
for (const n of [1, 2]) {
  console.log(`${n + 1}. Update live site, press ${n}`);
  const before = await label();
  const made = await press();
  const p = await project();
  check(`the button read Update live site, and one production deployment came of it`, /Update live site/.test(before) && made.length === 1, `${JSON.stringify(before)}; ${made.map((d) => `${d.id} by ${d.by} of ${d.sha}`).join(", ") || "none"}`);
  check("it is the push's own, of the commit just pushed", made[0]?.by === "git" && made[0]?.sha === shaOf(commits), `deployed ${made[0]?.sha ?? "nothing"} by ${made[0]?.by ?? "nobody"}, pushed ${shaOf(commits)}`);
  check("followed to READY: the live link is the same address", p?.live?.url === ADDRESS && !p?.pending, `live = ${p?.live?.url ?? null}, pending = ${JSON.stringify(p?.pending ?? null)}`);
}
console.log("4. A project connected by an earlier press, never deployed");
await open("Earlier");
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("builder.builds")); raw.state.projects[0].repo = { owner: "someone", name: "earlier", branch: "main" }; raw.state.projects[0].bound = "made"; localStorage.setItem("builder.builds", JSON.stringify(raw)); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  const made = await press();
  const p = await project();
  check("one production deployment, and the site is live", made.length === 1 && p?.live?.url === "https://earlier.vercel.app", `${made.map((d) => `${d.id} by ${d.by}`).join(", ") || "none"}; live = ${p?.live?.url ?? null}`);
}
check("one project per site, never a second", projects.length === 2, projects.map((p) => p.name).join(", "));
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
