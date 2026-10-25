/**
 * The environment a lane's agent gets. Agents get neither the helper's
 * token nor its port (proposal, Safety), and how a run is paid is set on
 * purpose, never inherited:
 *
 * - plan: no ANTHROPIC_API_KEY (it would win over J's sign-in, per the
 *   authentication doc) and no CLAUDE_CODE_OAUTH_TOKEN. The unmodified
 *   `claude` binary uses J's own sign-in, which it keeps itself; the helper
 *   never reads, stores or passes a plan credential (legal-and-compliance:
 *   developers may not "collect, store, or intermediate" them).
 * - api: the key J gave the helper, from Windows Credential Manager.
 */
import { dirname } from "node:path";

const HELPER_VARS = /^(POLIO_HELPER_|POLIO_JOB_)/;
const CLAUDE_CREDENTIALS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"];

export function laneEnv(base: NodeJS.ProcessEnv, { port, pays, apiKey }: { port: number; pays: "plan" | "api" | "cloud"; apiKey?: string }): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, val] of Object.entries(base)) {
    if (HELPER_VARS.test(k) || CLAUDE_CREDENTIALS.includes(k)) continue;
    env[k] = val;
  }
  env.PORT = String(port);
  // The hook command calls plain `node`, so it works the same from bash,
  // cmd and PowerShell; put this node first.
  const sep = process.platform === "win32" ? ";" : ":";
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  env[pathKey] = `${dirname(process.execPath)}${sep}${env[pathKey] ?? ""}`;
  if (pays === "api") {
    if (!apiKey) throw new Error("an API run needs the key J gave the helper");
    env.ANTHROPIC_API_KEY = apiKey;
  }
  return env;
}
