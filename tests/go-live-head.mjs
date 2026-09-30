#!/usr/bin/env node
/**
 * THE LINK PREVIEW NAMES THE ADDRESS FROM THE FIRST PUSH, IN ONE DEPLOYMENT.
 *
 * stonkfun's copy went live for the first time with og:image named relative
 * and no og:url: the address was not known when the pages were written. One
 * press is one deployment (tests/go-live-once.mjs), so the address is asked
 * for before the push: the project connected to the site's repository, and
 * its production domain from Vercel's project domains. Held here:
 *   · a site whose repository has a project connected and never deployed:
 *     the one push says og:url on its production domain (not the branch's,
 *     not a redirect); one deployment;
 *   · a new site, no repository or project yet: the one push names no og:url
 *     and one deployment is made; the next press, once live, says og:url on
 *     the address.
 *
 * Stand-ins for GitHub and Vercel, as tests/go-live-bar.mjs.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GH_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/go-live-head.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "STANDIN_GITHUB_TOKEN_0000";
const VC_TOKEN = "STANDIN_VERCEL_TOKEN_0000";
const ADDRESS = "https://top-bar.vercel.app";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ghSeen = [];
let lastCommit = "c0ffee0000";
const blobs = new Map();
/** Each push's files, path → text. */
const trees = [];
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
  if (rest === "/git/blobs") { const sha = `b${ghSeen.length}`; const b = JSON.parse(body || "{}"); blobs.set(sha, b.encoding === "base64" ? Buffer.from(b.content ?? "", "base64").toString("utf8") : String(b.content ?? "")); return send(201, { sha }); }
  if (rest === "/git/trees") { const t = JSON.parse(body || "{}"); trees.push(Object.fromEntries((t.tree ?? []).map((e) => [e.path, e.content ?? blobs.get(e.sha) ?? null]))); return send(201, { sha: "tree1" }); }
  if (rest === "/git/commits") { lastCommit = `c0ffee${String(ghSeen.length).padStart(4, "0")}`; return send(201, { sha: lastCommit, html_url: "https://example.invalid/c" }); }
  if (rest.startsWith("/git/refs")) {
    /* Vercel's Git link, played: a push to a repository a project is linked to
       deploys that project on its own, a moment later (tests/go-live-linked.mjs). */
    const [org, name] = m[1].split("/");
    const linked = projects.find((p) => p.link?.org === org && p.link?.repo === name);
    if (linked && req.method !== "GET") { const s = lastCommit; setTimeout(() => deployments.push({ id: `dpl_${deployments.length + 1}`, polls: 0, by: "git", project: linked.id, sha: s, at: Date.now() }), 600); }
    return send(200, { object: { sha: lastCommit } });
  }
  return send(404, { message: "Not Found" });
});

const vcSeen = [];
/** One connected by an earlier press and never deployed, with its domains. */
const projects = [{ id: "prj_earlier", name: "earlier", link: { type: "github", org: "someone", repo: "earlier", repoId: 900 } }];
/** Every deployment asked for, and how many times each has been polled. */
const deployments = [];
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const path = new URL(req.url, "http://x").pathname;
  vcSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  if (path === "/v9/projects" && req.method === "GET") return send(200, { projects, pagination: { next: null } });
  if (path === "/v9/projects/prj_earlier/domains" && req.method === "GET") return send(200, { domains: [
    { name: "earlier-git-main-someone.vercel.app", gitBranch: "main", redirect: null },
    { name: "old.example", redirect: "earlier-site.vercel.app", gitBranch: null },
    { name: "earlier-site.vercel.app", redirect: null, gitBranch: null },
  ] });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    const [org, name] = String(b.gitRepository?.repo ?? "").split("/");
    const p = { id: `prj_${projects.length + 1}`, name: b.name, link: { type: "github", org, repo: name, repoId: 1000 } };
    projects.push(p);
    return send(200, p);
  }
  /* The list the route reads to find a push's own deployment, by its commit. */
  if (/^\/v\d+\/deployments$/.test(path) && req.method === "GET") {
    const projectId = new URL(req.url, "http://x").searchParams.get("projectId");
    return send(200, { deployments: deployments.filter((x) => x.by === "git" && x.project === projectId).map((x) => ({ uid: x.id, id: x.id, readyState: x.polls >= 5 ? "READY" : "BUILDING", url: `top-bar-${x.id}.vercel.app`, created: x.at, meta: { githubCommitSha: x.sha, githubCommitRef: "main" } })) });
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    const id = `dpl_${deployments.length + 1}`;
    deployments.push({ id, polls: 0, by: "api" });
    return send(200, { id, readyState: "QUEUED", url: `top-bar-${id}.vercel.app` });
  }
  const d = path.match(/^\/v13\/deployments\/(dpl_\d+)$/);
  if (d && req.method === "GET") {
    const dep = deployments.find((x) => x.id === d[1]);
    if (!dep) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    dep.polls++;
    if (dep.polls < 5) return send(200, { readyState: "BUILDING", url: `top-bar-${dep.id}.vercel.app` });
    return send(200, { readyState: "READY", url: `top-bar-${dep.id}.vercel.app`, alias: ["top-bar-git-main-someone.vercel.app", "top-bar.vercel.app"] });
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
  if (!ghSeen.some((l) => l.includes("/repos/stand-in/probe")) || !vcSeen.includes("GET /v13/deployments/probe")) {
    console.error(`The server at ${BASE} is not pointed at the stand-ins on ${GH_PORT} and ${VC_PORT}. Start it with GITHUB_API and VERCEL_API set and no tokens of its own.`);
    stop();
    process.exit(2);
  }
  ghSeen.length = 0;
  vcSeen.length = 0;
  trees.length = 0;
  blobs.clear();
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* Nothing from the browser reaches either service: the server speaks for it. */
await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Top Bar", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [],
  }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

