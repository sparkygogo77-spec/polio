#!/usr/bin/env node
/**
 * BAM: THE BUILDER'S AGENTS MANAGER AS J DREW IT (2026-11-11, `handovers/open/decisions-in-panes/j-11-11-pm/21.webp`;
 * brief `handovers/open/dock-talk-brief.md`, marks 1, 9, 11 to 13, 16, 18 to 20, 22).
 *
 *    1/9. the coordinator's terminal: under the ring, the rest of the rail's height; its messages in line, oldest
 *         first; J types with the real keyboard; Send / Note / New chat save a press through the Helper (Answer
 *         when a question is open), read on the coordinator's next turn; typing never reaches the board;
 *   11.   one question button on the coordinator's head with its count (no row of "!n" pills), opening every open
 *         question grouped: new since J last looked, by chat, older carried over;
 *   12.   the column stands off the left wall;
 *   13.   the ring sits in the top right, in its own box with room, and nothing on it nears the screen's edge;
 *   16.   finished chats a day old with nothing waiting leave the ring for the nucleus (the sun), which is pressable
 *         and shows them only when pressed;
 *   18.   each chat on a ring has its own place, by when it began: two working chats are never one big orb;
 *   19.   moons take no pointer; every orb's press area is at least 32 px across;
 *   20.   a pane opens at its full size, its newest question whole; the model chip reads the row's model;
 *   22.   the console's badge beside the plain name ("🎛️ STAGE · Console stage").
 *
 * No wall-clock limits (the speed-check rule): only counts, places and words.
 *
 *   npx next start -p 3098          (a build of this branch)
 *   node tests/bam-manager.mjs http://127.0.0.1:3098 [fixtures folder with sites/<name>/site/document.json]
 *
 * Covers: src/features/agents/manager.ts, src/features/agents/AgentsManager.tsx, src/features/agents/LanesBoard.tsx, src/features/agents/lanes.ts, helper/server/lanes.ts
 */
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3098").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? "";
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const tryImport = async (p) => { try { return await import(p); } catch (e) { check(`${p} loads`, false, String(e?.message ?? e).split("\n")[0].slice(0, 140)); return null; } };

/* ------------------------------------------------------------ the made feed, shaped as J's is now */
const ago = (m) => new Date(Date.now() - m * 60_000).toISOString();
const uid = (k) => `local_${String(k).padStart(8, "0")}-0000-4000-8000-000000000000`;
const row = (k, name, state, extra = {}) => ({ id: uid(k), name, lane: name.toLowerCase().replace(/\s+/g, "-"), state, kind: "lane", lastSeen: ago(k), turns: 1, ...extra });
const C8 = row(8, "Coordinator 8", "work", { kind: "coordinator", lane: "coordinator", code: "PIONEER", emoji: "🧽", turns: 9, model: "Fable 5.2", effort: "medium",
  messages: [{ at: ago(30), text: "First: TRYIT finished." }, { at: ago(20), text: "Second: STAGE put console 0.25 in the mod." }, { at: ago(5), text: "Third: BAM started at your word." }] });
