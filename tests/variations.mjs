#!/usr/bin/env node
/**
 * VARIATIONS OF A SITE (J, 2026-10-24): many better versions, each a copy,
 * six layers he can lock, Randomize re-rolling only the unlocked ones.
 *
 *   1. pure, on the capture's own document:
 *      - a variation with colours locked, randomized again, keeps every
 *        colour token exactly, and its other layers change;
 *      - a variation that leaves colours alone keeps the original's colours;
 *      - every unlocked layer of the re-roll is a new choice;
 *      - the same seeds make the same variation again;
 *      - the original's document is not changed by any of it;
 *      - Claude's answer is read strictly (a choice not allowed is dropped,
 *        a word only for a part that was sent);
 *   2. in the Builder, the site brought in: Randomize makes four variations,
 *      each a site of its own with `versionOf`; lock colours and Randomize
 *      again: every colour token the same, the others changed; Ask Claude
 *      (stubbed: no real call is made) adds four, with word suggestions that
 *      go in only when accepted; Discard takes one away;
 *   3. the original's board, opened again, does not move by a pixel (part by
 *      part, box and painted style; and pixels, against an untouched
 *      control), and its stored document is the same;
 *   4. a variation kept and published draws with no page errors.
 *
 *   npx next start -p 3111
 *   node tests/variations.mjs http://127.0.0.1:3111 capture/sites/thesolface3
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";
import { prepare, build } from "../src/features/studio/variations/make.ts";
import { rollSpec, specFromSeeds, differs, LAYERS } from "../src/features/studio/variations/model.ts";
import { tokenValues } from "../src/features/studio/variations/tokens.ts";
import { readAnswer } from "../src/features/studio/better/prompt.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3111").replace(/\/$/, "");
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/variations.mjs <builder url> <the capture folder>");
  process.exit(2);
}
const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const SHOTS = ".screenshots/variations";
mkdirSync(SHOTS, { recursive: true });
const T0 = Date.now();
const say = (w) => console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const NON_COLOUR = ["type", "face", "space", "radius", "duration", "easing"];

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */
const DOC = readFileSync(join(SINK, "site/document.json"));
{
  const doc = JSON.parse(DOC.toString("utf8"));
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const input = { ...doc, nodes: landed.nodes };
  const before = JSON.stringify(input);
  const p = prepare(input, palette, { name: TAG, at: 1 });
  const aims = ["cleaner", "modern"];
  const v1 = rollSpec({ seed: 11, aims, shape: p.shape });
  const v2 = rollSpec({ seed: 12345, aims, shape: p.shape, prev: v1, locks: ["colours"] });
  const d1 = build(p, v1.spec), d2 = build(p, v2.spec);
  const T = tokenValues(p.system), T1 = tokenValues(d1.system), T2 = tokenValues(d2.system);
  check("pure: the first variation changes the colours", !same(T.colour, T1.colour), `${T.colour.length} colour tokens`);
  check("pure: colours locked and randomized again: every colour token unchanged", same(T1.colour, T2.colour), `${T2.colour.length} colour tokens`);
  const changed = NON_COLOUR.filter((k) => T1[k].length && !same(T1[k], T2[k]));
  check("pure: and the other tokens changed", changed.includes("type") && changed.includes("space"), `changed: ${changed.join(", ")}`);
  const relaid = d2.doc.nodes.filter((n, i) => n.x !== d1.doc.nodes[i].x || n.y !== d1.doc.nodes[i].y || n.h !== d1.doc.nodes[i].h).length;
  check("pure: and the parts were laid out again", relaid > 0, `${relaid} parts moved between the two`);
  const fresh = differs(v1.spec, v2.spec);
  /* A page of three sections or fewer has one order only (the first screen and the foot stay). */
  const canChange = LAYERS.filter((l) => l !== "colours" && v1.spec[l] && !(l === "order" && p.shape.sections <= 3));
  check("pure: every unlocked layer is a new choice", canChange.every((l) => fresh.includes(l)) && !fresh.includes("colours"), `new: ${fresh.join(", ")} (${p.shape.sections} sections)`);
  const keptColours = rollSpec({ seed: 5, aims, shape: p.shape, skip: ["colours"] });
  check("pure: colours left alone keep the original's colours", same(tokenValues(build(p, keptColours.spec).system).colour, T.colour));
  const again = specFromSeeds(v2.seeds, aims, p.shape);
  const d2b = build(p, again, { id: d2.system.id });
  check("pure: the same seeds make the same variation again", same(again, v2.spec) && same(d2b.doc.nodes, d2.doc.nodes) && same(tokenValues(d2b.system), T2));
  check("pure: the original's document is not changed", JSON.stringify(input) === before);
  check("pure: each variation has a System of its own", d1.system.id !== d2.system.id && d1.system.id !== p.system.id && d1.doc.nodes.filter((n) => n.sys).every((n) => n.sys.s === d1.system.id));
  const read = readAnswer({ variants: [
    { note: "Calm", colours: { keep: false, hue: 200, harmony: "mono", chroma: 0.1 }, type: { keep: false, pairing: "no-such", ratio: 1.25, base: 16 }, space: { keep: true }, layout: { keep: true }, order: { keep: false, order: [0, 0, 1] }, motion: { keep: false, style: "snappy" }, words: [{ part: "p1", to: "Start here", why: "a clear button" }, { part: "not-sent", to: "x", why: "" }] },
  ] }, { words: [{ part: "p1", now: "Click" }], count: 4 }, 3);
  const r0 = read[0];
  check("pure: Claude's answer is read strictly", read.length === 1 && r0.spec.colours?.hue === 200 && r0.spec.type === null && r0.spec.order === null && r0.spec.motion?.style === "snappy" && r0.words.length === 1 && r0.words[0].now === "Click", JSON.stringify(r0.spec));
}

