/**
 * MERGE AND BRANCH DELETE KEEP PUBLISH'S LOCKS, AT THE ROUTE.
 *
 * Merge writes into a repository's default branch, which is the running
 * site, and deletes the branch it merged; Delete on the branch list removes
 * one. Both used to check only that the repository was owner/name, so a
 * call that named any repository the token could write to was carried out:
 * off the server's `GITHUB_REPOS` list, or a repository a site here was
 * brought in from (PST itself). They are held to what Publish is held to:
 *
 *   · a repository off `GITHUB_REPOS` (when the server names any) is
 *     refused, "bad-repo", before GitHub is asked anything;
 *   · a repository among the `sources` the browser sends is refused,
 *     "source", before GitHub is asked anything;
 *   · the site's own repository, on the list and not a source, still
 *     merges, and still deletes a branch;
 *   · and Merge never takes the default branch for the edit branch, by
 *     whatever name the repository calls it.
 *
 * The routes are the real handlers, called in-process. GitHub is a stand-in
 * fetch in this file; the token is a placeholder and nothing leaves the
 * machine. No server or browser is needed.
 *
 *   node tests/merge-locks.mjs
 *
 * Covers: src/app/api/studio/merge/route.ts, src/app/api/studio/branches/route.ts, src/app/api/studio/publish/capture.ts, src/features/studio/RepoPicker.tsx
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

/* ------------------------------------------------- GitHub, a stand-in */
process.env.GITHUB_API = "https://github.test";
process.env.GITHUB_TOKEN = "";
const calls = [];
const json = (status, body) => new Response(body === undefined ? null : JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
let defaultBranch = "main";
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const method = init.method ?? "GET";
  calls.push(`${method} ${u}`);
  if (!u.startsWith("https://github.test/")) return json(599, { message: `stand-in refuses ${u}` });
  const path = decodeURIComponent(u.slice("https://github.test".length));
  if (method === "GET" && path === "/repos/me/out") return json(200, { default_branch: defaultBranch, full_name: "me/out" });
  if (method === "POST" && path === "/repos/me/out/merges") return json(201, { sha: "STANDIN_SHA" });
  if (method === "DELETE" && path.startsWith("/repos/me/out/git/refs/heads/")) return json(204);
  return json(404, { message: "Not Found" });
};

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const merge = await jiti.import(join(ROOT, "src/app/api/studio/merge/route.ts"));
const branches = await jiti.import(join(ROOT, "src/app/api/studio/branches/route.ts"));

const HEAD = { "content-type": "application/json", "x-github-token": "STANDIN_GITHUB_TOKEN" };
const ask = async (handler, method, body) => {
  calls.length = 0;
  const res = await handler(new Request(`http://polio.test/api/studio/x`, { method, headers: HEAD, body: JSON.stringify(body) }));
  return { a: await res.json(), asked: [...calls] };
};

/* ------------------------------------------------- off the list */
process.env.GITHUB_REPOS = "me/out";
{
  const { a, asked } = await ask(merge.POST, "POST", { repo: "me/other", branch: "edit-1" });
  check("Merge refuses a repository off GITHUB_REPOS, in words", a.ok === false && a.reason === "bad-repo" && /me\/out/.test(a.message ?? ""), JSON.stringify(a));
  check("…and asks GitHub nothing", asked.length === 0, asked.join(", "));
}
{
  const { a, asked } = await ask(branches.DELETE, "DELETE", { repo: "me/other", branch: "edit-1" });
  check("Delete refuses a repository off GITHUB_REPOS, in words", a.ok === false && a.reason === "bad-repo" && /me\/out/.test(a.message ?? ""), JSON.stringify(a));
  check("…and asks GitHub nothing", asked.length === 0, asked.join(", "));
}

/* ------------------------------------------------- where a site came from */
{
  const { a, asked } = await ask(merge.POST, "POST", { repo: "me/out", branch: "edit-1", sources: ["Me/Out"] });
  check("Merge refuses a repository a site here was brought in from", a.ok === false && a.reason === "source" && a.repo === "Me/Out", JSON.stringify(a));
  check("…and asks GitHub nothing", asked.length === 0, asked.join(", "));
}
{
  const { a, asked } = await ask(branches.DELETE, "DELETE", { repo: "me/out", branch: "edit-1", sources: ["me/out"] });
  check("Delete refuses a repository a site here was brought in from", a.ok === false && a.reason === "source", JSON.stringify(a));
  check("…and asks GitHub nothing", asked.length === 0, asked.join(", "));
}

/* ------------------------------------------------- the site's own repository */
{
  const { a, asked } = await ask(merge.POST, "POST", { repo: "me/out", branch: "edit-1", sources: ["me/src"] });
  check("Merge into the site's own repository still merges", a.ok === true && a.base === "main" && a.sha === "STANDIN_SHA", JSON.stringify(a));
  check("…asking GitHub about it, merging, then deleting the branch", asked.join(" | ") === "GET https://github.test/repos/me/out | POST https://github.test/repos/me/out/merges | DELETE https://github.test/repos/me/out/git/refs/heads/edit-1", asked.join(" | "));
}
{
  const { a, asked } = await ask(branches.DELETE, "DELETE", { repo: "me/out", branch: "edit-1", sources: ["me/src"] });
  check("Delete in the site's own repository still deletes", a.ok === true && asked.some((c) => c.startsWith("DELETE ")), `${JSON.stringify(a)} ${asked.join(", ")}`);
}
process.env.GITHUB_REPOS = "";
{
  const { a } = await ask(merge.POST, "POST", { repo: "me/out", branch: "edit-1" });
  check("with no GITHUB_REPOS, any owner/name is the server's to work on, as Publish", a.ok === true, JSON.stringify(a));
}

/* ------------------------------------------------- the default branch, by its own name */
defaultBranch = "claude/wizardly-davinci-92ah39";
{
  const { a, asked } = await ask(merge.POST, "POST", { repo: "me/out", branch: "claude/wizardly-davinci-92ah39" });
  check("Merge refuses the default branch as the edit branch, whatever it is called", a.ok === false && a.reason === "bad-branch", JSON.stringify(a));
  check("…and neither merges nor deletes", !asked.some((c) => c.startsWith("POST ") || c.startsWith("DELETE ")), asked.join(", "));
}

/* ------------------------------------------------- the button sends what Publish sends */
{
  const src = readFileSync(join(ROOT, "src/features/studio/RepoPicker.tsx"), "utf8");
  const bodies = src.match(/\/api\/studio\/(merge|branches)",[^\n]*/g) ?? [];
  check("Merge and Delete on the repo panel send the sources Publish sends", bodies.length === 2 && bodies.every((b) => b.includes("sources: allSources()")), bodies.join("\n"));
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
