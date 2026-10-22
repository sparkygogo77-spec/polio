#!/usr/bin/env node
/**
 * DRAWING WITH A SITE'S STYLE, BY HAND, ON TRUMPMORTY.FUN.
 *
 * The owner: "If I have this theme of buttons on the Trump & Morty site, I
 * should be able to select the theme or another for the button I'm drawing,
 * so a cone would come out with the same shadow behind it, a lighting bar
 * on it maybe, and then decide after it's drawn what colour and how it
 * behaves." Held here, through the real tool and a real hand:
 *
 *   · the space tool's options list this site's kits first and Plain last;
 *   · a rough cone drawn wearing "Trorty button" snaps to a clean triangle
 *     and wears the kit: its shadow is the triangle moved by the page's
 *     0 10px (never the box round it: the box's corners stay bare, and the
 *     shadow shows beside the slanted sides, where no box shadow reaches);
 *   · the lighting bar is the kit's own (the gloss laid inside the remote
 *     keys, white at 0.35, 10px in): it runs along the cone's long axis on
 *     its lit side and is clipped inside it; turned off and on, pixels
 *     inside change and pixels outside do not;
 *   · the snap is undone back to the line as drawn and snapped again; a
 *     rough circle snaps to a circle; with Snap off the line stays;
 *   · its options are in the part panel: Look (what it is, colour, style,
 *     lighting bar, outline) and Motion; a point dragged there moves the outline;
 *   · a motion captured on a board (a wobble, a pulse) put on the cone runs
 *     on the exported page, from the page's own stylesheet, and nothing
 *     in the export points at the Builder.
 *
 * Writes .screenshots/lane-j/ (ignored): the source button beside the cone,
 * the part panel, the exported page. docs/shots/lane-j-*.png are the
 * committed record, copied by hand.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/draw-with-kit.mjs http://127.0.0.1:3013
 */
