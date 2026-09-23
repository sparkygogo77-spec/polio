/**
 * A marquee takes what it covers even when the release lands in the same
 * task as the last move.
 *
 * THE FAULT. The marquee's rectangle lived only in React state, and the
 * release read it from the render its handler was made in. So a release that
 * arrived before a render had landed after the last move saw the rectangle as
 * it was one move earlier, or not at all, and fell through to "a plain press
 * picks the part under it": the box the hand drew across was picked instead
 * of what the hand drew round. A dropped frame on a loaded machine is a real
 * hand losing a selection it drew. The Playwright mouse check
 * (`tests/marquee-cover.mjs`) goes through the real input pipeline and shows
 * the happy path; this shows the other one.
 *
 * HOW. Events are dispatched from inside the page. A frame is awaited after
 * the press and after every move except the last, so the drag is rendered and
 * the rectangle is drawn (asserted, so the interaction happened). Then the
 * last move and the release go in one task, with no render between them. The
 * last move is the one that brings the second part inside the rectangle, so
 * a release reading a stale rectangle takes the wrong thing.
 *
 *   npx next start -p 3013
 *   node tests/marquee-burst.mjs http://127.0.0.1:3013
 */
import { createRequire } from "node:module";
const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const node = (id, f, content, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label: id, prompt: "", content, data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});

/* His sidebar's shape: a navigation box at (0,229), 255×431, holding buttons.
   And two leaves on the bare page, for a marquee begun on the page itself. */
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("nav", "box", "", 0, 229, 255, 431),
    node("b1", "cta-primary", "Creator Hub", 16, 236, 223, 44),
    node("b2", "cta-primary", "Cleanup", 16, 288, 223, 44),
    node("p1", "value-prop", "P1", 600, 300, 120, 50),
    node("p2", "value-prop", "P2", 760, 300, 120, 50),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "BURST", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"], ...(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {}) });

/*
 * One marquee, dispatched in the page. `from` and `path` are board points,
 * mapped to the screen through a reference part measured after scrolling it
 * into view. Returns what was drawn before the release, what the press landed
 * on, and what ended up picked.
 */
const burst = (page, ref, from, path) => page.evaluate(async ({ ref, from, path }) => {
  const el = document.querySelector(`[data-node-id="${ref.id}"]`);
  el.scrollIntoView({ block: "center" });
  await new Promise((f) => setTimeout(f, 300));
  const R = el.getBoundingClientRect();
  const k = R.width / ref.w;
  const at = ([x, y]) => [R.left + (x - ref.x) * k, R.top + (y - ref.y) * k];
  const [x0, y0] = at(from);
  const target = document.elementFromPoint(x0, y0);
  const pressedOn = target?.closest("[data-node-id]")?.getAttribute("data-node-id") ?? (target?.closest("[data-frame]") ? "frame" : "elsewhere");
  const o = (x, y, buttons) => ({ bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons });
  const frame = () => new Promise((f) => requestAnimationFrame(() => requestAnimationFrame(() => f())));
  target.dispatchEvent(new PointerEvent("pointerdown", o(x0, y0, 1)));
  await frame();
  const points = path.map(at);
  for (const [x, y] of points.slice(0, -1)) {
    target.dispatchEvent(new PointerEvent("pointermove", o(x, y, 1)));
    await frame();
  }
  const m = document.querySelector("[data-marquee]")?.getBoundingClientRect();
  const drawnBefore = m && m.width > 2 && m.height > 2 ? [Math.round(m.width), Math.round(m.height)] : null;
  // The last move and the release in ONE task: no render between them.
  const [xl, yl] = points[points.length - 1];
  target.dispatchEvent(new PointerEvent("pointermove", o(xl, yl, 1)));
  target.dispatchEvent(new PointerEvent("pointerup", o(xl, yl, 0)));
  await new Promise((f) => setTimeout(f, 500));
  const picked = [...document.querySelectorAll("[data-node-id]")].filter((n) => n.querySelector('[data-mode="live"]')).map((n) => n.getAttribute("data-node-id")).sort();
  return { pressedOn, drawnBefore, picked };
}, { ref, from, path });

const open = async () => {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  await context.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await context.newPage();
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2000);
  return page;
};

/* 1. Begun on the navigation box, below its buttons, drawn up and right. The
      rectangle covers b2 from the fourth move on; only the LAST move brings
      b1 inside it too. */
let page = await open();
const nav = { id: "nav", x: 0, y: 229, w: 255 };
const navBefore = await page.locator('[data-node-id="nav"]').boundingBox();
const a = await burst(page, nav, [8, 400], [[60, 380], [120, 360], [200, 340], [245, 283], [245, 232]]);
check("the press landed on the navigation box", a.pressedOn === "nav", a.pressedOn);
check("the marquee was drawn before the release", !!a.drawnBefore, JSON.stringify(a.drawnBefore));
check("released in the same task as the last move, it takes what that move covered: both buttons", JSON.stringify(a.picked) === JSON.stringify(["b1", "b2"]), a.picked.join(", ") || "nothing");
check("…and not the box it was drawn across", !a.picked.includes("nav"));
const navAfter = await page.locator('[data-node-id="nav"]').boundingBox();
check("…and the box did not move", Math.abs(navAfter.x - navBefore.x) < 1 && Math.abs(navAfter.y - navBefore.y) < 1);
await page.context().close();

/* 2. Begun on the bare page, drawn right. Only the LAST move brings p2 inside. */
page = await open();
const p1 = { id: "p1", x: 600, y: 300, w: 120 };
const b = await burst(page, p1, [580, 280], [[640, 360], [700, 370], [760, 370], [870, 370], [890, 370]]);
check("the press landed on the bare page", b.pressedOn === "frame", b.pressedOn);
check("the marquee was drawn before the release", !!b.drawnBefore, JSON.stringify(b.drawnBefore));
check("released in the same task as the last move, it takes both leaves", JSON.stringify(b.picked) === JSON.stringify(["p1", "p2"]), b.picked.join(", ") || "nothing");
await page.context().close();

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
