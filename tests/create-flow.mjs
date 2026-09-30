/**
 * The create flow, in J's words, driven by a hand.
 *
 * He draws the boundary first, say a box. It becomes a black hole
 * background in its own right. Everything drawn inside it gets its own
 * prompt: a square prompted "chart associated with currently traded
 * token", a button beside it prompted "buy button". Generate makes one new
 * surface containing two elements, locked in the ratio and the size he
 * drew them at, relative to each other and to the boundary. He watches it
 * form, boundary and edge first, then the middle. That locking is what
 * makes it worth building: he drew the layout, so the layout is the
 * specification.
 *
 * Every claim in that paragraph is a check here, on what is on the board.
 * The reshape and image routes are stubbed to a locked keys panel, because the
 * layout has to lock the same way with no key at all.
 *
 *   node tests/create-flow.mjs [url]
 *   SHOTS=1 node tests/create-flow.mjs
 *
 * Runs alone: watches a box form frame by frame, rim first; under load the frames it watches are missed.
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
await page.route("**/api/studio/reshape", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key", message: "no key" }) }));
await page.route("**/api/studio/image", (r) =>
  r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "no token" }) }));
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
if (SHOTS) mkdirSync("docs/shots", { recursive: true });
const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `docs/shots/create-flow-${n}.png` }); };

const PANE = await page.locator("[data-ctx='studio-canvas']").first().boundingBox();
const draw = async (pts, step = 12) => {
  await page.mouse.move(pts[0][0], pts[0][1]);
  await page.mouse.down();
  for (const [x, y] of pts) { await page.mouse.move(x, y); await page.waitForTimeout(step); }
  await page.mouse.up();
  await page.waitForTimeout(450);
};
/** A box, the way a hand draws one: four corners and back to the first. */
const box = (x, y, w, h) => [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]];
const tool = async (key) => { await page.mouse.move(PANE.x + PANE.width / 2, PANE.y + PANE.height / 2); await page.keyboard.press(key); await page.waitForTimeout(300); };
const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const settle = async (want) => {
  for (let i = 0; i < 60; i++) {
    await page.waitForTimeout(750);
    const ask = page.locator("[data-queue-answer]").last();
    if (await ask.count()) { await ask.click({ force: true }); await page.waitForTimeout(400); continue; }
    if ((await page.locator("[data-node-id]").count()) >= want) { await page.waitForTimeout(1200); return true; }
  }
  return false;
};

/* ------------------------------------------------------------------ */
/* 1. The boundary first: the outermost layer of what is coming         */
/* ------------------------------------------------------------------ */

const B = { x: PANE.x + 300, y: PANE.y + 110, w: 520, h: 360 };
await tool("s");
await draw(box(B.x, B.y, B.w, B.h));
check("a box drawn with the space tool is a black hole in its own right, with nothing to choose",
  (await page.locator("[data-space]").count()) === 1 && (await page.locator("[data-space-hole-key], [data-space-construct-key]").count()) === 0);
await page.waitForTimeout(1900);
check("and it has consumed its area", (await page.locator("[data-space-horizon][data-space-open]").count()) === 1);

/* ------------------------------------------------------------------ */
/* 2. Each thing drawn inside gets its own prompt                       */
/* ------------------------------------------------------------------ */

await tool("d");
const SQ = { x: B.x + 40, y: B.y + 60, w: 280, h: 220 };
const BT = { x: B.x + 360, y: B.y + 250, w: 120, h: 44 };
await draw(box(SQ.x, SQ.y, SQ.w, SQ.h), 10);
await draw(box(BT.x, BT.y, BT.w, BT.h), 10);
check("two things drawn inside it are two drawings, each marked as in the space", (await page.locator("[data-ink-space]").count()) === 2);

