/**
 * The first publish into a repository with nothing in it.
 *
 * He pressed Push to GitHub on the live deploy with his own token and got
 * back, from our own route:
 *
 *     {"ok":false,"reason":"github","status":409,"message":"Git Repository is empty."}
 *
 * The route knew how to make a root commit and never reached that code. It
 * decided "there is nothing here" from a 404, and GitHub answers a **409**
 * for the git ref endpoints of a repository that has no commits at all —
 * which is every repository this route has just made for a site's first
 * publish. So the 409 was rethrown as a failure instead.
 *
 * This runs a stand-in for GitHub that answers the way an empty repository
 * really does, points the route at it, and presses the button. It needs the
 * server under test to have been started with GITHUB_API at this stub:
 *
 *     GITHUB_API=http://127.0.0.1:4319 npx next start -p 3011
 *     node tests/publish-empty.mjs http://127.0.0.1:3011
 *
 * No real token, no real repository, nothing that touches anybody's account.
 */
import http from "node:http";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const PORT = Number(process.env.STUB_PORT ?? 4319);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* What the stub was asked, in order, so the shape of the conversation can be
   read as well as its answer. */
let seen = [];
/* Repositories the stub was asked to make, so a press that makes two can be seen. */
let made = [];
let mode = "empty";
/* Once the first commit exists, the stub stops being empty. */
let tip = null;

const stub = http.createServer(async (req, res) => {
  const body = await new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  seen.push(`${req.method} ${path}`);
  const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  const auth = req.headers.authorization ?? "";
  if (!/^Bearer .+/.test(auth)) return send(401, { message: "Bad credentials" });

  // The repository itself is fine; it simply has nothing in it.
  if (/^\/repos\/[^/]+\/[^/]+$/.test(path) && req.method === "GET") return send(200, { default_branch: "main", full_name: path.slice(7) });
  // Making one, which is what a site's first publish does before it pushes.
  if (path === "/user/repos" && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    made.push(b.name);
    return send(201, { full_name: `someone/${b.name}` });
  }
  // Git refs in an empty repository: 409, with GitHub's own words.
  if (path.includes("/git/ref/") && req.method === "GET") {
    if (tip) return send(200, { object: { sha: tip } });
    return send(409, { message: "Git Repository is empty." });
  }
  if (mode === "refuses-everything" && !path.startsWith("/user/repos")) return send(404, { message: "Not Found" });
  if (path.endsWith("/git/blobs") && req.method === "POST") {
    if (mode === "refuses-blobs" && !tip) return send(409, { message: "Git Repository is empty." });
    return send(201, { sha: `blob${seen.length}` });
  }
  if (path.endsWith("/git/trees") && req.method === "POST") return send(201, { sha: "tree1" });
  if (path.endsWith("/git/commits") && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    if (!tip && Array.isArray(b.parents) && b.parents.length) return send(422, { message: "A commit in an empty repository cannot have a parent." });
    tip = "commit1";
    return send(201, { sha: "commit1", html_url: "https://example.invalid/commit/commit1", parents: b.parents });
  }
  if (path.match(/\/git\/commits\/[^/]+$/) && req.method === "GET") return send(200, { tree: { sha: "tree0" } });
  if (path.endsWith("/git/refs") && req.method === "POST") { tip = tip ?? "commit1"; return send(201, { object: { sha: tip } }); }
  if (path.includes("/git/refs/heads/") && req.method === "PATCH") return send(200, { object: { sha: tip } });
  // The contents API: the way into a repository the git data API will not touch.
  if (path.includes("/contents/") && req.method === "PUT") { tip = "seed1"; return send(201, { commit: { sha: "seed1" } }); }
  return send(404, { message: `The stub has no ${req.method} ${path}` });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

const press = async (over = {}) => {
  seen = [];
  made = [];
  tip = null;
  const res = await fetch(`${URL_}/api/studio/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": "github_pat_NOTATOKEN_stub_0000000000" },
    body: JSON.stringify({
      files: [{ path: "site/document.json", content: "{}\n" }, { path: "README.md", content: "# a site\n" }],
      message: "Builder: publish BLACKORB",
      deploy: false,
      repo: "someone/blackorb",
      ...over,
    }),
  });
  return { status: res.status, body: await res.json() };
};

/* 1. The ordinary empty repository: refs 409, everything else works. */
mode = "empty";
let out = await press();
check("the route is reachable and answered", typeof out.body?.ok === "boolean", `HTTP ${out.status}`);
check("a push into an empty repository lands", out.body?.ok === true, out.body?.ok ? `commit ${out.body.sha} on ${out.body.branch}` : `${out.body?.reason}: ${out.body?.message}`);
check("and it asked for the branch, was told the repository is empty, and made a root commit anyway",
  seen.some((s) => s.includes("GET") && s.includes("/git/ref/")) && seen.some((s) => s === "POST /repos/someone/blackorb/git/commits") && seen.some((s) => s === "POST /repos/someone/blackorb/git/refs"),
  seen.join(" · "));
check("the first commit has no parent, which is what a root commit is",
  !seen.some((s) => s.includes("/git/refs/heads/")), "no ref was patched, a new one was created");

/* 2. And the harder kind, which refuses the git data API until it has one
      commit: the first file goes up through the contents API instead. */
mode = "refuses-blobs";
out = await press();
check("a repository that will not take a blob until it has a commit is seeded and then pushed", out.body?.ok === true,
  out.body?.ok ? `commit ${out.body.sha}` : `${out.body?.reason}: ${out.body?.message}`);
check("and the seed went through the contents API", seen.some((s) => s.startsWith("PUT") && s.includes("/contents/")), seen.join(" · "));

/* 3. A site with no repository yet: the name it is called by is what makes
      one. Go live used to send no name at all and came back "nothing to name
      a new one after" on a site plainly called BLACKORB. */
mode = "empty";
out = await press({ repo: undefined, create: undefined });
check("a push that names no repository and no name to make one under is refused, and says so without blaming the brief",
  out.body?.ok === false && out.body?.reason === "no-repo" && !/brief/i.test(out.body?.message ?? ""),
  out.body?.message ?? "");
out = await press({ repo: undefined, create: "BLACKORB" });
check("and a push that carries the site's name makes the repository and lands in it",
  out.body?.ok === true && out.body?.created === "someone/blackorb",
  out.body?.ok ? `made ${out.body.created}, commit ${out.body.sha}` : `${out.body?.reason}: ${out.body?.message}`);
check("one repository, not one per press", made.length === 1, made.join(", ") || "none");

/* 4. And when the making works but the push does not, the answer still names
      what was made, so the next press goes there instead of making another. */
mode = "refuses-everything";
out = await press({ repo: undefined, create: "BLACKORB" });
check("a failed first publish still names the repository it made", out.body?.ok === false && out.body?.created === "someone/blackorb",
  `${out.body?.reason ?? "?"}: ${out.body?.message ?? ""} · created ${JSON.stringify(out.body?.created ?? null)}`);

/* 5. Nothing of the token is in the answer, whatever happens. */
const said = JSON.stringify(out.body);
check("no token comes back in the answer", !said.includes("NOTATOKEN"));

stub.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
