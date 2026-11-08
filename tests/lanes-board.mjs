#!/usr/bin/env node
/**
 * THE LANES BOARD (J, 2026-11-01/03): every chat working for J, in the
 * Agents dock's first tab, read from handovers/lanes.json plus the hooks'
 * heartbeats. Round B (Gyro4, J picked B1): no nucleus, the finished chats are
 * the middle; rings tumble slowly while their coordinator works.
 *
 *   1. pure: the feed's states, a heartbeat turning a chat blue, the ring's
 *      colour rule, its size step, axis and speed, the 48 pieces with their
 *      depth, colours that drift, the laps' ease, the three middles;
 *   2. the helper's GET /lanes: the Builder's origin reads it, nothing else
 *      does, and it is still all the Builder page can reach;
 *   3. the route serves the file it is pointed at;
 *   4. in the Builder, on a fixture of three coordinators (one all done, one
 *      working, one needing J): ring and orb counts and colours, sizes and
 *      tumbling, one depth-sorted scene, the decisions line in the menu, a
 *      click that tumbles whole turns, hover showing the right name in the menu
 *      and the chat box, a lap when a chat is sent a message and its going to
 *      the middle when it answers, the helper's frame still in the second tab,
 *      a real saved site that doesn't move, no page errors.
 *
 *   LANES_FILE=tests/fixtures/lanes.json LANES_BEATS=tests/fixtures/no-beats npx next start -p 3421
 *   node tests/lanes-board.mjs http://127.0.0.1:3421
 */
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3421").replace(/\/$/, "");
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const FIXTURE = JSON.parse(readFileSync(new URL("./fixtures/lanes.json", import.meta.url), "utf8"));
const [A, B, C] = FIXTURE.coordinators;
const close = (a, b, by = 0.6) => Math.abs(a - b) <= by;

