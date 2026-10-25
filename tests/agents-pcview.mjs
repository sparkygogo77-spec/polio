/**
 * "Everything Claude is doing" (helper/pc): the reader and Stop, no browser.
 *
 * 1. The reader labels a fake process tree, shaped like this PC on
 *    2026-10-25: the desktop app with its internal processes, two Claude Code
 *    sessions (one matched by --resume, one by start time), a session's
 *    PowerShell tool command, a Builder copy on a port, a headless test
 *    browser, a `next build`, a Terminal panel tab, and a pid labelled
 *    through Pleo/agents/running/<pid>.json.
 * 2. Stop plans only the chosen tree; it never plans the desktop app, a
 *    reused pid, or a session's own claude.exe without the second yes.
 * 3. Stop, for real: three node processes are started (a parent with a
 *    child, and a sibling). Reading the PC and stopping the parent ends the
 *    parent and its child, and the sibling lives on.
 *
 *   node tests/agents-pcview.mjs
 */
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const done = (code) => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(code ?? (passed === results.length ? 0 : 1));
};

let T = null, S = null, F = null, R = null, C = null;
try {
  T = await import("../helper/pc/tree.ts");
  S = await import("../helper/pc/stop.ts");
  F = await import("../helper/pc/fake.ts");
  R = await import("../helper/pc/read.ts");
  C = await import("../helper/contract.ts");
} catch (e) { console.log(`  (not there yet: ${e.message.split("\n")[0]})`); }
check("the reader, Stop and the fake tree load", !!(T && S && F && R && C));
if (!T || !S || !F || !R || !C) done(1);

// ---- 1. labels -----------------------------------------------------------
const input = F.fakeInput();
const pc = T.buildPc(input);
check("the snapshot is a good contract message (v2)", C.problems(pc).length === 0 && pc.v === 2, C.problems(pc).slice(0, 3).join("; "));
const item = (pid) => pc.groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g }))).find((i) => i.pid === pid);
const P = F.FAKE_PIDS;

const app = pc.groups.find((g) => g.kind === "app");
check("the desktop app is one group with its total", !!app && app.items.length === 5 && app.memBytes === app.items.reduce((a, i) => a + i.memBytes, 0), app ? `${app.items.length} items` : "none");
check("no part of the desktop app is stoppable", !!app && app.items.every((i) => i.kind === "app" && !i.stoppable));
check("a renderer reads as an app window", /window/i.test(item(P.renderer)?.label ?? ""), item(P.renderer)?.label);

const coord = pc.groups.find((g) => g.items[0]?.pid === P.sessionResume);
check("a session matched by --resume carries its title and folder", coord?.kind === "session" && coord.title === "Polio coordinator #3" && coord.folder === "C:\\Users\\Josh\\Downloads\\Pleo" && coord.match === "resume", JSON.stringify(coord && { t: coord.title, m: coord.match }));
const lane = pc.groups.find((g) => g.items[0]?.pid === P.sessionNew);
check("a new session is matched by its start time", lane?.title === "export: send to repo" && lane.match === "start-time", JSON.stringify(lane && { t: lane.title, m: lane.match }));
check("a session's idle time comes from its last activity", lane?.idleMinutes === 25, `${lane?.idleMinutes}`);
check("the session's own claude.exe is stoppable (after asking)", item(P.sessionNew)?.kind === "session" && item(P.sessionNew)?.stoppable === true);

const dev = item(P.devServer);
check("a dev server says Builder copy, lane and port", dev?.kind === "dev-server" && dev.label === "Builder copy for lane export, port 3091" && dev.port === 3091, dev?.label);
check("the dev server sits under the session that started it", dev?.group === lane && dev.startedBy === "export: send to repo" && dev.depth >= 1);
const br = item(P.browser);
check("a headless browser says test browser and whose", br?.kind === "browser" && br.label === "test browser for whats-new", br?.label);
check("the browser's renderer reads as part of it", /part of the test browser/.test(item(P.browserRenderer)?.label ?? ""), item(P.browserRenderer)?.label);
check("a next build says so", item(P.build)?.kind === "build" && /build of the Builder for lane export/.test(item(P.build)?.label ?? ""), item(P.build)?.label);
check("a PowerShell tool command reads as one", item(P.toolShell)?.kind === "shell" && /PowerShell tool/.test(item(P.toolShell)?.label ?? ""), item(P.toolShell)?.label);
check("a console host says what it serves", item(P.conhost)?.kind === "console" && /console/.test(item(P.conhost)?.label ?? ""), item(P.conhost)?.label);
const term = pc.groups.find((g) => g.kind === "terminal");
check("the Terminal panel's tabs are their own group, started by you", !!term && term.items.some((i) => i.pid === P.terminalTab && i.kind === "terminal-tab" && i.startedBy === "you, in the app's Terminal panel"));

