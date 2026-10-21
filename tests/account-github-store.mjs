#!/usr/bin/env node
/**
 * THE ACCOUNT KEPT IN A PRIVATE GITHUB REPOSITORY, CHECKED WITHOUT GITHUB.
 *
 * J (2026-10-21): the Vercel Blob store was suspended, so a GitHub sign-in
 * keeps the account in `<login>/polio-saves`. This drives
 * `src/app/api/account/github.ts` against a GitHub stood in by a Map:
 *
 *   1. before the first save there is nothing, and nothing is made;
 *   2. the first save makes the repository, private;
 *   3. what is saved reads back byte for byte, with the version the list
 *      shows (git's blob sha), and a picture is known for what it is;
 *   4. saving again replaces the file (with its sha), and the version moves;
 *   5. a key that may not make the repository is told what it needs.
 *
 *   node tests/account-github-store.mjs
 */
import { blobSha, githubBackend, GithubStoreError, savesRepo, sniff } from "../src/app/api/account/github.ts";

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

function fakeGitHub({ mayCreate = true } = {}) {
  const repo = { made: false, private: null, files: new Map() };
  const calls = [];
  const json = (b, status = 200) => new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });
  const fetch = async (url, init = {}) => {
    const u = new URL(url);
    const method = init.method ?? "GET";
    calls.push(`${method} ${u.pathname}`);
    const accept = init.headers?.accept ?? "";
    if (u.pathname === "/user/repos" && method === "POST") {
      if (!mayCreate) return json({ message: "Resource not accessible by personal access token" }, 403);
      const b = JSON.parse(init.body);
      repo.made = true; repo.private = b.private;
      return json({ default_branch: "main" }, 201);
    }
    const base = "/repos/STANDIN-owner/polio-saves";
    if (!u.pathname.startsWith(base)) return json({}, 404);
    if (!repo.made) return json({ message: "Not Found" }, 404);
    const rest = u.pathname.slice(base.length);
    if (rest === "") return json({ default_branch: "main", private: repo.private });
    if (rest.startsWith("/git/trees/")) return json({ tree: [...repo.files].map(([path, b]) => ({ path, type: "blob", sha: blobSha(b), size: b.byteLength })) });
    if (rest.startsWith("/contents/")) {
      const path = decodeURIComponent(rest.slice("/contents/".length));
      const have = repo.files.get(path);
      if (method === "GET") {
        if (!have) return json({ message: "Not Found" }, 404);
        if (accept.includes("raw")) return new Response(have, { status: 200 });
        return json({ sha: blobSha(have), path });
      }
      if (method === "PUT") {
        const b = JSON.parse(init.body);
        if (have && b.sha !== blobSha(have)) return json({ message: "sha mismatch" }, 409);
        const bytes = new Uint8Array(Buffer.from(b.content, "base64"));
        repo.files.set(path, bytes);
        return json({ content: { sha: blobSha(bytes) } }, have ? 200 : 201);
      }
      if (method === "DELETE") { repo.files.delete(path); return json({}); }
    }
    return json({}, 404);
  };
  return { repo, calls, fetch };
}

const enc = (s) => new TextEncoder().encode(s);
check("the repository is <login>/polio-saves unless POLIO_SAVES_REPO says", savesRepo({}, "sparky") === "sparky/polio-saves" && savesRepo({ POLIO_SAVES_REPO: "a/b" }, "x") === "a/b" && savesRepo({ POLIO_SAVES_REPO: "bad" }, "x") === "x/polio-saves");

// 1.
const gh = fakeGitHub();
const store = () => githubBackend({ token: "ghp_STANDIN", repo: "STANDIN-owner/polio-saves", fetch: gh.fetch });
check("before the first save the list is empty and nothing reads", (await store().list("data/")).length === 0 && (await store().read("data/prefs.json")) === null);
check("and reading made nothing", !gh.repo.made && !gh.calls.some((c) => c.startsWith("POST")));

// 2. + 3.
const site = enc(JSON.stringify({ kind: "polio-account-site", name: "Mochi" }));
const w = await store().write("data/sites/s1.json", site, "application/json");
check("the first save makes the repository, private", gh.repo.made && gh.repo.private === true);
const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
await store().write("data/pictures/pic_1", png, "image/png");
const listed = await store().list("data/");
const one = listed.find((i) => i.path === "data/sites/s1.json");
check("the list shows both, with git's sha as the version", listed.length === 2 && one?.etag === w.etag && w.etag === `"${blobSha(site)}"`);
const back = await store().read("data/sites/s1.json");
check("a site reads back byte for byte, as JSON, with the same version", back && Buffer.from(back.bytes).equals(Buffer.from(site)) && back.type === "application/json" && back.etag === w.etag);
check("a picture is known for what it is", (await store().read("data/pictures/pic_1"))?.type === "image/png" && sniff("data/pictures/x", enc("GIF89a")) === "image/gif" && sniff("data/pictures/x", enc("<svg")) === "application/octet-stream");

// 4.
const site2 = enc(JSON.stringify({ kind: "polio-account-site", name: "Mochi 2" }));
const w2 = await store().write("data/sites/s1.json", site2, "application/json");
check("saving again replaces it, and the version moves", w2.etag !== w.etag && (await store().list("data/sites/")).find((i) => i.path === "data/sites/s1.json")?.etag === w2.etag);
await store().remove("data/pictures/pic_1");
check("remove takes a file away", (await store().read("data/pictures/pic_1")) === null);

// 5.
const locked = fakeGitHub({ mayCreate: false });
let err = null;
try { await githubBackend({ token: "ghp_STANDIN", repo: "STANDIN-owner/polio-saves", fetch: locked.fetch }).write("data/prefs.json", enc("{}"), "application/json"); } catch (e) { err = e; }
check("a key that may not make the repository is told what it needs", err instanceof GithubStoreError && /Administration/.test(err.message) && err.status === 403, err?.message);

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
