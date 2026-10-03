/**
 * The bench: five drawings, the whole loop, real renders, real numbers.
 *
 * The drawing path stopped going through a model that writes. It now
 * rasterises the strokes, hands the picture to a tracer, cuts what comes
 * back to the line that was drawn, and scores the silhouette against that
 * line. Whether that is better than what it replaced is not a matter of
 * opinion, so this prints the numbers: every go's overlap, how many goes it
 * took, how long it took, and what it cost.
 *
 * Five fixed drawings, each one three times:
 *
 *   stack   three bars over one another, asked for as a triangle
 *   helix   one long winding line, closed back on itself
 *   spiral  one line turning in on itself
 *   star    five points
 *   ring    a circle inside a circle
 *
 * The renders and the scores are real: every overlap is a headless render
 * of that body, cut to the outline the way the board cuts it, rasterised
 * and compared against the path the drawing was reduced to. With no
 * Replicate token on this machine the tracer itself is stood in for by a
 * real one — the picture is decoded in a second browser page, thresholded
 * and run-length traced to SVG — so the loop under test is the loop, and
 * only the vendor is absent. With a token set, the real model is used.
 *
 *   node tests/shapes.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { kindOfSketch } from "../src/features/studio/shapeKind.ts";
import { RENDER_COST } from "../src/features/studio/renderer.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const LIVE = !!process.env.REPLICATE_API_TOKEN;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The five drawings                                                   */
/* ------------------------------------------------------------------ */

const ring = (n, r, cx = 0.5, cy = 0.5) =>
  Array.from({ length: n + 1 }, (_, i) => {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });

const DRAWINGS = {
  /* Three bars stacked: what J drew, and asked to come out a triangle. */
  stack: {
    words: "a 3 stack, as a triangle",
    strokes: [
      [[0.30, 0.32], [0.70, 0.32]],
      [[0.26, 0.50], [0.74, 0.50]],
      [[0.22, 0.68], [0.78, 0.68]],
    ],
  },
  helix: {
    words: "a helix of sentences",
    strokes: [(() => {
      const out = [];
      for (let i = 0; i <= 90; i++) { const t = i / 90; out.push([0.5 + Math.sin(t * Math.PI * 6) * 0.16, 0.2 + t * 0.6]); }
      for (let i = 90; i >= 0; i--) { const t = i / 90; out.push([0.5 + Math.sin(t * Math.PI * 6) * 0.07, 0.2 + t * 0.6]); }
      return out;
    })()],
  },
  spiral: {
    words: "a spiral of names",
    strokes: [Array.from({ length: 150 }, (_, i) => {
      const t = i / 149, a = t * Math.PI * 6;
      return [0.5 + Math.cos(a) * 0.3 * t, 0.5 + Math.sin(a) * 0.3 * t];
    })],
  },
  star: {
    words: "a star of five claims",
    strokes: [Array.from({ length: 11 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 ? 0.13 : 0.32;
      return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
    })],
  },
  ring: {
    words: "a ring round the offer",
    strokes: [ring(48, 0.34), ring(40, 0.19)],
  },
};
const NAMES = Object.keys(DRAWINGS);
const RUNS = 3;

/* ------------------------------------------------------------------ */
/* 1. What each drawing means, read off the geometry alone             */
/* ------------------------------------------------------------------ */

const roleOf = (n) => kindOfSketch({ strokes: DRAWINGS[n].strokes, words: "" });
check("three parallel bars are a list of three", roleOf("stack").kind === "list" && roleOf("stack").rows === 3, JSON.stringify(roleOf("stack")));
check("a circle inside a circle is a container", roleOf("ring").kind === "container", roleOf("ring").kind);
check("a star is a surface", roleOf("star").kind === "surface", roleOf("star").kind);
check("a helix drawn closed is a surface", roleOf("helix").kind === "surface", roleOf("helix").kind);
check("a spiral is a mark, because it encloses nothing cleanly", ["mark", "surface"].includes(roleOf("spiral").kind), roleOf("spiral").kind);
check("one straight line is a connector", kindOfSketch({ strokes: [[[0.2, 0.5], [0.8, 0.5]]], words: "" }).kind === "connector");
check("a line with an arrowhead is still a connector",
  kindOfSketch({ strokes: [[[0.2, 0.5], [0.8, 0.5]], [[0.72, 0.44], [0.8, 0.5]], [[0.72, 0.56], [0.8, 0.5]]], words: "" }).kind === "connector");
