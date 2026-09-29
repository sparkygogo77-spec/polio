#!/usr/bin/env node
/**
 * MOTION SAMPLED FROM A PAGE, BROUGHT IN, PLAYED ON THE BOARD, IN THE PREVIEW
 * AND ON THE PUBLISHED PAGE.
 *
 * trumpmorty.fun moves in ways its first captures never carried: the big
 * planet turns and drifts, dust floats over the hero, the TV and the cards
 * tilt toward the pointer over them, the marquee hurries while the page
 * scrolls and the roadmap's line grows with it. sink now samples motion as
 * the browser draws it, on any page (`doc.behaviours.motion`, sink
 * docs/behaviours.md "Motion sampled"). Taking a document in attaches the
 * feature that does each (`library/captured.ts`):
 *
 *   · a spin (the page's script, or a stylesheet loop the part does not
 *     carry) → Spin, its period and direction;
 *   · a float → Float, its axis, travel, period and curve;
 *   · a tilt a script made under the pointer → Tilt, degrees across and
 *     down, lift, depth, perspective, pace, carrying the parts on it and
 *     watching the pointer over the box it was listened on;
 *   · a marquee the scroll hurries → the Marquee's boost and cap;
 *   · a line the scroll grows → Grow with the scroll;
 *   · a canvas repainted with specks → a new inert layer at its box, where
 *     it was painted, carrying Dust with its colours, spacing, speed, size.
 *
 * On the board only what moves on its own plays (spin, float, dust), softly,
 * on the drawn layer inside the part: the part is still picked and moved.
 * A visitor who asked for less motion sees nothing move anywhere.
 *
 * The document is sink's own stand-in page, captured and converted
 * (tests/fixtures/motion-sampled.json, from sink's
 * check-motion-sample.mjs); with a sink checkout beside this one, its
 * trumpmorty.fun capture is held too.
 *
 *   npm run build && npx next start -p 3013
 *   node --experimental-strip-types tests/motion-sampled.mjs http://127.0.0.1:3013 [path to a sink checkout]
 */
