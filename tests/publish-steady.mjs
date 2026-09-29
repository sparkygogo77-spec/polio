#!/usr/bin/env node
/**
 * A BIG SITE GOES UP STEADILY: WHAT IS THERE IS NOT SENT AGAIN, A RATE LIMIT
 * IS WAITED OUT, AND A PUBLISH THAT RUNS OUT OF TIME CARRIES ON.
 *
 * gotchi's Update live site made every blob at once, ~230 of them, and
 * GitHub answered "You have exceeded a secondary rate limit" — which the
 * route then read as "The key may not have Contents write". Against a
 * stand-in GitHub:
 *   · a secondary limit on the 3rd blob, with retry-after, is waited out and
 *     the publish lands as one commit and one move of main;
 *   · a file whose blob is already in main's tree is not uploaded again;
 *   · a limit longer than the call can wait answers `resume` with what went
 *     up, and the next call sends only the rest, still one commit;
 *   · a rate limit never says Contents write; a real permission refusal does;
 *   · no answer ever carries the key.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO -u VERCEL_TOKEN -u VERCEL_PROJECT -u VERCEL_TEAM \
 *     GITHUB_API=http://127.0.0.1:4333 VERCEL_API=http://127.0.0.1:4334 PUBLISH_BLOB_GAP_MS=20 npx next start -p 3013
 *   node tests/publish-steady.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { createHash } from "node:crypto";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const GH_PORT = Number(process.env.GH_PORT ?? 4333);
const KEY = "github_pat_STANDIN_not_a_real_key_0123456789abcdef";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`);
};
const readBody = (req) => new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
const blobSha = (bytes) => createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");

/* The stand-in. `tree0` is main's tree; `limit` says which blob POST is refused and how. */
let tree0 = [];
let limit = null; // { nth, times, status, headers, message }
let posts = 0;
let seen = [];
let blobs = [];
let treeBody = null;
const gh = http.createServer(async (req, res) => {
  const raw = await readBody(req);
  const send = (code, body, headers = {}) => { res.writeHead(code, { "content-type": "application/json", ...headers }); res.end(JSON.stringify(body)); };
  const u = new URL(req.url, "http://x");
  seen.push(`${req.method} ${u.pathname}`);
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi") return send(200, { default_branch: "main", full_name: "owner/gotchi" });
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi/git/ref/heads/main") return send(200, { object: { sha: "base0" } });
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi/git/commits/base0") return send(200, { sha: "base0", tree: { sha: "tree0" } });
  if (req.method === "GET" && u.pathname === "/repos/owner/gotchi/git/trees/tree0") return send(200, { sha: "tree0", truncated: false, tree: tree0 });
  if (req.method === "POST" && u.pathname === "/repos/owner/gotchi/git/blobs") {
    posts++;
    if (limit && posts >= limit.nth && limit.times > 0) {
      limit.times--;
      return send(limit.status, { message: limit.message.replace("KEY", KEY), documentation_url: "https://docs.github.com/rest/overview/rate-limits-for-the-rest-api" }, limit.headers);
    }
    const b = JSON.parse(raw);
    const bytes = b.encoding === "base64" ? Buffer.from(b.content, "base64") : Buffer.from(b.content, "utf8");
    const sha = blobSha(bytes);
    blobs.push(sha);
    return send(201, { sha });
  }
  if (req.method === "POST" && u.pathname === "/repos/owner/gotchi/git/trees") { treeBody = JSON.parse(raw); return send(201, { sha: "tree1" }); }
  if (req.method === "POST" && u.pathname === "/repos/owner/gotchi/git/commits") return send(201, { sha: "commit1", html_url: "https://github.example/commit1" });
  if (req.method === "PATCH" && u.pathname === "/repos/owner/gotchi/git/refs/heads/main") {
    if (limit?.at === "ref" && limit.times > 0) { limit.times--; return send(limit.status, { message: limit.message }, limit.headers); }
    return send(200, { object: { sha: "commit1" } });
  }
  return send(404, { message: "Not Found" });
});
await new Promise((r) => gh.listen(GH_PORT, "127.0.0.1", r));

