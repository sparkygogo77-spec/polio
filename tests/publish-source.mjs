#!/usr/bin/env node
/**
 * A BOARD NEVER PUBLISHES INTO THE REPOSITORY IT WAS BROUGHT IN FROM.
 *
 * The owner's ruling: polio never writes to a capture repository. sink holds
 * the capturer's code and the capture, and it is kept. Publish sends a site
 * to its own output repository, never to the capture it came from.
 *
 * MEASURED ON 3e14749: a fresh Bring of sparkygogo77-spec/sink left the site
 * with `repo = sparkygogo77-spec/sink, bound = "import"`, and Publish sent
 * that as both `repo` and `boundTo`, so it committed to sink's main and
 * replaced site/document.json.
 *
 * WHAT THIS DOES, all of it against stand-ins, nothing against GitHub:
 *   · the browser's reads of GitHub (the import) are answered here, from the
 *     sink fixture, with a tree that carries site/capture/ as sink's does;
 *   · the server's GitHub is a stand-in on STUB_PORT, which records every
 *     call. The server must be started pointed at it, and WITHOUT a
 *     GITHUB_TOKEN of its own. The test proves the first before it presses
 *     anything, and every call it makes carries a placeholder token, so a
 *     server pointed anywhere else could not write with it either.
 *
 *   npm run build
 *   env -u GITHUB_TOKEN -u GITHUB_REPO GITHUB_API=http://127.0.0.1:4329 npx next start -p 3013
 *   node tests/publish-source.mjs http://127.0.0.1:3013
 */
import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PORT = Number(process.env.STUB_PORT ?? 4329);
const SINK = "sparkygogo77-spec/sink";
const TOKEN = "not-a-token-placeholder-xxxx";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const same = (a, b) => typeof a === "string" && typeof b === "string" && a.toLowerCase() === b.toLowerCase();

/* ------------------------------------------------------------------ */
/* The server's GitHub: a stand-in that records every call             */
/* ------------------------------------------------------------------ */

/** Every call the route made, as "METHOD /path". */
const seen = [];
/** Repositories that carry a capture, as sink does. */
const CAPTURED = new Set([SINK.toLowerCase()]);
const isWrite = (line) => /^(POST|PATCH|PUT|DELETE) /.test(line) && !line.startsWith("POST /user/repos");
const writesTo = (repo) => seen.filter((l) => isWrite(l) && l.toLowerCase().includes(`/repos/${repo.toLowerCase()}/`));
const stub = http.createServer(async (req, res) => {
  const body = await new Promise((ok) => { const c = []; req.on("data", (d) => c.push(d)); req.on("end", () => ok(Buffer.concat(c).toString("utf8"))); });
  const path = new URL(req.url, `http://127.0.0.1:${PORT}`).pathname;
  seen.push(`${req.method} ${path}`);
  const send = (status, obj) => { res.writeHead(status, { "content-type": "application/json" }); res.end(JSON.stringify(obj)); };
  const m = path.match(/^\/repos\/([^/]+\/[^/]+)(\/.*)?$/);
  if (path === "/user/repos" && req.method === "POST") {
    const b = JSON.parse(body || "{}");
    return send(201, { full_name: `someone/${b.name}` });
  }
  if (!m) return send(404, { message: "Not Found" });
  const repo = m[1].toLowerCase();
  const rest = m[2] ?? "";
  if (!rest && req.method === "GET") return send(200, { default_branch: "main", full_name: m[1] });
  if (rest.startsWith("/contents/site/capture") && req.method === "GET") {
    if (repo === "someone/unreadable") return send(500, { message: "Server Error" });
    return CAPTURED.has(repo) ? send(200, [{ name: "home.json", path: "site/capture/home.json", type: "file" }]) : send(404, { message: "Not Found" });
  }
  if (rest.startsWith("/git/ref/heads/") && req.method === "GET") return send(200, { object: { sha: "tip0" } });
  if (rest.startsWith("/git/commits/") && req.method === "GET") return send(200, { tree: { sha: "tree0" } });
  if (rest === "/git/blobs" && req.method === "POST") return send(201, { sha: `blob${seen.length}` });
  if (rest === "/git/trees" && req.method === "POST") return send(201, { sha: "tree1" });
  if (rest === "/git/commits" && req.method === "POST") return send(201, { sha: "commit1", html_url: `https://example.invalid/${repo}/commit1` });
  if (rest.startsWith("/git/refs") && (req.method === "PATCH" || req.method === "POST")) return send(200, { object: { sha: "commit1" } });
  return send(404, { message: "Not Found" });
});
await new Promise((ok) => stub.listen(PORT, "127.0.0.1", ok));

