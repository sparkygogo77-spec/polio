/**
 * "Everything Claude is doing": the dock's second tab. It draws one PcNow
 * (helper/contract.ts) as collapsible groups with the totals on top, and
 * turns J's presses into pc-stop and pc-stop-idle messages, each checked
 * before it leaves.
 *
 *   ?pc=fake   the fake PC tree (helper/pc/fake.ts), stops played in the page (the default)
 *   ?pc=live   the real PC through serve.mjs --pc: GET /api/pc/now, POST /api/pc/stop, /api/pc/stop-idle
 *
 * window.__dock.pcSent holds what the panel sent, for the test.
 */
import {
  CONTRACT_VERSION as v, PC_IDLE_MINUTES, problems,
  type PcGroup, type PcItem, type PcNow, type PcStop, type PcStopIdle, type PcStopped,
} from "../contract.ts";
import { fakeInput } from "../pc/fake.ts";
import { planStop, planStopIdle } from "../pc/plan.ts";
import { buildPc } from "../pc/tree.ts";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const MB = 1024 * 1024;
const mem = (b: number) => (b >= 1024 * MB ? `${(b / 1024 / MB).toFixed(1)} GB` : `${Math.round(b / MB)} MB`);
const cpu = (c: number | null) => (c === null ? "cpu …" : `cpu ${c < 10 ? c.toFixed(1) : Math.round(c)}%`);
const age = (ms: number) => {
  const m = Math.max(0, Math.floor(ms / 60_000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
};
const idle = (n: number | null) => (n !== null && n >= PC_IDLE_MINUTES ? `<span class="idle" data-idle>idle ${n} min</span>` : "");

export type PcSource = {
  now(): Promise<PcNow>;
  send(m: PcStop | PcStopIdle): Promise<PcStopped>;
};

/** The fake PC: Stop is planned with the real plan and the tree leaves the fake. */
export function fakeSource(): PcSource {
  const input = fakeInput();
  const rebuild = () => buildPc({ ...input, procs: [...input.procs] });
  const drop = (pids: number[]) => { input.procs = input.procs.filter((p) => !pids.includes(p.pid)); };
  return {
    async now() { return rebuild(); },
    async send(m) {
      if (m.kind === "pc-stop-idle") {
        const pc = rebuild();
        const ended: number[] = [];
        for (const pid of planStopIdle(pc, m.minutes)) {
          const it = pc.groups.flatMap((g) => g.items).find((i) => i.pid === pid)!;
          const plan = planStop(input.procs, { pid, created: it.created, confirmSession: false });
          drop(plan.pids); ended.push(...plan.pids);
        }
        return { v, kind: "pc-stopped", pid: null, ended, refused: null, needsConfirm: false };
      }
      const plan = planStop(input.procs, m);
      drop(plan.pids);
      return { v, kind: "pc-stopped", pid: m.pid, ended: plan.pids, refused: plan.refused, needsConfirm: plan.needsConfirm };
    },
  };
}

export function liveSource(): PcSource {
  const post = (path: string, m: unknown) =>
    fetch(path, { method: "POST", headers: { "content-type": "application/json", "x-polio-dock": "1" }, body: JSON.stringify(m) }).then((r) => r.json() as Promise<PcStopped>);
  return {
    now: () => fetch("/api/pc/now").then((r) => r.json() as Promise<PcNow>),
    send: (m) => post(m.kind === "pc-stop" ? "/api/pc/stop" : "/api/pc/stop-idle", m),
  };
}

type Ask = { pid?: number; idle?: boolean } | null;

export function mountPcView(root: HTMLElement, source: PcSource, opts: { everyMs?: number; sent: unknown[] }) {
  let pc: PcNow | null = null;
  let ask: Ask = null;
  let result = "";
  const closed = new Set<string>();

  const itemRow = (g: PcGroup, i: PcItem) => {
    const asking = ask?.pid === i.pid;
    const stop = !i.stoppable ? "" : asking
      ? `<span class="ask">Ends the whole session "${esc(g.title)}" and what it is doing. Stop it?</span><button class="danger" data-pc-yes>Yes, stop</button><button data-pc-no>Keep it</button>`
      : `<button class="small" data-pc-stop title="End this and what it started">Stop</button>`;
    return `
      <li class="pc-item" data-pc-item="${i.pid}" data-kind="${i.kind}" style="--depth:${Math.min(i.depth, 6)}">
        <div class="what"><span class="kind">${esc(i.kind)}</span> <b>${esc(i.label)}</b> ${i.kind === "app" ? "" : idle(i.idleMinutes)}${asking ? "" : stop}</div>
        <div class="nums quiet"><span>${cpu(i.cpu)}</span><span>${mem(i.memBytes)}</span><span>${age(pc!.at - i.created)}</span><span>pid ${i.pid}</span></div>
        <div class="detail quiet" title="${esc(i.detail)}">${esc(i.detail)}</div>
        ${asking ? `<div class="row-buttons">${stop}</div>` : ""}
      </li>`;
  };

  const groupHtml = (g: PcGroup) => {
    const tag = g.kind === "session" ? (g.match === "none" ? "not matched" : g.match === "start-time" ? "matched by start time" : "") : "";
    const head = g.items[0];
    const stopGroup = g.kind === "session" && head?.kind === "session" ? `<button class="small" data-stop-group="${head.pid}">Stop session</button>` : "";
    const note = g.kind === "app" ? `<p class="quiet">The app itself. It is never stopped from here.</p>`
      : g.kind === "terminal" ? `<p class="quiet">Tabs you opened in the app's Terminal panel.</p>` : "";
    return `
      <details class="pc-group" data-pc-group="${esc(g.id)}" data-kind="${g.kind}"${closed.has(g.id) ? "" : " open"}>
        <summary>
          <span class="title" data-group-title>${esc(g.title)}</span>
          ${tag ? `<span class="tag">${tag}</span>` : ""} ${g.kind === "app" ? "" : idle(g.idleMinutes)}
          <span class="right quiet">${g.items.length} · ${mem(g.memBytes)} · ${cpu(g.cpu)}</span>
        </summary>
        <div class="group-head quiet">${g.folder ? `${esc(g.folder)} · ` : ""}since ${new Date(g.startedAt).toTimeString().slice(0, 5)} ${stopGroup}</div>
        ${note}
        <ul class="pc-items">${g.items.map((i) => itemRow(g, i)).join("")}</ul>
      </details>`;
  };

  function draw() {
    if (!pc) return;
    const t = pc.totals;
    const idleCount = planStopIdle(pc, PC_IDLE_MINUTES).length;
    const stopIdle = ask?.idle
      ? `<span class="ask">Stop ${idleCount} idle thing${idleCount === 1 ? "" : "s"}? Sessions and the app are left alone.</span><button class="danger" data-stop-idle-yes>Yes, stop</button><button data-stop-idle-no>Keep them</button>`
      : `<button data-stop-idle${idleCount ? "" : " disabled"}>Stop all idle (${idleCount})</button>`;
    const cloud = pc.cloud.visible
      ? (pc.cloud.sessions.map((s) => `<li>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.title)}</a>` : esc(s.title)} <span class="quiet">${esc(s.state)}</span></li>`).join("") || `<li class="quiet">None running.</li>`)
      : `<li class="quiet">${esc(pc.cloud.reason ?? "Not visible yet.")}</li>`;
    root.innerHTML = `
      <div class="pc-totals" data-pc-totals>
        <b>${t.processes} processes</b> · ${t.sessions} sessions · ${mem(t.memBytes)} · ${cpu(t.cpu)}
        <div class="quiet">PC memory ${mem(pc.memory.usedBytes)} of ${mem(pc.memory.totalBytes)} · read ${new Date(pc.at).toTimeString().slice(0, 8)}</div>
      </div>
      <div class="go">${stopIdle}</div>
      <p class="hint" data-pc-result${result ? "" : " hidden"}>${esc(result)}</p>
      ${pc.groups.map(groupHtml).join("")}
      <section class="pc-cloud" data-pc-cloud><h2>Cloud sessions</h2><ul>${cloud}</ul></section>`;
  }

  async function refresh() { pc = await source.now(); draw(); }

  async function send(m: PcStop | PcStopIdle) {
    const p = problems(m);
    if (p.length) { console.warn("pcview: not sent", p); return; }
    opts.sent.push(m);
    const r = await source.send(m);
    result = r.refused ?? `Ended ${r.ended.length} process${r.ended.length === 1 ? "" : "es"}${r.ended.length ? ` (pid ${r.ended.join(", ")})` : ""}.`;
    ask = null;
    await refresh();
  }

  const find = (pid: number) => pc?.groups.flatMap((g) => g.items).find((i) => i.pid === pid);
  const stopOne = (it: PcItem, confirmSession: boolean) =>
    send({ v, kind: "pc-stop", by: "j", pid: it.pid, created: it.created, confirmSession });

  root.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const pid = Number(t.closest<HTMLElement>("[data-pc-item]")?.dataset.pcItem ?? t.closest<HTMLElement>("[data-stop-group]")?.dataset.stopGroup);
    const it = pid ? find(pid) : undefined;
    if (t.closest("[data-pc-stop], [data-stop-group]") && it) {
      if (it.kind === "session") { ask = { pid: it.pid }; draw(); } else void stopOne(it, false);
    } else if (t.closest("[data-pc-yes]") && it) void stopOne(it, true);
    else if (t.closest("[data-pc-no], [data-stop-idle-no]")) { ask = null; draw(); }
    else if (t.closest("[data-stop-idle]")) { ask = { idle: true }; draw(); }
    else if (t.closest("[data-stop-idle-yes]")) void send({ v, kind: "pc-stop-idle", by: "j", minutes: PC_IDLE_MINUTES });
  });
  // Keep what J folded across redraws.
  root.addEventListener("toggle", (e) => {
    const d = e.target as HTMLDetailsElement;
    const id = d.dataset?.pcGroup;
    if (id) { if (d.open) closed.delete(id); else closed.add(id); }
  }, true);

  const timer = opts.everyMs ? setInterval(() => { if (!ask) void refresh(); }, opts.everyMs) : null;
  return { refresh, stop: () => { if (timer) clearInterval(timer); } };
}
