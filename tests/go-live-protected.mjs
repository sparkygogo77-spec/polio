#!/usr/bin/env node
/**
 * GO LIVE NEVER UNLOCKS A VERCEL PROJECT IT DID NOT MAKE.
 *
 * J points a site at a repository he already deploys on Vercel with a
 * password on purpose (a staging copy, a client's preview). The first Go
 * live quietly turned off the password and Vercel's sign-in on that project,
 * and said nothing: the deploy route took protection off whatever project it
 * found for the repository, not only one it had just made.
 *
 * Now the lock comes off only a project this press made (Vercel's default
 * lock, nobody's choice). A project it finds keeps its protection, and the
 * answer says in one plain line that the site is protected, for the top bar
 * to show as a card. Held here, with the real deploy route called in-process
 * against stand-ins for Vercel and GitHub kept in this file:
 *   · a connected project behind Vercel's sign-in and a password: nothing is
 *     sent to change it, it stays protected, and the line names both;
 *   · a project named, not connected, behind Vercel's sign-in: the same;
 *   · a found project with no protection, one whose listing leaves the
 *     fields out, and one protected on previews only: no line, no change;
 *   · no project yet: the one made is opened (sign-in and password off),
 *     and no "protected" line;
 *   · the wiring (source read): Go live shows the route's line as a card.
 *
 * No server, no browser, no token: the keys are STANDIN placeholders the
 * stand-ins never check, and nothing leaves the machine.
 *
 *   node tests/go-live-protected.mjs
 *
 * Covers: src/app/api/studio/deploy/route.ts, src/features/studio/send-out/goLive.ts
 * The server-and-browser check of the same route: tests/go-live-first-deploy.mjs.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 400)}`}`);
};

/* ------------------------------------------------- Vercel and GitHub, stand-ins */
const SHA = "c0ffee1234567890c0ffee1234567890c0ffee12";
const lock = { sso: { deploymentType: "all_except_custom_domains" }, pw: { deploymentType: "all" } };
const linked = (repo) => ({ type: "github", org: "him", repo, repoId: 7, productionBranch: "main" });
const projects = [
  { id: "prj_staging", name: "staging", link: linked("staging"), ssoProtection: lock.sso, passwordProtection: lock.pw },
  { id: "prj_client", name: "client-preview", ssoProtection: lock.sso, passwordProtection: null },
  { id: "prj_open", name: "open", link: linked("open"), ssoProtection: null, passwordProtection: null },
  { id: "prj_unsaid", name: "unsaid", link: linked("unsaid") },
  { id: "prj_previews", name: "previews", link: linked("previews"), ssoProtection: { deploymentType: "preview" }, passwordProtection: null },
];
const calls = [];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(String(init.body)) : null;
  calls.push({ line: `${method} ${u.origin}${u.pathname}`, body });
  if (u.origin === "https://github.test") return json(404, { message: "Not Found" });
  if (u.origin !== "https://vercel.test") return json(599, { message: `stand-in refuses ${u}` });
  const p = u.pathname;
  if (method === "GET" && p === "/v9/projects") return json(200, { projects: projects.map((x) => structuredClone(x)), pagination: { next: null } });
  if (method === "POST" && p === "/v11/projects") {
    const [org, repo] = String(body?.gitRepository?.repo ?? "").split("/");
    /* Vercel makes a new project behind its own sign-in. */
    const made = { id: `prj_${body.name}`, name: body.name, link: { type: "github", org, repo, repoId: 9, productionBranch: "main" }, ssoProtection: { deploymentType: "all_except_custom_domains" }, passwordProtection: null };
    projects.push(made);
    return json(200, structuredClone(made));
  }
  const one = p.match(/^\/v9\/projects\/([^/]+)$/);
  if (one && method === "PATCH") {
    const x = projects.find((q) => q.id === decodeURIComponent(one[1]));
    if (!x) return json(404, { error: { code: "not_found", message: "Project not found" } });
    Object.assign(x, body);
    return json(200, structuredClone(x));
  }
  /* A connected project deploys each push by itself: its deployment of the commit is already listed. */
  if (method === "GET" && p === "/v6/deployments") return json(200, { deployments: [{ uid: `dpl_${u.searchParams.get("projectId")}`, url: "site-abc.vercel.app", readyState: "BUILDING", meta: { githubCommitSha: SHA, githubCommitRef: "main" } }] });
  if (method === "POST" && p === "/v13/deployments") return json(200, { id: `dpl_${body.project}`, readyState: "QUEUED", url: `${body.name}-abc.vercel.app` });
  return json(404, { error: { code: "not_found", message: "Not found" } });
};
process.env.VERCEL_API = "https://vercel.test";
process.env.GITHUB_API = "https://github.test";
for (const k of ["VERCEL_TOKEN", "VERCEL_TEAM", "VERCEL_PROJECT", "GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH"]) delete process.env[k];

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const route = await jiti.import(join(ROOT, "src/app/api/studio/deploy/route.ts"));

