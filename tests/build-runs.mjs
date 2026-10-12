#!/usr/bin/env node
/**
 * BUILD'S CODE RUNS ON THE LIVE SITE (J, 2026-10-12: "Run it").
 *
 * Build wrote a Next.js codebase and nothing to run it with, and it went up
 * beside the site's published HTML pages, which were what Vercel served: the
 * code was only ever read. J chose that it runs. Held here:
 *
 *   1. Build writes what makes it an app Vercel runs: package.json at the
 *      Builder's own versions (three only with a solid), a tsconfig whose
 *      "@/" is the root, a Next config that goes on past a type error, a
 *      vercel.json that says Next.js. And the parts compile as Next reads
 *      them: two elements side by side in a fragment, a cube a client
 *      component, a quote in a label or an attribute in braces, a "*" "/"
 *      in a label kept from closing the comment it is written in;
 *   2. the record of what Build wrote (`buildRecord.ts`): written again
 *      when the branch still holds Build's own, kept when somebody changed
 *      it, taken off when Build no longer writes it and nobody changed it,
 *      Claude's file in the book written as sent; and the site's own files
 *      moved into public/, the export's vercel.json giving way to the app's;
 *   3. the real publish route, against a stand-in GitHub kept in this file:
 *      · the push that makes a site an app writes everything as sent, and
 *        the copies of the pages at the root come off, the record of the
 *        pages now naming them in public/;
 *      · the next push keeps the part a code chat changed, writes the rest
 *        again, takes off the part no longer on the board, and says both;
 *      · a branch record that cannot be read keeps and takes off nothing;
 *   4. the wiring (source read): every Go live of a site Build made carries
 *      the app, Build's parts point at the pictures where public/ serves
 *      them, and Bring in finds a picture in public/;
 *   5. the real thing: Build's files for a board with every kind of part,
 *      and the site's pages in public/, through `next build`, then served
 *      by `next start`: the app at / and /orb-lab, the pages at their own
 *      files, the picture where the parts point.
 *
 * No browser, no token, nothing leaves the machine: the key is a STANDIN
 * placeholder the stand-in never reads.
 *
 *   node tests/build-runs.mjs
 *
 * Covers: src/features/studio/scaffolding/app.ts, src/features/studio/scaffolding/scaffold.ts, src/features/studio/scaffolding/pages.ts, src/features/studio/scaffolding/jsx.ts, src/features/studio/scaffolding/frameMesh.ts, src/features/studio/scaffolding/shell.ts, src/features/studio/scaffolding/contract.ts, src/features/studio/send-out/buildRecord.ts, src/features/studio/send-out/goLive.ts, src/app/api/studio/publish/route.ts, src/features/studio/loop/agent.ts, src/features/studio/scaffoldRun.ts, src/features/studio/repoRun.ts, src/features/studio/BriefDialog.tsx
 */
import { createHash } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 600)}`}`);
};
const J = (x) => JSON.stringify(x);

const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(ROOT, "src") } });
const S = await jiti.import(join(ROOT, "src/features/studio/scaffold.ts"));
const A = await jiti.import(join(ROOT, "src/features/studio/scaffolding/app.ts"));
const R = await jiti.import(join(ROOT, "src/features/studio/send-out/index.ts"));

