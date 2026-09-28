/**
 * ON THE ZOOMED BOARD, WHAT THE HAND DOES LANDS UNDER THE HAND.
 *
 * The board draws its page with CSS `zoom` (Canvas.tsx, `tests/board-crisp`)
 * rather than `transform: scale`, and CSS zoom changes what rectangles and
 * computed lengths read. So every gesture that turns a pointer into the page
 * and back is held here at the owner's zooms, 0.79 and 0.83, on the screen:
 *
 *   · a drag: the point pressed on a part stays under the pointer;
 *   · a resize handle: the corner dragged ends under the pointer;
 *   · the selection box: its handles sit on the part's own corners;
 *   · a marquee: the drawn rectangle runs from the press to the pointer, and
 *     picks what it was drawn round;
 *   · snapping: the guide is drawn on the edge it snapped to, and the part
 *     ends on it;
 *   · a right press: the wheel opens centred on the pointer.
 *
 * Every expected number is read off the board; the moves are whole page
 * pixels on the 8px grid, so snapping has nothing to round.
 *
 *   node tests/board-zoom-pointer.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const URL_ = process.argv[2] ?? "http://127.0.0.1:3013";
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const J = (x) => JSON.stringify(x);
const near = (a, b, e = 1.01) => Math.abs(a - b) <= e;

const node = (id, x, y, w, h, bg) => ({
  id, pageId: "page_home", featureId: "box", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: { bg }, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  radius: 20, edge: { width: 4, style: "solid", colour: "rgb(26, 15, 11)" },
});
const doc = JSON.stringify({ state: {
  pages: [{ id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [node("a", 304, 200, 240, 88, "rgb(166, 216, 111)"), node("b", 704, 424, 200, 120, "rgb(120, 180, 240)")],
  groups: [], shapes: [], format: {}, brief: { name: "POINTER", gimmick: "", master: "" },
  frameWidth: 1440, activePageId: "page_home", trail: [], swept: 999,
}, version: 0 });

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
for (const [target, h] of [[0.79, 1082], [0.83, 1118]]) {
  const ctx = await browser.newContext({ viewport: { width: 1800, height: h }, deviceScaleFactor: 1 });
  await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
  await page.waitForTimeout(2500);
  const Z = `at ${target}`;
  const frame = () => page.evaluate(() => { const r = document.querySelector("[data-frame]").getBoundingClientRect(); return { x: r.left, y: r.top, z: r.width / 1440 }; });
  const rect = (sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }, sel);
  const stored = () => page.evaluate(() => { const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {}; return { nodes: Object.fromEntries((s.nodes ?? []).map((n) => [n.id, [n.x, n.y, n.w, n.h]])) }; });
  const glide = async (x0, y0, x1, y1, steps = 12) => { for (let i = 1; i <= steps; i++) await page.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps); };
  let f = await frame();
  check(`${Z}: the board fits at about ${target}`, near(f.z, target, 0.012), `applied ${f.z.toFixed(4)}`);

  /* A drag: pressed 30 × 20 page px into the part, moved 80 × 48 page px. */
  {
    const a0 = await rect('[data-node-id="a"]');
    const px = a0.x + 30 * f.z, py = a0.y + 20 * f.z;
    await page.mouse.move(px, py); await page.mouse.down();
    const tx = px + 80 * f.z, ty = py + 48 * f.z;
    await glide(px, py, tx, ty); await page.mouse.up(); await page.waitForTimeout(300);
    f = await frame();
    const a1 = await rect('[data-node-id="a"]');
    const s = await stored();
    check(`${Z}: drag — the point pressed is still under the pointer`, near(tx - a1.x, 30 * f.z) && near(ty - a1.y, 20 * f.z), `pointer ${[tx - a1.x, ty - a1.y].map((v) => v.toFixed(2))} into the part, pressed at ${[30 * f.z, 20 * f.z].map((v) => v.toFixed(2))}`);
    check(`${Z}: drag — the part moved 80 × 48 in the page`, J(s.nodes.a?.slice(0, 2)) === J([384, 248]), J(s.nodes.a));
  }

  /* The selection box: a press on b, its corner handles on its corners. */
  {
    const b0 = await rect('[data-node-id="b"]');
    await page.mouse.click(b0.x + 40, b0.y + 40); await page.waitForTimeout(400);
    f = await frame();
    const b = await rect('[data-node-id="b"]');
    const hd = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-node-id="b"] [data-resize]')].map((e) => { const r = e.getBoundingClientRect(); return [e.dataset.resize, [r.left + r.width / 2, r.top + r.height / 2]]; })));
    const corners = { nw: [b.x, b.y], ne: [b.r, b.y], se: [b.r, b.b], sw: [b.x, b.b] };
    const off = Object.entries(corners).map(([k, [x, y]]) => [k, hd[k] ? Math.max(Math.abs(hd[k][0] - x), Math.abs(hd[k][1] - y)) : Infinity]);
    check(`${Z}: selection box — its corner handles sit on the part's corners`, off.every(([, d]) => d <= 1.5), J(off.map(([k, d]) => [k, +d.toFixed(2)])));

    /* A resize from the bottom-right handle, 48 × 32 page px. */
    const [hx, hy] = hd.se;
    await page.mouse.move(hx, hy); await page.mouse.down();
    const tx = hx + 48 * f.z, ty = hy + 32 * f.z;
    await glide(hx, hy, tx, ty); await page.mouse.up(); await page.waitForTimeout(300);
    const b1 = await rect('[data-node-id="b"]');
    const s = await stored();
    check(`${Z}: resize — the corner ends under the pointer`, near(b1.r, tx, 1.5) && near(b1.b, ty, 1.5), `corner ${[b1.r, b1.b].map((v) => v.toFixed(2))}, pointer ${[tx, ty].map((v) => v.toFixed(2))}`);
    check(`${Z}: resize — the part is 48 × 32 larger in the page`, J(s.nodes.b?.slice(2)) === J([248, 152]), J(s.nodes.b));
  }

  /* A marquee from bare page above-left of a to below-right of it (not reaching b). */
  {
    f = await frame();
    const a = await rect('[data-node-id="a"]');
    const sx = a.x - 40 * f.z, sy = a.y - 40 * f.z;
    await page.mouse.click(f.x + 1300 * f.z, f.y + 60 * f.z); await page.waitForTimeout(200);
    await page.mouse.move(sx, sy); await page.mouse.down();
    const tx = a.r + 30 * f.z, ty = a.b + 30 * f.z;
    await glide(sx, sy, tx, ty);
    await page.waitForTimeout(100);
    const m = await rect("[data-marquee]");
    check(`${Z}: marquee — the rectangle runs from the press to the pointer`, !!m && near(m.x, sx, 1.5) && near(m.y, sy, 1.5) && near(m.r, tx, 1.5) && near(m.b, ty, 1.5), m ? `${[m.x, m.y, m.r, m.b].map((v) => v.toFixed(1))} against ${[sx, sy, tx, ty].map((v) => v.toFixed(1))}` : "no marquee");
    await page.mouse.up(); await page.waitForTimeout(300);
    /* Picked is what shows the selection's handles (the selection is not written to storage). */
    const picked = await page.evaluate(() => [...document.querySelectorAll("[data-node-id]")].filter((e) => e.querySelector(":scope [data-resize]")).map((e) => e.getAttribute("data-node-id")));
    check(`${Z}: marquee — it picks what it was drawn round, and only that`, J(picked) === J(["a"]), J(picked));
  }

  /* Snapping: a's left edge taken to 5 page px short of b's; the guide on b's edge, a ends on it. */
  {
    f = await frame();
    await page.mouse.click(f.x + 1300 * f.z, f.y + 60 * f.z); await page.waitForTimeout(200);
    const a = await rect('[data-node-id="a"]'), b = await rect('[data-node-id="b"]');
    const s0 = await stored();
    const dx = (s0.nodes.b[0] - 5 - s0.nodes.a[0]) * f.z;
    const px = a.x + 30 * f.z, py = a.y + 20 * f.z;
    await page.mouse.move(px, py); await page.mouse.down();
    await glide(px, py, px + dx, py + 200 * f.z, 16);
    await page.waitForTimeout(100);
    const g = await page.evaluate(() => [...document.querySelectorAll("svg line")].filter((l) => l.getAttribute("stroke") === "var(--accent)" && l.getAttribute("x1") === l.getAttribute("x2")).map((l) => l.getBoundingClientRect().left + l.getBoundingClientRect().width / 2));
    await page.mouse.up(); await page.waitForTimeout(300);
    const a1 = await rect('[data-node-id="a"]');
    const s = await stored();
    check(`${Z}: snap — a guide is drawn on b's left edge`, g.some((x) => near(x, b.x, 1.5)), `guides ${J(g.map((x) => +x.toFixed(1)))}, b's edge ${b.x.toFixed(1)}`);
    check(`${Z}: snap — a ends on it, in the page and on the screen`, s.nodes.a?.[0] === s.nodes.b?.[0] && near(a1.x, b.x), `${s.nodes.a?.[0]} / ${s.nodes.b?.[0]}; ${a1.x.toFixed(2)} / ${b.x.toFixed(2)}`);
  }

  /* A right press: the wheel opens centred on the pointer, on a part and on the bare page. */
  for (const [what, at] of [["a part", async () => { const b = await rect('[data-node-id="b"]'); return [b.x + 37.3, b.y + 29.7]; }], ["the bare page", async () => { f = await frame(); return [f.x + 1200.5 * f.z, f.y + 700.25 * f.z]; }]]) {
    await page.keyboard.press("Escape"); await page.waitForTimeout(200);
    const [x, y] = await at();
    await page.mouse.move(x, y); await page.mouse.down({ button: "right" }); await page.waitForTimeout(250);
    const c = await page.evaluate(() => { const e = document.querySelector("[data-radial] > div.absolute"); if (!e) return null; const r = e.getBoundingClientRect(); return [r.left, r.top]; });
    await page.mouse.up({ button: "right" }); await page.waitForTimeout(200);
    await page.keyboard.press("Escape"); await page.waitForTimeout(250);
    check(`${Z}: right press on ${what} — the wheel opens on the pointer`, !!c && near(c[0], x, 1.5) && near(c[1], y, 1.5), c ? `${c.map((v) => v.toFixed(1))} against ${[x, y].map((v) => v.toFixed(1))}` : "no wheel");
  }
  check(`${Z}: no page error`, errors.length === 0, errors.join(" / "));
  await ctx.close();
}
await browser.close();
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
