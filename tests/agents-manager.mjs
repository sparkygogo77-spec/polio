#!/usr/bin/env node
/**
 * THE AGENTS MANAGER (J's drawing, 2026-11-10/11; rules in Pleo/handovers/open/columns-rules.md).
 *
 *   A. a full-screen manager, a toggle from the Agents dock, on the Builder's nebula (no black box);
 *   B. columns as drawn, in J's design blocks: one per coordinator side by side, a thick outside ring of two
 *      touching lines in the coordinator's colour (a band of 7 px and a line of 3), a head (C-number, question count, turn number), chats stacked
 *      as compact panes (name, state dot, memory pill, a red question button, the cube, age, two lines, the bar),
 *      a foot by age; the columns size to their count;
 *   C. the orb system beside the columns, at the right, each ring in its coordinator's colour and named on hover;
 *      a column lights its ring and the other way round; hovering an orb shows that chat in its column, a press
 *      pins it;
 *   D. a question opens over its coordinator's column with every Choose showing; only a decision with pictures
 *      takes the full width, as slides stepped up and down;
 *   E. PC cost on each pane: memory, CPU, running time, kind icons, each kind's share on hover; a labelled
 *      process is never "no session";
 *   F. one press archives a chat, with undo; nothing is deleted;
 *   G. the model chip: a press asks the coordinator through the helper.
 *
 * And: nothing read from the helper reaches the saved site or an outgoing request; the board doesn't move by a
 * pixel; the same on each of the six repo fixtures.
 *
 *   npx next start -p 3610          (a build of this branch)
 *   node tests/agents-manager.mjs http://127.0.0.1:3610 [fixtures folder with sites/<name>/site/document.json]
 *
 * Covers: src/features/agents/manager.ts, src/features/agents/AgentsManager.tsx, src/features/agents/LanesBoard.tsx, src/features/agents/AgentsDock.tsx, src/features/agents/feed.ts, src/features/agents/store.ts, src/features/agents/lanes.ts, src/features/agents/Decisions.tsx, helper/server/lanes.ts, helper/server/server.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3610").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? "";
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const tryImport = async (p) => { try { return await import(p); } catch (e) { check(`${p} loads`, false, String(e?.message ?? e).split("\n")[0].slice(0, 140)); return null; } };
const near = (a, b, e = 1.5) => Math.abs(a - b) <= e;

/* ------------------------------------------------------------ the made feed, shaped as J's is: one list, each row with a kind */
const minutes = (m) => new Date(Date.now() - m * 60_000).toISOString();
const uid = (k) => `local_${String(k).padStart(8, "0")}-0000-4000-8000-000000000000`;
const row = (k, name, state, extra = {}) => ({ id: uid(k), name, lane: name.toLowerCase().replace(/\s+/g, "-"), state, kind: "lane", lastSeen: minutes(k * 3), code: name.split(" ")[0].toUpperCase(), emoji: "🔮", turns: 2, ...extra });
const C7 = row(7, "Coordinator 7", "work", { kind: "coordinator", lane: "coordinator", code: "PIONEER", emoji: "🧽", turns: 21, model: "Fable 5.2", effort: "high", note: String.raw`Steering HELPERTEXT-c7 from C:\Users\Josh\Pleo, pid 4242` });
const C8 = row(8, "Coordinator 8", "work", { kind: "coordinator", lane: "coordinator-8", code: "SECOND", emoji: "🥈", turns: 2 });
const C6 = row(6, "Coordinator 6", "done", { kind: "coordinator", lane: "coordinator-6", code: "HELM6", emoji: "🧭", lastSeen: minutes(600) });
const C5 = row(5, "Coordinator 5", "done", { kind: "coordinator", lane: "coordinator-5", hidden: true, lastSeen: minutes(3000) });
const VOID = row(11, "Void", "work", { model: "Opus 5.5", effort: "medium", note: "You get: HELPERTEXT-void a deep space to float in, with a long tail of words that goes on well past what two short lines can hold so that it has to be cut at a word somewhere along the way.", last: "Pushed HELPERTEXT-last for review" });
const PANELS = row(12, "Panels", "need", { turns: 5, note: "Waiting on your pick of the panel look." });
const PARKED = row(13, "Parked one", "park", { note: "Parked nine days ago." });
const ROUND = row(14, "Round maker", "done", { note: "Three looks are ready." });
const FIN_A = row(15, "Finished A", "done"), FIN_B = row(16, "Finished B", "done", { lastSeen: minutes(900) });
const ARCHIVED = row(17, "Archived one", "done", { archived: true });
const HIDDEN = row(18, "Hidden one", "done", { hidden: true });
const ORBIT = row(21, "Orbit", "work", { runBy: "C8" });
const RINGS = row(22, "Rings", "need", { runBy: C8.id });
const FEED = {
  decisions: [
    { id: "q-panels", order: 1, about: "panels", question: "Which panel look?", what: "Three looks for the panels.", why: "The panels are what you read all day.", how: "Press Choose under one.", context: "A longer background that sits under a fold.", asked: minutes(50),
      options: [{ key: "a", label: "Glass", desc: "Polished and light." }, { key: "b", label: "Molten", desc: "Your timeline boxes.", pick: true }, { key: "c", label: "A mix", desc: "Molten columns, glass panes." }], answer: "", answeredAt: "" },
    { id: "q-own", order: 2, about: "coordinator", question: "Send Merges 75 tonight?", why: "It is green.", options: [{ key: "yes", label: "Yes" }, { key: "no", label: "Wait" }], answer: "", answeredAt: "", asked: minutes(20) },
    { id: "q-orbit", order: 2.5, about: "orbit", question: "Which orbit speed?", options: [{ key: "a", label: "Slow" }, { key: "b", label: "Fast", pick: true }], answer: "", answeredAt: "", asked: minutes(15) },
    { id: "q-rings", order: 3, about: "rings", question: "Which ring texture?", what: "Two textures.", options: [{ key: "a", label: "Glass ring", picture: "open/rings/a.png" }, { key: "b", label: "Marble ring", picture: "open/rings/b.png", pick: true }], answer: "", answeredAt: "", asked: minutes(10) },
    { id: "q-done", order: 0, about: "void", question: "Already answered", options: [{ key: "a", label: "Yes" }], answer: "a", answeredAt: minutes(5) },
  ],
  checks: [{ id: "chk-void", lane: "void", what: "Float through the void once and see it holds.", checked: false }, { id: "chk-old", lane: "void", what: "Old", checked: true }],
  iterations: [
    { id: "round-1", lane: "round-maker", title: "Three looks of the round", options: [{ key: "a", label: "A", picture: "handovers/open/round/a.png" }, { key: "b", label: "B", picture: "handovers/open/round/b.png" }, { key: "c", label: "C", picture: "handovers/open/round/c.png" }], pick: "b", chosen: "" },
    { id: "round-0", lane: "void", title: "Chosen already", options: [{ key: "a", label: "A", picture: "handovers/open/round/a.png" }], pick: "a", chosen: "a" },
  ],
  coordinators: [{ id: uid(4), name: "Coordinator 4", chats: [C7, C8, VOID, PANELS, PARKED, ROUND, FIN_A, FIN_B, ARCHIVED, HIDDEN, ORBIT, RINGS, C6, C5] }],
};
const MB = 1048576;
const PC = { ok: true, at: Date.now(), memTotal: 32 * 1024 * MB, owners: [
  { key: VOID.id, title: "Void", memBytes: 700 * MB, cpu: 5, startedAt: Date.now() - 10 * 60_000, kinds: [{ kind: "shell", count: 2, memBytes: 434 * MB, cpu: 4 }, { kind: "node", count: 1, memBytes: 266 * MB, cpu: 1 }] },
  { key: "PANELS", title: "", memBytes: 50 * MB, cpu: 0, startedAt: Date.now() - 50_000, kinds: [{ kind: "host", count: 1, memBytes: 50 * MB, cpu: 0 }] },
  { key: "SECOND", title: "", memBytes: 100 * MB, cpu: 1, startedAt: Date.now() - 3600_000, kinds: [{ kind: "browser", count: 3, memBytes: 100 * MB, cpu: 1 }] },
  { key: "TRAY", title: "", memBytes: 235 * MB, cpu: 0, startedAt: Date.now() - 7 * 3600_000, kinds: [{ kind: "shell", count: 1, memBytes: 235 * MB, cpu: 0 }] },
] };
const HELPER_WORDS = ["HELPERTEXT-c7", "HELPERTEXT-void", "HELPERTEXT-last"];
const BLUE = "#2f7bff", GREEN = "#52e36a", PURPLE = "#a06bff";
/* BAM mark 30: live coordinators by place, oldest first: green, purple, amber. */
const FIRST = "#2fd27a", FIRST_IN = "#b8ffd8";
const rgb = (h) => `rgb(${parseInt(h.slice(1, 3), 16)}, ${parseInt(h.slice(3, 5), 16)}, ${parseInt(h.slice(5, 7), 16)})`;

