#!/usr/bin/env node
/**
 * PARTS ARE INSTANCES OF THEIR COMPONENT (the parts-bind lane, proposal (c):
 * "Button / primary · Edit the component · Change just this one · Reset").
 *
 *   1. pure, on the capture's own document, taken: every instance shows its
 *      variant (nothing to reset on a fresh take, and a reset there changes
 *      nothing); a variant's fill set to a new colour repaints exactly the
 *      fill fields of that variant's instances and nothing else; an
 *      instance changed by hand keeps its fill, and one held as its own
 *      keeps it too; Reset brings it back; a site holding the old copy of
 *      the System follows the same way when it takes the new one;
 *   2. in the Builder, on the site brought in: the take moves nothing; the
 *      Element panel names the picked instance "Component / variant" with
 *      Edit the component, Change just this one and Reset; Edit the
 *      component opens the System tab's editor on that variant; changing
 *      its fill there repaints exactly its instances on the board (an
 *      override kept); one Ctrl+Z takes it all back; Reset restores the
 *      overridden one; the exported component library holds the new fill;
 *      no page errors.
 *
 *   npx next start -p 3241
 *   node tests/parts-bind.mjs http://127.0.0.1:3241 <the capture folder>
 *
 * Red on base: there is no `system/bind.ts` to load, and no instance row.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3241").replace(/\/$/, "");
const SINK = process.argv[3];
const PURE_ONLY = process.argv.includes("--pure");
if (!SINK || !existsSync(join(SINK, "site/document.json"))) {
  console.error("usage: node tests/parts-bind.mjs <builder url> <the capture folder> [--pure]");
  process.exit(2);
}
const TAG = SINK.replace(/[\\/]+$/, "").split(/[\\/]/).pop();
const T0 = Date.now();
const say = (w) => console.log(`       … ${w} (${((Date.now() - T0) / 1000).toFixed(0)}s)`);
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const finish = () => {
  const passed = results.filter(Boolean).length;
  console.log(`\n${TAG}: ${passed}/${results.length}`);
  process.exit(passed === results.length ? 0 : 1);
};

let B;
try {
  B = await import("../src/features/studio/system/bind.ts");
} catch (e) {
  check("the instances module is there (system/bind.ts)", false, String(e.message).slice(0, 120));
  finish();
}
const { takeSystem, linksHold } = await import("../src/features/studio/system/take.ts");
const { setVariantSlot } = await import("../src/features/studio/system/link.ts");
const { materialise } = await import("../src/features/studio/system/resolve.ts");
const { componentsOf } = await import("../src/features/studio/components.ts");
const { landPalette } = await import("../src/features/studio/paletteFrom.ts");
const { paletteFromHue } = await import("../src/features/studio/look/index.ts");

const MAGENTA = "rgb(255, 0, 255)";
const CYAN = "rgb(0, 255, 255)";

/* ------------------------------------------------------------------ */
/* 1. Pure                                                              */
/* ------------------------------------------------------------------ */
const DOC = readFileSync(join(SINK, "site/document.json"));
const doc = JSON.parse(DOC.toString("utf8"));
/** The variant with the most instances that has a fill a part paints: the one the checks edit. */
let target = null;
{
  const landed = landPalette(doc.nodes, doc.look?.palette ?? {});
  const palette = { ...paletteFromHue(265), ...landed.palette };
  const t = takeSystem({ nodes: landed.nodes, palette, frameWidth: 1440, name: TAG });
  const nodes = landed.nodes.map((n) => (t.links.has(n.id) ? { ...n, sys: t.links.get(n.id) } : n));
  const s = t.system;
  const hosts = nodes.filter((n) => n.sys?.c);
  check("pure: the take made instances", hosts.length > 0 && hosts.length === t.report.instances, `${hosts.length} instances of ${s.components.length} components`);

  const left = hosts.filter((n) => B.overridesOf(nodes, s, n.id, palette).length);
  check("pure: on a fresh take every instance shows its variant", left.length === 0, left.slice(0, 3).map((n) => `${n.id}: ${B.overridesOf(nodes, s, n.id, palette)}`).join("; "));
  const resetMoves = hosts.filter((n) => B.resetInstance(nodes, s, n.id, palette).changed.length);
  check("pure: Reset on a fresh take changes nothing", resetMoves.length === 0, resetMoves.slice(0, 3).map((n) => n.id).join(", "));
  check("pure: a System that did not change rebinds nothing", B.rebind(nodes, s, s, palette).changed.length === 0);

  const comps = componentsOf(nodes, palette);
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const groups = new Map();
  for (const h of hosts) {
    const key = `${h.sys.c.component}|${h.sys.c.variant}`;
    const comp = comps.byId.get(h.id);
    const fill = comp && B.slotFields(byId, comp, "fill").find((f) => f.main);
    if (fill) (groups.get(key) ?? groups.set(key, []).get(key)).push(h.id);
  }
  const [key, ids] = [...groups.entries()].filter(([k]) => {
    const [c, v] = k.split("|");
    return !!s.components.find((x) => x.id === c)?.variants.find((x) => x.id === v)?.look.fill;
  }).sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!key) {
    check("pure: a variant with a fill and instances to edit", false, "none on this site");
  } else {
    const [cid, vid] = key.split("|");
    target = { component: cid, variant: vid, hosts: ids };
    say(`editing ${cid} / ${vid}: ${ids.length} instances`);
    /* The fields a fill change should reach: each instance's fill fields that show the variant's fill. */
    const want = B.slotValue(s, s.components.find((x) => x.id === cid).variants.find((x) => x.id === vid).look.fill).value;
    const fillParts = (list, skip = new Set()) => [...new Set(list.filter((h) => !skip.has(h)).flatMap((h) => B.slotFields(byId, comps.byId.get(h), "fill").map((f) => f.node)))];

    /* An override on the second instance (by hand), and the third held as its own. */
    const byHand = ids[1] ?? null, held = ids[2] ?? null;
    let start = nodes;
    if (byHand) {
      const f = B.slotFields(byId, comps.byId.get(byHand), "fill").find((x) => x.main);
      start = start.map((n) => (n.id === f.node ? { ...n, colour: { ...n.colour, [f.field.split(".")[1]]: CYAN } } : n));
    }
    if (held) start = start.map((n) => (n.id === held ? B.holdOwn(n, s) : n));

    const next = setVariantSlot(s, cid, vid, "fill", { value: MAGENTA }, "colour");
    check("pure: the variant's fill holds the new colour", !!next && B.slotValue(next, next.components.find((x) => x.id === cid).variants.find((x) => x.id === vid).look.fill)?.value === MAGENTA);
    const r = B.rebind(start, s, next, palette);
    const expect = fillParts(ids, new Set([byHand, held].filter(Boolean)));
    const extra = r.changed.filter((id) => !expect.includes(id));
    const missing = expect.filter((id) => !r.changed.includes(id));
    check("pure: it repaints exactly that variant's instances' fills", extra.length === 0 && missing.length === 0, `${r.changed.length} parts repainted, ${expect.length} expected${extra.length ? `, extra ${extra.slice(0, 3)}` : ""}${missing.length ? `, missing ${missing.slice(0, 3)}` : ""}`);
    const after = new Map(r.nodes.map((n) => [n.id, n]));
    const shows = (h, v) => { const f = B.slotFields(after, comps.byId.get(h), "fill").find((x) => x.main); const c = after.get(f.node).colour[f.field.split(".")[1]]; return (palette[c] ?? c) === v; };
    check("pure: and each shows it", ids.filter((h) => h !== byHand && h !== held).every((h) => shows(h, MAGENTA)));
    const other = r.nodes.filter((n, i) => n !== start[i] && !expect.includes(n.id));
    check("pure: no other part changed", other.length === 0, other.slice(0, 3).map((n) => n.id).join(", "));
    if (byHand) {
      check("pure: an instance changed by hand keeps its fill", shows(byHand, CYAN));
      check("pure: and says its fill is its own", B.overridesOf(r.nodes, next, byHand, palette).includes("fill"));
      const reset = B.resetInstance(r.nodes, next, byHand, palette);
      const back = new Map(reset.nodes.map((n) => [n.id, n]));
      const f = B.slotFields(back, comps.byId.get(byHand), "fill").find((x) => x.main);
      check("pure: Reset restores it to the variant", back.get(f.node).colour[f.field.split(".")[1]] === MAGENTA && B.overridesOf(reset.nodes, next, byHand, palette).length === 0);
    }
    if (held) {
      check("pure: an instance held as its own keeps its fill", shows(held, palette[want] ?? want) || B.overridesOf(r.nodes, next, held, palette).includes("fill"));
      const reset = B.resetInstance(r.nodes, next, held, palette);
      check("pure: Reset on it wears the variant again", B.overridesOf(reset.nodes, next, held, palette).length === 0 && !reset.nodes.find((n) => n.id === held).sys.c.own);
    }
    /* Except the fill changed by hand: an override, kept on purpose. */
    const handNode = byHand ? B.slotFields(byId, comps.byId.get(byHand), "fill").find((x) => x.main).node : null;
    const broken = linksHold(materialise(r.nodes, next).nodes, next).filter((x) => x.node !== handNode);
    check("pure: every other linked field still holds its token's value", broken.length === 0, JSON.stringify(broken.slice(0, 3)));

    /* A token as the new fill: the instances point at it. */
    const tok = s.tokens.colour.find((x) => x.value !== want && !x.role);
    if (tok) {
      const viaToken = setVariantSlot(s, cid, vid, "fill", { token: tok.id }, "colour");
      const rt = B.rebind(nodes, s, viaToken, palette);
      const pointing = ids.flatMap((h) => B.slotFields(byId, comps.byId.get(h), "fill").filter((f) => f.main)).filter((f) => rt.nodes.find((n) => n.id === f.node).sys?.f?.[f.field] === tok.id);
      check("pure: a token as the fill: the instances point at it", pointing.length === ids.length, `${pointing.length}/${ids.length}`);
    }

    /* Another site holding the same document and the old copy of the System takes the new one: the same parts follow. */
    const elsewhere = B.rebind(JSON.parse(JSON.stringify(start)), JSON.parse(JSON.stringify(s)), next, palette);
    check("pure: a site sharing the System follows the same way", JSON.stringify([...elsewhere.changed].sort()) === JSON.stringify([...r.changed].sort()));
  }
}
if (PURE_ONLY) finish();

