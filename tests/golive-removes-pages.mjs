#!/usr/bin/env node
/**
 * A PAGE DELETED OR RENAMED ON THE BOARD COMES OFF THE LIVE SITE.
 *
 * J deleted a page, or renamed its path from about to team, and pressed Go
 * live: the new pages went up, but about/index.html from the earlier push
 * stayed in the repository, so Vercel still served the old About page at
 * /about, to bookmarks and search results, though the Builder and the
 * Preview no longer had it. Go live only ever added or overwrote files.
 *
 * Now each push of the site carries `site/pages.json`, the page files it
 * wrote, and the publish route takes off the branch each page file the
 * record already there names and the new one does not. Held here:
 *   1. the record (`pagesRecord`, `pagesGone`): only page files, and only
 *      those the last record named and this one does not;
 *   2. the real publish route, called in-process against a stand-in GitHub
 *      kept in this file (a git that keeps what it is handed, and refuses to
 *      delete a path that is not there, as GitHub does):
 *      · About renamed to Team: about/index.html goes in the same one
 *        commit; the owner's own page and notes, AGENTS.md and the pictures
 *        stay; the answer names what went;
 *      · the next push, nothing deleted: nothing taken off;
 *      · a push with no record (a kit, a style layer) takes nothing off;
 *      · a branch with no record yet takes nothing off, and gets one;
 *      · a record that cannot be read takes nothing off, and the push goes;
 *      · a record that names files that are not pages takes none of them off;
 *   3. the wiring (source read): Go live sends the record, in the last
 *      request, where the route reads it as it commits.
 *
 * No server, no browser, no token: the key is a STANDIN placeholder the
 * stand-in never reads, and nothing leaves the machine.
 *
 *   node tests/golive-removes-pages.mjs
 *
 * Covers: src/features/studio/send-out/pagesRecord.ts, src/app/api/studio/publish/route.ts, src/features/studio/send-out/goLive.ts, src/features/studio/loop/agent.ts
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

/* ------------------------------------------------- a stand-in GitHub that keeps what it is handed */
const git = { blobs: new Map(), trees: new Map(), commits: new Map(), tip: null, failBlobRead: false };
const blobId = (buf) => createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
const putBlob = (buf) => { const id = blobId(buf); git.blobs.set(id, buf); return id; };
let n = 0;
const putTree = (entries) => { const id = `tree${++n}`; git.trees.set(id, new Map(entries)); return id; };
const putCommit = (tree, parents) => { const id = `commit${++n}`; git.commits.set(id, { tree, parents }); return id; };
/** A branch holding these files, as one commit. */
const seed = (files) => { git.tip = putCommit(putTree(Object.entries(files).map(([p, text]) => [p, putBlob(Buffer.from(text))])), []); };
const onBranch = () => git.trees.get(git.commits.get(git.tip).tree);
const textAt = (path) => { const sha = onBranch().get(path); return sha ? git.blobs.get(sha).toString("utf8") : null; };

