#!/usr/bin/env node
/**
 * THE AUDIT RUNNER FINDS THE CUT, PINS IT, AND WRITES A RECEIPT (queue 72).
 *
 * A small pretend checkout is built in a temp folder: a git history with two
 * lanes merged on dated commits, one tool whose guard reads process.argv, a
 * next.config.ts that includes playwright-core whole, and a `.next` whose
 * traces say what each function carries (a 3 MB fixture that rode in with
 * the tool; playwright's vite pages in two browser routes). The runner is
 * run on it and the receipt read back. No build, no server, ~2 s.
 *
 * Then, when the base worktree's real Turbopack build is beside this
 * checkout (`../work-reference-slim-base/.next`, or AUDIT_ROOT), the runner
 * is run on that too: the kit tools' guard line must come out as a cut.
 * Without it those checks are said as not run, never as green.
 *
 * Red on base: the runner does not exist there.
 *
 *   node tests/audit-runner.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "..");
const results = [];
const notRun = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${detail}`}`); };

/* ------------------------------------------------------------------ */
/* A pretend checkout                                                  */
/* ------------------------------------------------------------------ */

const root = mkdtempSync(join(tmpdir(), "audit-"));
const put = (rel, body) => { const at = join(root, rel); mkdirSync(dirname(at), { recursive: true }); writeFileSync(at, body); };
const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8", env: { ...process.env, GIT_AUTHOR_DATE: env.date, GIT_COMMITTER_DATE: env.date } }).trim();
const env = { date: "2026-10-01T12:00:00" };
const commit = (date, msg) => { env.date = `${date}T12:00:00`; git("add", "-A"); git("commit", "-q", "-m", msg); };

git("init", "-q", "-b", "main");
git("config", "user.email", "t@t"); git("config", "user.name", "t");
put("package.json", "{}");
put("next.config.ts", "export default { outputFileTracingIncludes: {} };\n");
commit("2026-10-01", "Start");
/* Lane one: the browser routes, including playwright whole. */
git("switch", "-q", "-c", "claude/browser-routes");
put("next.config.ts", "export default { outputFileTracingIncludes: { '/api/x': ['./node_modules/playwright-core/**'] } };\n");
commit("2026-10-05", "Include playwright for the browser routes");
git("switch", "-q", "main");
env.date = "2026-10-06T12:00:00";
git("merge", "-q", "--no-ff", "-m", "Merge pull request #10 from owner/claude/browser-routes", "claude/browser-routes");
/* Lane two: a kit tool with the guard line that traces the project. */
git("switch", "-q", "-c", "claude/kit-tools");
put("kit/tools/check.mjs", "import { resolve } from 'node:path';\nexport const a = 1;\nif (import.meta.url === new URL(`file://${resolve(process.argv[1] ?? '')}`).href) { console.log('cli'); }\n");
commit("2026-10-12", "Kit check tool");
git("switch", "-q", "main");
env.date = "2026-10-14T12:00:00";
git("merge", "-q", "--no-ff", "-m", "Merge pull request #11 from owner/claude/kit-tools", "claude/kit-tools");

/* The build: traces, and the files they point at. */
const big = Buffer.alloc(3 * 1048576, 1);
put("capture/fixtures/big.tar.xz", big);
put("node_modules/playwright-core/index.js", "x".repeat(1000));
put("node_modules/playwright-core/lib/vite/recorder/index.html", "p".repeat(400_000));
put("node_modules/playwright-core/types/types.d.ts", "t".repeat(100_000));
put("node_modules/@sparticuz/chromium/bin/x", "c".repeat(2_000_000));
const app = ".next/server/app";
const trace = (fn, files) => { put(`${app}/${fn}/route.js`, "// route"); put(`${app}/${fn}/route.js.nft.json`, JSON.stringify({ version: 1, files: files.map((f) => relative(join(root, app, fn), join(root, f)).replaceAll("\\", "/")) })); };
trace("api/studio/kit-map", ["kit/tools/check.mjs", "capture/fixtures/big.tar.xz"]);
trace("api/studio/element", ["node_modules/playwright-core/index.js", "node_modules/playwright-core/lib/vite/recorder/index.html", "node_modules/playwright-core/types/types.d.ts", "node_modules/@sparticuz/chromium/bin/x"]);
trace("api/studio/render", ["node_modules/playwright-core/index.js", "node_modules/playwright-core/lib/vite/recorder/index.html", "node_modules/playwright-core/types/types.d.ts", "node_modules/@sparticuz/chromium/bin/x"]);
trace("api/small", []);

/* ------------------------------------------------------------------ */
/* Run it                                                              */
/* ------------------------------------------------------------------ */

