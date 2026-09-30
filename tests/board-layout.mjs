/**
 * The board is a window on the site, and one side carries the tools.
 *
 * Three things were wrong with the room, and all three were the same thing:
 * the design area grew with the site instead of standing still.
 *
 *  · **The frame was the whole page laid out flat**, so a deep site grew
 *    downwards for ever and the foot of it was somewhere below the
 *    workspace's horizon — and the parts shelf below that. The frame is one
 *    screen now, the shape of a real viewport, and the site scrolls behind
 *    its edge the way it will in a browser. The workspace itself never
 *    scrolls, so the shelf is always where you left it.
 *  · **The shelf was a dark row with a dark search box in it.** The search is
 *    a screen across the whole shelf — the app's own colour for anywhere
 *    words are typed — and the categories are round buttons with the planet
 *    big enough to see what it is drawn of, wrapping to as many rows as they
 *    need.
 *  · **There were two side panels**, and the right one was hidden under
 *    1280px — exactly where room is short — so the panel you need when you
 *    pick something was not there. There is one now, on the left, and what is
 *    in it answers what you have in your hand.
 *
 *   node tests/board-layout.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

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
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const node = (id, f, l, x, y, w, h) => ({
  id, pageId: "p0", featureId: f, label: l, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
// A deep site: the last part is far below one screen of it.
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("top", "sticky-header", "Top bar", 0, 0, 1440, 64),
    node("hero", "hero-split", "Hero", 40, 90, 1360, 420),
    node("cta", "cta-primary", "Join", 560, 560, 320, 64),
    node("deep", "feature-cards", "Deep", 40, 2400, 640, 260),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BLACKORB", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ["--no-sandbox"] } : {}) });

/** The builder at a given window size, settled. */
async function open(w, h) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1600);
  return { context, page };
}

/*
 * Is it actually on the screen?
 *
 * Every check in this suite used to ask the DOM whether a control existed,
 * and a control with `display: none` exists: it has a role, it has a name,
 * `count()` finds it, and it is a rectangle of nothing that nobody can press.
 * That is how a deployment served a Builder with no bar at all while every
 * suite in the repository stayed green. Existing is not the question.
 *
 * On the screen is: a rectangle with both sides above zero that overlaps the
 * window, a `display` that is not `none`, a `visibility` that is not
 * `hidden`, and some opacity.
 *
 * **`offsetParent` is not the gate.** It is null for every `position: fixed`
 * element — a dialog, a slide-over, a pinned bar — whether or not anybody can
 * see it, so gating on it fails the keys panel for the crime of being a
 * dialog. It is one signal among the others: a statically positioned node
 * with no offset parent really is detached, and a fixed or sticky one is
 * exempt because being fixed is the reason it has none.
 */
const onScreen = (locator) => locator.evaluateAll((els) => els.map((el) => {
  const r = el.getBoundingClientRect();
  const s = getComputedStyle(el);
  const fixed = s.position === "fixed" || s.position === "sticky";
  // And it has to be *where the window is*. A slide-over that is shut is
  // parked at `translate-x-full`: full size, `display: flex`, wholly outside
  // the glass. Nobody can press that either.
  const inView = r.bottom > 0 && r.right > 0 && r.top < window.innerHeight && r.left < window.innerWidth;
  const on = r.width > 0 && r.height > 0 && inView
    && s.display !== "none" && s.visibility !== "hidden" && Number(s.opacity) !== 0
    && (fixed || el === document.body || !!el.offsetParent);
  return {
    name: (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 28),
    on,
    box: `${Math.round(r.width)}×${Math.round(r.height)}`,
    display: s.display,
    position: s.position,
  };
}));

/* ------------------------------------------------------------------ */
/* 0. The front door                                                   */
/* ------------------------------------------------------------------ */

/*
 * What a person gets when they type the address and nothing else.
 *
 * The deployment redirected the root to the published site the moment
 * anything had been published into the repository, so the tool's own front
 * door became the site it had built: no bar, no shelf, no panel, and nothing
 * saying where the Builder had gone. Every suite stayed green, because every
 * suite went straight to /builder.
 */
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
  const page = await context.newPage();
  const res = await page.goto(`${URL_}/`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1400);
  check("the root is not a redirect away from the app", !/\/site(\/|$)/.test(page.url()), page.url());
  check("and it answers", (res?.status() ?? 0) < 400, String(res?.status()));
  const doors = await page.getByRole("link", { name: /Builder|Open/ }).count() + await page.getByRole("button", { name: /Open|Builds|New site/ }).count();
  check("with a way into the Builder on it", doors > 0, `${doors} doors`);
  await context.close();
}

