/**
 * Where the timeline's time actually goes.
 *
 * The complaint was that dragging a board is smooth and panning the surface
 * is not, so this measures both — and the answer is that they cost the same,
 * which means the fix is not in either handler.
 *
 * Frame timing cannot tell them apart here: this container has no GPU and
 * idles at 33ms a frame, so the rasteriser swamps whatever the main thread
 * does. What this reads instead is Chrome's own main-thread counters through
 * CDP — script, style recalc, layout — which are the part a handler running
 * per pointermove is responsible for.
 *
 * Run it against a build, not the dev server:
 *
 *   node tests/pan-cost.mjs [url]  # default http://localhost:3000
 */
import { chromium } from "playwright-core";
/* The URL comes in as an argument, the way every other suite here takes it,
   so the sweep can point this at whichever port it built on. It was pinned
   to :3000, which meant it only ever ran against a dev server. */
const URL_ = process.argv[2] ?? "http://localhost:3000";
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const seed = (n) => {
  const threads = [], spots = {};
  for (let i = 0; i < n; i++) {
    threads.push({ id: `t${i}`, at: 0, mode: ["plan", "critique", "build"][i % 3], state: "done",
      ask: `Iteration ${i}`, answer: "A plan.", changes: [`changed ${i} things`], parentId: i ? `t${i - 1}` : null });
    spots[`t${i}`] = { x: 60 + (i % 5) * 290, y: 60 + Math.floor(i / 5) * 190 };
  }
  localStorage.setItem("builder.studio", JSON.stringify({ state: { threads, threadSpots: spots, openThreadId: null }, version: 0 }));
};
/**
 * Main-thread cost, from the browser's own counters.
 *
 * Frame timing cannot tell pan from drag here: this container has no GPU and
 * idles at 33ms a frame, so the rasteriser swamps whatever the main thread
 * does. These counters are the main thread alone — script, style recalc,
 * layout — and they are what a handler running per pointermove actually
 * costs.
 */
const cost = async (p, client, run) => {
  const read = async () => {
    const { metrics } = await client.send("Performance.getMetrics");
    const at = (n) => metrics.find((m) => m.name === n)?.value ?? 0;
    return { script: at("ScriptDuration"), style: at("RecalcStyleDuration"), layout: at("LayoutDuration"), tasks: at("TaskDuration") };
  };
  const a = await read();
  await run();
  const z = await read();
  const ms = (k) => +((z[k] - a[k]) * 1000).toFixed(1);
  return { script: ms("script"), style: ms("style"), layout: ms("layout"), tasks: ms("tasks") };
};

const timed = async (p, run) => {
  await p.evaluate(() => {
    window.__frames = []; window.__stop = false;
    let last = performance.now();
    const tick = (now) => { window.__frames.push(now - last); last = now; if (!window.__stop) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
  });
  await run();
  return p.evaluate(() => {
    window.__stop = true;
    const f = window.__frames.slice(3);
    const s = [...f].sort((a, b) => a - b);
    return { frames: f.length, median: +s[Math.floor(s.length / 2)].toFixed(1),
      p95: +s[Math.floor(s.length * 0.95)].toFixed(1), worst: +s[s.length - 1].toFixed(1) };
  });
};
const sweep = async (p, from, to, steps) => {
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
    await p.waitForTimeout(8);
  }
  await p.mouse.up();
};
for (const n of [1, 6, 30]) {
  const p = await b.newPage({ viewport: { width: 1200, height: 900 } });
  await p.addInitScript(seed, n);
  await p.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await p.waitForTimeout(1800);
  await p.locator("[data-finish]").click();
  await p.waitForTimeout(2600);
  const client = await p.context().newCDPSession(p);
  await client.send("Performance.enable");
  const box = await p.locator("[data-box]").first().boundingBox();
  const idle = await cost(p, client, async () => p.waitForTimeout(2000));
  const pan = await cost(p, client, () => sweep(p, { x: 220, y: 640 }, { x: 760, y: 380 }, 60));
  const drag = await cost(p, client, () => sweep(p,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 + 540, y: box.y + box.height / 2 - 260 }, 60));
  const line = (l, c) => `  ${l.padEnd(6)} script ${String(c.script).padStart(7)}ms  style ${String(c.style).padStart(6)}ms  layout ${String(c.layout).padStart(6)}ms  all tasks ${String(c.tasks).padStart(7)}ms`;
  console.log(`${n} boards — 60 pointer moves each`);
  console.log(line("idle", idle));
  console.log(line("pan", pan));
  console.log(line("drag", drag));
  await p.close();
}
await b.close();
