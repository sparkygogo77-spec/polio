#!/usr/bin/env node
/**
 * The whole suite, run the same way by everyone.
 *
 * Each file in tests/ says in its own header how it wants to be run: the
 * server it needs (`GITHUB_API=… VERCEL_API=… npx next start -p 3013`, with
 * `env -u GITHUB_TOKEN …` when it must have no token of its own) and the
 * arguments it takes (`node tests/x.mjs http://127.0.0.1:3013 <path to a
 * sink checkout>`). This reads those headers rather than keeping a second
 * list that drifts: tests that want the same server share one, every server
 * starts without any real GitHub or Vercel token, and each test is handed
 * its server's address and, where it asks for one, the sink checkout.
 *
 *   npm run build                           # once; --build does it for you
 *   node scripts/test-all.mjs               # everything, then the table
 *   node scripts/test-all.mjs oddness coded # just these (names or globs)
 *
 *   --build        run `npm run build` first (also done when there is no build)
 *   --jobs N       tests that start no stand-in of their own, N at a time (default 3);
 *                  one that fails beside others is run again alone and shown as pass*
 *   --timeout S    seconds before a test is stopped and counted failed (default 600)
 *   --out FILE     also write the table, as Markdown, to FILE
 *   --list         say which server and arguments each test gets, and run nothing
 *   SINK=path      the sink checkout (default ../sink); tests are given
 *                  its sites/trumpmorty-fun as SINK, which is what they read
 *
 * The stand-ins each test serves (GitHub on 4333, Vercel on 4334, 4335 for
 * publish-big-picture, 4336 for publish-changed, …) are the tests' own; the
 * server for them is pointed there by the header. Tests that start a
 * stand-in run one at a time, since two of them would want the same port,
 * each on a fresh server, since a server remembers what GitHub told it.
 *
 * Exit code 0 when every test that ran passed.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TESTS = join(ROOT, "tests");

/* ------------------------------------------------------------ options */
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); if (i < 0) return dflt; const v = argv[i + 1]; argv.splice(i, 2); return v; };
const flag = (name) => { const i = argv.indexOf(name); if (i < 0) return false; argv.splice(i, 1); return true; };
const JOBS = Math.max(1, Number(opt("--jobs", process.env.JOBS ?? 3)));
const TIMEOUT = Math.max(10, Number(opt("--timeout", process.env.TEST_TIMEOUT ?? 600))) * 1000;
const OUT = opt("--out", null);
const BUILD = flag("--build");
const LIST = flag("--list");
const SINK = resolve(ROOT, process.env.SINK ?? "../sink");
const only = argv.filter((a) => !a.startsWith("--"));

/*
 * Not tests. Measurements answer a question and pass nothing (ground-growth
 * runs for twelve minutes by design); deploy-check asks the live production
 * site, which is not this checkout. Listed, so the table says why they did
 * not run.
 */
const SKIP = {
  "deploy-check": "asks the live production site: npm run check:deploy",
  "ground-cost": "a measurement, not a pass or fail",
  "ground-growth": "a measurement, not a pass or fail (twelve minutes)",
  "ground-readback": "a measurement, not a pass or fail",
  "pan-cost": "a measurement, not a pass or fail",
};
/* Arguments a header names in words the rules below do not read. */
const ARGS = {
  "sticky-in-section": (url) => [url, join(SINK, "sites", "gotchi-gg")],
  "motion-sampled": (url) => [url, SINK],
};

/* Never a real token: a test that needs one serves a stand-in and says so. */
const UNSET = ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_REPO", "GITHUB_BRANCH", "VERCEL_TOKEN", "VERCEL_PROJECT", "VERCEL_TEAM", "REPLICATE_API_TOKEN", "ANTHROPIC_API_KEY"];

