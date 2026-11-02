#!/usr/bin/env node
/**
 * TIDY A TAKEN SYSTEM: THE FOLD, THE PLAN, AND NOTHING MOVES UNTIL ASKED
 * (handovers/FABLE-AUDIT-NEXT.md "Tidy a taken System", card G, J 2026-10-25;
 * the rules are in src/features/studio/system/tidy.ts).
 *
 * A System taken from a captured site is exact (sol face: 35 text sizes, 39
 * space steps). Tidy folds them onto a scale, shown as a plan first.
 *
 *   1. pure, on the capture's own document, after a take: the plan has fewer
 *      text sizes, space steps and corners (never more); the smallest and
 *      largest of each kind are kept exactly; no size moves further than an
 *      eighth (12.5%, or a pixel for a corner); every text size sits on the
 *      ratio scale, every space step on the grid, and pills (999px+) never
 *      fold; applying the plan changes exactly
 *      the parts the plan lists, and every linked field then holds its
 *      token's value; a part pointing at nothing is the very same object
 *      after; a field set apart by hand stays and is counted under "stays";
 *      tidying a tidied System moves nothing; the components' slots all
 *      point at tokens the folded System has; the System survives being
 *      written and read back with its tidy mark; the undo step is named
 *      "tidy the System: …";
 *   2. in the Builder, on the site brought in and its System taken: opening
 *      the Tidy dialog moves nothing on the board (part by part, and pixel
 *      for pixel where the untouched board holds still); its counts are the
 *      plan's; "Tidy it" changes exactly the parts the plan listed, as one
 *      undo step named for it, and nothing points at a value it does not
 *      hold; one undo puts the board back as it was.
 *
 *   npx next start -p 3311
 *   node tests/system-tidy.mjs http://127.0.0.1:3311 <the capture folder>
 *
 * PURE=1 runs part 1 only (no server). Run on sol face, mochi and sunkcoin
 * (capture/sites/thesolface3, mochi3, sunk2) and the six repo fixtures; the
 * fixtures have several pages, and the board draws only the open one, so the
 * board checks read the parts it draws and the document checks read them all.
 * DIAG=1 prints page errors' stacks and what the followers changed.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { takeSystem, linksHold } from "../src/features/studio/system/take.ts";
import { tidyPlan, foldType, foldSpace, foldRadius, spaceGrid, EIGHTH, PILL, TIDY_KINDS } from "../src/features/studio/system/tidy.ts";
import { materialise } from "../src/features/studio/system/resolve.ts";
import { readSystem, tokenById } from "../src/features/studio/system/model.ts";
import { stepName } from "../src/features/studio/historyNames.ts";
import { landPalette } from "../src/features/studio/paletteFrom.ts";
import { paletteFromHue } from "../src/features/studio/look/index.ts";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3311").replace(/\/$/, "");
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/system-tidy.mjs <builder url> <the capture folder>");
  process.exit(2);
}
const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();

const T0 = Date.now();
let phase = "starting";
const say = (w) => { phase = w; console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`); };
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const finish = async (browser) => {
  await browser?.close();
  const passed = results.filter(Boolean).length;
  console.log(`\n${passed}/${results.length} passed`);
  process.exit(passed === results.length ? 0 : 1);
};
const J = (v) => JSON.stringify(v)?.slice(0, 200);
const away = (a, b) => Math.abs(Math.log(b / a));
const listOf = (s, kind) => (kind === "type" ? s.tokens.type.steps : kind === "space" ? s.tokens.space : s.tokens.radius);

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
{
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const t = takeSystem({ nodes: landed.nodes, palette, frameWidth: 1440, name: TAG });
  const s = t.system;
  const nodes = landed.nodes.map((n) => (t.links.has(n.id) ? { ...n, sys: t.links.get(n.id) } : n));
  const plan = tidyPlan(s, nodes);
  const after = plan.after;
  console.log(`       ${TAG}: ${plan.kinds.map((k) => `${k.word} ${k.before} → ${k.after}${k.ratio ? ` (scale ${k.ratio} from ${k.base}px)` : ""}`).join("; ")}; ${plan.fields} values on ${plan.parts.length} parts move`);

  /* Fewer, never more; the ends kept. */
  for (const k of plan.kinds) {
    const was = listOf(s, k.kind).map((x) => x.px), now = listOf(after, k.kind).map((x) => x.px);
    check(`pure: ${k.word}: no more steps than before (${k.before} → ${k.after})`, now.length <= was.length && k.after === now.length && k.before === was.length);
    /* Corners a pixel apart fold to the one most worn, so their ends may move by that pixel; text sizes and space steps keep their ends exactly. */
    const px1 = (a, b) => Math.abs(a - b) <= 1 + 1e-9;
    const kept = (end) => (k.kind === "radius" ? now.some((px) => px1(px, end) || away(px, end) <= EIGHTH + 1e-9) : now.includes(end));
    check(`pure: ${k.word}: the smallest and largest are kept${k.kind === "radius" ? " (within an eighth or a pixel)" : " exactly"}`, kept(Math.min(...was)) && kept(Math.max(...was)), `${Math.min(...was)}..${Math.max(...was)} in ${J(now)}`);
    const moves = k.steps.flatMap((st) => st.gathers);
    const far = moves.filter((g) => away(g.from, g.to) > EIGHTH + 1e-9 && !(k.kind === "radius" && px1(g.from, g.to)));
    check(`pure: ${k.word}: no size moves further than an eighth${k.kind === "radius" ? " (or a pixel)" : ""}`, far.length === 0, J(far.map((g) => `${g.from}→${g.to}`)));
    const ids = new Set(now.map((px) => px));
    check(`pure: ${k.word}: every token folds onto a step the folded System has`, moves.every((g) => ids.has(g.to)));
  }
  const type = plan.kinds.find((k) => k.kind === "type");
  if (type && type.ratio) {
    const { ratio, base } = type;
    const was = listOf(s, "type").map((x) => x.px);
    const ends = new Set([Math.min(...was), Math.max(...was)]);
    const onScale = (px) => ends.has(px) || [...Array(81).keys()].some((i) => Math.round(base * ratio ** (i - 40)) === px);
    check("pure: every text size sits on the ratio scale from the body (or is an end)", listOf(after, "type").every((x) => onScale(x.px)), J(listOf(after, "type").filter((x) => !onScale(x.px)).map((x) => x.px)));
    check("pure: the body (the size most fields wear) does not move", type.steps.some((st) => st.px === base && !st.gathers.some((g) => g.token === st.token)));
    check("pure: the folded scale is recorded on the System", after.tokens.type.scale?.ratio === ratio && after.tokens.type.scale?.base === base, J(after.tokens.type.scale));
  }
  const space = plan.kinds.find((k) => k.kind === "space");
  if (space) {
    const was = listOf(s, "space").map((x) => x.px);
    const grid = new Set([...spaceGrid(Math.max(...was) * 2), Math.min(...was), Math.max(...was)]);
    check("pure: every space step sits on the grid (or is an end)", listOf(after, "space").every((x) => grid.has(x.px)), J(listOf(after, "space").filter((x) => !grid.has(x.px)).map((x) => x.px)));
  }
  const radius = plan.kinds.find((k) => k.kind === "radius");
  if (radius) {
    const pills = listOf(s, "radius").filter((x) => x.px >= PILL).map((x) => x.px);
    check("pure: pills (999px and more) never fold", pills.every((px) => listOf(after, "radius").some((x) => x.px === px)) && !radius.steps.some((st) => st.gathers.some((g) => g.from >= PILL)), J(pills));
  }

  /* Applying the plan: exactly the listed parts, and every link then holds. */
  const repointed = nodes.map((n) => (plan.links.has(n.id) ? { ...n, sys: plan.links.get(n.id) } : n));
  const m = materialise(repointed, after);
  const listed = new Set(plan.parts);
  const extra = m.changed.filter((id) => !listed.has(id)), missing = plan.parts.filter((id) => !m.changed.includes(id));
  check("pure: applying the plan changes exactly the parts the plan lists", extra.length === 0 && missing.length === 0, `${m.changed.length} changed, ${plan.parts.length} listed, ${extra.length} extra, ${missing.length} missing`);
  check("pure: the plan moves something on this site", plan.fields > 0 && plan.parts.length > 0, `${plan.fields} values`);
  check("pure: every linked field then holds its token's value", linksHold(m.nodes, after).length === 0, J(linksHold(m.nodes, after).slice(0, 3)));
  const literal = nodes.filter((n) => !n.sys);
  check("pure: a part pointing at nothing is the very same part after", literal.length > 0 && literal.every((n) => m.nodes.includes(n)), `${literal.length} such parts`);
  const movedFields = plan.kinds.flatMap((k) => k.steps.flatMap((st) => st.gathers)).reduce((a, g) => a + g.fields, 0);
  check("pure: the plan's values add up across its steps", movedFields === plan.fields, `${movedFields} vs ${plan.fields}`);

  /* A field set apart by hand stays. Pick a part whose text size would move and give it a value of its own. */
  const sample = plan.kinds.find((k) => k.kind === "type")?.steps.flatMap((st) => st.gathers).find((g) => g.parts.length)?.parts[0];
  if (sample) {
    const apart = nodes.map((n) => (n.id === sample ? { ...n, font: { ...n.font, px: (n.font?.px ?? 16) + 0.37 } } : n));
    const p2 = tidyPlan(s, apart);
    const m2 = materialise(apart.map((n) => (p2.links.has(n.id) ? { ...n, sys: p2.links.get(n.id) } : n)), p2.after);
    check("pure: a field set apart by hand stays, and the plan counts it under \"stays\"", !p2.parts.includes(sample) && !m2.changed.includes(sample) && p2.stays === plan.stays + 1, `stays ${plan.stays} → ${p2.stays}`);
  } else check("pure: a part whose text size would move was found", false);

  /* Twice is once. */
  const again = tidyPlan(after, m.nodes);
  check("pure: tidying a tidied System moves nothing", again.nothing && again.fields === 0 && again.after === after, `${again.fields} values would move`);
  check("pure: every component slot points at a token the folded System has, or holds its own value", after.components.every((c) => [c.base, ...c.variants.map((v) => v.look)].every((look) => Object.values(look).every((r) => ("token" in r ? !!tokenById(after, r.token) : "value" in r)))));
  const back = readSystem(JSON.parse(JSON.stringify(after)));
  check("pure: the folded System survives being written and read back, tidy mark and all", !!back && JSON.stringify(back.tokens) === JSON.stringify(after.tokens) && back.tidied === after.tidied);
  const docOf = (system, ns) => ({ pages: [], nodes: ns, groups: [], shapes: [], spaces: [], format: {}, brief: {}, look: {}, motion: [], system });
  const name = stepName(docOf(s, nodes), docOf(after, m.nodes));
  check("pure: the undo step is named for the tidy", /^tidy the System: /.test(name) && /text size|space step|corner/.test(name), J(name));
  check("pure: a System without the tidy mark is not named a tidy", !/^tidy the System/.test(stepName(docOf(s, nodes), docOf({ ...after, tidied: undefined }, m.nodes))));

  /* The fold rules alone. */
  const ft = foldType([{ px: 11, weight: 70 }, { px: 12, weight: 20 }, { px: 13, weight: 20 }, { px: 16, weight: 24 }, { px: 22, weight: 28 }, { px: 44, weight: 8 }]);
  check("fold: text sizes fold onto a ratio scale from the body, ends kept", ft.base === 11 && ft.to.get(11) === 11 && ft.to.get(44) === 44 && [...ft.to.values()].every((v) => Number.isInteger(v)) && [...ft.to].every(([a, b]) => away(a, b) <= EIGHTH + 1e-9), J([...ft.to]));
  const fs = foldSpace([{ px: 9, weight: 7 }, { px: 10, weight: 9 }, { px: 11, weight: 4 }, { px: 24, weight: 53 }, { px: 25, weight: 7 }, { px: 1, weight: 72 }, { px: 505, weight: 2 }]);
  check("fold: 9 folds to 10 and 11 to 12 (nearest by proportion); 24 and 25 to 24; 1 and 505 stay", fs.to.get(9) === 10 && fs.to.get(10) === 10 && fs.to.get(11) === 12 && fs.to.get(24) === 24 && fs.to.get(25) === 24 && fs.to.get(1) === 1 && fs.to.get(505) === 505, J([...fs.to]));
  check("fold: the space grid grows with the size", J(spaceGrid(70)) === J([1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 56, 64, 80]), J(spaceGrid(70)));
  const fr = foldRadius([{ px: 3, weight: 12 }, { px: 4, weight: 21 }, { px: 5, weight: 3 }, { px: 7, weight: 4 }, { px: 999, weight: 9 }]);
  check("fold: corners 3, 4, 5 fold to 4 (the one most worn); 7 stays apart; the pill stays", fr.to.get(3) === 4 && fr.to.get(4) === 4 && fr.to.get(5) === 4 && fr.to.get(7) === 7 && fr.to.get(999) === 999, J([...fr.to]));
  /* Twice is once for every fold: folding the folded values (with their gathered weights) changes nothing. 20, 22, 24 is the case a nearest-pair chain gets wrong (22 and 24 pair off, then 22 folds into 20 next time). */
  const twice = (fold, sizes) => {
    const once = fold(sizes);
    const gathered = new Map();
    for (const z of sizes) { const px = once.to.get(z.px); gathered.set(px, (gathered.get(px) ?? 0) + z.weight); }
    const again = fold([...gathered].map(([px, weight]) => ({ px, weight })), once.ratio ? { ratio: once.ratio, base: once.base } : undefined);
    return { once, same: [...again.to].every(([a, b]) => a === b) };
  };
  const fr2 = twice(foldRadius, [{ px: 20, weight: 10 }, { px: 22, weight: 5 }, { px: 24, weight: 1 }]);
  check("fold: 22 folds into 20 and 24 stays (it cannot reach 20); folding the result again changes nothing", fr2.once.to.get(22) === 20 && fr2.once.to.get(24) === 24 && fr2.same, J([...fr2.once.to]));
  const corners = [{ px: 2, weight: 3 }, { px: 3, weight: 12 }, { px: 4, weight: 21 }, { px: 5, weight: 3 }, { px: 6, weight: 2 }, { px: 7, weight: 4 }, { px: 8, weight: 1 }, { px: 9, weight: 2 }, { px: 10, weight: 2 }, { px: 12, weight: 9 }, { px: 13, weight: 1 }, { px: 16, weight: 8 }, { px: 18, weight: 1 }, { px: 20, weight: 6 }, { px: 22, weight: 2 }, { px: 24, weight: 11 }, { px: 28, weight: 1 }, { px: 30, weight: 1 }, { px: 32, weight: 3 }, { px: 999, weight: 5 }];
  check("fold: a long run of corners folds once and then holds still, every corner within an eighth or a pixel of where it lands", twice(foldRadius, corners).same && [...twice(foldRadius, corners).once.to].every(([a, b]) => Math.abs(a - b) <= 1 || away(a, b) <= EIGHTH + 1e-9), J([...twice(foldRadius, corners).once.to]));
  check("fold: the space grid and the text scale hold still too", twice(foldSpace, [{ px: 9, weight: 7 }, { px: 11, weight: 4 }, { px: 13, weight: 2 }, { px: 23, weight: 1 }, { px: 25, weight: 7 }, { px: 1, weight: 72 }, { px: 70, weight: 2 }]).same && twice(foldType, [{ px: 11, weight: 70 }, { px: 12, weight: 20 }, { px: 13, weight: 20 }, { px: 16, weight: 24 }, { px: 22, weight: 28 }, { px: 44, weight: 8 }]).same);
}