/*
 * The rule these were written to has been reversed on purpose.
 *
 * They said the workspace never scrolls and the shelf is always on screen —
 * true of the pane-and-band the Builder was, and a fair thing to pin at the
 * time. J has asked for the scroll back: down past the design box, out of
 * its view, and on into the categories and the prompt sections. So the rule
 * is now four things, and these check those instead of being deleted:
 *
 *   · the workspace scrolls;
 *   · the side panels do not move while it does;
 *   · the parts shelf is still reachable without hunting — one scroll, no
 *     searching, and whole when you get there;
 *   · and no scrollbar shows anywhere.
 *
 * "Reachable without hunting" is the one worth stating carefully, because it
 * is the thing the old rule was protecting and the easiest to lose. It means
 * the shelf is the foot of the same column, reached by scrolling down and
 * nothing else — not behind a control, not on another screen.
 */

/**
 * Take the surface to the foot of the page, and say where the shelf is.
 *
 * The column does not scroll any more and the shelf is not below the page:
 * the *pane* moves and the shelf is a band beside it, which is how a site
 * that grows downwards stops pushing the categories below the horizon. So
 * this wheels the surface rather than setting a scrollTop, and the shelf
 * should be exactly where it was when it finishes.
 */
async function toTheFoot(page) {
  const pane = await page.locator("[data-studio-pane]").boundingBox();
  const before = await page.locator("[data-frame]").boundingBox().catch(() => null);
  await page.mouse.move(pane.x + pane.width / 2, pane.y + pane.height / 2);
  for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 300); await page.waitForTimeout(25); }
  await page.waitForTimeout(400);
  const after = await page.locator("[data-frame]").boundingBox().catch(() => null);
  const shelf = await page.locator("[data-drawer]").boundingBox().catch(() => null);
  return { room: before && after ? Math.round(before.y - after.y) : 0, top: before && after ? Math.round(before.y - after.y) : 0, shelf };
}