import { mkdirSync, mkdtempSync, writeFileSync, existsSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import http from "node:http";
import { board, checker, J } from "./fixtures/draw-board.mjs";

const { check, done } = checker();
const SHOTS = process.env.SHOTS ?? ".screenshots/lane-j";
mkdirSync(SHOTS, { recursive: true });
const b = await board(process.argv[2] ?? "http://127.0.0.1:3013", { viewport: { width: 1500, height: 1000 } });
const p = b.page;
await b.load();

const worn = async () => (await b.nodes()).filter((n) => n.worn);
const lastWorn = async () => (await worn()).at(-1) ?? null;
const pane = async () => p.locator("[data-ctx='studio-canvas']").first().boundingBox();

/** A hand: press, move through the points with a little tremor, let go. */
const draw = async (pts) => {
  await p.mouse.move(pts[0][0], pts[0][1]);
  await p.mouse.down();
  for (const [i, [x, y]] of pts.entries()) { await p.mouse.move(x + Math.sin(i * 2.3) * 1.5, y + Math.cos(i * 1.7) * 1.5); await p.waitForTimeout(6); }
  await p.mouse.up();
  await p.waitForTimeout(700);
};
const seg = (a, c, n) => Array.from({ length: n }, (_, i) => [a[0] + ((c[0] - a[0]) * i) / n, a[1] + ((c[1] - a[1]) * i) / n]);
/** An ice-cream cone, point down, drawn as one line ending a little short of where it began. */
const cone = (cx, top, hw, hgt) => [...seg([cx - hw, top], [cx + hw, top], 18), ...seg([cx + hw, top], [cx, top + hgt], 18), ...seg([cx, top + hgt], [cx - hw + 6, top + 8], 18)];
const circle = (cx, cy, r) => Array.from({ length: 44 }, (_, i) => { const a = (i / 43) * Math.PI * 2 * 0.97; return [cx + Math.cos(a) * r * (1 + Math.sin(i * 1.3) * 0.04), cy + Math.sin(a) * r * (1 + Math.cos(i * 1.1) * 0.04)]; });

/** The lighting bar as drawn: gloss or inset, which way the light comes from, and whether it is cut to the outline. */
const bandOf = (id) => p.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-worn]`);
  const g = el?.querySelector("[data-worn-band='bar']");
  const clipId = /url\(#(.+)\)/.exec(g?.getAttribute("clip-path") ?? "")?.[1];
  const clip = clipId ? el.querySelector(`[id="${clipId}"] path`) : null;
  return g ? { gloss: g.hasAttribute("data-gloss"), normal: g.getAttribute("data-normal"), opacity: g.getAttribute("data-opacity"), clipped: !!clip && clip.getAttribute("d") === el.querySelector("[data-worn-body]").getAttribute("d") } : null;
}, id);
/** Is a "x,y" normal within a tenth of the expected one? */
const facing = (normal, [ex, ey]) => { const [x, y] = String(normal ?? "").split(",").map(Number); return Math.abs(x - ex) < 0.1 && Math.abs(y - ey) < 0.1; };
const pickSpace = async () => { await p.mouse.move(750, 480); await p.keyboard.press("Escape"); await p.keyboard.press("s"); await p.waitForTimeout(300); };

/* ------------------------------------------------------------ the picker */
await pickSpace();
check("the space tool's options carry the style picker", (await p.locator("[data-tool-options='space'] [data-kit-picker]").count()) === 1);
await p.locator("[data-kit-picked]").click();
await p.waitForTimeout(700);
const listed = await p.locator("[data-kit-list] [data-kit-choice]").evaluateAll((els) => els.map((e) => e.getAttribute("data-kit-choice") === "plain" ? "Plain" : e.getAttribute("data-kit-name")));
check("this site's kits first, the Trorty button at the top", listed[0] === "Trorty button", J(listed.slice(0, 4)));
check("Plain last", listed.at(-1) === "Plain", J(listed.slice(-2)));
check("kits are named plainly and never twice", new Set(listed).size === listed.length && listed.every((n) => /^[A-Za-z0-9$ ,“”.'\-&]+$/.test(n)), J(listed));
await p.screenshot({ path: join(SHOTS, "picker.png") });
await p.locator('[data-kit-name="Trorty button"]').click();
await p.waitForTimeout(300);
check("the bar says the kit in hand", (await p.locator("[data-kit-picked]").getAttribute("data-kit-picked"))?.includes(":button:0"));

/* ------------------------------------------------------------ a cone beside its source button */
const kitFrom = await p.evaluate(() => JSON.parse(localStorage.getItem("builder.drawKit") || "{}").state?.kit?.from?.[0] ?? null);
const src = kitFrom ? p.locator(`[data-node-id="${kitFrom}"]`).first() : null;
if (src) { await src.scrollIntoViewIfNeeded(); await p.waitForTimeout(400); }
let sb = src ? await src.boundingBox() : null;
const pb = await pane();
const coneX = sb ? Math.min(pb.x + pb.width - 120, sb.x + sb.width + 110) : pb.x + 400;
const coneTop = sb ? Math.max(pb.y + 40, sb.y - 40) : pb.y + 150;
await pickSpace();
await draw(cone(coneX, coneTop, 55, 170));
let c = await lastWorn();
check("a closed line drawn with a kit is a part wearing it, not a space", !!c && c.worn.kit.name === "Trorty button", c ? c.worn.kit.name : "none");
check("the rough cone snapped to a clean triangle", c?.worn.snap === "triangle" && c.worn.pts.length === 3, J(c?.worn.pts));
check("its part panel opens on it, with the shape's Look and Motion", (await p.locator(`[data-part-panel="${c?.id}"] [data-worn-look]`).count()) === 1 && (await p.locator(`[data-part-panel="${c?.id}"] [data-worn-motions]`).count()) === 1);
check("…its plain options come from the part's options data", (await p.locator(`[data-part-panel="${c?.id}"] [data-field="worn:what"]`).count()) === 1 && (await p.locator(`[data-part-panel="${c?.id}"] [data-field="worn:bar"]`).count()) === 1);
check("…and no floating popover is left on the board", (await p.locator("[data-worn-panel]").count()) === 0);

/* The shadow, in the drawing's own geometry. */
const geo = await p.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-worn]`);
  const body = el?.querySelector("[data-worn-body]");
  const sh = [...(el?.querySelectorAll("[data-worn-shadow-at]") ?? [])];
  if (!el || !body || !sh.length) return null;
  const bb = body.getBBox();
  const inFill = (x, y) => { const pt = el.querySelector("svg").createSVGPoint(); pt.x = x; pt.y = y; return body.isPointInFill(pt); };
  const t = sh[0].getAttribute("transform");
  const [dx, dy] = (/translate\(([-\d.]+) ([-\d.]+)\)/.exec(t) ?? []).slice(1).map(Number);
  // Where a box shadow would be and where this one is: the shadow is the body moved by (dx, dy).
  const shadowAt = (x, y) => inFill(x - dx, y - dy);
  // Beside the slanted side: a point on the row halfway down that is outside the cone and inside its shadow.
  const tipX = bb.x + bb.width / 2, rowY = bb.y + bb.height * 0.5;
  let side = false;
  for (let x = tipX; x < bb.x + bb.width + 20 && !side; x += 0.5) side = !inFill(x, rowY) && shadowAt(x, rowY);
  return {
    count: sh.length, at: sh[0].getAttribute("data-worn-shadow-at"), same: sh[0].getAttribute("d") === body.getAttribute("d"), dx, dy,
    corner: shadowAt(bb.x + bb.width * 0.06, bb.y + bb.height + dy / 2),
    side,
    underBase: shadowAt(tipX, bb.y + bb.height + dy / 2),
    fill: body.getAttribute("fill"), border: el.querySelector("[data-worn-border]")?.getAttribute("stroke"),
  };
}, c?.id);
check("one shadow, at the kit's 0 10px, drawn from the outline itself", geo?.count === 1 && geo.at === "0,10" && geo.same && geo.dx === 0 && geo.dy === 10, J(geo));
check("the shadow follows the outline: none under the box's corner, some beside the slanted side and under the tip", geo && !geo.corner && geo.side && geo.underBase, J(geo));
{
  const tall = await bandOf(c.id);
  check("on a cone taller than wide, the lighting bar runs down its side, lit from the left", c.h > c.w && facing(tall?.normal, [-1, 0]) && tall.clipped, J({ tall, w: c.w, h: c.h }));
}
check("the border traces the outline in the kit's colour", geo?.border === c?.worn.kit.border?.colour, `${geo?.border} vs ${c?.worn.kit.border?.colour}`);