const STAGE = row(11, "Console stage", "work", { code: "STAGE", emoji: "🎛️", model: "Opus 5.5", effort: "medium", runBy: C8.id, history: [{ at: ago(90), text: "Started.", public: true }], note: "Building the side panel." });
const OSC = row(12, "Orbs speed check", "work", { code: "OSC", emoji: "⏱️", model: "Opus 5.5", effort: "medium", runBy: C8.id, history: [{ at: ago(80), text: "Started.", public: true }], note: "Fixing the speed check." });
const TRYIT = row(13, "Blender as one button", "need", { code: "TRYIT", emoji: "🧊", model: "Opus 5.5", effort: "medium", runBy: C8.id, history: [{ at: ago(200), text: "Started.", public: true }], note: "One Try it press." });
const OLD = row(14, "Old finished one", "done", { code: "OLD", lastSeen: ago(3 * 24 * 60) });
const FRESH = row(15, "Fresh finished one", "done", { code: "FRESH", lastSeen: ago(120) });
const OLDASK = row(16, "Old one with a question", "done", { code: "OLDASK", lastSeen: ago(4 * 24 * 60) });
const C7 = row(7, "Coordinator 7", "done", { kind: "coordinator", lane: "coordinator-7", code: "HELM", emoji: "🧭", lastSeen: ago(600) });
const LONG = "Try it now runs in 2.6 s on a copy of 953, makes the picture and undoes it, leaving nothing running: is that what you wanted from one button, or should it also open the picture for you at the end?";
const FEED = {
  decisions: [
    { id: "q-try-1", order: 1, about: "blender-as-one-button", question: "Keep the copy after Try it?", options: [{ key: "a", label: "Keep" }, { key: "b", label: "Throw away", pick: true }], answer: "", answeredAt: "", asked: ago(60) },
    { id: "q-try-2", order: 2, about: "blender-as-one-button", question: LONG, options: [{ key: "a", label: "That" }, { key: "b", label: "Also open it" }], answer: "", answeredAt: "", asked: ago(10) },
    { id: "q-own", order: 3, about: "coordinator", question: "Send Merges 76 tonight?", options: [{ key: "yes", label: "Yes" }, { key: "no", label: "Wait" }], answer: "", answeredAt: "", asked: ago(15) },
    { id: "q-carried", order: 4, about: "old-one-with-a-question", question: "An old one, carried over", options: [{ key: "a", label: "Fine" }], answer: "", answeredAt: "", asked: ago(3 * 24 * 60), carried: "From coordinator 7 (8 Nov). Still open." },
    { id: "q-gone", order: 0, about: "console-stage", question: "Answered already", options: [{ key: "a", label: "Yes" }], answer: "a", answeredAt: ago(5) },
  ],
  checks: [], iterations: [],
  coordinators: [{ id: "c-all", name: "Coordinator 4", chats: [C8, STAGE, OSC, TRYIT, OLD, FRESH, OLDASK, C7] }],
};

/* ------------------------------------------------------------ 1. pure */
const L = await tryImport("../src/features/agents/lanes.ts");
const M = await tryImport("../src/features/agents/manager.ts");
const HL = await tryImport("../helper/server/lanes.ts");
const NOW = Date.now();

