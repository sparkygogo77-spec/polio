/**
 * A picture becomes a texture: which patch of it, and whether it moves.
 *
 * A photograph of a surface is almost never a tile — the useful part is a
 * patch in the middle and everything round it is a lamp, a hand, or the edge
 * of the table — so the selection is the step that turns one into the other.
 * And a texture that drifts has to drift by a whole number of its own tiles,
 * or the loop has a jump in it once a cycle.
 *
 *   node tests/texture-patch.mjs [url]     # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright", "/usr/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/**
 * A picture in four flat quadrants, written here rather than kept in the repo.
 * Four colours means a patch of it is provably a different tile from the whole
 * of it, which is the only thing the selection has to be able to do.
 */
function quadPng(w = 64, h = 48) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(w * 3 + 1);
    for (let x = 0; x < w; x++) {
      const left = x < w / 2, top = y < h / 2;
      const rgb = left && top ? [255, 60, 60] : !left && top ? [60, 255, 60] : left ? [60, 60, 255] : [240, 240, 60];
      row.set(rgb, 1 + x * 3);
    }
    rows.push(row);
  }
  const crcTable = [...Array(256).keys()].map((n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const picture = join(tmpdir(), `quad-${process.pid}.png`);
writeFileSync(picture, quadPng());

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
await page.goto(`${URL}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(900);

const layerOf = () => page.evaluate(() => {
  try { return JSON.parse(localStorage.getItem("builder.studio") ?? "{}")?.state?.look?.texture?.[0] ?? null; } catch { return null; }
});

// A picture on the page, put there the way the wheel puts one there.
const frame = await page.locator("[data-frame]").first().boundingBox();
await page.mouse.click(frame.x + frame.width * 0.5, frame.y + frame.height * 0.3, { button: "right" });
await page.waitForTimeout(600);
for (const word of [/^Looks$/, /^Texture$/]) {
  const el = page.locator("[data-radial]").getByText(word).first();
  if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(650); }
}
await page.locator('[data-radial] input[type="file"]').first().setInputFiles(picture);
await page.waitForTimeout(1200);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
const added = await layerOf();
check("a picture becomes a texture layer", added?.kind === "image" && !!added.src);
check("the tile is baked with a shape written down", !!added?.baked && !!added.aspect, `aspect ${added?.aspect?.toFixed(2)}`);

// Open the layer in the panel: the page pressed in the Colours preview shows its Texture row, with the picture's picker (PieceTexture, since 1d680d3f); the selection is on it.
await page.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
await page.waitForTimeout(800);
const picker = page.locator("[data-crop-picker]").first();
check("the layer has a selection on the picture", (await picker.count()) === 1);
if (!(await picker.count())) {
  await browser.close();
  console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
  process.exit(1);
}
await picker.scrollIntoViewIfNeeded();
await page.waitForTimeout(250);

// Nothing is drawn over the picture while there is no selection — an overlay
// covering the whole of it is an overlay you cannot draw through.
check("with no selection there is nothing in the way", (await page.locator("[data-crop-body]").count()) === 0);

const box = await picker.boundingBox();
const wholeTile = (await layerOf())?.baked ?? "";
await page.mouse.move(box.x + box.width * 0.55, box.y + box.height * 0.55);
await page.mouse.down();
await page.mouse.move(box.x + box.width * 0.95, box.y + box.height * 0.95, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(1000);
const cropped = await layerOf();
const c = cropped?.crop;
check("dragging picks a patch of the picture", !!c && Math.abs(c.x - 0.55) < 0.06 && Math.abs(c.w - 0.4) < 0.08,
  c && `${(c.x * 100).toFixed(0)},${(c.y * 100).toFixed(0)} ${(c.w * 100).toFixed(0)}×${(c.h * 100).toFixed(0)}`);
check("the patch is what gets cooked into the tile", !!cropped?.baked && cropped.baked !== wholeTile);
check("the selection can be dragged and resized", (await page.locator("[data-crop-body]").count()) === 1 && (await page.locator("[data-crop-corner]").count()) === 4);

// Whole picture puts it back.
await page.getByRole("button", { name: "Whole picture" }).first().click();
await page.waitForTimeout(800);
check("whole picture gives the whole picture back", !(await layerOf())?.crop);

// A layer turned off the axes, so both directions of the drift are exercised:
// straight along one axis the other distance is zero, and zero is a whole
// number of tiles whatever the arithmetic did.
const angle = page.locator("label").filter({ hasText: /^Angle/ }).locator('[role="slider"]').first();
if (await angle.count()) {
  await angle.scrollIntoViewIfNeeded();
  await angle.focus();
  await page.keyboard.press("PageUp");
  await page.keyboard.press("PageUp");
  await page.waitForTimeout(600);
}
const turned = await layerOf();
check("the layer can be turned off the axes", (turned?.angle ?? 0) > 5 && (turned?.angle ?? 0) < 355, `${turned?.angle}°`);

// Drift: a still texture animates nothing; a drifting one moves by whole tiles.
check("a texture is still until it is asked to move", (await page.locator("style").filter({ hasText: "tex-drift" }).count()) === 0);
const drift = page.locator("label").filter({ hasText: /^Drift/ }).locator('[role="slider"]').first();
check("the layer has a drift control", (await drift.count()) === 1);
if (await drift.count()) {
  await drift.scrollIntoViewIfNeeded();
  await drift.focus();
  // End is the far end of a slider on every platform, and it does not depend
  // on where a drag happens to land on the track.
  await page.keyboard.press("End");
  await page.waitForTimeout(700);
}
const moving = await layerOf();
check("drift can be turned up", (moving?.drift ?? 0) > 0.3, `${Math.round((moving?.drift ?? 0) * 100)}%`);

const kf = await page.evaluate(() => [...document.querySelectorAll("style")].map((s) => s.textContent ?? "").find((t) => t.includes("tex-drift")) ?? "");
check("the keyframes that move it are written out", /@keyframes tex-drift-[a-z0-9]+\{to\{background-position:/.test(kf), kf.slice(0, 90));

// Whole tiles, or the loop jumps once a cycle.
const offsets = [...kf.matchAll(/calc\(50% \+ (-?\d+(?:\.\d+)?)px\)/g)].map((m) => Number(m[1]));
const tile = moving?.scale ?? 0;
const height = tile && moving?.aspect ? Math.round(tile / moving.aspect) : 0;
const [dx, dy] = offsets;
const wholeTiles = tile > 0 && height > 0 && Number.isInteger(dx / tile) && Number.isInteger(dy / height);
check("it moves by whole tiles, so the loop has no seam", offsets.length === 2 && wholeTiles,
  `${offsets.join(", ")} against ${tile}×${height}`);
check("and it moves in both directions once it is turned", Math.abs(dx) > 0 && Math.abs(dy) > 0, `${dx}, ${dy}`);

const anim = await page.locator("[data-frame]").first().evaluate((el) => getComputedStyle(el).animationName);
check("the page's own background is the thing moving", /tex-drift/.test(anim), anim);

/* ------------------------------------------------------------------ */
/* Reiterate: the patch, re-rolled                                     */
/* ------------------------------------------------------------------ */

/*
 * On a picture, the one thing a re-roll changes is which patch of it is the
 * texture — a photograph carries more textures than the whole generated set,
 * and the window is what gets at them. What makes it worth pressing twice is
 * *how* the patch is drawn, which is the thing checked here: every press
 * somewhere genuinely else, and the sizes spread across the kinds rather
 * than all landing in the middle of the range.
 */
// Put the drift back to nothing first, so that "the first re-roll sets a
// still picture going" is a claim about the re-roll and not about the slider
// this test moved a moment ago.
if (await drift.count()) {
  await drift.focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(600);
}
check("the picture is still again before the re-rolls", ((await layerOf())?.drift ?? 0) === 0);

await page.keyboard.press("Escape");
await page.waitForTimeout(300);

// Reiterate lives on a *part's* Looks › Texture, where the part is wearing a
// layer out of the site's stack — so a part is dropped and pointed at the
// picture already in it.
await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
await page.keyboard.type("drop a new idea");
await page.waitForTimeout(500);
await page.keyboard.press("Enter");
await page.waitForTimeout(900);
const part = page.locator("[data-node-id]").first();
check("a part to wear the picture", (await part.count()) === 1);
const pb = await part.boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2, { button: "right" });
await page.waitForTimeout(700);
for (const word of [/^Looks$/, /^Texture$/]) {
  const el = page.locator("[data-radial]").getByText(word).first();
  if (await el.count()) { await el.click({ force: true }); await page.waitForTimeout(700); }
}
// The chips are Follow the site, No texture, then the stack; the picture is
// the third, and picking it is what gives Reiterate something to re-roll.
const chips = page.locator("[data-radial] [data-arc-chip]");
if ((await chips.count()) >= 3) { await chips.nth(2).click({ force: true }); await page.waitForTimeout(700); }
// The wheel's buttons are SVG paths that carry their name, not text nodes.
const again = page.locator('[data-radial] [data-arc-button="Reiterate"]').first();
check("Reiterate is on the wheel with the picture", (await again.count()) === 1 && (await again.getAttribute("aria-disabled")) !== "true");

const before = await layerOf();
const rolls = [];
for (let i = 0; i < 8 && (await again.count()); i++) {
  await again.click({ force: true });
  await page.waitForTimeout(420);
  const l = await layerOf();
  if (l?.crop) rolls.push({ ...l.crop, baked: l.baked, scale: l.scale, angle: l.angle, hue: l.hue ?? 0, drift: l.drift ?? 0 });
}
check("every press re-rolls the patch", rolls.length === 8, `${rolls.length} of 8`);

const key = (c) => `${c.x},${c.y},${c.w},${c.h}`;
check("no two presses give the same patch", rolls.length > 0 && new Set(rolls.map(key)).size === rolls.length,
  `${new Set(rolls.map(key)).size} distinct`);

// The hub's lesson: kinds, not one distribution. A close crop, a middling
// one, a wide one and a strip are different textures out of one picture, so
// eight presses should not all be the same size of window.
const widths = rolls.map((c) => c.w);
const bands = new Set(widths.map((w) => (w < 0.25 ? "close" : w < 0.5 ? "middle" : "wide")));
check("the patches come in more than one size", rolls.length > 0 && bands.size >= 2, [...bands].join(", "));
check("and none of them runs off the picture",
  rolls.length > 0 && rolls.every((c) => c.x >= 0 && c.y >= 0 && c.x + c.w <= 1.001 && c.y + c.h <= 1.001));

// Consecutive presses have to move: a re-roll that lands where it was is a
// press that taught you nothing.
const hops = rolls.slice(1).map((c, i) => {
  const p0 = rolls[i];
  return Math.hypot(c.x + c.w / 2 - (p0.x + p0.w / 2), c.y + c.h / 2 - (p0.y + p0.h / 2));
});
check("each press lands somewhere else on the picture", hops.length > 0 && hops.every((d) => d > 0.02),
  `smallest hop ${(Math.min(...hops) * 100).toFixed(1)}% of the picture`);

// And the tile is actually cooked from the new patch, from the wheel, with
// the Look panel shut behind it.
const last = rolls[rolls.length - 1];
check("the new patch is cooked into the tile", !!last?.baked && last.baked !== before?.baked);
check("a still picture is set moving by the first re-roll", (rolls[0]?.drift ?? 0) > 0, `${Math.round((rolls[0]?.drift ?? 0) * 100)}%`);
// ...and the speed it was set going at is left alone by the presses after it.
check("and the presses after it leave that speed alone", rolls.every((c) => c.drift === rolls[0]?.drift), `${rolls.map((c) => Math.round(c.drift * 100)).join(", ")}`);

// One thing at a time still holds: the patch is the thing, and the tint and
// the scale are left where they were.
check("nothing else about the layer is re-rolled",
  rolls.length > 0 && rolls.every((c) => c.scale === before?.scale && c.angle === before?.angle && c.hue === (before?.hue ?? 0)));

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
