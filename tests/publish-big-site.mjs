#!/usr/bin/env node
/**
 * A BIG SITE GOES UP WHOLE, IN REQUESTS THE BUILDER'S HOST WILL TAKE.
 *
 * Found getting share.xyz ready for its first Go live (sink's
 * sites/share-xyz, 128 pictures, three pages of about 4,000 parts): the push
 * was one request of 9.3 MB, its index.html alone over the route's 2 MB
 * cap, so it was refused ("index.html is over 2 MB"), and after the route
 * had already made the repository, which the refusal did not name, so every
 * press made another. On Vercel, where the Builder runs, a function takes a
 * request body of at most 4.5 MB ("Request body size",
 * vercel.com/docs/functions/limitations), so the one request would have been
 * a 413 before the route read a byte. And past 200 files the route dropped
 * the rest without a word, while the import brings up to 600 pictures.
 *
 * Held here, against a stand-in GitHub:
 *   · the route takes more than 200 files and says how many went up;
 *   · a file of a few MB goes up; one past the cap is refused in words, and
 *     so is a set past the file count, BEFORE any repository is made;
 *   · Go live of a site whose files come to more than 4.5 MB sends no
 *     request to the Builder over 4.5 MB, lands as ONE commit on the new
 *     repository's branch (after its seed, an empty repository's first), and
 *     every file arrives byte for byte, the document and the page included.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/publish-big-site.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "STANDIN_github_token_xxxx";
const VC_TOKEN = "STANDIN_vercel_token_xxxx";
/** Vercel Functions: "The maximum payload size for the request body … is 4.5 MB." */
const BODY_LIMIT = 4.5 * 1000 * 1000;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });

