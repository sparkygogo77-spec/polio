/**
 * Polls the PC every few seconds and keeps what CPU and "idle for N min"
 * need from one read to the next. The helper (or serve.mjs for the preview)
 * owns one watch and hands each PcNow to the dock.
 */
import type { PcNow, PcStopped } from "../contract.ts";
import { CONTRACT_VERSION as v } from "../contract.ts";
import { coreCount, CLOUD_NOT_VISIBLE, memoryNow, procReader, readLabels, readSessions, type ProcReader } from "./read.ts";
import { planStop, planStopIdle, stopNow } from "./stop.ts";
import { buildPc } from "./tree.ts";
import { keyOf, type PcInput } from "./types.ts";

export type WatchOptions = {
  sessionsDir?: string;
  labelsDir?: string;
  cloud?: () => PcNow["cloud"];
  reader?: ProcReader;
};

export function pcWatch(opts: WatchOptions = {}) {
  const reader = opts.reader ?? procReader();
  let prev: PcInput["prev"] = null;
  const busy: Record<string, number> = {};
  let last: PcNow | null = null;

  async function read(): Promise<PcNow> {
    const sample = await reader.read();
    const now = Date.now();
    const pc = buildPc({
      now, cores: coreCount(), memory: memoryNow(), procs: sample.procs, ports: sample.ports,
      labels: readLabels(opts.labelsDir), sessions: readSessions(opts.sessionsDir), prev, busy,
      self: [process.pid, ...reader.pids()], cloud: opts.cloud?.() ?? CLOUD_NOT_VISIBLE,
    });
    prev = { at: now, cpuMs: Object.fromEntries(sample.procs.map((p) => [keyOf(p), p.cpuMs])) };
    last = pc;
    return pc;
  }

  /** Re-reads the PC first, so the plan is made on what is running now. */
  async function stop(pid: number, created: number, confirmSession: boolean): Promise<PcStopped> {
    const { procs } = await reader.read();
    const plan = planStop(procs, { pid, created, confirmSession }, { self: [process.pid, ...reader.pids()] });
    const { ended } = await stopNow(plan.pids);
    return { v, kind: "pc-stopped", pid, ended, refused: plan.refused, needsConfirm: plan.needsConfirm };
  }

  async function stopIdle(minutes: number): Promise<PcStopped> {
    const pc = await read();
    const { procs } = await reader.read();
    const ended: number[] = [];
    for (const pid of planStopIdle(pc, minutes)) {
      const it = pc.groups.flatMap((g) => g.items).find((i) => i.pid === pid)!;
      const plan = planStop(procs, { pid, created: it.created, confirmSession: false }, { self: [process.pid, ...reader.pids()] });
      ended.push(...(await stopNow(plan.pids)).ended);
    }
    return { v, kind: "pc-stopped", pid: null, ended, refused: null, needsConfirm: false };
  }

  return { read, stop, stopIdle, last: () => last, close: () => reader.close() };
}
