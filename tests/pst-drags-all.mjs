#!/usr/bin/env node
/**
 * EVERY PONSSTARS PART THE HAND CAN REACH MOVES.
 *
 * J (2026-10-08): "some items especially on Pst are totally undraggable, it
 * would not move." PST's web/ (tests/fixtures/pst-tv) is brought in through
 * the GitHub control against a stand-in GitHub, at 1440. Then, on every page,
 * each part with some of itself on top under the hand is pressed there and
 * dragged; what was pressed must move, and Undo puts it back. A part wholly
 * covered by others is reached by two presses (`board/press.ts`, go-in), so
 * it is counted, not dragged.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/pst-drags-all.mjs http://127.0.0.1:3013
 *
 * Runs alone: drags every part on every page, one after another
 * Covers: src/features/studio/board/press.ts, src/features/studio/board/pressRead.ts, src/features/studio/canvas/DesktopCanvas.tsx, src/features/studio/stateFrames.ts
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const ROOT = process.env.PST_ROOT ?? "tests/fixtures/pst-tv";
const FILES = {};
const walk = (d, rel = "") => { for (const n of readdirSync(d)) { const p = join(d, n); const r = rel ? `${rel}/${n}` : n; if (statSync(p).isDirectory()) walk(p, r); else if (n !== "FROM.md") FILES[r] = readFileSync(p); } };
walk(ROOT);
const names = Object.keys(FILES);
const tree = names.map((f, i) => ({ path: f, type: "blob", sha: `f${i}`, size: FILES[f].length }));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
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
const board = () => ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state);
let st = await board();
for (let i = 0; i < 150 && !st.nodes.length; i++) { await ui.waitForTimeout(1000); st = await board(); }
await ui.waitForTimeout(2500);
st = await board();
check("PST came in", st.nodes.length > 20, `${st.nodes.length} parts on ${st.pages?.length} pages`);

/* Each part drawn on the board, and a point on it where it is on top under the hand, read fresh before each press (a drag or Undo can scroll the pane). */
const drawnIds = () => ui.evaluate(() => [...new Set([...document.querySelectorAll("[data-node-id]")].map((e) => e.dataset.nodeId))]);
const spotOn = (id) => ui.evaluate((id) => {
  const pane = document.querySelector("[data-studio-pane]")?.getBoundingClientRect();
  const el = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2 || getComputedStyle(el).visibility === "hidden" || !el.checkVisibility?.({ opacityProperty: false, visibilityProperty: true })) return null;
  if (pane && (r.bottom < pane.top + 4 || r.top > pane.bottom - 4 || r.right < pane.left + 4 || r.left > pane.right - 4)) return "away";
  for (let i = 1; i < 6; i++) for (let j = 1; j < 6; j++) {
    const x = r.left + (r.width * i) / 6, y = r.top + (r.height * j) / 6;
    if (pane && (x < pane.left || x > pane.right || y < pane.top || y > pane.bottom)) continue;
    const under = document.elementFromPoint(x, y);
    if (under?.closest?.("[data-node-id]")?.dataset.nodeId === id && !under.closest("[data-resize],[data-group-resize]")) return { x, y };
  }
  return "covered";
}, id);
const boxOf = (id) => ui.evaluate((id) => { const r = document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.getBoundingClientRect(); return r ? { x: r.left, y: r.top } : null; }, id);

const stuck = [];
let dragged = 0, coveredAll = 0, away = 0;
const pages = (st.pages ?? [{ id: st.activePageId }]).map((p) => p.id);
for (const pageId of pages) {
  /* Opened on that page, as a reload after switching leaves it. */
  await ui.evaluate((pageId) => { const k = "builder.studio", v = JSON.parse(localStorage.getItem(k)); v.state.activePageId = pageId; localStorage.setItem(k, JSON.stringify(v)); }, pageId);
  await ui.reload({ waitUntil: "networkidle" });
  await ui.waitForTimeout(1500);
  const shown = await ui.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.activePageId);
  const ids = await drawnIds();
  console.log(`  ..   ${pageId}: open on ${shown}, ${ids.length} parts drawn`);
  for (const id of ids) {
    await ui.keyboard.press("Escape");
    let at = await spotOn(id);
    /* Below the fold: scrolled to, as the hand would. */
    if (at === "away") { await ui.evaluate((id) => document.querySelector(`[data-node-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: "center", inline: "center" }), id); await ui.waitForTimeout(120); at = await spotOn(id); }
    if (at === "away") { away++; continue; }
    if (!at) continue;
    if (at === "covered") { coveredAll++; continue; }
    const p = { id, ...at };
    const before = await boxOf(p.id);
    await ui.mouse.move(p.x, p.y);
    await ui.mouse.down();
    await ui.mouse.move(p.x + 12, p.y + 8, { steps: 3 });
    await ui.mouse.move(p.x + 30, p.y + 20, { steps: 3 });
    await ui.mouse.up();
    await ui.waitForTimeout(60);
    const after = await boxOf(p.id);
    const moved = before && after && Math.hypot(after.x - before.x, after.y - before.y) >= 1;
    if (moved) dragged++; else stuck.push(`${pageId}:${p.id}`);
    if (moved) { await ui.keyboard.press(process.platform === "darwin" ? "Meta+z" : "Control+z"); await ui.waitForTimeout(60); }
    /* Two quick presses on the same part are a double press: wait it out. */
    await ui.waitForTimeout(260);
  }
}
check("every part the hand can reach moves when dragged", stuck.length === 0 && dragged > 20, `${dragged} moved, ${stuck.length} stuck${stuck.length ? `: ${stuck.slice(0, 12).join(", ")}` : ""}; ${coveredAll} wholly covered (reached by two presses); ${away} out of reach of the pane`);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
