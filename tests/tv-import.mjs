/**
 * PST'S CHART TV, BROUGHT IN FROM ITS REPOSITORY, DRAWS AS THE PAGE DOES.
 *
 * Re-imported into the Builder, PST's Chart TV (PR #14) came in with its
 * orange body white inside its outline, and its two antennas (a rod with a
 * red ball on the tip, each leaning its own way) as one dark block. The
 * reading by parts (`siteRead.ts#PARTS`) kept one colour per part and the box
 * round each part as the browser reported it: the body's paint is a
 * gradient built from tokens over no colour at all, each rod is a 6x90 bar
 * turned -32deg and 28deg (its reported box the 51x81 round the lean, filled
 * with ink), and the balls are each rod's ::after, with no element to read.
 *
 * The fixture is PST's web/ and builder.json as a repository
 * (tests/fixtures/pst-tv/FROM.md), brought in through the GitHub control
 * against a stand-in GitHub, at 1440. Then, against the same page opened in
 * a browser at 1440 as a visitor sees it (its rods at rest):
 *
 *   1. the body's fill is the page's gradient, as computed, and its shadow;
 *      and what the board draws there is orange, not white;
 *   2. each rod is a part of the rod's own size, turned as the page turns it:
 *      the box it covers on the board is the box it covers on the page, and
 *      the two are apart; each ball is a part of its own, red with an ink
 *      edge, on its rod's tip where the page draws it;
 *   3. the gradients, shadows and turns are general: the knobs' radial
 *      gradients, the speaker's stripes, the feet's slant, the screen's
 *      static (a data: picture with its filter), a knob's turned notch;
 *   4. the screen holds a still of the sample chart (builder.json
 *      `preview.stills`: chart on tv-idle), taken from the repository's own
 *      preview page with nothing reaching the network: a candle chart of
 *      the screen's size, as the chart part's picture; the static that would
 *      cover it, which tv-idle does not show, kept as a hidden part;
 *   5. the TV still comes in as the page opens: "Tuning in to the game
 *      server".
 *
 *   npm run build && npx next start -p 3013
 *   node tests/tv-import.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/siteRead.ts, src/features/studio/pageParts.ts, src/features/studio/stills.ts, src/features/studio/builderManifest.ts, src/features/studio/repoRun.ts, src/app/api/studio/zip/route.ts, src/features/studio/FromASite.tsx
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { readManifest } from "../src/features/studio/builderManifest.ts";
import { readStills, stillQuery, stillsAsk, readStillsAsk, stillFiles } from "../src/features/studio/stills.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ROOT = "tests/fixtures/pst-tv";
const FILES = {};
const walk = (d, rel = "") => { for (const n of readdirSync(d)) { const p = join(d, n); const r = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) walk(p, r); else if (n !== "FROM.md") FILES[r] = readFileSync(p); } };
walk(ROOT);

/* ------------------------------------------------------------------ */
/* 0. The stills, read                                                  */
/* ------------------------------------------------------------------ */

const m = readManifest(FILES["builder.json"].toString("utf8"), "builder.json");
check("builder.json's stills: the part by its hook and the preview screen", JSON.stringify(m?.stills) === JSON.stringify([{ hook: "chart", screen: "tv-idle" }]), JSON.stringify(m?.stills));
check("a still is asked for at the manifest's own query with the screen in it", JSON.stringify(stillsAsk(m)) === JSON.stringify({ page: "web/preview.html", shots: [{ hook: "chart", query: "?still=1&screen=tv-idle" }] }));
check("stills read loosely: no hook, a hook that is not a name, are left out", readStills([{ screen: "x" }, { hook: "a b" }, { hook: "ok", screen: "bad name" }, "x"]).map((s) => `${s.hook}:${s.screen}`).join() === "ok:null" && stillQuery(null, "idle") === "?still=1&screen=idle");
check("the route takes only a page in the zip's shape and plain queries", readStillsAsk(JSON.stringify({ page: "../x.html", shots: [{ hook: "a", query: "" }] })) === null && readStillsAsk(JSON.stringify({ page: "web/p.html", shots: [{ hook: "a", query: "?x=<script>" }] })) === null && readStillsAsk(JSON.stringify({ page: "web/p.html", shots: [{ hook: "a", query: "?still=1&screen=b" }] }))?.shots.length === 1);
check("the preview page's folder is packed, without its notes", stillFiles([{ path: "web/a.js" }, { path: "web/HOOKS.md" }, { path: "server/x.js" }, { path: "web/vendor/c.mjs" }], "web/preview.html").map((e) => e.path).join() === "web/a.js,web/vendor/c.mjs");

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/* ------------------------------------------------------------------ */
/* The page, as a visitor's browser draws it at 1440                    */
/* ------------------------------------------------------------------ */