/* ------------------------------------------------------------ 1. pure */
const L = await tryImport("../src/features/agents/lanes.ts");
const M = await tryImport("../src/features/agents/manager.ts");
const HL = await tryImport("../helper/server/lanes.ts");

if (L?.readFeed && M?.columnsOf) {
  const feed = L.readFeed(FEED);
  const cols = M.columnsOf(feed);
  const ids = (list) => list.map((x) => x.id).join();
  check("B (BAM mark 31): a column per live coordinator, oldest first: C7, then C8 (the newest, the current one)", cols.length === 2 && cols.map((c) => c.label).join() === "C7,C8" && cols[1].current && !cols[0].current, cols.map((c) => c.label).join());
  const c7 = cols[0], c8 = cols[1];
  check("B: a chat stands under the coordinator that runs it (its C-number or id); the rest under the current one", ids(c8.panes).includes(ORBIT.id) && ids(c8.panes).includes(RINGS.id) && !ids(c7.panes).includes(ORBIT.id));
  /* With two live coordinators and no runBy, the rest fall to the current one (C8). */
  check("B: panes are the chats with something left, red first; finished ones with nothing left are the foot, newest first", c8.panes[0].state === "need" && ids(c8.foot) === `${FIN_A.id},${FIN_B.id}` && ids(c8.panes).includes(ROUND.id) && ids(c8.panes).includes(PARKED.id), ids(c8.panes));
  check("F: an archived chat is in no pane and no foot, but kept (findable); a hidden one shows nowhere", ids(c8.archived) === ARCHIVED.id && ![...c8.panes, ...c8.foot, ...c7.panes, ...c7.foot].some((x) => x.id === ARCHIVED.id || x.id === HIDDEN.id));
  check("B: retired coordinators J has not hidden are lines in the current column's foot; a hidden one is nowhere", ids(c8.retired) === C6.id);
  check("B: each open question stands in its chat's column; one about a coordinator is that coordinator's own, on its head", c8.questions.map((d) => d.id).join() === "q-panels,q-orbit,q-rings" && c8.own.length === 0 && c7.questions.map((d) => d.id).join() === "q-own" && c7.own.map((d) => d.id).join() === "q-own", `${c8.questions.map((d) => d.id)} own ${c7.own.map((d) => d.id)}`);
  const gone = M.columnsOf(feed, { [VOID.id]: true, [ARCHIVED.id]: false });
  check("F: what this browser archived or put back holds until the feed says the same", gone[1].archived.some((x) => x.id === VOID.id) && !gone[1].panes.some((x) => x.id === VOID.id) && gone[1].foot.some((x) => x.id === ARCHIVED.id));
  check("B: a coordinator keeps its colour by its number: 7 blue and green, 6 red, 5 yellow, 8 purple", M.coloursOf(7).outer === BLUE && M.coloursOf(7).inner === GREEN && M.coloursOf(6).outer === "#ff4a3d" && M.coloursOf(5).outer === "#f2c230" && M.coloursOf(8).outer === PURPLE && M.coloursOf(13).outer === BLUE);
  check("B: the ring is a thick band: 7 px outside, 3 px inside, radius 14 and 7, over three times a pane's line", M.RING.outer === 7 && M.RING.inner === 3 && M.RING.radius === 14 && M.RING.innerRadius === 7 && M.RING.outer > 3 * M.RING.pane);
  const old = L.readFeed({ coordinators: [{ id: "a", name: "Coordinator A", chats: [{ id: "a1", name: "x", state: "done" }] }, { id: "b", name: "Coordinator B", chats: [{ id: "b1", name: "y", state: "work" }] }, { id: "c", name: "Coordinator C", chats: [{ id: "c1", name: "z", state: "need" }] }] });
  check("B: a feed whose coordinators are not chats gives a column per live coordinator of its own", M.columnsOf(old).map((c) => c.id).join() === "b,c" && M.columnsOf(old)[0].coord === null);
  check("B: the cube counts what is left to look at: checks not ticked and picture rounds not chosen", M.cubeOf(feed, VOID).count === 1 && M.cubeOf(feed, ROUND).count === 1 && M.cubeOf(feed, PANELS).count === 0);
  check("B: a round's pictures are read from inside handovers/", feed.rounds[0].options[0].picture === "open/round/a.png" && feed.rounds.length === 2);
  const slides = M.slidesOf(feed, cols);
  check("D: only what has pictures is a slide: the picture question, then the open round", slides.map((s) => `${s.kind}:${s.id}`).join() === "question:q-rings,round:round-1" && M.hasPictures(FEED.decisions[3]) && !M.hasPictures(L.readDecisions(FEED.decisions)[1]));
  check("D: slides step up and down and hold at the ends; three across from 1150 px, two from 700, else one", M.stepSlide(0, -1, 2) === 0 && M.stepSlide(0, 1, 2) === 1 && M.stepSlide(1, 1, 2) === 1 && M.slideAcross(1400, 3) === 3 && M.slideAcross(900, 3) === 2 && M.slideAcross(500, 3) === 1 && M.slideAcross(1400, 2) === 2);
  check("B: turns out of five, amber at five, red past it", M.turnsOf(VOID).words === "2/5" && M.turnsOf(PANELS).tone === "full" && M.turnsOf(C7).tone === "over" && M.turnsOf({ ...VOID, turns: undefined }) === null);
  check("B: columns share the width by their count, none wider than 640 px or narrower than 300", M.columnWidth(1000, 1) === 640 && M.columnWidth(1000, 2) === 496 && M.columnWidth(1000, 3) === 328 && M.columnWidth(500, 3) === 300);
  const cut = M.cutAt(VOID.note, 140);
  check("B: a long line is cut at a word, never mid-word", cut.more && cut.words.length <= 140 && VOID.note.startsWith(cut.words) && /\s/.test(VOID.note[cut.words.length]) && !M.cutAt("short").more);

  const pc = M.readCost(PC);
  const v = M.costOf(pc, VOID), p = M.costOf(pc, PANELS);
  check("E: a chat's cost is what its session and its labels run: by id, code, name or lane", v?.memBytes === 700 * MB && p?.memBytes === 50 * MB && M.costOf(pc, ORBIT) === null);
  check("E: memory, CPU and running time in words", M.memWords(700 * MB) === "700 MB" && M.memWords(1434 * MB) === "1.4 GB" && M.cpuWords(5) === "CPU 5%" && M.cpuWords(0.2) === "CPU under 1%" && M.cpuWords(null) === "" && M.upWords(Date.now() - 601_000, Date.now()) === "up 10 min");
  const lines = M.shareLines(v, "this chat");
  check("E: each kind's share of the chat's total, biggest first", lines[0].words === "PowerShell or cmd ×2 · 434 MB · 62% of this chat · 80% of its CPU" && lines[1].words === "node or npx · 266 MB · 38% of this chat · 20% of its CPU", lines.map((l) => l.words).join(" | "));
  check("E: while private the memory figure is left out and the shares stay", M.shareLines(v, "this chat", true)[0].words === "PowerShell or cmd ×2 · 62% of this chat · 80% of its CPU");
  check("E: the column head sums its coordinator and its chats", M.columnCost(pc, c8)?.memBytes === 850 * MB, String(M.columnCost(pc, c8)?.memBytes / MB));
  check("E: what belongs to no chat is named by its label's word (the tray), never 'no session'", M.unowned(pc, cols).map((o) => o.key).join() === "TRAY");
  check("E: the pill's bar is on one scale: the heaviest fills it", M.pillShare(700 * MB, 700 * MB) === 1 && near(M.pillShare(50 * MB, 700 * MB), 0.0714, 0.001));
  check("G: what a chat runs on, and the chip's words", JSON.stringify(M.modelOf(VOID)) === '{"model":"Opus 5.5","effort":"medium"}' && JSON.stringify(M.modelOf({ model: "Opus 5.5 medium" })) === '{"model":"Opus 5.5","effort":"medium"}' && M.modelOf({}) === null
    && M.chipWords(M.modelOf(VOID), null, false) === "Opus 5.5 · medium" && M.chipWords(M.modelOf(VOID), { model: "Fable 5.2", effort: "high" }, false) === "Opus 5.5 · medium → Fable 5.2 · high asked" && M.chipWords(M.modelOf(VOID), null, true) === "model");
  check("G: the choices are the four models and five efforts", M.MODELS.join() === "Fable 5.2,Opus 5.5,Sonnet 5.5,Haiku 5.5" && M.EFFORTS.join() === "low,medium,high,xhigh,max");
}