/* ------------------------------------------------- 1. what Build writes */
const behaviours = { progress: true, backToTop: false, reveal: false, parallax: 0, smooth: false, snap: null, intro: false, cursor: null, tilt: false, confetti: false, described: [], any: true };
const input = {
  name: "BLACKORB: the \"dark\" one",
  gimmick: "A black sphere lit from inside the dark.",
  master: "",
  frameWidth: 1440,
  pages: [{ id: "p1", name: "Home", path: "/", behaviours }, { id: "p2", name: "Orb lab", path: "/orb-lab", prompt: "Three orbs */ side by side." }],
  parts: [
    /* Two elements side by side, a picture where the site serves it, an attribute with a quote in it, an element TypeScript does not know. */
    { id: "n_head", pageId: "p1", featureId: "big-headline", label: "Hero \"headline\" */ one", prompt: "Two tone, */ really.", x: 0, y: 0, w: 1440, h: 200,
      html: '<h1 style="color:#f5f7f2;font-size:88px">Power in the <em style="color:#b8ff24">dark</em></h1><p title="say &quot;hi&quot;" align="center">sub {line}</p><img src="/assets/pictures/orb1234.png" alt="the orb"><orb-glow data-x="1"></orb-glow>' },
    { id: "n_body", pageId: "p1", featureId: "custom-idea", label: "The helix", prompt: "", x: 80, y: 260, w: 360, h: 360, html: "",
      outline: { cut: "M 0.5 0 L 1 1 L 0 1 Z", closed: true }, code: { html: '<svg viewBox="0 0 10 10"><text x="1" y="5">a helix</text></svg>' } },
    { id: "n_cube", pageId: "p2", featureId: "cube-3d", label: "Pillars \"three\"", prompt: "", x: 0, y: 0, w: 400, h: 300, html: "", cube: { faces: [{ heading: "Speed", body: "", colour: "accent" }] } },
    { id: "n_mesh", pageId: "p2", featureId: "mesh", label: "The orb", prompt: "", x: 420, y: 0, w: 400, h: 300, html: "", mesh: { glb: "data:model/gltf-binary;base64,AA==" } },
    { id: "n_link", pageId: "p2", featureId: "button", label: "Back home", prompt: "", x: 0, y: 320, w: 200, h: 60, html: "<span>Home</span>", link: { kind: "page", target: "p1" } },
  ],
  palette: { bg: "#050505", surface: "#0c0e0d", text: "#f5f7f2", muted: "#8c9690", accent: "#b8ff24", highlight: "#075dff" },
  tokens: { radius: 8, fontPx: 16, bodyFamily: "ui-monospace, monospace", headingFamily: "ui-monospace, monospace", line: "#1b1f1d", surface: "#0c0e0d", muted: "#8c9690" },
};
const files = S.scaffold(input);
const at = (p) => files.find((f) => f.path === p)?.content ?? "";
{
  const pkg = JSON.parse(at("package.json"));
  const own = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  const all = { ...pkg.dependencies, ...pkg.devDependencies };
  const drift = Object.entries(all).filter(([name, v]) => (own.dependencies?.[name] ?? own.devDependencies?.[name]) !== v);
  check("1 package.json names the packages at the versions the Builder renders the parts with", drift.length === 0 && ["next", "react", "react-dom", "three"].every((n) => n in pkg.dependencies), J(drift));
  check("1 …named for npm from the site's name, private, with the scripts to build, run and check it", pkg.name === "blackorb-the-dark-one" && pkg.private === true && pkg.scripts.build === "next build" && pkg.scripts.typecheck === "tsc --noEmit", J(pkg));
  check("1 a site with no solid needs no three", !("three" in JSON.parse(S.scaffold({ ...input, parts: input.parts.filter((p) => !p.mesh) }).find((f) => f.path === "package.json").content).dependencies));
  check("1 vercel.json says Next.js, and next build goes on past a type error", JSON.parse(at("vercel.json")).framework === "nextjs" && /ignoreBuildErrors:\s*true/.test(at("next.config.mjs")));
  check("1 a name npm would refuse is made one it takes", A.packageName("  ---  ") === "site" && A.packageName("Über Orb!!") === "ber-orb" && A.packageName("x".repeat(90)).length <= 60);
  const head = at(`components/parts/${S.componentName(input.parts[0])}.tsx`);
  check("1 two elements side by side go in a fragment", /return \(\n<>\n[\s\S]*<\/h1><p[\s\S]*\n {4}<\/>\n {2}\);/.test(head), head.slice(head.indexOf("return"), head.indexOf("return") + 200));
  check("1 an attribute with a quote in it goes in braces, as the string it is", head.includes('title={"say \\"hi\\""}'), (head.match(/title=[^ ]+ /) ?? [""])[0]);
  check("1 a picture points where public/ serves it", head.includes('src="/assets/pictures/orb1234.png"'));
  check("1 a star and a slash in a label or a prompt never close the comment they are written in", !/\*\/ one|\*\/ really|\*\/ side/.test(files.map((f) => f.content).join("\n")) && head.includes("* / one"));
  const cube = at(`components/parts/${S.componentName(input.parts[2])}.tsx`);
  check("1 a cube is a client component, so a page can import it", /^"use client";$/m.test(cube) && cube.indexOf('"use client"') < cube.indexOf("import "), cube.slice(0, 120));
  check("1 its label goes in braces when it has a quote", cube.includes('aria-label={"Pillars \\"three\\", a cube.'));
}

