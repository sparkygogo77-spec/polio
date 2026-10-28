/**
 * The queue: between the dock and the runner. A request goes to the lead,
 * the plan goes to the dock, and each lane is handed to the runner only
 * when it may run:
 *
 * - J said Start (a plan-first request, or one that adds a new control);
 * - every earlier lane it shares a file with has pushed: the new lane is
 *   then stacked on it (it starts from that branch and merges after it),
 *   never run side by side with it while it is still editing;
 * - no open lane in owners.json that is still pushing owns one of its
 *   files. An owner that pushed a while ago is idle (most likely queued for
 *   merge): the new lane stacks on its branch rather than waiting on a
 *   session that may never come back. A merged owner has given its files
 *   up, and a stale one (gone for days) is ignored;
 * - fewer than `atOnce` lanes are running (3 by default, 5 at most).
 *
 * A lane that stands for the lead's question to J waits in the "question"
 * state; J's answer goes back to the lead with the request, and the lanes
 * it then plans take the question's place.
 *
 * Once handed over, the runner's own rules apply: the 4 GB memory gate,
 * one build at a time, token counts and the token cap (no dollars: every
 * lane is on J's plan, and a cloud lane's tokens stay unmeasured, never
 * estimated here). Lanes start through the runner's adapters, which the
 * queue wraps only to give each lane its brief and its model, and through
 * the runner's workspace, which the queue tells the branch to start from.
 * The queue speaks the same calls the server uses (submit, control,
 * subscribe, snapshot, stopAll), and every message it sends passes the
 * contract's checks.
 */
import {
  CONTRACT_VERSION as v, STEPS, problems,
  type Control, type Lane, type Message, type Plan, type PlanLane, type Request, type State, type Where,
} from "../contract.ts";
import { MAX_AT_ONCE, Runner, type ControlResult, type RunnerOptions } from "../agents/runner.ts";
import type { Adapter } from "../agents/types.ts";
import { briefFor } from "./brief.ts";
import { lead, shares, type Ask, type LaneExtra, type LiveLane } from "./lead.ts";
import { busyOwners, type Owner, type Owners } from "./owners.ts";

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
  /** Made when the lane is handed over, since the start branch is known only then. */
  brief: string;
  /** The branch it started from, once handed. */
  from: string | null;
  /** What it came after (lanes here, owners' branches), once handed. */
  after: string[];
  stepsDone: number;
  note: string;
};

/** A lane that has pushed (its ring is at `ci`) may be stacked on. */
export const PUSHED = STEPS.indexOf("ci");

export type CoordinatorOptions = {
  /** The runner's options, less the plan and model (the queue gives those). */
  runner: Omit<RunnerOptions, "plan" | "model" | "atOnce" | "workspace"> & {
    /** Where a lane works; `from` is the branch it starts from. */
    workspace(lane: string, where: Where, from: string): Promise<string> | string;
  };
  ask: Ask;
  /** Read for every look at the queue, so a rebuilt owners.json counts at once. */
  owners: () => Owners;
  /** The text of handovers/lane-rules.md. */
  rules: () => string;
  /** The branch an unstacked lane starts from. */
  base: string;
  atOnce?: number;
  /** An owner whose tip is younger than this is still pushing: wait for it. */
  activeMs?: number;
  now?: () => number;
};

/** What a runner row says about a handed lane's end, if it ended. */
export function endOf(row: Lane): "done" | "failed" | "stopped" | null {
  if (row.state === "done") return "done";
  if (row.state === "only-you" && row.note.startsWith("ended at")) return "failed";
  if (row.state === "paused" && (row.note.startsWith("stopped by you") || row.note.startsWith("you said no"))) return "stopped";
  return null;
}

type Wait = { state: State; note: string };
type Go = { from: string; after: string[] };

export class Coordinator {
  readonly runner: Runner;
  readonly atOnce: number;
  private lanes = new Map<string, QLane>();
  private listeners = new Set<(m: Message) => void>();
  private seq = 0;
  private handing: Plan | null = null;
  private pumping = false;
  private again = false;
  private chain: Promise<unknown> = Promise.resolve();
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
      workspace: (lane, where) => opts.runner.workspace(lane, where, this.lanes.get(lane)?.from ?? opts.base),
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

