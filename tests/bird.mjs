/**
 * His bird, back as his bird, and then used for something.
 *
 * A drawing used to end as a picture of itself clipped to its own outline.
 * This holds open the other half: the trace lands as **vector** — his
 * lines, in his coordinates — and what it is *for* is decided after, and
 * never decided for him.
 *
 *   · the paths that come back are kept whole, with the box they were
 *     drawn in;
 *   · making it fit an icon merges paths rather than discarding them, so
 *     "fewer paths" never means "less bird";
 *   · an icon carries no colour of its own, so it takes the colour of
 *     whatever it sits on;
 *   · the words choose a role when they say one, and when they say nothing
 *     the role stays empty and the panel asks, with all three offered;
 *   · and a bird set to icon can be dragged onto a button, which then
 *     wears it.
 *
 *   node tests/bird.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { ICON_PATHS, ROLES, readVector, roleFromWords, simplify, vectorMarkup, weigh } from "../src/features/studio/vector.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. What comes back is kept whole                                    */
/* ------------------------------------------------------------------ */

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${
  Array.from({ length: 20 }, (_, i) => `<path d="M${i * 5} ${i * 6}h${20 + i}v3h-${20 + i}z" fill="#000"/>`).join("")
}<rect width="128" height="128" fill="#fff"/></svg>`;

{
  const v = readVector(SVG, "test");
  check("the paths come back with the box they were drawn in", v?.viewBox === "0 0 128 128" && v.paths.length === 20, `${v?.paths.length} paths`);
  check("a rect the tracer found is not a path and is left behind", !JSON.stringify(v).includes("rect"));
  check("nothing that is not an svg gives a vector", readVector("<div>no</div>") === null);
  check("it says how heavy it is", weigh(v).paths === 20 && weigh(v).bytes > 100);
}
{
  const v = readVector(SVG, "test");
  const small = simplify(v, 5);
  check("simplifying gets to few paths", small.paths.length <= 5, `${v.paths.length} → ${small.paths.length}`);
  // Every original path's data has to still be in there somewhere.
  const all = small.paths.map((p) => p.d).join(" ");
  check("and every line drawn is still in one of them", v.paths.every((p) => all.includes(p.d)),
    `${v.paths.filter((p) => !all.includes(p.d)).length} lost`);
  check("fewer paths never means less bird", simplify(v, 1).paths.length === 1 && v.paths.every((p) => simplify(v, 1).paths[0].d.includes(p.d)));
  check("an already-small drawing is left alone", simplify(readVector(`<svg viewBox="0 0 10 10"><path d="M0 0h9v9H0z"/></svg>`), 6).paths.length === 1);
  check("the default keeps it icon-sized", simplify(v).paths.length <= ICON_PATHS);
}
{
  const markup = vectorMarkup(readVector(SVG));
  check("an icon has no colour of its own", !/#[0-9a-f]{3,6}/i.test(markup) && markup.includes("currentColor"), markup.slice(0, 60));
  check("its box is the one it was drawn in, and it is fitted rather than rewritten",
    markup.includes('viewBox="0 0 128 128"') && markup.includes("xMidYMid meet"));
  check("a line drawing can be stroked instead of filled", vectorMarkup(readVector(SVG), { stroke: true }).includes('stroke="currentColor"'));
}

/* ------------------------------------------------------------------ */
/* 2. Nothing invents a role                                           */
/* ------------------------------------------------------------------ */

check("the words choose one when they say one", roleFromWords("a bird icon") === "icon" && roleFromWords("a frame that holds the offer") === "surface" && roleFromWords("it flies along this path") === "motion");
check("a bare bird chooses nothing", roleFromWords("a bird") === null);
check("nothing said chooses nothing", roleFromWords("") === null && roleFromWords("   ") === null);
check("two roles named at once is not an answer either", roleFromWords("an icon on a surface") === null);
check("all three are on offer", ROLES.length === 3 && ROLES.includes("icon") && ROLES.includes("surface") && ROLES.includes("motion"));

/* ------------------------------------------------------------------ */
/* 3. Drawn, in a browser, and then used                               */
/* ------------------------------------------------------------------ */

const BIRD = (() => {
  const left = [], right = [];
  for (let i = 0; i <= 30; i++) {
    const t = i / 30;
    left.push([0.5 - t * 0.28, 0.52 - Math.sin(t * Math.PI) * 0.16 - t * 0.06]);
    right.push([0.5 + t * 0.28, 0.52 - Math.sin(t * Math.PI) * 0.16 - t * 0.06]);
  }
  return [left, right];
})();

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const lab = await browser.newPage({ viewport: { width: 64, height: 64 } });
await lab.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });

/* The tracer stands in locally and says so: a real run-length trace of the
   real picture, so everything downstream is under test and only the vendor
   is absent. The live numbers come from a person with a key. */
const traceLocally = (png) => lab.evaluate(async (data) => {
  const img = new Image();
  await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = `data:image/png;base64,${data}`; });
  const N = 128;
  const el = document.createElement("canvas"); el.width = N; el.height = N;
  const c = el.getContext("2d", { willReadFrequently: true });
  c.clearRect(0, 0, N, N); c.drawImage(img, 0, 0, N, N);
  const px = c.getImageData(0, 0, N, N).data;
  const ink = (i) => px[i * 4 + 3] > 40 && (px[i * 4] + px[i * 4 + 1] + px[i * 4 + 2]) / 3 < 150;
  const runs = [];
  for (let y = 0; y < N; y++) { let r = -1; for (let x = 0; x <= N; x++) { const on = x < N && ink(y * N + x); if (on && r < 0) r = x; if (!on && r >= 0) { runs.push(`M${r} ${y}h${x - r}v1h${r - x}z`); r = -1; } } }
  if (!runs.length) return null;
  const per = Math.ceil(runs.length / 14);
  const groups = [];
  for (let i = 0; i < runs.length; i += per) groups.push(runs.slice(i, i + per).join(""));
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${N} ${N}">${groups.map((g) => `<path d="${g}" fill="#000"/>`).join("")}</svg>`;
}, png);