/* ------------------------------------------------------------------ */
/* 2. In the Builder                                                    */
/* ------------------------------------------------------------------ */
const { chromium } = await import("playwright-core");
const sharp = (await import("sharp")).default;
const pics = existsSync(join(SINK, "assets/pictures")) ? readdirSync(join(SINK, "assets/pictures")) : [];
const REPO = "/repos/sparkygogo77-spec/sink";
const tree = [
  { path: "package.json", type: "blob", sha: "pkg", size: 10 },
  { path: "site/document.json", type: "blob", sha: "doc", size: DOC.length },
  ...pics.map((p) => ({ path: `assets/pictures/${p}`, type: "blob", sha: `pic:${p}`, size: 100 })),
];
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox", ...(process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean)], ...(existsSync(AT) ? { executablePath: AT } : {}) });
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
const done = async () => { await browser.close(); finish(); };
const pause = (ms = 600) => page.waitForTimeout(ms);

/* Bringing the capture in, as tests/system-panel.mjs does. */
const nodeCount = () => page.evaluate(() => window.__studioHistory?.doc().nodes.length ?? 0).catch(() => 0);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => {
  const env = (s) => JSON.stringify({ state: s, version: 0 });
  localStorage.setItem("builder.builds", env({ projects: [{ id: "s3", name: "Site 3", updatedAt: Date.now() }], activeId: "s3" }));
  localStorage.setItem("builder.studio", env({ nodes: [] }));
  localStorage.removeItem("builder.systems");
});
await page.reload({ waitUntil: "networkidle" });
await pause(1200);
const keys = page.locator("[data-keys-panel]");
await page.getByRole("button", { name: "Keys", exact: true }).click();
await pause(500);
const skip = keys.getByRole("button", { name: /Skip the PIN|Hold the key for this tab/ });
if (await skip.count()) { await skip.first().click(); await pause(300); }
await keys.locator('[data-service="github"] input[type="password"]').first().fill("not-a-token-placeholder-xxxx");
await keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first().click();
await pause(500);
await keys.getByRole("button", { name: "Close keys" }).click();
await pause(500);
await page.locator("[data-github-button]").first().click();
await pause(700);
await page.locator("[data-repo-bring]").fill("sparkygogo77-spec/sink");
await page.locator("[data-repo-pull]").click();
await pause(300);
if (await page.locator("[data-repo-bring-go]").count()) await page.locator("[data-repo-bring-go]").click();
say("bringing in");
for (let i = 0; i < 120 && (await nodeCount()) < 50; i++) await pause(1000);
await page.mouse.move(2, 2);
await pause(Number(process.env.SETTLE ?? 8000));
check("the site came in", (await nodeCount()) >= 50, `${await nodeCount()} parts`);

