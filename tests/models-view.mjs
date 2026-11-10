#!/usr/bin/env node
/**
 * THE MODELS VIEW: A 3D MODEL FROM EVERY SIDE, BLENDER'S WAY.
 *
 * `/models` opens a .glb and lets it be turned the way Blender does, then
 * marked up for the modeller. Red on the base (there is no `/models`), green
 * with `src/features/models`:
 *
 *   1. the Builds page has a Models door, and its scripts carry none of the viewer;
 *   2. `/models` opens the sample (the catalogue's dark lantern): meshes, named parts;
 *   3. drag orbits (the angle round changes), the wheel zooms (closer),
 *      Shift + wheel turns it like a turntable (angle changes, distance holds);
 *   4. Turntable turns it on its own; Reset view returns to 35° round, 75° from the top;
 *   5. Front / Top and numpad 3 (Right) put the camera where Blender's do;
 *   6. Pick part names a mesh; Arrow draws; Copy for the modeller downloads a PNG
 *      and writes the model, the view, the parts and the note;
 *   7. a .glb chosen in the file picker opens (it stays in the browser);
 *   8. no page errors.
 *
 *   npx next dev -p 3580   (or a build: npx next start -p 3580)
 *   node tests/models-view.mjs http://127.0.0.1:3580
 *
 * Covers: src/features/models/index.ts, src/features/models/ModelsPage.tsx, src/features/models/viewer.ts, src/features/builds/BuildsPage.tsx
 */
import { chromium } from "playwright-core";
import { fileURLToPath } from "node:url";
import path from "node:path";

const URL_BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SAMPLE = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "public", "models", "dark_lantern.glb");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const angleGap = (a, b) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

const AT = process.env.PLAYWRIGHT_CHROMIUM;
const browser = await chromium.launch({ args: ["--disable-gpu", "--use-angle=swiftshader", "--in-process-gpu"], ...(AT ? { executablePath: AT } : {}) });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(String(e)));