/* ------------------------------------------------------------------ */
/* 2. In the Builder                                                    */
/* ------------------------------------------------------------------ */
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
let claudeCalls = 0;
await page.route("https://api.github.com/**", (r) => {
  const u = new URL(r.request().url());
  const j = (b, code = 200) => r.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  if (!u.pathname.startsWith(REPO)) return j({ message: "no" }, 404);
  const rest = u.pathname.slice(REPO.length);
  if (!rest) return j({ default_branch: "main", homepage: "" });
  if (rest.startsWith("/git/trees/")) return j({ tree });
  if (rest === "/git/blobs/doc") return j({ encoding: "base64", content: DOC.toString("base64") });
  const pic = decodeURIComponent(rest).match(/^\/git\/blobs\/pic:(.+)$/);
  if (pic) return j({ encoding: "base64", content: readFileSync(join(SINK, "assets/pictures", pic[1])).toString("base64") });
  return j({ message: "no" }, 404);
});
/* The Claude call is stubbed: four variants, as the route would hand them back. No real call is ever made here. */
await page.route("**/api/studio/better", async (r) => {
  claudeCalls++;
  const ask = JSON.parse(r.request().postData() ?? "{}").ask ?? {};
  const word = (ask.words ?? [])[0];
  const variant = (i) => ({
    name: ["Calm editorial", "Bold product", "Quiet grid", "Warm friendly"][i],
    note: `Stub variant ${i + 1}`,
    spec: { colours: { hue: 40 + i * 70, harmony: "analogous", chroma: 0.12 }, type: { pairing: "sans-sans", ratio: 1.333, base: 17 }, space: { step: 8, density: 1.25, corner: "round", depth: "soft" }, layout: null, order: null, motion: { style: "calm" } },
    words: word && i === 0 ? [{ id: "w0_0", part: word.part, now: word.now, to: `${word.now} now`, why: "clearer" }] : [],
  });
  await r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, variants: [0, 1, 2, 3].map(variant), usage: { input: 0, output: 0 } }) });
});
await page.route("**/api/studio/screenshot", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "stub" }) }));

