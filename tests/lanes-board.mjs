#!/usr/bin/env node
/**
 * THE LANES BOARD (J, 2026-11-01/02): every chat working for J as an atom, in
 * the Agents dock's first tab, read from handovers/lanes.json plus the hooks'
 * heartbeats.
 *
 *   1. pure: the feed's states, a heartbeat turning a chat blue, the ring's
 *      colour and tilt, the near and far halves, the hex grid, the tumble;
 *   2. the helper's GET /lanes: the Builder's origin reads it, nothing else
 *      does, and it is still all the Builder page can reach;
 *   3. the route serves the file it is pointed at;
 *   4. in the Builder, on a fixture of three coordinators (one all done, one
 *      working, one needing J): ring and orb counts and colours, the tilt, the
 *      nucleus's count, near and far, a click that tumbles and lands back
 *      exactly, hover showing the right name in the menu and the chat box, a
 *      lap when a chat is sent a message and its docking when it answers, the
 *      helper's frame still in the second tab, no page errors.
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
  check("a ring wears its most urgent chat's colour", L.ringState(a) === "done" && L.ringState(b) === "work" && L.ringState(c) === "need" && L.ringState({ chats: [{ state: "park" }] }) === "park");
  check("tilt is the share done: 0° all done, 85° none", L.wantTilt(a) === 0 && L.wantTilt(b) === 85 * 0.75 && L.wantTilt(c) === 85);
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
  const flat = L.project(0, 100, 0, 0), up = L.project(0, 100, 85, 0);
  check("flat is seen from a little above, 85° nearly a full circle", flat.y > 20 && flat.y < 50 && up.y > 95, `${flat.y} ${up.y}`);
  check("a new ring is small, a done ring the outside one, growing with the tilt", L.radiusAt(85) === 150 && L.radiusAt(0) === 300 && L.radiusAt(40) > 150 && L.radiusAt(40) < 300);
  check("the prototype's three iterations are there, with A1's values the default", L.yawOf(0, 3) === -35 && L.yawOf(2, 3) === 35 && L.yawOf(0, 3, L.ATOMS.A2) === -55 && L.radiusAt(40, L.ATOMS.A2) === 290 && L.radiusAt(40, L.ATOMS.A3, 2) === 160 && L.tumbleAt(1, L.ATOMS.A2) === 720 && L.tumbleAt(1) === 1080 && L.ATOMS.A1.disc && !L.ATOMS.A2.disc);
  check("the front of a ring is near, the back far, at any tilt it stands at", [0, 30, 64, 85].every((t) => L.project(0, 100, t, 0).z > 0 && L.project(0, -100, t, 0).z < 0));
  check("a lap: 0 and 1 are the front, 0.5 the back", close(Math.sin(L.lapAngle(0)), 1, 1e-9) && close(Math.sin(L.lapAngle(1)), 1, 1e-9) && close(Math.sin(L.lapAngle(0.5)), -1, 1e-9));
  check("a thinking chat leaves at 5% and holds on the back half", close(L.thinkingPos(0), 0.05, 1e-9) && L.thinkingPos(1000) < 0.75 && L.thinkingPos(1000) > 0.5);
  check("the tumble is whole turns, and ends where it began", L.tumbleAt(0) === 0 && L.tumbleAt(1) % 360 === 0 && L.tumbleAt(1) > 360 && L.tumbleAt(0.1) > L.tumbleAt(0.05));
  const cells = L.hexCells(14);
  const apart = cells.every((p, i) => cells.every((q, j) => i === j || Math.hypot(p.u - q.u, p.v - q.v) > 60));
  check("the done grid has space between its cells and leaves the nucleus clear", cells.length === 14 && apart && cells.every((p) => Math.hypot(p.u, p.v) > 62));
  const shown = cells.slice(0, 6).map((p) => L.project(p.u, p.v, 0, 0));
  check("…and its first six stay apart on screen when the ring lies flat", shown.every((p, i) => shown.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 48)), JSON.stringify(shown.map((p) => [Math.round(p.x), Math.round(p.y)])));
  const arcs = L.ringArcs(300, 40, 0);
  check("the ring is cut in two where it crosses the nucleus's plane", arcs.front.startsWith("M") && arcs.back.startsWith("M") && arcs.front !== arcs.back);
  const yawed = L.hexCells(6, -35).map((p) => L.project(p.u, p.v, 0, -35));
  check("…whatever the ring's yaw", yawed.every((p, i) => yawed.every((q, j) => i === j || Math.hypot(p.x - q.x, p.y - q.y) > 48)), JSON.stringify(yawed.map((p) => [Math.round(p.x), Math.round(p.y)])));
  check("…and a tumble's end is the ring it left", L.ringArcs(200, 40, 20, 1080).front === L.ringArcs(200, 40, 20).front);
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
  rings: Object.fromEntries([...document.querySelectorAll("[data-lanes-ring]")].map((e) => [e.getAttribute("data-lanes-ring"), { state: e.dataset.state, colour: e.dataset.colour, tilt: Number(e.dataset.tilt), spin: Number(e.dataset.spin), d: e.getAttribute("d") }])),
  orbs: Object.fromEntries([...document.querySelectorAll("[data-lanes-orb]")].map((e) => [e.getAttribute("data-lanes-orb"), { state: e.dataset.state, colour: e.dataset.colour, side: e.dataset.side, scale: Number(e.dataset.scale), pos: Number(e.dataset.pos), x: Number(e.dataset.x), y: Number(e.dataset.y), fill: e.querySelectorAll("circle")[1]?.getAttribute("fill") }])),
  nucleus: document.querySelector("[data-lanes-nucleus]")?.getAttribute("data-lanes-nucleus"),
  nucleusText: document.querySelector("[data-lanes-nucleus] > text")?.textContent,
  menu: document.querySelector("[data-lanes-menu-name]")?.textContent,
  box: document.querySelector("[data-lanes-box]")?.getAttribute("data-lanes-box") ?? null,
}));
const until = async (test, ms = 8000) => { const end = Date.now() + ms; let s = await read(); while (Date.now() < end && !test(s)) { await page.waitForTimeout(100); s = await read(); } return s; };

/* The rings have eased down from standing to what they are. */
let s = await until((x) => x.rings[A.id] && close(x.rings[A.id].tilt, 0, 0.1) && close(x.rings[B.id].tilt, 63.75, 0.1));
const COL = { need: "#ff4d4d", work: "#35c8ff", done: "#3dffae", park: "#6f7f99" };
check("one ring per coordinator", Object.keys(s.rings).length === 3, String(Object.keys(s.rings).length));
const allChats = FIXTURE.coordinators.flatMap((c) => c.chats);
check("one orb per chat", Object.keys(s.orbs).length === allChats.length, String(Object.keys(s.orbs).length));
check("orbs wear their state's colour", allChats.every((c) => s.orbs[c.id]?.colour === COL[c.state] && s.orbs[c.id]?.fill === COL[c.state]));
check("rings wear the most urgent: green, blue, red", s.rings[A.id]?.colour === COL.done && s.rings[B.id]?.colour === COL.work && s.rings[C.id]?.colour === COL.need, JSON.stringify([A, B, C].map((c) => s.rings[c.id]?.colour)));
check("tilt: 0° all done, 64° a quarter done, 85° none", close(s.rings[A.id]?.tilt, 0, 0.1) && close(s.rings[B.id]?.tilt, 63.75, 0.1) && close(s.rings[C.id]?.tilt, 85, 0.1), JSON.stringify([A, B, C].map((c) => s.rings[c.id]?.tilt)));
check("the nucleus shows the decisions waiting", s.nucleus === "2" && s.nucleusText === "2", `${s.nucleus}/${s.nucleusText}`);
check("…on the camouflage disc, A1's nucleus", (await page.locator("[data-lanes-nucleus] [data-lanes-disc]").count()) === 1);

