#!/usr/bin/env node
/**
 * ✍️ MARK UP: J DRAWS ON THE BUILDER AND EVERY STROKE REGISTERS WHAT IT TOUCHED (J, 2026-11-11, 6:08 pm: "id love
 * to be able to mark for you whats missing with something that you automatically register my drawn lines instead
 * of having to look and decide where they are"; 6:05 pm: "where is my snapshot to edit button";
 * brief handovers/open/markup-brief.md).
 *
 *   1. a Mark up button on the board's top bar and in the Agents manager's bar; pressing it lays a layer over
 *      everything that takes every press (the view is frozen);
 *   2. a line over a known part registers that part by its name; a loop registers everything inside it; an arrow
 *      names what its head points at; a line on empty board names the nearest parts; one over the manager names
 *      the manager's control and its chat;
 *   3. Send saves one press `{kind: "markup", strokes, note, picture}` through the Helper, and the Helper writes the
 *      pictures under handovers/open/markup/<date>/ and the words into console-presses.json;
 *   4. Snapshot saves the whole view's picture and the map of every element on screen;
 *   5. nothing on the board moves: every part's box and the document are the same after, to the pixel.
 *
 *   npx next start -p 3099          (a build of this branch)
 *   node tests/markup.mjs http://127.0.0.1:3099 [fixtures folder with sites/<name>/site/document.json]
 *
 * Covers: src/features/markup/*, helper/server/markup.ts, helper/server/lanes.ts, helper/server/server.ts, src/features/agents/AgentsManager.tsx
 */
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3099").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? "";
const HELPER = "http://127.0.0.1:47821";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const tryImport = async (p) => { try { return await import(p); } catch (e) { check(`${p} loads`, false, String(e?.message ?? e).split("\n")[0].slice(0, 140)); return null; } };

