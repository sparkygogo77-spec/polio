/**
 * The box forms *with* the iteration, not after it.
 *
 * J's complaint: the box appeared already finished and then played its
 * formation, once everything was over. It was true, and for two reasons —
 * the iteration was landed when the *read came back*, so there was nothing
 * on the timeline to form until most of the work was done; and the progress
 * of every step before that was written onto whatever landed last, which
 * was the previous iteration's box.
 *
 * So: the iteration is landed when the drawing is queued, the job carries
 * its id, every step climbs that box, and it is complete when the job is —
 * which is the last pass landing, not the first answer coming back.
 *
 * This watches a real job through the real queue, the real run and the real
 * routing, sampling the box's own number ten times a second, and prints the
 * milestones it actually passed. The models are answered at the edge and
 * **slowly** — there is no Replicate token in this container and there is
 * not meant to be one — so the pixels are stubbed and the *timing* is real:
 * a read that takes four seconds, three tracer goes of three each, a second
 * pass of twelve. Nothing else is faked: the press, the queue, the steps,
 * the store, the thread, the bands.
 *
 *   node tests/forming-live.mjs [url]     # default http://localhost:3000
 *   SHOTS=/dir node tests/forming-live.mjs   # …and photograph it forming
 */
import { chromium } from "playwright-core";
import { FORM, QUEUED, stageOf } from "../src/features/studio/formation.ts";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/** How long each stubbed model takes. Real seconds, so the job is a slow one. */
const READ_MS = 4000;
const RENDER_MS = 3000;
const REFINE_MS = 12000;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });
const page = await b.newPage({ viewport: { width: 1300, height: 950 } });

await page.route("**/api/studio/reshape", async (r) => {
  await wait(READ_MS);
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    ok: true, patch: { featureId: "custom-idea", label: "Drawn", w: 300, h: 200, note: "an idea, drawn" }, usage: { model: "stub" } }) });
});
await page.route("**/api/studio/image", async (r) => {
  const body = JSON.parse(r.request().postData() ?? "{}");
  if (Number(body.stage) === 2) {
    await wait(REFINE_MS);
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
      ok: true, stage: 2, model: "openai/gpt-image-2", name: "GPT Image 2", making: "picture",
      html: `<svg viewBox="0 0 100 100"><rect width="100" height="100" fill="#2b6"/></svg>`,
      image: "data:image/png;base64,iVBORw0KGgo=", ms: REFINE_MS, cost: null }) });
  }
  await wait(RENDER_MS);
  return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    ok: true, kind: "vectorize", cost: 0.08, model: "recraft-ai/recraft-vectorize", stripped: [],
    html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M12 88 L88 12" fill="none" stroke="#b8ff24" stroke-width="6"/></svg>` }) });
});

await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 }));
  localStorage.setItem("builder.keys.plain", JSON.stringify({ ANTHROPIC_API_KEY: "sk-ant-stub", REPLICATE_API_TOKEN: "r8_stub" }));
});
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A gull: two strokes, so it is not a box and not one straight line — it
   goes the long way round, through the read and the tracer. */
const arc = (cx, cy, r, from, to, n = 12) =>
  Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (n - 1);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
const GULL = [arc(0.36, 0.5, 0.18, Math.PI, 0), arc(0.64, 0.5, 0.18, Math.PI, 0)];

/* ------------------------------------------------------------------ */
/* Draw it, and watch                                                  */
/* ------------------------------------------------------------------ */

await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await page.keyboard.type("drop a new idea");
await page.waitForTimeout(500);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
const pb = await page.locator("[data-node-id]").last().boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
await page.waitForTimeout(700);
await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
await page.waitForTimeout(1300);
const on = await page.locator("[data-draw-board]").boundingBox();
for (const s of GULL) {
  await page.mouse.move(on.x + s[0][0] * on.width, on.y + s[0][1] * on.height);
  await page.mouse.down();
  for (const [x, y] of s) { await page.mouse.move(on.x + x * on.width, on.y + y * on.height); await page.waitForTimeout(4); }
  await page.mouse.up();
  await page.waitForTimeout(160);
}
await page.locator("[data-draw-words]").fill("a gull");

/**
 * The box's own number, the job's step, and how the two are getting on.
 *
 * The threads come off the store's own storage; the queue does not, because
 * a queue is what is happening now rather than what happened, so it is read
 * through the hook the Builder exposes for exactly this.
 */
const look = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const q = (window.__studioQueue?.() ?? []);
  const job = q[q.length - 1] ?? null;
  const t = (s.threads ?? []).find((x) => x.id === job?.threadId) ?? (s.threads ?? [])[(s.threads ?? []).length - 1] ?? null;
  return { p: t?.form?.p ?? null, gen: t?.form?.gen ?? null, state: t?.state ?? null, step: job?.step ?? null, status: job?.status ?? null, threads: (s.threads ?? []).length };
});

const before = await look();
const t0 = Date.now();
await page.keyboard.press("Enter");

/*
 * And straight to the timeline, which is where a person watching a drawing
 * become a part is looking. The box is there, forming, while the work runs.
 */
const shots = process.env.SHOTS;
await page.waitForTimeout(300);
await page.locator("[data-finish]").first().click();
const shot = async (name) => {
  if (!shots) return;
  const box = await page.locator("[data-box]").last().boundingBox().catch(() => null);
  if (!box) return;
  await page.screenshot({ path: `${shots}/${name}.png`, clip: {
    x: Math.max(0, box.x - 220), y: Math.max(0, box.y - 90),
    width: Math.min(1300, box.width + 440), height: Math.min(950, box.height + 200) } });
};