/* Reading the board, part by part (box and painted style) and pixel for pixel, as system-panel does. */
const PROPS = ["color", "background-color", "background-image", "border-top-color", "border-top-width", "border-radius", "box-shadow", "padding", "gap", "font-size", "font-family", "font-weight", "line-height", "letter-spacing", "transition", "opacity", "transform"];
const hold = () => page.evaluate(() => { for (const a of document.getAnimations()) { try { if (a instanceof CSSTransition) a.finish(); else { a.pause(); a.currentTime = 0; } } catch { /* a finished one */ } } });
const boardRead = async () => { await hold(); return page.evaluate((PROPS) => {
  const out = {};
  for (const el of document.querySelectorAll("[data-studio-scroll] [data-node-id]")) {
    const r = el.getBoundingClientRect();
    /* The Builder's own marks under the mouse (its dashed outline, the part's name chip) are not the part. */
    const styles = [el, ...el.querySelectorAll("*:not([data-hover-mark]):not([class*='group-hover:'])")].slice(0, 60).map((e) => { const cs = getComputedStyle(e); return PROPS.map((p) => cs.getPropertyValue(p)).join("|"); });
    out[el.getAttribute("data-node-id")] = `${Math.round(r.x * 10)},${Math.round(r.y * 10)},${Math.round(r.width * 10)},${Math.round(r.height * 10)}#${styles.join(";")}`;
  }
  return out;
}, PROPS); };
const frameClip = () => page.evaluate(() => { const r = document.querySelector("[data-frame]")?.getBoundingClientRect(); if (!r) return null; const x = Math.max(0, r.left), y = Math.max(0, r.top); return { x, y, width: Math.min(innerWidth, r.right) - x, height: Math.min(innerHeight, r.bottom) - y }; });
const shot = async () => { await hold(); const clip = await frameClip(); return sharp(await page.screenshot({ animations: "disabled", ...(clip ? { clip } : {}) })).raw().toBuffer({ resolveWithObject: true }); };
const diffPx = (a, b) => { if (a.data.length !== b.data.length) return Infinity; const ch = a.info.channels; let n = 0; for (let i = 0; i < a.data.length; i += ch) if (a.data[i] !== b.data[i] || a.data[i + 1] !== b.data[i + 1] || a.data[i + 2] !== b.data[i + 2]) n++; return n; };
const differ = (a, b) => Object.keys(a).filter((id) => a[id] !== b[id]).concat(Object.keys(b).filter((id) => !(id in a)));
const S = (fn, arg) => page.evaluate(([f, a]) => new Function("S", "a", `return (${f})(S, a);`)(window.__polioSystem, a), [fn.toString(), arg]);
const docNow = () => page.evaluate(() => window.__studioHistory.doc().nodes);
const depth = () => page.evaluate(() => window.__studioUndoDepth());
const tab = (name) => page.locator(`[data-side-panel] [aria-label="Side panel"] [role=radio][aria-label="${name}"]`).click();
const blur = () => page.evaluate(() => document.activeElement?.blur?.());
const select = async (id) => { await page.evaluate((x) => window.__studioSelect(x ? [x] : []), id); await pause(600); };

