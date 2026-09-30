#!/usr/bin/env node
/**
 * GO LIVE SAYS WHY VERCEL REFUSED, AND PASSES THE TEAM THE WAY VERCEL READS IT.
 *
 * The first real Go live pushed to GitHub and then stopped at Vercel, which
 * answered "You don't have permission to create the project." The route
 * returned that, and neither the top-bar button nor the book's row said a
 * word of it: the owner saw nothing.
 *
 * Held here, against stand-ins for GitHub and Vercel:
 *   · the team goes as ?teamId= when it is a team_ id and as ?slug= when it
 *     is a slug; the Vercel stand-in refuses either sent the other way, with
 *     Vercel's own 403, as a real team does;
 *   · a refusal is shown on the top-bar Go live, without hovering, and in the
 *     book's publish row, in Vercel's words, with a one-line hint at the fix.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 npx next start -p 3013
 *   node tests/go-live-refused.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const VC_PORT = Number(process.env.VC_PORT ?? 4334);
const GH_TOKEN = "not-a-token-placeholder-xxxx";
const VC_TOKEN = "not-a-vercel-token-placeholder";
const TEAM_ID = "team_TESTONLY0000000000000000";
const TEAM_SLUG = "someone-projects";
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
const REFUSED = { error: { code: "forbidden", message: "You don't have permission to create the project." } };
/**
 * The team a call is scoped to, as Vercel reads it: ?teamId= takes an id,
 * ?slug= takes a slug. The wrong one names no team this token is in, and
 * Vercel answers 403. No team at all is the personal scope, where this
 * account cannot make projects either.
 */
