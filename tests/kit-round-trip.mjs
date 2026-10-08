/**
 * THE STARTER KIT, ROUND TRIP: IMPORT, RESTYLE ONE TOKEN, SEND THE DESIGN,
 * AND THE KIT'S OWN `kit:diff --style-only` PASSES ON THE BRANCH.
 *
 * kit/PIPELINE.md, route 2 (code first): a code chat builds a site from
 * the kit; J brings it into the Builder, redesigns it, and "Send the design
 * back" opens a pull request from a new style/ branch into the repository's
 * default branch, which only a merge chat merges. Here the repository is a
 * real git repository made from kit/ (builder.json at its root, the starter
 * site under starter/), and GitHub is a stand-in over it, writing real git
 * objects, so the branch the Builder makes can be checked out and held to
 * the kit's own tools.
 *
 *   1. import: the starter's pages read part by part with their source
 *      (`PARTS`, `sourceHooks.ts`, `pageParts.ts`), and the repository's
 *      builder.json read as the baseline (`kitRun.ts readKit`);
 *   2. its link rules become the site's link list (`kitLinksToOffsite`);
 *   3. a code change lands on the default branch (a hook added, one
 *      removed), and the next design round says so before anything is sent
 *      (`readRound`), with the design's rule for the removed hook flagged;
 *   4. one token restyled (`--color-accent`), and one part's colour, sent:
 *      only style-layer.css and the hooks map remade by the kit's check
 *      change; a pull request into the default branch is opened, nothing
 *      is merged, and the default branch is untouched;
 *   5. on the branch: `kit:check` and `kit:diff --style-only` pass, and the
 *      page wears the new accent.
 *
 *   node tests/kit-round-trip.mjs
 *
 * Covers: src/features/studio/kitRun.ts, src/features/studio/kitMap.ts, src/features/studio/styleLayerRun.ts, src/features/studio/send-out/styleLayer.ts, src/features/studio/shelf/parts/offsite.ts, kit/tools/kit-diff.mjs, kit/tools/code-notes.mjs
 */
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { PARTS } from "../src/features/studio/bring-in/siteRead.ts";
import { pagesToDoc } from "../src/features/studio/bring-in/pageParts.ts";
import { sourceOfPage, withLines } from "../src/features/studio/sourceHooks.ts";
import { layerHooksOf, readKit, readRound } from "../src/features/studio/kitRun.ts";
import { kitMap } from "../src/features/studio/kitMap.ts";
import { prepareLayer, publishLayer } from "../src/features/studio/styleLayerRun.ts";
import { buildLayer } from "../src/features/studio/send-out/styleLayer.ts";
import { explainLink, kitLinksToOffsite, linkAllowed, offsiteRules } from "../src/features/studio/shelf/parts/offsite.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The repository: kit/ as a repo of its own, on main. */
const REPO_DIR = mkdtempSync(join(tmpdir(), "kit-round-"));
cpSync("kit", REPO_DIR, { recursive: true });
const git = (...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
const gitIn = (input, ...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", input, stdio: ["pipe", "pipe", "pipe"] }).trim();
git("init", "-q", "-b", "main");
git("-c", "user.name=t", "-c", "user.email=t@t", "add", "-A");
git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qm", "the starter");
const at = (ref, path) => { try { return execFileSync("git", ["show", `${ref}:${path}`], { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }); } catch { return null; } };

/* GitHub, stood in over that repository: every write is a real git object. */
const calls = [];
const pulls = [];
const stand = async (url, init = {}) => {
  const u = new URL(url);
  const method = init.method ?? "GET";
  const body = init.body ? JSON.parse(init.body) : null;
  calls.push(`${method} ${u.pathname}${u.search}`);
  const j = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
  const p = u.pathname.replace("/repos/j/starter", "");
  if (!u.pathname.startsWith("/repos/j/starter")) return j({ message: "Not Found" }, 404);
  if (p === "") return j({ default_branch: "main" });
  if (p.startsWith("/contents/")) { const t = at(u.searchParams.get("ref") ?? "main", decodeURIComponent(p.slice(10))); return t === null ? j({ message: "Not Found" }, 404) : j({ content: Buffer.from(t).toString("base64") }); }
  if (p.startsWith("/git/trees/") && method === "GET") {
    const ref = decodeURIComponent(p.slice(11));
    const tree = git("ls-tree", "-r", ref).split("\n").filter(Boolean).map((l) => { const [meta, path] = l.split("\t"); const [, type, sha] = meta.split(" "); return { path, type, sha }; });
    return j({ tree });
  }
  if (p.startsWith("/git/blobs/") && method === "GET") return j({ content: execFileSync("git", ["cat-file", "blob", p.slice(11)], { cwd: REPO_DIR }).toString("base64") });
  if (p.startsWith("/git/ref/heads/")) { try { return j({ object: { sha: git("rev-parse", `refs/heads/${decodeURIComponent(p.slice(15))}`) } }); } catch { return j({}, 404); } }
  if (p.startsWith("/git/commits/") && method === "GET") return j({ tree: { sha: git("rev-parse", `${p.slice(13)}^{tree}`) } });
  if (p === "/git/blobs") return j({ sha: gitIn(body.content, "hash-object", "-w", "--stdin") }, 201);
  if (p === "/git/trees") {
    const env = { ...process.env, GIT_INDEX_FILE: join(REPO_DIR, ".git", "stand-index") };
    const g = (...args) => execFileSync("git", args, { cwd: REPO_DIR, encoding: "utf8", env }).trim();
    g("read-tree", body.base_tree);
    for (const e of body.tree) g("update-index", "--add", "--cacheinfo", `${e.mode},${e.sha},${e.path}`);
    return j({ sha: g("write-tree") }, 201);
  }
  if (p === "/git/commits") return j({ sha: git("-c", "user.name=b", "-c", "user.email=b@b", "commit-tree", body.tree, "-p", body.parents[0], "-m", body.message) }, 201);
  if (p === "/git/refs") { try { git("rev-parse", "--verify", body.ref); return j({ message: "Reference already exists" }, 422); } catch { git("update-ref", body.ref, body.sha); return j({ ref: body.ref }, 201); } }
  if (p === "/pulls" && method === "POST") { pulls.push(body); return j({ number: pulls.length, html_url: `https://github.com/j/starter/pull/${pulls.length}` }, 201); }
  return j({ message: "no" }, 404);
};

/* ------------------------------------------------------------------ */
/* 1. Import                                                            */
/* ------------------------------------------------------------------ */

const PAGES = JSON.parse(at("main", "builder.json")).pages.map((p) => p.file);
const FILES = Object.fromEntries(git("ls-tree", "-r", "--name-only", "main").split("\n").filter(Boolean).map((f) => [f, at("main", f)]));
const server = createServer((req, res) => {
  const path = decodeURIComponent((req.url ?? "/").split("?")[0]).replace(/^\//, "");
  const body = FILES[path];
  if (body === undefined) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : "text/html" });
  res.end(body);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const open = (p) => (FILES[p] !== undefined ? { file: p, text: FILES[p] } : null);
const bare = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const reads = [];
for (const file of PAGES) {
  await bare.goto(`http://127.0.0.1:${port}/${file}?still=1`, { waitUntil: "load" });
  const source = sourceOfPage(file, FILES[file], open);
  reads.push({ file, read: withLines(await bare.evaluate(PARTS, 1500), source, FILES[file], open), source });
}
await bare.close();
const { doc } = pagesToDoc(reads, { at: 1, code: Object.entries(FILES).filter(([f]) => f.startsWith("starter/js/")).map(([path, text]) => ({ path, text })) });
const kit = await readKit("j/starter", "main", "tok", { fetch: stand, when: "2026-10-02T00:00:00Z" });
check("import reads builder.json and the hooks map as the baseline", kit?.ok && kit.seen.kit && kit.seen.pages.length === 5 && Object.keys(kit.seen.hooks).includes("hero-button") && kit.seen.hooks["hero-button"] === "button" && kit.seen.tokens.includes("--color-accent"), JSON.stringify(kit?.seen?.pages));
const source = { repo: "j/starter", ref: "main", dir: "starter/", ...doc.styleSource, seen: kit.seen, kit: kit.manifest };
check("the starter's tokens are read as the variables the design can set", source.files[0].vars.some((v) => v.name === "--color-accent" && v.value === "#2f6fde"));
const nodes = doc.nodes.map((n) => JSON.parse(JSON.stringify(n)));
const byHook = (h) => nodes.find((n) => n.hooks?.["data-hook"] === h);
check("every part keeps its data-hook from the code", !!byHook("hero-button") && !!byHook("page-title") && byHook("hero-button").source?.hook?.value === "hero-button");

/* ------------------------------------------------------------------ */
/* 2. Its link rules are the site's                                     */
/* ------------------------------------------------------------------ */

const rules = offsiteRules(kitLinksToOffsite(kit.manifest.links));
check("link rules: pump.fun and DexScreener itself are allowed", linkAllowed("https://pump.fun/coin/x", rules) && linkAllowed("https://dexscreener.com/", rules));
check("link rules: a DexScreener link to one contract address is refused, saying why", !linkAllowed("https://dexscreener.com/solana/7xKXabc", rules) && /specific contract address/.test(explainLink("https://dexscreener.com/solana/7xKXabc", rules).why));
check("link rules: an X profile, and any host not listed, are refused", !linkAllowed("https://x.com/someone", rules) && !linkAllowed("https://twitter.com/someone", rules) && !linkAllowed("https://example.com/", rules));

/* ------------------------------------------------------------------ */
/* 3. A code change lands; the next round says what changed             */
/* ------------------------------------------------------------------ */

/* The design styles feature-hooks-text; then a code chat drops it and adds a hero note. */
const intro = byHook("feature-hooks-text");
intro.colour = { ...intro.colour, text: "rgb(90, 20, 20)" };
const before = buildLayer(nodes, null, source, { kit: true });
const home = readFileSync(join(REPO_DIR, "starter/index.html"), "utf8");
const changed = home.replace(/\s*<p data-hook="feature-hooks-text">[^<]*<\/p>/, "").replace('<button data-hook="hero-button"', '<p data-hook="hero-note">New this week.</p>\n    <button data-hook="hero-button"');
writeFileSync(join(REPO_DIR, "starter/index.html"), changed);
const gallery = readFileSync(join(REPO_DIR, "starter/gallery.html"), "utf8");
writeFileSync(join(REPO_DIR, "starter/gallery.html"), gallery.replace(/\s*<p data-hook="feature-hooks-text">[^<]*<\/p>/, ""));
/* The code chat asks the builder to learn the note's sound (rule 27) and leaves its change note (rule 26). */
const bj = readFileSync(join(REPO_DIR, "builder.json"), "utf8");
writeFileSync(join(REPO_DIR, "builder.json"), bj.replace('"requests": []', '"requests": [{ "hook": "hero-note", "need": "the note\'s chime", "kind": "sound" }]'));
writeFileSync(join(REPO_DIR, "starter/index.html"), changed.replace('<p data-hook="hero-note">', '<p data-hook="hero-note" data-label="Weekly note">'));
execFileSync("node", ["tools/kit-check.mjs", "builder.json", "--write"], { cwd: REPO_DIR });
execFileSync("node", ["tools/code-notes.mjs", "builder.json", "--base", "HEAD", "--why", "A weekly note on the home page", "--branch", "hero-note"], { cwd: REPO_DIR });
git("add", "-A");
git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-qam", "a code chat: hero note, one feature line gone");
const round = await readRound(source, "tok", { fetch: stand, layerHooks: layerHooksOf(before.rules), when: "2026-10-03T00:00:00Z" });
check("the round reads builder.json and hooks.json again from the default branch", round.ok && calls.filter((c) => c.startsWith("GET /repos/j/starter/contents/builder.json?ref=main")).length >= 2);
check("the round says the hook added and the hook gone", round.ok && round.changes.hooksAdded.join() === "hero-note" && round.changes.hooksRemoved.join() === "feature-hooks-text" && /1 new hook: hero-note/.test(round.changes.says) && /1 hook gone: feature-hooks-text/.test(round.changes.says), round.ok ? round.changes.says : round.says);
check("the round brings the code chat's note: the new part by its plain name, and why", round.ok && round.notes?.entries[0]?.why === "A weekly note on the home page" && round.notes.entries[0].parts.some((p) => p.hook === "hero-note" && p.label === "Weekly note"), JSON.stringify(round.ok ? round.notes : null)?.slice(0, 300));
check("and the request to learn the chime, with a prompt for a Polio chat", round.ok && round.notes?.requests[0]?.need === "the note's chime" && /sparkygogo77-spec\/polio/.test(round.notes.requests[0].prompt ?? ""));
check("and flags the design's rule for the hook no page has now", round.ok && round.changes.staleRules.join() === "feature-hooks-text" && /Warning: your design styles feature-hooks-text/.test(round.changes.says));
/* He takes the round in: the new baseline, and his rule for the gone hook taken off. */
source.seen = round.seen;
intro.colour = { ...intro.colour, text: undefined };
intro.source.was.color = undefined;
const nodesNow = nodes.filter((n) => n !== intro);
const again = await readRound(source, "tok", { fetch: stand, layerHooks: layerHooksOf(buildLayer(nodesNow, null, source, { kit: true }).rules) });
check("taken in, the next round has nothing new to say", again.ok && again.changes.same && /^Nothing changed/.test(again.changes.says), again.ok ? again.changes.says : again.says);

/* ------------------------------------------------------------------ */
/* 4. Restyle one token, and one part; send                             */
/* ------------------------------------------------------------------ */

source.varsSet = { "--color-accent": "#c2410c" };
const hero = byHook("hero-button");
hero.radius = 2;
hero.colour = { ...hero.colour, bg: "rgb(20, 90, 60)" };
const mainBefore = git("rev-parse", "main");
const prepared = await prepareLayer(nodesNow, null, source, "tok", { fetch: stand, when: "2026-10-03", kitMap: async (files) => kitMap(files) });
check("prepared against the default branch, by the kit's contract", prepared.ok && prepared.kit && prepared.base === "main" && prepared.cssPath === "starter/style-layer.css", prepared.says ?? "");
check("only the style layer and the hooks map the kit's check remade from it are written; no page", prepared.ok && prepared.files.map((f) => f.path).sort().join() === "starter/hooks.json,starter/style-layer.css", prepared.ok ? prepared.files.map((f) => f.path).join() : "");
const css = prepared.ok ? prepared.files.find((f) => f.path === "starter/style-layer.css").content : "";
check("the token is set in the layer, and no rule outside a custom property holds a colour", /--color-accent:\s*#c2410c/.test(css) && /\[data-hook="hero-button"\]\s*\{[^}]*--hero-button-background-color: rgb\(20, 90, 60\);\s*background-color: var\(--hero-button-background-color\);[^}]*border-radius: 2px/.test(css) && !/#[0-9a-f]{3,8}\b(?![^:]*\*\/)/i.test(css.split("\n").filter((l) => !/^\s*--/.test(l) && !/\/\*/.test(l)).join("\n")), css);
const sent = await publishLayer(prepared, source, "tok", { site: "Starter", date: new Date("2026-10-03T10:00:00Z"), fetch: stand });
check("it goes to a new style/ branch made from the default branch", sent.ok && sent.branch === "style/starter-2026-10-03" && git("rev-parse", `${sent.branch}^`) === mainBefore, JSON.stringify(sent));
check("a pull request from it into the default branch is opened", pulls.length === 1 && pulls[0].head === "style/starter-2026-10-03" && pulls[0].base === "main" && sent.pull === "https://github.com/j/starter/pull/1" && /merge it once its checks are green/.test(sent.says));
check("nothing is merged and the default branch is untouched", git("rev-parse", "main") === mainBefore && !calls.some((c) => /\/merge|PATCH|PUT|DELETE/.test(c)));

/* ------------------------------------------------------------------ */
/* 5. The kit's own tools on the branch                                 */
/* ------------------------------------------------------------------ */

git("checkout", "-q", sent.branch ?? "main");
const run = (...args) => { try { return { ok: true, out: execFileSync("node", args, { cwd: REPO_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }) }; } catch (e) { return { ok: false, out: `${e.stdout ?? ""}${e.stderr ?? ""}` }; } };
const kc = run("tools/kit-check.mjs", "builder.json");
console.log(`       ${kc.out.trim().split("\n").at(-1)}`);
check("kit:check passes on the branch", kc.ok, kc.out.trim().split("\n").slice(-4).join(" | "));
const kd = run("tools/kit-diff.mjs", "builder.json", "--base", "main", "--style-only");
console.log(`       ${kd.out.trim().split("\n").at(-1)}`);
check("kit:diff --style-only passes on the branch", kd.ok, kd.out.trim().split("\n").slice(-4).join(" | "));
/* Served from the branch, the page wears the new accent. */
for (const f of Object.keys(FILES)) delete FILES[f];
for (const f of git("ls-tree", "-r", "--name-only", "HEAD").split("\n").filter(Boolean)) FILES[f] = at("HEAD", f);
const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await live.goto(`http://127.0.0.1:${port}/starter/index.html?still=1`, { waitUntil: "load" });
const look = await live.evaluate(() => ({ accent: getComputedStyle(document.documentElement).getPropertyValue("--color-accent").trim(), radius: getComputedStyle(document.querySelector('[data-hook="hero-button"]')).borderTopLeftRadius, bg: getComputedStyle(document.querySelector('[data-hook="hero-button"]')).backgroundColor }));
check("the page from the branch wears the new accent and the button's new fill and corners", look.accent === "#c2410c" && look.radius === "2px" && look.bg === "rgb(20, 90, 60)", JSON.stringify(look));
await live.close();

/* A design that would break the contract is refused before anything is written. */
const bad = await prepareLayer(nodesNow, null, source, "tok", { fetch: stand, kitMap: async () => ({ problems: ['starter/style-layer.css:3: rule for hook "gone", which no page has'], made: {} }) });
check("a design the kit's check fails is refused, saying why, with nothing written", !bad.ok && /kit's check finds 1 problem/.test(bad.says) && /gone/.test(bad.says));

await browser.close();
server.close();
rmSync(REPO_DIR, { recursive: true, force: true });
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
