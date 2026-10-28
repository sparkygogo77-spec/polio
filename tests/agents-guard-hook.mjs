/**
 * Agents panel, security (fable-security lane): a lane's tool call can't
 * reach the helper, and the lead's planning call can't run or write.
 *
 * - The real hold hook (helper/agents/hold-hook.mjs) is run as Claude Code
 *   runs it, with the call as JSON on stdin: a shell command or a file write
 *   that names the helper's port, its state folder or Windows credentials,
 *   or that force-pushes, exits 2 with one line of why; an ordinary call,
 *   the lane's own build command included, exits 0.
 * - helper/coordinator/ask.ts starts `claude -p` with --disallowedTools for
 *   Bash, Edit, Write, WebFetch and the rest, so J's own allow rules can't
 *   give an injected request a shell.
 *
 * Red on base: the hook lets `curl http://127.0.0.1:47821/pair/start`
 * through, and the lead's argv has no --disallowedTools.
 *
 *   node tests/agents-guard-hook.mjs
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const HOOK = fileURLToPath(new URL("../helper/agents/hold-hook.mjs", import.meta.url));
const dir = mkdtempSync(join(tmpdir(), "polio-guard-"));
const gateDir = join(dir, "state", "lanes", "hero-calm", "gate");
const lockDir = join(dir, "state");

/** Runs the hook's pre step for one call; returns { code, said }. */
const hook = (call) => {
  const r = spawnSync(process.execPath, [HOOK, "pre", gateDir, lockDir, "hero-calm", "1"], { input: JSON.stringify(call), encoding: "utf8", timeout: 20000 });
  // Node's module-type warnings land on stderr too; the hook's own line is the last one.
  return { code: r.status, said: (r.stderr ?? "").trim().split("\n").at(-1) ?? "" };
};
const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });

try {
  // ---- what must be refused -------------------------------------------------
  const curl = hook(bash("curl -s -H 'Origin: http://127.0.0.1:47821' -X POST http://127.0.0.1:47821/pair/start"));
  check("a shell call to the helper's port is refused (exit 2)", curl.code === 2, `exit ${curl.code}`);
  check("…and says why in one line", /helper's port/.test(curl.said) && !curl.said.includes("\n"), curl.said);
  check("localhost spelling is refused too", hook(bash("node -e \"fetch('http://localhost:47821/stream')\"")).code === 2);
  check("a file write that points at the helper's port is refused", hook({ tool_name: "Write", tool_input: { file_path: "scripts/x.mjs", content: "await fetch('http://127.0.0.1:47821/control', {method:'POST'})" } }).code === 2);
  check("reading the lane's own gate folder is refused", hook({ tool_name: "Read", tool_input: { file_path: join(gateDir, "paused") } }).code === 2);
  check("deleting the build lock is refused", hook(bash(`rm -f "${join(lockDir, "build.lock")}"`)).code === 2);
  check("the helper's state folder under LOCALAPPDATA is refused, whatever the drive", hook(bash("type C:\\Users\\Josh\\AppData\\Local\\PolioHelper\\helper.log")).code === 2);
  check("Credential Manager from a shell is refused", hook(bash("cmdkey /list")).code === 2);
  check("the GitHub token's credential name is refused", hook(bash("powershell -c \"[PolioHelper.Cred]::CredRead('PolioHelper:github',1,0,[ref]$p)\"")).code === 2);
  check("a forced push is refused", hook(bash("git push --force origin claude/hero-calm")).code === 2);
  check("…with -f as well", hook(bash("git push -f origin HEAD")).code === 2);

  // ---- what must go on ------------------------------------------------------
  check("an ordinary shell call goes on (exit 0)", hook(bash("node tests/agents-contract.mjs")).code === 0);
  check("the lane's own push goes on", hook(bash("git push -u origin claude/hero-calm")).code === 0);
  check("a dev server on the lane's port goes on", hook(bash("PORT=3100 npm run dev")).code === 0);
  check("a build goes on (and takes the build lock)", hook(bash("npm run build")).code === 0);
  check("a file write into the worktree goes on", hook({ tool_name: "Edit", tool_input: { file_path: "src/features/agents/store.ts", old_string: "a", new_string: "b" } }).code === 0);
  check("editing the helper's own source (the word PolioHelper, no path) goes on", hook({ tool_name: "Edit", tool_input: { file_path: "helper/server/main.ts", old_string: "x", new_string: 'join(process.env.LOCALAPPDATA, "PolioHelper")' } }).code === 0);
  check("a call with no input goes on", hook({ tool_name: "TodoWrite" }).code === 0);

  // ---- the guard itself, imported ---------------------------------------------
  const { touchesHelper } = await import("../helper/agents/guard.ts");
  check("touchesHelper is null for a plain call", touchesHelper(bash("ls")) === null);
  check("touchesHelper names the port", /port/.test(touchesHelper(bash("curl 127.0.0.1:47821/health")) ?? ""));
  check("the gate dir is matched with either slash", touchesHelper({ tool_name: "Bash", tool_input: { command: `cat ${gateDir.replace(/\\/g, "/")}/stopped` } }, [gateDir]) !== null);

  // ---- the lead's call: read-only tools, whatever J's settings allow -----------
  const { claudeAsk, LEAD_NEVER } = await import("../helper/coordinator/ask.ts");
  const standIn = join(dir, "fake-lead.mjs");
  writeFileSync(standIn, `process.stdout.write(JSON.stringify({ result: JSON.stringify(process.argv.slice(2)) }));`);
  const ask = claudeAsk({ file: process.execPath, args: [standIn], cwd: dir, timeoutMs: 20000 });
  const argv = JSON.parse(await ask("plan this", { model: "claude-opus-5-5" }));
  const at = argv.indexOf("--disallowedTools");
  const never = at >= 0 ? argv[at + 1].split(",") : [];
  check("the lead's argv carries --disallowedTools", at >= 0, argv.join(" "));
  check("…with Bash, Edit, Write, WebFetch and Agent in it", ["Bash", "Edit", "Write", "WebFetch", "Agent"].every((t) => never.includes(t)), never.join(","));
  check("LEAD_NEVER is what reaches the command line", never.join(",") === LEAD_NEVER.join(","));
  check("the lead still reads: Read, Grep and Glob are allowed", argv[argv.indexOf("--allowedTools") + 1] === "Read,Grep,Glob");
  check("the stand-in's own args come first and the prompt is on stdin", argv.indexOf("-p") === 0);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