if (process.env.PURE) await finish(null);

/* ------------------------------------------------------------------ */
/* 2. In the Builder                                                    */
/* ------------------------------------------------------------------ */
const { chromium } = await import("playwright-core");
const sharp = (await import("sharp")).default;
const SHOTS = ".screenshots/system-tidy";
mkdirSync(SHOTS, { recursive: true });
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
/* Page errors, with when they came (which phase of the run) so a failure says where to look; DIAG prints the stack. */
const errors = [];
page.on("pageerror", (e) => { errors.push(`[${((Date.now() - T0) / 1000).toFixed(0)}s, ${phase}] ${e.message}`); if (process.env.DIAG) console.log(`       page error: ${e.stack ?? e.message}`); });
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

const nodeCount = () => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
  localStorage.removeItem("builder.systems");
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
for (let i = 0; i < 120 && (await nodeCount()) < 50; i++) await page.waitForTimeout(1000);
await page.mouse.move(2, 2);
await page.waitForTimeout(Number(process.env.SETTLE ?? 8000));
check("the site came in", (await nodeCount()) >= 50, `${await nodeCount()} parts`);
check("the System hook is there", await page.evaluate(() => !!window.__polioSystem));

/* Reading the board: every part's box and painted style, as tests/system-panel.mjs reads it. */
const PROPS = ["color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius", "box-shadow", "padding", "gap", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "transition", "opacity", "transform"];
const hold = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { try { if (a instanceof CSSTransition) a.finish(); else { a.pause(); a.currentTime = 0; } } catch { /* a finished one */ } } });
const boardRead = async () => { await hold(page); return page.evaluate((PROPS) => {
  const out = {};
  for (const el of document.querySelectorAll("[data-studio-scroll] [data-node-id]")) {
    const r = el.getBoundingClientRect();
    const styles = [el, ...el.querySelectorAll("*")].slice(0, 60).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)).join("|"); });
    /* box # own style # what it draws inside (a child part's words are inside their box's element too). */
    out[el.getAttribute("data-node-id")] = `${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}#${styles[0]}#${styles.slice(1).join(";")}`;
  }
  return out;
}, PROPS); };
const frameClip = () => page.evaluate(() => { const r = document.querySelector("[data-frame]")?.getBoundingClientRect(); if (!r) return null; const x = Math.max(0, r.left), y = Math.max(0, r.top); return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y }; });
const shot = async () => { await hold(page); const clip = await frameClip(); return sharp(await page.screenshot({ animations: "disabled", ...(clip ? { clip } : {}) })).raw().toBuffer({ resolveWithObject: true }); };
function movingMask(shots, r = 6) {
  const { width: W, height: H, channels: ch } = shots[0].info;
  const raw = new Uint8Array(W * H);
  for (let s = 1; s < shots.length; s++) for (let p = 0, i = 0; p < W * H; p++, i += ch) {
    const a = shots[0].data, b = shots[s].data;
    if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) raw[p] = 1;
  }
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (raw[y * W + x]) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < W && Y < H) out[Y * W + X] = 1; }
  return out;
}
function outside(a, b, mask) {
  if (a.data.length !== b.data.length) return Infinity;
  const ch = a.info.channels;
  let n = 0;
  for (let p = 0, i = 0; i < a.data.length; p++, i += ch) if (!mask[p] && (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2])) n++;
  return n;
}
const differ = (a, b) => Object.keys(a).filter((id) => a[id] !== b[id]).concat(Object.keys(b).filter((id) => !(id in a)));
/** Where a part differs: its box, its own style, or only what it draws inside (another part's change showing through). */
const where = (a, b, id) => { const x = (a[id] ?? "").split("#"), y = (b[id] ?? "").split("#"); return x[0] !== y[0] ? "box" : x[1] !== y[1] ? "own style" : x[2] !== y[2] ? "inside only" : "same"; };
/** Parts whose own box or style differs (not only what another part draws inside them). */
const differOwn = (a, b) => differ(a, b).filter((id) => where(a, b, id) !== "inside only");
const storeOf = () => page.evaluate(() => Object.fromEntries(window.__studioHistory.doc().nodes.map((n) => { const { sys, ...rest } = n; return [n.id, JSON.stringify(rest)]; })));
const sys = (fn, arg) => page.evaluate(([f, a]) => { const fn = new Function("S", "a", `return (${f})(S, a);`); return fn(window.__polioSystem, a); }, [fn.toString(), arg]);
const pause = (ms = 600) => page.waitForTimeout(ms);