/* 1. Pure. */
let L = null;
try { L = await import("../src/features/agents/lanes.ts"); } catch (e) { check("the board's pure module loads", false, String(e?.message ?? e).slice(0, 120)); }
if (L) {
  const feed = L.readFeed(FIXTURE);
  check("the feed reads: three coordinators, ten chats, two decisions", feed?.coordinators.length === 3 && feed.coordinators.flatMap((c) => c.chats).length === 10 && feed.decisions === 2);
  check("what isn't a feed is refused", L.readFeed(null) === null && L.readFeed({ coordinators: "x" }) === null);
  check("a chat in a state it doesn't know is left out, not guessed", L.readFeed({ coordinators: [{ id: "c", chats: [{ id: "x", state: "busy" }] }] }).coordinators[0].chats.length === 0);
  check("with no decisions given, it counts the red chats", L.readFeed({ coordinators: FIXTURE.coordinators }).decisions === 2);
  const [a, b, c] = feed.coordinators;
  const ring = (...xs) => L.ringState({ chats: xs.map((state) => ({ state })) });
  check("a ring is red if even one chat waits on J", L.ringState(c) === "need" && ring("done", "done", "need") === "need" && ring("work", "need") === "need");
  check("…green only when every chat is done", L.ringState(a) === "done" && ring("done", "park") === "park" && ring("done", "work") === "work");
  check("…blue when one works and nothing stops it, grey otherwise", L.ringState(b) === "work" && ring("park") === "park" && ring("park", "done") === "park");
  const now = 1_000_000_000;
  const state = (f, id) => f.coordinators.flatMap((x) => x.chats).find((x) => x.id === id).state;
  const form = B.chats[3], hard = A.chats[0], em = C.chats[0];
  check("a beat under 2 minutes old turns a parked chat blue, by session", state(L.withBeats(feed, [{ session: form.id, name: "", at: now - 60_000 }], now), form.id) === "work");
  check("…and by lane name, however it is written", state(L.withBeats(feed, [{ session: "x", name: "form-backend", at: now - 1000 }], now), form.id) === "work");
  const named = L.readFeed({ coordinators: [{ id: "c", chats: [{ id: "x1", name: "Forms on exported sites", lane: "form-backend", state: "park" }, { id: "x2", name: "Form backend", lane: "other-lane", state: "park" }] }] });
  const beatNamed = L.withBeats(named, [{ session: "x", name: "form-backend", at: now }], now);
  check("a chat's lane is what a beat matches, so its name can be the words J reads", state(beatNamed, "x1") === "work");
  check("…and its name isn't matched when it has a lane", state(beatNamed, "x2") === "park");
  check("an old beat doesn't", state(L.withBeats(feed, [{ session: form.id, name: "", at: now - 121_000 }], now), form.id) === "park");
  check("a chat that needs J stays red while it works", state(L.withBeats(feed, [{ session: em.id, name: "", at: now }], now), em.id) === "need");
  check("a done chat at work again is blue", state(L.withBeats(feed, [{ session: hard.id, name: "", at: now }], now), hard.id) === "work");
  check("the chat link holds only an id", L.chatLink(hard.id) === `claude://claude.ai/epitaxy/${hard.id}` && L.chatLink("https://evil.test/x") === null && L.chatLink("a/../b1234567") === null);
  check("a lap: 0 and 1 are the front, 0.5 the back", close(Math.sin(L.lapAngle(0)), 1, 1e-9) && close(Math.sin(L.lapAngle(1)), 1, 1e-9) && close(Math.sin(L.lapAngle(0.5)), -1, 1e-9));
  check("seen from a little above: a flat ring is a thin ellipse, its front nearer", close(L.ringPoint(200, Math.PI / 2, 0, 0).y, 200 * Math.sin((22 * Math.PI) / 180), 1e-6) && L.ringPoint(200, Math.PI / 2, 0, 0).z > 0 && L.ringPoint(200, -Math.PI / 2, 0, 0).z < 0);
  check("each ring a step further out (+24), growing with the share done", L.radiusOf(0, 0) === 150 && L.radiusOf(1, 0) === 300 && L.radiusOf(0.5, 2) === 273);
  check("each ring on its own axis, 55° apart", L.axisOf(0) === -55 && L.axisOf(1) === 0 && L.axisOf(2) === 55);
  check("a working ring tumbles, slower the more is done, each its own speed; a done one doesn't", L.tumbleSpeed(0, 0) === 8 && L.tumbleSpeed(0.5, 0) === 4 && L.tumbleSpeed(0, 2) > L.tumbleSpeed(0, 1) && L.tumbleSpeed(1, 1) === 0);
  check("no two rings set off in line", new Set([0, 1, 2, 3].map((i) => L.startTilt(i) % 360)).size === 4);
  const segs = L.ringSegments(200, 40, 20);
  check("a ring is 48 pieces, each with its own depth, some near and some far", segs.length === 48 && segs.every((x) => /^M[-\d. ]+L[-\d. ]+$/.test(x.d)) && segs.some((x) => x.z > 0) && segs.some((x) => x.z < 0));
  check("the tumble is three whole turns, eased, and ends where it began", L.tumbleAt(0) === 0 && L.tumbleAt(1) === 1080 && L.tumbleAt(0.1) > L.tumbleAt(0.05) && L.ringSegments(200, 40 + L.tumbleAt(1), 20).every((x, k) => x.d === segs[k].d));
  check("colours drift 4% every 25 ms, never snapping", close(L.driftShare(0.025), 0.04, 1e-9) && close(L.driftShare(0.05), 1 - 0.96 * 0.96, 1e-9) && L.driftShare(0) === 0);
  const red = L.ringTarget("need", 0, 0);
  check("a ring breathes towards a lighter shade of its own colour, a little", red[0] === 255 && red[1] >= 77 && red[1] < 77 + 0.08 * 63 + 1e-9);
  check("a lap is one ease over its message: 5% out, the back halfway, home", close(L.lapPos(0), 0.05, 1e-9) && close(L.lapPos(0.5), 0.525, 1e-9) && L.lapPos(1) === 1 && L.lapPos(0.2) - L.lapPos(0.1) < L.lapPos(0.5) - L.lapPos(0.4));
  check("…and while the chat thinks it waits round the back", L.thinkingShare(0) === 0 && L.thinkingShare(1e6) <= 0.5 && L.thinkingShare(30) > 0.49);
  const ring5 = [0, 1, 2, 3, 4].map((k) => L.centreAt(L.ROUNDS.B1, k, 5, 3));
  check("B1's middle: the finished chats spin on a circle round the middle, evenly spaced", ring5.every((p) => close(Math.hypot(p.x, p.z * Math.cos((22 * Math.PI) / 180) + p.y * Math.sin((22 * Math.PI) / 180)), 78, 8)) && ring5.every((p, i) => ring5.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 20)));
  check("…turning with time", L.centreAt(L.ROUNDS.B1, 0, 5, 0).x !== L.centreAt(L.ROUNDS.B1, 0, 5, 2).x);
  check("B2 and B3 are there as options: dragon balls and a pool rack", L.ROUNDS.B2.centre === "dragon" && L.ROUNDS.B3.centre === "rack" && Number.isFinite(L.centreAt(L.ROUNDS.B2, 4, 6, 1).x) && close(L.centreAt(L.ROUNDS.B3, 1, 3, 0).x, -29, 1e-6) && close(L.centreAt(L.ROUNDS.B3, 2, 3, 0).x, 29, 1e-6));
}

