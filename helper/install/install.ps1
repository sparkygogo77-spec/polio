# Polio Helper: install once (AGENTS-PANEL-PROPOSAL.md, section 2, "Install once").
#
# The Agents dock's "Set up the helper" shows one line to paste into PowerShell
# (helper/install/line.ts). It runs this file straight from the polio repo, so
# you can read it first at the same address.
#
# What it does, as you (no admin rights, nothing elevated):
#   1. checks Node 24 and Git, and finds Claude Code;
#   2. puts the helper in %USERPROFILE%\PolioHelper (a clone of the polio repo,
#      plus its packages and the browser the live check uses);
#   3. registers the polio-helper:// link for you only (HKCU). The link can do
#      two things: start the helper, or bring up its dock. Anything else in a
#      link is refused before anything runs;
#   4. adds a hidden "at log on" task for you (or, if Windows refuses that, a
#      shortcut in your Startup folder), so the helper starts with Windows;
#   5. starts the tray icon: Open, Pause all, Quit.
#
# What it never does:
#   - ask for an API key, or read, store or pass on a Claude sign-in. The
#     helper runs your own Claude Code under your existing sign-in;
#   - touch certificates, trust stores, firewall, Defender, UAC, the execution
#     policy or any other security setting;
#   - write outside %USERPROFILE%\PolioHelper, your user's registry
#     (HKCU\Software\Classes\polio-helper), your own scheduled task and
#     Startup folder.
#
# Everything it adds is listed in %USERPROFILE%\PolioHelper\installed.json,
# and uninstall.ps1 (next to this file) removes all of it.
#
# -DryRun prints each step and what it would add, and changes nothing.
param(
  [string]$Root = (Join-Path $env:USERPROFILE 'PolioHelper'),
  [string]$Pleo = (Join-Path $env:USERPROFILE 'Downloads\Pleo'),
  [string]$From = 'https://github.com/sparkygogo77-spec/polio.git',
  [string]$Branch = 'claude/template-ui-website-builder-11bfgl',
  [string]$Node = '',
  [string]$Git = '',
  [string]$Claude = '',
  [string]$ClassesKey = 'HKCU:\Software\Classes',
  [string]$TaskName = 'Polio Helper',
  [string]$StartupDir = '',
  [string]$StateDir = (Join-Path $env:LOCALAPPDATA 'PolioHelper'),
  [switch]$NoDeps,
  [switch]$NoTask,
  [switch]$NoStart,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'

$Link = 'polio-helper'
$Repo = Join-Path $Root 'polio'
$Launcher = Join-Path $Root 'launch.vbs'
$Wscript = Join-Path $env:SystemRoot 'System32\wscript.exe'
if (-not $StartupDir) { $StartupDir = [Environment]::GetFolderPath('Startup') }
$Added = New-Object System.Collections.ArrayList

function Step([string]$name, [string]$what) { Write-Host "STEP $name : $what" }
function Added([string]$kind, [string]$target) {
  [void]$Added.Add([ordered]@{ kind = $kind; target = $target })
  Write-Host "ADD $kind $target"
}
function Say([string]$text) { Write-Host "  $text" }
function Find([string]$given, [string]$name) {
  if ($given) { return $given }
  $c = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($c) { return $c.Source }
  return ''
}

# ---- 1. checks --------------------------------------------------------------
Step 'check-node' 'Node 24 or newer'
$Node = Find $Node 'node'
if (-not $Node) { throw 'Node is not installed. Install Node 24 from https://nodejs.org, then paste the line again.' }
$nodeVersion = (& $Node --version 2>$null | Out-String).Trim()
if ($nodeVersion -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) {
  throw "Polio Helper needs Node 24 or newer; this PC has $(if ($nodeVersion) { $nodeVersion } else { 'none that answers' }). Install Node 24 from https://nodejs.org, then paste the line again."
}
Say "Node $nodeVersion at $Node"

Step 'check-git' 'Git'
$Git = Find $Git 'git'
if (-not $Git) { throw 'Git is not installed. Install Git from https://git-scm.com, then paste the line again.' }
$gitVersion = (& $Git --version 2>$null | Out-String).Trim()
if ($gitVersion -notmatch '^git version') { throw "Git at $Git doesn't answer. Install Git from https://git-scm.com, then paste the line again." }
Say "$gitVersion at $Git"

Step 'check-claude' 'Claude Code, signed in as you (your plan; no API key)'
if (-not $Claude) {
  $local = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
  $Claude = if (Test-Path $local) { $local } else { Find '' 'claude' }
}
if ($Claude) { Say "Claude Code at $Claude. The helper uses the sign-in it already has." }
else { Say 'Claude Code was not found. Install it and run "claude" once to sign in; the helper waits for it and never asks for a key.' }

# ---- 2. the helper's folder -----------------------------------------------------
Step 'folder' "the helper's folder"
if (-not (Test-Path $Root)) { if (-not $DryRun) { New-Item -ItemType Directory -Path $Root | Out-Null } }
Added 'folder' $Root

Step 'fetch' "the helper's code, from $From ($Branch)"
if (-not $DryRun) {
  if (Test-Path (Join-Path $Repo '.git')) {
    & $Git -C $Repo fetch -q origin $Branch
    & $Git -C $Repo checkout -q $Branch
    & $Git -C $Repo merge -q --ff-only "origin/$Branch"
  } else {
    & $Git clone -q --branch $Branch $From $Repo
  }
  if ($LASTEXITCODE -ne 0) { throw "Git couldn't fetch the helper (exit $LASTEXITCODE)." }
}
Say "into $Repo"

Step 'deps' 'the packages and the live-check browser'
if ($NoDeps) { Say 'skipped (-NoDeps)' }
elseif (-not $DryRun) {
  $npm = Join-Path (Split-Path $Node) 'npm.cmd'
  Push-Location $Repo
  try {
    & $npm ci --no-audit --no-fund --loglevel=error
    if ($LASTEXITCODE -ne 0) { throw "npm ci failed (exit $LASTEXITCODE)." }
    & $Node node_modules/playwright-core/cli.js install chromium-headless-shell
    if ($LASTEXITCODE -ne 0) { Say 'The live-check browser did not install; merges still work, the live check says it did not run.' }
  } finally { Pop-Location }
}

Step 'config' 'helper.json: where Node, the repo, Pleo and Claude Code are'
$config = [ordered]@{
  node = $Node; repo = $Repo; pleo = $Pleo
  handovers = (Join-Path $Pleo 'handovers'); agents = (Join-Path $Pleo 'agents')
  claude = $Claude; dock = 'http://127.0.0.1:47821/dock/'
}
if (-not $DryRun) { $config | ConvertTo-Json | Set-Content -Encoding ASCII (Join-Path $Root 'helper.json') }

# ---- 3. the launcher and the link ------------------------------------------------
# The launcher is the only thing the link, the log-on task and the Startup
# shortcut run. It takes exactly one word, start or open (as itself or as
# polio-helper://start or polio-helper://open), refuses anything else, and
# never passes any part of the link on: the command it runs is fixed here.
Step 'launcher' 'launch.vbs: starts the tray hidden, or opens the dock'
$tray = Join-Path $Repo 'helper\install\tray.ps1'
$run = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File """"$tray"""" -Root """"$Root"""""
$vbs = @"
' Polio Helper launcher, written by install.ps1. Accepts start or open only.
Option Explicit
Dim sh, arg, act
act = ""
arg = ""
If WScript.Arguments.Count = 1 Then arg = LCase(WScript.Arguments(0))
Select Case arg
  Case "start", "polio-helper://start", "polio-helper://start/" : act = "start"
  Case "open", "polio-helper://open", "polio-helper://open/" : act = "open"
End Select
If act = "" Then WScript.Quit 2
Set sh = CreateObject("WScript.Shell")
Dim cmd
cmd = "$run"
If act = "open" Then cmd = cmd & " -Open"
If sh.Environment("PROCESS")("POLIO_HELPER_LINK_DRYRUN") = "1" Then
  WScript.Echo act & " | " & cmd
  WScript.Quit 0
End If
sh.Run cmd, 0, False
"@
if (-not $DryRun) { Set-Content -Path $Launcher -Value ($vbs -replace "`r?`n", "`r`n") -Encoding ASCII -NoNewline }
Say $Launcher

Step 'link' "the ${Link}:// link, for you only"
$key = Join-Path $ClassesKey $Link
if (-not $DryRun) {
  New-Item -Path "$key\shell\open\command" -Force | Out-Null
  Set-ItemProperty -Path $key -Name '(default)' -Value 'URL:Polio Helper'
  Set-ItemProperty -Path $key -Name 'URL Protocol' -Value ''
  Set-ItemProperty -Path "$key\shell\open\command" -Name '(default)' -Value "`"$Wscript`" `"$Launcher`" `"%1`""
}
Added 'registry' $key

# ---- 4. start with Windows -----------------------------------------------------
Step 'logon' 'start with Windows, hidden'
$shortcut = Join-Path $StartupDir 'Polio Helper.lnk'
if ($NoTask) { Say 'skipped (-NoTask)' }
elseif ($DryRun) { Added 'task' $TaskName }
else {
  try {
    $me = "$env:USERDOMAIN\$env:USERNAME"
    $action = New-ScheduledTaskAction -Execute $Wscript -Argument "`"$Launcher`" start"
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $me
    $principal = New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive -RunLevel Limited
    $settings = New-ScheduledTaskSettingsSet -Hidden -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
    Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Description 'Starts Polio Helper (tray) when you log on. Added by helper/install/install.ps1.' -Force | Out-Null
    Added 'task' $TaskName
  } catch {
    Say "Windows didn't take a log-on task without admin ($($_.Exception.Message.Trim())); using your Startup folder instead."
    $ws = New-Object -ComObject WScript.Shell
    $lnk = $ws.CreateShortcut($shortcut)
    $lnk.TargetPath = $Wscript
    $lnk.Arguments = "`"$Launcher`" start"
    $lnk.WindowStyle = 7
    $lnk.Description = 'Polio Helper'
    $lnk.Save()
    Added 'shortcut' $shortcut
  }
}

# The helper's own state (job launcher, pause gates, live-check shots) is made
# when it runs; uninstall removes it too.
Added 'state' $StateDir

if (-not $DryRun) {
  [ordered]@{ installedAt = (Get-Date).ToString('o'); root = $Root; added = $Added } | ConvertTo-Json -Depth 4 |
    Set-Content -Encoding ASCII (Join-Path $Root 'installed.json')
}

# ---- 5. start it -----------------------------------------------------------------
Step 'start' 'the tray icon: Open, Pause all, Quit'
if ($NoStart -or $DryRun) { Say 'not started now' }
else { Start-Process -FilePath $Wscript -ArgumentList "`"$Launcher`"", 'start' }

Write-Host ''
if ($DryRun) { Write-Host 'Dry run: nothing was changed.' }
else { Write-Host 'Polio Helper is installed. In the Builder, open Agents and press Pair with this PC.' }