await page.route("**/api/studio/image", async (route) => {
  const sent = JSON.parse(route.request().postData() ?? "{}");
  const svg = sent.picture ? await traceLocally(sent.picture) : null;
  if (!svg) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "empty-body", message: "nothing to trace" }) });
  return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kind: "vectorize", cost: 0.08, model: "recraft-ai/recraft-vectorize (stood in)", stripped: [], html: svg }) });
});
await page.route("**/api/studio/reshape", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "no-key", message: "no" }) }));
await page.route("**/api/studio/body", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "no" }) }));

await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 })); });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);

await page.keyboard.press("Control+k"); await page.waitForTimeout(340);
await page.keyboard.type("drop a new idea"); await page.waitForTimeout(420);
await page.keyboard.press("Enter"); await page.waitForTimeout(900);
{
  const part = page.locator("[data-node-id]").last();
  const pb = await part.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(700);
  await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
  await page.waitForTimeout(1300);
  const bb = await page.locator("[data-draw-board]").boundingBox();
  for (const s of BIRD) {
    await page.mouse.move(bb.x + s[0][0] * bb.width, bb.y + s[0][1] * bb.height);
    await page.mouse.down();
    for (const [x, y] of s) { await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height); await page.waitForTimeout(5); }
    await page.mouse.up(); await page.waitForTimeout(200);
  }
  await page.locator("[data-draw-words]").fill("a bird");
  await page.keyboard.press("Enter");
}
const read = () => page.evaluate(() => (JSON.parse(localStorage.getItem("builder.studio") || "{}").state?.nodes ?? []).map((n) => ({ id: n.id, f: n.featureId, role: n.role, paths: n.vector?.paths?.length ?? 0, vb: n.vector?.viewBox ?? null, hasVector: !!n.vector })));
let node = null;
for (let i = 0; i < 40; i++) { await page.waitForTimeout(700); node = (await read())[0]; if (node?.hasVector) break; }
check("the drawing comes back as vector, not only as a picture", !!node?.hasVector, `${node?.paths} paths in ${node?.vb}`);
check("and it is his box, not a made-up one", /^0 0 \d+ \d+$/.test(node?.vb ?? ""), node?.vb ?? "-");
check("nothing chose a role for him", node?.role === null, String(node?.role));

await page.locator(`[data-node-id="${node.id}"]`).click({ force: true });
await page.waitForTimeout(700);
/* Picking a part no longer brings Element to the front: the five side tabs
   are permanent and only a press moves them, so a panel being worked in
   cannot be taken away mid-adjustment. Element is one press away. */