say("waiting for the board to hold still");
let board0 = await boardRead();
for (let i = 0, still = 0; i < 80 && still < 2; i++) { await pause(1500); const next = await boardRead(); still = differ(board0, next).length ? 0 : still + 1; board0 = next; }
const px0 = await shot();
await pause(1500);
const pxStill = diffPx(px0, await shot()) === 0;
say(`untouched board read (${Object.keys(board0).length} parts drawn; pixels ${pxStill ? "decide" : "cannot decide, the board moves of itself"})`);

/* The take, pressed in the System tab. */
await tab("System");
await pause(800);
await page.locator("[data-system-panel] [data-take-open]").click();
await page.locator("[data-take-report] [data-take-linked]").waitFor({ timeout: 15000 });
await page.locator("[data-take-confirm]").click();
await pause(1500);
await page.mouse.move(2, 2);
await pause(900);
const boardT = await boardRead();
const movedT = differ(board0, boardT);
check("the take moves nothing on the board, part by part", movedT.length === 0, `${movedT.length} of ${Object.keys(board0).length} differ ${movedT.slice(0, 4)}`);
if (pxStill) { const n = diffPx(px0, await shot()); check("…and pixel for pixel", n === 0, `${n} px`); }

/* The variant to edit: the one with the most instances drawn on the board whose fill a part paints. */
const want = await S((S) => {
  const nodes = window.__studioHistory.doc().nodes;
  const drawn = new Set([...document.querySelectorAll("[data-studio-scroll] [data-node-id]")].map((e) => e.getAttribute("data-node-id")));
  const sys = S.system();
  const groups = new Map();
  for (const n of nodes) {
    if (!n.sys?.c) continue;
    const it = S.instance(n.id);
    const fill = it?.fields.fill?.find((f) => f.main);
    const look = sys.components.find((c) => c.id === n.sys.c.component)?.variants.find((v) => v.id === n.sys.c.variant)?.look;
    if (!fill || !look?.fill || !drawn.has(fill.node)) continue;
    const key = `${it.component}|${it.variant}`;
    (groups.get(key) ?? groups.set(key, []).get(key)).push(it);
  }
  const best = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  return best ? { list: best, name: best[0].name } : null;
});
if (!want) { check("a variant with drawn instances and a fill", false, "none"); await done(); }
const list = want.list;
const [first, byHand, held] = [list[0], list[1] ?? null, list[2] ?? null];
say(`editing ${want.name}: ${list.length} instances on the board`);
const fillOf = (it) => it.fields.fill.find((f) => f.main);
const keyOf = (it) => fillOf(it).field.split(".")[1];

