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
 *      home exactly (no jitter), 60 frames a second with 40 chats, drawn only
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

/* A made feed of 40 chats: 3 coordinators; 26 finished, the rest working, waiting or parked; two open questions. */
const minutes = (m) => new Date(Date.parse("2026-11-10T12:00:00Z") - m * 60_000).toISOString();
const chat = (c, k, state, extra = {}) => ({ id: `local_${c}${String(k).padStart(7, "0")}-0000-4000-8000-000000000000`, name: `Secret client ${c}${k}`, lane: `lane-${c}${k}`, code: `C${c.toUpperCase()}${k}`, emoji: "🔮", state, lastSeen: minutes(k * 7 + c.charCodeAt(0)), ...extra });
const FEED = {
  decisions: [
    { id: "q-orbit", order: 1, about: "lane-b7", question: "Which orbit speed?", options: [{ key: "a", label: "Slow" }, { key: "b", label: "Fast", pick: true }], answer: "", answeredAt: "" },
    { id: "q-merge", order: 2, about: "lane-c2", question: "Merge which first?", options: [{ key: "a", label: "Orbs" }, { key: "b", label: "Veil" }], answer: "", answeredAt: "" },
    { id: "q-done", order: 0, about: "lane-a1", question: "Already answered", options: [{ key: "a", label: "Yes" }], answer: "a", answeredAt: minutes(5) },
  ],
  coordinators: [
    { id: "local_cccccccc-0000-4000-8000-00000000000a", name: "Coordinator A", chats: Array.from({ length: 14 }, (_, k) => chat("a", k + 1, "done")) },
    { id: "local_cccccccc-0000-4000-8000-00000000000b", name: "Coordinator B", chats: [...Array.from({ length: 10 }, (_, k) => chat("b", k + 1, k < 6 ? "done" : k === 6 ? "need" : "work"))] },
    { id: "local_cccccccc-0000-4000-8000-00000000000c", name: "Coordinator C", chats: [...Array.from({ length: 16 }, (_, k) => chat("c", k + 1, k < 6 ? "done" : k === 1 ? "need" : k % 3 === 0 ? "park" : "work"))] },
  ],
};
FEED.coordinators[2].chats[1].state = "need";
const ALL = FEED.coordinators.flatMap((c) => c.chats);
const DONE = ALL.filter((x) => x.state === "done");
const LIVE = ALL.filter((x) => x.state !== "done");

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

if (T && BT) {
  const S = BT.BOARD_TUNE, keys = T.controlsOf(S).map((c) => c.key);
  check("D: the board's drawer has every value J named", ["tilt", "axis", "order", "orb", "ring", "texture", "key", "rim", "glow", "orbit", "spin", "gravity", "drag", "bounce", "settle"].every((k) => keys.includes(k)) && S.groups.map((g) => g.label).join() === "Orientation,Order,Size,Texture,Lighting,Speeds,Motion", keys.join());
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
  check("5: the helper serves each chat's badge, still no note", s.coordinators[0].chats[0].code === "ORBS" && s.coordinators[0].chats[0].emoji === "🔮" && !("note" in s.coordinators[0].chats[0]));
}

