/**
 * A drawn box becoming a real object: the walk it is judged by.
 *
 * The bar is not that a cube renders. It is that a person draws a box,
 * turns it, writes something on one face, turns it again and the words are
 * still on that face, then moves and resizes the whole thing like any
 * other part — with no key anywhere, because the site has none and a
 * person landing on it should still see the thing turn. Every step is
 * walked here by hand, measured, and photographed — into the ignored
 * scratch path unless the committed shots are asked for by name (see `SHOTS`).
 *
 *   1. a box drawn with the pen, no words, is read as a box off its own
 *      geometry and says so on the part; it lands as the cube, at the
 *      proportion it was drawn, and no model is called;
 *   2. it turns by dragging, cannot be tumbled upside down, and comes to
 *      rest at a three-quarter view;
 *   3. a face is picked by pressing it, the panel hands it the keys, and
 *      typing puts words on that face; the wheel's pencil edits the same
 *      face; the face keeps its words through a turn and back;
 *   4. it moves, resizes by the handle (the object follows the box), is
 *      undone, and survives a reload;
 *   5. the model road is behind the routing table: with no token the
 *      card says what would light it and nothing is called; with one it
 *      sends the four sides to the one model that returns a solid, and
 *      the answer lands as a solid with the cube kept underneath.
 *
 * The model in step 5 is a mocked route: what goes up and what lands are
 * measured, and the vendor is never reached from a test.
 *
 *   node tests/box-to-cube.mjs [url]      # default http://localhost:3000
 *
 * Runs alone: reads where a released cube's settling animation leaves it; under load it had not come to rest.
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";
import { isBox, kindOfSketch } from "../src/features/studio/shapeKind.ts";
import { pickCoded } from "../src/features/studio/coded.ts";
import { REST } from "../src/features/studio/shelf/parts/cubeFaces.ts";
import { facing, restFor, nearestRest, PITCH_LIMIT, REST_PITCHES } from "../src/features/studio/shelf/parts/cubePose.ts";
import { makingOf, route } from "../src/features/studio/pictures/imageRoute.ts";
import { SOLID_WORDS, solidModel } from "../src/features/studio/solidRoute.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
/*
 * Where the shots go, and why the default is not the committed ones.
 *
 * This suite photographs what it walks, and it used to default straight at
 * `docs/shots` — so every session that ran the floor rewrote tracked PNGs as
 * a side effect, with byte-level render noise for a diff and nothing visual
 * changed. A merge session had to throw four of them away to avoid pushing
 * that noise over a deliberate refresh.
 *
 * A shot is a deliberate act, so it is asked for by name. The default is the
 * ignored scratch path, where the pictures are still there to look at:
 *
 *   node tests/box-to-cube.mjs                     # writes .screenshots, tree stays clean
 *   SHOTS=docs/shots node tests/box-to-cube.mjs    # refreshes the committed baseline
 *
 * Held by `tests/dead-declarations.mjs`, which fails if any suite points its
 * default back at the tracked directory.
 */
const SHOTS = process.env.SHOTS ?? ".screenshots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const atRest = (x, y) => REST_PITCHES.includes(x) && ((((y - REST.y) % 90) + 90) % 90) === 0;

/* ------------------------------------------------------------------ */
/* 0. The rules, pure                                                   */
/* ------------------------------------------------------------------ */

const RECT = [[0.24, 0.26], [0.76, 0.26], [0.76, 0.74], [0.24, 0.74], [0.24, 0.26]];
const WOBBLY = (() => {
  const out = [];
  for (let i = 0; i <= 60; i++) {
    const t = i / 60; const w = ((i * 7919) % 13) / 13 * 0.02 - 0.01;
    if (t < 0.25) out.push([0.1 + t * 4 * 0.8 + w, 0.1 + w]);
    else if (t < 0.5) out.push([0.9 + w, 0.1 + (t - 0.25) * 4 * 0.8 + w]);
    else if (t < 0.75) out.push([0.9 - (t - 0.5) * 4 * 0.8 + w, 0.9 + w]);
    else out.push([0.1 + w, 0.9 - (t - 0.75) * 4 * 0.8 + w]);
  }
  return out;
})();
const CIRCLE = Array.from({ length: 40 }, (_, i) => { const a = (i / 39) * Math.PI * 2; return [0.5 + Math.cos(a) * 0.4, 0.5 + Math.sin(a) * 0.4]; });