await p.keyboard.press("Escape");
await p.waitForTimeout(300);
if (src) {
  sb = await src.boundingBox();
  const cb = await p.locator(`[data-node-id="${c.id}"]`).boundingBox();
  const x0 = Math.min(sb.x, cb.x) - 30, y0 = Math.min(sb.y, cb.y) - 30;
  const x1 = Math.max(sb.x + sb.width, cb.x + cb.width) + 40, y1 = Math.max(sb.y + sb.height, cb.y + cb.height) + 40;
  await p.screenshot({ path: join(SHOTS, "source-and-cone.png"), clip: { x: Math.max(0, x0), y: Math.max(0, y0), width: Math.min(1500, x1) - Math.max(0, x0), height: Math.min(1000, y1) - Math.max(0, y0) } });
}

/* ------------------------------------------------------------ a captured motion, exported */
/* Picked again with the hand, its part panel comes back. */
await p.keyboard.press("Escape");
await p.keyboard.press("v");
{
  const cbb = await p.locator(`[data-node-id="${c.id}"]`).boundingBox();
  await p.mouse.click(cbb.x + cbb.width / 2, cbb.y + cbb.height * 0.3);
  await p.waitForTimeout(500);
}
check("picked again, its part panel is back", (await p.locator(`[data-part-panel="${c.id}"] [data-worn-look]`).count()) === 1);
const motions = await p.locator("[data-part-panel] [data-worn-motion]").evaluateAll((els) => els.map((e) => ({ id: e.getAttribute("data-worn-motion"), says: e.getAttribute("data-worn-motion-name") ?? "Still" })));
check("the motion list is built from the boards' captured motions", motions.length > 3 && motions.some((m) => /Wobble|Blink|Pulse|Float/.test(m.says)), J(motions.map((m) => m.says)));
const wobble = motions.find((m) => /Pulse/.test(m.says)) ?? motions.find((m) => /Wobble|Float/.test(m.says)) ?? motions[1];
await p.locator(`[data-part-panel] [data-worn-motion="${wobble.id}"]`).click();
await p.locator("[data-part-panel] [data-field='worn:strength'] input").fill("2");
await p.waitForTimeout(300);
await p.screenshot({ path: join(SHOTS, "part-panel.png") });
c = await lastWorn();
check("the cone wears the motion", c.worn.motion?.id === wobble.id && c.worn.motion.strength === 2, J(c.worn.motion && { id: c.worn.motion.id, strength: c.worn.motion.strength }));