/* 2. The helper's door. */
try {
  const Sv = await import("../helper/server/server.ts");
  const { Pairing } = await import("../helper/server/pairing.ts");
  const dir = mkdtempSync(join(tmpdir(), "lanes-"));
  mkdirSync(join(dir, "beats"));
  writeFileSync(join(dir, "lanes.json"), JSON.stringify(FIXTURE));
  writeFileSync(join(dir, "beats", "abc.json"), JSON.stringify({ name: "form-backend", at: Date.now() }));
  writeFileSync(join(dir, "beats", "old.json"), JSON.stringify({ name: "gone", at: Date.now() - 3600_000 }));
  writeFileSync(join(dir, "beats", "torn.json"), "{");
  const runner = { subscribe: () => () => {}, snapshot: () => [], submit: async () => ({}), control: async () => ({ ok: true }) };
  const helper = await Sv.startHelperServer({ runner, pairing: new Pairing({ show() {} }), port: 0, lanes: { file: join(dir, "lanes.json"), beats: join(dir, "beats") } });
  const call = (path, origin, method = "GET") => new Promise((resolve, reject) => {
    const req = request({ host: "127.0.0.1", port: helper.port, path, method, headers: origin ? { origin } : {} }, (res) => {
      let t = ""; res.on("data", (c) => (t += c)); res.on("end", () => { let json = null; try { json = JSON.parse(t); } catch {} resolve({ status: res.statusCode, cors: res.headers["access-control-allow-origin"], json }); });
    });
    req.on("error", reject); req.end();
  });
  const ok = await call("/lanes", Sv.BUILDER_ORIGIN);
  check("the Builder's origin reads the feed from the helper, with CORS for it alone", ok.status === 200 && ok.cors === Sv.BUILDER_ORIGIN && ok.json?.feed?.coordinators?.length === 3, JSON.stringify({ s: ok.status, c: ok.cors }));
  check("…and the fresh beats, not the old or torn ones", ok.json?.beats?.length === 1 && ok.json.beats[0].session === "abc" && ok.json.beats[0].name === "form-backend", JSON.stringify(ok.json?.beats));
  check("another origin is refused", (await call("/lanes", "https://evil.test")).status === 403);
  check("no origin is refused", (await call("/lanes", null)).status === 403);
  check("the Builder can't write to it", (await call("/lanes", Sv.BUILDER_ORIGIN, "POST")).status === 403);
  check("the Builder still can't reach a control", (await call("/control", Sv.BUILDER_ORIGIN, "POST")).status === 403 && (await call("/stream", Sv.BUILDER_ORIGIN)).status === 403);
  await helper.close();
  const bare = await Sv.startHelperServer({ runner, pairing: new Pairing({ show() {} }), port: 0 });
  await bare.close();
  check("a helper with no files still starts", true);
} catch (e) { check("the helper's door", false, String(e?.message ?? e).slice(0, 200)); }

