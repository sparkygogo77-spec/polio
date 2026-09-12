/**
 * The bar and the side panel, as J asked for them.
 *
 * One file for the whole menu pass, grown a chunk at a time, so each push has
 * both a picture and a check behind it. Screenshots land in .screenshots/ as
 * `bar-<size>.png` and `panel-<size>.png`, cropped to the thing that changed
 * rather than the whole window, because a full-page shot of a 40px strip is
 * not a picture of the strip.
 *
 *   node tests/menu-pass.mjs [url]
 */
import { createRequire } from "node:module";
import { mkdirSync } from "node:fs";

const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";

/* A board with something on it, so undo and redo have something to be.
   Seeded through the store's own persisted shape, the way the other suites
   do it, rather than driven through the shelf — how a part gets added is a
   different job, and this one is only about the colour of two arrows. */
const node = (id, f, l, x, y, w, h) => ({
  id, pageId: "p0", featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
const DOC = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("a", "hero-split", "Hero", 40, 90, 1360, 420), node("b", "cta-primary", "Join", 560, 560, 320, 64)],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });
mkdirSync(".screenshots", { recursive: true });
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

/** Visible means on the screen, not merely in the document. */
function seenIn(sel) {
  const el = document.querySelector(sel);
  if (!el) return { found: false };
  const r = el.getBoundingClientRect();
  const st = getComputedStyle(el);
  return {
    found: true,
    on: r.width > 0 && r.height > 0 && r.left < innerWidth && r.top < innerHeight && r.right > 0 && r.bottom > 0
      && st.display !== "none" && st.visibility !== "hidden" && Number(st.opacity) > 0.01,
    w: Math.round(r.width), h: Math.round(r.height),
  };
}

