#!/usr/bin/env node
/**
 * UNDO SAYS WHAT IT WILL TAKE BACK, AND THE STEPS ARE A LIST YOU CAN GO BACK TO.
 *
 * Lane H, item 1. The undo key said "Undo" and nothing else, and there was
 * no history list. Now:
 *   1. Dragging a part on the board and hovering Undo reads "Undo: move
 *      COPY CA"; after undoing, Redo reads "Redo: move COPY CA".
 *   2. Every kind of edit records a readable name: each store action below
 *      is run and the next undo is read. None may be the fallback "an edit",
 *      and each names what it did.
 *   3. The history list shows the steps newest first (at most fifty), the
 *      step the board is at marked "now"; pressing an older step puts the
 *      board back as it was right after that step in one go, and the steps
 *      after it are listed as undone and can be pressed to come forward.
 *
 * Screenshots: .screenshots/lane-h/undo-tooltip.png, undo-history-list.png.
 *
 *   npx next start -p 3013
 *   node tests/undo-history.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SHOTS = ".screenshots/lane-h";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/api\.(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const node = (id, content, x, y) => ({ id, pageId: "page_home", featureId: "prose", label: "", prompt: "", content, data: "", x, y, w: 260, h: 60, groupId: null, options: {}, priority: "must", custom: false });
await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(({ doc, builds }) => { localStorage.clear(); localStorage.setItem("builder.builds", builds); localStorage.setItem("builder.studio", doc); }, {
  builds: env({ projects: [{ id: "s1", name: "History", updatedAt: Date.now() }], activeId: "s1" }),
  doc: env({ pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes: [node("n_copy", "COPY CA", 160, 160), node("n_two", "Second words", 160, 420)] }),
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
await page.waitForTimeout(800);

const H = (fn, ...args) => page.evaluate(({ fn, args }) => window.__studioHistory[fn](...args), { fn, args });
const tipOf = (which) => page.locator(`[data-history-${which}]`).getAttribute("data-history-tip");

/* ------------------------------------------------ 1. a real drag, and its name */
{
  const box = await page.locator('[data-node-id="n_copy"]').first().boundingBox();
  check("the part is on the board", !!box, J(box));
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(box.x + box.width / 2 + i * 12, box.y + box.height / 2 + i * 6);
    await page.mouse.up();
    await page.waitForTimeout(400);
  }
  const undoBtn = page.locator("[data-history-undo]");
  await page.mouse.move(10, 10);
  await undoBtn.hover();
  await page.waitForTimeout(900);
  const tip = await tipOf("undo");
  check("Undo's tooltip names the drag: \"Undo: move COPY CA\"", tip === "Undo: move COPY CA", J(tip));
  const shown = await page.locator('[role="tooltip"]').first().innerText().catch(() => "");
  check("the tooltip on screen says it too", /Undo: move COPY CA/.test(shown), J(shown));
  await page.screenshot({ path: `${SHOTS}/undo-tooltip.png`, clip: { x: 0, y: 0, width: 1440, height: 160 } });
  await undoBtn.click();
  await page.waitForTimeout(300);
  await page.locator("[data-history-redo]").hover();
  await page.waitForTimeout(700);
  const redo = await tipOf("redo");
  check("after undoing it, Redo names the same step", redo === "Redo: move COPY CA", J(redo));
  await page.locator("[data-history-redo]").click();
  await page.waitForTimeout(300);
}

