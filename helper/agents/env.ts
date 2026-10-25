/**
 * The environment a lane's agent gets. Agents get neither the helper's
 * token nor its port (proposal, Safety), and every run is on J's plan
 * (J, 2026-10-25: "no api"):
 *
 * - No ANTHROPIC_API_KEY or ANTHROPIC_AUTH_TOKEN: either would win over J's
 *   sign-in (authentication doc) and bill a key instead of his plan.
 * - No CLAUDE_CODE_OAUTH_TOKEN: the unmodified `claude` binary uses J's own
 *   sign-in, which it keeps itself. The helper never reads, stores or passes
 *   a plan credential (legal-and-compliance: developers may not "collect,
 *   store, or intermediate" them), and never uses `claude setup-token`.
 */
import { dirname } from "node:path";

const HELPER_VARS = /^(POLIO_HELPER_|POLIO_JOB_)/;
export const CLAUDE_CREDENTIALS = ["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_CODE_OAUTH_TOKEN"];

export function laneEnv(base: NodeJS.ProcessEnv, { port }: { port: number }): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {};
  for (const [k, val] of Object.entries(base)) {
    if (HELPER_VARS.test(k) || CLAUDE_CREDENTIALS.includes(k.toUpperCase())) continue;
    env[k] = val;
  }
  env.PORT = String(port);
  // The hook command calls plain `node`, so it works the same from bash,
  // cmd and PowerShell; put this node first.
  const sep = process.platform === "win32" ? ";" : ":";
  const pathKey = Object.keys(env).find((k) => k.toUpperCase() === "PATH") ?? "PATH";
  env[pathKey] = `${dirname(process.execPath)}${sep}${env[pathKey] ?? ""}`;
  return env;
}