/* The helper's part: what it serves, the two presses, the cost, and the routes. */
const tmp = mkdtempSync(join(tmpdir(), "agents-manager-"));
if (HL?.archiveLanes && HL?.pressLanes && HL?.costFor) {
  const served = HL.blankKeys(HL.forBuilder({ ...FEED, coordinators: [{ ...FEED.coordinators[0], chats: [{ ...VOID, pid: 4242, folder: "work-void" }, ARCHIVED] }] }));
  const x = served.coordinators[0].chats[0];
  check("the helper serves what the columns need: kind, who runs it, turns, model, hidden and archived, the checks and the rounds", x.kind === "lane" && x.turns === 2 && x.model === "Opus 5.5" && x.effort === "medium" && served.coordinators[0].chats[1].archived === true && served.checks.length === 2 && served.iterations.length === 2);
  check("…never a pid or a folder", !("pid" in x) && !("folder" in x));

  const file = join(tmp, "lanes.json");
  const text = JSON.stringify(FEED, null, 2) + "\n";
  writeFileSync(file, text);
  const a = HL.archiveLanes(file, { id: VOID.id, archived: true }, new Date("2026-11-11T12:00:00Z"));
  const after = JSON.parse(readFileSync(file, "utf8"));
  const was = JSON.parse(text);
  const chatOf = (f, id) => f.coordinators[0].chats.find((c) => c.id === id);
  check("F: an archive press sets that chat's archived and archivedAt", a.ok && chatOf(after, VOID.id).archived === true && chatOf(after, VOID.id).archivedAt === "2026-11-11T12:00:00.000Z");
  delete chatOf(after, VOID.id).archived; delete chatOf(after, VOID.id).archivedAt;
  check("F: …and nothing else: no row is deleted, no other field moves, the file keeps its shape", JSON.stringify(after) === JSON.stringify(was) && readFileSync(file, "utf8").endsWith("\n") && after.coordinators[0].chats.length === was.coordinators[0].chats.length);
  const back = HL.archiveLanes(file, { id: VOID.id, archived: false });
  check("F: undo puts it back", back.ok && chatOf(JSON.parse(readFileSync(file, "utf8")), VOID.id).archived === false);
  check("F: a press for no chat, or not true-or-false, is refused", HL.archiveLanes(file, { id: "nope", archived: true }).status === 404 && HL.archiveLanes(file, { id: VOID.id, archived: "yes" }).status === 400 && HL.archiveLanes(file, { id: VOID.id }).status === 400);

  const presses = join(tmp, "console-presses.json");
  const p1 = HL.pressLanes(presses, { kind: "model", target: VOID.id, model: "Fable 5.2", effort: "high" }, new Date("2026-11-11T12:00:00Z"));
  const p2 = HL.pressLanes(presses, { kind: "choose", target: "round-1", option: "b" });
  const p3 = HL.pressLanes(presses, { kind: "check", target: "chk-void" });
  const rows = JSON.parse(readFileSync(presses, "utf8"));
  check("G: a model press is one row for the coordinator in console-presses.json, as the console writes them", p1.ok && rows.length === 3 && JSON.stringify(rows[0]) === JSON.stringify({ at: "2026-11-11T12:00:00.000Z", kind: "model", target: VOID.id, from: "builder", model: "Fable 5.2", effort: "high" }) && readFileSync(presses, "utf8").split("\n").length === 6);
  check("…a chosen picture and a ticked check too", p2.ok && p3.ok && rows[1].kind === "choose" && rows[1].option === "b" && rows[2].kind === "check" && rows[2].target === "chk-void");
  check("G: only the Builder's kinds, a real model and effort, short single-line words", [{ kind: "push", target: "75" }, { kind: "say", target: "x", text: "" }, { kind: "model", target: "x", model: "GPT", effort: "high" }, { kind: "model", target: "x", model: "Opus 5.5", effort: "huge" }, { kind: "choose", target: "x" }, { kind: "check", target: "a\nb" }, { kind: "check", target: "x".repeat(200) }, { kind: "check" }].every((b) => HL.pressLanes(presses, b).status === 400) && JSON.parse(readFileSync(presses, "utf8")).length === 3);
  writeFileSync(presses, "{ broken");
  check("G: a presses file that does not parse is never overwritten", HL.pressLanes(presses, { kind: "check", target: "x" }).status === 409 && readFileSync(presses, "utf8") === "{ broken");

  const F = await tryImport("../helper/pc/fake.ts");
  if (F?.fakePc) {
    const pc = F.fakePc();
    const cost = HL.costFor(pc);
    const out = JSON.stringify(cost);
    const items = pc.groups.flatMap((g) => g.items);
    const secrets = [...items.map((i) => i.detail).filter((d) => d && d.length > 14), ...pc.groups.map((g) => g.folder).filter(Boolean), ...items.map((i) => i.folder).filter(Boolean), ...items.map((i) => i.label).filter((l) => l && l.length > 14)];
    check("E: the helper sums the PC per owner: memory, CPU, oldest start, processes by kind", cost.owners.length > 0 && cost.owners.every((o) => o.memBytes === o.kinds.reduce((a, k) => a + k.memBytes, 0) && o.kinds.every((k) => ["shell", "host", "node", "browser", "other"].includes(k.kind) && k.count >= 1)) && cost.memTotal === pc.memory.totalBytes);
    check("E: …and no pid, port, folder, command line or label text leaves with it", secrets.length > 3 && !secrets.some((s) => out.includes(s)) && !/"pid"|"port"|"folder"|"detail"|"label"/.test(out), secrets.find((s) => out.includes(s)) ?? "");
    const left = { at: 1, memory: { totalBytes: 9 }, groups: [{ id: "left", kind: "left", title: "Left running, no session", items: [{ kind: "shell", cpu: 0, memBytes: 5, created: 3, startedBy: "TRAY" }, { kind: "node", cpu: null, memBytes: 7, created: 2, startedBy: "no session (the one that started it has ended)" }] }, { id: "app", kind: "app", title: "Claude desktop app", items: [{ kind: "app", memBytes: 99, created: 1 }] }] };
    const lc = HL.costFor(left);
    check("E: a labelled process is its label's word (TRAY), never 'no session'; the app itself is nobody's cost", lc.owners.map((o) => o.key).join() === "TRAY,unlabelled" && !JSON.stringify(lc).includes("no session") && lc.owners[0].memBytes === 5);
  }

  /* The routes: the Builder's origin only. */
  const Sv = await tryImport("../helper/server/server.ts");
  const Pair = await tryImport("../helper/server/pairing.ts");
  if (Sv?.startHelperServer && Pair?.Pairing) {
    writeFileSync(file, text);
    rmSync(presses, { force: true });
    const runner = { subscribe: () => () => {}, snapshot: () => [], submit: async () => ({}), control: async () => ({ ok: true }) };
    const fakePc = (await tryImport("../helper/pc/fake.ts"))?.fakePc;
    const h = await Sv.startHelperServer({ runner, pairing: new Pair.Pairing({ show() {} }), port: 0, lanes: { file, beats: join(tmp, "beats") }, pc: { read: async () => fakePc(), stop: async () => ({}), stopIdle: async () => ({}) } });
    const B = Sv.BUILDER_ORIGIN, at = `http://127.0.0.1:${h.port}`;
    const call = async (path, init = {}) => { const r = await fetch(`${at}${path}`, { ...init, headers: { ...(init.origin ? { origin: init.origin } : {}), ...(init.body ? { "content-type": "application/json" } : {}) }, body: init.body ? JSON.stringify(init.body) : undefined }); return { status: r.status, cors: r.headers.get("access-control-allow-origin"), j: await r.json().catch(() => null) }; };
    const pre = await call("/lanes/archive", { method: "OPTIONS", origin: B }), pre2 = await call("/lanes/press", { method: "OPTIONS", origin: B });
    check("the helper lets the Builder, and only it, send an archive and a press", pre.status === 204 && pre.cors === B && pre2.status === 204 && (await call("/lanes/archive", { method: "POST", origin: "https://evil.test", body: { id: VOID.id, archived: true } })).status === 403 && (await call("/lanes/press", { method: "POST", body: { kind: "check", target: "x" } })).status === 403);
    const ar = await call("/lanes/archive", { method: "POST", origin: B, body: { id: VOID.id, archived: true } });
    const pr = await call("/lanes/press", { method: "POST", origin: B, body: { kind: "model", target: VOID.id, model: "Sonnet 5.5", effort: "low" } });
    check("F/G: through the route, the chat is marked and the press is saved beside lanes.json", ar.status === 200 && ar.j.ok && ar.cors === B && chatOf(JSON.parse(readFileSync(file, "utf8")), VOID.id).archived === true && pr.status === 200 && JSON.parse(readFileSync(presses, "utf8"))[0].model === "Sonnet 5.5");
    const cost = await call("/lanes/pc", { origin: B });
    check("E: GET /lanes/pc gives the Builder the sums, and no other origin anything", cost.status === 200 && cost.j.ok && Array.isArray(cost.j.owners) && cost.cors === B && (await call("/lanes/pc", { origin: "https://evil.test" })).status === 403 && (await call("/lanes/pc")).status === 403);
    await h.close();
  }
}
rmSync(tmp, { recursive: true, force: true });