check("a snapped box is a box, off its four corners", isBox({ strokes: [RECT], words: "" }));
check("a wobbly hand-drawn box is a box too", isBox({ strokes: [WOBBLY], words: "" }));
check("a circle is not", !isBox({ strokes: [CIRCLE], words: "" }));
check("a box on its own with nothing said is read as a cube", kindOfSketch({ strokes: [RECT], words: "" }).kind === "cube");
check("a box captioned as something else keeps its words' meaning", kindOfSketch({ strokes: [RECT], words: "the pricing table" }).kind === "surface");
check("a box round parts, or over a real part, is not a cube", kindOfSketch({ strokes: [RECT], words: "" }, "", false).kind === "surface");
{
  const pick = pickCoded({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: null, lone: true });
  check("the catalogue claims a lone box for the cube, with no model", pick?.part.id === "cube" && pick.score >= 0.9, pick ? `${pick.part.id} ${pick.score}` : "nothing");
  const wide = pickCoded({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: { w: 480, h: 200, content: "", prompt: "" }, lone: true });
  const patch = wide.part.configure({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: { w: 480, h: 200, content: "", prompt: "" }, lone: true }).patch;
  check("and keeps the proportion it was drawn at rather than squaring it", patch.w === 480 && patch.h === 200, `${patch.w}×${patch.h}`);
  const small = wide.part.configure({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: { w: 60, h: 40, content: "", prompt: "" }, lone: true }).patch;
  check("a box too small to read is grown in proportion", small.w === 180 && small.h === 120, `${small.w}×${small.h}`);
  check("not claimed when the box is not alone", !pickCoded({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: null, lone: false }));
}
check("the rest pose is a three-quarter view from a little above", REST.x === -18 && REST.y === -32);
check("the three rest pitches are inside the tumble limit", REST_PITCHES.every((p) => Math.abs(p) <= PITCH_LIMIT), REST_PITCHES.join(" "));
check("any angle rests at a rest pose", [[-80, 400], [40, -200], [0, 0]].every(([x, y]) => { const r = nearestRest({ x, y }); return atRest(r.x, r.y); }));
check("the front face is what the rest pose shows", facing(REST) === 0);
check("a quarter turn of yaw brings the left face round, then the back, then the right", [1, 2, 3].map((k) => facing({ x: REST.x, y: REST.y + 90 * k })).join(",") === "3,2,1");
check("looking down on the top is the top, looking up is the bottom", facing({ x: REST_PITCHES[0], y: REST.y }) === 4 && facing({ x: REST_PITCHES[2], y: REST.y }) === 5);
check("asking for the back from the front goes the short way, half a turn", Math.abs(restFor("back", REST).y - REST.y) === 180);
check("the words that route to a solid route to the object cell", makingOf({ said: SOLID_WORDS }) === "object");
/* TRELLIS since 2026-10-12 (tests/pictures-many.mjs): Hunyuan3D 2 gave grey shards, no colour. */
check("and the table's solid model is TRELLIS, shape and colour", solidModel()?.slug === "firtoz/trellis" && route({ making: "object", step: "first", fromImage: true }).model?.slug === "firtoz/trellis", solidModel()?.slug ?? "none");
check("a plain box is never routed to a model by its words alone", makingOf({ said: "a box" }) !== "object");
/* ------------------------------------------------------------------ */
/* The walk                                                            */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const asked = [];
let serverToken = false;
let solidCalls = [];
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ set: { REPLICATE_API_TOKEN: serverToken }, repo: null, branch: "main" }) }));
for (const route of ["**/api/studio/body", "**/api/studio/reshape"]) {
  await page.route(route, (r) => { asked.push(r.request().url().split("/").pop()); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key", message: "no key" }) }); });
}
await page.route("**/api/studio/image", (r) => {
  const body = r.request().postDataJSON();
  asked.push("image");
  if (body?.stage === 2) {
    solidCalls.push({ first: body.first?.length ?? 0, views: (body.views ?? []).map((v) => v.length), said: body.said, model: body.model, w: body.w, h: body.h, key: r.request().headers()["x-replicate-key"] ?? null });
    if (!serverToken) return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, stage: 2, reason: "unavailable", message: "no token" }) });
    const glb = `data:model/gltf-binary;base64,${Buffer.from("glTF-mocked-by-the-suite").toString("base64")}`;
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, stage: 2, solid: true, model: "tencent/hunyuan3d-2mv", name: "Hunyuan3D 2 (multi-view)", making: "object", mesh: { glb, bytes: glb.length, from: "tencent/hunyuan3d-2mv" }, ms: 1234, cost: null }) });
  }
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "no token" }) });
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.removeItem("builder.studio"); localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "snap" }, advanced: false }, version: 0 })); });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const read = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const n = (s.nodes ?? []).find((x) => x.cube);
  return n ? { id: n.id, featureId: n.featureId, kind: n.kind, x: n.x, y: n.y, w: n.w, h: n.h, outline: !!n.outline, code: !!n.code, faces: n.cube?.faces ?? null, turn: n.cube?.turn ?? null, mesh: n.mesh ? { bytes: n.mesh.bytes, from: n.mesh.from, glb: n.mesh.glb.slice(0, 30) } : null } : null;
});
const shot = async (name, clip) => { await page.screenshot({ path: `${SHOTS}/box-to-cube-${name}.png`, ...(clip ? { clip } : {}) }); };
const around = async (loc, pad = 60) => {
  const b = await loc.boundingBox().catch(() => null);
  if (!b) return undefined;
  const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
  const width = Math.min(1500, b.x + b.width + pad) - x, height = Math.min(1000, b.y + b.height + pad) - y;
  return width > 10 && height > 10 ? { x, y, width, height } : undefined;
};