/* The System tab, and the System taken (the take itself is tests/system-take.mjs's to check). */
const side = page.locator("[data-side-panel]");
const tab = side.locator('[aria-label="Side panel"] [role=radio][aria-label="System"]');
if (!(await tab.count())) { check("the side panel has a System tab", false); await finish(browser); }
await tab.click();
await pause(800);
const took = await sys((S) => S.take());
check("the System was taken from the site", took?.ok === true, J(took));
await pause(1500);

/** The board once two reads 1.5s apart agree (a large site's pictures, its word fitter and its hugging rows settle a moment after a change). */
async function settled() {
  await page.mouse.move(2, 2);
  let board = await boardRead();
  let stillFor = 0;
  for (let i = 0; i < 80 && stillFor < 2; i++) {
    await pause(1500);
    const next = await boardRead();
    stillFor = differ(board, next).length === 0 ? stillFor + 1 : 0;
    board = next;
  }
  return { board, still: stillFor >= 2 };
}
say("waiting for the board to hold still");
const s0 = await settled();
const board0 = s0.board;
check("the board holds still before Tidy is pressed", s0.still, `${((Date.now() - T0) / 1000).toFixed(0)}s in`);
const px0 = [await shot()];
for (const ms of [500, 2000, 1500]) { await pause(ms); px0.push(await shot()); }
const mask = movingMask(px0);
const masked = mask.reduce((a, b) => a + b, 0);
/* The control: one more untouched shot. Where a board moves of itself beyond the mask (sunkcoin's sea and films), the dry run may differ by no more than the untouched board does. */
await pause(1200);
const control = outside(px0[0], await shot(), mask);

