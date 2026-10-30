/**
 * Starts Polio Helper: the loopback server on 127.0.0.1:47821, the
 * coordinator's queue, and the runner behind it.
 *
 *   node helper/server/main.ts [--repo <polio clone>] [--handovers <Pleo/handovers>]
 *        [--agents <folder for lane worktrees>] [--claude <path to claude.exe>]
 *        [--at-once 3] [--tokens-per-day N] [--tokens-per-request N]
 *        [--port 47821] [--state <state folder>]   (a test helper: another port and folder)
 *
 * - Every run is on J's plan: the unmodified `claude` CLI under his own
 *   sign-in, on the PC or as a cloud session. There is no API-key way. The
 *   lead's planning call is the same CLI, with read-only tools.
 * - A request goes to the lead, then its lanes through the queue
 *   (helper/coordinator/queue.ts): stacking, owners, J's yes, 3 at once.
 * - Lanes on the PC get worktrees under --agents (default Pleo/agents, next
 *   to --repo), each from the branch the queue says (the base, or the one it
 *   is stacked on).
 * - handovers/owners.json is rebuilt at start, every 15 minutes, and when a
 *   lane ends, in a child process so the server keeps answering.
 * - Caps are in tokens. Leave one out for no cap of that kind.
 * - After a lane's CI is green (its row is past `ci`), `afterGreen` takes
 *   the live board's "before" reading, calls mergeStep (helper/merge), and
 *   once the branch is in the base, liveCheck (helper/livecheck). Both
 *   results go to the dock as merge lines. A merge that waits for J goes on
 *   when he presses Approve on that lane.
 * - The tray (helper/install/tray.ps1) runs this with its stdin and stdout
 *   piped: it reads `@pair <code>` and `@ready <port>`, and writes
 *   `pause-all`, `resume-all` and `quit` (with --tray, the helper also quits
 *   when the tray's pipe closes).
 * - A PC lane gets the site tools (helper/mcp/site.ts, through --mcp-config)
 *   and its own lane ticket, so it can read and change the site J has open,
 *   through the paired dock only (POST /site, tickets.ts).
 * - Every child process starts hidden (windowsHide), so no console window
 *   flashes on J's screen.
 * - Ctrl+C, `quit` or the tray's Quit stops every lane the helper started,
 *   and nothing else.
 */
