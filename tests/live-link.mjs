#!/usr/bin/env node
/**
 * ONE PRESS FROM BOARD TO A LIVE LINK.
 *
 * Publish makes a site its own repository, and nothing gave that repository
 * an address: the deploy route only built a Vercel project already connected
 * to the repository, and answered "no-project" for a repository made a
 * moment earlier. So a site's first Go live never went live.
 *
 * What is held here, all of it against stand-ins, nothing against GitHub or
 * Vercel:
 *   · Go live on a site with no repository makes one (GitHub), makes a Vercel
 *     project connected to it and named after the site, waits for its first
 *     deployment, and hands back the production address; the site records it
 *     and the Builder shows it as a link.
 *   · A second Go live makes no second project and shows the same address,
 *     and so does a plain Push to GitHub.
 *   · Every failure is said in words: no Vercel token; Vercel's GitHub app
 *     cannot see the repository (and how to grant it); a name clash; a build
 *     that fails, with Vercel's own reason.
 *   · Vercel is never connected to a repository a site was brought in from,
 *     nor to one that holds a capture: the same rule as Publish.
 *
 * The server is started pointed at both stand-ins and with no token of its
 * own; the test proves that before it presses anything, and every token it
 * sends is a placeholder.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/live-link.mjs http://127.0.0.1:3013
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

/* ------------------------------------------------------------ GitHub */
const ghSeen = [];
const CAPTURED = new Set(["someone/captured", "sparkygogo77-spec/sink"]);
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
  if (rest.startsWith("/contents/site/capture")) return CAPTURED.has(m[1].toLowerCase()) ? send(200, [{ name: "home.json" }]) : send(404, { message: "Not Found" });
  if (rest.startsWith("/git/ref/heads/")) return send(200, { object: { sha: "tip0" } });
  if (rest.startsWith("/git/commits/")) return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs") return send(201, { sha: `b${ghSeen.length}` });
  if (rest === "/git/trees") return send(201, { sha: "tree1" });
  if (rest === "/git/commits") return send(201, { sha: "commit1", html_url: "https://example.invalid/c" });
  if (rest.startsWith("/git/refs")) return send(200, { object: { sha: "commit1" } });
  return send(404, { message: "Not Found" });
});

/* ------------------------------------------------------------ Vercel */
const vcSeen = [];
/** Projects on the account, as Vercel lists them. */
const projects = [];
/** Deployments, and how many times each has been asked after. */
const deployments = new Map();
/** Names Vercel says are taken, and repositories its GitHub app cannot see. */
const TAKEN = new Set(["clash"]);
const HIDDEN = new Set(["someone/hidden"]);
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  vcSeen.push({ line: `${req.method} ${path}`, body: body ? JSON.parse(body) : null });
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  if (path === "/v9/projects" && req.method === "GET") return send(200, { projects, pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    const repo = String(b.gitRepository?.repo ?? "");
    if (HIDDEN.has(repo.toLowerCase())) {
      return send(400, { error: { code: "bad_request", message: "To link a GitHub repository, you need to install the GitHub integration first. Make sure there aren't any typos and that you have access to the repository if it's private.", action: "Install GitHub App", link: "https://github.com/apps/vercel/installations/new" } });
    }
    if (TAKEN.has(b.name) || projects.some((p) => p.name === b.name)) return send(409, { error: { code: "conflict", message: `A project with the name "${b.name}" already exists.` } });
    const [org, name] = repo.split("/");
    const p = { id: `prj_${projects.length + 1}`, name: b.name, link: { type: "github", org, repo: name, repoId: 1000 + projects.length } };
    projects.push(p);
    return send(200, p);
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    const p = projects.find((x) => x.id === b.project);
    const id = `dpl_${deployments.size + 1}`;
    const failing = p?.name === "breaks";
    deployments.set(id, { project: p, asked: 0, failing });
    return send(200, { id, readyState: "QUEUED", url: `${p?.name ?? "x"}-${id}.vercel.app`, inspectorUrl: `https://vercel.invalid/${id}` });
  }
  const d = path.match(/^\/v13\/deployments\/([^/]+)$/);
  if (d && req.method === "GET") {
    const dep = deployments.get(d[1]);
    if (!dep) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    dep.asked++;
    const name = dep.project?.name ?? "x";
    if (dep.asked < 2) return send(200, { readyState: "BUILDING", url: `${name}-${d[1]}.vercel.app` });
    if (dep.failing) return send(200, { readyState: "ERROR", url: `${name}-${d[1]}.vercel.app`, errorMessage: 'Command "npm run build" exited with 1' });
    return send(200, { readyState: "READY", url: `${name}-${d[1]}.vercel.app`, alias: [`${name}-git-main-someone.vercel.app`, `${name}.vercel.app`] });
  }
  return send(404, { error: { code: "not_found", message: "Not found" } });
});
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));
await new Promise((ok) => vc.listen(VC_PORT, "127.0.0.1", ok));
const stop = () => { gh.close(); vc.close(); };