/* 3. The route, on the server the header asks for. */
const routed = await fetch(`${BASE}/api/lanes`).then((r) => (r.ok ? r.json() : null)).catch(() => null);
check("/api/lanes serves the file it is pointed at", routed?.feed?.coordinators?.[0]?.id === A.id && Array.isArray(routed?.beats), JSON.stringify(routed)?.slice(0, 100));

/* 4. In the Builder. The helper is stubbed and the feed can change under a poll. */
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
let feedNow = JSON.parse(JSON.stringify(FIXTURE));
await ctx.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: feedNow, beats: [], now: Date.now() }) }));
await ctx.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", headers: { "access-control-allow-origin": "*" }, body: "<!doctype html><title>dock stub</title><body>dock" }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.waitForSelector("[data-agents-button]", { timeout: 30000 }).catch(() => {});
await page.locator("[data-agents-button]").click().catch(() => {});
await page.waitForSelector("[data-lanes-orb]", { timeout: 15000 }).catch(() => {});
check("the Agents button opens on the board, the dock's first tab", (await page.locator("[data-lanes-board]").count()) === 1 && (await page.locator('[data-agents-tab="chats"]').getAttribute("aria-selected").catch(() => null)) === "true");

const read = () => page.evaluate(() => ({
  rings: Object.fromEntries([...document.querySelectorAll("[data-lanes-ring]")].map((e) => [e.getAttribute("data-lanes-ring"), { state: e.dataset.state, target: e.dataset.target, colour: e.dataset.colour, r: Number(e.dataset.r), tilt: Number(e.dataset.tilt), speed: Number(e.dataset.speed), spin: Number(e.dataset.spin) }])),
  orbs: Object.fromEntries([...document.querySelectorAll("[data-lanes-orb]")].map((e) => [e.getAttribute("data-lanes-orb"), { state: e.dataset.state, target: e.dataset.target, colour: e.dataset.colour, z: Number(e.dataset.z), scale: Number(e.dataset.scale), share: Number(e.dataset.share), x: Number(e.dataset.x), y: Number(e.dataset.y), fill: e.querySelectorAll("circle")[1]?.getAttribute("fill") }])),
  segs: [...document.querySelectorAll("[data-ring-seg]")].length,
  menu: document.querySelector("[data-lanes-menu-name]")?.textContent,
  decisions: document.querySelector("[data-lanes-decisions]")?.textContent,
  box: document.querySelector("[data-lanes-box]")?.getAttribute("data-lanes-box") ?? null,
}));
const until = async (test, ms = 8000) => { const end = Date.now() + ms; let s = await read(); while (Date.now() < end && !test(s)) { await page.waitForTimeout(100); s = await read(); } return s; };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgbOf = (t) => (t?.match(/\d+/g) ?? []).map(Number);
const near = (colour, target, by = 40) => { const a = rgbOf(colour), b = hex(target ?? "#000000"); return a.length === 3 && Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]) < by; };