/** The route, called the way the browser calls it, with the placeholder token. */
const publishRoute = async (body) => {
  const r = await fetch(`${BASE}/api/studio/publish`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-github-token": TOKEN },
    body: JSON.stringify({ files: [{ path: "index.html", content: "<p>hi</p>" }], message: "test", deploy: false, ...body }),
  });
  return r.json();
};

/* THE SERVER IS POINTED AT THE STAND-IN, or nothing is pressed. A probe
   into a repository nobody owns: if the stand-in does not hear it, the
   server is talking to somebody else, and the test stops here. */
{
  const before = seen.length;
  await publishRoute({ repo: "stand-in/probe", branch: "main" }).catch(() => null);
  if (!seen.slice(before).some((l) => l.includes("/repos/stand-in/probe"))) {
    console.error(`The server at ${BASE} did not call the stand-in on ${PORT}. Start it with GITHUB_API=http://127.0.0.1:${PORT} and no GITHUB_TOKEN.`);
    stub.close();
    process.exit(2);
  }
  seen.length = 0;
}

/* ------------------------------------------------------------------ */
/* The browser: sink brought in through the real door                  */
/* ------------------------------------------------------------------ */

const DOC = readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url));
/* One transparent pixel, standing in for each picture. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const doc = JSON.parse(DOC.toString("utf8"));
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  { path: "site/capture/home.json", type: "blob", sha: "cap", size: 2 },
  /* The pictures the fixture's pages show. A publish now refuses a page that
     points at a file nothing provides (tests/publish-complete.mjs), so the
     board has to arrive whole for the rest of this to be about sources. */
  ...[...new Set(DOC.toString("utf8").match(/assets\/pictures\/pic_[a-z0-9]+\.png/g) ?? [])].map((path) => ({ path, type: "blob", sha: "pic", size: PNG.length })),
];

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("dialog", (d) => { errors.push(`a browser dialog opened: ${d.message()}`); void d.dismiss(); });
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const at = `/repos/${SINK}`;
  if (r.request().method() !== "GET" || !u.pathname.startsWith(at)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(at.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  if (rest === "/git/blobs/pic") return j({ encoding: "base64", content: PNG.toString("base64") });
  return j({ message: "no" }, 404);
});
/* The list the Bring dialog shows, answered here rather than by GitHub. */
await page.route("**/api/studio/repo", (r) => r.request().method() === "GET"
  ? r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, repos: [{ name: SINK, private: false, branch: "main" }] }) })
  : r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
/* Every publish the browser asks for, as it asked for it. It goes on to the
   route, and the route to the stand-in. */
const asked = [];
page.on("request", (q) => { if (q.url().endsWith("/api/studio/publish") && q.method() === "POST") asked.push(JSON.parse(q.postData() ?? "{}")); });

const studio = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const builds = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") || "{}").state ?? {});
const project = async (id) => (await builds()).projects?.find((p) => p.id === id) ?? null;
const label = (r) => (r ? `${r.owner}/${r.name}` : null);
const nodeIds = async () => ((await studio()).nodes ?? []).map((n) => n.id);
const imported = async () => (await nodeIds()).some((id) => doc.nodes.some((n) => n.id === id));

const fresh = async (projects, activeId, nodes = []) => {
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(([p, a, n]) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    for (const k of Object.keys(localStorage)) if (k.startsWith("builder.doc:")) localStorage.removeItem(k);
    localStorage.setItem("builder.builds", env({ projects: p, activeId: a }));
    localStorage.setItem("builder.studio", env({
      pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
      activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: n,
    }));
  }, [projects, activeId, nodes]);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
};