/* The Element panel names the picked instance and offers the three choices. */
await tab("Element");
await select((byHand ?? first).host);
const row = page.locator("[data-instance-row]");
const rowText = (await row.count()) ? await row.first().innerText() : "";
check("picked, the Element panel says which component and variant it is", rowText.includes(want.name), JSON.stringify(rowText.slice(0, 80)));
check("…with Edit the component, Change just this one and Reset", (await row.locator("[data-instance-edit]").count()) === 1 && (await row.locator("[data-instance-own-look]").count()) === 1 && (await row.locator("[data-instance-reset]").count()) === 1);
check("…Reset waits until it holds something of its own", (await row.count()) === 1 && (await row.locator("[data-instance-reset]").isDisabled()));
const layer = byHand ? byHand.parts.find((p) => p !== byHand.host) : null;
if (layer) {
  await select(layer);
  check("a layer of it picked speaks for its component", (await page.locator(`[data-instance-row="${byHand.host}"]`).count()) === 1);
}

/* An override changed by hand, as the Element panel's own fields do it, and one instance held as its own. */
if (byHand) {
  await page.evaluate(([id, key, v]) => { const n = window.__studioHistory.doc().nodes.find((x) => x.id === id); window.__studioHistory.act("updateNode", id, { colour: { ...(n.colour ?? {}), [key]: v } }); }, [fillOf(byHand).node, keyOf(byHand), CYAN]);
  await select(byHand.host);
  let ownSaid = "";
  for (let i = 0; i < 10 && !ownSaid; i++) { ownSaid = ((await row.locator("[data-instance-own]").count()) ? await row.locator("[data-instance-own]").first().getAttribute("data-instance-own") : ""); if (!ownSaid) await pause(500); }
  check("changed by hand, the row says its fill is its own", ownSaid.split(" ").includes("fill") && !(await row.locator("[data-instance-reset]").isDisabled()), `row: ${JSON.stringify(ownSaid)}, row of ${await row.first().getAttribute("data-instance-row")}, api: ${JSON.stringify(await S((S, id) => S.overridesOfPart(id), byHand.host))}, fill ${JSON.stringify((await docNow()).find((n) => n.id === fillOf(byHand).node)?.colour)}`);
}
if (held) {
  await select(held.host);
  await row.locator("[data-instance-own-look]").click();
  await pause(500);
  check("Change just this one: the row says it keeps its own look", /its own look/.test(await row.first().innerText()));
}
/* Read with nothing picked: a picked part draws the Builder's own chip inside it. */
await select(null);
await page.mouse.move(2, 2);
await pause(900);
const boardB = await boardRead();
const docB = await docNow();
const depthB = await depth();
await select(first.host);