/* ------------------------------------------------------------------ */
/* 1. At a full monitor                                                */
/* ------------------------------------------------------------------ */
{
  const { context, page } = await open(1440, 900);

  /* The bar first: everything below is about a Builder you can see. */
  {
    const bar = (await onScreen(page.locator("[data-studio-bar]")))[0];
    check("the Builder's bar is on the screen", !!bar?.on, bar ? `${bar.box} · display ${bar.display}` : "no bar at all");
    const controls = await onScreen(page.locator("[data-studio-bar] button, [data-studio-bar] a, [data-studio-bar] [role=radio]"));
    const dark = controls.filter((c) => !c.on);
    check("and every control in it can be pressed", controls.length >= 8 && dark.length === 0, `${controls.length} controls, ${dark.length} dark${dark.length ? `: ${dark.slice(0, 3).map((d) => d.name).join(", ")}` : ""}`);
    const side = (await onScreen(page.locator("[data-side-panel]")))[0];
    check("the side panel is on the screen with it", !!side?.on, side?.box ?? "-");
    /* The shelf is the foot of the same column now rather than a band held
       above the fold, so it is reached rather than already there. */
    const shelf = await page.locator("[data-drawer]").boundingBox().catch(() => null);
    check("and the parts shelf exists, below it", !!shelf && shelf.height > 100,
      shelf ? `${Math.round(shelf.height)}px at y ${Math.round(shelf.y)}` : "no shelf");
  }

  const win = await page.locator("[data-page-window]").boundingBox();
  /* The board is zoomed with CSS zoom on [data-board-zoom] (crisp text at any
     size), not a transform on the window's parent as it once was: read
     whichever is there, the zoom first. */
  const zoom = Number((await page.locator("[data-page-window]").evaluate((el) => {
    const z = el.closest("[data-board-zoom]");
    const css = z ? Number(getComputedStyle(z).zoom) : NaN;
    if (Number.isFinite(css) && css > 0 && css !== 1) return String(css);
    const m = /matrix\(([\d.]+)/.exec(getComputedStyle(el.parentElement).transform);
    return m ? m[1] : "1";
  })));
  const pageH = Math.round(win.height / zoom);
  /*
   * The frame is the whole site, not one screen of it.
   *
   * These two said the opposite, and were right while the frame was a window
   * the site slid behind. J asked for the reverse in as many words: all of it
   * should be rendered, not scrolling within the same web frame. So the
   * height is the site's own and the only thing with a right answer is the
   * width; an empty page still stands a screen tall rather than a sliver.
   */
  check("the frame is the site's own width", Math.round(win.width / zoom) >= 380, `${Math.round(win.width / zoom)} across`);
  check("and at least a screen tall, however empty the page", pageH >= 520, `${pageH} down`);
  check("it is zoomed out a little, so the ground shows round it", zoom < 0.95, `${Math.round(zoom * 100)}%`);

  const pane = await page.locator("[data-studio-pane]").boundingBox();
  /* Ground either side and above the head of the page. Below it is the rest
     of the site, which is the point of it being the whole site. */
  check("the ground shows either side of the page and above its head",
    win.x > pane.x + 4 && win.x + win.width < pane.x + pane.width - 4 && win.y > pane.y + 4,
    `frame ${Math.round(win.x)}–${Math.round(win.x + win.width)} in pane ${Math.round(pane.x)}–${Math.round(pane.x + pane.width)}, head at ${Math.round(win.y)}`);

  /* The surface moves down the page, and the shelf comes up to meet it.
     This pair used to read "the shelf never left", which was a fact about
     the arrangement rather than the rule: a band beside the pane cannot
     move, so the check could not fail while it was one. The shelf is under
     the board in the same scroller now, because J asked for one gesture
     that runs "on into the categories" — so what has to hold is that it
     arrives whole, and that the panels either side never budge. */
  const panelsBefore = await page.locator("[data-side-panel]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  const shelfBefore = await page.locator("[data-drawer]").boundingBox();
  const foot = await toTheFoot(page);
  check("the surface moves down the page", foot.room > 40, `the frame's head went up ${foot.room}px`);
  /*
   * Whole and on screen at the end of the gesture — which is the rule. That
   * it *rose* to get there is not, and demanding a 40px rise fails a board
   * behaving correctly.
   *
   * Since content set the page and the pane set the zoom, a site that fits
   * its pane leaves the shelf already fully up: 247px at y 653 in a 900
   * window, before the gesture and after it. There is nowhere for it to come
   * from. scroll-contract holds "the categories are on screen without
   * scrolling" at every width it measures, and this pair was still written
   * for the arrangement where the shelf began below the fold.
   *
   * So: it moved, or it was already there, and either way it is whole. The
   * same shape full-page uses — the shelf is there, or one gesture brings it.
   */
  const shelfRose = !!foot.shelf && foot.shelf.y < shelfBefore.y - 40;
  const shelfWasUp = !!foot.shelf && foot.shelf.y + foot.shelf.height <= (await page.evaluate(() => window.innerHeight)) + 4;
  check(shelfRose ? "and the parts shelf came up with it, whole" : "and the parts shelf was already up, whole",
    !!foot.shelf && foot.shelf.height > 120 && (shelfRose || shelfWasUp),
    foot.shelf ? `${Math.round(foot.shelf.height)}px at y ${Math.round(foot.shelf.y)}, was ${Math.round(shelfBefore.y)}${shelfRose ? "" : " — already up, nothing to rise from"}` : "no shelf");
  const panelsAfter = await page.locator("[data-side-panel]").evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)));
  check("and the side panels did not move while it did",
    panelsBefore.length > 0 && panelsBefore.every((t, i) => t === panelsAfter[i]),
    `${panelsBefore.join(",")} → ${panelsAfter.join(",")}`);
  /* Nothing about the scroll is allowed to put a bar on the screen. */
  const bars = await page.evaluate(() => [...document.querySelectorAll("*")]
    .filter((e) => (/(auto|scroll)/.test(getComputedStyle(e).overflowY) || /(auto|scroll)/.test(getComputedStyle(e).overflowX))
      && (e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1)
      && e.clientWidth >= 40 && e.clientHeight >= 30
      && getComputedStyle(e).scrollbarWidth !== "none")
    .map((e) => e.tagName.toLowerCase() + [...e.attributes].filter((a) => a.name.startsWith("data-")).map((a) => `[${a.name}]`).join("")));
  check("and no scrollbar shows anywhere", bars.length === 0, bars.join(", ") || "every scroller asks for none");
  await page.locator("[data-studio-scroll]").evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(350);
  const shelf = foot.shelf;

  /*
   * The surface moves down the site, and stops at its foot.
   *
   * This section used to be about the site sliding behind the frame's edge
   * and the workspace holding still — a scrollbox in all but name, which is
   * what J asked to be rid of. What is left of the rule is the half that was
   * always true and still is: a wheel over the page moves you down the whole
   * of it, and it ends rather than running on into empty space.
   */
  const head = async () => (await page.locator("[data-frame]").boundingBox()).y;
  /* Back to the top of the page first: the check above already took the
     surface to the foot, and a surface already at its floor does not move,
     which reads as a broken wheel rather than a spent one. */
  const back = await page.locator("[data-studio-pane]").boundingBox();
  await page.mouse.move(back.x + back.width / 2, back.y + back.height / 2);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, -400); await page.waitForTimeout(18); }
  await page.waitForTimeout(400);
  const h0 = await head();
  /* The pane's middle, not the frame's: a full-length page is taller than
     the window, so its centre is somewhere off the bottom of the screen and
     a wheel aimed there lands on nothing. */
  const over = await page.locator("[data-studio-pane]").boundingBox();
  await page.mouse.move(over.x + over.width / 2, over.y + over.height / 2);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const h1 = await head();
  check("a wheel over the page moves the surface down it", h0 - h1 > 100, `${Math.round(h0 - h1)}px down`);
  for (let i = 0; i < 40; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(20); }
  await page.waitForTimeout(400);
  const h2 = await head();
  await page.mouse.wheel(0, 99999);
  await page.waitForTimeout(300);
  check("and stops at the foot of the page", Math.abs((await head()) - h2) < 4, `${Math.round(h2)}`);
  /* And the categories are where the gesture ends, whole and on screen —
     not clipped, not half a band, not somewhere a second scroll is needed
     to reach. */
  const shelfNow = await page.locator("[data-drawer]").boundingBox();
  const deck = await page.evaluate(() => window.innerHeight);
  /* Same as the pair above: on screen and whole is the rule; having moved to
     get there is not, because a shelf that fits was never off screen. */
  const landedWhole = shelfNow.height > 120 && shelfNow.y < deck && shelfNow.y + shelfNow.height <= deck + 4;
  check("and the categories are what you land on, whole",
    landedWhole && (shelfNow.y < shelfBefore.y || shelfNow.y + shelfNow.height <= deck + 4),
    `${Math.round(shelfNow.height)}px at y ${Math.round(shelfNow.y)}, was ${Math.round(shelfBefore.y)}, window ${deck}`);

  /* ---------------------------------------------- the shelf's own shape */
  // The screen itself, not the text cursor inside it: the field has a rim and
  // a magnifier, and it is the rim that has to reach across the shelf.
  const search = await page.locator("[data-parts-search] > div").boundingBox();
  check("the search runs the width of the shelf", search.width > shelf.width - 40, `${Math.round(search.width)} of ${Math.round(shelf.width)}`);
  const bg = await page.locator("[data-parts-search] > div").evaluate((el) => getComputedStyle(el).backgroundImage + "|" + getComputedStyle(el).backgroundColor);
  check("and it is not the same black as everything round it", /gradient/.test(bg), bg.slice(0, 48));

  const cats = await page.locator("[data-category]").evaluateAll((els) => els.map((e) => {
    const disc = e.firstElementChild;
    const r = disc.getBoundingClientRect();
    const svg = disc.querySelector("svg");
    const s = svg?.getBoundingClientRect();
    return { size: Math.round(r.width), radius: getComputedStyle(disc).borderRadius, icon: Math.round(s?.width ?? 0), top: Math.round(r.top) };
  }));
  check("every category is a round button", cats.length > 10 && cats.every((c) => /9999px|50%/.test(c.radius) || parseFloat(c.radius) >= c.size / 2), cats[0]?.radius);
  check("with an icon big enough to see what it is drawn of", cats.every((c) => c.icon >= 30), `${Math.min(...cats.map((c) => c.icon))}px`);
  check("and there is a way to add something the library has not got", (await page.locator('[data-category="custom-idea"]').count()) === 1);

  await context.close();
}

