/**
 * The queue: between the dock and the runner. A request goes to the lead,
 * the plan goes to the dock, and each lane is handed to the runner only
 * when it may run:
 *
 * - J said Start (a plan-first request, or one that adds a new control);
 * - no earlier lane it shares a file with is still going (stacked lanes
 *   never run side by side);
 * - no open lane in owners.json owns one of its files (it waits; a lane
 *   that merged has given its files up);
 * - fewer than `atOnce` lanes are running (3 by default, 5 at most).
 *
 * Once handed over, the runner's own rules apply: the 4 GB memory gate,
 * one build at a time, spend and the cap. Lanes start through the runner's
 * adapters, which the queue wraps only to give each lane its brief and its
 * model. The queue speaks the same calls the server uses (submit, control,
 * subscribe, snapshot, stopAll), and every message it sends passes the
 * contract's checks.
 */
import {
  CONTRACT_VERSION as v, problems,
  type Control, type Lane, type Message, type Plan, type PlanLane, type Request, type State,
} from "../contract.ts";
import { MAX_AT_ONCE, Runner, type ControlResult, type RunnerOptions } from "../agents/runner.ts";
import type { Adapter } from "../agents/types.ts";
import { briefFor } from "./brief.ts";
import { lead, shares, type Ask, type LaneExtra } from "./lead.ts";
import { busyOwners, type Owners } from "./owners.ts";

type Status = "held" | "handed" | "done" | "failed" | "stopped";

type QLane = {
  seq: number;
  req: Request;
  plan: PlanLane;
  extra: LaneExtra;
  status: Status;
  approved: boolean;
  paused: boolean;
  newControl: boolean;
  brief: string;
  note: string;
};

export type CoordinatorOptions = {
  /** The runner's options, less the plan and model (the queue gives those). */
  runner: Omit<RunnerOptions, "plan" | "model" | "atOnce">;
  ask: Ask;
  /** Read fresh for every request, so a rebuilt owners.json counts at once. */
  owners: () => Owners;
  /** The text of handovers/lane-rules.md. */
  rules: () => string;
  /** The branch an unstacked lane starts from. */
  base: string;
  atOnce?: number;
};

/** What a runner row says about a handed lane's end, if it ended. */
export function endOf(row: Lane): "done" | "failed" | "stopped" | null {
  if (row.state === "done") return "done";
  if (row.state === "only-you" && row.note.startsWith("ended at")) return "failed";
  if (row.state === "paused" && (row.note.startsWith("stopped by you") || row.note.startsWith("you said no"))) return "stopped";
  return null;
}

export class Coordinator {
  readonly runner: Runner;
  readonly atOnce: number;
  private lanes = new Map<string, QLane>();
  private listeners = new Set<(m: Message) => void>();
  private seq = 0;
  private handing: Plan | null = null;
  private pumping = false;
  private again = false;
  private opts: CoordinatorOptions;

  constructor(opts: CoordinatorOptions) {
    this.opts = opts;
    this.atOnce = Math.max(1, Math.min(MAX_AT_ONCE, opts.atOnce ?? 3));
    const adapters: RunnerOptions["adapters"] = {};
    for (const [where, a] of Object.entries(opts.runner.adapters) as [keyof RunnerOptions["adapters"], Adapter | undefined][]) {
      if (a) adapters[where] = this.wrap(a);
    }
    this.runner = new Runner({
      ...opts.runner, adapters, atOnce: this.atOnce,
      plan: () => { if (!this.handing) throw new Error("requests go through the queue"); return this.handing; },
      model: (l) => this.lanes.get(l.lane)?.extra.model,
    });
    this.runner.subscribe((m) => this.fromRunner(m));
  }

  /** The runner's adapter, starting each lane on its brief and model. */
  private wrap(a: Adapter): Adapter {
    return { ...a, start: (spec) => {
      const q = this.lanes.get(spec.lane);
      return a.start(q ? { ...spec, prompt: q.brief, model: q.extra.model } : spec);
    } };
  }

