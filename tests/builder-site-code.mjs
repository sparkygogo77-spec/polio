/**
 * A SITE MADE HERE: REFRESH AND PUBLISH BESIDE GO LIVE, AND THE ROUND TRIP
 * THROUGH A CODE CHAT.
 *
 * HIS WORDS: "it should have both because the pipeline will require a code
 * chat utilizing this repo that was just created and the design site will
 * need to be able to do the refresh and publish both."
 *
 * Against a stand-in GitHub kept in this file (nothing leaves the machine):
 *
 *   1. A site made here with no repository yet: Refresh and Publish are in
 *      the top bar beside Go live, and both say Go live makes the repository.
 *   2. With the repository Go live made: Publish puts the board in as the
 *      builder-ready kit (builder.json, pages with data-hooks, tokens, the
 *      style layer, the kit's CLAUDE.md and checks) on a kit/ branch, opens
 *      a pull request and merges it; pictures go as the bytes they are.
 *      Refresh is green after.
 *   3. A code chat pushes to the repository: Refresh turns to "the code moved
 *      on", Publish waits (it would write over the chat's work), and a
 *      Publish forced anyway is refused before anything is written.
 *   4. Refresh, confirmed: the repository is brought in, its builder.json
 *      read first, and the site is a site from code: the code site's own
 *      Refresh and Publish, with the chat's change on the board.
 *
 *   npx next start -p 3013
 *   node tests/builder-site-code.mjs http://127.0.0.1:3013
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* ------------------------------------------------------------ the pure half */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitPublish.ts"));
check("the kit goes to a kit/ branch named for the site and the day", K.kitBranch("Site 10!", new Date("2026-10-05T12:00:00Z")) === "kit/site-10-2026-10-05");
check("never published: Publish puts the kit in", K.kitStatus("him/site", null, "aaa").at === "none");
check("at the commit the kit was merged at: up to date", K.kitStatus("him/site", { repo: "him/site", sha: "aaa", at: 0 }, "aaa").at === "current");
const moved = K.kitStatus("him/site", { repo: "him/site", sha: "aaaaaaa1", at: 0 }, "bbbbbbb2");
check("pushed to since: moved, and it says from which commit to which", moved.at === "moved" && /aaaaaaa → bbbbbbb/.test(moved.says), moved.says);
check("a kit sent to another repository is not this one's", K.kitStatus("him/site", { repo: "him/other", sha: "aaa", at: 0 }, "aaa").at === "none");
/* Pushed to since: a Publish forced anyway is refused before anything is written. */
const asked = [];
const answer = async (url, init) => { asked.push(`${init?.method ?? "GET"} ${url}`); return new Response(JSON.stringify({ sha: "bbbbbbb2" }), { status: 200 }); };
const refused = await K.publishKit("him/site", "t", { site: "Site 10", sent: { repo: "him/site", sha: "aaaaaaa1", at: 0 }, fetch: answer });
check("a Publish after a code chat pushed is refused before anything is written, and says Refresh first", !refused.ok && /Refresh first/.test(refused.says) && asked.every((x) => x.startsWith("GET")), `${refused.says} | ${asked.join(", ")}`);

/* ------------------------------------------------------------ a stand-in GitHub */
const sha = (s) => createHash("sha1").update(s).digest("hex");
const git = { blobs: new Map(), trees: new Map(), commits: new Map(), refs: new Map(), pulls: [], merged: [], writes: 0 };
const putBlob = (buf) => { const id = sha(buf); git.blobs.set(id, buf); return id; };
const putTree = (entries) => { const id = sha(JSON.stringify([...entries].sort())); git.trees.set(id, new Map(entries)); return id; };
const putCommit = (tree, parents, message) => { const id = sha(`${tree}${parents.join()}${message}${Math.random()}`); git.commits.set(id, { tree, parents, message }); return id; };
/* What Go live left: the still pages and the board's own document. */
const goLiveTree = putTree([["index.html", putBlob(Buffer.from("<!doctype html><title>Still</title><h1>Still copy</h1>"))], ["vercel.json", putBlob(Buffer.from("{}"))]]);
git.refs.set("main", putCommit(goLiveTree, [], "Go live"));
const treeOf = (commit) => git.trees.get(git.commits.get(commit).tree);
/** A code chat's push: a file changed on main, as a commit of its own. */
const chatPush = (path, content) => {
  const t = new Map(treeOf(git.refs.get("main")));
  t.set(path, putBlob(Buffer.from(content)));
  git.refs.set("main", putCommit(putTree([...t]), [git.refs.get("main")], "code chat"));
};

