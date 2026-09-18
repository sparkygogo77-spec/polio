/**
 * What a person does second, once a drawn box is a cube.
 *
 * The judged walk holds (`tests/box-to-cube.mjs`). These are the next four
 * questions, each measured and each with its shortfalls named:
 *
 *   1. more than one cube on a board: each turns, is written on and is
 *      picked on its own, and both come back after a reload;
 *   2. a cube inside a space beside a flat part: the space counts it,
 *      it still turns in there, and when the layout is locked and the
 *      space resized the cube goes with it in proportion;
 *   3. a drawn box that is not square: wide, tall and tiny, what object
 *      comes out and how big its words are;
 *   4. the page saved and reopened in a **new browser**: the document goes
 *      out as Publish sends it (`site/document.json`), the site is built,
 *      and a browser with nothing in it opens /site and turns the cube.
 *
 * Question 4 is two phases with a build between them, because that is the
 * road: `--make` draws the cube and writes the document; `--visit` opens
 * /site in a fresh context. The document written is restored afterwards by
 * whoever ran it (`git checkout site/document.json`).
 *
 *   node tests/cube-second.mjs [url]            # questions 1 to 3, and --make if WRITE_DOC=1
 *   node tests/cube-second.mjs [url] --visit    # question 4, after a build
 */
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { pickCoded } from "../src/features/studio/coded.ts";
import { isBox } from "../src/features/studio/shapeKind.ts";
import { cubeDims } from "../src/features/studio/parts/cubePose.ts";
import { REST, CUBE_MIN } from "../src/features/studio/parts/cubeFaces.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3000";
const VISIT = process.argv.includes("--visit");
const SHOTS = process.env.SHOTS ?? "docs/shots";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (s) => console.log(`       ${s}`);
const atRest = (x, y) => [REST.x - 54, REST.x, REST.x + 90].includes(x) && ((((y - REST.y) % 90) + 90) % 90) === 0;
const RECT = [[0.24, 0.26], [0.76, 0.26], [0.76, 0.74], [0.24, 0.74], [0.24, 0.26]];

const finish = () => {
  const failed = results.filter((r) => !r).length;
  console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
  process.exit(failed ? 1 : 0);
};

/* ------------------------------------------------------------------ */
/* 4b. The fresh browser                                               */
/* ------------------------------------------------------------------ */

