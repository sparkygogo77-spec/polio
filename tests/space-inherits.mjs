/**
 * A drawing made inside a space, made real, belongs to that space.
 *
 * The claim, in J's terms: a green card is the site as it stands and the
 * red cards are the steps that changed it, so a space that does not reach
 * the parts made inside it is decoration. Concretely, all the way through,
 * with a hand rather than a seed:
 *
 *   draw a loop → black hole → steer the space → draw inside it →
 *   Make real → the part that lands is inside the space and carries the
 *   space's plan.
 *
 * Every link in that chain has been checked on its own; this is the chain.
 * The reshape and image routes are stubbed, because what is being held
 * here is the belonging, not the model: the part has to land the same way
 * with a locked vault, which is this app's rule for the whole drawing path.
 *
 * The queue may stop and ask before it spends — euler's question, "is this
 * box a cube?" — and a hand answers it, so this does too. A run that seems
 * to land nothing is usually a run waiting to be answered: the first go at
 * this file read that as Make real being broken, which it was not.
 *
 *   node tests/space-inherits.mjs [url]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const SHOTS = !!process.env.SHOTS;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const note = (l) => console.log(`  note  ${l}`);

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium", args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
// A locked vault: the part still has to land, and land in the space.
await page.route("**/api/studio/reshape", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key", message: "no key" }) }));
await page.route("**/api/studio/image", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "no token" }) }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });

const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
const draw = async (pts, step = 12) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(step); }
  await page.mouse.up();
  await page.waitForTimeout(450);
};
const loop = (cx, cy, r, n = 28) =>
  Array.from({ length: n }, (_, i) => {
    const a = (i / (n - 1)) * Math.PI * 2 - Math.PI / 2;
    return [Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r)];
  });
const tool = async (key) => { await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2); await page.keyboard.press(key); await page.waitForTimeout(300); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});

/**
 * Wait for the queue to finish, answering the question if it asks one.
 *
 * The queue is not persisted, so it cannot be read out of storage; what
 * says a run is over is a part on the board, or the question sitting
 * unanswered. "Make it anyway" is the answer a hand gives when the
 * question is not the point of what it is doing.
 */
const settle = async (was) => {
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(750);
    const ask = page.locator("[data-queue-answer]").last();
    if (await ask.count()) { await ask.click({ force: true }); await page.waitForTimeout(400); continue; }
    if ((await page.locator("[data-node-id]").count()) > was) { await page.waitForTimeout(900); return true; }
  }
  return false;
};

/* ------------------------------------------------------------------ */
/* 1. A space, steered                                                 */
/* ------------------------------------------------------------------ */

const cx = PANE.x + PANE.width / 2 - 60;
const cy = PANE.y + PANE.height / 2;
await tool("s");
await draw(loop(cx, cy, 170));
await page.locator("[data-space-hole-key]").last().click({ force: true });
await page.waitForTimeout(1900);
check("a loop drawn by hand becomes a black hole that has consumed its area",
  (await page.locator("[data-space-horizon][data-space-open]").count()) === 1);

await tool("v");
await page.locator("[data-space-fill]").first().click({ force: true });
await page.waitForTimeout(500);
const panel = page.locator("[data-space-panel]");
check("the empty hole opens its own panel", (await panel.count()) === 1);

await panel.locator("[data-space-prompt]").fill("everything here is quiet and dark");
await page.waitForTimeout(250);
// Steer it: leave the refine step out, so the space's plan is not the default.
const before = await panel.locator("[data-space-step]").evaluateAll((els) => els.map((e) => e.dataset.spaceStep));
await panel.getByTestId("space-step-drop-refine").click();
await page.waitForTimeout(300);
const spacePlan = await panel.locator("[data-space-step]").evaluateAll((els) => els.map((e) => e.dataset.spaceStep));
check("the space can be steered before anything is in it", !spacePlan.includes("refine") && before.includes("refine"),
  `${before.join(" › ")} → ${spacePlan.join(" › ")}`);
const kept = (await state()).spaces?.[0];
check("and what it was steered to is kept on the space itself",
  kept?.plan?.steps?.join(",") === spacePlan.join(",") && kept?.prompt === "everything here is quiet and dark",
  JSON.stringify(kept?.plan));