const posted = { trees: [], commits: 0, refs: 0 };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const method = init.method ?? "GET";
  if (u.origin !== "https://github.test") return json(599, { message: `stand-in refuses ${u}` });
  if (!u.pathname.startsWith("/repos/him/site")) return json(404, { message: "Not Found" });
  const p = decodeURIComponent(u.pathname.slice("/repos/him/site".length));
  const body = init.body ? JSON.parse(String(init.body)) : null;
  if (method === "GET" && p === "") return json(200, { default_branch: "main", full_name: "him/site" });
  /* No capture here, and no AGENTS.md to merge into. */
  if (p.startsWith("/contents/")) return json(404, { message: "Not Found" });
  if (method === "GET" && p === "/git/ref/heads/main") return git.tip ? json(200, { object: { sha: git.tip } }) : json(404, { message: "Not Found" });
  if (method === "GET" && p.startsWith("/git/commits/")) { const c = git.commits.get(p.slice(13)); return c ? json(200, { sha: p.slice(13), tree: { sha: c.tree } }) : json(404, { message: "Not Found" }); }
  if (method === "GET" && p.startsWith("/git/trees/")) {
    const t = git.trees.get(p.slice(11));
    return t ? json(200, { sha: p.slice(11), truncated: false, tree: [...t].map(([path, sha]) => ({ path, mode: "100644", type: "blob", sha })) }) : json(404, { message: "Not Found" });
  }
  if (method === "GET" && p.startsWith("/git/blobs/")) {
    if (git.failBlobRead) return json(502, { message: "Bad Gateway" });
    const b = git.blobs.get(p.slice(11));
    /* GitHub wraps its base64 at 60 characters. */
    return b ? json(200, { sha: p.slice(11), encoding: "base64", content: b.toString("base64").replace(/.{60}/g, "$&\n"), size: b.length }) : json(404, { message: "Not Found" });
  }
  if (method === "POST" && p === "/git/blobs") return json(201, { sha: putBlob(Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8")) });
  if (method === "POST" && p === "/git/trees") {
    posted.trees.push(body);
    const t = new Map(body.base_tree ? git.trees.get(body.base_tree) : []);
    for (const e of body.tree) {
      if (e.sha !== null) { t.set(e.path, e.sha); continue; }
      /* GitHub will not delete what is not there. */
      if (!t.has(e.path)) return json(422, { message: `GitRPC::BadObjectState: ${e.path} is not in the tree` });
      t.delete(e.path);
    }
    return json(201, { sha: putTree(t) });
  }
  if (method === "POST" && p === "/git/commits") { posted.commits++; return json(201, { sha: putCommit(body.tree, body.parents), html_url: "https://github.test/commit" }); }
  if (method === "PATCH" && p === "/git/refs/heads/main") { posted.refs++; git.tip = body.sha; return json(200, { object: { sha: body.sha } }); }
  return json(404, { message: "Not Found" });
};
process.env.GITHUB_API = "https://github.test";
process.env.PUBLISH_BLOB_GAP_MS = "0";
for (const k of ["GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH", "GITHUB_REPOS", "VERCEL_DEPLOY_HOOK"]) delete process.env[k];

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const R = await jiti.import(join(ROOT, "src/features/studio/send-out/index.ts"));
const route = await jiti.import(join(ROOT, "src/app/api/studio/publish/route.ts"));

/* ------------------------------------------------- 1. the record */
const record = (paths) => R.pagesRecord(paths.map((path) => ({ path })));
{
  const r = record(["team/index.html", "assets/site.css", "index.html", "assets/pictures/a.png", "vercel.json", "site/document.json"]);
  const said = JSON.parse(r?.content ?? "{}");
  check("1 the record is site/pages.json and names only the page files, sorted", r?.path === "site/pages.json" && R.PAGES_RECORD === "site/pages.json" && JSON.stringify(said.pages) === JSON.stringify(["index.html", "team/index.html"]), r?.content);
  check("1 …and says in plain words what it is for", /no longer a page on the board/.test(said.about ?? "") && /never removes a file this list does not name/.test(said.about ?? ""), said.about);
  check("1 a push with no pages writes no record", record(["assets/site.css", "site/document.json"]) === null && record([]) === null);
  const was = record(["index.html", "about/index.html", "blog/post/index.html"]).content;
  const now = record(["index.html", "team/index.html"]).content;
  check("1 a page the last record named and this one does not is gone", JSON.stringify(R.pagesGone(was, now, new Set())) === JSON.stringify(["about/index.html", "blog/post/index.html"]), JSON.stringify(R.pagesGone(was, now, new Set())));
  check("1 …unless this push writes that file anyway", JSON.stringify(R.pagesGone(was, now, new Set(["about/index.html"]))) === JSON.stringify(["blog/post/index.html"]));
  const odd = JSON.stringify({ pages: ["index.html", "AGENTS.md", "notes/owner.md", "polio/NEXT.md", "web/style-layer.css", "assets/pictures/a.png", 7, null] });
  check("1 a record that names files that are not pages takes none of them", R.pagesGone(odd, now, new Set()).length === 0, JSON.stringify(R.pagesGone(odd, now, new Set())));
  check("1 a record that is not one, or a new one with no pages, takes nothing", R.pagesGone("not json", now, new Set()).length === 0 && R.pagesGone(was, "{}", new Set()).length === 0 && R.pagesGone(was, JSON.stringify({ pages: [] }), new Set()).length === 0);
}

/* ------------------------------------------------- 2. the route, against the stand-in */
const HEAD = { "content-type": "application/json", "x-github-token": "STANDIN_GITHUB_TOKEN_0123456789" };
const push = async (files) => {
  const before = { trees: posted.trees.length, commits: posted.commits, refs: posted.refs };
  const res = await route.POST(new Request("http://polio.test/api/studio/publish", { method: "POST", headers: HEAD, body: JSON.stringify({ repo: "him/site", branch: "main", message: "Builder: publish", deploy: false, files }) }));
  const a = await res.json();
  const tree = posted.trees.at(-1)?.tree ?? [];
  return { a, nulls: posted.trees.length > before.trees ? tree.filter((e) => e.sha === null).map((e) => e.path) : [], once: posted.trees.length - before.trees === 1 && posted.commits - before.commits === 1 && posted.refs - before.refs === 1 };
};
/** What Go live sends: the pages, the stylesheet, the record of the pages, the document. */
const site = (pages) => {
  const files = [...pages.map(([path, text]) => ({ path, content: text })), { path: "assets/site.css", content: "body { margin: 0 }\n" }];
  return [...files, record(files.map((f) => f.path)), { path: "site/document.json", content: "{}\n" }];
};
const OWNER = {
  "blog/index.html": "<h1>The owner's own page, never a Go live's</h1>",
  "notes/owner.md": "# The owner's notes\n",
  "AGENTS.md": "# The owner's agents file\n",
  "assets/pictures/team.png": "PNG-ish bytes",
};

console.log("2a. About renamed to Team, and Go live pressed");
seed({ ...OWNER, "index.html": "<h1>Home</h1>", "about/index.html": "<h1>About</h1>", "assets/site.css": "body { margin: 0 }\n", "site/pages.json": record(["index.html", "about/index.html"]).content, "site/document.json": "{}\n" });
{
  const { a, nulls, once } = await push(site([["index.html", "<h1>Home</h1>"], ["team/index.html", "<h1>Team</h1>"]]));
  check("2a it publishes", a.ok === true, JSON.stringify(a));
  check("2a the old About page is taken off, in the same tree", JSON.stringify(nulls) === JSON.stringify(["about/index.html"]) && !onBranch().has("about/index.html"), JSON.stringify(nulls));
  check("2a …and the answer names it", JSON.stringify(a.removed) === JSON.stringify(["about/index.html"]), JSON.stringify(a.removed));
  check("2a the new Team page is there", textAt("team/index.html") === "<h1>Team</h1>");
  const kept = Object.keys(OWNER).filter((p) => textAt(p) === OWNER[p]);
  check("2a the owner's page and notes, AGENTS.md and the pictures stay as they were", kept.length === Object.keys(OWNER).length, `kept ${kept.join(", ")}`);
  check("2a the branch's record is now this push's", JSON.stringify(JSON.parse(textAt("site/pages.json") ?? "{}").pages) === JSON.stringify(["index.html", "team/index.html"]), textAt("site/pages.json"));
  check("2a one tree, one commit, one move of the branch", once);
}

console.log("2b. The next push, nothing deleted");
{
  const { a, nulls, once } = await push(site([["index.html", "<h1>Home, again</h1>"], ["team/index.html", "<h1>Team</h1>"]]));
  check("2b nothing is taken off", a.ok === true && nulls.length === 0 && a.removed === undefined && textAt("team/index.html") === "<h1>Team</h1>", JSON.stringify({ ok: a.ok, nulls, removed: a.removed }));
  check("2b one tree, one commit, one move of the branch", once);
}

console.log("2c. A push with no record (a kit, a style layer)");
{
  const { a, nulls } = await push([{ path: "polio/NEXT.md", content: "# Next\n" }]);
  check("2c takes nothing off, though the branch's record names pages it does not carry", a.ok === true && nulls.length === 0 && textAt("index.html") !== null && textAt("team/index.html") !== null, JSON.stringify({ ok: a.ok, nulls }));
}

console.log("2d. A branch with no record yet");
seed({ ...OWNER, "index.html": "<h1>Home</h1>", "about/index.html": "<h1>About, from before any record</h1>" });
{
  const { a, nulls } = await push(site([["index.html", "<h1>Home</h1>"]]));
  check("2d takes nothing off: no record says the Builder wrote about/index.html", a.ok === true && nulls.length === 0 && textAt("about/index.html") !== null, JSON.stringify({ ok: a.ok, nulls }));
  check("2d …and the branch gets its first record", JSON.stringify(JSON.parse(textAt("site/pages.json") ?? "{}").pages) === JSON.stringify(["index.html"]), textAt("site/pages.json"));
}

console.log("2e. The branch's record cannot be read");
seed({ ...OWNER, "index.html": "<h1>Home</h1>", "about/index.html": "<h1>About</h1>", "site/pages.json": record(["index.html", "about/index.html"]).content });
git.failBlobRead = true;
{
  const { a, nulls, once } = await push(site([["index.html", "<h1>Home</h1>"]]));
  check("2e takes nothing off, and the push still goes", a.ok === true && nulls.length === 0 && textAt("about/index.html") !== null && once, JSON.stringify({ ok: a.ok, message: a.message, nulls }));
}
git.failBlobRead = false;

console.log("2f. A record on the branch that names files that are not pages");
seed({ ...OWNER, "index.html": "<h1>Home</h1>", "polio/NEXT.md": "# Next\n", "site/pages.json": JSON.stringify({ pages: ["index.html", "AGENTS.md", "notes/owner.md", "blog/../AGENTS.md", "polio/NEXT.md", "assets/pictures/team.png"] }) });
{
  const { a, nulls } = await push(site([["index.html", "<h1>Home</h1>"]]));
  check("2f takes none of them off", a.ok === true && nulls.length === 0 && Object.keys(OWNER).every((p) => textAt(p) === OWNER[p]) && textAt("polio/NEXT.md") !== null, JSON.stringify({ ok: a.ok, nulls }));
}

/* ------------------------------------------------- 3. the wiring */
{
  const live = readFileSync(join(ROOT, "src/features/studio/send-out/goLive.ts"), "utf8");
  check("3 Go live puts the record of the pages it wrote in what goes up", /const record = pagesRecord\(pages\);/.test(live) && /const all = \[\.\.\.pages, \.\.\.\(record \? \[record\] : \[\]\)/.test(live));
  const agent = readFileSync(join(ROOT, "src/features/studio/loop/agent.ts"), "utf8");
  check("3 the record always goes in the last request, where the route reads it as it commits", /const COMMITTED_LAST = new Set\(\[[^\]]*PAGES_RECORD[^\]]*\]\)/.test(agent));
  const r = readFileSync(join(ROOT, "src/app/api/studio/publish/route.ts"), "utf8");
  check("3 the route takes pages off only in the commit, never in a call that only stages blobs", (r.match(/pagesTakenOff\(/g) ?? []).length === 2 && /const removed = await pagesTakenOff\(token, repo, files, staged, onBranch\);/.test(r));
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
