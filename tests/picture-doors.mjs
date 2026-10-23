/**
 * The three picture doors say what they did with the odd shapes (inventory C3).
 *
 * Choose, drop, paste: a picture by any of them is shrunk to 640 px on the
 * way in. Three shapes of input went through quietly:
 *
 *   · an animated GIF or WebP kept its first frame only and said nothing;
 *   · a drag from another web page (a URL, no file) did nothing and said
 *     nothing;
 *   · a cut-out with real transparency was re-encoded as lossy WebP whichever
 *     way the dead `hasAlpha` branch went, so its edges grew halos.
 *
 * Now: the first frame is kept and the well says so; a drag with no file in
 * it is told what would work; a picture with any transparent pixel is kept
 * lossless (PNG), and one with none is WebP as before. All read off the
 * document and the panel, in the browser.
 *
 *   node tests/picture-doors.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";
import { deflateSync } from "node:zlib";

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

/* A 1 × 1 GIF with two frames: the smallest thing a browser calls animated. */
const gifFrame = [0x21, 0xf9, 0x04, 0x04, 0x0a, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44, 0x01, 0x00];
const ANIMATED = Buffer.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff,
  0x21, 0xff, 0x0b, ...Buffer.from("NETSCAPE2.0"), 0x03, 0x01, 0x00, 0x00, 0x00,
  ...gifFrame, ...gifFrame, 0x3b,
]);
const STILL = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0xff, 0xff, ...gifFrame, 0x3b]);

/* A 700 × 700 PNG, noisy so it does not shrink into the keep-as-is path, with or without a transparent hole. */
function png(w, h, hole) {
  const rows = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) % 256;
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    for (let x = 0; x < w; x++) {
      const inHole = hole && Math.hypot(x - w / 2, y - h / 2) < w / 4;
      row.set([rnd(), rnd(), rnd(), inHole ? 0 : 255], 1 + x * 4);
    }
    rows.push(row);
  }
  const crcTable = [...Array(256).keys()].map((n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body));
    return Buffer.concat([len, body, sum]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 6 })), chunk("IEND", Buffer.alloc(0))]);
}

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{\"state\":{}}").state);
const side = (name) => page.locator("[data-side-panel] [role=radio]").filter({ hasText: name }).first().click().catch(() => {});
const frame0 = async () => (await doc()).motion?.[0]?.frames?.[0] ?? null;

/* 1. The sleeve well, by the chooser. */
await side("Motion");
await page.waitForTimeout(500);
const panel = page.locator("[data-motion-panel]");
/* Frame interpolation is a folded section at the foot of the Motion tab now (MotionPanel.tsx): unfold it first. */
if (!(await panel.locator("[data-motion-crates]").evaluate((d) => d.open).catch(() => true))) {
  await panel.locator("[data-motion-crates] > summary").click();
  await page.waitForTimeout(300);
}
await panel.getByRole("button", { name: /crate/i }).first().click();
/* A new crate opens straight into its own wide editor (MotionPanel.tsx). */
const crate = page.locator("[data-crate-editor]");
await page.waitForTimeout(500);
const sleeve = crate.locator("input[type=file]").first();
const note = async () => (await crate.locator("[data-picture-note]").allInnerTexts()).join(" ").replace(/\s+/g, " ").trim();

await sleeve.setInputFiles({ name: "loop.gif", mimeType: "image/gif", buffer: ANIMATED });
await page.waitForTimeout(1500);
check("an animated GIF lands", (await frame0() ?? "").startsWith("data:image/"), (await frame0())?.slice(0, 20) ?? "no frame");
check("and the well says its first frame was kept", /first frame/i.test(await note()), (await note()) || "nothing said");

await sleeve.setInputFiles({ name: "dot.gif", mimeType: "image/gif", buffer: STILL });
await page.waitForTimeout(1500);
check("a still GIF lands with no such note", (await frame0() ?? "").startsWith("data:image/") && !(await note()), (await note()) || "nothing said");

await sleeve.setInputFiles({ name: "cutout.png", mimeType: "image/png", buffer: png(700, 700, true) });
await page.waitForTimeout(2500);
const cut = await frame0();
check("a 700 px cut-out with a transparent hole is shrunk and kept lossless", (cut ?? "").startsWith("data:image/png"), cut?.slice(0, 20) ?? "no frame");
const cutSize = await page.evaluate((src) => new Promise((r) => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = src; }), cut ?? "");
check("at 640 on the long edge", cutSize[0] === 640 && cutSize[1] === 640, `${cutSize[0]} × ${cutSize[1]}`);

await sleeve.setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: png(700, 700, false) });
await page.waitForTimeout(2500);
const solid = await frame0();
check("the same picture with no transparent pixel is WebP, as before", (solid ?? "").startsWith("data:image/webp"), solid?.slice(0, 20) ?? "no frame");
check("and smaller for it", !!cut && !!solid && solid.length < cut.length, `${Math.round((solid?.length ?? 0) / 1024)} KB against ${Math.round((cut?.length ?? 0) / 1024)} KB`);

/* 2. The Texture section, by a drag that carries a URL and no file. */
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await side("Look");
await page.waitForTimeout(500);
/* The picture texture lives in the Texture row of the Background inspector (PieceTexture, since 1d680d3f): the "Picture" tile opens its drop well. */
await page.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true }); /* the page, pressed in the Colours preview: its editor holds the Texture row */
await page.waitForTimeout(400);
await page.locator('[data-kind-texture] [data-texture-sample="image"]').first().click();
await page.waitForTimeout(500);
const zone = page.locator("[data-texture-picture]").first();
const before = ((await doc()).look?.texture ?? []).length;
const dt = await page.evaluateHandle(() => {
  const dt = new DataTransfer();
  dt.setData("text/uri-list", "https://example.com/a-picture.jpg");
  dt.setData("text/plain", "https://example.com/a-picture.jpg");
  return dt;
});
/* The drop is taken by the well inside the row; events dispatched on its label bubble up to it. */
const well = zone.locator("label").first();
await well.dispatchEvent("dragover", { dataTransfer: dt });
await well.dispatchEvent("drop", { dataTransfer: dt });
await page.waitForTimeout(800);
const said = (await zone.locator("[data-picture-refused]").allInnerTexts()).join(" ").replace(/\s+/g, " ").trim();
check("a drag from another page, with no file in it, makes no layer", ((await doc()).look?.texture ?? []).length === before);
check("and the section says what would work", /file|paste|save/i.test(said) && /computer|disk|first/i.test(said), said || "nothing said");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
