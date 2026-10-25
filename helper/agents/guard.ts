/**
 * What a lane's tool call may never touch (proposal, Safety: "An agent can't
 * read the token"; hold-hook.mjs runs this before every call).
 *
 * A hook is a check, not a wall: the agent runs as J's user. But a prompt
 * that was injected from a captured site or a PR has to get past this plain
 * list before it can reach the helper, and that is where the token, the
 * pairing code and the lane gates live:
 *
 * - the helper's port, 47821 on any loopback name (a request from the PC
 *   can forge Origin, which the server can't tell from the dock's);
 * - the helper's state folders (the gate files, the build lock, the lane
 *   settings, the job launcher's DLL, any log the pairing code lands in);
 * - Windows Credential Manager from a shell (the GitHub token lives there);
 * - a forced push (the merge gate trusts the branch's own history).
 *
 * Pure: tests/agents-guard-hook.mjs imports it straight.
 */

const PORT = /(127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0|\[?::\]?):47821\b/i;
const STATE_SEGMENT = /[\\/]PolioHelper[\\/]/i;
const CREDENTIALS = /\b(cmdkey|vaultcmd|CredRead|CredEnumerate|Get-StoredCredential|keymgr\.dll|PolioHelper:github)\b/i;
const FORCE_PUSH = /\bgit\b[^|;&\n]*\bpush\b[^|;&\n]*(\s--force(-with-lease)?\b|\s-f\b|\s-[a-zA-Z]*f[a-zA-Z]*\b(?=\s|$))/;

const slash = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** Every string inside the call's input, however nested, so a path in a file write counts as much as a shell command. */
function strings(x: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof x === "string") out.push(x);
  else if (x && typeof x === "object" && depth < 5) for (const v of Object.values(x)) strings(v, out, depth + 1);
  return out;
}

export type ToolCall = { tool_name?: unknown; tool_input?: unknown };

/** Null when the call may go on; otherwise the one line the agent reads. */
export function touchesHelper(call: ToolCall, protectedDirs: string[] = []): string | null {
  const texts = strings(call?.tool_input);
  const all = texts.join("\n");
  const dirs = protectedDirs.filter(Boolean).map(slash);
  if (PORT.test(all)) return "This call reaches the helper's port. Lanes never talk to the helper; J drives it from the dock.";
  if (STATE_SEGMENT.test(all) || texts.some((t) => { const s = slash(t); return dirs.some((d) => s.includes(d)); }))
    return "This call touches the helper's own folder. Lanes never read or change it.";
  if (call?.tool_name === "Bash") {
    if (CREDENTIALS.test(all)) return "This call reads Windows credentials. Lanes never hold keys; the helper keeps them.";
    if (FORCE_PUSH.test(all)) return "This call force-pushes. Lanes push their own branch forward only.";
  }
  return null;
}
