/**
 * A lane's own place on the PC: a git worktree under Pleo/agents/<lane> on
 * branch claude/<lane>, and a port from 3100 to 3199.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

/** Lane names become folder and branch names, so they are kept plain. */
export const LANE_NAME = /^[a-z0-9][a-z0-9-]{0,47}$/;

export function addWorktree({ repo, root, lane, base }: { repo: string; root: string; lane: string; base: string }): string {
  if (!LANE_NAME.test(lane)) throw new Error(`lane name ${JSON.stringify(lane)} must be lower-case letters, digits and dashes`);
  const dir = join(root, lane);
  if (existsSync(join(dir, ".git"))) return dir;
  const git = (...args: string[]) => execFileSync("git", ["-C", repo, ...args], { stdio: "pipe" }).toString();
  const branch = `claude/${lane}`;
  const has = git("branch", "--list", branch).trim().length > 0;
  git("worktree", "add", ...(has ? [dir, branch] : ["-b", branch, dir, base]));
  return dir;
}

export class PortPool {
  private held = new Map<string, number>();
  readonly first: number;
  readonly last: number;
  constructor(first = 3100, last = 3199) { this.first = first; this.last = last; }
  take(lane: string): number {
    const had = this.held.get(lane);
    if (had) return had;
    const used = new Set(this.held.values());
    for (let p = this.first; p <= this.last; p++) if (!used.has(p)) { this.held.set(lane, p); return p; }
    throw new Error(`every port from ${this.first} to ${this.last} is taken`);
  }
  give(lane: string) { this.held.delete(lane); }
}