/* 1. A box, drawn with the pen, no words. */
await page.keyboard.press("d");
await page.waitForTimeout(300);
const DRAWN = { x: 520, y: 380, w: 240, h: 180 };
{
  const pts = [[DRAWN.x, DRAWN.y], [DRAWN.x + DRAWN.w, DRAWN.y], [DRAWN.x + DRAWN.w, DRAWN.y + DRAWN.h], [DRAWN.x, DRAWN.y + DRAWN.h], [DRAWN.x, DRAWN.y]];
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { for (let i = 1; i <= 8; i++) { await page.mouse.move(x, y); await page.waitForTimeout(5); } }
  await page.mouse.up();
  await page.waitForTimeout(400);
}
/* The ink's own width on the page, in page pixels: the zoom it was drawn at
   is the one "the size it was drawn" means. The board can fit itself to the
   window again once the pen is put down, so the zoom read after landing is
   not the zoom the person drew at. */
const inkW = await page.evaluate(() => {
  const pen = (JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state?.shapes ?? []).filter((x) => x.kind === "pen");
  const xs = pen.flatMap((p) => p.points.map((q) => q[0]));
  return xs.length ? Math.max(...xs) - Math.min(...xs) : 0;
});
const drawZoom = inkW ? DRAWN.w / inkW : 0;
check("the ink is on the page at the zoom it was drawn at", inkW > 0, `${Math.round(inkW)} page px for ${DRAWN.w} screen px`);
await shot("1-drawn", { x: 300, y: 120, width: 1120, height: 700 });
check("the ink is one drawing with a Make real button", (await page.locator("[data-make-real]").count()) === 1);
await page.locator("[data-make-real]").first().click({ force: true });
let node = null;
for (let i = 0; i < 30; i++) { await page.waitForTimeout(400); node = await read(); if (node) break; }
// The pen is put down: everything after this is handling, not drawing.
await page.keyboard.press("v");
await page.waitForTimeout(200);
check("no question was asked: the box was decided off its geometry", (await page.locator("[data-queue-question]").count()) === 0);
check("the box became the cube part", node?.featureId === "cube-3d", node?.featureId ?? "nothing");
check("marked on the node as a cube, read as a box", node?.kind === "cube", node?.kind ?? "-");
check("no model was called on the way, not even to read the drawing", asked.length === 0, asked.join(" ") || "none");
check("no clip, no traced body: it is code", !node?.outline && !node?.code);
const zoom = await page.evaluate(() => { const el = document.querySelector("[data-node-id]"); return el ? el.getBoundingClientRect().width : 0; }) / (node?.w ?? 1);
{
  const drawnRatio = DRAWN.w / DRAWN.h;
  const ratio = node ? node.w / node.h : 0;
  check("at the proportion it was drawn, not squared", node && Math.abs(ratio - drawnRatio) < 0.06, `drawn ${DRAWN.w}×${DRAWN.h} (${drawnRatio.toFixed(2)}) → part ${node?.w}×${node?.h} (${ratio.toFixed(2)}), board zoom ${zoom.toFixed(3)}`);
  check("at the size it was drawn", node && drawZoom > 0 && Math.abs(node.w * drawZoom - DRAWN.w) < 12, `${Math.round((node?.w ?? 0) * drawZoom)} screen px wide against ${DRAWN.w} drawn, at the zoom it was drawn at (${drawZoom.toFixed(3)}; the board is at ${zoom.toFixed(3)} now)`);
}
const part = page.locator(`[data-node-id="${node.id}"]`);
/*
 * Two presses open a solid for handling; one only selects it.
 *
 * HIS WORDS: "also once i selected something i have to click off and then
 * clicck and hold to drag." A selected cube used to take the pointer, so
 * the press that would have moved it turned it instead. Now selecting is
 * only selecting and the second press is what hands it the pointer and the
 * keys. `tests/selected-drags.mjs` measures both halves.
 */
