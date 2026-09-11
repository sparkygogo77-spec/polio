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
 * see it, so gating on it fails the key vault for the crime of being a
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
    const shelf = (await onScreen(page.locator("[data-drawer]")))[0];
    const side = (await onScreen(page.locator("[data-side-panel]")))[0];
    check("the shelf and the side panel are on the screen with it", !!shelf?.on && !!side?.on, `shelf ${shelf?.box ?? "-"} · panel ${side?.box ?? "-"}`);
  }

  const win = await page.locator("[data-page-window]").boundingBox();
  const zoom = Number((await page.locator("[data-page-window]").evaluate((el) => {
    const m = /matrix\(([\d.]+)/.exec(getComputedStyle(el.parentElement).transform);
    return m ? m[1] : "1";
  })));
  const pageH = Math.round(win.height / zoom);
  check("the frame is one screen of the site, not all of it", pageH > 520 && pageH < 1000, `${Math.round(win.width / zoom)}×${pageH}`);
  check(
    "and it is a screen's shape, not a letterbox",
    pageH / (win.width / zoom) > 0.5 && pageH / (win.width / zoom) < 0.8,
    (pageH / (win.width / zoom)).toFixed(2),
  );
  check("it is zoomed out a little, so the ground shows round it", zoom < 0.95, `${Math.round(zoom * 100)}%`);

  const pane = await page.locator("[data-studio-scroll]").boundingBox();
  check("the ground shows above and below the page", win.y > pane.y + 4 && win.y + win.height < pane.y + pane.height - 4, `frame ${Math.round(win.y)}–${Math.round(win.y + win.height)} in pane ${Math.round(pane.y)}–${Math.round(pane.y + pane.height)}`);

  const scrolls = await page.locator("[data-studio-scroll]").evaluate((el) => el.scrollHeight - el.clientHeight);
  check("the workspace itself never needs scrolling", scrolls <= 1, `${scrolls}px of scroll`);

  const shelf = await page.locator("[data-drawer]").boundingBox();
  check("the parts shelf is on screen without going looking for it", shelf && shelf.y + shelf.height <= 900 + 1 && shelf.height > 120, `${Math.round(shelf?.height ?? 0)}px at y ${Math.round(shelf?.y ?? 0)}`);

  // The site scrolls inside the frame, and stops at its foot.
  const at = () => page.locator("[data-page-scroll]").evaluate((el) => Math.abs(Number(/matrix\([^)]*?,\s*([-\d.]+)\)$/.exec(getComputedStyle(el).transform)?.[1] ?? 0)));
  check("the page starts at its top", (await at()) === 0);
  await page.mouse.move(win.x + win.width / 2, win.y + win.height / 2);
  await page.mouse.wheel(0, 500);
  await page.waitForTimeout(400);
  const mid = await at();
  check("the wheel scrolls the site inside its frame", mid > 100, `${Math.round(mid)}px down`);
  await page.mouse.wheel(0, 99999);
  await page.waitForTimeout(400);
  const end = await at();
  await page.mouse.wheel(0, 99999);
  await page.waitForTimeout(300);
  check("and stops at the foot of the page", Math.abs((await at()) - end) < 2, `${Math.round(end)}px`);
  check("the workspace did not move while the site did", (await page.locator("[data-studio-scroll]").evaluate((el) => el.scrollTop)) === 0);

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

  const tabs = () => page.locator("[data-side-panel] [role=radio]").evaluateAll((els) => els.map((e) => e.textContent?.trim()));
  const before = await tabs();
  check("with nothing picked it is Look and Motion", before.slice(0, 2).join(",") === "Look,Motion", before.slice(0, 4).join(" · "));

  await page.locator('[data-node-id="cta"]').click();
  await page.waitForTimeout(600);
  const after = await tabs();
  check("picking something summons its own panel, on the same side", after.slice(0, 3).join(",") === "Element,Format,Pages", after.slice(0, 5).join(" · "));
  check("and the panel is showing it", /Join|Element/.test((await page.locator("[data-side-panel]").innerText()).slice(0, 200)));

  const win = await page.locator("[data-page-window]").boundingBox();
  check("the frame is still a whole screen here", win.width > 300 && win.height > 200, `${Math.round(win.width)}×${Math.round(win.height)}`);
  const shelf = await page.locator("[data-drawer]").boundingBox();
  check("and the shelf is still on screen", shelf.y + shelf.height <= 901);

  // Let go by pressing the ground, which is the one place that is nothing.
  const pane = await page.locator("[data-studio-scroll]").boundingBox();
  await page.mouse.click(pane.x + 12, pane.y + 12);
  await page.waitForTimeout(600);
  const back = await tabs();
  check("letting go of it gives the column back to Look", back.slice(0, 2).join(",") === "Look,Motion", back.slice(0, 3).join(" · "));
  await context.close();
}