  subscribe(fn: (m: Message) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(m: Message) {
    const p = problems(m);
    if (p.length) throw new Error(`queue made a bad ${m.kind} message: ${p.join("; ")}`);
    for (const fn of this.listeners) fn(m);
  }

  snapshot(): Message[] {
    const held = [...this.lanes.values()].filter((q) => q.status === "held").map((q) => this.heldRow(q));
    return [...this.runner.snapshot(), ...held];
  }

  /** The brief a lane was (or will be) started on. */
  briefOf(lane: string): string | undefined { return this.lanes.get(lane)?.brief; }
  extraOf(lane: string): LaneExtra | undefined { return this.lanes.get(lane)?.extra; }

  /** A request from the dock: the lead plans it, the dock gets the plan, then the lanes queue. */
  async submit(req: Request): Promise<Plan> {
    const p = problems(req);
    if (p.length || req.kind !== "request") throw new Error(`bad request: ${p.join("; ")}`);
    const owners = this.opts.owners();
    const taken = new Set([...this.lanes.keys(), ...owners.owners.map((o) => o.lane)]);
    const { plan, extra } = await lead(req, { ask: this.opts.ask, owners, taken });
    for (const l of plan.lanes) if (!this.opts.runner.adapters[l.where]) throw new Error(`no ${l.where} runner is set up`);
    const rules = this.opts.rules();
    const approved = req.how === "just-do-it" && !plan.newControl;
    this.emit(plan);
    for (const l of plan.lanes) {
      const x = extra.get(l.lane)!;
      this.lanes.set(l.lane, {
        seq: this.seq++, req, plan: l, extra: x, status: "held", approved, paused: false, newControl: plan.newControl,
        brief: briefFor({ req, lane: l, rules, base: this.opts.base, after: x.after, model: x.model }), note: "",
      });
    }
    this.pump();
    return plan;
  }

  /** Why a held lane can't be handed over yet, or null when it can. */
  waitingFor(q: QLane, owners: Owners): { state: State; note: string } | null {
    if (q.paused) return { state: "paused", note: "paused by you" };
    if (!q.approved) return { state: "only-you", note: q.newControl ? "adds a new control: waiting for your yes" : "waiting for Start" };
    for (const o of this.lanes.values()) {
      if (o === q || o.seq > q.seq || o.status === "done" || o.status === "stopped") continue;
      if (!q.extra.after.includes(o.plan.lane) && !shares(o.plan.files, q.plan.files)) continue;
      if (o.status === "failed") return { state: "working", note: `stacked on ${o.plan.lane}: it ended early and needs you` };
      const common = q.plan.files.find((f) => shares(o.plan.files, [f]));
      return { state: "working", note: `stacked on ${o.plan.lane}: waits for it to finish${common ? ` (both touch ${common})` : ""}` };
    }
    for (const f of q.plan.files) {
      const busy = busyOwners(owners, f, q.plan.lane).filter((o) => !this.lanes.has(o.lane));
      if (busy.length) return { state: "working", note: `waiting for ${busy[0]!.lane}, which owns ${f} and hasn't merged` };
    }
    const running = [...this.lanes.values()].filter((o) => o.status === "handed").length;
    if (running >= this.atOnce) return { state: "working", note: `waiting its turn (${running} of ${this.atOnce} running)` };
    return null;
  }

  /** Hands every lane that may run to the runner, oldest first. */
  pump() {
    if (this.pumping) { this.again = true; return; }
    this.pumping = true;
    try {
      do {
        this.again = false;
        const owners = this.opts.owners();
        for (const q of [...this.lanes.values()].sort((a, b) => a.seq - b.seq)) {
          if (q.status !== "held") continue;
          const wait = this.waitingFor(q, owners);
          if (wait) {
            if (wait.note !== q.note) { q.note = wait.note; this.emit(this.heldRow(q)); }
            continue;
          }
          this.hand(q);
        }
      } while (this.again);
    } finally { this.pumping = false; }
  }

  private hand(q: QLane) {
    q.status = "handed";
    this.handing = { v, kind: "plan", requestId: q.req.id, newControl: false, lanes: [{ ...q.plan, stackedOn: null }] };
    try { this.runner.submit({ ...q.req, how: "just-do-it" }); }
    catch (e) {
      q.status = "failed";
      q.note = `couldn't start: ${(e as Error).message}`;
      this.emit({ ...this.heldRow(q), state: "only-you", note: q.note });
    }
    finally { this.handing = null; }
  }

  private heldRow(q: QLane): Lane {
    const w = this.waitingFor(q, this.opts.owners()) ?? { state: "working" as State, note: q.note || "starting" };
    return { v, kind: "lane", requestId: q.req.id, lane: q.plan.lane, where: q.plan.where, stepsDone: 0, stepNow: "brief",
      etaSeconds: null, state: w.state, note: w.note };
  }

  private fromRunner(m: Message) {
    if (m.kind === "plan") return; // the queue sent the whole plan already
    for (const fn of this.listeners) fn(m);
    if (m.kind !== "lane") return;
    const q = this.lanes.get(m.lane);
    const end = endOf(m);
    if (!q || q.status !== "handed" || !end) return;
    q.status = end;
    this.pump();
  }

  /** J's controls: the queue answers for lanes it still holds, the runner for the rest. */
  async control(c: Control): Promise<ControlResult> {
    const p = problems(c);
    if (p.length || c.kind !== "control") return { ok: false, error: p.join("; ") || "not a control" };
    if (c.by !== "j") return { ok: false, error: "only J's controls are taken from the dock" };
    const q = this.lanes.get(c.lane);
    if (!q || q.status === "handed") {
      // A stop shows on the runner's row, which frees the lane's files (fromRunner).
      return this.runner.control(c);
    }
    if (q.status === "done" || q.status === "stopped") return { ok: false, error: `${c.lane} has ended` };
    const say = (state: State, note: string) => this.emit({ ...this.heldRow(q), state, note });
    if (q.status === "failed") {
      if (c.do !== "stop") return { ok: false, error: `${c.lane} has ended` };
      q.status = "stopped";
      say("paused", "stopped by you; the branch is kept as it is");
      this.pump();
      return { ok: true };
    }
    switch (c.do) {
      case "approve":
        if (q.approved) return { ok: false, error: `${c.lane} isn't waiting for you` };
        q.approved = true;
        break;
      case "decline":
      case "stop":
        q.status = "stopped";
        say("paused", c.do === "decline" ? "you said no; nothing ran" : "stopped by you; nothing ran");
        this.pump();
        return { ok: true };
      case "pause":
        q.paused = true;
        break;
      case "resume":
        if (!q.paused) return { ok: false, error: `${c.lane} isn't paused` };
        q.paused = false;
        break;
      case "steer":
      case "answer":
        return { ok: false, error: `${c.lane} isn't running yet` };
    }
    q.note = ""; // the pump sends the row again, with why it still waits (if it does)
    this.pump();
    return { ok: true };
  }

  /** The owners map changed (rebuilt from handovers and git): look again. */
  ownersChanged() { this.pump(); }

  async stopAll() { await this.runner.stopAll(); }
}
