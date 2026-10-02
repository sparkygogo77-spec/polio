#!/usr/bin/env node
/**
 * BETTER DRAWING, AND "WHAT IS THIS?", THROUGH THE REAL TOOL AND A REAL HAND.
 *
 * The owner picked two ideas: combine and cut drawn shapes, words along a
 * drawn path, any drawn shape as a picture mask; and one clear question
 * after drawing. Held here, on the Trump & Morty board's "Trorty button"
 * kit drawn on a bare board (so pixels can be read):
 *
 *   · a shape drawn with a kit is asked "What is this?" at the top of its
 *     panel, unanswered, with the kit's own kind suggested;
 *   · JOIN: a box and a circle picked together are joined into one shape;
 *     its shadow, lighting bar and border follow the new edge (the shadow
 *     is the joined outline moved, the bar is cut to it), and in pixels the
 *     circle's far side wears the kit; one undo brings the two back;
 *   · CUT: a circle inside a box is cut out of it: a hole, whose middle in
 *     pixels is the ground, while the frame round it keeps the kit's fill;
 *   · WORDS ALONG A PATH: an open wavy line drawn with the kit carries words
 *     that follow its curve (each letter's height changes along it); the
 *     words, their font and their size are changed in the panel;
 *   · MASK: a picture dropped onto a drawn circle is clipped to it, with the
 *     kit's border and shadow still round it; in pixels, the picture shows
 *     inside and not in the box's corner outside the circle;
 *   · each answer to "What is this?" opens what it needs: Button asks where
 *     it leads under the site's link rules (pump.fun kept; a DEX Screener
 *     contract page, an X profile refused, with the reason); Picture frame
 *     asks for a picture; Section goes behind every other part; Decoration
 *     opens Motion; Words along a path asks for the words;
 *   · the export draws all of it as seen: the even-odd outline with its
 *     hole, the words on their path, the picture in its outline; and
 *     nothing in it points at the Builder.
 *
 * Writes .screenshots/lane-j/draw2-*.png (ignored); docs/shots/lane-j-draw2-*.png
 * are the committed record, copied by hand.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/draw-combine.mjs http://127.0.0.1:3013
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
const draw = async (pts) => {
  await p.mouse.move(pts[0][0], pts[0][1]);
  await p.mouse.down();
  for (const [i, [x, y]] of pts.entries()) { await p.mouse.move(x + Math.sin(i * 2.3) * 1.2, y + Math.cos(i * 1.7) * 1.2); await p.waitForTimeout(5); }
  await p.mouse.up();
  await p.waitForTimeout(700);
};
const seg = (a, c, n) => Array.from({ length: n }, (_, i) => [a[0] + ((c[0] - a[0]) * i) / n, a[1] + ((c[1] - a[1]) * i) / n]);
const rect = (x, y, w, h) => [...seg([x, y], [x + w, y], 14), ...seg([x + w, y], [x + w, y + h], 14), ...seg([x + w, y + h], [x, y + h], 14), ...seg([x, y + h], [x, y + 6], 14)];
const circle = (cx, cy, r) => Array.from({ length: 48 }, (_, i) => { const a = (i / 47) * Math.PI * 2 * 0.97; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
const pickSpace = async () => { await p.mouse.move(750, 480); await p.keyboard.press("Escape"); await p.keyboard.press("s"); await p.waitForTimeout(300); };
const pickV = async () => { await p.keyboard.press("Escape"); await p.keyboard.press("v"); await p.waitForTimeout(200); };
const shot = async (name, el) => { const r = await el.boundingBox(); if (r) await p.screenshot({ path: join(SHOTS, `draw2-${name}.png`), clip: { x: Math.max(0, r.x - 40), y: Math.max(0, r.y - 40), width: Math.min(1500 - Math.max(0, r.x - 40), r.width + 100), height: Math.min(1000 - Math.max(0, r.y - 40), r.height + 100) } }); };
const near = (a, c, tol = 16) => a.every((v, i) => Math.abs(v - c[i]) <= tol);
const pixelsOf = async () => {
  const buf = await p.screenshot({ clip: { x: 0, y: 0, width: 1500, height: 1000 } });
  const data = buf.toString("base64");
  return async (x, y) => p.evaluate(async ({ data, x, y }) => {
    const img = new Image(); img.src = `data:image/png;base64,${data}`; await img.decode();
    const cv = document.createElement("canvas"); cv.width = img.width; cv.height = img.height; const g = cv.getContext("2d"); g.drawImage(img, 0, 0);
    return [...g.getImageData(Math.round(x), Math.round(y), 1, 1).data].slice(0, 3);
  }, { data, x, y });
};
/** The drawn shape's layers, read off its SVG. */
const layersOf = (id) => p.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-worn]`);
  if (!el) return null;
  const body = el.querySelector("[data-worn-body]");
  const d = body?.getAttribute("d") ?? "";
  const band = el.querySelector("[data-worn-band='bar']");
  const clipId = /url\(#(.+)\)/.exec(band?.getAttribute("clip-path") ?? "")?.[1];
  const shadows = [...el.querySelectorAll("[data-worn-shadow-at]")];
  return {
    rings: (d.match(/Z/g) ?? []).length,
    evenodd: body?.getAttribute("fill-rule") === "evenodd",
    shadowFollows: shadows.length > 0 && shadows.every((s) => s.getAttribute("d") === d && s.getAttribute("fill-rule") === "evenodd"),
    barFollows: !!clipId && el.querySelector(`[id="${clipId}"] path`)?.getAttribute("d") === d,
    border: el.querySelector("[data-worn-border]")?.getAttribute("d") === d,
    picture: !!el.querySelector("[data-worn-picture]"),
    pictureClipped: /url\(#/.test(el.querySelector("[data-worn-picture]")?.getAttribute("clip-path") ?? ""),
  };
}, id);

/* ------------------------------------------------------------ the kit in hand, on a bare board */
await pickSpace();
await p.locator("[data-kit-picked]").click();
await p.waitForTimeout(600);
await p.locator('[data-kit-name="Trorty button"]').click();
await p.waitForTimeout(300);
const bare = await p.evaluate(() => { const d = window.__studioPublishDoc(); return { ...d, nodes: [], shapes: [], spaces: [], look: { ...d.look, texture: [], palette: { ...d.look.palette, bg: "rgb(40, 44, 60)" } } }; });
await p.evaluate((d) => window.__studioLoadDoc(d), bare);
await p.waitForTimeout(1200);
await p.evaluate(() => document.querySelector("[data-ctx='studio-canvas']")?.closest(".overflow-y-auto")?.scrollTo(0, 0));
const pb = await pane();
const X = pb.x + 160, Y = pb.y + 110;

/* ------------------------------------------------------------ What is this? asked first */
await pickSpace();
await draw(rect(X, Y, 240, 170));
const A = await lastWorn();
check("a box drawn with the kit wears it", A?.worn.kit.name === "Trorty button" && A.worn.snap === "rectangle", J(A?.worn.snap));
const ask = p.locator(`[data-part-panel="${A?.id}"] [data-what-is-this]`);
check("its panel asks What is this? first, unanswered", (await ask.getAttribute("data-what-is-this")) === "unanswered" && (await p.locator("[data-part-panel] [data-what-is-this] ~ [data-part-section]").count()) >= 1, await ask.getAttribute("data-what-is-this"));
const choices = await ask.locator("[data-worn-what-choice]").evaluateAll((els) => els.map((e) => e.textContent.replace(" · suggested", "")));
check("…with the five answers", J(choices) === J(["Button", "Picture frame", "Decoration", "Section", "Words along a path"]), J(choices));
check("…and the kit's own kind (a button) suggested", (await ask.locator("[data-suggested]").getAttribute("data-worn-what-choice")) === "button");
await shot("what-is-this", p.locator("[data-part-panel]").first());

/* ------------------------------------------------------------ join */
await pickSpace();
await draw(circle(X + 250, Y + 85, 70));
const B = await lastWorn();
check("a circle drawn beside it, overlapping", B && B.id !== A.id && B.worn.snap === "circle", J(B?.worn.snap));
const pickBoth = async (a, c) => {
  await pickV();
  const ra = await p.locator(`[data-node-id="${a.id}"]`).boundingBox();
  const rc = await p.locator(`[data-node-id="${c.id}"]`).boundingBox();
  await p.mouse.click(ra.x + 20, ra.y + ra.height / 2);
  await p.waitForTimeout(200);
  await p.keyboard.down("Shift");
  await p.mouse.click(rc.x + rc.width - 25, rc.y + rc.height / 2);
  await p.keyboard.up("Shift");
  await p.waitForTimeout(400);
};
await pickBoth(A, B);
check("picked together, the panel offers Join and Cut", (await p.locator("[data-join-or-cut]").count()) === 1);
const bodyBox = async (id) => p.locator(`[data-node-id="${id}"] [data-worn-body]`).boundingBox();
const rb = await bodyBox(B.id);
const farSide = [rb.x + rb.width - 12, rb.y + rb.height / 2];
await p.locator("[data-worn-join]").click();
await p.waitForTimeout(600);
let all = await worn();
const J1 = all.find((n) => n.id === A.id);
check("joined: one shape where there were two", all.length === 1 && !!J1?.worn.poly && J1.worn.poly.length === 1, J(all.map((n) => n.id)));
check("…its box reaches the circle's far side", J1 && J1.x + J1.w >= B.x + B.w - 2 && J1.x <= A.x + 2, J(J1 && { x: J1.x, w: J1.w }));
const lj = await layersOf(J1.id);
check("…its shadow is the joined outline moved, its lighting bar is cut to it, its border traces it", lj?.shadowFollows && lj.barFollows && lj.border && lj.evenodd, J(lj));
{
  const px = await pixelsOf();
  const fill = await px(farSide[0] - 8, farSide[1]);
  const ground = await px(farSide[0] + 40, farSide[1] - 90);
  check("in pixels: the circle's far side wears the kit's fill, not the ground", !near(fill, ground, 30), J({ fill, ground }));
}
await shot("join", p.locator(`[data-node-id="${J1.id}"]`));
await b.undo();
all = await worn();
check("one undo brings the two shapes back", all.length === 2 && !all.find((n) => n.id === A.id)?.worn.poly, J(all.length));

/* ------------------------------------------------------------ cut */
// A clean board for the cut.
await p.evaluate(() => { const d = window.__studioPublishDoc(); window.__studioLoadDoc({ ...d, nodes: [] }); });
await p.waitForTimeout(900);
await pickSpace();
await draw(rect(X, Y, 300, 220));
const F = await lastWorn();
await pickSpace();
await draw(circle(X + 150, Y + 110, 55));
const H = await lastWorn();
await pickBoth(F, H);
await p.locator("[data-worn-cut]").click();
await p.waitForTimeout(600);
all = await worn();
const C1 = all.find((n) => n.id === F.id);
check("cut: the circle is gone and the box has a hole where it was", all.length === 1 && C1?.worn.poly?.length === 1 && C1.worn.poly[0].length === 2, J(C1?.worn.poly?.map((pc) => pc.length)));
const lc = await layersOf(C1.id);
check("…drawn as two rings, even-odd, with the shadow, bar and border following both edges", lc?.rings === 2 && lc.evenodd && lc.shadowFollows && lc.barFollows && lc.border, J(lc));
{
  const r = await bodyBox(C1.id);
  const px = await pixelsOf();
  const hole = await px(r.x + r.width / 2, r.y + r.height / 2);
  const frame = await px(r.x + r.width / 2, r.y + 30);
  const ground = await px(r.x - 30, r.y - 30);
  check("in pixels: the hole's middle is the ground, the frame round it is the kit's fill", near(hole, ground, 30) && !near(frame, ground, 30), J({ hole, frame, ground }));
}
check("its panel says how it was made, not the snap", (await p.locator(`[data-part-panel="${C1.id}"] [data-worn-made]`).innerText()).includes("1 hole"));
await shot("cut", p.locator(`[data-node-id="${C1.id}"]`));

/* ------------------------------------------------------------ words along a path */
await pickSpace();
await draw(Array.from({ length: 50 }, (_, i) => [X + 380 + i * 8, Y + 420 + Math.sin(i / 7) * 50]));
const W = await lastWorn();
check("an open wavy line drawn with the kit is words along a path", W?.worn.open === true && W.worn.what === "path" && W.content === "Words along a path", J(W && { open: W.worn.open, what: W.worn.what, content: W.content }));
check("…the question is answered with it, and its words, font and size are open", (await p.locator(`[data-part-panel="${W.id}"] [data-what-is-this="path"] [data-worn-path-fields]`).count()) === 1);
const curve = async () => p.evaluate((id) => {
  const t = document.querySelector(`[data-node-id="${id}"] [data-worn-text-path]`);
  const tp = t?.querySelector("textPath");
  const guide = tp ? document.getElementById(tp.getAttribute("href").slice(1)) : null;
  if (!t || !tp) return null;
  const n = t.getNumberOfChars();
  const ys = Array.from({ length: n }, (_, i) => t.getStartPositionOfChar(i).y);
  const rot = Array.from({ length: n }, (_, i) => t.getRotationOfChar(i));
  return { text: tp.textContent, n, spread: Math.max(...ys) - Math.min(...ys), turns: Math.max(...rot) - Math.min(...rot), open: !/Z\s*$/.test(guide?.getAttribute("d") ?? "Z"), font: t.getAttribute("font-family"), size: Number(t.getAttribute("font-size")) };
}, W.id);
let wc = await curve();
check("the words follow the curve: their height and their turn change along it", wc && wc.n > 10 && wc.spread > 20 && wc.turns > 20 && wc.open, J(wc));
await p.locator("[data-worn-path-words-input]").fill("Buy the dip, ride the wave");
await p.locator(`[data-worn-font*="Georgia"]`).click();
await p.locator("[data-part-panel] [data-field='worn:size'] input").fill("30");
await p.waitForTimeout(400);
wc = await curve();
check("the words, their font and their size are changed in the panel", wc?.text === "Buy the dip, ride the wave" && /Georgia/.test(wc.font) && wc.size === 30, J(wc));
await shot("path-words", p.locator(`[data-node-id="${W.id}"]`));

/* ------------------------------------------------------------ a picture mask */
await pickSpace();
await draw(circle(X + 560, Y + 130, 90));
const M = await lastWorn();
const r0 = await bodyBox(M.id);
await p.evaluate(async ({ x, y }) => {
  const cv = document.createElement("canvas"); cv.width = 240; cv.height = 240;
  const g = cv.getContext("2d");
  for (let i = 0; i < 12; i++) { g.fillStyle = i % 2 ? "rgb(20, 90, 255)" : "rgb(255, 40, 140)"; g.fillRect(i * 20, 0, 20, 240); }
  const blob = await new Promise((r) => cv.toBlob(r, "image/png"));
  const dt = new DataTransfer();
  dt.items.add(new File([blob], "stripes.png", { type: "image/png" }));
  const target = document.elementFromPoint(x, y);
  target.dispatchEvent(new DragEvent("dragover", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: x, clientY: y }));
  target.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true, cancelable: true, clientX: x, clientY: y }));
}, { x: r0.x + r0.width / 2, y: r0.y + r0.height / 2 });
await p.waitForTimeout(1500);
const M1 = (await b.nodes()).find((n) => n.id === M.id);
const pictureParts = (await b.nodes()).filter((n) => n.featureId === "picture");
check("a picture dropped onto the drawn circle goes into it, not beside it", !!M1?.picture && M1.worn.what === "frame" && pictureParts.length === 0, J({ picture: !!M1?.picture, what: M1?.worn.what, loose: pictureParts.length }));
const lm = await layersOf(M.id);
check("…clipped to the outline, with the kit's border and shadow still round it", lm?.picture && lm.pictureClipped && lm.border && lm.shadowFollows, J(lm));
{
  const px = await pixelsOf();
  const mid = await px(r0.x + r0.width / 2, r0.y + r0.height / 2);
  const corner = await px(r0.x + 6, r0.y + 6);
  const ground = await px(r0.x - 40, r0.y - 30);
  // The stripes are pink and blue (both low in green, high in blue); where they meet, or under the gloss, they mix.
  const striped = (c) => c[2] > 120 && c[1] < 140;
  check("in pixels: the picture shows inside the circle, and the box's corner outside it is the ground", striped(mid) && near(corner, ground, 30), J({ mid, corner, ground }));
}
await shot("mask", p.locator(`[data-node-id="${M.id}"]`));

/* ------------------------------------------------------------ each answer to What is this? */
const choose = async (id, what) => { await p.locator(`[data-part-panel="${id}"] [data-worn-what-choice="${what}"]`).click(); await p.waitForTimeout(450); };
const Q = F; // the cut box
await pickV();
{ const r = await bodyBox(Q.id); await p.mouse.click(r.x + 12, r.y + r.height / 2); await p.waitForTimeout(400); }
await choose(Q.id, "button");
check("Button: it asks where it leads, at once", (await p.locator(`[data-part-panel="${Q.id}"] [data-what-is-this="button"] [data-worn-leads]`).count()) === 1);
const tryAddress = async (a) => {
  const box = p.locator("[data-worn-link-address]");
  await box.fill(a);
  await p.waitForTimeout(150);
  const said = await p.locator("[data-worn-link-allowed]").getAttribute("data-worn-link-allowed");
  const why = await p.locator("[data-worn-link-allowed]").innerText();
  await box.press("Enter");
  await p.waitForTimeout(300);
  return { said, why, link: (await b.node(Q.id))?.link ?? null };
};
const dex = await tryAddress("https://dexscreener.com/solana/STANDIN_PAIR");
check("…a DEX Screener contract page is refused, with the reason, and not kept", dex.said === "no" && /specific contract address/.test(dex.why) && !dex.link, J(dex));
const xp = await tryAddress("https://x.com/STANDIN_PROFILE");
check("…an X profile is refused, with the reason", xp.said === "no" && /x\.com/.test(xp.why) && !xp.link, J(xp));
const pump = await tryAddress("pump.fun/coin/STANDIN_MINT");
check("…pump.fun is allowed and kept", pump.said === "yes" && pump.link?.kind === "url" && pump.link.target === "https://pump.fun/coin/STANDIN_MINT", J(pump));
const dexHome = await tryAddress("https://dexscreener.com/");
check("…DEX Screener itself is allowed", dexHome.said === "yes" && dexHome.link?.target === "https://dexscreener.com/", J(dexHome));
await p.locator("[data-worn-link-address]").fill("");
const page0 = await p.locator("[data-worn-link-page]").first().getAttribute("data-worn-link-page");
await p.locator("[data-worn-link-page]").first().click();
await p.waitForTimeout(300);
check("…a page of the site is always allowed", (await b.node(Q.id))?.link?.kind === "page" && (await b.node(Q.id)).link.target === page0);
await shot("button-leads", p.locator("[data-part-panel]").first());

await choose(Q.id, "frame");
check("Picture frame: it asks for a picture, and the link is let go", (await p.locator(`[data-part-panel="${Q.id}"] [data-what-is-this="frame"] [data-worn-picture-input]`).count()) === 1 && !(await b.node(Q.id))?.link);
await choose(Q.id, "section");
const order = (await b.nodes()).map((n) => n.id);
check("Section: it goes behind every other part, and Look opens", order[0] === Q.id && (await p.locator(`[data-part-panel="${Q.id}"] [data-part-section="look"][data-open]`).count()) === 1, J(order.slice(0, 3)));
await choose(Q.id, "decoration");
check("Decoration: Motion opens, with its motions to choose from", (await p.locator(`[data-part-panel="${Q.id}"] [data-part-section="motion"][data-open] [data-worn-motions]`).count()) === 1);
await choose(Q.id, "path");
const Qp = await b.node(Q.id);
check("Words along a path: the words are asked for, and run round the outline", (await p.locator(`[data-part-panel="${Q.id}"] [data-worn-path-fields]`).count()) === 1 && Qp.worn.what === "path" && (await p.locator(`[data-node-id="${Q.id}"] [data-worn-text-path]`).count()) === 1);
await choose(Q.id, "decoration");
check("…and back to a shape, its outline (with its hole) is drawn again, without the sample words", (await layersOf(Q.id))?.rings === 2 && !(await b.node(Q.id))?.content);
check("a drawn shape's panel has one place for its words, not two", (await p.locator(`[data-part-panel="${Q.id}"] [data-part-section="content"] textarea, [data-part-panel="${Q.id}"] [data-part-section="content"] input`).count()) <= 1);

/* ------------------------------------------------------------ in the Element list */
await p.locator("[data-back-to-tree]").first().click();
await p.waitForTimeout(500);
const listed = await p.locator("[data-list-row]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-list-ids"), e.querySelector("[data-list-name]")?.textContent]));
const inList = (id) => listed.some(([ids]) => (ids ?? "").split(" ").includes(id));
check("the Element list has each drawn shape, the words along the path by their words", inList(Q.id) && inList(M.id) && listed.some(([ids, name]) => (ids ?? "").split(" ").includes(W.id) && /Buy the dip/.test(name ?? "")), J(listed.slice(0, 6)));

/* ------------------------------------------------------------ published as seen */
const files = await p.evaluate(async () => (window.__studioExport ? await window.__studioExport() : null));
const html = files?.find((f) => f.path === "index.html")?.content ?? "";
const cls = (id) => `wk-${id.replace(/[^A-Za-z0-9_-]/g, "_")}`;
check("the export carries the cut shape, the words on their path and the picture in its circle", html.includes(cls(Q.id)) && html.includes(cls(W.id)) && html.includes(cls(M.id)) && /<textPath/.test(html) && /fill-rule="evenodd"/.test(html) && /<image[^>]*clip-path="url\(#wk-/.test(html));
check("nothing in the export points at the Builder", !/\/_next\/|\/builder|builder\.studio/.test(files?.filter((f) => typeof f.content === "string").map((f) => f.content).join("\n") ?? ""));
const out = mkdtempSync(join(tmpdir(), "draw-combine-"));
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
await site.waitForTimeout(800);
const seen = await site.evaluate(({ q, w, m }) => {
  // The export keeps none of the Builder's data-* marks, so the page is read by its plain SVG.
  const words = document.querySelector(`.${w} text textPath`)?.textContent ?? null;
  const t = document.querySelector(`.${w} text`);
  const ys = t ? Array.from({ length: t.getNumberOfChars() }, (_, i) => t.getStartPositionOfChar(i).y) : [];
  const img = document.querySelector(`.${m} image`);
  const body = document.querySelector(`.${q} svg > path[fill-rule="evenodd"]`);
  return { words, spread: ys.length ? Math.max(...ys) - Math.min(...ys) : 0, picture: !!img && /url\(#/.test(img.getAttribute("clip-path") ?? "") && !!img.getAttribute("href"), rings: (body?.getAttribute("d")?.match(/Z/g) ?? []).length, evenodd: body?.getAttribute("fill-rule") === "evenodd" };
}, { q: cls(Q.id), w: cls(W.id), m: cls(M.id) });
check("on the published page: the words run along their curve, the picture sits in its outline, the hole is a hole", seen.words === "Buy the dip, ride the wave" && seen.spread > 20 && seen.picture && seen.rings === 2 && seen.evenodd, J(seen));
const picOk = await site.evaluate(async (m) => { const img = document.querySelector(`.${m} image`); const href = img?.getAttribute("href"); if (!href) return false; try { const r = await fetch(href); return r.ok; } catch { return href.startsWith("data:"); } }, cls(M.id));
check("…and the picture's file is in the export", picOk);
{
  const el = site.locator(`.${cls(W.id)}`);
  await el.scrollIntoViewIfNeeded();
  const r1 = await site.locator(`.${cls(Q.id)}`).boundingBox();
  const r2 = await el.boundingBox();
  const r3 = await site.locator(`.${cls(M.id)}`).boundingBox();
  if (r1 && r2 && r3) {
    const x0 = Math.max(0, Math.min(r1.x, r2.x, r3.x) - 30), y0 = Math.max(0, Math.min(r1.y, r2.y, r3.y) - 30);
    await site.screenshot({ path: join(SHOTS, "draw2-exported.png"), clip: { x: x0, y: y0, width: Math.min(1440 - x0, Math.max(r1.x + r1.width, r2.x + r2.width, r3.x + r3.width) - x0 + 40), height: Math.min(900 - y0, Math.max(r1.y + r1.height, r2.y + r2.height, r3.y + r3.height) - y0 + 40) } });
  }
}
server.close();

check("no page errors", b.errors.length === 0, J(b.errors.slice(0, 3)));
await b.browser.close();
done();
