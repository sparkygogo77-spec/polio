/**
 * THE WHEEL'S EDGE POP-UP, ON EVERY REPO FIXTURE.
 *
 * Right-click a part, Looks, Edge: a small pop-up beside the wheel, not three
 * slabs. Its corner slider changes the part's drawn radius and one undo takes
 * it back. Corners per corner and padding per side open a smaller pop-up. Near
 * every window edge it stays inside, flipping to the wheel's other side. Esc
 * closes the smaller one, then it; a press away closes it. No page errors.
 *
 *   node tests/wheel-popups.mjs http://localhost:3431 <folder holding sites/>
 *
 * SITES=share-xyz narrows the run. A site that freezes the headless browser
 * gives up after five minutes rather than holding the machine.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { openBoard } from "./lib/board.mjs";

const req = createRequire(import.meta.url);
const { chromium } = req("playwright-core");
const BASE = (process.argv[2] ?? "http://localhost:3431").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? "capture";
const SITES = (process.env.SITES ?? "share-xyz,trumpmorty-fun,gotchi-gg,stonkfun-xyz,parasiteonsol-fun,trendtrader-pro").split(",");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? `: ${detail}` : ""}`); };

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: (process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean) });

const POP = '[data-wheel-popup="edge"]';

async function runSite(site) {
  const file = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); return; }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(page, BASE, "solface");
  const doc = JSON.parse(readFileSync(file, "utf8"));
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
  await page.waitForTimeout(2500);

  /* A plain part in view, big enough to press, whose box draws its own corners. */
  const target = await page.evaluate(() => {
    const nodes = window.__studioHistory.doc().nodes;
    const ok = [...document.querySelectorAll("[data-node-id]")].map((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const n = nodes.find((x) => x.id === el.getAttribute("data-node-id"));
      return { id: n?.id, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, own: hit?.closest("[data-node-id]") === el, feature: n?.featureId, locked: n?.locked, shape: n?.shape };
    }).filter((p) => p.id && p.own && !p.locked && !p.shape && p.w > 60 && p.h > 24 && p.y > 120 && p.y < innerHeight - 120 && p.x > 340 && p.x < innerWidth - 60);
    return ok.find((p) => p.feature === "box") ?? ok[0] ?? null;
  });
  if (!target) { check(`${site}: a part to press`, false); await ctx.close(); return; }
  const node = () => page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id), target.id);
  /*
   * The element that paints the part's corners: the one whose radius the slider moved.
   * Noted before the drag, element by element, because a part holds other rounded
   * things too (its words, the board's own marks), and those come and go.
   */
  const noteRadii = () => page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    window.__radii = new Map([el, ...el.querySelectorAll("*")].map((e) => [e, getComputedStyle(e).borderTopLeftRadius]));
  }, target.id);
  const painter = (wanted) => page.evaluate((px) => {
    for (const [e] of window.__radii) if (e.isConnected && getComputedStyle(e).borderTopLeftRadius === px) { window.__painter = e; return window.__radii.get(e); }
    return null;
  }, wanted);
  const drawn = () => page.evaluate(() => (window.__painter?.isConnected ? getComputedStyle(window.__painter).borderTopLeftRadius : null));
  const past = () => page.evaluate(() => JSON.parse(JSON.stringify(window.__studioHistory.rows?.() ?? [])).length);
  const openEdge = async (x = target.x, y = target.y) => {
    await page.mouse.click(x, y, { button: "right" });
    await page.waitForTimeout(450);
    await page.locator('[data-radial] [data-shard="look"]').click({ force: true });
    await page.waitForTimeout(350);
    await page.locator('[data-radial] [data-shard="edge"]').click({ force: true });
    await page.waitForTimeout(350);
  };
  const closeAll = async () => { for (let i = 0; i < 5 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); } };
  const box = (sel) => page.locator(sel).first().boundingBox();
  const inWindow = (b) => !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 900;

  await openEdge();
  const pop = await box(POP);
  check(`${site}: Edge opens a pop-up`, !!pop && (await page.locator('[data-radial-editor="edge"]').count()) === 0, pop ? `${Math.round(pop.width)}x${Math.round(pop.height)}` : "none");
  if (!pop) { await ctx.close(); return; }
  const wheel = await page.evaluate(() => { const r = document.querySelector('[data-radial] [data-shard="edge"]').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
  const gap = Math.hypot(Math.max(pop.x - wheel.x, 0, wheel.x - pop.x - pop.width), Math.max(pop.y - wheel.y, 0, wheel.y - pop.y - pop.height));
  check(`${site}: it stands beside the slab`, gap < 240, `${Math.round(gap)}px from the slab`);

  /* Change the radius with the hand: drag the slider, one undo. */
  await noteRadii();
  const wasN = JSON.stringify(await node());
  const steps0 = await past();
  const s = await box('[data-popup-slider="Corners"] input');
  await page.mouse.move(s.x + 4, s.y + s.height / 2);
  await page.mouse.down();
  await page.mouse.move(s.x + s.width * 0.3, s.y + s.height / 2, { steps: 4 });
  await page.mouse.move(s.x + s.width * 0.5, s.y + s.height / 2, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(350);
  const set = (await node()).radius;
  const was = await painter(`${set}px`);
  const now = await drawn();
  check(`${site}: the corner slider changes the part's drawn radius`, was !== null && now === `${set}px` && now !== was, `${was} to ${now}`);
  check(`${site}: the whole drag is one undo step`, (await past()) === steps0 + 1, `${steps0} to ${await past()}`);
  await page.keyboard.press("Control+z");
  /* A site's own transition may ease the corner back: read it once it has landed. */
  for (let i = 0; i < 20 && (await drawn()) !== was; i++) await page.waitForTimeout(150);
  check(`${site}: undo restores it`, (await drawn()) === was && JSON.stringify(await node()) === wasN, await drawn());

  /* Each corner, in the smaller pop-up. */
  await page.locator('[data-popup-key="Each corner"]').click();
  await page.waitForTimeout(200);
  const small = await box('[data-wheel-popup="corners"]');
  const cross = small && !(small.x + small.width <= pop.x || pop.x + pop.width <= small.x || small.y + small.height <= pop.y || pop.y + pop.height <= small.y);
  check(`${site}: Each corner opens a smaller pop-up beside it`, !!small && !cross && inWindow(small));
  await page.locator('[data-wheel-popup="corners"] input[aria-label="Top left"]').fill("13");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  const one = await node();
  check(`${site}: one corner is stored per corner`, one.radii?.[0] === 13, JSON.stringify(one.radii));
  await page.keyboard.press("Escape");
  await page.waitForTimeout(150);
  check(`${site}: Esc closes the smaller one first`, (await page.locator('[data-wheel-popup="corners"]').count()) === 0 && (await page.locator(POP).count()) === 1);
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);

  /* Spacing per side, the part's own pad. */
  await openEdgeIfGone();
  async function openEdgeIfGone() { if (!(await page.locator(POP).count())) { await closeAll(); await openEdge(); } }
  await page.locator('[data-popup-key="Spacing"]').click();
  await page.locator('[data-popup-key="Each side"]').click();
  await page.waitForTimeout(150);
  await page.locator('input[aria-label="Padding left"]').fill("17");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(250);
  check(`${site}: padding is stored per side`, (await node()).pad?.left === 17, JSON.stringify((await node()).pad));
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(250);
  check(`${site}: one undo takes that side back`, (await node()).pad?.left !== 17, JSON.stringify((await node()).pad));

  /* Border width. */
  await openEdgeIfGone();
  await page.locator('[data-popup-key="Border"]').click();
  await page.locator('[data-popup-slider="Border width"] input').focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(200);
  const bw = (await node()).edge?.width ?? 0;
  check(`${site}: the border width is written on the part's edge`, bw > 0, String(bw));
  await page.keyboard.press("Control+z");
  await page.waitForTimeout(200);
  check(`${site}: after every undo the part is as it was`, JSON.stringify(await node()) === wasN);
  await closeAll();

  /* Esc, and a press away. */
  await openEdge();
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  check(`${site}: Esc closes it`, (await page.locator(POP).count()) === 0 && (await page.locator("[data-radial]").count()) === 1);
  await closeAll();
  await openEdge();
  await page.mouse.click(target.x, target.y);
  await page.waitForTimeout(200);
  check(`${site}: a press away closes it`, (await page.locator(POP).count()) === 0);
  await closeAll();

  /* Near each edge of the window, with the wheel turned so the slab points at that edge. */
  const edges = [
    { name: "right", x: 1430, y: 450, spin: 0.5 },
    { name: "bottom", x: 720, y: 890, spin: 0.75 },
    { name: "left", x: 10, y: 450, spin: 0 },
    { name: "top", x: 720, y: 10, spin: 0.25 },
  ];
  for (const e of edges) {
    await page.evaluate((v) => window.__studioHistory.act("setMenuSpin", v), e.spin);
    await openWheelAt(e);
    const b = await box(POP);
    const flipped = await page.locator(POP).evaluate((el) => el.hasAttribute("data-flip-x") || el.hasAttribute("data-flip-y"));
    await page.locator('[data-popup-key="Each corner"]').click();
    await page.waitForTimeout(150);
    const c = await box('[data-wheel-popup="corners"]');
    check(`${site}: near the ${e.name} edge it stays inside the window, flipped inward`, inWindow(b) && inWindow(c) && flipped, b ? `${Math.round(b.x)},${Math.round(b.y)} flip ${flipped}` : "none");
    await closeAll();
  }
  async function openWheelAt(e) {
    /* The wheel is carried to the edge by its handle: the same move a hand makes. */
    await page.mouse.click(target.x, target.y, { button: "right" });
    await page.waitForTimeout(400);
    const h = await page.locator("[data-menu-lock]").boundingBox();
    await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2);
    await page.mouse.down();
    await page.mouse.move(e.x, e.y, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(200);
    await page.locator('[data-radial] [data-shard="look"]').click({ force: true });
    await page.waitForTimeout(300);
    await page.locator('[data-radial] [data-shard="edge"]').click({ force: true });
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.__studioHistory.act("setMenuSpin", 0));

  check(`${site}: no page errors`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

for (const site of SITES) {
  const gave = await Promise.race([
    runSite(site).then(() => null, (e) => `error: ${String(e.message).split("\n")[0]}`),
    new Promise((done) => setTimeout(() => done("froze for five minutes"), 300_000)),
  ]);
  if (gave) check(`${site}: the run finished`, false, gave);
}
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed} of ${results.length} hold${failed ? `, ${failed} FAILED` : ""}`);
process.exit(failed ? 1 : 0);
