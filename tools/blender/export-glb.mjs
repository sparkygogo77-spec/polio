#!/usr/bin/env node
/**
 * Exports Blender passes to .glb for the Models view (`/models`), one at a time,
 * hidden, under the PC-wide heavy lock (Pleo/agents/heavy.lock).
 *
 *   node tools/blender/export-glb.mjs <pass.blend> [more.blend …] [-- set=nose=0.4 take=Shelf_E visible=1 groups=1]
 *
 * Each .glb lands next to its pass with the same name (pass `out=<path>` after
 * `--` for one pass to put it elsewhere). Prints the size and time for each.
 * Env: BLENDER (default Blender 5.2's exe), HEAVY_LOCK (default the Pleo lock;
 * set it to "none" to skip it), EXPORT_TIMEOUT_S (default 900).
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BLENDER = process.env.BLENDER ?? "C:\\Program Files\\Blender Foundation\\Blender 5.2\\blender.exe";
const LOCK = process.env.HEAVY_LOCK ?? "C:\\Users\\Josh\\Downloads\\Pleo\\agents\\heavy.lock";
const TIMEOUT = Number(process.env.EXPORT_TIMEOUT_S ?? 900) * 1000;
const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "export_glb.py");

const argv = process.argv.slice(2);
const cut = argv.indexOf("--");
const passes = cut < 0 ? argv : argv.slice(0, cut);
const extra = cut < 0 ? [] : argv.slice(cut + 1);
if (!passes.length) {
  console.error("usage: node tools/blender/export-glb.mjs <pass.blend> [more.blend …] [-- set=k=v take=<collection> out=<path>]");
  process.exit(2);
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
/* The lock: created atomically (flag "wx"), with this node's Windows pid; a lock whose pid is gone is stale. */
async function takeLock() {
  if (LOCK === "none") return;
  for (;;) {
    try {
      fs.writeFileSync(LOCK, JSON.stringify({ lane: "model-view", pid: process.pid, what: "blender glb export", created: Date.now() }), { flag: "wx" });
      return;
    } catch {
      let pid = 0;
      try {
        pid = Number(/"pid"\s*:\s*(\d+)/.exec(fs.readFileSync(LOCK, "utf8"))?.[1] ?? 0);
      } catch {}
      if (pid && !alive(pid)) {
        console.log(`heavy lock held by pid ${pid}, which is gone: taking it`);
        fs.rmSync(LOCK, { force: true });
        continue;
      }
      console.log(`heavy lock held${pid ? ` by pid ${pid}` : ""}: waiting a minute`);
      await new Promise((r) => setTimeout(r, 60_000));
    }
  }
}
const dropLock = () => {
  if (LOCK === "none") return;
  try {
    if (JSON.parse(fs.readFileSync(LOCK, "utf8")).pid === process.pid) fs.rmSync(LOCK, { force: true });
  } catch {}
};
process.on("exit", dropLock);
process.on("SIGINT", () => process.exit(130));

await takeLock();
let failed = 0;
for (const pass of passes) {
  const abs = path.resolve(pass);
  const args = ["-b", abs, "--python", SCRIPT, "--", ...extra];
  if (!extra.some((a) => a.startsWith("out="))) args.push(`out=${abs.replace(/\.blend$/i, ".glb")}`);
  const t = Date.now();
  const r = spawnSync(BLENDER, args, { encoding: "utf8", windowsHide: true, timeout: TIMEOUT, maxBuffer: 256 * 1024 * 1024 });
  const line = (r.stdout ?? "").split(/\r?\n/).find((l) => l.startsWith("GLB_DONE "));
  if (!line) {
    failed++;
    const tail = `${r.stdout ?? ""}\n${r.stderr ?? ""}`.split(/\r?\n/).filter((l) => /Error|Traceback|No collection/.test(l)).slice(-6).join("\n");
    console.log(`FAIL ${path.basename(abs)} after ${((Date.now() - t) / 1000).toFixed(1)} s${r.error ? ` (${r.error.message})` : ""}\n${tail}`);
    continue;
  }
  const info = JSON.parse(line.slice(9));
  console.log(`${path.basename(abs)} → ${info.out}: ${(info.bytes / 1048576).toFixed(1)} MB, ${info.objects} objects, export ${info.seconds} s, whole run ${((Date.now() - t) / 1000).toFixed(1)} s; sliders ${JSON.stringify(info.sliders)}`);
}
process.exit(failed ? 1 : 0);