const reset = () => { posts = 0; seen = []; blobs = []; treeBody = null; limit = null; tree0 = []; };
const count = (s) => seen.filter((x) => x === s).length;
const publish = async (files, extra = {}) => {
  const r = await fetch(`${BASE}/api/studio/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": KEY },
    body: JSON.stringify({ files, message: "Update the site", deploy: false, repo: "owner/gotchi", branch: "main", ...extra }),
  });
  const text = await r.text();
  return { text, json: JSON.parse(text || "{}") };
};
const pages = (n, tag = "") => Array.from({ length: n }, (_, i) => ({ path: `pages/p${i}.html`, content: `<p>page ${i}${tag}</p>` }));
const SECONDARY = "You have exceeded a secondary rate limit. Please wait a few minutes before you try again. (KEY)";

/* 1. A secondary limit on the 3rd blob, retry-after 1: waited out, one commit. */
reset();
limit = { nth: 3, times: 1, status: 403, headers: { "retry-after": "1" }, message: SECONDARY };
const one = await publish(pages(6));
check("a secondary limit on the 3rd blob is waited out and the publish lands", one.json.ok === true, one.text.slice(0, 300));
check("…every blob made once, the limited one asked for again", blobs.length === 6 && posts === 7, `${blobs.length} made, ${posts} asked`);
check("…as one commit and one move of main", count("POST /repos/owner/gotchi/git/commits") === 1 && count("PATCH /repos/owner/gotchi/git/refs/heads/main") === 1, seen.join(", "));
check("…and never the key", !one.text.includes(KEY));

/* 2. Files already in main's tree are not uploaded again. */
reset();
const same = pages(5);
tree0 = same.slice(0, 4).map((f) => ({ path: f.path, mode: "100644", type: "blob", sha: blobSha(Buffer.from(f.content, "utf8")) }));
tree0.push({ path: "pictures/a.png", mode: "100644", type: "blob", sha: blobSha(Buffer.from("PNGBYTES")) });
const two = await publish([...same, { path: "pictures/b.png", content: Buffer.from("PNGBYTES").toString("base64"), encoding: "base64" }]);
check("unchanged files are not uploaded again: 1 new page, 0 of 4 unchanged, 0 for a picture main already holds", two.json.ok === true && posts === 1, `${posts} blob posts; ${two.text.slice(0, 200)}`);
check("…and the commit still names every file", two.json.files === 6 && (treeBody?.tree ?? []).length >= 2, JSON.stringify(treeBody?.tree?.map((t) => t.path)));

/* 3. A limit longer than the call can wait: `resume`, then only the rest. */
reset();
limit = { nth: 4, times: 1, status: 403, headers: { "retry-after": "600" }, message: SECONDARY };
const files3 = pages(8, "!");
const first = await publish(files3);
check("a limit longer than the call can wait answers resume, with what went up", first.json.ok === false && first.json.reason === "resume" && (first.json.staged ?? []).length === 3 && (first.json.pending ?? []).length === 5, first.text.slice(0, 300));
check("…and made no commit and did not move main", count("POST /repos/owner/gotchi/git/commits") === 0 && count("PATCH /repos/owner/gotchi/git/refs/heads/main") === 0, seen.join(", "));
check("…and says it is a rate limit, not Contents write", /rate limit/i.test(first.json.message ?? "") && !/Contents write/.test(first.json.message ?? ""), first.json.message);
const madeBefore = posts;
const rest = files3.filter((f) => first.json.pending?.includes(f.path));
const second = await publish(rest, { staged: first.json.staged });
check("the next call sends only the rest and lands as one commit", second.json.ok === true && posts - madeBefore === 5 && second.json.files === 8 && count("POST /repos/owner/gotchi/git/commits") === 1 && count("PATCH /repos/owner/gotchi/git/refs/heads/main") === 1, `${posts - madeBefore} posts; ${second.text.slice(0, 200)}`);

/* 4. Wording: a rate limit at the move of main vs a real permission refusal. */
reset();
limit = { at: "ref", times: 1, status: 403, headers: { "retry-after": "600" }, message: "You have exceeded a secondary rate limit." };
const r4 = await publish(pages(1));
check("a rate limit moving main never says Contents write", r4.json.ok === false && /rate limit/i.test(r4.json.message ?? "") && !/Contents write/.test(r4.json.message ?? ""), r4.text.slice(0, 300));
reset();
limit = { nth: 1, times: 1, status: 403, headers: {}, message: "Resource not accessible by personal access token" };
const r5 = await publish(pages(1));
check("a real permission refusal still says Contents write", r5.json.ok === false && /Resource not accessible/.test(r5.json.message ?? "") && /Contents write/.test(r5.json.message ?? ""), r5.text.slice(0, 300));

gh.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
