#!/usr/bin/env node
/**
 * MODEL SHEET (ALL SIDES), ON THE DRAWING TOOL.
 *
 * J (2026-10-12), with a ring drawn from ten sides: "make a format check
 * mark that automatically generates these faces ... so it generates the most
 * useful image it can when i need it like this for a model image".
 *
 *   · the box sits next to "Make it a cursor", with its tip, and the two
 *     (and a sphere, cube or pyramid) never stay ticked together;
 *   · ticked, the ask carries the sheet's layout (nine named views, the
 *     bottom never the top again, which way the front points left and
 *     right), asked square;
 *   · with "A real 3D model", the sheet is cut into its views and its own
 *     front, back, left and right go to the 3D step: nothing is drawn twice.
 *
 * The renderer is answered here: nothing reaches Replicate, nothing is spent.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/model-sheet.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/pictures/modelSheet.ts, src/features/studio/RenderPanel.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openGenerate } from "./fixtures/openGenerate.mjs";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

const GLB = "data:model/gltf-binary;base64,Z2xURgIAAAA=";
/* Nine cells in the sheet's order; front, back, left and right are told apart by colour. */
const COLOURS = ["#d01010", "#1030d0", "#808080", "#10a010", "#e08000", "#808080", "#808080", "#808080", "#808080"];
let SHEET = "";
const sent = [];
await page.route("**/api/keys/status", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ set: { REPLICATE_API_TOKEN: true }, repo: null, branch: "main" }) }));
await page.route("**/api/studio/**", async (route) => {
  const what = route.request().url().split("/").pop().split("?")[0];
  if (what === "image") {
    const body = JSON.parse(route.request().postData() ?? "{}");
    sent.push(body);
    await new Promise((r) => setTimeout(r, 300));
    if (Number(body.stage) === 2) return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, stage: 2, solid: true, model: "tencent/hunyuan3d-2mv", name: "Hunyuan3D 2 (multi-view)", mesh: { glb: GLB, bytes: 8, from: "tencent/hunyuan3d-2mv" }, cost: 0.2 }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, kind: "raster", image: SHEET, cost: 0.04 }) });
  }
  return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
});

