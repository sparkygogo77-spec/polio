#!/usr/bin/env node
/**
 * COLOURS' RESET PUTS BACK EVERYTHING THE PREVIEW'S EDITORS CHANGED.
 *
 * polio/next-issues.md item 6 (J, 2026-10-10: "next"): Reset put the colours
 * back but left a kind's Corners, the glow taken off the page's words, and a
 * texture given to the page. On the saved PST board:
 *
 *   1. take the page's glow off, give the page Stripes, turn a panel kind's corners;
 *   2. Reset puts every part's look (corners, glow, font, texture, colours)
 *      and the texture stack back as the bring-in left them;
 *   3. Reset is one undo step.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/colours-reset-all.mjs http://127.0.0.1:3013
 *
 * Covers: src/features/studio/previewWas.ts, src/features/studio/SiteColours.tsx, src/features/studio/PieceTexture.tsx
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";
import { openBoard } from "./lib/board.mjs";

const URL_BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const canon = (v) => JSON.stringify(v, (_, x) => (x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().filter((k) => x[k] !== undefined && x[k] !== null).map((k) => [k, x[k]])) : x));
const KEYS = ["colour", "content", "edge", "art", "aura", "radius", "radii", "radiiY", "font", "texture"];
const lookOf = (n) => canon(Object.fromEntries(KEYS.map((k) => [k, n[k] ?? null])));

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const ui = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
ui.on("pageerror", (e) => errors.push(e.message));
await ui.route("https://api.github.com/**", (r) => r.abort());
await openBoard(ui, URL_BASE, "pst");
await ui.evaluate(() => window.__studioSetLeftPanel?.("look"));
await ui.waitForSelector("[data-theme-preview]", { timeout: 30000 });
await ui.waitForTimeout(1000);
const state = () => ui.evaluate(() => window.__studioPublishDoc());
const s0 = await state();
const before = new Map(s0.nodes.map((n) => [n.id, lookOf(n)]));

/* 1. The page: no glow, Stripes. */
await ui.locator('[data-theme-preview] [data-preview-part="heading"]').first().evaluate((e) => e.click());
await ui.waitForSelector('[data-kind-editor="The page"]');
await ui.locator('[data-kind-editor="The page"] [data-kind-glow-off]').first().evaluate((b) => b.click());
await ui.waitForTimeout(400);
await ui.locator('[data-kind-editor="The page"] [data-texture-sample="stripes"]').first().evaluate((b) => b.click());
await ui.waitForTimeout(600);
/* A panel kind: its corners, by keys (one undo step a press). */
const kinds = await ui.locator("[data-theme-preview] [data-preview-kind]").evaluateAll((els) => els.map((e) => e.getAttribute("data-preview-kind")));
let turned = null;
for (let i = 0; i < kinds.length && !turned; i++) {
  await ui.locator("[data-theme-preview] [data-preview-kind]").nth(i).evaluate((e) => e.click());
  await ui.waitForTimeout(400);
  const slider = ui.locator("[data-kind-editor] [data-kind-corners] [role=slider]").first();
  if (!(await slider.count())) continue;
  /* Toward the end with room: a kind already at its cap or square would not move. */
  const now = Number(await slider.getAttribute("aria-valuenow")), max = Number(await slider.getAttribute("aria-valuemax"));
  if (max < 2) continue;
  await slider.focus();
  for (let k = 0; k < 4; k++) await ui.keyboard.press(now >= max / 2 ? "ArrowLeft" : "ArrowRight");
  await ui.waitForTimeout(400);
  if (Number(await slider.getAttribute("aria-valuenow")) !== now) turned = kinds[i];
}
const s1 = await state();
const changed = s1.nodes.filter((n) => before.get(n.id) !== lookOf(n));
const cornered = changed.filter((n) => n.radius !== s0.nodes.find((x) => x.id === n.id)?.radius).length;
check("1. the editors changed parts: glow, texture, corners", changed.length > 5 && cornered > 0 && canon(s1.look.texture) !== canon(s0.look.texture), `${changed.length} parts, ${cornered} with new corners (${turned}), ${s1.look.texture?.length ?? 0} texture layers`);

/* 2. */
const depth = await ui.evaluate(() => window.__studioUndoDepth());
await ui.locator("[data-colours-reset]").first().evaluate((b) => b.click());
await ui.waitForTimeout(800);
const s2 = await state();
const off = s2.nodes.filter((n) => before.get(n.id) !== lookOf(n));
check("2. Reset puts every part's look back: corners, glow, texture, colours", off.length === 0, `${off.length} still off${off[0] ? `, e.g. ${off[0].id}: ${lookOf(off[0]).slice(0, 200)} was ${before.get(off[0].id)?.slice(0, 200)}` : ""}`);
check("…and the texture stack as it was", canon(s2.look.texture ?? []) === canon(s0.look.texture ?? []), `${s2.look.texture?.length ?? 0} layers, was ${s0.look.texture?.length ?? 0}`);

/* 3. */
check("3. Reset is one undo step", (await ui.evaluate(() => window.__studioUndoDepth())) === depth + 1);
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((x) => !x).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
