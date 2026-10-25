/**
 * Starts Polio Helper: the loopback server on 127.0.0.1:47821, the
 * coordinator's queue, and the runner behind it.
 *
 *   node helper/server/main.ts [--repo <polio clone>] [--handovers <Pleo/handovers>]
 *        [--claude <path to claude.exe>] [--at-once 3]
 *        [--tokens-per-day N] [--tokens-per-request N]
 *
 * - Every run is on J's plan: the unmodified `claude` CLI under his own
 *   sign-in, on the PC or as a cloud session. There is no API-key way. The
 *   lead's planning call is the same CLI, with read-only tools.
 * - A request goes to the lead, then its lanes through the queue
 *   (helper/coordinator/queue.ts): stacking, owners, J's yes, 3 at once.
 * - Lanes on the PC get worktrees under Pleo/agents/<lane> (next to --repo),
 *   each from the branch the queue says (the base, or the one it is
 *   stacked on).
 * - handovers/owners.json is rebuilt at start, every 15 minutes, and when a
 *   lane ends, in a child process so the server keeps answering.
 * - Caps are in tokens. Leave one out for no cap of that kind.
 * - The pairing code is printed here. The tray and the at-log-on task come
 *   with the installer lane.
 * - Ctrl+C stops every lane the helper started, and nothing else.
 */
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { cloudAdapter } from "../agents/cloud.ts";
import { pcPlanAdapter } from "../agents/pc.ts";
import { SpendBook } from "../agents/spend.ts";
import { addWorktree } from "../agents/worktree.ts";
import { claudeAsk } from "../coordinator/ask.ts";
import { loadRules } from "../coordinator/brief.ts";
import { OWNERS_FILE, ownersReader } from "../coordinator/owners.ts";
import { Coordinator } from "../coordinator/queue.ts";
import { Pairing } from "./pairing.ts";
import { startHelperServer, HELPER_PORT } from "./server.ts";

const { values } = parseArgs({ options: {
  repo: { type: "string", default: process.cwd() },
  handovers: { type: "string" },
  claude: { type: "string", default: join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude") },
  base: { type: "string", default: "origin/claude/template-ui-website-builder-11bfgl" },
  "at-once": { type: "string", default: "3" },
  "tokens-per-day": { type: "string" },
  "tokens-per-request": { type: "string" },
} });

const count = (s: string | undefined) => (s === undefined ? undefined : Number(s));
const repo = resolve(values.repo!);
const handoversDir = resolve(values.handovers ?? join(dirname(repo), "handovers"));
const stateDir = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "PolioHelper");
const command = { file: values.claude! };

const coordinator = new Coordinator({
  runner: {
    adapters: { pc: pcPlanAdapter({ command }), cloud: cloudAdapter({ command }) },
    stateDir,
    spend: new SpendBook({ caps: { tokensPerDay: count(values["tokens-per-day"]), tokensPerRequest: count(values["tokens-per-request"]) } }),
    workspace: (lane, where, from) => where === "pc" ? addWorktree({ repo, root: join(dirname(repo), "agents"), lane, base: from }) : repo,
  },
  ask: claudeAsk({ file: command.file, cwd: repo }),
  owners: ownersReader(join(handoversDir, OWNERS_FILE)),
  rules: () => loadRules({ handoversDir, repo }),
  base: values.base!,
  atOnce: Number(values["at-once"]),
});

// owners.json: rebuilt in a child, never two at once; the queue looks again when it's done.
let rebuilding = false;
function rebuildOwners() {
  if (rebuilding) return;
  rebuilding = true;
  const child = spawn(process.execPath, [fileURLToPath(new URL("../coordinator/owners-main.ts", import.meta.url)), "--repo", repo, "--handovers", handoversDir, "--base", values.base!],
    { stdio: "ignore", windowsHide: true });
  child.on("exit", (code) => { rebuilding = false; if (code === 0) coordinator.ownersChanged(); else console.log("owners.json wasn't rebuilt (git or the handovers folder?)"); });
  child.on("error", () => { rebuilding = false; });
}
rebuildOwners();
const every = setInterval(rebuildOwners, 15 * 60_000);
coordinator.subscribe((m) => { if (m.kind === "lane" && (m.state === "done" || m.stepNow === "merge")) rebuildOwners(); });

const pairing = new Pairing({ show: (code) => console.log(`\n  Pair with polio-two.vercel.app?  Code: ${code.slice(0, 3)} ${code.slice(3)}\n`) });
const helper = await startHelperServer({ runner: coordinator, pairing, port: HELPER_PORT });
console.log(`Polio Helper on http://127.0.0.1:${helper.port} (on your plan, ${coordinator.atOnce} lanes at once)`);

const quit = async () => { clearInterval(every); await coordinator.stopAll(); await helper.close(); process.exit(0); };
process.on("SIGINT", quit);
process.on("SIGTERM", quit);