async function look(w, h, tag) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.addInitScript((d) => localStorage.setItem("builder.studio", d), DOC);
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-studio-bar]", { timeout: 20000 });
  await page.waitForTimeout(2200);

  /* One side-panel toggle, not two. */
  const hides = await page.evaluate(() =>
    [...document.querySelectorAll("button")].filter((b) => /side panel|toggle look/i.test(b.getAttribute("aria-label") ?? "")).length);
  check(`${tag}: one control for the side panel`, hides === 1, `${hides} found`);

  /* Undo red, redo green — and only when they can be pressed, so the board
     needs a history before either can be looked at. Two parts in, one step
     back, and both arrows are live at once. A screenshot of two greyed-out
     arrows is not a picture of their colour. */
  const part = page.locator("[data-node-id]").first();
  if (await part.count()) {
    // Two moves and one step back, so both arrows are live at the same
    // moment. A click does not make history; a drag does.
    const bb = await part.boundingBox();
    for (const d of [40, -25]) {
      await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
      await page.mouse.down();
      await page.mouse.move(bb.x + bb.width / 2 + d, bb.y + bb.height / 2 + d / 2, { steps: 6 });
      await page.mouse.up();
      await page.waitForTimeout(250);
    }
  }

  /* Each arrow is read at the moment its own precondition holds, rather than
     trying to catch both live at once — two drags then a step back does
     usually leave both live, but "usually" is a flaky test. The colours come
     back as `oklch(L C H)`, so the hue is read straight off; 27 is the
     process red and 150 the process green, the same pair the timeline and
     the Finish key use, which is the point. */
  const arrow = (label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === l);
    return b ? { colour: getComputedStyle(b).color, off: b.disabled } : null;
  }, label);
  const hueOf = (c) => { const m = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(c || ""); return m ? Number(m[1]) : null; };
  const near = (h, want) => h !== null && Math.min(Math.abs(h - want), 360 - Math.abs(h - want)) < 20;

  const undo = await arrow("Undo");
  check(`${tag}: undo is live after two moves`, !!undo && !undo.off, undo?.off ? "greyed" : "live");
  if (undo && !undo.off) check(`${tag}: undo is the process red`, near(hueOf(undo.colour), 27), undo.colour);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  const redo = await arrow("Redo");
  check(`${tag}: redo is live after a step back`, !!redo && !redo.off, redo?.off ? "greyed" : "live");
  if (redo && !redo.off) check(`${tag}: redo is the process green`, near(hueOf(redo.colour), 150), redo.colour);

  /* The cursor pans on bare ground and marquees on the page.
     Measured by where the page frame ends up: if the view panned, the frame
     moved with it; if it marqueed, the frame stayed exactly where it was. */
  const frameAt = async () => { const b = await page.locator("[data-frame]").boundingBox(); return b ? { x: Math.round(b.x), y: Math.round(b.y) } : null; };
  const drag = async (from, to) => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 8 });
    await page.mouse.up();
    await page.waitForTimeout(300);
  };
  const f0 = await frameAt();
  if (f0) {
    // Bare ground: below and left of the frame, out on the nebula.
    const ground = { x: Math.max(8, f0.x - 60), y: f0.y + 200 };
    await drag(ground, { x: ground.x + 70, y: ground.y + 40 });
    const f1 = await frameAt();
    check(`${tag}: dragging bare ground pans the view`, !!f1 && (Math.abs(f1.x - f0.x) > 20 || Math.abs(f1.y - f0.y) > 10),
      `frame moved ${f1 ? `${f1.x - f0.x},${f1.y - f0.y}` : "?"}`);

    // Empty page: inside the frame, away from any part.
    const f2 = await frameAt();
    const inside = { x: f2.x + 40, y: f2.y + Math.min(600, 40) };
    await drag(inside, { x: inside.x + 90, y: inside.y + 60 });
    const f3 = await frameAt();
    check(`${tag}: dragging empty page does not pan`, !!f3 && Math.abs(f3.x - f2.x) < 6 && Math.abs(f3.y - f2.y) < 6,
      `frame moved ${f3 ? `${f3.x - f2.x},${f3.y - f2.y}` : "?"}`);
  }

  /* Three devices, three different colours, no words. */
  const dev = await page.evaluate(() => {
    const box = document.querySelector("[data-device-switch]");
    if (!box) return null;
    const kids = [...box.querySelectorAll("[data-device]")];
    return {
      n: kids.length,
      words: kids.map((k) => k.textContent.trim()).join(""),
      colours: kids.map((k) => getComputedStyle(k).color),
      lit: kids.filter((k) => k.getAttribute("aria-checked") === "true").length,
      width: Math.round(box.getBoundingClientRect().width),
    };
  });
  check(`${tag}: three devices, icons only`, dev?.n === 3 && dev.words === "", dev ? `${dev.n} buttons, ${dev.width}px, text "${dev.words}"` : "no switch");
  check(`${tag}: exactly one device is lit`, dev?.lit === 1, `${dev?.lit} lit`);

  /* The search fills the gap it sits in, carries no shortcut chip. */
  const search = await page.evaluate((fn) => {
    const s = eval(`(${fn})`)("[data-tool-search]");
    const el = document.querySelector("[data-tool-search]");
    if (!el) return s;
    const bar = document.querySelector("[data-studio-bar]").getBoundingClientRect();
    return { ...s, share: el.getBoundingClientRect().width / bar.width, kbd: !!el.querySelector("kbd"), text: el.textContent.trim() };
  }, seenIn.toString());
  if (w >= 1024) {
    check(`${tag}: the search is on screen`, search.on, `${search.w}×${search.h}`);
    check(`${tag}: it fills the gap rather than a fixed width`, search.share > 0.1, `${(search.share * 100).toFixed(0)}% of the bar`);
    check(`${tag}: no shortcut chip in it`, !search.kbd && !/mod\+k/i.test(search.text), search.text);
  }

  // The bar's own box: it is not at the top of the window, there is app
  // chrome above it, and a clip from y=0 photographs that instead.
  const bar = await page.locator("[data-studio-bar]").boundingBox();
  await page.screenshot({
    path: `.screenshots/bar-${tag}.png`,
    clip: { x: 0, y: Math.max(0, bar.y - 2), width: w, height: Math.ceil(bar.height) + 6 },
  });
  const panel = await page.locator("[data-side-panel]").boundingBox().catch(() => null);
  if (panel) {
    await page.screenshot({ path: `.screenshots/panel-${tag}.png`, clip: { x: panel.x, y: panel.y, width: panel.width, height: Math.min(panel.height, h - panel.y) } });
  }
  console.log(`       .screenshots/bar-${tag}.png${panel ? ` and panel-${tag}.png` : ""}`);
  await page.close();
}

