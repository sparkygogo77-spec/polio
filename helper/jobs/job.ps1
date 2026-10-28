# Starts one command inside a Windows job object, so Stop can end the whole
# tree it started and nothing else. helper/jobs/job.ts runs this with the
# command in POLIO_JOB_SPEC (base64 JSON {cmdline, cwd}) and pipes for stdio.
#
# The launcher puts itself in a new job with KILL_ON_JOB_CLOSE, then starts
# the command with its own stdio handles, so the command and everything it
# starts are in the job too, even a grandchild whose parent has exited.
# The job handle is not inheritable: only this process holds it. When this
# process ends, by Stop (TerminateProcess) or after the command exits,
# Windows closes the handle and kills every process left in the job.
$ErrorActionPreference = 'Stop'

$spec = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($env:POLIO_JOB_SPEC)) | ConvertFrom-Json
[Environment]::SetEnvironmentVariable('POLIO_JOB_SPEC', $null)

$src = @'
using System;
using System.Runtime.InteropServices;

public static class PolioJob1 {
  [StructLayout(LayoutKind.Sequential)]
  struct BASIC_LIMIT {
    public long PerProcessUserTimeLimit; public long PerJobUserTimeLimit; public uint LimitFlags;
    public UIntPtr MinimumWorkingSetSize; public UIntPtr MaximumWorkingSetSize; public uint ActiveProcessLimit;
    public UIntPtr Affinity; public uint PriorityClass; public uint SchedulingClass;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct IO_COUNTERS { public ulong a, b, c, d, e, f; }
  [StructLayout(LayoutKind.Sequential)]
  struct EXTENDED_LIMIT {
    public BASIC_LIMIT Basic; public IO_COUNTERS Io; public UIntPtr ProcessMemoryLimit;
    public UIntPtr JobMemoryLimit; public UIntPtr PeakProcessMemoryUsed; public UIntPtr PeakJobMemoryUsed;
  }
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  struct STARTUPINFO {
    public int cb; public string lpReserved; public string lpDesktop; public string lpTitle;
    public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
    public short wShowWindow, cbReserved2; public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
  }
  [StructLayout(LayoutKind.Sequential)]
  struct PROCESS_INFORMATION { public IntPtr hProcess, hThread; public int dwProcessId, dwThreadId; }

  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateJobObject(IntPtr a, string name);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool SetInformationJobObject(IntPtr job, int cls, ref EXTENDED_LIMIT info, int len);
  [DllImport("kernel32.dll", SetLastError = true)] static extern bool AssignProcessToJobObject(IntPtr job, IntPtr proc);
  [DllImport("kernel32.dll")] static extern IntPtr GetCurrentProcess();
  [DllImport("kernel32.dll")] static extern IntPtr GetStdHandle(int which);
  [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
  static extern bool CreateProcess(string app, string cmdline, IntPtr pa, IntPtr ta, bool inherit, uint flags,
    IntPtr env, string cwd, ref STARTUPINFO si, out PROCESS_INFORMATION pi);
  [DllImport("kernel32.dll")] static extern uint WaitForSingleObject(IntPtr h, uint ms);
  [DllImport("kernel32.dll")] static extern bool GetExitCodeProcess(IntPtr h, out uint code);

  const uint KILL_ON_JOB_CLOSE = 0x2000;
  const int EXTENDED_LIMIT_INFORMATION = 9;
  const int STARTF_USESTDHANDLES = 0x100;
  const uint CREATE_NO_WINDOW = 0x08000000;

  public static int Run(string cmdline, string cwd) {
    IntPtr job = CreateJobObject(IntPtr.Zero, null);
    if (job == IntPtr.Zero) throw new Exception("CreateJobObject failed: " + Marshal.GetLastWin32Error());
    var info = new EXTENDED_LIMIT();
    info.Basic.LimitFlags = KILL_ON_JOB_CLOSE;
    if (!SetInformationJobObject(job, EXTENDED_LIMIT_INFORMATION, ref info, Marshal.SizeOf(typeof(EXTENDED_LIMIT))))
      throw new Exception("SetInformationJobObject failed: " + Marshal.GetLastWin32Error());
    if (!AssignProcessToJobObject(job, GetCurrentProcess()))
      throw new Exception("AssignProcessToJobObject failed: " + Marshal.GetLastWin32Error());
    var si = new STARTUPINFO();
    si.cb = Marshal.SizeOf(typeof(STARTUPINFO));
    si.dwFlags = STARTF_USESTDHANDLES;
    si.hStdInput = GetStdHandle(-10); si.hStdOutput = GetStdHandle(-11); si.hStdError = GetStdHandle(-12);
    PROCESS_INFORMATION pi;
    if (!CreateProcess(null, cmdline, IntPtr.Zero, IntPtr.Zero, true, CREATE_NO_WINDOW, IntPtr.Zero, cwd, ref si, out pi))
      throw new Exception("CreateProcess failed: " + Marshal.GetLastWin32Error());
    Console.Error.WriteLine("polio-job child " + pi.dwProcessId);
    WaitForSingleObject(pi.hProcess, 0xFFFFFFFF);
    uint code; GetExitCodeProcess(pi.hProcess, out code);
    return (int)code;
  }
}
'@

# Compiling takes about a second, so the assembly is kept and reused. The
# name carries the version: change the C# above, change the 1 in both places.
$dir = Join-Path $env:LOCALAPPDATA 'PolioHelper'
$dll = Join-Path $dir 'polio-job-1.dll'
if (-not (Test-Path $dll)) {
  New-Item -ItemType Directory -Force $dir | Out-Null
  $tmp = Join-Path $dir ("polio-job-1." + [Guid]::NewGuid().ToString('N') + ".dll")
  Add-Type -TypeDefinition $src -OutputAssembly $tmp
  # Two first launches at once both compile; the loser loads its own copy.
  try { Move-Item $tmp $dll -ErrorAction Stop } catch { $dll = $tmp }
}
Add-Type -Path $dll
exit [PolioJob1]::Run($spec.cmdline, $spec.cwd)
