/**
 * The runner: takes requests and J's controls from the dock (through the
 * loopback server), runs each lane on its adapter, and says what happens as
 * contract messages (plan, lane rows, spend). Every message it sends passes
 * the contract's checks first.
 *
 * Bookkeeping here is plain code, as the proposal's section 3 asks:
 * - how many at once: 3 by default, never more than 5 (J's limit);
 * - the memory gate: a PC lane doesn't start below 4 GB free, and its row
 *   says "waiting for memory" until it can;
 * - one big build at a time: the build lock (build-lock.ts), taken by the
 *   hold hook around build commands, given back here when a lane ends;
 * - spend per lane, and every lane paused (by "runner", reason
 *   "spend-cap") when a cap is reached.
 *
 * The lead (splitting a request into lanes) belongs to lead-and-queue; until
 * then a request runs as one lane, on the PC for a site request, in the
 * cloud otherwise (J's answer 1).
 */
import { join } from "node:path";
import { rmSync } from "node:fs";
import {
  CONTRACT_VERSION as v, STEPS, problems,
  type Control, type Lane, type Message, type Plan, type PlanLane, type Request, type State, type Where,
} from "../contract.ts";
import { giveBuildLock } from "./build-lock.ts";
import { laneEnv } from "./env.ts";
import { Gate } from "./gate.ts";
import { memoryGate, type MemoryGate } from "./memory.ts";
import { SpendBook } from "./spend.ts";
import type { Adapter, AgentRun } from "./types.ts";
import { LANE_NAME, PortPool } from "./worktree.ts";

export const MAX_AT_ONCE = 5;

type Status = "waiting-start" | "queued" | "running" | "ended" | "stopped";

type LaneRec = {
  requestId: string;
  plan: PlanLane;
  adapter: Adapter;
  prompt: string;
  status: Status;
  state: State;
  stepsDone: number;
  note: string;
  gate: Gate;
  run: AgentRun | null;
  sessionId: string | null;
};

export type RunnerOptions = {
  adapters: { pc?: Adapter; cloud?: Adapter };
  /** Lane hook files and the build lock; outside every worktree. */
  stateDir: string;
  spend: SpendBook;
  memory?: MemoryGate;
  atOnce?: number;
  /** Where a lane works: a fresh worktree on the PC, the repo for a cloud lane. */
  workspace(lane: string, where: Where): Promise<string> | string;
  ports?: PortPool;
  baseEnv?: NodeJS.ProcessEnv;
  apiKey?: () => string;
  plan?: (r: Request) => Plan;
  /** How often a lane waiting for memory looks again. */
  memoryPollMs?: number;
  model?: (lane: PlanLane) => string | undefined;
};

export type ControlResult = { ok: true } | { ok: false; error: string };

export function defaultPlan(r: Request): Plan {
  const slug = r.text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32).replace(/-+$/, "") || "lane";
  const lane = LANE_NAME.test(slug) ? slug : `lane-${r.id.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8)}`;
  const where: Where = r.target === "site" ? "pc" : "cloud";
  return { v, kind: "plan", requestId: r.id, newControl: false,
    lanes: [{ lane, where, files: [], test: `tests/${lane}.mjs`, size: "medium", stackedOn: null }] };
}

export class Runner {
  private lanes = new Map<string, LaneRec>();
  private listeners = new Set<(m: Message) => void>();
  private ports: PortPool;
  private memory: MemoryGate;
  private atOnce: number;
  private capped = false;
  private retry: NodeJS.Timeout | null = null;

  readonly opts: RunnerOptions;
  constructor(opts: RunnerOptions) {
    this.opts = opts;
    this.ports = opts.ports ?? new PortPool();
    this.memory = opts.memory ?? memoryGate();
    this.atOnce = Math.max(1, Math.min(MAX_AT_ONCE, opts.atOnce ?? 3));
  }