const route = async (path, init = {}) => {
  const r = await fetch(`${BASE}${path}`, { ...init, headers: { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN, ...(init.headers ?? {}) } });
  return r.json();
};
const deployRoute = (body, headers = {}) => route("/api/studio/deploy", { method: "POST", body: JSON.stringify(body), headers });

/* Both stand-ins answer for the server, or nothing is pressed. */
{
  await route("/api/studio/publish", { method: "POST", body: JSON.stringify({ files: [{ path: "index.html", content: "x" }], repo: "stand-in/probe", branch: "main", deploy: false }) }).catch(() => null);
  await route("/api/studio/deploy?id=probe").catch(() => null);
  const ghOk = ghSeen.some((l) => l.includes("/repos/stand-in/probe"));
  const vcOk = vcSeen.some((c) => c.line === "GET /v13/deployments/probe");
  if (!ghOk || !vcOk) {
    console.error(`The server at ${BASE} did not call ${!ghOk ? `the GitHub stand-in on ${GH_PORT}` : ""}${!ghOk && !vcOk ? " or " : ""}${!vcOk ? `the Vercel stand-in on ${VC_PORT}` : ""}. Start it with GITHUB_API=http://127.0.0.1:${GH_PORT} VERCEL_API=http://127.0.0.1:${VC_PORT} and no tokens of its own.`);
    stop();
    process.exit(2);
  }
  ghSeen.length = 0;
  vcSeen.length = 0;
}
const made = () => vcSeen.filter((c) => /^POST \/v\d+\/projects$/.test(c.line));