/* Edit the component: the System tab, on this variant; its fill set there. */
await row.locator("[data-instance-edit]").click();
await pause(900);
const editor = page.locator(`[data-component-editor="${first.component}"]`);
check("Edit the component opens the System tab's editor on that variant", (await editor.count()) === 1 && (await editor.getAttribute("data-variant-shown")) === first.variant);
const input = editor.locator('[data-slot="fill"] input:not([type="color"])').first();
await input.fill(MAGENTA);
await input.press("Enter");
await blur();
await pause(1200);
await page.mouse.move(2, 2);
await pause(900);
check("the change is one undo step", (await depth()) === depthB + 1, `${depthB} → ${await depth()}`);
const docE = await docNow();
const nodeE = new Map(docE.map((n) => [n.id, n]));
const showsNow = (it, v) => nodeE.get(fillOf(it).node)?.colour?.[keyOf(it)] === v;
const followers = list.filter((it) => it !== byHand && it !== held);
check("every instance of the variant shows the new fill", followers.every((it) => showsNow(it, MAGENTA)), `${followers.filter((it) => showsNow(it, MAGENTA)).length}/${followers.length}`);
if (byHand) check("the one changed by hand keeps its own fill", showsNow(byHand, CYAN));
if (held) check("the one held as its own keeps its fill", !showsNow(held, MAGENTA));
const before = new Map(docB.map((n) => [n.id, JSON.stringify(n)]));
const changedDoc = docE.filter((n) => JSON.stringify(n) !== before.get(n.id)).map((n) => n.id);
const allowed = new Set(followers.flatMap((it) => it.parts));
const strays = changedDoc.filter((id) => !allowed.has(id));
check("no other part in the document changed", strays.length === 0, `${changedDoc.length} changed, strays ${strays.slice(0, 4)}`);
const boardE = await boardRead();
const repainted = differ(boardB, boardE);
const fillNodes = followers.map((it) => fillOf(it).node).filter((id) => id in boardB);
const strayDrawn = repainted.filter((id) => !allowed.has(id));
check("on the board it repaints exactly those instances", strayDrawn.length === 0 && fillNodes.every((id) => repainted.includes(id)), `${repainted.length} parts repainted, ${fillNodes.length} fills drawn${strayDrawn.length ? `, strays ${strayDrawn.slice(0, 4)}` : ""}`);
const libFill = await S((S, a) => { const s = S.system(); const r = s.components.find((c) => c.id === a.c).variants.find((x) => x.id === a.v).look.fill; return "token" in r ? s.tokens.colour.find((t) => t.id === r.token)?.value : r.value; }, { c: first.component, v: first.variant });
check("the System's variant (what the exported library draws) holds the instances' fill", libFill === MAGENTA, String(libFill));
check("…and it is the copy in the library every site shares", await S((S) => { const s = S.system(); return S.library().some((x) => x.id === s.id && x.rev === s.rev); }));

