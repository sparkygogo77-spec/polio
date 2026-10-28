/**
 * A fake read of the PC, shaped like this one on 2026-10-25: the desktop
 * app, two Claude Code sessions, a PowerShell tool command, a Builder copy
 * on a port with a `next build` beside it, a headless test browser, a
 * Terminal panel tab, a labelled live check left running, and J's own Chrome
 * (which is not Claude's and must not show). The test and the panel's fake
 * mode both use it.
 */
import { buildPc } from "./tree.ts";
import { keyOf, type PcInput, type RawProc } from "./types.ts";

const MB = 1024 * 1024;
const NOW = Date.UTC(2026, 9, 25, 19, 30, 0);
const min = 60_000;
const APP = '"C:\\Program Files\\WindowsApps\\Claude_3.6556.2.0_x64__pzs8sxrjxfjjc\\app\\Claude.exe"';
const CLI = "C:\\Users\\Josh\\AppData\\Roaming\\Claude\\claude-code\\2.1.308\\c17a819afb40\\claude.exe --output-format stream-json --verbose --input-format stream-json --model=claude-opus-5-5";
const NODE = '"C:\\Program Files\\nodejs\\node.exe"';
const PLEO = "C:\\Users\\Josh\\Downloads\\Pleo";
const SHELL = "C:\\Users\\Josh\\AppData\\Local\\ms-playwright\\chromium_headless_shell-1200\\chrome-win\\headless_shell.exe";

export const FAKE_PIDS = {
  appMain: 4732, renderer: 17268, gpu: 16848, network: 16856, nodeService: 17516,
  terminalTab: 17948, terminalConsole: 18120,
  sessionResume: 10976, testNode: 15900, browser: 16000, browserRenderer: 16100,
  sessionNew: 20068, conhost: 2876, toolWrapper: 14796, toolShell: 20320,
  devServer: 15500, devServerChild: 15600, build: 15700,
  labelled: 17000, unrelated: 18000, explorer: 1676,
} as const;
const P = FAKE_PIDS;
const NEW_AT = NOW - 50 * min;

const proc = (pid: number, ppid: number, name: string, cmd: string, agoMin: number, mb: number, cpuMs = 1000, created = NOW - agoMin * min): RawProc =>
  ({ pid, ppid, name, cmd, created, memBytes: mb * MB, cpuMs });

