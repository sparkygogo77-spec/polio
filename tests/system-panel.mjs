#!/usr/bin/env node
/**
 * THE SYSTEM TAB, DRIVEN AS J WOULD (create-system step 2,
 * handovers/CREATE-SYSTEM-PROPOSAL.md "(c) The System").
 *
 * On a captured site brought in, every step below is a press in the panel,
 * never a call to the API behind it:
 *
 *   1. the side panel has a System tab next to Look; opening it moves nothing
 *      on the board and says the site has no System yet;
 *   2. "Take from this site" opens a dialog with the dry take's counts
 *      (found, will point at tokens, one-offs) and changes nothing; Cancel
 *      leaves the site without a System; "Take it" takes it, and the board is
 *      the same part by part (box and painted style) and, where the
 *      untouched board holds still, pixel for pixel;
 *   3. the token rows: one per token, grouped by kind; close shades folded
 *      under their lead and one press away; "used by" lights exactly the
 *      parts pointing at the token, and a second press puts the light out;
 *   4. a token's value changed in its row repaints the parts pointing at it,
 *      in one undo step; renamed; a token added, then taken out;
 *   5. the picked part's "Change just this one" lets one field go of its
 *      token, nothing moving;
 *   6. a component opened: variants and states as keys, a hover state set
 *      and edited, a variant added, "Show all" lights its instances,
 *      "Detach the picked one" takes an instance out of the System;
 *   7. the library: "Own copy" makes the site's own System; the picker
 *      points it back at the first; "New" gives it an empty one. The board
 *      never moves through any of it.
 *
 *   npx next start -p 3072
 *   node tests/system-panel.mjs http://127.0.0.1:3072 <the capture folder>
 *
 * Run on sol face, mochi and sunkcoin (capture/sites/thesolface3, mochi3,
 * sunk2), the proposal's check that the board does not move.
 */
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import sharp from "sharp";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3072").replace(/\/$/, "");
const SINK = process.argv[3];
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/system-panel.mjs <builder url> <the capture folder>");
  process.exit(2);
}
const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const SHOTS = ".screenshots/system-panel";
mkdirSync(SHOTS, { recursive: true });

const T0 = Date.now();
const say = (w) => console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`);
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

/* ------------------------------------------------------------------ */
/* Bringing the capture in (as tests/system-take.mjs does)              */
/* ------------------------------------------------------------------ */
const DOC = readFileSync(join(SINK, "site/document.json"));
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

/* ------------------------------------------------------------------ */
/* Reading the board                                                    */
/* ------------------------------------------------------------------ */
const PROPS = ["color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius", "box-shadow", "padding", "gap", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "transition", "opacity", "transform"];
const hold = (p) => p.evaluate(() => { for (const a of document.getAnimations()) { try { a.pause(); a.currentTime = 0; } catch { /* a finished one */ } } });
/** Every part on the board: its box, and the painted style of it and of what it draws. */
const boardRead = async () => { await hold(page); return page.evaluate((PROPS) => {
  const out = {};
  for (const el of document.querySelectorAll("[data-studio-scroll] [data-node-id]")) {
    const r = el.getBoundingClientRect();
    const styles = [el, ...el.querySelectorAll("*")].slice(0, 60).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)).join("|"); });
    out[el.getAttribute("data-node-id")] = `${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}#${styles.join(";")}`;
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
const sys = (fn, arg) => page.evaluate(([f, a]) => { const fn = new Function("S", "a", `return (${f})(S, a);`); return fn(window.__polioSystem, a); }, [fn.toString(), arg]);
const docSys = () => page.evaluate(() => window.__polioSystem.doc());
const pause = (ms = 600) => page.waitForTimeout(ms);

/* ------------------------------------------------------------------ */
/* 1. The tab                                                           */
/* ------------------------------------------------------------------ */
const side = page.locator("[data-side-panel]");
const tab = side.locator('[aria-label="Side panel"] [role=radio][aria-label="System"]');
const order = await side.locator('[aria-label="Side panel"] [role=radio]').evaluateAll((ts) => ts.map((t) => t.getAttribute("aria-label")));
check("the side panel has a System tab, next to Look", order.indexOf("System") === order.indexOf("Look") + 1, order.join(", "));
if (!(await tab.count())) { check("the System tab can be pressed", false); await finish(browser); }

