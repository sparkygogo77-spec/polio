/**
 * Two Make reals, one after the other, and the queue keeps its word.
 *
 * The create space found this through its own Generate flow, which queues
 * more than one drawing at a time — but it is not that flow's bug, it is the
 * queue's, so this presses the button twice on the board and watches what
 * the queue does with both.
 *
 * Three things have to hold, and each of them has been broken:
 *
 *  1. **The one behind is started.** The runner used to let go of a finished
 *     job only *after* telling the queue it was over, and telling the queue
 *     is what runs the effect that starts the next one: it saw a busy runner
 *     and returned, and nothing changed the queue again. Any second drawing
 *     stayed waiting for ever.
 *  2. **A failure is a failure, not a stop.** The first drawing failing must
 *     not take the second with it.
 *  3. **And an unexpected error is a failure too.** `runDrawJob` reports
 *     every failure it can see, but a *throw* — anything outside its own try,
 *     or anything in the handler that follows it — rejected the promise, and
 *     nothing wrote a status: the job sat at `running` for ever, and
 *     `nextJob` will not start anything while a job is running. One error
 *     nobody expected stopped the queue rather than losing one drawing.
 *
 * The models are answered at the edge — there is no Replicate token in this
 * container and there is not meant to be one — so the pixels are stubbed and
 * the timing is real. Nothing else is faked: the press, the queue, the run,
 * the store, the threads.
 *
 *   node tests/two-in-a-row.mjs [url]      # default http://localhost:3000
 */
import { readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The runner's three rules, where they are written                 */
/* ------------------------------------------------------------------ */

const queueSrc = readFileSync("src/features/studio/DrawQueue.tsx", "utf8");
const runSrc = readFileSync("src/features/studio/reshapeRun.ts", "utf8");
const runner = /React\.useEffect\(\(\) => \{[\s\S]*?\n  \}, \[queue, ctx\]\);/.exec(queueSrc)?.[0] ?? "";

check("one job at a time, and the runner is a ref so two renders cannot both take it",
  /const running = React\.useRef<string \| null>\(null\);/.test(queueSrc) && /if \(!job \|\| running\.current\) return;/.test(runner));
check("a finished job lets go of the runner before the queue is told, or the one behind it is never started",
  (() => {
    const i = runner.indexOf("running.current = null;");
    const j = runner.indexOf("useStudio.getState().updateJob(job.id, {");
    return i > 0 && j > i;
  })());
check("a run that throws still closes its job, so one unexpected error cannot stop the queue",
  /\.catch\(\(err: unknown\) => \{/.test(runner) && /status: "failed", note, step: undefined, ended: Date\.now\(\)/.test(runner));
check("…and says so, rather than a drawing quietly not happening",
  /title: "The drawing could not be worked"/.test(runner) && /toast: true/.test(runner));
check("…and the box it was making stops forming rather than sitting half-formed for ever",
  /st\.markThread\(job\.threadId, "done"\);/.test(runner));
check("the run works nothing out where a throw would escape it", (() => {
  const head = runSrc.slice(runSrc.indexOf("export async function runDrawJob"), runSrc.indexOf("export async function runDrawJob") + 2600);
  const beforeTry = head.slice(0, head.indexOf("\n  try {"));
  // Only the node, which the catch needs and which cannot throw.
  return !/stillAsks\(/.test(beforeTry) && !/withAnswer\(/.test(beforeTry) && !/getFeature\(/.test(beforeTry) && !/planOf\(/.test(beforeTry);
})());

/* ------------------------------------------------------------------ */
/* 2. On the board, twice in a row                                     */
/* ------------------------------------------------------------------ */

const READ_MS = 2600, RENDER_MS = 700, REFINE_MS = 1400;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const arc = (cx, cy, r, from, to, n = 12) =>
  Array.from({ length: n }, (_, i) => { const a = from + ((to - from) * i) / (n - 1); return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
/* Two strokes, so it is not a box and not one straight line: it goes the
   long way round, through the read and the tracer. */
const GULL = [arc(0.36, 0.5, 0.18, Math.PI, 0), arc(0.64, 0.5, 0.18, Math.PI, 0)];

let live = false;
try { live = (await fetch(`${URL_}/builder`, { signal: AbortSignal.timeout(8000) })).ok; } catch { live = false; }
check("the Builder answers", live, live ? URL_ : `${URL_} — skipped the live half`);

if (live) {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM ?? "/opt/pw-browsers/chromium" });

  /** Press Make real twice in a row; `breakFirst` makes the first read fail. */
  const twice = async (breakFirst) => {
    const page = await b.newPage({ viewport: { width: 1300, height: 950 } });
    let reads = 0;
    await page.route("**/api/studio/reshape", async (r) => {
      await wait(READ_MS);
      reads++;
      if (breakFirst && reads === 1) {
        return r.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ ok: false, error: "the reader fell over" }) });
      }
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

    const press = async (words) => {
      await page.keyboard.press("Control+k");
      await page.waitForTimeout(350);
      await page.keyboard.type("drop a new idea");
      await page.waitForTimeout(400);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(900);
      const pb = await page.locator("[data-node-id]").last().boundingBox();
      await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
      await page.waitForTimeout(600);
      await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
      await page.waitForTimeout(1100);
      const on = await page.locator("[data-draw-board]").boundingBox();
      for (const s of GULL) {
        await page.mouse.move(on.x + s[0][0] * on.width, on.y + s[0][1] * on.height);
        await page.mouse.down();
        for (const [x, y] of s) { await page.mouse.move(on.x + x * on.width, on.y + y * on.height); await page.waitForTimeout(3); }
        await page.mouse.up();
        await page.waitForTimeout(120);
      }
      await page.locator("[data-draw-words]").fill(words);
      await page.keyboard.press("Enter");
      await page.waitForTimeout(400);
    };

    const look = () => page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
      const q = window.__studioQueue?.() ?? [];
      return {
        jobs: q.map((j) => ({ status: j.status, nodeId: j.nodeId, madeId: j.madeId, threadId: j.threadId })),
        threads: (s.threads ?? []).filter((t) => t.mode === "drawing").map((t) => ({ id: t.id, state: t.state, p: t.form?.p ?? null })),
      };
    });

    await press("a gull");
    const mid = await look();
    await press("a second gull");
    let last = null;
    for (let i = 0; i < 90; i++) {
      last = await look();
      const over = last.jobs.length >= 2 && last.jobs.every((j) => j.status === "done" || j.status === "failed");
      if (over && last.threads.every((t) => t.state !== "running")) break;
      await page.waitForTimeout(1000);
    }
    await page.close();
    return { mid, last };
  };

  {
    const { mid, last } = await twice(false);
    check("the first press starts at once", mid.jobs.length === 1 && mid.jobs[0].status === "running", JSON.stringify(mid.jobs));
    check("two presses are two jobs, and neither is left waiting or running",
      last.jobs.length === 2 && last.jobs.every((j) => j.status === "done"), last.jobs.map((j) => j.status).join(", "));
    check("…each on its own part, and each making its own", (() => {
      const [a, z] = last.jobs;
      return a.nodeId && z.nodeId && a.nodeId !== z.nodeId && a.madeId === a.nodeId && z.madeId === z.nodeId;
    })(), last.jobs.map((j) => `${j.nodeId} → ${j.madeId}`).join(" | "));
    check("…and two boxes on the timeline, both complete", (() => (
      last.threads.length === 2 && last.threads.every((t) => t.state === "done" && t.p === 1)
    ))(), last.threads.map((t) => `${t.state} p${t.p}`).join(", "));
    check("…each box is the box of its own job", (() => {
      const ids = new Set(last.threads.map((t) => t.id));
      return last.jobs.every((j) => j.threadId && ids.has(j.threadId)) && new Set(last.jobs.map((j) => j.threadId)).size === 2;
    })());
  }

  {
    const { last } = await twice(true);
    check("a drawing that fails does not take the one behind it with it",
      last.jobs.length === 2 && last.jobs[0].status === "failed" && last.jobs[1].status === "done",
      last.jobs.map((j) => j.status).join(", "));
    check("…and neither box is left forming", last.threads.every((t) => t.state !== "running" && t.p === 1),
      last.threads.map((t) => `${t.state} p${t.p}`).join(", "));
  }

  await b.close();
}

const passed = results.filter(Boolean).length;
console.log(`\n${passed === results.length ? "all good" : "FAILED"} — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