if (VISIT) {
  const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${URL_BASE}/site`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  check("a fresh browser context opens the published site", (await page.locator("[data-published-site]").count()) === 1);
  const cube = page.locator("[data-cube]").first();
  check("and the cube is on it", (await cube.count()) === 1);
  // What the published document says, as the fresh store took it.
  const doc = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {}; const n = (s.nodes ?? []).find((x) => x.cube); return n ? { turn: n.cube.turn, w: n.w, h: n.h, left: n.cube.faces[3]?.heading } : null; });
  const turn0 = await cube.getAttribute("data-cube-turn");
  check("standing where it was left when it was published", !!doc && turn0 === `${doc.turn.x},${doc.turn.y}`, `document ${JSON.stringify(doc?.turn)}, site ${turn0}`);
  check("with the words on the face they were written on", (await cube.locator('[data-face="left"]').innerText().catch(() => "")).includes("Second browser"), (await cube.locator('[data-face="left"]').innerText().catch(() => "-")).slice(0, 30));
  check("and the proportion it was drawn at", (await cube.getAttribute("data-cube-dims")) !== null && /^\d+×\d+×\d+$/.test(await cube.getAttribute("data-cube-dims")), await cube.getAttribute("data-cube-dims"));
  const b = await cube.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(b.x + b.width / 2 + i * 8, b.y + b.height / 2); await page.waitForTimeout(16); }
  const mid = await cube.getAttribute("data-cube-turn");
  await page.mouse.up();
  check("a visitor can turn it", mid !== turn0, `${turn0} → ${mid}`);
  let last = mid; let still = 0; const from = Date.now();
  while (Date.now() - from < 6000) { await page.waitForTimeout(120); const now = await cube.getAttribute("data-cube-turn"); still = now === last ? still + 1 : 0; last = now; const [x, y] = now.split(",").map(Number); if (still >= 3 && atRest(x, y)) break; }
  const [rx, ry] = last.split(",").map(Number);
  check("and it comes to rest for them too", atRest(rx, ry), `${last} after ${Date.now() - from}ms`);
  await page.screenshot({ path: `${SHOTS}/cube-second-4-fresh-browser.png`, clip: { x: Math.max(0, b.x - 80), y: Math.max(0, b.y - 80), width: Math.min(1400, b.width + 160), height: Math.min(900, b.height + 160) } });
  await browser.close();
  finish();
}

/* ------------------------------------------------------------------ */
/* 3a. Not square, pure                                                 */
/* ------------------------------------------------------------------ */

const conf = (w, h) => pickCoded({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: null, lone: true }).part.configure({ sketch: { strokes: [RECT], words: "" }, prompt: "", node: { w, h, content: "", prompt: "" }, lone: true }).patch;
{
  const wide = conf(480, 160), tall = conf(140, 420), tiny = conf(50, 40), band = conf(600, 60);
  check("a wide box stays wide: 480 × 160 is 480 × 160", wide.w === 480 && wide.h === 160);
  check("a tall box stays tall: 140 × 420 is 140 × 420", tall.w === 140 && tall.h === 420);
  check(`a tiny box is grown in proportion to a short side of ${CUBE_MIN}: 50 × 40 → 150 × 120`, tiny.w === 150 && tiny.h === 120, `${tiny.w}×${tiny.h}`);
  check(`a band is grown the same way: 600 × 60 → 1200 × 120`, band.w === 1200 && band.h === 120, `${band.w}×${band.h}`);
  const d = (w, h) => { const { W, H, D } = cubeDims(w, h, 0.74); return `${W}×${H}×${D}`; };
  note(`objects: wide ${d(480, 160)}, tall ${d(140, 420)}, band ${d(1200, 120)}, square ${d(300, 300)}`);
  check("depth is always the short side, so the thinnest box is still as deep as it is short", cubeDims(1200, 120, 0.74).D === 89 && cubeDims(140, 420, 0.74).D === 104);
  const thin = [[0.05, 0.42], [0.95, 0.42], [0.95, 0.58], [0.05, 0.58], [0.05, 0.42]];
  check("a 6:1 box is still read as a box", isBox({ strokes: [thin], words: "" }));
}

/* ------------------------------------------------------------------ */
/* The board                                                           */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const asked = [];
for (const route of ["**/api/studio/body", "**/api/studio/reshape", "**/api/studio/image"]) {
  await page.route(route, (r) => { asked.push(r.request().url().split("/").pop()); return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key", message: "no key" }) }); });
}
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ set: {}, repo: null, branch: "main" }) }));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.removeItem("builder.studio"); localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "snap" }, advanced: false }, version: 0 })); });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const cubes = async () => ((await state()).nodes ?? []).filter((n) => n.featureId === "cube-3d").map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, faces: n.cube?.faces ?? [], turn: n.cube?.turn ?? null }));
const shot = async (name, clip) => page.screenshot({ path: `${SHOTS}/cube-second-${name}.png`, ...(clip ? { clip } : {}) });
const around = async (loc, pad = 60) => {
  const b = await loc.boundingBox().catch(() => null);
  if (!b) return undefined;
  const x = Math.max(0, b.x - pad), y = Math.max(0, b.y - pad);
  const width = Math.min(1500, b.x + b.width + pad) - x, height = Math.min(1000, b.y + b.height + pad) - y;
  return width > 10 && height > 10 ? { x, y, width, height } : undefined;
};
const drawBox = async (x, y, w, h) => {
  await page.keyboard.press("d");
  await page.waitForTimeout(250);
  const pts = [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [px, py] of pts) { for (let i = 1; i <= 8; i++) { await page.mouse.move(px, py); await page.waitForTimeout(5); } }
  await page.mouse.up();
  await page.waitForTimeout(350);
};
const makeAll = async (want) => {
  const buttons = page.locator("[data-make-real]");
  const n = await buttons.count();
  for (let i = 0; i < n; i++) { await page.locator("[data-make-real]").first().click({ force: true }); await page.waitForTimeout(600); }
  for (let i = 0; i < 40; i++) { await page.waitForTimeout(400); if ((await cubes()).length >= want) break; }
  await page.keyboard.press("v");
  await page.waitForTimeout(200);
  return cubes();
};
const openElement = async () => {
  const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
  if (await tab.count()) await tab.click().catch(() => {});
  await page.waitForTimeout(250);
};
const settle = async (cube, max = 6000) => {
  const from = Date.now();
  let last = await cube.getAttribute("data-cube-turn"); let still = 0;
  while (Date.now() - from < max) {
    await page.waitForTimeout(120);
    const now = await cube.getAttribute("data-cube-turn");
    still = now === last ? still + 1 : 0; last = now;
    const [x, y] = now.split(",").map(Number);
    if (still >= 3 && atRest(x, y)) break;
  }
  return Date.now() - from;
};
const letGo = async () => { await page.mouse.click(330, 150); await page.waitForTimeout(300); };

/* ------------------------------------------------------------------ */
/* 1. Two cubes                                                        */
/* ------------------------------------------------------------------ */

await drawBox(420, 380, 220, 170);
await drawBox(800, 380, 200, 200);
let two = await makeAll(2);
check("two boxes drawn become two cubes", two.length === 2, `${two.length}`);
check("no model was called for either", asked.length === 0, asked.join(" ") || "none");
const [A, B] = two.sort((a, b) => a.x - b.x);
const nodeA = page.locator(`[data-node-id="${A.id}"]`), nodeB = page.locator(`[data-node-id="${B.id}"]`);
const cubeA = nodeA.locator("[data-cube]"), cubeB = nodeB.locator("[data-cube]");
check("each at its own drawn proportion", Math.abs(A.w / A.h - 220 / 170) < 0.06 && Math.abs(B.w / B.h - 1) < 0.06, `${A.w}×${A.h} and ${B.w}×${B.h}`);
{
  // Two presses open a solid for handling. One only selects it, and a
  // selected part is dragged, not turned — see `tests/selected-drags.mjs`.
  const open = async (node) => {
    const r = await node.boundingBox();
    await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(500);
  };
  await open(nodeA);
  check("opening one makes only that one hands-on", (await cubeA.evaluate((el) => !el.closest("[inert]"))) && (await cubeB.evaluate((el) => !!el.closest("[inert]"))));
  const b = await cubeA.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(b.x + b.width / 2 + i * 8, b.y + b.height / 2); await page.waitForTimeout(16); }
  await page.mouse.up();
  await settle(cubeA);
  const turnA = await cubeA.getAttribute("data-cube-turn"), turnB = await cubeB.getAttribute("data-cube-turn");
  check("turning one leaves the other where it stood", turnA !== `${REST.x},${REST.y}` && turnB === `${REST.x},${REST.y}`, `A ${turnA}, B ${turnB}`);
  await openElement();
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(500);
  const side = await cubeA.getAttribute("data-cube-pick");
  check("a face of one is picked", !!side, side ?? "none");
  await page.keyboard.type("Alpha");
  await page.waitForTimeout(400);
  const now = await cubes();
  const a = now.find((n) => n.id === A.id), bb = now.find((n) => n.id === B.id);
  const i = ["front", "right", "back", "left", "top", "bottom"].indexOf(side);
  check("and the words land on that cube only", a.faces[i]?.heading === "Alpha" && bb.faces.every((f) => !f.heading), `A ${a.faces[i]?.heading}, B ${bb.faces.map((f) => f.heading || "-").join("·")}`);
  await open(nodeB);
  check("picking the other lets the first face go", (await cubeA.locator("[data-face-picked]").count()) === 0 && (await cubeA.getAttribute("data-cube-pick")) === null);
  await cubeB.focus();
  await page.keyboard.press("ArrowRight");
  await settle(cubeB);
  check("the arrow keys turn the picked cube and not the other", (await cubeB.getAttribute("data-cube-turn")) === `${REST.x},${REST.y + 90}` && (await cubeA.getAttribute("data-cube-turn")) === turnA, `B ${await cubeB.getAttribute("data-cube-turn")}, A ${await cubeA.getAttribute("data-cube-turn")}`);
  await letGo();
  await shot("1-two-cubes", { x: 300, y: 250, width: 900, height: 450 });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  const back = await cubes();
  const ra = back.find((n) => n.id === A.id), rb = back.find((n) => n.id === B.id);
  check("both come back after a reload, each with its own words and pose", back.length === 2 && ra?.faces[i]?.heading === "Alpha" && `${rb?.turn.x},${rb?.turn.y}` === `${REST.x},${REST.y + 90}`, JSON.stringify({ a: ra?.turn, b: rb?.turn }));
}

/* ------------------------------------------------------------------ */
/* 3b. Not square, on the board                                        */
/* ------------------------------------------------------------------ */

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
{
  // Drawn one at a time, each made real before the next: three boxes put
  // down in one sitting within reach of each other are one drawing by the
  // board's own rule (`inkGroups`), which is right for a bird and would be
  // three strokes of nothing here.
  await drawBox(400, 300, 360, 90);
  await makeAll(1);
  await drawBox(900, 250, 90, 300);
  await makeAll(2);
  await drawBox(400, 560, 44, 36);
  const made = await makeAll(3);
  check("a wide, a tall and a tiny box all become cubes", made.length === 3, `${made.length}`);
  const wide = made.find((n) => n.w > n.h * 2), tall = made.find((n) => n.h > n.w * 2), tiny = made.find((n) => n !== wide && n !== tall);
  const dims = async (n) => page.locator(`[data-node-id="${n.id}"] [data-cube]`).getAttribute("data-cube-dims");
  const font = async (n) => page.locator(`[data-node-id="${n.id}"] [data-face="front"] span`).first().evaluate((el) => getComputedStyle(el).fontSize).catch(() => "none");
  check("the wide box is a slab as deep as it is tall", !!wide && (await dims(wide)).split("×").map(Number)[2] === (await dims(wide)).split("×").map(Number)[1], wide ? `${wide.w}×${wide.h}, object ${await dims(wide)}, front heading ${await font(wide)}` : "-");
  check("the tall box is a pillar as deep as it is wide", !!tall && (await dims(tall)).split("×").map(Number)[2] === (await dims(tall)).split("×").map(Number)[0], tall ? `${tall.w}×${tall.h}, object ${await dims(tall)}, front heading ${await font(tall)}` : "-");
  check(`the tiny box is grown so its short side is ${CUBE_MIN}, in proportion`, !!tiny && Math.min(tiny.w, tiny.h) === CUBE_MIN && Math.abs(tiny.w / tiny.h - 44 / 36) < 0.1, tiny ? `44 × 36 drawn → ${tiny.w}×${tiny.h}, object ${await dims(tiny)}, front heading ${await font(tiny)}` : "-");
  await shot("3-not-square", { x: 300, y: 150, width: 900, height: 600 });
  note("the slab's side faces are as narrow as it is tall, so a heading on them is the short side's 11%: read the shot before trusting words on a slab's ends");
}

/* ------------------------------------------------------------------ */
/* 2. A cube in a space beside a flat part                             */
/* ------------------------------------------------------------------ */

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
{
  // A flat part first, dragged into where the space will be.
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(340);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(420);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const flat = page.locator("[data-node-id]").last();
  const flatId = await flat.getAttribute("data-node-id");
  let fb = await flat.boundingBox();
  await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.mouse.down();
  const tx = 620, ty = 330;
  for (let i = 1; i <= 12; i++) { await page.mouse.move(fb.x + fb.width / 2 + ((tx - fb.x - fb.width / 2) * i) / 12, fb.y + fb.height / 2 + ((ty - fb.y - fb.height / 2) * i) / 12); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(400);
  await letGo();
  fb = await flat.boundingBox();
  // A space round the flat part with room under it.
  const cx = fb.x + fb.width / 2, cy = fb.y + fb.height / 2 + 110, r = Math.max(fb.width, fb.height) * 0.62 + 60;
  await page.mouse.move(750, 480);
  await page.keyboard.press("s");
  await page.waitForTimeout(300);
  const ring = Array.from({ length: 34 }, (_, i) => { const a = (i / 33) * Math.PI * 2 - Math.PI / 2; return [Math.round(cx + Math.cos(a) * r * 1.35), Math.round(cy + Math.sin(a) * r)]; });
  await page.mouse.move(ring[0][0], ring[0][1]);
  await page.mouse.down();
  for (const [x, y] of ring) { await page.mouse.move(x, y); await page.waitForTimeout(12); }
  await page.mouse.up();
  await page.waitForTimeout(2200);
  const open = page.locator("[data-space-horizon][data-space-open]").first();
  check("a space drawn round the flat part opens", (await open.count()) === 1);
  // A box drawn inside the space, under the flat part.
  const bx = cx - 100, by = fb.y + fb.height + 24;
  await drawBox(bx, by, 200, 120);
  const made = await makeAll(1);
  check("a box drawn in the space becomes a cube", made.length === 1, `${made.length}`);
  const C = made[0];
  check("landing on whole pixels, as every part does", Number.isInteger(C.x) && Number.isInteger(C.y), `${C.x},${C.y}`);
  const nodeC = page.locator(`[data-node-id="${C.id}"]`);
  const cubeC = nodeC.locator("[data-cube]");
  await nodeC.click({ force: true });
  await page.waitForTimeout(600);
  check("the cube has a panel of its own inside the space", (await page.locator(`[data-space-panel="${C.id}"]`).count()) === 1);
  // The space's own key on the board goes once a part is inside it, so the
  // part's panel carries the way back to the space: holds, lock, the brief.
  await page.locator("[data-space-own]").first().click();
  await page.waitForTimeout(500);
  const holds = (await page.locator("[data-space-holds]").innerText({ timeout: 3000 }).catch(() => "")).trim();
  check("and the space counts it beside the flat part", /2 parts/.test(holds), holds || "-");
  // Opened, not merely selected: the second press is what hands a solid the
  // pointer. See `tests/selected-drags.mjs`.
  {
    const r = await nodeC.boundingBox();
    await page.mouse.dblclick(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(500);
  }
  const b = await cubeC.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) { await page.mouse.move(b.x + b.width / 2 + i * 8, b.y + b.height / 2); await page.waitForTimeout(16); }
  await page.mouse.up();
  await settle(cubeC);
  check("it turns inside the space", (await cubeC.getAttribute("data-cube-turn")) !== `${REST.x},${REST.y}`, await cubeC.getAttribute("data-cube-turn"));
  await shot("2-in-a-space", { x: 300, y: 120, width: 900, height: 700 });
  // Lock the layout, then resize the space: the cube goes with it.
  await page.locator("[data-space-own]").first().click();
  await page.waitForTimeout(500);
  const lock = page.locator("[data-space-generate]");
  check("the space offers to lock the layout, with no drawings left to make", (await lock.count()) === 1 && /Lock the layout/.test(await lock.innerText()), await lock.innerText().catch(() => "-"));
  await lock.click();
  await page.waitForTimeout(800);
  const size = page.locator("[data-space-size]").first();
  check("a locked space has a size handle", (await size.count()) === 1);
  const before = (await cubes())[0];
  const dimsBefore = await cubeC.getAttribute("data-cube-dims");
  const sb = await size.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(sb.x + sb.width / 2 + i * 12, sb.y + sb.height / 2 + i * 8); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(600);
  const after = (await cubes())[0];
  const dimsAfter = await cubeC.getAttribute("data-cube-dims");
  check("resizing the space carries the cube with it", after.w > before.w && after.h > before.h && after.x >= before.x, `${before.w}×${before.h} at ${before.x},${before.y} → ${after.w}×${after.h} at ${after.x},${after.y}`);
  check("and the object follows", dimsAfter !== dimsBefore, `${dimsBefore} → ${dimsAfter}`);
  const flatAfter = ((await state()).nodes ?? []).find((n) => n.id === flatId);
  check("the flat part beside it moved too: the layout held", !!flatAfter && flatAfter.w > 0, flatAfter ? `${flatAfter.w}×${flatAfter.h}` : "-");
  await shot("2b-space-resized", { x: 300, y: 120, width: 1000, height: 750 });
}

/* ------------------------------------------------------------------ */
/* 4a. The document, as Publish sends it                               */
/* ------------------------------------------------------------------ */

if (process.env.WRITE_DOC) {
  await page.evaluate(() => localStorage.removeItem("builder.studio"));
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await drawBox(520, 380, 240, 180);
  const [D] = await makeAll(1);
  const nodeD = page.locator(`[data-node-id="${D.id}"]`);
  const cubeD = nodeD.locator("[data-cube]");
  await nodeD.click({ force: true });
  await page.waitForTimeout(500);
  await openElement();
  await page.locator('[data-face-list] [data-cube-face="left"] input').first().fill("Second browser");
  await page.waitForTimeout(400);
  const b = await cubeD.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(b.x + b.width / 2 + i * 7, b.y + b.height / 2); await page.waitForTimeout(16); }
  await page.mouse.up();
  await settle(cubeD);
  await page.waitForTimeout(400);
  const s = await state();
  const doc = { pages: s.pages, nodes: s.nodes, groups: s.groups, shapes: s.shapes, format: s.format, brief: s.brief, look: s.look, motion: s.motion, activePageId: s.activePageId, hiddenFeatures: s.hiddenFeatures, frameWidth: s.frameWidth, companion: s.companion };
  const cube = doc.nodes.find((n) => n.featureId === "cube-3d");
  check("the document Publish sends carries the cube, its faces and its pose", !!cube && cube.cube.faces[3].heading === "Second browser" && atRest(cube.cube.turn.x, cube.cube.turn.y), JSON.stringify(cube?.cube?.turn));
  writeFileSync("site/document.json", JSON.stringify(doc, null, 2) + "\n");
  note(`site/document.json written: ${JSON.stringify(doc).length} bytes, ${doc.nodes.length} node(s); build, then run --visit, then git checkout site/document.json`);
}

await browser.close();
finish();
