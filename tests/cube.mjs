/**
 * The cube: drawn, recognised, turned, edited, published, built.
 *
 * This is the thing the whole drawing line of work is judged by. Someone
 * draws a box, types what goes on it, and gets an element that turns in 3D,
 * carries words on its sides, and is still editable afterwards. A traced
 * picture cannot do any of that, so this is where the coded path earns its
 * keep: the drawing supplies the kind and the proportions, the prompt
 * supplies the faces, and the element itself is code.
 *
 * What is held shut here:
 *
 *   · a cube is recognised off the geometry alone, with no model call:
 *     three quadrilaterals meeting at a corner, a hexagon with a Y in it,
 *     or a plain rectangle when the words say cube;
 *   · the part that comes out is a real cube-3d node with six faces, not a
 *     picture and not a coded body;
 *   · the prompt fills one face an item and leaves the rest blank, rather
 *     than inventing filler;
 *   · it turns: dragging moves it, it settles on a face, and the arrow keys
 *     step round it;
 *   · editing a face is editing the node, so it survives a reload and goes
 *     out with a publish;
 *   · and Build writes it as a component with its own state, not a flat
 *     snapshot of one angle.
 *
 *   node tests/cube.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { corners, isCube, kindOfSketch } from "../src/features/studio/shapeKind.ts";
import { faceItems, faceOf, facesFrom, saysCube } from "../src/features/studio/parts/cube.ts";
import { scaffold } from "../src/features/studio/scaffold.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_BASE = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* The drawings                                                        */
/* ------------------------------------------------------------------ */

/** A plain rectangle. On its own it is a surface; with the word cube it is a cube. */
const RECT = [[0.24, 0.26], [0.76, 0.26], [0.76, 0.74], [0.24, 0.74], [0.24, 0.26]];

/** Three quadrilaterals meeting at the middle: the isometric box. */
const ISO = (() => {
  const c = [0.5, 0.5];
  const up = [0.5, 0.2], dl = [0.22, 0.36], dr = [0.78, 0.36], bl = [0.22, 0.68], br = [0.78, 0.68], dn = [0.5, 0.82];
  const quad = (a, b, cc, d) => [a, b, cc, d, a];
  return [quad(c, dl, up, dr), quad(c, dl, bl, dn), quad(c, dr, br, dn)];
})();

/** A hexagon with a Y inside it: the same cube, drawn as an outline and three creases. */
const HEX = (() => {
  const ring = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
    return [0.5 + Math.cos(a) * 0.3, 0.5 + Math.sin(a) * 0.3];
  });
  const c = [0.5, 0.5];
  return [ring, [c, [0.5, 0.2]], [c, [0.24, 0.65]], [c, [0.76, 0.65]]];
})();

/* ------------------------------------------------------------------ */
/* 1. Recognition, off the geometry, with no model                     */
/* ------------------------------------------------------------------ */

check("three quadrilaterals meeting at a corner are a cube", isCube({ strokes: ISO, words: "" }), "");
check("a hexagon with a Y in it is a cube", isCube({ strokes: HEX, words: "" }), "");
check("a plain rectangle is not, on its own", !isCube({ strokes: [RECT], words: "the offer" }));
check("a plain rectangle is, when the words say cube", isCube({ strokes: [RECT], words: "make this a cube" }));
check("or when the element's own prompt does", isCube({ strokes: [RECT], words: "" }, "a rotating box of our three pillars"));
check("and the kind that comes out is cube", kindOfSketch({ strokes: ISO, words: "" }).kind === "cube", kindOfSketch({ strokes: ISO, words: "" }).kind);
check("a rectangle with no such word is still a surface", kindOfSketch({ strokes: [RECT], words: "the offer" }).kind === "surface");
check("a ring is still a container", kindOfSketch({ strokes: [
  Array.from({ length: 40 }, (_, i) => { const a = (i / 39) * Math.PI * 2; return [0.5 + Math.cos(a) * 0.34, 0.5 + Math.sin(a) * 0.34]; }),
  Array.from({ length: 40 }, (_, i) => { const a = (i / 39) * Math.PI * 2; return [0.5 + Math.cos(a) * 0.18, 0.5 + Math.sin(a) * 0.18]; }),
], words: "" }).kind === "container");
check("cube, box and cuboid are the words; cubic is not a claim about shape", saysCube("a cube") && saysCube("a 3D BOX") && !saysCube("cubicle"));
check("a hexagon's corners are counted, not guessed", corners(HEX[0]) >= 5 && corners(HEX[0]) <= 8, String(corners(HEX[0])));

