#!/usr/bin/env node
/**
 * UPDATE LIVE SITE SENDS ONLY WHAT CHANGED, AND IT IS STILL ONE COMMIT.
 *
 * Parasite's Update live site re-sent all 354 files, about two a request,
 * six minutes when little had changed. Held here with a STANDIN repository
 * whose branch holds 50 files, and a push of the same 50 with one changed:
 *   · one file goes up (in the requests to the Builder, and as one new blob);
 *   · the commit's tree names all 50, the 49 by the shas already there;
 *   · one tree, one commit, one move of the branch;
 *   · the push says "1 of 50" changed.
 *
 *   GITHUB_API=http://127.0.0.1:4336 npx next start -p 3013   (no GITHUB_TOKEN of its own)
 *   node tests/publish-changed.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PORT = Number(process.env.GH_PORT ?? 4336);
const KEY = "github_pat_STANDIN_not_a_real_key_0123456789abcdef";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const blobSha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });

/* 50 files: pages and pictures, as a site is. */
const PNG = (i) => Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(200 + i, i)]);
const files = Array.from({ length: 50 }, (_, i) => i % 2
  ? { path: `assets/pictures/pic_${i}.png`, content: PNG(i).toString("base64"), encoding: "base64" }
  : { path: i ? `page${i}/index.html` : "index.html", content: `<!doctype html><title>Page ${i}</title><p>${"words ".repeat(50 + i)}</p>` });
const bytesOf = (f) => (f.encoding === "base64" ? Buffer.from(f.content, "base64") : Buffer.from(f.content, "utf8"));
const TREE0 = files.map((f) => ({ path: f.path, mode: "100644", type: "blob", sha: blobSha(bytesOf(f)) }));
const next = files.map((f) => (f.path === "page8/index.html" ? { ...f, content: f.content.replace("Page 8", "Page 8, changed") } : f));

const posts = [];
let trees = [], commits = 0, refs = 0;
const gh = http.createServer(async (req, res) => {
  const raw = await readBody(req);
  const send = (code, body) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(body)); };
  const u = new URL(req.url, "http://x");
  const R = "/repos/owner/site";
  if (req.method === "GET" && u.pathname === R) return send(200, { default_branch: "main", full_name: "owner/site" });
  if (req.method === "GET" && u.pathname === `${R}/git/ref/heads/main`) return send(200, { object: { sha: "base0" } });
  if (req.method === "GET" && u.pathname === `${R}/git/commits/base0`) return send(200, { sha: "base0", tree: { sha: "tree0" } });
  if (req.method === "GET" && u.pathname === `${R}/git/trees/tree0`) return send(200, { sha: "tree0", truncated: false, tree: TREE0 });
  if (req.method === "POST" && u.pathname === `${R}/git/blobs`) {
    const b = JSON.parse(raw);
    const sha = blobSha(b.encoding === "base64" ? Buffer.from(b.content, "base64") : Buffer.from(b.content, "utf8"));
    posts.push(sha);
    return send(201, { sha });
  }
  if (req.method === "POST" && u.pathname === `${R}/git/trees`) { trees.push(JSON.parse(raw)); return send(201, { sha: "tree1" }); }
  if (req.method === "POST" && u.pathname === `${R}/git/commits`) { commits++; return send(201, { sha: "commit1", html_url: "https://github.example/commit1" }); }
  if (req.method === "PATCH" && u.pathname === `${R}/git/refs/heads/main`) { refs++; return send(200, { object: { sha: "commit1" } }); }
  return send(404, { message: "Not Found" });
});
await new Promise((r) => gh.listen(PORT, "127.0.0.1", r));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const sentPaths = [];
await page.route("**/api/studio/publish", (r) => {
  if (r.request().method() === "POST") for (const f of JSON.parse(r.request().postData() ?? "{}").files ?? []) sentPaths.push(f.path);
  return r.continue();
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click(); await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill(KEY);
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click(); await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click(); await page.waitForTimeout(500);

const got = await page.evaluate((files) => window.__studioPublish({ message: "Builder: publish", deploy: false, repo: "owner/site", branch: "main", files }), next);
check("it publishes", got?.ok === true, JSON.stringify(got).slice(0, 200));
check("only the changed file is sent to the Builder", JSON.stringify(sentPaths) === JSON.stringify(["page8/index.html"]), `${sentPaths.length} sent: ${sentPaths.slice(0, 4).join(", ")}${sentPaths.length > 4 ? "…" : ""}`);
check("…and only it is made a new blob", posts.length === 1 && posts[0] === blobSha(bytesOf(next[8])), `${posts.length} blob(s) made`);
const tree = trees.at(-1)?.tree ?? [];
const want = next.map((f) => [f.path, blobSha(bytesOf(f))]);
check("the commit's tree names all 50 by the right shas", want.every(([p, sha]) => tree.find((e) => e.path === p)?.sha === sha), `${tree.length} entries`);
check("one tree, one commit, one move of the branch", trees.length === 1 && commits === 1 && refs === 1, `${trees.length}/${commits}/${refs}`);
check("the push says 1 of 50 files changed", got?.changed === 1 && got?.total === 50, `${got?.changed} of ${got?.total}`);
check("no page error", errors.length === 0, errors.join(" / "));
await browser.close();
gh.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
