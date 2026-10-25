# Polio Helper's tray icon: Open, Pause all, Quit.
#
# launch.vbs starts this hidden (at log on, or from a polio-helper:// link).
# It runs the helper (helper/server/main.ts --tray) as a hidden child with its
# stdin and stdout piped, so no console window ever shows:
#   - the helper prints "@pair <code>": a small window shows the code, so only
#     someone at this PC can pair the Builder;
#   - "@ready <port>": the icon says it's running (and -Open opens the dock);
#   - the tray writes "pause-all", "resume-all" or "quit" to the helper.
# Only one tray runs at a time. A second start (another link click) just opens
# the dock if -Open was asked, and leaves.
# uninstall.ps1 asks it to quit through the named event Local\PolioHelperQuit.
param(
  [string]$Root = (Join-Path $env:USERPROFILE 'PolioHelper'),
  [switch]$Open
)
$ErrorActionPreference = 'Stop'

$created = $false
$mutex = New-Object System.Threading.Mutex($true, 'Local\PolioHelperTray', [ref]$created)
$config = Get-Content -Raw (Join-Path $Root 'helper.json') | ConvertFrom-Json
if (-not $created) {
  if ($Open) { Start-Process $config.dock }
  return
}
$quitEvent = New-Object System.Threading.EventWaitHandle($false, [System.Threading.EventResetMode]::ManualReset, 'Local\PolioHelperQuit')
[void]$quitEvent.Reset()

Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -TypeDefinition @'
using System;
using System.Collections.Concurrent;
using System.Diagnostics;
using System.IO;
public class PolioHelperChild {
  public readonly ConcurrentQueue<string> Lines = new ConcurrentQueue<string>();
  public Process P;
  public PolioHelperChild(string node, string args, string cwd, string log) {
    var si = new ProcessStartInfo(node, args);
    si.WorkingDirectory = cwd;
    si.UseShellExecute = false;
    si.CreateNoWindow = true;
    si.WindowStyle = ProcessWindowStyle.Hidden;
    si.RedirectStandardInput = true;
    si.RedirectStandardOutput = true;
    si.RedirectStandardError = true;
    P = new Process();
    P.StartInfo = si;
    DataReceivedEventHandler keep = (s, e) => {
      if (e.Data == null) return;
      Lines.Enqueue(e.Data);
      try { File.AppendAllText(log, DateTime.Now.ToString("s") + " " + e.Data + Environment.NewLine); } catch { }
    };
    P.OutputDataReceived += keep;
    P.ErrorDataReceived += keep;
    P.Start();
    P.BeginOutputReadLine();
    P.BeginErrorReadLine();
  }
  public void Say(string line) { try { P.StandardInput.WriteLine(line); P.StandardInput.Flush(); } catch { } }
}
'@

$logs = Join-Path $Root 'logs'
New-Item -ItemType Directory -Force -Path $logs | Out-Null
$log = Join-Path $logs 'helper.log'
$main = Join-Path $config.repo 'helper\server\main.ts'
$q = { param($s) '"' + $s + '"' }
$helperArgs = @((& $q $main), '--tray', '--repo', (& $q $config.repo), '--handovers', (& $q $config.handovers), '--agents', (& $q $config.agents))
if ($config.claude) { $helperArgs += @('--claude', (& $q $config.claude)) }
$argLine = $helperArgs -join ' '

$script:child = $null
$script:starts = @()
$script:paused = $false
$script:quitting = $false
function Start-Helper {
  $script:starts = @($script:starts | Where-Object { $_ -gt (Get-Date).AddMinutes(-10) }) + (Get-Date)
  $script:child = New-Object PolioHelperChild($config.node, $argLine, $config.repo, $log)
}

# A plain round icon, drawn here so there is no image file to ship.
$bmp = New-Object System.Drawing.Bitmap 16, 16
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 99, 102, 241))), 1, 1, 14, 14)
$g.FillEllipse([System.Drawing.Brushes]::White, 5, 5, 6, 6)
$g.Dispose()

$icon = New-Object System.Windows.Forms.NotifyIcon
$icon.Icon = [System.Drawing.Icon]::FromHandle($bmp.GetHicon())
$icon.Text = 'Polio Helper: starting'
$menu = New-Object System.Windows.Forms.ContextMenuStrip
$openItem = $menu.Items.Add('Open')
$pauseItem = $menu.Items.Add('Pause all')
[void]$menu.Items.Add('-')
$quitItem = $menu.Items.Add('Quit')
$icon.ContextMenuStrip = $menu
$icon.Visible = $true

$openItem.add_Click({ Start-Process $config.dock })
$icon.add_DoubleClick({ Start-Process $config.dock })
$pauseItem.add_Click({
  if ($script:paused) { $script:child.Say('resume-all'); $pauseItem.Text = 'Pause all'; $script:paused = $false }
  else { $script:child.Say('pause-all'); $pauseItem.Text = 'Resume all'; $script:paused = $true }
})
function Stop-All {
  if ($script:quitting) { return }
  $script:quitting = $true
  $icon.Text = 'Polio Helper: stopping'
  if ($script:child -and -not $script:child.P.HasExited) {
    $script:child.Say('quit')
    if (-not $script:child.P.WaitForExit(20000)) { try { $script:child.P.Kill() } catch { } }
  }
  $icon.Visible = $false
  $icon.Dispose()
  [System.Windows.Forms.Application]::Exit()
}
$quitItem.add_Click({ Stop-All })

function Show-Code([string]$code) {
  $f = New-Object System.Windows.Forms.Form
  $f.Text = 'Polio Helper'
  $f.TopMost = $true
  $f.FormBorderStyle = 'FixedDialog'
  $f.MaximizeBox = $false
  $f.MinimizeBox = $false
  $f.StartPosition = 'CenterScreen'
  $f.ClientSize = New-Object System.Drawing.Size 320, 150
  $l = New-Object System.Windows.Forms.Label
  $l.Text = "Pair with polio-two.vercel.app?`n`nCode:  $($code.Substring(0,3)) $($code.Substring(3))`n`nType it in the dock. It works for 5 minutes."
  $l.Font = New-Object System.Drawing.Font 'Segoe UI', 10
  $l.SetBounds(16, 12, 290, 96)
  $deny = New-Object System.Windows.Forms.Button
  $deny.Text = 'Deny'
  $deny.SetBounds(224, 112, 80, 28)
  $deny.add_Click({ $f.Close() })
  $f.Controls.AddRange(@($l, $deny))
  $f.Show()
}

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 500
$timer.add_Tick({
  if ($quitEvent.WaitOne(0)) { Stop-All; return }
  $line = $null
  while ($script:child.Lines.TryDequeue([ref]$line)) {
    if ($line -match '^@pair (\d{6})$') { Show-Code $Matches[1] }
    elseif ($line -match '^@ready (\d+)$') {
      $icon.Text = 'Polio Helper: running'
      if ($Open) { Start-Process $config.dock; $script:Open = $false }
    }
  }
  if (-not $script:quitting -and $script:child.P.HasExited) {
    if ($script:starts.Count -lt 3) { $icon.Text = 'Polio Helper: restarting'; Start-Helper }
    else {
      $icon.Text = 'Polio Helper: stopped'
      $icon.ShowBalloonTip(8000, 'Polio Helper stopped', "It stopped 3 times in 10 minutes. The log is $log", 'Warning')
      $timer.Stop()
    }
  }
})

Start-Helper
$timer.Start()
[System.Windows.Forms.Application]::Run()
$mutex.ReleaseMutex()