/* ------------------------------------------------------------------ */
/* 2. The faces, from what was typed and nothing else                  */
/* ------------------------------------------------------------------ */

{
  const three = facesFrom("", "a cube with our three pillars: Speed, Proof, Reach");
  check("the lead-in is dropped and each pillar takes a face", three[0].heading === "Speed" && three[1].heading === "Proof" && three[2].heading === "Reach",
    three.slice(0, 3).map((f) => f.heading).join(" · "));
  check("the other three stay blank rather than being filled in", three.slice(3).every((f) => !f.heading && !f.body), JSON.stringify(three.slice(3)));
  check("six is the most it takes", facesFrom("a,b,c,d,e,f,g,h", "").length === 6);
  const pair = faceOf("Speed: under a second");
  check("a colon in an item is a heading and a line", pair.heading === "Speed" && pair.body === "under a second");
  check("newlines beat semicolons beat commas", faceItems("one, two\nthree").length === 2, JSON.stringify(faceItems("one, two\nthree")));
  check("a sentence with no list in it fills nothing", facesFrom("", "a cube that turns as you scroll").every((f) => !f.heading), "");
  check("the content field wins over the prompt", facesFrom("A, B", "a cube: X, Y, Z")[0].heading === "A");
}

/* ------------------------------------------------------------------ */
/* 3. Build writes a component, not a picture                          */
/* ------------------------------------------------------------------ */

{
  const files = scaffold({
    name: "Bench", frameWidth: 1440,
    pages: [{ id: "p", name: "Home", path: "/" }],
    palette: { bg: "#000", text: "#fff", accent: "#0f0", muted: "#888", surface: "#111", highlight: "#f0f" },
    tokens: {},
    parts: [{
      id: "n1", pageId: "p", featureId: "cube-3d", label: "Pillars", x: 0, y: 0, w: 420, h: 420,
      html: "<div>a snapshot nobody should ship</div>",
      cube: { faces: [{ heading: "Speed", body: "under a second", colour: "" }, { heading: "Proof", body: "", colour: "accent" }, { heading: "Reach", body: "", colour: "" }, { heading: "", body: "", colour: "" }, { heading: "", body: "", colour: "" }, { heading: "", body: "", colour: "" }], turn: { x: -18, y: -32 } },
    }],
  });
  const file = files.find((f) => f.path.startsWith("components/parts/"));
  check("Build writes a file for the cube", !!file, file?.path);
  const src = file?.content ?? "";
  check("it is a component with its own state, not a snapshot", /useState/.test(src) && /requestAnimationFrame/.test(src));
  check("the snapshot markup is not what shipped", !src.includes("a snapshot nobody should ship"));
  check("the six sides are in it, in order", /"front", "right", "back", "left", "top", "bottom"/.test(src));
  check("the words are data at the top of the file", /"heading": "Speed"/.test(src) && /"body": "under a second"/.test(src));
  check("it turns with the pointer and the keys", /onPointerMove/.test(src) && /ArrowLeft/.test(src));
  check("a face's colour is a site token, not a hex", /var\(--\$\{face\.colour\}\)/.test(src) || /var\(--/.test(src));
  check("nothing is fetched and no library is imported", !/from "(?!react)/.test(src.replace(/from "react"/g, "")), (src.match(/^import .*$/gm) ?? []).join(" | "));
}

/* ------------------------------------------------------------------ */
/* 4. The whole way through, in the browser                            */
/* ------------------------------------------------------------------ */

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });

/* Nothing on this path may reach a model. Both routes are caught and
   counted, and the run fails if either is called. */
const asked = [];
for (const route of ["**/api/studio/body", "**/api/studio/image", "**/api/studio/reshape"]) {
  await page.route(route, (r) => {
    asked.push(r.request().url().split("/").pop());
    return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: false, reason: "unavailable", message: "not on this path" }) });
  });
}

await page.goto(`${URL_BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.setItem("builder.settings", JSON.stringify({ state: { values: { "studio.drawMode": "raw" }, advanced: false }, version: 0 })));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

const read = () => page.evaluate(() => {
  const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
  const n = (s.nodes ?? []).find((x) => x.featureId === "cube-3d");
  return n ? { id: n.id, featureId: n.featureId, kind: n.kind, w: n.w, h: n.h, outline: n.outline, code: n.code, faces: n.cube?.faces ?? null, turn: n.cube?.turn ?? null } : null;
});

/* Draw the isometric box, and say what goes on it. */
await page.keyboard.press("Control+k");
await page.waitForTimeout(340);
await page.keyboard.type("drop a new idea");
await page.waitForTimeout(400);
await page.keyboard.press("Enter");
await page.waitForTimeout(800);
{
  const part = page.locator("[data-node-id]").last();
  const pb = await part.boundingBox();
  await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
  await page.waitForTimeout(650);
  await page.locator('[data-radial] [data-shard="draw"]').first().click({ force: true });
  await page.waitForTimeout(1200);
  const bb = await page.locator("[data-draw-board]").boundingBox();
  for (const stroke of ISO) {
    await page.mouse.move(bb.x + stroke[0][0] * bb.width, bb.y + stroke[0][1] * bb.height);
    await page.mouse.down();
    for (const [x, y] of stroke) { await page.mouse.move(bb.x + x * bb.width, bb.y + y * bb.height); await page.waitForTimeout(6); }
    await page.mouse.up();
    await page.waitForTimeout(180);
  }
  await page.locator("[data-draw-words]").fill("a cube with our three pillars: Speed, Proof, Reach");
  await page.keyboard.press("Enter");
}

let node = null;
for (let i = 0; i < 40; i++) {
  await page.waitForTimeout(800);
  node = await read();
  if (node) break;
}
check("the drawing becomes a cube part", !!node && node.featureId === "cube-3d", node ? `${node.featureId} ${node.w}×${node.h}` : "nothing");
check("marked as a cube on the node", node?.kind === "cube", node?.kind ?? "-");
check("it is square, because a cube is", node && node.w === node.h, node ? `${node.w}×${node.h}` : "-");
check("no clip is left on it: a solid that turns cannot live in a still silhouette", !node?.outline);
check("no body was written or traced for it", !node?.code);
check("no model was called anywhere on this path, not even to read the drawing", asked.length === 0, asked.join(" ") || "none");
check("six faces, three written and three blank", node?.faces?.length === 6 && node.faces.filter((f) => f.heading).length === 3,
  (node?.faces ?? []).map((f) => f.heading || "-").join(" · "));
check("the pillars are on the first three, in order", ["Speed", "Proof", "Reach"].every((w, i) => node?.faces?.[i]?.heading === w));

check("the cube is on the board", (await page.locator("[data-cube]").count()) === 1);
{
  const still = await page.locator("[data-cube]").first().getAttribute("data-cube-turn");
  check("and the board draws it at the angle it is standing at", still === "-18,-32", still ?? "-");
}

/*
 * It turns in Preview.
 *
 * Every part on the board is inert by the board's own rule — the canvas is
 * a layout surface and a part that grabbed the pointer there could not be
 * moved — so Preview is where anyone turns one, and where the site turns
 * it too.
 */
await page.locator("[data-preview-toggle]").click();
await page.waitForTimeout(1600);
const cube = page.locator("[data-cube]").first();
await cube.scrollIntoViewIfNeeded().catch(() => {});
check("the cube is in the preview", (await cube.count()) === 1);
const box = await cube.boundingBox();
const turnOf = () => cube.getAttribute("data-cube-turn");
const before = await turnOf();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
for (let i = 1; i <= 12; i++) { await page.mouse.move(box.x + box.width / 2 + i * 9, box.y + box.height / 2); await page.waitForTimeout(16); }
await page.mouse.up();
await page.waitForTimeout(300);
check("dragging turns it", (await turnOf()) !== before, `${before} → ${await turnOf()}`);
await page.waitForTimeout(2200);
{
  const [x, y] = (await turnOf()).split(",").map(Number);
  check("and it settles on a face rather than at an angle", x % 90 === 0 && y % 90 === 0, `${x},${y}`);
}
{
  const seen = new Set();
  await cube.focus();
  for (let i = 0; i < 4; i++) {
    seen.add(await cube.getAttribute("data-cube-face"));
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(700);
  }
  check("the arrow keys step round all four sides", seen.size === 4, [...seen].join(" "));
  await page.keyboard.press("ArrowUp");
  await page.waitForTimeout(800);
  check("and up to the top", (await cube.getAttribute("data-cube-face")) === "top", await cube.getAttribute("data-cube-face"));
}

/* Back to the board to edit it. */
await page.locator("[data-preview-toggle]").click();
await page.waitForTimeout(1200);
await page.locator(`[data-node-id="${node.id}"]`).click({ force: true });
await page.waitForTimeout(700);

/* Editable after it exists. */
const panel = page.locator("[data-face-list]").first();
check("the panel lists all six faces", (await panel.locator("[data-cube-face]").count()) === 6, String(await panel.locator("[data-cube-face]").count()));
await panel.locator('[data-cube-face="left"] input').first().fill("Trust");
await page.waitForTimeout(600);
await panel.locator('[data-cube-face="front"] textarea').first().fill("under a second, every time");
await page.waitForTimeout(600);
await panel.locator('[data-cube-face="back"] button[aria-label^="Clear"]').click();
await page.waitForTimeout(500);
{
  const now = await read();
  check("a face can be written after the cube exists", now?.faces?.[3]?.heading === "Trust", now?.faces?.[3]?.heading ?? "-");
  check("a face's body can be changed", now?.faces?.[0]?.body === "under a second, every time", now?.faces?.[0]?.body ?? "-");
  check("a face can be cleared", !now?.faces?.[2]?.heading, now?.faces?.[2]?.heading ?? "(blank)");
}
await panel.locator('[data-cube-face="right"] button[aria-label$="accent"]').click();
await page.waitForTimeout(500);
check("a face can take a colour from the palette", (await read())?.faces?.[1]?.colour === "accent", (await read())?.faces?.[1]?.colour ?? "-");
{
  const left = (await read())?.turn;
  check("where it was left standing is written on the node", !!left && left.x % 90 === 0 && left.y % 90 === 0, JSON.stringify(left));
}

/* It survives a reload. */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1400);
{
  const after = await read();
  check("the words survive a reload", after?.faces?.[3]?.heading === "Trust" && after?.faces?.[0]?.body === "under a second, every time",
    (after?.faces ?? []).map((f) => f.heading || "-").join(" · "));
  check("so does the colour", after?.faces?.[1]?.colour === "accent");
  check("and the cube is still on the board after it", (await page.locator("[data-cube]").count()) === 1);
}

/* It goes out with a publish: the document is what publish sends. */
{
  const doc = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {};
    return JSON.stringify({ nodes: s.nodes });
  });
  check("the faces are in the document publish sends", doc.includes('"Trust"') && doc.includes('"under a second, every time"'));
  check("and the cube is a part id, not an image", doc.includes('"cube-3d"') && !/"code":\{/.test(doc));
}

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