const files = await p.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const html = files?.find((f) => f.path === "index.html")?.content ?? "";
const cls = `wk-${c.id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
check("the export draws the cone as its SVG, with its motion's keyframes beside it", html.includes(cls) && html.includes(`@keyframes ${cls}-move`) && /<svg[^>]*>[\s\S]*<path/.test(html), `${html.includes(cls)} ${html.includes(`@keyframes ${cls}-move`)}`);
check("nothing in the export points at the Builder", !/\/_next\/|\/builder|builder\.studio/.test(files?.filter((f) => typeof f.content === "string").map((f) => f.content).join("\n") ?? ""));
const out = mkdtempSync(join(tmpdir(), "draw-with-kit-"));
for (const f of files ?? []) { mkdirSync(dirname(join(out, f.path)), { recursive: true }); writeFileSync(join(out, f.path), f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content); }
const types = { html: "text/html", css: "text/css", js: "text/javascript", webp: "image/webp", png: "image/png", jpg: "image/jpeg", svg: "image/svg+xml", woff2: "font/woff2" };
const server = http.createServer((req, res) => {
  let f = join(out, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/^\/+/, ""));
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[f.split(".").pop()] ?? "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const site = await b.browser.newPage({ viewport: { width: 1440, height: 900 } });
await site.goto(`http://127.0.0.1:${server.address().port}/`, { waitUntil: "load" });
// The site's own loader (its captured television tuning in) stands over the page first; wait it out.
for (let i = 0; i < 40; i++) {
  const covered = await site.evaluate(() => [...document.querySelectorAll("body *")].some((e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return cs.position === "fixed" && r.width >= innerWidth * 0.9 && r.height >= innerHeight * 0.9 && cs.display !== "none" && cs.visibility !== "hidden" && Number(cs.opacity) > 0.05; }));
  if (!covered) break;
  await site.waitForTimeout(250);
}
await site.waitForTimeout(400);
const runs = await site.evaluate(async (cls) => {
  const el = document.querySelector(`.${cls} .wk-move`);
  if (!el) return null;
  el.scrollIntoView({ block: "center" });
  const name = getComputedStyle(el).animationName;
  const seen = new Set();
  for (let i = 0; i < 12; i++) { seen.add(getComputedStyle(el).transform); await new Promise((r) => setTimeout(r, 120)); }
  return { name, distinct: seen.size, shadow: !!document.querySelector(`.${cls} .wk-shadow path`) };
}, cls);
check("on the exported page the captured motion runs on the drawn shape", runs?.name === `${cls}-move` && runs.distinct > 2 && runs.shadow, J(runs));
const bbox = await site.locator(`.${cls}`).boundingBox();
if (bbox) {
  await site.locator(`.${cls}`).scrollIntoViewIfNeeded();
  const r = await site.locator(`.${cls}`).boundingBox();
  await site.screenshot({ path: join(SHOTS, "exported.png"), clip: { x: Math.max(0, r.x - 160), y: Math.max(0, r.y - 60), width: Math.min(1440, r.width + 320), height: Math.min(900, r.height + 120) } });
}
server.close();