/* ------------------------------------------------------------------ */
/* 2. A drawing inside it                                              */
/* ------------------------------------------------------------------ */

await tool("d");
await draw([[cx - 60, cy - 30], [cx - 20, cy + 24], [cx + 26, cy - 26], [cx + 62, cy + 18]], 18);
const badge = page.locator("[data-ink-space]");
check("a drawing made inside it says which space it is in", (await badge.count()) === 1,
  (await badge.first().innerText().catch(() => "")).replace(/\n/g, " "));
check("and it says the space has a way of its own", /made its way/.test(await badge.first().innerText().catch(() => "")));
if (SHOTS) await page.screenshot({ path: "docs/shots/space-inherits-drawing.png" });

/* ------------------------------------------------------------------ */
/* 3. Made real                                                        */
/* ------------------------------------------------------------------ */

const nodesBefore = await page.locator("[data-node-id]").count();
const storedBefore = (await state()).nodes?.length ?? 0;
await page.locator("[data-make-real]").first().click({ force: true });
check("Make real finishes, answering the question if the queue asks one", await settle(nodesBefore));

const after = await state();
const made = (after.nodes ?? []).slice(storedBefore);
check("Make real lands a part", made.length === 1, `${made.length} new parts`);

if (made.length === 1) {
  const part = made[0];
  const space = after.spaces?.[0];
  /* Inside, by the same rule everything else uses: the middle of the part
     is inside the boundary. Checked here rather than trusted. */
  const inside = await page.evaluate(([b, n]) => {
    const x = n.x + n.w / 2, y = n.y + n.h / 2;
    let hit = false;
    for (let i = 0, j = b.length - 1; i < b.length; j = i++) {
      const [xi, yi] = b[i], [xj, yj] = b[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
  }, [space.boundary, part]);
  check("and it lands inside the space the drawing was in", inside, `the part is at ${Math.round(part.x)},${Math.round(part.y)} ${part.w}×${part.h}`);
  check("carrying the space's plan rather than the route's default",
    part.plan?.steps?.join(",") === space.plan?.steps?.join(","), `part ${JSON.stringify(part.plan?.steps)} vs space ${JSON.stringify(space.plan?.steps)}`);
  check("which is a copy, so steering the part does not steer the space",
    part.plan?.steps !== space.plan?.steps);
  check("and the space's words, since the drawing said nothing of its own",
    part.prompt === "everything here is quiet and dark", JSON.stringify(part.prompt));

  // And the part, picked, has the per-element panel: the space reached it.
  await tool("v");
  const el = page.locator(`[data-node-id="${part.id}"]`);
  const nb = await el.boundingBox();
  if (nb) {
    await page.mouse.click(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await page.waitForTimeout(500);
    const own = page.locator(`[data-space-panel="${part.id}"]`);
    check("and it has its own panel, in that space", (await own.count()) === 1);
    const steps = await own.locator("[data-space-step]").evaluateAll((els) => els.map((e) => e.dataset.spaceStep));
    check("showing the order it inherited", steps.join(",") === space.plan?.steps?.join(","), steps.join(" › "));
    if (SHOTS) await page.screenshot({ path: "docs/shots/space-inherits-part.png" });
  }
}

/* ------------------------------------------------------------------ */
/* 4. And a drawing outside every space inherits nothing               */
/* ------------------------------------------------------------------ */

await tool("d");
await draw([[PANE.x + 70, PANE.y + 70], [PANE.x + 120, PANE.y + 110], [PANE.x + 170, PANE.y + 70]], 18);
const loose = page.locator("[data-make-real]").first();
if (await loose.count()) {
  const n0 = (await state()).nodes?.length ?? 0;
  const onBoard = await page.locator("[data-node-id]").count();
  await loose.click({ force: true });
  await settle(onBoard);
  const outside = ((await state()).nodes ?? []).slice(n0)[0];
  check("a drawing made real outside every space inherits nothing",
    !!outside && !outside.plan && outside.prompt !== "everything here is quiet and dark",
    outside ? `plan ${JSON.stringify(outside.plan)}` : "no part landed");
} else {
  note("no second drawing to make real; the door was not on the board");
}

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
