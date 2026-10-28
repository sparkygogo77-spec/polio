/**
 * One process tree the helper started, and the only way it ends one.
 *
 * On Windows the command runs inside a job object (job.ps1): Stop ends the
 * launcher, Windows closes the job and every process in it dies, including
 * a grandchild whose parent already exited, which `taskkill /T` would miss.
 * Nothing outside the job is touched, so a process the helper did not start
 * can't be ended by it (J's rule).
 *
 * Elsewhere (CI runs on Linux) the command gets its own process group and
 * Stop kills the group. A process can leave the group (setsid, or Node's
 * `detached`), so the command also gets a random mark in its environment,
 * which every descendant inherits, and on Linux Stop then ends every process
 * that still carries the mark. A process that clears its own environment and
 * leaves the group escapes; elsewhere than Linux, leaving the group is enough.
 */
import { spawn, type ChildProcess } from "node:child_process";
import { randomUUID } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Job = {
  /** The launcher on Windows, the command itself elsewhere. */
  child: ChildProcess;
  /** Resolves with the exit code (null when it was killed). */
  exited: Promise<number | null>;
  /** Ends this tree and only this tree. Safe to call twice. */
  stop(): Promise<void>;
};

export type JobOptions = {
  cwd: string;
  env: NodeJS.ProcessEnv;
  /** Forces the POSIX path, for a test that wants it on Windows. */
  platform?: NodeJS.Platform;
};

const LAUNCHER = fileURLToPath(new URL("./job.ps1", import.meta.url));
const MARK = "POLIO_JOB_MARK";

/** Linux only: the live processes whose environment carries this mark. */
function marked(mark: string): number[] {
  const want = `${MARK}=${mark}`;
  let dirs: string[];
  try { dirs = readdirSync("/proc").filter((d) => /^\d+$/.test(d)); } catch { return []; }
  const pids: number[] = [];
  for (const d of dirs) {
    try { if (readFileSync(`/proc/${d}/environ`, "latin1").split("\0").includes(want)) pids.push(Number(d)); } catch { /* gone, or not ours */ }
  }
  return pids.filter((p) => p !== process.pid);
}

/** One argument, quoted the way CommandLineToArgvW reads it back. */
export function quoteArg(a: string): string {
  if (a.length > 0 && !/[\s"]/.test(a)) return a;
  let out = '"';
  let slashes = 0;
  for (const ch of a) {
    if (ch === "\\") { slashes++; continue; }
    if (ch === '"') out += "\\".repeat(slashes * 2 + 1) + '"';
    else out += "\\".repeat(slashes) + ch;
    slashes = 0;
  }
  return out + "\\".repeat(slashes * 2) + '"';
}

export const commandLine = (file: string, args: string[]) => [file, ...args].map(quoteArg).join(" ");

export function startJob(file: string, args: string[], opts: JobOptions): Job {
  const platform = opts.platform ?? process.platform;
  const mark = randomUUID();
  let child: ChildProcess;
  if (platform === "win32") {
    const spec = Buffer.from(JSON.stringify({ cmdline: commandLine(file, args), cwd: opts.cwd }), "utf8").toString("base64");
    child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", LAUNCHER], {
      cwd: opts.cwd, env: { ...opts.env, POLIO_JOB_SPEC: spec }, stdio: "pipe", windowsHide: true,
    });
  } else {
    child = spawn(file, args, { cwd: opts.cwd, env: { ...opts.env, [MARK]: mark }, stdio: "pipe", detached: true, windowsHide: true });
  }
  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", (code) => resolve(code));
    child.once("error", () => resolve(null));
  });
  let stopping: Promise<void> | null = null;
  const stop = () => stopping ??= (async () => {
    const running = child.exitCode === null && child.signalCode === null;
    if (platform === "win32") {
      if (running) { child.kill(); await exited; }
      return;
    }
    if (running) {
      try { process.kill(-child.pid!, "SIGKILL"); } catch { child.kill("SIGKILL"); }
      await exited;
    }
    // What left the group: a few rounds, in case one was starting a child.
    for (let round = 0; round < 5; round++) {
      const left = marked(mark);
      if (left.length === 0) break;
      for (const pid of left) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
      await new Promise((r) => setTimeout(r, 50));
    }
  })();
  return { child, exited, stop };
}
