#!/usr/bin/env node
/**
 * EXPORT FOR CODE TO A BRANCH, WITH EVERY HOOK KEPT.
 *
 * J's pipeline (2026-10-02): he arranges a site brought in from a repository
 * (PonsStars), a code chat moves the repository's code into that design,
 * and the Builder brings it in again with every part still tied to its code.
 * So the design goes back to the repository as the export for code, under
 * `design/` on a new `design/<site>-<date>` branch, never the default
 * branch, with a draft pull request saying which hooks moved, were added or
 * were removed (`designBranch.ts`). Through the real door, against a GitHub
 * stood in (nothing leaves this machine):
 *
 *   · bring the repository in, move the chart box, add one part named
 *     "Chart main", delete one (the chart's attribution: "deleting this in
 *     the builder should remove it from the site");
 *   · export to a branch: one new design/ branch, nothing written to the
 *     default branch, a draft pull request into it;
 *   · every hook the board came in with is in the export exactly as it was
 *     (the words', and a list's choices', too), and the new part's hook is
 *     `chart-main`, never a random id;
 *   · the hook changes list only the move, the new hook and the deleted
 *     part's hooks, each removed one with the code that finds it (from the
 *     repository's hooks.json), in the pull request, in
 *     design/HOOK-CHANGES.md and in design/HOOK-CHANGES.json (for kit:diff);
 *   · kit:check passes on what was written, run from design/.
 *   · a big site goes in many small requests: the kit's check gets its
 *     files gzipped, under the 4.5 MB the host takes (it answered 413 on
 *     PST's 707 parts), pictures written inside pages and stylesheets
 *     become files of their own, each step is said as it goes, and a key
 *     GitHub refuses (401) is said at once, before anything is exported.
 *   · the design record (design/record.json, PST kit/DESIGN-RECORD.md) goes
 *     with it, and the verify step works: the board's record as it came in
 *     matches a look-only capture of the page (on PST, every shown part of
 *     the Chart TV), and the branch's record lists the move and the new part
 *     against the unbuilt page.
 *
 * The repository is PonsStars when a checkout is given (its HEAD, or REV),
 * else a small one built the same way (tests/fixtures/design-repo).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/export-to-branch.mjs http://127.0.0.1:3013 [a PonsStars checkout]
 *
 * Covers: src/features/studio/designBranch.ts, src/features/studio/exportForCode.ts, src/features/studio/kitExport.ts, src/features/studio/parts/PageControls.tsx
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { chromium } from "playwright-core";
import { DUMP } from "../capture/site/capture/dump.mjs";
import { recordDiff } from "../kit/tools/record-diff.mjs";
import { pullPictures } from "../src/features/studio/kitExport.ts";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PST = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The repository: a git checkout at a revision, or the fixture folder. */
/* Pure: a picture written inside a page or a stylesheet comes out as a file of its own, the text pointing at it (kitExport.ts#pullPictures). */
{
  const big = Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), Buffer.alloc(3_000_000, 7)]).toString("base64");
  const small = Buffer.from("89504e470d0a1a0a", "hex").toString("base64");
  const got = pullPictures([
    { path: "site/match/index.html", content: `<div style="background:url(data:image/png;base64,${big})"></div><img src="data:image/png;base64,${small}">` },
    { path: "site/base.css", content: `[data-hook="a"] { background: url("data:image/png;base64,${big}"); }` },
  ]);
  const html = got.files.find((f) => f.path === "site/match/index.html").content;
  const css = got.files.find((f) => f.path === "site/base.css").content;
  const pic = got.files.filter((f) => f.path.startsWith("site/assets/pictures/"));
  check("a 4 MB picture inside a page and a stylesheet becomes one file; the text points at it, relative to each; a tiny one stays", got.pulled === 2 && pic.length === 1 && pic[0].encoding === "base64" && pic[0].content === big && html.includes(`url(../assets/pictures/`) && css.includes(`url("assets/pictures/`) && html.includes(small) && html.length < 400, `${got.pulled} pulled, ${pic.map((f) => f.path).join()}, page ${html.length} chars`);
}
let names, read;
if (PST) {
  const REV = process.env.REV ?? "HEAD";
  names = execFileSync("git", ["-C", PST, "ls-tree", "-r", "--name-only", REV], { encoding: "utf8" }).trim().split("\n").filter((f) => !/\.(mp4|zip|woff2?)$/i.test(f));
  read = (f) => execFileSync("git", ["-C", PST, "show", `${REV}:${f}`], { maxBuffer: 64 << 20 });
} else {
  const root = join(here, "fixtures", "design-repo");
  const walk = (d) => readdirSync(d).flatMap((x) => (statSync(join(d, x)).isDirectory() ? walk(join(d, x)) : [relative(root, join(d, x))]));
  names = walk(root);
  read = (f) => readFileSync(join(root, f));
}
const REPO = "him/pst";
const MAIN = "main";
/* Each file under git's own name for its bytes, as GitHub lists it: the export points at what the repository already has. */
const gitSha = (buf) => createHash("sha1").update(Buffer.concat([Buffer.from(`blob ${buf.length}\0`), buf])).digest("hex");
const shaOf = new Map(names.map((f) => [f, gitSha(read(f))]));
const repoBySha = new Map([...shaOf].map(([f, sha]) => [sha, f]));
const tree = names.map((f) => ({ path: f, type: "blob", sha: shaOf.get(f), size: 100 }));

