/**
 * A covering picture is not a 320 px tile stretched over the page (inventory C2).
 *
 * A picture layer is baked into a tile, and the tile is small on purpose:
 * the document lives in localStorage. That is right for a tile, which
 * repeats at 60 px. It was wrong for a picture at the top of the weave,
 * which becomes one picture covering the whole surface (`size: cover`):
 * the same 320 px tile over a 1440 px frame is a 4.5× upscale, always soft.
 * This holds the bake to what the layer does with it:
 *
 *   · a tiling layer still bakes to the 320 px cap;
 *   · a covering layer bakes at the picture's own size, which the intake
 *     already holds to 640 px on the long edge;
 *   · both are read back off the baked tile itself, decoded in the browser.
 *
 *   node tests/cover-tile.mjs [url]      # default http://localhost:3000
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

/* A 640 × 480 PNG with something in it: a diagonal ramp, so a scale shows. */
function png(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 3);
    for (let x = 0; x < w; x++) row.set([(x * 255) / w, (y * 255) / h, ((x + y) * 127) / (w + h)].map(Math.round), 1 + x * 3);
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
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const SRC = `data:image/png;base64,${png(640, 480).toString("base64")}`;

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);

/* Two picture layers off one picture: one tiling, one covering. Colours kept, nothing keyed out. */
await page.evaluate((src) => {
  const d = JSON.parse(localStorage.getItem("builder.studio") ?? "{\"state\":{}}");
  const layer = (id, weave) => ({ id, kind: "image", role: "accent", scale: 60, angle: 0, opacity: 1, contrast: 0.45, blend: "normal", hue: 0, target: "page", pattern: false, cutout: false, tolerance: 0.35, weave, on: true, src });
  d.state.look = { ...(d.state.look ?? {}), texture: [layer("tx_tile", 0), layer("tx_cover", 1)] };
  localStorage.setItem("builder.studio", JSON.stringify(d));
}, SRC);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const sizes = await page.evaluate(async () => {
  const d = JSON.parse(localStorage.getItem("builder.studio"));
  const out = {};
  for (const l of d.state.look.texture) {
    if (!l.baked) { out[l.id] = null; continue; }
    out[l.id] = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight, bytes: l.baked.length });
      img.onerror = () => resolve({ w: 0, h: 0, bytes: l.baked.length });
      img.src = l.baked;
    });
  }
  return out;
});
const tile = sizes.tx_tile;
const cover = sizes.tx_cover;
const kb = (n) => `${Math.round(n / 1024)} KB`;
check("both picture layers were baked", !!tile && !!cover, JSON.stringify(sizes));
check("a tiling picture bakes to the 320 px cap", !!tile && Math.max(tile.w, tile.h) === 320, tile ? `${tile.w} × ${tile.h}, ${kb(tile.bytes)}` : "not baked");
check("a covering picture bakes at the picture's own size, 640 on the long edge, not the tile cap", !!cover && Math.max(cover.w, cover.h) === 640 && cover.w / cover.h > 1.3 && cover.w / cover.h < 1.36, cover ? `${cover.w} × ${cover.h}, ${kb(cover.bytes)}` : "not baked");
check("and the covering tile is under 1 MB, so the document still fits", !!cover && cover.bytes < 1024 * 1024, cover ? kb(cover.bytes) : "");

/* Turned back down, it is a tile again. */
await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("builder.studio"));
  d.state.look.texture = d.state.look.texture.map((l) => (l.id === "tx_cover" ? { ...l, weave: 0.5, baked: undefined } : l));
  localStorage.setItem("builder.studio", JSON.stringify(d));
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(2500);
const half = await page.evaluate(async () => {
  const l = JSON.parse(localStorage.getItem("builder.studio")).state.look.texture.find((x) => x.id === "tx_cover");
  if (!l?.baked) return null;
  return new Promise((resolve) => { const img = new Image(); img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight }); img.onerror = () => resolve({ w: 0, h: 0 }); img.src = l.baked; });
});
check("the same layer at half weave, tiling again, is back at the cap", !!half && Math.max(half.w, half.h) === 320, half ? `${half.w} × ${half.h}` : "not baked");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