/* The plan the hook reads: what the dialog must show and what Tidy it must do. */
const plan = await sys((S) => S.tidyPlan());
check("the hook reads a plan", plan && !("ok" in plan && plan.ok === false) && Array.isArray(plan.parts), J(plan?.kinds?.map((k) => `${k.word} ${k.before}→${k.after}`)));
console.log(`       plan: ${plan.kinds.map((k) => `${k.word} ${k.before} → ${k.after}`).join("; ")}; ${plan.fields} values on ${plan.parts.length} parts`);

/* 2a. The dialog opens, and nothing moves. */
const openTidy = side.locator("[data-tidy-open]");
check("the System panel has a Tidy button", (await openTidy.count()) === 1 && (await openTidy.isEnabled()));
await openTidy.click();
const dialog = page.locator("[data-tidy-plan]");
await dialog.locator("[data-tidy-fields]").waitFor({ timeout: 20000 });
await pause(800);
const shownFields = Number(await dialog.locator("[data-tidy-fields]").getAttribute("data-tidy-fields"));
const shownParts = Number(await dialog.locator("[data-tidy-fields]").getAttribute("data-tidy-parts"));
check("the dialog shows the plan's counts", shownFields === plan.fields && shownParts === plan.parts.length, `dialog ${shownFields} values on ${shownParts} parts; plan ${plan.fields} on ${plan.parts.length}`);
for (const k of plan.kinds) {
  const row = dialog.locator(`[data-tidy-kind="${k.kind}"]`);
  check(`the dialog's ${k.word} row says ${k.before} → ${k.after}`, (await row.getAttribute("data-tidy-before")) === String(k.before) && (await row.getAttribute("data-tidy-after")) === String(k.after));
}
const stepRows = await dialog.locator("[data-tidy-step]").count();
check("the dialog lists the steps that gather something", stepRows > 0 && stepRows <= plan.kinds.reduce((a, k) => a + k.after, 0), `${stepRows} rows`);
const board1 = await boardRead();
const d1 = differ(board0, board1);
check("with the dialog open, no part on the board moved or restyled", d1.length === 0, `${d1.length} differ: ${d1.slice(0, 5).join(", ")}`);
const sysBefore = await sys((S) => S.system());
const depth0 = await page.evaluate(() => window.__studioUndoDepth());
const store0 = await storeOf();
/* Cancel: the dialog (which dims the Builder behind it) goes, and the board is what it was, to the pixel. */
await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
await page.mouse.move(2, 2);
await pause(800);
check("Cancel closes the dialog", (await page.locator("[data-tidy-plan]").count()) === 0);
const board1b = await boardRead();
check("after the dry run, no part on the board moved or restyled", differ(board0, board1b).length === 0, differ(board0, board1b).slice(0, 4).map((id) => `${id}: ${where(board0, board1b, id)}`).join(", "));
const px1 = await shot();
const out1 = outside(px0[0], px1, mask);
/* A board that moves of itself over more than a hundredth of the frame (sunkcoin's sea and films: 500,000 px) is not decidable to the pixel; there the part-by-part read above decides, and the pixels are reported. */
const decidable = masked < px0[0].info.width * px0[0].info.height / 100;
check(decidable ? "after the dry run, the board is pixel for pixel what it was (outside what moves of itself; the untouched board is the control)" : "after the dry run, the board is what it was (not decidable to the pixel: it moves of itself; the part-by-part read decides)",
  decidable ? out1 <= control : differ(board0, board1b).length === 0, `${out1} px differ; the untouched board differs from itself by ${control} px; ${masked} px move of themselves`);
