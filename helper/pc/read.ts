/**
 * Reads the PC for "Everything Claude is doing": processes, listening ports,
 * the desktop app's session list, and the label files in agents/running.
 *
 * On Windows one PowerShell stays open, hidden (windowsHide, which gives it
 * CREATE_NO_WINDOW), and answers each line on its stdin with one line of
 * JSON from CIM. Starting a fresh PowerShell every 5 seconds would itself be
 * one of the flashing, coming-and-going processes J asked about.
 * Elsewhere (CI runs on Linux) /proc is read directly.
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { cpus, freemem, homedir, totalmem } from "node:os";
import { join } from "node:path";
import type { PcNow } from "../contract.ts";
import type { PidLabel, RawProc, SessionInfo } from "./types.ts";

export type Sample = { procs: RawProc[]; ports: Record<number, number[]> };

// One answer per line read: every process, then every listening port.
const PS_LOOP = `
$ErrorActionPreference = 'SilentlyContinue'
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $p = @(Get-CimInstance Win32_Process | ForEach-Object {
    $c = $_.CreationDate
    @{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = $_.Name; cmd = $_.CommandLine;
       created = $(if ($c) { ([DateTimeOffset]$c).ToUnixTimeMilliseconds() } else { 0 });
       memBytes = [int64]$_.WorkingSetSize; cpuMs = [int64](($_.KernelModeTime + $_.UserModeTime) / 10000) }
  })
  $l = @(Get-NetTCPConnection -State Listen | ForEach-Object { @{ pid = [int]$_.OwningProcess; port = [int]$_.LocalPort } })
  [Console]::Out.WriteLine((@{ procs = $p; ports = $l } | ConvertTo-Json -Depth 3 -Compress))
  [Console]::Out.Flush()
}`;

type Wire = { procs: RawProc[] | RawProc; ports: { pid: number; port: number }[] | { pid: number; port: number } };
const list = <T>(x: T[] | T | null | undefined): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);

function fromWire(w: Wire): Sample {
  const ports: Record<number, number[]> = {};
  for (const { pid, port } of list(w.ports)) (ports[pid] ??= []).includes(port) || ports[pid]!.push(port);
  for (const k of Object.keys(ports)) ports[Number(k)]!.sort((a, b) => a - b);
  return { procs: list(w.procs).map((p) => ({ ...p, cmd: p.cmd ?? null })), ports };
}

export type ProcReader = { read(): Promise<Sample>; close(): void; pids(): number[] };

/** A reader that stays open between reads. Close it when the panel closes. */
export function procReader(): ProcReader {
  if (process.platform !== "win32") return { read: async () => readProc(), close() {}, pids: () => [] };
  let ps: ChildProcessWithoutNullStreams | null = null;
  let buf = "";
  const waiting: ((s: string) => void)[] = [];
  const open = () => {
    // The loop goes in as the command; stdin carries only the "read" lines.
    const encoded = Buffer.from(PS_LOOP, "utf16le").toString("base64");
    ps = spawn("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], { windowsHide: true });
    ps.stdout.setEncoding("utf8");
    ps.stdout.on("data", (d: string) => {
      buf += d;
      for (let i = buf.indexOf("\n"); i >= 0; i = buf.indexOf("\n")) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (line.startsWith("{")) waiting.shift()?.(line);
      }
    });
    ps.on("exit", () => { ps = null; for (const w of waiting.splice(0)) w("{\"procs\":[],\"ports\":[]}"); });
  };
  return {
    async read() {
      if (!ps) open();
      const line = await new Promise<string>((ok) => { waiting.push(ok); ps!.stdin.write("read\r\n"); });
      return fromWire(JSON.parse(line) as Wire);
    },
    close() { ps?.stdin.end(); ps?.kill(); ps = null; },
    pids: () => (ps?.pid ? [ps.pid] : []),
  };
}

/** One read, for a Stop or a test: opens a reader, reads, closes it. */
export async function readProcs(): Promise<RawProc[]> {
  const r = procReader();
  try { return (await r.read()).procs; } finally { r.close(); }
}