/* ------------------------------------------------------------ 1. pure: the stroke's shape, and the Helper's saving */
const G = await tryImport("../src/features/markup/geometry.ts");
const HL = await tryImport("../helper/server/lanes.ts");
const ring = (cx, cy, rx, ry, n = 40, turn = 1) => Array.from({ length: n + 1 }, (_, i) => [cx + rx * Math.cos((i / n) * 2 * Math.PI * turn), cy + ry * Math.sin((i / n) * 2 * Math.PI * turn)]);
if (G) {
  check("a loop that ends where it began is a circle, a flat one round a wide headline too", G.isClosed(ring(200, 200, 80, 50)) && G.isClosed(ring(675, 474, 421, 95, 48)) && G.isClosed(ring(675, 474, 421, 95, 48).reverse()));
  check("a straight line, a back-and-forth scribble and a tiny loop are not", !G.isClosed([[0, 0], [50, 0], [100, 0], [150, 0], [200, 0], [250, 0], [300, 0], [350, 0]]) && !G.isClosed([[0, 0], [100, 2], [0, 4], [100, 6], [0, 8], [100, 10], [0, 12], [2, 1]]) && !G.isClosed(ring(10, 10, 4, 4)));
  const a = G.along([[0, 0], [60, 0]], 6);
  check("a stroke is read every few pixels along it, ends included", a.length === 11 && a[0][0] === 0 && a.at(-1)[0] === 60, a.length);
  check("a loop's area is what it closes", Math.abs(G.areaOf([[0, 0], [10, 0], [10, 10], [0, 10]]) - 100) < 1e-9 && Math.abs(G.areaOf(ring(0, 0, 10, 10, 400)) - Math.PI * 100) < 1);
  check("inside a loop is inside; outside is not", G.inside([200, 200], ring(200, 200, 80, 50)) && !G.inside([300, 200], ring(200, 200, 80, 50)));
  check("a long stroke is thinned to at most 200 whole points, its ends kept", (() => { const t = G.thin(Array.from({ length: 1000 }, (_, i) => [i + 0.4, 0])); return t.length === 200 && t[0][0] === 0 && t.at(-1)[0] === 999; })());
}
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
const tmp = mkdtempSync(join(tmpdir(), "markup-"));
const presses = join(tmp, "console-presses.json");
if (HL?.pressLanes) {
  const at = new Date("2026-11-12T10:20:30.456Z");
  const ok = HL.pressLanes(presses, {
    kind: "markup", target: "coordinator", note: "The price line is missing",
    strokes: [
      { shape: "line", points: [[10, 10], [80, 12]], note: "this one", box: { x: 10, y: 10, w: 70, h: 2 }, elements: [{ how: "crossed", nodeId: "n1", name: "Hero title", tag: "div", box: { x: 0, y: 0, w: 100, h: 40 }, token: "sk-should-not-pass" }], picture: { mime: "image/png", data: PNG } },
      { shape: "circle", points: [[0, 0], [5, 5], [0, 9]], elements: [], near: [{ how: "near", nodeId: "n2", name: "Price", tag: "div", box: { x: 1, y: 2, w: 3, h: 4 } }] },
    ],
    picture: { mime: "image/png", data: PNG }, view: { w: 1500, h: 950, page: "/builder" },
  }, at);
  const rows = existsSync(presses) ? JSON.parse(readFileSync(presses, "utf8")) : [];
  const r = rows[0] ?? {};
  check("3: a mark-up press is saved for the coordinator, from the Builder, with its note and strokes", ok.ok && rows.length === 1 && r.kind === "markup" && r.from === "builder" && r.note === "The price line is missing" && r.strokes?.length === 2, JSON.stringify(ok).slice(0, 200));
  check("3: each stroke keeps its shape, points, note and what it touched (by name and part id), nothing else", r.strokes?.[0]?.shape === "line" && r.strokes[0].note === "this one" && r.strokes[0].elements?.[0]?.name === "Hero title" && r.strokes[0].elements[0].nodeId === "n1" && !("token" in r.strokes[0].elements[0]) && r.strokes[1].near?.[0]?.name === "Price", JSON.stringify(r.strokes ?? null).slice(0, 300));
  const dir = join(tmp, "open", "markup", "2026-11-12");
  const files = existsSync(dir) ? readdirSync(dir).sort() : [];
  check("3: the pictures are written under open/markup/<date>/ and named in the row", files.includes("102030456-markup.png") && files.includes("102030456-s1.png") && r.picture === "open/markup/2026-11-12/102030456-markup.png" && r.strokes?.[0]?.picture === "open/markup/2026-11-12/102030456-s1.png" && readFileSync(join(dir, "102030456-s1.png")).subarray(1, 4).toString() === "PNG", files.join());
  const snap = HL.pressLanes(presses, { kind: "snapshot", target: "coordinator", picture: { mime: "image/png", data: PNG }, map: [{ how: "in-view", nodeId: "n1", name: "Hero title", tag: "div", box: { x: 0, y: 0, w: 1, h: 1 } }] }, at);
  const s = JSON.parse(readFileSync(presses, "utf8"))[1] ?? {};
  check("4: a snapshot press saves the picture and the element map as files, the row names them", snap.ok && s.kind === "snapshot" && s.elements === 1 && s.map && existsSync(join(tmp, ...s.map.split("/"))) && existsSync(join(tmp, ...s.picture.split("/"))), JSON.stringify(s));
  const bad = [
    { kind: "markup", target: "coordinator", strokes: [] },
    { kind: "markup", target: "coordinator", strokes: [{ shape: "blob", points: [[0, 0], [1, 1]] }] },
    { kind: "markup", target: "coordinator", strokes: [{ shape: "line", points: [[0, 0]] }] },
    { kind: "markup", target: "coordinator", strokes: [{ shape: "line", points: [[0, 0], [1, 1]] }], picture: { mime: "text/html", data: "PGgxPg==" } },
    { kind: "markup", target: "coordinator", strokes: [{ shape: "line", points: [[0, 0], [1, 1]] }], picture: { mime: "image/png", data: "not base64!" } },
    { kind: "snapshot", target: "coordinator" },
  ].map((b) => HL.pressLanes(presses, b, at));
  check("3: no stroke, an odd shape, one point, a picture that isn't one, an empty snapshot: refused, nothing saved", bad.every((x) => !x.ok && x.status === 400) && JSON.parse(readFileSync(presses, "utf8")).length === 2, bad.map((x) => x.status).join());
}

