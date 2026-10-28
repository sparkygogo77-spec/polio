/**
 * Starts Polio Helper: the loopback server on 127.0.0.1:47821 and the
 * runner behind it.
 *
 *   node helper/server/main.ts [--repo <polio clone>] [--pays plan|api] [--claude <path to claude.exe>]
 *
 * - Lanes on the PC get worktrees under Pleo/agents/<lane> (next to --repo).
 * - --pays plan (the default) runs the `claude` CLI under J's own sign-in;
 *   --pays api runs the Agent SDK with the key in POLIO_HELPER_API_KEY
 *   (the installer lane moves it to Windows Credential Manager).
 * - The pairing code is printed here. The tray and the at-log-on task come
 *   with the installer lane.
 * - Ctrl+C stops every lane the helper started, and nothing else.
 */
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";
import { cloudAdapter } from "../agents/cloud.ts";
import { pcApiAdapter, pcPlanAdapter } from "../agents/pc.ts";
import { Runner } from "../agents/runner.ts";
import { SpendBook } from "../agents/spend.ts";
import { addWorktree } from "../agents/worktree.ts";
import { Pairing } from "./pairing.ts";
import { startHelperServer, HELPER_PORT } from "./server.ts";

const { values } = parseArgs({ options: {
  repo: { type: "string", default: process.cwd() },
  pays: { type: "string", default: "plan" },
  claude: { type: "string", default: join(homedir(), ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude") },
  base: { type: "string", default: "origin/claude/template-ui-website-builder-11bfgl" },
  "plan-window-tokens": { type: "string", default: "5000000" },
  "usd-per-day": { type: "string", default: "15" },
} });

const repo = resolve(values.repo!);
const stateDir = join(process.env.LOCALAPPDATA ?? join(homedir(), ".local", "share"), "PolioHelper");
const apiKey = process.env.POLIO_HELPER_API_KEY;
const command = { file: values.claude! };
const pc = values.pays === "api"
  ? pcApiAdapter({ apiKey: () => { if (!apiKey) throw new Error("no API key held"); return apiKey; } })
  : pcPlanAdapter({ command });

const runner = new Runner({
  adapters: { pc, cloud: cloudAdapter({ command }) },
  stateDir,
  spend: new SpendBook({ planWindowTokens: Number(values["plan-window-tokens"]), caps: { usdPerDay: Number(values["usd-per-day"]) } }),
  workspace: (lane, where) => where === "pc" ? addWorktree({ repo, root: join(dirname(repo), "agents"), lane, base: values.base! }) : repo,
  apiKey: apiKey ? () => apiKey : undefined,
});
const pairing = new Pairing({ show: (code) => console.log(`\n  Pair with polio-two.vercel.app?  Code: ${code.slice(0, 3)} ${code.slice(3)}\n`) });
const helper = await startHelperServer({ runner, pairing, port: HELPER_PORT });
console.log(`Polio Helper on http://127.0.0.1:${helper.port} (pays: ${values.pays})`);

const quit = async () => { await runner.stopAll(); await helper.close(); process.exit(0); };
process.on("SIGINT", quit);
process.on("SIGTERM", quit);
