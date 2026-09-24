/**
 * A PART THE CAPTURE PLACED ABOVE THE PAGE'S TOP CAN BE SCROLLED TO.
 *
 * MEASURED on 2bbde72 with sink's pages: the SOL WORKS badge is captured at
 * y -11, 112 tall, on every section page. The board keeps 20px of ground over
 * the page, so at the zoom it opens at (0.98) the badge fits in it, with 9px to
 * spare. Zoom in and the overhang grows while the ground does not: at 1.81 it
 * had 4px left, and at 3.70 its top 13px were above the board's own top, where
 * no scroll reaches, because a scroller only travels down. `frameTopReach` gave
 * room above the page for ink and drawn spaces and not for parts.
 *
 * The part stays where the capture put it. Nothing here moves it, and the check
 * reads its stored position before and after to say so. What changes is the
 * board: it reaches up to the part the way it already reached up to ink.
 *
 * Two cases, both measured by scrolling the pane as far up as it goes and
 * asking whether the part's top is on screen:
 *   - his: the fixture's own topmost part, zoomed in until its overhang is
 *     wider than the ground above the page;
 *   - the rule: one part far above the page, at the zoom the board opens at.
 * And a control: a page with nothing above y 0 gets no extra room above.
 * No expected number is written here; each one is the fixture's or the board's.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/part-above-reach.mjs http://127.0.0.1:3013
 */
import { existsSync, readFileSync } from "node:fs";
import { chromium } from "playwright-core";

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const fixture = JSON.parse(readFileSync(new URL("./fixtures/sink-pages.json", import.meta.url), "utf8"));
const home = fixture.nodes.filter((n) => n.pageId === "page_home");
const highest = Math.min(...home.map((n) => n.y));

const part = (id, y, extra = {}) => ({
  id, pageId: "page_home", featureId: "custom-idea", label: id, prompt: "", content: "", data: "",
  x: 300, y, w: 600, h: 200, groupId: null, options: {}, priority: "must", custom: true,
  glyph: null, hue: null, locked: false, link: null, colour: null, font: null, anim: null, animSpeed: 1,
  animDelay: 0, animEase: "smooth", shape: null, outline: null, kind: null, vector: null, role: null,
  cube: null, mesh: null, code: null, aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, plan: null,
  ...extra,
});
const stock = (nodes) => ({
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], nodes,
});
/* Far enough above that no gutter could be holding it by accident. */
const FAR = -Math.max(200, 4 * Math.abs(highest));

const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });

/**
 * Open a document, zoom in `notches` wheel steps, scroll the pane as far up as
 * it goes, and read where the topmost part sits against the pane and the board.
 */
async function open(state, notches = 0) {
  const page = await browser.newPage({ viewport: { width: 1763, height: 1000 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
  await page.evaluate((s) => localStorage.setItem("builder.studio", JSON.stringify({ state: s, version: 0 })), state);
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const pane = await page.locator("[data-studio-pane]").boundingBox();
  await page.mouse.move(pane.x + 400, pane.y + 300);
  for (let i = 0; i < notches; i++) {
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -100);
    await page.keyboard.up("Control");
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.querySelector("[data-studio-pane]").scrollTop = 0; });
  await page.waitForTimeout(300);
  const out = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("builder.studio")).state;
    const mine = s.nodes.filter((n) => n.pageId === s.activePageId);
    const top = mine.reduce((m, n) => (n.y < m.y ? n : m), mine[0]);
    const pane = document.querySelector("[data-studio-pane]");
    const board = pane.firstElementChild;
    const frame = document.querySelector("[data-frame]").getBoundingClientRect();
    const el = document.querySelector(`[data-node-id="${top.id}"]`);
    const r = el.getBoundingClientRect(), b = board.getBoundingClientRect(), p = pane.getBoundingClientRect();
    /* Anything between the part and the board that clips, and how much of the part's top it takes. */
    let cut = null;
    for (let a = el.parentElement; a && a !== board; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (!/(hidden|clip|auto|scroll)/.test(cs.overflowX + cs.overflowY)) continue;
      const q = a.getBoundingClientRect();
      if (q.top - r.top > 1) { cut = `${a.getAttribute("data-frame") !== null ? "[data-frame]" : a.tagName} takes ${Math.round(q.top - r.top)}px`; break; }
    }
    return {
      id: top.id, y: top.y, zoom: frame.width / s.frameWidth || frame.width / 1440,
      scrollTop: pane.scrollTop,
      offPane: Math.round(p.top - r.top), offBoard: Math.round(b.top - r.top),
      fromFrame: r.top - frame.top, frameBelowBoard: Math.round(frame.top - b.top), cut,
      frameH: document.querySelector("[data-frame]").clientHeight,
    };
  });
  await page.close();
  return { ...out, errors };
}

/* The control: nothing above y 0, so no room is added above the page. */
const flat = await open(stock([part("n_top", 0)]));
check("control: a page whose top part sits at 0 is scrolled to its top", flat.scrollTop === 0 && flat.offPane <= 0, `${flat.offPane}px above the pane`);

/* His case, zoomed in until the badge's overhang is wider than the ground over the page. */
const his = await open({ ...fixture, activePageId: "page_home" }, 20);
check("the fixture's topmost part is the one the capture placed above 0", his.y === highest && highest < 0, `${his.id} at y ${his.y}`);
check("zoomed in, its overhang is wider than the ground the board keeps over the page, so this case can fail",
  -his.y * his.zoom > flat.frameBelowBoard, `${(-his.y * his.zoom).toFixed(1)}px overhang at zoom ${his.zoom.toFixed(2)}, ${flat.frameBelowBoard}px of ground`);
check("scrolled all the way up, the top of that part is on screen", his.offPane <= 1, `${his.offPane}px of it above the pane`);
check("…and on the board's own surface", his.offBoard <= 1, `${his.offBoard}px above the board's top`);
check("…and nothing between it and the board clips it", his.cut === null, his.cut ?? "");
check("the part did not move: still where the capture put it", his.y === highest && Math.abs(his.fromFrame - his.y * his.zoom) <= 1.5,
  `stored y ${his.y}, drawn ${(his.fromFrame / his.zoom).toFixed(1)} from the page's top`);

/* The rule: a part far above the page, at the zoom the board opens at. */
const far = await open(stock([part("n_far", FAR), part("n_low", 300)]));
check(`a part at y ${FAR}, at the zoom the board opens at, is scrolled to its top`, far.offPane <= 1, `${far.offPane}px of it above the pane`);
check("…and it is on the board's own surface", far.offBoard <= 1, `${far.offBoard}px above the board's top`);
check("…and it did not move", far.y === FAR && Math.abs(far.fromFrame - far.y * far.zoom) <= 1.5, `stored y ${far.y}, drawn ${(far.fromFrame / far.zoom).toFixed(1)}`);
check("the page keeps its origin: the part far above does not make the page taller", far.frameH === (await open(stock([part("n_low", 300)]))).frameH, `${far.frameH}`);

const errors = [flat, his, far].flatMap((o) => o.errors);
check("with no page error on the way", errors.length === 0, errors.join(" / "));

await browser.close();
const passed = results.filter(Boolean).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
