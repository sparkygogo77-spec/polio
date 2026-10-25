/**
 * The GitHub token, if J chose to hold one: a Windows Credential Manager
 * generic credential named `PolioHelper:github` (the installer lane writes
 * it). Read through PowerShell's CredRead, never from a file or an
 * environment variable, and never printed.
 *
 * Off Windows, or with no such credential, it is null and the helper uses
 * the project-chat way.
 */
import { execFile } from "node:child_process";

export const TOKEN_TARGET = "PolioHelper:github";

const READ = `
$sig = @'
[DllImport("advapi32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
public static extern bool CredRead(string target, int type, int flags, out IntPtr cred);
[DllImport("advapi32.dll")] public static extern void CredFree(IntPtr cred);
[StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
public struct CREDENTIAL { public int Flags; public int Type; public string TargetName; public string Comment;
  public long LastWritten; public int CredentialBlobSize; public IntPtr CredentialBlob; public int Persist;
  public int AttributeCount; public IntPtr Attributes; public string TargetAlias; public string UserName; }
'@
$t = Add-Type -MemberDefinition $sig -Name Cred -Namespace PolioHelper -PassThru
$p = [IntPtr]::Zero
if ($t::CredRead($env:POLIO_CRED_TARGET, 1, 0, [ref]$p)) {
  $c = [Runtime.InteropServices.Marshal]::PtrToStructure($p, [type]'PolioHelper.Cred+CREDENTIAL')
  [Console]::Out.Write([Runtime.InteropServices.Marshal]::PtrToStringUni($c.CredentialBlob, $c.CredentialBlobSize / 2))
  $t::CredFree($p)
}`;

export function readGithubToken(target = TOKEN_TARGET): Promise<string | null> {
  if (process.platform !== "win32") return Promise.resolve(null);
  return new Promise((done) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", READ],
      { env: { ...process.env, POLIO_CRED_TARGET: target }, windowsHide: true, timeout: 15000 },
      (err, out) => done(err || !out.trim() ? null : out.trim()));
  });
}