check("the document's System did not change", (await sys((S) => S.system()))?.rev === sysBefore.rev && (await page.evaluate(() => window.__studioUndoDepth())) === depth0);
const store1 = await storeOf();
check("the document's parts did not change", Object.keys(store0).every((id) => store0[id] === store1[id]), J(Object.keys(store0).filter((id) => store0[id] !== store1[id]).slice(0, 5)));

/* 2b. Tidy it: exactly the listed parts, one named undo step. */
await openTidy.click();
await dialog.locator("[data-tidy-fields]").waitFor({ timeout: 20000 });
await pause(500);
const tApply = Date.now();
/* A large site's apply holds the page's thread while its parts are written and drawn again (sunkcoin, 2,900 parts: well over 30s), so the press waits as long as it takes and the time is reported. */
await page.getByRole("dialog").locator("[data-tidy-confirm]").click({ timeout: 300000 });
await page.mouse.move(2, 2);
console.log(`       Tidy it took ${((Date.now() - tApply) / 1000).toFixed(1)}s until the page answered again`);
await pause(1500);
check("the dialog closed", (await page.locator("[data-tidy-plan]").count()) === 0);
say("waiting for the board to settle after Tidy it");
const s2 = await settled();
const board2 = s2.board;
const listed = new Set(plan.parts);
const d2 = differ(board0, board2);
/*
 * THE BOARD DRAWS THE OPEN PAGE. A site with several pages (gotchi: 13, share:
 * 3, parasiteonsol: 12) has most of its parts on pages the board is not
 * showing, and those are not in the DOM at all, so they cannot show a change
 * there; the document check below covers every listed part. Here: the listed
 * parts the board draws (read before the press) show their change.
 */
