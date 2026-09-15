/**
 * What a picked thing is marked in.
 *
 * A selection used to be a bright opaque box in the app's accent, drawn over
 * whatever was being edited — the aura you had just set, most of all. The
 * rule now: a mark is **the far side of what it marks**, drawn thin and
 * inside the thing's own edge, so the aura stays outside it and visible.
 *
 * What is held shut here:
 *   · the mark is a complement of the part's own aura or fill, never the
 *     app's accent, and never a fill;
 *   · it is one thin line, and it is *inside* the part;
 *   · a picked part wears exactly one ring: the dashed hover outline, drawn
 *     in the part's category hue, is not left on underneath it;
 *   · the page's own mark answers the page's backdrop, not the accent;
 *   · a picked chain glows in the far side of its red;
 *   · and pure `complementOf` / `markColour` say so off the board too.
 *
 *   node tests/picked.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { complementOf, markColour } from "../src/features/studio/look.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The colour, on its own                                           */
/* ------------------------------------------------------------------ */

const hueOf = (s) => {
  const m = /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)/.exec(s);
  return m ? { l: +m[1], c: +m[2], h: +m[3] } : null;
};

{
  const blue = "oklch(0.72 0.16 205)";
  const mark = complementOf(blue);
  const m = hueOf(mark);
  check("a mark is the far side of the colour it marks", !!m && Math.abs(((m.h - 205 + 360) % 360) - 180) < 1, mark);
  check("and it is lifted to something that reads on a dark part", !!m && m.l > 0.75, `l=${m?.l}`);
  check("with nothing to answer, it is nobody's accent", hueOf(complementOf(null))?.h === 90, complementOf(null));
  const palette = { accent: blue, ink: "oklch(0.9 0.02 260)" };
  check(
    "a part's aura is answered before its fill",
    markColour({ aura: "ink", colour: null }, palette) !== markColour({ aura: null, colour: null }, palette),
    `${markColour({ aura: "ink" }, palette)} vs ${markColour({ aura: null }, palette)}`,
  );
  check(
    "a part with nothing of its own answers the site's accent",
    markColour({ aura: null, colour: null }, palette) === complementOf(blue),
  );
}

/* ------------------------------------------------------------------ */
/* 2. On the board                                                     */
/* ------------------------------------------------------------------ */

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const node = (id, featureId, label, x, y, w, h, extra = {}) => ({
  id, pageId: "page_home", featureId, label, prompt: "", content: "", data: "",
  x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false,
  link: null, colour: null, font: null, anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth",
  aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const doc = {
  state: {
    pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
    // A first-screen button: its category hue is a red, which is what made
    // the hover ring under a selection read as a warning.
    nodes: [node("n_cta", "cta-primary", "Join", 480, 300, 320, 64, { aura: "accent", auraSize: 1.2 })],
    groups: [],
    shapes: [{ id: "s_chain", pageId: "page_home", kind: "arrow", points: [[200, 200], [480, 332]], hue: 265, width: 2, label: "", prompt: "", relation: "flow", fromNodeId: null, toNodeId: null }],
    format: {},
    brief: { name: "BLACKORB", gimmick: "", master: "" },
    frameWidth: 1440, activePageId: "page_home", trail: [],
  },
  version: 0,
};

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), JSON.stringify(doc));
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const part = page.locator('[data-node-id="n_cta"]');
const skin = part.locator("div[data-mode]").first();
const outlineOf = (l) => l.evaluate((el) => {
  const s = getComputedStyle(el);
  return { colour: s.outlineColor, style: s.outlineStyle, width: s.outlineWidth, offset: s.outlineOffset };
});

const before = await outlineOf(skin);
check("an unpicked part is not ringed", before.style === "none" || before.colour === "rgba(0, 0, 0, 0)" || /transparent/.test(before.colour), JSON.stringify(before));