say("reading the untouched board");
const board0 = await boardRead();
const px0 = [await shot()];
for (const ms of [500, 2000, 1500]) { await pause(ms); px0.push(await shot()); }
await pause(1500);
const pxControl = await shot();
const mask = movingMask(px0);
const control = outside(px0[0], pxControl, mask);
const still = control === 0;
console.log(`       control: the untouched board differs from itself by ${control} px outside what moves of itself`);
/** The board, now, against the untouched board: part by part, and pixel for pixel where pixels can decide. */
async function unmoved(when) {
  await page.mouse.move(2, 2);
  await pause(900);
  const b = await boardRead();
  const d = differ(board0, b);
  check(`${when}: every part's box and painted style are as they were`, d.length === 0 && Object.keys(b).length === Object.keys(board0).length, `${Object.keys(board0).length} parts, ${d.length} differ ${d.slice(0, 4).join(", ")}`);
  if (still) { const n = outside(px0[0], await shot(), mask); check(`${when}: the board is 0 px different`, n === 0, `${n} px`); }
}

await tab.click();
await pause(800);
const panel = page.locator("[data-system-panel]");
check("pressing it opens the System panel", (await panel.count()) === 1);
check("…which says the site has no System yet", (await panel.locator("[data-system-none]").count()) === 1 && (await docSys()).systemId === null);
await unmoved("opening the System tab");

/* ------------------------------------------------------------------ */
/* 2. Take from this site                                               */
/* ------------------------------------------------------------------ */
const dryWant = await sys((S) => S.take({ dry: true }));
await panel.locator("[data-take-open]").click();
const report = page.locator("[data-take-report]");
await report.locator("[data-take-linked]").waitFor({ timeout: 15000 });
const shown = await report.evaluate((r) => ({ linked: Number(r.querySelector("[data-take-linked]").dataset.takeLinked), oneOffs: Number(r.querySelector("[data-take-linked]").dataset.takeOneoffs), comps: Number(r.querySelector("[data-take-components]").dataset.takeComponents), text: r.textContent }));
check("the dialog says what a take would find, before anything is linked",
  shown.linked === dryWant.report.linked && shown.oneOffs === dryWant.report.oneOffs && shown.comps === dryWant.report.found.components && /Nothing on the board moves/.test(shown.text) && shown.text.includes(`${dryWant.report.found.colours.toLocaleString()} colours`),
  `${shown.linked} linked, ${shown.oneOffs} one-offs, ${shown.comps} components (dry take: ${dryWant.report.linked} / ${dryWant.report.oneOffs} / ${dryWant.report.found.components})`);
check("…and reading it took nothing", (await docSys()).systemId === null && (await sys((S) => S.library().length)) === 0);
await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
await pause();
check("Cancel leaves the site without a System", (await docSys()).systemId === null && (await panel.locator("[data-system-none]").count()) === 1);
await unmoved("the take read and cancelled");

const depth0 = await page.evaluate(() => window.__studioUndoDepth());
await panel.locator("[data-take-open]").click();
await report.locator("[data-take-linked]").waitFor({ timeout: 15000 });
await page.locator("[data-take-confirm]").click();
await pause(2500);
const doc1 = await docSys();
const S1 = await sys((S) => S.system());
check("Take it: the site names its System, and the library holds it", !!doc1.systemId && S1?.id === doc1.systemId && (await sys((S, id) => S.library().some((x) => x.id === id), doc1.systemId)));
check("…in one undo step", (await page.evaluate(() => window.__studioUndoDepth())) === depth0 + 1, `${depth0} → ${await page.evaluate(() => window.__studioUndoDepth())}`);
check("…every linked field holds its token's value", (await sys((S) => S.broken().length)) === 0);
await unmoved("after the take");