const HEAD = { "content-type": "application/json", "x-vercel-token": "STANDIN_VERCEL_TOKEN_0123", "x-github-token": "STANDIN_GITHUB_TOKEN_0123" };
const press = async (body) => {
  calls.length = 0;
  const res = await route.POST(new Request("http://polio.test/api/studio/deploy", { method: "POST", headers: HEAD, body: JSON.stringify({ branch: "main", sha: SHA, ...body }) }));
  return { a: await res.json(), patched: calls.filter((c) => c.line.startsWith("PATCH ")).map((c) => c.line.split("/").pop()) };
};
const state = (id) => { const x = projects.find((q) => q.id === id); return JSON.stringify({ sso: x?.ssoProtection, pw: x?.passwordProtection }); };

console.log("1. A connected project behind Vercel's sign-in and a password");
{
  const was = state("prj_staging");
  const { a, patched } = await press({ repo: "him/staging", name: "Staging" });
  check("1 it goes live, following the push's own deployment", a.ok === true && a.followed === true && a.project === "staging", JSON.stringify(a));
  check("1 nothing is sent to change its protection", patched.length === 0, patched.join(", "));
  check("1 …and it is still protected as its owner set it", state("prj_staging") === was, state("prj_staging"));
  check("1 the answer says so in one plain line, naming the sign-in and the password", /^The site is protected: Vercel asks visitors for Vercel's sign-in and a password \(the staging project's Settings, then Deployment Protection\), and Go live left that as it is\.$/.test(a.note ?? ""), a.note);
}

console.log("2. A project named, not connected, behind Vercel's sign-in");
{
  const was = state("prj_client");
  const { a, patched } = await press({ repo: "him/client", name: "Client", project: "client-preview" });
  check("2 its deployment starts", a.ok === true && a.id === "dpl_prj_client", JSON.stringify(a));
  check("2 nothing is sent to change its protection, and it stays protected", patched.length === 0 && state("prj_client") === was, `${patched.join(", ")} ${state("prj_client")}`);
  check("2 the line names the sign-in only", /^The site is protected: Vercel asks visitors for Vercel's sign-in \(the client-preview project's/.test(a.note ?? "") && !/password/.test(a.note ?? ""), a.note);
}

console.log("3. Found projects the live site is open on");
for (const [repo, why] of [["open", "no protection"], ["unsaid", "a listing that leaves the fields out"], ["previews", "protection on previews only"]]) {
  const { a, patched } = await press({ repo: `him/${repo}`, name: repo });
  check(`3 ${why}: no line, and nothing sent to change it`, a.ok === true && a.note === undefined && patched.length === 0, JSON.stringify({ ok: a.ok, note: a.note, patched }));
}

console.log("4. No project yet: Go live makes one");
{
  const { a, patched } = await press({ repo: "him/fresh", name: "Fresh" });
  const made = projects.find((q) => q.name === "fresh");
  check("4 the project is made and its first deployment starts", a.ok === true && a.created === "fresh" && a.id === "dpl_prj_fresh", JSON.stringify(a));
  check("4 Vercel's default lock is taken off the project it made", JSON.stringify(patched) === JSON.stringify(["prj_fresh"]) && made?.ssoProtection === null && made?.passwordProtection === null, `${patched.join(", ")} ${state("prj_fresh")}`);
  const sent = calls.find((c) => c.line.startsWith("PATCH "))?.body;
  check("4 …by sending both kinds off, and nothing else", JSON.stringify(sent) === JSON.stringify({ ssoProtection: null, passwordProtection: null }), JSON.stringify(sent));
  check("4 no \"protected\" line for a site that is open", !/protected/.test(a.note ?? ""), a.note);
}

console.log("5. The wiring");
{
  const live = readFileSync(join(ROOT, "src/features/studio/send-out/goLive.ts"), "utf8");
  check("5 Go live shows the route's line as a card, not only in the book's note", /if \(started\.note\) \{\s*setNote\(started\.note\);\s*say\(\{ key: "studio:live-note", [^}]*body: started\.note, level: "warn"/.test(live));
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