const pushToGitHub = async () => {
  const n = asked.length;
  const before = seen.length;
  await page.evaluate(() => window.__studioOpenBrief?.());
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: /Push to GitHub/ }).first().click({ timeout: 15000 });
  for (let i = 0; i < 120 && asked.length === n; i++) await page.waitForTimeout(500);
  await page.waitForTimeout(2500);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  return { body: asked[n] ?? null, calls: seen.slice(before) };
};

await fresh([{ id: "s3", name: "Site 3", updatedAt: Date.now() }], "s3");

/* A placeholder token, through the Keys panel. */
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

console.log("\n1. A board brought in from sink, and Publish pressed");
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill(SINK);
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 90 && !(await imported()); i++) await page.waitForTimeout(1000);
await page.waitForTimeout(3000);
check("sink came in through the door", await imported(), `${(await nodeIds()).length} parts`);
const afterBring = await project("s3");
console.log(`  the board as the import left it: repo = ${label(afterBring?.repo)}, bound = ${afterBring?.bound ?? null}, source = ${label(afterBring?.source)}`);
check("the import set where it came from", same(label(afterBring?.source), SINK), `source = ${label(afterBring?.source)}`);
check("…and nothing to publish to", !afterBring?.repo, `repo = ${label(afterBring?.repo)}`);

const first = await pushToGitHub();
console.log(`  the push the browser asked for: repo = ${first.body?.repo ?? null}, boundTo = ${first.body?.boundTo ?? null}, create = ${first.body?.create ?? null}, branch = ${first.body?.branch ?? null}`);
console.log(`  what the route did at GitHub: ${first.calls.length ? first.calls.join(", ") : "nothing"}`);
check("the publish the browser asked for does not name sink", !!first.body && !same(first.body.repo, SINK) && !same(first.body.boundTo, SINK),
  `repo = ${first.body?.repo ?? null}, boundTo = ${first.body?.boundTo ?? null}`);
check("nothing was written into sink", writesTo(SINK).length === 0, `${writesTo(SINK).length} writes: ${writesTo(SINK).slice(0, 4).join(", ")}`);
const madeCall = first.calls.find((l) => l === "POST /user/repos");
const madeRepo = (await project("s3"))?.repo;
check("the first publish made the board a repository of its own and wrote there",
  !!madeCall && !!madeRepo && !same(label(madeRepo), SINK) && writesTo(label(madeRepo)).length > 0,
  `made: ${madeCall ? "yes" : "no"}, repo now ${label(madeRepo)}, ${madeRepo ? writesTo(label(madeRepo)).length : 0} writes there`);
check("the board still reads sink as where it came from", same(label((await project("s3"))?.source), SINK));

console.log("\n2. The route, asked directly for sink the way 3e14749's browser asked");
{
  const before = seen.length;
  const r = await publishRoute({ repo: SINK, boundTo: SINK, branch: "main" });
  const w = seen.slice(before).filter(isWrite);
  check("refused, in words, because sink carries site/capture/", r.ok === false && /capture/i.test(r.message ?? ""), JSON.stringify({ ok: r.ok, reason: r.reason, message: r.message }));
  check("…before a byte moved", w.length === 0, w.join(", "));
}
{
  const before = seen.length;
  const r = await publishRoute({ repo: "someone/clean", branch: "main", sources: ["someone/clean"] });
  const w = seen.slice(before).filter(isWrite);
  check("a repository a board was brought in from is refused, in words, even with no capture in it",
    r.ok === false && r.reason === "source" && w.length === 0, JSON.stringify({ ok: r.ok, reason: r.reason, message: r.message, writes: w.length }));
}
{
  const before = seen.length;
  const r = await publishRoute({ repo: "someone/unreadable", branch: "main" });
  const w = seen.slice(before).filter(isWrite);
  check("a repository whose capture folder cannot be looked for is refused, not assumed clean", r.ok === false && w.length === 0, JSON.stringify({ ok: r.ok, reason: r.reason, message: r.message }));
}
{
  const r = await publishRoute({ repo: "someone/clean", branch: "main", sources: ["someone/other"] });
  check("an ordinary repository of its own still publishes", r.ok === true, JSON.stringify({ ok: r.ok, message: r.message }));
}

