/**
 * The one place a process ends: exactly the pids a plan (plan.ts) chose.
 */
import { execFile } from "node:child_process";

export { IDLE_KINDS, planStop, planStopIdle, type StopPlan } from "./plan.ts";

const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };

/**
 * Ends exactly these pids, in this order. On Windows that is one hidden
 * `taskkill /F /PID a /PID b`, without /T, so nothing outside the plan ends.
 */
export async function stopNow(pids: number[]): Promise<{ ended: number[]; failed: number[] }> {
  if (!pids.length) return { ended: [], failed: [] };
  if (process.platform === "win32") {
    await new Promise<void>((ok) => execFile("taskkill.exe", ["/F", ...pids.flatMap((p) => ["/PID", String(p)])], { windowsHide: true }, () => ok()));
  } else {
    for (const pid of pids) { try { process.kill(pid, "SIGKILL"); } catch { /* already gone */ } }
  }
  for (let i = 0; i < 20 && pids.some(alive); i++) await new Promise((ok) => setTimeout(ok, 100));
  return { ended: pids.filter((p) => !alive(p)), failed: pids.filter(alive) };
}
