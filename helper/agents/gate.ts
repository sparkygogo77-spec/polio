/**
 * A lane's pause flag, held two ways: in the helper's memory, for the SDK's
 * in-process hook, and as files in the lane's state folder, for the command
 * hook a `claude -p` run calls before every tool (hold-hook.mjs).
 *
 *   <dir>/paused    exists while J has the lane paused
 *   <dir>/stopped   exists once J pressed Stop: every later tool call is refused
 *
 * Only the runner sets these, and only on a control from the paired dock
 * (or its own spend-cap pause). The folder is outside the lane's worktree.
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type GateState = "running" | "paused" | "stopped";

export class Gate {
  state: GateState = "running";
  private waiters: (() => void)[] = [];
  readonly dir: string;
  constructor(dir: string) {
    this.dir = dir;
    mkdirSync(dir, { recursive: true });
    rmSync(join(dir, "paused"), { force: true });
    rmSync(join(dir, "stopped"), { force: true });
  }
  pause() {
    if (this.state !== "running") return;
    this.state = "paused";
    writeFileSync(join(this.dir, "paused"), String(Date.now()));
  }
  resume() {
    if (this.state !== "paused") return;
    this.state = "running";
    rmSync(join(this.dir, "paused"), { force: true });
    this.wake();
  }
  stop() {
    this.state = "stopped";
    writeFileSync(join(this.dir, "stopped"), String(Date.now()));
    rmSync(join(this.dir, "paused"), { force: true });
    this.wake();
  }
  /** Resolves once the lane may go on: "go", or "stopped" when it may not. */
  async wait(): Promise<"go" | "stopped"> {
    while (this.state === "paused") await new Promise<void>((r) => this.waiters.push(r));
    return this.state === "stopped" ? "stopped" : "go";
  }
  private wake() { for (const w of this.waiters.splice(0)) w(); }
}
