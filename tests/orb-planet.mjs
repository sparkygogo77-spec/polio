#!/usr/bin/env node
/**
 * THE ORB IS A PLANET.
 *
 * J (2026-10-10): "the orb in media should rotate every degree and be
 * draggable like a sphere to see all sides, like a plent". Three places, the
 * same lines (`library/planetJs.ts`):
 *
 *   · the kit's vendor/builder-motion.js, a hook named `planet`: a picture
 *     wraps round the ball (half a turn shows the other side of it), a drag
 *     sideways turns it, a drag down tips a pole toward the viewer, a throw
 *     keeps turning after the hand lets go, and left alone it spins;
 *   · the Builder: the drawn orb and the picture orb are that ball, still and
 *     out of reach on the board, turnable in the Preview;
 *   · Publish: the exported page ships the planet feature, and served, the
 *     orb is drawn and turns in the hand.
 *
 *   node tests/orb-planet.mjs [url]      # default http://localhost:3000
 *
 * Covers: src/features/studio/shelf/library/planetJs.ts, src/features/studio/shelf/parts/Orb.tsx, src/features/studio/shelf/library/behaviourScripts/effects.ts, src/features/studio/shelf/library/works.ts, scripts/kit-motion.mjs
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createJiti } from "jiti";
import { chromium } from "playwright-core";

const here = dirname(fileURLToPath(import.meta.url));
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const K = await jiti.import(join(here, "..", "src", "features", "studio", "send-out", "kitMotion.ts"));
const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");

const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const file = readFileSync(join(here, "..", "kit", "starter", "vendor", "builder-motion.js"), "utf8");
check("vendor/builder-motion.js is current and carries the planet", file === K.kitMotionJs() && file.includes("function polioPlanet("));

/* Four stripes round the picture: A from the back seam, then B, C (the middle, facing the viewer at first) and D. */
const STRIPES = `(() => { const c = document.createElement("canvas"); c.width = 64; c.height = 32; const g = c.getContext("2d");
  [["#ff0000", 0, 8], ["#00ff00", 8, 16], ["#0000ff", 24, 16], ["#ffff00", 40, 16], ["#ff0000", 56, 8]].forEach(([f, x, w]) => { g.fillStyle = f; g.fillRect(x, 0, w, 32); });
  return c.toDataURL(); })()`;