say("browser up");
const nodeCount = () => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await page.waitForTimeout(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await page.waitForTimeout(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await page.waitForTimeout(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await page.waitForTimeout(500);
await page.locator("[data-github-button]").first().click();
await page.waitForTimeout(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
await page.waitForTimeout(300);
if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
say("bringing in");
for (let i = 0; i < 180 && (await nodeCount()) < 50; i++) await page.waitForTimeout(1000);
await page.mouse.move(2, 2);
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
check("the site came in", (await nodeCount()) >= 50, `${await nodeCount()} parts`);

const PROPS = ["color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius", "box-shadow", "padding", "gap", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "transition", "opacity", "transform"];
const hold = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* finished */ } } });
const boardRead = async () => { await hold(page); return page.evaluate((PROPS) => {
  const out = {};
  for (const el of document.querySelectorAll("[data-node-id]")) {
    const r = el.getBoundingClientRect();
    const styles = [el, ...el.querySelectorAll("*")].slice(0, 60).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)).join("|"); });
    out[el.getAttribute("data-node-id")] = `${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}#${styles.join(";")}`;
  }
  return out;
}, PROPS); };
/** The board once it holds still: two reads 1.5 s apart that agree (pictures keep arriving on a big site). */
const stillBoard = async () => {
  let a = await boardRead();
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(1500); const b = await boardRead(); if (same(a, b)) return a; a = b; }
  return a;
};
const frameClip = () => page.evaluate(() => { const r = document.querySelector("[data-frame]")?.getBoundingClientRect(); if (!r) return null; const x = Math.max(0, r.left), y = Math.max(0, r.top); return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y }; });
const shot = async (target) => { await hold(target); const clip = target === page ? await frameClip() : null; return sharp(await target.screenshot({ fullPage: target !== page, animations: "disabled", ...(clip ? { clip } : {}) })).raw().toBuffer({ resolveWithObject: true }); };
function movingMask(shots, r = 6) {
  const { width: W, height: H, channels: ch } = shots[0].info;
  const raw = new Uint8Array(W * H);
  for (let s = 1; s < shots.length; s++) for (let p = 0, i = 0; p < W * H; p++, i += ch) { const a = shots[0].data, b = shots[s].data; if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) raw[p] = 1; }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw[y * W + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = 1; }
  return out;
}
function outside(a, b, mask) {
  if (a.data.length !== b.data.length) return { n: Infinity };
  const ch = a.info.channels;
  let n = 0;
  for (let p = 0, i = 0; i < a.data.length; p++, i += ch) if (!mask[p] && (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2])) n++;
  return { n };
}
/** The original's stored document, as far as what draws it goes. */
const storedOriginal = (id) => page.evaluate(async (id) => {
  const d = await window.__polioVariations?.doc(id);
  return d ? JSON.stringify({ nodes: d.nodes, look: d.look, format: d.format, pages: d.pages, systemId: d.systemId ?? null, system: d.system ?? null }) : null;
}, id);

/* The board as it opens: the Builder loaded again on the original, then read once it holds still. */
const openBuilder = async () => { await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" }); await page.mouse.move(2, 2); await page.waitForTimeout(Number(process.env.SETTLE ?? 8000)); };
await openBuilder();
const ORIGINAL = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state?.activeId ?? null);
say("reading the original's board");
const board0 = await stillBoard();
const px0a = await shot(page);
await page.waitForTimeout(600);
const px0b = await shot(page);
await openBuilder();
const boardC = await stillBoard();
const pxC = await shot(page);
const ctlParts = Object.keys(board0).filter((k) => board0[k] !== boardC[k]);
console.log(`       control (opened again, untouched): ${ctlParts.length} parts differ, ${outside(px0a, pxC, movingMask([px0a, px0b])).n} px`);
const mask = movingMask([px0a, px0b, pxC]);

