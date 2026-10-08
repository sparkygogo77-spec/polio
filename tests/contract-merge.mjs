#!/usr/bin/env node
/**
 * THE OWNER'S OWN AGENTS.md AND CLAUDE.md SURVIVE A PUBLISH.
 *
 * Every publish writes the feature contract into AGENTS.md and CLAUDE.md
 * (`library/contract.ts`), and a repo-connected code chat, or the owner, may
 * have written those files first. So the contract is one marked block, and
 * the publish route merges it into the file on the branch: the block is
 * replaced where it is, added at the end where it is not, and the file is
 * written whole only where there is none. Every other file is pushed as sent.
 *
 * GitHub is a stand-in that records every call; nothing leaves the machine.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO GITHUB_API=http://127.0.0.1:4332 npx next start -p 3015
 *   STUB_PORT=4332 node --experimental-strip-types tests/contract-merge.mjs http://127.0.0.1:3015
 */
import http from "node:http";
import { agentsFile, claudeFile, BLOCK_START, BLOCK_END } from "../src/features/studio/shelf/library/contract.ts";

const BASE = process.argv[2] ?? "http://127.0.0.1:3015";
const PORT = Number(process.env.STUB_PORT ?? 4332);
const TOKEN = "not-a-token-placeholder-xxxx";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The branch as it stands: the owner's AGENTS.md, an older contract inside their CLAUDE.md, no TASKS.md. */
const OWN_AGENTS = "# My site\n\nKeep the green. Never touch the footer.\n";
const OLD_BLOCK = `${BLOCK_START}\nan older contract\n${BLOCK_END}`;
const OWN_CLAUDE = `# Notes for Claude\n\nBefore.\n\n${OLD_BLOCK}\n\nAfter, still mine.\n`;
const onBranch = new Map([["AGENTS.md", OWN_AGENTS], ["CLAUDE.md", OWN_CLAUDE]]);

const seen = [];
const blobs = [];
const stub = http.createServer(async (req, res) => {
  const body = await new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  const path = url.pathname;
  seen.push(`${req.method} ${path}${url.search}`);
  const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (!m) return send(404, { message: "Not Found" });
  const rest = m[2] ?? "";
  if (!rest && req.method === "GET") return send(200, { default_branch: "main" });
  if (rest.startsWith("/contents/site/capture")) return send(404, { message: "Not Found" });
  if (rest.startsWith("/contents/") && req.method === "GET") {
    const file = decodeURIComponent(rest.slice("/contents/".length));
    if (!onBranch.has(file)) return send(404, { message: "Not Found" });
    return send(200, { type: "file", encoding: "base64", content: Buffer.from(onBranch.get(file), "utf8").toString("base64") });
  }
  if (rest.startsWith("/git/ref/heads/") && req.method === "GET") return send(200, { object: { sha: "tip0" } });
  if (rest.startsWith("/git/commits/") && req.method === "GET") return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs" && req.method === "POST") { blobs.push(JSON.parse(body)); return send(201, { sha: `blob${blobs.length - 1}` }); }
  if (rest === "/git/trees" && req.method === "POST") {
    const t = JSON.parse(body);
    for (const e of t.tree) { const i = Number(String(e.sha).replace("blob", "")); if (blobs[i]) blobs[i].path = e.path; }
    return send(201, { sha: "tree1" });
  }
  if (rest === "/git/commits" && req.method === "POST") return send(201, { sha: "commit1", html_url: "https://example.invalid/commit1" });
  if (rest.startsWith("/git/refs") && (req.method === "PATCH" || req.method === "POST")) return send(200, { object: { sha: "commit1" } });
  return send(404, { message: "Not Found" });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

const push = async (files) => {
  blobs.length = 0;
  seen.length = 0;
  const r = await fetch(`${BASE}/api/studio/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": TOKEN },
    body: JSON.stringify({ files, repo: "sparkygogo77-spec/solcinerator", branch: "main", deploy: false }),
  }).then((x) => x.json()).catch((e) => ({ ok: false, message: String(e) }));
  const out = new Map(blobs.map((b) => [b.path, b.encoding === "base64" ? Buffer.from(b.content, "base64").toString("utf8") : b.content]));
  return { r, out };
};

const { r, out } = await push([
  { path: "index.html", content: "<!doctype html><title>x</title>" },
  { path: "AGENTS.md", content: agentsFile() },
  { path: "CLAUDE.md", content: claudeFile() },
  { path: "TASKS.md", content: "# Tasks\n" },
]);
if (!seen.some((l) => l.includes("/repos/sparkygogo77-spec/solcinerator"))) {
  console.error(`The server at ${BASE} did not call the stand-in on ${PORT}. Start it with GITHUB_API=http://127.0.0.1:${PORT} and no GITHUB_TOKEN.`);
  stub.close();
  process.exit(2);
}
check("the publish went through", r.ok === true, r.message ?? "");
const agents = out.get("AGENTS.md") ?? "";
check("AGENTS.md keeps the owner's own words", agents.startsWith("# My site") && agents.includes("Never touch the footer."), JSON.stringify(agents.slice(0, 40)));
check("…with the feature contract added once, at the end", agents.includes("siteFeatures.define") && agents.split(BLOCK_START).length === 2 && agents.indexOf(BLOCK_START) > agents.indexOf("Never touch"));
const claude = out.get("CLAUDE.md") ?? "";
check("CLAUDE.md's older contract is replaced, not added to", !claude.includes("an older contract") && claude.split(BLOCK_START).length === 2 && claude.includes("siteFeatures.define"));
check("…and the owner's words before and after it stay", claude.includes("Before.") && claude.includes("After, still mine."));
check("the files it read were read from the branch being written", seen.some((l) => l.includes("/contents/AGENTS.md") && /ref=/.test(l)));
check("every other file is pushed as sent", out.get("TASKS.md") === "# Tasks\n" && out.get("index.html")?.startsWith("<!doctype html>"));

/* A repository with no AGENTS.md gets the file whole. */
onBranch.delete("AGENTS.md");
const second = await push([{ path: "AGENTS.md", content: agentsFile() }]);
check("where there is no AGENTS.md, the contract is the whole file", second.out.get("AGENTS.md") === agentsFile());

stub.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