export function fakeProcs(): RawProc[] {
  return [
    proc(P.explorer, 4, "explorer.exe", "C:\\Windows\\Explorer.EXE", 600, 120),
    proc(P.appMain, P.explorer, "claude.exe", APP, 360, 289),
    proc(P.renderer, P.appMain, "claude.exe", `${APP} --type=renderer --user-data-dir="C:\\Users\\Josh\\AppData\\Roaming\\Claude"`, 359, 746),
    proc(P.gpu, P.appMain, "claude.exe", `${APP} --type=gpu-process`, 359, 185),
    proc(P.network, P.appMain, "claude.exe", `${APP} --type=utility --utility-sub-type=network.mojom.NetworkService`, 359, 88),
    proc(P.nodeService, P.appMain, "claude.exe", `${APP} --type=utility --utility-sub-type=node.mojom.NodeService`, 359, 108),
    proc(P.terminalTab, P.nodeService, "powershell.exe", 'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe -NoProfile -NoExit -Command "try { . $profile } catch {}"', 300, 50),
    proc(P.terminalConsole, P.nodeService, "conhost.exe", "\\\\?\\C:\\Windows\\system32\\conhost.exe --headless --width 169 --height 31", 300, 7),

    proc(P.sessionResume, P.appMain, "claude.exe", `${CLI} --resume=fe98a469-ea90-4e77-8526-6413bc11e141 --permission-mode=auto`, 120, 325),
    proc(P.testNode, P.sessionResume, "node.exe", `${NODE} ${PLEO}\\work-whats-new\\tests\\builder-whats-new.mjs`, 3, 90),
    proc(P.browser, P.testNode, "headless_shell.exe", `${SHELL} --disable-gpu --headless --user-data-dir=C:\\Users\\Josh\\AppData\\Local\\Temp\\playwright_chromiumdev_profile-x`, 3, 140),
    proc(P.browserRenderer, P.browser, "headless_shell.exe", `${SHELL} --type=renderer --headless`, 3, 210),

    proc(P.sessionNew, P.appMain, "claude.exe", `${CLI} --permission-mode=auto`, 0, 302, 90_000, NEW_AT + 800),
    proc(P.conhost, P.sessionNew, "conhost.exe", "\\??\\C:\\Windows\\system32\\conhost.exe 0x4", 49, 12),
    proc(P.toolWrapper, P.sessionNew, "cmd.exe", 'C:\\Windows\\System32\\cmd.exe /d /s /c ""C:\\Windows\\System32\\chcp.com" 65001 >nul & powershell.exe -Command "$__claudeCodeScript = $env:CLAUDE_CODE_SHELL_LAUNCHER_SCRIPT""', 1, 4),
    proc(P.toolShell, P.toolWrapper, "powershell.exe", '"C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe" -NoProfile -NonInteractive -Command "$__claudeCodeScript = $env:CLAUDE_CODE_SHELL_LAUNCHER_SCRIPT; $k = \'sk-ant-api03-AbCdEf0123456789\'"', 1, 74),
    proc(P.devServer, P.sessionNew, "node.exe", `${NODE} ${PLEO}\\work-export\\node_modules\\next\\dist\\bin\\next start -p 3091`, 45, 520, 4000),
    proc(P.devServerChild, P.devServer, "node.exe", `${NODE} ${PLEO}\\work-export\\node_modules\\next\\dist\\server\\lib\\start-server.js`, 45, 380, 3000),
    proc(P.build, P.sessionNew, "node.exe", `${NODE} ${PLEO}\\work-export\\node_modules\\next\\dist\\bin\\next build`, 2, 3100, 200_000),

    // Its parent (pid 99999) has ended; its label file says what it is.
    proc(P.labelled, 99999, "node.exe", `${NODE} ${PLEO}\\work-livecheck\\run.mjs`, 90, 610),
    proc(P.unrelated, P.explorer, "chrome.exe", '"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"', 200, 900),
  ];
}

export function fakeInput(): PcInput {
  const procs = fakeProcs();
  const cores = 8;
  const at = NOW - 5000;
  const cpuMs: Record<string, number> = {};
  // Each process used this share of the PC over the last 5 seconds.
  const share: Record<number, number> = { [P.devServer]: 0.0025, [P.build]: 0.6, [P.browser]: 0.08, [P.renderer]: 0.02 };
  for (const p of procs) cpuMs[keyOf(p)] = p.cpuMs - (share[p.pid] ?? 0) * 5000 * cores;
  const dev = procs.find((p) => p.pid === P.devServer)!;
  return {
    now: NOW, cores, memory: { usedBytes: Math.round(19.2 * 1024) * MB, totalBytes: 32 * 1024 * MB },
    procs, ports: { [P.devServer]: [3091], [P.labelled]: [3120] },
    labels: [{ pid: P.labelled, session: "live-check", purpose: "live check for boxes-hug, port 3120", port: 3120 }],
    sessions: [
      { id: "local_2f123766-90d8-4b53-ab5c-849c3851e891", title: "Polio coordinator #3", cwd: PLEO, cliSessionId: "fe98a469-ea90-4e77-8526-6413bc11e141", createdAt: NOW - 30 * 60 * min, lastActivityAt: NOW - min },
      { id: "local_aaaaaaaa-0000-4000-8000-000000000001", title: "export: send to repo", cwd: PLEO, cliSessionId: null, createdAt: NEW_AT, lastActivityAt: NOW - 25 * min },
      { id: "local_bbbbbbbb-0000-4000-8000-000000000002", title: "an older session", cwd: PLEO, cliSessionId: null, createdAt: NOW - 5 * 60 * min, lastActivityAt: NOW - 4 * 60 * min },
    ],
    prev: { at, cpuMs },
    busy: { [keyOf(dev)]: NOW - 40 * min },
    self: [],
    cloud: { visible: false, reason: "Not visible yet: the Claude CLI can start and message a cloud session but can't list them.", sessions: [] },
  };
}

export const fakePc = () => buildPc(fakeInput());
