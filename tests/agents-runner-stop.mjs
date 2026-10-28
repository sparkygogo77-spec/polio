/**
 * Agents panel, the runner: Stop ends only the tree it started.
 *
 * Two jobs each run a small tree (helper/jobs/testing/tree.mjs): a root, its
 * child, and an orphan whose parent has already exited, the case a kill by
 * parent id misses. A third node process runs outside any job. Stopping the
 * first job must end all three of its processes and leave the second job and
 * the outsider running. On Windows this is the job object (job.ps1);
 * elsewhere, the process group.
 *
 *   node tests/agents-runner-stop.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

let J = null;
try { J = await import("../helper/jobs/job.ts"); } catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the job module loads", !!(J && typeof J.startJob === "function"));

const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { const v = fn(); if (v) return v; await sleep(100); }
  return fn();
}

if (J) {
  const { startJob, quoteArg } = J;
  check("an argument with spaces and quotes is quoted for Windows",
    quoteArg('a "b" c\\') === '"a \\"b\\" c\\\\"' && quoteArg("plain") === "plain" && quoteArg("") === '""', quoteArg('a "b" c\\'));

  const dir = mkdtempSync(join(tmpdir(), "agents-stop-"));
  const tree = fileURLToPath(new URL("../helper/jobs/testing/tree.mjs", import.meta.url));
  const run = (name) => {
    const file = join(dir, `${name}.json`);
    const job = startJob(process.execPath, [tree, file], { cwd: dir, env: process.env });
    return { job, file };
  };
  const a = run("a");
  const b = run("b");
  const outsider = spawn(process.execPath, ["-e", "setInterval(() => {}, 1 << 30)"], { stdio: "ignore" });
  try {
    const pidsA = await until(() => existsSync(a.file) && JSON.parse(readFileSync(a.file, "utf8")));
    const pidsB = await until(() => existsSync(b.file) && JSON.parse(readFileSync(b.file, "utf8")));
    check("both trees started, each with an orphan", !!(pidsA && pidsB && pidsA.orphan && pidsB.orphan), JSON.stringify({ pidsA, pidsB }));
    if (pidsA && pidsB) {
      const ownA = [pidsA.root, pidsA.kid, pidsA.orphan];
      check("the orphan's parent has exited", !alive(pidsA.middle));
      check("before Stop, every process of job A is running", ownA.every(alive));

      await a.job.stop();
      const goneA = await until(() => ownA.every((p) => !alive(p)), 10000);
      check("Stop on job A ends its root, its child and its orphan", goneA, ownA.map((p) => `${p}:${alive(p) ? "alive" : "gone"}`).join(" "));
      check("job B is still running, orphan and all", [pidsB.root, pidsB.kid, pidsB.orphan].every(alive));
      check("the process outside any job is still running", alive(outsider.pid));
      await a.job.stop();
      check("Stop a second time is harmless", true);
    }
  } finally {
    await a.job.stop();
    await b.job.stop();
    outsider.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