/* ------------------------------------------------ 2. every kind of edit has a name */
const kinds = [
  ["edit the words", ["updateNode", "n_copy", { content: "COPY CA NOW" }], /^edit the words of COPY CA NOW$/],
  ["write a prompt", ["updateNode", "n_two", { prompt: "make it louder" }], /^edit the prompt of Second words$/],
  ["resize", ["updateNode", "n_two", { w: 300, h: 80 }], /^resize Second words$/],
  ["recolour", ["updateNode", "n_two", { hue: 40 }], /^recolour Second words$/],
  ["font", ["updateNode", "n_two", { font: { family: "Georgia", size: 22 } }], /^change the font of Second words$/],
  ["lock", ["updateNode", "n_two", { locked: true }], /^lock Second words$/],
  ["options", ["updateNode", "n_two", { options: { measure: "58ch" } }], /^change the options of Second words$/],
  /* A part added from the shelf wears its catalogue name as its label until someone renames it. */
  ["add a part", ["addNode", "prose", 400, 700, { content: "Fresh part" }], /^add (Fresh part|Text block)$/],
  ["duplicate", ["duplicateNodes", ["n_two"]], /^add Second words$/],
  ["delete a part", ["removeNodes", ["n_two"]], /^delete Second words$/],
  ["add a page", ["addPage", "About"], /^add the page “About”$/],
  ["rename a page", ["updatePage", "page_home", { name: "Start" }], /^rename the page “Home” to “Start”$/],
  ["format", ["setFormat", "pages.nav", "sidebar"], /^change Format: Navigation style$/],
  ["look", ["setLook", { veil: 0.3 }], /^change the veil$/],
  ["brief", ["setBrief", { name: "New name" }], /^rename the site$/],
  ["shape", ["addShape", { pageId: "page_home", kind: "arrow", points: [[0, 0], [100, 100]], hue: 200, width: 2, label: "", prompt: "" }], /^draw a wire$/],
  ["motion", ["addMotion"], /^add the animation/],
];
for (const [what, [action, ...args], want] of kinds) {
  try { await H("act", action, ...args); } catch (e) { check(`${what}: ran ${action}`, false, String(e).slice(0, 160)); continue; }
  await page.waitForTimeout(80);
  const name = await H("undo");
  check(`${what}: the next undo is named`, typeof name === "string" && name !== "an edit" && want.test(name), J(name));
}

/* ------------------------------------------------ 3. the list, and going back to a step */
{
  const rows = await H("rows");
  check("the list is newest first, with the board's own step marked now", rows[0]?.kind === "now" && rows[0].name === (await H("undo")), J(rows.slice(0, 3)));
  check("the list holds at most fifty steps, plus where it begins", rows.length <= 51, `${rows.length} rows`);
  check("no step in the list is unnamed", rows.every((r) => r.name && r.name !== "an edit"), J(rows.filter((r) => !r.name || r.name === "an edit")));
  await page.locator("[data-history-open]").click();
  await page.waitForTimeout(500);
  const listed = await page.locator("[data-history-step]").allInnerTexts();
  check("the list opens under the key", listed.length === rows.length, `${listed.length} on screen, ${rows.length} steps`);
  await page.screenshot({ path: `${SHOTS}/undo-history-list.png`, clip: { x: 640, y: 0, width: 800, height: 700 } });
  /* Go back to "edit the words of COPY CA NOW": the board right after that step. */
  const target = page.locator("[data-history-step]", { hasText: "Edit the words of COPY CA NOW" }).first();
  const steps = Number(await target.getAttribute("data-history-steps"));
  await target.click();
  await page.waitForTimeout(500);
  const after = await page.evaluate(() => {
    const raw = JSON.parse(localStorage.getItem("builder.studio")).state;
    return { words: raw.nodes.find((n) => n.id === "n_copy")?.content, two: raw.nodes.find((n) => n.id === "n_two")?.prompt ?? null, pages: raw.pages.length };
  });
  check("pressing a step puts the board as it was right after it", after.words === "COPY CA NOW" && after.two === "" && after.pages === 1, J(after));
  check("every step after it went onto redo, in one change", (await H("rows")).filter((r) => r.kind === "redo").length === -steps, `${-steps} steps`);
  check("Undo now names that step", (await H("undo")) === "edit the words of COPY CA NOW", J(await H("undo")));
  await page.locator("[data-history-open]").click();
  await page.waitForTimeout(400);
  const forward = page.locator('[data-history-step="redo"]').first();
  const fwdSteps = Number(await forward.getAttribute("data-history-steps"));
  await forward.click();
  await page.waitForTimeout(400);
  check("pressing an undone step comes forward to it", (await H("rows")).filter((r) => r.kind === "redo").length === 0 && fwdSteps === -steps, `${fwdSteps}`);
}

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
