#!/usr/bin/env node
/**
 * ORBS 2 (J, 2026-11-10): the Agents board, second round.
 *
 *   A. the helper's state, always visible: a mark on the Agents button and a
 *      line at the top of the dock (paired and answering, answering but not
 *      paired, not answering) with when it was last heard from; it follows
 *      the helper within a few seconds, without a reload, with the dock open
 *      or shut, and never uses the polio-helper:// link;
 *   B. questions on the orbs: the Agents button counts the questions waiting
 *      on J (dock shut too), the asking orb carries the mark, and a press on
 *      it opens that question with its options as buttons;
 *   C. finished chats are one archive body with a count; a press fans out the
 *      latest dozen, and search reaches the rest; only working, waiting and
 *      parked chats are orbs of their own;
 *   D. one Tune drawer of live sliders with Reset, kept per browser, the look
 *      exported and imported as one small JSON; the drawer is generic (any
 *      schema), the board is its first user;
 *   E. weighted orbs: three texture sets, a drag flings an orb and it settles
 *      home exactly (no jitter), one draw a frame with 40 chats (counted, any machine), drawn only
 *      while something moves, still under prefers-reduced-motion;
 *   5. privacy (handovers/open/privacy-rules.md): Private on by default; chat
 *      names drawn as badges; the PC view's pid, memory, command line and
 *      folder folded under one Details per row and "hidden" while private.
 *
 * Then each of the six repo fixtures, loaded on the board with the dock open:
 * the mark, the count, the archive and Tune are there, and the board doesn't
 * move by a pixel.
 *
 *   npx next start -p 3600          (a build of this branch)
 *   node tests/orbs-2.mjs http://127.0.0.1:3600 [fixtures folder with sites/<name>/site/document.json]
 *
 * Covers: src/features/agents/lanes.ts, src/features/agents/feed.ts, src/features/agents/LanesBoard.tsx, src/features/agents/AgentsDock.tsx, src/features/agents/Decisions.tsx, src/features/agents/boardTune.ts, src/features/agents/orbArt.ts, src/features/agents/privacy.ts, src/core/ui/tune/tune.ts, src/core/ui/tune/TuneDrawer.tsx, helper/dock/pcview.ts, helper/dock/privacy.ts, helper/server/lanes.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3600").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? "";
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const close = (a, b, e) => Math.abs(a - b) <= e;
const tryImport = async (p) => { try { return await import(p); } catch (e) { check(`${p} loads`, false, String(e?.message ?? e).split("\n")[0].slice(0, 140)); return null; } };

/*
 * A made feed of 42 chats: two live coordinators (B, C), two retired (A, all done; D, marked retired), three open
 * questions (one carried from a retired lane, one about a chat that retired with it unanswered) and one answered.
 */
const minutes = (m) => new Date(Date.now() - m * 60_000).toISOString();
const chat = (c, k, state, extra = {}) => ({ id: `local_${c}${String(k).padStart(7, "0")}-0000-4000-8000-000000000000`, name: `Secret client ${c}${k}`, lane: `lane-${c}${k}`, code: `C${c.toUpperCase()}${k}`, emoji: "🔮", state, lastSeen: minutes(k * 7 + c.charCodeAt(0)), ...extra });
const FEED = {
  decisions: [
    { id: "q-orbit", order: 1, about: "lane-b7", question: "Which orbit speed?", options: [{ key: "a", label: "Slow" }, { key: "b", label: "Fast", pick: true }], answer: "", answeredAt: "", asked: minutes(30) },
    { id: "q-merge", order: 2, about: "lane-c2", askedBy: "lane-a3", carried: minutes(90), asked: minutes(2 * 1440 + 60), question: "Merge which first?", what: "Two branches touch the dock.", why: "Merging both at once conflicts.", how: "Press one; the other rebases after.", context: "Long background that sits under a fold.",
      options: [{ key: "a", label: "Orbs", desc: "The board lands first.", pick: true }, { key: "b", label: "Veil", desc: "The console lands first." }], answer: "", answeredAt: "" },
    { id: "q-left", order: 3, about: "lane-c1", question: "Keep the old dock tab?", options: [{ key: "a", label: "Keep" }, { key: "b", label: "Drop" }], answer: "", answeredAt: "", asked: minutes(600) },
    { id: "q-done", order: 0, about: "lane-a1", question: "Already answered", options: [{ key: "a", label: "Yes" }], answer: "a", answeredAt: minutes(5) },
  ],
  coordinators: [
    { id: "local_cccccccc-0000-4000-8000-00000000000a", name: "Coordinator A", chats: Array.from({ length: 14 }, (_, k) => chat("a", k + 1, "done")) },
    { id: "local_cccccccc-0000-4000-8000-00000000000b", name: "Coordinator B", chats: [...Array.from({ length: 10 }, (_, k) => chat("b", k + 1, k < 6 ? "done" : k === 6 ? "need" : "work"))] },
    { id: "local_cccccccc-0000-4000-8000-00000000000c", name: "Coordinator C", chats: [...Array.from({ length: 16 }, (_, k) => chat("c", k + 1, k < 6 ? "done" : k === 1 ? "need" : k % 3 === 0 ? "park" : "work"))] },
    { id: "local_cccccccc-0000-4000-8000-00000000000d", name: "Coordinator D", retired: true, chats: [chat("d", 1, "done", { lastSeen: minutes(9000) }), chat("d", 2, "work", { lastSeen: minutes(9100) })] },
  ],
};
FEED.coordinators[2].chats[1].state = "need";
/* Piece G: a chat's note and latest line, with a path, a pid and a word that must never leave the browser. */
FEED.coordinators[1].chats[6].note = String.raw`Working on HELPERTEXT-7f3 in C:\Users\Josh\Pleo\work-secret, pid 4242`;
FEED.coordinators[1].chats[6].last = "Pushed HELPERTEXT-last-91 for review";
const HELPER_WORDS = ["HELPERTEXT-7f3", "HELPERTEXT-last-91"];
const ALL = FEED.coordinators.flatMap((c) => c.chats);
const DONE = ALL.filter((x) => x.state === "done");
const LIVE = FEED.coordinators.slice(1, 3).flatMap((c) => c.chats).filter((x) => x.state !== "done");
const OPEN = FEED.decisions.filter((d) => !d.answer);
const QM = FEED.decisions.find((d) => d.id === "q-merge");
const asker = FEED.coordinators[1].chats[6], asker2 = FEED.coordinators[2].chats[1], leftover = FEED.coordinators[2].chats[0];
const BEADS = FEED.coordinators.slice(1, 3).flatMap((c) => c.chats).filter((x) => x.state === "done" && x.id !== leftover.id);

/* ------------------------------------------------------------ 1. pure */
const L = await tryImport("../src/features/agents/lanes.ts");
const T = await tryImport("../src/core/ui/tune/tune.ts");
const BT = await tryImport("../src/features/agents/boardTune.ts");
const ART = await tryImport("../src/features/agents/orbArt.ts");
const PV = await tryImport("../src/features/agents/privacy.ts");
const HL = await tryImport("../helper/server/lanes.ts");

if (L?.helperStateOf) {
  check("A: /health saying paired is paired; saying not paired, or only answering, is answering; nothing is off",
    L.helperStateOf({ health: { paired: true }, answered: true }) === "paired" && L.helperStateOf({ health: { paired: false }, answered: true }) === "answering" && L.helperStateOf({ health: null, answered: true }) === "answering" && L.helperStateOf({ health: null, answered: false }) === "off");
  check("A: words for each state, the off one naming the PC asleep", /paired/.test(L.helperWords("paired", true)) && /not paired/.test(L.helperWords("answering", false)) && /asleep/.test(L.helperWords("off", null)) && L.HELPER_POLL_MS <= 3000);
} else check("A: the helper's state is read", false);

