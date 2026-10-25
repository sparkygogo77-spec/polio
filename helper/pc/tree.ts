/**
 * Builds "Everything Claude is doing" from one read of the PC: the desktop
 * app as one group, the app's Terminal panel tabs, one group per Claude Code
 * session (named from the app's session list), and "Left running" for
 * labelled or orphaned processes no session holds any more. Pure.
 *
 * A child counts as a child only when it started after its parent: Windows
 * reuses pids, and a parent pid that now names a younger process is not the
 * parent.
 */
import {
  CONTRACT_VERSION as v,
  type PcGroup, type PcGroupKind, type PcItem, type PcMatch, type PcNow,
} from "../contract.ts";
import { describe, detailOf, folderOf, isAppMain, isAppProcess, isSession, type Described } from "./label.ts";
import { keyOf, type PcInput, type PidLabel, type RawProc, type SessionInfo } from "./types.ts";

/** Above this share of the PC a process counts as busy. */
const BUSY_CPU = 0.5;
/** Within this of a session's createdAt, a claude.exe start is that session's. */
const START_SLACK_MS = 20_000;
export const DEFAULT_ROOTS = ["\\Downloads\\Pleo\\"];

export function childrenOf(procs: RawProc[]): Map<number, RawProc[]> {
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const kids = new Map<number, RawProc[]>();
  for (const p of procs) {
    const parent = byPid.get(p.ppid);
    if (!parent || parent.pid === p.pid || parent.created > p.created) continue;
    const list = kids.get(parent.pid) ?? [];
    list.push(p);
    kids.set(parent.pid, list);
  }
  for (const list of kids.values()) list.sort((a, b) => a.created - b.created);
  return kids;
}

/** Ties each session's claude.exe to the app's session list: --resume first, then start time. */
export function matchSessions(procs: RawProc[], sessions: SessionInfo[]) {
  const out = new Map<number, { s: SessionInfo; match: PcMatch }>();
  const used = new Set<string>();
  const loose: RawProc[] = [];
  for (const p of procs.filter(isSession)) {
    const resume = /--resume[= ]"?([0-9a-f-]{36})/.exec(p.cmd ?? "")?.[1];
    const s = resume ? sessions.find((x) => x.cliSessionId === resume) : undefined;
    if (s) { out.set(p.pid, { s, match: "resume" }); used.add(s.id); } else loose.push(p);
  }
  const pairs = loose.flatMap((p) => sessions.filter((s) => !used.has(s.id)).map((s) => ({ p, s, gap: Math.abs(s.createdAt - p.created) })))
    .filter((x) => x.gap <= START_SLACK_MS).sort((a, b) => a.gap - b.gap);
  for (const { p, s } of pairs) {
    if (out.has(p.pid) || used.has(s.id)) continue;
    out.set(p.pid, { s, match: "start-time" });
    used.add(s.id);
  }
  return out;
}

const hhmm = (ms: number) => new Date(ms).toTimeString().slice(0, 5);
const minutesSince = (now: number, t: number | null | undefined) => (t == null ? null : Math.max(0, Math.floor((now - t) / 60_000)));

