#!/usr/bin/env node
/**
 * THE FIRST GO LIVE WRITES THE LINK PREVIEW ON THE ADDRESS IT GETS.
 *
 * stonkfun's copy went live for the first time and its pages said
 * og:image="assets/pictures/…" and no og:url: before the first deploy the
 * address is not known (Vercel names it, suffix and all), and a relative
 * og:image draws no card. Held here:
 *   · the first press pushes twice: the pages as written before the
 *     address was known, then, once Vercel has said it, the pages again;
 *   · the second push's index.html says og:url on that address, the first
 *     says none and names nothing relative;
 *   · a press once live pushes once.
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

console.log("1. The first press: twice, the second on the address");
{
  await bar().first().click();
  for (let i = 0; i < 600 && !(trees.length >= 2 && deployments.length >= 2 && (await state()) !== "busy"); i++) await sleep(100);
  await page.waitForTimeout(800);
  const p = await project();
  check("the address is recorded", p?.live?.url === ADDRESS, p?.live?.url);
  check("two pushes and two deployments", trees.length === 2 && deployments.length === 2, `${trees.length} pushes, ${deployments.length} deployments`);
  const first = indexOf(trees[0] ?? {}), second = indexOf(trees[1] ?? {});
  check("the first push names no og:url and nothing relative", !!first && metaIn(first, "og:url") === null && !/content="assets\//.test(first), first.match(/<head>[\s\S]*?<\/head>/)?.[0]?.slice(0, 400));
  check("the second push says og:url on the address", metaIn(second, "og:url") === `${ADDRESS}/`, metaIn(second, "og:url"));
}
console.log("2. Live: one press, one push");
{
  const n = trees.length, d = deployments.length;
  await bar().first().click().catch(() => {});
  for (let i = 0; i < 600 && !(trees.length > n && deployments[d]?.polls >= 5 && (await state()) !== "busy"); i++) await sleep(100);
  await page.waitForTimeout(1500);
  check("once live a press pushes once, on the address from the start", trees.length === n + 1 && metaIn(indexOf(trees[n] ?? {}), "og:url") === `${ADDRESS}/`, `${trees.length - n} pushes`);
}
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