/* Ring B: the middle one, tilted part way, where front and back are plainest. */
const em = C.chats[0], ts = B.chats[0], parked = B.chats[3];
check("a chat waiting on its ring sits at the front, on the near side", s.orbs[parked.id]?.side === "near" && s.orbs[parked.id].pos === 1 && s.orbs[em.id].pos === 1, JSON.stringify(s.orbs[parked.id]));
s = await until((x) => x.orbs[ts.id]?.side === "far");
check("a thinking chat is round the back: far, and smaller than the front", s.orbs[ts.id]?.side === "far" && s.orbs[ts.id].scale < s.orbs[parked.id].scale && s.orbs[ts.id].pos > 0.25 && s.orbs[ts.id].pos < 0.75, JSON.stringify(s.orbs[ts.id]));
const paint = await page.evaluate(([far, near]) => { const all = [...document.querySelectorAll("[data-lanes-orb],[data-lanes-nucleus]")]; const at = (q) => all.indexOf(document.querySelector(q)); return { far: at(`[data-lanes-orb="${far}"]`), nuc: at("[data-lanes-nucleus]"), near: at(`[data-lanes-orb="${near}"]`) }; }, [ts.id, parked.id]);
check("true depth: the far orb paints before the nucleus, the near one after", paint.far < paint.nuc && paint.nuc < paint.near, JSON.stringify(paint));
const halves = await page.evaluate(() => { const nuc = [...document.querySelectorAll("[data-ring-part],[data-lanes-nucleus]")]; return nuc.map((e) => e.getAttribute("data-ring-part") ?? "nucleus").join(","); });
check("every ring's far half paints before the nucleus, its near half after", /^(back,){3}nucleus(,front){3}$/.test(halves), halves);
const homes = A.chats.map((c) => s.orbs[c.id]);
check("done chats are home around the nucleus, inside the ring, with space between them", homes.every((o) => Math.hypot(o.x, o.y) < 180) && homes.every((o, i) => homes.every((q, j) => i === j || Math.hypot(o.x - q.x, o.y - q.y) > 44)), JSON.stringify(homes.map((o) => [o.x, o.y])));