console.log("\n3. A board bound to sink by an import before this change (the owner's shape)");
const OLD = { owner: "sparkygogo77-spec", name: "sink", branch: "main" };
await fresh([{ id: "old", name: "Old", updatedAt: Date.now(), repo: OLD, bound: "import" }], "old");
{
  const p = await project("old");
  console.log(`  read back after load: repo = ${label(p?.repo)}, bound = ${p?.bound ?? null}, source = ${label(p?.source)}`);
  check("it reads as brought in from sink, and publishing nowhere yet", same(label(p?.source), SINK) && !p?.repo && p?.bound !== "import",
    `repo = ${label(p?.repo)}, bound = ${p?.bound ?? null}, source = ${label(p?.source)}`);
  const push = await pushToGitHub();
  check("pressing Publish on it does not ask for sink", !!push.body && !same(push.body.repo, SINK) && !same(push.body.boundTo, SINK),
    `repo = ${push.body?.repo ?? null}, boundTo = ${push.body?.boundTo ?? null}, create = ${push.body?.create ?? null}`);
  check("and nothing reached sink", writesTo(SINK).length === 0, `${writesTo(SINK).length} writes`);
}
console.log("\n   …and one that was pointed at sink by hand (connected), beside a board brought in from it");
await fresh([
  { id: "a", name: "A", updatedAt: Date.now(), repo: OLD, bound: "connected" },
  { id: "b", name: "B", updatedAt: Date.now(), source: OLD },
], "a");
{
  const p = await project("a");
  check("a publish target that is another board's source is taken off", !p?.repo, `repo = ${label(p?.repo)}, bound = ${p?.bound ?? null}`);
}

console.log("\n4. Bring into a board that has parts, from its own source");
const part = (id, y) => ({
  id, pageId: "page_home", featureId: "custom-idea", label: id, prompt: "", content: "", data: "",
  x: 100, y, w: 400, h: 120, groupId: null, options: {}, priority: "must", custom: true,
  glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
  animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
  cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
});
const MINE = [part("mine_a", 100), part("mine_b", 300), part("mine_c", 500)];
const mineHeld = async () => { const ids = await nodeIds(); return ids.length === MINE.length && MINE.every((n) => ids.includes(n.id)); };
const doors = [
  { name: "the GitHub panel's Bring beside the source", press: async () => { await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(700); await page.locator("[data-repo-bring-own]").click(); } },
  { name: "the GitHub panel's typed field", press: async () => { await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(700); await page.locator("[data-repo-bring]").fill(SINK); await page.locator("[data-repo-pull]").click(); } },
  { name: "the GitHub panel's list of repos", press: async () => { await page.locator("[data-github-button]").first().click(); await page.waitForTimeout(1200); await page.locator(`[data-repo-connect="${SINK}"]`).click(); } },
  { name: "the Bring a repository in dialog", press: async () => { await page.locator("[data-bring-repo]").first().click(); await page.waitForTimeout(900); await page.locator(`[data-repo-pick="${SINK}"]`).click(); } },
];
for (const d of doors) {
  /* The shape an import left before this change, which the change reads as brought in from sink. */
  await fresh([{ id: "s4", name: "Site 4", updatedAt: Date.now(), repo: OLD, bound: "import" }], "s4", MINE);
  let pressed = true;
  try { await d.press(); } catch (e) { pressed = false; console.log(`    could not press: ${e.message.split("\n")[0]}`); }
  await page.waitForTimeout(1500);
  const warn = page.locator("[data-repo-bring-confirm]");
  const says = (await warn.count()) ? (await warn.first().innerText()).replace(/\s+/g, " ") : "";
  const held = await mineHeld();
  check(`${d.name}: warns before replacing ${MINE.length} parts`, pressed && !!says && /3 parts/.test(says) && held, says ? JSON.stringify(says) : `no warning; the board holds ${(await nodeIds()).length} parts`);
  if (says) {
    await page.locator("[data-repo-bring-keep]").first().click();
    await page.waitForTimeout(500);
    check(`${d.name}: Keep my board leaves it as it was`, await mineHeld());
  }
  await page.keyboard.press("Escape");
}

check("no page error on the way", errors.filter((e) => !/a browser dialog/.test(e)).length === 0, errors.join(" / "));
check("and not one write reached sink in the whole run", writesTo(SINK).length === 0, `${writesTo(SINK).length}`);

await browser.close();
stub.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