export function buildPc(input: PcInput): PcNow {
  const { procs, now } = input;
  const byPid = new Map(procs.map((p) => [p.pid, p]));
  const kids = childrenOf(procs);
  const labels = new Map<number, PidLabel>();
  for (const l of input.labels) {
    const p = byPid.get(l.pid);
    if (p && (l.created == null || l.created === p.created)) labels.set(l.pid, l);
  }
  const matched = matchSessions(procs, input.sessions);
  const roots = (input.roots ?? DEFAULT_ROOTS).map((r) => r.toLowerCase());
  const placed = new Set<number>();

  const cpuOf = (p: RawProc): number | null => {
    const before = input.prev?.cpuMs[keyOf(p)];
    if (!input.prev || before == null || now <= input.prev.at) return null;
    return Math.max(0, ((p.cpuMs - before) / ((now - input.prev.at) * input.cores)) * 100);
  };
  const idleOf = (p: RawProc, cpu: number | null): number | null => {
    const k = keyOf(p);
    if (cpu !== null && cpu >= BUSY_CPU) input.busy[k] = now;
    else if (input.busy[k] == null) {
      // First sight: a process that has barely used CPU all its life has been idle since it started.
      const life = Math.max(1, now - p.created);
      input.busy[k] = p.cpuMs / (life * input.cores) < 0.002 ? p.created : now;
    }
    return minutesSince(now, input.busy[k]);
  };

  function walk(root: RawProc, startedBy: string, out: PcItem[], stopAt?: (p: RawProc) => boolean) {
    const go = (p: RawProc, depth: number, parent: Described | null, parentProc: RawProc | null, lane: string | null) => {
      if (placed.has(p.pid)) return;
      placed.add(p.pid);
      const label = labels.get(p.pid);
      let d = describe(p, { parent, parentProc, ports: input.ports[p.pid] ?? [], lane });
      if (label) d = { ...d, kind: "labelled", label: label.purpose, port: label.port ?? d.port };
      if (input.self.includes(p.pid)) d = { ...d, label: "the reader for this panel" };
      const cpu = cpuOf(p);
      out.push({
        pid: p.pid, created: p.created, parentPid: p.ppid, depth, kind: d.kind, label: d.label,
        detail: detailOf(p), port: d.port, folder: d.folder, cpu, memBytes: p.memBytes,
        idleMinutes: idleOf(p, cpu), startedBy: label?.session ?? startedBy, stoppable: d.kind !== "app",
      });
      const nextLane = folderOf(p.cmd)?.lane ?? lane;
      for (const c of kids.get(p.pid) ?? []) if (!stopAt?.(c)) go(c, depth + 1, d, p, nextLane);
    };
    go(root, 0, null, byPid.get(root.ppid) ?? null, null);
  }

  const group = (id: string, kind: PcGroupKind, title: string, items: PcItem[], extra: Partial<PcGroup> = {}): PcGroup => {
    const cpus = items.map((i) => i.cpu).filter((c): c is number => c !== null);
    const idles = items.map((i) => i.idleMinutes).filter((x): x is number => x !== null);
    return {
      id, kind, title, folder: null, match: null,
      startedAt: Math.min(...items.map((i) => i.created)),
      idleMinutes: idles.length === items.length && idles.length ? Math.min(...idles) : null,
      cpu: cpus.length ? cpus.reduce((a, b) => a + b, 0) : null,
      memBytes: items.reduce((a, i) => a + i.memBytes, 0),
      items, ...extra,
    };
  };

  const groups: PcGroup[] = [];
  const appItems: PcItem[] = [];
  const terminalItems: PcItem[] = [];
  const sessionGroups: PcGroup[] = [];

  for (const main of procs.filter(isAppMain)) {
    // The app's own processes first, then what hangs below them.
    walk(main, "the Claude desktop app", appItems, (c) => !isAppProcess(c));
    const below = (p: RawProc): RawProc[] => (kids.get(p.pid) ?? []).flatMap((c) => (isAppProcess(c) ? below(c) : [c]));
    for (const c of below(main)) {
      if (isSession(c)) continue;
      walk(c, "you, in the app's Terminal panel", terminalItems);
    }
  }
  // Oldest first, so a session started by another session stays inside it.
  for (const s of procs.filter(isSession).sort((a, b) => a.created - b.created)) {
    if (placed.has(s.pid)) continue;
    const m = matched.get(s.pid);
    const title = m?.s.title ?? `Claude Code session, started ${hhmm(s.created)}`;
    const items: PcItem[] = [];
    walk(s, title, items);
    if (!items.length) continue;
    const idle = minutesSince(now, m?.s.lastActivityAt);
    const g = group(m?.s.id ?? `pid-${s.pid}`, "session", title, items, { folder: m?.s.cwd ?? null, match: m?.match ?? "none" });
    // A session is idle from its last turn, not from its CPU.
    if (idle !== null) { g.idleMinutes = idle; items[0]!.idleMinutes = idle; }
    sessionGroups.push(g);
  }

  // Left running: labelled pids no group holds, and orphans in Claude's folders.
  const left: PcItem[] = [];
  const orphan = (p: RawProc) => {
    const parent = byPid.get(p.ppid);
    return !parent || parent.created > p.created;
  };
  for (const p of procs) {
    if (placed.has(p.pid)) continue;
    const inRoot = roots.some((r) => (p.cmd ?? "").toLowerCase().includes(r));
    if (labels.has(p.pid) || (orphan(p) && inRoot)) walk(p, "no session (the one that started it has ended)", left);
  }

  if (appItems.length) groups.push(group("app", "app", "Claude desktop app", appItems));
  groups.push(...sessionGroups);
  if (terminalItems.length) groups.push(group("terminal", "terminal", "Terminal panel (yours)", terminalItems));
  if (left.length) groups.push(group("left", "left", "Left running, no session", left));

  const all = groups.flatMap((g) => g.items);
  const cpus = groups.map((g) => g.cpu).filter((c): c is number => c !== null);
  return {
    v, kind: "pc", at: now, memory: input.memory,
    totals: { processes: all.length, sessions: sessionGroups.length, cpu: cpus.length ? cpus.reduce((a, b) => a + b, 0) : null, memBytes: all.reduce((a, i) => a + i.memBytes, 0) },
    groups, cloud: input.cloud,
  };
}