/* ------------------------------------------------- 2. the record */
const sha = (text) => createHash("sha1").update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest("hex");
{
  const rec = R.buildRecordFile({ "b.tsx": sha("b"), "a.tsx": sha("a") });
  const said = JSON.parse(rec.content);
  check("2 the record is site/build.json, its files in order, and says what it is for", rec.path === "site/build.json" && R.BUILD_RECORD === "site/build.json" && J(Object.keys(said.files)) === J(["a.tsx", "b.tsx"]) && /kept as it is/.test(said.about) && /never touched/.test(said.about), rec.content);
  check("2 a record read back is the same files; one that is not a record is none", J(R.builtIn(rec.content)) === J({ "a.tsx": sha("a"), "b.tsx": sha("b") }) && R.builtIn("nope") === null && R.builtIn("{}") === null);
  check("2 a line with no sha, a short one, an absolute path or one that climbs out is dropped", J(R.builtIn(J({ files: { "ok.tsx": sha("x"), "short.tsx": "abc", "/abs.tsx": sha("x"), "../up.tsx": sha("x"), "n.tsx": 7 } }))) === J({ "ok.tsx": sha("x") }));
  const was = { "app/page.tsx": sha("page 1"), "components/parts/A.tsx": sha("A 1"), "components/parts/B.tsx": sha("B 1"), "components/parts/Old.tsx": sha("old"), "components/parts/Worked.tsx": sha("worked") };
  const now = { "app/page.tsx": sha("page 2"), "components/parts/A.tsx": sha("A 2"), "components/parts/B.tsx": sha("B 2"), "components/parts/New.tsx": sha("new"), "components/parts/C.tsx": sha("C 1") };
  const onBranch = new Map([["app/page.tsx", sha("page 1")], ["components/parts/A.tsx", sha("A, by a code chat")], ["components/parts/B.tsx", sha("B 1")], ["components/parts/Old.tsx", sha("old")], ["components/parts/Worked.tsx", sha("worked on")], ["components/parts/New.tsx", sha("someone's own New")], ["site/build.json", sha("rec")]]);
  /* What this push sends: Build's own everywhere, except C, which Claude wrote over in the book. */
  const sent = new Map([["app/page.tsx", sha("page 2")], ["components/parts/A.tsx", sha("A 2")], ["components/parts/B.tsx", sha("B 2")], ["components/parts/New.tsx", sha("new")], ["components/parts/C.tsx", sha("C by Claude")]]);
  const r = R.buildKeeps(was, now, onBranch, sent);
  check("2 a file the branch still holds as Build wrote it is written again; one somebody changed is kept; one already there that Build never wrote is kept", J(r.keep) === J(["components/parts/A.tsx", "components/parts/New.tsx"]), J(r));
  check("2 one Build no longer writes comes off when nobody changed it, and is left when somebody did", J(r.gone) === J(["components/parts/Old.tsx"]), J(r));
  check("2 Claude's file in the book is written as sent, whatever the branch holds", !r.keep.includes("components/parts/C.tsx") && J(R.buildKeeps(was, now, new Map([...onBranch, ["components/parts/C.tsx", sha("C, changed")]]), sent).keep).indexOf("C.tsx") < 0);
  check("2 a branch with no record keeps nothing and takes nothing off", J(R.buildKeeps(null, now, onBranch, sent)) === J({ keep: [], gone: [] }));
  check("2 a branch that cannot be listed keeps nothing and takes nothing off", J(R.buildKeeps(was, now, new Map(), sent)) === J({ keep: [], gone: [] }));
  const moved = R.intoPublic([{ path: "index.html" }, { path: "orb-lab/index.html" }, { path: "assets/site.css" }, { path: "assets/pictures/x.png", encoding: "base64" }, { path: "vercel.json" }]);
  check("2 the site's own files go into public/ at the same addresses, the export's vercel.json giving way to the app's", J(moved.map((f) => f.path)) === J(["public/index.html", "public/orb-lab/index.html", "public/assets/site.css", "public/assets/pictures/x.png"]) && moved[3].encoding === "base64", J(moved));
}