  subscribe(fn: (m: Message) => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** The rows as they stand, for a dock that just connected. */
  snapshot(): Message[] {
    const out: Message[] = [...this.lanes.keys()].map((l) => this.row(l));
    for (const id of new Set([...this.lanes.values()].map((r) => r.requestId))) out.push(this.opts.spend.message(id));
    return out;
  }

  private emit(m: Message) {
    const p = problems(m);
    if (p.length) throw new Error(`runner made a bad ${m.kind} message: ${p.join("; ")}`);
    for (const fn of this.listeners) fn(m);
  }

  private row(lane: string): Lane {
    const r = this.lanes.get(lane)!;
    const stepNow = r.stepsDone >= STEPS.length ? null : STEPS[r.stepsDone]!;
    return { v, kind: "lane", requestId: r.requestId, lane, where: r.plan.where, stepsDone: r.stepsDone, stepNow,
      etaSeconds: null, state: r.state, note: r.note };
  }

  private update(lane: string, change: Partial<Pick<LaneRec, "state" | "note" | "stepsDone" | "status">>) {
    const r = this.lanes.get(lane);
    if (!r) return;
    Object.assign(r, change);
    this.emit(this.row(lane));
  }

  /** A request from the dock: its plan, then its lanes (now, or after Start). */
  submit(req: Request): Plan {
    const p = problems(req);
    if (p.length || req.kind !== "request") throw new Error(`bad request: ${p.join("; ")}`);
    const plan = (this.opts.plan ?? defaultPlan)(req);
    for (const l of plan.lanes) {
      if (this.lanes.has(l.lane)) throw new Error(`lane ${l.lane} is already in use`);
      if (!LANE_NAME.test(l.lane)) throw new Error(`lane name ${l.lane} isn't plain`);
      const adapter = this.opts.adapters[l.where];
      if (!adapter) throw new Error(`no ${l.where} runner is set up`);
    }
    this.emit(plan);
    const startNow = req.how === "just-do-it" && !plan.newControl;
    for (const l of plan.lanes) {
      this.lanes.set(l.lane, {
        requestId: req.id, plan: l, adapter: this.opts.adapters[l.where]!, prompt: promptFor(req, l),
        status: startNow ? "queued" : "waiting-start", state: startNow ? "working" : "only-you", stepsDone: 0,
        note: startNow ? "waiting its turn" : plan.newControl ? "adds a new control: waiting for your yes" : "waiting for Start",
        gate: new Gate(join(this.opts.stateDir, "gates", l.lane)), run: null, sessionId: null,
      });
      this.opts.spend.open(req.id, l.lane, this.opts.adapters[l.where]!.pays, this.opts.adapters[l.where]!.can.tokens);
      this.emit(this.row(l.lane));
    }
    this.pump();
    return plan;
  }

  private active() { return [...this.lanes.values()].filter((r) => r.status === "running").length; }

  private pump() {
    for (const [lane, r] of this.lanes) {
      if (this.active() >= this.atOnce) return;
      if (r.status !== "queued" || r.state === "paused") continue;
      if (r.plan.where === "pc" && !this.memory.ok()) {
        if (r.note !== "waiting for memory") this.update(lane, { note: "waiting for memory" });
        this.retry ??= setTimeout(() => { this.retry = null; this.pump(); }, this.opts.memoryPollMs ?? 5000);
        return;
      }
      r.status = "running";
      void this.drive(lane).catch((e) => this.finish(lane, false, String(e?.message ?? e)));
    }
  }

  private async drive(lane: string) {
    const r = this.lanes.get(lane)!;
    const port = this.ports.take(lane);
    const cwd = await this.opts.workspace(lane, r.plan.where);
    const pays = r.adapter.pays;
    const env = laneEnv(this.opts.baseEnv ?? process.env, { port, pays, apiKey: pays === "api" ? this.opts.apiKey?.() : undefined });
    this.update(lane, { state: "working", note: "starting" });
    r.run = r.adapter.start({
      requestId: r.requestId, lane, prompt: r.prompt, cwd, port, env, gate: r.gate,
      stateDir: this.opts.stateDir, model: this.opts.model?.(r.plan), resume: r.sessionId ?? undefined,
    });
    this.opts.spend.running(lane, true);
    for await (const e of r.run.events) {
      if (r.status === "stopped") break;
      switch (e.type) {
        case "started":
          r.sessionId = e.sessionId;
          break;
        case "step": {
          const at = STEPS.indexOf(e.step);
          this.update(lane, { stepsDone: Math.max(r.stepsDone, at), note: e.note || e.step,
            ...(r.state === "paused" ? {} : { state: "working" as State }) });
          break;
        }
        case "note":
          this.update(lane, { note: e.note });
          break;
        case "question":
          this.update(lane, { state: "question", note: e.text });
          break;
        case "usage":
          this.opts.spend.add(lane, e.tokens, e.usd);
          this.emit(this.opts.spend.message(r.requestId));
          this.checkCap();
          break;
        case "idle":
          // The turn ended. All 8 done: the lane is done. A question: wait for
          // J. Anything else: the agent stopped early and waits for a line.
          if (r.stepsDone >= STEPS.length - 1 && r.state !== "question") {
            await r.run.stop();
            return this.finish(lane, true, "live and checked");
          }
          if (r.state !== "question" && r.state !== "paused") this.update(lane, { state: "question", note: `stopped at ${STEPS[r.stepsDone]}: waiting for a line from you` });
          break;
        case "ended":
          return this.finish(lane, e.ok, e.reason);
      }
    }
  }

  /** The lane ended: give back its port and build lock, then start the next. */
  private finish(lane: string, ok: boolean, reason: string) {
    const r = this.lanes.get(lane);
    if (!r || r.status === "ended") return;
    this.opts.spend.running(lane, false);
    this.ports.give(lane);
    giveBuildLock(this.opts.stateDir, lane);
    if (r.status !== "stopped") {
      const all = ok && r.stepsDone >= STEPS.length - 1;
      r.status = "ended";
      this.update(lane, all ? { stepsDone: STEPS.length, state: "done", note: reason } : { state: "only-you", note: `ended at ${STEPS[r.stepsDone]}: ${reason}` });
    }
    this.emit(this.opts.spend.message(r.requestId));
    this.pump();
  }

  /** A cloud lane says it is done from outside (its PR merged and checked). */
  markDone(lane: string, note = "live and checked") {
    const r = this.lanes.get(lane);
    if (!r) return;
    r.stepsDone = STEPS.length - 1;
    this.finish(lane, true, note);
  }

  private checkCap() {
    const why = this.opts.spend.overCap();
    if (!why || this.capped) return;
    this.capped = true;
    for (const [lane, r] of this.lanes) {
      if (r.status !== "running" && r.status !== "queued") continue;
      if (!r.adapter.can.pause) continue;
      const c: Control = { v, kind: "control", lane, do: "pause", by: "runner", reason: "spend-cap" };
      this.emit(c);
      this.pauseLane(lane, why);
    }
  }

  /** Raising the cap is J's click in the dock; this lets lanes resume. */
  clearCap() { this.capped = false; }

  private pauseLane(lane: string, note: string) {
    const r = this.lanes.get(lane)!;
    r.gate.pause();
    this.opts.spend.running(lane, false);
    this.update(lane, { state: "paused", note });
  }

  /**
   * A control. The server lets only the paired dock send one, and only as
   * J; this checks it again against the contract (J-only controls) and
   * against what the lane's adapter can do.
   */
  async control(c: Control): Promise<ControlResult> {
    const p = problems(c);
    if (p.length || c.kind !== "control") return { ok: false, error: p.join("; ") || "not a control" };
    if (c.by !== "j") return { ok: false, error: "only J's controls are taken from the dock" };
    const r = this.lanes.get(c.lane);
    if (!r) return { ok: false, error: `no lane ${c.lane}` };
    if (r.status === "stopped" || r.status === "ended") return { ok: false, error: `${c.lane} has ended` };
    const lane = c.lane;
    switch (c.do) {
      case "pause":
        if (!r.adapter.can.pause) return { ok: false, error: r.adapter.limits ?? "this lane can't be paused" };
        if (r.state === "paused") return { ok: true };
        this.pauseLane(lane, "paused by you");
        return { ok: true };
      case "resume":
        if (r.state !== "paused") return { ok: false, error: `${lane} isn't paused` };
        if (this.capped && this.opts.spend.overCap()) return { ok: false, error: "spend is still over the cap: raise it first" };
        r.gate.resume();
        if (r.status === "running") this.opts.spend.running(lane, true);
        // Pause held the next tool call without ending the turn, so letting
        // the hold go is all Resume needs: nothing is sent to the agent.
        this.update(lane, { state: "working", note: "carrying on" });
        this.pump();
        return { ok: true };
      case "stop": {
        if (r.status === "running" && !r.adapter.can.stop) return { ok: false, error: r.adapter.limits ?? "this lane can't be stopped here" };
        r.gate.stop();
        const was = r.status;
        r.status = "stopped";
        if (was === "running") await r.run?.stop();
        // The contract has no "stopped" state yet: the row reads paused, and
        // the runner refuses Resume on it (agents-runner.md, contract gaps).
        this.update(lane, { state: "paused", note: "stopped by you; the branch is kept as it is" });
        this.opts.spend.running(lane, false);
        this.ports.give(lane);
        giveBuildLock(this.opts.stateDir, lane);
        this.pump();
        return { ok: true };
      }
      case "steer":
      case "answer":
        if (r.status !== "running" || !r.run) return { ok: false, error: `${lane} isn't running yet` };
        await r.run.steer(c.text!);
        if (r.state === "question") this.update(lane, { state: "working", note: `you said: ${c.text}` });
        return { ok: true };
      case "approve":
        if (r.status === "waiting-start") { r.status = "queued"; this.update(lane, { state: "working", note: "waiting its turn" }); this.pump(); return { ok: true }; }
        if (r.state !== "only-you" || !r.run) return { ok: false, error: `${lane} isn't waiting for you` };
        await r.run.steer("J approved. Go ahead.");
        this.update(lane, { state: "working", note: "approved by you" });
        return { ok: true };
      case "decline":
        if (r.status === "waiting-start") {
          r.status = "stopped";
          this.update(lane, { state: "paused", note: "you said no; nothing ran" });
          return { ok: true };
        }
        if (r.state !== "only-you" || !r.run) return { ok: false, error: `${lane} isn't waiting for you` };
        await r.run.steer("J said no. Don't do that; carry on without it, or stop if you can't.");
        this.update(lane, { state: "working", note: "you said no" });
        return { ok: true };
    }
  }

  /** Stops every lane the runner started (helper quitting). */
  async stopAll() {
    if (this.retry) clearTimeout(this.retry);
    await Promise.all([...this.lanes.entries()].filter(([, r]) => r.status === "running" && r.adapter.can.stop).map(async ([lane, r]) => {
      r.gate.stop(); r.status = "stopped"; await r.run?.stop(); this.ports.give(lane); giveBuildLock(this.opts.stateDir, lane);
    }));
  }

  /** Forgets a lane's gate files (after it ended and J closed it). */
  forget(lane: string) {
    const r = this.lanes.get(lane);
    if (!r || r.status === "running") return;
    rmSync(r.gate.dir, { recursive: true, force: true });
    this.lanes.delete(lane);
  }
}

function promptFor(req: Request, l: PlanLane): string {
  const chips = req.chips.length ? `\nGoes with it: ${JSON.stringify(req.chips)}` : "";
  const action = req.action ? `\nPart action: ${req.action}` : "";
  return [
    `Lane ${l.lane} (${l.size}), for ${req.target}.`,
    `J asked: ${req.text}${action}${chips}`,
    l.files.length ? `Your files: ${l.files.join(", ")}. Touch nothing else.` : "",
    `Turn ${l.test} from red to green. Read handovers/lane-rules.md first.`,
  ].filter(Boolean).join("\n");
}
