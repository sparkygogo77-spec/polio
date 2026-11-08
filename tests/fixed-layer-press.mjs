/**
 * A CLICK-THROUGH LAYER PINNED TO THE WINDOW GIVES WAY TO ANYTHING UNDER THE HAND.
 *
 * MEASURED on sol face (the import checkup, 2026-11-01, EDIT-ISSUES #60).
 * Its pointer glow is a 450px `position: fixed` box the page made
 * `pointer-events: none` and moves with the pointer. On the board it rides
 * with the view, so it lies over a different stretch of the page at every
 * scroll; a press through it reached only a part SMALLER than it
 * (`pressRead.ts#underInert`, the rule for trumpmorty's planet), so a press
 * on a 660px hero tile or the 1440px marquee picture under the glow picked
 * the glow: 16 content parts no press could reach, and a model driving the
 * Builder picked "div · 0 inside" where it meant the tile.
 *
 * On the page nothing is ever under such a layer: a click there reaches
 * whatever is drawn below, whatever its size. So does a press on the board,
 * for a pinned click-through layer; a click-through part in the page's flow
 * keeps the size rule (`tests/inert-picture-press.mjs`, `tests/press-through-inert.mjs`).
 *
 * Held here, on a section with a 450px pinned click-through box over a 660px
 * tile and a 1440px band, and an absolutely placed click-through box of the
 * same size over another tile:
 *   · the browser hits the pinned box at the tile's centre (the case is real);
 *   · one press there picks the tile, not the box;
 *   · one press on the band under the pinned box picks the band;
 *   · a drag there moves the tile, not the box;
 *   · one press on the absolutely placed box over its tile still picks that box (the flow rule holds);
 * and, given sol face's capture, a press on its hero tile and its marquee picture under the glow picks them.
 *
 *   npx next start -p 3013
 *   node tests/fixed-layer-press.mjs http://127.0.0.1:3013
 *   node tests/fixed-layer-press.mjs http://127.0.0.1:3013 <folder with site/document.json of sol face>
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright-core";
import { SWEEP } from "../src/features/studio/reassemble.ts";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const SINK = process.argv[3] ?? null;
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const node = (id, f, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  from: { url: "https://x.test/", host: "x.test", selector: `body > main > ${id}`, at: 1 },
  ...extra,
});
const seed = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("hero", "box", 0, 0, 1440, 1600, { colour: { bg: "#182030" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section", at: 1 } }),
    node("tile", "box", 60, 120, 660, 660, { colour: { bg: "#2a6040" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(1)", at: 1 } }),
    /* The band stands just under the tile, so that scrolled to its middle the ridden glow lies over it (the glow rides down by the view's top, up to the page's foot). */
    node("band", "picture", 0, 820, 1440, 165, { colour: { bg: "#604020" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(2)", at: 1 } }),
    node("tile2", "box", 760, 120, 660, 660, { colour: { bg: "#40306a" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(3)", at: 1 } }),
    /* The pointer glow: pinned to the window, click-through, 450 square, over the tile's middle. */
    node("glow", "box", 165, 225, 450, 450, { inert: true, colour: { bg: "#60a060" }, from: { url: "https://x.test/", host: "x.test", selector: "body > div:nth-of-type(3)", at: 1, id: "cursorGlow", position: "fixed" } }),
    /* The same box placed absolutely over the second tile: in the page's flow, it keeps its rule. */
    node("planet", "box", 865, 225, 450, 450, { inert: true, colour: { bg: "#a06060" }, from: { url: "https://x.test/", host: "x.test", selector: "body > main > section > div:nth-of-type(4)", at: 1, position: "absolute" } }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "PINNED", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [], swept: SWEEP,
}, version: 0 });

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, seed);
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
const doc = () => page.evaluate(() => window.__studioHistory?.doc() ?? { nodes: [] });
const selection = () => page.evaluate(() => window.__studioSelection?.() ?? []);
const clear = async () => { await page.evaluate(() => window.__studioHistory.act("clearSelection")); await page.waitForTimeout(250); };
const centre = (id) => page.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const hitAt = ([x, y]) => page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null, [x, y]);
/* Scroll the pane so the part's centre sits in the middle of the view, as a person would before pressing it. */
const show = (id) => page.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); const pane = document.querySelector("[data-studio-pane]"); if (!el || !pane) return; const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect(); pane.scrollTop += r.top - p.top + r.height / 2 - p.height / 2; }, id);

await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForSelector('[data-node-id="glow"]', { timeout: 20000 });
await page.waitForTimeout(1500);

