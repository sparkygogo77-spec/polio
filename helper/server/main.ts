/**
 * Starts Polio Helper: the loopback server on 127.0.0.1:47821 and the
 * runner behind it.
 *
 *   node helper/server/main.ts [--repo <polio clone>] [--claude <path to claude.exe>]
 *        [--tokens-per-day N] [--tokens-per-request N]
 *
 * - Every run is on J's plan: the unmodified `claude` CLI under his own
 *   sign-in, on the PC or as a cloud session. There is no API-key way.
 * - Lanes on the PC get worktrees under Pleo/agents/<lane> (next to --repo).
 * - Caps are in tokens. Leave one out for no cap of that kind.
 * - The pairing code is printed here. The tray and the at-log-on task come
 *   with the installer lane.
 * - Ctrl+C stops every lane the helper started, and nothing else.
 */
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { cloudAdapter } from "../agents/cloud.ts";
import { pcPlanAdapter } from "../agents/pc.ts";
import { Runner } from "../agents/runner.ts";
import { SpendBook } from "../agents/spend.ts";
import { addWorktree } from "../agents/worktree.ts";
import { Pairing } from "./pairing.ts";
import { startHelperServer, HELPER_PORT } from "./server.ts";

const { values } = parseArgs({ options: {
  repo: { type: "string", default: process.cwd() },
  claude: { type: "string", default: join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude") },
  base: { type: "string", default: "origin/claude/template-ui-website-builder-11bfgl" },
  "tokens-per-day": { type: "string" },
  "tokens-per-request": { type: "string" },
} });

const count = (s: string | undefined) => (s === undefined ? undefined : Number(s));
const repo = resolve(values.repo!);
const stateDir = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "PolioHelper");
const command = { file: values.claude! };

const runner = new Runner({
  adapters: { pc: pcPlanAdapter({ command }), cloud: cloudAdapter({ command }) },
  stateDir,
  spend: new SpendBook({ caps: { tokensPerDay: count(values["tokens-per-day"]), tokensPerRequest: count(values["tokens-per-request"]) } }),
  workspace: (lane, where) => where === "pc" ? addWorktree({ repo, root: join(dirname(repo), "agents"), lane, base: values.base! }) : repo,
});
const pairing = new Pairing({ show: (code) => console.log(`\n  Pair with polio-two.vercel.app?  Code: ${code.slice(0, 3)} ${code.slice(3)}\n`) });
const helper = await startHelperServer({ runner, pairing, port: HELPER_PORT });
console.log(`Polio Helper on http://127.0.0.1:${helper.port} (on your plan)`);

const quit = async () => { await runner.stopAll(); await helper.close(); process.exit(0); };
process.on("SIGINT", quit);
process.on("SIGTERM", quit);