/* ------------------------------------------------------------------ */
/* 2. At half a monitor, where the right panel used to vanish           */
/* ------------------------------------------------------------------ */
{
  const { context, page } = await open(1280, 900);
  check("there is one side panel, not two", (await page.locator("aside[data-side-panel]").count()) === 1 && (await page.locator("main aside, aside").count()) <= 2);

  /* The strip is the same row in the same order whatever is held.
     It used to grow and shrink with the selection — Element, Format and
     Pages appearing when something was picked up and going when it was let
     go — so the tab you were reaching for depended on what you had just
     clicked. Permanence is the rule now, so that is what is asked.

     SIX RATHER THAN THE OLD COUNT, and the sixth was put there on purpose:
     the Draw tab was renamed on his word, "change it from 'Draw' to
     Generate", because Draw is what the pen does on the board while that
     tab asks a model for a picture. This counted the old row and went red
     on the rename. The row is written out in full rather than counted, so
     the thing this check is actually about still bites: a tab that goes
     missing with the selection, or moves in the order, fails it exactly as
     it did before. */
  const tabs = () => page.locator("[data-side-panel] [role=radio]").evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  const ROW = "Element,Format,Pages,Look,Motion,Generate";
  const before = await tabs();
  check("with nothing picked it is the whole row, in order", before.join(",") === ROW, before.join(" · "));

  await page.locator('[data-node-id="cta"]').click();
  await page.waitForTimeout(600);
  const after = await tabs();
  check("picking something does not move them", after.join(",") === ROW, after.join(" · "));
  // The strip's first tab is always "Element", so its text proved nothing.
  // Picking does not move the tab (`StudioPage.tsx`: the tab you are on is
  // the tab you stay on), so Element is pressed, and then the panel's name
  // field has to hold the picked part's own name.
  await page.locator("[data-side-panel] [role=radio]").first().click();
  await page.waitForTimeout(400);
  const named = await page.locator("[data-side-panel] input").evaluateAll((els) => els.map((e) => e.value));
  check("and Element, pressed, is showing it", named.includes("Join"), `fields: ${named.map((v) => JSON.stringify(v)).join(", ")}`);

  const win = await page.locator("[data-page-window]").boundingBox();
  check("the frame is still a whole screen here", win.width > 300 && win.height > 200, `${Math.round(win.width)}×${Math.round(win.height)}`);
  const reached = await toTheFoot(page);
  check("and the shelf is still one scroll away", !!reached.shelf && reached.shelf.y + reached.shelf.height <= 901,
    reached.shelf ? `y ${Math.round(reached.shelf.y)}` : "no shelf");
  await page.locator("[data-studio-scroll]").evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(300);

  // Let go by pressing the ground, which is the one place that is nothing.
  const pane = await page.locator("[data-studio-scroll]").boundingBox();
  await page.mouse.click(pane.x + 12, pane.y + 12);
  await page.waitForTimeout(600);
  const back = await tabs();
  check("and letting go does not move them either", back.join(",") === ROW, back.join(" · "));
  await context.close();
}

