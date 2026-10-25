/**
 * The messages between the Agents dock and the runner (the helper on J's PC,
 * or the cloud runner). Step 0 of the Agents panel: every other lane builds
 * against this file, so it holds only shapes and their checks, no I/O.
 *
 * Each message carries `v`, the contract version, and `kind`. A change that
 * old readers can ignore (a new optional field) keeps the version; a change
 * that alters what a field means raises CONTRACT_VERSION, and a reader
 * refuses a message newer than it knows.
 *
 * Plain unions and const lists, no enums: tests import this file straight
 * through node's type stripping.
 *
 *   dock -> runner   request, control, pc-stop, pc-stop-idle
 *   runner -> dock   plan, lane, merge, spend, pc, pc-stopped
 *
 * Version 2 added "Everything Claude is doing" (helper/pc): the `pc` snapshot
 * of every Claude process on the PC, and J's Stop for one process tree or for
 * everything idle.
 */

/**
 * 2 (2026-10-25, J: "no api, only plan usage and tokens"): every run is on
 * J's plan. Spend is tokens only, no dollars; a cloud lane's tokens are null
 * (not measured); a spend line may carry the plan-limit reading.
 */
export const CONTRACT_VERSION = 2;

export const TARGETS = ["site", "builder-ui", "backend"] as const;
export type Target = (typeof TARGETS)[number];

/** Right-click a part, Ask agents, then one of these (J's answer to Q9). */
export const PART_ACTIONS = ["change", "features", "security", "backend", "explain"] as const;
export type PartAction = (typeof PART_ACTIONS)[number];

/** A lane runs in the cloud by default, on the PC only when it needs the PC. */
export const WHERE = ["cloud", "pc"] as const;
export type Where = (typeof WHERE)[number];

/** The ring's 8 segments, in order. */
export const STEPS = ["brief", "red", "fix", "green", "push", "ci", "merge", "live"] as const;
export type Step = (typeof STEPS)[number];

export const STATES = ["working", "question", "only-you", "done", "paused"] as const;
export type State = (typeof STATES)[number];

export const SIZES = ["small", "medium", "large"] as const;
export type Size = (typeof SIZES)[number];

/** Steer and answer carry a line of text; the rest are a press. */
export const CONTROLS = ["steer", "answer", "approve", "decline", "pause", "resume", "stop"] as const;
export type ControlDo = (typeof CONTROLS)[number];

/**
 * Only J presses these, from inside the dock. The one exception: the runner
 * pauses every lane itself when spend reaches the cap (reason "spend-cap").
 * An agent never sends a control at all.
 */
export const J_ONLY: readonly ControlDo[] = ["pause", "resume", "stop", "approve", "decline"];

/**
 * Where J's plan is used: a `claude -p` run on the PC, or a cloud session
 * (which also counts toward the plan). There is no API-key way (J, v2).
 */
export const PAYS = ["plan", "cloud"] as const;
export type Pays = (typeof PAYS)[number];

export const MERGE_STATUS = ["waiting-ci", "stacked", "merged", "live", "checked", "check-failed"] as const;
export type MergeStatus = (typeof MERGE_STATUS)[number];

export type Chip =
  | { kind: "part"; id: string; name?: string }
  | { kind: "page"; id: string }
  | { kind: "shot"; ref: string };

export type Request = {
  v: number;
  kind: "request";
  id: string;
  text: string;
  target: Target;
  chips: Chip[];
  /** Set when the request came from a part's right-click menu. */
  action: PartAction | null;
  how: "plan-first" | "just-do-it";
};

export type PlanLane = {
  lane: string;
  where: Where;
  files: string[];
  /** The test this lane turns from red to green. */
  test: string;
  size: Size;
  /** Starts from that lane's branch and merges after it (two lanes, one file). */
  stackedOn: string | null;
};

export type Plan = {
  v: number;
  kind: "plan";
  requestId: string;
  lanes: PlanLane[];
  /** A lane adds a Builder control: it waits for J's yes. */
  newControl: boolean;
};

export type Lane = {
  v: number;
  kind: "lane";
  requestId: string;
  lane: string;
  where: Where;
  /** How many of STEPS are finished, 0 to 8. */
  stepsDone: number;
  /** The step under way, always STEPS[stepsDone]; null once all 8 are done. */
  stepNow: Step | null;
  etaSeconds: number | null;
  state: State;
  /** The one-line note on the row, or the question asked. */
  note: string;
};