/* ------------------------------------------------------------ reading a header */
function headerOf(src) {
  const m = /^(?:#!.*\n)?\s*\/\*\*?([\s\S]*?)\*\//.exec(src);
  return (m?.[1] ?? "").split("\n").map((l) => l.replace(/^\s*\*\s?/, "")).join("\n").replace(/\\\n\s*/g, " ");
}

/** The server a test asks for: the env on its `next start` line. */
function serverOf(header) {
  const line = header.split("\n").find((l) => /\bnpx next (start|dev)\b/.test(l));
  const env = {};
  if (!line) return env;
  const before = line.slice(0, line.search(/\bnpx next (start|dev)\b/)).replace(/^.*&&/, "");
  for (const [, k, v] of before.matchAll(/\b([A-Z][A-Z0-9_]*)=(\S+)/g)) env[k] = v;
  return env;
}

/** The arguments a test takes, from its usage line, filled in for this run. */
function argsOf(name, header, src, url) {
  if (ARGS[name]) return ARGS[name](url);
  const usage = header.split("\n").find((l) => l.includes(`node tests/${name}.mjs`));
  if (usage) {
    const rest = usage.slice(usage.indexOf(`${name}.mjs`) + name.length + 4).replace(/#.*$/, "").trim();
    const tokens = rest.match(/<[^>]*>|\[[^\]]*\]|\S+/g) ?? [];
    const out = [];
    for (const t of tokens) {
      if (/^https?:\/\//.test(t) || /^[<[](url|builder url|base url)[>\]]$/.test(t)) out.push(url);
      else if (/sink checkout/.test(t)) out.push(SINK);
      else if (t.startsWith("[")) break; // optional, and nothing here to give it
      else if (t.startsWith("<")) return { needs: t };
      else if (t.startsWith("--") || t.startsWith("(")) break;
      else out.push(t);
    }
    if (out.length) return out;
  }
  /* No usage line that says: a URL when it reads one, the sink when that is its first argument. */
  if (/process\.argv\[2\]\s*(\?\?|\|\|)\s*(process\.env\.SINK|join\(|"\.\.\/sink")/.test(src)) return [SINK];
  if (/process\.argv\[2\]/.test(src)) return [url];
  return [];
}

/* ------------------------------------------------------------ the plan */
const files = readdirSync(TESTS).filter((f) => f.endsWith(".mjs")).sort();
const glob = (p) => new RegExp(`^${p.replace(/\.mjs$/, "").replace(/[.+^${}()|\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".")}$`);
const picked = only.length ? files.filter((f) => only.some((p) => glob(basename(p)).test(f.replace(/\.mjs$/, "")))) : files;
if (!picked.length) { console.error(`No test matches ${only.join(" ")}`); process.exit(2); }

const plan = picked.map((f) => {
  const name = f.replace(/\.mjs$/, "");
  const src = readFileSync(join(TESTS, f), "utf8");
  const header = headerOf(src);
  return { name, src, header, env: serverOf(header), standIn: /\bcreateServer\(/.test(src) };
});

/* One server per distinct env; the plain one for everything that names none. */
const servers = new Map();
for (const t of plan) {
  if (SKIP[t.name]) continue;
  const key = JSON.stringify(Object.entries(t.env).sort());
  if (!servers.has(key)) servers.set(key, { env: t.env, tests: [] });
  servers.get(key).tests.push(t);
}

if (LIST) {
  let port = 3200;
  for (const { env, tests } of servers.values()) {
    const url = `http://127.0.0.1:${port++}`;
    console.log(`\n${url} — ${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(" ") || "no stand-ins"}`);
    for (const t of tests) { const a = argsOf(t.name, t.header, t.src, url); console.log(`  ${t.name}${t.standIn ? " (one at a time)" : ""}: ${Array.isArray(a) ? a.join(" ") : `needs ${a.needs}`}`); }
  }
  for (const t of plan) if (SKIP[t.name]) console.log(`  skip ${t.name}: ${SKIP[t.name]}`);
  process.exit(0);
}

/* ------------------------------------------------------------ running */
const results = [];
const clean = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");

function run(cmd, args, { env, timeout, cwd = ROOT } = {}) {
  return new Promise((done) => {
    const started = Date.now();
    const child = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    let out = "";
    child.stdout.on("data", (d) => { out += d; });
    child.stderr.on("data", (d) => { out += d; });
    const timer = setTimeout(() => { out += `\n[stopped after ${timeout / 1000}s]`; try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ } }, timeout);
    child.on("close", (code, signal) => { clearTimeout(timer); done({ code: signal ? 124 : code, out: clean(out), ms: Date.now() - started }); });
  });
}

function baseEnv() {
  /*
   * SINK, to a test, is the trumpmorty.fun capture's folder (the drawing
   * fixture and site-colours read it so); the few that want the checkout
   * itself are handed it as an argument.
   */
  const env = { ...process.env, SINK: join(SINK, "sites", "trumpmorty-fun"), NODE_NO_WARNINGS: "1" };
  for (const k of UNSET) delete env[k];
  /* The browser that is here, for the suites that take one by name: without
     it they ask Playwright for its own build, which may not be installed. */
  const here = ["/opt/pw-browsers/chromium"].find((p) => existsSync(p));
  if (here) { env.PLAYWRIGHT_CHROMIUM ??= here; env.CHROMIUM ??= here; }
  return env;
}

async function startServer(port, extra) {
  const env = { ...baseEnv(), ...extra, PORT: String(port) };
  const child = spawn("npx", ["next", "start", "-p", String(port)], { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
  let log = "";
  child.stdout.on("data", (d) => { log += d; });
  child.stderr.on("data", (d) => { log += d; });
  const url = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${url}/builder`, { signal: AbortSignal.timeout(5000) })).ok) return { url, stop: () => { try { process.kill(-child.pid, "SIGTERM"); } catch { /* gone */ } } }; } catch { /* not yet */ }
    if (child.exitCode !== null) break;
    await new Promise((r) => setTimeout(r, 500));
  }
  try { process.kill(-child.pid, "SIGKILL"); } catch { /* gone */ }
  throw new Error(`the server on ${port} did not answer:\n${log.slice(-2000)}`);
}

/** "12/14", "all good — 14/14", "3 failed of 45", "27/29 passed": what the test said it counted. */
function countOf(out) {
  const lines = out.trim().split("\n").reverse();
  for (const l of lines) {
    let m = /(\d+) failed of (\d+)/.exec(l);
    if (m) return `${Number(m[2]) - Number(m[1])}/${m[2]}`;
    m = /\b(\d+)\s*\/\s*(\d+)\b/.exec(l);
    if (m && /pass|good|ok|fail|checks?|—|-/i.test(l)) return `${m[1]}/${m[2]}`;
  }
  const ok = (out.match(/^\s*ok\b/gm) ?? []).length;
  const fail = (out.match(/^\s*FAIL\b/gm) ?? []).length;
  return ok + fail ? `${ok}/${ok + fail}` : "";
}

async function runTest(t, url) {
  const args = argsOf(t.name, t.header, t.src, url);
  if (!Array.isArray(args)) { results.push({ name: t.name, result: "skip", count: "", s: 0, note: `needs ${args.needs}` }); return; }
  const r = await run(process.execPath, [join("tests", `${t.name}.mjs`), ...args], { env: baseEnv(), timeout: TIMEOUT });
  const result = r.code === 0 ? "pass" : r.code === 124 ? "timeout" : "FAIL";
  const firstFail = r.code === 0 ? "" : (/^\s*FAIL\b.*$/m.exec(r.out)?.[0].trim().replace(/^FAIL\s+/, "") ?? r.out.trim().split("\n").filter(Boolean).slice(-1)[0] ?? "");
  results.push({ name: t.name, result, count: countOf(r.out), s: Math.round(r.ms / 1000), note: firstFail.slice(0, 140) });
  process.stdout.write(`${result === "pass" ? "  pass" : ` ${result.padStart(5)}`}  ${t.name}${countOf(r.out) ? ` (${countOf(r.out)})` : ""}\n`);
  if (result !== "pass" && process.env.VERBOSE) process.stdout.write(r.out.split("\n").map((l) => `        ${l}`).join("\n") + "\n");
}

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(n, queue.length) }, async () => { while (queue.length) await fn(queue.shift()); }));
}

/* ------------------------------------------------------------ go */
function treeState() {
  try { return new Set(execFileSync("git", ["status", "--porcelain"], { cwd: ROOT, encoding: "utf8" }).split("\n").filter(Boolean)); } catch { return new Set(); }
}
const before = treeState();
if (!existsSync(SINK)) console.warn(`No sink checkout at ${SINK}: tests that read it will fail. Set SINK.`);
if (BUILD || !existsSync(join(ROOT, ".next", "BUILD_ID"))) {
  console.log("Building (npm run build)…");
  const b = await run("npm", ["run", "build"], { env: baseEnv(), timeout: 15 * 60 * 1000 });
  if (b.code !== 0) { console.error(b.out.slice(-4000)); console.error("The build failed; nothing was run."); process.exit(1); }
}

for (const t of plan) if (SKIP[t.name]) results.push({ name: t.name, result: "skip", count: "", s: 0, note: SKIP[t.name] });

const started = Date.now();
/* Clear of every port a suite claims for itself (3011–3015, 3101, 4319–4341). */
let port = 3200;
for (const { env, tests } of servers.values()) {
  const named = Object.entries(env).map(([k, v]) => `${k}=${v}`).join(" ") || "no stand-ins";
  const shared = tests.filter((t) => !t.standIn);
  console.log(`\n${named} — ${tests.length} test${tests.length === 1 ? "" : "s"}`);
  let server = null;
  if (shared.length) {
    try { server = await startServer(port++, env); } catch (e) {
      for (const t of shared) results.push({ name: t.name, result: "FAIL", count: "", s: 0, note: `server did not start (${named})` });
      console.error(String(e.message ?? e));
    }
  }
  if (server) try {
    await pool(shared, JOBS, (t) => runTest(t, server.url));
    /*
     * A test that failed beside others is run again on its own, once, and
     * the table says so: "pass*" is a test that only holds on a quiet
     * machine, which is worth knowing and is not the same as a failure.
     */
    if (JOBS > 1) {
      for (const t of shared) {
        const i = results.findIndex((r) => r.name === t.name);
        if (i < 0 || results[i].result === "pass" || results[i].result === "skip") continue;
        const [crowded] = results.splice(i, 1);
        await runTest(t, server.url);
        const alone = results[results.length - 1];
        if (alone.result === "pass") Object.assign(alone, { result: "pass*", note: `failed beside others: ${crowded.note}`.slice(0, 140) });
      }
    }
  } finally {
    server.stop();
    await new Promise((r) => setTimeout(r, 500));
  }
  /*
   * A test with a stand-in of its own gets a server of its own. The server
   * remembers what GitHub answered (under the one placeholder token every
   * suite uses), so a stand-in served by the test before it answered for
   * this one: repo-menu passed alone and failed after publish-empty.
   */
  for (const t of tests.filter((t) => t.standIn)) {
    let own;
    try { own = await startServer(port++, env); } catch (e) {
      results.push({ name: t.name, result: "FAIL", count: "", s: 0, note: `server did not start (${named})` });
      console.error(String(e.message ?? e));
      continue;
    }
    try { await runTest(t, own.url); } finally { own.stop(); await new Promise((r) => setTimeout(r, 500)); }
  }
}

/* ------------------------------------------------------------ the table */
results.sort((a, b) => a.name.localeCompare(b.name));
const tally = (r) => results.filter((x) => x.result === r).length;
const rows = results.map((r) => [r.name, r.result, r.count, r.result === "skip" ? "" : `${r.s}s`, r.result === "pass" ? "" : r.note]);
const quiet = tally("pass*");
const head = ["test", "result", "checks", "time", "first failure / why skipped"];
const widths = head.map((h, i) => Math.min(i === 4 ? 90 : 60, Math.max(h.length, ...rows.map((r) => String(r[i]).length))));
const line = (cells) => cells.map((c, i) => String(c).slice(0, widths[i]).padEnd(widths[i])).join("  ").trimEnd();
console.log(`\n${line(head)}\n${widths.map((w) => "-".repeat(w)).join("  ")}`);
for (const r of rows) console.log(line(r));
const summary = `${tally("pass")} passed, ${quiet ? `${quiet} passed only on their own (pass*), ` : ""}${tally("FAIL")} failed, ${tally("timeout")} timed out, ${tally("skip")} skipped — ${results.length} in ${Math.round((Date.now() - started) / 60000)} min`;
console.log(`\n${summary}`);

if (OUT) {
  const md = [`| ${head.join(" | ")} |`, `|${head.map(() => "---").join("|")}|`, ...rows.map((r) => `| ${r.map((c) => String(c).replace(/\|/g, "\\|")).join(" | ")} |`), "", summary, ""].join("\n");
  writeFileSync(resolve(OUT), md);
}

const after = treeState();
const changed = [...after].filter((l) => !before.has(l));
if (changed.length) console.log(`\nThe run changed the tree (a test should not):\n${changed.join("\n")}`);

process.exit(tally("FAIL") + tally("timeout") ? 1 : 0);