async function github(route) {
  const req = route.request();
  const url = new URL(req.url());
  const p = url.pathname.replace(/^\/repos\/him\/site/, "");
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  const json = (status, j) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(j) });
  if (!url.pathname.startsWith("/repos/him/site")) return json(404, {});
  const m = req.method();
  if (m === "GET" && p === "") return json(200, { default_branch: "main", full_name: "him/site", homepage: "" });
  if (m === "GET" && p.startsWith("/git/ref/heads/")) { const r = git.refs.get(decodeURIComponent(p.slice(15))); return r ? json(200, { object: { sha: r } }) : json(404, {}); }
  if (m === "GET" && p.startsWith("/git/commits/")) { const c = git.commits.get(p.slice(13)); return c ? json(200, { sha: p.slice(13), tree: { sha: c.tree } }) : json(404, {}); }
  if (m === "GET" && p.startsWith("/commits/")) {
    const ref = decodeURIComponent(p.slice(9));
    const s = ref === "HEAD" ? git.refs.get("main") : git.refs.get(ref) ?? (git.commits.has(ref) ? ref : null);
    return s ? json(200, { sha: s }) : json(404, {});
  }
  if (m === "POST" && p === "/git/blobs") { git.writes++; return json(201, { sha: putBlob(Buffer.from(body.content, body.encoding === "base64" ? "base64" : "utf8")) }); }
  if (m === "POST" && p === "/git/trees") { const t = new Map(body.base_tree ? git.trees.get(body.base_tree) : []); for (const e of body.tree) t.set(e.path, e.sha); return json(201, { sha: putTree([...t]) }); }
  if (m === "POST" && p === "/git/commits") return json(201, { sha: putCommit(body.tree, body.parents, body.message) });
  if (m === "POST" && p === "/git/refs") { const name = body.ref.replace("refs/heads/", ""); if (git.refs.has(name)) return json(422, {}); git.refs.set(name, body.sha); return json(201, { ref: body.ref }); }
  if (m === "POST" && p === "/pulls") { git.pulls.push(body); return json(201, { number: git.pulls.length, html_url: `https://github.com/him/site/pull/${git.pulls.length}` }); }
  if (m === "PUT" && /^\/pulls\/\d+\/merge$/.test(p)) {
    const pr = git.pulls[Number(p.split("/")[2]) - 1];
    const head = git.refs.get(pr.head);
    const merged = putCommit(git.commits.get(head).tree, [git.refs.get("main"), head], body.commit_title ?? "merge");
    git.refs.set("main", merged); git.merged.push(pr.head);
    return json(200, { sha: merged, merged: true });
  }
  if (m === "GET" && p.startsWith("/git/trees/")) {
    const ref = decodeURIComponent(p.slice(11).split("?")[0]);
    const c = git.refs.get(ref) ?? (git.commits.has(ref) ? ref : null) ?? git.refs.get("main");
    const t = treeOf(c);
    return json(200, { sha: git.commits.get(c).tree, truncated: false, tree: [...t].map(([path, s]) => ({ path, type: "blob", sha: s, size: git.blobs.get(s).length })) });
  }
  if (m === "GET" && p.startsWith("/git/blobs/")) { const b = git.blobs.get(p.slice(11)); return b ? json(200, { sha: p.slice(11), encoding: "base64", content: b.toString("base64"), size: b.length }) : json(404, {}); }
  return json(404, { message: `stand-in has no ${m} ${p}` });
}

/* ------------------------------------------------------------ the browser half */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/api\.github\.com\/.*/, github);
await page.route(/https:\/\/(api\.)?vercel\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));
await page.route("**/api/studio/publish**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, token: null, repo: null, branch: "main", missing: [], allow: null }, vercel: { hook: false } }) }));

const env = (s) => JSON.stringify({ state: s, version: 0 });
const PIC = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const node = (id, featureId, content, y, extra = {}) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content, data: "", x: 120, y, w: 600, h: 90, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra });
const doc = { pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], brief: { name: "Site 10", gimmick: "", master: "" },
  nodes: [node("n_head", "heading", "Find a match", 60), node("n_body", "text", "Deposit once, play as many matches as it covers.", 180)] };
const open = async (repo) => {
  await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
  await page.evaluate(({ b, d }) => { localStorage.clear(); localStorage.setItem("builder.builds", b); localStorage.setItem("builder.studio", d); }, {
    b: env({ projects: [{ id: "s1", name: "Site 10", updatedAt: Date.now(), nudged: true, ...(repo ? { repo } : {}) }], activeId: "s1" }), d: env(doc),
  });
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.__studioPublishDoc === "function", null, { timeout: 30000 });
  await page.waitForTimeout(1200);
};
const has = async (sel) => (await page.locator(`header ${sel}`).count()) > 0;
const statusOf = () => page.locator("header [data-builder-refresh]").first().getAttribute("data-builder-status");

/* 1. No repository yet. */
await open(null);
check("1 a site made here shows Refresh and Publish beside Go live", (await has("[data-builder-refresh]")) && (await has("[data-builder-publish]")) && (await has("[data-go-live]")));
check("1 …and with no repository, both wait for Go live to make one", (await statusOf()) === "no-repo" && (await page.locator("header [data-builder-publish]").first().isDisabled()));