/* ------------------------------------------------------------ on a bare board, in pixels */
const bare = await p.evaluate(() => { const d = window.__studioPublishDoc(); return { ...d, nodes: [], shapes: [], spaces: [], look: { ...d.look, texture: [], palette: { ...d.look.palette, bg: "rgb(40, 44, 60)" } } }; });
await p.evaluate((d) => window.__studioLoadDoc(d), bare);
await p.waitForTimeout(1200);
await p.evaluate(() => document.querySelector("[data-ctx='studio-canvas']")?.closest(".overflow-y-auto")?.scrollTo(0, 0));
await pickSpace();
const pb2 = await pane();
await draw(cone(pb2.x + 380, pb2.y + 120, 130, 200));
c = await lastWorn();
const box = async () => p.locator(`[data-node-id="${c.id}"] [data-worn]`).boundingBox();
const zoom = async () => { const bb = await box(); return bb.width / c.w; };
const shot = async () => p.screenshot({ clip: { x: 0, y: 0, width: 1500, height: 1000 } });
const { PNG } = await import("pngjs").catch(() => ({ PNG: null }));
const pixelsOf = async () => {
  const buf = await shot();
  if (PNG) { const png = PNG.sync.read(buf); return (x, y) => { const i = (Math.round(y) * png.width + Math.round(x)) * 4; return [png.data[i], png.data[i + 1], png.data[i + 2]]; }; }
  // No PNG reader here: read the pixels back in the page from the same screenshot.
  const data = buf.toString("base64");
  return async (x, y) => p.evaluate(async ({ data, x, y }) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
    return [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
  }, { data, x, y });
};
const near = (a, b2, tol = 14) => a.every((v, i) => Math.abs(v - b2[i]) <= tol);
const lum = (a) => a[0] + a[1] + a[2];
const cb = await box();
const z = await zoom();
const px = await pixelsOf();
const ground = await px(cb.x - 20, cb.y + cb.height + 5 * z);
const tipX = cb.x + cb.width * 0.5;
const cornerPx = await px(cb.x + cb.width * 0.05, cb.y + cb.height + 5 * z);
const body = await p.locator(`[data-node-id="${c.id}"] [data-worn-body]`).boundingBox();
const basePx = await px(body.x + body.width / 2, body.y + body.height + 5 * z);
check("in pixels: under the box's corner is the bare ground, where a box's shadow would be", near(cornerPx, ground), J({ cornerPx, ground }));
check("in pixels: under the tip is the kit's dark shadow, because the shadow is the cone's", lum(basePx) < lum(ground) - 30, J({ basePx, ground }));
await p.screenshot({ path: join(SHOTS, "cone-bare.png"), clip: { x: cb.x - 30, y: cb.y - 30, width: cb.width + 80, height: cb.height + 80 } });

/* The lighting bar: the keys' own gloss, laid along the cone and cut to it. */
check("the cone came out with the kit's lighting bar: the remote keys' gloss, white at 0.35, 10px in", c.worn.bar?.kind === "gloss" && c.worn.bar.opacity === 0.35 && c.worn.bar.colour === "rgb(255, 255, 255)" && c.worn.bar.edge === 10 && (await p.locator("[data-field='worn:bar'] [data-value='On']").getAttribute("aria-checked")) === "true", J(c.worn.bar));
const band = await bandOf(c.id);
check("…laid along the cone's long axis: wider than tall, so across its top, lit from above", c.w > c.h && band?.gloss && facing(band.normal, [0, -1]), J({ band, w: c.w, h: c.h }));
check("…and clipped to the outline", band?.clipped === true, J(band));
const top = await p.locator(`[data-node-id="${c.id}"] [data-worn-body]`).boundingBox();
const inside = [top.x + top.width * 0.5, top.y + 24 * z], outside = [top.x + top.width * 0.5, top.y - 3 * z];
const sideOut = [top.x - 3, top.y + 24 * z];
const on = { inside: await px(...inside), outside: await px(...outside), side: await px(...sideOut) };
await p.locator("[data-field='worn:bar'] [data-value='Off']").click();
await p.waitForTimeout(400);
const px2 = await pixelsOf();
const off = { inside: await px2(...inside), outside: await px2(...outside), side: await px2(...sideOut) };
check("in pixels: the bar lights the inside, and nothing outside the outline changes", lum(on.inside) > lum(off.inside) + 20 && near(on.outside, off.outside, 6) && near(on.side, off.side, 6), J({ on, off }));
await p.locator("[data-field='worn:bar'] [data-value='On']").click();
await p.waitForTimeout(400);
await p.screenshot({ path: join(SHOTS, "cone-with-bar.png"), clip: { x: cb.x - 30, y: cb.y - 30, width: cb.width + 80, height: cb.height + 80 } });

