/**
 * What each process is for, in plain words, read from its name and command
 * line alone. Pure, so the test can label a fake tree.
 *
 * The Claude desktop app is one Electron program (Claude.exe, many
 * processes told apart by --type). Its Claude Code sessions are claude.exe
 * from AppData\Roaming\Claude\claude-code, run with --output-format
 * stream-json. Everything a session runs (shells, servers, browsers, git)
 * hangs below its claude.exe.
 */
import type { PcKind } from "../contract.ts";
import type { RawProc } from "./types.ts";

export type Described = { kind: PcKind; label: string; port: number | null; folder: string | null };

const lower = (s: string | null) => (s ?? "").toLowerCase();

export const isAppProcess = (p: RawProc) =>
  lower(p.name) === "claude.exe" && /\\(windowsapps\\claude_[^\\]*\\app|anthropicclaude\\[^\\]*)\\claude\.exe/i.test(p.cmd ?? "");
export const isAppMain = (p: RawProc) => isAppProcess(p) && !/--type=/.test(p.cmd ?? "");
export const isSession = (p: RawProc) => lower(p.name) === "claude.exe" && !isAppProcess(p) && /stream-json/.test(p.cmd ?? "");
const isBrowser = (p: RawProc) => /^(headless_shell|chrome-headless-shell|chrome|chromium|msedge)(\.exe)?$/i.test(p.name) && /--headless|headless[_-]shell/i.test(`${p.name} ${p.cmd ?? ""}`);
export const isBrowserProcess = isBrowser;

/** The lane folder a command line points into: Pleo\work-<lane> or Pleo\agents\<lane>. */
export function folderOf(cmd: string | null): { folder: string; lane: string } | null {
  const m = /([A-Za-z]:\\(?:[^\\"\s]+\\)*?Pleo\\(?:agents\\)?([^\\"\s]+))/i.exec(cmd ?? "");
  if (!m || !m[1] || !m[2]) return null;
  return { folder: m[1], lane: m[2].replace(/^work-/, "") };
}

function portOf(cmd: string | null, listening: number[]): number | null {
  const m = /(?:\s-p|--port)[ =](\d{2,5})\b/.exec(cmd ?? "");
  if (m) return Number(m[1]);
  return listening[0] ?? null;
}

const APP_TYPES: [RegExp, string][] = [
  [/--type=renderer/, "app window (renderer)"],
  [/--type=gpu-process/, "app graphics"],
  [/network\.mojom/, "app network"],
  [/node\.mojom\.NodeService/, "app background helper"],
  [/audio\.mojom/, "app audio"],
  [/video_capture/, "app camera and video"],
  [/--type=crashpad-handler/, "app crash reporter"],
];

/**
 * `parent` is the parent's own description, when it has one; `lane` is the
 * nearest lane folder found up the tree, for a process whose own command
 * line doesn't name one.
 */