/* ------------------------------------------------------------ 2. in the Builder */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launch = () => chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
let browser = await launch();
const errors = [];
const posts = [];
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const live = () => JSON.parse(JSON.stringify(FEED));
let feedNow = live();
async function standIn(ctx, origin) {
  await ctx.route(`${HELPER}/**`, (r) => {
    const u = new URL(r.request().url()), method = r.request().method();
    const cors = { "access-control-allow-origin": origin, vary: "Origin" };
    const json = (body) => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" }, body: "" });
    if (u.pathname === "/health") return json({ helper: true, paired: true });
    if (u.pathname === "/lanes/pc") return json(PC);
    if (u.pathname.startsWith("/lanes/file/")) return r.fulfill({ status: 200, contentType: "image/png", headers: cors, body: PNG });
    if (method === "POST") {
      const b = JSON.parse(r.request().postData() ?? "{}");
      posts.push({ path: u.pathname, ...b });
      if (u.pathname === "/lanes/answer") { const d = feedNow.decisions.find((x) => x.id === b.id); if (d) { d.answer = b.answer; d.answeredAt = new Date().toISOString(); } return json({ ok: true, answeredAt: d?.answeredAt }); }
      if (u.pathname === "/lanes/archive") { const x = feedNow.coordinators[0].chats.find((c) => c.id === b.id); if (x) x.archived = b.archived; return json({ ok: true, id: b.id, archived: b.archived }); }
      if (u.pathname === "/lanes/press") { if (b.kind === "choose") { const it = feedNow.iterations.find((i) => i.id === b.target); if (it) it.chosen = b.option; } return json({ ok: true, kind: b.kind, target: b.target }); }
      return json({ ok: true });
    }
    if (u.pathname === "/lanes") return json({ feed: feedNow, beats: [], now: Date.now() });
    return r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!doctype html><title>dock stub</title><body>dock" });
  });
  await ctx.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: feedNow, beats: [], now: Date.now() }) }));
  await ctx.route("**/api/lanes/file/**", (r) => r.fulfill({ status: 200, contentType: "image/png", body: PNG }));
}
const waitFor = async (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
const settled = async (page) => { let a = ""; for (let i = 0; i < 30; i++) { const b = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? [])); if (b === a) return b; a = b; await page.waitForTimeout(1500); } return a; };
const box = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const col = (id) => `[data-manager-column="${id}"]`;
const pane = (id) => `[data-manager-pane="${id}"]`;
async function openManager(page) {
  await page.locator("[data-agents-button]").click();
  const there = await page.locator("[data-agents-manager-open]").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  if (!there) return false;
  await page.locator("[data-agents-manager-open]").click();
  return page.locator("[data-agents-manager]").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
}

