#!/usr/bin/env node
/**
 * ICON AND CUBE, CHOSEN BEFORE DRAWING, WORK FOR PEN DRAWINGS; THE WHEEL'S
 * DISC SAYS WHICH CHOICE IT IS USING.
 *
 * The audit (A9): the Draw tool's row offers Icon and Cube, and ink's Make
 * real never carried the choice, so both did nothing for pen drawings. The
 * wheel's drawing disc shows no row and still sent whatever the row last
 * had, unseen. Held here with no key at all.
 *
 *   node tests/draw-kind-chips.mjs http://127.0.0.1:3013
 */
import { board, checker, J } from "./fixtures/draw-board.mjs";
const { check, done } = checker();
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013");
const { page } = b;
/* An empty page to draw on. */
await page.evaluate((d) => window.__studioLoadDoc({ ...d, nodes: [] }), b.doc);
await page.waitForTimeout(1200);
await page.evaluate(() => document.activeElement?.blur?.());

const ink = async (kind, pts) => {
  await page.keyboard.press("d");
  await page.waitForTimeout(300);
  await page.locator(`[data-draw-kind="${kind}"]`).first().click();
  await page.waitForTimeout(200);
  const fr = await page.locator("[data-frame]").boundingBox();
  const at = (x, y) => [fr.x + fr.width * x, fr.y + Math.min(fr.height, 700) * y];
  await page.mouse.move(...at(...pts[0])); await page.mouse.down();
  for (const p of pts.slice(1)) await page.mouse.move(...at(...p), { steps: 8 });
  await page.mouse.up(); await page.waitForTimeout(500);
  const before = (await b.nodes()).length;
  await page.locator("[data-make-real]").first().click({ force: true });
  let made = null;
  for (let i = 0; i < 60 && !made; i++) { await page.waitForTimeout(300); const all = await b.nodes(); made = all.length > before ? all.at(-1) : null; }
  await page.waitForTimeout(800);
  return made ? await b.node(made.id) : null;
};

const icon = await ink("icon", [[0.2, 0.3], [0.25, 0.2], [0.3, 0.35], [0.35, 0.22], [0.4, 0.3]]);
check("Icon chosen, a pen drawing made real: a drawn icon, with no key", icon?.featureId === "drawn-icon", J(icon && { featureId: icon.featureId }));
check("…drawn from the strokes themselves", (icon?.vector?.paths?.length ?? 0) >= 1, J(icon?.vector?.paths?.length));

const cube = await ink("cube", [[0.55, 0.2], [0.75, 0.2], [0.75, 0.45], [0.55, 0.45], [0.55, 0.2]]);
check("Cube chosen, a pen drawing made real: a cube, with no key", cube?.featureId === "cube-3d", J(cube && { featureId: cube.featureId }));

/* The wheel's disc, on a part, with Cube still chosen on the row. */
await page.keyboard.press("v");
await page.waitForTimeout(200);
const part = page.locator(`[data-node-id="${cube?.id}"]`);
const pb = await part.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
await page.waitForTimeout(700);
await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
await page.waitForTimeout(900);
const said = await page.evaluate(() => { const e = document.querySelector("[data-draw-choice]"); return e ? { choice: e.getAttribute("data-draw-choice"), text: e.textContent } : null; });
check("the wheel's disc says which choice it is using", said?.choice === "cube" && /Making: a cube/.test(said?.text ?? ""), J(said));
await page.keyboard.press("Escape");
check("no page error", b.errors.length === 0, b.errors.join(" / "));
await b.browser.close();
done();