import { execFile, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { CONTRACT_VERSION as v, STEPS, type Control, type Lane, type MergeLine, type Message } from "../contract.ts";
import { cloudAdapter } from "../agents/cloud.ts";
import { pcPlanAdapter } from "../agents/pc.ts";
import { SpendBook } from "../agents/spend.ts";
import { addWorktree } from "../agents/worktree.ts";
import { branchPushed } from "../agents/pushed.ts";
import { claudeAsk } from "../coordinator/ask.ts";
import { loadRules } from "../coordinator/brief.ts";
import { OWNERS_FILE, ownersReader } from "../coordinator/owners.ts";
import { Coordinator, endOf } from "../coordinator/queue.ts";
import { liveCheck, stillReading, type LiveDeps, type LiveJob } from "../livecheck/check.ts";
import type { Reading } from "../livecheck/compare.ts";
import { BASE } from "../merge/github.ts";
import { mergeStep, type MergeJob, type MergeStep } from "../merge/route.ts";
import { readGithubToken } from "../merge/token.ts";
import { Pairing } from "./pairing.ts";
import { startHelperServer, HELPER_PORT, type RunnerLike } from "./server.ts";
import { SiteTickets, siteMcpConfig, withSiteTickets } from "./tickets.ts";

// ---- after green: merge, then the live check ---------------------------------

/** What a lane's branch says about itself: git for the commit and files, its PR body for the rest. */
export type LaneFacts = Omit<MergeJob, "ours" | "onlyYou">;

/** The live board in a fresh browser: opened for one reading, closed again. */
export type LiveBrowser = { deps: Omit<LiveDeps, "ownCheck">; close: () => Promise<void> };

export type GreenDeps = {
  /** True only for a lane this helper's runner started (its own records, never the branch name). */
  ours: (lane: string) => boolean;
  onlyYou: (lane: string) => boolean;
  facts: (lane: string) => Promise<LaneFacts | null>;
  token: () => Promise<string | null>;
  github?: Parameters<typeof mergeStep>[1]["github"];
  /** Null when no browser can be started (the live check is then skipped, and says so). */
  browser: () => Promise<LiveBrowser | null>;
  /** Resolves with the base commit that holds `commit`, or null if it never lands. */
  landed: (f: LaneFacts) => Promise<string | null>;
  send: (m: MergeLine) => void;
  merge?: typeof mergeStep;
  check?: typeof liveCheck;
};

type Before = { reading: Reading; shot: string | null } | null;

async function readBefore(d: GreenDeps, lane: string): Promise<Before> {
  const b = await d.browser().catch(() => null);
  if (!b) return null;
  try { return { reading: await stillReading(b.deps), shot: await b.deps.shoot(`${lane}-before`).catch(() => null) }; }
  catch { return null; }
  finally { await b.close().catch(() => {}); }
}

/**
 * One green lane: the before reading, mergeStep, and (once merged) liveCheck.
 * Answers the merge step, so a lane that waits for J can be run again with
 * `approved` once he presses Approve.
 */
export async function afterGreen(lane: string, d: GreenDeps, approved = false): Promise<MergeStep | null> {
  const f = await d.facts(lane);
  if (!f) return null;
  const job: MergeJob = { ...f, ours: d.ours(lane) === true, onlyYou: d.onlyYou(lane) };
  const before = await readBefore(d, lane); // on the old live commit, before anything merges
  const step = await (d.merge ?? mergeStep)(job, { token: await d.token().catch(() => null), approved, github: d.github });
  d.send(step.line);
  if (step.waitsFor) return step;

  const sha = await d.landed(f);
  if (!sha) return step;
  const pr = step.line.pr;
  const lj: LiveJob = { lane, p: f.p, generality: f.generality, pr, sha, fixes: f.fixes };
  const base = { v, kind: "merge" as const, lane, p: f.p, generality: f.generality, pr, shots: null, undo: false };
  if (!before) { d.send({ ...base, status: "merged", line: `Merged; the live check didn't run (no browser for it): ${f.fixes}` }); return step; }
  const b = await d.browser().catch(() => null);
  if (!b) { d.send({ ...base, status: "merged", line: `Merged; the live check didn't run (the browser didn't start): ${f.fixes}` }); return step; }
  try { d.send(await (d.check ?? liveCheck)(lj, b.deps, before.reading, before.shot)); }
  finally { await b.close().catch(() => {}); }
  return step;
}

/** A lane's row says its CI is green: past `ci`, and it didn't fail or get stopped. */
export const isGreen = (row: Lane) => row.stepsDone > STEPS.indexOf("ci") && endOf(row) !== "failed" && endOf(row) !== "stopped";

/**
 * The runner the server talks to, with merge lines added: each lane goes
 * through afterGreen once, its lines go to every stream and into the
 * snapshot, and J's Approve on a lane whose merge waits for him runs it again.
 */
export function withMerges(inner: RunnerLike, d: Omit<GreenDeps, "send">): RunnerLike & { idle: () => Promise<void> } {
  const listeners = new Set<(m: Message) => void>();
  const lines = new Map<string, MergeLine>();
  const started = new Set<string>();
  const waiting = new Set<string>();
  const running = new Set<Promise<unknown>>();
  const send = (m: MergeLine) => { lines.set(m.lane, m); for (const fn of listeners) fn(m); };
  const deps: GreenDeps = { ...d, send };
  const go = (lane: string, approved: boolean) => {
    const p = afterGreen(lane, deps, approved)
      .then((s) => { if (s?.waitsFor) waiting.add(lane); })
      .catch((e) => console.log(`merge of ${lane} stopped: ${(e as Error).message}`))
      .finally(() => running.delete(p));
    running.add(p);
  };
  inner.subscribe((m) => {
    for (const fn of listeners) fn(m);
    if (m.kind === "lane" && !started.has(m.lane) && isGreen(m)) { started.add(m.lane); go(m.lane, false); }
  });
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    snapshot: () => [...inner.snapshot(), ...lines.values()],
    submit: (req) => inner.submit(req),
    async control(c) {
      const k = c as Control;
      if (k.kind === "control" && k.do === "approve" && k.by === "j" && waiting.has(k.lane)) {
        waiting.delete(k.lane);
        go(k.lane, true);
        return { ok: true };
      }
      return inner.control(c);
    },
    idle: async () => { while (running.size) await Promise.all([...running]); },
  };
}

// ---- the real facts, from git and the lane's PR body ------------------------

const gitIn = (repo: string) => (...args: string[]) => new Promise<string>((ok, no) =>
  execFile("git", ["-C", repo, ...args], { windowsHide: true, maxBuffer: 16 << 20 }, (e, out) => (e ? no(e) : ok(out.toString().trim()))));

