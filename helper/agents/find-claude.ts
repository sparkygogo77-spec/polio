/**
 * Where Claude Code is on this PC (audit helper-install.md, risk 1). The same
 * order install.ps1 uses, so an installed helper finds it again each time it
 * starts, even after the desktop app updates and moves its own copy:
 *
 *   1. the path the tray passes (--claude, from helper.json), if it is there;
 *   2. ~/.local/bin/claude(.exe), the Claude Code install in the user folder;
 *   3. claude on PATH;
 *   4. the Claude desktop app's own copy:
 *      %APPDATA%\Claude\claude-code\<version>\<hash>\claude.exe, newest version.
 *
 * Answers the path and, in plain words, where it came from (the helper prints
 * it at start), or null with what to do.
 */
import { existsSync, readdirSync, statSync } from "node:fs";
import { delimiter, join } from "node:path";

export type Found = { file: string; from: string } | { file: null; from: string };

const exe = (p: string) => (p.endsWith(".exe") || process.platform !== "win32" ? p : `${p}.exe`);

/** "2.1.309" → [2,1,309]; anything else → null. */
const version = (s: string) => (/^\d+(\.\d+){0,3}$/.test(s) ? s.split(".").map(Number) : null);
const newer = (a: number[], b: number[]) => {
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return false;
};

/** The desktop app's newest claude.exe under <appData>/Claude/claude-code, or null. */
export function desktopClaude(appData: string | undefined): string | null {
  if (!appData) return null;
  const base = join(appData, "Claude", "claude-code");
  let best: { file: string; v: number[] } | null = null;
  let dirs: string[] = [];
  try { dirs = readdirSync(base); } catch { return null; }
  for (const d of dirs) {
    const v = version(d);
    if (!v) continue;
    let hashes: string[] = [];
    try { hashes = readdirSync(join(base, d)); } catch { continue; }
    const files = hashes.map((h) => join(base, d, h, "claude.exe")).filter((f) => existsSync(f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
    if (files[0] && (!best || newer(v, best.v))) best = { file: files[0], v };
  }
  return best?.file ?? null;
}

export function findClaude(opts: { given?: string; home?: string; path?: string; appData?: string } = {}): Found {
  if (opts.given && existsSync(opts.given)) return { file: opts.given, from: "the path in helper.json" };
  if (opts.home) {
    const local = exe(join(opts.home, ".local", "bin", "claude"));
    if (existsSync(local)) return { file: local, from: "the Claude Code install in your user folder" };
  }
  for (const dir of (opts.path ?? "").split(delimiter).filter(Boolean)) {
    const f = exe(join(dir, "claude"));
    if (existsSync(f)) return { file: f, from: "claude on PATH" };
  }
  const app = desktopClaude(opts.appData);
  if (app) return { file: app, from: "the Claude desktop app's own copy, the newest version" };
  return { file: null, from: "Claude Code was not found: install it and run claude once to sign in, or pass --claude" };
}