/* ------------------------------------------------------------ 2. in the Builder */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launch = () => chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
let browser = await launch();
const errors = [];
/** The stand-in helper: paired, answering unpaired, refusing this Builder (answering), or off. */
const helper = { mode: "paired", healthAsks: 0, starts: 0 };
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
    if (u.pathname === "/lanes") return r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify({ feed: FEED, beats: [], now: Date.now() }) });
    return r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!doctype html><title>dock stub</title><body>dock" });
  });
  await ctx.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: FEED, beats: [], now: Date.now() }) }));
}
const waitFor = async (page, fn, arg, ms) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true).catch(() => false);
/** A press on the archive body, where its hit circle is. */
const pressArchive = async (page) => { const b = await page.locator("[data-lanes-hit=archive]").boundingBox(); if (b) await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2); };
/** The board's parts once they stop settling (a saved board's text can move a few pixels as fonts arrive, dock or no dock). */
const settled = async (page) => { let a = ""; for (let i = 0; i < 30; i++) { const b = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? [])); if (b === a) return b; a = b; await page.waitForTimeout(1500); } return a; };
const mark = (page) => page.evaluate(() => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") ?? null);

try {
  const origin = new URL(BASE).origin;
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await standIn(ctx, origin);
  const page = await ctx.newPage();
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

  /* B. */
  const asks = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll("[data-lanes-asks]")].map((e) => [e.getAttribute("data-lanes-orb"), e.getAttribute("data-lanes-asks")])));
  check("B: the Agents button counts the questions waiting on J", (await page.locator("[data-agents-waiting]").getAttribute("data-agents-waiting").catch(() => null)) === "2");
  const asker = FEED.coordinators[1].chats[6], asker2 = FEED.coordinators[2].chats[1];
  check("B: the asking chats' orbs carry the same mark", asks[asker.id] === "1" && asks[asker2.id] === "1" && Object.keys(asks).length === 2, JSON.stringify(asks));
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(300);
  await page.locator(`[data-lanes-hit="${asker2.id}"]`).dispatchEvent("pointerdown", { button: 0, clientX: 0, clientY: 0, pointerId: 1, isPrimary: true });
  await page.evaluate(() => window.dispatchEvent(new PointerEvent("pointerup", { button: 0, clientX: 0, clientY: 0, pointerId: 1 })));
  const opened = await waitFor(page, () => document.querySelector('[data-decision="q-merge"][data-decision-lit]') !== null, null, 4000);
  check("B: a press on the asking orb opens its question, lit", opened);
  check("B: …with its options as buttons, the first one ready to press", (await page.locator('[data-decision="q-merge"] button[data-decision-press]').count()) === 2 && (await page.evaluate(() => document.activeElement?.closest('[data-decision="q-merge"]') !== null)));
  await page.locator("[data-agents-close]").click();
  await page.waitForTimeout(300);
  check("B: with the dock shut, the count and the mark stay on the button", (await page.locator("[data-agents-waiting]").getAttribute("data-agents-waiting").catch(() => null)) === "2" && (await mark(page)) === "paired");
  const asked = helper.healthAsks;
  helper.mode = "off";
  check("A: …and the dock shut, the mark still follows the helper", await waitFor(page, () => document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark") === "off", null, 9000) && helper.healthAsks >= asked);
  helper.mode = "paired";
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-board]", { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);

  /* C. */
  const orbs = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-orb]")].map((e) => e.getAttribute("data-lanes-orb")));
  check("C: only working, waiting and parked chats are orbs of their own", orbs.length === LIVE.length && LIVE.every((x) => orbs.includes(x.id)), `${orbs.length} orbs for ${LIVE.length}`);
  check("C: the finished ones are one archive body with their count", (await page.locator("[data-lanes-archive]").getAttribute("data-lanes-archive").catch(() => null)) === String(DONE.length) && (await page.locator("[data-lanes-archive]").textContent()).includes(String(DONE.length)));
  await pressArchive(page);
  await page.waitForTimeout(1200);
  const fan = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-orb][data-state=done]")].map((e) => ({ id: e.getAttribute("data-lanes-orb"), x: +e.getAttribute("data-x"), y: +e.getAttribute("data-y") })));
  const latest = [...DONE].sort((a, b) => Date.parse(b.lastSeen) - Date.parse(a.lastSeen)).slice(0, 12).map((x) => x.id);
  check("C: a press fans out the latest dozen round it", fan.length === 12 && latest.every((id) => fan.some((f) => f.id === id)) && fan.every((f) => Math.hypot(f.x, f.y) > 40 && Math.hypot(f.x, f.y) < 160), `${fan.length}`);
  const oldest = [...DONE].sort((a, b) => Date.parse(a.lastSeen) - Date.parse(b.lastSeen))[0];
  await page.locator("[data-lanes-archive-search]").fill(oldest.code.toLowerCase());
  await page.waitForTimeout(300);
  const hits = await page.evaluate(() => [...document.querySelectorAll("[data-lanes-archive-item]")].map((e) => e.getAttribute("data-lanes-archive-item")));
  check("C: search reaches one that isn't in the dozen", !latest.includes(oldest.id) && hits.length === 1 && hits[0] === oldest.id, JSON.stringify(hits));
  await pressArchive(page);
  await page.waitForTimeout(1800);
  check("C: pressed again, they fold back in", (await page.locator("[data-lanes-orb][data-state=done]").count()) === 0 && (await page.locator("[data-lanes-archive-list]").count()) === 0);

  /* 5, on the board. */
  const boardText = await page.locator("[data-agents-dock]").innerText();
  check("5: Private is on by default, and no chat's name is on screen, only badges", (await page.locator("[data-agents-private]").getAttribute("data-agents-private")) === "on" && !/Secret client/.test(boardText) && /🔮 CB7/.test(boardText));
  await page.locator("[data-agents-private]").click();
  await page.waitForTimeout(500);
  check("5: Private off, the names are back", /Secret client/.test(await page.locator("[data-agents-dock]").innerText()));
  await page.locator("[data-agents-private]").click();
  await page.waitForTimeout(300);

  /* D. */
  await page.locator("[data-lanes-tune-open]").click();
  await page.waitForSelector("[data-tune]", { timeout: 4000 }).catch(() => {});
  const groups = await page.evaluate(() => [...document.querySelectorAll("[data-tune-group]")].map((e) => e.getAttribute("data-tune-group")));
  check("D: Tune opens one drawer, grouped as J asked", groups.join() === "orientation,order,size,texture,lighting,speeds,motion", groups.join());
  check("D: …sliders for every number, a choice for order and texture", (await page.locator('[data-tune] input[type=range]').count()) === 13 && (await page.locator("[data-tune] select").count()) === 2);
  const scaleOf = () => page.evaluate(() => { const o = document.querySelector("[data-lanes-orb]"); return o ? +o.querySelector("circle:nth-of-type(2)").getAttribute("r") : 0; });
  const r1 = await scaleOf();
  await page.locator('[data-tune-key="orb"]').fill("1.5");
  await page.waitForTimeout(400);
  const r2 = await scaleOf();
  check("D: a slider changes the board live (orb size)", close(r2 / r1, 1.5, 0.02), `${r1} → ${r2}`);
  await page.locator('[data-tune-key="texture"]').selectOption("planet");
  await page.waitForTimeout(400);
  check("D/E: a texture set wraps the orbs", (await page.locator('[data-lanes-texture="planet"]').count()) >= LIVE.length);
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
  const mid = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
  const diffOf = (x, y) => { const A = JSON.parse(x), B = JSON.parse(y); if (A.length !== B.length) return `${A.length} parts, then ${B.length}`; const i = A.findIndex((n, k) => JSON.stringify(n) !== JSON.stringify(B[k])); if (i < 0) return ""; return `${A[i].id}: ${Object.keys({ ...A[i], ...B[i] }).filter((k) => JSON.stringify(A[i][k]) !== JSON.stringify(B[i][k])).map((k) => `${k} ${JSON.stringify(A[i][k])?.slice(0, 40)} → ${JSON.stringify(B[i][k])?.slice(0, 40)}`).join("; ")}`; };
  check("the board under the dock didn't move by a pixel (helper states, questions, archive, Tune)", before === mid && before.length > 10, diffOf(before, mid));
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  check("D: …and a reload keeps it", (await page.locator('[data-lanes-texture="planet"]').count()) > 0);
  await page.locator("[data-agents-close]").click();
  const before2 = await settled(page);
  await page.locator("[data-agents-button]").click();
  await page.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  await page.evaluate(() => localStorage.removeItem("polio.tune.agents-board"));

  /* E. */
  await page.evaluate(() => document.querySelector("[data-lanes-atom]")?.scrollIntoView({ block: "end" }));
  await page.waitForTimeout(500);
  const target = LIVE.find((x) => x.state === "park") ?? LIVE[0];
  const orb = page.locator(`[data-lanes-orb="${target.id}"]`);
  const box = await orb.boundingBox();
  if (box) {
    const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) { await page.mouse.move(cx - 18 * i, cy - 10 * i); await page.waitForTimeout(16); }
    const held = await orb.getAttribute("data-held");
    await page.mouse.up();
    const flung = await orb.getAttribute("data-held");
    const samples = [];
    for (let i = 0; i < 40; i++) { samples.push(await orb.evaluate((e) => ({ d: Math.hypot(+e.dataset.x - +e.dataset.homeX, +e.dataset.y - +e.dataset.homeY), held: e.dataset.held ?? "" }))); await page.waitForTimeout(100); }
    const last = samples.at(-1);
    check("E: a drag holds the orb off its place, a release flings it", held === "held" && flung === "flung" && samples[0].d > 30, `${held} ${flung} ${samples[0].d.toFixed(0)}`);
    check("E: it settles home exactly, by itself", last.d === 0 && last.held === "", JSON.stringify(last));
    const settledAt = samples.findIndex((s) => s.d === 0);
    check("E: and stays there: no jitter once home", settledAt > 0 && samples.slice(settledAt).every((s) => s.d === 0));
  } else check("E: the orb is on screen to drag", false);

  const fps = async () => { const a = await page.evaluate(() => window.__lanesBoard?.draws ?? 0); await page.waitForTimeout(2000); return ((await page.evaluate(() => window.__lanesBoard?.draws ?? 0)) - a) / 2; };
  const rate = await fps();
  check(`E: ${ALL.length} chats draw at the screen's rate (about 60 a second)`, rate >= 50, `${rate.toFixed(0)} draws a second`);
  /* With orbit and spin at 0 and nothing thrown, nothing moves, so nothing is drawn. */
  await page.locator("[data-lanes-tune-open]").click();
  await page.locator('[data-tune-key="orbit"]').fill("0");
  await page.locator('[data-tune-key="spin"]').fill("0");
  /* A working ring held at orbit 0 eases flat over some seconds; then nothing moves. */
  const stilled = await waitFor(page, () => window.__lanesBoard && !window.__lanesBoard.moving, null, 30000);
  await page.waitForTimeout(300);
  const idleRate = await fps();
  check("E: a board where nothing moves isn't drawn", stilled && idleRate < 2, `${idleRate} draws a second`);
  await page.evaluate(() => localStorage.removeItem("polio.tune.agents-board"));
  const after = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
  const diff = (() => { const A = JSON.parse(before2), B = JSON.parse(after); if (A.length !== B.length) return `${A.length} parts, then ${B.length}`; const i = A.findIndex((n, k) => JSON.stringify(n) !== JSON.stringify(B[k])); if (i < 0) return ""; const keys = Object.keys({ ...A[i], ...B[i] }).filter((k) => JSON.stringify(A[i][k]) !== JSON.stringify(B[i][k])); return `${A[i].id}: ${keys.map((k) => `${k} ${JSON.stringify(A[i][k])?.slice(0, 40)} → ${JSON.stringify(B[i][k])?.slice(0, 40)}`).join("; ")}`; })();
  check("…nor while orbs are dragged and the board tuned", before2 === after && before2.length > 10, diff);
  await ctx.close();

  /* E, reduced motion. */
  const c2 = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: "reduce" });
  await standIn(c2, origin);
  const p2 = await c2.newPage();
  p2.on("pageerror", (e) => errors.push(`reduced: ${e.message}`));
  await openBoard(p2, BASE, "solface");
  await p2.locator("[data-agents-button]").click();
  await p2.waitForSelector("[data-lanes-orb]", { timeout: 20000 }).catch(() => {});
  await p2.waitForTimeout(800);
  const pos = () => p2.evaluate(() => [...document.querySelectorAll("[data-lanes-orb]")].map((e) => `${e.dataset.x},${e.dataset.y}`).join("|"));
  const a1 = await pos(), d1 = await p2.evaluate(() => window.__lanesBoard?.draws ?? 0);
  await p2.waitForTimeout(1500);
  check("E: under prefers-reduced-motion everything is still and nothing redraws", a1 === (await pos()) && a1.length > 0 && (await p2.evaluate(() => window.__lanesBoard?.draws ?? 0)) - d1 < 3);
  await pressArchive(p2);
  await p2.waitForTimeout(200);
  check("E: …and the archive still fans out, at once", (await p2.locator("[data-lanes-orb][data-state=done]").count()) === 12);
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
  await page.waitForSelector("[data-lanes-archive]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => ({
    mark: document.querySelector("[data-agents-helper-mark]")?.getAttribute("data-agents-helper-mark"),
    waiting: document.querySelector("[data-agents-waiting]")?.getAttribute("data-agents-waiting"),
    orbs: document.querySelectorAll("[data-lanes-orb]").length,
    archive: document.querySelector("[data-lanes-archive]")?.getAttribute("data-lanes-archive"),
  }));
  await page.locator("[data-lanes-tune-open]").click().catch(() => {});
  const tune = await page.locator("[data-tune-group]").count();
  const after = await page.evaluate(() => JSON.stringify(window.__studioNodes?.() ?? []));
  check(`${site}: the helper's mark, the count, ${LIVE.length} orbs, the archive and Tune, with the dock open`, s.mark === "paired" && s.waiting === "2" && s.orbs === LIVE.length && s.archive === String(DONE.length) && tune === 7, JSON.stringify({ ...s, tune }));
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