/*
 * As fast as it can be asked for the first second — a job with nothing
 * ahead of it starts almost at once, and the moment before it starts is
 * the moment being checked — then ten times a second to the end.
 */
const seen = [];
let last = null;
let shotMid = false;
for (let i = 0; i < 900; i++) {
  const now = await look();
  const key = `${now.p}|${now.step}|${now.status}|${now.state}`;
  if (key !== last) { seen.push({ at: Date.now() - t0, ...now }); last = key; }
  /*
   * Mid-formation, on the real job: the rim being traced round a box with
   * no surface in it yet, and the vine into it grown.
   *
   * A breath after the number arrives, not on the same frame — what is
   * drawn follows the truth at its own rate (`useForming`), so a photograph
   * taken the instant the truth moves catches the box where it *was*.
   */
  if (!shotMid && typeof now.p === "number" && now.p >= 0.42) {
    shotMid = true;
    await page.waitForTimeout(900);
    await shot("forming-real-mid");
  }
  if (now.status === "done" && now.state === "done" && now.p === 1) break;
  if (Date.now() - t0 > 1000) await page.waitForTimeout(100);
}
// The ease follows the truth at its own rate, so the complete one is taken
// a breath after the number lands rather than on the same frame.
await page.waitForTimeout(3000);
await shot("forming-real-done");
const done = seen[seen.length - 1];

console.log("\n  the milestones, as they happened\n");
console.log("     at      p      stage      job        step");
for (const s of seen) {
  console.log(
    `  ${String((s.at / 1000).toFixed(1)).padStart(6)}s  ${String(s.p ?? "—").padStart(5)}  ${String(s.p === null ? "—" : stageOf(s.p)).padEnd(9)}  ${String(s.status ?? "—").padEnd(8)}  ${s.step ?? ""}`,
  );
}
console.log();

/* ------------------------------------------------------------------ */
/* What has to be true of it                                           */
/* ------------------------------------------------------------------ */

const first = seen[0];
check("the box exists the instant the drawing is queued", first && first.p !== null && first.threads === before.threads + 1,
  `${before.threads} threads → ${first?.threads}, p ${first?.p}`);
check("…and it has begun forming rather than being finished", first && first.p >= QUEUED && first.p <= 0.15 && first.state === "running",
  `p ${first?.p}, ${first?.state}`);
check("…at the very start of it: the vine, and nothing else yet", first && stageOf(first.p) === "vine", first ? stageOf(first.p) : "—");
const climbed = seen.filter((s) => typeof s.p === "number");
check("it only ever climbs", climbed.every((s, i) => i === 0 || s.p >= climbed[i - 1].p),
  climbed.map((s) => s.p).join(" → "));
check("it passes through the vine, the rim and the close before the surface", (() => {
  const stages = climbed.map((s) => stageOf(s.p));
  return stages.includes("vine") && stages.includes("rim") && stages.includes("close");
})(), [...new Set(climbed.map((s) => stageOf(s.p)))].join(" › "));
check("the steps the job said are the steps that moved it", seen.filter((s) => s.step).length >= 3,
  seen.filter((s) => s.step).map((s) => s.step).join(" | "));
check("it is not complete while the job is still going",
  seen.every((s) => s.p !== 1 || s.status === "done" || s.status === "failed"),
  seen.filter((s) => s.p === 1).map((s) => `${s.status} at ${(s.at / 1000).toFixed(1)}s`).join(", ") || "never early");
/*
 * The second pass is part of the iteration, and the box says so: it reaches
 * the refine's own milestone and *stays there* for as long as the pass runs
 * — twelve seconds here — rather than completing when the tracer finished.
 */
check("the second pass is part of it: the box is still forming while it runs", (() => {
  const refine = seen.find((s) => typeof s.p === "number" && s.p >= 0.82 && s.p < 1);
  const complete = seen.find((s) => s.p === 1);
  return !!refine && !!complete && complete.at - refine.at > REFINE_MS * 0.8;
})(), (() => {
  const refine = seen.find((s) => typeof s.p === "number" && s.p >= 0.82 && s.p < 1);
  const complete = seen.find((s) => s.p === 1);
  return refine && complete ? `${(refine.at / 1000).toFixed(1)}s → ${(complete.at / 1000).toFixed(1)}s` : "never";
})());
check("it reaches complete, and only when the job has landed", done?.p === 1 && done?.state === "done" && done?.status === "done",
  `p ${done?.p}, ${done?.state}, job ${done?.status} at ${((done?.at ?? 0) / 1000).toFixed(1)}s`);
check("it formed once, not again afterwards", climbed.every((s) => s.gen === climbed[0].gen),
  [...new Set(climbed.map((s) => s.gen))].join(","));
check("the whole of it took a real job's time rather than a moment", (done?.at ?? 0) > READ_MS + RENDER_MS,
  `${((done?.at ?? 0) / 1000).toFixed(1)}s`);
check("and the bands it passed are the ones the model declares", FORM.vine[0] === 0 && FORM.core[1] === 1);

await b.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `\n${failed} failed of ${results.length}` : `\nall good — ${results.length}/${results.length}`);
process.exit(failed ? 1 : 0);