/* ------------------------------------------------------------------ */
/* The Variations page                                                  */
/* ------------------------------------------------------------------ */
await page.goto(`${BASE}/builder/variations?of=${ORIGINAL}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const stored0 = await storedOriginal(ORIGINAL);
check("the Variations page opens on the original", (await page.locator("[data-variations]").count()) === 1 && !!stored0);
const vars = () => page.evaluate((of) => window.__polioVariations.list(of), ORIGINAL);
const projects = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state?.projects ?? []);
const sysOf = (id) => page.evaluate(async (id) => { const d = await window.__polioVariations.doc(id); return d?.system ?? null; }, id);
const tokensOf = (s) => {
  const T = s.tokens;
  return { colour: T.colour.map((t) => t.value), type: T.type.steps.map((t) => t.px), face: T.type.faces.map((t) => t.stack), space: T.space.map((t) => t.px), radius: T.radius.map((t) => t.px), duration: T.motion.durations.map((t) => t.css), easing: T.motion.easings.map((t) => t.css) };
};
const waitFor = async (fn, ms = 60000) => { for (let t = 0; t < ms; t += 500) { if (await fn()) return true; await page.waitForTimeout(500); } return false; };

await page.locator('[data-aim="modern"]').check();
await page.locator("[data-variations-roll]").click();
await waitFor(async () => (await vars()).length >= 4);
let list = await vars();
const ps = await projects();
check("Randomize makes four variations", list.length === 4, `${list.length}`);
check("each a site of its own, a Duplicate of the original", list.every((x) => ps.some((p) => p.id === x.id && p.versionOf?.project === ORIGINAL)) && !list.some((x) => x.id === ORIGINAL));
await waitFor(async () => (await page.locator('[data-variations-pane="b"] [data-node-id], [data-variations-pane="b"] *').count()) > 20, 20000);
check("the shown variation stands beside the original", (await page.locator("[data-variations-pane]").count()) === 2);

const shownId = await page.locator("[data-variation][aria-pressed=true]").getAttribute("data-variation");
const sBefore = tokensOf(await sysOf(shownId));
await page.locator('[data-variation-lock="colours"]').click();
await page.locator("[data-variation-again]").click();
await waitFor(async () => (await vars()).find((x) => x.id === shownId)?.made !== list.find((x) => x.id === shownId)?.made);
const sAfter = tokensOf(await sysOf(shownId));
check("colours locked, Randomize again: every colour token unchanged", same(sBefore.colour, sAfter.colour), `${sAfter.colour.length} colour tokens`);
const moved = NON_COLOUR.filter((k) => sBefore[k].length && !same(sBefore[k], sAfter[k]));
check("and the other tokens changed", moved.includes("type") && moved.includes("space"), `changed: ${moved.join(", ")}`);
const rec = (await vars()).find((x) => x.id === shownId);
check("its seeds are kept, so it can be made again", rec && LAYERS.filter((l) => l !== "colours").every((l) => typeof rec.v.seeds[l] === "number"));

await page.locator("[data-variations-claude]").click();
await waitFor(async () => (await vars()).length >= 8);
list = await vars();
check("Ask Claude (stubbed) adds four from one call", list.length === 8 && claudeCalls === 1, `${list.length} variations, ${claudeCalls} call`);
const withWord = list.find((x) => x.v.words?.length);
if (withWord) {
  await page.locator(`[data-variation="${withWord.id}"]`).click();
  await page.waitForTimeout(800);
  const w = withWord.v.words[0];
  const wordsNow = async () => page.evaluate(async ({ id, part }) => (await window.__polioVariations.doc(id))?.nodes.find((n) => n.id === part)?.content ?? null, { id: withWord.id, part: w.part });
  check("a word suggestion is not put in until it is accepted", (await wordsNow()) === w.now, JSON.stringify(await wordsNow()));
  await page.locator(`[data-word="${w.id}"]`).click();
  await waitFor(async () => (await wordsNow()) === w.to, 20000);
  check("accepted, it goes in", (await wordsNow()) === w.to);
} else check("Claude's word suggestion is offered", false, "no variant carried one");
const gone = list[list.length - 1].id;
await page.locator(`[data-variation="${gone}"]`).click();
await page.waitForTimeout(500);
await page.locator("[data-variation-discard]").click();
await waitFor(async () => !(await projects()).some((p) => p.id === gone));
check("Discard takes it away", !(await projects()).some((p) => p.id === gone) && !(await vars()).some((x) => x.id === gone));
const stored1 = await storedOriginal(ORIGINAL);
check("the original's stored document is the same", stored0 === stored1);

/* ------------------------------------------------------------------ */
/* 3. The original does not move                                        */
/* ------------------------------------------------------------------ */
await openBuilder();
check("the Builder is still on the original", (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state?.activeId)) === ORIGINAL);
const board1 = await stillBoard();
const px1 = await shot(page);
const partsMoved = Object.keys(board0).filter((k) => board0[k] !== board1[k] && board0[k] === boardC[k]);
check("the original's board: every part as it was", partsMoved.length === 0 && Object.keys(board1).length === Object.keys(board0).length, `${partsMoved.length} of ${Object.keys(board0).length} parts differ: ${partsMoved.slice(0, 4).join(", ")}`);
const px = outside(px0a, px1, mask);
const ctlPx = outside(px0a, pxC, movingMask([px0a, px0b])).n;
/* A board that is not still opened twice untouched (sunkcoin's sea and films) cannot be decided by pixels: the part-by-part read above decides it. */
if (ctlPx === 0) check("the original's board: not a pixel moved", px.n === 0, `${px.n} px differ (control 0)`);
else console.log(`  --   the original's board pixels: not decidable, the untouched board differs from itself by ${ctlPx} px (after: ${px.n}); decided part by part above`);

/* ------------------------------------------------------------------ */
/* 4. A variation, kept and published                                   */
/* ------------------------------------------------------------------ */
await page.goto(`${BASE}/builder/variations?of=${ORIGINAL}&v=${shownId}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await page.locator("[data-variation-keep]").click();
await page.waitForURL(/\/builder$/, { timeout: 30000 }).catch(() => {});
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
check("Keep opens the variation in the Builder", (await page.evaluate(() => JSON.parse(localStorage.getItem("builder.builds") ?? "{}").state?.activeId)) === shownId);
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, content: f.content, encoding: f.encoding })));
const byPath = new Map(files.map((f) => [f.path.replace(/^\/+/, ""), f]));
const out = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const pubErrors = [];
out.on("pageerror", (e) => pubErrors.push(e.message));
await out.route("http://site.test/**", (r) => {
  const path = decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/+/, "")) || "index.html";
  const f = byPath.get(path) ?? byPath.get(`${path}/index.html`);
  if (!f) return r.fulfill({ status: 404, body: "" });
  const type = path.endsWith(".css") ? "text/css" : path.endsWith(".js") ? "text/javascript" : path.endsWith(".svg") ? "image/svg+xml" : /\.(png|webp|jpe?g)$/.test(path) ? "image/" + path.split(".").pop().replace("jpg", "jpeg") : "text/html";
  return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
});
await out.goto("http://site.test/index.html", { waitUntil: "load" });
const H = await out.evaluate(() => document.documentElement.scrollHeight);
for (let y = 0; y < H; y += 700) { await out.evaluate((y) => window.scrollTo(0, y), y); await out.waitForTimeout(100); }
await out.waitForTimeout(1500);
await out.screenshot({ path: `${SHOTS}/${TAG}-published-variation.png`, fullPage: true });
const drawn = await out.evaluate(() => document.body.querySelectorAll("*").length);
check("the variation publishes with no page errors", files.length > 0 && pubErrors.length === 0 && drawn > 20, `${files.length} files, ${drawn} elements, ${pubErrors.length} errors ${pubErrors.slice(0, 2).join(" | ")}`);
await out.close();
check("no page errors in the Builder", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed (${TAG})`);
process.exit(passed === results.length ? 0 : 1);
