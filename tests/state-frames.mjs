#!/usr/bin/env node
/**
 * A PART'S STATES, LOCKED TO THEIR FRAME, AND ITS STATES TIMELINE.
 *
 * J (2026-10-03): a part's states (PonsStars' TV message box: connecting,
 * then "Find a match", then the result) are tied to the frame around them:
 * they move and resize with it and cannot spill outside it. And a small
 * States timeline on the part's right-click menu shows the states in order,
 * each with a thumbnail and the data it holds; pressing one shows it on the
 * board. The fixture is the TV box's markup as PonsStars writes it
 * (tests/fixtures/state-frames), brought in through the GitHub control
 * against a stand-in GitHub:
 *
 *   1. pure: the frame and its faces are read off the element paths, in the
 *      page's order; a moved state stops at its frame's edge; a frame takes
 *      its faces; a spill is found;
 *   2. brought in, the box is a frame of three faces (loading, idle,
 *      result), each face set where the first starts, none spilling;
 *   3. the right-click menu offers the States timeline on the box and on a
 *      face's part; it lists the three in order with a thumbnail each and
 *      their words, values and settings;
 *   4. pressing "idle" shows that face on the board and hides the others;
 *      "As the page opens" puts it back; the step bar on the board clicks
 *      it through, next by next, and Finish puts it back;
 *   5. dragged, the box takes every face, hidden ones too; resized, the
 *      faces keep their place and size on it;
 *   6. a face's part dragged far out stops at the box's edge.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/state-frames.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/stateFrames.ts, src/features/studio/StatesTimeline.tsx, src/features/studio/boardStates.ts, src/features/studio/pageParts.ts, src/features/studio/Canvas.tsx, src/features/studio/RadialMenu.tsx
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { clampMove, frameRiders, keepInFrame, spills, stateFrames, stepData } from "../src/features/studio/stateFrames.ts";
import { boardShows } from "../src/features/studio/boardStates.ts";

const URL_BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */

const B = "body > main > div > div";
const part = (id, sel, box, extra = {}) => ({ id, pageId: "p", from: { selector: sel }, x: box[0], y: box[1], w: box[2], h: box[3], ...extra });
const hidden = (g) => ({ state: { group: `hidden:${g}`, option: 1 } });
const toy = [
  part("screen", "body > main > div", [0, 0, 600, 400], { hooks: { "data-hook": "tv-screen" } }),
  part("box", B, [100, 100, 400, 160], { hooks: { "data-hook": "chart-tv-box", "data-state": "offline" } }),
  part("load", `${B} > div:nth-of-type(1)`, [110, 110, 380, 120], { hooks: { "data-hook": "chart-tv-loading", "data-step": "contacting" } }),
  part("load-t", `${B} > div:nth-of-type(1) > p`, [110, 110, 380, 30], { hooks: { "data-hook": "chart-tv-loading-title" }, content: "Tuning in" }),
  part("idle", `${B} > div:nth-of-type(2)`, [110, 110, 380, 80], { hooks: { "data-hook": "chart-tv-idle" }, ...hidden("chart-tv-idle") }),
  part("idle-t", `${B} > div:nth-of-type(2) > p`, [110, 110, 380, 30], { hooks: { "data-hook": "chart-tv-idle-title" }, content: [{ text: "Find a match" }], ...hidden("chart-tv-idle") }),
  part("res", `${B} > div:nth-of-type(3)`, [110, 110, 380, 60], { hooks: { "data-hook": "chart-tv-result" }, ...hidden("chart-tv-result") }),
];
const r = stateFrames(toy);
const fr = r.byFrame.get("box");
check("the box is a frame; its faces in the page's order, named plainly", !!fr && fr.steps.map((s) => `${s.key}:${s.label}`).join() === "open:loading,hidden:chart-tv-idle:idle,hidden:chart-tv-result:result", JSON.stringify(fr?.steps));
check("a state's part knows its frame; the open face's parts are not states", r.frameOf.get("idle-t") === "box" && !r.frameOf.has("load-t") && r.inFrame.get("load-t") === "box");
check("a frame takes every face with it, the hidden ones too", frameRiders(toy, ["box"]).sort().join() === "idle,idle-t,load,load-t,res");
const o = Object.fromEntries(toy.map((n) => [n.id, { x: n.x, y: n.y, w: n.w, h: n.h }]));
const c = clampMove(toy, ["idle", "idle-t"], o, 500, -300);
check("a face moved by hand stops at its frame's edge", c.dx === 10 && c.dy === -10, JSON.stringify(c));
check("moved with its frame it is not held back", JSON.stringify(clampMove(toy, ["box", "idle"], o, 500, -300)) === JSON.stringify({ dx: 500, dy: -300 }));
check("a box is kept inside a frame, no bigger than it", JSON.stringify(keepInFrame({ x: 450, y: 0, w: 900, h: 20 }, { x: 100, y: 100, w: 400, h: 160 })) === JSON.stringify({ x: 100, y: 100, w: 400, h: 20 }));
check("a spill is found", spills(toy).length === 0 && spills(toy.map((n) => (n.id === "res" ? { ...n, y: 300 } : n))).map((s) => s.part).join() === "res");
const d = stepData(toy, fr.steps[1]);
check("a face's data: its words and its settings", d.words.join() === "Find a match" && /hidden until/.test(d.settings[0]), JSON.stringify(d));
const shows = boardShows(["step:box=hidden:chart-tv-idle"], [], () => null, r);
check("a picked face is drawn in its frame and the others are not", shows(toy[4]) && shows(toy[5]) && !shows(toy[2]) && !shows(toy[3]) && !shows(toy[6]) && shows(toy[0]));
const panel = [
  part("col", "body > main > div", [0, 0, 600, 300], { hooks: { "data-hook": "column" } }),
  part("a", "body > main > div > p", [0, 0, 600, 40]),
  part("big", "body > main > div > section", [0, 280, 600, 400], { hooks: { "data-hook": "match-panel" }, ...hidden("match-panel") }),
];
check("a panel shown below the rest, growing its column, is not a face of it", stateFrames(panel).frames.length === 0);