/* ------------------------------------------------- 3. the route, against a stand-in GitHub */
const git = { blobs: new Map(), trees: new Map(), commits: new Map(), tip: null, failBlobRead: false };
const blobId = (buf) => createHash("sha1").update(`blob ${buf.length}\0`).update(buf).digest("hex");
const putBlob = (buf) => { const id = blobId(buf); git.blobs.set(id, buf); return id; };
let n = 0;
const putTree = (entries) => { const id = `tree${++n}`; git.trees.set(id, new Map(entries)); return id; };
const putCommit = (tree, parents) => { const id = `commit${++n}`; git.commits.set(id, { tree, parents }); return id; };
const seed = (tree) => { git.tip = putCommit(putTree(Object.entries(tree).map(([p, text]) => [p, putBlob(Buffer.from(text))])), []); };
const onBranch = () => git.trees.get(git.commits.get(git.tip).tree);
const textAt = (path) => { const s = onBranch().get(path); return s ? git.blobs.get(s).toString("utf8") : null; };
const posted = { trees: [] };
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
/* The real one, for the site `next start` serves in 5. */
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = new URL(String(url));
  const method = init.method ?? "GET";
  if (u.origin !== "https://github.test") return json(599, { message: `stand-in refuses ${u}` });
  if (!u.pathname.startsWith("/repos/him/site")) return json(404, { message: "Not Found" });
  const p = decodeURIComponent(u.pathname.slice("/repos/him/site".length));
  const body = init.body ? JSON.parse(String(init.body)) : null;
  if (method === "GET" && p === "") return json(200, { default_branch: "main", full_name: "him/site" });
  if (p.startsWith("/contents/")) return json(404, { message: "Not Found" });
  if (method === "GET" && p === "/git/ref/heads/main") return git.tip ? json(200, { object: { sha: git.tip } }) : json(404, { message: "Not Found" });
  if (method === "GET" && p.startsWith("/git/commits/")) { const c = git.commits.get(p.slice(13)); return c ? json(200, { sha: p.slice(13), tree: { sha: c.tree } }) : json(404, { message: "Not Found" }); }
  if (method === "GET" && p.startsWith("/git/trees/")) {
    const t = git.trees.get(p.slice(11));
    return t ? json(200, { sha: p.slice(11), truncated: false, tree: [...t].map(([path, s]) => ({ path, mode: "100644", type: "blob", sha: s })) }) : json(404, { message: "Not Found" });
  }
  if (method === "GET" && p.startsWith("/git/blobs/")) {
    if (git.failBlobRead) return json(502, { message: "Bad Gateway" });
    const b = git.blobs.get(p.slice(11));
    return b ? json(200, { sha: p.slice(11), encoding: "base64", content: b.toString("base64").replace(/.{60}/g, "$&\n"), size: b.length }) : json(404, { message: "Not Found" });
  }
  if (method === "POST" && p === "/git/blobs") return json(201, { sha: putBlob(Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8")) });
  if (method === "POST" && p === "/git/trees") {
    posted.trees.push(body);
    const t = new Map(body.base_tree ? git.trees.get(body.base_tree) : []);
    for (const e of body.tree) {
      if (e.sha !== null) { t.set(e.path, e.sha); continue; }
      if (!t.has(e.path)) return json(422, { message: `GitRPC::BadObjectState: ${e.path} is not in the tree` });
      t.delete(e.path);
    }
    return json(201, { sha: putTree(t) });
  }
  if (method === "POST" && p === "/git/commits") return json(201, { sha: putCommit(body.tree, body.parents), html_url: "https://github.test/commit" });
  if (method === "PATCH" && p === "/git/refs/heads/main") { git.tip = body.sha; return json(200, { object: { sha: body.sha } }); }
  return json(404, { message: "Not Found" });
};
process.env.GITHUB_API = "https://github.test";
process.env.PUBLISH_BLOB_GAP_MS = "0";
for (const k of ["GITHUB_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH", "GITHUB_REPOS", "VERCEL_DEPLOY_HOOK"]) delete process.env[k];
const route = await jiti.import(join(ROOT, "src/app/api/studio/publish/route.ts"));
const push = async (out) => {
  const before = posted.trees.length;
  const res = await route.POST(new Request("http://polio.test/api/studio/publish", { method: "POST", headers: { "content-type": "application/json", "x-github-token": "STANDIN_GITHUB_TOKEN_0123456789" }, body: J({ repo: "him/site", branch: "main", message: "Builder: publish", deploy: false, files: out }) }));
  const a = await res.json();
  return { a, nulls: posted.trees.length > before ? posted.trees.at(-1).tree.filter((e) => e.sha === null).map((e) => e.path).sort() : [] };
};
/** What a push of the app sends: the site's pages in public/ with their record, Build's files with theirs, the document, and Claude's files. */
const appPush = (built, claude = {}) => {
  const site = R.intoPublic([{ path: "index.html", content: "<h1>Home</h1>" }, { path: "assets/site.css", content: "body{}" }, { path: "vercel.json", content: "{}" }]);
  return [
    ...site, R.pagesRecord(site),
    ...Object.entries({ ...built, ...claude }).map(([path, content]) => ({ path, content })),
    R.buildRecordFile(Object.fromEntries(Object.entries(built).map(([p, text]) => [p, sha(text)]))),
    { path: "site/document.json", content: "{}\n" },
  ];
};
const OWNER = { "notes/owner.md": "# The owner's notes\n", "lib/feed.ts": "export const feed = 1;\n" };

console.log("3a. The push that makes a site an app");
seed({ ...OWNER, "index.html": "<h1>Home, static</h1>", "about/index.html": "<h1>About</h1>", "assets/site.css": "body{}", "vercel.json": '{"cleanUrls":true}', "site/pages.json": R.pagesRecord([{ path: "index.html" }, { path: "about/index.html" }]).content, "app/page.tsx": "// Build's, from before it ran\n" });
{
  const built = { "package.json": "{}\n", "vercel.json": '{"framework":"nextjs"}\n', "app/page.tsx": "export default function Page() { return null; }\n", "components/parts/HeroA1B2.tsx": "export function HeroA1B2() { return null; }\n", "components/parts/OldC3D4.tsx": "export function OldC3D4() { return null; }\n" };
  const { a, nulls } = await push(appPush(built));
  check("3a it publishes, writing Build's files as sent: no record on the branch yet", a.ok === true && a.kept === undefined && textAt("app/page.tsx") === built["app/page.tsx"] && textAt("vercel.json") === built["vercel.json"], J(a));
  check("3a the pages' copies at the root come off, the record now naming them in public/", J(nulls) === J(["about/index.html", "index.html"]) && textAt("public/index.html") === "<h1>Home</h1>" && J(JSON.parse(textAt("site/pages.json")).pages) === J(["public/index.html"]), J(nulls));
  check("3a the branch gets Build's record", J(Object.keys(JSON.parse(textAt("site/build.json") ?? "{}").files ?? {})) === J(Object.keys(built).sort()), textAt("site/build.json"));
  check("3a the owner's own files stay", Object.keys(OWNER).every((p) => textAt(p) === OWNER[p]));
}

console.log("3b. A code chat changes a part; the board loses another; Go live again");
{
  const chat = "export function HeroA1B2() { return <h1>by a code chat</h1>; }\n";
  git.tip = putCommit(putTree([...onBranch(), ["components/parts/HeroA1B2.tsx", putBlob(Buffer.from(chat))]]), [git.tip]);
  const built = { "package.json": "{}\n", "vercel.json": '{"framework":"nextjs"}\n', "app/page.tsx": "export default function Page() { return <main />; }\n", "components/parts/HeroA1B2.tsx": "export function HeroA1B2() { return <h1>from the board, again</h1>; }\n" };
  const { a, nulls } = await push(appPush(built, { "components/data.ts": "export const data = [];\n" }));
  check("3b the part the code chat changed is kept as it is", a.ok === true && textAt("components/parts/HeroA1B2.tsx") === chat, textAt("components/parts/HeroA1B2.tsx"));
  check("3b …and the answer says so", J(a.kept) === J(["components/parts/HeroA1B2.tsx"]), J(a.kept));
  check("3b the rest of Build's files are written again from the board", textAt("app/page.tsx") === built["app/page.tsx"]);
  check("3b the part no longer on the board comes off, and the answer names it", J(nulls) === J(["components/parts/OldC3D4.tsx"]) && !onBranch().has("components/parts/OldC3D4.tsx") && (a.removed ?? []).includes("components/parts/OldC3D4.tsx"), J({ nulls, removed: a.removed }));
  check("3b Claude's file from the book goes up, and the owner's own files stay", textAt("components/data.ts") === "export const data = [];\n" && Object.keys(OWNER).every((p) => textAt(p) === OWNER[p]));
}

console.log("3c. The branch's record cannot be read");
{
  git.failBlobRead = true;
  const built = { "app/page.tsx": "export default function Page() { return <main>3c</main>; }\n", "components/parts/HeroA1B2.tsx": "export function HeroA1B2() { return null; }\n" };
  const { a, nulls } = await push(appPush(built));
  git.failBlobRead = false;
  check("3c everything goes as sent and nothing comes off", a.ok === true && a.kept === undefined && nulls.length === 0 && textAt("components/parts/HeroA1B2.tsx") === built["components/parts/HeroA1B2.tsx"], J({ a, nulls }));
}

/* ------------------------------------------------- 4. the wiring */
{
  const live = readFileSync(join(ROOT, "src/features/studio/send-out/goLive.ts"), "utf8");
  check("4 every Go live asks whether the push carries the app, and sends Claude's files over Build's", /const app = await carriesApp\(!!o\.built, repo, branch\);/.test(live) && /app \? \{ explicit: o\.extra \?\? \[\] \} : null\);/.test(live));
  check("4 it carries Build's files written again from the board, and their record", /built = buildScaffold\(\)\.files;/.test(live) && /record: buildRecordFile\(/.test(live) && /intoPublic\(\[\.\.\.pages, \.\.\.shots/.test(live));
  const agent = readFileSync(join(ROOT, "src/features/studio/loop/agent.ts"), "utf8");
  check("4 the record goes in the last request, where the route reads it as it commits; a branch holding it is an app", /const COMMITTED_LAST = new Set\(\[[^\]]*BUILD_RECORD[^\]]*\]\)/.test(agent) && /\.has\(BUILD_RECORD\)/.test(agent));
  const book = readFileSync(join(ROOT, "src/features/studio/BriefDialog.tsx"), "utf8");
  check("4 the book sends only what Claude wrote over Build's files, and says Build ran", /goLiveNow\(\{ extra: claudeFiles, built: !!ownFiles,/.test(book) && /carriesApp\(!!ownFiles, repo, branch\)/.test(book));
  const run = readFileSync(join(ROOT, "src/features/studio/scaffoldRun.ts"), "utf8");
  check("4 Build's parts point at a picture where the site serves it, not this browser's blob", /const pictureAt = \(pic: \{ path: string \}\) => `\/\$\{pic\.path/.test(run) && /layers: s\.look\?\.texture, pictureAt,/.test(run));
  const bring = readFileSync(join(ROOT, "src/features/studio/repoRun.ts"), "utf8");
  check("4 Bring in finds a picture in public/ when the site is an app", /pathIn\(repo\.dir, `public\/\$\{path\}`\)/.test(bring));
}

/* ------------------------------------------------- 5. the real thing: next build, then next start */
const scratch = join(ROOT, ".scratch");
mkdirSync(scratch, { recursive: true });
/* A run that died before it cleaned up leaves its app behind; this one starts clean. */
for (const d of readdirSync(scratch)) if (d.startsWith("build-runs-")) rmSync(join(scratch, d), { recursive: true, force: true });
/* Inside the repository, so Next finds the Builder's own packages above it: what Vercel installs from package.json. */
const site = join(scratch, `build-runs-${process.pid}`);
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const statics = R.intoPublic([
  { path: "index.html", content: "<!doctype html><title>Home</title><p>THE PAGE, AS PUBLISHED</p>" },
  { path: "orb-lab/index.html", content: "<!doctype html><title>Lab</title><p>THE LAB PAGE, AS PUBLISHED</p>" },
  { path: "assets/site.css", content: "body{margin:0}" },
  { path: "assets/pictures/orb1234.png", content: PNG },
  { path: "vercel.json", content: '{"cleanUrls":true}' },
]);
let server = null;
try {
  for (const f of [...files, ...statics]) {
    const to = join(site, f.path);
    mkdirSync(dirname(to), { recursive: true });
    writeFileSync(to, f.content);
  }
  const next = join(ROOT, "node_modules", "next", "dist", "bin", "next");
  const env = { ...process.env, NEXT_TELEMETRY_DISABLED: "1" };
  const built = spawnSync(process.execPath, [next, "build"], { cwd: site, env, encoding: "utf8", timeout: 400_000 });
  const said = `${built.stdout ?? ""}${built.stderr ?? ""}`;
  check("5 next build builds Build's files with the site's pages in public/", built.status === 0, said.split("\n").filter((l) => /error|Error|failed|✓|Route/.test(l)).slice(0, 14).join(" | ") || said.slice(-1200));
  if (built.status === 0) {
    const port = 41000 + (process.pid % 2000);
    server = spawn(process.execPath, [next, "start", "-p", String(port)], { cwd: site, env, stdio: "ignore" });
    const base = `http://127.0.0.1:${port}`;
    const get = async (path) => { try { const r = await realFetch(`${base}${path}`); return { status: r.status, type: r.headers.get("content-type") ?? "", text: /image/.test(r.headers.get("content-type") ?? "") ? "" : await r.text() }; } catch { return { status: 0, type: "", text: "" }; } };
    for (let i = 0; i < 120 && (await get("/")).status === 0; i++) await new Promise((r) => setTimeout(r, 250));
    const home = await get("/");
    check("5 / is the app: the board's home page, drawn by Build's parts", home.status === 200 && home.text.includes("Power in the") && home.text.includes("orb1234.png"), `${home.status} ${home.text.slice(0, 200)}`);
    const lab = await get("/orb-lab");
    check("5 /orb-lab is the app's second page", lab.status === 200 && lab.text.includes("data-cube"), `${lab.status}`);
    const page = await get("/index.html");
    const labPage = await get("/orb-lab/index.html");
    check("5 the site's published pages are still there, at their own files", page.status === 200 && page.text.includes("THE PAGE, AS PUBLISHED") && labPage.status === 200 && labPage.text.includes("THE LAB PAGE"), `${page.status} ${labPage.status}`);
    const pic = await get("/assets/pictures/orb1234.png");
    check("5 the picture is where the parts point", pic.status === 200 && /image\/png/.test(pic.type), `${pic.status} ${pic.type}`);
  }
} finally {
  server?.kill("SIGTERM");
  rmSync(site, { recursive: true, force: true });
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
