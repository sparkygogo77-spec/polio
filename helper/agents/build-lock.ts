/**
 * One big build at a time across every lane on the PC. A build needs about
 * 3 GB, and two at once have run out of memory here (proposal, section 3).
 *
 * The lock is a file holding the lane's name, made with `wx` so only one
 * maker wins. The hook takes it before a build command and gives it back
 * after; the runner gives back a lane's lock when the lane ends, so a lane
 * killed mid-build doesn't hold it forever.
 */
import { mkdirSync, openSync, writeSync, closeSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const BUILD = /\b(next\s+build|npm\s+run\s+(build|check|test:nightly)|scripts\/test-all\.mjs\s+.*--build)\b/;
export const isBuild = (command: string) => BUILD.test(command);

export function takeBuildLock(dir: string, lane: string): boolean {
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "build.lock");
  try {
    const fd = openSync(file, "wx");
    writeSync(fd, lane);
    closeSync(fd);
    return true;
  } catch {
    return holderOf(dir) === lane;
  }
}

export function holderOf(dir: string): string | null {
  try { return readFileSync(join(dir, "build.lock"), "utf8").trim() || null; } catch { return null; }
}

export function giveBuildLock(dir: string, lane: string) {
  if (holderOf(dir) === lane) rmSync(join(dir, "build.lock"), { force: true });
}