/* GitHub, stood in: reads from the repository; writes are kept here and nowhere else. */
const blobs = new Map();
const trees = new Map();
const commits = new Map();
const refs = new Map([[MAIN, "c0"]]);
const pulls = [];
const writes = [];
let made = 0;
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
/* The host takes no request body over 4.5 MB (Vercel answers 413 before our route runs): the kit's check is held to it here too. */
const HOST_MOST = 4.5 * 1024 * 1024;
const kitMapSent = [];
await page.route("**/api/studio/kit-map", (r) => {
  const n = r.request().postDataBuffer()?.length ?? 0;
  const gz = r.request().headers()["x-body-encoding"] === "gzip";
  kitMapSent.push({ bytes: n, gzip: gz, text: gz ? gunzipSync(r.request().postDataBuffer()).length : n });
  return n > HOST_MOST ? r.fulfill({ status: 413, contentType: "text/plain", body: "Request Entity Too Large" }) : r.continue();
});
let refuseKey = false;
await page.route("https://api.github.com/**", (r) => {
  if (refuseKey) return r.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ message: "Bad credentials" }) });
  const req = r.request();
  const u = new URL(req.url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/pst(\/.*)?$/);
  if (!mm) return j({ message: "Not Found" }, 404);
  const rest = mm[1] ?? "";
  const body = req.postData() ? JSON.parse(req.postData()) : null;
  if (req.method() === "POST") {
    writes.push(rest);
    const sha = `w${++made}`;
    if (rest === "/git/blobs") { blobs.set(sha, body.encoding === "base64" ? Buffer.from(body.content, "base64") : Buffer.from(body.content, "utf8")); return j({ sha }, 201); }
    if (rest === "/git/trees") { trees.set(sha, body); return j({ sha }, 201); }
    if (rest === "/git/commits") { commits.set(sha, body); return j({ sha }, 201); }
    if (rest === "/git/refs") { const name = body.ref.replace(/^refs\/heads\//, ""); if (refs.has(name)) return j({ message: "Reference already exists" }, 422); refs.set(name, body.sha); return j({ ref: body.ref }, 201); }
    if (rest === "/pulls") { pulls.push(body); return j({ html_url: `https://github.com/${REPO}/pull/${pulls.length}`, draft: !!body.draft, number: pulls.length }, 201); }
    return j({ message: "no" }, 404);
  }
  if (req.method() !== "GET") return j({ message: "no" }, 405);
  if (!rest) return j({ default_branch: MAIN, homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/([0-9a-f]{40})$/.exec(rest);
  if (b && repoBySha.has(b[1])) return j({ encoding: "base64", content: read(repoBySha.get(b[1])).toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10)); return names.includes(f) ? j({ content: read(f).toString("base64") }) : j({ message: "Not Found" }, 404); }
  const ref = /^\/git\/ref\/heads\/(.+)$/.exec(rest);
  if (ref) { const sha = refs.get(decodeURIComponent(ref[1])); return sha ? j({ object: { sha } }) : j({ message: "Not Found" }, 404); }
  if (rest.startsWith("/git/commits/")) return j({ sha: "c0", tree: { sha: "t0" } });
  if (rest.startsWith("/commits/")) return j({ sha: "c0" });
  return j({ message: "Not Found" }, 404);
});

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const act = (name, ...args) => page.evaluate(({ name, args }) => window.__studioHistory.act(name, ...args), { name, args });
const DIR = mkdtempSync(join(tmpdir(), "to-branch-"));
try {
  await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => { const env = (s) => JSON.stringify({ state: s, version: 0 }); localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "Duel", updatedAt: Date.now() }], activeId: "s1" })); localStorage.setItem("builder.studio", env({ nodes: [] })); });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  /* A stand-in key, held for this tab: the token never leaves this machine. */
  const keys = page.locator("[data-keys-panel]");
  await page.getByRole("button", { name: "Keys", exact: true }).click();
  await page.waitForTimeout(500);
  const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
  if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
  await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
  await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
  await page.waitForTimeout(500);
  await keys.getByRole("button", { name: "Close keys" }).click();
  await page.waitForTimeout(500);

  /* The door. */
  await page.locator("[data-github-button]").first().click();
  await page.waitForTimeout(700);
  await page.locator("[data-repo-bring]").fill(REPO);
  await page.locator("[data-repo-pull]").click();
  let st = await state();
  for (let i = 0; i < 150 && !(st.nodes?.length && st.look?.styleSource?.onBoard); i++) { await page.waitForTimeout(1000); st = await state(); }
  await page.waitForTimeout(3000);
  st = await state();
  const onBoard = st.look?.styleSource?.onBoard ?? [];
  const hooked = (st.nodes ?? []).filter((n) => n.hooks?.["data-hook"]);
  check("the repository came in, and the hooks on its board are kept with it", hooked.length > 5 && onBoard.length >= new Set(hooked.map((n) => n.hooks["data-hook"])).size, `${st.nodes?.length} parts, ${hooked.length} hooked, ${onBoard.length} hooks on the board`);
  const choices = (st.nodes ?? []).filter((n) => n.options?.choiceHooks);
  check("a list's choices came in with their hooks", choices.length >= 1, choices.map((n) => `${n.hooks?.["data-hook"]}: ${n.options.choiceHooks.replace(/\n/g, ", ")}`).slice(0, 3).join("; "));

  /* The design record of the board as it came in, and the verify step a code chat runs after a build: a look-only capture of
     the page as its own code draws it, checked against the record part by part (kit/tools/record-diff.mjs). */
  const rec0 = await page.evaluate(() => window.__studioRecord());
  const recPage = PST ? "web/index.html" : rec0.pages[0]?.file;
  /* As the Builder read it: the page's HTML and styles, its scripts not run (the board is the page before its code runs). */
  const builtCtx = await browser.newContext({ viewport: { width: 1440, height: 900 }, javaScriptEnabled: false });
  const built = await builtCtx.newPage();
  await built.route("http://site.test/**", (r) => { const f = decodeURIComponent(new URL(r.request().url()).pathname.slice(1)); try { const b = read(f); const type = f.endsWith(".html") ? "text/html" : f.endsWith(".css") ? "text/css" : f.endsWith(".js") || f.endsWith(".mjs") ? "text/javascript" : f.endsWith(".json") ? "application/json" : f.endsWith(".svg") ? "image/svg+xml" : "application/octet-stream"; return r.fulfill({ status: 200, contentType: type, body: b }); } catch { return r.fulfill({ status: 404, body: "" }); } });
  await built.route(/^https?:\/\/(?!site\.test)/, (r) => r.abort());
  await built.goto(`http://site.test/${recPage}?still=1`, { waitUntil: "load" }).catch(() => {});
  await built.waitForTimeout(1500);
  const capture = await built.evaluate(DUMP, { sheets: [], paths: false });
  await builtCtx.close();
  const vs = recordDiff(rec0, capture, { page: recPage, px: 4 });
  const recParts = rec0.pages.find((p) => p.file === recPage);
  check(`design record: every board part with its hook, name and page (${rec0.pages.length} pages)`, rec0.record === 1 && rec0.source === "builder" && !!recParts && vs.checked >= Math.min(20, hooked.length) && rec0.breakpoints?.[0]?.width > 0, `${vs.checked} hooked parts on ${recPage}`);
  if (PST) {
    const tv = vs.differ.filter((d) => d.hook.startsWith("chart-tv"));
    const tvAll = [];
    const walkR = (n) => { if (n.hook?.startsWith("chart-tv")) tvAll.push(n); for (const k of n.kids ?? []) walkR(k); };
    walkR(recParts.tree);
    check(`verify step on PST's Chart TV: a look-only capture of the built page matches the record (${tvAll.length} TV parts)`, tvAll.length > 10 && tv.length === 0, tv.slice(0, 6).map((d) => `${d.hook}: ${d.why}`).join(" | ") || `${tvAll.filter((n) => !n.states?.hidden).length} shown parts match; ${vs.differ.length} of ${vs.checked} parts on the page differ in all`);
    console.log(`  record-diff on the whole page: ${vs.same} same, ${vs.differ.length} differ${vs.differ.length ? `: ${vs.differ.slice(0, 8).map((d) => `${d.hook} (${d.why})`).join("; ")}` : ""}`);
  } else {
    check("verify step: a look-only capture of the built page matches the record", vs.differ.length === 0, vs.differ.slice(0, 6).map((d) => `${d.hook}: ${d.why}`).join(" | ") || `${vs.same} parts match`);
  }

  /* Move the chart box: picked, and nudged with the arrows, as he would. */
  const chart = st.nodes.find((n) => n.hooks?.["data-hook"] === "chart-area");
  check("the chart box is on the board", !!chart, chart ? `${chart.id} at ${chart.x}, ${chart.y}` : "");
  await act("setActivePage", chart.pageId);
  await act("setSelection", [chart.id]);
  await page.mouse.move(1400, 880);
  for (let i = 0; i < 4; i++) { await page.keyboard.press("Shift+ArrowRight"); await page.waitForTimeout(120); }
  await page.waitForTimeout(600);
  const movedNode = (await state()).nodes.find((n) => n.id === chart.id);
  check("it moved 40px right", movedNode.x - chart.x === 40 && movedNode.y === chart.y && movedNode.byHand === true, `${chart.x} to ${movedNode.x}`);

  /* One new part, named by him. */
  const added = await act("addNode", "prose", 40, 40, { label: "Chart main", content: "The main chart" });
  await page.waitForTimeout(500);
  check("one new part, named Chart main", typeof added === "string" && (await state()).nodes.some((n) => n.id === added && n.label === "Chart main"), String(added));

  /* One part deleted (J: "deleting this in the builder should remove it from the site"): the chart's attribution. */
  /* PST's chart attribution went with its own chart renderer; at a later commit a TV part stands in for it. */
  const DEL = PST ? ((await state()).nodes.some((n) => n.hooks?.["data-hook"] === "chart-attribution") ? "chart-attribution" : "chart-tv-led") : "footer-note";
  const del = (await state()).nodes.find((n) => n.hooks?.["data-hook"] === DEL);
  const runHooks = (c) => (Array.isArray(c) ? c.flatMap(runHooks) : c && typeof c === "object" ? [...(c.hooks?.["data-hook"] ? [c.hooks["data-hook"]] : []), ...Object.values(c).flatMap((v) => (v && typeof v === "object" ? runHooks(v) : []))] : []);
  const gone = del ? [...new Set([DEL, ...runHooks(del.content)])].sort() : [];
  if (del) await act("removeNodes", [del.id]);
  await page.waitForTimeout(400);
  check(`one part deleted: ${DEL}`, !!del && !(await state()).nodes.some((n) => n.id === del.id), gone.join(", "));

  /* Export for code, to a branch. */
  const got = await page.evaluate(async () => await window.__studioKitBranch());
  check("export to a branch says it is done", got?.ok === true, got?.says?.slice(0, 400));
  const branches = [...refs.keys()].filter((b) => b !== MAIN);
  const today = new Date().toISOString().slice(0, 10);
  check("one new design/<site>-<date> branch, and the default branch untouched", branches.length === 1 && /^design\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}$/.test(branches[0]) && branches[0].endsWith(today) && refs.get(MAIN) === "c0" && !writes.some((w) => w.includes("/git/refs/heads/")), branches.join(", "));
  check("a draft pull request into the default branch", pulls.length === 1 && pulls[0].draft === true && pulls[0].base === MAIN && pulls[0].head === branches[0], pulls[0] ? `${pulls[0].title}` : "none");

  /* What was written, on disk, as a code chat checks it out. */
  const commit = commits.get(refs.get(branches[0]));
  const written = trees.get(commit?.tree)?.tree ?? [];
  for (const e of written) { const at = join(DIR, e.path); mkdirSync(dirname(at), { recursive: true }); writeFileSync(at, blobs.get(e.sha) ?? read(repoBySha.get(e.sha))); }
  check("everything under design/, nothing of the code's own written over", written.length > 10 && written.every((e) => e.path.startsWith("design/")) && commit.parents?.[0] === "c0", `${written.length} files`);
  const want = ["design/builder.json", "design/site/hooks.json", "design/site/tokens.css", "design/site/style-layer.css", "design/site/index.html", "design/HOOK-CHANGES.md"];
  check("the kit layout: pages, builder.json, hooks.json, tokens.css, style-layer.css, and the hook changes", want.every((p) => existsSync(join(DIR, p))), want.filter((p) => !existsSync(join(DIR, p))).join(", "));

  /* Every hook it came in with, exactly. */
  const html = written.filter((e) => e.path.endsWith(".html")).map((e) => readFileSync(join(DIR, e.path), "utf8")).join("\n");
  const inExport = new Set([...html.matchAll(/\sdata-hook="([^"]+)"/g)].map((m) => m[1]));
  const lost = onBoard.filter((h) => !gone.includes(h) && !inExport.has(h));
  check(`all ${onBoard.length - gone.length} hooks the board came in with and still has are in the export, exactly`, lost.length === 0, lost.length ? `lost ${lost.length}: ${lost.slice(0, 12).join(", ")}` : `${onBoard.length - gone.length} kept`);
  check("the deleted part's hooks are not", gone.every((h) => !inExport.has(h)), gone.filter((h) => inExport.has(h)).join(", "));
  const forChoices = choices.flatMap((n) => n.options.choiceHooks.split("\n").filter(Boolean));
  check("a list's choices keep theirs", forChoices.every((h) => new RegExp(`<option[^>]*data-hook="${h}"`).test(html)), forChoices.join(", "));
  const own = new RegExp(`<[^>]*\\sdata-hook="([^"]+)"[^>]*\\sid="${added}"|<[^>]*\\sid="${added}"[^>]*\\sdata-hook="([^"]+)"`).exec(html);
  check("the new part's hook is read from its name: chart-main, not its id", (own?.[1] ?? own?.[2]) === "chart-main" && !html.includes(`data-hook="${added}"`), `${added}: ${own?.[1] ?? own?.[2]}`);

  /* The changes: the move and the new hook, nothing else. */
  const c = got?.changes ?? {};
  check(`the changes list only the move, the new hook and the deleted part's (${gone.join(", ")})`, c.moved?.length === 1 && c.moved[0].hook === "chart-area" && c.moved[0].dx === 40 && c.moved[0].dy === 0 && c.added?.length === 1 && c.added[0].hook === "chart-main" && JSON.stringify((c.removed ?? []).map((r) => r.hook)) === JSON.stringify(gone) && c.removed.every((r) => r.hook === DEL || r.inside === DEL) && c.renamed?.length === 0, JSON.stringify({ moved: c.moved, added: c.added, removed: c.removed?.slice(0, 5), renamed: c.renamed?.slice(0, 5) }));
  const md = existsSync(join(DIR, "design/HOOK-CHANGES.md")) ? readFileSync(join(DIR, "design/HOOK-CHANGES.md"), "utf8") : "";
  const listed = existsSync(join(DIR, "design/HOOK-CHANGES.json")) ? JSON.parse(readFileSync(join(DIR, "design/HOOK-CHANGES.json"), "utf8")) : {};
  check(`the pull request, design/HOOK-CHANGES.md and HOOK-CHANGES.json say so, ${DEL} marked removed with the code that finds it`, /## Moved \(1\)[\s\S]*`chart-area`[\s\S]*\+40px across/.test(md) && /## Added \(1\)[\s\S]*`chart-main`/.test(md) && new RegExp(`## Removed \\(${gone.length}\\)[\\s\\S]*\`${DEL}\`[^\\n]*: (found by|no script finds it)`).test(md) && pulls[0]?.body?.includes("`chart-main`") && pulls[0]?.body?.includes(`\`${DEL}\``) && JSON.stringify((listed.removed ?? []).map((r) => r.hook)) === JSON.stringify(gone) && listed.removed.every((r) => Array.isArray(r.refs)), md.split("\n").filter((l) => /Removed|`/.test(l)).slice(0, 8).join(" | "));

  /* The design record went with it, as it is now: the move, the new part, the deleted one gone, hidden states and tokens marked. */
  const rec = existsSync(join(DIR, "design/record.json")) ? JSON.parse(readFileSync(join(DIR, "design/record.json"), "utf8")) : null;
  const flat = [];
  const walkF = (n) => { flat.push(n); for (const k of n.kids ?? []) walkF(k); };
  for (const p of rec?.pages ?? []) walkF(p.tree);
  const recHook = (h) => flat.find((n) => n.hook === h);
  check("design/record.json is on the branch: the chart moved 40px, chart-main in it, the deleted part not", !!rec && rec.record === 1 && recHook("chart-area")?.x === Math.round(chart.x + 40) && flat.some((n) => n.label === "Chart main") && gone.every((h) => !recHook(h)), rec ? `chart-area at ${recHook("chart-area")?.x} (was ${chart.x}); ${flat.length} parts` : "no record");
  check("…with each part's states, the parts it sits in, and the values that are tokens", flat.some((n) => n.states?.hidden?.hidden) === (st.nodes.some((n) => n.state?.group?.startsWith("hidden:"))) && flat.some((n) => n.kids?.length && n.hook) && Object.keys(rec?.tokens ?? {}).length > 0 && flat.some((n) => n.tokens && Object.values(n.tokens).every((t) => t.startsWith("--"))), `${flat.filter((n) => n.states?.hidden).length} hidden, ${flat.filter((n) => n.tokens).length} with tokens, ${Object.keys(rec?.tokens ?? {}).length} tokens`);

  /* The verify step catches what the build has not done yet: the branch's record against the page as it still is lists the move and the new part. */
  const pending = rec ? recordDiff(rec, capture, { page: recPage, px: 4 }) : { differ: [] };
  const why = (h) => pending.differ.find((d) => d.hook === h)?.why ?? "";
  check("…and record-diff on the unbuilt page lists the chart's move and the new part, nothing the design left alone", /place/.test(why("chart-area")) && /not drawn/.test(why("chart-main")) && pending.differ.length <= vs.differ.length + 2 + gone.length, pending.differ.slice(0, 6).map((d) => `${d.hook}: ${d.why}`).join(" | "));
  if (!PST) writeFileSync(join(tmpdir(), "record-fixture.json"), JSON.stringify(rec));

  /* A big site goes in many small requests: the check's files packed under the host's limit, pictures as files of their own, every step said. */
  const steps = await page.evaluate(() => window.__studioKitSteps ?? []);
  const sentMax = Math.max(0, ...kitMapSent.map((k) => k.bytes));
  check(`the kit's check is sent packed, under the host's 4.5 MB (${st.nodes.length} parts)`, kitMapSent.length >= 1 && kitMapSent.every((k) => k.gzip) && sentMax <= HOST_MOST, `${kitMapSent.length} request(s), largest ${(sentMax / 1048576).toFixed(2)} MB packed from ${(Math.max(...kitMapSent.map((k) => k.text)) / 1048576).toFixed(2)} MB of text`);
  const textFiles = written.filter((e) => /\.(html|css)$/.test(e.path));
  const inline = textFiles.filter((e) => /data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]{2048,}/i.test(readFileSync(join(DIR, e.path), "utf8")));
  const pics = written.filter((e) => e.path.startsWith("design/site/assets/pictures/"));
  check("no big picture written inside a page or stylesheet: each is a file of its own", inline.length === 0, `${pics.length} picture files (${(pics.reduce((t, e) => t + (blobs.get(e.sha)?.length ?? 0), 0) / 1048576).toFixed(2)} MB); inline in ${inline.map((e) => e.path).join(", ") || "none"}`);
  check("each step is said as it goes: the key, the export, the files sent", steps.some((x) => /Asking GitHub/.test(x)) && steps.some((x) => /Exporting \d+ parts/.test(x)) && steps.some((x) => /file \d+ of \d+/.test(x)), steps.slice(0, 3).concat(steps.slice(-2)).join(" | "));

  /* Only what changed is sent: a file the repository already has (its pictures, an unchanged page) is pointed at by its git name. */
  const reusedEntries = written.filter((e) => !blobs.has(e.sha));
  check("files the repository already has are pointed at, not sent again; everything else is sent", (got?.reused ?? 0) === reusedEntries.length && reusedEntries.every((e) => repoBySha.has(e.sha)) && (got?.sent ?? 0) + (got?.reused ?? 0) === written.length && /not sent again/.test(got?.says ?? "") === reusedEntries.length > 0, `${got?.sent} sent, ${got?.reused} pointed at: ${reusedEntries.slice(0, 6).map((e) => e.path).join(", ")}`);

  /* A key GitHub refuses: said at once, in words, before anything is exported. */
  refuseKey = true;
  const before = kitMapSent.length;
  const t0 = Date.now();
  const refused = await page.evaluate(async () => await window.__studioKitBranch());
  refuseKey = false;
  check("a key GitHub refuses (401) is said at once, with what to do, before the export runs", refused?.ok === false && /401/.test(refused.says) && /Keys/.test(refused.says) && kitMapSent.length === before && Date.now() - t0 < 10000, `${Date.now() - t0} ms: ${refused?.says}`);

  /* kit:check, run as a code chat runs it, from design/. */
  let kc;
  try { kc = { ok: true, out: execFileSync("node", ["tools/kit-check.mjs", "builder.json"], { cwd: join(DIR, "design"), encoding: "utf8" }) }; } catch (e) { kc = { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; }
  check("kit:check passes on the branch, from design/", kc.ok, kc.out.trim().split("\n").slice(-6).join(" | "));
  check("no script errors", errors.length === 0, errors.slice(0, 3).join(" | "));
} finally {
  await browser.close();
  rmSync(DIR, { recursive: true, force: true });
}

const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