const openPart = async () => {
  const r = await part.boundingBox();
  await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(600);
};
await openPart();
check("the part chip says what it is: a box, made a cube", (await part.locator("[data-kind-chip=cube]").count()) === 1, await part.locator("[data-kind-chip=cube]").innerText().catch(() => "-"));
const cube = part.locator("[data-cube]").first();
check("the cube stands at the rest pose before anyone touches it", (await cube.getAttribute("data-cube-turn")) === `${REST.x},${REST.y}`, await cube.getAttribute("data-cube-turn"));
{
  const [W, H, D] = (await cube.getAttribute("data-cube-dims")).split("×").map(Number);
  check("…measured: depth is the shorter of width and height", D === Math.min(W, H) && Math.abs(W / H - DRAWN.w / DRAWN.h) < 0.08, `${W}×${H}×${D}`);
}
await shot("2-landed", await around(part, 80));

/* 2. It turns, within limits, and comes to rest. */
const turnOf = async () => (await cube.getAttribute("data-cube-turn")).split(",").map(Number);
/** Wait until it stops moving at a rest pose, or give up after `max` ms. Returns the wait. */
const settle = async (max = 6000) => {
  const from = Date.now();
  let last = await cube.getAttribute("data-cube-turn");
  let still = 0;
  while (Date.now() - from < max) {
    await page.waitForTimeout(120);
    const now = await cube.getAttribute("data-cube-turn");
    still = now === last ? still + 1 : 0;
    last = now;
    const [x, y] = now.split(",").map(Number);
    if (still >= 3 && atRest(x, y)) break;
  }
  return Date.now() - from;
};
{
  const b = await cube.boundingBox();
  const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  const before = await turnOf();
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 16; i++) { await page.mouse.move(cx + i * 7, cy - i * 1); await page.waitForTimeout(16); }
  const mid = await turnOf();
  await page.mouse.up();
  check("dragging turns it, on the board, there and then", mid[1] !== before[1], `${before} → ${mid} over 112 px of drag`);
  const ms = await settle();
  const [x, y] = await turnOf();
  check("let go, it comes to rest at a three-quarter view", atRest(x, y), `${x},${y} after ${ms}ms`);
  check("and where it rests is written on the node", (await read())?.turn?.x === x && (await read())?.turn?.y === y, JSON.stringify((await read())?.turn));
  await shot("3-turned", await around(part, 80));

  // Tumbling: drag a long way up. The pitch stops at the limit.
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  let maxPitch = 0;
  for (let i = 1; i <= 40; i++) { await page.mouse.move(cx, cy - i * 12); await page.waitForTimeout(8); maxPitch = Math.max(maxPitch, Math.abs((await turnOf())[0])); }
  // Photographed with the hand still down, pinned at the limit.
  await shot("3b-pitch-limit-held", await around(part, 80));
  await page.mouse.up();
  check("it cannot be tumbled upside down: 480 px of upward drag pitches it no further than the limit", maxPitch <= PITCH_LIMIT && maxPitch >= 60, `${maxPitch}° of a possible ${Math.round(480 * 0.42)}°, limit ${PITCH_LIMIT}°`);
  await settle();
  const [rx, ry] = await turnOf();
  check("and it returns to a resting pose from there", atRest(rx, ry), `${rx},${ry}`);
  await shot("3c-pitch-limit-rested", await around(part, 80));
}

