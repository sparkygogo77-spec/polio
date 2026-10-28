/**
 * The lead's real Claude call: one `claude -p` on J's own sign-in (the plan
 * path agents-runner.md checked against the terms), in the repo, with
 * read-only tools so the lead can look at the files it plans around. Any
 * tool that writes is refused, since `-p` denies what isn't allowed.
 *
 * Tests never use this: they pass their own Ask.
 */
import { spawn } from "node:child_process";
import type { Ask } from "./lead.ts";

export function claudeAsk({ file, cwd, env = process.env, timeoutMs = 300_000 }: {
  file: string; cwd: string; env?: NodeJS.ProcessEnv; timeoutMs?: number;
}): Ask {
  return (prompt, { model }) => new Promise((resolve, reject) => {
    const args = ["-p", "--output-format", "json", "--model", model, "--allowedTools", "Read,Grep,Glob"];
    const child = spawn(file, args, { cwd, env, stdio: ["pipe", "pipe", "pipe"], windowsHide: true });
    let out = "", err = "";
    const timer = setTimeout(() => { child.kill(); reject(new Error(`the lead took over ${timeoutMs / 1000} s`)); }, timeoutMs);
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => { clearTimeout(timer); reject(e); });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`the lead's call ended with ${code}: ${err.trim().split("\n").at(-1) ?? ""}`));
      try {
        const j = JSON.parse(out) as { result?: string; is_error?: boolean };
        if (j.is_error) return reject(new Error(`the lead's call failed: ${j.result ?? ""}`));
        resolve(j.result ?? "");
      } catch { resolve(out); }
    });
    child.stdin.end(prompt);
  });
}
