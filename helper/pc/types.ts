/**
 * What the PC reader reads (helper/pc/read.ts) before it is labelled and
 * grouped (tree.ts). Kept apart from the contract: these never leave the
 * helper, only the PcNow built from them does.
 */
import type { PcNow } from "../contract.ts";

/** One process as Windows (or /proc) reports it. */
export type RawProc = {
  pid: number;
  ppid: number;
  /** The image name, such as "node.exe". */
  name: string;
  cmd: string | null;
  /** Start time, ms since 1970. */
  created: number;
  memBytes: number;
  /** CPU time used since it started, kernel plus user, in ms. */
  cpuMs: number;
};

/**
 * Pleo/agents/running/<pid>.json, written by whoever starts something
 * long-lived (lane-rules.md, "Leave nothing running"). `created` is optional:
 * when given, a label for a pid that now names another process is ignored.
 */
export type PidLabel = { pid: number; session: string; purpose: string; port?: number | null; created?: number };

/** The few fields read from the desktop app's session list, nothing more. */
export type SessionInfo = {
  id: string;
  title: string;
  cwd: string | null;
  cliSessionId: string | null;
  createdAt: number;
  lastActivityAt: number | null;
};

export type PcInput = {
  now: number;
  cores: number;
  memory: PcNow["memory"];
  procs: RawProc[];
  /** Listening TCP ports by pid. */
  ports: Record<number, number[]>;
  labels: PidLabel[];
  sessions: SessionInfo[];
  /** The last read, for CPU: when it was and each process's cpuMs then. */
  prev: { at: number; cpuMs: Record<string, number> } | null;
  /** When each process last used CPU. buildPc writes the new times back. */
  busy: Record<string, number>;
  /** This helper's own pids, labelled as such. */
  self: number[];
  cloud: PcNow["cloud"];
  /** Folders whose orphans count as Claude's (a server left by a session that ended). */
  roots?: string[];
};

/** A process is named by pid and start time together, so a reused pid is a new key. */
export const keyOf = (p: Pick<RawProc, "pid" | "created">) => `${p.pid}@${p.created}`;
