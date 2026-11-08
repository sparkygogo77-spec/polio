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
 * - a forced push (the merge gate trusts the branch's own history);
 * - J's own sign-ins (audit helper-install.md, risk 2): anything under
 *   %USERPROFILE%\.claude (.credentials.json, the transcripts) or the
 *   .claude.json beside it, any .credentials.json, and git's credential
 *   commands (`git credential fill` hands out the GitHub sign-in);
 * - a dev server on every interface (risk 10): `next dev`/`next start` and
 *   `npm run dev`/`start` must say `-H 127.0.0.1` (Next's own default is
 *   0.0.0.0, which other machines on the network could reach).
 *
 * Pure: tests/agents-guard-hook.mjs imports it straight.
 */

const PORT = /(127\.0\.0\.1|localhost|\[::1\]|0\.0\.0\.0|\[?::\]?):47821\b/i;
const STATE_SEGMENT = /[\\/]PolioHelper[\\/]/i;
const CREDENTIALS = /\b(cmdkey|vaultcmd|CredRead|CredEnumerate|Get-StoredCredential|keymgr\.dll|PolioHelper:github)\b/i;
const FORCE_PUSH = /\bgit\b[^|;&\n]*\bpush\b[^|;&\n]*(\s--force(-with-lease)?\b|\s-f\b|\s-[a-zA-Z]*f[a-zA-Z]*\b(?=\s|$))/;
/** git's credential plumbing, however it is spelled: `git credential fill`, `git -c x=y credential-manager get`, `git-credential-manager`. */
const GIT_CREDENTIAL = /\bgit(\.exe)?\b[^|;&\n]*\bcredential(-manager(-core)?|-store|-cache|-wincred)?\s+\w|\bgit-credential-\w+/i;
/** A sign-in file wherever it is named. */
const SIGNIN_FILE = /\.credentials\.json\b|(^|[\\/"'\s=])\.claude\.json\b/i;
/** The home folder by any of its spellings, then .claude or .claude.json. */
const HOME_CLAUDE = /(~|\$HOME|\$\{HOME\}|%USERPROFILE%|%HOMEPATH%|\$env:USERPROFILE|\$env:HOME|\$\{env:USERPROFILE\}|\$\{USERPROFILE\}|\$USERPROFILE)[\\/]+\.claude(\.json)?\b/i;
/** Starting a Next.js (or the repo's npm dev/start) server. */
const DEV_SERVER = /\bnext(\.cmd)?\s+(dev|start)\b|\b(npm|pnpm|yarn|bun)\s+(run\s+)?(dev|start)\b/i;
const LOOPBACK_HOST = /(\s-H|\s--hostname)(\s+|=)["']?(127\.0\.0\.1|localhost|::1)\b/i;
const SHELLS = new Set(["Bash", "PowerShell"]);

const slash = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
/** The home folder as a lane might write it: C:/Users/J, /c/Users/J (Git Bash), /mnt/c/Users/J (WSL). */
function homeSpellings(home: string): string[] {
  const h = slash(home);
  const out = [h];
  const drive = /^([a-z]):\/(.*)$/.exec(h);
  if (drive) out.push(`/${drive[1]}/${drive[2]}`, `/mnt/${drive[1]}/${drive[2]}`);
  return out.filter(Boolean);
}

/** Every string inside the call's input, however nested, so a path in a file write counts as much as a shell command. */
function strings(x: unknown, out: string[] = [], depth = 0): string[] {
  if (typeof x === "string") out.push(x);
  else if (x && typeof x === "object" && depth < 5) for (const v of Object.values(x)) strings(v, out, depth + 1);
  return out;
}

export type ToolCall = { tool_name?: unknown; tool_input?: unknown };

/** Null when the call may go on; otherwise the one line the agent reads. */
export function touchesHelper(call: ToolCall, protectedDirs: string[] = [], opts: { home?: string } = {}): string | null {
  const texts = strings(call?.tool_input);
  const all = texts.join("\n");
  const dirs = protectedDirs.filter(Boolean).map(slash);
  if (PORT.test(all)) return "This call reaches the helper's port. Lanes never talk to the helper; J drives it from the dock.";
  if (STATE_SEGMENT.test(all) || texts.some((t) => { const s = slash(t); return dirs.some((d) => s.includes(d)); }))
    return "This call touches the helper's own folder. Lanes never read or change it.";
  const home = opts.home ?? process.env.USERPROFILE ?? process.env.HOME ?? "";
  const homeClaude = home ? homeSpellings(home).map((h) => `${h}/.claude`) : [];
  if (SIGNIN_FILE.test(all) || HOME_CLAUDE.test(all) || texts.some((t) => { const s = slash(t); return homeClaude.some((d) => s.includes(d)); }))
    return "This call reaches J's Claude sign-in folder (.claude in his user folder). Lanes never read sign-ins.";
  if (SHELLS.has(String(call?.tool_name))) {
    if (CREDENTIALS.test(all)) return "This call reads Windows credentials. Lanes never hold keys; the helper keeps them.";
    if (GIT_CREDENTIAL.test(all)) return "This call asks git for a stored sign-in. Lanes push with git push only, never read credentials.";
    if (FORCE_PUSH.test(all)) return "This call force-pushes. Lanes push their own branch forward only.";
    if (DEV_SERVER.test(all) && !LOOPBACK_HOST.test(all))
      return "This starts a dev server on every network interface. Add -H 127.0.0.1 (npm run dev -- -H 127.0.0.1 -p $PORT) so only this PC can reach it.";
  }
  return null;
}