const scope = (url) => {
  const id = url.searchParams.get("teamId");
  const slug = url.searchParams.get("slug");
  if (id) return id === TEAM_ID ? "team" : "wrong";
  if (slug) return slug === TEAM_SLUG ? "team" : "wrong";
  return "personal";
};
const vc = http.createServer(async (req, res) => {
  const body = await readBody(req);
  const url = new URL(req.url, "http://x");
  const path = url.pathname;
  vcSeen.push(`${req.method} ${path}${url.search}`);
  const send = (s, o) => { res.writeHead(s, { "content-type": "application/json" }); res.end(JSON.stringify(o)); };
  if (!/^Bearer .{9,}/.test(req.headers.authorization ?? "")) return send(403, { error: { code: "forbidden", message: "Not authorized" } });
  const where = scope(url);
  if (path === "/v9/projects" && req.method === "GET") return where === "wrong" ? send(403, REFUSED) : send(200, { projects: where === "team" ? projects : [], pagination: { next: null } });
  if (/^\/v\d+\/projects$/.test(path) && req.method === "POST") {
    if (where !== "team") return send(403, REFUSED);
    const b = JSON.parse(body || "{}");
    const [org, name] = String(b.gitRepository?.repo ?? "").split("/");
    const p = { id: `prj_${projects.length + 1}`, name: b.name, link: { type: "github", org, repo: name, repoId: 1000 + projects.length } };
    projects.push(p);
    return send(200, p);
  }
  if (path === "/v13/deployments" && req.method === "POST") {
    if (where !== "team") return send(403, REFUSED);
    const b = JSON.parse(body || "{}");
    const id = `dpl_${deployments.length + 1}`;
    deployments.push({ id, polls: 0, name: projects.find((p) => p.id === b.project)?.name ?? "x" });
    return send(200, { id, readyState: "QUEUED", url: `${id}.vercel.app` });
  }
  const d = path.match(/^\/v13\/deployments\/(dpl_\d+)$/);
  if (d && req.method === "GET") {
    if (where !== "team") return send(403, { error: { code: "forbidden", message: "Not authorized" } });
    const dep = deployments.find((x) => x.id === d[1]);
    if (!dep) return send(404, { error: { code: "not_found", message: "Deployment not found" } });
    dep.polls++;
    if (dep.polls < 2) return send(200, { readyState: "BUILDING", url: `${dep.id}.vercel.app` });
    return send(200, { readyState: "READY", url: `${dep.id}.vercel.app`, alias: [`${dep.name}.vercel.app`] });
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

const route = async (body, headers = {}) => (await fetch(`${BASE}/api/studio/deploy`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-github-token": GH_TOKEN, "x-vercel-token": VC_TOKEN, ...headers },
  body: JSON.stringify(body),
})).json();

console.log("1. The team, as Vercel reads it");
{
  const before = vcSeen.length;
  const r = await route({ repo: "someone/by-id", branch: "main", name: "By Id", team: TEAM_ID });
  const made = vcSeen.slice(before).find((l) => /^POST \/v11\/projects/.test(l)) ?? "";
  check("a team_ id goes as ?teamId=, and the project is made", r.ok === true && made.includes(`teamId=${TEAM_ID}`) && !made.includes("slug="), `${made} → ${r.ok ? `made ${r.project}` : r.message}`);
}
{
  const before = vcSeen.length;
  const r = await route({ repo: "someone/by-slug", branch: "main", name: "By Slug", team: TEAM_SLUG });
  const made = vcSeen.slice(before).find((l) => /^POST \/v11\/projects/.test(l)) ?? "";
  check("a slug goes as ?slug=, and the project is made", r.ok === true && made.includes(`slug=${TEAM_SLUG}`) && !made.includes("teamId="), `${made} → ${r.ok ? `made ${r.project}` : r.message}`);
}
{
  const r = await route({ repo: "someone/no-team", branch: "main", name: "No Team" });
  check("Vercel's refusal comes back in its own words, with a hint at the fix", r.ok === false && /You don't have permission to create the project/.test(r.message ?? "") && /team|scope|GitHub app/i.test(r.hint ?? ""), JSON.stringify({ reason: r.reason, message: r.message, hint: r.hint }));
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/api\.(github|vercel)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Refused", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [],
  }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const keysIn = async (team) => {
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill(GH_TOKEN);
  await keys.locator('[data-service="vercel"] input[type="password"]').first().fill(VC_TOKEN);
  await keys.locator('[data-service="vercel"] input:not([type="password"])').first().fill(team);
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(1200);
};
const bar = () => page.locator("header [data-go-live]").first();
const pressAndWait = async () => {
  await bar().click();
  await page.waitForTimeout(800);
  for (let i = 0; i < 120 && (await bar().getAttribute("data-go-live-state")) === "busy"; i++) await page.waitForTimeout(250);
  await page.waitForTimeout(800);
};

console.log("2. Refused by Vercel, pressed from the top bar");
await keysIn("");
await pressAndWait();
{
  const said = await page.evaluate(() => document.querySelector("header [data-go-live-said]")?.textContent?.replace(/\s+/g, " ").trim() ?? "");
  const visible = await page.locator("header [data-go-live-said]").first().isVisible().catch(() => false);
  /* In plain words now, with the fix beside it; Vercel's own words one press away under "details" (tests/publish-status-line.mjs). */
  check("the top bar shows the refusal without hovering, in plain words, with the hint", visible && /saved on GitHub.*but Vercel would not build it/.test(said) && /team|scope|GitHub app/i.test(said), JSON.stringify(said));
  await page.locator("header [data-go-live-details]").click();
  await page.waitForTimeout(400);
  const folded = await page.evaluate(() => document.querySelector("[data-go-live-detail]")?.textContent ?? "");
  check("…and Vercel's own words are under 'details'", /You don't have permission to create the project/.test(folded), JSON.stringify(folded));
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1200);
  const row = await page.evaluate(() => document.querySelector("[data-brief-publish] [data-live-refused]")?.textContent?.replace(/\s+/g, " ").trim() ?? "");
  check("the book's publish row shows the same refusal and hint", /You don't have permission to create the project/.test(row) && /team|scope|GitHub app/i.test(row), JSON.stringify(row));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
}

console.log("3. With the team as a team_ id in the keys panel");
await keysIn(TEAM_ID);
await pressAndWait();
{
  const p = await project();
  const saidNow = await page.locator("header [data-go-live-said]").count();
  check("it goes live, and the refusal is gone", !!p?.live?.url && saidNow === 0, `live ${p?.live?.url ?? null}, refusal still shown: ${saidNow}`);
}
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stop();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