// Pick the square and say what it is; then the button.
await tool("v");
const say = async (r, words) => {
  /* The badge on the drawing is the way to pick it: a drawn line is a
     pixel wide at this zoom and a hand cannot land on it. The badge sits
     under the drawing's box, so the one nearest this box's foot is its. */
  const badges = await page.locator("[data-ink-space]").all();
  let best = null, dist = Infinity;
  for (const b of badges) {
    const bb = await b.boundingBox();
    const d = Math.hypot(bb.x - r.x, bb.y - (r.y + r.h));
    if (d < dist) { dist = d; best = b; }
  }
  if (!best) return false;
  await best.click({ force: true });
  await page.waitForTimeout(400);
  const prompt = page.locator("[data-space-panel] [data-ink-prompt]");
  if (!(await prompt.count())) return false;
  await prompt.fill(words);
  await page.waitForTimeout(200);
  return true;
};
check("picking a drawing inside the space opens its own words", await say(SQ, "chart associated with currently traded token"));
check("and the other its own", await say(BT, "buy button"));
const prompted = (await state()).shapes.filter((sh) => sh.prompt).map((sh) => sh.prompt);
check("each drawing keeps its own prompt, not one for the space", prompted.length === 2 && prompted.includes("buy button"), prompted.join(" | "));
await shot("prompted");

/* ------------------------------------------------------------------ */
/* 3. Generate: one surface, two elements, locked as drawn              */
/* ------------------------------------------------------------------ */

await page.locator("[data-space-fill]").first().click({ force: true });
await page.waitForTimeout(400);
const panel = page.locator("[data-space-panel]");
check("the space's panel says what it holds", /2 drawings to make/.test(await panel.locator("[data-space-holds]").innerText()), await panel.locator("[data-space-holds]").innerText());
check("and it can generate from here, which was the gap", (await panel.locator("[data-space-generate]").count()) === 1 && !(await panel.locator("[data-space-generate]").isDisabled()));
const brief = await panel.locator("[data-space-brief]").innerText();
check("the brief is a complete brief, with the layout in it as shares of the surface",
  /How to read this/.test(brief) && /share of the surface/.test(brief) && /What the backend must provide/.test(brief), brief.split("\n")[0]);

/*
 * Watched from the press rather than sampled after it.
 *
 * This read `data-space-form` once, 300ms after Generate, and wanted it
 * below 1. Formation does start at QUEUED — 0.04, a hair of vine, because
 * the thing has begun and nothing has landed — but with the models stubbed
 * both parts land in well under 300ms, so by the time it looked the surface
 * had finished forming and the single sample read 1. The claim is that
 * forming *starts* when it is asked for, so the attribute is recorded from
 * the moment of the press and the lowest value it ever showed is what is
 * asked about. That holds however fast the work behind it finishes.
 */
await page.evaluate(() => {
  window.__form = [];
  const el = document.querySelector("[data-space]");
  if (!el) return;
  const take = () => { const v = el.getAttribute("data-space-form"); if (v !== null) window.__form.push(Number(v)); };
  take();
  new MutationObserver(take).observe(el, { attributes: true, attributeFilter: ["data-space-form"] });
  /* And what is drawn while it forms: the stage on the timeline's bands and
     the eased value shown, every time either changes. */
  window.__shown = [];
  const drawn = () => { const f = el.querySelector("[data-space-forming]"); if (f) window.__shown.push([f.getAttribute("data-space-forming"), Number(f.getAttribute("data-space-form-shown"))]); };
  new MutationObserver(drawn).observe(el, { attributes: true, subtree: true, childList: true, attributeFilter: ["data-space-form-shown", "data-space-forming"] });
});
await panel.locator("[data-space-generate]").click();
await page.waitForTimeout(300);
const seen = await page.evaluate(() => window.__form ?? []);
const formingEarly = await page.locator("[data-space]").getAttribute("data-space-form");
check("it starts forming the moment it is asked for", seen.some((v) => v < 1),
  seen.length ? `form went ${seen.join(" → ")}` : `nothing recorded, form=${formingEarly}`);
check("both drawings are on the queue and off the board", (await page.locator("[data-make-real]").count()) === 0);
await shot("forming");

check("both land as parts", await settle(2));
const done = await state();
const space = done.spaces[0];
const parts = done.nodes;
if (!Array.isArray(space.locked) || space.locked.length < 2) {
  console.log(`\n${results.filter(Boolean).length} of ${results.length} hold, stopped: the surface did not lock two elements`);
  await browser.close();
  process.exit(1);
}
check("the surface is locked once the last one lands", Array.isArray(space.locked) && space.locked.length === 2, `${space.locked?.length ?? 0} locked`);
check("and has finished forming", space.form?.p === 1, `form=${space.form?.p}`);
/* He watched it form: the rim traced round the line, then the middle
   filling, on the timeline's own bands, and what was shown eased through
   many values rather than jumping. */
