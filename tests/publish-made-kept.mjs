#!/usr/bin/env node
/**
 * A REPOSITORY A FIRST PUBLISH MADE IS KEPT, EVEN WHEN THE PUSH AFTER IT FAILED.
 *
 * The route makes a site its repository on its first publish, and when the
 * push into it then fails it still names what it made (`created`), so the
 * next press goes there rather than making another. The route's half of that
 * is held by tests/publish-empty.mjs. The browser's half was not: `publish()`
 * in agent.ts passed a failure on as `{ ok, message, reason }`, dropping
 * `created`, so the Brief dialog never wrote the repository on the site and
 * the next press made a second one, with a suffix, because the name was
 * taken by the first.
 *
 * This presses Push to GitHub twice on a site with no repository. GitHub is
 * a stand-in that records every call: the first press makes someone/<name>
 * and then refuses its blobs; the second is let through.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO GITHUB_API=http://127.0.0.1:4331 npx next start -p 3013
 *   node tests/publish-made-kept.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PORT = Number(process.env.STUB_PORT ?? 4331);
const TOKEN = "not-a-token-placeholder-xxxx";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------ the stand-in */
const seen = [];
/** Names already taken on the account: a second make of one is GitHub's 422. */
const made = [];
let refuseBlobs = true;
const stub = http.createServer(async (req, res) => {
  const body = await new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
  seen.push(`${req.method} ${path}`);
  const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  if (path === "/user/repos" && req.method === "POST") {
    const name = JSON.parse(body || "{}").name;
    if (made.includes(name)) return send(422, { message: "name already exists on this account" });
    made.push(name);
    return send(201, { full_name: `someone/${name}` });
  }
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m) return send(404, { message: "Not Found" });
  const rest = m[2] ?? "";
  if (!rest && req.method === "GET") return send(200, { default_branch: "main" });
  if (rest.startsWith("/contents/site/capture")) return send(404, { message: "Not Found" });
  if (rest.startsWith("/git/ref/heads/") && req.method === "GET") return send(200, { object: { sha: "tip0" } });
  if (rest.startsWith("/git/commits/") && req.method === "GET") return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs" && req.method === "POST") return refuseBlobs ? send(500, { message: "Server Error" }) : send(201, { sha: `blob${seen.length}` });
  if (rest === "/git/trees" && req.method === "POST") return send(201, { sha: "tree1" });
  if (rest === "/git/commits" && req.method === "POST") return send(201, { sha: "commit1", html_url: "https://example.invalid/commit1" });
  if (rest.startsWith("/git/refs") && (req.method === "PATCH" || req.method === "POST")) return send(200, { object: { sha: "commit1" } });
  return send(404, { message: "Not Found" });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

/* The server is pointed at the stand-in, or nothing is pressed. */
{
  await fetch(`${BASE}/api/studio/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": TOKEN },
    body: JSON.stringify({ files: [{ path: "index.html", content: "x" }], repo: "stand-in/probe", branch: "main", deploy: false }),
  }).catch(() => null);
  if (!seen.some((l) => l.includes("/repos/stand-in/probe"))) {
    console.error(`The server at ${BASE} did not call the stand-in on ${PORT}. Start it with GITHUB_API=http://127.0.0.1:${PORT} and no GITHUB_TOKEN.`);
    stub.close();
    process.exit(2);
  }
  seen.length = 0;
}

/* ------------------------------------------------------------ the browser */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route("https://api.github.com/**", (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
const answers = [];
page.on("response", async (r) => { if (r.url().endsWith("/api/studio/publish") && r.request().method() === "POST") answers.push(await r.json().catch(() => null)); });
const project = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state?.projects?.find((p) => p.id === "s1") ?? null);
const label = (r) => (r ? `${r.owner}/${r.name}` : null);

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Kept", updatedAt: Date.now() }], activeId: "s1" }));
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
  await keys.locator('[data-service="github"] input[type="password"]').first().fill(TOKEN);
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(500);
}
const press = async () => {
  const n = answers.length;
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Push to GitHub/ }).first().click({ timeout: 15000 });
  for (let i = 0; i < 120 && answers.length === n; i++) await page.waitForTimeout(500);
  await page.waitForTimeout(1500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return answers[n] ?? null;
};

console.log("1. The first press: the repository is made, and the push into it fails");
const first = await press();
console.log(`  the route answered: ${JSON.stringify({ ok: first?.ok, reason: first?.reason, created: first?.created, message: first?.message })}`);
check("the route made a repository and said so, though the push failed", first?.ok === false && first?.created === "someone/kept", JSON.stringify(first?.created));
const after1 = await project();
check("the site now names that repository as where it publishes", label(after1?.repo) === "someone/kept", `repo = ${label(after1?.repo)}`);

console.log("2. The second press");
refuseBlobs = false;
const before = seen.length;
const second = await press();
const calls = seen.slice(before);
console.log(`  the route answered: ${JSON.stringify({ ok: second?.ok, repo: second?.repo, created: second?.created })}`);
check("it made no second repository", !calls.includes("POST /user/repos") && made.length === 1, `made: ${made.join(", ")}`);
check("it pushed into the one the first press made", second?.ok === true && second?.repo === "someone/kept", `repo = ${second?.repo}`);
check("the site still publishes there", label((await project())?.repo) === "someone/kept", `repo = ${label((await project())?.repo)}`);
check("no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
stub.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