/* ------------------------------------------------------------------ */
/* 3. At the size a pane actually is                                    */
/* ------------------------------------------------------------------ */
{
  const { context, page } = await open(980, 820);
  const win = await page.locator("[data-page-window]").boundingBox();
  const pane = await page.locator("[data-studio-pane]").boundingBox();
  /* Width, not height: the height is the site's and goes past the pane on
     purpose. A frame that fitted the pane whole would be the window again. */
  check("the frame still fits the pane's width, with ground either side",
    win.x > pane.x && win.x + win.width < pane.x + pane.width,
    `frame ${Math.round(win.x)}–${Math.round(win.x + win.width)} in pane ${Math.round(pane.x)}–${Math.round(pane.x + pane.width)}`);
  check("the categories wrap rather than shrink", (await page.locator("[data-category]").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size)) >= 2);
  const small = await toTheFoot(page);
  check("and the shelf is whole when you reach it", !!small.shelf && small.shelf.y >= 0 && small.shelf.y + small.shelf.height <= 821,
    small.shelf ? `${Math.round(small.shelf.height)}px at y ${Math.round(small.shelf.y)}` : "no shelf");
  await context.close();
}

/* ------------------------------------------------------------------ */
/* 4. The bands are there at every size, with no exceptions             */
/* ------------------------------------------------------------------ */
for (const [w, h] of [[1440, 900], [1280, 720], [900, 600], [760, 420], [1440, 340]]) {
  const { context, page } = await open(w, h);
  const reach = await toTheFoot(page);
  check(
    `${w}×${h}: the categories are reachable and whole`,
    !!reach.shelf && reach.shelf.y >= 0 && reach.shelf.y + reach.shelf.height <= h + 1 && reach.shelf.height > 100,
    reach.shelf ? `${Math.round(reach.shelf.height)}px at y ${Math.round(reach.shelf.y)} after ${reach.top}px of scroll` : "no shelf",
  );
  await page.locator("[data-studio-scroll]").evaluate((el) => { el.scrollTop = 0; });
  await page.waitForTimeout(250);
  await page.locator("[data-finish]").click();
  await page.waitForTimeout(1000);
  const down = await toTheFoot(page);
  void down;
  const band = await page.locator("[data-timeline-detail]").boundingBox().catch(() => null);
  check(
    `${w}×${h}: this update is reachable and whole`,
    !!band && band.y >= 0 && band.y + band.height <= h + 1 && band.height > 100,
    band ? `${Math.round(band.height)}px at y ${Math.round(band.y)}` : "no band",
  );
  await context.close();
}