if (L?.archiveOf) {
  const feed = L.readFeed(FEED);
  const arch = L.archiveOf(feed);
  check("C: the archive is every finished chat, latest heard from first", arch.length === DONE.length && arch.every((x, i) => i === 0 || Date.parse(arch[i - 1].lastSeen) >= Date.parse(x.lastSeen)), `${arch.length}`);
  check("C: search by name or lane, however written; empty is everything", L.searchArchive(arch, "client a7").map((x) => x.code).join() === "CA7" && L.searchArchive(arch, "LANE_A1").length >= 1 && L.searchArchive(arch, "").length === arch.length && L.searchArchive(arch, "nothing like it").length === 0);
  const slots = Array.from({ length: 12 }, (_, k) => L.archiveSlot(k, 12));
  check("C: a dozen fanned out evenly round the archive, none on another", slots.every((p, i) => slots.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 20)) && L.ARCHIVE_FAN === 12);
  const ch = feed.coordinators[2].chats.filter((x) => x.state !== "done");
  check("D: order on a ring by state puts red first; by age the oldest first; else as listed", L.orderChats(ch, "state")[0].state === "need" && L.orderChats(ch, "coordinator").map((x) => x.id).join() === ch.map((x) => x.id).join() && Date.parse(L.orderChats(ch, "age")[0].lastSeen) <= Date.parse(L.orderChats(ch, "age").at(-1).lastSeen));
  /* The body: flung, it comes home and stops exactly, without wobbling back and forth for ever. */
  const b = { dx: 0, dy: 0, vx: 1500, vy: -600, held: false };
  let steps = 0, sign = 0, flips = 0, moving = true;
  while (moving && steps < 2000) { moving = L.stepBody(b, 1 / 60, L.MOTION, { x: 0, y: 0 }); const s = Math.sign(b.dx); if (s && sign && s !== sign) flips++; if (s) sign = s; steps++; }
  check("E: a flung orb settles home exactly, in a few swings, within its settle time and a bit", !moving && b.dx === 0 && b.dy === 0 && flips <= 4 && steps / 60 < 4, `${(steps / 60).toFixed(2)} s, ${flips} swings`);
  const heavy = { dx: 0, dy: 0, vx: 600, vy: 0, held: false }, light = { ...heavy };
  let far = [0, 0];
  for (let i = 0; i < 90; i++) { L.stepBody(heavy, 1 / 60, { ...L.MOTION, drag: 3 }, { x: 0, y: 0 }); L.stepBody(light, 1 / 60, { ...L.MOTION, drag: 0.2 }, { x: 0, y: 0 }); far = [Math.max(far[0], Math.abs(heavy.dx)), Math.max(far[1], Math.abs(light.dx))]; }
  check("E: resistance holds a throw back", far[0] < far[1] * 0.8, far.map((x) => x.toFixed(0)).join(" vs "));
  const wall = { dx: 0, dy: 0, vx: 9000, vy: 0, held: false };
  L.stepBody(wall, 0.1, { ...L.MOTION, bounce: 0.8 }, { x: 300, y: 0 });
  check("E: it bounces off the board's edge, never through it", 300 + wall.dx <= L.VIEW.x + L.VIEW.w - 24 + 1e-6 && wall.vx < 0, `${wall.dx.toFixed(1)} ${wall.vx.toFixed(0)}`);
  const slow = { dx: 50, dy: 0, vx: 0, vy: 0, held: false }, one = { ...slow };
  L.stepBody(slow, 0.1, L.MOTION, { x: 0, y: 0 }); for (let i = 0; i < 6; i++) L.stepBody(one, 1 / 60, L.MOTION, { x: 0, y: 0 });
  check("E: a slow frame moves it as six quick ones do (fixed steps, no jump)", close(slow.dx, one.dx, 0.5), `${slow.dx.toFixed(2)} vs ${one.dx.toFixed(2)}`);
  check("E: held, it stays where the hand is", (() => { const h = { dx: 40, dy: 0, vx: 0, vy: 0, held: true }; L.stepBody(h, 0.1, L.MOTION, { x: 0, y: 0 }); return h.dx === 40; })());
  check("D: the camera turns with the Tune drawer's tilt and axis", (() => { const a = L.ringPoint(200, 0, 0, 0); L.camera.yaw = 90; const b2 = L.ringPoint(200, 0, 0, 0); L.camera.yaw = 0; L.camera.pitch = 60; const c2 = L.ringPoint(200, Math.PI / 2, 0, 0); L.camera.pitch = L.PITCH; return Math.abs(a.x - b2.x) > 100 && c2.y > L.ringPoint(200, Math.PI / 2, 0, 0).y; })());
  check("5: private, chats are drawn by their badge and still match their questions", (() => { const v = L.veilFeed(feed, true, PV?.badgeOf ?? (() => "")); const x = v.coordinators[1].chats[6]; return x.name === "🔮 CB7" && L.chatsAbout(v, "Secret client b7")[0]?.id === x.id && L.veilFeed(feed, false, () => "").coordinators[1].chats[6].name === "Secret client b7"; })());
  check("5: an orb's mark is the badge's letters, never half an emoji", L.markOf("🔮 CB7") === "CB" && L.markOf("Export motion") === "EM");
} else check("C: the archive is read", false);