if (L?.readFeed && M?.labelOf) {
  const feed = L.readFeed(FEED);
  const chat = (id) => feed.coordinators[0].chats.find((x) => x.id === id);
  check("1: the coordinator's messages are read, oldest first", chat(C8.id).messages?.map((m) => m.text.split(":")[0]).join() === "First,Second,Third");
  check("18: a chat's start is its first timeline step", chat(STAGE.id).begun === Date.parse(STAGE.history[0].at) && chat(OSC.id).begun > chat(STAGE.id).begun);
  check("22: the badge beside the plain name; the name alone when the code says the same", M.labelOf(chat(STAGE.id)) === "🎛️ STAGE · Console stage" && M.labelOf({ name: "Stage", code: "STAGE" }) === "Stage" && M.labelOf({ name: "Plain" }) === "Plain", M.labelOf(chat(STAGE.id)));
  const nuc = M.nucleusChats(feed, NOW).map((x) => x.id);
  check("16/17: a chat finished more than a day ago with nothing waiting is in the nucleus; a fresh one and one with an open question are not", nuc.includes(OLD.id) && !nuc.includes(FRESH.id) && !nuc.includes(OLDASK.id) && !nuc.includes(C7.id), nuc.join());
  const slots = M.ringSlots([chat(OSC.id), chat(STAGE.id), chat(TRYIT.id)]);
  const fr = [slots.get(TRYIT.id), slots.get(STAGE.id), slots.get(OSC.id)];
  check("18: each chat its own place on the ring, by when it began (oldest first), evenly round", fr.join() === `0,${1 / 3},${2 / 3}`, fr.join());
  check("19: a press area is never under 16 px across its radius on screen", M.hitRadius(10, 0.5) === 32 && M.hitRadius(40, 1) === 40);
  const lay = M.layoutOf(1500, 950, 1), small = M.layoutOf(700, 900, 1);
  check("12/13: the column off the wall, a rail on the right for the ring and the terminal; stacked when narrow", !lay.stacked && lay.gap >= 40 && lay.rail >= 340 && lay.col <= 640 && lay.gap + lay.col + lay.rail < 1500 - 60 && small.stacked, JSON.stringify(lay));
  const fits = [960, 1000, 1100, 1300, 1900].map((w) => { const l = M.layoutOf(w, 950, 2); return l.stacked || (l.col >= 300 && l.gap + 2 * l.col + l.rail + 2 * 8 + 16 <= w); });
  check("12/13: at every width two columns, the gap and the rail fit side by side (the rail, then the gap, give way first) or stack", fits.every(Boolean), fits.join());
  const open = feed.questions.filter(L.isOpen);
  const g0 = M.questionGroups(feed, open, new Set(), NOW);
  check("11: grouped: new since you last looked (newest first), then older carried over", g0.fresh.map((d) => d.id).join() === "q-try-2,q-own,q-try-1" && g0.older.map((d) => d.id).join() === "q-carried" && g0.byChat.length === 0, JSON.stringify(g0).slice(0, 200));
  const g1 = M.questionGroups(feed, open, new Set(["q-try-1", "q-try-2"]), NOW);
  check("11: once opened, a question leaves New for its chat's group, named by its badge", g1.fresh.map((d) => d.id).join() === "q-own" && g1.byChat[0]?.who === "🧊 TRYIT · Blender as one button" && g1.byChat[0].list.map((d) => d.id).join() === "q-try-2,q-try-1" && M.countWords(g1) === "1 new · 2 seen · 1 older", M.countWords(g1));
}

const tmp = mkdtempSync(join(tmpdir(), "bam-manager-"));
if (HL?.pressLanes && HL?.forBuilder) {
  const served = HL.blankKeys(HL.forBuilder(FEED));
  check("1: the helper passes the coordinator's messages on", served.coordinators[0].chats[0].messages?.length === 3);
  const presses = join(tmp, "console-presses.json");
  const a = HL.pressLanes(presses, { kind: "say", target: C8.id, text: "  Hello\r\nthere  " });
  const b = HL.pressLanes(presses, { kind: "note", target: "q-try-1", text: "keep it" });
  const c = HL.pressLanes(presses, { kind: "new-chat", target: C8.id, text: "A brief" });
  const d = HL.pressLanes(presses, { kind: "say", target: C8.id, text: "   " });
  const e = HL.pressLanes(presses, { kind: "say", target: C8.id, text: "x".repeat(HL.MAX_SAY + 1) });
  const rows = JSON.parse(readFileSync(presses, "utf8"));
  check("9: say, note and new-chat presses are saved as words, one row each, from the Builder", a.ok && b.ok && c.ok && rows.length === 3 && rows[0].text === "Hello\nthere" && rows[0].kind === "say" && rows[0].from === "builder" && rows[1].target === "q-try-1" && rows[2].kind === "new-chat", JSON.stringify(rows));
  check("9: empty words or too many are refused, nothing saved", !d.ok && d.status === 400 && !e.ok && e.status === 400 && JSON.parse(readFileSync(presses, "utf8")).length === 3);
}
rmSync(tmp, { recursive: true, force: true });

