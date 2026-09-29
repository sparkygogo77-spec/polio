/**
 * A board with sink's trumpmorty.fun on it, and a way to put a drawing on
 * the queue the way the doors do (`window.__studioDraw`), for the drawing
 * checks (tests/draw-*.mjs). No key anywhere unless a check stands a reader
 * in: `reader(body)` answers `/api/studio/reshape` in its place.
 *
 * The parts are chosen by what they are, not by id, so the checks run on
 * whichever capture of trumpmorty.fun the sink checkout holds:
 *   · ribbon  a captured part the page's full width that holds nothing wholly
 *   · strip   a second such part
 *   · leaves  captured single items in the first screen (the title, the buttons, the address)
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { trumpmorty } from "./trumpmorty.mjs";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
export const J = (x) => JSON.stringify(x);

export function checker() {
  const results = [];
  const check = (name, ok, detail = "") => {
    results.push(ok === true);
    console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
  };
  const done = () => {
    const failed = results.filter((r) => !r).length;
    console.log(`\n${results.length - failed}/${results.length} passed`);
    process.exit(failed ? 1 : 0);
  };
  return { check, done };
}

const holds = (nodes, c) => nodes.some((n) => n.id !== c.id && n.pageId === c.pageId && n.x >= c.x && n.y >= c.y && n.x + n.w <= c.x + c.w && n.y + n.h <= c.y + c.h && n.w * n.h < c.w * c.h);

/** The parts a check draws on, read off the document. */
export function partsOf(doc) {
  const home = doc.nodes.filter((n) => n.pageId === (doc.pages?.[0]?.id ?? "page_home") && n.from?.selector);
  const fw = doc.frameWidth ?? 1440;
  const wide = home.filter((n) => n.w >= fw * 0.9 && n.h <= 400 && !holds(home, n)).sort((a, b) => a.y - b.y);
  const leaves = home.filter((n) => n.y < 900 && n.w >= 150 && n.h >= 30 && n.w < fw * 0.8 && !holds(home, n)).sort((a, b) => b.w * b.h - a.w * a.h);
  const text = leaves.filter((n) => /prose|value-prop|heading|text/.test(n.featureId));
  return { ribbon: wide[0] ?? null, strip: wide[1] ?? null, title: text[0] ?? leaves[0] ?? null, leaf: text[1] ?? leaves[1] ?? null };
}

/** What a check compares: everything a drawing must not change on a part. */
export const shapeOf = (n) => n ? { featureId: n.featureId, kind: n.kind ?? null, x: n.x, y: n.y, w: n.w, h: n.h, shape: n.shape ?? null, outline: !!n.outline, content: (() => { const c = JSON.stringify(n.content ?? ""); return c.length > 60 ? `${c.slice(0, 40)}…(${c.length})` : c; })(), sketch: !!(n.sketch && n.sketch.strokes?.length) } : null;

export const BOX = [[[0.1, 0.1], [0.9, 0.1], [0.9, 0.85], [0.1, 0.85], [0.1, 0.1]]];
export const LINE = [[[0.05, 0.5], [0.3, 0.5], [0.5, 0.5], [0.7, 0.5], [0.95, 0.5]]];
export const CIRCLE = [Array.from({ length: 41 }, (_, i) => [0.5 + 0.4 * Math.cos((i / 40) * Math.PI * 2), 0.5 + 0.4 * Math.sin((i / 40) * Math.PI * 2)])];
export const SCRIBBLE = [[[0.1, 0.8], [0.3, 0.4], [0.5, 0.6], [0.7, 0.2], [0.9, 0.3]], [[0.2, 0.9], [0.8, 0.9]]];

export async function board(base, { reader = null, image = null, viewport = { width: 1500, height: 1000 } } = {}) {
  const doc = await trumpmorty();
  if (!doc) { console.error("no sink checkout: set SINK to a sites/trumpmorty-fun folder"); process.exit(2); }
  const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const answer = (r, body) => r.fulfill({ status: 200, contentType: "application/json", body: J(body) });
  await page.route("**/api/keys/status", (r) => answer(r, { set: {}, repo: null, branch: "main" }));
  await page.route("**/api/studio/reshape", (r) => answer(r, reader ? reader(JSON.parse(r.request().postData() ?? "{}")) : { ok: false, reason: "no-key", message: "no key" }));
  await page.route("**/api/studio/body", (r) => answer(r, { ok: false, reason: "no-key", message: "no key" }));
  await page.route("**/api/studio/image", async (r) => image ? image(r) : answer(r, { ok: false, reason: "no-key", message: "no key" }));
  await page.goto(`${base}/builder`, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${base}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);

  const live = () => page.evaluate(() => window.__studioPublishDoc?.() ?? { nodes: [], shapes: [] });
  const api = {
    browser, page, errors, doc,
    parts: partsOf(doc),
    async load() { await page.evaluate((d) => window.__studioLoadDoc(d), doc); await page.waitForTimeout(1500); },
    async nodes() { return (await live()).nodes ?? []; },
    async shapes() { return (await live()).shapes ?? []; },
    async node(id) { return (await api.nodes()).find((n) => n.id === id) ?? null; },
    /** A drawing on the queue, as the doors put one there; resolves with the job once it is over. */
    async draw({ on = null, strokes, words = "", want = null, at = null, drawn = null }) {
      const jid = await page.evaluate((j) => window.__studioDraw({ nodeId: j.on, at: j.at, frameWidth: 1440, sketch: { strokes: j.strokes, words: j.words }, picture: null, want: j.want, ...(j.drawn ? { drawn: j.drawn } : {}), label: "a check's drawing" }), { on, strokes, words, want, at, drawn });
      let job = null;
      for (let i = 0; i < 80; i++) {
        await page.waitForTimeout(250);
        job = await page.evaluate((id) => (window.__studioQueue?.() ?? []).find((x) => x.id === id) ?? null, jid);
        if (job && job.status === "asking") { await page.locator("[data-queue-question] button").first().click({ force: true }).catch(() => {}); continue; }
        if (job && !["waiting", "running"].includes(job.status)) break;
      }
      await page.waitForTimeout(300);
      return job;
    },
    async undo() { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press("Control+z"); await page.waitForTimeout(350); },
    async redo() { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press("Control+Shift+z"); await page.waitForTimeout(350); },
    async toasts() { return page.evaluate(() => document.body.innerText); },
  };
  return api;
}