if (L?.pieOf) {
  const now = Date.now(), feed = L.readFeed(FEED);
  check("H: a live age, short: s, min, h, d", L.ageOf(now - 42e3, now) === "42 s" && L.ageOf(now - 7 * 60e3, now) === "7 min" && L.ageOf(now - 3 * 3600e3, now) === "3 h" && L.ageOf(now - 2 * 86400e3, now) === "2 d" && L.ageOf("", now) === "");
  check("H: chats by latest word, newest first", (() => { const o = L.byLatest(feed.coordinators[2].chats); return o.every((x, i) => i === 0 || Date.parse(o[i - 1].lastSeen) >= Date.parse(x.lastSeen)); })());
  const pie = L.pieOf(feed.questions, now);
  check("H: the pie: one equal slice per question this round, open ones red, the recent answer green", pie.length === 4 && pie.filter((x) => x.open).length === 3 && close(pie[1].to - pie[1].from, 0.25, 1e-9) && pie[0].from === 0 && pie.at(-1).to === 1);
  const many = Array.from({ length: 11 }, (_, i) => ({ ...feed.questions[1], id: `m${i}`, answer: "" }));
  check("H: past eight, eight slices and the last says how many more", L.pieOf(many, now).length === 8 && L.pieOf(many, now).at(-1).more === 3);
  check("H: a lone slice is a whole circle", /A9 9 0 1 1/.test(L.slicePath({ id: "x", open: true, from: 0, to: 1, more: 0 }, 9)) && /^M0 0L/.test(L.slicePath(pie[0], 9)));
  const ret = L.retiredOf(feed);
  check("M: retired coordinators: one marked retired, one all done; numbered oldest first, brightest the newest", ret.length === 2 && ret[0].c.id.endsWith("d") && ret[1].c.id.endsWith("a") && ret[0].n === 1 && ret[1].light > ret[0].light && !feed.coordinators[1].retired);
  check("M: their purple goes from dark to light", L.purpleOf(0)[0] < L.purpleOf(1)[0]);
  const ms = Array.from({ length: 3 }, (_, k) => L.moonAt(k, 3, 1, 24));
  check("O: moons orbit their orb, apart from each other, outside it", ms.every((m) => Math.hypot(m.x, m.y / 0.35) > 24) && ms.every((m, i) => ms.every((q, j) => i === j || Math.hypot(m.x - q.x, m.y - q.y) > 4)));
  check("O: a carried question says who asked and who has it now", L.carriedWords(feed.questions.find((d) => d.id === "q-merge"), "CC2") === "asked by lane-a3, now with CC2" && L.carriedWords(feed.questions.find((d) => d.id === "q-orbit"), "x") === "");
  check("P: a done chat with a question still open is a leftover", L.leftovers(feed).has(leftover.id) && L.leftovers(feed).size === 1);
  check("P: it drifts further the older it is, never past the edge; a burst lasts under a second", L.driftOut(1) < L.driftOut(24) && L.driftOut(1e6) <= 1 && L.NOVA_S < 1 && L.novaAt(1).alpha === 0 && L.novaAt(0).r === 1);
  const sg = L.ringSegments(200, 30, 10);
  check("K: a ring is 96 curved pieces, each through the circle's own midpoint", L.SEGMENTS === 96 && sg.length === 96 && sg.every((x) => /^M[-\d. ]+Q[-\d. ]+$/.test(x.d)));
  check("F: a question carries What, How, background, asked, askedBy and carried", (() => { const d = feed.questions.find((x) => x.id === "q-merge"); return !!(d.what && d.how && d.context && d.asked && d.askedBy === "lane-a3" && d.carried); })());
}
if (L?.settleAnswered) {
  const q = (about, answer) => ({ id: about + answer, about, question: "q", options: [{ key: "a" }], answer });
  const one = (qs) => L.readFeed({ coordinators: [{ id: "c", chats: [{ id: "x12345678", name: "Bridge integration", lane: "bridge-integration", state: "need" }] }], decisions: qs }).coordinators[0].chats[0].state;
  check("Q: a red chat whose questions are all answered is red no more", one([q("bridge-integration", "a")]) === "work" && one([q("bridge-integration", "a"), q("bridge-integration", "")]) === "need" && one([]) === "need" && one([q("other-lane", "a")]) === "need");
}
if (HL?.forBuilder) {
  /* A made key-shaped value, built here so no key-like text sits in the file. */
  const fakeKey = ["s", "k-", "ant-api03-", "q".repeat(26)].join("");
  const served = HL.blankKeys(HL.forBuilder({ coordinators: [{ id: "c", name: "C", note: "n", retired: true, chats: [{ id: "x", name: "n", state: "work", note: "a note", last: `a line ${fakeKey}`, model: "Opus", pid: 4, history: [{ at: 1, text: "kept", public: false }] }] }] }));
  const x = served.coordinators[0].chats[0];
  check("G: the helper serves each chat's note, latest line and whole timeline", x.note === "a note" && x.last.startsWith("a line") && x.history.length === 1 && x.history[0].text === "kept" && served.coordinators[0].retired === true);
  /* The Agents manager's model chip (J, 2026-11-10: "a way from both to be able to choose the model running") needs the model; it is drawn only with Private off. A pid still never leaves. */
  check("G: …never a pid, and never a key (its model goes, for the manager's chip)", x.model === "Opus" && !("pid" in x) && !x.last.includes(fakeKey) && x.last.includes("•••"));
}
if (T && BT) {
  const S = BT.BOARD_TUNE, keys = T.controlsOf(S).map((c) => c.key);
  check("D: the board's drawer has every value J named", ["tilt", "axis", "order", "orb", "ring", "texture", "key", "rim", "glow", "orbit", "spin", "gravity", "drag", "bounce", "settle", "leftover"].every((k) => keys.includes(k)) && S.groups.map((g) => g.label).join() === "Orientation,Order,Size,Texture,Lighting,Speeds,Motion", keys.join());
  check("D: three texture sets to choose from", BT.TEXTURE_SETS.length === 3 && T.controlsOf(S).find((c) => c.key === "texture").options.length === 3);
  const d = T.defaultsOf(S);
  check("D: values read back are clamped and snapped; unknown keys and bad choices dropped", (() => { const v = T.readValues(S, { orb: 99, tilt: "12.4", texture: "plaid", junk: 1 }); return v.orb === 1.6 && v.tilt === 12 && v.texture === "glass" && !("junk" in v) && Object.keys(v).length === keys.length; })());
  const json = T.exportValues(S, { ...d, orb: 1.3, texture: "marble" });
  check("D: the look exports as one small JSON of what differs", JSON.parse(json).tune === "agents-board" && Object.keys(JSON.parse(json).values).sort().join() === "orb,texture" && json.length < 120, json);
  check("D: …and imports back; another schema's look is refused", T.importValues(S, json).orb === 1.3 && T.importValues(S, json).texture === "marble" && T.importValues(S, '{"tune":"a-model","values":{}}') === null && T.importValues(S, "not json") === null);
  const model = { id: "a-model", label: "A model", groups: [{ id: "m", label: "Motion", controls: [{ key: "gravity", label: "Gravity", kind: "slider", min: 0, max: 2, step: 0.1, value: 1 }] }] };
  check("D: the same drawer takes any schema (a model's own values)", T.defaultsOf(model).gravity === 1 && T.storageKey(model) === "polio.tune.a-model" && T.readValues(model, { gravity: 5 }).gravity === 2);
}
if (ART) {
  const g = ART.stripPixels("glass"), p = ART.stripPixels("planet"), m = ART.stripPixels("marble");
  const sum = (a) => a.reduce((n, v, i) => (i % 4 === 3 ? n + v : n), 0);
  check("E: glass has no pattern; planet and marble are strips that differ", g === null && p.length === ART.STRIP_W * ART.STRIP_H * 4 && m.length === p.length && sum(p) > 0 && sum(m) > 0 && Buffer.compare(Buffer.from(p), Buffer.from(m)) !== 0);
  const wraps = (a) => { let d = 0; for (let y = 0; y < ART.STRIP_H; y++) d += Math.abs(a[(y * ART.STRIP_W) * 4 + 3] - a[(y * ART.STRIP_W + ART.STRIP_W / 2) * 4 + 3]); return d / ART.STRIP_H; };
  check("E: each strip repeats at half its width, so it turns without a seam", wraps(p) < 2 && wraps(m) < 2, `${wraps(p).toFixed(1)} ${wraps(m).toFixed(1)}`);
}
if (PV) {
  const line = "npx next dev --webpack -p 3091 in C:\\Users\\Josh\\Downloads\\Pleo\\work-orbs-2, pid 4243, local_3d6def76-75a2, Opus 5.5 medium, claude/orbs-2, port 3600";
  const out = PV.scrub(true, line);
  check("5: private, a line loses its command, path, pid, session id, model, branch and port", !/3091|Josh|4243|3d6def76|Opus|orbs-2|3600/.test(out) && out.includes("hidden"), out);
  check("5: …and off, it is as written", PV.scrub(false, line) === line && PV.veil(false, 4243) === "4243" && PV.veil(true, 4243) === "hidden");
  check("5: the switch is on unless this browser turned it off", PV.readPrivate(null) === true && PV.readPrivate("on") === true && PV.readPrivate("off") === false);
  const here = readFileSync(new URL("../src/features/agents/privacy.ts", import.meta.url), "utf8"), there = existsSync(new URL("../helper/dock/privacy.ts", import.meta.url)) ? readFileSync(new URL("../helper/dock/privacy.ts", import.meta.url), "utf8") : "";
  check("5: the helper's dock hides the same things (its copy is the same file)", here === there);
}
if (HL?.namesOnly) {
  const s = HL.namesOnly({ coordinators: [{ id: "c", chats: [{ id: "x", name: "n", code: "ORBS", emoji: "🔮", state: "work", note: "secret" }] }] });
  check("5: the helper serves each chat's badge", s.coordinators[0].chats[0].code === "ORBS" && s.coordinators[0].chats[0].emoji === "🔮");
}

/* ------------------------------------------------------------ 2. in the Builder */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launch = () => chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
let browser = await launch();
const errors = [];
/** The stand-in helper: paired, answering unpaired, refusing this Builder (answering), or off. */
const helper = { mode: "paired", healthAsks: 0, starts: 0, reads: 0 };
async function standIn(ctx, origin) {
  await ctx.route(`${HELPER}/**`, (r) => {
    const u = new URL(r.request().url());
    if (u.protocol === "polio-helper:") helper.starts++;
    if (helper.mode === "off") return r.abort("connectionrefused");
    const cors = { "access-control-allow-origin": origin, vary: "Origin" };
    if (u.pathname === "/health") {
      helper.healthAsks++;
      if (helper.mode === "refuse") return r.fulfill({ status: 403, contentType: "application/json", body: '{"error":"this origin may not use the helper"}' });
      return r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ helper: true, paired: helper.mode === "paired" }) });
    }
    if (r.request().method() === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" }, body: "" });
    if (u.pathname === "/lanes/answer" && r.request().method() === "POST") {
      const b = JSON.parse(r.request().postData() ?? "{}"), d = FEED.decisions.find((x) => x.id === b.id);
      if (d) { d.answer = b.answer; d.answeredAt = new Date().toISOString(); }
      return r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ ok: true, answeredAt: d?.answeredAt }) });
    }
    if (u.pathname === "/lanes") helper.reads++;
    if (u.pathname === "/lanes") return r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ feed: FEED, beats: [], now: Date.now() }) });
    return r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!doctype html><title>dock stub</title><body>dock" });
  });
  await ctx.route("**/api/lanes", (r) => (helper.reads++, r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: FEED, beats: [], now: Date.now() }) })));
}
/*
 * PACE (2026-11-11): what a moving board costs, counted over `ms`: draws per animation frame (a rAF counter of the
 * test's own), DOM changes per draw per element of the board (a MutationObserver), and layouts and style passes per
 * draw (the browser's own LayoutCount and RecalcStyleCount over CDP). Draws a second ride along only as words.
 */