/**
 * The PR body is `handovers/claude-<lane>-pr-body.md` (lane-rules.md). Its
 * first line holds "P1/P2/P3" and "generality N"; "You get: …" (or the
 * first line) is what J notices. A body that is missing or unreadable is
 * treated as a P1, so it waits for J.
 */
export function readPrBody(text: string | null, lane: string) {
  const first = text?.split(/\r?\n/).find((l) => l.trim()) ?? "";
  const p = Number(/\bP([123])\b/.exec(first)?.[1] ?? 1) as 1 | 2 | 3;
  const generality = Number(/generality\s*([1-5])/i.exec(first)?.[1] ?? 1) as 1 | 2 | 3 | 4 | 5;
  const plain = (s: string) => s.replace(/\*\*|`/g, "").replace(/^#+\s*/, "").trim();
  const youGet = text ? /^\**You get:?\**:?\s*(.+)$/im.exec(text)?.[1] : undefined;
  const fixes = plain(youGet ?? (text ? first : `lane ${lane} (no PR body found)`)).slice(0, 300);
  const title = plain(text ? /^##\s+(.+)$/m.exec(text)?.[1] ?? `Agents lane ${lane}` : `Agents lane ${lane}`);
  const tests = text ? /^\**Tests?:?\**:?\s*(.+)$/im.exec(text)?.[1] : undefined;
  return { p, generality, fixes, prTitle: `P${p}: ${title}`, prBody: text ?? fixes, before: plain(tests ?? `tests/${lane}.mjs`) };
}

export function gitFacts(repo: string, handoversDir: string, base = BASE, after: (lane: string) => string | null = () => null) {
  const git = gitIn(repo);
  return async (lane: string): Promise<LaneFacts | null> => {
    const branch = `claude/${lane}`;
    try {
      await git("fetch", "-q", "origin", base, branch);
      const commit = await git("rev-parse", `origin/${branch}`);
      const files = (await git("diff", "--name-only", `origin/${base}...origin/${branch}`)).split("\n").filter(Boolean);
      const file = join(handoversDir, `claude-${lane}-pr-body.md`);
      const body = readPrBody(existsSync(file) ? readFileSync(file, "utf8") : null, lane);
      const a = after(lane);
      return { lane, branch, commit, files, ...body, after: "the live check: the saved board on polio-two.vercel.app, nothing moves", after_branch: a ? `claude/${a}` : null };
    } catch (e) {
      console.log(`no merge for ${lane}: git couldn't read origin/${branch} (${(e as Error).message.split("\n")[0]})`);
      return null;
    }
  };
}

/** Polls git until the base branch holds the lane's commit (the chat way merges outside the helper). */
export function gitLanded(repo: string, base = BASE, { everyMs = 120_000, forMs = 12 * 3600_000 } = {}) {
  const git = gitIn(repo);
  return async (f: LaneFacts): Promise<string | null> => {
    const until = Date.now() + forMs;
    while (Date.now() < until) {
      try {
        await git("fetch", "-q", "origin", base);
        await git("merge-base", "--is-ancestor", f.commit, `origin/${base}`);
        return await git("rev-parse", `origin/${base}`);
      } catch { /* not in yet */ }
      await new Promise((r) => setTimeout(r, everyMs));
    }
    return null;
  };
}

/** measure.ts is loaded only when a live check runs, so the helper starts without the browser kit. */
export function realBrowser(shotsDir: string) {
  return async (): Promise<LiveBrowser | null> => {
    try { const m = await import("../livecheck/measure.ts"); return await m.liveBrowser({ shotsDir }); }
    catch (e) { console.log(`live check browser: ${(e as Error).message.split("\n")[0]}`); return null; }
  };
}

// ---- the tray's commands on stdin --------------------------------------------

/** Pause all pauses every working lane and remembers them; Resume all resumes those. */
export function trayCommands(runner: RunnerLike, quit: () => void) {
  const pausedByTray = new Set<string>();
  const control = (lane: string, d: "pause" | "resume") => runner.control({ v, kind: "control", lane, do: d, by: "j" } as Control);
  return async (line: string) => {
    const cmd = line.trim();
    if (cmd === "pause-all") {
      for (const m of runner.snapshot()) if (m.kind === "lane" && m.state === "working") {
        const r = await control(m.lane, "pause");
        if (r.ok) pausedByTray.add(m.lane);
      }
    } else if (cmd === "resume-all") {
      for (const lane of pausedByTray) await control(lane, "resume");
      pausedByTray.clear();
    } else if (cmd === "quit") quit();
  };
}

// ---- start ---------------------------------------------------------------------