/* ------------------------------------------------------------ 2. the Builder */
const posts = [];
const errors = [];
async function standIn(ctx, origin) {
  await ctx.route(`${HELPER}/**`, (r) => {
    const u = new URL(r.request().url()), method = r.request().method();
    const cors = { "access-control-allow-origin": origin, vary: "Origin" };
    const json = (body) => r.fulfill({ status: 200, contentType: "application/json", headers: cors, body: JSON.stringify(body) });
    if (method === "OPTIONS") return r.fulfill({ status: 204, headers: { ...cors, "access-control-allow-methods": "GET, POST", "access-control-allow-headers": "content-type" }, body: "" });
    if (u.pathname === "/health") return json({ helper: true, paired: true });
    if (u.pathname === "/lanes/pc") return json({ ok: true, at: Date.now(), memTotal: 0, owners: [] });
    if (method === "POST") { const b = JSON.parse(r.request().postData() ?? "{}"); posts.push({ path: u.pathname, ...b }); return json({ ok: true, kind: b.kind, target: b.target, at: new Date().toISOString() }); }
    if (u.pathname === "/lanes") return json({ feed: { decisions: [], coordinators: [{ id: "c", name: "Coordinator 10", chats: [{ id: "local_00000010-0000-4000-8000-000000000000", name: "Coordinator 10", kind: "coordinator", state: "work", lane: "coordinator", code: "C10", lastSeen: new Date().toISOString() }] }] }, beats: [], now: Date.now() });
    return r.fulfill({ status: 404, headers: cors, body: "" });
  });
  await ctx.route("**/api/lanes", (r) => r.fulfill({ status: 404, body: "" }));
}

/** Every part's box on screen and the document, as one string: the board "to the pixel". */
const settled = (page) => page.evaluate(() => JSON.stringify({
  boxes: [...document.querySelectorAll("[data-node-id]")].map((e) => { const r = e.getBoundingClientRect(); return [e.getAttribute("data-node-id"), Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)]; }),
  doc: (() => { const d = window.__studioHistory?.doc?.(); return d ? { nodes: d.nodes, frameWidth: d.frameWidth, zoom: d.zoom } : null; })(),
}));

/** The first difference between two `settled` strings, in words. */
function diffOf(a, b) {
  if (a === b) return "";
  const A = JSON.parse(a), B = JSON.parse(b);
  const box = A.boxes.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(B.boxes[i]));
  if (box >= 0) return `box ${JSON.stringify(A.boxes[box])} → ${JSON.stringify(B.boxes[box])}`;
  const n = (A.doc?.nodes ?? []).findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(B.doc?.nodes?.[i]));
  if (n >= 0) { const x = A.doc.nodes[n], y = B.doc.nodes[n]; const k = Object.keys({ ...x, ...y }).filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])); return `node ${x.id}: ${k.map((k) => `${k} ${JSON.stringify(x[k]).slice(0, 60)} → ${JSON.stringify(y[k]).slice(0, 60)}`).join("; ")}`; }
  return "the document's frame or zoom";
}

/** A stroke with the real mouse, a point every few pixels. */
async function draw(page, pts) {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(p[0], p[1], { steps: 2 });
  await page.mouse.up();
  await page.waitForTimeout(150);
}
const strokes = (page) => page.evaluate(() => window.__markup?.strokes?.() ?? null);
const line = (x0, y0, x1, y1, n = 20) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);

