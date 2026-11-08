/**
 * Polio Helper: the eleven install risks the 2026-11-01 audit found
 * (handovers/audits/helper-install.md, section 6), each closed and checked.
 *
 *  1. install.ps1 (and the helper at each start) finds the Claude desktop
 *     app's own claude.exe, newest version, when -Claude isn't given and
 *     nothing is on PATH, and says which it chose.
 *  2. guard.ts refuses anything under %USERPROFILE%\.claude, any
 *     .credentials.json, .claude.json and git's credential commands.
 *  3. A default daily token cap: install writes it, the tray passes it, the
 *     helper never runs uncapped, and the dock sees and changes it (/caps).
 *  4. A merge touching helper/ or .claude/ waits for J; the install line
 *     names a commit and install.ps1 holds the helper at it.
 *  5. Pairing survives a restart (the token's hash in <state>/pairing.json).
 *  6. The pairing code never reaches logs\helper.log; the log stays under 1 MB.
 *  7. Deny in the code window ends the code in the helper.
 *  8. The PC tab reads the real PC through token-gated /api/pc/* routes.
 *  9. Uninstall names what it leaves behind.
 * 10. Lanes' dev servers listen on 127.0.0.1 only (the brief says so, the
 *     hook refuses one without -H 127.0.0.1).
 * 11. Install adds no log-on task unless -AtLogOn; the Builder's Start the
 *     helper starts it.
 *
 * Red on base: line.ts has no installLine, the guard lets
 * `cat ~/.claude/.credentials.json` through, and the server has no /caps.
 * Windows parts (PowerShell, the tray's C#) are skipped elsewhere. Nothing is
 * installed for real: scratch folders and a test HKCU key, removed at the end.
 *
 *   node tests/helper-install-fixes.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};
const load = async (p) => { try { return await import(p); } catch (e) { check(`${p} loads`, false, String(e?.message ?? e).split("\n")[0]); return null; } };

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const WIN = process.platform === "win32";
const PS = WIN ? join(process.env.SystemRoot ?? "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe") : "";
const tmp = mkdtempSync(join(tmpdir(), "helper-fixes-"));
const touch = (p, text = "x") => { mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, text); };

const L = await load("../helper/install/line.ts");
const C = await load("../src/features/agents/context.ts");
const Guard = await load("../helper/agents/guard.ts");
const Gate = await load("../helper/merge/gate.ts");
const Spend = await load("../helper/agents/spend.ts");
const Find = await load("../helper/agents/find-claude.ts");
const Pa = await load("../helper/server/pairing.ts");
const Sv = await load("../helper/server/server.ts");
const R = await load("../helper/agents/runner.ts");
const Main = await load("../helper/server/main.ts");
const Brief = await load("../helper/agents/brief.ts");
if (!(L && C && Guard && Gate && Spend && Find && Pa && Sv && R && Main && Brief)) { rmSync(tmp, { recursive: true, force: true }); done(); }

/** A scratch install's PowerShell: the given script with arguments, no profile. */
const ps = (script, args, env = {}) => spawnSync(PS, ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", join(ROOT, "helper", "install", script), ...args],
  { encoding: "utf8", windowsHide: true, timeout: 120000, env: { ...process.env, ...env } });
/** A PATH with no claude on it (Windows' own folders only): the case on J's PC. */
const NO_CLAUDE_PATH = { PATH: `${process.env.SystemRoot}\\System32;${process.env.SystemRoot}` };
const nodeExe = process.execPath;
const gitExe = WIN ? (spawnSync("where.exe", ["git"], { encoding: "utf8" }).stdout.split(/\r?\n/)[0] ?? "").trim() : "";
const said = (r) => `${r.stdout}\n${r.stderr}`;
const testKey = `HKCU:\\Software\\PolioHelperFixesTest-${process.pid}`;
const common = (name) => ["-Root", join(tmp, name, "PolioHelper"), "-Pleo", join(tmp, name, "Pleo"), "-ClassesKey", `${testKey}\\Classes`, "-TaskName", `PolioHelperFixesTest-${process.pid}`,
  "-StartupDir", join(tmp, name, "Startup"), "-StateDir", join(tmp, name, "state"), "-Node", nodeExe, "-Git", gitExe, "-UserHome", join(tmp, name, "home")];