const COL = { need: "#ff4d4d", work: "#35c8ff", done: "#3dffae", park: "#6f7f99" };
const allChats = FIXTURE.coordinators.flatMap((c) => c.chats);
let s = await until((x) => x.rings[A.id] && close(x.rings[B.id].r, 211.5, 0.5) && near(x.rings[C.id].colour, COL.need, 30), 10000);
check("one ring per coordinator, 48 pieces each", Object.keys(s.rings).length === 3 && s.segs === 144, `${Object.keys(s.rings).length} rings, ${s.segs} pieces`);
check("one orb per chat", Object.keys(s.orbs).length === allChats.length, String(Object.keys(s.orbs).length));
check("no nucleus", (await page.locator("[data-lanes-nucleus]").count()) === 0);
check("orbs head for their state's colour", allChats.every((c) => s.orbs[c.id]?.target === COL[c.state] && near(s.orbs[c.id].colour, COL[c.state]) && s.orbs[c.id].fill === s.orbs[c.id].colour));
check("rings: green all done, blue working, red one waits on J", s.rings[A.id]?.target === COL.done && s.rings[B.id]?.target === COL.work && s.rings[C.id]?.target === COL.need && [A, B, C].every((c) => near(s.rings[c.id].colour, s.rings[c.id].target)), JSON.stringify([A, B, C].map((c) => s.rings[c.id]?.colour)));
check("each ring its own size: grown by its share done, a step out from the last", close(s.rings[A.id].r, 300, 0.5) && close(s.rings[B.id].r, 211.5, 0.5) && close(s.rings[C.id].r, 198, 0.5), JSON.stringify([A, B, C].map((c) => s.rings[c.id].r)));
check("the decisions waiting are a line in the menu", s.decisions === "2 decisions wait on you", s.decisions);

const t1 = await read(); await page.waitForTimeout(1500); const t2 = await read();
check("working rings tumble end over end, each its own speed, slower the more is done", t2.rings[B.id].tilt !== t1.rings[B.id].tilt && t2.rings[C.id].tilt !== t1.rings[C.id].tilt && close(t2.rings[B.id].speed, 8.03, 0.05) && close(t2.rings[C.id].speed, 13.4, 0.05), JSON.stringify([t1.rings[B.id].tilt, t2.rings[B.id].tilt, t2.rings[C.id].speed]));
s = await until((x) => Math.abs(x.rings[A.id].tilt) < 0.5, 12000);
check("the all-done ring has settled flat and rests", s.rings[A.id].speed === 0 && Math.abs(s.rings[A.id].tilt) < 0.5, String(s.rings[A.id].tilt));

const order = await page.evaluate(() => [...document.querySelectorAll("[data-ring-seg],[data-lanes-orb]")].map((e) => ({ z: Number(e.dataset.z), ring: e.getAttribute("data-ring-seg") })));
check("one scene sorted by depth: every ring piece and orb, far to near", order.length === 154 && order.every((x, i) => i === 0 || x.z >= order[i - 1].z));
const switches = order.filter((x) => x.ring).reduce((n, x, i, a) => n + (i > 0 && x.ring !== a[i - 1].ring ? 1 : 0), 0);
check("…so rings pass in front of and behind each other", switches > 6, `${switches} changes of ring along the depth order`);
const orbsNow = Object.values(s.orbs);
check("far orbs are smaller than near ones", orbsNow.filter((o) => o.z < -30).every((f) => orbsNow.filter((o) => o.z > 30).every((n) => f.scale < n.scale)));
const mids = A.chats.map((c) => s.orbs[c.id]).concat([s.orbs[B.chats[2].id]]);
check("the finished chats are the middle, spinning round it, with space between them", mids.every((o) => Math.abs(o.x) < 82 && Math.abs(o.y) < 45) && mids.every((o, i) => mids.every((q, j) => i === j || Math.hypot(o.x - q.x, o.y - q.y) > 10)), JSON.stringify(mids.map((o) => [o.x, o.y])));
await page.waitForTimeout(400);
const m1 = (await read()).orbs[A.chats[0].id];
check("…turning", m1.x !== s.orbs[A.chats[0].id].x || m1.y !== s.orbs[A.chats[0].id].y);

/* Hover: a point on a ring piece that the pointer really finds. */
const onRing = (id) => page.evaluate((id) => {
  for (const g of document.querySelectorAll(`[data-ring-seg="${id}"]`)) {
    const p = g.querySelector("path"), m = p.getScreenCTM(), at = p.getPointAtLength(p.getTotalLength() / 2);
    const x = at.x * m.a + at.y * m.c + m.e, y = at.x * m.b + at.y * m.d + m.f;
    if (document.elementFromPoint(x, y)?.closest("[data-ring-seg]") === g) return { x, y };
  }
  return { x: 0, y: 0 };
}, id);
let pt = await onRing(C.id);
await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(120);
s = await read();
check("hovering a ring shows its coordinator in the menu", s.menu === C.name, s.menu);
const widths = await page.evaluate((id) => [...new Set([...document.querySelectorAll(`[data-ring-seg="${id}"] path:first-child`)].map((p) => p.getAttribute("stroke-width")))], C.id);
check("…and brightens it, only it", widths.join() === "14" && s.rings[C.id].spin === 0, widths.join());

