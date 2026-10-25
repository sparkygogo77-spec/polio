# Polio Helper: uninstall. Removes everything install.ps1 added:
#   - the tray and the helper (asked to quit first, so lanes stop cleanly);
#   - the "at log on" task, or the Startup-folder shortcut;
#   - the polio-helper:// link (HKCU\Software\Classes\polio-helper);
#   - %USERPROFILE%\PolioHelper (the helper's clone, config, launcher, logs);
#   - %LOCALAPPDATA%\PolioHelper (the helper's own state).
# It reads installed.json for what was added, and also removes the default
# places, so it works even if that file is gone.
#
# Lanes' folders in Pleo\agents are your work, so they are kept. While any
# exist, the clone they belong to is kept too (say -Everything to remove it);
# their branches are on GitHub either way.
#
# -DryRun prints what it would remove, and changes nothing.
param(
  [string]$Root = (Join-Path $env:USERPROFILE 'PolioHelper'),
  [string]$ClassesKey = 'HKCU:\Software\Classes',
  [string]$TaskName = 'Polio Helper',
  [string]$StartupDir = '',
  [string]$StateDir = (Join-Path $env:LOCALAPPDATA 'PolioHelper'),
  [switch]$Everything,
  [switch]$NoQuit,
  [switch]$DryRun
)
$ErrorActionPreference = 'Stop'
if (-not $StartupDir) { $StartupDir = [Environment]::GetFolderPath('Startup') }

$targets = [ordered]@{}
function Want([string]$kind, [string]$target) { $targets["$kind|$target"] = @{ kind = $kind; target = $target } }
Want 'folder' $Root
Want 'registry' (Join-Path $ClassesKey 'polio-helper')
Want 'task' $TaskName
Want 'state' $StateDir
$manifest = Join-Path $Root 'installed.json'
if (Test-Path $manifest) {
  foreach ($a in (Get-Content -Raw $manifest | ConvertFrom-Json).added) { Want $a.kind $a.target }
}
if (Test-Path (Join-Path $StartupDir 'Polio Helper.lnk')) { Want 'shortcut' (Join-Path $StartupDir 'Polio Helper.lnk') }

Write-Host 'STEP quit : ask the tray and the helper to stop'
if (-not $DryRun -and -not $NoQuit) {
  $quit = $null
  if ([System.Threading.EventWaitHandle]::TryOpenExisting('Local\PolioHelperQuit', [ref]$quit)) {
    [void]$quit.Set()
    $until = (Get-Date).AddSeconds(30)
    $m = $null
    while ((Get-Date) -lt $until -and [System.Threading.Mutex]::TryOpenExisting('Local\PolioHelperTray', [ref]$m)) { $m.Dispose(); Start-Sleep -Milliseconds 500 }
  }
}

$repo = Join-Path $Root 'polio'
$keepRepo = $false
if (-not $Everything -and (Test-Path (Join-Path $repo '.git'))) {
  $trees = @(& git -C $repo worktree list --porcelain 2>$null | Where-Object { $_ -like 'worktree *' })
  if ($trees.Count -gt 1) {
    $keepRepo = $true
    Write-Host "  $($trees.Count - 1) lane folder(s) still use $repo, so it is kept. Say -Everything to remove it too."
  }
}

Write-Host 'STEP remove : everything install added'
foreach ($t in $targets.Values) {
  $kind = $t.kind; $target = $t.target
  switch ($kind) {
    'task' {
      $has = Get-ScheduledTask -TaskName $target -ErrorAction SilentlyContinue
      if ($DryRun -or $has) { Write-Host "REMOVE task $target" }
      if (-not $DryRun -and $has) { Unregister-ScheduledTask -TaskName $target -Confirm:$false }
    }
    'registry' {
      Write-Host "REMOVE registry $target"
      if (-not $DryRun -and (Test-Path $target)) { Remove-Item -Path $target -Recurse -Force }
    }
    'shortcut' {
      Write-Host "REMOVE shortcut $target"
      if (-not $DryRun -and (Test-Path $target)) { Remove-Item -Path $target -Force }
    }
    { $_ -in 'folder', 'state' } {
      Write-Host "REMOVE $kind $target"
      if (-not $DryRun -and (Test-Path $target)) {
        if ($kind -eq 'folder' -and $keepRepo) {
          Get-ChildItem -Force $target | Where-Object { $_.FullName -ne $repo } | Remove-Item -Recurse -Force
        } else {
          Remove-Item -Path $target -Recurse -Force
        }
      }
    }
  }
}

Write-Host ''
if ($DryRun) { Write-Host 'Dry run: nothing was changed.' } else { Write-Host 'Polio Helper is removed.' }
