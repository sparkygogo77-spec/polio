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

  /* No strip along the bottom. Checked as a person sees it — is there
     anything down there, and does the Builder reach the floor — rather than
     by asking whether a particular component is mounted, because the
     complaint was about a band of small grey words and not about a footer
     element. `live`, the ping, `tweets`, `compact`, `sound` and the clock
     were its whole contents; the version tag went with them. */
  const floor = await page.evaluate(() => {
    const band = 34;
    const words = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.height <= 0 || r.width <= 0) continue;
      if (r.bottom < innerHeight - band || r.top > innerHeight) continue;
      const st = getComputedStyle(el);
      if (st.visibility === "hidden" || Number(st.opacity) < 0.05) continue;
      // Leaf text only, so a wrapper does not report its children's words.
      if (el.children.length) continue;
      const t = (el.innerText || "").trim();
      if (t) words.push(t.replace(/\s+/g, " ").slice(0, 24));
    }
    /* How much window is left under the Builder itself. Its own root, not
       the deepest descendant: a panel that scrolls has content past the
       bottom edge by design, and that is not the question. */
    const root = document.querySelector("[data-studio-root]");
    const gap = root ? Math.round(innerHeight - root.getBoundingClientRect().bottom) : null;
    const under = document.elementFromPoint(Math.round(innerWidth / 2), innerHeight - 2);
    return { words: [...new Set(words)], gap, inside: !!(root && under && root.contains(under)) };
  });
  const strip = /^(live|tweets|compact|comfortable|sound|muted|v\d|\d+ ?ms|\d+ fps|\d\d:\d\d)/i;
  const left = floor.words.filter((w) => strip.test(w));
  check(`${tag}: no strip of small print along the bottom`, left.length === 0, left.length ? `still reads ${JSON.stringify(left)}` : `nothing but the Builder down there`);
  check(
    `${tag}: the Builder reaches the bottom of the window`,
    floor.gap !== null && Math.abs(floor.gap) <= 2 && floor.inside,
    `${floor.gap}px of window left under it, and the bottom row of pixels ${floor.inside ? "belongs to the Builder" : "belongs to something else"}`,
  );

  /* The tab you are on is the tab you stay on.
     Done the way it is complained about: go to Motion, then click the bare
     background the way you would to let go of a part. The old panel wrote
     the active tab from an effect on the selection, so that press threw you
     back to Look. It also grew and shrank its own tab strip — Element,
     Format and Pages came and went with the selection — so the count is
     read in both states and has to be the same number. */
  const tabNames = () => page.evaluate(() => {
    const strip = document.querySelector("[aria-label='Side panel']");
    if (!strip) return null;
    const on = [...strip.querySelectorAll("button")];
    return {
      all: on.map((b) => (b.innerText || "").trim()).filter(Boolean),
      lit: on.filter((b) => b.getAttribute("aria-checked") === "true" || b.getAttribute("aria-selected") === "true" || b.dataset.state === "on").map((b) => (b.innerText || "").trim()),
    };
  });
  const pressTab = async (word) => {
    await page.evaluate((w) => {
      const strip = document.querySelector("[aria-label='Side panel']");
      [...(strip?.querySelectorAll("button") ?? [])].find((b) => (b.innerText || "").trim() === w)?.click();
    }, word);
    await page.waitForTimeout(250);
  };

  /* Five tabs in a 215px column: the strip has to hold them all. Adding
     Element, Format and Pages permanently pushed 347px of tabs into it and
     Look and Motion went off the end, which is how this check earned its
     place. */
  const stripFit = await page.evaluate(() => {
    const strip = document.querySelector("[aria-label='Side panel']");
    if (!strip) return null;
    const r = strip.getBoundingClientRect();
    const off = [...strip.querySelectorAll("button")]
      .filter((b) => { const q = b.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; })
      .map((b) => (b.innerText || "").trim() || "an icon");
    return { off, w: Math.round(r.width) };
  });
  if (stripFit) {
    check(`${tag}: every tab is inside the panel`, stripFit.off.length === 0,
      stripFit.off.length ? `${JSON.stringify(stripFit.off)} hangs off a ${stripFit.w}px strip` : `all of them, in ${stripFit.w}px`);
  }

  const withNothing = await tabNames();
  if (withNothing) {
    const first = page.locator("[data-node-id]").first();
    check(`${tag}: there is a part to pick`, (await first.count()) >= 1, `${await first.count()} parts on the board`);
    if (await first.count()) { await first.click(); await page.waitForTimeout(300); }
    const withPart = await tabNames();
    check(
      `${tag}: the same tabs whether or not something is picked`,
      JSON.stringify(withNothing.all) === JSON.stringify(withPart.all),
      `${JSON.stringify(withNothing.all)} then ${JSON.stringify(withPart.all)}`,
    );

    /* Done on Element, so the same press proves two things: the tab did not
       move, and the click really did let go of the part. Element names what
       is in your hand and falls back to the page's own prompt when your hand
       is empty, so its heading says which happened. */
    await pressTab("Element");
    const held = await page.evaluate(() => (document.querySelector("[data-side-panel]")?.innerText || "").slice(0, 60));
    const spot = await page.evaluate(() => {
      // Bare ground: inside the workspace, clear of the frame and the shelf.
      const f = document.querySelector("[data-frame]")?.getBoundingClientRect();
      const g = document.querySelector("[data-ground-clouds]")?.getBoundingClientRect();
      if (!f || !g) return null;
      const x = f.right + Math.min(40, (g.right - f.right) / 2);
      return x < g.right - 4 ? { x: Math.round(x), y: Math.round(f.top + f.height / 2) } : null;
    });
    if (!spot) {
      check(`${tag}: clicking the background does not move the tab`, false, "no bare ground beside the frame to click");
    } else {
      const before = await tabNames();
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(400);
      const after = await tabNames();
      const now = await page.evaluate(() => (document.querySelector("[data-side-panel]")?.innerText || "").slice(0, 60));
      check(
        `${tag}: the click on bare ground did let go of the part`,
        held !== now,
        `the panel read ${JSON.stringify(held)} and now reads ${JSON.stringify(now)}`,
      );
      check(
        `${tag}: and it did not move the tab`,
        before?.lit?.[0] === "Element" && after?.lit?.[0] === "Element",
        `on ${JSON.stringify(before?.lit)} before the click, ${JSON.stringify(after?.lit)} after`,
      );
    }
    await pressTab("Look");
  }

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
  /* Read the colour with transitions switched off.
     `disabled` is a DOM property and flips the instant the state changes;
     `color` is transitioned and arrives later. Reading both together caught
     an enabled button still wearing its disabled grey — and waiting for two
     equal reads did not fix it, because two reads taken before the fade has
     even started agree with each other perfectly. Chrome also serialises a
     colour mid-fade as `oklab(...)` rather than the authored `oklch(...)`,
     which is how this showed itself. There is no fade to wait out here: the
     check is about which colour was authored, so the transition is switched
     off for the read and put back afterwards. */
  const frozen = await page.addStyleTag({ content: "*,*::before,*::after{transition:none !important;animation:none !important}" });
  const arrow = (label) => page.evaluate((l) => {
    const b = [...document.querySelectorAll("button")].find((x) => x.getAttribute("aria-label") === l);
    return b ? { colour: getComputedStyle(b).color, off: b.disabled } : null;
  }, label);
  const hueOf = (c) => {
    const ch = /oklch\(\s*[\d.]+\s+[\d.]+\s+([\d.]+)/.exec(c || "");
    if (ch) return Number(ch[1]);
    const la = /oklab\(\s*[-\d.]+\s+(-?[\d.]+)\s+(-?[\d.]+)/.exec(c || "");
    if (!la) return null;
    const d = (Math.atan2(Number(la[2]), Number(la[1])) * 180) / Math.PI;
    return d < 0 ? d + 360 : d;
  };
  /* 27 is the process red and 150 the process green — the same pair the
     timeline and the Finish key use, which is the whole point of them. */
  const near = (h, want) => h !== null && Math.min(Math.abs(h - want), 360 - Math.abs(h - want)) < 20;
  const undo = await arrow("Undo");
  check(`${tag}: undo is live after two moves`, !!undo && !undo.off, undo?.off ? "greyed" : "live");
  if (undo && !undo.off) check(`${tag}: undo is the process red`, near(hueOf(undo.colour), 27), undo.colour);

  await page.keyboard.press("Control+z");
  await page.waitForTimeout(400);
  const redo = await arrow("Redo");
  check(`${tag}: redo is live after a step back`, !!redo && !redo.off, redo?.off ? "greyed" : "live");
  if (redo && !redo.off) check(`${tag}: redo is the process green`, near(hueOf(redo.colour), 150), redo.colour);
  await frozen.evaluate((el) => el.remove());

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
 * Nothing is ever cut off, and the ladder is the ladder that is written down.
 *
 * Two passes. The first is the bar's own scroll width against its own width
 * at eight sizes: a breakpoint ladder that is only written down in a comment
 * is a comment, and this is the guarantee.
 *
 * The second is the ladder itself, rung by rung, and it is here because the
 * first pass cannot see the thing the complaint was about. Nothing being cut
 * off is satisfied by a bar that drops its controls in any order it likes,
 * and the fault was precisely that the wrong ones survived — "Desktop",
 * "Tablet" and "Phone" spelled out in full while the controls on the right
 * walked off the edge. So each rung is read on both sides of its own
 * breakpoint: there one pixel above, gone one pixel below, and never back
 * again at anything narrower.
 *
 * An earlier version of this comment said the first pass already checked the
 * order. It did not: it read three rungs and asserted two of them, and never
 * once checked that a rung was still *there* above its breakpoint.
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
        /* Any control in the bar still spending width on a *label* — a word
           beside an icon that already says the same thing. Four things carry
           text and are not labels, so they are exempt by name rather than by
           a rule that would quietly excuse a real one:
             · the page strip — a page's name is which page, not a label
             · the search      — a placeholder is what makes a field a field
             · the zoom hud    — a percentage is a reading
             · Finish          — a count is a reading
           Builds keeps its word deliberately: it is the only way out of the
           Builder and the only wayfinding in the bar, and a bare stack of
           layers at the far left is a guess. */
        wordy: [...document.querySelectorAll("[data-studio-bar] button")]
          .filter((b) => !b.closest("[data-page-strip]") && !b.closest("[data-tool-search]")
            && !b.matches("[data-tool-search]") && !b.closest("[data-finish]")
            && !b.classList.contains("num") && !/Builds/.test(b.innerText))
          .filter((b) => b.innerText.trim() && b.querySelector("svg"))
          .map((b) => b.innerText.replace(/\s+/g, " ").trim()).join(" | "),
      };
    });
    if (r.over > worst) { worst = r.over; worstAt = w; }
    console.log(`    ${String(w).padStart(4)}px  overflow ${String(r.over).padStart(4)}px  kept: ${r.kept}${r.search ? " search" : ""}${r.updates ? " updates" : ""}  tool reads "${r.toolWords}"`);
    check(`${w}px: nothing is cut off`, r.over <= 1, `${r.over}px past the edge`);
    check(`${w}px: the tool, the devices and Finish all survive`, /tool/.test(r.kept) && /devices/.test(r.kept) && /finish/.test(r.kept), r.kept);
    // No word on it at any width, so there is no rung to check — the point
    // is that it never has one to give up.
    check(`${w}px: the tool control carries no word`, r.toolWords === "", `reads "${r.toolWords}"`);
    check(`${w}px: no control wears a word its icon already says`, r.wordy === "", r.wordy || "none");
    if (w < 768) check(`${w}px: the search has gone`, !r.search);
    if (w < 1024) check(`${w}px: Updates has gone`, !r.updates);
  }
  /* ---------------------------------------------- the ladder, rung by rung */
  /* Copied from the bar's comment, not imported from its classes, so that
     moving an `lg:` to an `xl:` fails here rather than quietly rewriting the
     ladder it is supposed to be keeping. */
  const LADDER = [
    { rung: 1, what: "the search's own words", goes: 1280, key: "words" },
    { rung: 2, what: "the ink hues", goes: 1024, key: "hues" },
    { rung: 3, what: "Wires", goes: 1024, key: "wires" },
    { rung: 4, what: "Updates", goes: 1024, key: "updates" },
    { rung: 5, what: "the search entirely", goes: 768, key: "search" },
    { rung: 6, what: "the menu's edge switch", goes: 768, key: "edge" },
    { rung: 7, what: "the page chips", goes: 768, key: "pages" },
    { rung: 8, what: "the site's name", goes: 640, key: "name" },
  ];
  /*
   * What the comment says never goes, at any width — the zoom readout now
   * among them.
   *
   * This list and the ladder above had both gone stale, which is why three
   * of these were failing before anything was changed: the readout was
   * deliberately kept at every width when it became the way back, and the
   * page chips were deliberately dropped below md because Pages is one of
   * the side panel's tabs and the panel's own toggle is in this bar at
   * every width. Neither was a bug in the bar; both were a test still
   * holding the bar to an older shape. There is no "Fit" key any more
   * either: the button is gone and the readout does its job.
   */
  const SURVIVES = ["tool", "devices", "undo", "redo", "zoomOut", "zoom", "zoomIn", "preview", "finish", "panel"];

  /* The ink hues are only out while drawing, so the pen goes in hand — with a
     press on the board first, or `d` lands in whatever field has focus. */
  await page.setViewportSize({ width: 1600, height: 950 });
  await page.waitForTimeout(300);
  await page.mouse.click(900, 520);
  await page.keyboard.press("d");
  await page.waitForTimeout(400);

  const rungsAt = {};
  for (const w of [...new Set(LADDER.flatMap((r) => [r.goes + 1, r.goes - 1]))].sort((a, b) => b - a)) {
    await page.setViewportSize({ width: w, height: 950 });
    await page.waitForTimeout(340);
    rungsAt[w] = await page.evaluate(() => {
      const vis = (el) => { if (!el) return false; const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
      const bar = document.querySelector("[data-studio-bar]");
      const byLabel = (l) => vis(bar.querySelector(`[aria-label='${l}']`));
      const btns = [...bar.querySelectorAll("button")];
      return {
        words: vis([...bar.querySelectorAll("span")].find((x) => /Search commands/.test(x.textContent || ""))),
        hues: vis(bar.querySelector("[data-ink-hues]")),
        zoom: btns.some((e) => /^\d+%$/.test((e.textContent || "").trim()) && vis(e)),
        wires: byLabel("Toggle wires"),
        updates: vis(bar.querySelector("[data-updates-toggle]")),
        search: vis(bar.querySelector("[data-tool-search]")),
        edge: vis(bar.querySelector("[data-menu-shape]")),
        name: vis(bar.querySelector("[data-site-build]")),
        tool: vis(bar.querySelector("[data-tool-picker]")),
        devices: [...bar.querySelectorAll("[data-device]")].filter(vis).length === 3,
        undo: byLabel("Undo"),
        redo: byLabel("Redo"),
        zoomOut: byLabel("Zoom out"),
        zoomIn: byLabel("Zoom in"),
        preview: vis(bar.querySelector("[data-preview-toggle]")),
        finish: vis(bar.querySelector("[data-finish]")),
        panel: byLabel("Toggle the side panel"),
        pages: vis(bar.querySelector("[data-page-strip]")),
        over: Math.max(0, bar.scrollWidth - bar.clientWidth),
      };
    });
  }
  const rungWidths = Object.keys(rungsAt).map(Number).sort((a, b) => b - a);
  console.log(`\n  the ladder, on both sides of every rung:`);
  for (const r of LADDER) {
    const above = rungsAt[r.goes + 1], below = rungsAt[r.goes - 1];
    check(
      `rung ${r.rung}: ${r.what} goes below ${r.goes}`,
      above[r.key] === true && below[r.key] === false,
      `${above[r.key] ? "there" : "gone"} at ${r.goes + 1}px, ${below[r.key] ? "there" : "gone"} at ${r.goes - 1}px`,
    );
    const back = rungWidths.filter((w) => w < r.goes && rungsAt[w][r.key]);
    check(`rung ${r.rung}: and does not come back`, back.length === 0, back.length ? `there again at ${back.join("px, ")}px` : "gone and stays gone");
  }
  for (const k of SURVIVES) {
    const lost = rungWidths.filter((w) => !rungsAt[w][k]);
    check(`${k} survives every rung`, lost.length === 0, lost.length ? `missing at ${lost.join("px, ")}px` : `there at all ${rungWidths.length}`);
  }
  const spilled = rungWidths.filter((w) => rungsAt[w].over > 1);
  check("nothing is cut off on either side of a rung", spilled.length === 0, spilled.length ? spilled.map((w) => `${rungsAt[w].over}px at ${w}`).join(", ") : "0px past the edge at all of them");

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