/* 3. A face is picked and given words; it keeps them through a turn. */
const openElement = async () => {
  const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
  if (await tab.count()) await tab.click().catch(() => {});
  await page.waitForTimeout(250);
};
await openElement();
let side = null;
{
  // Back to the middle row after the tumble, so the middle of the part is
  // a side face and turning round the sides changes what is in front.
  await cube.focus();
  await page.keyboard.press("ArrowUp");
  await settle();
  check("up from the bottom row is the middle row", (await turnOf())[0] === REST.x, (await cube.getAttribute("data-cube-turn")));
  const b = await cube.boundingBox();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(500);
  side = await cube.getAttribute("data-cube-pick");
  check("pressing a face picks it", !!side, side ?? "none");
  check("the picked face wears the mark", (await cube.locator("[data-face-picked]").count()) === 1 && (await cube.locator("[data-face-picked]").getAttribute("data-face")) === side);
  const card = page.locator(`[data-face-list] [data-cube-face="${side}"]`);
  check("the panel marks the same face", (await card.getAttribute("data-face-picked")) !== null);
  const focused = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? "");
  check("and hands it the keys", focused === `${side} heading`, focused || "nothing focused");
  await page.keyboard.type("Hello there");
  await page.waitForTimeout(500);
  const idx = ["front", "right", "back", "left", "top", "bottom"].indexOf(side);
  check("typing puts the words on that face of the node", (await read())?.faces?.[idx]?.heading === "Hello there", (await read())?.faces?.[idx]?.heading ?? "-");
  check("and on the cube itself", (await cube.locator(`[data-face="${side}"]`).innerText()).includes("Hello there"));
  // One undo takes back the edit, not a letter: eleven keystrokes, one press.
  await page.mouse.click(330, 150);
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  check("one undo takes the whole word off the face, not one letter", (await read())?.faces?.[idx]?.heading === "", JSON.stringify((await read())?.faces?.[idx]?.heading));
  await page.keyboard.press("Control+Shift+z");
  await page.waitForTimeout(400);
  check("and one redo puts it back", (await read())?.faces?.[idx]?.heading === "Hello there", (await read())?.faces?.[idx]?.heading ?? "-");
  await shot("4b-face-undo-redo", await around(part, 80));
  await openPart();
  await openElement();
  await page.locator(`[data-face-list] [data-cube-face="${side}"] [data-face-prompt]`).fill("the greeting");
  await page.waitForTimeout(300);
  check("a face takes its own prompt, like any part", (await read())?.faces?.[idx]?.prompt === "the greeting");
  await shot("4-face-written", await around(part, 80));

  // Turn it away and back: the words stay on that face.
  await cube.focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await settle();
  const away = await cube.getAttribute("data-cube-face");
  check("two quarter turns show a different face", away !== side, `${side} → ${away}`);
  check("the words are still on the face they were written on", (await cube.locator(`[data-face="${side}"]`).innerText()).includes("Hello there") && !(await cube.locator(`[data-face="${away}"]`).innerText()).includes("Hello there"));
  await shot("5-turned-away", await around(part, 80));
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await settle();
  check("and turned back, that face is in front again with the words on it", (await cube.getAttribute("data-cube-face")) === side && (await cube.locator(`[data-face="${side}"]`).innerText()).includes("Hello there"), await cube.getAttribute("data-cube-face"));
  check("four quarter turns come back to the same face", await (async () => { await cube.focus(); for (let i = 0; i < 4; i++) { await page.keyboard.press("ArrowRight"); } await settle(); return (await cube.getAttribute("data-cube-face")) === side; })());
  await shot("6-turned-back", await around(part, 80));

  // Picking a face in the panel turns the cube to show it.
  const other = side === "back" ? "front" : "back";
  await page.locator(`[data-face-list] [data-pick-face="${other}"]`).click();
  await settle();
  check("naming a face in the panel turns the cube to show it", (await cube.getAttribute("data-cube-face")) === other, await cube.getAttribute("data-cube-face"));

  // The wheel's pencil edits the picked face.
  const pb = await part.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(650);
  await page.locator('[data-radial] [data-shard="write"]').first().click({ force: true });
  await page.waitForTimeout(500);
  /* The pencil opens on the one box now (tests/one-box.mjs); Words is one press further, under More. */
  await page.locator('[data-radial] [data-shard="more"]').first().click({ force: true });
  await page.waitForTimeout(500);
  await page.locator('[data-radial] [data-shard="words"]').first().click({ force: true });
  await page.waitForTimeout(500);
  const plate = page.locator(`[data-plate-face="${other}"]`);
  check("the wheel's pencil is about the picked face", (await plate.count()) === 1, other);
  await plate.locator("input").fill("From the wheel");
  await page.waitForTimeout(300);
  const oi = ["front", "right", "back", "left", "top", "bottom"].indexOf(other);
  check("and writes on it", (await read())?.faces?.[oi]?.heading === "From the wheel", (await read())?.faces?.[oi]?.heading ?? "-");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(400);
  await page.locator("[data-radial]").first().waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
}