/* ------------------------------------------------------------------ */
/* 2. Brought in                                                        */
/* ------------------------------------------------------------------ */

const ROOT = "tests/fixtures/state-frames";
const FILES = {};
const walk = (dir, rel = "") => { for (const n of readdirSync(dir)) { const p = join(dir, n); const q = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) walk(p, q); else FILES[q] = readFileSync(p); } };
walk(ROOT);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (rt) => {
  const u = new URL(rt.request().url());
  const j = (b, code = 200) => rt.fulfill({ status: code, contentType: "application/json", body: JSON.stringify(b) });
  const mm = u.pathname.match(/^\/repos\/him\/tv(\/.*)?$/);
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
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s1", name: "TV", updatedAt: Date.now() }], activeId: "s1" }));
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
await ui.locator("[data-repo-bring]").fill("him/tv");
await ui.locator("[data-repo-pull]").click();
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 120 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(1500);
st = await board();
const hook = (h) => st.nodes.find((n) => n.hooks?.["data-hook"] === h);
const read = stateFrames(st.nodes);
const box = hook("chart-tv-box");
const tvf = box ? read.byFrame.get(box.id) : null;
check("brought in: the box is a frame of three faces, in order", tvf?.steps.map((s) => s.label).join() === "loading,idle,result", JSON.stringify(tvf?.steps.map((s) => [s.label, s.parts.length])));
check("each face starts where the first does, inside the box", hook("chart-tv-idle")?.y === hook("chart-tv-loading")?.y && hook("chart-tv-result")?.y === hook("chart-tv-loading")?.y && spills(st.nodes).length === 0, JSON.stringify(["chart-tv-box", "chart-tv-loading", "chart-tv-idle", "chart-tv-result", "chart-tv-result-scores"].map((h) => [h, hook(h)?.y, hook(h)?.h])));
check("the faces stay hidden as the page opens", hook("chart-tv-idle")?.state?.group === "hidden:chart-tv-idle" && hook("chart-tv-loading")?.state == null);

/* ------------------------------------------------------------------ */
/* 3. The States timeline, from the right-click menu                    */
/* ------------------------------------------------------------------ */

const el = (id) => ui.locator(`[data-node-id="${id}"]`).first();
const openMenu = async (id) => {
  const b = await el(id).boundingBox();
  await ui.mouse.click(b.x + 6, b.y + 6, { button: "right" });
  await ui.waitForTimeout(700);
  return ui.locator('[data-tray-item="states"]').count();
};
check("the box's right-click menu offers the States timeline", (await openMenu(box.id)) === 1);
await ui.locator('[data-tray-item="states"]').evaluate((b) => b.click());
await ui.waitForTimeout(600);
const tl = ui.locator("[data-states-timeline]");
const steps = await tl.locator(`[data-state-row="${box.id}"] [data-state-step]`).evaluateAll((els) => els.map((e) => ({ key: e.getAttribute("data-state-step"), label: e.getAttribute("aria-label"), thumb: !!e.querySelector("[data-state-thumb]"), data: e.getAttribute("data-state-data") ?? "" })));
check("the box's row lists the three in order", steps.map((s) => s.label).join(" | ") === "State 1: loading | State 2: idle | State 3: result", steps.map((s) => s.label).join(" | "));
/* J (2026-10-05): the thumbnails were shrunk past reading; the board is the picture now, and a card says its name. */
check("each a plain card, its name and number, no shrunk picture", steps.length === 3 && steps.every((s) => !s.thumb));
check("and the data each holds on hover: words, values, settings", /Tuning in/.test(steps[0]?.data) && /chart-tv-loading-bar: 0 of 100/.test(steps[0]?.data) && /step=contacting/.test(steps[0]?.data) && /Find a match/.test(steps[1]?.data) && /You won/.test(steps[2]?.data), steps.map((s) => s.data).join(" / "));

/* ------------------------------------------------------------------ */
/* 4. A step pressed shows it on the board                             */
/* ------------------------------------------------------------------ */

const drawn = async (h) => ((await ui.locator(`[data-node-id="${hook(h).id}"]`).first().isVisible()) ? 1 : 0);
check("before: the loading face is drawn, idle is not", (await drawn("chart-tv-loading-title")) === 1 && (await drawn("chart-tv-idle-title")) === 0);
await tl.locator(`[data-state-row="${box.id}"] [data-state-step="hidden:chart-tv-idle"]`).click();
await ui.waitForTimeout(600);
check("pressing idle draws idle in the box and hides loading and result", (await drawn("chart-tv-idle-title")) === 1 && (await drawn("chart-tv-loading-title")) === 0 && (await drawn("chart-tv-result-headline")) === 0 && (await tl.locator(`[data-state-row="${box.id}"] [data-state-step="hidden:chart-tv-idle"]`).getAttribute("aria-pressed")) === "true");
const ib = await el(hook("chart-tv-idle-title").id).boundingBox(), bb = await el(box.id).boundingBox();
check("drawn inside the box on the board", ib.x >= bb.x - 1 && ib.y >= bb.y - 1 && ib.x + ib.width <= bb.x + bb.width + 1 && ib.y + ib.height <= bb.y + bb.height + 1);
const onState = (await board()).statesOn ?? [];
check("a board-only switch: the page's parts keep their state", onState.some((k) => k.startsWith("step:")) && (await board()).nodes.find((n) => n.id === hook("chart-tv-idle").id).state?.group === "hidden:chart-tv-idle", JSON.stringify(onState));
await tl.locator("[data-state-step-off]").click();
await ui.waitForTimeout(500);
check("'As the page opens' puts it back", (await drawn("chart-tv-loading-title")) === 1 && (await drawn("chart-tv-idle-title")) === 0);
/* J (2026-10-05): "on the board I can click through 1 to 5 / finish": the step bar, on the board, for the part picked. */
const bar = ui.locator(`[data-step-bar="${box.id}"]`);
check("the box picked, its step bar is on the board: a key for each of its three steps", (await bar.count()) === 1 && (await bar.locator("[data-step-key]").count()) === 3, await bar.getAttribute("aria-label").catch(() => "no bar"));
await bar.locator("[data-step-next]").click();
await ui.waitForTimeout(500);
check("next: idle in the box, loading gone", (await drawn("chart-tv-idle-title")) === 1 && (await drawn("chart-tv-loading-title")) === 0 && (await bar.getAttribute("aria-label")) === "States of chart-tv-box: 2 of 3");
await bar.locator("[data-step-next]").click();
await ui.waitForTimeout(500);
check("next again: the result, and Finish in place of next at the end", (await drawn("chart-tv-result-headline")) === 1 && (await drawn("chart-tv-idle-title")) === 0 && (await bar.locator("[data-step-finish]").count()) === 1);
await bar.locator("[data-step-finish]").click();
await ui.waitForTimeout(500);
check("Finish puts it back as the page opens", (await drawn("chart-tv-loading-title")) === 1 && (await drawn("chart-tv-result-headline")) === 0 && !((await board()).statesOn ?? []).some((k) => k.startsWith("step:")));
await ui.keyboard.press("Escape");
await ui.waitForTimeout(300);
check("Escape closes it", (await tl.count()) === 0);
check("a face's own part offers the timeline too", (await openMenu(hook("chart-tv-loading-title").id)) === 1);
await ui.keyboard.press("Escape");
await ui.waitForTimeout(400);

/* ------------------------------------------------------------------ */
/* 5. The frame moves and resizes its states                            */
/* ------------------------------------------------------------------ */

const zoomOf = async () => { const a = await el(box.id).boundingBox(); return a.width / box.w; };
const z = await zoomOf();
const ids = tvf.steps.flatMap((s) => s.parts);
const before = Object.fromEntries((await board()).nodes.filter((n) => ids.includes(n.id) || n.id === box.id).map((n) => [n.id, n]));
const b0 = await el(box.id).boundingBox();
await ui.mouse.move(b0.x + b0.width - 8, b0.y + 4);
await ui.mouse.down();
await ui.mouse.move(b0.x + b0.width - 8 + 30 * z, b0.y + 4 + 20 * z, { steps: 8 });
await ui.mouse.up();
await ui.waitForTimeout(600);
st = await board();
const now = (id) => st.nodes.find((n) => n.id === id);
const dx = now(box.id).x - before[box.id].x, dy = now(box.id).y - before[box.id].y;
const allMoved = ids.every((id) => now(id).x - before[id].x === dx && now(id).y - before[id].y === dy);
check("dragged, the box takes every face, hidden ones too", (dx !== 0 || dy !== 0) && allMoved, `moved ${dx},${dy}; ${ids.filter((id) => !(now(id).x - before[id].x === dx && now(id).y - before[id].y === dy)).length} left behind`);
await ui.mouse.click(10, 10);
await el(box.id).click({ position: { x: 6, y: 6 } });
await ui.waitForTimeout(400);
const handle = ui.locator(`[data-node-id="${box.id}"] [data-resize="se"]`).first();
let resized = false;
if (await handle.count()) {
  const hb = await handle.boundingBox();
  await ui.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await ui.mouse.down();
  await ui.mouse.move(hb.x + hb.width / 2 + 80 * z, hb.y + hb.height / 2 + 40 * z, { steps: 8 });
  await ui.mouse.up();
  await ui.waitForTimeout(600);
  const was = st;
  st = await board();
  const f0 = was.nodes.find((n) => n.id === box.id), f1 = now(box.id);
  const idle0 = was.nodes.find((n) => n.id === hook("chart-tv-idle").id), idle1 = now(hook("chart-tv-idle").id);
  const kx = f1.w / f0.w;
  resized = f1.w > f0.w && Math.abs(idle1.w - Math.round(idle0.w * kx)) <= 1 && Math.abs(idle1.x - Math.round(f1.x + (idle0.x - f0.x) * kx)) <= 1;
  check("resized, the faces keep their place and size on it", resized, JSON.stringify({ f0: [f0.x, f0.w], f1: [f1.x, f1.w], idle0: [idle0.x, idle0.w], idle1: [idle1.x, idle1.w] }));
} else check("resized, the faces keep their place and size on it", false, "no resize handle on the box");

/* ------------------------------------------------------------------ */
/* 6. A state cannot spill out                                          */
/* ------------------------------------------------------------------ */

/* The idle face shown, its title dragged far out of the box. */
await openMenu(box.id);
await ui.locator('[data-tray-item="states"]').evaluate((b) => b.click());
await ui.waitForTimeout(500);
await tl.locator(`[data-state-row="${box.id}"] [data-state-step="hidden:chart-tv-idle"]`).click();
await ui.waitForTimeout(400);
await ui.keyboard.press("Escape");
await ui.waitForTimeout(300);
const lt = hook("chart-tv-idle-title");
const lb = await el(lt.id).boundingBox();
await ui.mouse.move(lb.x + lb.width / 2, lb.y + lb.height / 2);
await ui.mouse.down();
await ui.mouse.move(lb.x + lb.width / 2 + 900 * z, lb.y + lb.height / 2 + 600 * z, { steps: 10 });
await ui.mouse.up();
await ui.waitForTimeout(600);
st = await board();
const f = now(box.id);
const inFrame = (n) => n.x >= f.x && n.y >= f.y && n.x + n.w <= f.x + f.w && n.y + n.h <= f.y + f.h;
const moved = now(lt.id);
check("a face's part dragged far out stops at the box's edge", inFrame(moved) && spills(st.nodes).length === 0, JSON.stringify({ part: [moved.x, moved.y, moved.w, moved.h], frame: [f.x, f.y, f.w, f.h] }));
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(passed === results.length ? 0 : 1);