/** Visible parts with a name, big enough to aim at, inside the board's page and the screen. */
const parts = (page) => page.evaluate(() => {
  const nodes = window.__studioHistory?.doc?.()?.nodes ?? [];
  const frame = document.querySelector("[data-frame]")?.getBoundingClientRect();
  return [...document.querySelectorAll("[data-node-id]")].map((e) => {
    const r = e.getBoundingClientRect(), id = e.getAttribute("data-node-id"), n = nodes.find((x) => x.id === id);
    const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
    const top = document.elementsFromPoint(cx, cy).find((x) => !x.closest("[data-markup-layer]"))?.closest("[data-node-id]")?.getAttribute("data-node-id");
    return { id, label: n?.label ?? "", x: r.x, y: r.y, w: r.width, h: r.height, cx, cy, top: top === id };
  }).filter((p) => p.top && p.w >= 40 && p.h >= 16 && p.label && frame && p.x > frame.x && p.y > 60 && p.y + p.h < window.innerHeight - 20 && p.x + p.w < window.innerWidth - 20);
});

async function onBoard(browser, label, open) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
  await standIn(ctx, new URL(BASE).origin);
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (e) => errors.push(`${label}: ${e.message}`));
  await open(page);
  /* The board settles on its own first (a face arriving moves a part by a pixel): wait for three readings alike, a second apart. */
  let before = await settled(page);
  for (let i = 0, same = 0; i < 20 && same < 3; i++) { await page.waitForTimeout(1000); const b = await settled(page); same = b === before ? same + 1 : 0; before = b; }
  const button = page.locator("[data-markup-button]");
  check(`${label} 1: a Mark up button on the board's top bar`, (await button.count()) === 1);
  await button.click().catch(() => {});
  const layer = await page.locator("[data-markup-layer]").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const takes = layer && await page.evaluate(() => { const l = document.querySelector("[data-markup-layer]").getBoundingClientRect(); const hit = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2); return l.width >= window.innerWidth && l.height >= window.innerHeight && !!hit?.closest("[data-markup-layer]"); });
  check(`${label} 1: pressing it lays the drawing layer over everything, taking every press`, takes === true);
  if (!takes) { await ctx.close(); return; }

  const ps = await parts(page);
  const p = ps.find((x) => x.w >= 80) ?? ps[0];
  let n = 0;
  if (p) {
    await draw(page, line(p.x + 4, p.cy, p.x + p.w - 4, p.cy + 2));
    const s = (await strokes(page))?.[n++];
    check(`${label} 2: a line over a known part registers that part by its name`, s?.shape === "line" && s.elements.some((e) => e.nodeId === p.id && e.name === p.label && e.how === "crossed" && e.pageBox), `${p.label} → ${String(JSON.stringify(s?.elements?.map((e) => e.name || e.attr))).slice(0, 200)}`);
    const tag = await page.locator("[data-markup-tag='1'] [data-markup-words]").textContent().catch(() => "");
    check(`${label} 2: the stroke's tag shows J what it registered`, !!tag && tag.includes(p.label.slice(0, 20)), tag);
    await page.keyboard.type("Too low");
    await page.keyboard.press("Enter");
    check(`${label} 2: a stroke takes a note, typed straight after it`, (await strokes(page))?.[0]?.note === "Too low");
  } else check(`${label}: a named part to aim at`, false);

  /* A loop round an area: everything whose middle is inside it, and nothing else. */
  /* The part to circle: one that fits on screen with room round it (a loop J draws goes round the thing). */
  const fits = (x) => { const rx = x.w / 2 * 1.45 + 24, ry = x.h / 2 * 1.45 + 24; return x.cx - rx > 4 && x.cx + rx < 1496 && x.cy - ry > 70 && x.cy + ry < 860; };
  const c = ps.filter(fits).sort((a, b) => b.w * b.h - a.w * a.h)[0] ?? null;
  const area = c ? { cx: c.cx, cy: c.cy } : null;
  if (area) {
    const rx = c.w / 2 * 1.45 + 24, ry = c.h / 2 * 1.45 + 24;
    const loop = ring(area.cx, area.cy, rx, ry, 48).map(([x, y]) => [Math.max(2, Math.min(1498, x)), Math.max(70, Math.min(948, y))]);
    const want = await page.evaluate(({ loop }) => {
      const inside = (p) => { let yes = false; for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) { const [xi, yi] = loop[i], [xj, yj] = loop[j]; if ((yi > p[1]) !== (yj > p[1]) && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) yes = !yes; } return yes; };
      const xs = loop.map((p) => p[0]), ys = loop.map((p) => p[1]), L = Math.min(...xs), R = Math.max(...xs), T = Math.min(...ys), B = Math.max(...ys);
      const mostly = (r) => { const w = Math.min(r.right, R) - Math.max(r.left, L), h = Math.min(r.bottom, B) - Math.max(r.top, T); return w > 0 && h > 0 && (w * h) / (r.width * r.height) >= 0.6 && r.width * r.height <= loopArea; };
      let loopArea = 0; for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) loopArea += (loop[j][0] + loop[i][0]) * (loop[j][1] - loop[i][1]); loopArea = Math.abs(loopArea / 2);
      return [...document.querySelectorAll("[data-node-id]")].filter((e) => {
        const r = e.getBoundingClientRect(), st = getComputedStyle(e);
        return r.width && r.height && st.visibility !== "hidden" && st.display !== "none" && Number(st.opacity) !== 0 && inside([r.x + r.width / 2, r.y + r.height / 2]) && mostly(r);
      }).filter((e, _, all) => !all.some((o) => o !== e && o.contains(e))).map((e) => e.getAttribute("data-node-id")).sort();
    }, { loop });
    await draw(page, loop);
    const s = (await strokes(page))?.[n++];
    const got = [...new Set((s?.elements ?? []).filter((e) => e.nodeId).map((e) => e.nodeId))].sort();
    const loopBox = { w: 2 * rx, h: 2 * ry };
    check(`${label} 2: a loop registers nothing much bigger than itself (no page-wide holder)`, !!s && s.elements.every((e) => e.box.w * e.box.h <= 1.2 * loopBox.w * loopBox.h), `${String(JSON.stringify(s?.elements?.filter((e) => e.box.w * e.box.h > 1.2 * loopBox.w * loopBox.h).map((e) => [(e.name || e.text || e.attr || "").slice(0, 30), e.box])))} loop ${JSON.stringify(G?.boxOf?.(s?.points ?? []) ?? null)} c ${JSON.stringify(c)}`);
    check(`${label} 2: a loop registers every part inside it, and only those`, s?.shape === "circle" && want.includes(c.id) && got.join() === want.join(), `want ${want.length} got ${got.length}: ${want.filter((x) => !got.includes(x)).slice(0, 3)} | ${got.filter((x) => !want.includes(x)).slice(0, 3)}`);
  }

  /* An arrow: its head names what it points at. */
  if (p) {
    await page.locator("[data-markup-tool='arrow']").click();
    await draw(page, line(p.cx - 120, Math.max(80, p.cy - 90), p.cx, p.cy));
    const s = (await strokes(page))?.[n++];
    check(`${label} 2: an arrow names what its head points at`, s?.shape === "arrow" && s.elements[0]?.how === "points-at" && s.elements[0]?.nodeId === p.id, JSON.stringify(s?.elements?.[0] ?? null).slice(0, 160));
    await page.locator("[data-markup-tool='auto']").click();
  }

  const lay = await page.evaluate(() => {
    const tags = [...document.querySelectorAll("[data-markup-tag]")].map((e) => e.getBoundingClientRect());
    const over = tags.some((a, i) => tags.some((b, j) => j > i && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
    const bar = document.querySelector("[data-markup-bar]").getBoundingClientRect(), top = document.querySelector("[data-markup-button]")?.getBoundingClientRect();
    return { n: tags.length, over, barLow: bar.top > innerHeight / 2, clearOfTop: !top || bar.top > top.bottom };
  });
  check(`${label} 2: each stroke's tag stands clear of the others; the bar sits low, off the Builder's own bar`, lay.n === n && !lay.over && lay.barLow && lay.clearOfTop, JSON.stringify(lay));

  /* A stroke on empty board names the nearest parts. */
  const empty = await page.evaluate(() => {
    const f = document.querySelector("[data-frame]")?.getBoundingClientRect();
    if (!f) return null;
    for (let y = Math.max(f.y + 10, 90); y < Math.min(f.bottom, window.innerHeight - 20); y += 12) for (let x = Math.max(f.x + 10, 20); x < Math.min(f.right, window.innerWidth - 80); x += 12) {
      const ok = [0, 20, 40, 60].every((d) => { const t = document.elementsFromPoint(x + d, y).find((e) => !e.closest("[data-markup-layer]")); return t && !t.closest("[data-node-id]") && (t.closest("[data-frame]") || t.closest("[data-page-window]")); });
      if (ok) return [x, y];
    }
    return null;
  });
  if (empty) {
    await draw(page, line(empty[0], empty[1], empty[0] + 60, empty[1], 10));
    const s = (await strokes(page))?.[n++];
    check(`${label} 2: a line on empty board names the nearest parts`, !!s && !s.elements.some((e) => e.nodeId) && s.near.length >= 1 && s.near.every((e) => e.nodeId), String(JSON.stringify(s?.near?.map((e) => e.name))).slice(0, 160));
  } else console.log(`  --   ${label}: no empty board in view to draw on`);

  /* Send: one press, every stroke with what it touched and a picture; the Helper writes it as it would on J's PC. */
  posts.length = 0;
  await page.locator("[data-markup-note]").fill("What is missing here");
  /* For the picture round: the layer as J sees it, and what Send makes of it (MARKUP_SHOTS=<folder>). */
  if (process.env.MARKUP_SHOTS && label === "solface") await page.screenshot({ path: join(process.env.MARKUP_SHOTS, "layer.png") });
  if (!n) { check(`${label}: strokes to send`, false); await ctx.close(); return; }
  await page.locator("[data-markup-send]").click();
  await page.waitForFunction(() => /Sent|Not saved/.test(document.querySelector("[data-markup-said]")?.textContent ?? ""), null, { timeout: 60000 }).catch(() => {});
  const sent = posts.find((x) => x.path === "/lanes/press" && x.kind === "markup");
  check(`${label} 3: Send saves one markup press through the Helper with every stroke, its note and pictures`, !!sent && sent.target === "coordinator" && sent.note === "What is missing here" && sent.strokes.length === n && sent.strokes[0].note === "Too low" && sent.strokes.every((s) => s.picture?.data && s.points.length >= 2) && sent.picture?.mime === "image/webp", JSON.stringify(sent ? { n: sent.strokes.length, pics: sent.strokes.map((s) => !!s.picture) } : await page.locator("[data-markup-said]").textContent().catch(() => "")));
  if (sent && process.env.MARKUP_SHOTS && label === "solface") { writeFileSync(join(process.env.MARKUP_SHOTS, "sent-all.webp"), Buffer.from(sent.picture.data, "base64")); sent.strokes.forEach((s, i) => writeFileSync(join(process.env.MARKUP_SHOTS, `sent-s${i + 1}.webp`), Buffer.from(s.picture.data, "base64"))); }
  if (sent && HL?.pressLanes) {
    const file = join(tmp, `${label.replace(/\W+/g, "-")}-presses.json`);
    const saved = HL.pressLanes(file, sent);
    const row = saved.ok ? JSON.parse(readFileSync(file, "utf8"))[0] : null;
    check(`${label} 3: the Helper takes the Builder's press whole and writes its pictures`, saved.ok && row.strokes.length === n && row.strokes[0].elements.some((e) => e.nodeId === p?.id) && existsSync(join(tmp, ...row.picture.split("/"))) && JSON.stringify(sent).length < 12 << 20, JSON.stringify(saved).slice(0, 160));
  }
  check(`${label} 3: after Send the strokes are cleared`, ((await strokes(page)) ?? [1]).length === 0);

  /* Snapshot: the whole view and its element map. */
  posts.length = 0;
  await page.locator("[data-markup-snapshot]").click();
  await page.waitForFunction(() => /Snapshot saved|Not saved/.test(document.querySelector("[data-markup-said]")?.textContent ?? ""), null, { timeout: 60000 }).catch(() => {});
  const snap = posts.find((x) => x.kind === "snapshot");
  const onScreen = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; }).length);
  check(`${label} 4: Snapshot saves the view's picture and every part on screen in its map`, !!snap && snap.picture?.data?.length > 500 && snap.map.filter((e) => e.nodeId).length >= Math.min(onScreen, 1000) && snap.map.some((e) => e.attr?.startsWith("data-markup")) === false, `${snap?.map?.filter((e) => e.nodeId).length} of ${onScreen}`);

  await page.locator("[data-markup-close]").click();
  const gone = await page.locator("[data-markup-layer]").count();
  await page.waitForTimeout(300);
  const after = await settled(page);
  check(`${label} 5: nothing on the board moved or changed, to the pixel`, gone === 0 && before === after && before.length > 50, diffOf(before, after));
  await ctx.close();
}

