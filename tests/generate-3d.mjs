#!/usr/bin/env node
/**
 * A GENERATED PICTURE MADE 3D, FROM THE DRAWING TOOL.
 *
 * J (2026-10-10): "make sure that my generated images have the options
 * either within the generator to become 3d or maybe for me to drag the
 * sphere media shelf element into the generator and it uses that
 * inspiration or tells it something".
 *
 *   · "Make it 3D: On a sphere" tells the model what the picture is for
 *     (a map that wraps a ball) and lands it on a Sphere on the board,
 *     wearing the picture;
 *   · the Sphere card from Media, carried onto the drawing tool, picks the
 *     same choice;
 *   · "A real 3D model" sends the picture to the routing table's one solid
 *     model and lands a Solid with the mesh on it.
 *
 * The renderer is answered here: nothing reaches Replicate, nothing is spent.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/generate-3d.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/pictures/threeD.ts, src/features/studio/pictures/estimate.ts, src/features/studio/RenderPanel.tsx, src/features/studio/ShelfCards.tsx, src/features/studio/shelf/parts/Shape3D.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openGenerate } from "./fixtures/openGenerate.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const GLB = "data:model/gltf-binary;base64,Z2xURgIAAAA=";
const sent = [];
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ set: { REPLICATE_API_TOKEN: true }, repo: null, branch: "main" }) }));
await page.route("**/api/studio/**", async (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  if (what === "image") {
    const body = JSON.parse(route.request().postData() ?? "{}");
    sent.push(body);
    /* Long enough to watch the progress row tick. */
    await new Promise((r) => setTimeout(r, 2200));
    if (Number(body.stage) === 2) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, stage: 2, solid: true, model: "tencent/hunyuan3d-2mv", name: "Hunyuan3D 2 (multi-view)", mesh: { glb: GLB, bytes: 8, from: "tencent/hunyuan3d-2mv" }, cost: 0.2 }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kind: "raster", image: PIXEL, cost: 0.04 }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.removeItem("builder.studio"); localStorage.setItem("builder.shelf.folded", "0"); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const panel = await openGenerate(page);
const nodes = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes);
const pickThreeD = async (label) => {
  await panel.locator("[data-render-3d] button, [data-render-3d] [role=combobox]").first().click({ force: true });
  await page.waitForTimeout(250);
  await page.getByRole("option", { name: label, exact: true }).first().click({ force: true });
  await page.waitForTimeout(250);
};

/* 1. On a sphere */
check("the drawing tool has Make it 3D", (await panel.locator("[data-render-row='3d']").count()) === 1);
await pickThreeD("On a sphere");
check("choosing a sphere says so", (await panel.locator("[data-render-3d]").getAttribute("data-render-3d")) === "sphere");
await panel.locator("[data-render-tweak]").fill("a mossy planet");
await panel.locator("[data-render-go]").click({ force: true });
await page.waitForTimeout(1600);
const row = panel.locator("[data-render-job]").first();
const rowText = (await row.count()) ? (await row.innerText()).replace(/\s+/g, " ") : "";
const bar = Number((await panel.locator("[data-render-bar]").first().getAttribute("data-render-bar").catch(() => null)) ?? -1);
check("while it runs, a row says what it is doing and the seconds so far", /Drawing with .+… \d+s of about \d+s/.test(rowText), rowText);
check("with a bar that has moved", bar > 0 && bar < 100, `${bar}%`);
await page.waitForTimeout(2500);
check("and the row goes when the picture is back", (await panel.locator("[data-render-job]").count()) === 0);
const ask = sent[0] ?? {};
check("the model is told the picture wraps a ball", /^a mossy planet\n\n.*wraps round a ball/s.test(ask.prompt ?? ""), JSON.stringify(ask.prompt));
let ns = await nodes();
const sphere = ns.find((n) => n.featureId === "shape-sphere");
check("it lands as a Sphere on the board, wearing the picture", !!sphere?.picture?.id, sphere ? `picture ${sphere.picture?.path}` : `${ns.map((n) => n.featureId).join(", ")}`);
check("the Sphere draws the picture round it", sphere ? (await page.locator(`[data-node-id="${sphere.id}"] [data-planet-picture]`).count()) >= 1 : false);

/* 2. A Cube card from Media, carried onto the drawing tool */
await pickThreeD("Flat");
if (!(await page.locator('[data-category-open="content"]').count())) await page.locator('[data-category="content"]').first().click({ force: true }).catch(() => {});
await page.waitForTimeout(1000);
const card = page.locator('[data-shelf-card="shape-cube"]').first();
if (await card.count()) await card.scrollIntoViewIfNeeded().catch(() => {});
const grip = await page.evaluate(() => {
  const c = document.querySelector('[data-shelf-card="shape-cube"]');
  if (!c) return null;
  const r = c.getBoundingClientRect();
  for (let y = r.top + 8; y < Math.min(r.bottom, innerHeight) - 4; y += 8) {
    const e = document.elementFromPoint(r.left + r.width / 2, y);
    if (e && c.contains(e) && !e.closest("[role=switch],a,input")) return { x: r.left + r.width / 2, y };
  }
  return null;
});
check("the Cube is on the Words and pictures shelf", !!grip);
if (grip) {
  const box = await panel.boundingBox();
  const to = { x: box.x + box.width / 2, y: box.y + 80 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  for (let i = 1; i <= 14; i++) { await page.mouse.move(grip.x + ((to.x - grip.x) * i) / 14, grip.y + ((to.y - grip.y) * i) / 14); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(600);
}
const afterDrop = await nodes();
check("dropped on the drawing tool, the Cube picks On a cube", (await panel.locator("[data-render-3d]").getAttribute("data-render-3d")) === "cube");
check("and no Cube part is added to the board", afterDrop.filter((n) => n.featureId === "shape-cube").length === 0, `${afterDrop.length} parts`);

/* 3. A real 3D model, from a picture already made */
await pickThreeD("A real 3D model");
const priceLine = (await panel.locator("[data-render-price]").innerText()).trim();
check("the price before the press adds the 3D model", /for the 3D model/.test(priceLine) && /in all/.test(priceLine), priceLine);
const before = sent.length;
await panel.locator("[data-render-3d-from]").first().click({ force: true });
await page.waitForTimeout(1200);
const solidRow = (await panel.locator("[data-render-job]").first().innerText().catch(() => "")).replace(/\s+/g, " ");
check("making the 3D model shows its own row, against its usual time", /Making the 3D model with .+ of about 104s/.test(solidRow), solidRow);
await page.waitForTimeout(2500);
const solidCall = sent.slice(before).find((b) => Number(b.stage) === 2);
check("the picture goes to the solid model", !!solidCall && solidCall.model === "tencent/hunyuan3d-2mv" && /3d/i.test(solidCall.said ?? "") && typeof solidCall.first === "string" && solidCall.first.length > 20, solidCall ? `${solidCall.model}, said ${JSON.stringify(solidCall.said)}` : "no call");
ns = await nodes();
const solid = ns.find((n) => n.featureId === "mesh-3d");
check("and lands as a Solid with the mesh on it", solid?.mesh?.glb === GLB, solid ? "mesh-3d" : ns.map((n) => n.featureId).join(", "));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