/* ------------------------------------------------------------------ */
/* 5. The header, and the ground under the lamp                        */
/* ------------------------------------------------------------------ */
{
  const { context, page } = await open(1440, 900);

  check("the wordmark has left the top left", (await page.getByRole("link", { name: /Builder home|Builder$/ }).count()) === 0);
  check("the window's chrome does not carry a second search", (await page.locator("header").getByText("Search or run a command").count()) === 0);

  const search = await page.locator("[data-tool-search]").boundingBox();
  const phone = await page.getByRole("radio", { name: "Phone" }).boundingBox();
  const shape = await page.locator("[data-menu-shape]").boundingBox();
  check("the tool search is in the row of tools", !!search, search ? `${Math.round(search.width)}px` : "missing");
  check("between Phone and the menu's own switch", !!search && !!phone && !!shape && phone.x < search.x && search.x < shape.x, `${Math.round(phone?.x ?? -1)} < ${Math.round(search?.x ?? -1)} < ${Math.round(shape?.x ?? -1)}`);

  /* The ground keeps its light while the lamp is being placed. */
  const ground = () => page.locator("[data-ground-sparks]").evaluate((el) => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width * 0.08, y: r.y + r.height * 0.5 };
  });
  const at = await ground();
  /*
   * Is the ground blacked out at that point?
   *
   * The dim was a box the size of the page with a 9999px spread on it, which
   * is how one small element covers a whole screen — and it is untouchable,
   * so asking what is under the pointer there finds the canvas and learns
   * nothing. The spread is measured instead.
   */
  const litness = async () => page.evaluate(({ x, y }) => {
    for (const el of document.querySelectorAll("[data-light-dim], [data-light-dim] *")) {
      const m = /(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px\s+(-?[\d.]+)px/.exec(getComputedStyle(el).boxShadow);
      if (!m) continue;
      const spread = parseFloat(m[4]);
      const r = el.getBoundingClientRect();
      if (spread > 200 && x > r.x - spread && x < r.right + spread && y > r.y - spread && y < r.bottom + spread) return true;
    }
    return false;
  }, at);
  check("nothing covers the ground at rest", (await litness()) === false);
  await page.locator("[data-place-light]").click();
  await page.waitForTimeout(700);
  check("placing the lamp draws its dim, one of them", (await page.locator("[data-light-dim]").count()) === 1, `${await page.locator("[data-light-dim]").count()} dims`);
  check("and nothing covers it while the lamp is being placed", (await litness()) === false);
  const dim = await page.locator("[data-light-dim] > div").evaluate((el) => getComputedStyle(el).boxShadow).catch(() => "none");
  check("the page is ringed rather than the ground blacked out", !/9999px/.test(dim) && !/ 0px 0px 0px 9999/.test(dim), dim.slice(0, 46));

  /* And placing ends with the board. */
  await page.locator("[data-finish]").click();
  await page.waitForTimeout(900);
  check("leaving the board puts the lamp down", (await page.locator("[data-light-dim]").count()) === 0);
  await context.close();
}

