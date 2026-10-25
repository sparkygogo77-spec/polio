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
 * Stop kills the group. A process that leaves the group (setsid) escapes;
 * that is the POSIX fallback's known gap, not the Windows path's.
 */
import { spawn, type ChildProcess } from "node:child_process";
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
  let child: ChildProcess;
  if (platform === "win32") {
    const spec = Buffer.from(JSON.stringify({ cmdline: commandLine(file, args), cwd: opts.cwd }), "utf8").toString("base64");
    child = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", LAUNCHER], {
      cwd: opts.cwd, env: { ...opts.env, POLIO_JOB_SPEC: spec }, stdio: "pipe", windowsHide: true,
    });
  } else {
    child = spawn(file, args, { cwd: opts.cwd, env: opts.env, stdio: "pipe", detached: true, windowsHide: true });
  }
  const exited = new Promise<number | null>((resolve) => {
    child.once("exit", (code) => resolve(code));
    child.once("error", () => resolve(null));
  });
  let stopping: Promise<void> | null = null;
  const stop = () => stopping ??= (async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    if (platform === "win32") child.kill();
    else { try { process.kill(-child.pid!, "SIGKILL"); } catch { child.kill("SIGKILL"); } }
    await exited;
  })();
  return { child, exited, stop };
}