const shown = await page.evaluate(() => window.__shown ?? []);
const stages = [...new Set(shown.map(([st]) => st))];
const values = [...new Set(shown.map(([, v]) => v))];
check("it could be watched forming: the rim first, then the middle filling, on the timeline's own bands",
  stages.includes("rim") && (stages.includes("close") || stages.includes("surface")) && values.length >= 8,
  `${stages.join(" → ")}, ${values.length} values shown`);
check("each part carries its own words", parts.some((n) => n.prompt === "buy button") && parts.some((n) => /currently traded token/.test(n.prompt)), parts.map((n) => n.prompt).join(" | "));
/* And is named by them, whole: not "chart associated with currently traded t". */
check("and is named by its words, whole, not cut mid-word", parts.some((n) => n.label === "chart associated with currently traded token"), parts.map((n) => n.label).join(" | "));
/* Background work says what happened in the news and on the counter; it
   does not stack toasts over the panel. */
check("and nothing toasted over the panel while they landed", (await page.locator("[data-toaster] .animate-toast-in, .animate-toast-in").count()) === 0, `${await page.locator(".animate-toast-in").count()} toasts`);
await shot("made");

/*
 * Locked in the ratio and the size he drew them at. The square was drawn
 * 280 wide in a 520 boundary: its share is 280/520. The button was drawn
 * 120 wide at 360 in. Those shares are what the lock holds, to a pixel or
 * two of rounding, whatever scale the board was drawn at.
 */
const byW = [...space.locked].sort((a, b) => b.w - a.w);
check("the square keeps its share of the surface's width", Math.abs(byW[0].w - SQ.w / B.w) < 0.04, `${byW[0].w.toFixed(3)} vs ${(SQ.w / B.w).toFixed(3)}`);
check("the button keeps its place, 360 of 520 across", Math.abs(byW[1].x - (BT.x - B.x) / B.w) < 0.04, `${byW[1].x.toFixed(3)} vs ${((BT.x - B.x) / B.w).toFixed(3)}`);
check("and its share of the height", Math.abs(byW[1].h - BT.h / B.h) < 0.04, `${byW[1].h.toFixed(3)} vs ${(BT.h / B.h).toFixed(3)}`);

/* ------------------------------------------------------------------ */
/* 4. Resize the surface and the layout holds                           */
/* ------------------------------------------------------------------ */

const size = page.locator("[data-space-size]");
check("a made surface carries a resize handle", (await size.count()) === 1);
const wasNodes = (await state()).nodes.map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h }));
const sb = await size.boundingBox();
await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
await page.mouse.down();
await page.mouse.move(sb.x + 60, sb.y + 40, { steps: 8 });
await page.mouse.move(sb.x + 120, sb.y + 80, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(500);
const nowNodes = (await state()).nodes;
const grew = nowNodes.every((n) => { const w = wasNodes.find((x) => x.id === n.id); return w && n.w > w.w && n.h > w.h; });
check("dragging the handle out makes every element inside larger with it", grew, nowNodes.map((n) => `${n.w}×${n.h}`).join(", "));
const ratioHeld = nowNodes.every((n) => { const w = wasNodes.find((x) => x.id === n.id); return w && Math.abs(n.w / n.h - w.w / w.h) < 0.08; });
check("and each keeps its own proportion", ratioHeld);
const b2 = (await state()).spaces[0].boundary;
const bw = Math.max(...b2.map((p) => p[0])) - Math.min(...b2.map((p) => p[0]));
const bx0 = Math.min(...b2.map((p) => p[0]));
const big = nowNodes.reduce((a, n) => (n.w > a.w ? n : a));
check("the square still has its share of the surface, at the new size", Math.abs(big.w / bw - SQ.w / B.w) < 0.05, `${(big.w / bw).toFixed(3)} vs ${(SQ.w / B.w).toFixed(3)}`);
check("and the surface's own edge moved with it", bx0 <= big.x, `edge at ${Math.round(bx0)}, square at ${big.x}`);
await shot("resized");

await browser.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