export type Control = {
  v: number;
  kind: "control";
  lane: string;
  do: ControlDo;
  by: "j" | "runner";
  text?: string;
  reason?: "spend-cap";
};

export type MergeLine = {
  v: number;
  kind: "merge";
  lane: string;
  p: 1 | 2 | 3;
  generality: 1 | 2 | 3 | 4 | 5;
  status: MergeStatus;
  pr: number | null;
  /** What J will notice, first. */
  line: string;
  /** Live-check screenshots at 1440: before is the old live commit. */
  shots: { before: string; after: string } | null;
  /** Undo merge is offered (it opens a revert PR). */
  undo: boolean;
};

export type Tokens = { in: number; out: number };

/**
 * Spend is tokens, never dollars. A PC lane's tokens are counted from its
 * stream; a cloud session's can't be read, so they are null, and the dock
 * says "on your plan, not measured".
 */
export type LaneSpend = {
  lane: string;
  pays: Pays;
  tokens: Tokens | null;
  seconds: number;
};

/**
 * How much of J's plan limit is used, as Claude Code last reported it (its
 * rate-limit event). It is the whole account's, not one lane's.
 */
export type PlanUse = {
  /** 0 to 1. */
  used: number;
  /** When the limit window resets, Unix seconds, if it was said. */
  resetsAt: number | null;
  /** allowed, allowed_warning (near the limit) or rejected (at it). */
  status: "allowed" | "allowed_warning" | "rejected";
};

export type Spend = {
  v: number;
  kind: "spend";
  requestId: string;
  lanes: LaneSpend[];
  /** The request's tokens: the sum of its measured lanes'. */
  tokens: Tokens;
  /** The plan-limit reading, or null when Claude Code hasn't sent one. */
  plan: PlanUse | null;
};

// ---- everything Claude is doing on the PC (v2) ----------------------------

/** What a process is for, in the reader's words (helper/pc/label.ts). */
export const PC_KINDS = [
  "app", "session", "terminal-tab", "shell", "console", "dev-server", "browser",
  "build", "test", "git", "npm", "node", "labelled", "other",
] as const;
export type PcKind = (typeof PC_KINDS)[number];

/** How a session's claude.exe was tied to the app's session list. */
export const PC_MATCH = ["resume", "start-time", "label", "none"] as const;
export type PcMatch = (typeof PC_MATCH)[number];

export const PC_GROUPS = ["app", "terminal", "session", "left"] as const;
export type PcGroupKind = (typeof PC_GROUPS)[number];

/** A process shows "idle for N min" from this many minutes on. */
export const PC_IDLE_MINUTES = 10;

export type PcItem = {
  pid: number;
  /** Start time, ms since 1970. With pid it names one process, so a reused pid is never stopped. */
  created: number;
  parentPid: number;
  /** 0 for the group's root, 1 for its children, and so on. */
  depth: number;
  kind: PcKind;
  /** Plain words: "Builder copy for lane export, port 3091". */
  label: string;
  /** The process name and a short, key-blanked part of its command line. */
  detail: string;
  port: number | null;
  folder: string | null;
  /** Percent of the whole PC since the last read; null on the first read. */
  cpu: number | null;
  memBytes: number;
  idleMinutes: number | null;
  /** Who started it, in words: a session's title, "the Claude desktop app", "you". */
  startedBy: string;
  /** False for the desktop app itself: the panel never offers to end it. */
  stoppable: boolean;
};

export type PcGroup = {
  /** "app", "terminal", "left", or the session's id ("pid-<n>" when it isn't matched). */
  id: string;
  kind: PcGroupKind;
  title: string;
  folder: string | null;
  match: PcMatch | null;
  startedAt: number;
  idleMinutes: number | null;
  cpu: number | null;
  memBytes: number;
  items: PcItem[];
};

export type PcCloudSession = { id: string; title: string; url: string | null; state: string };

export type PcNow = {
  v: number;
  kind: "pc";
  at: number;
  memory: { usedBytes: number; totalBytes: number };
  totals: { processes: number; sessions: number; cpu: number | null; memBytes: number };
  groups: PcGroup[];
  /** Cloud sessions, where the runner can see them; otherwise why not. */
  cloud: { visible: boolean; reason: string | null; sessions: PcCloudSession[] };
};