try {
  // ---- 1. Claude Code: the desktop app's own copy, newest version -----------------
  console.log("1. finding claude.exe");
  const appData = join(tmp, "appdata");
  const old = join(appData, "Claude", "claude-code", "2.1.300", "aaa111", "claude.exe");
  const newest = join(appData, "Claude", "claude-code", "2.1.309", "9078b9c1d466", "claude.exe");
  touch(old); touch(newest); touch(join(appData, "Claude", "claude-code", "2.1.99", "bbb", "claude.exe"));
  touch(join(appData, "Claude", "claude-code", "not-a-version", "ccc", "claude.exe"));
  const f = Find.findClaude({ home: join(tmp, "nohome"), path: "", appData });
  check("the helper finds the desktop app's newest claude.exe (2.1.309 over 2.1.300 and 2.1.99)", f.file === newest, JSON.stringify(f));
  check("…and says where it came from", /desktop app/.test(f.from), f.from);
  check("a path from helper.json that still exists wins", Find.findClaude({ given: old, appData }).file === old);
  check("a path from helper.json the app has since removed is looked for again", Find.findClaude({ given: join(appData, "gone", "claude.exe"), path: "", appData }).file === newest);
  check("nothing anywhere: no file, and words saying what to do", Find.findClaude({ path: "", appData: join(tmp, "empty") }).file === null && /install it/.test(Find.findClaude({ path: "", appData: join(tmp, "empty") }).from));
  check("main.ts starts with findClaude, not a fixed ~/.local/bin path", /findClaude\(\{ given: values\.claude/.test(read("helper/server/main.ts")) && !/claude: \{ type: "string", default:/.test(read("helper/server/main.ts")));
  if (WIN) {
    const dry = ps("install.ps1", [...common("one"), "-DryRun", "-AppData", appData], NO_CLAUDE_PATH);
    check("install.ps1 with no -Claude and none on PATH picks the desktop app's newest copy", dry.status === 0 && said(dry).includes(`Claude Code at ${newest}`), said(dry).split(/\r?\n/).find((l) => /Claude Code/.test(l)));
    check("…and says which one it chose", /desktop app's own copy, the newest version/.test(said(dry)));
  }

  // ---- 2. the guard: J's sign-ins ------------------------------------------------
  console.log("2. the guard and J's sign-ins");
  const home = "C:\\Users\\J";
  const g = (call) => Guard.touchesHelper(call, [], { home });
  const bash = (command) => ({ tool_name: "Bash", tool_input: { command } });
  const pwsh = (command) => ({ tool_name: "PowerShell", tool_input: { command } });
  for (const [what, call] of [
    ["cat ~/.claude/.credentials.json", bash("cat ~/.claude/.credentials.json")],
    ["Read of C:\\Users\\J\\.claude\\.credentials.json", { tool_name: "Read", tool_input: { file_path: "C:\\Users\\J\\.claude\\.credentials.json" } }],
    ["Read of the transcripts folder by its Git Bash path", { tool_name: "Glob", tool_input: { pattern: "*.jsonl", path: "/c/Users/J/.claude/projects" } }],
    ["type %USERPROFILE%\\.claude.json", bash("type %USERPROFILE%\\.claude.json")],
    ["PowerShell Get-Content $env:USERPROFILE\\.claude\\settings.json", pwsh("Get-Content $env:USERPROFILE\\.claude\\settings.json")],
    ["any .credentials.json, wherever", bash("find / -name .credentials.json")],
    ["git credential fill", bash("printf 'protocol=https\\nhost=github.com\\n\\n' | git credential fill")],
    ["git credential-manager get", bash("echo host=github.com | git credential-manager get")],
    ["git-credential-manager.exe get", pwsh("'host=github.com' | git-credential-manager.exe get")],
    ["cmdkey from the PowerShell tool", pwsh("cmdkey /list")],
  ]) check(`refused: ${what}`, typeof g(call) === "string", String(g(call)));
  check("the refusal says why in one line", /sign-in/.test(g(bash("cat ~/.claude/.credentials.json")) ?? ""));
  for (const [what, call] of [
    ["the repo's own .claude/settings.json", { tool_name: "Read", tool_input: { file_path: "C:\\Users\\J\\Downloads\\Pleo\\agents\\hero\\.claude\\settings.json" } }],
    ["git push of the lane's branch", bash("git push -u origin claude/hero")],
    ["git config user.name", bash("git config user.name")],
    ["an ordinary test", bash("node tests/agents-contract.mjs")],
  ]) check(`goes on: ${what}`, g(call) === null, String(g(call)));
  const hookRun = spawnSync(nodeExe, [join(ROOT, "helper", "agents", "hold-hook.mjs"), "pre", join(tmp, "gate"), join(tmp, "lock"), "hero", "1"],
    { input: JSON.stringify(bash("cat ~/.claude/.credentials.json")), encoding: "utf8", timeout: 20000 });
  check("the real hook refuses it (exit 2)", hookRun.status === 2, `exit ${hookRun.status}`);

  // ---- 3. the daily token cap --------------------------------------------------
  console.log("3. the daily token cap");
  check("the default cap is 2,000,000 tokens a day", Spend.DEFAULT_TOKENS_PER_DAY === 2_000_000);
  check("a cap is a whole number from 10,000 up", Spend.goodCap(50_000) && !Spend.goodCap(0) && !Spend.goodCap(9_999) && !Spend.goodCap(1.5) && !Spend.goodCap("2000000"));
  const capsFile = join(tmp, "state3", "caps.json");
  Spend.writeCapsFile(capsFile, { tokensPerDay: 750_000 });
  check("the dock's change is kept and read back", Spend.readCapsFile(capsFile).tokensPerDay === 750_000);
  writeFileSync(capsFile, "{ not json");
  check("a broken caps file means no kept change (the default stands)", JSON.stringify(Spend.readCapsFile(capsFile)) === "{}");
  const mainText = read("helper/server/main.ts");
  check("the helper falls back to the default cap, never none", /kept\.tokensPerDay \?\? \(goodCap\(given\) \? given : DEFAULT_TOKENS_PER_DAY\)/.test(mainText));
  const tray = read("helper/install/tray.ps1");
  check("the tray passes --tokens-per-day from helper.json (2,000,000 when missing)", /'--tokens-per-day'/.test(tray) && /\$cap = 2000000/.test(tray) && /\$config\.tokensPerDay/.test(tray));
  check("install.ps1 writes tokensPerDay to helper.json", /tokensPerDay = \$TokensPerDay/.test(read("helper/install/install.ps1")) && /\[long\]\$TokensPerDay = 2000000/.test(read("helper/install/install.ps1")));

  // the server's /caps and /api/pc, behind the token
  const shown = [];
  const pairing = new Pa.Pairing({ show: (c) => shown.push(c), file: join(tmp, "state5", "pairing.json") });
  const runner = new R.Runner({ adapters: {}, stateDir: join(tmp, "state3"), spend: new Spend.SpendBook({ caps: { tokensPerDay: 2_000_000 } }), workspace: () => tmp });
  let capsNow = { tokensPerDay: 2_000_000, tokensPerRequest: null, today: 1234 };
  const pcCalls = [];
  const helper = await Sv.startHelperServer({
    runner, pairing, port: 0,
    caps: { get: () => capsNow, set: ({ tokensPerDay }) => { capsNow = { ...capsNow, tokensPerDay }; } },
    pc: {
      read: async () => { pcCalls.push("now"); return { v: 2, kind: "pc", at: 1, marker: "real-pc" }; },
      stop: async (pid, created, confirm) => { pcCalls.push(`stop ${pid} ${created} ${confirm}`); return { v: 2, kind: "pc-stopped", pid, ended: [pid], refused: null, needsConfirm: false }; },
      stopIdle: async (minutes) => { pcCalls.push(`idle ${minutes}`); return { v: 2, kind: "pc-stopped", pid: null, ended: [], refused: null, needsConfirm: false }; },
    },
  });
  const port = helper.port;
  const DOCK = `http://127.0.0.1:${port}`;
  const call = (method, path, { origin = DOCK, token, body } = {}) => new Promise((resolve, reject) => {
    const headers = { host: `127.0.0.1:${port}` };
    if (origin) headers.origin = origin;
    if (token) headers.authorization = `Bearer ${token}`;
    if (body !== undefined) headers["content-type"] = "application/json";
    const req = httpRequest({ host: "127.0.0.1", port, method, path, headers }, (res) => {
      let text = "";
      res.on("data", (c) => { text += c; });
      res.on("end", () => { let json = null; try { json = JSON.parse(text); } catch {} resolve({ status: res.statusCode, json }); });
    });
    req.on("error", reject);
    if (body !== undefined) req.write(JSON.stringify(body));
    req.end();
  });
  let token = null;
  try {
    check("unpaired, /caps is refused (401)", (await call("GET", "/caps")).status === 401);
    await call("POST", "/pair/start");
    const paired = await call("POST", "/pair", { body: { code: shown.at(-1) } });
    token = paired.json?.token;
    check("paired: the dock pairs as before", paired.status === 200 && typeof token === "string");
    const seen = await call("GET", "/caps", { token });
    check("the dock sees the daily cap and today's count", seen.status === 200 && seen.json?.tokensPerDay === 2_000_000 && seen.json?.today === 1234, JSON.stringify(seen.json));
    const set = await call("POST", "/caps", { token, body: { by: "j", tokensPerDay: 500_000 } });
    check("J changes it from the dock", set.status === 200 && set.json?.tokensPerDay === 500_000 && capsNow.tokensPerDay === 500_000, JSON.stringify(set.json));
    check("…a change not by J is refused", (await call("POST", "/caps", { token, body: { by: "runner", tokensPerDay: 9e8 } })).status === 403);
    check("…a cap under 10,000 or not a number is refused", (await call("POST", "/caps", { token, body: { by: "j", tokensPerDay: 5 } })).status === 400 && (await call("POST", "/caps", { token, body: { by: "j", tokensPerDay: "lots" } })).status === 400);
    check("…another origin can't change it", (await call("POST", "/caps", { origin: "https://evil.example", token, body: { by: "j", tokensPerDay: 9e8 } })).status === 403);

    // ---- 8. the PC tab: real data behind the token ------------------------------
    console.log("8. the PC tab");
    check("unpaired, /api/pc/now is refused (401)", (await call("GET", "/api/pc/now", { token: "wrong" })).status === 401);
    const now = await call("GET", "/api/pc/now", { token });
    check("paired, /api/pc/now answers from the PC reader", now.status === 200 && now.json?.marker === "real-pc", JSON.stringify(now.json));
    const stop = await call("POST", "/api/pc/stop", { token, body: { v: 2, kind: "pc-stop", by: "j", pid: 4242, created: 99, confirmSession: false } });
    check("Stop reaches the reader with the pid and its start time", stop.status === 200 && pcCalls.includes("stop 4242 99 false"), JSON.stringify(stop.json));
    check("a message that isn't a pc-stop is refused", (await call("POST", "/api/pc/stop", { token, body: { v: 2, kind: "pc-stop", by: "j" } })).status === 400);
    check("another origin can't press Stop", (await call("POST", "/api/pc/stop", { origin: "https://evil.example", token, body: { v: 2, kind: "pc-stop", by: "j", pid: 1, created: 1, confirmSession: false } })).status === 403);
    const dockText = read("helper/dock/dock.ts");
    check("the dock's PC tab reads through the helper when it isn't the fake", /mode === "helper" \? live\.pc/.test(dockText) && /qs\.get\("pc"\) \?\? \(FAKE \? "fake" : "helper"\)/.test(dockText));
    check("the dock sends the token with the PC calls", /pc: \{[\s\S]*get\("\/api\/pc\/now"\)/.test(read("helper/dock/live.ts")));
  } finally { await helper.close(); }
  const bare = await Sv.startHelperServer({ runner, pairing, port: 0 });
  try {
    const r = await new Promise((resolve) => {
      const req = httpRequest({ host: "127.0.0.1", port: bare.port, method: "GET", path: "/api/pc/now", headers: { host: `127.0.0.1:${bare.port}`, origin: `http://127.0.0.1:${bare.port}`, authorization: `Bearer ${token}` } },
        (res) => { res.resume(); res.on("end", () => resolve(res.statusCode)); });
      req.end();
    });
    check("a helper with no PC reader says so (404), it never shows made-up data", r === 404, String(r));
  } finally { await bare.close(); }

  // ---- 4. merges that change the helper; the pinned line ---------------------------
  console.log("4. merges that change the helper, and the pinned line");
  const plain = { ours: true, p: 2, onlyYou: false };
  for (const file of ["helper/server/server.ts", "helper/install/install.ps1", ".claude/settings.json", ".claude/hooks/pleo/lib.mjs"])
    check(`a merge touching ${file} waits for J`, (Gate.waitsForJ({ ...plain, files: [file] }) ?? "").includes("changes the helper"), String(Gate.waitsForJ({ ...plain, files: [file] })));
  check("a merge of Builder files still goes on its own", Gate.waitsForJ({ ...plain, files: ["src/features/agents/AgentsDock.tsx", "tests/x.mjs"] }) === null);
  const sha = "17bf6272a0c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4";
  check("the install line names the commit, twice (the address and -Commit)", L.installLine(sha).line.split(sha).length === 3 && L.installLine(sha).line.endsWith(` -Commit ${sha}`));
  check("the Builder's copy of the line is the same as the helper's", C.installLine(sha).line === L.installLine(sha).line && C.installLine(null).line === L.installLine(null).line && C.uninstallLine(sha) === L.uninstallLine(sha));
  check("a value that isn't a commit never reaches the line", !C.installLine("abc; calc").line.includes("calc") && !C.installLine("abc; calc").pinned);
  const dockTsx = read("src/features/agents/AgentsDock.tsx");
  check("Set up the helper shows the pinned line from /api/version", /installLine\(commit\)/.test(dockTsx) && /\/api\/version/.test(dockTsx) && /data-agents-install-line/.test(dockTsx));
  if (WIN && gitExe) {
    const origin = join(tmp, "origin");
    mkdirSync(join(origin, "helper", "install"), { recursive: true });
    const git = (...a) => execFileSync(gitExe, ["-C", origin, "-c", "user.name=t", "-c", "user.email=t@t", ...a], { stdio: "pipe", windowsHide: true }).toString().trim();
    git("init", "-q", "-b", "claude/template-ui-website-builder-11bfgl");
    writeFileSync(join(origin, "helper", "install", "tray.ps1"), "# first\n");
    git("add", "."); git("commit", "-q", "-m", "first");
    const first = git("rev-parse", "HEAD");
    writeFileSync(join(origin, "helper", "install", "tray.ps1"), "# second, merged later\n");
    git("commit", "-q", "-am", "second");
    const real = ps("install.ps1", [...common("four"), "-From", origin, "-Commit", first, "-NoDeps", "-NoStart", "-Claude", newest]);
    const repo = join(tmp, "four", "PolioHelper", "polio");
    let head = "";
    try { head = execFileSync(gitExe, ["-C", repo, "rev-parse", "HEAD"], { stdio: "pipe" }).toString().trim(); } catch { /* no clone: the check below says so */ }
    check("install -Commit holds the helper at that commit, not the branch tip", real.status === 0 && head === first, `${head} vs ${first}; ${said(real).trim().split(/\r?\n/).slice(-2).join(" ")}`);
    check("…and the helper's file is that commit's", existsSync(repo) && readFileSync(join(repo, "helper", "install", "tray.ps1"), "utf8").includes("first"));
    const config = existsSync(join(tmp, "four", "PolioHelper", "helper.json")) ? JSON.parse(readFileSync(join(tmp, "four", "PolioHelper", "helper.json"), "utf8")) : {};
    check("helper.json gets the daily cap (2,000,000)", config.tokensPerDay === 2000000, JSON.stringify(config.tokensPerDay));
    const bad = ps("install.ps1", [...common("bad"), "-Commit", "main; calc", "-DryRun"]);
    check("a -Commit that isn't a commit id stops it", bad.status !== 0 && /commit id/.test(said(bad)));
    // ---- 11. no log-on task by default ------------------------------------------
    console.log("11. on demand, not at every log-on");
    const adds = said(real).split(/\r?\n/).filter((l) => l.startsWith("ADD ")).map((l) => l.split(" ")[1]);
    check("the real install adds no task and no Startup shortcut", !adds.includes("task") && !adds.includes("shortcut") && !existsSync(join(tmp, "four", "Startup", "Polio Helper.lnk")), adds.join(","));
    check("…and says the Builder's Start the helper starts it", /Start the helper in the Builder/.test(said(real)));
    const logon = ps("install.ps1", [...common("five"), "-DryRun", "-AtLogOn", "-Claude", newest]);
    check("-AtLogOn still adds the task for whoever wants it", said(logon).split(/\r?\n/).some((l) => l.startsWith("ADD task ")));
    ps("uninstall.ps1", ["-Root", join(tmp, "four", "PolioHelper"), "-ClassesKey", `${testKey}\\Classes`, "-TaskName", `PolioHelperFixesTest-${process.pid}`, "-StartupDir", join(tmp, "four", "Startup"), "-StateDir", join(tmp, "four", "state"), "-NoQuit", "-Everything"]);
  }
  check("the Builder no longer says the helper starts with Windows", !/It starts with Windows/.test(dockTsx) && /doesn&apos;t start with Windows/.test(dockTsx));

  // ---- 5. pairing survives a restart --------------------------------------------
  console.log("5. pairing survives a restart");
  const pfile = join(tmp, "state5", "pairing.json");
  check("pairing keeps a file in the state folder", existsSync(pfile));
  const kept = existsSync(pfile) ? readFileSync(pfile, "utf8") : "";
  check("…holding the token's hash, never the token", !!token && !kept.includes(token) && /"sha256"/.test(kept));
  const again = new Pa.Pairing({ show: () => {}, file: pfile });
  check("a restarted helper still knows the dock's token", again.paired && again.check(token));
  check("…and still refuses a wrong one", !again.check("x".repeat(43)));
  again.unpair();
  check("Unpair deletes the file, so the next start isn't paired", !existsSync(pfile) && !new Pa.Pairing({ show: () => {}, file: pfile }).paired);
  writeFileSync(pfile, '{"sha256":"short"}');
  check("a damaged file pairs nothing", !new Pa.Pairing({ show: () => {}, file: pfile }).paired);
  check("main.ts gives the pairing its file in the state folder", /file: join\(stateDir, "pairing\.json"\)/.test(mainText));

  // ---- 7. Deny ends the code ---------------------------------------------------
  console.log("7. Deny");
  const codes = [];
  const p7 = new Pa.Pairing({ show: (c) => codes.push(c) });
  p7.start();
  const stubRunner = { subscribe: () => () => {}, snapshot: () => [], submit: () => { throw new Error("no"); }, control: async () => ({ ok: true }) };
  await Main.trayCommands(stubRunner, () => {}, p7)("deny");
  const after = p7.finish(codes[0]);
  check("after the tray's deny, the right code no longer pairs", after.ok === false && /no code is waiting/.test(after.error), JSON.stringify(after));
  check("the window's Deny tells the helper (deny), not only closes", /\$deny\.add_Click\(\{ \$script:child\.Say\('deny'\); \$f\.Close\(\) \}\)/.test(tray));

  // ---- 6. the log --------------------------------------------------------------
  console.log("6. the log");
  check("under the tray the helper prints the code only on the @pair line", /values\.tray \? `@pair \$\{code\}`/.test(mainText));
  if (WIN) {
    const cs = /Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/.exec(tray)?.[1] ?? "";
    writeFileSync(join(tmp, "child.cs"), cs);
    const log = join(tmp, "logs", "helper.log");
    mkdirSync(dirname(log), { recursive: true });
    const run = spawnSync(PS, ["-NoProfile", "-NonInteractive", "-Command", `Add-Type -TypeDefinition (Get-Content -Raw '${join(tmp, "child.cs")}');
      $a = [PolioHelperChild]::Keep('${log}', '@pair 123456');
      $b = [PolioHelperChild]::Keep('${log}', '  Pair with polio-two.vercel.app?  Code: 123 456');
      $c = [PolioHelperChild]::Keep('${log}', 'Polio Helper on http://127.0.0.1:47821');
      "$a $b $c"`], { encoding: "utf8", windowsHide: true, timeout: 60000 });
    check("an @pair line and a human code line are not logged; others are", run.stdout.trim() === "False False True", (run.stdout + run.stderr).trim().split("\n")[0]);
    const text = existsSync(log) ? readFileSync(log, "utf8") : "";
    check("the log holds no code", !/123 ?456/.test(text) && /Polio Helper on/.test(text), text.trim());
    writeFileSync(log, ("old line ".repeat(10) + "\n").repeat(12000)); // about 1.1 MB
    const big = spawnSync(PS, ["-NoProfile", "-NonInteractive", "-Command", `Add-Type -TypeDefinition (Get-Content -Raw '${join(tmp, "child.cs")}');
      for ($i = 0; $i -lt 50; $i++) { [void][PolioHelperChild]::Keep('${log}', "new line $i") }; 'ok'`], { encoding: "utf8", windowsHide: true, timeout: 60000 });
    const size = statSync(log).size;
    const tail = readFileSync(log, "utf8");
    check("a log past 1 MB keeps its newest half and stays under 1 MB", big.stdout.trim() === "ok" && size <= 1048576 && size > 400000, `${size} bytes`);
    check("…the newest lines are kept, whole", /new line 49\r?\n$/.test(tail) && tail.startsWith("old line ") === true);
  }

  // ---- 9. uninstall names what it leaves ------------------------------------------
  console.log("9. what uninstall leaves");
  if (WIN) {
    const uHome = join(tmp, "nine", "home");
    const pleo = join(tmp, "nine", "Pleo");
    const key = join(pleo, "agents").replace(/[^A-Za-z0-9]/g, "-");
    mkdirSync(join(uHome, ".claude", "projects", `${key}-hero-calm`), { recursive: true });
    mkdirSync(join(uHome, ".claude", "projects", "C--somewhere-else"), { recursive: true });
    mkdirSync(join(tmp, "nine", "local", "ms-playwright"), { recursive: true });
    const un = ps("uninstall.ps1", ["-Root", join(tmp, "nine", "PolioHelper"), "-ClassesKey", `${testKey}\\Classes`, "-TaskName", `PolioHelperFixesTest-${process.pid}`, "-StartupDir", join(tmp, "nine", "Startup"),
      "-StateDir", join(tmp, "nine", "state"), "-Pleo", pleo, "-UserHome", uHome, "-LocalAppData", join(tmp, "nine", "local"), "-DryRun"]);
    const left = said(un).split(/\r?\n/).filter((l) => l.startsWith("LEFT "));
    check("uninstall names the Playwright browser it leaves", left.some((l) => /ms-playwright/.test(l)), left.join(" | "));
    check("…the lanes' transcripts, counted (1 here, not J's own chats)", left.some((l) => /transcript/.test(l) && /\(1 folder/.test(l)));
    check("…the dock's token in the browser's storage", left.some((l) => /127\.0\.0\.1:47821/.test(l) && /storage/.test(l)));
    check("…the lane folders and branches", left.some((l) => /lanes' folders/.test(l)) && left.some((l) => /branches on GitHub/.test(l)));
    check("each LEFT line is followed by how to remove it", said(un).split(/\r?\n/).every((l, i, all) => !l.startsWith("LEFT ") || /^\s{2}\S/.test(all[i + 1] ?? "")));
  }

  // ---- 10. dev servers on this PC only ------------------------------------------------
  console.log("10. dev servers on 127.0.0.1");
  check("refused: npm run dev with no host", typeof g(bash("PORT=3100 npm run dev")) === "string");
  check("refused: npx next dev -p 3100", typeof g(bash("npx next dev -p 3100")) === "string");
  check("refused: next start -H 0.0.0.0", typeof g(pwsh("npx next start -H 0.0.0.0 -p 3101")) === "string");
  check("goes on: npm run dev -- -H 127.0.0.1 -p 3100", g(bash("npm run dev -- -H 127.0.0.1 -p 3100")) === null);
  check("goes on: next start --hostname=localhost", g(bash("npx next start --hostname=localhost -p 3101")) === null);
  check("every lane's brief says -H 127.0.0.1", /-H 127\.0\.0\.1/.test(Brief.PROGRESS_RULES));
} finally {
  if (WIN) spawnSync(PS, ["-NoProfile", "-NonInteractive", "-Command", `Remove-Item -Path '${testKey}' -Recurse -Force -ErrorAction SilentlyContinue`], { windowsHide: true });
  rmSync(tmp, { recursive: true, force: true });
}
done();
