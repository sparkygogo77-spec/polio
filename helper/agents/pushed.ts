/**
 * Has a lane pushed its work? Asked when a PC lane's turn ends at `push`
 * without the agent writing its next step line (the first real smoke run,
 * 2026-10-29: the branch was on GitHub, the row said "stopped at push").
 *
 * Pushed means origin holds `claude/<lane>` at exactly the worktree's HEAD.
 * A branch of that name left from another run doesn't match this HEAD, and
 * a worktree with nothing committed has HEAD at its start, which origin
 * doesn't hold under the lane's name. git runs with argument arrays, never a
 * shell; the lane name is already checked (LANE_NAME) before a worktree exists.
 */
import { execFile } from "node:child_process";

const git = (cwd: string, ...args: string[]) => new Promise<string>((ok, no) =>
  execFile("git", ["-C", cwd, ...args], { windowsHide: true, timeout: 60_000 }, (e, out) => (e ? no(e) : ok(out.toString().trim()))));

export async function branchPushed(lane: string, cwd: string): Promise<boolean> {
  try {
    const head = await git(cwd, "rev-parse", "HEAD");
    const remote = (await git(cwd, "ls-remote", "origin", `refs/heads/claude/${lane}`)).split(/\s+/)[0] ?? "";
    return remote.length >= 40 && remote === head;
  } catch {
    return false;
  }
}