/* Hover: a point on the ring, not the middle of its box. */
const ringPoint = (id) => page.evaluate((id) => { const p = document.querySelector(`[data-lanes-ring="${id}"]`); const m = p.getScreenCTM(); for (let f = 0.03; f < 1; f += 0.03) { const at = p.getPointAtLength(p.getTotalLength() * f); const x = at.x * m.a + at.y * m.c + m.e, y = at.x * m.b + at.y * m.d + m.f; if (document.elementFromPoint(x, y) === p) return { x, y }; } return { x: 0, y: 0 }; }, id);
await page.waitForTimeout(2000); /* the last of the easing */
const before = await read();
let pt = await ringPoint(C.id);
await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(250);
s = await read();
check("hovering a ring shows its coordinator in the menu", s.menu === C.name, s.menu);
check("…and doesn't move it", s.rings[C.id].d === before.rings[C.id].d && s.rings[C.id].spin === 0);
const line = await page.locator(`[data-lanes-ring="${C.id}"]`).evaluate((e) => e.parentElement.querySelector("[data-ring-line]").getAttribute("stroke-width"));
check("…only brightens it", Number(line) > 9, line);

/* The tumble. */
await page.mouse.click(pt.x, pt.y);
const seenSpins = [];
const shapes = new Set();
const t0 = Date.now();
for (;;) {
  const r = await read();
  seenSpins.push(r.rings[C.id].spin); shapes.add(r.rings[C.id].d);
  if ((r.rings[C.id].spin === 0 && seenSpins.some((x) => x > 0)) || Date.now() - t0 > 12000) break;
  await page.waitForTimeout(50);
}
const after = await read();
check("a click tumbles the ring", seenSpins.some((x) => x > 100) && shapes.size > 3, `${shapes.size} shapes, spin up to ${Math.max(...seenSpins)}`);
check("…eased, never turning back", seenSpins.slice(0, -1).every((x, i, a) => i === 0 || x >= a[i - 1]));
check("…and lands exactly where it started", after.rings[C.id].d === before.rings[C.id].d, `${after.rings[C.id].d.slice(0, 40)}`);
check("…its waiting orbs back with it", close(after.orbs[em.id].x, before.orbs[em.id].x, 0.2) && close(after.orbs[em.id].y, before.orbs[em.id].y, 0.2), JSON.stringify([after.orbs[em.id].x, before.orbs[em.id].x]));
check("the others didn't tumble", after.rings[A.id].d === before.rings[A.id].d && after.rings[B.id].d === before.rings[B.id].d);
await page.mouse.move(3, 400); await page.waitForTimeout(250);
check("the click picked the coordinator: the menu stays on it", (await read()).menu === C.name);
check("the menu's Open chat opens the coordinator's chat", (await page.locator('[data-lanes-control="open chat"]').getAttribute("href")) === `claude://claude.ai/epitaxy/${C.id}`);
check("…and it says what Steer, Pause and Stop do from here", /desktop app/.test((await page.locator("[data-lanes-how]").textContent()) ?? ""));

