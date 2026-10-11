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
 *      the screen's size, as the chart part's picture, under the static that
 *      covers it as the page opens (shown, as on the page); the blank chart
 *      canvas is a plain box, never the library's stand-in landscape;
 *   5. the TV still comes in as the page opens: "Tuning in to the game
 *      server";
 *   6. look from capture: what the builder had no field for is drawn as
 *      the page computed it, and the part says so;
 *   7. accuracy, scored: the Preview against the page at 1440 and 390, part
 *      by part and pixel by pixel, held at what this branch reached; and the
 *      board opens with the page across the pane, no part outside it;
 *   8. a slot for each: PST's gradients, patterns, shadows, turns, filters,
 *      glow, animations and its hover, press and focus come in as the part's
 *      Page look, are edited there (panel and wheel), and go back out through
 *      the style layer; untouched, they write nothing.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/tv-import.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/bring-in/siteRead.ts, src/features/studio/bring-in/pageParts.ts, src/features/studio/stills.ts, src/features/studio/builderManifest.ts, src/features/studio/repoRun.ts, src/app/api/studio/zip/route.ts, src/features/studio/bring-in/FromASite.tsx
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { readManifest } from "../src/features/studio/builderManifest.ts";
import { readStills, stillQuery, stillsAsk, readStillsAsk, stillFiles } from "../src/features/studio/stills.ts";
import { artCss, buildLayer, changedDeclarations, lookOf as layerLook, statesCss } from "../src/features/studio/send-out/styleLayer.ts";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* PST_ROOT=path to a copy of PST's web/ and builder.json scores another revision of it (with SCORE_ONLY=1). */
const ROOT = process.env.PST_ROOT ?? "tests/fixtures/pst-tv";
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
/* The document is in IndexedDB once it outgrows localStorage (board/store/create.ts), with only a pointer left there. */
const board = () => ui.evaluate(() => new Promise((done) => {
  const local = JSON.parse(localStorage.getItem("builder.studio") ?? "{}");
  if (local.state?.nodes) return done(local.state);
  const req = indexedDB.open("builder.docs", 1);
  req.onerror = () => done({ nodes: [] });
  req.onupgradeneeded = () => { req.result.createObjectStore("docs"); };
  req.onsuccess = () => { try { const g = req.result.transaction("docs", "readonly").objectStore("docs").get("builder.studio"); g.onsuccess = () => done(typeof g.result === "string" ? JSON.parse(g.result).state : { nodes: [] }); g.onerror = () => done({ nodes: [] }); } catch { done({ nodes: [] }); } };
}));
let st = await board();
for (let i = 0; i < 150 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(2000);
st = await board();
/* The board opens with the page across the pane (the owner, 2026-10-03: framed at 37 to 48%, not the 1440 page), and nothing drawn sits outside the page. */
const fit = await ui.evaluate(() => {
  const f = document.querySelector("[data-frame]")?.getBoundingClientRect(), pane = document.querySelector("[data-studio-pane]")?.getBoundingClientRect();
  const out = Array.from(document.querySelectorAll("[data-node-id]")).map((e) => ({ id: e.getAttribute("data-node-id"), r: e.getBoundingClientRect() })).filter((x) => f && x.r.width > 0 && x.r.height > 0 && (x.r.right > f.right + 2 || x.r.left < f.left - 2)).map((x) => x.id);
  return { frame: f ? Math.round(f.width) : 0, pane: pane ? Math.round(pane.width) : 0, out };
});
check("the board opens with the 1440 page filling the pane across, and no part outside the page", fit.frame >= fit.pane - 130 && fit.frame <= fit.pane && fit.out.length === 0, JSON.stringify(fit));
if (process.env.STORE_FILE) { const { writeFileSync } = await import("node:fs"); writeFileSync(process.env.STORE_FILE, JSON.stringify(st)); }
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
  check(`…its ball is a part of its own, ${ball.bg} with an ink edge`, !!ballNode && ballNode.colour?.bg === ball.bg && ballDrawn?.border === ball.edge && ballNode.w === 22 && ballNode.h === 22, JSON.stringify({ bg: ballNode?.colour?.bg, edge: ballNode?.edge, w: ballNode?.w }));
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
check("…under the static, which covers it as the page opens: the static, the scanlines, the glare and \u201cTuning in\u201d are all shown, as on the page", !staticNode?.state && !byHook("chart-tv-scanlines")?.state && !byHook("chart-tv-vignette")?.state && !byHook("chart-tv-loading")?.state, JSON.stringify(staticNode?.state ?? null));
/* The chart's canvas, blank without its code, is a box with nothing to paint: as a picture with no file it drew the library's stand-in landscape over the screen. */
check("…and the blank chart canvas is no picture: no stand-in landscape on the screen", byHook("chart-canvas")?.featureId !== "picture" && !st.nodes.some((n) => n.pageId === home && n.featureId === "picture" && /> canvas: /.test(n.prompt ?? "")), byHook("chart-canvas")?.featureId);

/* 5. The state it opens in. */
check("5. the screen still opens tuning in, as the page does before its code runs", st.nodes.some((n) => n.pageId === home && n.hooks?.["data-hook"] === "chart-tv-loading-title" && JSON.stringify(n.content).includes(page.tuning)), page.tuning);
check("no errors on the page", errors.length === 0, errors.slice(0, 3).join(" | "));

/*
 * 6. LOOK FROM CAPTURE. What the builder has no field for yet is drawn as
 * the page computed it, not dropped, and the part says so: the TV body's
 * gradient, the knobs' stacked shadows, the title icons' masks, the label
 * glow; any animation the page runs comes with its @keyframes in the look.
 */
const lookOf = (h) => byHook(h)?.source?.look ?? [];
check("6. a part wearing what the builder cannot set yet is marked look from capture, with what", lookOf("chart-tv-body").includes("gradient") && st.nodes.some((n) => n.pageId === home && (n.source?.look ?? []).includes("icon mask")), JSON.stringify({ body: lookOf("chart-tv-body"), marked: st.nodes.filter((n) => n.pageId === home && n.source?.look?.length).length }));
const textGlow = st.nodes.find((n) => n.pageId === home && n.art?.textShadow);
check("…a text glow is drawn as computed, not dropped", !!textGlow && (textGlow.source?.look ?? []).includes("text glow"), textGlow ? `${textGlow.hooks?.["data-hook"] ?? textGlow.label}: ${textGlow.art.textShadow.slice(0, 60)}` : "none");
const moving = st.nodes.filter((n) => n.pageId === home && n.motion?.animation?.length);
const frames = st.look?.keyframes ?? [];
check("…an animation comes with its @keyframes in the look", moving.length === 0 || moving.every((n) => n.motion.animation.every((a) => frames.some((k) => k.name === a.name))), `${moving.length} animated, keyframes: ${frames.map((k) => k.name).join(", ") || "none"}`);
await ui.click(`[data-node-id="${byHook("chart-tv-body")?.id}"]`, { force: true }).catch(() => {});
await ui.waitForTimeout(400);
const said = await ui.locator("[data-look-from-capture]").first().textContent({ timeout: 3000 }).catch(() => "");
check("…and the panel says so on the part picked", /^Look from capture: [a-z]/.test(said ?? ""), (said ?? "").slice(0, 120));

/*
 * 8. A SLOT FOR EACH. What PST wears besides colour, edge, type and one
 * corner is a slot of the part's Page look (`LookFields.tsx`), in CSS:
 * imported, shown, edited, and written back by the style layer.
 */
const slotOf = (h, prop) => artCss(byHook(h) ?? {})[prop] ?? "";
check("8. PST's looks come in as slots: gradient, stripes, mask, turn, slant, filter, glow, corners, animation", /gradient/.test(slotOf("chart-tv-body", "background-image")) && /repeating-linear-gradient/.test(slotOf("chart-tv-speaker", "background-image")) && /url\(/.test(st.nodes.find((n) => n.pageId === home && n.art?.mask)?.art?.mask ?? "") && /matrix/.test(slotOf("chart-tv-antenna-left", "transform")) && /matrix\(1, 0, 0\.2/.test(slotOf("chart-tv-foot-left", "transform")) && /contrast/.test(slotOf("chart-tv-static", "filter")) && st.nodes.some((n) => n.pageId === home && artCss(n)["text-shadow"]) && st.nodes.some((n) => n.pageId === home && artCss(n)["border-radius"]) && /pons-tv-antenna-left/.test(slotOf("chart-tv-antenna-left", "animation")), JSON.stringify({ speaker: slotOf("chart-tv-speaker", "background-image").slice(0, 40), foot: slotOf("chart-tv-foot-left", "transform"), anim: slotOf("chart-tv-antenna-left", "animation") }));
const pressed = statesCss(byHook("chart-tv-idle-button") ?? {});
check("…and its hover, press and focus: the TV button sinks when pressed, the page's tokens resolved", /translate\(\d+px, \d+px\)/.test(pressed.active ?? "") && !/var\(/.test(pressed.active ?? "") && st.nodes.some((n) => n.pageId === home && statesCss(n)["focus-visible"]), JSON.stringify(pressed));
const untouched = st.nodes.filter((n) => n.pageId === home && n.source?.was).filter((n) => changedDeclarations(n.source.was, { ...layerLook(n, null), box: n.source.was.box }, { dx: 0, dy: 0 }).some((d) => /^(background-image|background-size|mask|transform|filter|backdrop|mix-blend|clip-path|text-shadow|-webkit-text-stroke|paint-order|border-radius|animation|transition):/.test(d)));
check("…untouched, no slot writes a declaration", untouched.length === 0, untouched.slice(0, 4).map((n) => n.hooks?.["data-hook"] ?? n.label).join(", "));
const speaker = byHook("chart-tv-speaker"), idle = byHook("chart-tv-idle-button");
const edited = [{ ...speaker, art: { ...speaker.art, filter: "blur(1px)" } }, { ...idle, motion: { ...idle.motion, hover: [{ self: true, state: "hover", style: { filter: "brightness(1.2)" } }] } }];
const layer = buildLayer(edited, null, { repo: "x/pst", ref: "", dir: "web/", files: [] });
check("…edited, a slot goes back as the page's own CSS: a filter on the speaker, a hover on the button", layer.rules.some((r) => r.selector === '[data-hook="chart-tv-speaker"]' && r.declarations.includes("filter: blur(1px)")) && layer.rules.some((r) => r.selector === '[data-hook="chart-tv-idle-button"]:hover' && r.declarations.includes("filter: brightness(1.2)")), layer.rules.map((r) => `${r.selector} { ${r.declarations.join("; ")} }`).join(" | ").slice(0, 300));
/* And edited by hand: the part picked, its Page look opened, a slot typed into. */
await ui.click(`[data-node-id="${speaker.id}"]`, { force: true }).catch(() => {});
await ui.waitForTimeout(300);
await ui.locator("button", { hasText: /^Page look/ }).first().click({ timeout: 3000 }).catch(() => {});
const slot = ui.locator('[data-look-slot="filter"] input').first();
await slot.fill("blur(1px)", { timeout: 3000 }).catch(() => {});
await slot.press("Enter").catch(() => {});
await ui.waitForTimeout(400);
const typed = (await board()).nodes.find((n) => n.id === speaker.id)?.art?.filter ?? null;
const shown = await ui.locator('[data-look-slot="background-image"] input').first().inputValue({ timeout: 2000 }).catch(() => "");
check("…in the panel: the speaker's stripes shown in their slot, a filter typed is on the part", /repeating-linear-gradient/.test(shown) && typed === "blur(1px)", `${shown.slice(0, 40)} · ${typed}`);
/* Back as it came, for the score below. */
await slot.fill("", { timeout: 2000 }).catch(() => {});
await slot.press("Enter").catch(() => {});
await ui.waitForTimeout(300);

/*
 * 7. IMPORT ACCURACY, SCORED. The Preview of Play (the site as the board
 * makes it, opened in a window of that width) against the live page at that
 * width, at 1440 and at 375. For every hooked part shown as the page opens:
 *   place  within 4px of the page's (from the top left of the site),
 *   size   within 4px,
 *   text   the same words, as shown (innerText, spaces collapsed),
 *   look   its pixels, sampled over its box in each picture: at most 12% of
 *          them differ by more than 96 (summed over red, green and blue), and
 *          the mean colour within 30. A colour, edge, shadow, picture or icon
 *          lost shows here; a face drawn a pixel differently does not.
 * A part matches when all four hold. And over the whole page, the share of
 * pixels that differ by more than 96, with whatever one picture has and the
 * other does not counted as differing. Every part that still differs is
 * listed with what. SCORE_ONLY=1 prints the score without holding it.
 */
const prev = ui;
const score = async (width, device = "window") => {
  /* The phone is drawn 390 wide, one to one: the window has room for it and its margin. */
  const win = device === "phone" ? width + 120 : width;
  await prev.setViewportSize({ width: win, height: 900 });
  await prev.goto(`${URL_BASE}/builder/preview`, { waitUntil: "networkidle" });
  await prev.waitForTimeout(2000);
  if (device !== "window") { await prev.evaluate((d) => window.__studioLiveDevice?.(d), device); await prev.waitForTimeout(1500); }
  const tall = await prev.evaluate(() => {
    const sc = document.querySelector("[data-live-scroller]");
    if (!sc) return 0;
    const h = sc.scrollHeight;
    sc.style.overflow = "visible"; sc.style.height = `${h}px`; sc.style.flex = "none";
    if (sc.parentElement) sc.parentElement.style.height = `${h}px`;
    return h;
  });
  /* At rest, as the page is shot: the builder plays the page's own animations (the LED's blink). */
  await prev.addStyleTag({ content: "*, *::before, *::after { animation: none !important; transition: none !important; }" });
  await prev.setViewportSize({ width: win, height: Math.max(900, tall + 200) });
  await prev.waitForTimeout(500);
  /* The site's own top left, in the window or in the phone's frame. */
  const origin = await prev.evaluate(() => { const r = document.querySelector("[data-live-root]")?.getBoundingClientRect(); return r ? { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), w: Math.round(r.width), h: Math.round(r.height) } : { x: 0, y: 0, w: 0, h: 0 }; });
  const nodes = st.nodes.filter((n) => n.pageId === home && !n.state && n.hooks?.["data-hook"]);
  const board = await prev.evaluate((ids) => Object.fromEntries(ids.map((id) => {
    const e = document.querySelector(`[data-live-node="${id}"]`);
    if (!e) return [id, null];
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return [id, r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" ? { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, text: (e.innerText ?? "").replace(/\s+/g, " ").trim() } : null];
  })), nodes.map((n) => n.id));
  const previewShot = (await prev.screenshot({ fullPage: true })).toString("base64");
  await live.setViewportSize({ width, height: 900 });
  await live.waitForTimeout(400);
  /* A check and its words are one part on the board, as in its label: the page's box for it is the label's. */
  const onPage = await live.evaluate((hs) => Object.fromEntries(hs.map((h) => {
    const hit = document.querySelector(`[data-hook="${h}"]`);
    const e = hit?.matches("input[type=checkbox], input[type=radio]") ? hit.closest("label") ?? hit : hit;
    if (!e) return [h, null];
    const r = e.getBoundingClientRect(), cs = getComputedStyle(e);
    return [h, r.width > 0 && r.height > 0 && cs.visibility !== "hidden" ? { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height, text: (e.innerText ?? "").replace(/\s+/g, " ").trim() } : null];
  })), nodes.map((n) => n.hooks["data-hook"]));
  const liveShot = (await live.screenshot({ fullPage: true })).toString("base64");
  if (process.env.SHOTDIR) { const { writeFileSync } = await import("node:fs"); writeFileSync(`${process.env.SHOTDIR}/look-page-${width}.png`, Buffer.from(liveShot, "base64")); writeFileSync(`${process.env.SHOTDIR}/look-builder-${width}.png`, Buffer.from(previewShot, "base64")); }
  /* The parts the page shows at this width; one the builder does not draw is a part that differs. A turned part is held by its own check (2): its bounds lean on the page. */
  const words = (t) => (t ?? "").replace(/\u200b/g, "").replace(/\s+/g, " ").trim();
  const parts = nodes.filter((n) => onPage[n.hooks["data-hook"]] && n.w >= 4 && n.h >= 4).map((n) => ({ hook: n.hooks["data-hook"], turned: !!n.art?.transform, worded: typeof n.content === "string" ? !!n.content.trim() : Array.isArray(n.content) && n.content.some((r) => r.text?.trim()), a: onPage[n.hooks["data-hook"]], b: board[n.id] ? { ...board[n.id], x: board[n.id].x - origin.x, y: board[n.id].y - origin.y } : null }));
  const px = await prev.evaluate(async ({ A, B, parts, origin }) => {
    const load = async (b64) => { const i = new Image(); i.src = `data:image/png;base64,${b64}`; await i.decode(); const c = document.createElement("canvas"); c.width = i.width; c.height = i.height; const g = c.getContext("2d", { willReadFrequently: true }); g.drawImage(i, 0, 0); return { g, w: i.width, h: i.height, d: g.getImageData(0, 0, i.width, i.height).data }; };
    const P = await load(A), Q = await load(B);
    const at = (img, x, y) => { x = Math.round(x); y = Math.round(y); if (x < 0 || y < 0 || x >= img.w || y >= img.h) return null; const i = (y * img.w + x) * 4; return [img.d[i], img.d[i + 1], img.d[i + 2]]; };
    const dist = (p, q) => (!p || !q ? Infinity : Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]));
    /* A pixel of the page against the board's at the same place or one beside it: words set a pixel to one side are the same words. */
    const far = (pa, x, y) => { if (!pa) return true; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dist(pa, at(Q, x + dx, y + dy)) <= 96) return false; return true; };
    /* Each part: its box sampled on a grid of up to 60 by 60 in each picture, the board's stretched over the page's. */
    const each = parts.map((p) => {
      if (!p.b) return null;
      const nx = Math.max(1, Math.min(60, Math.round(p.a.w))), ny = Math.max(1, Math.min(60, Math.round(p.a.h)));
      let off = 0, n = 0; const ma = [0, 0, 0], mb = [0, 0, 0];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const u = (i + 0.5) / nx, v = (j + 0.5) / ny;
        /* A turned part is looked at where the page drew it, on both: the board's box for it is the unturned one, the page's the one round the lean. */
        const ax = p.a.x + u * p.a.w, ay = p.a.y + v * p.a.h, bx = p.turned ? ax : p.b.x + u * p.b.w, by = p.turned ? ay : p.b.y + v * p.b.h;
        const pa = at(P, ax, ay), pb = at(Q, origin.x + bx, origin.y + by);
        n++; if (far(pa, origin.x + bx, origin.y + by)) off++;
        if (pa) for (let k = 0; k < 3; k++) ma[k] += pa[k];
        if (pb) for (let k = 0; k < 3; k++) mb[k] += pb[k];
      }
      return n ? { off: off / n, mean: Math.hypot(...ma.map((v, k) => (v - mb[k]) / n)) } : null;
    });
    /* The whole page: every pixel of the page's own picture against the board's at the site's top left (the board's empty room below the page is not the page). */
    const W = P.w, H = P.h;
    let off = 0;
    let all = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) { all++; if (far(at(P, x, y), origin.x + x, origin.y + y)) off++; }
    return { each, page: off / Math.max(1, all) };
  }, { A: liveShot, B: previewShot, parts, origin });
  const off = [];
  parts.forEach((p, i) => {
    const what = [];
    if (!p.b) what.push("not drawn by the builder");
    else {
      if (!p.turned && (Math.abs(p.a.x - p.b.x) > 4 || Math.abs(p.a.y - p.b.y) > 4)) what.push(`place off ${Math.round(p.b.x - p.a.x)}, ${Math.round(p.b.y - p.a.y)}`);
      if (!p.turned && (Math.abs(p.a.w - p.b.w) > 4 || Math.abs(p.a.h - p.b.h) > 4)) what.push(`size ${Math.round(p.b.w)}x${Math.round(p.b.h)}, page ${Math.round(p.a.w)}x${Math.round(p.a.h)}`);
      if (p.worded && words(p.a.text) !== words(p.b.text)) what.push(`text “${p.b.text.slice(0, 40)}”, page “${p.a.text.slice(0, 40)}”`);
      const q = px.each[i];
      if (q && (q.off > 0.12 || q.mean > 30)) what.push(`look ${Math.round(q.off * 100)}% of pixels off, mean colour off ${Math.round(q.mean)}`);
    }
    if (what.length) off.push({ hook: p.hook, what });
  });
  const matching = parts.length - off.length;
  console.log(`\n  Accuracy, Play at ${width}: ${matching} of ${parts.length} parts match (${Math.round((matching / Math.max(1, parts.length)) * 100)}%), ${(px.page * 100).toFixed(1)}% of the page's pixels differ${off.length ? ". Still differ:" : "."}`);
  for (const o of off) console.log(`    ${o.hook}  ${o.what.join("; ")}`);
  return { width, parts: parts.length, matching, pixels: px.page, off, origin };
};
const wide = await score(1440);
/* The builder draws a phone 390 wide (`live/small.ts`), so the page is measured at 390 beside it. */
const narrow = await score(390, "phone");
if (process.env.SCORE_FILE) { const { writeFileSync } = await import("node:fs"); writeFileSync(process.env.SCORE_FILE, JSON.stringify([wide, narrow], null, 1)); }
/* What this branch reached, held so it cannot slip back. */
const HOLD = { 1440: { share: 1, pixels: 0.015 }, 390: { share: 1, pixels: 0.015 } };
for (const r of [wide, narrow]) check(`7. at ${r.width} the import scores at least what it reached (${Math.round(HOLD[r.width].share * 100)}% of parts, at most ${Math.round(HOLD[r.width].pixels * 100)}% of pixels off)`, !!process.env.SCORE_ONLY || (r.parts > 60 && r.matching / r.parts >= HOLD[r.width].share && r.pixels <= HOLD[r.width].pixels), `${r.matching}/${r.parts} parts, ${(r.pixels * 100).toFixed(1)}% pixels`);
/*
 * …AND A LINE HELD ON ONE LINE IS NEVER CUT. J (2026-10-03), on the live
 * builder: PST's title drew "PonsStars test pag". Its part was 314px wide, as
 * the capture measured it, and its words in the viewer's monospace needed
 * 334. The words of a one-line part are set as wide as they need, so here
 * the title is stored at half its width (another machine's font, in short)
 * and its words, which run past the box, must be cut by nothing between them
 * and the page: not on the board, not in the Preview.
 */
{
  const title = byHook("page-title");
  const cut = async (url, nodeSel) => {
    await ui.goto(`${URL_BASE}${url}`, { waitUntil: "networkidle" });
    await ui.waitForTimeout(2000);
    return ui.evaluate(({ id, nodeSel }) => {
      const host = document.querySelector(nodeSel.replace("ID", id));
      const words = host && Array.from(host.querySelectorAll("*")).find((e) => Array.from(e.childNodes).some((c) => c.nodeType === 3 && c.textContent.includes("PonsStars")));
      if (!host || !words) return { found: false };
      const range = document.createRange(); range.selectNodeContents(words);
      const ink = range.getBoundingClientRect(), box = host.getBoundingClientRect();
      const cutBy = [];
      for (let e = words; e && e !== host.parentElement; e = e.parentElement) { const c = getComputedStyle(e); if (/hidden|clip|scroll|auto/.test(c.overflowX) || c.clipPath !== "none") cutBy.push(`${e.tagName.toLowerCase()} ${c.overflowX}`); }
      return { found: true, past: Math.round(ink.right - box.right), cutBy, oneLine: ink.height < 1.8 * parseFloat(getComputedStyle(words).fontSize) };
    }, { id: title.id, nodeSel });
  };
  /* Half the width the page's own words take (the h1 itself is the page's width). */
  const wordsW = await live.evaluate(() => { const e = document.querySelector('[data-hook="page-title"]'); const r = document.createRange(); r.selectNodeContents(e); return r.getBoundingClientRect().width; });
  /* Stored where the document lives: IndexedDB, and localStorage when it fits there. */
  const doc = await board();
  await ui.evaluate(({ doc, id, w }) => new Promise((done) => {
    const env = JSON.stringify({ state: { ...doc, nodes: doc.nodes.map((n) => (n.id === id ? { ...n, w } : n)) }, version: 0 });
    try { localStorage.setItem("builder.studio", env); } catch {}
    const req = indexedDB.open("builder.docs", 1);
    req.onupgradeneeded = () => { req.result.createObjectStore("docs"); };
    req.onerror = () => done(null);
    req.onsuccess = () => { const tx = req.result.transaction("docs", "readwrite"); tx.objectStore("docs").put(env, "builder.studio"); tx.oncomplete = () => done(null); tx.onerror = () => done(null); };
  }), { doc, id: title?.id, w: Math.round(wordsW / 2) });
    const onBoardCut = await cut("/builder", '[data-node-id="ID"]');
  const inPreview = await cut("/builder/preview", '[data-live-node="ID"]');
  for (const [where, r] of [["on the board", onBoardCut], ["in the Preview", inPreview]]) check(`7. the title stored at half its width runs past its box on one line ${where}, cut by nothing`, !!title && r.found && r.past > 10 && r.oneLine && r.cutBy.length === 0, JSON.stringify(r));
}
await prev.setViewportSize({ width: 1440, height: 900 });
if (process.env.SHOT) { const tv = byHook("chart-tv"); const loc = ui.locator(`[data-node-id="${tv?.id}"]`).first(); await loc.scrollIntoViewIfNeeded().catch(() => {}); await ui.screenshot({ path: process.env.SHOT }); }

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