import { readFileSync, writeFileSync, existsSync, mkdtempSync, mkdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";
import { takeDoc } from "../src/features/studio/docTake.ts";
import { usesOf, getWork, inputsOf, pageFeatures } from "../src/features/studio/library/works.ts";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SINK = process.argv[3] ?? process.env.SINK ?? join(here, "..", "..", "sink");
const DOC = readFileSync(join(here, "fixtures", "motion-sampled.json"));
const doc = JSON.parse(DOC.toString("utf8"));

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
const near = (a, b, tol) => Number.isFinite(Number(a)) && Math.abs(Number(a) - b) <= tol;
const take = (d) => takeDoc({ pages: [{ id: "page_home" }], nodes: [], groups: [], shapes: [], spaces: [], brief: {}, look: {}, motion: [], frameWidth: 1440 }, d, { format: () => ({}), look: () => ({}) }).nodes;
const inputsIn = (nodes) => (id, work) => { const u = usesOf(nodes.find((n) => n.id === id)?.work).find((x) => x.id === work && !x.off); return u ? inputsOf(getWork(work).manifest, u.inputs) : null; };

/* ------------------------------------------------------------ taken in (pure) */
const M = doc.behaviours?.motion ?? {};
const sel = (id) => doc.nodes.find((n) => n.id === id)?.from?.selector ?? "";
const DISC = M.spin?.find((s) => /div:nth-of-type\(1\)$/.test(sel(s.part)))?.part;
const MOON = M.float?.find((f) => f.via === "script")?.part;
const RING = M.float?.find((f) => f.via === "css")?.part;
const CARD = M.hover?.find((h) => h.kind === "tilt")?.part;
const BUTTON = M.hover?.find((h) => h.kind === "lift")?.part;
const TRACK = M.scrollSpeed?.[0]?.part;
const LINE = M.scrollGrow?.[0]?.part;
const CV = M.canvases?.[0];
check("the stand-in's document carries every kind this holds", !!(DISC && MOON && RING && CARD && BUTTON && TRACK && LINE && CV), J({ DISC, MOON, RING, CARD, BUTTON, TRACK, LINE, canvas: !!CV }));

const nodes = take(doc);
const inp = inputsIn(nodes);
const sp = inp(DISC, "spin");
check("the disc a script turned carries Spin: one turn in 12 s, anticlockwise", near(sp?.period, 12, 0.6) && sp?.direction === "ccw", J(sp));
const fm = inp(MOON, "float");
check("the moon a script bobbed carries Float: up and down, its travel and period", fm?.axis === "y" && near(fm?.travel, 20, 3) && near(fm?.period, 5, 0.75), J(fm));
check("the ring a stylesheet floats keeps its captured loop and is given no Float twice", !inp(RING, "float") && (nodes.find((n) => n.id === RING)?.motion?.animation ?? []).some((a) => a.name === "bob"), J(nodes.find((n) => n.id === RING)?.motion));
const tl = inp(CARD, "tilt");
const inCard = doc.nodes.filter((n) => n.id !== CARD && (n.from?.selector ?? "").startsWith(`${sel(CARD)} > `)).map((n) => n.id);
check("the card a script tilted carries Tilt: 14° across, 12° down, 6 px lift, 900 px perspective, 150 ms", near(tl?.across, 14, 1) && near(tl?.down, 12, 1) && near(tl?.lift, 6, 0.5) && tl?.perspective === "900" && tl?.pace === "150", J(tl));
check("…carrying the parts on it (its heading)", inCard.length > 0 && inCard.every((id) => (tl?.parts ?? "").split(",").includes(id)), J({ parts: tl?.parts, inCard }));
check("the button a :hover rule lifts is left to its captured CSS (no Lift on hover)", !inp(BUTTON, "hover-lift"), J(nodes.find((n) => n.id === BUTTON)?.work));
const mq = inp(TRACK, "marquee");
check("the marquee the scroll hurries carries its boost (0.25 a px) and cap (14)", near(mq?.boost, 0.25, 0.04) && near(mq?.cap, 14, 1.5) && near(mq?.speed, 36, 6), J(mq));
const gr = inp(LINE, "scroll-grow");
check("the line the scroll grows carries Grow with the scroll: by width, from its top a window down to 0.72 above", gr?.prop === "width" && near(gr?.start, 1, 0.06) && near(gr?.end, -0.725, 0.08) && gr?.from === "0" && gr?.to === "100", J(gr));
check("…and how much of it the capture drew (as seen with its section in view), so it is made whole before it is shown", near(gr?.kept, M.scrollGrow[0].kept, 0.1) && Number(gr?.kept) < 100, J({ kept: gr?.kept }));
const dustAt = nodes.findIndex((n) => usesOf(n.work).some((u) => u.id === "dust-canvas"));
const dust = nodes[dustAt];
const du = dust ? inp(dust.id, "dust-canvas") : null;
check("the repainted canvas became a layer of its own at its box, inert, carrying Dust", dust && dust.featureId === "box" && dust.inert === true && dust.x === CV.box[0] && dust.y === CV.box[1] && dust.w === CV.box[2] && dust.h === CV.box[3] && dust.pageId === "page_home", J(dust && { id: dust.id, box: [dust.x, dust.y, dust.w, dust.h], inert: dust.inert }));
check("…painted where the canvas was: just under the part above it", dust && nodes[dustAt + 1]?.id === CV.above, J({ next: nodes[dustAt + 1]?.id, above: CV.above }));
check("…with its colours, one speck every 20 px, rising at its own pace", du && ["#8fbf7a", "#89cebc", "#fff3a0", "#ef9043"].every((c) => du.colours.includes(c)) && near(du.spacing, 20, 4) && Number(du.speed) > 1 && du.direction === "up", J(du));
const bare = take({ ...doc, behaviours: { ...doc.behaviours, motion: undefined } });
check("control: without the motion section nothing new is attached and no layer is made", bare.length === doc.nodes.length && !bare.some((n) => usesOf(n.work).some((u) => ["spin", "float", "hover-lift", "scroll-grow", "dust-canvas"].includes(u.id))), J(bare.length));
const ship = pageFeatures(nodes).scripts;
check("publishing ships the four new scripts beside the runtime", ["spin.js", "float.js", "scroll-grow.js", "dust-canvas.js", "tilt.js", "marquee.js"].every((f) => ship.includes(f)) && !ship.includes("hover-lift.js"), J(ship));

/* trumpmorty.fun itself, when a sink checkout is beside this one. */
const TM = join(SINK, "sites", "trumpmorty-fun", "site", "document.json");
if (existsSync(TM)) {
  const tdoc = JSON.parse(readFileSync(TM, "utf8"));
  const tm = tdoc.behaviours?.motion;
  check("trumpmorty.fun: sink's capture carries motion", !!tm, J(Object.keys(tdoc.behaviours ?? {})));
  if (tm) {
    const tn = take(tdoc), ti = inputsIn(tn);
    const tv = tm.hover.find((h) => h.kind === "tilt" && h.depth > 0);
    const tvi = tv ? ti(tv.part, "tilt") : null;
    check("trumpmorty.fun: the TV tilts 22° across and 18° down, forward 20 px in a 1200 px perspective, carrying its screen, knobs and words, watching the pointer over its holder", near(tvi?.across, 22, 1) && near(tvi?.down, 18, 1) && near(tvi?.depth, 20, 1) && tvi?.perspective === "1200" && (tvi?.parts ?? "").split(",").length >= 5 && tvi?.area === tv.host, J(tvi));
    const cards = tm.hover.filter((h) => h.kind === "tilt" && !(h.depth > 0)).map((h) => ti(h.part, "tilt"));
    check("trumpmorty.fun: the lore picture and the four steps tilt ≈14° / 12° and rise 6 px", cards.length === 5 && cards.every((c) => near(c?.across, 14, 1) && near(c?.down, 12, 1) && near(c?.lift, 6, 0.5)), J(cards.map((c) => c && [c.across, c.down, c.lift])));
    const ribbons = tm.scrollSpeed.map((q) => ti(q.part, "marquee"));
    check("trumpmorty.fun: both ribbons hurry with the scroll (boost ≈0.25, cap ≈14), still 36 px a second at rest", ribbons.length === 2 && ribbons.every((r) => near(r?.boost, 0.25, 0.05) && near(r?.cap, 14, 1.5) && near(r?.speed, 36, 6)), J(ribbons));
    const line = tm.scrollGrow[0] ? ti(tm.scrollGrow[0].part, "scroll-grow") : null;
    check("trumpmorty.fun: the roadmap's line grows with the scroll", line?.prop === "width" && near(line?.start, 0.85, 0.05), J(line));
    const tdust = tn.find((n) => usesOf(n.work).some((u) => u.id === "dust-canvas"));
    const tdi = tdust ? ti(tdust.id, "dust-canvas") : null;
    /* Its specks are drawn faint (alpha .3–.9), so a shade may come back a unit or two off. */
    const rgb = (h) => [1, 3, 5].map((j) => parseInt(String(h).slice(j, j + 2), 16));
    const has = (c) => (tdi?.colours ?? "").split(",").map((x) => x.trim()).some((x) => rgb(x).every((v, j) => Math.abs(v - rgb(c)[j]) <= 3));
    check("trumpmorty.fun: the hero's dust is a layer over the ring, under the far desert, with the page's five colours", tdust && tn[tn.indexOf(tdust) + 1]?.id === tm.canvases[0].above && tn[tn.indexOf(tdust) - 1]?.id === tm.canvases[0].below && ["#8fbf7a", "#a6d86f", "#89cebc", "#fff3a0", "#ef9043"].every(has), J(tdi));
    const planet = tm.spin.find((s) => s.name === "spin");
    check("trumpmorty.fun: the planet's 140 s turn is its stylesheet's own and stays its captured loop", planet && planet.period === 140000 && planet.direction === "cw" && !ti(planet.part, "spin") && (tn.find((n) => n.id === planet.part)?.motion?.animation ?? []).some((a) => a.name === "spin"), J(planet));
  }
} else console.log(`  (no sink checkout at ${SINK}: trumpmorty.fun is not held here)`);

/* ------------------------------------------------------------ in the Builder */
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [{ path: "package.json", type: "blob", sha: "pkg", size: 10 }, { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length }];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const done = async () => {
  await browser.close().catch(() => {});
  const failed = results.filter((r) => !r).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
};
const ctx = await browser.newContext({ viewport: { width: 1640, height: 1000 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await ctx.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  return j({ message: "no" }, 404);
});
const state = (p = page) => p.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
try { await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" }); } catch { check(`the Builder answers at ${BASE}`, false, "start it: npm run build && npx next start -p 3013"); await done(); }
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s7", name: "Site 7", updatedAt: Date.now() }], activeId: "s7" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("STANDIN_GITHUB_TOKEN_placeholder");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
for (let i = 0; i < 60 && ((await state()).nodes?.length ?? 0) < doc.nodes.length; i++) await page.waitForTimeout(1000);
await page.waitForTimeout(2500);
let s = await state();
const DUST = (s.nodes ?? []).find((n) => usesOf(n.work).some((u) => u.id === "dust-canvas"))?.id;
check("brought in through the door: Spin on the disc, Float on the moon, Tilt on the card, a Dust layer", usesOf((s.nodes ?? []).find((n) => n.id === DISC)?.work).some((u) => u.id === "spin") && usesOf((s.nodes ?? []).find((n) => n.id === MOON)?.work).some((u) => u.id === "float") && usesOf((s.nodes ?? []).find((n) => n.id === CARD)?.work).some((u) => u.id === "tilt") && !!DUST, J({ n: s.nodes?.length, DUST }));

/* ------------------------------------------------------------ the board */
const drawn = (p, id) => p.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`); if (!el) return null; const cs = getComputedStyle(el); return { rotate: cs.rotate, translate: cs.translate, moves: el.getAttribute("data-board-moves"), box: getComputedStyle(el.parentElement).transform + "|" + el.parentElement.style.left + "," + el.parentElement.style.top }; }, id);
const canvasSum = (p, sel) => p.evaluate((sel) => { const c = document.querySelector(sel); if (!c || !c.width) return null; const x = document.createElement("canvas"); x.width = 80; x.height = 50; const g = x.getContext("2d"); g.drawImage(c, 0, 0, 80, 50); const d = g.getImageData(0, 0, 80, 50).data; let h = 0; for (let i = 0; i < d.length; i += 7) h = (h * 31 + d[i]) >>> 0; return h; }, sel);
const d1 = await drawn(page, DISC), m1 = await drawn(page, MOON);
const c1 = await canvasSum(page, `[data-node-id="${DUST}"] canvas[data-feature-layer]`);
await page.waitForTimeout(1200);
const d2 = await drawn(page, DISC), m2 = await drawn(page, MOON);
const c2 = await canvasSum(page, `[data-node-id="${DUST}"] canvas[data-feature-layer]`);
check("board: the disc turns, on its drawn layer, its box standing still", d1?.moves === "spin" && d1.rotate !== d2?.rotate && d1.box === d2?.box, J({ d1, d2 }));
check("board: the moon floats, softly (half its 20 px travel: never past 10 px)", m1?.moves === "float" && m1.translate !== m2?.translate && [m1, m2].every((m) => Math.abs(parseFloat(String(m.translate).split(" ")[1] ?? "0")) <= 10.2), J({ m1: m1?.translate, m2: m2?.translate }));
check("board: the dust layer draws and redraws its specks", c1 !== null && c1 !== c2, J({ c1, c2 }));
const still = await page.evaluate((ids) => ids.map((id) => { const el = document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`); return el ? [el, ...el.querySelectorAll("*")].map((x) => getComputedStyle(x).transform + getComputedStyle(x).translate + getComputedStyle(x).clipPath).join(";") : null; }), [CARD, TRACK, LINE]);
await page.mouse.move(600, 500, { steps: 4 }); await page.waitForTimeout(500); await page.mouse.move(900, 300, { steps: 4 }); await page.waitForTimeout(500);
const still2 = await page.evaluate((ids) => ids.map((id) => { const el = document.querySelector(`[data-node-id="${id}"] > [data-part-drawn]`); return el ? [el, ...el.querySelectorAll("*")].map((x) => getComputedStyle(x).transform + getComputedStyle(x).translate + getComputedStyle(x).clipPath).join(";") : null; }), [CARD, TRACK, LINE]);
/* The part as drawn, not the board's own chip and handles round it, which answer the pointer by design. */
check("board: what answers the pointer or the scroll (the tilt, the marquee, the line) does not play there", still.every(Boolean) && J(still) === J(still2) && !(await page.evaluate(() => document.querySelector('[data-board-moves="tilt"], [data-board-moves="marquee"], [data-board-moves="scroll-grow"]'))), J(still.map((a, i) => a === still2[i] ? "same" : `${String(a).slice(0, 160)} → ${String(still2[i]).slice(0, 160)}`)));
/* Still editable: the turning disc is picked and moved by its box. */
const box = await page.locator(`[data-node-id="${DISC}"]`).boundingBox();
const x0 = (s.nodes ?? []).find((n) => n.id === DISC)?.x;
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.mouse.move(box.x + box.width / 2 + 60, box.y + box.height / 2 + 10, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1200);
s = await state();
const x1 = (s.nodes ?? []).find((n) => n.id === DISC)?.x;
const picked = await page.evaluate((id) => !!document.querySelector(`[data-node-id="${id}"] [data-part-drawn][data-mode="live"]`), DISC);
check("board: the turning disc is still picked up and moved like any part", picked && Number.isFinite(x1) && x1 > x0 + 20, J({ x0, x1, picked }));
const d3 = await drawn(page, DISC); await page.waitForTimeout(700); const d4 = await drawn(page, DISC);
check("board: …and keeps turning where it was put", d3?.rotate !== d4?.rotate, J({ d3: d3?.rotate, d4: d4?.rotate }));
await page.keyboard.press("Control+z").catch(() => {});