  /** The brief a lane was started on (empty until it is handed over). */
  briefOf(lane: string): string | undefined { return this.lanes.get(lane)?.brief; }
  extraOf(lane: string): LaneExtra | undefined { return this.lanes.get(lane)?.extra; }
  /** The branch a handed lane started from. */
  startOf(lane: string): string | null { return this.lanes.get(lane)?.from ?? null; }

  /** The lanes the lead must plan around: held or running here now. */
  private live(): LiveLane[] {
    return [...this.lanes.values()].filter((q) => q.status === "held" || q.status === "handed")
      .map((q) => ({ lane: q.plan.lane, files: q.plan.files, requestId: q.req.id }));
  }

  /** A request from the dock: the lead plans it, the dock gets the plan, then the lanes queue. */
  submit(req: Request): Promise<Plan> {
    const p = problems(req);
    if (p.length || req.kind !== "request") return Promise.reject(new Error(`bad request: ${p.join("; ")}`));
    // One at a time, so two requests planned together can't be given one lane name.
    const run = this.chain.then(() => this.plan(req));
    this.chain = run.catch(() => {});
    return run;
  }

  private async plan(req: Request): Promise<Plan> {
    const owners = this.opts.owners();
    const taken = new Set([...this.lanes.keys(), ...owners.owners.map((o) => o.lane)]);
    const { plan, extra } = await lead(req, { ask: this.opts.ask, owners, taken, live: this.live() });
    for (const l of plan.lanes) if (!this.opts.runner.adapters[l.where]) throw new Error(`no ${l.where} runner is set up`);
    const approved = req.how === "just-do-it" && !plan.newControl;
    this.emit(plan);
    for (const l of plan.lanes) {
      const x = extra.get(l.lane)!;
      this.lanes.set(l.lane, {
        seq: this.seq++, req, plan: l, extra: x, status: "held", approved, paused: false, newControl: plan.newControl,
        brief: "", from: null, after: [], stepsDone: 0, note: "",
      });
    }
    this.pump();
    return plan;
  }