async function paceOf(page, ms) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Performance.enable");
  /* PACE_CPU=4 or 6: the speed checks run as on a machine that many times slower (they must still pass). */
  const slow = Number(process.env.PACE_CPU ?? 1);
  if (slow > 1) { await cdp.send("Emulation.setCPUThrottlingRate", { rate: slow }); await page.waitForTimeout(1500); }
  const counts = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.filter((m) => /^(LayoutCount|RecalcStyleCount)$/.test(m.name)).map((m) => [m.name, m.value]));
  await page.evaluate(() => {
    const p = (window.__pace = { frames: 0, changes: 0, on: true });
    p.mo = new MutationObserver((rs) => { for (const r of rs) p.changes += r.type === "childList" ? r.addedNodes.length + r.removedNodes.length : 1; });
    p.mo.observe(document.querySelector("[data-lanes-board]") ?? document.body, { subtree: true, attributes: true, childList: true, characterData: true });
    const f = () => { if (!p.on) return; p.frames++; requestAnimationFrame(f); };
    requestAnimationFrame(f);
  });
  const read = () => page.evaluate(() => ({ draws: window.__lanesBoard?.draws ?? 0, frames: window.__pace.frames, changes: window.__pace.changes, nodes: document.querySelector("[data-lanes-board]")?.getElementsByTagName("*").length ?? 0 }));
  const a = await read(), ca = await counts();
  await page.waitForTimeout(ms);
  const b = await read(), cb = await counts();
  await page.evaluate(() => { window.__pace.on = false; window.__pace.mo.disconnect(); });
  if (slow > 1 && !(Number(process.env.PACE_CPU_ALL ?? 1) > 1)) await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await cdp.detach().catch(() => {});
  const draws = Math.max(1, b.draws - a.draws);
  return { draws: b.draws - a.draws, frames: b.frames - a.frames, perSecond: (b.draws - a.draws) / (ms / 1000), perFrame: (b.draws - a.draws) / Math.max(1, b.frames - a.frames),
    changesPerNode: (b.changes - a.changes) / draws / Math.max(1, b.nodes), layouts: (cb.LayoutCount - ca.LayoutCount) / draws, styles: (cb.RecalcStyleCount - ca.RecalcStyleCount) / draws };
}
const paceWords = (p) => `${p.perFrame.toFixed(2)} draws a frame, ${p.changesPerNode.toFixed(2)} changes an element, ${p.layouts.toFixed(2)} layouts and ${p.styles.toFixed(2)} style passes a draw (${p.perSecond.toFixed(0)} draws a second here)`;
/*
 * To show the speed checks still catch a real regression (PACE): PACE_SLOWDOWN=dom touches every element of the
 * board once more after each draw (twice the work per frame); =thrash reads a layout after a style write in each
 * draw. PACE_CPU=4 (or 6) throttles the CPU for the speed checks the way a slow machine is slow. All off unless set.
 */
async function slowDown(ctx) {
  const kind = process.env.PACE_SLOWDOWN;
  if (!kind) return;
  await ctx.addInitScript((kind) => {
    let m;
    Object.defineProperty(window, "__lanesBoard", { configurable: true, get: () => m, set: (v) => {
      let d = v.draws; m = v;
      Object.defineProperty(v, "draws", { get: () => d, set: (n) => {
        d = n;
        const board = document.querySelector("[data-lanes-board]");
        if (!board) return;
        if (kind === "thrash") for (const e of [...board.querySelectorAll("[data-lanes-orb]")].slice(0, 8)) { e.style.outlineOffset = `${n % 2}px`; e.getBoundingClientRect(); }
        else requestAnimationFrame(() => { for (const e of board.getElementsByTagName("*")) e.setAttribute("data-pace", String(n)); });
      } });
    } });
  }, kind);
}
/* PACE_CPU_ALL=4: the whole made page that slow, to find other checks that lean on wall-clock time (see the PACE handover). */
async function throttle(page) {
  const rate = Number(process.env.PACE_CPU_ALL ?? 1);
  if (rate > 1) await (await page.context().newCDPSession(page)).send("Emulation.setCPUThrottlingRate", { rate });
}
/*
 * A burst "under a second" is under a second of the board's own clock. A frame moves that clock at most 0.1 s, so on
 * a machine drawing under 10 frames a second it runs slower than the wall: judge it by wall clock or by frames drawn
 * (NOVA_S of frames at 60 a second, with room), whichever passes (PACE, 2026-11-11).
 */