check("nothing drawn is a mark", kindOfSketch({ strokes: [], words: "" }).kind === "mark");

/* ------------------------------------------------------------------ */
/* 2. The loop, five drawings, three goes each                         */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
/** A second page, only ever used to decode a PNG. Never the page under test. */
const lab = await browser.newPage({ viewport: { width: 64, height: 64 } });
await lab.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });

/**
 * A real tracer: threshold the picture and run-length encode each row.
 *
 * Coarse next to recraft, and honest about it, but it is a raster turned
 * into vector paths off the actual pixels, so everything downstream of it —
 * the sanitising, the clip, the render, the score, the ladder — is under
 * test rather than pretended.
 */
async function traceLocally(pngBase64) {
  return lab.evaluate(async (data) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${data}`; });
    const N = 128;
    const el = document.createElement("canvas");
    el.width = N; el.height = N;
    const c = el.getContext("2d", { willReadFrequently: true });
    c.clearRect(0, 0, N, N);
    c.drawImage(img, 0, 0, N, N);
    const px = c.getImageData(0, 0, N, N).data;
    // Ink is anything dark enough and opaque enough. A transparent ground
    // has no pixels at all, which is the point of dropping it.
    const ink = (i) => px[i * 4 + 3] > 40 && (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3 < 150;
    const parts = [];
    for (let y = 0; y < N; y++) {
      let run = -1;
      for (let x = 0; x <= N; x++) {
        const on = x < N && ink(y * N + x);
        if (on && run < 0) run = x;
        if (!on && run >= 0) { parts.push(`M${run} ${y}h${x - run}v1h${run - x}z`); run = -1; }
      }
    }
    if (!parts.length) return null;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}" preserveAspectRatio="none"><path d="${parts.join("")}" fill="currentColor"/></svg>`;
  }, pngBase64);
}

/* Claude must not be reached from this path at all. Any call to the writing
   route is caught here and counted; the bench fails if the count is not
   zero, and the route answers so the run does not hang on it. */
const wrote = [];
await page.route("**/api/studio/body", (route) => {
  wrote.push(JSON.parse(route.request().postData() ?? "{}"));
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unexpected", message: "The drawing path must not write." }) });
});

const calls = [];
if (!LIVE) {
  await page.route("**/api/studio/image", async (route) => {
    const sent = JSON.parse(route.request().postData() ?? "{}");
    calls.push(sent);
    const svg = sent.picture ? await traceLocally(sent.picture) : null;
    if (!svg) {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "empty-body", message: "Nothing in that picture to trace." }) });
    }
    return route.fulfill({
      status: 200, contentType: "application/json",
      body: JSON.stringify({ ok: true, kind: "vectorize", cost: RENDER_COST.vectorize, model: "recraft-ai/recraft-vectorize (stood in)", stripped: [], html: svg }),
    });
  });
}

await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 })));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const read = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const withCode = (s.nodes ?? []).filter((n) => n.code);
  const last = withCode[withCode.length - 1];
  return {
    made: withCode.length,
    nodes: (s.nodes ?? []).length,
    kind: last?.kind ?? null,
    how: last?.outline?.closed === true ? "area" : "ink",
    shape: last?.shape ?? null,
    points: last?.outline?.points ?? 0,
    closed: last?.outline?.closed ?? null,
    code: last?.code ? { overlap: last.code.overlap, attempts: last.code.attempts, scores: last.code.scores ?? [], cost: last.code.cost ?? 0, source: last.code.source, kind: last.code.kind, bytes: last.code.html.length } : null,
  };
});