const lab = item(P.labelled);
check("a labelled pid uses its label file's words, session and port", lab?.kind === "labelled" && lab.label === "live check for boxes-hug, port 3120" && lab.port === 3120 && lab.startedBy === "live-check", lab?.label);
check("an orphan with a label lands in Left running", lab?.group.kind === "left");
check("a process outside Claude is left out", !item(P.unrelated));
check("an idle dev server says idle for N min", dev?.idleMinutes === 40, `${dev?.idleMinutes}`);
check("the totals count every process and the two sessions", pc.totals.processes === pc.groups.reduce((a, g) => a + g.items.length, 0) && pc.totals.sessions === 2, JSON.stringify(pc.totals));
check("CPU comes from two reads", dev?.cpu !== null && Math.abs(dev.cpu - 0.25) < 0.01, `${dev?.cpu}`);
check("a key in a command line is blanked", !pc.groups.some((g) => g.items.some((i) => i.detail.includes("sk-ant-"))) && item(P.toolShell)?.detail.includes("•••"), item(P.toolShell)?.detail);
check("cloud sessions say why they are not visible", pc.cloud.visible === false && /list/.test(pc.cloud.reason ?? ""), pc.cloud.reason);

// ---- 2. Stop plans only the chosen tree -------------------------------------
const procs = input.procs;
const byPid = (pid) => procs.find((p) => p.pid === pid);
const plan = (pid, confirmSession = false, created = byPid(pid)?.created) => S.planStop(procs, { pid, created, confirmSession });
let p = plan(P.devServer);
check("Stop on the dev server plans only it and its children", p.refused === null && p.pids.includes(P.devServer) && p.pids.includes(P.devServerChild) && p.pids.length === 2, JSON.stringify(p));
check("children end before their parent", p.pids.indexOf(P.devServerChild) < p.pids.indexOf(P.devServer));
p = plan(P.appMain);
check("Stop never plans the desktop app", p.pids.length === 0 && /desktop app/.test(p.refused ?? ""), p.refused);
p = plan(P.renderer);
check("nor any of the app's own processes", p.pids.length === 0 && !!p.refused);
p = plan(P.sessionNew);
check("a session's claude.exe asks first", p.pids.length === 0 && p.needsConfirm, JSON.stringify(p));
p = plan(P.sessionNew, true);
check("after the second yes the session's whole tree is planned, and no other", p.pids.includes(P.sessionNew) && p.pids.includes(P.devServer) && !p.pids.includes(P.sessionResume) && !p.pids.includes(P.appMain) && !p.pids.includes(P.browser), JSON.stringify(p.pids));
p = plan(P.devServer, false, byPid(P.devServer).created + 1);
check("a reused pid (other start time) is refused", p.pids.length === 0 && /already ended/.test(p.refused ?? ""), p.refused);
const idle = S.planStopIdle(pc, 10);
check("Stop all idle takes idle servers and browsers, never a session, a shell or the app", idle.includes(P.devServer) && !idle.includes(P.sessionNew) && !idle.includes(P.sessionResume) && !idle.includes(P.terminalTab) && !idle.includes(P.appMain) && !idle.includes(P.devServerChild), JSON.stringify(idle));

// ---- 3. Stop, for real ----------------------------------------------------
const dir = mkdtempSync(join(tmpdir(), "pcview-"));
const started = [];
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };
try {
  const childJs = join(dir, "child.js");
  writeFileSync(childJs, "setInterval(() => {}, 1000);\n");
  const parentJs = join(dir, "parent.js");
  writeFileSync(parentJs, `const { spawn } = require("node:child_process");
const c = spawn(process.execPath, [${JSON.stringify(childJs)}], { stdio: "ignore", windowsHide: true });
console.log(c.pid); setInterval(() => {}, 1000);\n`);
  const parent = spawn(process.execPath, [parentJs], { stdio: ["ignore", "pipe", "ignore"], windowsHide: true });
  const sibling = spawn(process.execPath, [childJs], { stdio: "ignore", windowsHide: true });
  started.push(parent.pid, sibling.pid);
  const childPid = await new Promise((ok) => parent.stdout.once("data", (d) => ok(Number(String(d).trim()))));
  started.push(childPid);
  const real = await R.readProcs();
  const mine = real.find((x) => x.pid === parent.pid);
  check("the reader sees the started processes on this PC", !!mine && real.some((x) => x.pid === childPid && x.ppid === parent.pid), `${real.length} processes`);
  const rp = S.planStop(real, { pid: parent.pid, created: mine?.created ?? 0, confirmSession: false });
  // On Windows each console program gets its own conhost.exe; it belongs to the tree.
  const extra = rp.pids.filter((x) => x !== parent.pid && x !== childPid).map((x) => real.find((y) => y.pid === x)?.name.toLowerCase());
  check("Stop plans the parent and its child (and their console hosts) only", rp.pids.includes(parent.pid) && rp.pids.includes(childPid) && !rp.pids.includes(sibling.pid) && extra.every((n) => n === "conhost.exe"), JSON.stringify({ rp, extra }));
  const out = await S.stopNow(rp.pids);
  await new Promise((ok) => setTimeout(ok, 500));
  check("the parent and its child ended", !alive(parent.pid) && !alive(childPid), JSON.stringify(out));
  check("the sibling lives on", alive(sibling.pid));
  check("the test process lives on", alive(process.pid));
} catch (e) {
  check("the real stop ran", false, e.message.split("\n")[0]);
} finally {
  for (const pid of started) { try { process.kill(pid); } catch {} }
  rmSync(dir, { recursive: true, force: true });
}
done();