/* ------------------------------------------------------------------ */
/* 3. The rows                                                          */
/* ------------------------------------------------------------------ */
const all = (s) => [...s.tokens.colour, ...s.tokens.type.steps, ...s.tokens.type.faces, ...s.tokens.space, ...s.tokens.radius, ...s.tokens.shadow, ...s.tokens.motion.durations, ...s.tokens.motion.easings];
const leads = S1.tokens.colour.filter((t) => !t.swatch || t.role).length + new Set(S1.tokens.colour.filter((t) => t.swatch && !t.role).map((t) => t.swatch)).size;
const kindsShown = await panel.evaluate((p) => [...p.querySelectorAll("[data-token-list]")].map((l) => l.dataset.tokenList));
check("the tokens are grouped by kind: colours, faces, text sizes, space, corners, shadows, durations, easings",
  JSON.stringify(kindsShown) === JSON.stringify(["colour", "face", "type", "space", "radius", "shadow", "duration", "easing"]), kindsShown.join(", "));
const rowsShown = await panel.locator("[data-token-row]").count();
check("one row per token, close shades folded under their lead", rowsShown === all(S1).length - (S1.tokens.colour.length - leads), `${rowsShown} rows, ${all(S1).length} tokens, ${S1.tokens.colour.length - leads} shades folded`);
const fold = panel.locator("[data-shades]").first();
if (await fold.count()) {
  const n = Number(await fold.getAttribute("data-shades"));
  await fold.click();
  await pause(300);
  check("a fold opens to its close shades", (await panel.locator("[data-token-row]").count()) === rowsShown + n, `${n} shades`);
  await fold.click();
  await pause(300);
} else console.log("  --   no close shades to fold on this site");

/* The colour most fields point at that is no palette role: the one J would reach for. */
const pick = await page.evaluate(() => {
  const s = window.__polioSystem.system();
  const doc = window.__studioHistory.doc();
  const count = new Map();
  for (const n of doc.nodes) for (const [f, id] of Object.entries(n.sys?.f ?? {})) if (f === "colour.bg" || f === "colour.text" || f === "edge.colour") count.set(id, (count.get(id) ?? 0) + 1);
  const [id] = [...count.entries()].filter(([id]) => { const t = s.tokens.colour.find((t) => t.id === id); return t && !t.role && !!document.querySelector(`[data-system-panel] [data-token-row="${id}"]`); }).sort((a, b) => b[1] - a[1])[0] ?? [];
  const fields = id ? doc.nodes.reduce((a, n) => a + Object.values(n.sys?.f ?? {}).filter((t) => t === id).length, 0) : 0;
  return id ? { id, value: s.tokens.colour.find((t) => t.id === id).value, name: s.tokens.colour.find((t) => t.id === id).name, users: window.__polioSystem.usedBy(id), fields } : null;
});
if (!pick) { check("a colour token the parts wear", false); await finish(browser); }
const row = panel.locator(`[data-token-row="${pick.id}"]`);
check("its row says how many fields point at it", (await row.locator(`[data-used-by="${pick.id}"]`).textContent()).replace(/\D/g, "") === String(pick.fields), `${await row.locator(`[data-used-by="${pick.id}"]`).textContent()} (${pick.fields} fields, ${pick.users.length} parts)`);
await row.locator(`[data-used-by="${pick.id}"]`).click();
await pause(500);
const lit = await page.evaluate(() => [...document.querySelectorAll("[data-point-mark]")].map((e) => e.getAttribute("data-point-mark")));
const drawnUsers = await page.evaluate((ids) => ids.filter((id) => document.querySelector(`[data-studio-scroll] [data-node-id="${id}"]`)).length, pick.users);
check("pressing \"used by\" lights exactly those parts on the board", lit.length > 0 && lit.every((id) => pick.users.includes(id)) && new Set(lit).size >= Math.min(drawnUsers, 1), `${new Set(lit).size} lit of ${drawnUsers} drawn users`);
await row.locator(`[data-used-by="${pick.id}"]`).click();
await pause(500);
check("…and pressing again puts the light out", (await page.locator("[data-point-mark]").count()) === 0);
await unmoved("after lighting and unlighting");