/* 4. Moves, resizes, undoes, survives a reload. */
{
  // Let go of it (press the bare frame, where nothing is), then drag it by the middle.
  await page.mouse.click(330, 150);
  await page.waitForTimeout(300);
  const was = await read();
  const b = await part.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(b.x + b.width / 2 + i * 12, b.y + b.height / 2 + i * 6); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const moved = await read();
  const dx = (moved.x - was.x) * zoom, dy = (moved.y - was.y) * zoom;
  check("the whole object moves like any part", Math.abs(dx - 120) < 14 && Math.abs(dy - 60) < 14, `dragged 120,60 screen px → moved ${dx.toFixed(0)},${dy.toFixed(0)} (snapping allowed)`);
  check("with the words still on it", (await cube.locator(`[data-face="${side}"]`).innerText()).includes("Hello there"));

  const dimsBefore = await cube.getAttribute("data-cube-dims");
  const se = part.locator('[data-resize="se"]');
  const hb = await se.boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(hb.x + hb.width / 2 + i * 10, hb.y + hb.height / 2 + i * 6); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(500);
  const grown = await read();
  check("resizing by the handle grows the part", grown.w > moved.w && grown.h > moved.h, `${moved.w}×${moved.h} → ${grown.w}×${grown.h} for 100,60 screen px`);
  const dimsAfter = await cube.getAttribute("data-cube-dims");
  check("and the object follows the box", dimsAfter !== dimsBefore, `${dimsBefore} → ${dimsAfter}`);
  await shot("7-moved-resized", await around(part, 80));

  await page.mouse.click(330, 150);
  await page.waitForTimeout(300);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  const undone = await read();
  check("undo takes the resize back", undone.w === moved.w && undone.h === moved.h, `${undone.w}×${undone.h}`);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  const undone2 = await read();
  check("and again takes the move back", undone2.x === was.x && undone2.y === was.y, `${undone2.x},${undone2.y}`);
  await page.locator(`[data-node-id="${node.id}"]`).scrollIntoViewIfNeeded().catch(() => {});
  await shot("7b-undone", await around(page.locator(`[data-node-id="${node.id}"]`), 80));
  await page.keyboard.press("Control+Shift+z");
  await page.keyboard.press("Control+Shift+z");
  await page.waitForTimeout(400);

  // The same rule serves the part's own prompt: typed letter by letter, one undo.
  await page.locator(`[data-node-id="${node.id}"]`).click({ force: true });
  await page.waitForTimeout(400);
  await openElement();
  /* The prompt is a folded section of the part's panel (tests/side-panel-g.mjs). */
  { const more = page.locator('[data-part-section="more"]:not([data-open]) > [data-section-head]'); if (await more.count()) { await more.first().click(); await new Promise((r) => setTimeout(r, 300)); } } /* Name, prompt, saving and Make a picture sit under More. */
  const promptSection = page.locator('[data-side-panel] [data-part-section="prompt"]');
  if ((await promptSection.count()) && (await promptSection.getAttribute("data-open")) === null) { await promptSection.locator("[data-section-head]").click(); await page.waitForTimeout(300); }
  const promptBox = page.locator('[data-side-panel] textarea[aria-label="Element prompt"]').first();
  await promptBox.click();
  await page.keyboard.type("three pillars, spinning");
  await page.waitForTimeout(300);
  check("typing a prompt writes it on the part", (await read()) && (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.cube).prompt)) === "three pillars, spinning");
  await page.mouse.click(330, 150);
  await page.waitForTimeout(400);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  const promptAfter = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((n) => n.cube).prompt);
  check("one undo takes the whole prompt back, twenty-three keystrokes in one", promptAfter === "", JSON.stringify(promptAfter));
  const sizeAfter = await read();
  check("and nothing else with it: the size stays", sizeAfter.w === grown.w && sizeAfter.h === grown.h, `${sizeAfter.w}×${sizeAfter.h}`);

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const back = await read();
  const idx = ["front", "right", "back", "left", "top", "bottom"].indexOf(side);
  check("saved and reopened: the cube, its size, its faces and its pose all come back", back?.featureId === "cube-3d" && back.w === grown.w && back.faces?.[idx]?.heading === "Hello there" && atRest(back.turn.x, back.turn.y), JSON.stringify({ w: back?.w, h: back?.h, turn: back?.turn }));
  check("and it is on the board, standing where it was left", (await page.locator("[data-cube]").count()) === 1 && (await page.locator("[data-cube]").getAttribute("data-cube-turn")) === `${back.turn.x},${back.turn.y}`);

  // The blueprint says all of it: the faces, a face's own prompt, the proportion.
  await page.keyboard.press("Control+Enter");
  await page.waitForTimeout(1500);
  const brief = (await page.locator("[data-brief-body]").allInnerTexts()).join("\n");
  check("the blueprint carries the face's words and its own prompt", brief.includes("Hello there") && brief.includes("for: the greeting"), brief.split("\n").find((l) => l.includes("Hello there"))?.slice(0, 120) ?? "not in the brief");
  check("and says the object keeps its drawn proportion", brief.includes(`${back.w} × ${back.h} and as deep as its shorter side`));
  check("and what the drawn box means", brief.includes("a cube: six faces in real 3D"));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(500);
}

