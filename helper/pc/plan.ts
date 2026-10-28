/**
 * J's Stop for one process tree, and "Stop all idle", as plans. Pure, so the
 * test and the dock's fake mode run it too; helper/pc/stop.ts is the one
 * place a process really ends.
 *
 * What Stop never does:
 * - end the Claude desktop app or any of its own processes;
 * - end a pid whose start time differs from the one J saw (a reused pid);
 * - end a session's own claude.exe without J's second yes;
 * - end the helper itself.
 * The tree is the process and everything that started under it, ended
 * children first so a parent can't start a replacement on the way out.
 */
import { PC_IDLE_MINUTES, type PcKind, type PcNow } from "../contract.ts";
import { isAppProcess, isSession } from "./label.ts";
import { childrenOf } from "./tree.ts";
import type { RawProc } from "./types.ts";

export type StopPlan = { pids: number[]; refused: string | null; needsConfirm: boolean };

const refuse = (refused: string, needsConfirm = false): StopPlan => ({ pids: [], refused, needsConfirm });

export function planStop(procs: RawProc[], target: { pid: number; created: number; confirmSession: boolean }, opts: { self?: number[] } = {}): StopPlan {
  const self = opts.self ?? [];
  const p = procs.find((x) => x.pid === target.pid);
  if (!p || p.created !== target.created) return refuse("That process has already ended, or its number now belongs to another one. Nothing was stopped.");
  if (isAppProcess(p)) return refuse("Stop never ends the Claude desktop app. Quit it from its own menu if you mean to.");
  if (isSession(p) && !target.confirmSession) return refuse("This ends a whole Claude Code session and what it is doing. Press Stop again to say yes.", true);
  const kids = childrenOf(procs);
  const out: number[] = [];
  const go = (x: RawProc) => {
    for (const c of kids.get(x.pid) ?? []) if (!isAppProcess(c)) go(c);
    out.push(x.pid);
  };
  go(p);
  if (out.some((pid) => self.includes(pid))) return refuse("That tree holds this helper itself, so it was left alone.");
  return { pids: out, refused: null, needsConfirm: false };
}

/** The kinds "Stop all idle" may end: long-lived things left waiting. */
export const IDLE_KINDS: readonly PcKind[] = ["dev-server", "browser", "test", "node", "labelled", "npm"];

/** The pids "Stop all idle" would press Stop on: the top of each idle tree only. */
export function planStopIdle(pc: PcNow, minutes = PC_IDLE_MINUTES): number[] {
  const out: number[] = [];
  for (const g of pc.groups) {
    if (g.kind !== "session" && g.kind !== "left") continue;
    const picked = new Set<number>();
    const parentOf = new Map(g.items.map((i) => [i.pid, i.parentPid]));
    const under = (pid: number) => {
      for (let p = parentOf.get(pid); p != null; p = parentOf.get(p)) if (picked.has(p)) return true;
      return false;
    };
    for (const i of g.items) {
      if (!i.stoppable || !IDLE_KINDS.includes(i.kind) || i.idleMinutes == null || i.idleMinutes < minutes || under(i.pid)) continue;
      picked.add(i.pid);
      out.push(i.pid);
    }
  }
  return out;
}

