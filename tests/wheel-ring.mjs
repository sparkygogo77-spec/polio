/**
 * THE WHEEL'S POP-UPS ON BOTH SHAPES, ON EVERY REPO FIXTURE.
 *
 * The round wheel wears the ring (design C): Edge's controls on a slab of a ring
 * round the wheel, out past it at the slab's angle, the per-corner pop-up
 * further round the same ring. The square menu wears the tag (design A). One
 * drag is one undo step on the ring as on the tag; Esc closes the smaller one,
 * then it. Texture, Aura and Hue open pop-ups too, on both shapes: change a
 * value in each, the part's drawn look changes, one undo puts the part back.
 * No page errors.
 *
 *   node tests/wheel-ring.mjs http://localhost:3451 <folder holding sites/>
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
const BASE = (process.argv[2] ?? "http://localhost:3451").replace(/\/$/, "");
const SINK = process.argv[3] ?? process.env.SINK ?? "capture";
const SITES = (process.env.SITES ?? "share-xyz,trumpmorty-fun,gotchi-gg,stonkfun-xyz,parasiteonsol-fun,trendtrader-pro").split(",");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? `: ${detail}` : ""}`); };

const browser = await chromium.launch({ headless: true, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: (process.env.CHROMIUM_ARGS ?? "").split(" ").filter(Boolean) });

async function runSite(site) {
  const file = join(SINK, "sites", site, "site", "document.json");
  if (!existsSync(file)) { check(`${site}: its capture is here`, false, file); return; }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30_000);
  const errors = [];
  /* The Builder's errors; a dev server's first compile of /api/version (which `openBoard` passes through) can answer 500, and that is not the Builder. */
  page.on("pageerror", (e) => { if (!page.url().includes("/api/version")) errors.push(`${e.message} @ ${String(e.stack).split("\n").slice(1, 3).join(" ").trim()}`); });
  await ctx.route("https://api.github.com/**", (r) => r.abort());
  await openBoard(page, BASE, "solface");
  const doc = JSON.parse(readFileSync(file, "utf8"));
  await page.evaluate((d) => window.__studioLoadDoc(d), { ...doc, activePageId: doc.pages[0].id });
  await page.waitForTimeout(2500);

  /* A plain part in view, big enough to press, near the middle so the wheel has room round it. */
  const target = await page.evaluate(() => {
    const nodes = window.__studioHistory.doc().nodes;
    const ok = [...document.querySelectorAll("[data-node-id]")].map((el) => {
      const r = el.getBoundingClientRect();
      const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      const n = nodes.find((x) => x.id === el.getAttribute("data-node-id"));
      return { id: n?.id, x: r.x + r.width / 2, y: r.y + r.height / 2, w: r.width, h: r.height, own: hit?.closest("[data-node-id]") === el, feature: n?.featureId, locked: n?.locked, shape: n?.shape };
    }).filter((p) => p.id && p.own && !p.locked && !p.shape && p.w > 60 && p.h > 24 && p.y > 200 && p.y < innerHeight - 200 && p.x > 500 && p.x < innerWidth - 300);
    return ok.find((p) => p.feature === "box") ?? ok[0] ?? null;
  });
  if (!target) { check(`${site}: a part to press`, false); await ctx.close(); return; }
  const node = () => page.evaluate((id) => window.__studioHistory.doc().nodes.find((n) => n.id === id), target.id);
  const past = () => page.evaluate(() => (window.__studioHistory.rows?.() ?? []).length);
  /* What the part looks like, drawn: its own and its insides' paint. */
  const drawn = () => page.evaluate((id) => {
    const el = document.querySelector(`[data-node-id="${id}"]`);
    if (!el) return "gone";
    return [el, ...el.querySelectorAll("*")].slice(0, 300).map((e) => { const s = getComputedStyle(e); return [s.backgroundColor, s.backgroundImage, s.boxShadow, s.color, s.filter, s.borderTopLeftRadius].join("|"); }).join("\n");
  }, target.id);
  /* Which of the part's values differ from a JSON copy taken before. */
  const differs = async (was) => { const a = JSON.parse(was), b = await node(); return [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).map((k) => `${k} ${JSON.stringify(a[k])} to ${JSON.stringify(b[k])}`).join("; "); };
  /* The first line of paint that differs, to say what moved. */
  const lineDiff = (a, b) => { const x = a.split("\n"), y = b.split("\n"); const i = x.findIndex((l, k) => l !== y[k]); return i < 0 ? `${x.length} vs ${y.length} lines` : `#${i}: ${x[i]} || ${y[i]}`; };
  /* Undo puts the selection back as it was too; the part is picked again so its paint is read in the same state. */
  const settle = async (want) => {
    await page.evaluate((id) => window.__studioHistory.act("setSelection", [id]), target.id);
    for (let i = 0; i < 20 && (await drawn()) !== want; i++) await page.waitForTimeout(150);
  };
  const open = async (which) => {
    await page.mouse.click(target.x, target.y, { button: "right" });
    await page.waitForTimeout(450);
    await page.locator('[data-radial] [data-shard="look"]').click({ force: true });
    await page.waitForTimeout(350);
    await page.locator(`[data-radial] [data-shard="${which}"]`).click({ force: true });
    await page.waitForTimeout(450);
  };
  const closeAll = async () => { for (let i = 0; i < 5 && (await page.locator("[data-radial]").count()); i++) { await page.keyboard.press("Escape"); await page.waitForTimeout(150); } };
  const box = async (sel) => ((await page.locator(sel).count()) ? page.locator(sel).first().boundingBox() : null);
  const inWindow = (b) => !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= 1440 && b.y + b.height <= 900;
  const shapeOf = async (which) => ((await page.locator(`[data-wheel-popup="${which}"]`).count()) ? page.locator(`[data-wheel-popup="${which}"]`).getAttribute("data-popup-shape") : null);
  const frames = () => page.locator("[data-wheel-popup-frame]").count();
  const drag = async (sel, to) => {
    const s = await box(sel);
    await page.mouse.move(s.x + 3, s.y + s.height / 2);
    await page.mouse.down();
    await page.mouse.move(s.x + s.width * to * 0.6, s.y + s.height / 2, { steps: 4 });
    await page.mouse.move(s.x + s.width * to, s.y + s.height / 2, { steps: 4 });
    await page.mouse.up();
    await page.waitForTimeout(350);
  };

  /* ---- Round: the ring ---- */
  await page.evaluate(() => window.__studioHistory.act("setMenuShape", "round"));
  await open("edge");
  check(`${site}: on the round wheel Edge opens the ring`, (await shapeOf("edge")) === "ring" && (await frames()) === 1 && (await page.locator('[data-radial-editor="edge"]').count()) === 0, `${await shapeOf("edge")}, ${await frames()} frame`);
  if ((await shapeOf("edge")) === "ring") {
    const ring = await page.evaluate(() => {
      const g = document.querySelector('[data-wheel-popup-frame="main"]');
      const p = document.querySelector('[data-wheel-popup="edge"]').getBoundingClientRect();
      const cx = Number(g.getAttribute("data-ring-cx")), cy = Number(g.getAttribute("data-ring-cy")), rIn = Number(g.getAttribute("data-ring-in"));
      const near = Math.hypot(Math.max(p.x - cx, 0, cx - p.x - p.width), Math.max(p.y - cy, 0, cy - p.y - p.height));
      /* The wheel's own pieces come in to here at their nearest corner; the ring starts past every one. */
      const reach = Math.max(...[...document.querySelectorAll("[data-radial] [data-shard]")].map((el) => { const r = el.getBoundingClientRect(); return Math.min(...[[r.x, r.y], [r.right, r.y], [r.x, r.bottom], [r.right, r.bottom]].map(([x, y]) => Math.hypot(x - cx, y - cy))); }));
      const shard = document.querySelector('[data-radial] [data-shard="edge"]').getBoundingClientRect();
      const slabWay = Math.atan2(shard.y + shard.height / 2 - cy, shard.x + shard.width / 2 - cx);
      const popWay = Math.atan2(p.y + p.height / 2 - cy, p.x + p.width / 2 - cx);
      const turn = Math.abs(Math.atan2(Math.sin(popWay - slabWay), Math.cos(popWay - slabWay)));
      return { near, rIn, reach, turn };
    });
    check(`${site}: the ring stands out past the wheel, round it at the slab's angle`, ring.near >= ring.rIn - 1 && ring.rIn >= ring.reach && ring.turn < 0.9, `controls ${Math.round(ring.near)}px out, ring from ${Math.round(ring.rIn)}, pieces to ${Math.round(ring.reach)}, ${ring.turn.toFixed(2)} rad off the slab`);
    check(`${site}: the ring is inside the window`, inWindow(await box('[data-wheel-popup="edge"]')));

    const wasN = JSON.stringify(await node());
    const wasDrawn = await drawn();
    const steps0 = await past();
    await drag('[data-popup-slider="Corners"] input', 0.5);
    check(`${site}: on the ring a drag of the corners is one undo step`, (await past()) === steps0 + 1 && (await node()).radius > 0, `${steps0} to ${await past()}, radius ${(await node()).radius}`);
    await page.keyboard.press("Control+z");
    await settle(wasDrawn);
    check(`${site}: undo puts the corners back`, JSON.stringify(await node()) === wasN && (await drawn()) === wasDrawn, `${await differs(wasN)}${(await drawn()) === wasDrawn ? "" : ` (drawn differs ${lineDiff(wasDrawn, await drawn())})`}`);

    await page.locator('[data-popup-key="Each corner"]').click();
    await page.waitForTimeout(300);
    const big = await box('[data-wheel-popup="edge"]'), small = await box('[data-wheel-popup="corners"]');
    const cross = small && big && !(small.x + small.width <= big.x || big.x + big.width <= small.x || small.y + small.height <= big.y || big.y + big.height <= small.y);
    check(`${site}: Each corner opens further round the ring`, !!small && !cross && inWindow(small) && (await shapeOf("corners")) === "ring" && (await frames()) === 2);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    check(`${site}: Esc closes the smaller ring first`, (await page.locator('[data-wheel-popup="corners"]').count()) === 0 && (await page.locator('[data-wheel-popup="edge"]').count()) === 1);
    await page.keyboard.press("Escape");
    await page.waitForTimeout(150);
    check(`${site}: then Esc closes the ring`, (await page.locator('[data-wheel-popup="edge"]').count()) === 0 && (await frames()) === 0);
    await closeAll();
    await open("edge");
    await page.mouse.click(target.x, target.y);
    await page.waitForTimeout(200);
    check(`${site}: a press away closes the ring`, (await page.locator('[data-wheel-popup="edge"]').count()) === 0);
  }
  await closeAll();

  /* ---- Square: the tag ---- */
  await page.evaluate(() => window.__studioHistory.act("setMenuShape", "square"));
  await open("edge");
  check(`${site}: on the square menu Edge opens the tag`, (await shapeOf("edge")) === "tag" && (await frames()) === 0, String(await shapeOf("edge")));
  await closeAll();

  /* ---- Texture, Aura, Hue, on both shapes ---- */
  const png = await page.evaluate(() => { const c = document.createElement("canvas"); c.width = c.height = 32; const g = c.getContext("2d"); for (let i = 0; i < 32; i += 4) { g.fillStyle = i % 8 ? "#e33" : "#3e3"; g.fillRect(i, 0, 4, 32); } return c.toDataURL("image/png").split(",")[1]; });
  const edits = {
    texture: {
      what: "a picture of its own",
      run: async () => {
        await page.locator('[data-wheel-popup="texture"] input[type="file"]').setInputFiles({ name: "stripes.png", mimeType: "image/png", buffer: Buffer.from(png, "base64") });
        for (let i = 0; i < 20 && !(await node()).texture; i++) await page.waitForTimeout(150);
        const n = await node();
        return { stored: !!n.texture && n.texture !== "none", detail: `texture ${n.texture}` };
      },
    },
    aura: {
      what: "an aura colour",
      run: async () => {
        const was = (await node()).aura ?? "";
        const sw = page.locator('[data-wheel-popup="aura"] [data-popup-swatch$=" aura"]:not([data-popup-swatch="No aura"])');
        for (let i = 0; i < (await sw.count()); i++) {
          await sw.nth(i).click();
          await page.waitForTimeout(250);
          if (((await node()).aura ?? "") !== was) break;
        }
        const n = await node();
        return { stored: !!n.aura && n.aura !== was, detail: `aura ${n.aura}` };
      },
    },
    hue: {
      what: "the background's lightness",
      run: async () => {
        await drag('[data-wheel-popup="hue"] [data-popup-slider="Lightness"] input', 0.97);
        const n = await node();
        return { stored: !!n.colour?.bg, detail: `bg ${n.colour?.bg}` };
      },
    },
  };
  for (const shape of ["round", "square"]) {
    await page.evaluate((s) => window.__studioHistory.act("setMenuShape", s), shape);
    const want = shape === "round" ? "ring" : "tag";
    for (const [which, e] of Object.entries(edits)) {
      await open(which);
      const got = await shapeOf(which);
      check(`${site}: on the ${shape} wheel ${which} opens the ${want}`, got === want && (await frames()) === (want === "ring" ? 1 : 0) && (await page.locator(`[data-radial-editor="${which}"]`).count()) === 0 && inWindow(await box(`[data-wheel-popup="${which}"]`)), String(got));
      if (got !== want) { await closeAll(); continue; }
      const before = JSON.stringify(await node());
      const look = await drawn();
      const steps0 = await past();
      const r = await e.run();
      await page.waitForTimeout(300);
      const after = await drawn();
      check(`${site}: ${shape}, ${which}: ${e.what} is stored and the part changes`, r.stored && after !== look, r.detail);
      /* A picture is two steps, as on the slabs: the layer joins the site's stack, then the part wears it. */
      const steps = (await past()) - steps0;
      await page.keyboard.press("Control+z");
      await settle(look);
      check(`${site}: ${shape}, ${which}: one undo puts the part back`, JSON.stringify(await node()) === before && (await drawn()) === look, `${steps} step(s) ${await differs(before)}${(await drawn()) === look ? "" : ` (drawn differs ${lineDiff(look, await drawn())})`}`);
      if (steps > 1) { for (let i = 1; i < steps; i++) await page.keyboard.press("Control+z"); await page.waitForTimeout(200); }
      await closeAll();
    }
  }
  await page.evaluate(() => window.__studioHistory.act("setMenuShape", "square"));
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