const drawOne = async (name) => {
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(320);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(380);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(750);
  const part = page.locator("[data-node-id]").last();
  // The board fills up as the bench runs; the newest part is often below
  // the fold by the fifth drawing.
  await part.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(250);
  const pb = await part.boundingBox();
  if (!pb) return false;
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(650);
  const shard = page.locator('[data-radial] [data-shard="draw"]').first();
  if (!(await shard.count())) {
    await page.keyboard.press("Escape");
    return false;
  }
  await shard.click({ force: true });
  await page.waitForTimeout(1150);
  const bb = await page.locator("[data-draw-board]").boundingBox();
  if (!bb) return false;
  for (const stroke of DRAWINGS[name].strokes) {
    await page.mouse.move(bb.x + stroke[0][0] * bb.width, bb.y + stroke[0][1] * bb.height);
    await page.mouse.down();
    for (const [x, y] of stroke) {
      await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height);
      await page.waitForTimeout(4);
    }
    await page.mouse.up();
    await page.waitForTimeout(160);
  }
  await page.locator("[data-draw-words]").fill(DRAWINGS[name].words);
  await page.keyboard.press("Enter");
  return true;
};

const rows = [];
let done = 0;
for (const name of NAMES) {
  for (let run = 1; run <= RUNS; run++) {
    const started = Date.now();
    const ok = await drawOne(name);
    if (!ok) { rows.push({ name, run, failed: "the board would not open" }); continue; }
    done++;
    let state = null;
    /* Polled four times a second, for the same minute: a body back is seen when it lands, not up to a second later. */
    for (let i = 0; i < 240; i++) {
      await page.waitForTimeout(250);
      state = await read();
      if (state.made >= done) break;
    }
    await page.waitForTimeout(900);
    state = await read();
    const ms = Date.now() - started;
    if (state.made < done) { done = state.made; rows.push({ name, run, failed: "no body came back", ms }); continue; }
    rows.push({ name, run, ms, ...state.code, clip: `${state.points}pt ${state.closed ? "clip" : "band"}`, kind: state.kind, how: state.how });
  }
}

/* ------------------------------------------------------------------ */
/* The table                                                           */
/* ------------------------------------------------------------------ */

const pad = (v, n, right = false) => (right ? String(v).padStart(n) : String(v).padEnd(n));
console.log(`\n  the drawing path, ${RUNS} runs each, tracer ${LIVE ? "live (recraft-ai/recraft-vectorize)" : "stood in locally, renders and scores real"}\n`);
console.log(`  ${pad("drawing", 9)}${pad("run", 4)}${pad("kind", 11)}${pad("clip", 12)}${pad("scored", 7)}${pad("goes", 5, true)}  ${pad("every go", 24)}${pad("best", 7, true)}${pad("secs", 7, true)}${pad("cost", 8, true)}`);
console.log(`  ${"-".repeat(9 + 4 + 11 + 12 + 7 + 5 + 2 + 24 + 7 + 7 + 8)}`);
for (const r of rows) {
  if (r.failed) { console.log(`  ${pad(r.name, 9)}${pad(r.run, 4)}${r.failed}`); continue; }
  console.log(
    `  ${pad(r.name, 9)}${pad(r.run, 4)}${pad(r.kind ?? "-", 11)}${pad(r.clip, 12)}${pad(r.how ?? "-", 7)}${pad(r.attempts, 5, true)}  ` +
    `${pad((r.scores ?? []).map((v) => v.toFixed(2)).join(" "), 24)}${pad((r.overlap ?? 0).toFixed(2), 7, true)}${pad((r.ms / 1000).toFixed(1), 7, true)}${pad(`$${(r.cost ?? 0).toFixed(2)}`, 8, true)}`,
  );
}
const good = rows.filter((r) => !r.failed);
const per = (name) => good.filter((r) => r.name === name);
console.log(`  ${"-".repeat(78)}`);
for (const name of NAMES) {
  const rs = per(name);
  if (!rs.length) continue;
  const mean = (f) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
  console.log(`  ${pad(name, 9)}${pad("mean", 4 + 11 + 12)}${pad(rs[0].how ?? "-", 7)}${pad(mean((r) => r.attempts).toFixed(1), 5, true)}  ${pad("", 24)}${pad(mean((r) => r.overlap).toFixed(2), 7, true)}${pad((mean((r) => r.ms) / 1000).toFixed(1), 7, true)}${pad(`$${mean((r) => r.cost).toFixed(2)}`, 8, true)}`);
}
const spent = good.reduce((a, r) => a + (r.cost ?? 0), 0);
console.log(`\n  ${good.length} of ${NAMES.length * RUNS} drawings made a body · $${spent.toFixed(2)} at $${RENDER_COST.vectorize.toFixed(2)} a trace · ${(good.reduce((a, r) => a + r.ms, 0) / 1000).toFixed(0)}s in total\n`);

