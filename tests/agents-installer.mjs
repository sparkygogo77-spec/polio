/**
 * Agents panel, the installer (helper/install/*).
 *
 * - The one line the dock shows runs install.ps1 from the repo's base branch.
 * - The scripts never ask for admin, an API key or a sign-in token, and never
 *   touch certificates, trust stores or security settings.
 * - Install's steps, in dry-run: the order, what each adds, and that nothing
 *   changes. A Node older than 24 stops it before anything is added.
 * - A real install into a scratch folder (a tiny local repo, a test registry
 *   key, no task, no start): the polio-helper:// launcher accepts start and
 *   open only, and uninstall removes everything install added.
 *
 * Nothing is installed for real: the registry key is a test key under
 * HKCU\Software\PolioHelperTest-*, removed at the end, and no task, shortcut,
 * tray or helper is started. The Windows parts are skipped elsewhere.
 *
 *   node tests/agents-installer.mjs
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = () => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};

const here = fileURLToPath(new URL("../helper/install/", import.meta.url));
const file = (n) => join(here, n);
const names = ["install.ps1", "uninstall.ps1", "tray.ps1", "line.ts"];
check("the installer's files are there", names.every((n) => existsSync(file(n))), names.filter((n) => !existsSync(file(n))).join(", "));
if (!names.every((n) => existsSync(file(n)))) done();
const text = Object.fromEntries(names.map((n) => [n, readFileSync(file(n), "utf8")]));
const scripts = ["install.ps1", "uninstall.ps1", "tray.ps1"];

// ---- the line --------------------------------------------------------------
const L = await import("../helper/install/line.ts");
check("the line runs install.ps1 from the base branch on GitHub",
  L.INSTALL_LINE === "& ([scriptblock]::Create((irm 'https://raw.githubusercontent.com/sparkygogo77-spec/polio/claude/template-ui-website-builder-11bfgl/helper/install/install.ps1')))", L.INSTALL_LINE);
check("the uninstall line is the same shape", L.UNINSTALL_LINE.endsWith("/helper/install/uninstall.ps1')))"));
check("the Builder's links are start and open only", JSON.stringify(Object.values(L.LINKS)) === '["polio-helper://start","polio-helper://open"]');

// ---- what the scripts never do ------------------------------------------------
const NEVER = [
  [/RunLevel\s+Highest|-Verb\s+RunAs|requireAdministrator/i, "admin rights"],
  [/Cert:|Import-Certificate|certutil|X509Store|Import-PfxCertificate/i, "certificates and trust stores"],
  [/Set-ExecutionPolicy|Set-MpPreference|Add-MpPreference|netsh|New-NetFirewallRule|EnableLUA/i, "security settings"],
  [/HKLM:|HKEY_LOCAL_MACHINE/i, "the machine's registry"],
  [/Read-Host|Get-Credential|ANTHROPIC_API_KEY|CLAUDE_CODE_OAUTH_TOKEN|setup-token|CredWrite|cmdkey/i, "API keys and sign-in tokens"],
];
for (const n of scripts) for (const [re, what] of NEVER) {
  const code = text[n].split("\n").filter((l) => !l.trimStart().startsWith("#")).join("\n");
  check(`${n} leaves alone: ${what}`, !re.test(code), re.exec(code)?.[0]);
}
for (const n of scripts) check(`${n} is plain ASCII (Windows PowerShell 5.1 reads it right)`, /^[\x09\x0a\x0d\x20-\x7e]*$/.test(text[n]));
check("the tray starts the helper with no window", /CreateNoWindow = true/.test(text["tray.ps1"]) && /UseShellExecute = false/.test(text["tray.ps1"]));
check("the tray runs the helper with --tray", /'--tray'/.test(text["tray.ps1"]));
check("the launcher starts the tray hidden (window style 0, -WindowStyle Hidden)", /sh\.Run cmd, 0, False/.test(text["install.ps1"]) && /-WindowStyle Hidden/.test(text["install.ps1"]));
check("the log-on task is hidden and limited", /-Hidden/.test(text["install.ps1"]) && /-RunLevel Limited/.test(text["install.ps1"]));
check("the link is registered for this user only (HKCU)", /'HKCU:\\Software\\Classes'/.test(text["install.ps1"]));

if (process.platform !== "win32") {
  console.log("  (the dry runs, the launcher and uninstall run on Windows only)");
  done();
}

// ---- Windows: dry runs, a sandboxed install, the launcher, uninstall --------------
const tmp = mkdtempSync(join(tmpdir(), "polio-installer-"));
const testKey = `HKCU:\\Software\\PolioHelperTest-${process.pid}`;
const classes = `${testKey}\\Classes`;
const ps = (script, args) => spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", file(script), ...args],
  { encoding: "utf8", windowsHide: true, timeout: 120000 });
const regHas = (key) => spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `if (Test-Path '${key}') { 'yes' } else { 'no' }`], { encoding: "utf8", windowsHide: true }).stdout.trim() === "yes";
const regValue = (key) => spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `(Get-ItemProperty -Path '${key}').'(default)'`], { encoding: "utf8", windowsHide: true }).stdout.trim();
const listed = (out, word) => out.split(/\r?\n/).filter((l) => l.startsWith(`${word} `)).map((l) => l.slice(word.length + 1).trim()).sort();

try {
  const root = join(tmp, "PolioHelper");
  const state = join(tmp, "state");
  const common = ["-Root", root, "-Pleo", join(tmp, "Pleo"), "-ClassesKey", classes, "-TaskName", `PolioHelperTest-${process.pid}`, "-StartupDir", join(tmp, "Startup"), "-StateDir", state];

  // every script parses, and the tray's C# compiles
  for (const n of scripts) {
    const r = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
      `$e = $null; [void][System.Management.Automation.Language.Parser]::ParseFile('${file(n)}', [ref]$null, [ref]$e); $e | ForEach-Object { $_.Message }`], { encoding: "utf8", windowsHide: true });
    check(`${n} parses in Windows PowerShell`, r.status === 0 && r.stdout.trim() === "", r.stdout.trim().split("\n")[0]);
  }
  const cs = /Add-Type -TypeDefinition @'\r?\n([\s\S]*?)\r?\n'@/.exec(text["tray.ps1"])?.[1] ?? "";
  writeFileSync(join(tmp, "child.cs"), cs);
  const compiled = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Add-Type -TypeDefinition (Get-Content -Raw '${join(tmp, "child.cs")}'); [PolioHelperChild].Name`], { encoding: "utf8", windowsHide: true });
  check("the tray's hidden-child class compiles", compiled.stdout.trim() === "PolioHelperChild", (compiled.stderr || "").trim().split("\n")[0]);

  // dry run
  const dry = ps("install.ps1", [...common, "-DryRun"]);
  const steps = dry.stdout.split(/\r?\n/).filter((l) => l.startsWith("STEP ")).map((l) => l.split(" ")[1]);
  check("dry run: it succeeds", dry.status === 0, dry.stderr.trim().split("\n")[0]);
  check("dry run: the steps, in order", steps.join(",") === "check-node,check-git,check-claude,folder,fetch,deps,config,launcher,link,logon,start", steps.join(","));
  const addsDry = listed(dry.stdout, "ADD");
  check("dry run: it says what it would add (folder, link, task, state)",
    JSON.stringify(addsDry.map((a) => a.split(" ")[0])) === JSON.stringify(["folder", "registry", "state", "task"]), addsDry.join(" | "));
  check("dry run: nothing changed (no folder, no link)", !existsSync(root) && !regHas(classes));
  check("dry run: it never asks for an API key", !/api key/i.test(dry.stdout.replace(/no API key|never asks for a key/gi, "")));

  const unDry = ps("uninstall.ps1", [...common, "-DryRun"]);
  check("dry-run uninstall removes what dry-run install adds", JSON.stringify(listed(unDry.stdout, "REMOVE")) === JSON.stringify(addsDry), listed(unDry.stdout, "REMOVE").join(" | "));

  // Node too old
  const old = join(tmp, "node22.cmd");
  writeFileSync(old, "@echo v22.11.0\r\n");
  const tooOld = ps("install.ps1", [...common, "-Node", old, "-DryRun"]);
  check("Node 22: it stops and says Node 24", tooOld.status !== 0 && /Node 24/.test(tooOld.stdout + tooOld.stderr), (tooOld.stdout + tooOld.stderr).split("\n").find((l) => /Node/.test(l)));
  check("Node 22: it stops before the first change", !/STEP folder/.test(tooOld.stdout) && !existsSync(root));

  // a tiny origin for the real (sandboxed) run
  const origin = join(tmp, "origin");
  mkdirSync(join(origin, "helper", "install"), { recursive: true });
  writeFileSync(join(origin, "helper", "install", "tray.ps1"), "# stand-in\n");
  const git = (...a) => execFileSync("git", ["-C", origin, ...a], { stdio: "pipe", windowsHide: true });
  git("init", "-q", "-b", "claude/template-ui-website-builder-11bfgl");
  git("-c", "user.name=t", "-c", "user.email=t@t", "add", ".");
  git("-c", "user.name=t", "-c", "user.email=t@t", "commit", "-q", "-m", "stand-in");

  const real = ps("install.ps1", [...common, "-From", origin, "-NoDeps", "-NoTask", "-NoStart"]);
  check("sandboxed install: it succeeds", real.status === 0, (real.stderr || real.stdout).trim().split("\n").slice(-2).join(" "));
  const launcher = join(root, "launch.vbs");
  check("sandboxed install: the clone, helper.json, launch.vbs and installed.json are there",
    ["polio/helper/install/tray.ps1", "helper.json", "launch.vbs", "installed.json"].every((p) => existsSync(join(root, p))));
  const cmd = regValue(`${classes}\\polio-helper\\shell\\open\\command`);
  check("the link runs only the launcher, with the link as its one argument", /^"[^"]*\\wscript\.exe" "[^"]*\\launch\.vbs" "%1"$/i.test(cmd), cmd);
  check("the link is marked as a URL protocol", spawnSync("powershell.exe", ["-NoProfile", "-Command", `(Get-ItemProperty -Path '${classes}\\polio-helper').PSObject.Properties.Name -contains 'URL Protocol'`], { encoding: "utf8", windowsHide: true }).stdout.trim() === "True");
  const config = JSON.parse(readFileSync(join(root, "helper.json"), "utf8"));
  check("helper.json names Node, the clone and Pleo's folders, and no key", config.repo === join(root, "polio") && /node/i.test(config.node) && config.agents === join(tmp, "Pleo", "agents") && !/key|token/i.test(JSON.stringify(Object.keys(config))));

  // the launcher: start and open, nothing else
  const link = (...args) => spawnSync("cscript.exe", ["//nologo", launcher, ...args], { encoding: "utf8", windowsHide: true, env: { ...process.env, POLIO_HELPER_LINK_DRYRUN: "1" } });
  for (const [arg, act] of [["polio-helper://start", "start"], ["polio-helper://start/", "start"], ["POLIO-HELPER://Start", "start"], ["polio-helper://open", "open"], ["polio-helper://open/", "open"], ["start", "start"]]) {
    const r = link(arg);
    check(`the link takes ${arg}`, r.status === 0 && r.stdout.trim().startsWith(`${act} | `), r.stdout.trim().slice(0, 60));
  }
  const started = link("polio-helper://start").stdout;
  check("start runs the tray hidden, from the clone, with nothing from the link", /powershell\.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "[^"]*\\polio\\helper\\install\\tray\.ps1" -Root "[^"]*"$/.test(started.split(" | ")[1]?.trim() ?? ""), started.trim());
  check("open adds -Open and nothing else", link("polio-helper://open").stdout.trim().endsWith(`-Root "${root}" -Open`));
  for (const bad of ["polio-helper://run", "polio-helper://start?cmd=calc", "polio-helper://start/../x", "polio-helper://open&calc", 'polio-helper://start" -Command calc', "polio-helper://", "", "stop", "polio-helper://quit"]) {
    const r = link(bad);
    check(`the link refuses ${JSON.stringify(bad)}`, r.status === 2 && r.stdout.trim() === "", `exit ${r.status} ${r.stdout.trim()}`);
  }
  const two = link("polio-helper://start", "polio-helper://open");
  check("the link refuses two arguments", two.status === 2 && two.stdout.trim() === "");
  const none = link();
  check("the launcher refuses no argument", none.status === 2);

  // uninstall
  mkdirSync(join(state, "gates"), { recursive: true });
  const addsReal = JSON.parse(readFileSync(join(root, "installed.json"), "utf8")).added.map((a) => `${a.kind} ${a.target}`).sort();
  const un = ps("uninstall.ps1", [...common, "-NoQuit"]);
  check("uninstall: it succeeds", un.status === 0, (un.stderr || un.stdout).trim().split("\n").slice(-2).join(" "));
  const removed = listed(un.stdout, "REMOVE");
  check("uninstall removes every thing installed.json lists", addsReal.every((a) => removed.includes(a)), `added ${addsReal.join(" | ")}; removed ${removed.join(" | ")}`);
  check("uninstall: the folder, the state and the link are gone", !existsSync(root) && !existsSync(state) && !regHas(`${classes}\\polio-helper`));
  check("uninstall leaves Pleo alone", !removed.some((r) => r.includes(join(tmp, "Pleo"))));
} finally {
  spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", `Remove-Item -Path '${testKey}' -Recurse -Force -ErrorAction SilentlyContinue`], { windowsHide: true });
  rmSync(tmp, { recursive: true, force: true });
}
check("the test registry key is gone", !regHas(testKey));
done();