const drawn = plan.parts.filter((id) => id in board0);
const elsewhere = plan.parts.length - drawn.length;
const missing = drawn.filter((id) => !d2.includes(id));
check("the listed parts the board draws show their change (but for a gap with nothing to space or a padding nothing draws)", drawn.length > 0 && missing.length <= Math.ceil(drawn.length / 20), `${d2.length} parts differ on the board, ${plan.parts.length} listed, ${drawn.length} of them drawn (${elsewhere} on other pages); ${missing.length} drawn but not visibly changed (${missing.slice(0, 4).join(", ")})`);
/*
 * THE DOCUMENT SAYS EXACTLY WHAT CHANGED. The listed parts change the fields
 * their tokens hold (font, pad, gap, radius). The Builder then does what it
 * does for any hand edit of a size: a row hugs its grown words and what is
 * below moves down (`bigger-row-grows`, `boxes-hug`). Those followers change
 * only their box (x, y, w, h), never a style, and the test counts them apart.
 */
const store2 = await storeOf();
const storeMoved = Object.keys(store0).filter((id) => store0[id] !== store2[id]);
const BOX = new Set(["x", "y", "w", "h"]);
const keysOf = (a, b, id) => { const x = JSON.parse(a[id] ?? "{}"), y = JSON.parse(b[id] ?? "{}"); return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])); };
const followers = storeMoved.filter((id) => !listed.has(id));
const styled = followers.filter((id) => keysOf(store0, store2, id).some((k) => !BOX.has(k)));
const unlisted = plan.parts.filter((id) => !storeMoved.includes(id));
check("in the document, every listed part changed", unlisted.length === 0, `${unlisted.length} listed but unchanged: ${unlisted.slice(0, 4).join(", ")}`);
check("…and every other part that changed only followed (its box: a row hugging grown words, what is below moving down), never its style", styled.length === 0, `${followers.length} followed; ${styled.length} changed a style field: ${styled.slice(0, 4).map((id) => `${id} ${keysOf(store0, store2, id).join("/")}`).join(", ")}`);
console.log(`       Tidy it: ${plan.parts.length} parts listed and changed; ${followers.length} parts followed (box only)`);
/** Which keys of a part differ between two store readings. */
const keysDiff = (a, b, id) => { const x = JSON.parse(a[id] ?? "{}"), y = JSON.parse(b[id] ?? "{}"); return [...new Set([...Object.keys(x), ...Object.keys(y)])].filter((k) => JSON.stringify(x[k]) !== JSON.stringify(y[k])).map((k) => `${k}: ${JSON.stringify(x[k])?.slice(0, 60)} → ${JSON.stringify(y[k])?.slice(0, 60)}`); };
if (process.env.DIAG) for (const id of followers.slice(0, 4)) console.log(`       ${id} (followed): ${keysDiff(store0, store2, id).join("; ")}`);
const sysAfter = await sys((S) => S.system());
check("the System has fewer sizes now", TIDY_KINDS.every((k) => listOf(sysAfter, k).length <= listOf(sysBefore, k).length) && TIDY_KINDS.some((k) => listOf(sysAfter, k).length < listOf(sysBefore, k).length), TIDY_KINDS.map((k) => `${k} ${listOf(sysBefore, k).length}→${listOf(sysAfter, k).length}`).join(", "));
const broken = await sys((S) => S.broken());
check("nothing points at a value it does not hold", broken.length === 0, J(broken.slice(0, 3)));
check("…in one undo step", (await page.evaluate(() => window.__studioUndoDepth())) === depth0 + 1, `${depth0} → ${await page.evaluate(() => window.__studioUndoDepth())}`);
const undoName = await page.evaluate(() => window.__studioHistory.undo());
check("the undo step is named for the tidy", /^tidy the System: /.test(undoName ?? ""), J(undoName));
const again = await sys((S) => S.tidyPlan());
check("a second tidy would move nothing", again.nothing === true && again.fields === 0, `${again.fields} values: ${J(again.kinds?.flatMap((k) => k.steps.flatMap((st) => st.gathers.filter((g) => g.fields).map((g) => `${k.word} ${g.from}→${g.to} ×${g.fields}`))))}`);
const px2 = await shot();
console.log(`       after Tidy it: ${outside(px0[0], px2, mask)} px differ from the untouched board (the moved parts)`);