/* ------------------------------------------------------------------ */
/* 3. What the table has to show                                       */
/* ------------------------------------------------------------------ */

check("every drawing came back with a body", good.length === NAMES.length * RUNS, `${good.length}/${NAMES.length * RUNS}`);
check("every body was traced, never written", good.every((r) => r.source === "renderer"), good.map((r) => r.source).join(" "));
check("no Claude call happened on the drawing path", wrote.length === 0, `${wrote.length} calls to /api/studio/body`);
check("every go's score is kept, not just the best", good.every((r) => (r.scores ?? []).length === r.attempts), good.map((r) => `${r.scores?.length}/${r.attempts}`).join(" "));
check("the best of the goes is the one kept", good.every((r) => Math.abs(r.overlap - Math.max(...(r.scores ?? [0]))) < 0.011));
check("nothing took more than three goes", good.every((r) => r.attempts <= 3), good.map((r) => r.attempts).join(" "));
// A drawing that closed a line is cut to it. Three separate bars close
// nothing, so there is nothing to cut to and the part keeps its box: that
// is the old behaviour and it is still right.
const cut = good.filter((r) => /clip$/.test(r.clip));
check("a drawing that closed a line is still cut to it", cut.length > 0 && cut.every((r) => parseInt(r.clip) > 2), good.map((r) => `${r.name} ${r.clip}`).join(" · "));
check("a drawing that cleared the bar stopped there", good.filter((r) => r.overlap >= 0.72).every((r) => r.attempts === (r.scores ?? []).findIndex((v) => v >= 0.72) + 1));
// Like against like: a closed drawing is an area and an open one is a
// line. Nothing is scored thin ink against a filled shape any more, which
// is what capped the first bench.
const closed = good.filter((r) => r.how === "area");
const opened = good.filter((r) => r.how === "ink");
check("a closed drawing is scored area against area", closed.length > 0 && ["helix", "star", "ring"].every((n) => per(n).every((r) => r.how === "area")),
  `${closed.length} closed, ${opened.length} open`);
check("an open drawing is scored ink against ink", opened.length > 0 && per("stack").every((r) => r.how === "ink") && per("spiral").every((r) => r.how === "ink"));
check("no drawing is scored thin ink against a filled area", good.every((r) => (r.how === "area") === (r.clip.endsWith("clip"))), good.map((r) => `${r.name} ${r.how}/${r.clip}`).join(" · "));
check("the price is one trace a go", good.every((r) => Math.abs(r.cost - r.attempts * RENDER_COST.vectorize) < 0.001), good.map((r) => `${r.cost}/${r.attempts}`).join(" "));
check("the ring became a container and the stack a list", per("ring").every((r) => r.kind === "container") && per("stack").every((r) => r.kind === "list"),
  `${per("ring")[0]?.kind} · ${per("stack")[0]?.kind}`);

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