/* ------------------------------------------------------------------ */
/* 6. The weather moves every frame and is repainted almost never       */
/* ------------------------------------------------------------------ */
/*
 * The nebula used to be redrawn to move it: 420ms a pass, which is 2.4
 * changes a second, which is what an eye reads as its frame rate. J called
 * it two fps and he was right — the page loop was never the slow part. So
 * the field is painted once, bigger than the box, and slid on the
 * compositor. The two numbers that say whether that is actually what is
 * happening are here: how often the content is repainted, and how often the
 * layer moves.
 */
{
  const { context, page } = await open(1440, 900);
  // Count every pattern fill: four of them is one lay of the whole field.
  const WATCH = `(()=>{const w=window;w.__lays=0;const p=CanvasRenderingContext2D.prototype.createPattern;CanvasRenderingContext2D.prototype.createPattern=function(...a){w.__lays++;return p.apply(this,a);};
    w.__f=[];w.__moved=0;const el=document.querySelector("[data-cloud-layer]");let seen=el?getComputedStyle(el).transform:"";
    (function l(){w.__r=requestAnimationFrame((t)=>{w.__f.push(t);if(el){const t=getComputedStyle(el).transform;if(t!==seen){seen=t;w.__moved++;}}l();});})();})()`;
  const STATS = `cancelAnimationFrame(window.__r);(()=>{const w=window,f=w.__f,d=[];for(let i=1;i<f.length;i++)d.push(f[i]-f[i-1]);
    const beat=[...d].sort((a,b)=>a-b)[Math.floor(d.length*0.5)];
    return {beat:+beat.toFixed(1),late:d.filter(v=>v>beat*1.5).length,frames:d.length,moved:w.__moved,lays:w.__lays,max:+Math.max(...d).toFixed(1)};})()`;

  let hidden = null;
  const ground = async (where) => {
    check(`${where} is a sky, one cloud layer and the embers`,
      (await page.locator("[data-ground-sky]").count()) === 1
      && (await page.locator("[data-cloud-layer]").count()) === 1
      && (await page.locator("[data-ground-sparks]").count()) === 1,
      `${await page.locator("[data-cloud-layer]").count()} layers`);
    // Read off the DOM rather than through a locator, so a ground built the
    // old way fails these checks with its own numbers instead of throwing.
    const field = await page.evaluate(() => {
      const el = document.querySelector("[data-cloud-layer]") ?? document.querySelector("[data-ground-clouds]");
      if (!el) return { backing: 0, css: 0, box: 0 };
      // The style width, not the rect: these layers are turned, and a
      // rotated element's bounding box is not its own width.
      return { backing: el.width ?? 0, css: Math.round(parseFloat(el.style.width) || 0), box: Math.round(el.parentElement.getBoundingClientRect().width) };
    });
    // A pixel a pixel. This is the number J told us not to move to buy
    // frames, so it is held here rather than left to drift.
    check(`${where} draws the clouds at full resolution`, field.backing === Math.round(field.css), `${field.backing} backing for ${field.css} css`);
    // And bigger than the box, or there would be nothing to slide into.
    check(`${where} has material past the edge to slide into`, field.css > field.box + 60, `${field.css} of field for a ${field.box} box`);
    /* Four headings, not one, and each on its own clock.
     *
     * Read from the *computed* transform, because nothing in JavaScript
     * writes the inline one any more: a layer is painted once and slid by a
     * CSS animation. Reading `el.style.transform` here reported every layer
     * motionless, which was the test looking in the wrong place rather than
     * the ground standing still.
     *
     * The turn is gone from the check because it is gone from the ground. A
     * slow rotation is the one thing a repeating pattern cannot be slid into,
     * and it was the source of the seam; the ask was nearly static, so it was
     * dropped rather than the mechanism bent around it. What is checked
     * instead is that each layer still has a heading of its own, which is
     * what the parallax is made of. */
    const headings = await page.evaluate(() => new Promise((done) => {
      const els = [...document.querySelectorAll("[data-cloud-layer]")];
      const read = () => els.map((el) => getComputedStyle(el).transform);
      const dirs = els.map((el) => `${el.style.getPropertyValue("--gx")},${el.style.getPropertyValue("--gy")}`);
      const first = read();
      setTimeout(() => {
        const now = read();
        done({
          moved: now.filter((t, i) => t !== first[i]).length,
          distinct: new Set(dirs).size,
          inline: els.filter((el) => el.style.transform !== "").length,
          of: els.length,
        });
      }, 900);
    }));
    check(`${where} moves its layer`, headings.moved === headings.of, `${headings.moved} of ${headings.of}`);
    check(`${where} has a heading`, headings.distinct === headings.of, `${headings.distinct} heading`);
    check(`${where} moves them without touching the DOM`, headings.inline === 0, `${headings.inline} inline transforms written`);

    /*
     * What this machine costs with no ground at all, to measure the ground
     * against. An absolute count of late frames measures whatever else is
     * running on the box: the same build gave none on a quiet machine and
     * thirty on a busy one. The beat is the signal that is actually about
     * the ground — it halves to 33ms when the ground is too dear to
     * composite — and the late count is only worth reading beside a
     * baseline.
     */
    await page.addStyleTag({ content: "[data-ground-clouds],[data-ground-sparks]{display:none !important}" }).then((tag) => (hidden = tag));
    await page.evaluate(WATCH);
    await page.waitForTimeout(2500);
    const bare = await page.evaluate(STATS);
    await page.evaluate(() => document.querySelectorAll("style").forEach((el) => { if (el.textContent?.includes("data-ground-clouds")) el.remove(); }));
    await page.waitForTimeout(400);

    await page.evaluate(WATCH);
    await page.waitForTimeout(5000);
    const s = await page.evaluate(STATS);
    /*
     * It moves on the compositor, and since the sliding layer was made to
     * land on whole pixels it steps through them rather than sliding within
     * them: the computed transform changes once per pixel — six times a
     * second — not once a frame. So counting changed frames measures the
     * rounding and not the motion. The check here read `moved >= frames - 2`
     * and saw 30 of 299, which is exactly the right number and read as a
     * stalled layer.
     *
     * What is worth holding is the rate: six pixels a second, over however
     * long the window happened to run. A layer that has stopped reads far
     * under it; one being repainted per frame reads far over.
     *
     * That no frame of ours is spent on it is the beat and the late count
     * printed below, and neither moved: 16.7ms, 0 late of 299. `lays` counts
     * pattern fills, and that is the number nailed to the floor — the ground
     * is painted once per size and never again.
     */
    const secs = (s.frames * s.beat) / 1000;
    const want = secs * 6;
    check(`${where} slides at six pixels a second`,
      s.frames > 40 && s.moved >= want * 0.6 && s.moved <= want * 1.6,
      `${s.moved} whole-pixel steps over ${secs.toFixed(1)}s, against the ${want.toFixed(0)} that six a second makes`);
    // One pattern fill is one lay of one layer; each carries about fourteen
    // seconds of material, so five seconds of it should need very few.
    // Counted against every layer on the page, because the timeline floats
    // over the workspace and both grounds are running.
    const onPage = await page.locator("[data-cloud-layer]").count();
    check(`${where} is not repainted to do it`, s.lays <= onPage, `${s.lays} re-laid of ${onPage} layers in ${(s.frames / (1000 / s.beat)).toFixed(1)}s`);
    /*
     * The rate is *reported*, not asserted.
     *
     * This container rasterises in software (ANGLE/SwiftShader), where four
     * window-sized blended layers are a great deal of fill and the ground
     * measures 13.9fps against a one-layer field's 60. On a graphics card
     * the same work is nothing. J chose the four layers knowing that, so a
     * red line here would be this box overruling him. What is worth holding
     * is that the *method* is right — moved every frame, repainted almost
     * never — and those are the checks above. `docs/shelf/README.md` has the
     * whole table.
     */
    console.log(`       ${where}: beat ${s.beat}ms (${bare.beat}ms with no ground), ${s.late} of ${s.frames} late (${bare.late} of ${bare.frames} without), worst ${s.max}ms`);
  };

  await ground("the board's ground");
  await page.locator("[data-finish]").click();
  await page.waitForTimeout(1500);
  await ground("the timeline's floor");

  /* The weather does not stop for a hand on the board.
   *
   * It used to: a flag on the root, and the ground held where it was. That
   * was bought when moving a cloud meant repainting it, and moving one costs
   * a transform write now, so there is nothing left to buy. Both the flag
   * and a real pointer are put in place here, which is exactly the state
   * that used to freeze it. */
  const cloud = () => page.evaluate(() => getComputedStyle(document.querySelector("[data-cloud-layer]")).transform);
  await page.evaluate(() => { document.documentElement.dataset.boardDrag = "1"; });
  await page.mouse.move(400, 400);
  await page.mouse.down();
  await page.waitForTimeout(120);
  const during = await cloud();
  await page.waitForTimeout(700);
  const after = await cloud();
  check("a hand on the board does not stop the weather", during !== after);
  await page.mouse.up();
  await page.evaluate(() => { delete document.documentElement.dataset.boardDrag; });
  await page.waitForTimeout(700);
  const later = await cloud();
  /* A matrix, not a translate3d string: the drift is a CSS animation now and
     the computed value comes back as `matrix(a, b, c, d, tx, ty)`. */
  const px = (t) => { const m = /matrix\(([^)]+)\)/.exec(t); return m ? Number(m[1].split(",")[4]) : 0; };
  const went = Math.abs(px(later) - px(after));
  /* And it keeps the same steady pace afterwards — there is no pause to catch
     up from, so there is nothing to jump. The ground drifts at 6px a second,
     so seven tenths of a second is a little over four pixels. The band is
     wide enough for a slow frame and narrow enough to catch the ground being
     stopped or run away with: it was 0.02 to 3 when the drift was 1.13px a
     second, and that speed turned out to be a still image with a duration
     attached. */
  check("and it keeps the same pace afterwards", went > 2 && went < 9, `${went.toFixed(2)}px in 0.7s, at 6px a second`);
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
