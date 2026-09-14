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
/*
 * Each update carries the document it landed on, because a green card
 * renders it: the card is the site as that update left it, so a board of
 * cards with no documents measures an empty timeline rather than a full one.
 * Four parts a card, which is a small site and enough to pay for.
 *
 * All of it inside `seed`, because this goes into the page as a function and
 * a function sent to a page arrives without its closure.
 */
const seed = (n) => {
  const pages = [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }];
  const part = (id, featureId, label, x, y, w, h) => ({
    id, pageId: "p0", featureId, label, prompt: "", content: "", data: "", x, y, w, h,
    groupId: null, options: {}, priority: "must", custom: false, colour: null, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null,
    code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, link: null,
  });
  const nodes = [
    part("n1", "sticky-header", "Top bar", 0, 0, 1440, 64),
    part("n2", "hero-split", "Hero", 40, 90, 1360, 420),
    part("n3", "feature-cards", "What it does", 40, 540, 1360, 300),
    part("n4", "cta-primary", "Join", 560, 880, 320, 64),
  ];
  const brief = { name: "Orbit", gimmick: "", master: "" };
  const doc = { pages, nodes, groups: [], shapes: [], format: {}, look: {}, motion: [], activePageId: "p0", frameWidth: 1440, brief };
  const threads = [], spots = {};
  for (let i = 0; i < n; i++) {
    threads.push({ id: `t${i}`, at: 0, mode: ["plan", "critique", "build"][i % 3], state: "done",
      ask: `Iteration ${i}`, answer: "A plan.", changes: [`changed ${i} things`], parentId: i ? `t${i - 1}` : null, doc });
    spots[`t${i}`] = { x: 60 + (i % 5) * 680, y: 60 + Math.floor(i / 5) * 300 };
  }
  localStorage.setItem("builder.studio", JSON.stringify({ state: {
    pages, nodes, groups: [], shapes: [], format: {}, look: {}, motion: [],
    activePageId: "p0", frameWidth: 1440, brief,
    threads, threadSpots: spots, openThreadId: null, trail: [], liveThreadId: `t${n - 1}`,
    pinnedThreads: [], bookPinned: false, hiddenFeatures: [], companion: null, draftPieces: [], sentPieces: {},
  }, version: 0 }));
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
  /* `HIDE=<selector> node tests/pan-cost.mjs` takes one thing off the board
     and measures the rest, which is how you find out what that thing costs
     rather than guessing. Nothing is hidden unless it is asked for. */
  if (process.env.HIDE) await p.addStyleTag({ content: `${process.env.HIDE}{display:none!important}` });
  await p.waitForTimeout(1800);
  await p.locator("[data-finish]").click();
  await p.waitForTimeout(2600);
  const client = await p.context().newCDPSession(p);
  await client.send("Performance.enable");
  /*
   * Somewhere on the bare surface to pan from.
   *
   * Found rather than guessed: a fixed point picked by eye landed on a
   * button below the timeline, so the pan row was a gesture that panned
   * nothing and the number underneath it was the paint loop running on its
   * own clock. A gesture that does not move anything measures nothing.
   */
  const ground = await p.evaluate(() => {
    const r = document.querySelector("[data-timeline]").getBoundingClientRect();
    const clear = (x, y) => {
      const el = document.elementFromPoint(x, y);
      return !!el && !el.closest("[data-box]") && !el.closest("[data-card]") && !el.closest("button");
    };
    for (let y = Math.max(24, r.top + 40); y < Math.min(innerHeight - 24, r.bottom - 40); y += 24)
      for (let x = Math.max(24, r.left + 40); x < Math.min(innerWidth - 24, r.right - 40); x += 24)
        if (clear(x, y)) return { x, y };
    return null;
  });
  if (!ground) throw new Error(`${n} boards: nowhere clear to pan from`);
  const viewAt = () => p.evaluate(() => document.querySelector("[data-timeline-plot]").style.transform);
  const view0 = await viewAt();
  const idle = await cost(p, client, async () => p.waitForTimeout(2000));
  const pan = await cost(p, client, () => sweep(p, ground, { x: ground.x + 420, y: ground.y - 180 }, 60));
  const panned = (await viewAt()) !== view0;
  // Measured after the pan, not before it: the pan moves the surface, so a
  // rectangle read at the start is empty ground by the time the drag runs —
  // which made the drag row a second pan and not a drag at all.
  await p.waitForTimeout(900);
  /*
   * The boards are brought back before one is picked to drag.
   *
   * The pan that was just measured carries the surface 420px sideways, and
   * whether any board is still on screen afterwards is luck: at six exactly
   * one survived, and at one the only board there is lands at x 1010 with a
   * width of 248 and overflows the right edge by 66px, so this threw "no
   * board on screen to drag" and measured nothing. That is the geometry of
   * the settle deciding whether the suite runs at all, which is no way to
   * hold a number. Centring costs nothing measured — the pan row is already
   * taken and the drag row has not started — and it leaves every board on
   * screen at any count.
   */
  const home = p.locator("[data-timeline-centre]").first();
  if (await home.count()) { await home.click().catch(() => {}); await p.waitForTimeout(1300); }
  // A board that is actually under the pointer: at thirty they are spread
  // wider than the window, and dragging at a rectangle that is off-screen
  // is another pan with a different name.
  const boxes = await p.locator("[data-box]").all();
  let box = null;
  let pick = -1;
  for (let i = 0; i < boxes.length; i++) {
    const r = await boxes[i].boundingBox();
    // Its middle on screen, not the whole of it: the drag takes the middle,
    // and one board sits mid-screen now, so the pan carries its far edge
    // past the window while the middle is still well under the pointer.
    const cx = r ? r.x + r.width / 2 : -1, cy = r ? r.y + r.height / 2 : -1;
    if (!r || cx < 8 || cy < 8 || cx > 1192 || cy > 892) continue;
    // On screen is not the same as under the pointer: the toolbar sits over
    // the top of the surface, and a board beneath it takes no press at all.
    const mine = await p.evaluate(([x, y, j]) => {
      const el = document.elementFromPoint(x, y);
      return !!el && document.querySelectorAll("[data-box]")[j].contains(el);
    }, [r.x + r.width / 2, r.y + r.height / 2, i]);
    if (mine) { box = r; pick = i; break; }
  }
  if (!box) throw new Error(`${n} boards: no board on screen to drag`);
  // The same board, before and after: a drag row that was really a second
  // pan is worse than no row at all.
  const where = () => p.evaluate((i) => {
    const r = document.querySelectorAll("[data-box]")[i].getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y) };
  }, pick);
  const at0 = await where();
  const drag = await cost(p, client, () => sweep(p,
    { x: box.x + box.width / 2, y: box.y + box.height / 2 },
    { x: box.x + box.width / 2 + 540, y: box.y + box.height / 2 - 260 }, 60));
  const at1 = await where();
  const carried = Math.hypot(at1.x - at0.x, at1.y - at0.y) > 20;
  const line = (l, c) => `  ${l.padEnd(6)} script ${String(c.script).padStart(7)}ms  style ${String(c.style).padStart(6)}ms  layout ${String(c.layout).padStart(6)}ms  all tasks ${String(c.tasks).padStart(7)}ms`;
  console.log(`${n} boards — 60 pointer moves each`);
  console.log(line("idle", idle));
  console.log(line("pan", pan) + (panned ? "" : "   ← view did not move"));
  console.log(line("drag", drag) + (carried ? "" : "   ← board did not move"));
  await p.close();
}
await b.close();
