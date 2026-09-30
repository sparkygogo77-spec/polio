/**
 * The 3D kind: a drawing that becomes a thing you can turn.
 *
 * The oldest unkept promise on this project was a box drawn on the board
 * coming back as a flat cutout. Two roads out of that, and they are not the
 * same road:
 *
 *   · a **box** is the catalogue's own cube — six faces, editable, turnable,
 *     no model called and nothing charged — and it is claimed off the
 *     geometry and the words before anything reaches a model;
 *   · a box that nobody claimed is no longer silent about the cube it
 *     nearly was, because the guess is too risky to take and not too risky
 *     to offer;
 *   · anything **else** that asks to be turnable becomes a real mesh,
 *     mounted in a viewer that turns with the pointer and the arrow keys
 *     and remembers where it was left.
 *
 * The model is stubbed: there is no Replicate token in this container and
 * there is not meant to be one. What is not stubbed is the drawing, the
 * queue, the routing, the part, the GL context or the turning.
 *
 *   node tests/solid.mjs [url]        # default http://localhost:3000
 *
 * Runs alone: drags a solid and reads the turn written after it settles; under load the drawing's queue was read mid-run.
 */
import { chromium } from "playwright-core";
import { isSolid, makingOf } from "../src/features/studio/imageRoute.ts";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** A pyramid, as glTF 2.0 binary. Built here so the suite carries no fixture. */
function pyramid() {
  const verts = [[-0.5, -0.4, -0.5], [0.5, -0.4, -0.5], [0.5, -0.4, 0.5], [-0.5, -0.4, 0.5], [0, 0.6, 0]];
  const idx = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 2, 1, 0, 3, 2];
  const vbuf = Buffer.concat(verts.map((v) => { const b = Buffer.alloc(12); v.forEach((n, i) => b.writeFloatLE(n, i * 4)); return b; }));
  const ibuf = Buffer.alloc(idx.length * 2);
  idx.forEach((n, i) => ibuf.writeUInt16LE(n, i * 2));
  const bin = Buffer.concat([vbuf, ibuf, Buffer.alloc((4 - (ibuf.length % 4)) % 4)]);
  const gltf = {
    asset: { version: "2.0" }, scene: 0, scenes: [{ nodes: [0] }], nodes: [{ mesh: 0 }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
    materials: [{ pbrMetallicRoughness: { baseColorFactor: [0.72, 0.94, 0.23, 1], metallicFactor: 0.1, roughnessFactor: 0.5 } }],
    accessors: [
      { bufferView: 0, componentType: 5126, count: verts.length, type: "VEC3", min: [-0.5, -0.4, -0.5], max: [0.5, 0.6, 0.5] },
      { bufferView: 1, componentType: 5123, count: idx.length, type: "SCALAR" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: vbuf.length, target: 34962 },
      { buffer: 0, byteOffset: vbuf.length, byteLength: ibuf.length, target: 34963 },
    ],
    buffers: [{ byteLength: bin.length }],
  };
  let j = Buffer.from(JSON.stringify(gltf));
  j = Buffer.concat([j, Buffer.alloc((4 - (j.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12);
  head.write("glTF", 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(12 + 8 + j.length + 8 + bin.length, 8);
  const jh = Buffer.alloc(8); jh.writeUInt32LE(j.length, 0); jh.write("JSON", 4);
  const bh = Buffer.alloc(8); bh.writeUInt32LE(bin.length, 0); bh.write("BIN\0", 4);
  return Buffer.concat([head, jh, j, bh, bin]).toString("base64");
}
const GLB = pyramid();

const b = await chromium.launch({
  executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium",
  // Software GL, because this runs where there is no card.
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});
const page = await b.newPage({ viewport: { width: 1300, height: 950 } });

/* Claude and the models, answered at the edge. Everything else is real. */
await page.route("**/api/studio/reshape", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, patch: { featureId: "custom-idea", label: "Drawn", w: 360, h: 360, note: "an idea, drawn" }, usage: { model: "stub" } }) }));
const asked = [];
await page.route("**/api/studio/image", (r) => {
  const body = JSON.parse(r.request().postData() ?? "{}");
  asked.push(body);
  if (Number(body.stage) === 2) {
    /*
     * The *decision* is the real one — the same two questions the route
     * asks, off the same table — and only the model's pixels are faked. A
     * stub that handed back a solid whatever was asked would prove the
     * viewer and nothing about the routing.
     */
    const making = makingOf({ kind: body.kind, role: body.role ?? null, said: body.said, w: body.w, h: body.h });
    if (!isSolid(making)) {
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        ok: true, stage: 2, model: "openai/gpt-image-2", name: "GPT Image 2", making,
        html: `<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFUlEQVR4nGP8z8Dwn4EIwESMokGmEADbCwEjxtqm4wAAAABJRU5ErkJggg==" alt="" style="display:block;width:100%;height:100%;object-fit:cover;">`,
        image: "data:image/png;base64,iVBORw0KGgo=", ms: 3100, cost: null }) });
    }
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, stage: 2, model: "tencent/hunyuan3d-2mv", name: "Hunyuan3D 2 (multi-view)", making: "object",
      solid: true, mesh: { glb: `data:model/gltf-binary;base64,${GLB}`, bytes: GLB.length, from: "tencent/hunyuan3d-2mv" },
      ms: 21400, cost: null }) });
  }
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    ok: true, kind: "vectorize", cost: 0.08, model: "recraft-ai/recraft-vectorize", stripped: [],
    html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><rect x="12" y="12" width="76" height="76" fill="none" stroke="#b8ff24" stroke-width="6"/></svg>` }) });
});

await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 }));
  localStorage.setItem("builder.keys.plain", JSON.stringify({ ANTHROPIC_API_KEY: "sk-ant-stub", REPLICATE_API_TOKEN: "r8_stub" }));
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const seg = (a, z, n = 10) => Array.from({ length: n }, (_, i) => [a[0] + (z[0] - a[0]) * (i + 1) / n, a[1] + (z[1] - a[1]) * (i + 1) / n]);
const SQUARE = [[[0.25, 0.25], ...seg([0.25, 0.25], [0.75, 0.25]), ...seg([0.75, 0.25], [0.75, 0.75]), ...seg([0.75, 0.75], [0.25, 0.75]), ...seg([0.25, 0.75], [0.25, 0.25])]];

/* The question the last drawing raised, if it raised one. */
let lastAsked = null;

/**
 * One drawing, made real.
 *
 * `answer` is for the one question an ambiguous drawing now raises before
 * anything is spent (`oddness.ts`): a bare box is asked whether it is a
 * cube, and nothing runs until somebody says. A drawing with words beside
 * it is never asked, so most of these pass no answer at all.
 */
const draw = async (strokes, words, answer) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(400);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(500);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(1200);
  const pb = await page.locator("[data-node-id]").last().boundingBox();
  if (!pb) return null;
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(700);
  await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
  await page.waitForTimeout(1300);
  const on = await page.locator("[data-draw-board]").boundingBox();
  for (const s of strokes) {
    await page.mouse.move(on.x + s[0][0] * on.width, on.y + s[0][1] * on.height);
    await page.mouse.down();
    for (const [x, y] of s) { await page.mouse.move(on.x + x * on.width, on.y + y * on.height); await page.waitForTimeout(4); }
    await page.mouse.up();
    await page.waitForTimeout(160);
  }
  await page.locator("[data-draw-words]").fill(words);
  await page.keyboard.press("Enter");
  /*
   * A drawing that raises a question stops before anything is spent, and
   * this waits it out rather than walking past it.
   *
   * `oddness.ts` gave the run a third resting state: a job that is `asking`
   * is neither running nor waiting, so the loop below used to see a quiet
   * queue and go on to read a part that was never made — every check after
   * it reading null off a drawing still sitting behind an unanswered
   * question. The question is answered here instead: with `answer` when one
   * is named, and otherwise by waving it on, which is what these drawings
   * mean — they say in words what they are, and the default keeps every
   * call that predates the question saying exactly what it said before.
   */
  lastAsked = null;
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    // A job that stopped to ask waits on a person, not on the queue. What it
    // asked is kept, so a later check can say the box was asked about a cube
    // rather than only that something was asked.
    const q = page.locator("[data-queue-question]").first();
    if (await q.count()) {
      lastAsked = {
        ask: await q.getAttribute("aria-label"),
        choices: await q.locator("[data-queue-answer]").evaluateAll((els) => els.map((e) => e.getAttribute("data-queue-answer")).filter(Boolean)),
      };
      await page.locator(answer === undefined ? '[data-queue-answer=""]' : `[data-queue-answer="${answer}"]`).first().click();
      await page.waitForTimeout(900);
      continue;
    }
    if (await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
      return (s.queue ?? []).every((j) => j.status !== "running" && j.status !== "waiting" && j.status !== "asking");
    })) break;
  }
  await page.waitForTimeout(1400);
  return page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
    const n = (s.nodes ?? [])[(s.nodes ?? []).length - 1];
    const t = (s.threads ?? [])[(s.threads ?? []).length - 1];
    return { id: n?.id, featureId: n?.featureId,
      faces: (n?.cube?.faces ?? []).filter((f) => f.heading).map((f) => f.heading),
      mesh: n?.mesh ? { bytes: n.mesh.bytes, from: n.mesh.from, still: !!n.mesh.still, turn: n.mesh.turn } : null,
      changes: t?.changes ?? [], passes: t?.usage?.passes ?? [] };
  });
};

/* ------------------------------------------------------------------ */
/* 1. A box is the catalogue's cube, and costs nothing                 */
/* ------------------------------------------------------------------ */

const cube = await draw(SQUARE, "a cube: Speed, Proof, Reach");
check("a drawn box that says cube becomes the real cube", cube?.featureId === "cube-3d", cube?.featureId);
check("with the words on its faces, editable afterwards", cube?.faces.join(",") === "Speed,Proof,Reach", cube?.faces.join(","));
check("and no model was called to make one", asked.length === 0, `${asked.length} calls`);

/* ------------------------------------------------------------------ */
/* 2. A box nobody claimed is not silent about it                      */
/* ------------------------------------------------------------------ */

/*
 * It is asked now, before anything is spent, rather than guessed at and
 * explained afterwards: a bare box is the ambiguous case the question
 * exists for. Answer "A flat box" and it is the flat box it always was.
 */
const quiet = await draw(SQUARE, "", "A flat box");
check("a drawn box with nothing said is not turned into a cube behind your back",
  quiet?.featureId !== "cube-3d", quiet?.featureId);
/*
 * The offer moved, so this asks where it went.
 *
 * It used to be a line in the thread's changes — the part made the flat way
 * first and told afterwards that a cube was one word off — and `oddness.ts`
 * moved it in front of the first paid call: the box is asked before
 * anything is spent, with the cube as the likeliest answer. What the
 * question is made of belongs to `tests/oddness.mjs`, which holds the rules
 * and every answer; all this suite needs to know is that a box nobody
 * claimed still does not go quietly, and that waving it on leaves the flat
 * box the flat box.
 *
 * Both branches wrote half of that at once. Kept as two checks rather than
 * one: a suite that only answers the question cannot tell an empty question
 * from a right one, and a suite that only reads the question cannot tell
 * that answering it does anything.
 */
check("…but it is asked about, before anything is spent",
  /cube/i.test(lastAsked?.ask ?? "") && (lastAsked?.choices ?? []).some((c) => /cube/i.test(c)),
  lastAsked ? `${lastAsked.ask} — ${lastAsked.choices.join(" / ")}` : "nothing asked");
check("…and answering \"A flat box\" lands the flat box it always was",
  !!quiet?.id && quiet.featureId === "custom-idea", `${quiet?.id} ${quiet?.featureId}`);
/* Answering "A cube" instead is the same as having typed the word — the
   answer goes in beside the drawing as that word (`tests/oddness.mjs`), and
   a box that says cube is the real cube, which is the first case above.
   Proved in two halves rather than by drawing a third box here, because
   every extra drawing in this suite is another part on the board and this
   one is about the solid. */

/* ------------------------------------------------------------------ */
/* 3. Anything else that asks to be turnable becomes a real solid      */
/* ------------------------------------------------------------------ */

const before = asked.length;
const solid = await draw(SQUARE, "a chunk of rock, in 3d, turnable");
check("a drawing that asks to be turnable becomes a solid", solid?.featureId === "mesh-3d", solid?.featureId);
check("the mesh is carried by the part, with the drawing kept as its still",
  !!solid.mesh && solid.mesh.bytes > 0 && solid.mesh.still, JSON.stringify(solid.mesh));
check("and the card says which model made it and that no price came back",
  solid.passes.some((l) => /^made solid ·/.test(l) && /cost not reported/.test(l)),
  solid.passes.join(" | "));
const solidAsk = asked.slice(before).find((a) => Number(a.stage) === 2);
check("what was said reached the route, because it is what decides a solid",
  /in 3d/.test(solidAsk?.said ?? ""), solidAsk?.said);

/* ------------------------------------------------------------------ */
/* 4. Mounted, turned, and remembered                                  */
/* ------------------------------------------------------------------ */

/*
 * Reloaded rather than clicked away from: what is selected is not part of
 * the document, so a fresh page is the resting state with nothing held.
 */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1600);
const holder = page.locator(`[data-node-id="${solid.id}"]`).first();
await holder.scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(600);
const inert = holder.locator("[data-mesh]").first();
check("a solid nobody is holding is a still, so the board can still move it",
  (await inert.getAttribute("data-mesh-still")) !== null);

const at = await holder.boundingBox();
await page.mouse.click(at.x + at.width / 2, at.y + at.height / 2);
await page.waitForTimeout(2600);
const held = holder.locator("[data-mesh]").first();
check("once it is the selected part it mounts for real", (await held.getAttribute("data-mesh-still")) === null,
  (await held.locator("[data-mesh-instead]").textContent().catch(() => "")) || "mounted");
const canvas = held.locator("canvas");
check("with a real 3D context rather than a picture of one", (await canvas.count()) === 1);

const box = await held.boundingBox();
/* One press selects and moves it like any part; two open it for turning, and it has the pointer until the ground is pressed (92067230, `Canvas.tsx`). */
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(80);
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
await page.waitForTimeout(500);
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 20; i++) { await page.mouse.move(box.x + box.width / 2 + i * 6, box.y + box.height / 2 - i * 2); await page.waitForTimeout(12); }
await page.mouse.up();
await page.waitForTimeout(2600);
const left = await page.evaluate((id) => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  return s.nodes.find((n) => n.id === id)?.mesh?.turn ?? null;
}, solid.id);
check("dragging turns it, and where it was left is written on the part",
  !!left && (left.x !== -12 || left.y !== -28), JSON.stringify(left));

await b.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