/* ------------------------------------------------------------------ */
/* 4. Editing tokens in their rows                                      */
/* ------------------------------------------------------------------ */
const MAGENTA = "rgb(255, 0, 255)";
const valueBox = row.locator('input:not([type=color])');
await valueBox.fill(MAGENTA);
await valueBox.press("Enter");
await pause(1500);
check("a colour changed in its row is the token's value, in the library too", (await sys((S, id) => S.system().tokens.colour.find((t) => t.id === id).value, pick.id)) === MAGENTA);
const showsIt = await page.evaluate(([ids, v]) => ids.filter((id) => { const el = document.querySelector(`[data-studio-scroll] [data-node-id="${id}"]`); return el && [el, ...el.querySelectorAll("*")].some((e) => { const cs = getComputedStyle(e); return [cs.color, cs.backgroundColor, cs.borderTopColor, cs.backgroundImage].some((c) => c.includes(v)); }); }).length, [pick.users, MAGENTA]);
const boardM = await boardRead();
const others = differ(board0, boardM).filter((id) => !pick.users.includes(id));
check("…it repaints the parts pointing at it, and only them", showsIt > 0 && others.length === 0, `${showsIt} parts show it, ${others.length} others changed ${others.slice(0, 4).join(", ")}`);
await page.evaluate(() => window.__studioHistory.act("undo"));
await pause(1500);
check("one undo takes it back", (await sys((S, id) => S.system().tokens.colour.find((t) => t.id === id).value, pick.id)) === pick.value);
await unmoved("after the colour change was undone");

await row.locator("[data-token-name]").click();
const nameBox = row.getByRole("textbox", { name: `Name of ${pick.name}` });
await nameBox.fill("Brand ink");
await nameBox.press("Enter");
await pause(500);
check("a token renamed in its row", (await sys((S, id) => S.system().tokens.colour.find((t) => t.id === id).name, pick.id)) === "Brand ink");

const spaces0 = (await sys((S) => S.system().tokens.space.length));
await panel.locator('[data-add-token="space"]').click();
const add = panel.locator('[data-add-row="space"]');
await add.getByRole("textbox", { name: "Name" }).fill("Test step");
await add.getByRole("textbox", { name: "Value" }).fill("13");
await add.locator("[data-add-confirm]").click();
await pause(600);
const added = await sys((S) => S.system().tokens.space.find((t) => t.name === "Test step") ?? null);
check("a space step added in the panel", !!added && added.px === 13 && (await sys((S) => S.system().tokens.space.length)) === spaces0 + 1, JSON.stringify(added));
if (added) {
  const r = panel.locator(`[data-token-row="${added.id}"]`);
  await r.hover();
  await r.getByRole("button", { name: "Take Test step out" }).click();
  await pause(600);
  check("…and taken out again", (await sys((S) => S.system().tokens.space.length)) === spaces0 && !(await panel.locator(`[data-token-row="${added.id}"]`).count()));
}
await unmoved("after a rename, an add and a take-out");

/* ------------------------------------------------------------------ */
/* 5. Change just this one                                              */
/* ------------------------------------------------------------------ */
const part = pick.users.find(Boolean);
await page.evaluate((id) => window.__studioSelect([id]), part);
await pause(600);
const picked = panel.locator(`[data-picked-part="${part}"]`);
check("with one part picked, the panel lists the fields it points with", (await picked.locator("[data-picked-field]").count()) > 0);
const field = await picked.locator("[data-picked-field]").evaluateAll((els, id) => els.map((e) => e.dataset.pickedField), pick.id);
const theField = await page.evaluate(([id, tok]) => Object.entries(window.__studioHistory.doc().nodes.find((n) => n.id === id).sys.f).find(([, t]) => t === tok)?.[0], [part, pick.id]);
await picked.locator(`[data-just-this-one="${theField}"]`).click();
await pause(800);
const after = await page.evaluate(([id, f]) => window.__studioHistory.doc().nodes.find((n) => n.id === id).sys?.f?.[f] ?? null, [part, theField]);
check("\"Change just this one\" lets that field go of its token", after === null && (await picked.locator("[data-picked-field]").count()) === field.length - 1, `${theField}: ${after}`);
await page.evaluate(() => window.__studioSelect([]));
await unmoved("after Change just this one");