/* ------------------------------------------------------------ stand-in GitHub, empty repositories as GitHub keeps them */
const made = [];
/** repo → { blobs: sha → bytes, commits: [{ sha, tree, parents, entries }], tip } */
const repos = new Map();
let n = 0;
const ghSeen = [];
const gh = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const path = new URL(req.url, "http://x").pathname;
  ghSeen.push(`${req.method} ${path}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (path === "/user/repos" && req.method === "POST") {
    const name = JSON.parse(body || "{}").name;
    if (made.includes(name)) return send(422, { message: "name already exists on this account" });
    made.push(name);
    repos.set(`someone/${name}`, { blobs: new Map(), trees: new Map(), commits: [], tip: null });
    return send(201, { full_name: `someone/${name}` });
  }
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m) return send(404, { message: "Not Found" });
  if (m[1] === "stand-in/probe") return send(404, { message: "Not Found" });
  const r = repos.get(m[1]);
  if (!r) return send(404, { message: "Not Found" });
  const rest = decodeURIComponent(m[2] ?? "");
  if (!rest) return send(200, { default_branch: "main" });
  if (rest.startsWith("/contents/site/capture")) return send(404, { message: "Not Found" });
  /* An empty repository: every git data call is GitHub's 409; the contents API writes the first file and makes the root commit. */
  const empty = !r.tip;
  if (rest.startsWith("/contents/") && req.method === "PUT") {
    const b = JSON.parse(body);
    const sha = `seed${++n}`;
    const bsha = `blob${++n}`;
    r.blobs.set(bsha, Buffer.from(b.content, "base64"));
    const entries = new Map(r.tip ? r.commits.find((c) => c.sha === r.tip).entries : []);
    entries.set(rest.slice(10), bsha);
    r.commits.push({ sha, parents: r.tip ? [r.tip] : [], entries, seed: true });
    r.tip = sha;
    return send(201, { commit: { sha } });
  }
  if (rest.startsWith("/contents/")) return send(404, { message: "Not Found" });
  if (empty && rest.startsWith("/git/")) return send(409, { message: "Git Repository is empty." });
  if (rest.startsWith("/git/ref/heads/")) return send(200, { object: { sha: r.tip } });
  if (rest.startsWith("/git/commits/") && req.method === "GET") return send(200, { tree: { sha: `tree-of-${rest.slice(13)}` } });
  if (rest === "/git/blobs" && req.method === "POST") {
    const b = JSON.parse(body);
    const sha = `blob${++n}`;
    r.blobs.set(sha, b.encoding === "base64" ? Buffer.from(b.content, "base64") : Buffer.from(b.content, "utf8"));
    return send(201, { sha });
  }
  if (rest === "/git/trees" && req.method === "POST") {
    const b = JSON.parse(body);
    const base = b.base_tree ? r.commits.find((c) => `tree-of-${c.sha}` === b.base_tree)?.entries : null;
    const entries = new Map(base ?? []);
    for (const e of b.tree) entries.set(e.path, e.sha);
    const sha = `tree${++n}`;
    r.trees.set(sha, entries);
    return send(201, { sha });
  }
  if (rest === "/git/commits" && req.method === "POST") {
    const b = JSON.parse(body);
    const sha = `commit${++n}`;
    r.commits.push({ sha, parents: b.parents, entries: r.trees.get(b.tree) });
    return send(201, { sha, html_url: "https://example.invalid/c" });
  }
  if (rest.startsWith("/git/refs") && (req.method === "PATCH" || req.method === "POST")) {
    const b = JSON.parse(body);
    r.tip = b.sha;
    return send(200, { object: { sha: b.sha } });
  }
  return send(404, { message: "Not Found" });
});

/* ------------------------------------------------------------ stand-in Vercel */
const projects = [];
const deployments = [];
const vcSeen = [];
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
  if (path === "/v13/deployments" && req.method === "POST") { const id = `dpl_${deployments.length + 1}`; deployments.push({ id, polls: 0 }); return send(200, { id, readyState: "QUEUED", url: `${id}.vercel.app` }); }
  const d = path.match(/^\/v13\/deployments\/(dpl_\d+)$/);
  if (d && req.method === "GET") { const dep = deployments.find((x) => x.id === d[1]); if (!dep) return send(404, { error: { message: "no" } }); dep.polls++; return send(200, dep.polls < 2 ? { readyState: "BUILDING", url: `${dep.id}.vercel.app` } : { readyState: "READY", url: `${dep.id}.vercel.app`, alias: ["big-site.vercel.app"] }); }
  if (path === "/v13/deployments/probe") return send(404, { error: { code: "not_found", message: "Deployment not found" } });
  return send(404, { error: { code: "not_found", message: "Not found" } });
});
await new Promise((ok) => gh.listen(GH_PORT, "127.0.0.1", ok));
await new Promise((ok) => vc.listen(VC_PORT, "127.0.0.1", ok));
const stop = () => { gh.close(); vc.close(); };
{
  const headers = { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN };
  await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers, body: JSON.stringify({ files: [{ path: "index.html", content: "x" }], repo: "stand-in/probe", branch: "main", deploy: false }) }).catch(() => null);
  await fetch(`${BASE}/api/studio/deploy?id=probe`, { headers }).catch(() => null);
  if (!ghSeen.some((l) => l.includes("/repos/stand-in/probe")) || !vcSeen.includes("GET /v13/deployments/probe")) {
    console.error(`The server at ${BASE} is not pointed at the stand-ins on ${GH_PORT} and ${VC_PORT}. Start it with GITHUB_API and VERCEL_API set and no tokens of its own.`);
    stop();
    process.exit(2);
  }
}

const post = async (body) => {
  const res = await fetch(`${BASE}/api/studio/publish`, { method: "POST", headers: { "content-type": "application/json", "x-github-token": GH_TOKEN }, body: JSON.stringify(body) });
  return res.json().catch(() => ({ ok: false, message: `HTTP ${res.status}` }));
};
const tipFiles = (repo) => { const r = repos.get(repo); const c = r?.commits.find((x) => x.sha === r.tip); return c ? new Map([...c.entries].map(([p, sha]) => [p, r.blobs.get(sha)])) : new Map(); };

console.log("1. The route");
{
  const files = Array.from({ length: 250 }, (_, i) => ({ path: `assets/pictures/p${i}.txt`, content: `picture ${i}` }));
  /* Blobs go up one at a time with a gap, under GitHub's rate limit, and a
     call stops at its time budget with `resume`: the browser's next call
     carries on from what was staged (tests/publish-steady.mjs). So the route
     is followed the way the browser follows it, and what is held is the end:
     every file in ONE commit on ONE repository, however many calls it took. */
  const all = [{ path: "index.html", content: "<p>hi</p>" }, ...files];
  let r = await post({ files: all, create: "many-files", deploy: false });
  let calls = 1;
  /* Each answer names what THAT call put up; the browser keeps the running whole (agent.ts), and so does this. */
  const staged = new Map();
  while (r.ok === false && r.reason === "resume" && calls < 12) {
    for (const x of r.staged ?? []) staged.set(x.path, x.sha);
    if (r.wait) await new Promise((ok) => setTimeout(ok, r.wait * 1000));
    const pending = new Set(r.pending ?? []);
    r = await post({ files: all.filter((f) => pending.has(f.path)), staged: [...staged].map(([path, sha]) => ({ path, sha })), repo: r.repo, branch: r.branch, deploy: false });
    calls++;
  }
  const up = tipFiles("someone/many-files");
  const commits = repos.get("someone/many-files")?.commits.filter((c) => !c.seed).length ?? 0;
  check("251 files: all go up, and the answer says 251", r.ok === true && r.files === 251 && up.size === 251, `${r.ok ? `files ${r.files}` : r.message}; ${up.size} in the commit, over ${calls} call${calls === 1 ? "" : "s"}`);
  check("…in one commit on one repository, however many calls it took", commits === 1 && made.filter((x) => x === "many-files").length === 1, `${commits} commits, ${made.length} repositories made`);
}
{
  const big = "<p>" + "a long page of parts ".repeat(150_000) + "</p>";
  const r = await post({ files: [{ path: "index.html", content: big }], create: "three-mb", deploy: false });
  const up = tipFiles("someone/three-mb");
  check(`a ${(big.length / 1e6).toFixed(1)} MB page goes up`, r.ok === true && up.get("index.html")?.toString("utf8") === big, r.ok ? "" : r.message);
}
{
  const before = made.length;
  const r = await post({ files: [{ path: "index.html", content: "x".repeat(26 * 1024 * 1024) }], create: "too-big", deploy: false });
  check("a file past the cap is refused in words, and no repository is made", r.ok === false && r.reason === "too-big" && /index\.html/.test(r.message ?? "") && made.length === before, `${r.reason}: ${r.message}; repositories made ${made.length - before}`);
}
{
  const before = made.length;
  const files = Array.from({ length: 2001 }, (_, i) => ({ path: `f${i}.txt`, content: "x" }));
  const r = await post({ files, create: "too-many", deploy: false });
  check("more files than the route takes is refused in words, not cut short, and no repository is made", r.ok === false && /2001|2,001/.test(r.message ?? "") && made.length === before, `${r.reason}: ${r.message}; repositories made ${made.length - before}`);
}

console.log("2. Go live of a site bigger than one request");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const sent = [];
page.on("request", (q) => { if (q.url().includes("/api/studio/") && q.method() === "POST") sent.push({ url: new URL(q.url()).pathname, bytes: Buffer.byteLength(q.postData() ?? "", "utf8") }); });
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
/* Forty parts of about 100,000 characters each: well past 4.5 MB as the page and the document, as share.xyz is. */
/* Words that do not pack, as pictures do not: a push past 4.5 MB even packed, so it has to go in parts. */
const words = (i) => { let x = 2166136261 ^ i; return Array.from({ length: 11000 }, () => { let w = ""; for (let c = 0; c < 8; c++) { x = Math.imul(x ^ (x >>> 13), 1597334677) >>> 0; w += (x % 36).toString(36); } return w; }).join(" "); };
await page.evaluate((parts) => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Big Site", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [],
    brief: { name: "Big Site", gimmick: "", master: "" },
    nodes: parts.map((content, i) => ({ id: `n${i}`, pageId: "page_home", featureId: "prose", label: "words", prompt: "", content, data: "", x: 40, y: 40 + i * 120, w: 900, h: 100, groupId: null, options: {}, priority: "must", custom: false })),
  }));
}, Array.from({ length: 40 }, (_, i) => words(i)));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2000);
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
  await page.waitForTimeout(800);
}
const want = await page.evaluate(async () => {
  const files = await window.__studioExport();
  return files.map((f) => ({ path: f.path, bytes: f.encoding === "base64" ? Math.floor(f.content.length * 3 / 4) : new TextEncoder().encode(f.content).length, text: f.encoding === "base64" ? null : f.content }));
});
const wantBytes = want.reduce((a, f) => a + f.bytes, 0);
console.log(`  the export: ${want.length} files, ${(wantBytes / 1e6).toFixed(2)} MB`);
const bar = page.locator("header [data-go-live]").first();
await bar.click();
await page.waitForTimeout(1000);
for (let i = 0; i < 240 && (await bar.getAttribute("data-go-live-state")) === "busy"; i++) await page.waitForTimeout(500);
await page.waitForTimeout(800);
const said = await page.evaluate(() => document.querySelector("header [data-go-live-said]")?.textContent?.replace(/\s+/g, " ").trim() ?? "");
const toBuilder = sent.filter((s) => s.url === "/api/studio/publish");
const biggest = Math.max(0, ...toBuilder.map((s) => s.bytes));
check("it goes in parts, and no request to the Builder is over 4.5 MB", toBuilder.length >= 2 && biggest <= BODY_LIMIT, `${toBuilder.length} publish requests, the biggest ${(biggest / 1e6).toFixed(2)} MB`);
const repo = "someone/big-site";
const r = repos.get(repo);
const up = tipFiles(repo);
const project = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);
check("it went live", !!project?.live?.url && !said, `live ${project?.live?.url ?? null}; said ${JSON.stringify(said.slice(0, 200))}`);
const own = (r?.commits ?? []).filter((c) => !c.seed);
check("one commit of the site on the branch, after an empty repository's seed", own.length === 1 && r.tip === own[0].sha, (r?.commits ?? []).map((c) => `${c.sha}${c.seed ? " (seed)" : ""}`).join(", "));
const upBytes = [...up.values()].reduce((a, b) => a + b.length, 0);
check("the site is bigger than one request may be", upBytes > BODY_LIMIT, `${(upBytes / 1e6).toFixed(2)} MB went up`);
const page0 = want.find((f) => f.path === "index.html");
check("the page arrives byte for byte", !!page0 && up.get("index.html")?.toString("utf8") === page0.text, `${up.get("index.html")?.length ?? 0} of ${page0?.bytes ?? 0} bytes`);
const doc = up.get("site/document.json")?.toString("utf8");
let parsed = null; try { parsed = JSON.parse(doc); } catch { /* */ }
check("the document arrives whole, every part's words in it", !!parsed && parsed.nodes?.length === 40 && parsed.nodes.every((x, i) => x.content === words(i)), `${doc?.length ?? 0} bytes, ${parsed?.nodes?.length ?? 0} parts`);
const missing = want.filter((f) => !up.has(f.path)).map((f) => f.path);
check("every exported file is in the commit", missing.length === 0, missing.slice(0, 5).join(", "));
check("one deployment", deployments.length === 1, `${deployments.length}`);
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