/* ------------------------------------------------------------ the browser */
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
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Kept Live", updatedAt: Date.now() }], activeId: "s1" }));
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
const openBrief = async () => { await page.evaluate(() => window.__studioOpenBrief?.()); await page.waitForTimeout(1500); };
const closeBrief = async () => { await page.keyboard.press("Escape"); await page.waitForTimeout(400); };
/** Press a Publish button and wait until the dialog is no longer busy. */
const pressAndSettle = async (name) => {
  await openBrief();
  await page.getByRole("button", { name }).first().click({ timeout: 15000 });
  await page.waitForTimeout(800);
  for (let i = 0; i < 120; i++) {
    const busy = await page.evaluate(() => /Pushing|Asking Vercel|Building|Queued|Waiting for Vercel|Finishing/.test(document.querySelector("[data-brief-publish]")?.textContent ?? ""));
    if (!busy) break;
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
  const link = await page.evaluate(() => { const a = document.querySelector("[data-live-address]"); return a ? { href: a.getAttribute("href"), text: a.textContent } : null; });
  const says = await page.evaluate(() => (document.querySelector("[data-brief-publish]")?.textContent ?? "").replace(/\s+/g, " "));
  await closeBrief();
  return { link, says };
};

console.log("1. Go live on a site with no repository");
const first = await pressAndSettle(/Go live/);
const p1 = await project();
const madeFirst = made();
console.log(`  Vercel was asked: ${vcSeen.map((c) => c.line).join(", ") || "nothing"}`);
check("GitHub made the site its repository", p1?.repo?.name === "kept-live", `repo = ${p1?.repo ? `${p1.repo.owner}/${p1.repo.name}` : null}`);
check("a Vercel project was made, connected to that repository and named after the site",
  madeFirst.length === 1 && madeFirst[0].body?.gitRepository?.repo === "someone/kept-live" && madeFirst[0].body?.gitRepository?.type === "github" && madeFirst[0].body?.name === "kept-live",
  JSON.stringify(madeFirst.map((c) => c.body)));
const dep = vcSeen.find((c) => c.line === "POST /v13/deployments");
check("its first deployment was asked for, from that repository", dep?.body?.project === "prj_1" && dep?.body?.gitSource?.repo === "kept-live", JSON.stringify(dep?.body ?? null));
check("the site records the production address", p1?.live?.url === "https://kept-live.vercel.app", `live = ${p1?.live?.url ?? null}`);
check("the Builder shows it as a link to press", first.link?.href === "https://kept-live.vercel.app", JSON.stringify(first.link) + (first.link ? "" : ` · the card says: ${first.says.slice(0, 220)}`));

console.log("2. A later Go live, and a plain Push to GitHub");
const before = made().length;
const second = await pressAndSettle(/Go live/);
check("no second Vercel project is made", made().length === before, `${made().length} made in all`);
check("the same address, recorded and shown", (await project())?.live?.url === "https://kept-live.vercel.app" && second.link?.href === "https://kept-live.vercel.app", JSON.stringify(second.link));
const push = await pressAndSettle(/Push to GitHub/);
check("a plain Push to GitHub shows the same address", push.link?.href === "https://kept-live.vercel.app", JSON.stringify(push.link));
check("no page error on the way", errors.length === 0, errors.join(" / "));
await browser.close();

console.log("3. Every failure, in words");
{
  const r = await deployRoute({ repo: "someone/tokenless", branch: "main" }, { "x-vercel-token": "" });
  check("no Vercel token: says where one goes", r.ok === false && r.reason === "no-token" && /keys panel|VERCEL_TOKEN/.test(r.message ?? ""), r.message);
}
{
  const r = await deployRoute({ repo: "someone/hidden", branch: "main", name: "Hidden" });
  check("Vercel's GitHub app cannot see the repository: said, with how to grant it",
    r.ok === false && r.reason === "github-access" && /someone\/hidden/.test(r.message ?? "") && /github\.com\/(settings\/installations|apps\/vercel)/.test(r.message ?? "") && /Repository access|repositor(y|ies) it can see/i.test(r.message ?? ""),
    r.message);
}
{
  const r = await deployRoute({ repo: "someone/clash", branch: "main", name: "Clash" });
  const clashMade = projects.find((p) => p.link.repo === "clash");
  check("a name clash is said, and the project gets a name of its own", r.ok === true && clashMade?.name === "clash-1" && /clash/.test(r.note ?? "") && /already/.test(r.note ?? ""), JSON.stringify({ ok: r.ok, project: r.project, note: r.note, message: r.message }));
}
{
  const r = await deployRoute({ repo: "someone/breaks", branch: "main", name: "Breaks" });
  let s = null;
  for (let i = 0; i < 4 && r.ok; i++) { s = await route(`/api/studio/deploy?id=${r.id}`); if (s.done) break; }
  check("a failing build says so with Vercel's own reason", s?.state === "ERROR" && /npm run build" exited with 1/.test(s?.message ?? ""), JSON.stringify(s ?? r));
}

console.log("4. Never connected to where a site came from");
{
  const n = made().length;
  const r = await deployRoute({ repo: "someone/brought", branch: "main", name: "Brought", sources: ["someone/brought"] });
  check("a source repository is refused, in words, and no project is made", r.ok === false && r.reason === "source" && made().length === n, JSON.stringify({ reason: r.reason, message: r.message }));
}
{
  const n = made().length;
  const r = await deployRoute({ repo: "someone/captured", branch: "main", name: "Captured" });
  check("a repository holding site/capture/ is refused, in words, and no project is made", r.ok === false && r.reason === "capture" && made().length === n, JSON.stringify({ reason: r.reason, message: r.message }));
}
check("not one Vercel project was connected to a capture or a source", !made().some((c) => /captured|brought|sink/.test(c.body?.gitRepository?.repo ?? "")));

stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