const quick = (wallMs, draws) => wallMs < 1500 || (draws > 0 && draws <= Math.ceil((L?.NOVA_S ?? 0.8) * 60 * 1.25) + 3);
const waitFor = async (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
/** The board's parts once they stop settling (a saved board's text can move a few pixels as fonts arrive, dock or no dock). */
const settled = async (page) => { let a = ""; for (let i = 0; i < 30; i++) { const b = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? [])); if (b === a) return b; a = b; await page.waitForTimeout(1500); } return a; };
const mark = (page) => page.evaluate(() => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") ?? null);

try {
  const origin = new URL(BASE).origin;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await standIn(ctx, origin);
  /* Piece G's limit: nothing read from the helper goes out in a request (to anywhere but the helper and the lanes route) or into the site. */
  const outgoing = [];
  ctx.on("request", (r) => { const u = r.url(); if (!u.startsWith(HELPER) && !u.includes("/api/lanes")) outgoing.push(`${r.method()} ${u} ${r.postData() ?? ""}`); });
  await slowDown(ctx);
  const page = await ctx.newPage();
  await throttle(page);
  page.on("pageerror", (e) => errors.push(`made page: ${e.message}`));
  page.setDefaultTimeout(60_000);
  await openBoard(page, BASE, "solface");
  const before = await settled(page);
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-board]", { timeout: 20000 }).catch(() => {});

  /* A. */
  check("A: the Agents button carries the helper's mark: paired", await waitFor(page, () => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") === "paired", null, 8000), String(await mark(page)));
  check("A: the dock's top line says it in words", /paired and answering/.test((await page.locator("[data-agents-helper]").textContent().catch(() => "")) ?? ""), await page.locator("[data-agents-helper]").textContent().catch(() => "none"));
  const t0 = Date.now();
  helper.mode = "off";
  const offSeen = await waitFor(page, () => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") === "off", null, 9000);
  const took = (Date.now() - t0) / 1000;
  check("A: the helper stops: the mark turns to not answering within a few seconds, no reload", offSeen && took < 7, `${took.toFixed(1)} s`);
  check("A: …and the line says when it was last heard from", /off, or the PC is asleep/.test(await page.locator("[data-agents-helper]").textContent()) && /last heard from \d+ s ago/.test(await page.locator("[data-agents-helper-heard]").textContent()), await page.locator("[data-agents-helper]").textContent());
  helper.mode = "unpaired";
  check("A: back, but not paired: answering, not paired", await waitFor(page, () => document.querySelector("[data-agents-helper]")?.textContent?.includes("not paired"), null, 8000));
  helper.mode = "refuse";
  check("A: answering a Builder it refuses still counts as answering", await waitFor(page, () => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") === "answering" && !document.querySelector("[data-agents-helper]")?.textContent?.includes("not paired"), null, 8000));
  helper.mode = "paired";
  await waitFor(page, () => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") === "paired", null, 8000);
  check("A: the polio-helper:// link was never followed", helper.starts === 0);
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));

  /* H: the pie. */
  const pie = await page.evaluate(() => [...document.querySelectorAll("[data-agents-slice]")].map((e) => `${e.getAttribute("data-agents-slice")}:${e.getAttribute("data-open")}`));
  check("H: the Agents button's mark is a pie: one slice per question this round, red open, green answered", pie.length === 4 && pie.filter((x) => x.endsWith(":1")).length === OPEN.length && pie.includes("q-done:0"), pie.join());
  check("B: …and it counts the questions waiting on J", (await page.locator("[data-agents-waiting]").getAttribute("data-agents-waiting").catch(() => null)) === String(OPEN.length));

  /* O: moons; B: the count mark. */
  const moons = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-moon]")].map((e) => `${e.getAttribute("data-of")}:${e.getAttribute("data-lanes-moon")}`));
  check("O: each open question is a bright moon round the orb that asked", moons.length === OPEN.length && moons.includes(`${asker.id}:q-orbit`) && moons.includes(`${asker2.id}:q-merge`) && moons.includes(`${leftover.id}:q-left`), moons.join());
  const asks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-lanes-asks]")].map((e) => [e.getAttribute("data-lanes-orb"), e.getAttribute("data-lanes-asks")])));
  check("B: the asking orbs keep the count mark", asks[asker.id] === "1" && asks[asker2.id] === "1", JSON.stringify(asks));

  /* F: folded to one line; a press on the orb opens it whole. */
  check("F: each question is one line until opened", (await page.locator("[data-decision-head]").count()) === OPEN.length && (await page.locator("button[data-decision-press]").count()) === 0);
  await page.locator(`[data-lanes-hit="${asker2.id}"]`).dispatchEvent("pointerdown", { button: 0, clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 0, clientY: 0, pointerId: 1 })));
  check("B: a press on the asking orb opens its question, lit", await waitFor(page, () => document.querySelector('[data-decision="q-merge"][data-decision-lit]') !== null, null, 4000));
  check("B: …with its options as buttons, the first one ready to press", (await page.locator('[data-decision="q-merge"] button[data-decision-press]').count()) === 2 && (await page.evaluate(() => document.activeElement?.closest('[data-decision="q-merge"]') !== null)));
  const whole = (await page.locator('[data-decision="q-merge"]').innerText()).replace(/\s+/g, " ");
  check("F: opened, it is whole: What, Why, How, what each option gives, the pick, who asked and when", whole.includes(QM.what) && whole.includes(QM.why) && whole.includes(QM.how) && whole.includes(QM.options[0].desc) && /pick/.test(whole) && /asked by/.test(whole) && /ago/.test(whole), whole.slice(0, 240));
  check("O: a carried question says who asked and who has it now, with the real asked time", /asked by lane-a3, now with/.test(whole) && /moved \d+ (s|min|h|d) ago/.test(whole) && /2 d ago/.test(whole), whole.slice(0, 240));
  check("F: the background sits under a fold", (await page.locator('[data-decision="q-merge"] [data-decision-context]').count()) === 1 && !(await page.locator('[data-decision="q-merge"] [data-decision-context]').evaluate((d) => d.open)));
  /* A moon's press opens its own question. */
  const mb = await page.locator('[data-lanes-moon-hit="q-orbit"]').boundingBox();
  await page.locator('[data-lanes-moon-hit="q-orbit"]').dispatchEvent("click");
  check("O: a press on a moon opens that question", await waitFor(page, () => document.querySelector('[data-decision="q-orbit"][data-decision-lit]') !== null && document.querySelectorAll('[data-decision="q-orbit"] button[data-decision-press]').length === 2, null, 4000), JSON.stringify(mb));
  /* H: a slice opens its question too, with the dock shut. */
  await page.locator("[data-agents-close]").click();
  await page.waitForTimeout(300);
  check("B: with the dock shut, the pie and the mark stay on the button", (await page.locator("[data-agents-waiting]").getAttribute("data-agents-waiting").catch(() => null)) === String(OPEN.length) && (await mark(page)) === "paired");
  const asked = helper.healthAsks;
  helper.mode = "off";
  check("A: …and the dock shut, the mark still follows the helper", await waitFor(page, () => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") === "off", null, 9000) && helper.healthAsks >= asked);
  helper.mode = "paired";
  await page.locator('[data-agents-slice="q-left"]').click();
  check("H: a press on a slice opens the dock on that question", await waitFor(page, () => document.querySelector('[data-decision="q-left"][data-decision-lit]') !== null, null, 8000));
  await page.waitForTimeout(800);
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));

  /* I: nothing shown twice. */
  const dockText = await page.locator("[data-agents-dock]").innerText();
  const times = (s, w) => s.split(w).length - 1;
  check("I: a question's words are shown once, in the questions; elsewhere a count and a jump", OPEN.every((d) => times(dockText, d.question) === 1) && (await page.locator("[data-lanes-note-asks]").count()) >= 2 && !(await page.locator("[data-lanes-decisions]").count()), OPEN.map((d) => times(dockText, d.question)).join());

  /* L, M, K: the sun, the nucleus, smooth rings. */
  check("L: a sun at the centre", (await page.locator("[data-lanes-sun]").count()) === 1);
  const nucleus = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-retired]")].map((e) => ({ id: e.getAttribute("data-lanes-retired"), n: +e.getAttribute("data-n"), light: +e.getAttribute("data-light") })));
  const retiredA = FEED.coordinators[0].id, retiredD = FEED.coordinators[3].id;
  check("M: the archive is one numbered purple orb per retired coordinator, brightest the newest", nucleus.length === 2 && nucleus.find((x) => x.id === retiredD)?.n === 1 && nucleus.find((x) => x.id === retiredA)?.n === 2 && nucleus.find((x) => x.id === retiredA).light > nucleus.find((x) => x.id === retiredD).light, JSON.stringify(nucleus));
  const rings = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-ring]")].map((e) => e.getAttribute("data-lanes-ring")));
  check("M: retired coordinators have no ring; their chats are inside, not drawn", rings.length === 2 && !rings.includes(retiredA) && (await page.locator(`[data-lanes-orb="${FEED.coordinators[0].chats[0].id}"],[data-lanes-bead="${FEED.coordinators[0].chats[0].id}"]`).count()) === 0, rings.join());
  const orbs = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-orb][data-kind=orb]")].map((e) => e.getAttribute("data-lanes-orb")));
  check("C: only working, waiting and parked chats are orbs; a live ring's finished chats are small beads", orbs.length === LIVE.length && LIVE.every((x) => orbs.includes(x.id)) && (await page.locator("[data-lanes-bead]").count()) === BEADS.length, `${orbs.length} orbs, ${await page.locator("[data-lanes-bead]").count()} beads`);
  const segs = await page.evaluate(() => [...document.querySelectorAll("[data-ring-seg] path")].filter((p) => p.getAttribute("stroke") !== "transparent").map((p) => `${p.getAttribute("d")?.includes("Q") ? "Q" : "L"}${p.getAttribute("stroke-linecap")}`));
  check("K: rings are smooth: curved pieces with flat ends that meet, 96 to a ring, no round caps to overlap", segs.length > 0 && segs.every((s) => s === "Qbutt") && (await page.locator("[data-ring-seg]").count()) === 96 * 2, `${segs.length} ${[...new Set(segs)].join()}`);
  await page.locator(`[data-lanes-hit="retired:${retiredA}"]`).dispatchEvent("click");
  await page.waitForTimeout(1200);
  const back = await page.evaluate((id) => ({ ring: document.querySelector(`[data-lanes-ring="${id}"]`)?.getAttribute("data-purple"), orbs: document.querySelectorAll("[data-lanes-orb]").length }), retiredA);
  check("M: a press on one brings it back as a purple ring with its chats on it", back.ring === "1" && back.orbs >= LIVE.length + FEED.coordinators[0].chats.length, JSON.stringify(back));
  check("N: …and the panel says so, with a way to put it away", /retired coordinator #2/.test(await page.locator("[data-lanes-menu]").innerText()) && (await page.locator(`[data-lanes-revive="${retiredA}"]`).count()) === 1);
  await page.locator(`[data-lanes-revive="${retiredA}"]`).click();
  await page.waitForTimeout(600);
  check("M: put away, its ring goes", (await page.locator(`[data-lanes-ring="${retiredA}"]`).count()) === 0);
  await page.locator("[data-lanes-archive-toggle]").click();
  await page.waitForTimeout(300);
  check("M: the nucleus is a toggle, off", (await page.locator("[data-lanes-retired]").count()) === 0 && (await page.locator("[data-lanes-archive-toggle]").getAttribute("data-lanes-archive-toggle")) === "off");
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  check("M: …remembered", (await page.locator("[data-lanes-retired]").count()) === 0);
  await page.locator("[data-lanes-archive-toggle]").click();
  await page.waitForTimeout(300);
  check("M: …and on again", (await page.locator("[data-lanes-retired]").count()) === 2);
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(400);

  /* C: search reaches every finished chat. */
  await page.locator("[data-lanes-archive-list] summary").click();
  const oldest = FEED.coordinators[0].chats.at(-1);
  await page.locator("[data-lanes-archive-search]").fill(oldest.code.toLowerCase());
  await page.waitForTimeout(300);
  const hits = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-archive-item]")].map((e) => e.getAttribute("data-lanes-archive-item")));
  check("C: search reaches a finished chat inside a retired coordinator", hits.length === 1 && hits[0] === oldest.id, JSON.stringify(hits));

  /* N: hover snaps the panel, the hover ending puts it back, a press pins. */
  const hb = await page.locator(`[data-lanes-hit="${asker.id}"]`).boundingBox();
  const panelName = () => page.locator("[data-lanes-menu-name]").textContent();
  const pinned = await panelName();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.waitForTimeout(250);
  const onHover = await panelName();
  await page.mouse.move(5, 500);
  await page.waitForTimeout(300);
  const afterHover = await panelName();
  const badge = `${asker.emoji} ${asker.code}`;
  check("N: hovering an orb snaps the panel to that chat; the hover ending puts it back", onHover === badge && afterHover === pinned && pinned !== badge, `${pinned} / ${onHover} / ${afterHover}`);
  await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.move(5, 500);
  await page.waitForTimeout(300);
  check("N: a press pins it", (await panelName()) === badge);
  check("J: the panel sits above the board, not on the orbs", await page.evaluate(() => { const p = document.querySelector("[data-lanes-menu]").getBoundingClientRect(), s = document.querySelector("svg[data-camera]").getBoundingClientRect(); return p.bottom <= s.top + 1; }));

  /* G: more is shown, nothing of it leaves. */
  const panel = await page.locator("[data-lanes-menu]").innerText();
  check("G: the panel shows the chat's note and latest line", panel.includes("HELPERTEXT-7f3") && panel.includes("Latest:"), panel.slice(0, 200));
  check("G: …with paths and pids hidden while Private", !/Users|work-secret|4242/.test(panel) && panel.includes("hidden"), panel.replace(/\s+/g, " ").slice(0, 220));
  await page.locator("[data-lanes-panel-fold]").click();
  check("J: the panel folds to one line", (await page.locator("[data-lanes-menu]").getAttribute("data-folded")) === "1" && (await page.locator("[data-lanes-menu]").boundingBox()).height < 48);
  await page.locator("[data-lanes-panel-fold]").click();
  check("J: …and opens again, and can be dragged taller", (await page.locator("[data-lanes-menu]").evaluate((e) => getComputedStyle(e).resize)) === "vertical");

  /* H: chats by latest word with a live age. */
  const notes = await page.evaluate((id) => [...document.querySelectorAll(`[data-lanes-notes-coord="${id}"] [data-lanes-note]`)].map((e) => ({ id: e.getAttribute("data-lanes-note"), age: e.querySelector("[data-lanes-seen]")?.textContent })), FEED.coordinators[2].id);
  const wantOrder = [...FEED.coordinators[2].chats].sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen)).map((x) => x.id);
  check("H: chats are ordered by latest word, newest first, each with an age", notes.map((n) => n.id).join() === wantOrder.join() && notes.every((n) => /^\d+ (s|min|h|d)$/.test(n.age ?? "")), notes.slice(0, 3).map((n) => n.age).join());

  /* J: drag the empty board to turn it. */
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));
  const cam0 = await page.locator("svg[data-camera]").getAttribute("data-camera");
  const sb = await page.locator("svg[data-camera]").boundingBox();
  await page.mouse.move(sb.x + 12, sb.y + sb.height - 12);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(sb.x + 12 + 15 * i, sb.y + sb.height - 12 - 4 * i); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(300);
  const cam1 = await page.locator("svg[data-camera]").getAttribute("data-camera");
  const tuned = await page.evaluate(() => JSON.parse(localStorage.getItem("polio.tune.agents-board") ?? "{}"));
  check("J: a drag on the empty board turns it, and Tune keeps the turn", cam0 !== cam1 && tuned.axis === Number(cam1.split(",")[1]), `${cam0} → ${cam1} ${JSON.stringify(tuned)}`);
  await page.evaluate(() => localStorage.removeItem("polio.tune.agents-board"));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));

  /* 5, on the board. */
  const boardText = await page.locator("[data-agents-dock]").innerText();
  check("5: Private is on by default, and no chat's name is on screen, only badges", (await page.locator("[data-agents-private]").getAttribute("data-agents-private")) === "on" && !/Secret client/.test(boardText) && /🔮 CB7/.test(boardText));
  await page.locator("[data-agents-private]").click();
  await page.waitForTimeout(500);
  check("5: Private off, the names are back", /Secret client/.test(await page.locator("[data-agents-dock]").innerText()));
  await page.locator("[data-agents-private]").click();
  await page.waitForTimeout(300);

  /* P: a chat retired with a question left is a small sun; answered, it bursts (nova) or fades (drift), in under a second. */
  check("P: a chat that retired with a question left is a small sun, not a bead", (await page.locator(`[data-lanes-orb="${leftover.id}"][data-kind=sun]`).count()) === 1 && (await page.locator(`[data-lanes-bead="${leftover.id}"]`).count()) === 0);
  const sunAt = async () => page.evaluate((id) => { const e = document.querySelector(`[data-lanes-orb="${id}"]`); return e ? Math.hypot(+e.dataset.x, +e.dataset.y) : 0; }, leftover.id);
  const driftFar = await sunAt();
  await page.evaluate(() => localStorage.setItem("polio.tune.agents-board", JSON.stringify({ leftover: "nova" })));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const novaNear = await sunAt();
  check("P: drifting, it sits further out than the nova look keeps it", driftFar > novaNear + 20, `${driftFar.toFixed(0)} vs ${novaNear.toFixed(0)}`);
  if ((await page.locator('[data-decision-head="q-left"]').getAttribute("aria-expanded")) !== "true") await page.locator('[data-decision-head="q-left"]').click();
  await page.locator('[data-decision="q-left"] button[data-decision-press="a"]').click();
  const burst = await waitFor(page, (id) => document.querySelector(`[data-lanes-nova="${id}"][data-mode=nova]`) !== null, leftover.id, 8000);
  const tBurst = Date.now(), dBurst = await page.evaluate(() => window.__lanesBoard?.draws ?? 0);
  const gone = await waitFor(page, (id) => !document.querySelector(`[data-lanes-nova="${id}"]`), leftover.id, 3000);
  check("P: answered, the small sun ends in a quick supernova (under a second)", burst && gone && quick(Date.now() - tBurst, (await page.evaluate(() => window.__lanesBoard?.draws ?? 0)) - dBurst) && (await page.locator(`[data-lanes-orb="${leftover.id}"]`).count()) === 0);
  check("P: …and becomes a plain finished bead", (await page.locator(`[data-lanes-bead="${leftover.id}"]`).count()) === 1);
  FEED.decisions.find((d) => d.id === "q-left").answer = "";

  /* Q: answering the red chat's question turns its orb from red within a few seconds, and the count drops. */
  await page.locator(`[data-lanes-hit="${asker.id}"]`).dispatchEvent("pointerdown", { button: 0, clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 0, clientY: 0, pointerId: 1 })));
  await waitFor(page, () => document.querySelectorAll('[data-decision="q-orbit"] button[data-decision-press]').length === 2, null, 4000);
  const redBefore = await page.locator(`[data-lanes-orb="${asker.id}"]`).getAttribute("data-state");
  const tq = Date.now(), rq = helper.reads;
  await page.locator('[data-decision="q-orbit"] button[data-decision-press="b"]').click();
  const turned = await waitFor(page, (id) => document.querySelector(`[data-lanes-orb="${id}"]`)?.getAttribute("data-state") === "work", asker.id, 8000);
  check("Q: an answered question's orb stops being red within a few seconds (or the next feed reads, on a slow machine)", redBefore === "need" && turned && (Date.now() - tq < 6000 || helper.reads - rq <= 3), `${redBefore} → ${await page.locator(`[data-lanes-orb="${asker.id}"]`).getAttribute("data-state")} in ${((Date.now() - tq) / 1000).toFixed(1)} s`);
  check("Q: …and the count drops with it", (await page.locator("[data-agents-waiting]").getAttribute("data-agents-waiting")) === String(OPEN.length - 1) && /2 decisions wait/.test(await page.locator("[data-decisions-count]").textContent()));
  FEED.decisions.find((d) => d.id === "q-orbit").answer = "";
  await page.evaluate(() => localStorage.removeItem("polio.tune.agents-board"));

  /* D. */
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  await page.locator("[data-lanes-tune-open]").click();
  await page.waitForSelector("[data-tune]", { timeout: 4000 }).catch(() => {});
  const groups = await page.evaluate(() => [...document.querySelectorAll("[data-tune-group]")].map((e) => e.getAttribute("data-tune-group")));
  check("D: Tune opens one drawer, grouped as J asked", groups.join() === "orientation,order,size,texture,lighting,speeds,motion", groups.join());
  check("D: …sliders for every number, a choice for order, texture and the leftover look", (await page.locator('[data-tune] input[type=range]').count()) === 13 && (await page.locator("[data-tune] select").count()) === 3);
  const scaleOf = () => page.evaluate(() => { const o = document.querySelector("[data-lanes-orb][data-kind=orb]"); return o ? +o.querySelector("circle:nth-of-type(2)").getAttribute("r") : 0; });
  const r1 = await scaleOf();
  await page.locator('[data-tune-key="orb"]').fill("1.5");
  await page.waitForTimeout(400);
  const r2 = await scaleOf();
  check("D: a slider changes the board live (orb size)", close(r2 / r1, 1.5, 0.02), `${r1} → ${r2}`);
  await page.locator('[data-tune-key="texture"]').selectOption("planet");
  await page.waitForTimeout(400);
  check("D/E: a texture set wraps the orbs, and gives the rings their look", (await page.locator('[data-lanes-texture="planet"]').count()) >= LIVE.length && (await page.locator('[data-lanes-ring][data-style="planet"]').count()) === 2);
  await page.locator('[data-tune-key="texture"]').selectOption("marble");
  await page.waitForTimeout(300);
  check("E: the marble set too", (await page.locator('[data-lanes-texture="marble"]').count()) >= LIVE.length);
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("polio.tune.agents-board") ?? "{}"));
  check("D: values are kept for this browser", stored.orb === 1.5 && stored.texture === "marble");
  await page.locator("[data-tune-reset]").click();
  await page.waitForTimeout(300);
  check("D: Reset puts every value back", close(await scaleOf(), r1, 0.01) && (await page.locator("[data-lanes-texture]").count()) === 0);
  await page.locator("[data-tune-import-open]").click();
  await page.locator("[data-tune-json]").fill('{"tune":"agents-board","v":1,"values":{"orb":1.2,"texture":"planet"}}');
  await page.locator("[data-tune-import]").click();
  await page.waitForTimeout(400);
  check("D: a pasted look sets the board", close((await scaleOf()) / r1, 1.2, 0.02) && (await page.locator('[data-lanes-texture="planet"]').count()) > 0);
  /* Settled, as `before` was: the page was reloaded for the nova look, and on a slow machine its text is still arriving. */
  const mid = await settled(page);
  const diffOf = (x, y) => { const A = JSON.parse(x), B = JSON.parse(y); if (A.length !== B.length) return `${A.length} parts, then ${B.length}`; const i = A.findIndex((n, k) => JSON.stringify(n) !== JSON.stringify(B[k])); if (i < 0) return ""; return `${A[i].id}: ${Object.keys({ ...A[i], ...B[i] }).filter((k) => JSON.stringify(A[i][k]) !== JSON.stringify(B[i][k])).map((k) => `${k} ${JSON.stringify(A[i][k])} → ${JSON.stringify(B[i][k])}`).join()}`; };
  check("the board under the dock didn't move by a pixel (helper states, questions, nucleus, panel, turning, Tune)", before === mid && before.length > 10, diffOf(before, mid));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  check("D: …and a reload keeps it", (await page.locator('[data-lanes-texture="planet"]').count()) > 0);
  await page.evaluate(() => localStorage.removeItem("polio.tune.agents-board"));
  await page.locator("[data-agents-close]").click();
  const before2 = await settled(page);
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});

  /* E. */
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(500);
  const target = LIVE.find((x) => x.state === "park") ?? LIVE[0];
  const orb = page.locator(`[data-lanes-orb="${target.id}"]`);
  const box = await page.locator(`[data-lanes-hit="${target.id}"]`).boundingBox();
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(cx - 18 * i, cy - 10 * i); await page.waitForTimeout(16); }
    const held = await orb.getAttribute("data-held");
    /* How far the hand took it, read before the release: on a slow machine the spring has it half home by the first sample. */
    const heldOff = await orb.evaluate((e) => Math.hypot(+e.dataset.x - +e.dataset.homeX, +e.dataset.y - +e.dataset.homeY));
    await page.mouse.up();
    const flung = await orb.getAttribute("data-held");
    const samples = [];
    for (let i = 0; i < 40; i++) { samples.push(await orb.evaluate((e) => ({ d: Math.hypot(+e.dataset.x - +e.dataset.homeX, +e.dataset.y - +e.dataset.homeY), held: e.dataset.held ?? "" }))); await page.waitForTimeout(100); }
    const last = samples.at(-1);
    check("E: a drag holds the orb off its place, a release flings it", held === "held" && flung === "flung" && heldOff > 30 && samples[0].d > 0, `${held} ${flung} ${heldOff.toFixed(0)} ${samples[0].d.toFixed(0)}`);
    check("E: it settles home exactly, by itself", last.d === 0 && last.held === "", JSON.stringify(last));
    /* Home is when its body is gone (data-held cleared): a swing can pass through zero on its way. */
    const settledAt = samples.findIndex((s) => s.d === 0 && s.held === "");
    check("E: and stays there: no jitter once home", settledAt > 0 && samples.slice(settledAt).every((s) => s.d === 0));
  } else check("E: the orb is on screen to drag", false);

  /*
   * Speed, judged by counting, never by draws a second (PACE, 2026-11-11): the merge chat's slow machine drew
   * fewer than 50 a second and the old check held Merges 74 and 75. What the board promises is one draw per frame
   * the browser offers, about one change per element per draw, one layout and no thrash; those counts are the same
   * on any machine and at 4x or 6x CPU throttling, and twice the work per frame (or a layout read in a draw) breaks them.
   */
  const pace = await paceOf(page, 2000);
  check(`E: ${ALL.length} chats draw once for each frame the browser offers, no frame skipped or drawn twice`, pace.frames >= 4 && pace.perFrame >= 0.85 && pace.perFrame <= 1.15, paceWords(pace));
  check("E: …about one change per element per draw (no twice-over work)", pace.changesPerNode > 0.2 && pace.changesPerNode <= 1.15, paceWords(pace));
  check("E: …one layout and at most three style passes per draw (no layout thrash)", pace.layouts <= 1.2 && pace.styles <= 3, paceWords(pace));
  const fps = async () => { const a = await page.evaluate(() => window.__lanesBoard?.draws ?? 0); await page.waitForTimeout(2000); return ((await page.evaluate(() => window.__lanesBoard?.draws ?? 0)) - a) / 2; };
  /* With orbit and spin at 0 and nothing thrown, nothing moves, so nothing is drawn. */
  await page.locator("[data-lanes-tune-open]").click();
  await page.locator('[data-tune-key="orbit"]').fill("0");
  await page.locator('[data-tune-key="spin"]').fill("0");
  const stilled = await waitFor(page, () => window.__lanesBoard && !window.__lanesBoard.moving, null, 30000);
  await page.waitForTimeout(300);
  const idleRate = await fps();
  check("E: a board where nothing moves isn't drawn", stilled && idleRate < 2, `${idleRate} draws a second`);
  await page.evaluate(() => localStorage.removeItem("polio.tune.agents-board"));
  const after = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
  check("…nor while orbs are dragged and the board tuned", before2 === after && before2.length > 10, diffOf(before2, after));

  /* G: nothing read from the helper left the browser or went into the site. */
  const saved = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k.startsWith("builder.")) out.push(localStorage.getItem(k)); }
    const ask = (req) => new Promise((done, no) => { req.onsuccess = () => done(req.result); req.onerror = () => no(req.error); });
    for (const { name, version } of await indexedDB.databases()) {
      if (!name?.startsWith("builder.")) continue;
      const db = await ask(indexedDB.open(name, version));
      for (const store of db.objectStoreNames) out.push(JSON.stringify(await ask(db.transaction(store, "readonly").objectStore(store).getAll()), (k, v) => (v instanceof Blob ? "blob" : v)));
      db.close();
    }
    return out.join("\n");
  });
  const leaks = outgoing.filter((r) => HELPER_WORDS.some((w) => r.includes(w)));
  check("G: no word read from the helper is in any request the page sent", outgoing.length > 0 && leaks.length === 0, leaks[0]?.slice(0, 160) ?? `${outgoing.length} requests`);
  check("G: …nor in the saved site", saved.length > 1000 && !HELPER_WORDS.some((w) => saved.includes(w)) && JSON.stringify(await page.evaluate(() => window.__studioHistory?.doc() ?? {})).length > 100 && !HELPER_WORDS.some((w) => JSON.stringify(after).includes(w)));
  await ctx.close();

  /* E, reduced motion. */
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await standIn(c2, origin);
  const p2 = await c2.newPage();
  p2.on("pageerror", (e) => errors.push(`reduced: ${e.message}`));
  await openBoard(p2, BASE, "solface");
  await p2.locator("[data-agents-button]").click();
  await p2.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  /* Opening it draws a few frames (the feed, the fonts); wait for those to end, not a fixed 800 ms a slow machine overruns (PACE). */
  await waitFor(p2, () => window.__lanesBoard && !window.__lanesBoard.moving, null, 10000);
  await p2.waitForTimeout(800);
  const pos = () => p2.evaluate(() => [...document.querySelectorAll("[data-lanes-orb],[data-lanes-moon],[data-lanes-retired]")].map((e) => e.getAttribute("transform")).join("|"));
  const a1 = await pos(), d1 = await p2.evaluate(() => window.__lanesBoard?.draws ?? 0);
  await p2.waitForTimeout(1500);
  const a2 = await pos(), d2 = await p2.evaluate(() => window.__lanesBoard?.draws ?? 0);
  check("E: under prefers-reduced-motion everything is still and nothing redraws", a1 === a2 && a1.length > 0 && d2 - d1 < 3, `${a1 === a2 ? "still" : "moved"}, ${d2 - d1} draws in 1.5 s`);
  await p2.locator(`[data-lanes-hit="retired:${FEED.coordinators[0].id}"]`).dispatchEvent("click");
  await p2.waitForTimeout(300);
  check("M: …and a retired coordinator still comes back as a ring, at once", (await p2.locator(`[data-lanes-ring="${FEED.coordinators[0].id}"]`).count()) === 1);
  await c2.close();
} catch (e) { check("the Builder part ran to the end", false, String(e?.message ?? e).split("\n")[0].slice(0, 200)); }