/** The colour at the middle of a ball's canvas, as the strongest channel: r, g, b or y. */
const middle = (p, sel) => p.evaluate((sel) => {
  const cv = document.querySelector(sel);
  const d = cv.getContext("2d").getImageData((cv.width / 2) | 0, (cv.height / 2) | 0, 1, 1).data;
  const [r, g, b] = d;
  return r > 2 * b && g > 2 * b ? "y" : r >= g && r >= b ? "r" : g >= b ? "g" : "b";
}, sel);
const turnOf = (p, sel) => p.evaluate((sel) => document.querySelector(sel).__planet?.turn() ?? null, sel);
const apart = (a, b) => (a && b ? Math.max(...a.map((v, i) => Math.abs(v - b[i]))) : 0);
const centreOf = async (p, sel) => { const r = await p.locator(sel).first().boundingBox(); return { x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width }; };
async function drag(p, from, dx, dy, steps = 20, hold = 0) {
  await p.mouse.move(from.x, from.y);
  await p.mouse.down();
  for (let s = 1; s <= steps; s++) await p.mouse.move(from.x + (dx * s) / steps, from.y + (dy * s) / steps);
  if (hold) await p.waitForTimeout(hold);
  await p.mouse.up();
}

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
try {
  /* ------------------------------------------------------------ the kit file, on a hook */
  const p = await browser.newPage({ viewport: { width: 700, height: 500 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  const kitPage = (spin) => `<!doctype html><html><head><style>
    body { margin: 0; padding: 40px; background: #111; }
    [data-hook="ball"] { width: 300px; height: 300px; --builder-motion: "planet?spin=${spin}"; }
  </style></head><body><div data-hook="ball"></div><script>window.PIC = ${STRIPES};</script>
  <script>document.querySelector('[data-hook="ball"]').innerHTML = '<img data-planet-picture alt="" src="' + window.PIC + '">';</script>
  <script>${file}</script></body></html>`;
  await p.setContent(kitPage("no"));
  await p.waitForTimeout(400);
  const CV = '[data-hook="ball"] canvas[data-planet-canvas]';
  check("A hook named planet gets a ball", (await p.locator(CV).count()) === 1);
  const front = await middle(p, CV);
  check("The picture is wrapped round it: its middle stripe faces the viewer", front === "b", front);
  const at = await centreOf(p, CV);
  /* A drag right across the ball turns it half way round: the far side of the picture comes to the front. */
  await drag(p, { x: at.x - at.w / 2 + 10, y: at.y }, at.w - 20, 0, 24, 200);
  await p.waitForTimeout(200);
  const back = await middle(p, CV);
  check("Dragged sideways it turns to show the far side of the picture", back === "r", `${front} then ${back}`);
  await drag(p, { x: at.x - at.w / 2 + 10, y: at.y }, (at.w - 20) / 2, 0, 24, 200);
  await p.waitForTimeout(200);
  const quarter = await middle(p, CV);
  check("A quarter turn more shows the side between", quarter === "g" || quarter === "y", quarter);
  /* Down by half the ball: a quarter turn over, so a pole comes round to face the viewer. */
  const before = await turnOf(p, '[data-hook="ball"] [data-planet]');
  await drag(p, { x: at.x, y: at.y - at.w / 4 }, 0, (at.w - 2) / 2, 24, 200);
  await p.waitForTimeout(200);
  const after = await turnOf(p, '[data-hook="ball"] [data-planet]');
  check("Dragged down it turns over the top: a pole faces the viewer", after && Math.abs(after[7]) > 0.8, after ? `pole toward the viewer ${after[7].toFixed(2)} (was ${before[7].toFixed(2)})` : "no ball");
  /* A throw: a quick drag let go while still moving carries on turning. */
  await drag(p, { x: at.x - 60, y: at.y + 20 }, 120, -40, 4);
  const thrown = await turnOf(p, '[data-hook="ball"] [data-planet]');
  await p.waitForTimeout(250);
  const carried = await turnOf(p, '[data-hook="ball"] [data-planet]');
  check("Thrown, it keeps turning after the hand lets go", apart(thrown, carried) > 0.02, apart(thrown, carried).toFixed(3));
  await p.waitForTimeout(2500);
  const s1 = await turnOf(p, '[data-hook="ball"] [data-planet]');
  await p.waitForTimeout(300);
  const s2 = await turnOf(p, '[data-hook="ball"] [data-planet]');
  check("With its spin off it comes to rest", apart(s1, s2) < 0.001, apart(s1, s2).toFixed(4));
  await p.setContent(kitPage("yes"));
  await p.waitForTimeout(200);
  const i1 = await turnOf(p, '[data-hook="ball"] [data-planet]');
  await p.waitForTimeout(600);
  const i2 = await turnOf(p, '[data-hook="ball"] [data-planet]');
  check("Left alone it turns slowly on its own", apart(i1, i2) > 0.02 && apart(i1, i2) < 0.6, apart(i1, i2).toFixed(3));
  check("Nothing throws", errors.length === 0, errors.join("; "));

  /* ------------------------------------------------------------ the Builder */
  const b = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const berr = [];
  b.on("pageerror", (e) => berr.push(e.message));
  await b.route("**/api/tweets/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ configured: false }) }));
  await b.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ github: { configured: false, missing: [] }, vercel: { hook: false }, configured: false, source: null }) }));
  /* The picture at an address, as a picture on a site is: a data address carries a comma, and the orb's words are split on commas. */
  const png = Buffer.from((await p.evaluate(STRIPES)).split(",")[1], "base64");
  const servePic = (r) => r.fulfill({ status: 200, contentType: "image/png", body: png });
  await b.route("**/planet-test.png", servePic);
  await b.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
  const SAMPLE = JSON.parse(readFileSync(join(here, "..", "site", "document.json"), "utf8"));
  const pic = "/planet-test.png";
  const node = (id, featureId, x, content, options) => ({
    id, pageId: "p_home", featureId, label: featureId, prompt: "", content, data: "", x, y: 40, w: 520, h: 520,
    groupId: null, options, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
    anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, cube: null, mesh: null, vector: null,
    role: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  });
  const doc = {
    pages: [{ id: "p_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    nodes: [node("n_drawn", "orb-css", 40, "The signal is live", { spin: "no", rings: "none", size: "94" }), node("n_pic", "orb-image", 640, `${pic}, Wrapped`, { float: "no", rings: "none", size: "94" })],
    groups: [], shapes: [], format: {}, brief: { ...SAMPLE.brief, name: "Planet" }, look: {}, frameWidth: 1440,
  };
  await b.evaluate(({ state }) => {
    const env = (s) => JSON.stringify({ state: s, version: 0 });
    localStorage.setItem("builder.builds", env({ projects: [{ id: "b1", name: "Planet", updatedAt: Date.now() }], activeId: "b1" }));
    localStorage.setItem("builder.studio", env({ ...state, activePageId: "p_home" }));
  }, { state: doc });
  await b.reload({ waitUntil: "networkidle" });
  await b.waitForFunction(() => typeof window.__studioExport === "function", null, { timeout: 60000 });
  await b.waitForTimeout(1200);
  const onBoard = await b.evaluate(() => [...document.querySelectorAll('[data-part="orb-css"] canvas[data-planet-canvas], [data-part="orb-image"] canvas[data-planet-canvas]')].map((c) => getComputedStyle(c).pointerEvents));
  check("On the board both orbs are drawn as the ball, out of the hand", onBoard.length >= 2 && onBoard.every((x) => x === "none"), onBoard.join(","));

  /* The export is what Publish sends: taken before the Preview, from the same parts. */
  const files = await b.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: f.encoding ? "" : f.content })));

  await b.locator("[data-preview-toggle]").first().click({ force: true });
  await b.waitForTimeout(1500);
  const PV = '[data-live-node="n_drawn"] canvas[data-planet-canvas]';
  check("In the Preview the drawn orb is a ball in the hand", (await b.locator(PV).count()) === 1 && (await b.evaluate((s) => getComputedStyle(document.querySelector(s)).pointerEvents, PV)) !== "none");
  const pat = await centreOf(b, PV);
  const t0 = await turnOf(b, '[data-live-node="n_drawn"] [data-planet]');
  await drag(b, { x: pat.x - 80, y: pat.y }, 160, 90, 20, 150);
  await b.waitForTimeout(150);
  const t1 = await turnOf(b, '[data-live-node="n_drawn"] [data-planet]');
  check("In the Preview a drag turns it, sideways and over", apart(t0, t1) > 0.3, apart(t0, t1).toFixed(2));
  const PIC = '[data-live-node="n_pic"] canvas[data-planet-canvas]';
  await b.waitForTimeout(300);
  const pf = (await b.locator(PIC).count()) ? await middle(b, PIC) : "none";
  check("In the Preview the picture orb wears the picture wrapped round it", pf === "b", pf);
  check("Nothing throws in the Builder", berr.length === 0, berr.join("; "));

  /* ------------------------------------------------------------ Publish */
  const home = files.find((f) => f.path === "index.html")?.content ?? "";
  check("Published, the page carries the planet feature", /"feature":"planet"/.test(home) && files.some((f) => f.path === "assets/features/planet.js"));
  const site = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const serr = [];
  site.on("pageerror", (e) => serr.push(e.message));
  await site.route("http://published.test/**", (r) => {
    const q = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\//, "") || "index.html";
    const f = files.find((x) => x.path === q);
    if (!f) return r.fulfill({ status: 404, body: "" });
    return r.fulfill({ status: 200, contentType: q.endsWith(".css") ? "text/css" : q.endsWith(".js") ? "text/javascript" : "text/html", body: f.content });
  });
  await site.route(/^https?:\/\/(?!published\.test)/, (r) => r.fulfill({ status: 200, contentType: "text/plain", body: "" }));
  /* Registered last, so it is asked first: the picture stays where the site keeps it. */
  await site.route("**/planet-test.png", servePic);
  await site.goto("http://published.test/index.html", { waitUntil: "load" });
  await site.waitForTimeout(1200);
  const PUB = '#n_drawn canvas[data-planet-canvas]';
  const pubN = await site.locator(PUB).count();
  check("Published, the drawn orb is a ball", pubN === 1, `${pubN} canvas`);
  if (pubN) {
    const lit = await site.evaluate((s) => { const c = document.querySelector(s); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 0) n++; return n / (c.width * c.height); }, PUB);
    check("Published, the ball is drawn, not blank", lit > 0.7, `${Math.round(lit * 100)}% of its box`);
    const sat = await centreOf(site, PUB);
    const u0 = await turnOf(site, '#n_drawn [data-planet]');
    await drag(site, { x: sat.x - 80, y: sat.y }, 160, 0, 20, 150);
    const u1 = await turnOf(site, '#n_drawn [data-planet]');
    check("Published, a drag turns it", apart(u0, u1) > 0.3, apart(u0, u1).toFixed(2));
    const ppf = (await site.locator('#n_pic canvas[data-planet-canvas]').count()) ? await middle(site, '#n_pic canvas[data-planet-canvas]') : "none";
    const ppsrc = await site.evaluate(() => document.querySelector("#n_pic img[data-planet-picture]")?.getAttribute("src") ?? "no picture");
    check("Published, the picture is wrapped round the picture orb", ppf === "b", `${ppf}, from ${ppsrc.slice(0, 60)}`);
  }
  check("Nothing throws on the published page", serr.length === 0, serr.join("; "));
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
