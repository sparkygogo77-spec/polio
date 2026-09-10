/**
 * The app's own surfaces: nothing off the theme, nothing sliced by a fold.
 *
 * The Builder is two materials and no others — the **void** (a dark
 * purple-blue at hue 288, lit at the rim) for the console's slabs, and the
 * **screen** (teal glass, scanlines, phosphor lettering) for anywhere words
 * are typed or read. `docs/DESIGN.md` §1 is the long version, and
 * `src/core/ui/void.ts` is the one definition of both.
 *
 * Two ways that goes wrong, and both had happened:
 *
 *  · **A surface painted out of another family.** The trail's canvas was
 *    `oklch(0.13 0.012 150)` — the shell's own ground with its hue typed as
 *    green — which nothing else in the app is anywhere near.
 *  · **A copy of the material that drifted.** The key vault kept its own
 *    five-value screen, every number a little away from the shared one.
 *
 * And one of layout: a row of buttons sliced in half by the edge of the
 * panel it is in, which is what the iteration book did to Publish.
 *
 *   node tests/surfaces.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { SCREEN } from "../src/core/ui/void.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. One screen, defined once                                         */
/* ------------------------------------------------------------------ */

{
  const vault = readFileSync(new URL("../src/features/keys/KeysPanel.tsx", import.meta.url), "utf8");
  check(
    "the key vault wears the shared screen rather than its own copy",
    /from "@\/core\/ui\/void"/.test(vault) && !/glass:\s*"radial-gradient/.test(vault),
    /glass:\s*"radial-gradient/.test(vault) ? "still defines its own glass" : "imports it",
  );
}

/* ------------------------------------------------------------------ */
/* 2. On screen                                                        */
/* ------------------------------------------------------------------ */

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "One scroll.", scroll: "inherit" }],
  nodes: [{ id: "n_cta", pageId: "page_home", featureId: "cta-primary", label: "Join", prompt: "Say the thing.", content: "", data: "", x: 560, y: 460, w: 320, h: 64, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null }],
  groups: [], shapes: [], format: {},
  brief: { name: "BLACKORB", gimmick: "Power in the dark.", master: "A community token site." },
  frameWidth: 1440, activePageId: "page_home", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript(({ d }) => {
  localStorage.setItem("builder.studio", d);
  localStorage.setItem("builder.doc:a", d);
  localStorage.setItem("builder.doc:b", d);
  localStorage.setItem("builder.builds", JSON.stringify({ state: { activeId: "a", projects: [
    { id: "a", name: "Polio", updatedAt: Date.now() - 60000, repo: { owner: "sparkygogo77-spec", name: "polio", branch: "main" } },
    { id: "b", name: "Client landing", updatedAt: Date.now() - 3 * 86400000 },
  ] }, version: 0 }));
}, { d: doc });
const page = await context.newPage();

/* The cards on Builds: their options bars are one row, so they line up. */
await page.goto(`${URL_}/builds`, { waitUntil: "networkidle" });
await page.waitForTimeout(1300);
const bars = await page.locator("[data-card-options]").evaluateAll((els) => els.map((e) => {
  const card = e.closest("li").getBoundingClientRect();
  const r = e.getBoundingClientRect();
  return { below: Math.round(card.bottom - r.bottom), bottom: Math.round(r.bottom) };
}));
check("every site card has an options bar", bars.length >= 2, `${bars.length}`);
check(
  "and they line up across a row, whatever each card had to say above them",
  bars.length >= 2 && new Set(bars.map((b) => b.bottom)).size === 1,
  bars.map((b) => b.bottom).join(" vs "),
);

/* The iteration book: nothing sliced by the fold. */
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1100);
await page.evaluate(() => window.__studioOpenBrief?.());
await page.waitForTimeout(1300);
const book = await page.evaluate(() => {
  const dlg = document.querySelector('[role=dialog][aria-labelledby]');
  const d = dlg.getBoundingClientRect();
  const rowOf = (re) => [...dlg.querySelectorAll("*")].find((e) => re.test(e.innerText ?? "") && e.children.length < 8);
  const pub = rowOf(/^Publish/);
  const r = pub?.getBoundingClientRect();
  return {
    dialog: [Math.round(d.top), Math.round(d.bottom)],
    publish: r ? [Math.round(r.top), Math.round(r.bottom)] : null,
    // A row is sliced when it starts inside the panel and ends outside it.
    sliced: r ? r.top < d.bottom && r.bottom > d.bottom : false,
  };
});
check("the book's Publish row is whole, not sliced by the panel's edge", book.publish && !book.sliced, JSON.stringify(book));

/* Every surface of the console is the void or the screen, never a third thing. */
const HUES = { void: 288, screen: 195 };
const strays = await page.evaluate(() => {
  const oklch = (s) => {
    const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s);
    return m ? { l: +m[1], c: +m[2], h: +m[3] } : null;
  };
  const out = [];
  const dlg = document.querySelector('[role=dialog][aria-labelledby]');
  for (const el of dlg.querySelectorAll("*")) {
    // The board's own parts wear the *site's* palette, which is the author's
    // to choose and nothing to do with the app's chrome.
    if (el.closest("[data-node-id], [data-frame], [data-thread-card], [data-piece]")) continue;
    const bg = getComputedStyle(el).backgroundColor;
    const c = oklch(bg);
    if (!c || c.c < 0.008) continue;
    out.push({ h: Math.round(c.h), bg, cls: el.className.toString().slice(0, 40) });
  }
  return out;
});
const off = strays.filter((s) => {
  const near = (h) => Math.min(Math.abs(s.h - h), 360 - Math.abs(s.h - h));
  return near(HUES.void) > 40 && near(HUES.screen) > 40;
});
check(
  "no surface in the book is painted out of a third family",
  off.length === 0,
  off.slice(0, 3).map((o) => `${o.bg} (${o.cls})`).join(" · ") || `${strays.length} measured`,
);

/* And the trail's canvas, which was the green one. */
const t = page.getByRole("radio", { name: /^Trail/ });
if (await t.count()) { await t.click(); await page.waitForTimeout(800); }
const canvas = await page.locator("[data-thread-tree]").evaluate((el) => getComputedStyle(el).backgroundColor);
const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(canvas);
const hue = m ? Number(m[3]) : NaN;
check(
  "the trail's canvas is the void's own ground, not a green one",
  Number.isFinite(hue) && Math.min(Math.abs(hue - 288), 360 - Math.abs(hue - 288)) < 20,
  canvas,
);

/* The screen the vault paints with is the screen everything else paints with. */
await page.evaluate(() => document.querySelector("[data-keys-panel]")?.setAttribute("data-open", "1"));
check("and core still owns the screen's glass", /radial-gradient/.test(SCREEN.glass) && /195/.test(SCREEN.glass), SCREEN.glass.slice(0, 46));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