/* Hover an orb. */
const orbOnScreen = (id) => page.evaluate((id) => { const r = document.querySelector(`[data-lanes-orb="${id}"]`).querySelectorAll("circle")[1].getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; }, id);
pt = await orbOnScreen(em.id);
await page.mouse.move(pt.x, pt.y); await page.waitForTimeout(300);
s = await read();
check("hovering a chat names it in the menu and opens its box", s.menu === em.name && s.box === em.id, `${s.menu} / ${s.box}`);
const boxText = await page.locator("[data-lanes-box]").textContent().catch(() => "");
check("…with its state and last line, a field and Send", /needs you/.test(boxText) && boxText.includes(em.last) && (await page.locator("[data-lanes-say]").count()) === 1 && (await page.locator("[data-lanes-send]").count()) === 1, boxText.slice(0, 80));
await page.mouse.move(3, 400); await page.waitForTimeout(250);

/* One lap per message: sent, round the back, answered, home. */
const form = B.chats[3];
const state = (id, to) => { feedNow = JSON.parse(JSON.stringify(feedNow)); for (const c of feedNow.coordinators) for (const x of c.chats) if (x.id === id) x.state = to; };
state(form.id, "work");
s = await until((x) => x.orbs[form.id]?.colour === COL.work, 8000);
const sent = s.orbs[form.id]?.pos;
check("a chat sent a message goes blue and leaves the front at once", s.orbs[form.id]?.colour === COL.work && sent < 0.4, String(sent));
s = await until((x) => x.orbs[form.id]?.pos > 0.3 && x.orbs[form.id]?.side === "far", 9000);
check("…slowing round the back", s.orbs[form.id]?.side === "far", JSON.stringify(s.orbs[form.id]));
state(form.id, "done");
s = await until((x) => x.orbs[form.id]?.pos === 1 && x.rings[B.id].tilt < 50, 14000);
await page.waitForTimeout(2500);
s = await read();
check("when it answers it completes the lap and goes home", s.orbs[form.id]?.colour === COL.done && s.orbs[form.id].pos === 1 && Math.hypot(s.orbs[form.id].x, s.orbs[form.id].y) < 180, JSON.stringify(s.orbs[form.id]));
s = await until((x) => close(x.rings[B.id].tilt, 42.5, 0.1), 6000);
check("…and its ring lies down a step, eased", close(s.rings[B.id].tilt, 42.5, 0.1), String(s.rings[B.id].tilt));

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