/**
 * Nothing is ever cut off.
 *
 * The bar's own scroll width against its own width, at eight sizes. A ladder
 * of breakpoints that is only written down in a comment is a comment; this is
 * the guarantee. It also reads which rungs have given way at each size, so
 * the stated order is checked rather than asserted.
 */
async function ladder() {
  console.log(`\n  the bar giving way — nothing may overflow at any width:`);
  const page = await browser.newPage({ viewport: { width: 2560, height: 1440 } });
  await page.addInitScript((d) => localStorage.setItem("builder.studio", d), DOC);
  await page.goto(`${URL_}/builder`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-studio-bar]", { timeout: 20000 });
  await page.waitForTimeout(1800);

  let worst = 0, worstAt = 0;
  for (const w of [640, 768, 900, 1024, 1280, 1500, 1920, 2560]) {
    await page.setViewportSize({ width: w, height: 950 });
    await page.waitForTimeout(320);
    const r = await page.evaluate(() => {
      const bar = document.querySelector("[data-studio-bar]");
      const on = (sel) => { const e = document.querySelector(sel); if (!e) return false; const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      // innerText, not textContent: textContent happily returns the words
      // inside a display:none span, which is exactly the thing being checked.
      const words = (sel) => { const e = document.querySelector(sel); return e ? e.innerText.replace(/\s+/g, " ").trim() : ""; };
      return {
        over: bar.scrollWidth - bar.clientWidth,
        kept: [
          on("[data-tool-picker]") && "tool",
          on("[data-device-switch]") && "devices",
          on("[data-finish]") && "finish",
          on("[data-preview-toggle]") && "preview",
          on("[data-page-strip]") && "pages",
        ].filter(Boolean).join(" "),
        toolWords: words("[data-tool-picker]"),
        search: on("[data-tool-search]"),
        updates: on("[data-updates-toggle]"),
        hues: on("[data-ink-hues]"),
      };
    });
    if (r.over > worst) { worst = r.over; worstAt = w; }
    console.log(`    ${String(w).padStart(4)}px  overflow ${String(r.over).padStart(4)}px  kept: ${r.kept}${r.search ? " search" : ""}${r.updates ? " updates" : ""}  tool reads "${r.toolWords}"`);
    check(`${w}px: nothing is cut off`, r.over <= 1, `${r.over}px past the edge`);
    check(`${w}px: the tool, the devices and Finish all survive`, /tool/.test(r.kept) && /devices/.test(r.kept) && /finish/.test(r.kept), r.kept);
    if (w < 1536) check(`${w}px: the tool's name has given way`, r.toolWords === "", `reads "${r.toolWords}"`);
    if (w >= 1536) check(`${w}px: the tool wears its name`, r.toolWords !== "", `reads "${r.toolWords}"`);
    if (w < 768) check(`${w}px: the search has gone`, !r.search);
    if (w < 1024) check(`${w}px: Updates has gone`, !r.updates);
  }
  await page.screenshot({ path: ".screenshots/bar-half.png", clip: { x: 0, y: 0, width: 1280, height: 44 } });
  await page.setViewportSize({ width: 1280, height: 950 });
  await page.waitForTimeout(300);
  const bb = await page.locator("[data-studio-bar]").boundingBox();
  await page.screenshot({ path: ".screenshots/bar-half.png", clip: { x: 0, y: Math.max(0, bb.y - 2), width: 1280, height: Math.ceil(bb.height) + 6 } });
  console.log(`       .screenshots/bar-half.png  1280px, half of 1440p`);
  console.log(`    worst overflow anywhere: ${worst}px${worst ? ` at ${worstAt}px` : ""}`);
  await page.close();
}

await look(1500, 950, "pane");
await look(2560, 1440, "1440p");
await ladder();
await browser.close();
const bad = results.filter((r) => !r.ok);
console.log(`\n${results.length - bad.length}/${results.length} passed`);
process.exit(bad.length ? 1 : 0);
