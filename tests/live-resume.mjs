#!/usr/bin/env node
/**
 * THE ADDRESS LANDS EVEN IF THE PAGE WAS RELOADED, OR THE TAB CLOSED, DURING THE BUILD.
 *
 * Go live pushes, has Vercel build, and follows the build from this page. A
 * reload, or a closed tab, ended that: measured on c76d112, polling stopped
 * at the first poll and the site never recorded its address. The pending
 * deployment is kept on the site now, and the Builder picks it up when it
 * opens again.
 *
 *   1. Go live, reload the moment Vercel has been asked for the deployment.
 *   2. Go live again, close the tab at the same moment, open a new one.
 * Each time the site must record the address once the deployment is READY,
 * show it, and keep nothing pending.
 *
 * Stand-ins for GitHub and Vercel, as tests/live-link.mjs; each deployment
 * stays BUILDING for its first four polls.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/live-resume.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "not-a-token-placeholder-xxxx";
const VC_TOKEN = "not-a-vercel-token-placeholder";
const ADDRESS = "https://reloaded.vercel.app";
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
const projects = [];
/** Every deployment asked for, and how many times each has been polled. */
const deployments = [];
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const path = new URL(req.url, "http://x").pathname;
  vcSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  if (path === "/v9/projects" && req.method === "GET") return send(200, { projects, pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    const [org, name] = String(b.gitRepository?.repo ?? "").split("/");
    const p = { id: `prj_${projects.length + 1}`, name: b.name, link: { type: "github", org, repo: name, repoId: 1000 } };
    projects.push(p);
    return send(200, p);
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    const id = `dpl_${deployments.length + 1}`;
    deployments.push({ id, polls: 0 });
    return send(200, { id, readyState: "QUEUED", url: `reloaded-${id}.vercel.app` });
  }
  const d = path.match(/^\/v13\/deployments\/(dpl_\d+)$/);
  if (d && req.method === "GET") {
    const dep = deployments.find((x) => x.id === d[1]);
    if (!dep) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    dep.polls++;
    if (dep.polls < 5) return send(200, { readyState: "BUILDING", url: `reloaded-${dep.id}.vercel.app` });
    return send(200, { readyState: "READY", url: `reloaded-${dep.id}.vercel.app`, alias: ["reloaded-git-main-someone.vercel.app", "reloaded.vercel.app"] });
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
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1763, height: 1000 } });
/* Nothing from the browser reaches either service: the server speaks for it. */
await context.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const errors = [];
let page = await context.newPage();
page.on("pageerror", (e) => errors.push(e.message));
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Reloaded", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [],
  }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
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
  await page.waitForTimeout(500);
}

/** Go live, and the moment Vercel has been asked for a deployment, leave the page the way `leave` says. */
const goLiveAndLeave = async (leave) => {
  const n = deployments.length;
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Go live/ }).first().click({ timeout: 15000 });
  for (let i = 0; i < 120 && deployments.length === n; i++) await sleep(100);
  const dep = deployments[n];
  const pollsWhenLeft = dep?.polls ?? null;
  await leave();
  return { dep, pollsWhenLeft };
};
const followed = async (dep) => {
  let p = null;
  for (let i = 0; i < 60; i++) { p = await project(); if ((p?.live?.url && !p?.pending) || (dep?.polls ?? 0) >= 8) break; await sleep(500); }
  await sleep(1000);
  return project();
};
const shown = async () => {
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1500);
  const link = await page.evaluate(() => document.querySelector("[data-live-address]")?.getAttribute("href") ?? null);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  return link;
};

console.log("1. Reloaded while Vercel was building");
{
  const { dep, pollsWhenLeft } = await goLiveAndLeave(() => page.reload({ waitUntil: "networkidle" }));
  check("the page was reloaded while Vercel was building", !!dep && pollsWhenLeft !== null && pollsWhenLeft < 5, `deployment ${dep?.id ?? "none"}, polls when it reloaded: ${pollsWhenLeft}`);
  const p = await followed(dep);
  check("the reopened Builder followed the deployment to READY", (dep?.polls ?? 0) >= 5, `${dep?.polls ?? 0} polls`);
  check("the site records the production address", p?.live?.url === ADDRESS, `live = ${p?.live?.url ?? null}`);
  check("and holds nothing pending", !p?.pending, JSON.stringify(p?.pending ?? null));
  check("the Builder shows it as a link", (await shown()) === ADDRESS);
}

console.log("2. The tab closed while Vercel was building, and the Builder opened in a new one");
{
  await page.evaluate(() => { const raw = JSON.parse(localStorage.getItem("builder.builds")); raw.state.projects[0].live = undefined; localStorage.setItem("builder.builds", JSON.stringify(raw)); });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  const { dep, pollsWhenLeft } = await goLiveAndLeave(async () => {
    await page.close();
    page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  });
  check("the tab was closed while Vercel was building", !!dep && pollsWhenLeft !== null && pollsWhenLeft < 5, `deployment ${dep?.id ?? "none"}, polls when it closed: ${pollsWhenLeft}`);
  const p = await followed(dep);
  check("the new tab followed the deployment to READY", (dep?.polls ?? 0) >= 5, `${dep?.polls ?? 0} polls`);
  check("the site records the production address", p?.live?.url === ADDRESS && !p?.pending, `live = ${p?.live?.url ?? null}, pending = ${JSON.stringify(p?.pending ?? null)}`);
  check("the Builder shows it as a link", (await shown()) === ADDRESS);
}
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