const openElement = async () => {
  const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Element" }).first();
  if (await tab.count()) await tab.click().catch(() => {});
  await page.waitForTimeout(250);
};
await openElement();
await page.locator("[data-role-picker]").scrollIntoViewIfNeeded().catch(() => {});
await page.waitForTimeout(400);
check("the panel offers all three", (await page.locator("[data-role-picker] [data-role]").count()) === 3);
check("with none of them pressed", (await page.locator('[data-role-picker] [aria-pressed="true"]').count()) === 0);
check("and says nothing will be chosen for you", /nothing will be chosen for you/i.test(await page.locator("[data-role-picker]").locator("xpath=ancestor::*[1]").innerText()));

await page.locator('[data-role-picker] [data-role="icon"]').click({ force: true });
await page.waitForTimeout(1000);
{
  const now = (await read())[0];
  check("picking icon makes it the icon part", now?.f === "drawn-icon" && now?.role === "icon", `${now?.f} / ${now?.role}`);
  const icon = page.locator("[data-icon]").first();
  check("and the drawing is what is drawn", (await icon.count()) === 1);
  check("cut to a few paths, with none of it thrown away", Number(await icon.getAttribute("data-icon-paths")) <= ICON_PATHS, await icon.getAttribute("data-icon-paths"));
  check("no colour is baked into it", !/#[0-9a-f]{3,6}/i.test(await icon.innerHTML()), (await icon.innerHTML()).slice(0, 50));
}
/* Small, and still there. */
await page.evaluate((nid) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  raw.state.nodes = raw.state.nodes.map((n) => (n.id === nid ? { ...n, w: 24, h: 24 } : n));
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, node.id);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  const b = await page.locator("[data-icon]").first().boundingBox();
  check("at 24 across it is still drawn", !!b && b.width > 8 && b.width < 30, b && `${Math.round(b.width)}px`);
}

/* Onto a button. */
await page.evaluate((nid) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  raw.state.nodes = raw.state.nodes.map((n) => (n.id === nid ? { ...n, w: 72, h: 72, x: 200, y: 180 } : n));
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, node.id);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1400);
await page.locator('input[placeholder*="Search parts"]').first().fill("main button");
await page.waitForTimeout(900);
await page.getByText("Main button", { exact: true }).first().click({ force: true });
await page.waitForTimeout(500);
await page.locator("[data-part-detail] [data-add-to-page]").first().click({ force: true }); /* A press on a card opens its detail card; Add to page is what places it (ShelfCards.tsx). */
await page.waitForTimeout(1500);
const buttonId = (await read()).find((n) => n.f === "cta-primary")?.id;
check("there is a button to drop it on", !!buttonId);
await page.evaluate(({ bid }) => {
  const raw = JSON.parse(localStorage.getItem("builder.studio"));
  raw.state.nodes = raw.state.nodes.map((n) => (n.id === bid ? { ...n, x: 560, y: 180, w: 320, h: 72 } : n));
  localStorage.setItem("builder.studio", JSON.stringify(raw));
}, { bid: buttonId });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
{
  const a = await page.locator(`[data-node-id="${node.id}"]`).boundingBox();
  const t = await page.locator(`[data-node-id="${buttonId}"]`).boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  for (let i = 1; i <= 18; i++) {
    await page.mouse.move(a.x + a.width / 2 + ((t.x + t.width / 2) - (a.x + a.width / 2)) * (i / 18), a.y + a.height / 2 + ((t.y + t.height / 2) - (a.y + a.height / 2)) * (i / 18));
    await page.waitForTimeout(16);
  }
  await page.mouse.up();
  await page.waitForTimeout(1400);
  const after = await read();
  check("dropping it on the button leaves one part, not two", after.length === 1 && after[0].f === "cta-primary", after.map((n) => n.f).join(" "));
  check("and the button wears the drawing", after[0]?.hasVector === true);
  check("which is drawn on it", (await page.locator("[data-button-icon]").count()) === 1);
  check("in the button's own colour, not the drawing's", !/#[0-9a-f]{3,6}/i.test(await page.locator("[data-button-icon]").first().innerHTML()));
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