/* 5. The model road, behind the table. */
{
  await page.locator(`[data-node-id="${node.id}"]`).click({ force: true });
  await page.waitForTimeout(500);
  await openElement();
  const card = page.locator("[data-solid-card]");
  await card.waitFor({ timeout: 5000 });
  for (let i = 0; i < 20 && (await card.getAttribute("data-solid-ready")) === "asking"; i++) await page.waitForTimeout(150);
  check("with no token, the card is not lit and says what would light it", (await card.getAttribute("data-solid-ready")) === "no" && (await card.locator("[data-solid-needs]").count()) === 1, (await card.locator("[data-solid-needs]").innerText().catch(() => "-")).slice(0, 60));
  check("it names the routed model, read off the same table", (await card.getAttribute("data-solid-model")) === "firtoz/trellis", await card.getAttribute("data-solid-model"));
  // The "Where it goes" card reads the part, not its words: a cube is a solid, in one step, to the same model.
  // It sits under the closed "Make a picture"; opened to be read.
  { const more = page.locator('[data-part-section="more"]:not([data-open]) > [data-section-head]'); if (await more.count()) { await more.first().click(); await new Promise((r) => setTimeout(r, 300)); } } /* Name, prompt, saving and Make a picture sit under More. */
  const pictureFold = page.locator('[data-part-section="make-picture"]').first();
  if ((await pictureFold.count()) && (await pictureFold.getAttribute("data-open")) === null) { await pictureFold.locator("[data-section-head]").click(); await page.waitForTimeout(300); }
  const what = (await page.locator("[data-audit-what]").first().innerText().catch(() => "")).trim();
  const steps = (await page.locator("[data-audit-steps]").first().innerText().catch(() => "")).replace(/\s+/g, " ").trim();
  check("and Where it goes says a solid for a cube, not a mark", what.includes("an object you can turn"), what || "-");
  check("in one step, with no reading of words it does not have", !/read/i.test(steps) && /first|one/i.test(steps), steps || "-");
  check("and nothing was sent anywhere to find that out", solidCalls.length === 0 && asked.length === 0, asked.join(" ") || "none");
  await card.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot("8-solid-unlit", await around(card, 30));

  // A token appears (the server's, here): the road lights up.
  serverToken = true;
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  await page.locator(`[data-node-id="${node.id}"]`).click({ force: true });
  await page.waitForTimeout(500);
  await openElement();
  const lit = page.locator("[data-solid-card]");
  for (let i = 0; i < 20 && (await lit.getAttribute("data-solid-ready")) !== "yes"; i++) await page.waitForTimeout(150);
  check("the moment a token is present the road lights up", (await lit.getAttribute("data-solid-ready")) === "yes" && (await lit.locator("[data-solid-make]").count()) === 1);
  await lit.scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  await shot("9-solid-lit", await around(lit, 30));
  await lit.locator("[data-solid-make]").click();
  for (let i = 0; i < 40 && !solidCalls.length; i++) await page.waitForTimeout(150);
  const call = solidCalls[0];
  check("one call went up the image route at stage two", !!call && solidCalls.length === 1);
  check("carrying the front and three more views, drawn off the cube's own faces", call && call.first > 1000 && call.views.length === 3 && call.views.every((v) => v > 1000), call ? `front ${call.first} b64 chars, views ${call.views.join(", ")}` : "-");
  check("with words that route to the object cell", call && makingOf({ said: call.said }) === "object" && call.model === "firtoz/trellis", call?.said);
  check("no key in any field: the token rides as a header from the keys panel or sits on the server", call && !call.key && !JSON.stringify(call).includes("REPLICATE"), call?.key ?? "no header (server token)");
  for (let i = 0; i < 40 && (await read())?.featureId !== "mesh-3d"; i++) await page.waitForTimeout(150);
  const solid = await read();
  check("the answer lands as a solid part", solid?.featureId === "mesh-3d" && solid.mesh?.from === "tencent/hunyuan3d-2mv", solid?.featureId);
  check("with the cube kept underneath, faces and all", solid?.faces?.[["front", "right", "back", "left", "top", "bottom"].indexOf(side)]?.heading === "Hello there" && solid.kind === "cube");
  // The still under it is the object, not one blank face: measured as how
  // many distinct colours the picture holds and whether its two halves differ.
  const still = await page.evaluate(async () => {
    const n = JSON.parse(localStorage.getItem("builder.studio")).state.nodes.find((x) => x.cube);
    const src = n?.mesh?.still;
    if (!src) return null;
    const img = new Image();
    await new Promise((ok, no) => { img.onload = ok; img.onerror = no; img.src = src; });
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height;
    const c = cv.getContext("2d"); c.drawImage(img, 0, 0);
    const d = c.getImageData(0, 0, cv.width, cv.height).data;
    const colours = new Set();
    for (let i = 0; i < d.length; i += 16) colours.add(`${d[i] >> 3},${d[i + 1] >> 3},${d[i + 2] >> 3}`);
    return { w: img.width, h: img.height, colours: colours.size, bytes: src.length };
  });
  check("the still under the solid is a picture of the object, not a blank plate", !!still && still.colours >= 6, still ? `${still.w}×${still.h}, ${still.colours} distinct colours (at 5 bits), ${still.bytes} chars` : "no still");
  await page.waitForTimeout(600);
  await shot("10-solid-landed", await around(page.locator(`[data-node-id="${node.id}"]`), 80));
  const backBtn = page.locator("[data-solid-back]");
  check("and back to the cube is one press", (await backBtn.count()) === 1);
  await backBtn.click();
  await page.waitForTimeout(500);
  check("which brings the cube back with nothing lost", (await read())?.featureId === "cube-3d" && (await page.locator("[data-cube]").count()) === 1);
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