/* ------------------------------------------------------------ snap, undo, again */
const snapped = { x: c.x, y: c.y, w: c.w, h: c.h };
await p.locator("[data-worn-unsnap]").click();
await p.waitForTimeout(400);
c = await lastWorn();
check("undo takes the snap back to the line as drawn", c.worn.snap === null && c.worn.pts.length > 12 && c.worn.smooth === true, `${c.worn.snap} ${c.worn.pts.length} points`);
await p.locator("[data-worn-resnap]").click();
await p.waitForTimeout(400);
c = await lastWorn();
check("…and it snaps clean again, where it was", c.worn.snap === "triangle" && c.x === snapped.x && c.w === snapped.w, J({ snap: c.worn.snap, x: c.x, w: c.w }));

/* Edit points: drag the tip of the cone to the right. */
await p.locator("[data-worn-edit-points]").click();
const tip = p.locator("[data-point-editor] [data-point='0']");
/* The popover scrolls when it holds more than the window: kits learned from other sites are offered too (tests/learned-library.mjs). */
await tip.scrollIntoViewIfNeeded();
await p.waitForTimeout(150);
const tb = await tip.boundingBox();
await p.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);
await p.mouse.down();
await p.mouse.move(tb.x + 40, tb.y + 10, { steps: 6 });
await p.mouse.up();
await p.waitForTimeout(400);
const moved = await lastWorn();
const abs = (n) => [n.x + n.worn.pts[0][0] * n.w, n.y + n.worn.pts[0][1] * n.h];
check("a point dragged in the part panel moves the outline, in the page", abs(moved)[0] > abs(c)[0] + 20, `${J(abs(c))} → ${J(abs(moved))}`);

/* A rough circle, and a line with Snap off. */
const closePanel = async () => { await p.keyboard.press("Escape"); await p.waitForTimeout(150); };
await closePanel();
await pickSpace();
await draw(circle(pb2.x + 700, pb2.y + 260, 90));
const round = await lastWorn();
check("a rough circle snaps to a circle, as wide as tall", round.worn.snap === "circle" && Math.abs(round.w - round.h) <= 2, J({ snap: round.worn.snap, w: round.w, h: round.h }));
await closePanel();
await pickSpace();
if (await p.locator("[data-reminder-dismiss]").count()) await p.locator("[data-reminder-dismiss]").click(); /* the "never backed up" nudge shows after a number of edits and sits over the panel */
await p.locator("[data-kit-snap]").uncheck();
await draw(circle(pb2.x + 560, pb2.y + 600, 80));
const loose = await lastWorn();
check("with Snap off the line stays as drawn", loose.worn.snap === null && loose.worn.pts.length > 12, `${loose.worn.snap} ${loose.worn.pts.length}`);
if (await p.locator("[data-reminder-dismiss]").count()) await p.locator("[data-reminder-dismiss]").click();
await p.locator("[data-kit-snap]").check();

check("no page errors", b.errors.length === 0, J(b.errors.slice(0, 3)));
await b.browser.close();
done();