try {
  const origin = new URL(BASE).origin;
  /* Still (reduced motion), so the pointer can rest on an orb or a ring. */
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 }, reducedMotion: "reduce" });
  await standIn(ctx, origin);
  const outgoing = [];
  ctx.on("request", (r) => { const u = r.url(); if (!u.startsWith(HELPER) && !u.includes("/api/lanes")) outgoing.push(`${r.method()} ${u} ${r.postData() ?? ""}`); });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`made page: ${e.message}`));
  page.setDefaultTimeout(60_000);
  await openBoard(page, BASE, "solface");
  const before = await settled(page);

  const up = await openManager(page);
  check("A: the Agents dock has a Manager toggle, and it opens the manager", up);
  if (up) {
    await page.waitForSelector("[data-manager-pane]", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const view = await box(page, "[data-agents-manager]");
    const bar = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--topbar-h")) || 44);
    check("A: it takes the whole screen under the top bar", near(view.x, 0) && near(view.w, 1500) && near(view.y, bar, 2) && near(view.b, 1000, 2), JSON.stringify(view));
    const nebula = await page.evaluate(() => { const n = document.querySelector("[data-manager-nebula]"); return n ? `${n.getAttribute("data-manager-nebula")} ${!!n.querySelector("[data-workspace-ground] [data-ground-clouds]")}` : ""; });
    check("A/V (BAM mark 32): on the board's own nebula (the workspace ground), not a black box", nebula === "workspace true", nebula);
    check("A: one board draws at a time (the dock's own stops under the manager)", (await page.locator("[data-lanes-board]").count()) === 1 && (await page.locator('[data-lanes-board="beside"]').count()) === 1);

    /* B: the columns. */
    const c8 = await box(page, col(C8.id)), c7 = await box(page, col(C7.id)), body = await box(page, "[data-manager-body]");
    check("B (BAM mark 31): two columns side by side, the oldest first", !!c8 && !!c7 && near(c8.y, c7.y) && c8.x >= c7.r && (await page.locator("[data-manager-column]").count()) === 2, JSON.stringify({ c8, c7 }));
    check("B: each column runs the full height of the view", c8.h >= body.h - 20 && near(c8.h, c7.h), `${c8.h} of ${body.h}`);
    const ring = await page.evaluate((ids) => ids.map((id) => {
      const o = document.querySelector(`[data-manager-column="${id}"]`), i = o.querySelector("[data-manager-ring-inner]");
      const so = getComputedStyle(o), si = getComputedStyle(i), ro = o.getBoundingClientRect(), ri = i.getBoundingClientRect();
      return { outer: so.borderTopColor, ow: [so.borderTopWidth, so.borderRightWidth, so.borderBottomWidth, so.borderLeftWidth].join(), or: so.borderTopLeftRadius, inner: si.borderTopColor, iw: [si.borderTopWidth, si.borderRightWidth, si.borderBottomWidth, si.borderLeftWidth].join(), ir: si.borderTopLeftRadius, gap: [ri.left - ro.left, ri.top - ro.top, ro.right - ri.right, ro.bottom - ri.bottom].map((n) => Math.round(n * 10) / 10).join(), fill: si.backgroundColor };
    }), [C7.id, C8.id]);
    check("B: the outside ring: a 7 px band in the coordinator's colour and a 3 px line inside it, touching, even all round, rounded", ring.every((r) => r.ow === "7px,7px,7px,7px" && r.iw === "3px,3px,3px,3px" && r.gap === "7,7,7,7" && r.or === "14px" && r.ir === "7px"), JSON.stringify(ring[0]));
    check("B (BAM mark 30): C7, the oldest, green; C8 purple; each column tinted with its colour", ring[0].outer === rgb(FIRST) && ring[0].inner === rgb(FIRST_IN) && ring[1].outer === rgb(PURPLE) && ring[0].fill !== ring[1].fill && !/rgba\(0, 0, 0, 0\)/.test(ring[0].fill), `${ring[0].outer} ${ring[0].inner} ${ring[1].outer}`);
    const head = await page.evaluate((id) => { const h = document.querySelector(`[data-manager-head="${id}"]`); return { c: h.querySelector("[data-manager-cnumber]")?.textContent, size: parseFloat(getComputedStyle(h.querySelector("[data-manager-cnumber]")).fontSize), count: h.querySelector("[data-manager-count]")?.getAttribute("data-manager-count"), turns: h.querySelector("[data-manager-turns]")?.textContent, asks: [...h.querySelectorAll("[data-manager-ask]")].map((e) => e.getAttribute("data-manager-ask")).join() }; }, C8.id);
    const head7 = await page.evaluate((id) => { const h = document.querySelector(`[data-manager-head="${id}"]`); return { turns: h.querySelector("[data-manager-turns]")?.textContent, count: h.querySelector("[data-manager-count]")?.getAttribute("data-manager-count"), asks: [...h.querySelectorAll("[data-manager-ask]")].map((e) => e.getAttribute("data-manager-ask")).join(), btn: h.querySelector("[data-manager-questions]")?.textContent }; }, C7.id);
    check("B: the head: the C-number big, the question count as a plain red disc, the coordinator's own question as a red button, its turn out of 5", head.c === "C8" && head.size >= 26 && head.count === "3" && head.asks === "" && head.turns === "# 2/5" && head7.turns === "# 21/5" && head7.count === "0" /* BAM mark 41: the count is its chat panes' questions; C7's own is in its list */ && head7.asks === "" && head7.btn === "?All" /* and its list is still one press away */ /* BAM mark 11: one question button, no pills */, JSON.stringify({ head, head7 }));
    const blocks = await page.evaluate(() => { const m = (s) => [...document.querySelectorAll(s)]; const is = (e) => (e.classList.contains("molten") || !!e.querySelector(":scope > .molten")) && !!e.querySelector("[data-molten]"); return { heads: m("[data-manager-head]").every(is), feet: m("[data-manager-foot]").every(is), panes: m("[data-manager-pane]:not([data-state=park])").every(is), n: m("[data-manager-pane]").length, kinds: [...new Set(m("[data-manager-pane][data-manager-block]").map((e) => `${e.dataset.state}:${e.dataset.managerBlock}`))].sort().join() }; });
    check("B/U: heads, panes and feet are J's design blocks (the Finish timeline's molten boxes), a pane's block by its state", blocks.heads && blocks.feet && blocks.panes && blocks.kinds === "done:verdant,need:ember,work:azure", JSON.stringify(blocks));
    const stack = await page.evaluate((id) => { const c = document.querySelector(`[data-manager-column="${id}"]`), b = c.querySelector("[data-manager-column-body]").getBoundingClientRect(); return [...c.querySelectorAll("[data-manager-pane]")].map((e) => { const r = e.getBoundingClientRect(); return { id: e.getAttribute("data-manager-pane"), state: e.dataset.state, open: e.dataset.open, x: Math.round(r.x - b.x), w: Math.round(r.width), bw: Math.round(b.width), y: Math.round(r.y), h: Math.round(r.height) }; }); }, C8.id);
    check("B: chats stack one under another at the column's full width, red first, never side by side", stack.length === 6 && stack.every((p, i) => p.x <= 8 && p.w >= p.bw - 16 && (i === 0 || p.y >= stack[i - 1].y + stack[i - 1].h)) && stack[0].state === "need", JSON.stringify(stack.map((p) => [p.state, p.y, p.h])));
    const voidPane = stack.find((p) => p.id === VOID.id), parked = stack.find((p) => p.id === PARKED.id);
    check("B (BAM mark 20): every pane opens at its full size, a parked one too", voidPane.open === "1" && parked.open === "1", `${voidPane.h} ${parked.h}`);
    const parts = await page.evaluate((id) => { const p = document.querySelector(`[data-manager-pane="${id}"]`), hr = p.querySelector("[data-manager-pane-head]"), q = (s) => hr.querySelector(s), top = (e) => Math.round(e.getBoundingClientRect().top - hr.getBoundingClientRect().top);
      return { name: q("[data-manager-name]")?.textContent, dot: q("[data-manager-dot]")?.getAttribute("data-manager-dot"), pill: !!q("[data-manager-pill]"), mem: q("[data-manager-mem]")?.textContent, kinds: [...hr.querySelectorAll("[data-manager-kind]")].map((e) => e.getAttribute("data-manager-kind") + (e.textContent || "")).join(), cpu: q("[data-manager-cpu]")?.textContent, cube: q("[data-manager-cube]")?.getAttribute("data-manager-cube"), age: q("[data-manager-age]")?.textContent, 
        row: [q("[data-manager-name]"), q("[data-manager-dot]"), q("[data-manager-pill]"), q("[data-manager-age]")].every((e) => e && top(e) < 12), lines: p.querySelectorAll("[data-manager-line]").length, bar: (() => { const b = p.querySelector("[data-manager-bar]"); if (!b) return null; const r = b.getBoundingClientRect(), pr = p.getBoundingClientRect(); return { w: Math.round(r.width), pw: Math.round(pr.width), below: r.top > p.querySelector("[data-manager-line]").getBoundingClientRect().bottom - 1, bg: getComputedStyle(b).backgroundColor }; })(), line1: p.querySelector('[data-manager-line="1"]')?.textContent, pw: Math.round(p.getBoundingClientRect().width), sw: p.scrollWidth, out: (() => { const pr = p.getBoundingClientRect(); return [...p.querySelectorAll("b, span, p, input, button, a")].filter((e) => !e.hasAttribute("data-molten")).some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < pr.left - 1 || r.right > pr.right + 1); }); })() }; }, VOID.id);
    const p2 = await page.evaluate((id) => document.querySelector(`[data-manager-pane="${id}"] [data-manager-turns]`)?.textContent, VOID.id);
    check("B: the pane's head row, as drawn: name, state dot, memory pill, the cube, its age", /VOID/.test(parts.name) && parts.dot === "work" && parts.pill && parts.cube === "1" && /^\d+ min$/.test(parts.age) && parts.row && p2 === "2/5", JSON.stringify(parts));
    check("B: two lines of words under it (whole, BAM mark 20), then the solid bar along the bottom, the pane's width", parts.lines === 2 && parts.line1 === VOID.note && parts.bar && parts.bar.below && parts.bar.w >= parts.bar.pw - 30 && parts.bar.bg === "rgb(0, 0, 0)" /* BAM mark 27: plain black */, JSON.stringify(parts.bar));
    check("B: nothing in a pane runs past its sides", parts.out === false);
    const askBtn = await page.evaluate((id) => { const b = document.querySelector(`[data-manager-pane="${id}"] [data-manager-questions]`); return b ? { n: b.getAttribute("data-manager-questions"), text: b.textContent, bg: getComputedStyle(b).backgroundColor } : null; }, PANELS.id);
    check("B (BAM mark 11): a chat's pane has one red question button with its count", askBtn?.n === "1" && askBtn.text === "?1" && askBtn.bg === "rgb(255, 77, 77)", JSON.stringify(askBtn));
    const foot = await page.evaluate((id) => { const c = document.querySelector(`[data-manager-column="${id}"]`), f = c.querySelector("[data-manager-foot]"), i = c.querySelector("[data-manager-ring-inner]"); return { text: f.textContent, atBottom: Math.abs(f.getBoundingClientRect().bottom - (i.getBoundingClientRect().bottom - 3)) < 2, open: f.dataset.open }; }, C8.id);
    check("B: the foot, at the bottom of the column: finished chats by age, the retired coordinator, the archived count; folded", /^Age/.test(foot.text) && /2 finished · newest \d+ min, oldest \d+ h/.test(foot.text) && /1 retired coordinator/.test(foot.text) && /1 archived/.test(foot.text) && foot.atBottom && foot.open === "1" /* BAM mark 41: finished chats stay in view */, foot.text);

    /* Privacy (on by default): badges, no memory figure, no model name. */
    /* The New coordinator box names the models one can choose; that is a choice, not a chat's model. */
    const shut = await page.evaluate(() => { const m = document.querySelector("[data-agents-manager]").cloneNode(true); m.querySelector("[data-manager-new-coord]")?.remove(); document.body.appendChild(m); const t = m.innerText; m.remove(); return t; });
    check("private by default: badges for names, no memory figure, no model name, no path or pid", !/\bVoid\b|Panels|Coordinator 7/.test(shut) && /🔮 VOID/.test(shut) && !/700 MB|Opus|Fable/.test(shut) && !/Users\\Josh|4242/.test(shut) && /memory/.test(shut));
    await page.locator("[data-manager-private]").click();
    await page.waitForTimeout(400);

    /* E: PC cost. */
    const cost = await page.evaluate((id) => { const p = document.querySelector(`[data-manager-pane="${id}"]`); return { mem: p.querySelector("[data-manager-mem]")?.textContent, kinds: [...p.querySelectorAll("[data-manager-kind]")].map((e) => e.getAttribute("data-manager-kind") + (e.textContent || "")).join(), cpu: p.querySelector("[data-manager-cpu]")?.textContent, bar: p.querySelector("[data-manager-pill-bar]")?.style.width, pill: (() => { const r = p.querySelector("[data-manager-pill]").getBoundingClientRect(); return `${Math.round(r.width)}x${Math.round(r.height)}`; })() }; }, VOID.id);
    check("E: on the pane: memory in the pill (84 × 16, its bar on one scale), the kind icons with a count, CPU now and running time", cost.mem === "700 MB" && cost.kinds === "shell2,node" && /^CPU 5% · 10 min$/.test(cost.cpu) && cost.bar === "100%" && cost.pill === "84x16", JSON.stringify(cost));
    check("E (BAM mark 41): a chat that runs nothing shows an empty pill; a small one's bar is small", (await page.locator(`${pane(ROUND.id)} [data-manager-pill]:not([data-empty])`).count()) === 0 && (await page.locator(`${pane(ROUND.id)} [data-manager-pill][data-empty]`).count()) === 1 && (await page.evaluate((id) => document.querySelector(`[data-manager-pane="${id}"] [data-manager-pill-bar]`)?.style.width, PANELS.id)) === "7%");
    await page.locator(`${pane(VOID.id)} [data-manager-kind="shell"]`).hover();
    await page.waitForTimeout(250);
    const one = await page.locator(`${pane(VOID.id)} [data-manager-shares]`).innerText().catch(() => "");
    check("E: hovering an icon tells that kind's share of the chat's total", one.trim() === "PowerShell or cmd ×2 · 434 MB · 62% of this chat · 80% of its CPU", one);
    await page.locator(`${pane(VOID.id)} [data-manager-pill]`).hover();
    await page.waitForTimeout(250);
    check("E: hovering the pill tells every kind's", (await page.locator(`${pane(VOID.id)} [data-manager-share]`).count()) === 2);
    await page.mouse.move(5, 500);
    const headMem = await page.evaluate((id) => document.querySelector(`[data-manager-head="${id}"] [data-manager-mem]`)?.textContent, C8.id);
    check("E: the column head sums its coordinator and its chats", headMem === "850 MB", headMem);
    const loose = await page.locator("[data-manager-loose]").innerText();
    check("E/Y: the tray is shown by its label's word, and nothing says 'no session'", /TRAY · 235 MB · up 7 h/.test(loose) && !/no session/i.test(await page.locator("[data-agents-manager]").innerText()), loose);

    /* C: the orbs beside the columns. */
    const orbs = await box(page, "[data-manager-orbs]");
    const boardBg = await page.evaluate(() => { const b = document.querySelector('[data-lanes-board="beside"]'); return [getComputedStyle(b).backgroundColor, getComputedStyle(b.querySelector("svg")).backgroundColor].join(); });
    check("C: the orb system has its own corner at the right of the columns, with no box behind it", orbs.x >= c7.r && orbs.w >= 300 && near(orbs.r, 1500, 12) && boardBg === "rgba(0, 0, 0, 0),rgba(0, 0, 0, 0)" && (await page.locator("[data-manager-orbs] [data-lanes-sun]").count()) === 1, `${JSON.stringify(orbs)} ${boardBg}`);
    const rings = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-ring]")].map((r) => `${r.getAttribute("data-lanes-ring")}=${r.getAttribute("data-own")}`).sort().join());
    check("C/S: a ring per column, each in its coordinator's colour, whatever its chats' states", rings === [`${C7.id}=${FIRST}`, `${C8.id}=${PURPLE}`].sort().join(), rings);
    check("C: the chats of a column are the orbs of its ring; finished ones beads; the retired coordinator by the sun; an archived chat nowhere", (await page.locator(`[data-lanes-orb="${VOID.id}"]`).count()) === 1 && (await page.locator(`[data-lanes-orb="${C7.id}"]`).count()) === 0 /* BAM mark 36: the ring is the coordinator */ && (await page.locator(`[data-lanes-bead="${FIN_A.id}"]`).count()) === 1 && (await page.locator("[data-lanes-retired]").count()) === 1 && (await page.locator(`[data-lanes-orb="${ARCHIVED.id}"], [data-lanes-bead="${ARCHIVED.id}"]`).count()) === 0);
    const litOf = (id) => page.evaluate((i) => document.querySelector(`[data-lanes-ring="${i}"]`)?.getAttribute("data-lit"), id);
    await page.locator(`${col(C7.id)} [data-manager-foot]`).hover();
    await page.waitForTimeout(400);
    const lit7 = await litOf(C7.id), lit8 = await litOf(C8.id);
    check("C: hovering a column lights its ring, and names it", lit7 === "1" && lit8 === "0" && /^C7 · /.test((await page.locator(`[data-lanes-ring-name="${C7.id}"]`).textContent().catch(() => "")) ?? ""), `${lit7} ${lit8}`);
    await page.mouse.move(5, 500);
    await page.locator(`[data-ring-seg="${C8.id}"]`).first().dispatchEvent("mouseover", { bubbles: true });
    await page.waitForTimeout(400);
    check("C: …and the other way round: hovering a ring lights its column", (await page.locator(col(C8.id)).getAttribute("data-lit")) === "1" && (await page.locator(col(C7.id)).getAttribute("data-lit")) === "0" && /^C8 · /.test((await page.locator(`[data-lanes-ring-name="${C8.id}"]`).textContent().catch(() => "")) ?? ""));
    await page.locator(`[data-lanes-hit="${PARKED.id}"]`).hover({ force: true });
    await page.waitForTimeout(400);
    const shown = await page.evaluate((id) => { const p = document.querySelector(`[data-manager-pane="${id}"]`); return { shown: p.dataset.shown, open: p.dataset.open, lines: p.querySelectorAll("[data-manager-line]").length }; }, PARKED.id);
    check("C/T: hovering an orb shows that chat in its column (its pane opens, lit)", shown.shown === "1" && shown.open === "1" && shown.lines >= 1, JSON.stringify(shown));
    await page.locator(`[data-lanes-hit="${FIN_A.id}"]`).hover({ force: true });
    await page.waitForTimeout(400);
    check("C/T: …a finished chat's bead too, as a pane at the top of its column", (await page.locator(`${col(C8.id)} ${pane(FIN_A.id)}[data-peek]`).count()) === 1 && (await page.locator(pane(PARKED.id)).getAttribute("data-shown")) === "0");
    await page.locator(`[data-lanes-hit="${PARKED.id}"]`).dispatchEvent("pointerdown", { button: 0, clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
    await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 0, clientY: 0, pointerId: 1 })));
    await page.mouse.move(5, 500);
    await page.waitForTimeout(400);
    check("C/T: a press pins it: it stays shown with the pointer away", (await page.locator(pane(PARKED.id)).getAttribute("data-pinned")) === "1" && (await page.locator(pane(PARKED.id)).getAttribute("data-shown")) === "1");

    /* G: the model chip. */
    const chip = `${pane(VOID.id)} [data-manager-chip]`;
    check("G: the chip on a pane says what the chat runs on", ((await page.locator(`${chip} [data-manager-chip-open]`).textContent()) ?? "").trim() === "▸ Opus 5.5 · medium" && /Fable 5.2 · high/.test((await page.locator(`[data-manager-head="${C7.id}"] [data-manager-chip-open]`).textContent()) ?? ""));
    await page.locator(`${chip} [data-manager-chip-open]`).click();
    check("G: a press opens the choices in place: four models, five efforts, what it runs on now marked", (await page.locator(`${chip} [data-manager-model]`).count()) === 4 && (await page.locator(`${chip} [data-manager-effort]`).count()) === 5 && /now/.test((await page.locator(`${chip} [data-manager-model="Opus 5.5"]`).textContent()) ?? ""));
    await page.locator(`${chip} [data-manager-model="Fable 5.2"]`).click();
    await page.locator(`${chip} [data-manager-effort="high"]`).click();
    await page.locator(`${chip} [data-manager-model-use]`).click();
    await waitFor(page, (id) => /asked/.test(document.querySelector(`[data-manager-pane="${id}"] [data-manager-chip-open]`)?.textContent ?? ""), VOID.id, 4000);
    const mp = posts.find((p) => p.path === "/lanes/press" && p.kind === "model");
    check("G: Use sends one press through the helper for the coordinator: {kind: model, target, model, effort}", mp?.target === VOID.id && mp.model === "Fable 5.2" && mp.effort === "high" && Object.keys(mp).sort().join() === "effort,kind,model,path,target", JSON.stringify(mp));
    const chipNow = ((await page.locator(`${chip} [data-manager-chip-open]`).textContent()) ?? "").trim();
    check("G: …and the chip reads what was asked until the coordinator has applied it", chipNow === "▸ Opus 5.5 · medium → Fable 5.2 · high asked", chipNow);

    /* D (BAM mark 27): a chat's question is open first, in place on its pane; the pane stretches down in its column. */
    const scrollBefore = await page.evaluate(() => [window.scrollY, document.querySelector(`[data-manager-body]`).scrollTop].join());
    await page.waitForSelector('[data-manager-question="q-panels"]', { timeout: 4000 }).catch(() => {});
    const q = await page.evaluate(([c8, c7, PANELS_ID]) => { const a = document.querySelector('[data-manager-question="q-panels"]'); if (!a) return null; const c = document.querySelector(`[data-manager-column="${c8}"]`), r = a.getBoundingClientRect(), cr = c.getBoundingClientRect(), hd = c.querySelector("[data-manager-head]").getBoundingClientRect();
      const ch = [...a.querySelectorAll("[data-manager-choose]")].map((b) => { const br = b.getBoundingClientRect(); return br.top >= 0 && br.bottom <= innerHeight && br.left >= cr.left && br.right <= cr.right; });
      return { inCol: c.contains(a) && r.left >= cr.left && r.right <= cr.right, inPane: !!a.closest(`[data-manager-pane]`)?.matches('[data-manager-pane]') && a.closest("[data-manager-pane]").getAttribute("data-manager-pane") === PANELS_ID, underHead: r.top >= hd.bottom - 1, chooses: ch.length, allSeen: ch.every(Boolean), panes8: c.querySelectorAll("[data-manager-pane]").length, panes7: document.querySelector(`[data-manager-column="${c7}"]`).querySelectorAll("[data-manager-pane]").length + document.querySelectorAll(`[data-manager-column="${c7}"] [data-manager-no-panes]`).length, text: a.textContent, at: a.querySelector("[data-manager-question-at]")?.textContent, across: a.querySelector("[data-manager-options]")?.getAttribute("data-manager-options"), blocks: [...a.querySelectorAll("[data-manager-option]")].every((o) => o.classList.contains("molten")) }; }, [C8.id, C7.id, PANELS.id]);
    check("D (BAM mark 27): its question is open first, in place on its own pane in its column, the other chats still there", q?.inCol && q.inPane && q.panes8 >= 2 && q.panes7 >= 1, JSON.stringify({ ...q, text: undefined }));
    check("D: …with everything needed to answer: What, Why, How, what each option gives, the pick, and every Choose in view", /What.*Three looks/.test(q?.text ?? "") && /Why/.test(q.text) && /How/.test(q.text) && /Your timeline boxes/.test(q.text) && /pick/.test(q.text) && q.chooses === 3 /* the pane stretches down, so a Choose may sit below the fold (mark 27) */ && q.at === "Question 1 of 1 · PANELS" /* counted in its own chat (console mark 18) */ && q.blocks, q?.at);
    check("D/N: having it open never scrolls the page", (await page.evaluate(() => [window.scrollY, document.querySelector(`[data-manager-body]`).scrollTop].join())) === scrollBefore);
    /* BAM mark 11 / console mark 18: a pane's button counts that chat's questions only, so its one question has no Next. */
    check("D: Next stays within the list it was opened from (this chat has one question)", await page.locator(`${pane(PANELS.id)} [data-manager-next]`).isDisabled());
    await page.locator('[data-manager-question="q-panels"] [data-manager-choose="c"]').click();
    const backToChats = await waitFor(page, (id) => !document.querySelector('[data-manager-question="q-panels"]') && document.querySelectorAll(`[data-manager-column="${id}"] [data-manager-pane]`).length > 0, C8.id, 6000);
    const ans = posts.find((p) => p.path === "/lanes/answer");
    check("D: Choose sends the answer by the helper's answer route, and the column returns", backToChats && ans?.id === "q-panels" && ans.answer === "c", JSON.stringify(ans));
    const dropped = await waitFor(page, (id) => document.querySelector(`[data-manager-head="${id}"] [data-manager-count]`)?.getAttribute("data-manager-count") === "2" && !document.querySelector('[data-manager-ask="q-panels"]'), C8.id, 8000);
    check("D: …the head's count drops and the pane's red button goes", dropped);

    /* D: pictures take the full width, as slides. */
    /* BAM mark 27: the picture question sits open in its pane; one press takes its pictures across the whole view. */
    await page.locator(`${pane(RINGS.id)} [data-manager-open-slides="q-rings"]`).click();
    await page.waitForSelector("[data-manager-slides]", { timeout: 4000 }).catch(() => {});
    const sl = await box(page, "[data-manager-slides]");
    const s0 = await page.evaluate(() => { const s = document.querySelector("[data-manager-slides]"); if (!s) return null; const o = [...s.querySelectorAll("[data-manager-slide-option]")].map((e) => e.getBoundingClientRect()); return { n: s.getAttribute("data-manager-slides"), at: s.getAttribute("data-slide-at"), id: s.querySelector("[data-manager-slide]")?.getAttribute("data-manager-slide"), count: s.querySelector("[data-manager-slide-count]")?.textContent, side: o.length === 2 && Math.abs(o[0].top - o[1].top) < 2 && o[1].left > o[0].right - 1, wide: o[0]?.width, chooses: s.querySelectorAll("[data-manager-slide-choose]").length, pics: s.querySelectorAll("img[data-manager-slide-picture]").length }; });
    check("D: a decision with pictures opens across the whole view (both columns and the orbs give way)", !!sl && near(sl.x, body.x, 2) && near(sl.w, body.w, 2) && near(sl.h, body.h, 2), JSON.stringify(sl));
    check("D: its options side by side, large, each with its picture and its own Choose; '1 of 2'", s0?.id === "q-rings" && s0.side && s0.wide > 500 && s0.chooses === 2 && s0.pics === 2 && /picture round 1 of 2/.test(s0.count), JSON.stringify(s0));
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(250);
    const s1 = await page.evaluate(() => { const s = document.querySelector("[data-manager-slides]"); return { at: s?.getAttribute("data-slide-at"), id: s?.querySelector("[data-manager-slide]")?.getAttribute("data-manager-slide"), across: s?.querySelector("[data-manager-slide-options]")?.getAttribute("data-manager-slide-options") }; });
    check("D: the down arrow steps to the next round, one round a slide, three across", s1.at === "1" && s1.id === "round-1" && s1.across === "3", JSON.stringify(s1));
    await page.keyboard.press("ArrowDown");
    await page.locator('[data-manager-slide-step="up"]').click();
    await page.waitForTimeout(200);
    check("D: the ends hold, and ▲ steps back up", (await page.locator("[data-manager-slides]").getAttribute("data-slide-at")) === "0");
    await page.locator("[data-manager-slides]").hover();
    await page.mouse.wheel(0, 300);
    await page.waitForTimeout(300);
    check("D: the wheel steps too, once the slide has no further to scroll", (await page.locator("[data-manager-slides]").getAttribute("data-slide-at")) === "1");
    await page.locator('[data-manager-slide-choose="b"]').click();
    await waitFor(page, () => !document.querySelector("[data-manager-slides]"), null, 5000);
    const cp = posts.find((p) => p.path === "/lanes/press" && p.kind === "choose");
    check("D: Choose on a picture round saves the pick for the coordinator, and the columns return after the last one", cp?.target === "round-1" && cp.option === "b" && (await page.locator("[data-manager-slides]").count()) === 0, JSON.stringify(cp));
    /* BAM mark 27: the picture question sits open in its pane; one press takes its pictures across the whole view. */
    await page.locator(`${pane(RINGS.id)} [data-manager-open-slides="q-rings"]`).click();
    await page.waitForSelector("[data-manager-slides]", { timeout: 4000 }).catch(() => {});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    check("D: Escape returns to the columns", (await page.locator("[data-manager-slides]").count()) === 0 && (await page.locator("[data-manager-column]").count()) === 2);

    /* The cube. */
    await page.locator(`${pane(VOID.id)} [data-manager-cube]`).click();
    await page.waitForSelector("[data-manager-cube-page]", { timeout: 4000 }).catch(() => {});
    check("the cube opens what is left to look at, over the column", /Float through the void/.test((await page.locator(`${col(C8.id)} [data-manager-cube-page]`).textContent().catch(() => "")) ?? "") && (await page.locator("[data-manager-check]").count()) === 1);
    await page.locator('[data-manager-looks-right="chk-void"]').click();
    await page.waitForTimeout(400);
    check("…and Looks right saves a check press", posts.some((p) => p.path === "/lanes/press" && p.kind === "check" && p.target === "chk-void"));
    await page.locator("[data-manager-back]").click();

    /* F: archive, with undo. */
    const chatsBefore = feedNow.coordinators[0].chats.length;
    await page.locator(`${pane(PARKED.id)} [data-manager-archive]`).click();
    const goneNow = await waitFor(page, (id) => !document.querySelector(`[data-manager-pane="${id}"]`) && !!document.querySelector("[data-manager-undo]"), PARKED.id, 3000);
    const ap = posts.filter((p) => p.path === "/lanes/archive");
    check("F: one press archives a chat: its pane goes at once, the helper is told, an Undo shows", goneNow && ap.length === 1 && ap[0].id === PARKED.id && ap[0].archived === true, JSON.stringify(ap));
    await page.waitForTimeout(900);
    check("F: …its orb leaves the board, and the foot counts it", (await page.locator(`[data-lanes-orb="${PARKED.id}"]`).count()) === 0 && /2 archived/.test((await page.locator(`${col(C8.id)} [data-manager-foot]`).textContent()) ?? ""));
    check("F: nothing is deleted: the chat's row is still in the feed", feedNow.coordinators[0].chats.length === chatsBefore && feedNow.coordinators[0].chats.find((c) => c.id === PARKED.id)?.archived === true && /Nothing is deleted/.test((await page.locator("[data-manager-undo]").textContent()) ?? ""));
    await page.locator("[data-manager-undo-press]").click();
    const backNow = await waitFor(page, (id) => !!document.querySelector(`[data-manager-pane="${id}"]`) && !document.querySelector("[data-manager-undo]"), PARKED.id, 3000);
    check("F: Undo puts it back", backNow && posts.filter((p) => p.path === "/lanes/archive").at(-1)?.archived === false);
    if ((await page.locator(`${col(C8.id)} [data-manager-foot]`).getAttribute("data-open")) !== "1") await page.locator(`${col(C8.id)} [data-manager-foot-toggle]`).click();
    await page.locator(`${col(C8.id)} [data-manager-archived] summary`).click();
    check("F: an archived chat stays findable in the foot, with Put back", (await page.locator(`[data-manager-archived-chat="${ARCHIVED.id}"] [data-manager-unarchive]`).count()) === 1 && (await page.locator(`[data-manager-foot-chat="${FIN_A.id}"]`).count()) === 1);

    /* The pie's slice opens the question here, not in the dock under it. */
    await page.locator('[data-agents-slice="q-own"]').click().catch(() => {});
    await page.waitForTimeout(400);
    check("a slice of the Agents button's pie opens its question over its column here", (await page.locator(`${col(C7.id)} [data-manager-question="q-own"]`).count()) === 1);
    await page.keyboard.press("Escape");

    /* Widths: nothing clipped, the orbs keep their corner. */
    for (const w of [1100, 1900]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.waitForTimeout(500);
      const fit = await page.evaluate(() => { const cs = [...document.querySelectorAll("[data-manager-column]")].map((e) => e.getBoundingClientRect()), o = document.querySelector("[data-manager-orbs]").getBoundingClientRect(); return { cols: cs.map((r) => Math.round(r.width)), orbs: Math.round(o.width), over: document.documentElement.scrollWidth > innerWidth + 1, order: cs.every((r, i) => i === 0 || r.left >= cs[i - 1].right) && o.left >= cs[cs.length - 1].right - 1 && o.right <= innerWidth + 1, clip: [...document.querySelectorAll("[data-manager-pane]")].some((p) => { const pr = p.getBoundingClientRect(); return [...p.querySelectorAll("b, span, p, input, button, a")].filter((e) => !e.hasAttribute("data-molten")).some((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < pr.left - 1 || r.right > pr.right + 1); }); }) }; });
      check(`at ${w} px: the columns share the width (300 to 640 each), the orbs keep their corner, nothing is clipped`, fit.cols.every((c) => c >= 300 && c <= 640) && fit.orbs >= 300 && !fit.over && fit.order && !fit.clip, JSON.stringify(fit));
    }
    await page.setViewportSize({ width: 1500, height: 1000 });

    /* Back to the dock, and shut. */
    await page.locator("[data-manager-to-dock]").click();
    await page.waitForTimeout(500);
    check("A: Dock goes back to the dock at the side, its own board drawing again", (await page.locator("[data-agents-manager]").count()) === 0 && (await page.locator("[data-agents-dock] [data-lanes-board]").count()) === 1);
    await page.locator("[data-agents-manager-open]").click();
    await page.waitForSelector("[data-agents-manager]", { timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);

    /* Nothing read from the helper leaves. */
    const text = await page.locator("[data-agents-manager]").innerText();
    check("the helper's words are on screen (Private off), so the next two checks mean something", HELPER_WORDS.some((w) => text.includes(w)) && /700 MB/.test(text));
    const saved = await page.evaluate(() => JSON.stringify(window.__studioHistory?.doc() ?? {}));
    const kept = await page.evaluate(() => JSON.stringify(Object.fromEntries(Object.entries(localStorage).filter(([k]) => k.startsWith("builder.")))));
    const leaks = outgoing.filter((r) => HELPER_WORDS.some((w) => r.includes(w)) || /TRAY|700 MB|PIONEER/.test(r));
    check("nothing read from the helper is in any request the page sent (but its own presses to the helper)", outgoing.length > 0 && leaks.length === 0, leaks[0]?.slice(0, 160) ?? `${outgoing.length} requests`);
    check("…nor in the saved site, nor in what the Builder keeps of it", saved.length > 1000 && ![...HELPER_WORDS, "PIONEER", "TRAY"].some((w) => saved.includes(w) || kept.includes(w)));
    const after = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
    check("the board doesn't move by a pixel", before === after && before.length > 10, `${before.length} ${after.length}`);
    await page.locator("[data-manager-close]").click();
    await page.waitForTimeout(300);
    check("A: the X shuts the manager and the dock", (await page.locator("[data-agents-manager], [data-agents-dock]").count()) === 0);
  }
  await ctx.close();
} catch (e) { check("the Builder part ran to the end", false, `${String(e?.stack ?? e).split("\n").slice(0, 3).join(" ").slice(0, 300)} | ${errors.join(" | ").slice(0, 300)}`); }

