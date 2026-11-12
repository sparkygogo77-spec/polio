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
 *   24.   the coordinator reads as in the console: "C8 · 🧽 PIONEER";
 *   25.   each pane carries its area as a tag; a column can show one area; an orb wears a faint band in its area's colour;
 *   26.   an emoji sits on a light chip, one step larger than its words;
 *   27.   a chat's open question shows first, opened in place: the pane stretches down in its column (never over it);
 *         its terminal line is plain black with no placeholder and no name, one send mark at the far right, and a
 *         press on it shows the chat's previous messages above;
 *   28.   no "behind" or "built on" version words on any pane or orb;
 *   29-31. two and three live coordinators: a column each, oldest first, green, purple, amber (columns and rings);
 *   32.   the manager stands on the same nebula as the board (the workspace's own ground).
 *   33/34. a gone chat's open questions roll over to the current coordinator, as a pane with Continue (a press);
 *   36-39. the ring is the coordinator (no coordinator orb), named with its count; every orb named on hover with End; a legend;
 *   41.   the head's button has the count of its chat panes' questions and no "N new · N older"; the foot stays open; the
 *         memory pill always shows;
 *   42.   Delete on every question and picture round: gone at once, the count drops, a press;
 *   43/44. End on every chat (pane and orb): off the ring at once, a press; a working chat asks first;
 *   45.   a pressed cube is one wide column, pictures on its right half; New coordinator open under the terminal.
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
const STAGE = row(11, "Console stage", "work", { area: "Console", builtOn: 75, code: "STAGE", emoji: "🎛️", model: "Opus 5.5", effort: "medium", runBy: C8.id, history: [{ at: ago(90), text: "Started.", public: true }], note: "Building the side panel." });
const OSC = row(12, "Orbs speed check", "work", { area: "Tests", builtOn: 74, code: "OSC", emoji: "⏱️", model: "Opus 5.5", effort: "medium", runBy: C8.id, history: [{ at: ago(80), text: "Started.", public: true }], note: "Fixing the speed check." });
const TRYIT = row(13, "Blender as one button", "need", { area: "Blender", code: "TRYIT", emoji: "🧊", model: "Opus 5.5", effort: "medium", runBy: C8.id, history: [{ at: ago(200), text: "Started.", public: true }], note: "One Try it press." });
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
  checks: [], iterations: [{ id: "r-stage", lane: "console-stage", title: "Two looks of the side panel", options: [{ key: "a", label: "Slim", picture: "handovers/open/x/a.png" }, { key: "b", label: "Wide", picture: "handovers/open/x/b.png" }], pick: "a", chosen: "" }],
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

if (L?.readFeed && M?.coordLabel) {
  const C9 = row(9, "Coordinator 9", "work", { kind: "coordinator", lane: "coordinator-9", code: "NINE", emoji: "🛰️" });
  const C10 = row(10, "Coordinator 10", "work", { kind: "coordinator", lane: "coordinator-10", code: "TEN", emoji: "🧭" });
  const three = L.readFeed({ ...FEED, coordinators: [{ id: "c", name: "C", chats: [C10, C8, C9, STAGE, OSC, TRYIT] }] });
  const cols = M.columnsOf(three);
  check("24: a coordinator reads as in the console: number, emoji, code word", M.coordLabel(cols[0]) === "C8 · 🧽 PIONEER", M.coordLabel(cols[0]));
  check("29/31: three live coordinators are three columns, oldest first; the newest is still the current one", cols.map((c) => c.label).join() === "C8,C9,C10" && M.currentOf(cols)?.label === "C10" && cols[2].current, cols.map((c) => c.label).join());
  check("30: their colours by place: green, purple, amber", cols.map((c) => c.colours.outer).join() === "#2fd27a,#a06bff,#f2a51f", cols.map((c) => c.colours.outer).join());
  check("29: a chat with no runBy stands under the current (newest) one", cols[2].panes.length === 0 && cols[0].panes.length === 3, cols.map((c) => c.panes.length).join());
  const feed1 = L.readFeed(FEED);
  check("25: a chat's area is read, its colour known; the areas of a list counted in J's order", feed1.coordinators[0].chats.find((x) => x.id === STAGE.id).area === "Console" && M.areaColour({ area: "Console" }) === "#c084fc" && M.areasIn([{ area: "Tests" }, { area: "Console" }, { area: "Tests" }]).map((a) => `${a.area}:${a.count}`).join() === "Console:1,Tests:2");
  check("26: a label in parts, the emoji apart", JSON.stringify(M.labelParts({ name: "Console stage", code: "STAGE", emoji: "🎛️" })) === JSON.stringify({ emoji: "🎛️", words: "STAGE · Console stage" }));
}

const tmp = mkdtempSync(join(tmpdir(), "bam-manager-"));
if (HL?.pressLanes && HL?.forBuilder) {
  const served = HL.blankKeys(HL.forBuilder(FEED));
  check("1: the helper passes the coordinator's messages on", served.coordinators[0].chats[0].messages?.length === 3);
  check("25/28: the helper passes a chat's area, never its builtOn", served.coordinators[0].chats[1].area === "Console" && !("builtOn" in served.coordinators[0].chats[1]));
  const presses = join(tmp, "console-presses.json");
  const a = HL.pressLanes(presses, { kind: "say", target: C8.id, text: "  Hello\r\nthere  " });
  const b = HL.pressLanes(presses, { kind: "note", target: "q-try-1", text: "keep it" });
  const c = HL.pressLanes(presses, { kind: "new-chat", target: C8.id, text: "A brief" });
  const d = HL.pressLanes(presses, { kind: "say", target: C8.id, text: "   " });
  const e = HL.pressLanes(presses, { kind: "say", target: C8.id, text: "x".repeat(HL.MAX_SAY + 1) });
  const rows = JSON.parse(readFileSync(presses, "utf8"));
  check("9: say, note and new-chat presses are saved as words, one row each, from the Builder", a.ok && b.ok && c.ok && rows.length === 3 && rows[0].text === "Hello\nthere" && rows[0].kind === "say" && rows[0].from === "builder" && rows[1].target === "q-try-1" && rows[2].kind === "new-chat", JSON.stringify(rows));
  const g = HL.pressLanes(presses, { kind: "delete", target: "q-try-1" }), h = HL.pressLanes(presses, { kind: "end", target: STAGE.id }), i2 = HL.pressLanes(presses, { kind: "continue", target: "q-try-1" });
  const j2 = HL.pressLanes(presses, { kind: "new-coordinator", target: "new", mode: "carry", model: "Opus 5.5", effort: "medium", text: "" }), k2 = HL.pressLanes(presses, { kind: "new-coordinator", target: "new", mode: "odd", model: "Opus 5.5", effort: "medium" });
  const rows2 = JSON.parse(readFileSync(presses, "utf8"));
  check("42/43/34/45: the helper saves delete, end, continue and new-coordinator presses; a wrong mode is refused", g.ok && h.ok && i2.ok && j2.ok && !k2.ok && rows2.slice(-4).map((r) => r.kind).join() === "delete,end,continue,new-coordinator" && rows2[rows2.length - 1].mode === "carry", rows2.slice(-4).map((r) => r.kind).join());
  check("9: empty words or too many are refused, nothing saved", !d.ok && d.status === 400 && !e.ok && e.status === 400 && JSON.parse(readFileSync(presses, "utf8")).length === 7);
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

    /* 32: the board's own nebula behind the manager */
    const neb = await page.evaluate(() => { const n = document.querySelector("[data-manager-nebula]"), g = n?.querySelector("[data-workspace-ground]"); return { kind: n?.getAttribute("data-manager-nebula"), ground: !!g, clouds: g?.querySelector("[data-ground-clouds]")?.childElementCount ?? 0, own: n ? getComputedStyle(n).backgroundImage : "" }; });
    check("32: the manager stands on the board's own nebula (the workspace ground, drawn), not a background of its own", neb.kind === "workspace" && neb.ground && neb.clouds >= 1 && neb.own === "none", JSON.stringify(neb));

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
    check("11/41: one question button on the head with the count of its chat panes' questions, no words beside it, no '!n' pills", head.buttons === 1 && head.count === "3" /* mark 41: its chat panes' questions */ && head.pills === 0 && !head.words /* mark 41: no "N new · N older" */, JSON.stringify(head));
    await page.locator(`[data-manager-head="${C8.id}"] [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const groups = await page.evaluate(() => [...document.querySelectorAll("[data-manager-all-group]")].map((g) => `${g.getAttribute("data-manager-all-group")}:${[...g.querySelectorAll("[data-manager-all-row]")].map((r) => r.getAttribute("data-manager-all-row")).join("+")}`).join(" | "));
    check("11: it opens every open question, grouped: new since you last looked (newest first), then older carried over", groups === "new:q-try-2+q-own+q-try-1 | older:q-carried", groups);
    await page.locator('[data-manager-all-row="q-own"]').click();
    await page.waitForTimeout(300);
    const qAt = await page.locator("[data-manager-column-body] > [data-manager-question] [data-manager-question-at]").textContent().catch(() => "");
    const termQ = await page.locator("[data-manager-term-question]").getAttribute("data-manager-term-question").catch(() => null);
    const answerBtn = await page.locator('[data-manager-term-send="answer"]').count();
    check("9: a question opened from the list says where it is in that list, and the terminal answers it", /Question 2 of 3/.test(qAt ?? "") && termQ === "q-own" && answerBtn === 1, `${qAt} ${termQ} ${answerBtn}`);
    await page.locator("[data-manager-column-body] > article [data-manager-back]").first().click();
    await page.locator(`[data-manager-head="${C8.id}"] [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const groups2 = await page.evaluate(() => [...document.querySelectorAll("[data-manager-all-group]")].map((g) => g.getAttribute("data-manager-all-group")).join(" | "));
    check("11: once opened it is no longer new: it stands under its chat", /^new \| chat:/.test(groups2), groups2);
    await page.locator("[data-manager-column-body] > article [data-manager-back]").first().click();

    /* 20, 22: Private is on by default and shows badges only; names and models show with it off. */
    const privName = await page.locator(`${pane(STAGE.id)} [data-manager-name]`).textContent();
    check("22: with Private on (the default) a pane shows its badge only, never the plain name", privName === "🎛️ STAGE", privName);
    await page.locator("[data-manager-private]").click();
    await page.waitForTimeout(300);
    const panes = await page.evaluate(() => [...document.querySelectorAll("[data-manager-pane]")].map((p) => ({ id: p.getAttribute("data-manager-pane"), open: p.dataset.open, name: p.querySelector("[data-manager-name]")?.textContent, q: p.querySelector("[data-manager-pane-question] [data-manager-question-words]")?.textContent ?? p.querySelector("[data-manager-pane-question]")?.textContent, chip: p.querySelector("[data-manager-chip-open]")?.textContent })));
    const tp = panes.find((p) => p.id === TRYIT.id), sp = panes.find((p) => p.id === STAGE.id);
    check("20: every pane opens at its full size", panes.length >= 3 && panes.every((p) => p.open === "1"), panes.map((p) => p.open).join());
    check("20: a pane shows its newest question whole, never cut", tp?.q === LONG, tp?.q);
    check("20: the model chip reads the row's model and effort", /Opus 5\.5 · medium/.test(sp?.chip ?? ""), sp?.chip);
    check("22: the console's badge beside the plain name", sp?.name === "🎛️ STAGE · Console stage" && tp?.name === "🧊 TRYIT · Blender as one button", `${sp?.name} | ${tp?.name}`);
    const paneBtn = await page.evaluate((id) => document.querySelectorAll(`[data-manager-pane="${id}"] [data-manager-questions]`).length, TRYIT.id);
    /* 27: open first, in place, without a press; the column keeps its chats (nothing over it). */
    const inPlace = await page.evaluate(([id, c8]) => { const p = document.querySelector(`[data-manager-pane="${id}"]`), q = p?.querySelector('[data-manager-pane-question][data-in-place="1"]'), body = document.querySelector(`[data-manager-column="${c8}"] [data-manager-column-body]`);
      return { at: q?.querySelector("[data-manager-question-at]")?.textContent, chooses: q?.querySelectorAll("[data-manager-choose]").length, over: !!body?.querySelector(":scope > [data-manager-question]"), panes: body?.querySelectorAll("[data-manager-pane]").length, h: Math.round(p?.getBoundingClientRect().height ?? 0) }; }, [TRYIT.id, C8.id]);
    check("27: a chat's newest question is open first, in place on its pane (the pane stretches down), never over the column", /Question 1 of 2 · TRYIT/.test(inPlace.at ?? "") && inPlace.chooses === 2 && !inPlace.over && inPlace.panes >= 3 && inPlace.h > 250, JSON.stringify(inPlace));
    await page.locator(`${pane(TRYIT.id)} [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const folded = await page.locator(`${pane(TRYIT.id)} [data-in-place="1"]`).count();
    await page.locator(`${pane(TRYIT.id)} [data-manager-questions]`).click();
    await page.waitForTimeout(300);
    const qAt2 = await page.locator(`${pane(TRYIT.id)} [data-manager-question-at]`).textContent().catch(() => "");
    const termQ2 = await page.locator("[data-manager-term-question]").getAttribute("data-manager-term-question").catch(() => null);
    check("11/27: a pane's one question button folds its question and opens it again in place, counted in that chat only; the terminal answers it", paneBtn === 1 && folded === 0 && /Question 1 of 2 · TRYIT/.test(qAt2 ?? "") && termQ2 === "q-try-2", `${paneBtn} ${folded} ${qAt2} ${termQ2}`);
    await page.locator(`${pane(TRYIT.id)} [data-manager-next]`).click();
    await page.waitForTimeout(200);
    const stepped = await page.locator(`${pane(TRYIT.id)} [data-manager-question-at]`).textContent().catch(() => "");
    await page.locator(`${pane(TRYIT.id)} [data-manager-prev]`).click();
    await page.waitForTimeout(200);
    check("27: Next and Prev step through that chat's questions inside its pane", /Question 2 of 2 · TRYIT/.test(stepped ?? ""), stepped);

    /* 24, 25, 26, 28 */
    const named = await page.evaluate(([c8, st]) => {
      const h = document.querySelector(`[data-manager-head="${c8}"] [data-manager-head-name]`), p = document.querySelector(`[data-manager-pane="${st}"]`), e = p.querySelector("[data-manager-name] [data-manager-emoji]"), n = p.querySelector("[data-manager-name]");
      const bg = e ? getComputedStyle(e).backgroundColor : "", m = bg.match(/rgba?\(([\d.]+), ([\d.]+), ([\d.]+)(?:, ([\d.]+))?\)/);
      return { head: h?.getAttribute("data-manager-coord-label"), headText: h?.textContent, light: !!m && (+m[1] + +m[2] + +m[3]) / 3 > 200 && (m[4] === undefined || +m[4] > 0.6), bigger: !!e && parseFloat(getComputedStyle(e).fontSize) > parseFloat(getComputedStyle(n).fontSize), area: p.querySelector("[data-manager-area]")?.textContent };
    }, [C8.id, STAGE.id]);
    check("24: the head reads as in the console: C8 · 🧽 PIONEER, not Coordinator 8", named.head === "C8 · 🧽 PIONEER" && named.headText === "🧽 PIONEER", JSON.stringify(named));
    check("26: the emoji sits on a light chip, one step larger than its words", named.light && named.bigger, JSON.stringify(named));
    check("25: each pane carries its area as a tag", named.area === "Console", named.area);
    const filters = await page.locator(`${col(C8.id)} [data-manager-area-pick]`).count();
    await page.locator(`${col(C8.id)} [data-manager-area-pick="Blender"]`).click();
    await page.waitForTimeout(200);
    const onlyB = await page.evaluate((c) => [...document.querySelectorAll(`[data-manager-column="${c}"] [data-manager-pane]`)].map((p) => p.getAttribute("data-manager-pane")), C8.id);
    await page.locator(`${col(C8.id)} [data-manager-area-pick="all"]`).click();
    await page.waitForTimeout(200);
    const allBack = await page.locator(`${col(C8.id)} [data-manager-pane]`).count();
    check("25: the column shows one area at a press, and all again", filters >= 4 && onlyB.join() === TRYIT.id && allBack >= 4, `${filters} ${onlyB.join()} ${allBack}`);
    const band = await page.evaluate((id) => document.querySelector(`[data-manager-orbs] [data-lanes-orb="${id}"] [data-lanes-area]`)?.getAttribute("stroke"), STAGE.id);
    check("25: on the ring an orb wears a faint band in its area's colour", band === "#c084fc", band);
    const version = await page.evaluate(() => [...document.querySelectorAll("[data-manager-pane], [data-manager-orbs] [data-lanes-orb]")].map((e) => `${e.textContent} ${e.getAttribute("aria-label") ?? ""}`).join(" "));
    check("28: no version words on any pane or orb (no 'behind', no 'built on')", !/behind:? ?\d|built on/i.test(version), (version.match(/behind:? ?\d|built on/i) ?? [""])[0]);

    /* 27: the pane's terminal line */
    const line = await page.evaluate((id) => { const b = document.querySelector(`[data-manager-pane="${id}"] [data-manager-bar]`), i = b.querySelector("[data-manager-say]"), s = b.querySelectorAll("[data-manager-say-send]"), br = b.getBoundingClientRect(), sr = s[0]?.getBoundingClientRect();
      return { bg: getComputedStyle(b).backgroundColor, ph: i.getAttribute("placeholder") ?? "", sends: s.length, right: sr ? Math.round(br.right - sr.right) : -1, words: b.textContent.replace(/[›➤\s]/g, "") }; }, STAGE.id);
    check("27: the pane's line is plain black, no placeholder words, no name, one send mark at the far right", line.bg === "rgb(0, 0, 0)" && line.ph === "" && line.sends === 1 && line.right >= 0 && line.right <= 6 && line.words === "", JSON.stringify(line));
    const pastBefore = await page.locator(`${pane(STAGE.id)} [data-manager-pane-past]`).count();
    await page.locator(`${pane(STAGE.id)} [data-manager-say]`).click();
    await page.waitForTimeout(200);
    const past = await page.evaluate((id) => { const pp = document.querySelector(`[data-manager-pane="${id}"] [data-manager-pane-past]`), b = document.querySelector(`[data-manager-pane="${id}"] [data-manager-bar]`); return pp ? { n: pp.children.length, above: pp.getBoundingClientRect().bottom <= b.getBoundingClientRect().top + 1 } : null; }, STAGE.id);
    check("27: pressing the line shows that chat's previous messages above it", pastBefore === 0 && past?.n >= 1 && past.above, JSON.stringify(past));
    await page.keyboard.type("Go on with 0.26");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(400);
    const said = posts.find((x) => x.kind === "say" && x.target === STAGE.id);
    check("27: Enter on the line saves the words for that chat (read on its next turn)", said?.text === "Go on with 0.26", JSON.stringify(said));

    /* 1, 9 */
    const nc = await box(page, "[data-manager-new-coord]");
    check("9/45: the terminal sits under the ring, New coordinator open under it to the bottom", !!term && !!nc && term.y >= orbs.b - 1 && Math.abs(term.x - orbs.x) <= 2 && nc.y >= term.b - 1 && body.b - nc.b <= 16 && term.h >= 150, JSON.stringify({ term, nc }));
    const lines = await page.evaluate(() => [...document.querySelectorAll("[data-manager-term-line]")].map((l) => `${l.getAttribute("data-manager-term-line")}:${l.textContent}`));
    check("1: the coordinator's messages in line, oldest above newest, named by its badge", lines.length === 3 && /First/.test(lines[0]) && /Third/.test(lines[2]) && /PIONEER/.test(lines[0]) && (await page.locator("[data-manager-term-name]").textContent()) === "C8 · 🧽 PIONEER", lines.join(" | "));
    const term1 = page.locator("[data-manager-term-input]");
    await term1.click();
    await page.keyboard.type("A note on this");
    await page.locator('[data-manager-term-send="note"]').click();
    await page.waitForTimeout(400);
    const note = posts.find((p) => p.path === "/lanes/press" && p.kind === "note");
    check("9: Note saves the words on the open question", note?.target === "q-try-2" && note.text === "A note on this", JSON.stringify(note));
    await page.locator(`${pane(TRYIT.id)} [data-manager-back]`).click();
    await page.waitForTimeout(200);
    await term1.click();
    await page.keyboard.type("Hello C8");
    await page.keyboard.press("Shift+Enter");
    await page.keyboard.type("second line, then Backspace and Delete: x");
    await page.keyboard.press("Backspace");
    await page.keyboard.press("Delete");
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
    const say = posts.find((p) => p.path === "/lanes/press" && p.kind === "say" && p.target === C8.id);
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
    /* ---------------- turn 4: marks 36 to 45, then 33 and 34 ---------------- */
    const ringNow = await page.evaluate((c8) => ({ coordOrb: document.querySelectorAll(`[data-manager-orbs] [data-lanes-orb="${c8}"]`).length, name: document.querySelector(`[data-lanes-ring-name="${c8}"]`)?.textContent, count: document.querySelector(`[data-lanes-ring-name="${c8}"]`)?.getAttribute("data-count"), own: document.querySelector(`[data-lanes-ring="${c8}"]`)?.getAttribute("data-own"), outer: document.querySelector(`[data-manager-column="${c8}"]`)?.getAttribute("data-outer"), legend: [...document.querySelectorAll("[data-manager-legend-item]")].map((e) => e.textContent).join(" · ") }), C8.id);
    check("36/39: the ring is the coordinator: no coordinator orb on it; it is always named, with its question count", ringNow.coordOrb === 0 && /^C8 · 🧽 PIONEER/.test(ringNow.name ?? "") && ringNow.count === "3", JSON.stringify(ringNow));
    check("37: the ring wears the coordinator's colour (its column's)", !!ringNow.own && ringNow.own === ringNow.outer, `${ringNow.own} ${ringNow.outer}`);
    check("38: a legend under the ring: working, waiting for you, done", ringNow.legend === "working · waiting for you · done", ringNow.legend);
    await page.locator(`[data-lanes-ring-name="${C8.id}"]`).dispatchEvent("mouseover", { bubbles: true });
    await page.waitForTimeout(250);
    const ringCard = await page.locator('[data-manager-orb-card="ring"]').textContent().catch(() => "");
    check("36: hovering the ring's name shows the coordinator", /C8 · 🧽 PIONEER/.test(ringCard ?? "") && /the coordinator/.test(ringCard ?? ""), ringCard);
    await page.locator(`[data-manager-orbs] [data-lanes-hit="${STAGE.id}"]`).hover({ force: true });
    await page.waitForTimeout(250);
    const card = await page.locator(`[data-manager-orb-card="${STAGE.id}"]`).textContent().catch(() => "");
    check("38/43: an orb under the pointer is named (emoji, code, state), with End", /🎛️ STAGE · Console stage/.test(card ?? "") && /working/.test(card ?? "") && (await page.locator(`[data-manager-orb-end="${STAGE.id}"]`).count()) === 1, card);
    await page.mouse.move(5, 500);

    /* 41: the foot open, the pill always shown */
    const f41 = await page.evaluate((c8) => ({ foot: document.querySelector(`[data-manager-foot="${c8}"]`)?.getAttribute("data-open"), empty: document.querySelectorAll("[data-manager-pane] [data-manager-pill][data-empty]").length, panes: document.querySelectorAll("[data-manager-pane]").length }), C8.id);
    check("41: finished chats stay in view in the column (the foot open), and every pane shows its memory pill", f41.foot === "1" && f41.empty === f41.panes && f41.panes >= 4, JSON.stringify(f41));

    /* 42: Delete a question, a round */
    const countBefore = await page.locator(`[data-manager-head="${C8.id}"] [data-manager-questions]`).getAttribute("data-manager-questions");
    if (!(await page.locator(`${pane(TRYIT.id)} [data-in-place="1"]`).count())) await page.locator(`${pane(TRYIT.id)} [data-manager-questions]`).click();
    await page.waitForTimeout(200);
    await page.locator(`${pane(TRYIT.id)} [data-manager-delete="q-try-2"]`).click();
    await page.waitForTimeout(400);
    const del = await page.evaluate(([t, c8]) => ({ gone: !document.querySelector('[data-manager-question="q-try-2"]'), next: document.querySelector(`[data-manager-pane="${t}"] [data-manager-question]`)?.getAttribute("data-manager-question"), count: document.querySelector(`[data-manager-head="${c8}"] [data-manager-questions]`)?.getAttribute("data-manager-questions") }), [TRYIT.id, C8.id]);
    const delPress = posts.find((x) => x.kind === "delete" && x.target === "q-try-2");
    check("42: Delete on a question: gone at once, the chat's next question shows, the count drops, a delete press is saved", del.gone && del.next === "q-try-1" && countBefore === "3" && del.count === "2" && !!delPress, JSON.stringify({ ...del, countBefore, delPress }));
    await page.locator(`${pane(STAGE.id)} [data-manager-cube]`).click();
    await page.waitForTimeout(300);
    const wide = await page.evaluate((c8) => { const c = document.querySelector(`[data-manager-column="${c8}"]`), r = document.querySelector('[data-manager-round="r-stage"]'), w = r?.querySelector("[data-manager-round-words]")?.getBoundingClientRect(), pc = r?.querySelector("[data-manager-round-pictures]")?.getBoundingClientRect(), rr = r?.getBoundingClientRect();
      return { wide: c?.getAttribute("data-wide"), w: Math.round(c?.getBoundingClientRect().width ?? 0), right: !!w && !!pc && pc.left >= w.right - 1 && pc.left >= rr.left + rr.width * 0.45, pics: r?.querySelectorAll("[data-manager-round-pictures] img").length, chooses: r?.querySelectorAll("[data-manager-round-choose]").length }; }, C8.id);
    check("45: a pressed cube is one wide column: the round's choices on the left, its pictures on the right half", wide.wide === "1" && wide.w > 700 && wide.right && wide.pics === 2 && wide.chooses === 2, JSON.stringify(wide));
    await page.locator('[data-manager-round="r-stage"] [data-manager-delete="r-stage"]').click();
    await page.waitForTimeout(300);
    check("42: Delete on a picture round: gone at once, a delete press is saved", (await page.locator('[data-manager-round="r-stage"]').count()) === 0 && posts.some((x) => x.kind === "delete" && x.target === "r-stage"));
    await page.locator("[data-manager-column-body] > article [data-manager-back]").first().click().catch(() => {});
    await page.waitForTimeout(200);

    /* 43/44: End a working chat asks first; End a waiting one at once; 33/34: its questions roll over */
    await page.locator(`${pane(OSC.id)} [data-manager-end="${OSC.id}"]`).click();
    await page.waitForTimeout(200);
    const ask = await page.locator("[data-manager-end-confirm]").textContent().catch(() => "");
    await page.locator("[data-manager-end-keep]").click();
    await page.waitForTimeout(200);
    const kept1 = (await page.locator(`[data-manager-orbs] [data-lanes-orb="${OSC.id}"]`).count()) === 1 && !posts.some((x) => x.kind === "end");
    check("44: ending a chat that is working asks once first; Keep it leaves it", /End ⏱️ OSC · Orbs speed check\? It is working now\./.test(ask ?? "") && kept1, ask);
    await page.locator(`${pane(OSC.id)} [data-manager-end="${OSC.id}"]`).click();
    await page.locator("[data-manager-end-sure]").click();
    await page.waitForTimeout(400);
    const ended = await page.evaluate((id) => ({ orb: document.querySelectorAll(`[data-manager-orbs] [data-lanes-orb="${id}"]`).length, pane: document.querySelectorAll(`[data-manager-pane="${id}"]`).length }), OSC.id);
    check("43: End: the orb leaves the ring and the pane the column at once; an end press is saved", ended.orb === 0 && ended.pane === 0 && posts.some((x) => x.kind === "end" && x.target === OSC.id), JSON.stringify(ended));
    await page.locator(`${pane(TRYIT.id)} [data-manager-end="${TRYIT.id}"]`).click();
    await page.waitForTimeout(400);
    const carried = await page.evaluate(([c8]) => { const c = document.querySelector(`[data-manager-column="${c8}"] [data-manager-carried="q-try-1"]`); return c ? { from: c.textContent?.includes("Carried from 🧊 TRYIT"), q: !!c.querySelector('[data-manager-question="q-try-1"]'), count: document.querySelector(`[data-manager-head="${c8}"] [data-manager-questions]`)?.getAttribute("data-manager-questions") } : null; }, [C8.id]);
    check("33: a chat that ends with an open question: the question rolls over to the coordinator, shown in its column", posts.some((x) => x.kind === "end" && x.target === TRYIT.id) && !!carried?.from && carried.q && carried.count === "2", JSON.stringify(carried));
    await page.locator('[data-manager-continue="q-try-1"]').click();
    await page.waitForTimeout(300);
    check("34: the carried question has Continue: a continue press is saved for the coordinator to start a chat", posts.some((x) => x.kind === "continue" && x.target === "q-try-1"));

    /* 45: New coordinator */
    await page.locator("[data-manager-new-coord-text]").click();
    await page.keyboard.type("Carry on from C8");
    await page.locator('[data-manager-new-coord-mode="fresh"]').click();
    await page.locator('[data-manager-new-coord-model="Fable 5.2"]').click();
    await page.locator("[data-manager-new-coord-start]").click();
    await page.waitForTimeout(300);
    const ncp = posts.find((x) => x.kind === "new-coordinator");
    check("45: New coordinator saves its press: mode, words, model and effort", ncp?.mode === "fresh" && ncp.text === "Carry on from C8" && ncp.model === "Fable 5.2" && ncp.effort === "medium", JSON.stringify(ncp));

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

  /* 29 to 31: two and three live coordinators, at two widths each. */
  for (const n of [2, 3]) {
    const extra = [row(9, "Coordinator 9", "work", { kind: "coordinator", lane: "coordinator-9", code: "NINE", emoji: "🛰️", messages: [{ at: ago(1), text: "Nine here." }] }), row(10, "Coordinator 10", "work", { kind: "coordinator", lane: "coordinator-10", code: "TEN", emoji: "🧭", messages: [{ at: ago(1), text: "Ten here." }] })].slice(0, n - 1);
    feedNow = JSON.parse(JSON.stringify(FEED));
    feedNow.coordinators[0].chats.push(...extra);
    const cx = await browser.newContext({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
    await standIn(cx, origin);
    const pg = await cx.newPage();
    pg.on("pageerror", (e) => errors.push(`${n} coordinators: ${e.message}`));
    await openBoard(pg, BASE, "solface");
    if (!(await openManager(pg))) { check(`29: ${n} coordinators: the manager opens`, false); await cx.close(); continue; }
    await pg.waitForFunction((k) => document.querySelectorAll("[data-manager-column]").length === k, n, { timeout: 15000 }).catch(() => {});
    for (const w of [1500, 1900]) {
      await pg.setViewportSize({ width: w, height: 950 });
      await pg.waitForTimeout(600);
      const got = await pg.evaluate(() => {
        const cs = [...document.querySelectorAll("[data-manager-column]")], rail = document.querySelector("[data-manager-rail]").getBoundingClientRect();
        const rs = cs.map((c) => c.getBoundingClientRect());
        return { labels: cs.map((c) => c.getAttribute("data-label")).join(), outer: cs.map((c) => c.getAttribute("data-outer")).join(), border: cs.map((c) => getComputedStyle(c).borderTopColor).join("|"),
          rings: cs.map((c) => document.querySelector(`[data-lanes-ring="${c.getAttribute("data-manager-column")}"]`)?.getAttribute("data-own")).join(),
          side: rs.every((r, i) => i === 0 || r.left >= rs[i - 1].right) && rs[rs.length - 1].right <= rail.left + 1 && rail.right <= innerWidth + 1 && rs.every((r) => r.width >= 299),
          term: document.querySelector("[data-manager-term-name]")?.textContent, current: cs.find((c) => c.getAttribute("data-current") === "1")?.getAttribute("data-label"),
          over: document.documentElement.scrollWidth > innerWidth + 1 };
      });
      const labels = ["C8", "C9", "C10"].slice(0, n).join(), outer = ["#2fd27a", "#a06bff", "#f2a51f"].slice(0, n).join();
      const newest = n === 2 ? "C9 · 🛰️ NINE" : "C10 · 🧭 TEN";
      check(`29-31: ${n} coordinators at ${w} px: a column each, oldest first, side by side with the rail, nothing over`, got.labels === labels && got.side && !got.over, JSON.stringify(got));
      check(`30: ${n} coordinators at ${w} px: green, purple${n === 3 ? ", amber" : ""} in that order, columns and rings alike`, got.outer === outer && got.rings === outer, `${got.outer} | ${got.rings}`);
      check(`29: ${n} coordinators at ${w} px: the terminal talks to the newest (current) one`, got.term === newest && got.current === labels.split(",").pop(), `${got.term} ${got.current}`);
    }
    await cx.close();
  }
  feedNow = JSON.parse(JSON.stringify(FEED));

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