/* ------------------------------------------------------------ 2. in the Builder */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const launch = () => chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
let browser = await launch();
const errors = [];
const posts = [];
let feedNow = JSON.parse(JSON.stringify(FEED));
async function standIn(ctx, origin) {
  await ctx.route(`${HELPER}/**`, (r) => {
    const u = new URL(r.request().url()), method = r.request().method();
    const cors = { "access-control-allow-origin": origin, vary: "Origin" };
    const json = (body) => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" }, body: "" });
    if (u.pathname === "/health") return json({ helper: true, paired: true });
    if (u.pathname === "/lanes/pc") return json({ ok: true, at: Date.now(), memTotal: 0, owners: [] });
    if (method === "POST") {
      const b = JSON.parse(r.request().postData() ?? "{}");
      posts.push({ path: u.pathname, ...b });
      if (u.pathname === "/lanes/answer") { const d = feedNow.decisions.find((x) => x.id === b.id); if (d) { d.answer = b.answer; d.answeredAt = new Date().toISOString(); } return json({ ok: true, answeredAt: d?.answeredAt }); }
      return json({ ok: true, kind: b.kind, target: b.target });
    }
    if (u.pathname === "/lanes") return json({ feed: feedNow, beats: [], now: Date.now() });
    return r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!doctype html><title>dock stub</title><body>dock" });
  });
  await ctx.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: feedNow, beats: [], now: Date.now() }) }));
}
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
/** Where every orb, the sun and each leftover sun is on screen, and each orb's press radius in screen pixels. */
const orbsOnScreen = (page) => page.evaluate(() => {
  const svg = document.querySelector("[data-manager-orbs] svg[role=group]");
  if (!svg) return null;
  const m = svg.getScreenCTM();
  const at = (x, y) => { const p = new DOMPoint(x, y).matrixTransform(m); return { x: p.x, y: p.y }; };
  const orbs = [...svg.querySelectorAll("[data-lanes-orb]")].map((g) => ({ id: g.getAttribute("data-lanes-orb"), kind: g.getAttribute("data-kind"), ...at(+g.dataset.x, +g.dataset.y) }));
  const sunG = svg.querySelector("[data-lanes-sun]"), t = sunG?.getAttribute("transform")?.match(/translate\(([-\d.]+) ([-\d.]+)\)/);
  const sun = t ? at(+t[1], +t[2]) : null;
  const hits = [...svg.querySelectorAll("[data-lanes-hit]")].map((c) => ({ id: c.getAttribute("data-lanes-hit"), r: +c.getAttribute("r") * m.a }));
  return { orbs, sun, hits, moonHits: svg.querySelectorAll("[data-lanes-moon-hit]").length, beads: [...svg.querySelectorAll("[data-lanes-bead]")].map((b) => b.getAttribute("data-lanes-bead")) };
});