/* 5, the PC view in the helper's own dock page. */
try {
  const { serveDock } = await import("../helper/dock/serve.mjs");
  const F = await import("../helper/pc/fake.ts");
  const server = await serveDock({ port: 0 });
  const D = `http://127.0.0.1:${server.address().port}`;
  const ctx = await browser.newContext({ viewport: { width: 440, height: 2200 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`pc view: ${e.message}`));
  await page.goto(`${D}/dock?fake=1&tab=pc&pc=fake`);
  await page.waitForSelector("[data-pcview-ready]", { timeout: 8000 }).catch(() => {});
  const pc = F.fakePc();
  const items = pc.groups.flatMap((g) => g.items);
  const secrets = [...items.map((i) => `pid ${i.pid}`), ...items.map((i) => i.detail).filter((d) => d && d.length > 12), ...pc.groups.map((g) => g.folder).filter(Boolean)];
  const text = async () => page.locator("[data-pcview]").innerText();
  check("5: each row's pid, memory and command line sit in one Details, closed", (await page.locator("[data-pc-more]").count()) === items.length && (await page.locator("[data-pc-more][open]").count()) === 0);
  await page.evaluate(() => document.querySelectorAll("[data-pc-more]").forEach((d) => { d.open = true; }));
  await page.waitForTimeout(200);
  const shut = await text();
  check("5: Private (the default), with every Details open: no pid, command line or folder on screen", secrets.length > 5 && !secrets.some((s) => shut.includes(s)) && shut.includes("hidden"), secrets.find((s) => shut.includes(s)) ?? "");
  await page.locator("[data-pc-private]").click();
  await page.evaluate(() => document.querySelectorAll("[data-pc-more]").forEach((d) => { d.open = true; }));
  await page.waitForTimeout(200);
  const open = await text();
  check("5: Private off, the Details show them", items.every((i) => open.includes(`pid ${i.pid}`)) && pc.groups.filter((g) => g.folder).every((g) => open.includes(g.folder)));
  await ctx.close();
  server.close();
} catch (e) { check("5: the PC view runs", false, String(e?.message ?? e).slice(0, 200)); }

/* ------------------------------------------------------------ 3. the six repo fixtures */
const SITE_MINUTES = 4;
async function onFixture(site) {
  const file = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); return; }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await standIn(ctx, new URL(BASE).origin);
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (e) => errors.push(`${site}: ${e.message}`));
  await openBoard(page, BASE, "solface");
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
  const before = await settled(page);
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-sun]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => ({
    mark: document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark"),
    waiting: document.querySelector("[data-agents-waiting]")?.getAttribute("data-agents-waiting"),
    orbs: document.querySelectorAll("[data-lanes-orb][data-kind=orb]").length,
    sun: document.querySelectorAll("[data-lanes-sun]").length,
    moons: document.querySelectorAll("[data-lanes-moon]").length,
    archive: document.querySelector("[data-lanes-archive]")?.getAttribute("data-lanes-archive"),
  }));
  await page.locator("[data-lanes-tune-open]").click().catch(() => {});
  const tune = await page.locator("[data-tune-group]").count();
  const after = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
  check(`${site}: the helper's mark, the pie, ${LIVE.length} orbs, the sun, the moons, the nucleus and Tune, with the dock open`, s.mark === "paired" && s.waiting === String(OPEN.length) && s.orbs === LIVE.length && s.sun === 1 && s.moons === OPEN.length && s.archive === "2" && tune === 7, JSON.stringify({ ...s, tune }));
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