/* ------------------------------------------------------------ 3. the six repo fixtures */
const SITE_MINUTES = 4;
async function onFixture(site) {
  const file = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); return; }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  feedNow = live();
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
  await standIn(ctx, new URL(BASE).origin);
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (e) => errors.push(`${site}: ${e.message}`));
  await openBoard(page, BASE, "solface");
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
  const before = await settled(page);
  const up = await openManager(page);
  await page.waitForSelector("[data-manager-pane]", { timeout: 30000 }).catch(() => {});
  await page.waitForSelector("[data-manager-orbs] [data-lanes-sun]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const s = await page.evaluate(([c7, blue]) => {
    const c = document.querySelector(`[data-manager-column="${c7}"]`), v = document.querySelector("[data-agents-manager]")?.getBoundingClientRect();
    return {
      cols: document.querySelectorAll("[data-manager-column]").length, panes: document.querySelectorAll("[data-manager-pane]").length,
      ring: c ? getComputedStyle(c).borderTopColor + getComputedStyle(c).borderTopWidth : "", blocks: document.querySelectorAll("[data-manager-head].molten, [data-manager-head] > .molten").length,
      orbs: document.querySelectorAll("[data-manager-orbs] [data-lanes-orb]").length, own: document.querySelector(`[data-lanes-ring="${c7}"]`)?.getAttribute("data-own") === blue,
      asks: document.querySelectorAll("[data-manager-ask]").length, pills: document.querySelectorAll("[data-manager-pane] [data-manager-pill]").length, full: !!v && v.width >= innerWidth - 1 && v.bottom >= innerHeight - 1,
      nebula: !!document.querySelector("[data-manager-nebula] [data-workspace-ground]"),
    };
  }, [C7.id, FIRST]);
  /* BAM mark 27: the question is already open in place on its pane. */
  const opened = await page.locator(`${col(C8.id)} [data-manager-question="q-panels"] [data-manager-choose]`).count();
  const after = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
  check(`${site}: the manager opens full screen on the nebula: two columns in their rings and blocks, six panes, the orbs beside them, the questions, the PC cost`, up && s.cols === 2 && s.panes === 6 && s.ring === `${rgb(FIRST)}7px` && s.blocks === 2 && s.orbs === 5 /* BAM mark 36: no coordinator orbs */ && s.own && s.asks === 0 && s.pills === 6 /* mark 41: every pane */ && s.full && s.nebula, JSON.stringify(s));
  check(`${site}: a question opens over its column with every Choose`, opened === 3, String(opened));
  check(`${site}: the board doesn't move by a pixel`, before === after && before.length > 10, `${before.length} ${after.length}`);
  await ctx.close();
}
if (SINK) {
  for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
    if (process.env.ONLY_SITE && process.env.ONLY_SITE !== site) continue;
    let t;
    try { await Promise.race([onFixture(site), new Promise((_, no) => { t = setTimeout(() => no(new Error(`stalled for ${SITE_MINUTES} minutes`)), SITE_MINUTES * 60_000); })]); }
    catch (e) {
      check(`${site}: ran to the end`, false, String(e?.message ?? e).split("\n")[0]);
      await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
      browser = await launch();
    } finally { clearTimeout(t); }
  }
} else console.log("  --   the fixtures skipped: no fixtures folder given (argv 3 or SINK)");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await Promise.race([browser.close().catch(() => {}), new Promise((r) => setTimeout(r, 10_000))]);
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