/* The tumble. */
pt = await onRing(C.id);
await page.mouse.click(pt.x, pt.y);
const seenSpins = [], others = [];
const t0 = Date.now();
for (;;) {
  const r = await read();
  seenSpins.push(r.rings[C.id].spin); others.push(r.rings[A.id].spin + r.rings[B.id].spin);
  if ((r.rings[C.id].spin === 0 && seenSpins.some((x) => x > 0)) || Date.now() - t0 > 12000) break;
  await page.waitForTimeout(50);
}
check("a click tumbles the ring over, fast then easing", seenSpins.some((x) => x > 300), `spin up to ${Math.max(...seenSpins)}`);
check("…never turning back, and over in whole turns", seenSpins.slice(0, -1).every((x, i, a) => i === 0 || x >= a[i - 1]) && seenSpins.at(-1) === 0);
check("the others didn't tumble", others.every((x) => x === 0));
await page.mouse.move(3, 400); await page.waitForTimeout(250);
check("the click picked the coordinator: the menu stays on it", (await read()).menu === C.name);
check("the menu's Open chat opens the coordinator's chat", (await page.locator('[data-lanes-control="open chat"]').getAttribute("href")) === `claude://claude.ai/epitaxy/${C.id}`);
check("…and it says what Steer, Pause and Stop do from here", /desktop app/.test((await page.locator("[data-lanes-how]").textContent()) ?? ""));

/* Hover an orb. */
const em = C.chats[0];
const orbOnScreen = (id) => page.evaluate((id) => { const g = document.querySelector(`[data-lanes-orb="${id}"]`), r = g.querySelectorAll("circle")[1].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)?.closest("[data-lanes-orb]") === g }; }, id);
let o = await orbOnScreen(em.id);
for (let i = 0; i < 40 && !o.top; i++) { await page.waitForTimeout(150); o = await orbOnScreen(em.id); }
await page.mouse.move(o.x, o.y); await page.waitForTimeout(200);
s = await read();
check("hovering a chat names it in the menu and opens its box", s.menu === em.name && s.box === em.id, `${s.menu} / ${s.box}`);
const boxText = await page.locator("[data-lanes-box]").textContent().catch(() => "");
check("…with its state and last line, a field and Send", /needs you/.test(boxText) && boxText.includes(em.last) && (await page.locator("[data-lanes-say]").count()) === 1 && (await page.locator("[data-lanes-send]").count()) === 1, boxText.slice(0, 80));
await page.mouse.move(3, 400); await page.waitForTimeout(250);

/* One lap per message: sent, round the back, answered, to the middle. */
const form = B.chats[3];
const state = (id, to) => { feedNow = JSON.parse(JSON.stringify(feedNow)); for (const c of feedNow.coordinators) for (const x of c.chats) if (x.id === id) x.state = to; };
state(form.id, "work");
s = await until((x) => x.orbs[form.id]?.state === "work", 8000);
const sent = s.orbs[form.id]?.share;
check("a chat sent a message leaves the front at once on its lap", s.orbs[form.id]?.target === COL.work && sent < 0.3, String(sent));
s = await until((x) => near(x.orbs[form.id].colour, COL.work, 30), 6000);
check("…its colour drifting to blue, not snapping", near(s.orbs[form.id].colour, COL.work, 30));
s = await until((x) => x.orbs[form.id]?.share > 0.3, 9000);
check("…easing round to the back while it thinks", s.orbs[form.id].share > 0.3 && s.orbs[form.id].share <= 0.5, String(s.orbs[form.id].share));
state(form.id, "done");
s = await until((x) => x.orbs[form.id]?.share === 1 && Math.abs(x.orbs[form.id].x) < 82 && Math.abs(x.orbs[form.id].y) < 45, 14000);
await page.waitForTimeout(2500);
s = await read();
check("when it answers it completes the lap and goes to the middle", s.orbs[form.id].share === 1 && Math.abs(s.orbs[form.id].x) < 82 && Math.abs(s.orbs[form.id].y) < 45, JSON.stringify(s.orbs[form.id]));
check("…and its ring grows a step out, eased", close(s.rings[B.id].r, 249, 0.5) && close(s.rings[B.id].speed, 5.35, 0.05), `${s.rings[B.id].r} ${s.rings[B.id].speed}`);