/** J presses Stop on one item or one session: that process and its tree end. */
export type PcStop = {
  v: number;
  kind: "pc-stop";
  by: "j";
  pid: number;
  created: number;
  /** A session's own claude.exe ends only after J's second yes. */
  confirmSession: boolean;
};

/** J presses "Stop all idle": every idle item, never a session or the app. */
export type PcStopIdle = { v: number; kind: "pc-stop-idle"; by: "j"; minutes: number };

export type PcStopped = {
  v: number;
  kind: "pc-stopped";
  pid: number | null;
  /** The pids that ended. */
  ended: number[];
  /** Why nothing ended, in plain words; null when it worked. */
  refused: string | null;
  /** The press was a session's own claude.exe without the second yes. */
  needsConfirm: boolean;
};

export type Message = Request | Plan | Lane | Control | MergeLine | Spend | PcNow | PcStop | PcStopIdle | PcStopped;

// ---- checks -------------------------------------------------------------
// Each returns the problems it found, empty when the message is good, so a
// reader can log why it dropped a message instead of only that it did.

type Obj = Record<string, unknown>;
const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isStr = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const isCount = (x: unknown): x is number => Number.isInteger(x) && (x as number) >= 0;
const oneOf = <T extends string>(list: readonly T[], x: unknown): x is T => list.includes(x as T);

function tokenProblems(t: unknown, at: string): string[] {
  if (!isObj(t)) return [`${at}: tokens missing`];
  const out: string[] = [];
  if (!isCount(t.in)) out.push(`${at}: tokens.in must be a whole number`);
  if (!isCount(t.out)) out.push(`${at}: tokens.out must be a whole number`);
  return out;
}

function laneProblems(m: Obj): string[] {
  const out: string[] = [];
  if (!isStr(m.requestId)) out.push("requestId missing");
  if (!isStr(m.lane)) out.push("lane missing");
  if (!oneOf(WHERE, m.where)) out.push(`where must be one of ${WHERE.join(", ")}`);
  if (!oneOf(STATES, m.state)) out.push(`unknown state ${JSON.stringify(m.state)}`);
  if (typeof m.note !== "string") out.push("note missing");
  if (m.etaSeconds !== null && !isCount(m.etaSeconds)) out.push("etaSeconds must be seconds or null");
  if (!isCount(m.stepsDone) || m.stepsDone > STEPS.length) {
    out.push(`stepsDone must be 0 to ${STEPS.length}`);
    return out;
  }
  const expected = m.stepsDone === STEPS.length ? null : STEPS[m.stepsDone];
  if (m.stepNow !== expected) out.push(`stepNow must be ${JSON.stringify(expected)} after ${m.stepsDone} steps`);
  if ((m.state === "done") !== (m.stepsDone === STEPS.length)) out.push("done means all 8 steps, and all 8 steps means done");
  return out;
}

const isCpu = (x: unknown) => x === null || (typeof x === "number" && x >= 0);

function pcProblems(m: Obj): string[] {
  const out: string[] = [];
  if (!isCount(m.at)) out.push("at missing");
  if (!isObj(m.memory) || !isCount(m.memory.usedBytes) || !isCount(m.memory.totalBytes)) out.push("memory needs usedBytes and totalBytes");
  if (!isObj(m.totals) || !isCount(m.totals.processes) || !isCount(m.totals.sessions) || !isCount(m.totals.memBytes) || !isCpu(m.totals.cpu)) out.push("totals need processes, sessions, cpu and memBytes");
  if (!isObj(m.cloud) || typeof m.cloud.visible !== "boolean" || !Array.isArray(m.cloud.sessions)) out.push("cloud needs visible and sessions");
  else if (!m.cloud.visible && !isStr(m.cloud.reason)) out.push("cloud that isn't visible says why");
  if (!Array.isArray(m.groups)) return [...out, "groups must be a list"];
  const seen = new Set<number>();
  m.groups.forEach((g, i) => {
    const at = `groups[${i}]`;
    if (!isObj(g)) return void out.push(`${at} must be an object`);
    if (!isStr(g.id) || !isStr(g.title)) out.push(`${at}: id and title missing`);
    if (!oneOf(PC_GROUPS, g.kind)) out.push(`${at}: unknown group kind ${JSON.stringify(g.kind)}`);
    if (g.match !== null && !oneOf(PC_MATCH, g.match)) out.push(`${at}: unknown match`);
    if (!isCount(g.memBytes) || !isCpu(g.cpu)) out.push(`${at}: memBytes and cpu missing`);
    if (!Array.isArray(g.items)) return void out.push(`${at}: items must be a list`);
    let sum = 0;
    g.items.forEach((it, j) => {
      const iat = `${at}.items[${j}]`;
      if (!isObj(it)) return void out.push(`${iat} must be an object`);
      if (!isCount(it.pid) || !isCount(it.created) || !isCount(it.parentPid) || !isCount(it.depth)) out.push(`${iat}: pid, created, parentPid and depth must be whole numbers`);
      if (!oneOf(PC_KINDS, it.kind)) out.push(`${iat}: unknown kind ${JSON.stringify(it.kind)}`);
      if (!isStr(it.label) || !isStr(it.startedBy)) out.push(`${iat}: label and startedBy missing`);
      if (it.kind === "app" && it.stoppable !== false) out.push(`${iat}: the desktop app is never stoppable`);
      if (seen.has(it.pid as number)) out.push(`${iat}: pid ${it.pid} is listed twice`);
      seen.add(it.pid as number);
      sum += Number(it.memBytes) || 0;
    });
    if (isCount(g.memBytes) && g.memBytes !== sum) out.push(`${at}: memBytes must be the sum of its items'`);
  });
  return out;
}