/* Less motion asked for: the board holds still. */
const calmCtx = await browser.newContext({ viewport: { width: 1640, height: 1000 }, reducedMotion: "reduce" });
const calm = await calmCtx.newPage();
await calm.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await calm.evaluate((st) => localStorage.setItem("builder.studio", st), await page.evaluate(() => localStorage.getItem("builder.studio")));
await calm.evaluate((b) => localStorage.setItem("builder.builds", b), await page.evaluate(() => localStorage.getItem("builder.builds")));
await calm.reload({ waitUntil: "networkidle" });
await calm.waitForTimeout(2500);
const k1 = await drawn(calm, DISC); await calm.waitForTimeout(900); const k2 = await drawn(calm, DISC);
check("board, less motion asked for: nothing turns and no dust is drawn", k1 && k1.rotate === k2?.rotate && !(await calm.evaluate(() => document.querySelector("canvas[data-feature-layer]"))), J({ k1: k1?.rotate, k2: k2?.rotate }));
await calmCtx.close();

/* ------------------------------------------------------------ the Preview */
await page.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const live = (id, what) => page.evaluate(({ id, what }) => { const el = document.querySelector(`[data-live-node="${id}"]`); return el ? getComputedStyle(el)[what] : null; }, { id, what });
const pr1 = await live(DISC, "rotate"), pf1 = await live(MOON, "translate");
await page.waitForTimeout(900);
const pr2 = await live(DISC, "rotate"), pf2 = await live(MOON, "translate");
check("Preview: the disc turns and the moon floats", pr1 !== pr2 && pf1 !== pf2, J({ pr1, pr2, pf1, pf2 }));
check("Preview: the dust draws", (await canvasSum(page, `[data-live-node="${DUST}"] canvas[data-feature-layer]`)) !== null);
const cardBox = await page.locator(`[data-live-node="${CARD}"]`).boundingBox();
await page.mouse.move(cardBox.x + cardBox.width * 0.85, cardBox.y + cardBox.height * 0.8, { steps: 6 });
await page.waitForTimeout(500);
const tilted = await page.evaluate(({ card, inner }) => [card, ...inner].map((id) => document.querySelector(`[data-live-node="${id}"]`)?.style.transform ?? ""), { card: CARD, inner: inCard });
check("Preview: under the pointer the card tilts toward it, its heading with it", tilted.every((t) => /rotateY\(\d/.test(t) && /perspective\(900px\)/.test(t)) && new Set(tilted.map((t) => t.split(")").slice(0, 3).join(")"))).size === 1, J(tilted));
await page.mouse.move(5, 5, { steps: 6 });
await page.waitForTimeout(500);
check("Preview: …and settles back when the pointer leaves", !/rotate/.test(await page.evaluate((id) => document.querySelector(`[data-live-node="${id}"]`)?.style.transform ?? "", CARD)));
await page.mouse.move(700, 600);
const rate = () => page.evaluate((id) => { const t = document.querySelector(`[data-live-node="${id}"] [data-marquee-track]`); const a = t?.getAnimations()[0]; return a ? a.playbackRate : null; }, TRACK);
const grown = () => page.evaluate((id) => Number(document.querySelector(`[data-live-node="${id}"]`)?.getAttribute("data-grown") ?? NaN), LINE);
const rest1 = await rate(), g1 = await grown();
let fastest = 0;
for (let i = 0; i < 14; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(40); fastest = Math.max(fastest, (await rate()) ?? 0); }
await page.waitForTimeout(400);
const g2 = await grown();
check("Preview: the marquee runs at its own pace at rest and hurries while the page scrolls", rest1 !== null && near(rest1, 1, 0.05) && fastest > 2, J({ rest1, fastest }));
check("Preview: the roadmap line grows as the page scrolls past it", Number.isFinite(g1) && g2 > g1, J({ g1, g2 }));
/* Whole: its captured length over the share the capture drew, at the Preview's scale (read off the disc, which nothing resizes). */
const whole = await page.evaluate(({ id, disc }) => { const el = document.querySelector(`[data-live-node="${id}"]`), d = document.querySelector(`[data-live-node="${disc}"]`); return el && d ? [el.offsetWidth, d.offsetWidth] : null; }, { id: LINE, disc: DISC });
const want = whole && doc.nodes.find((n) => n.id === LINE).w * 100 / Number(gr.kept) * (whole[1] / doc.nodes.find((n) => n.id === DISC).w);
check("Preview: …drawn whole (its captured length over the share the capture drew), shown as far as the scroll has reached", whole && near(whole[0], want, 4), J({ whole, want }));
await page.waitForTimeout(2500);
check("Preview: …and the marquee settles back to its own pace", near(await rate(), 1, 0.08), J(await rate()));

/* ------------------------------------------------------------ the export, served */
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const files = await page.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
check("the export has the four new scripts", ["spin", "float", "scroll-grow", "dust-canvas"].every((f) => (files ?? []).some((x) => x.path === `assets/features/${f}.js`)), J((files ?? []).filter((x) => /features\//.test(x.path)).map((x) => x.path)));
const out = mkdtempSync(join(tmpdir(), "motion-sampled-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", webp: "image/webp", png: "image/png", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let p = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(p) && statSync(p).isDirectory()) p = join(p, "index.html");
  if (!existsSync(p)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[p.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(p));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const SITEURL = `http://127.0.0.1:${server.address().port}/`;
const open = async (reducedMotion) => {
  const c = await browser.newContext({ viewport: { width: 1200, height: 800 }, reducedMotion });
  const p = await c.newPage();
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  await p.goto(SITEURL, { waitUntil: "networkidle" });
  await p.waitForTimeout(800);
  return { c, p, errs };
};
const pub = await open("no-preference");
const at = (p, id, what) => p.evaluate(({ id, what }) => { const el = document.getElementById(id); return el ? getComputedStyle(el)[what] : null; }, { id, what });
const er1 = await at(pub.p, DISC, "rotate"), ef1 = await at(pub.p, MOON, "translate"), ec1 = await canvasSum(pub.p, `#${DUST} canvas[data-feature-layer]`);
await pub.p.waitForTimeout(900);
const er2 = await at(pub.p, DISC, "rotate"), ef2 = await at(pub.p, MOON, "translate"), ec2 = await canvasSum(pub.p, `#${DUST} canvas[data-feature-layer]`);
check("published: the disc turns, the moon floats, the dust drifts", er1 !== er2 && ef1 !== ef2 && ec1 !== null && ec1 !== ec2, J({ er1, er2, ef1, ef2, ec1, ec2 }));
const cb = await pub.p.locator(`#${CARD}`).boundingBox();
await pub.p.mouse.move(cb.x + cb.width * 0.2, cb.y + cb.height * 0.2, { steps: 6 });
await pub.p.waitForTimeout(400);
const pt = await pub.p.evaluate(({ card, inner }) => [card, ...inner].map((id) => document.getElementById(id)?.style.transform ?? ""), { card: CARD, inner: inCard });
check("published: the card and its heading tilt together toward the pointer", pt.every((t) => /rotateY\(-\d/.test(t)) && new Set(pt.map((t) => t.split(")").slice(0, 3).join(")"))).size === 1, J(pt));
await pub.p.mouse.move(cb.x - 40, cb.y - 60, { steps: 4 });
await pub.p.waitForTimeout(300);
const prate = () => pub.p.evaluate((id) => document.querySelector(`#${id} [data-marquee-track]`)?.getAnimations()[0]?.playbackRate ?? null, TRACK);
const pg = () => pub.p.evaluate((id) => Number(document.getElementById(id)?.getAttribute("data-grown") ?? NaN), LINE);
const prest = await prate(), pg1 = await pg();
let pfast = 0;
for (let i = 0; i < 14; i++) { await pub.p.mouse.wheel(0, 120); await pub.p.waitForTimeout(40); pfast = Math.max(pfast, (await prate()) ?? 0); }
await pub.p.waitForTimeout(400);
check("published: the marquee hurries while scrolling", near(prest, 1, 0.05) && pfast > 2, J({ prest, pfast }));
check("published: the line grows with the scroll", Number.isFinite(pg1) && (await pg()) > pg1, J({ pg1, pg2: await pg() }));
check("published: no script error", pub.errs.length === 0, J(pub.errs));
await pub.c.close();
const calmPub = await open("reduce");
const q1 = await at(calmPub.p, DISC, "rotate"), qf1 = await at(calmPub.p, MOON, "translate");
await calmPub.p.waitForTimeout(900);
const q2 = await at(calmPub.p, DISC, "rotate"), qf2 = await at(calmPub.p, MOON, "translate");
const calmLine = await calmPub.p.evaluate((id) => getComputedStyle(document.getElementById(id)).clipPath, LINE);
check("published, less motion asked for: nothing turns or floats, no dust, the line shown whole", q1 === q2 && qf1 === qf2 && !(await calmPub.p.evaluate(() => document.querySelector("canvas[data-feature-layer]"))) && calmLine === "none", J({ q1, q2, qf1, qf2, calmLine }));
await calmPub.c.close();
server.close();
check("no page error in the Builder", errors.length === 0, J(errors.slice(0, 3)));
await done();