async function inManager(browser) {
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 }, reducedMotion: "reduce" });
  await standIn(ctx, new URL(BASE).origin);
  const page = await ctx.newPage();
  page.setDefaultTimeout(120_000);
  page.on("pageerror", (e) => errors.push(`manager: ${e.message}`));
  await openBoard(page, BASE, "solface");
  await page.locator("[data-agents-button]").click();
  await page.locator("[data-agents-manager-open]").waitFor({ timeout: 15000 }).catch(() => {});
  await page.locator("[data-agents-manager-open]").click().catch(() => {});
  const up = await page.locator("[data-agents-manager]").waitFor({ timeout: 15000 }).then(() => true).catch(() => false);
  const m = page.locator("[data-manager-markup]");
  check("1: a Mark up button in the Agents manager's bar", up && (await m.count()) === 1);
  await m.click().catch(() => {});
  const layer = await page.locator("[data-markup-layer]").waitFor({ timeout: 10000 }).then(() => true).catch(() => false);
  const b = await page.locator("[data-manager-private]").boundingBox();
  if (layer && b) {
    await draw(page, line(b.x + 3, b.y + b.height / 2, b.x + b.width - 3, b.y + b.height / 2, 10));
    const s = (await strokes(page))?.[0];
    check("2: a line over the manager's own control registers it", !!s?.elements.some((e) => e.attr?.startsWith("data-manager-private")), String(JSON.stringify(s?.elements?.map((e) => e.attr))).slice(0, 200));
  } else check("1: the manager's Mark up opens the layer over it", false);
  await ctx.close();
}

let browser;
try {
  browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: (process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean) });
  await onBoard(browser, "solface", (page) => openBoard(page, BASE, "solface"));
  await inManager(browser);
  if (SINK) {
    for (const site of ["share-xyz", "trumpmorty-fun", "gotchi-gg", "stonkfun-xyz", "parasiteonsol-fun", "trendtrader-pro"]) {
      if (process.env.ONLY_SITE && process.env.ONLY_SITE !== site) continue;
      const file = join(SINK, "sites", site, "site", "document.json");
      if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); continue; }
      const doc = JSON.parse(readFileSync(file, "utf8"));
      try { await onBoard(browser, site, async (page) => { await openBoard(page, BASE, "solface"); await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id }); }); }
      catch (e) { check(`${site}: ran to the end`, false, String(e?.message ?? e).split("\n")[0]); }
    }
  } else console.log("  --   the fixtures skipped: no fixtures folder given (argv 3 or SINK)");
} catch (e) {
  check("ran to the end", false, String(e?.stack ?? e).split("\n").slice(0, 3).join(" "));
}
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser?.close().catch(() => {});
rmSync(tmp, { recursive: true, force: true });
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