await part.click();
await page.waitForTimeout(400);
const after = await outlineOf(skin);
check("a picked part is ringed", after.style === "solid" && parseFloat(after.width) > 0, JSON.stringify(after));
check("thin: one line, not a band", parseFloat(after.width) <= 3, after.width);
check("and inside its own edge, so the aura stays visible", parseFloat(after.offset) < 0, after.offset);
/* The app's accent as the page renders it, and the ring's hue against it:
   the old form excluded one literal rgb that occurs nowhere in the app,
   which left "anything but black" as the rule. */
const rgbHue = (c) => {
  const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c);
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map((v) => Number(v) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d < 0.02) return null;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return ((h * 60) + 360) % 360;
};
const accentRgb = await page.evaluate(() => {
  const e = document.createElement("i");
  e.style.color = "oklch(0.76 0.13 var(--accent-h))";
  document.body.append(e);
  const v = getComputedStyle(e).color;
  e.remove();
  return v;
});
/* Chrome hands back oklch as it was written and rgb otherwise; either way a hue. */
const hue = (c) => hueOf(c)?.h ?? rgbHue(c);
const around = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const apart = hue(after.colour) !== null && hue(accentRgb) !== null ? around(hue(after.colour), hue(accentRgb)) : null;
check(
  "in the far side of the part's own colour, not the app's accent",
  after.colour !== "rgb(0, 0, 0)" && apart !== null && apart >= 60,
  `ring ${after.colour} (hue ${hue(after.colour)?.toFixed(0)}), accent ${accentRgb} (hue ${hue(accentRgb)?.toFixed(0)}): ${apart === null ? "no hue" : `${apart.toFixed(0)}° apart`}`,
);
const fill = await skin.evaluate((el) => getComputedStyle(el).backgroundColor);
check("and it is a line, not a wash over the part", fill === "rgba(0, 0, 0, 0)" || fill === "transparent", fill);

// The hand is on the part after the click, so the hover ring would be up.
const dashed = await part.evaluate((el) =>
  [...el.querySelectorAll("div")].filter((d) => getComputedStyle(d).outlineStyle === "dashed").length);
check("a picked part wears one ring, not the hover dashes as well", dashed === 0, `${dashed} dashed`);

// The page itself, which is picked by pressing the frame it is drawn on.
const frame = page.locator("[data-frame]").first();
const unpicked = await outlineOf(frame);
/*
 * Somewhere the frame actually answers to, found rather than computed.
 *
 * This took the frame's rectangle and pressed 40px in from its left and up
 * from its foot, clamped to y 900 because the frame used to run off the
 * bottom of the viewport. It does not any more — the page is a full-length
 * page on a surface that moves, and here the frame is 715 tall and ends at
 * 820 — so that arithmetic put the press at y 780, which is the shelf's
 * search box sitting over it, and the page was never pressed at all.
 *
 * Asking the document what is under a point costs nothing and cannot go
 * stale: the first spot that answers as the frame and not as a part on it
 * is the spot to press.
 */
const spot = await page.evaluate(() => {
  const f = document.querySelector("[data-frame]");
  if (!f) return null;
  const r = f.getBoundingClientRect();
  for (let y = Math.max(8, r.top + 12); y < Math.min(innerHeight - 8, r.bottom - 12); y += 16)
    for (let x = Math.max(8, r.left + 12); x < Math.min(innerWidth - 8, r.right - 12); x += 16) {
      const el = document.elementFromPoint(x, y);
      if (el && f.contains(el) && !el.closest("[data-node-id]")) return { x, y };
    }
  return null;
});
check("there is somewhere on the page to press", !!spot, spot ? `${spot.x},${spot.y}` : "the frame is covered everywhere");
await page.mouse.click(spot.x, spot.y);
await page.waitForTimeout(400);
const picked = await outlineOf(frame);
check("the page is picked by pressing it", (await page.locator("[data-frame][data-selected]").count()) === 1);
check("the page is marked too, and thinly", parseFloat(picked.width) > 0 && parseFloat(picked.width) <= 3, picked.width);
check("in the far side of its own backdrop, not the border it wears at rest", picked.colour !== unpicked.colour, `${unpicked.colour} → ${picked.colour}`);

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
