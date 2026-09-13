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

const draw = async (strokes, words) => {
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
  for (let i = 0; i < 30; i++) {
    await page.waitForTimeout(1000);
    if (await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
      return (s.queue ?? []).every((j) => j.status !== "running" && j.status !== "waiting");
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

const quiet = await draw(SQUARE, "");
check("a drawn box with nothing said is not turned into a cube behind your back",
  quiet?.featureId !== "cube-3d", quiet?.featureId);
check("…but it says a cube is one word away, which it never used to",
  quiet.changes.some((c) => /can be a real cube/.test(c) && /"cube" or "box"/.test(c)),
  quiet.changes.find((c) => /cube/.test(c)) ?? "nothing said");

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
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