  /** Why a held lane can't be handed over yet, or where it may start from. */
  look(q: QLane, owners: Owners): Wait | Go {
    if (q.extra.question) return { state: "question", note: q.extra.question };
    if (q.paused) return { state: "paused", note: "paused by you" };
    if (!q.approved) return { state: "only-you", note: q.newControl ? "adds a new control: waiting for your yes" : "waiting for Start" };
    // Several things to stack on: start from the newest branch among them (a
    // lane here beats an owner's branch), and name them all in the brief.
    const after: string[] = [];
    let from = this.opts.base, best: [number, number] = [-1, -Infinity];
    const stackOn = (name: string, branch: string, rank: [number, number]) => {
      after.push(name);
      if (rank[0] > best[0] || (rank[0] === best[0] && rank[1] > best[1])) { from = branch; best = rank; }
    };
    for (const o of this.lanes.values()) {
      if (o === q || o.seq > q.seq || o.status === "stopped") continue;
      if (!q.extra.after.includes(o.plan.lane) && !shares(o.plan.files, q.plan.files)) continue;
      const common = q.plan.files.find((f) => shares(o.plan.files, [f]));
      const both = common ? ` (both touch ${common})` : "";
      if (o.status === "done") continue; // merged: its files are in the base
      if (o.status === "failed") return { state: "working", note: `stacked on ${o.plan.lane}: it ended early and needs you${both}` };
      if (o.status === "held" || o.stepsDone < PUSHED) return { state: "working", note: `stacked on ${o.plan.lane}: waits until it has pushed${both}` };
      stackOn(o.plan.lane, `claude/${o.plan.lane}`, [1, o.seq]);
    }
    const now = (this.opts.now ?? Date.now)();
    const activeMs = this.opts.activeMs ?? 2 * 3600_000;
    const seen = new Set<Owner>();
    for (const f of q.plan.files) {
      for (const o of busyOwners(owners, f, q.plan.lane)) {
        if (this.lanes.has(o.lane) || seen.has(o)) continue;
        seen.add(o);
        const pushed = Date.parse(o.pushedAt);
        if (Number.isFinite(pushed) && now - pushed < activeMs) return { state: "working", note: `waiting for ${o.lane}, which owns ${f} and is still pushing` };
        stackOn(o.lane, `origin/${o.branch}`, [0, Number.isFinite(pushed) ? pushed : -Infinity]);
      }
    }
    const running = [...this.lanes.values()].filter((o) => o.status === "handed").length;
    if (running >= this.atOnce) return { state: "working", note: `waiting its turn (${running} of ${this.atOnce} running)` };
    return { from, after };
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
          const look = this.look(q, owners);
          if ("state" in look) {
            if (look.note !== q.note) { q.note = look.note; this.emit(this.heldRow(q)); }
            continue;
          }
          this.hand(q, look);
        }
      } while (this.again);
    } finally { this.pumping = false; }
  }

  private hand(q: QLane, { from, after }: Go) {
    q.status = "handed";
    q.from = from;
    q.after = after;
    q.brief = briefFor({ req: q.req, lane: q.plan, rules: this.opts.rules(), from, after, model: q.extra.model });
    const stackedOn = after.at(-1) ?? null;
    this.handing = { v, kind: "plan", requestId: q.req.id, newControl: false, lanes: [{ ...q.plan, stackedOn: null }] };
    try { this.runner.submit({ ...q.req, how: "just-do-it" }); }
    catch (e) {
      q.status = "failed";
      q.note = `couldn't start: ${(e as Error).message}`;
      this.emit({ ...this.heldRow(q), state: "only-you", note: q.note });
    }
    finally { this.handing = null; }
    if (stackedOn && q.status === "handed") this.emit({ ...this.row(q), note: `stacked on ${stackedOn}: started from ${from}` });
  }

  private row(q: QLane): Lane {
    return { v, kind: "lane", requestId: q.req.id, lane: q.plan.lane, where: q.plan.where, stepsDone: 0, stepNow: "brief",
      etaSeconds: null, state: "working", note: q.note };
  }

  private heldRow(q: QLane): Lane {
    const look = this.look(q, this.opts.owners());
    const w: Wait = "state" in look ? look : { state: "working", note: q.note || "starting" };
    return { ...this.row(q), state: w.state, note: w.note };
  }

  private fromRunner(m: Message) {
    if (m.kind === "plan") return; // the queue sent the whole plan already
    for (const fn of this.listeners) fn(m);
    if (m.kind !== "lane") return;
    const q = this.lanes.get(m.lane);
    if (!q || q.status !== "handed") return;
    const was = q.stepsDone;
    q.stepsDone = m.stepsDone;
    const end = endOf(m);
    if (end) q.status = end;
    // Pushed, or ended: a lane stacked on this one may go.
    if (end || (was < PUSHED && m.stepsDone >= PUSHED)) this.pump();
  }

  /** J answered the lead's question: the lead plans again, with the answer. */
  private async answered(q: QLane, text: string): Promise<ControlResult> {
    const req: Request = { ...q.req, text: `${q.req.text}\n\nJ's answer to "${q.extra.question}": ${text}` };
    q.status = "stopped";
    this.emit({ ...this.row(q), state: "paused", note: `you said: ${text}` });
    try { await this.submit(req); return { ok: true }; }
    catch (e) { return { ok: false, error: (e as Error).message }; }
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
    const say = (state: State, note: string) => this.emit({ ...this.row(q), state, note });
    if (q.status === "failed") {
      if (c.do !== "stop") return { ok: false, error: `${c.lane} has ended` };
      q.status = "stopped";
      say("paused", "stopped by you; the branch is kept as it is");
      this.pump();
      return { ok: true };
    }
    if (q.extra.question) {
      if (c.do === "answer" || c.do === "steer") return this.answered(q, c.text!);
      if (c.do === "decline" || c.do === "stop") { q.status = "stopped"; say("paused", "you said no; nothing ran"); return { ok: true }; }
      return { ok: false, error: `${c.lane} is a question: answer it, or say no` };
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