await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => { localStorage.removeItem("builder.studio"); localStorage.setItem("builder.shelf.folded", "0"); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/* A sheet as a model draws one: grey ground, a dark label over each view. */
SHEET = await page.evaluate((colours) => {
  const c = document.createElement("canvas");
  c.width = 900; c.height = 900;
  const g = c.getContext("2d");
  g.fillStyle = "#eeeeee"; g.fillRect(0, 0, 900, 900);
  colours.forEach((col, n) => {
    const x = (n % 3) * 300, y = Math.floor(n / 3) * 300;
    g.fillStyle = "#111111"; g.fillRect(x + 110, y + 20, 80, 18);
    g.fillStyle = col; g.fillRect(x + 80, y + 80, 140, 180);
  });
  return c.toDataURL("image/png");
}, COLOURS);

const panel = await openGenerate(page);
const sheetBox = panel.locator("[data-render-sheet]");
const cursorBox = panel.locator("[data-render-cursor]");
check("the drawing tool has Model sheet (all sides)", (await sheetBox.count()) === 1 && /Model sheet \(all sides\)/.test(await panel.locator("[data-render-row='sheet']").innerText()));
check("…with a one-line tip", /9 named sides/.test(await panel.locator("[data-render-row='sheet']").innerText()));
const rows = await panel.locator("[data-render-row]").evaluateAll((els) => els.map((e) => e.getAttribute("data-render-row")));
check("…right after Make it a cursor", rows.indexOf("sheet") === rows.indexOf("cursor") + 1, rows.join(", "));

await cursorBox.check({ force: true });
await sheetBox.check({ force: true });
check("ticking it unticks the cursor", (await sheetBox.isChecked()) && !(await cursorBox.isChecked()));
await cursorBox.check({ force: true });
check("and the cursor unticks it", !(await sheetBox.isChecked()));
await cursorBox.uncheck({ force: true });
await sheetBox.check({ force: true });

/* 1. The sheet on its own. */
await panel.locator("textarea").first().fill("an emerald signet ring");
check("the button says what it makes", /Generate sheet/.test(await panel.locator("[data-render-go]").innerText()));
let before = sent.length;
await panel.locator("[data-render-go]").click({ force: true });
for (let i = 0; i < 30 && sent.length === before; i++) await page.waitForTimeout(100);
await page.waitForTimeout(800);
const ask = sent[before] ?? {};
check("his words come first", (ask.prompt ?? "").startsWith("an emerald signet ring\n\n"));
check("the ask lays out nine named views in a fixed grid", /3 by 3 grid/.test(ask.prompt ?? "") && ["1 FRONT", "2 BACK", "3 TOP", "4 LEFT", "5 RIGHT", "6 BOTTOM", "7 FRONT LEFT", "8 FRONT RIGHT", "9 BACK RIGHT"].every((v) => ask.prompt.includes(v)));
check("…says the bottom is never the top again", /never the top again/.test(ask.prompt ?? ""));
check("…and which way the front points on each side", /front points to the right edge/.test(ask.prompt ?? "") && /front points to the left edge/.test(ask.prompt ?? ""));
check("…the same object, even light, plain ground, nothing else", /identical object/.test(ask.prompt) && /shadowless/.test(ask.prompt) && /NOTHING ELSE/.test(ask.prompt));
check("it is asked square, at full size", ask.w === 1024 && ask.h === 1024, `${ask.w}x${ask.h} ratio ${ask.ratio}`);
check("no 3D call without 3D", !sent.slice(before).some((b) => Number(b.stage) === 2));

/* 2. Sheet + a real 3D model: the sheet's own views go to the 3D step. */
await panel.locator("[data-render-3d] button, [data-render-3d] [role=combobox]").first().click({ force: true });
await page.waitForTimeout(250);
await page.getByRole("option", { name: "A real 3D model", exact: true }).first().click({ force: true });
await page.waitForTimeout(250);
check("a real 3D model keeps the sheet ticked", await sheetBox.isChecked());
before = sent.length;
await panel.locator("[data-render-go]").click({ force: true });
let solidCall;
for (let i = 0; i < 60 && !solidCall; i++) { await page.waitForTimeout(150); solidCall = sent.slice(before).find((b) => Number(b.stage) === 2); }
await page.waitForTimeout(800);
const drawCalls = sent.slice(before).filter((b) => Number(b.stage) !== 2);
check("only the sheet is drawn: no back or sides drawn again", drawCalls.length === 1 && /3 by 3 grid/.test(drawCalls[0]?.prompt ?? ""), `${drawCalls.length} draw calls`);
check("the sheet's back, left and right go to the 3D step", (solidCall?.views ?? []).length === 3, `${(solidCall?.views ?? []).length} views`);
const colourOf = (src) => page.evaluate(async (s) => {
  const img = new Image(); img.src = s.startsWith("data:") ? s : `data:image/png;base64,${s}`; await img.decode();
  const c = document.createElement("canvas"); c.width = img.width; c.height = img.height;
  const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const p = (x, y) => [...g.getImageData(x, y, 1, 1).data.slice(0, 3)];
  return { mid: p(img.width >> 1, img.height >> 1), corner: p(2, 2), top: p(img.width >> 1, Math.round(img.height * 0.03)) };
}, src);
const near = (a, hex) => { const b = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return a.every((v, i) => Math.abs(v - b[i]) < 40); };
const f = solidCall?.first ? await colourOf(solidCall.first) : null;
check("the front is the FRONT cell, cut out on white, its label left behind", !!f && near(f.mid, COLOURS[0]) && near(f.corner, "#ffffff") && !near(f.top, "#111111"), JSON.stringify(f));
const vs = await Promise.all((solidCall?.views ?? []).map(colourOf));
check("the others are BACK, LEFT and RIGHT, in that order", vs.length === 3 && near(vs[0].mid, COLOURS[1]) && near(vs[1].mid, COLOURS[3]) && near(vs[2].mid, COLOURS[4]), JSON.stringify(vs.map((v) => v.mid)));
for (let i = 0; i < 30 && !(await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.some((n) => n.featureId === "mesh-3d"))); i++) await page.waitForTimeout(150);
check("and a Solid lands on the board", await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.nodes.some((n) => n.featureId === "mesh-3d")));

/* 3. A sphere is not a sheet. */
await page.locator("[data-render-3d] button, [data-render-3d] [role=combobox]").first().click({ force: true });
await page.waitForTimeout(250);
await page.getByRole("option", { name: "On a sphere", exact: true }).first().click({ force: true });
await page.waitForTimeout(250);
check("picking On a sphere unticks the sheet", !(await sheetBox.isChecked()));

check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