/* The helper's page is still all there. */
await page.locator('[data-agents-tab="helper"]').click().catch(() => {}); await page.waitForTimeout(400);
const helperTab = await page.evaluate(() => { const d = document.querySelector("[data-agents-dock]").getBoundingClientRect(); return { w: Math.round(d.width), board: !!document.querySelector("[data-lanes-board]"), frame: !!document.querySelector("[data-agents-frame]") }; });
check("the second tab is the helper's frame, 380px, and the board is gone", helperTab.w === 380 && !helperTab.board && helperTab.frame, JSON.stringify(helperTab));
await page.locator('[data-agents-tab="chats"]').click().catch(() => {});
await page.waitForSelector("[data-lanes-board]", { timeout: 3000 }).catch(() => {});
check("the frame stays loaded under the board, out of the keyboard's way", await page.evaluate(() => !!document.querySelector("[data-agents-frame]")?.closest("[inert]")));
await page.locator("[data-agents-close]").click().catch(() => {});

/* A real site on the board, opened saved (no import): the board over it moves nothing. */
const c3 = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await c3.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: FIXTURE, beats: [], now: Date.now() }) }));
await c3.route(`${HELPER}/**`, (r) => r.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><title>dock stub</title><body>dock" }));
const p3 = await c3.newPage();
p3.on("pageerror", (e) => errors.push(e.message));
await openBoard(p3, BASE, "pst");
await p3.waitForTimeout(1500);
const parts = () => p3.evaluate(() => ({
  stored: (window.__studioHistory?.doc().nodes ?? []).map((n) => `${n.id}:${n.x},${n.y},${n.w},${n.h}`),
  drawn: [...document.querySelectorAll("[data-node-id]")].map((el) => { const r = el.getBoundingClientRect(); return `${el.getAttribute("data-node-id")}:${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.width)},${Math.round(r.height)}`; }),
}));
const p0 = await parts();
await p3.locator("[data-agents-button]").click().catch(() => {});
await p3.waitForSelector("[data-lanes-orb]", { timeout: 15000 }).catch(() => {});
const orbsOverSite = await p3.locator("[data-lanes-orb]").count();
await p3.waitForTimeout(3000);
await p3.locator("[data-agents-close]").click().catch(() => {});
await p3.waitForTimeout(800);
const p1 = await parts();
check(`on a real site (${p0.stored.length} parts): the atom draws and the board doesn't move by a pixel`, orbsOverSite === allChats.length && p0.stored.length > 20 && JSON.stringify(p0) === JSON.stringify(p1), `${orbsOverSite} orbs`);
await c3.close();

/* No feed: says so, doesn't crash. */
const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await c2.route("**/api/lanes", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ feed: null, beats: [], now: Date.now() }) }));
await c2.route(`${HELPER}/**`, (r) => r.abort("connectionrefused"));
const p2 = await c2.newPage();
p2.on("pageerror", (e) => errors.push(e.message));
await p2.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await p2.waitForSelector("[data-agents-button]", { timeout: 30000 }).catch(() => {});
await p2.locator("[data-agents-button]").click().catch(() => {});
await p2.waitForSelector("[data-lanes-empty]", { timeout: 8000 }).catch(() => {});
check("with no feed the board says why, and that the helper is the way", /helper/.test((await p2.locator("[data-lanes-empty]").textContent().catch(() => "")) ?? ""));
await c2.close();

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 300));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