/* The tile under the pinned glow. */
let at = await centre("tile");
check("the browser hits the pinned box at the tile's centre (the case is real)", (await hitAt(at)) === "glow", `hit ${await hitAt(at)}`);
await clear();
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("one press there picks the tile, not the pinned box", JSON.stringify(await selection()) === '["tile"]', JSON.stringify(await selection()));
await clear();

/* The band, further down: the glow rides with the view and lies over it once the band is in the middle of the view. */
await show("band"); await page.waitForTimeout(600);
at = await centre("band");
const over = await hitAt(at);
console.log(`  (scrolled to the band the browser hits ${over}: the glow's ride stops at the page's foot, so whether it lies over the band depends on the pane's height)`);
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("one press on the band, under the glow or beside it, picks the band", JSON.stringify(await selection()) === '["band"]', JSON.stringify(await selection()));
await clear();
await page.evaluate(() => { document.querySelector("[data-studio-pane]").scrollTop = 0; }); await page.waitForTimeout(600);

/* A drag through the glow moves the tile. */
at = await centre("tile");
const before = (await doc()).nodes.find((n) => n.id === "tile");
const glowBefore = (await doc()).nodes.find((n) => n.id === "glow");
await page.mouse.move(at[0], at[1]); await page.mouse.down();
for (let i = 1; i <= 8; i++) { await page.mouse.move(at[0] + 10 * i, at[1] + 5 * i); await page.waitForTimeout(16); }
await page.mouse.up(); await page.waitForTimeout(800);
const after = (await doc()).nodes.find((n) => n.id === "tile");
const glowAfter = (await doc()).nodes.find((n) => n.id === "glow");
check("a drag there moves the tile, not the pinned box", after.x > before.x + 20 && after.y > before.y + 10 && glowAfter.x === glowBefore.x && glowAfter.y === glowBefore.y, `tile ${before.x},${before.y} -> ${after.x},${after.y}; box ${glowBefore.x},${glowBefore.y} -> ${glowAfter.x},${glowAfter.y}`);
await page.keyboard.press("Control+z"); await page.waitForTimeout(500);
await clear();

/* The absolutely placed click-through box over the second tile keeps the flow rule: it is picked. */
at = await centre("planet");
check("the browser hits the placed box at its centre", (await hitAt(at)) === "planet", `hit ${await hitAt(at)}`);
await page.mouse.click(at[0], at[1]); await page.waitForTimeout(500);
check("one press on a click-through box in the page's flow, over a bigger tile, still picks the box", JSON.stringify(await selection()) === '["planet"]', JSON.stringify(await selection()));
await clear();

/* Given sol face: its hero tile and marquee picture under the glow. */
if (SINK && existsSync(join(SINK, "site/document.json"))) {
  {
    const { importSink } = await import("./lib/sink.mjs");
    const ctx2 = await browser.newContext({ viewport: { width: 1760, height: 1000 } });
    const p2 = await ctx2.newPage();
    p2.on("pageerror", (e) => errors.push(e.message));
    await importSink(p2, BASE, SINK, { atLeast: 600 });
    const pick = async (id) => {
      await p2.keyboard.press("Escape"); await p2.keyboard.press("Escape");
      await p2.evaluate((id) => { const el = document.querySelector(`[data-node-id="${id}"]`); const pane = document.querySelector("[data-studio-pane]"); const r = el.getBoundingClientRect(), p = pane.getBoundingClientRect(); pane.scrollTop += r.top - p.top + Math.min(r.height, p.height - 160) / 2 - p.height / 2; }, id);
      await p2.waitForTimeout(400);
      const c = await p2.evaluate((id) => { const r = document.querySelector(`[data-node-id="${id}"]`).getBoundingClientRect(); const pane = document.querySelector("[data-studio-pane]").getBoundingClientRect(); return [r.left + r.width / 2, Math.min(Math.max(r.top + r.height / 2, pane.top + 8), pane.bottom - 8)]; }, id);
      const hit = await p2.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? null, c);
      await p2.mouse.click(c[0], c[1]); await p2.waitForTimeout(300);
      return { hit, picked: await p2.evaluate(() => window.__studioSelection?.() ?? []) };
    };
    for (const id of ["n_ctaprimary_166", "n_picture_238", "n_picture_167"]) {
      const r = await pick(id);
      check(`sol face: a press on ${id} picks it or what owns it, never the glow`, r.picked.length === 1 && r.picked[0] !== "n_box_306", `hit ${r.hit}, picked ${JSON.stringify(r.picked)}`);
    }
    await ctx2.close();
  }
}

check("no page errors", errors.length === 0, errors.join(" | ").slice(0, 200));
console.log(`\n${results.filter(Boolean).length}/${results.length} pass`);
await browser.close();
process.exit(results.every(Boolean) ? 0 : 1);