export function describe(p: RawProc, ctx: { parent: Described | null; parentProc: RawProc | null; ports: number[]; lane: string | null }): Described {
  const cmd = p.cmd ?? "";
  const name = lower(p.name).replace(/\.exe$/, "");
  const at = folderOf(cmd);
  const lane = at?.lane ?? ctx.lane;
  const folder = at?.folder ?? null;
  const port = portOf(cmd, ctx.ports);
  const d = (kind: PcKind, label: string, withPort = port): Described => ({ kind, label, port: withPort, folder });

  if (isAppMain(p)) return d("app", "Claude desktop app", null);
  if (isAppProcess(p)) return d("app", APP_TYPES.find(([re]) => re.test(cmd))?.[1] ?? "app process", null);
  if (isSession(p)) return d("session", "Claude Code session", null);

  if (name === "conhost") {
    // Windows gives every console program a conhost. Started hidden it shows nothing;
    // started without CREATE_NO_WINDOW it is the window that flashes (agents-pcview.md).
    if (/--headless/.test(cmd)) return d("console", ctx.parentProc && isAppProcess(ctx.parentProc) ? "hidden console for a Terminal panel tab" : "hidden console", null);
    return d("console", `console host for ${ctx.parent?.label ?? "a program"}`, null);
  }
  if (name === "powershell" || name === "pwsh" || name === "cmd") {
    if (/CLAUDE_CODE_SHELL_LAUNCHER|__claudeCode/.test(cmd)) return d("shell", name === "cmd" ? "PowerShell tool command (its wrapper; closes when done)" : "PowerShell tool command (closes when done)", null);
    if (ctx.parentProc && isAppProcess(ctx.parentProc) && /-NoExit/i.test(cmd)) return d("terminal-tab", "Terminal panel tab", null);
    return d("shell", name === "cmd" ? "command prompt" : "PowerShell", null);
  }
  if (name === "bash" || name === "sh") return d("shell", "Bash tool command (closes when done)", null);
  if (name === "git") {
    const sub = /\bgit(?:\.exe"?)?\s+(?:-[Cc]\s+\S+\s+)*([a-z-]+)/i.exec(cmd)?.[1];
    return d("git", `git ${sub ?? "command"}${lane ? ` in ${lane}` : ""}`, null);
  }
  if (isBrowser(p)) {
    if (ctx.parentProc && isBrowser(ctx.parentProc)) return d("browser", "part of the test browser", null);
    return d("browser", `test browser${lane ? ` for ${lane}` : ""}`, null);
  }
  if (name === "node") {
    const forLane = lane ? ` for lane ${lane}` : "";
    if (/next(\.js)?["']?\s+build\b|\bnext\s+build\b/.test(cmd)) return d("build", `build of the Builder${forLane}`, null);
    if (/\bnext(\.js)?["']?\s+(start|dev)\b/.test(cmd)) return d("dev-server", `Builder copy${forLane}${port ? `, port ${port}` : ""}`);
    if (/dock[\\/]serve\.mjs/.test(cmd)) return d("dev-server", `dock preview${port ? `, port ${port}` : ""}`);
    if (/npm-cli\.js|npx-cli\.js/.test(cmd)) {
      const sub = /(?:npm|npx)-cli\.js"?\s+(\S+(?:\s+\S+)?)/.exec(cmd)?.[1] ?? "";
      return d("npm", `${/npx/.test(cmd) ? "npx" : "npm"} ${sub}`.trim() + (lane ? ` in ${lane}` : ""));
    }
    const test = /tests[\\/]([\w.-]+)\.m?js/.exec(cmd)?.[1];
    if (test) return d("test", `test ${test}${forLane}`);
    const script = /([\w.-]+\.(?:m?js|ts))"?(?:\s|$)/.exec(cmd)?.[1];
    return d("node", `node script ${script ?? ""}`.trim() + forLane);
  }
  return d("other", p.name);
}

// Key-shaped words, blanked before a command line is shown or logged.
const KEYS = /sk-ant-[\w-]+|gh[pousr]_\w{20,}|github_pat_\w+|xox[abpr]-[\w-]+|\b[A-Za-z0-9+_=-]{40,}\b/g;

/** The name and a short, key-blanked command line, without the app's long flags. */
export function detailOf(p: RawProc): string {
  const cmd = (p.cmd ?? "")
    .replace(/^"?[^"]*?([^\\"]+\.exe)"?/i, "")
    .replace(/--settings\s+"(?:\\"|[^"])*"/g, "")
    .replace(/--(allowedTools|disallowedTools|add-dir|standard-schemes|user-data-dir|gpu-preferences|field-trial-handle)\S*(\s+"[^"]*")?/g, "")
    .replace(KEYS, "•••")
    .replace(/\s+/g, " ")
    .trim();
  const text = `${p.name}${cmd ? ` ${cmd}` : ""}`;
  return text.length > 140 ? `${text.slice(0, 139)}…` : text;
}