/* ------------------------------------------------------------------ */
/* 6. A component                                                       */
/* ------------------------------------------------------------------ */
const comp = S1.components.slice().sort((a, b) => b.variants.length - a.variants.length)[0];
if (!comp) console.log("  --   no components on this site");
else {
  await panel.locator(`[data-component-open="${comp.id}"]`).click();
  await pause(500);
  const ed = panel.locator(`[data-component-editor="${comp.id}"]`);
  check("a component opens: its variants and the five states as keys", (await ed.locator("[data-variant]").count()) === comp.variants.length && (await ed.locator("[data-state]").count()) === 5);
  check("…its look is drawn, and its slots name their tokens", (await ed.locator("[data-component-preview]").count()) === 1 && (await ed.locator("[data-slot]").count()) === Object.keys(comp.variants[0].look).length);
  await ed.locator('[data-state="focus"]').click();
  await pause(300);
  const focus0 = comp.variants[0].states.focus;
  if (!focus0) await ed.locator('[data-state-set="focus"]').click();
  await pause(500);
  const across = ed.getByRole("textbox", { name: "Focus Across" });
  await across.fill("2");
  await across.press("Enter");
  await pause(600);
  const st = await sys((S, [c, v]) => S.system().components.find((x) => x.id === c).variants.find((x) => x.id === v).states.focus, [comp.id, comp.variants[0].id]);
  check("the focus state is set and edited in its editor", st?.dx === 2, JSON.stringify(st));
  await ed.locator("[data-variant-add]").click();
  await pause(500);
  check("+ add makes a variant", (await sys((S, c) => S.system().components.find((x) => x.id === c).variants.length, comp.id)) === comp.variants.length + 1 && (await ed.locator("[data-variant]").count()) === comp.variants.length + 1);
  const inst = await sys((S, c) => S.usedBy(c), comp.id);
  await ed.locator(`[data-used-by="${comp.id}"]`).click();
  await pause(500);
  const litI = await page.evaluate(() => [...new Set([...document.querySelectorAll("[data-point-mark]")].map((e) => e.getAttribute("data-point-mark")))]);
  check("Show all lights its instances on the board", litI.length > 0 && litI.every((id) => inst.includes(id)), `${litI.length} lit, ${inst.length} instances`);
  await ed.locator(`[data-used-by="${comp.id}"]`).click();
  await pause(300);
  await page.evaluate((id) => window.__studioSelect([id]), inst[0]);
  await pause(500);
  await ed.locator("[data-detach-picked]").click();
  await pause(800);
  check("Detach the picked one takes that instance out of the System", (await page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id).sys ?? null, inst[0])) === null);
  await page.evaluate(() => window.__studioSelect([]));
  await ed.locator("[data-component-back]").click();
  await pause(400);
  await unmoved("after the component edits");
}

/* ------------------------------------------------------------------ */
/* 7. The library                                                       */
/* ------------------------------------------------------------------ */
await panel.locator("[data-system-fork]").click();
await pause(800);
const doc2 = await docSys();
check("Own copy: the site uses a System of its own, every pointer kept", !!doc2.systemId && doc2.systemId !== doc1.systemId && (await sys((S) => S.library().length)) === 2 && (await sys((S) => S.broken().length)) === 0);
const picker = panel.getByRole("combobox", { name: "System this site uses" });
await picker.click();
await pause(300);
await page.getByRole("option", { name: S1.name, exact: true }).first().click();
await pause(800);
check("the library picker points the site back at the first System", (await docSys()).systemId === doc1.systemId);
await unmoved("after Own copy and the picker");
await panel.locator("[data-system-new]").click();
await pause(800);
const doc3 = await docSys();
const emptyNow = await sys((S) => { const s = S.system(); return s && s.tokens.colour.length + s.tokens.space.length + s.components.length; });
check("New: an empty System for the site", !!doc3.systemId && ![doc1.systemId, doc2.systemId].includes(doc3.systemId) && emptyNow === 0);
await unmoved("after New");

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await page.screenshot({ path: `${SHOTS}/${TAG}-end.png` });
writeFileSync(`${SHOTS}/${TAG}-report.json`, JSON.stringify({ control, still, report: dryWant.report }, null, 2));
await finish(browser);