const out = join(root, "out");
const run = spawnSync(process.execPath, [join(repo, "scripts/audit-runner.mjs"), "--root", root, "--out", out], { encoding: "utf8", cwd: repo });
check("the runner runs on a build with no server", run.status === 0, (run.stderr || run.stdout).slice(-400));
let r = null;
try { r = JSON.parse(readFileSync(join(out, "receipt.json"), "utf8")); } catch { /* none */ }
check("it writes receipt.json that says what it is", r?.kind === "polio-audit-receipt" && r.version === 1);
check("it measures every function and the total", r?.before.functions === 4 && r.before.total > 3 * 1048576 && r.functions.length === 4, JSON.stringify(r?.before));

const argv = r?.findings.find((f) => f.files.includes("kit/tools/check.mjs"));
check("the guard line that reads process.argv is a cut", argv?.kind === "cut", JSON.stringify(argv?.kind));
check("the cut says what rode in with it and how much", /capture/.test(argv?.why ?? "") && argv?.bytes.before - argv?.bytes.after === big.length, `${argv?.why} ${JSON.stringify(argv?.bytes)}`);
check("the cut is pinned to the lane that brought the line in, with its date", argv?.pin.feature === "Kit Tools" && argv?.pin.date === "2026-10-12" && argv?.pin.certain === true, JSON.stringify(argv?.pin));
check("and to the merge that carried it", argv?.pin.merged === "2026-10-14", JSON.stringify(argv?.pin));

const vite = r?.findings.find((f) => /recorder/.test(f.what));
check("playwright's web pages in a browser route are a cut, counted once per route", vite?.kind === "cut" && vite.functions.length === 2 && vite.bytes.before - vite.bytes.after === 2 * 500_000, JSON.stringify(vite?.bytes));
check("pinned to the lane that included playwright whole", vite?.pin.feature === "Browser Routes" && vite?.pin.date === "2026-10-05", JSON.stringify(vite?.pin));

const one = r?.findings.find((f) => f.kind === "shortcut");
check("one browser function for the routes is a shortcut that says what it gives up", !!one && /queue/.test(one.loses ?? "") && one.bytes.after < one.bytes.before, JSON.stringify(one?.loses));
check("a small function with nothing wrong is not a finding", !r?.findings.some((f) => f.functions.includes("api/small")));
check("the runner applied nothing", readFileSync(join(root, "kit/tools/check.mjs"), "utf8").includes("process.argv[1]") && git("status", "--porcelain").split("\n").every((l) => !l || /^\?\? (\.next|out|node_modules|capture)/.test(l)));

const md = (() => { try { return readFileSync(join(out, "receipt.md"), "utf8"); } catch { return ""; } })();
check("receipt.md says before → after for J, and what each shortcut gives up", /of 500 MB/.test(md) && /→/.test(md) && /Gives up:/.test(md) && /Came in with: Kit Tools, 2026-10-12/.test(md), md.slice(0, 300));
check("nothing in J's text names a branch or a commit code", !/claude\//.test(md) && !/\b[0-9a-f]{40}\b/.test(md));

rmSync(root, { recursive: true, force: true });

/* ------------------------------------------------------------------ */
/* The real base build, when it is here                               */
/* ------------------------------------------------------------------ */

const real = process.env.AUDIT_ROOT ?? resolve(repo, "..", "work-reference-slim-base");
if (existsSync(join(real, ".next", "server", "app"))) {
  const o = mkdtempSync(join(tmpdir(), "audit-real-"));
  const rr = spawnSync(process.execPath, [join(repo, "scripts/audit-runner.mjs"), "--root", real, "--out", o], { encoding: "utf8", cwd: repo });
  let rj = null; try { rj = JSON.parse(readFileSync(join(o, "receipt.json"), "utf8")); } catch { /* none */ }
  check("on the real base build the runner finishes", rr.status === 0, (rr.stderr || "").slice(-300));
  const kit = rj?.findings.find((f) => f.kind === "cut" && f.files.some((x) => x.startsWith("kit/tools/")));
  check("it finds the kit tools' guard line as a cut on kit-map", !!kit && kit.functions.includes("api/studio/kit-map") && kit.files.filter((x) => x.startsWith("kit/tools/")).length === 7, JSON.stringify(kit?.files));
  check("and says the deployment is over 500 MB before any cut", rj?.before.over === true, JSON.stringify(rj?.before));
  rmSync(o, { recursive: true, force: true });
} else {
  notRun.push("the real base build (no ../work-reference-slim-base/.next; set AUDIT_ROOT)");
}

const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}${notRun.length ? `; not run: ${notRun.join("; ")}` : ""}`);
process.exit(bad ? 1 : 0);