/* 2c. One undo puts it back. */
await page.evaluate(() => window.__studioHistory.act("undo"));
say("waiting for the board to settle after undo");
const s3 = await settled();
const board3 = s3.board;
const d3 = differ(board0, board3);
const store3 = await storeOf();
const storeBack = Object.keys(store0).filter((id) => store0[id] !== store3[id]);
if (process.env.DIAG) for (const id of storeBack.slice(0, 4)) console.log(`       ${id} after undo: ${keysDiff(store0, store3, id).join("; ")}`);
/*
 * KNOWN, NOT THIS LANE'S (handovers/EDIT-ISSUES.md, 2026-11-01): after an
 * undo of a text-size change, the word fitter measures the words again and
 * writes a new w or h on a few prose parts (sol face: 4 of 671), so their
 * box is not the captured one. Every other field comes back. Counted apart.
 */
const refit = storeBack.filter((id) => keysOf(store0, store3, id).every((k) => k === "w" || k === "h"));
check("one undo puts every field of every part back, but for the word fitter's own w/h on prose parts", storeBack.length === refit.length, `${storeBack.length} differ in the document, ${refit.length} only in w/h: ${storeBack.filter((id) => !refit.includes(id)).slice(0, 4).join(", ")}`);
const d3own = d3.filter((id) => !refit.includes(id) && where(board0, board3, id) !== "inside only");
check("…and every part on the board is back, but for those (and what they draw inside another)", d3own.length === 0, `${d3.length} differ on the board (${refit.length} refit by the word fitter): ${d3own.slice(0, 4).map((id) => `${id}: ${where(board0, board3, id)}`).join(", ")}`);
console.log(`       undo: ${refit.length} parts kept a w/h the word fitter wrote (${refit.slice(0, 5).join(", ")})`);
const sysUndone = await sys((S) => S.system());
check("…and the System has its sizes back", TIDY_KINDS.every((k) => listOf(sysUndone, k).length === listOf(sysBefore, k).length));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await page.screenshot({ path: `${SHOTS}/${TAG}-after-undo.png` });
await finish(browser);