const TYPES = { html: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json", png: "image/png", svg: "image/svg+xml" };
const live = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await live.route("**/*", (r) => {
  const u = new URL(r.request().url());
  if (u.host !== "pst.invalid") return r.abort();
  const f = u.pathname.slice(1) || "web/index.html";
  const body = FILES[f];
  if (!body) return r.fulfill({ status: 404, body: "" });
  /* As the import reads it: the page before its scripts run, so the TV is in the state its HTML says (offline, tuning in). */
  r.fulfill({ status: 200, contentType: TYPES[f.split(".").pop()] ?? "application/octet-stream", body: f.endsWith(".html") ? body.toString("utf8").replace(/<script\b[\s\S]*?<\/script>/gi, "") : body });
});
await live.goto("https://pst.invalid/web/index.html", { waitUntil: "load" });
/* The rods at rest: they sway, and the board draws them where they lean. */
await live.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
await live.waitForTimeout(300);
const page = await live.evaluate(() => {
  const at = (e) => { const r = e.getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height }; };
  const q = (h) => document.querySelector(`[data-hook="${h}"]`);
  const body = getComputedStyle(q("chart-tv-body"));
  /* A ball is the rod's ::after: drawn by a stand-in child with its computed place and size, which turns with the rod as the ::after does. */
  const ball = (h) => {
    const rod = q(h), ps = getComputedStyle(rod, "::after");
    const i = document.createElement("i");
    i.style.cssText = `position:absolute;box-sizing:${ps.boxSizing};left:${ps.left};top:${ps.top};width:${ps.width};height:${ps.height}`;
    rod.appendChild(i);
    const b = at(i);
    i.remove();
    return { ...b, bg: ps.backgroundColor, edge: ps.borderTopColor };
  };
  return {
    body: { image: body.backgroundImage, shadow: body.boxShadow, box: at(q("chart-tv-body")) },
    rods: ["chart-tv-antenna-left", "chart-tv-antenna-right"].map((h) => ({ h, box: at(q(h)), w: q(h).offsetWidth, hh: q(h).offsetHeight })),
    balls: ["chart-tv-antenna-left", "chart-tv-antenna-right"].map(ball),
    screen: at(q("chart")),
    tuning: q("chart-tv-loading-title")?.textContent ?? "",
  };
});
check("the page itself: an orange gradient body and two leaning rods apart", /linear-gradient\(160deg, rgb\(255, 179, 107\)/.test(page.body.image) && page.rods[0].box.x + page.rods[0].box.w < page.rods[1].box.x + page.rods[1].box.w && page.rods[0].w === 6, JSON.stringify(page.rods));

/* ------------------------------------------------------------------ */
/* Brought in through the GitHub control, from a stand-in GitHub        */
/* ------------------------------------------------------------------ */

const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/pst(\/.*)?$/);
  if (!mm) return j({ message: "no" }, 404);
  const rest = mm[1] ?? "";
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  const b = /\/git\/blobs\/f(\d+)$/.exec(rest);
  if (b) return j({ encoding: "base64", content: FILES[names[Number(b[1])]].toString("base64") });
  if (rest.startsWith("/contents/")) { const f = decodeURIComponent(rest.slice(10).split("?")[0]); return FILES[f] !== undefined ? j({ content: FILES[f].toString("base64"), encoding: "base64" }) : j({}, 404); }
  if (rest.startsWith("/git/ref/heads/")) return j({ object: { sha: "c0" } });
  if (rest.startsWith("/commits/")) return j({ sha: "c0" });
  return j({ message: "no" }, 404);
});
await ui.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await ui.evaluate(() => {
  const env = (state) => JSON.stringify({ state, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "PST", updatedAt: Date.now() }], activeId: "s1" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await ui.reload({ waitUntil: "networkidle" });
await ui.waitForTimeout(900);
const keys = ui.locator("[data-keys-panel]");
await ui.getByRole("button", { name: "Keys", exact: true }).click();
await ui.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await ui.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await ui.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await ui.waitForTimeout(500);
await ui.locator("[data-github-button]").first().click();
await ui.waitForTimeout(700);
await ui.locator("[data-repo-bring]").fill("him/pst");
await ui.locator("[data-repo-pull]").click();
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 150 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(2000);
st = await board();
const home = st.pages[0]?.id;
const byHook = (h) => st.nodes.find((n) => n.pageId === home && n.hooks?.["data-hook"] === h);
const strip = await ui.evaluate(() => document.querySelector("[data-import-strip]")?.textContent ?? "");
check("PST came in by its builder.json, its TV parts by their hooks", st.nodes.length > 200 && !!byHook("chart-tv-body") && !!byHook("chart-tv-antenna-left"), `${st.nodes.length} parts; ${strip.slice(0, 160)}`);

/* 1. The body's fill. */
const tvBody = byHook("chart-tv-body");
check("1. chart-tv-body carries the page's gradient as computed, and its shadow", tvBody?.art?.background === page.body.image && tvBody?.edge?.shadow === page.body.shadow, `${tvBody?.art?.background?.slice(0, 90)} | ${tvBody?.edge?.shadow?.slice(0, 60)}`);

/* Where the board's page frame is, and how far it is zoomed, so a box on the board is read in the page's px. */
await ui.keyboard.press("Escape");
await ui.waitForTimeout(400);
const onBoard = async (id) => ui.evaluate(({ id, W }) => {
  const frame = document.querySelector("[data-frame]");
  const el = document.querySelector(`[data-node-id="${id}"] [data-part-box]`) ?? document.querySelector(`[data-node-id="${id}"]`);
  if (!frame || !el) return null;
  const f = frame.getBoundingClientRect();
  const k = f.width / W;
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  return { x: (r.left - f.left) / k, y: (r.top - f.top) / k, w: r.width / k, h: r.height / k, image: s.backgroundImage, shadow: s.boxShadow, transform: s.transform, bg: s.backgroundColor, border: s.borderTopColor, k };
}, { id, W: st.frameWidth || 1440 });
const bodyDrawn = await onBoard(tvBody.id);
check("…and the board draws it: the box wrapper's background is that gradient", !!bodyDrawn && bodyDrawn.image === page.body.image, bodyDrawn?.image?.slice(0, 90));
/* What is on screen at the body's left padding, half way down: orange, never white. */
const pixel = async (id, fx, fy) => {
  const loc = ui.locator(`[data-node-id="${id}"]`).first();
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const png = await loc.screenshot();
  return ui.evaluate(async ({ b64, fx, fy }) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = document.createElement("canvas");
    c.width = img.width; c.height = img.height;
    const g = c.getContext("2d");
    g.drawImage(img, 0, 0);
    return Array.from(g.getImageData(Math.round(img.width * fx), Math.round(img.height * fy), 1, 1).data);
  }, { b64: png.toString("base64"), fx, fy });
};
const px = await pixel(tvBody.id, 0.012, 0.5);
check("…what shows in its padding is the gradient's orange, not white", px[0] > 200 && px[1] > 90 && px[1] < 200 && px[2] < 130, JSON.stringify(px));

/* 2. The antennas. */
const near = (a, b, d = 3) => Math.abs(a - b) <= d;
for (const [i, rod] of page.rods.entries()) {
  const n = byHook(rod.h);
  const drawn = n ? await onBoard(n.id) : null;
  check(`2. ${rod.h} is a ${rod.w}x${rod.hh} rod turned as the page turns it, not the box round its lean`, n?.w === rod.w && n?.h === rod.hh && /^matrix\(/.test(n?.art?.transform ?? ""), JSON.stringify({ w: n?.w, h: n?.h, t: n?.art?.transform }));
  /* The box the turned rod covers on the board is the box it covers on the page. */
  const cover = drawn ? await ui.evaluate(({ id, W }) => {
    const f = document.querySelector("[data-frame]").getBoundingClientRect(), k = f.width / W;
    const r = document.querySelector(`[data-node-id="${id}"] [data-part-box]`).getBoundingClientRect();
    return { x: (r.left - f.left) / k, y: (r.top - f.top) / k, w: r.width / k, h: r.height / k };
  }, { id: n.id, W: st.frameWidth || 1440 }) : null;
  check(`…on the board it covers what it covers on the page at 1440 (within 3px)`, !!cover && near(cover.x, rod.box.x) && near(cover.y, rod.box.y) && near(cover.w, rod.box.w) && near(cover.h, rod.box.h), `board ${JSON.stringify(cover && Object.fromEntries(Object.entries(cover).map(([k, v]) => [k, Math.round(v)])))} page ${JSON.stringify(Object.fromEntries(Object.entries(rod.box).map(([k, v]) => [k, Math.round(v)])))}`);
  const ballNode = st.nodes.find((x) => x.pageId === home && x.label === `${rod.h}::after`);
  const ballDrawn = ballNode ? await ui.evaluate(({ id, W }) => {
    const f = document.querySelector("[data-frame]").getBoundingClientRect(), k = f.width / W;
    const el = document.querySelector(`[data-node-id="${id}"] [data-part-box]`);
    const r = el.getBoundingClientRect(), s = getComputedStyle(el);
    return { x: (r.left - f.left) / k, y: (r.top - f.top) / k, w: r.width / k, h: r.height / k, bg: s.backgroundColor, border: s.borderTopColor };
  }, { id: ballNode.id, W: st.frameWidth || 1440 }) : null;
  const ball = page.balls[i];
  check(`…its ball is a part of its own, ${ball.bg} with an ink edge`, !!ballNode && ballNode.colour?.bg === ball.bg && ballNode.edge?.colour === ball.edge && ballNode.w === 22 && ballNode.h === 22, JSON.stringify({ bg: ballNode?.colour?.bg, edge: ballNode?.edge, w: ballNode?.w }));
  check(`…on its rod's tip, where the page draws it (within 3px)`, !!ballDrawn && near(ballDrawn.x, ball.x) && near(ballDrawn.y, ball.y) && near(ballDrawn.w, ball.w) && near(ballDrawn.h, ball.h), `board ${JSON.stringify(ballDrawn && [ballDrawn.x, ballDrawn.y, ballDrawn.w, ballDrawn.h].map(Math.round))} page ${JSON.stringify([ball.x, ball.y, ball.w, ball.h].map(Math.round))}`);
}
const [l, r] = page.rods.map((x) => byHook(x.h));
check("…and the two lean apart, not one block", !!l && !!r && l.art?.transform !== r.art?.transform && /matrix\(0\.84/.test(l.art.transform) && /matrix\(0\.88/.test(r.art.transform), `${l?.art?.transform} | ${r?.art?.transform}`);

/* 3. General: the TV's other paint and turns. */
const knob = byHook("chart-tv-knob-channel");
check("3. a radial gradient (the knobs) and a shadow", /^radial-gradient/.test(knob?.art?.background ?? "") && !!knob?.edge?.shadow, knob?.art?.background?.slice(0, 60));
check("…stripes (the speaker grille, a repeating gradient)", /^repeating-linear-gradient/.test(byHook("chart-tv-speaker")?.art?.background ?? ""));
check("…a slant (the feet's skewX)", /^matrix\(1, 0, 0\.21/.test(byHook("chart-tv-foot-left")?.art?.transform ?? "") && /^matrix\(1, 0, -0\.21/.test(byHook("chart-tv-foot-right")?.art?.transform ?? ""), byHook("chart-tv-foot-left")?.art?.transform);
const noise = byHook("chart-tv-static");
check("…a data: picture written in the CSS (the static), with its filter", /^url\("data:image\/svg\+xml/.test(noise?.art?.background ?? "") && /contrast/.test(noise?.art?.filter ?? ""));
const notch = st.nodes.find((x) => x.pageId === home && x.label === "chart-tv-knob-volume::after");
check("…a ::after turned on its own (the volume knob's notch)", !!notch && /^matrix\(0\.766/.test(notch.art?.transform ?? ""), notch?.art?.transform);
check("…and a move alone stays in the box, as before (the loading box's translate)", !byHook("chart-tv-loading")?.art?.transform);

/* 4. The still of the sample chart. */
const chart = byHook("chart");
check("4. the chart part holds a still of the sample chart as its picture", !!chart?.picture?.id && /still of what the code draws into chart/.test(chart.picture.alt ?? "") && near(chart.picture.w, page.screen.w, 2) && near(chart.picture.h, page.screen.h, 2), JSON.stringify(chart?.picture ?? null));
const still = chart ? await ui.evaluate(async (id) => {
  /* Wherever the part draws its picture: a background on it or inside it, or an img. */
  const root = document.querySelector(`[data-node-id="${id}"]`);
  if (!root) return null;
  let src = null;
  for (const el of [root, ...root.querySelectorAll("*")]) {
    const m = /url\("([^"]+)"\)/.exec(getComputedStyle(el).backgroundImage);
    if (m) { src = m[1]; break; }
    if (el.tagName === "IMG" && el.currentSrc) { src = el.currentSrc; break; }
  }
  if (!src) return null;
  const img = new Image();
  img.src = src;
  await img.decode();
  const c = document.createElement("canvas");
  c.width = img.width; c.height = img.height;
  const g = c.getContext("2d");
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let green = 0, red = 0;
  for (let i = 0; i < d.length; i += 4) { if (d[i + 1] > 140 && d[i] < 120) green++; if (d[i] > 160 && d[i + 1] < 90) red++; }
  return { w: img.width, h: img.height, green, red };
}, chart.id) : null;
check("…drawn on the board: a candle chart, green and red candles in it", !!still && still.green > 300 && still.red > 300, JSON.stringify(still));
check("…and the line says so", /chart shows a still of what its code draws, from web\/preview\.html/.test(strip), strip.slice(-260));

const staticNode = byHook("chart-tv-static");
check("…the static that would cover it, not shown on tv-idle, is kept as a hidden part; the scanlines and glare stay", staticNode?.state?.group === "hidden:still" && !byHook("chart-tv-scanlines")?.state && !byHook("chart-tv-vignette")?.state && !byHook("chart-tv-loading")?.state, JSON.stringify(staticNode?.state ?? null));

/* 5. The state it opens in. */
check("5. the screen still opens tuning in, as the page does before its code runs", st.nodes.some((n) => n.pageId === home && n.hooks?.["data-hook"] === "chart-tv-loading-title" && JSON.stringify(n.content).includes(page.tuning)), page.tuning);
check("no errors on the page", errors.length === 0, errors.slice(0, 3).join(" | "));
if (process.env.SHOT) { const tv = byHook("chart-tv"); const loc = ui.locator(`[data-node-id="${tv?.id}"]`).first(); await loc.scrollIntoViewIfNeeded().catch(() => {}); await ui.screenshot({ path: process.env.SHOT }); }

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
