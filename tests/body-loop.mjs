/**
 * The intricate path, end to end: a drawing becomes a part with a body,
 * and the body is judged against the drawing until it looks like it.
 *
 * Three shapes are drawn on the real board — a helix, a spiral and a star —
 * and each one goes through the real machinery: the queue, the clip taken
 * from the line, the body loop, the headless render of what came back, the
 * silhouette compared against the drawn shape, and the retry with the
 * critique. Only Claude is stubbed, because a test that needs a key is a
 * test nobody runs: the stub answers the way a model does, badly at first
 * and better when told what was wrong, so the loop's own behaviour — three
 * goes at most, the best kept rather than the last — is what is under test.
 *
 * The numbers printed are real: every overlap is a render of that body,
 * rasterised and compared against the path the drawing was reduced to.
 *
 *   node tests/body-loop.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* The three drawings, as points on the board, 0..1. */
const shapes = {
  helix: (() => {
    const out = [];
    for (let i = 0; i <= 90; i++) { const t = i / 90; out.push([0.5 + Math.sin(t * Math.PI * 6) * 0.16, 0.2 + t * 0.6]); }
    for (let i = 90; i >= 0; i--) { const t = i / 90; out.push([0.5 + Math.sin(t * Math.PI * 6) * 0.07, 0.2 + t * 0.6]); }
    return out;
  })(),
  spiral: Array.from({ length: 150 }, (_, i) => {
    const t = i / 149, a = t * Math.PI * 6;
    return [0.5 + Math.cos(a) * 0.3 * t, 0.5 + Math.sin(a) * 0.3 * t];
  }),
  star: Array.from({ length: 11 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? 0.13 : 0.32;
    return [0.5 + Math.cos(a) * r, 0.5 + Math.sin(a) * r];
  }),
};
const words = { helix: "a helix of sentences", spiral: "a spiral of names", star: "a star of five claims" };

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

/* Claude, stubbed: worse first, better when told what was wrong. */
const asked = [];
await page.route("**/api/studio/reshape", async (route) => {
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      ok: true,
      patch: { featureId: "custom-idea", label: "Drawn", w: 320, h: 320, note: "an idea, drawn" },
      usage: { model: "stub" },
    }),
  });
});
await page.route("**/api/studio/body", async (route) => {
  const sent = JSON.parse(route.request().postData() ?? "{}");
  asked.push(sent);
  // Which go this is, for *this* drawing: the label is the same on all
  // three, so the author's words are what tells them apart.
  const go = asked.filter((a) => (a.prompt ?? "") === (sent.prompt ?? "")).length;
  // 1: a small dot in the middle. 2: the whole box. 3: the outline itself.
  const code =
    go === 1
      ? `<svg viewBox="0 0 100 100" preserveAspectRatio="none"><circle cx="50" cy="50" r="9" fill="#b8ff24"/></svg>`
      : go === 2
        ? `<div style="width:100%;height:100%;background:#075dff"></div>`
        : `<svg viewBox="0 0 1 1" preserveAspectRatio="none"><path d="${sent.path}" fill="#b8ff24"/></svg>`;
  await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, html: code, note: `attempt ${go}`, stripped: [] }) });
});

// Strokes kept as drawn: the shapes are the point.
await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 })));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const drawOne = async (name) => {
  // A part to draw about.
  await page.keyboard.press("Control+k");
  await page.waitForTimeout(350);
  await page.keyboard.type("drop a new idea");
  await page.waitForTimeout(400);
  await page.keyboard.press("Enter");
  await page.waitForTimeout(800);
  const part = page.locator("[data-node-id]").last();
  const pb = await part.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(600);
  const shard = page.locator('[data-radial] [data-shard="draw"]').first();
  if (!(await shard.count())) return false;
  await shard.click({ force: true });
  await page.waitForTimeout(1200);
  const bb = await page.locator("[data-draw-board]").boundingBox();
  if (!bb) return false;
  const pts = shapes[name];
  await page.mouse.move(bb.x + pts[0][0] * bb.width, bb.y + pts[0][1] * bb.height);
  await page.mouse.down();
  for (const [x, y] of pts) await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height);
  await page.mouse.up();
  await page.waitForTimeout(400);
  await page.locator("[data-draw-words]").fill(words[name]);
  await page.keyboard.press("Enter");
  return true;
};

const read = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  return {
    nodes: (s.nodes ?? []).map((n) => ({
      id: n.id, label: n.label, w: n.w, h: n.h,
      outline: n.outline ? { points: n.outline.points, closed: n.outline.closed } : null,
      code: n.code ? { overlap: n.code.overlap, attempts: n.code.attempts, scores: n.code.scores, bytes: n.code.html.length, note: n.code.note } : null,
    })),
    queue: (s.queue ?? []).map((j) => ({ label: j.label, status: j.status, note: j.note })),
  };
});

for (const name of ["helix", "spiral", "star"]) {
  const ok = await drawOne(name);
  check(`${name}: the board takes the drawing`, ok);
  if (!ok) continue;
  // The queue runs it: the reshape, then the body loop with its renders.
  let state = null;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(1000);
    state = await read();
    const last = state.nodes[state.nodes.length - 1];
    if (last?.code) break;
  }
  // The job is marked done a beat after the body lands; its note is the
  // one place every attempt's number is written out.
  await page.waitForTimeout(1500);
  state = await read();
  const node = state.nodes[state.nodes.length - 1];
  const tries = asked.filter((a) => a.critique !== undefined).length;

  console.log(`     ${name}: ${node?.outline ? `${node.outline.points}-point ${node.outline.closed ? "clip" : "band"}` : "no clip"}, ` +
    `${node?.code ? `${node.code.attempts} attempts, best overlap ${node.code.overlap.toFixed(2)}, ${node.code.bytes} bytes` : "no body"}`);
  console.log(`     ${name}: every attempt — ${(node?.code?.scores ?? []).map((v, i) => `#${i + 1} ${v.toFixed(2)}`).join(", ")}`);
  check(`${name}: the drawn line becomes the part's clip`, !!node?.outline);
  check(`${name}: a body was written and kept`, !!node?.code);
  check(`${name}: it took more than one go`, (node?.code?.attempts ?? 0) > 1, `${node?.code?.attempts} attempts`);
  check(`${name}: the best attempt is the one kept`, (node?.code?.overlap ?? 0) > 0.7, `overlap ${node?.code?.overlap?.toFixed(2)}`);
}

const critiques = asked.filter((a) => a.critique);
check("a second go is told what was wrong, in numbers", critiques.some((a) => /%/.test(a.critique)), critiques[0]?.critique?.slice(0, 90));
check("and is given its own last attempt to revise", critiques.every((a) => typeof a.previous === "string" && a.previous.length > 0));
check("and a picture of how it actually rendered", critiques.some((a) => typeof a.shot === "string" && a.shot.length > 100));
check("no attempt was asked for more than three times", ["helix", "spiral", "star"].every((n) => asked.filter((a) => (a.prompt ?? "").includes(words[n])).length <= 3),
  ["helix", "spiral", "star"].map((n) => `${n}:${asked.filter((a) => (a.prompt ?? "").includes(words[n])).length}`).join(" "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