/* 2. The repository Go live made, and a key. */
await open({ owner: "him", name: "site", branch: "main" });
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(400);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(800);
/* A picture on the board, so the kit carries one as bytes. */
await page.evaluate((png) => {
  const c = document.createElement("canvas"); c.width = c.height = 4;
  const frame = document.querySelector("[data-frame]"); const r = frame.getBoundingClientRect();
  const dt = new DataTransfer(); dt.setData("application/x-studio-picture", JSON.stringify({ src: `data:image/png;base64,${png}`, w: 1, h: 1 }));
  const at = { clientX: r.left + 200, clientY: r.top + 340 };
  const target = document.elementFromPoint(at.clientX, at.clientY) ?? frame;
  for (const t of ["dragenter", "dragover", "drop"]) target.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt, ...at }));
}, PIC);
await page.waitForTimeout(1500);
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(800);
check("2 before the kit goes in, Refresh says there is nothing to bring in yet", (await statusOf()) === "none", await statusOf());

await page.locator("header [data-builder-publish]").first().click();
await page.waitForTimeout(800);
/* The board's check list may ask first; its own go-ahead carries on. */
const anyway = page.getByRole("button", { name: /Publish anyway|Go ahead|Publish as it is/ });
if (await anyway.count()) { await anyway.first().click(); await page.waitForTimeout(500); }
const says = await page.locator("[data-builder-publish-says]").innerText().catch(() => "");
check("2 Publish says what goes in before anything is written", /builder-ready kit/.test(says) && git.writes === 0, says.slice(0, 120));
await page.locator("[data-builder-publish-go]").click();
for (let t = 0; t < 60 && !git.merged.length; t++) await page.waitForTimeout(250);
await page.waitForTimeout(800);
const main1 = treeOf(git.refs.get("main"));
const paths = [...main1.keys()];
check("2 the kit went on a kit/ branch, by a pull request, merged", git.merged.length === 1 && /^kit\/site-/.test(git.merged[0]) && /Builder kit: (Site 10|site)$/.test(git.pulls[0]?.title ?? ""), `${git.merged.join()} ${git.pulls[0]?.title}`);
check("2 …carrying builder.json, CLAUDE.md, the kit's check, tokens, the style layer and the page", ["builder.json", "CLAUDE.md", "tools/kit-check.mjs", "site/tokens.css", "site/style-layer.css", "site/index.html"].every((f) => paths.includes(f)), paths.filter((x) => !x.startsWith("site/assets")).join(", "));
const page1 = git.blobs.get(main1.get("site/index.html")).toString();
check("2 …the page with a data-hook on its parts and the board's words", /data-hook="/.test(page1) && /Find a match/.test(page1));
const pic = paths.find((x) => /\.png$/.test(x));
check("2 …a picture as the bytes it is, not as text", !!pic && git.blobs.get(main1.get(pic)).subarray(0, 4).toString("hex") === "89504e47", pic ?? "no picture");
check("2 …and Go live's own files are where they were", paths.includes("index.html") && paths.includes("vercel.json"));
const sent = await page.evaluate(() => window.__studioPublishDoc().look?.kitSent ?? JSON.parse(localStorage.getItem("builder.studio")).state.look?.kitSent);
check("2 the board keeps the commit the kit was merged at", sent?.sha === git.refs.get("main") && sent?.repo === "him/site", JSON.stringify(sent));
check("2 Refresh is green: up to date", (await statusOf()) === "current", await statusOf());

/* 3. A code chat pushes. */
chatPush("site/index.html", page1.replace("Find a match", "Find a match now"));
await page.evaluate(() => window.dispatchEvent(new Event("focus")));
await page.waitForTimeout(1200);
check("3 after a code chat pushes, Refresh says the code moved on", (await statusOf()) === "moved", await statusOf());
check("3 …and Publish waits, so the chat's work is not written over", await page.locator("header [data-builder-publish]").first().isDisabled());
/* 4. Refresh, confirmed: the repository comes in as a site from code. */
await page.locator("header [data-builder-refresh]").first().click();
await page.waitForTimeout(500);
const asks = await page.locator("[data-builder-refresh-says]").innerText().catch(() => "");
check("4 Refresh asks first, and says what is replaced", /moved on/.test(asks) && /replaced/.test(asks), asks.slice(0, 160));
await page.locator("[data-builder-refresh-go]").click();
let fromCode = false;
for (let t = 0; t < 120 && !fromCode; t++) { await page.waitForTimeout(500); fromCode = await has("[data-code-refresh]"); }
check("4 the site is a site from code now: the code site's Refresh and Publish, no Go live", fromCode && (await has("[data-code-publish]")) && !(await has("[data-go-live]")));
const src = await page.evaluate(() => window.__studioPublishDoc().look?.styleSource ?? null);
check("4 …read from its builder.json", !!src?.repo && /him\/site/.test(src.repo) && !!src?.manifest, JSON.stringify({ repo: src?.repo, manifest: src?.manifest?.file }));
const words = await page.evaluate(() => JSON.stringify(window.__studioPublishDoc().nodes.map((n) => n.content)));
check("4 …with the code chat's change on the board", /Find a match now/.test(words), words.slice(0, 200));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