function kindProblems(m: Obj): string[] {
  const out: string[] = [];
  switch (m.kind) {
    case "request": {
      if (!isStr(m.id)) out.push("id missing");
      if (!isStr(m.text)) out.push("text missing");
      if (!oneOf(TARGETS, m.target)) out.push(`target must be one of ${TARGETS.join(", ")}`);
      if (m.action !== null && !oneOf(PART_ACTIONS, m.action)) out.push(`unknown part action ${JSON.stringify(m.action)}`);
      if (m.how !== "plan-first" && m.how !== "just-do-it") out.push("how must be plan-first or just-do-it");
      if (!Array.isArray(m.chips)) out.push("chips must be a list");
      else m.chips.forEach((c, i) => {
        const ok = isObj(c) && ((c.kind === "part" && isStr(c.id)) || (c.kind === "page" && isStr(c.id)) || (c.kind === "shot" && isStr(c.ref)));
        if (!ok) out.push(`chips[${i}] must be a part or page with an id, or a shot with a ref`);
      });
      return out;
    }
    case "plan": {
      if (!isStr(m.requestId)) out.push("requestId missing");
      if (typeof m.newControl !== "boolean") out.push("newControl must be true or false");
      if (!Array.isArray(m.lanes) || m.lanes.length === 0) return [...out, "a plan needs at least one lane"];
      const names = m.lanes.map((l) => (isObj(l) ? l.lane : undefined));
      m.lanes.forEach((l, i) => {
        const at = `lanes[${i}]`;
        if (!isObj(l)) return void out.push(`${at} must be an object`);
        if (!isStr(l.lane)) out.push(`${at}: lane missing`);
        if (!oneOf(WHERE, l.where)) out.push(`${at}: where must be cloud or pc`);
        if (!Array.isArray(l.files) || !l.files.every(isStr)) out.push(`${at}: files must be a list of paths`);
        if (!isStr(l.test)) out.push(`${at}: test missing`);
        if (!oneOf(SIZES, l.size)) out.push(`${at}: size must be small, medium or large`);
        if (l.stackedOn !== null && (!names.includes(l.stackedOn) || l.stackedOn === l.lane)) out.push(`${at}: stackedOn must name another lane in the plan`);
      });
      return out;
    }
    case "lane":
      return laneProblems(m);
    case "control": {
      if (!isStr(m.lane)) out.push("lane missing");
      if (!oneOf(CONTROLS, m.do)) return [...out, `unknown control ${JSON.stringify(m.do)}`];
      if (m.by !== "j" && m.by !== "runner") out.push("by must be j or runner");
      if ((m.do === "steer" || m.do === "answer") && !isStr(m.text)) out.push(`${m.do} needs text`);
      const runnerMay = m.do === "pause" && m.reason === "spend-cap";
      if (m.by !== "j" && J_ONLY.includes(m.do) && !runnerMay) out.push(`${m.do} is J's only`);
      return out;
    }
    case "merge": {
      if (!isStr(m.lane)) out.push("lane missing");
      if (m.p !== 1 && m.p !== 2 && m.p !== 3) out.push("p must be 1, 2 or 3");
      if (!Number.isInteger(m.generality) || (m.generality as number) < 1 || (m.generality as number) > 5) out.push("generality must be 1 to 5");
      if (!oneOf(MERGE_STATUS, m.status)) out.push(`unknown merge status ${JSON.stringify(m.status)}`);
      if (m.pr !== null && !isCount(m.pr)) out.push("pr must be a number or null");
      if (!isStr(m.line)) out.push("line missing");
      if (m.shots !== null && !(isObj(m.shots) && isStr(m.shots.before) && isStr(m.shots.after))) out.push("shots must have before and after, or be null");
      if (typeof m.undo !== "boolean") out.push("undo must be true or false");
      return out;
    }
    case "spend": {
      if (!isStr(m.requestId)) out.push("requestId missing");
      out.push(...tokenProblems(m.tokens, "request"));
      if (!Array.isArray(m.lanes)) return [...out, "lanes must be a list"];
      let sumIn = 0, sumOut = 0;
      m.lanes.forEach((l, i) => {
        const at = `lanes[${i}]`;
        if (!isObj(l)) return void out.push(`${at} must be an object`);
        if (!isStr(l.lane)) out.push(`${at}: lane missing`);
        if (!oneOf(PAYS, l.pays)) out.push(`${at}: pays must be plan or cloud`);
        if (l.pays === "plan" || l.tokens !== null) out.push(...tokenProblems(l.tokens, at));
        if (!isCount(l.seconds)) out.push(`${at}: seconds missing`);
        if ("usd" in l || "planShare" in l) out.push(`${at}: spend is tokens only, no dollars`);
        if (isObj(l.tokens)) { sumIn += Number(l.tokens.in) || 0; sumOut += Number(l.tokens.out) || 0; }
      });
      if (isObj(m.tokens) && (m.tokens.in !== sumIn || m.tokens.out !== sumOut)) out.push("request tokens must be the sum of its lanes'");
      if ("usd" in m) out.push("spend is tokens only, no dollars");
      if (m.plan !== null) {
        const p = m.plan;
        const ok = isObj(p) && typeof p.used === "number" && p.used >= 0 && p.used <= 1
          && (p.resetsAt === null || isCount(p.resetsAt)) && ["allowed", "allowed_warning", "rejected"].includes(p.status as string);
        if (!ok) out.push("plan must be null, or used 0 to 1 with resetsAt and status");
      }
      return out;
    }
    case "pc":
      return pcProblems(m);
    case "pc-stop":
      if (m.by !== "j") out.push("pc-stop is J's only");
      if (!isCount(m.pid) || m.pid === 0) out.push("pid missing");
      if (!isCount(m.created)) out.push("created missing (it guards against a reused pid)");
      if (typeof m.confirmSession !== "boolean") out.push("confirmSession must be true or false");
      return out;
    case "pc-stop-idle":
      if (m.by !== "j") out.push("pc-stop-idle is J's only");
      if (!isCount(m.minutes) || m.minutes < 1) out.push("minutes must be 1 or more");
      return out;
    case "pc-stopped":
      if (m.pid !== null && !isCount(m.pid)) out.push("pid must be a number or null");
      if (!Array.isArray(m.ended) || !m.ended.every(isCount)) out.push("ended must be a list of pids");
      if (m.refused !== null && !isStr(m.refused)) out.push("refused must be words or null");
      if (typeof m.needsConfirm !== "boolean") out.push("needsConfirm must be true or false");
      return out;
    default:
      return [`unknown kind ${JSON.stringify(m.kind)}`];
  }
}

/** Every problem with a message; empty means it is good. */
export function problems(x: unknown): string[] {
  if (!isObj(x)) return ["a message is an object"];
  if (!Number.isInteger(x.v) || (x.v as number) < 1) return ["v, the contract version, missing"];
  if ((x.v as number) > CONTRACT_VERSION) return [`version ${x.v} is newer than this reader (${CONTRACT_VERSION})`];
  return kindProblems(x);
}

export const isMessage = (x: unknown): x is Message => problems(x).length === 0;

/** Reads one line off the wire; throws with the problems when it is bad. */
export function parse(line: string): Message {
  const x: unknown = JSON.parse(line);
  const p = problems(x);
  if (p.length) throw new Error(`bad message: ${p.join("; ")}`);
  return x as Message;
}