try {
  const origin = new URL(BASE).origin;
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
  await standIn(ctx, origin);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`made page: ${e.message}`));
  page.setDefaultTimeout(60_000);
  await openBoard(page, BASE, "solface");
  const before = await settled(page);
  const up = await openManager(page);
  check("the manager opens from the dock", up);
  if (up) {
    await page.waitForSelector("[data-manager-pane]", { timeout: 15000 }).catch(() => {});
    await page.waitForSelector("[data-manager-orbs] [data-lanes-sun]", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const W = 1500, H = 950;
    const mgr = await box(page, "[data-agents-manager]");
    const c8 = await box(page, col(C8.id));
    const orbs = await box(page, "[data-manager-orbs]");
    const term = await box(page, "[data-manager-terminal]");
    const body = await box(page, "[data-manager-body]");

    /* 12, 13 */
    check("12: the column stands off the left wall, a clear gap on its left", !!c8 && c8.x - mgr.x >= 40, JSON.stringify(c8));
    check("13: the ring's box sits in the top right: against the right side and the top, right of the middle, clear of the column", !!orbs && W - orbs.r <= 30 && orbs.y - body.y <= 20 && orbs.x + orbs.w / 2 > 0.65 * W && orbs.x > c8.r + 40, JSON.stringify(orbs));
    const s = await orbsOnScreen(page);
    const inBox = (p, m) => p.x >= orbs.x + m && p.x <= orbs.r - m && p.y >= orbs.y + m && p.y <= orbs.b - m;
    check("13: the sun and every orb stay inside the ring's box with room, never near the screen's edge", !!s?.sun && inBox(s.sun, 60) && s.orbs.length > 0 && s.orbs.every((p) => inBox(p, 8) && W - p.x >= 24 && p.y - mgr.y >= 24), JSON.stringify(s?.orbs.filter((p) => !inBox(p, 8)).slice(0, 3)));

    /* 16 */
    check("16: a chat finished a day ago with nothing waiting is off the ring; a fresh one is still a bead", s && !s.orbs.some((p) => p.id === OLD.id) && !s.beads.includes(OLD.id) && s.beads.includes(FRESH.id), JSON.stringify(s?.beads));
    const nucleus = await page.locator("[data-lanes-nucleus]").getAttribute("data-lanes-nucleus").catch(() => null);
    const listBefore = await page.locator("[data-manager-nucleus-list]").count();
    await page.locator("[data-lanes-nucleus]").dispatchEvent("click").catch(() => {});
    await page.waitForTimeout(300);
    const listed = await page.locator(`[data-manager-nucleus-chat="${OLD.id}"]`).count();
    check("16: the sun is the nucleus: pressable, and its archived chats are loaded only when pressed", nucleus === "1" && listBefore === 0 && listed === 1, `${nucleus} ${listBefore} ${listed}`);
    await page.locator("[data-manager-nucleus-close]").click().catch(() => {});

    /* 18, 19 */
    const st = s?.orbs.find((p) => p.id === STAGE.id), os = s?.orbs.find((p) => p.id === OSC.id), tr = s?.orbs.find((p) => p.id === TRYIT.id);
    const apart = (a, b) => (a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0);
    check("18: the working chats are separate orbs, never in one place", apart(st, os) >= 30 && apart(st, tr) >= 30 && apart(os, tr) >= 30, `${apart(st, os).toFixed(0)} ${apart(st, tr).toFixed(0)} ${apart(os, tr).toFixed(0)}`);
    const orbHits = (s?.hits ?? []).filter((h) => s.orbs.some((p) => p.id === h.id));
    check("19: every orb's press area is at least 32 px across, and no moon takes the pointer", orbHits.length >= 4 && orbHits.every((h) => h.r >= 15.9) && s.moonHits === 0, JSON.stringify(orbHits.map((h) => h.r.toFixed(1))));

    /* 11 */
    const head = await page.evaluate((id) => { const h = document.querySelector(`[data-manager-head="${id}"]`); return { buttons: h.querySelectorAll("[data-manager-questions]").length, count: h.querySelector("[data-manager-questions]")?.getAttribute("data-manager-questions"), pills: document.querySelectorAll("[data-manager-ask]").length, words: h.querySelector("[data-manager-questions-words]")?.textContent }; }, C8.id);
    check("11: one question button on the head with the column's count, and no '!n' pills anywhere", head.buttons === 1 && head.count === "4" && head.pills === 0 && /3 new · 1 older/.test(head.words ?? ""), JSON.stringify(head));
    await page.locator(`[data-manager-head="${C8.id}"] [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const groups = await page.evaluate(() => [...document.querySelectorAll("[data-manager-all-group]")].map((g) => `${g.getAttribute("data-manager-all-group")}:${[...g.querySelectorAll("[data-manager-all-row]")].map((r) => r.getAttribute("data-manager-all-row")).join("+")}`).join(" | "));
    check("11: it opens every open question, grouped: new since you last looked (newest first), then older carried over", groups === "new:q-try-2+q-own+q-try-1 | older:q-carried", groups);
    await page.locator('[data-manager-all-row="q-own"]').click();
    await page.waitForTimeout(300);
    const qAt = await page.locator("[data-manager-question-at]").textContent().catch(() => "");
    const termQ = await page.locator("[data-manager-term-question]").getAttribute("data-manager-term-question").catch(() => null);
    const answerBtn = await page.locator('[data-manager-term-send="answer"]').count();
    check("9: a question opened from the list says where it is in that list, and the terminal answers it", /Question 2 of 3/.test(qAt ?? "") && termQ === "q-own" && answerBtn === 1, `${qAt} ${termQ} ${answerBtn}`);
    await page.locator("[data-manager-back]").first().click();
    await page.locator(`[data-manager-head="${C8.id}"] [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const groups2 = await page.evaluate(() => [...document.querySelectorAll("[data-manager-all-group]")].map((g) => g.getAttribute("data-manager-all-group")).join(" | "));
    check("11: once opened it is no longer new: it stands under its chat", /^new \| chat:/.test(groups2), groups2);
    await page.locator("[data-manager-back]").first().click();

    /* 20, 22: Private is on by default and shows badges only; names and models show with it off. */
    const privName = await page.locator(`${pane(STAGE.id)} [data-manager-name]`).textContent();
    check("22: with Private on (the default) a pane shows its badge only, never the plain name", privName === "🎛️ STAGE", privName);
    await page.locator("[data-manager-private]").click();
    await page.waitForTimeout(300);
    const panes = await page.evaluate(() => [...document.querySelectorAll("[data-manager-pane]")].map((p) => ({ id: p.getAttribute("data-manager-pane"), open: p.dataset.open, name: p.querySelector("[data-manager-name]")?.textContent, q: p.querySelector("[data-manager-pane-question]")?.textContent, chip: p.querySelector("[data-manager-chip-open]")?.textContent })));
    const tp = panes.find((p) => p.id === TRYIT.id), sp = panes.find((p) => p.id === STAGE.id);
    check("20: every pane opens at its full size", panes.length >= 3 && panes.every((p) => p.open === "1"), panes.map((p) => p.open).join());
    check("20: a pane shows its newest question whole, never cut", tp?.q === LONG, tp?.q);
    check("20: the model chip reads the row's model and effort", /Opus 5\.5 · medium/.test(sp?.chip ?? ""), sp?.chip);
    check("22: the console's badge beside the plain name", sp?.name === "🎛️ STAGE · Console stage" && tp?.name === "🧊 TRYIT · Blender as one button", `${sp?.name} | ${tp?.name}`);
    const paneBtn = await page.evaluate((id) => document.querySelectorAll(`[data-manager-pane="${id}"] [data-manager-questions]`).length, TRYIT.id);
    await page.locator(`${pane(TRYIT.id)} [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const qAt2 = await page.locator("[data-manager-question-at]").textContent().catch(() => "");
    check("11/20: a pane has one question button; it opens that chat's newest question, counted in that chat only", paneBtn === 1 && /Question 1 of 2 · TRYIT/.test(qAt2 ?? ""), `${paneBtn} ${qAt2}`);

    /* 1, 9 */
    check("9: the terminal sits under the ring and takes the rest of the height", !!term && term.y >= orbs.b - 1 && Math.abs(term.x - orbs.x) <= 2 && body.b - term.b <= 16 && term.h >= 200, JSON.stringify(term));
    const lines = await page.evaluate(() => [...document.querySelectorAll("[data-manager-term-line]")].map((l) => `${l.getAttribute("data-manager-term-line")}:${l.textContent}`));
    check("1: the coordinator's messages in line, oldest above newest, named by its badge", lines.length === 3 && /First/.test(lines[0]) && /Third/.test(lines[2]) && /PIONEER/.test(lines[0]) && (await page.locator("[data-manager-term-name]").textContent()) === "🧽 PIONEER · Coordinator 8", lines.join(" | "));
    const term1 = page.locator("[data-manager-term-input]");
    await term1.click();
    await page.keyboard.type("A note on this");
    await page.locator('[data-manager-term-send="note"]').click();
    await page.waitForTimeout(400);
    const note = posts.find((p) => p.path === "/lanes/press" && p.kind === "note");
    check("9: Note saves the words on the open question", note?.target === "q-try-2" && note.text === "A note on this", JSON.stringify(note));
    await page.locator("[data-manager-back]").first().click();
    await page.waitForTimeout(200);
    await term1.click();
    await page.keyboard.type("Hello C8");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("second line, then Backspace and Delete: x");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const say = posts.find((p) => p.path === "/lanes/press" && p.kind === "say");
    const says = await page.locator("[data-manager-term-says]").textContent();
    const mine = await page.evaluate(() => [...document.querySelectorAll('[data-manager-term-line="you"]')].map((l) => l.textContent).join(" | "));
    check("9: real typing: Enter sends to the coordinator, Shift+Enter is a new line, Backspace edits the words", say?.target === C8.id && say.text === "Hello C8\nsecond line, then Backspace and Delete:" && (await term1.inputValue()) === "", JSON.stringify(say));
    check("1: it says plainly when the words are read, and they stay in the terminal", /next turn/.test(says ?? "") && /Hello C8/.test(mine), `${says} | ${mine}`);
    await term1.click();
    await page.keyboard.type("Make a chat that tidies the dock");
    await page.locator('[data-manager-term-send="new-chat"]').click();
    await page.waitForTimeout(400);
    check("9: New chat saves the words as a new chat's brief", posts.some((p) => p.kind === "new-chat" && p.text === "Make a chat that tidies the dock"));
    await page.locator(`[data-manager-head="${C8.id}"] [data-manager-questions]`).click();
    await page.locator('[data-manager-all-row="q-own"]').click();
    await term1.click();
    await page.keyboard.type("yes");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    check("9: with a question open, Enter answers it", posts.some((p) => p.path === "/lanes/answer" && p.id === "q-own" && p.answer === "yes"));
    /* Narrow: a long model chip ("→ … asked") and every pane wrap inside their pane; the columns and the rail never overlap. */
    await page.locator(`${pane(STAGE.id)} [data-manager-chip-open]`).click();
    await page.locator(`${pane(STAGE.id)} [data-manager-model="Fable 5.2"]`).click();
    await page.locator(`${pane(STAGE.id)} [data-manager-effort="xhigh"]`).click();
    await page.locator(`${pane(STAGE.id)} [data-manager-model-use]`).click();
    await page.waitForTimeout(300);
    /* Two live coordinators, as on the merge chat's run: two columns share the width, so each is narrow. */
    feedNow.coordinators[0].chats.push(row(9, "Coordinator 9", "work", { kind: "coordinator", lane: "coordinator-9", code: "NEXT", emoji: "🛰️", turns: 1 }));
    const two = await page.waitForFunction(() => document.querySelectorAll("[data-manager-column]").length === 2, null, { timeout: 15000 }).then(() => true).catch(() => false);
    check("two live coordinators: two columns", two);
    for (const w of [960, 1000, 1100]) {
      await page.setViewportSize({ width: w, height: 950 });
      await page.waitForTimeout(500);
      const fit = await page.evaluate((id) => {
        const cs = [...document.querySelectorAll("[data-manager-column]")].map((e) => e.getBoundingClientRect()), rail = document.querySelector("[data-manager-rail]").getBoundingClientRect();
        const spill = [...document.querySelectorAll("[data-manager-pane]")].flatMap((p) => { const pr = p.getBoundingClientRect(); return [...p.querySelectorAll("b, span, p, input, textarea, button, a")].filter((e) => !e.hasAttribute("data-molten")).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.left < pr.left - 1 || r.right > pr.right + 1); }).map((e) => (e.textContent || e.tagName).slice(0, 30)); });
        return { chip: document.querySelector(`[data-manager-pane="${id}"] [data-manager-chip-open]`)?.textContent?.includes("asked"), spill, order: cs.every((r) => r.right <= rail.left + 1) && rail.right <= innerWidth + 1, over: document.documentElement.scrollWidth > innerWidth + 1 };
      }, STAGE.id);
      check(`at ${w} px: nothing in a pane runs past its side (a long model chip wraps), and the columns and the rail never overlap`, fit.chip && fit.spill.length === 0 && fit.order && !fit.over, JSON.stringify(fit));
    }
    await page.setViewportSize({ width: 1500, height: 950 });
    await page.waitForTimeout(300);
    await page.locator("[data-manager-to-dock]").click().catch(() => {});
    await page.locator("[data-agents-button]").click().catch(() => {});
    await page.waitForTimeout(300);
    const after = await settled(page);
    check("9: nothing typed in the terminal reached the board: it hasn't moved by a pixel", before === after && before.length > 10, `${before.length} ${after.length}`);
  }
  await ctx.close();

  /* With motion on: sample the ring a few times as it turns; nothing ever nears the edge, the two working chats never meet. */
  feedNow = JSON.parse(JSON.stringify(FEED));
  const ctx2 = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  await standIn(ctx2, origin);
  const p2 = await ctx2.newPage();
  p2.on("pageerror", (e) => errors.push(`moving page: ${e.message}`));
  await openBoard(p2, BASE, "solface");
  if (await openManager(p2)) {
    await p2.waitForSelector("[data-manager-orbs] [data-lanes-sun]", { timeout: 15000 }).catch(() => {});
    const ob = await box(p2, "[data-manager-orbs]");
    let edge = 0, met = 0, n = 0;
    for (let i = 0; i < 8; i++) {
      await p2.waitForTimeout(700);
      const s = await orbsOnScreen(p2);
      if (!s) continue;
      n++;
      for (const p of [...s.orbs, ...(s.sun ? [s.sun] : [])]) if (p.x < ob.x || p.x > ob.r || p.y < ob.y || p.y > ob.b || 1500 - p.x < 24) edge++;
      const a = s.orbs.find((p) => p.id === STAGE.id), b = s.orbs.find((p) => p.id === OSC.id);
      if (a && b && Math.hypot(a.x - b.x, a.y - b.y) < 30) met++;
    }
    check("13/18: as the ring turns, nothing leaves its box or nears the edge, and the two working chats never meet", n >= 6 && edge === 0 && met === 0, `${n} samples, ${edge} out, ${met} met`);
  } else check("13/18: the moving manager opens", false);
  await ctx2.close();
} catch (e) {
  check("ran to the end", false, String(e?.stack ?? e).split("\n").slice(0, 3).join(" "));
}

/* ------------------------------------------------------------ 3. the six repo fixtures: the layout on each, and the board unmoved */
async function onFixture(site) {
  const file = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); return; }
  const doc = JSON.parse(readFileSync(file, "utf8"));
  feedNow = JSON.parse(JSON.stringify(FEED));
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
  await standIn(ctx, new URL(BASE).origin);
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (e) => errors.push(`${site}: ${e.message}`));
  await openBoard(page, BASE, "solface");
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
  const before = await settled(page);
  const up = await openManager(page);
  await page.waitForSelector("[data-manager-orbs] [data-lanes-sun]", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(1000);
  const c = await box(page, col(C8.id)), o = await box(page, "[data-manager-orbs]"), t = await box(page, "[data-manager-terminal]"), m = await box(page, "[data-agents-manager]");
  await page.locator("[data-manager-term-input]").click().catch(() => {});
  await page.keyboard.type("words for the coordinator, Delete");
  await page.keyboard.press("Delete");
  await page.keyboard.press("Backspace");
  await page.locator("[data-manager-to-dock]").click().catch(() => {});
  await page.locator("[data-agents-button]").click().catch(() => {});
  await page.waitForTimeout(300);
  const after = await settled(page);
  check(`${site}: the column off the wall, the ring top right, the terminal under it`, up && !!c && !!o && !!t && c.x - m.x >= 40 && 1500 - o.r <= 30 && o.x > c.r && t.y >= o.b - 1, JSON.stringify({ c, o, t }));
  check(`${site}: typing in the terminal leaves the board as it was, to the pixel`, before === after && before.length > 10, `${before.length} ${after.length}`);
  await ctx.close();
}
if (SINK) {
  for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
    if (process.env.ONLY_SITE && process.env.ONLY_SITE !== site) continue;
    try { await onFixture(site); }
    catch (e) {
      check(`${site}: ran to the end`, false, String(e?.message ?? e).split("\n")[0]);
      await browser.close().catch(() => {});
      browser = await launch();
    }
  }
} else console.log("  --   the fixtures skipped: no fixtures folder given (argv 3 or SINK)");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close().catch(() => {});
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
