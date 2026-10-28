/**
 * What every adapter gives the runner. An adapter runs one lane's agent
 * somewhere (the PC or the cloud) and turns what it says into AgentEvents;
 * the runner turns those into contract messages for the dock.
 */
import type { Pays, PlanUse, Step, Tokens, Where } from "../contract.ts";
import type { Gate } from "./gate.ts";

export type AgentEvent =
  | { type: "started"; sessionId: string | null; url?: string }
  | { type: "step"; step: Step; note: string }
  | { type: "note"; note: string }
  | { type: "question"; text: string }
  /** Counted since the last usage event: add, don't replace. */
  | { type: "usage"; tokens: Tokens }
  /** Claude Code's plan-limit reading (a rate_limit_event), for the whole account. */
  | { type: "plan"; plan: PlanUse }
  /** The turn finished and the agent waits for a message (steer or answer). */
  | { type: "idle" }
  | { type: "ended"; ok: boolean; reason: string };

export type LaneSpec = {
  requestId: string;
  lane: string;
  prompt: string;
  cwd: string;
  /** The lane's own port for a dev server (3100 to 3199). */
  port: number;
  /** Already cleaned by the runner: no helper token or port in it. */
  env: NodeJS.ProcessEnv;
  gate: Gate;
  /** Where the lane's hook files and build lock live (outside the worktree). */
  stateDir: string;
  model?: string;
  /** Carry on a saved session instead of starting fresh. */
  resume?: string;
};

export type AgentRun = {
  events: AsyncIterable<AgentEvent>;
  /** A line from J into the same session; queues until the turn ends. */
  steer(text: string): Promise<void>;
  /** Ends the agent and the process tree started for it, and nothing else. */
  stop(): Promise<void>;
};

export type Adapter = {
  where: Where;
  pays: Pays;
  /** What this adapter can do; the runner refuses the rest with a reason. */
  can: { pause: boolean; stop: boolean; tokens: boolean };
  /** Why something in `can` is false, said to J on the row. */
  limits?: string;
  start(spec: LaneSpec): AgentRun;
};