/* ------------------------------------------------------------------ */
/* 3. At the size a pane actually is                                    */
/* ------------------------------------------------------------------ */
{
  const { context, page } = await open(980, 820);
  const win = await page.locator("[data-page-window]").boundingBox();
  const shelf = await page.locator("[data-drawer]").boundingBox();
  const pane = await page.locator("[data-studio-scroll]").boundingBox();
  check("the frame still fits the pane whole", win.x >= pane.x && win.x + win.width <= pane.x + pane.width + 1 && win.y + win.height <= pane.y + pane.height + 1,
    `frame ${Math.round(win.x)},${Math.round(win.y)} ${Math.round(win.width)}×${Math.round(win.height)} in ${Math.round(pane.width)}×${Math.round(pane.height)}`);
  check("the categories wrap rather than shrink", (await page.locator("[data-category]").evaluateAll((els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size)) >= 2);
  check("and the shelf is whole", shelf.y + shelf.height <= 821);
  await context.close();
}

/* ------------------------------------------------------------------ */
/* 4. The bands are there at every size, with no exceptions             */
/* ------------------------------------------------------------------ */
for (const [w, h] of [[1440, 900], [1280, 720], [900, 600], [760, 420], [1440, 340]]) {
  const { context, page } = await open(w, h);
  const shelf = await page.locator("[data-drawer]").boundingBox();
  check(
    `${w}×${h}: the categories are on screen and whole`,
    !!shelf && shelf.y >= 0 && shelf.y + shelf.height <= h + 1 && shelf.height > 100,
    shelf ? `${Math.round(shelf.height)}px at y ${Math.round(shelf.y)}` : "no shelf",
  );
  await page.locator("[data-finish]").click();
  await page.waitForTimeout(1000);
  const band = await page.locator("[data-timeline-detail]").boundingBox().catch(() => null);
  check(
    `${w}×${h}: this iteration is on screen and whole`,
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
    w.__f=[];w.__moved=0;const el=document.querySelector("[data-cloud-layer]");let seen=el?el.style.transform:"";
    (function l(){w.__r=requestAnimationFrame((t)=>{w.__f.push(t);if(el&&el.style.transform!==seen){seen=el.style.transform;w.__moved++;}l();});})();})()`;
  const STATS = `cancelAnimationFrame(window.__r);(()=>{const w=window,f=w.__f,d=[];for(let i=1;i<f.length;i++)d.push(f[i]-f[i-1]);
    const beat=[...d].sort((a,b)=>a-b)[Math.floor(d.length*0.5)];
    return {beat:+beat.toFixed(1),late:d.filter(v=>v>beat*1.5).length,frames:d.length,moved:w.__moved,lays:w.__lays,max:+Math.max(...d).toFixed(1)};})()`;

  let hidden = null;
  const ground = async (where) => {
    check(`${where} is a sky, four cloud layers and the embers`,
      (await page.locator("[data-ground-sky]").count()) === 1
      && (await page.locator("[data-cloud-layer]").count()) === 4
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
    // Four headings, not one: each layer carries its own drift and its own
    // slow turn, which is the look the speed pass had traded away.
    const headings = await page.evaluate(() => new Promise((done) => {
      const els = [...document.querySelectorAll("[data-cloud-layer]")];
      const read = () => els.map((el) => el.style.transform);
      const first = read();
      setTimeout(() => {
        const now = read();
        const moved = now.filter((t, i) => t !== first[i]).length;
        const distinct = new Set(now).size;
        const turning = now.filter((t) => !/rotate\(-?0(\.0+)?deg\)/.test(t) && /rotate/.test(t)).length;
        done({ moved, distinct, turning, of: els.length });
      }, 700);
    }));
    check(`${where} moves all four layers`, headings.moved === headings.of, `${headings.moved} of ${headings.of}`);
    check(`${where} gives each its own heading`, headings.distinct === headings.of, `${headings.distinct} distinct transforms`);
    check(`${where} turns them as they go`, headings.turning === headings.of, `${headings.turning} of ${headings.of} turning`);

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
    check(`${where} moves on every frame`, s.moved >= s.frames - 1 && s.frames > 40, `${s.moved} of ${s.frames} frames`);
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
  const cloud = () => page.evaluate(() => document.querySelector("[data-cloud-layer]")?.style.transform ?? "");
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
  const px = (t) => Number(/translate3d\(([-\d.]+)px/.exec(t)?.[1] ?? 0);
  const went = px(later) - px(after);
  // And it keeps the same steady pace afterwards, about 7.4px a second:
  // there is no pause to catch up from, so there is nothing to jump.
  check("and it keeps the same pace afterwards", went > 0.5 && went < 12, `${went.toFixed(1)}px in 0.7s`);
  await context.close();
}

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