if (import.meta.main) {
  const { values } = parseArgs({ options: {
    repo: { type: "string", default: process.cwd() },
    handovers: { type: "string" },
    agents: { type: "string" },
    claude: { type: "string", default: join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude") },
    base: { type: "string", default: `origin/${BASE}` },
    "at-once": { type: "string", default: "3" },
    "tokens-per-day": { type: "string" },
    "tokens-per-request": { type: "string" },
    tray: { type: "boolean", default: false },
    port: { type: "string" },
    state: { type: "string" },
  } });

  const count = (s: string | undefined) => (s === undefined ? undefined : Number(s));
  const repo = resolve(values.repo!);
  const handoversDir = resolve(values.handovers ?? join(dirname(repo), "handovers"));
  const agentsDir = resolve(values.agents ?? join(dirname(repo), "agents"));
  const stateDir = resolve(values.state ?? join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "PolioHelper"));
  const port = values.port ? Number(values.port) : HELPER_PORT;
  const command = { file: values.claude! };
  const tickets = new SiteTickets();
  const pcCommand = { file: values.claude!, args: ["--mcp-config", siteMcpConfig(stateDir)] };
  const baseName = values.base!.replace(/^origin\//, "");

  const coordinator = new Coordinator({
    runner: {
      adapters: { pc: withSiteTickets(pcPlanAdapter({ command: pcCommand }), tickets, `http://127.0.0.1:${port}/site`), cloud: cloudAdapter({ command }) },
      stateDir,
      spend: new SpendBook({ caps: { tokensPerDay: count(values["tokens-per-day"]), tokensPerRequest: count(values["tokens-per-request"]) } }),
      pushed: branchPushed,
      workspace: (lane, where, from) => where === "pc" ? addWorktree({ repo, root: agentsDir, lane, base: from }) : repo,
    },
    ask: claudeAsk({ file: command.file, cwd: repo }),
    owners: ownersReader(join(handoversDir, OWNERS_FILE)),
    rules: () => loadRules({ handoversDir, repo }),
    base: values.base!,
    atOnce: Number(values["at-once"]),
  });

  // owners.json: rebuilt in a child, never two at once; the queue looks again when it's done.
  let rebuilding = false;
  const rebuildOwners = () => {
    if (rebuilding) return;
    rebuilding = true;
    const child = spawn(process.execPath, [fileURLToPath(new URL("../coordinator/owners-main.ts", import.meta.url)), "--repo", repo, "--handovers", handoversDir, "--base", values.base!],
      { stdio: "ignore", windowsHide: true });
    child.on("exit", (code) => { rebuilding = false; if (code === 0) coordinator.ownersChanged(); else console.log("owners.json wasn't rebuilt (git or the handovers folder?)"); });
    child.on("error", () => { rebuilding = false; });
  };
  rebuildOwners();
  const every = setInterval(rebuildOwners, 15 * 60_000);
  coordinator.subscribe((m) => { if (m.kind === "lane" && (m.state === "done" || m.stepNow === "merge")) rebuildOwners(); });

  const runner = withMerges(coordinator, {
    // Only a lane this helper handed to its runner has a start branch; a branch named like one doesn't.
    ours: (lane) => coordinator.startOf(lane) !== null,
    onlyYou: (lane) => (coordinator.extraOf(lane)?.adds.length ?? 0) > 0,
    facts: gitFacts(repo, handoversDir, baseName, (lane) => coordinator.extraOf(lane)?.after.at(-1) ?? null),
    token: () => readGithubToken(),
    github: { fetch },
    browser: realBrowser(join(stateDir, "shots")),
    landed: gitLanded(repo, baseName),
  });

  const pairing = new Pairing({ show: (code) => console.log(`\n  Pair with polio-two.vercel.app?  Code: ${code.slice(0, 3)} ${code.slice(3)}\n@pair ${code}`) });
  const helper = await startHelperServer({ runner, pairing, tickets, port });
  console.log(`Polio Helper on http://127.0.0.1:${helper.port} (on your plan, ${coordinator.atOnce} lanes at once)\n@ready ${helper.port}`);

  const quit = async () => { clearInterval(every); await coordinator.stopAll(); await helper.close(); process.exit(0); };
  process.on("SIGINT", quit);
  process.on("SIGTERM", quit);
  // The tray pipes stdin; from a terminal these lines can be typed too.
  const tray = trayCommands(runner, () => void quit());
  const lines = createInterface({ input: process.stdin }).on("line", (l) => void tray(l));
  // Started by the tray: when the tray goes, so does the helper (and its lanes).
  if (values.tray) lines.on("close", () => void quit());
}