/* One Ctrl+Z takes it all back. */
await blur();
await page.keyboard.press("Control+z");
await pause(1200);
await page.mouse.move(2, 2);
await pause(900);
await select(null);
const boardU = await boardRead();
const backU = differ(boardB, boardU);
for (const id of backU.slice(0, 1)) { const a = boardB[id].split(/[;#|]/), b = boardU[id].split(/[;#|]/); console.log("       undo diff", id, a.map((x, i) => (x !== b[i] ? `${i}: ${x} -> ${b[i]}` : null)).filter(Boolean).slice(0, 6).join(" ; ")); }
check("one Ctrl+Z takes it all back, on the board", backU.length === 0 && (await depth()) === depthB, `${backU.length} differ ${backU.slice(0, 3)} (instances: ${backU.map((id) => list.findIndex((it) => it.parts.includes(id)))}), depth ${await depth()}`);
const libU = await S((S, a) => JSON.stringify(S.system().components.find((c) => c.id === a.c).variants.find((x) => x.id === a.v).look.fill), { c: first.component, v: first.variant });
check("…and in the System", !libU.includes("255, 0, 255"), libU);

/* Reset brings each back to its variant. */
await tab("Element");
if (byHand) {
  await select(byHand.host);
  await row.locator("[data-instance-reset]").click();
  await pause(900);
  const n = (await docNow()).find((x) => x.id === fillOf(byHand).node);
  const was = docB.find((x) => x.id === fillOf(first).node).colour?.[keyOf(first)];
  check("Reset restores the one changed by hand to its variant", n.colour?.[keyOf(byHand)] === was && (await row.locator("[data-instance-own]").count()) === 0, `${n.colour?.[keyOf(byHand)]} vs ${was}`);
}
if (held) {
  await select(held.host);
  await row.locator("[data-instance-reset]").click();
  await pause(700);
  check("Reset on the one held as its own: it follows again", !(await page.evaluate((id) => window.__studioHistory.doc().nodes.find((x) => x.id === id).sys?.c?.own ?? null, held.host)));
}
/*
 * Another site sharing the System: a copy of this one, made before the edit,
 * holds the old copy of the System. The component edited here, the copy is
 * opened: its instances follow, and the edit stays in the library (opening it does not put its old copy back).
 */
say("a site sharing the System");
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await pause(1200);
await page.locator('[data-build-id="s3"] [aria-label="Duplicate this site"]').click();
await pause(1500);
const copyId = await page.evaluate(() => [...document.querySelectorAll("[data-build-id]")].map((e) => e.getAttribute("data-build-id")).find((id) => id !== "s3") ?? null);
check("the site was copied", !!copyId);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await pause(2500);
await tab("Element");
await select(first.host);
await row.locator("[data-instance-edit]").click();
await pause(900);
const input2 = page.locator(`[data-component-editor="${first.component}"] [data-slot="fill"] input:not([type="color"])`).first();
await input2.fill(MAGENTA);
await input2.press("Enter");
await blur();
await pause(1500);
const rev = await S((S) => S.system().rev);
await page.goto(`${BASE}/builds`, { waitUntil: "networkidle" });
await pause(1200);
if (copyId) await page.locator(`[data-build-id="${copyId}"] button[aria-label^="Switch to"]`).first().click();
await pause(1500);
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await pause(3000);
const there = new Map((await docNow()).map((n) => [n.id, n]));
const onCopy = (it, v) => there.get(fillOf(it).node)?.colour?.[keyOf(it)] === v;
/* All of them: the override and the one held as its own were reset above, before the copy was made. */
check("on the copy, every instance of the variant shows the edit", list.every((it) => onCopy(it, MAGENTA)), `${list.filter((it) => onCopy(it, MAGENTA)).length}/${list.length}`);
check("…and the edit stays in the library", await S((S, r) => S.system().rev >= r && JSON.stringify(S.system().components.flatMap((c) => c.variants.map((v) => v.look.fill))).includes("255, 0, 255"), rev));
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await done();