try {
  /* 1. The door, and the Builds page's scripts without the viewer. */
  const scripts = [];
  page.on("response", (r) => { if (r.request().resourceType() === "script" && r.url().startsWith(URL_BASE)) scripts.push(r.text().catch(() => "")); });
  await page.goto(URL_BASE + "/", { waitUntil: "networkidle", timeout: 180_000 });
  await page.waitForTimeout(1000);
  const homeTexts = await Promise.all(scripts.splice(0));
  check("the Builds page has a Models door", (await page.locator("[data-builds-models]").count()) > 0);
  check("the Builds page loads none of the viewer", !homeTexts.some((t) => t.includes("data-model-canvas")));

  /* 2. The view, with the sample open. */
  await page.goto(URL_BASE + "/models", { waitUntil: "domcontentloaded", timeout: 180_000 });
  const opened = await page.waitForFunction(() => (window.__polioModels?.model().meshes ?? 0) > 0, null, { timeout: 120_000 }).then(() => true, () => false);
  check("/models opens the sample model", opened);
  if (!opened) throw new Error("no model");
  const model = await page.evaluate(() => window.__polioModels.model());
  check("its parts are named", model.parts.length > 0 && model.parts.every((p) => p && p !== "unnamed part"), `${model.meshes} meshes: ${model.parts.join(", ")}`);
  const cam = () => page.evaluate(() => window.__polioModels.camera());
  const settle = () => page.waitForTimeout(700);
  await settle();
  const home = await cam();
  check("it opens at the review site's angle", near(home.azimuth, 35, 1) && near(home.polar, 75, 1), `${home.azimuth}° ${home.polar}°`);

  /* 3. Drag, wheel, Shift + wheel on the stage. */
  const box = await page.locator("[data-model-canvas]").boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(cx + i * 20, cy + i * 4);
  await page.mouse.up();
  await settle();
  const dragged = await cam();
  check("drag orbits the model", angleGap(dragged.azimuth, home.azimuth) > 10, `${home.azimuth}° → ${dragged.azimuth}°`);

  await page.mouse.move(cx, cy);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -200);
  await settle();
  const zoomed = await cam();
  check("the wheel zooms in", zoomed.distance < dragged.distance * 0.95, `${dragged.distance} → ${zoomed.distance}`);

  await page.keyboard.down("Shift");
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, 200);
  await page.keyboard.up("Shift");
  await settle();
  const turned = await cam();
  check("Shift + wheel turns it like a turntable", angleGap(turned.azimuth, zoomed.azimuth) > 10 && near(turned.distance, zoomed.distance, zoomed.distance * 0.03), `${zoomed.azimuth}° → ${turned.azimuth}°, distance ${zoomed.distance} → ${turned.distance}`);

  /* 4. Turntable and Reset view. */
  await page.click("[data-model-turntable]");
  const t0 = await cam();
  await page.waitForTimeout(1200);
  const t1 = await cam();
  check("Turntable turns it on its own", (await page.evaluate(() => window.__polioModels.turntable())) && angleGap(t1.azimuth, t0.azimuth) > 8, `${t0.azimuth}° → ${t1.azimuth}°`);
  await page.click("[data-model-reset]");
  await settle();
  const back = await cam();
  check("Reset view returns home and stops the turntable", near(back.azimuth, 35, 1) && near(back.polar, 75, 1) && near(back.distance, home.distance, home.distance * 0.02) && !(await page.evaluate(() => window.__polioModels.turntable())), `${back.azimuth}° ${back.polar}° ${back.distance}`);

  /* 5. Blender's views. */
  await page.click('[data-model-view="front"]');
  await settle();
  const front = await cam();
  check("Front looks from Blender's front", angleGap(front.azimuth, 0) < 1 && near(front.polar, 90, 1), `${front.azimuth}° ${front.polar}°`);
  await page.click('[data-model-view="top"]');
  await settle();
  const top = await cam();
  check("Top looks straight down", top.polar < 1, `${top.polar}°`);
  await page.locator("[data-models-page] h1").click();
  await page.keyboard.press("Numpad3");
  await settle();
  const right = await cam();
  check("numpad 3 is Right", angleGap(right.azimuth, 90) < 1 && near(right.polar, 90, 1), `${right.azimuth}° ${right.polar}°`);
  await page.click("[data-model-reset]");
  await settle();

  /* 6. Mark up and copy. */
  await page.click('[data-model-tool="pick"]');
  /* The model is in the middle of the stage at home: try a few points near it. */
  let picked = 0;
  for (const [dx, dy] of [[0, 0], [0, 20], [0, -20], [15, 0], [-15, 0], [0, 50], [0, -50]]) {
    await page.mouse.click(cx + dx, cy + dy);
    picked = await page.locator("[data-model-parts] span.rounded").count();
    if (picked) break;
  }
  check("Pick part names a mesh", picked > 0, picked ? await page.locator("[data-model-parts]").innerText() : "missed");
  await page.click('[data-model-tool="arrow"]');
  await page.mouse.move(cx - 120, cy - 80);
  await page.mouse.down();
  await page.mouse.move(cx - 40, cy - 20, { steps: 5 });
  await page.mouse.up();
  await page.fill("[data-model-note]", "make the crest taller");
  const dl = page.waitForEvent("download", { timeout: 15_000 }).catch(() => null);
  await page.click("[data-model-copy]");
  const download = await dl;
  const last = await page.evaluate(() => window.__polioModelsLast);
  check("Copy for the modeller downloads a PNG of the view", !!download && /\.png$/.test(download.suggestedFilename()) && last?.dataUrl > 5000, download ? `${download.suggestedFilename()}, ${last?.dataUrl} chars` : "no download");
  check("and writes the model, the view, the parts, the marks and the note", !!last && /^Model: /m.test(last.text) && /^View: orbit 35° round, 75° from the top/m.test(last.text) && /^Parts: (?!none)/m.test(last.text) && /^Marks: 1 arrow/m.test(last.text) && /make the crest taller/.test(last.text), last?.text.replace(/\n/g, " | "));

  /* 7. A file from the picker (nothing uploaded: no request carries it). */
  await page.click("[data-model-clear]");
  const posts = [];
  page.on("request", (r) => { if (r.method() !== "GET") posts.push(r.url()); });
  await page.setInputFiles("[data-model-file]", SAMPLE);
  const fromFile = await page.waitForFunction(() => window.__polioModels?.model().name === "dark_lantern.glb", null, { timeout: 60_000 }).then(() => true, () => false);
  check("a .glb from the file picker opens, with nothing sent", fromFile && posts.length === 0, posts.join(", "));
} catch (e) {
  check("the run finished", false, String(e).slice(0, 300));
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} of ${results.length} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