const bar = () => page.locator("header [data-go-live]");
const state = async () => ((await bar().count()) ? bar().first().getAttribute("data-go-live-state") : null);
const tip = async () => {
  await page.mouse.move(5, 500);
  await page.waitForTimeout(300);
  await bar().first().locator("xpath=..").hover();
  await page.waitForTimeout(900);
  const t = page.locator('[role="tooltip"]');
  return (await t.count()) ? (await t.first().textContent())?.replace(/\s+/g, " ").trim() ?? "" : "";
};
const keysIn = async (fill) => {
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  for (const [service, value] of fill) await keys.locator(`[data-service="${service}"] input[type="password"]`).first().fill(value);
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(1200);
};

await keysIn([["github", GH_TOKEN], ["vercel", VC_TOKEN]]);
const indexOf = (t) => Object.entries(t).find(([p]) => p === "index.html")?.[1] ?? "";
const metaIn = (html, key) => html.match(new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`))?.[1] ?? null;
const press = async () => {
  const n = trees.length, d = deployments.length;
  await bar().first().click().catch(() => {});
  for (let i = 0; i < 600 && !(trees.length > n && deployments.length > d && deployments.at(-1).polls >= 5); i++) await sleep(100);
  for (let i = 0; i < 120 && (await state()) === "busy"; i++) await sleep(500);
  await page.waitForTimeout(1500);
  return { pushes: trees.length - n, deployments: deployments.length - d, by: deployments.slice(d).map((x) => x.by).join(", "), html: indexOf(trees[n] ?? {}) };
};

console.log("1. A repository whose project is connected and never deployed");
await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("builder.builds")); raw.state.projects[0].repo = { owner: "someone", name: "earlier", branch: "main" }; raw.state.projects[0].bound = "made"; localStorage.setItem("builder.builds", JSON.stringify(raw)); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  const r = await press();
  /* Connected: the push is the deployment, and none is asked for (tests/go-live-linked.mjs). */
  check("one push, one deployment: the push's own", r.pushes === 1 && r.deployments === 1 && r.by === "git", `${r.pushes} pushes, ${r.deployments} deployments (${r.by})`);
  check("the push says og:url on the project's production domain, not the branch's or a redirect", metaIn(r.html, "og:url") === "https://earlier-site.vercel.app/", metaIn(r.html, "og:url"));
}

console.log("2. A new site: no repository and no project yet");
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Top Bar", updatedAt: Date.now() }], activeId: "s1" }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  const r = await press();
  check("one push, one deployment", r.pushes === 1 && r.deployments === 1, `${r.pushes} pushes, ${r.deployments} deployments`);
  check("the push names no og:url: the address is not known yet", !!r.html && metaIn(r.html, "og:url") === null, metaIn(r.html, "og:url"));
  const p = await project();
  check("the address is recorded once live", p?.live?.url === ADDRESS, p?.live?.url);
  const again = await press();
  /* The first press made the project, linked to the repository, so this push deploys itself. */
  check("the next press, once live, says og:url on it, in one deployment", again.pushes === 1 && again.deployments === 1 && again.by === "git" && metaIn(again.html, "og:url") === `${ADDRESS}/`, `${again.pushes} pushes, ${again.deployments} deployments (${again.by}), ${metaIn(again.html, "og:url")}`);
}
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