// ---- Linux: /proc ----------------------------------------------------------

function readProc(): Sample {
  const tick = 100; // USER_HZ on every Linux CI runner
  const boot = Number(/btime (\d+)/.exec(readFileSync("/proc/stat", "utf8"))?.[1] ?? 0) * 1000;
  const procs: RawProc[] = [];
  for (const d of readdirSync("/proc")) {
    if (!/^\d+$/.test(d)) continue;
    try {
      const stat = readFileSync(`/proc/${d}/stat`, "utf8");
      const close = stat.lastIndexOf(")");
      const name = stat.slice(stat.indexOf("(") + 1, close);
      const f = stat.slice(close + 2).split(" ");
      const cmd = readFileSync(`/proc/${d}/cmdline`, "utf8").split("\0").filter(Boolean).join(" ");
      procs.push({
        pid: Number(d), ppid: Number(f[1]), name, cmd: cmd || null,
        created: boot + (Number(f[19]) * 1000) / tick,
        memBytes: Number(f[21]) * 4096, cpuMs: ((Number(f[11]) + Number(f[12])) * 1000) / tick,
      });
    } catch { /* it ended while being read */ }
  }
  return { procs, ports: {} };
}

// ---- the app's session list and the label files ----------------------------

export const SESSIONS_DIR = join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), "Claude", "claude-code-sessions");
export const LABELS_DIR = join(homedir(), "Downloads", "Pleo", "agents", "running");

/** Only title, folder, ids and times: the rest of each file stays unread by the panel. */
export function readSessions(dir = SESSIONS_DIR): SessionInfo[] {
  const out: SessionInfo[] = [];
  const walk = (d: string, depth: number) => {
    let names: string[] = [];
    try { names = readdirSync(d); } catch { return; }
    for (const n of names) {
      const f = join(d, n);
      if (depth < 2) { try { if (statSync(f).isDirectory()) walk(f, depth + 1); } catch { /* gone */ } continue; }
      if (!/^local_.*\.json$/.test(n)) continue;
      try {
        const j = JSON.parse(readFileSync(f, "utf8")) as Record<string, unknown>;
        if (j.isArchived === true || typeof j.sessionId !== "string") continue;
        out.push({
          id: j.sessionId, title: typeof j.title === "string" && j.title ? j.title : "untitled session",
          cwd: typeof j.cwd === "string" ? j.cwd : null,
          cliSessionId: typeof j.cliSessionId === "string" ? j.cliSessionId : null,
          createdAt: Number(j.createdAt) || 0,
          lastActivityAt: typeof j.lastActivityAt === "number" ? j.lastActivityAt : null,
        });
      } catch { /* half written */ }
    }
  };
  walk(dir, 0);
  return out;
}

/** Pleo/agents/running/<pid>.json: {pid, session, purpose, port}. */
export function readLabels(dir = LABELS_DIR): PidLabel[] {
  let names: string[] = [];
  try { names = readdirSync(dir); } catch { return []; }
  return names.filter((n) => /^\d+\.json$/.test(n)).flatMap((n) => {
    try {
      const j = JSON.parse(readFileSync(join(dir, n), "utf8")) as Partial<PidLabel>;
      if (!Number.isInteger(j.pid) || typeof j.purpose !== "string") return [];
      return [{ pid: j.pid!, session: typeof j.session === "string" ? j.session : "unnamed", purpose: j.purpose, port: typeof j.port === "number" ? j.port : null, ...(typeof j.created === "number" ? { created: j.created } : {}) }];
    } catch { return []; }
  });
}

export const memoryNow = (): PcNow["memory"] => ({ usedBytes: totalmem() - freemem(), totalBytes: totalmem() });
export const coreCount = () => Math.max(1, cpus().length);

/** Until the runner can list them (agents-runner's cloud adapter can't). */
export const CLOUD_NOT_VISIBLE: PcNow["cloud"] = {
  visible: false,
  reason: "Not visible yet: the Claude CLI can start and message a cloud session but can't list them, so cloud sessions show on claude.ai/code only. Ones the helper starts will show here with their link.",
  sessions: [],
};
