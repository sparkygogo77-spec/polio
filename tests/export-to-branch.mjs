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
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const PST = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The repository: a git checkout at a revision, or the fixture folder. */
let names, read;
if (PST) {
  const REV = process.env.REV ?? "HEAD";
  names = execFileSync("git", ["-C", PST, "ls-tree", "-r", "--name-only", REV], { encoding: "utf8" }).trim().split("\n").filter((f) => !/\.(png|jpe?g|gif|webp|mp4|zip|ico|woff2?)$/i.test(f));
  read = (f) => execFileSync("git", ["-C", PST, "show", `${REV}:${f}`], { maxBuffer: 64 << 20 });
} else {
  const root = join(here, "fixtures", "design-repo");
  const walk = (d) => readdirSync(d).flatMap((x) => (statSync(join(d, x)).isDirectory() ? walk(join(d, x)) : [relative(root, join(d, x))]));
  names = walk(root);
  read = (f) => readFileSync(join(root, f));
}
const REPO = "him/pst";
const MAIN = "main";
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: 100 }));

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
await page.route("https://api.github.com/**", (r) => {
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
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: read(names[Number(b[1])]).toString("base64") });
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
  const DEL = PST ? "chart-attribution" : "footer-note";
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
  for (const e of written) { const at = join(DIR, e.path); mkdirSync(dirname(at), { recursive: true }); writeFileSync(at, blobs.get(e.sha)); }
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
