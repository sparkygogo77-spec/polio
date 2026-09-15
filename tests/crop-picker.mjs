/**
 * The crop picker says when its picture never shows, and a tall picture does not run away (inventory C26).
 *
 * The picker sizes itself to the picture once it loads, and starts at 3:2.
 * A picture that never loads (bytes the browser cannot decode) left a 3:2
 * empty box forever with nothing said; a picture ten times taller than wide
 * made the picker ten times the column, with no height it would stop at.
 * Now a picture that does not load is said, and the picker is held to twice
 * its width, the picture squashed into it and the squash said: the patch is
 * picked in fractions of the box, which are fractions of the picture either
 * way.
 *
 *   node tests/crop-picker.mjs [url]      # default http://localhost:3000
 */
import { deflateSync } from "node:zlib";
import { createRequire } from "node:module";
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

function png(w, h) {
  const rows = [];
  for (let y = 0; y < h; y++) { const row = Buffer.alloc(1 + w * 3); for (let x = 0; x < w; x++) row.set([(x * 255) / w, (y * 255) / h, 128].map(Math.round), 1 + x * 3); rows.push(row); }
  const crcTable = [...Array(256).keys()].map((n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1; return n >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const body = Buffer.concat([Buffer.from(type), data]); const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const sum = Buffer.alloc(4); sum.writeUInt32BE(crc(body)); return Buffer.concat([len, body, sum]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(rows), { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}
const TALL = `data:image/png;base64,${png(40, 400).toString("base64")}`;
const BAD = "data:image/png;base64,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await page.evaluate(({ tall, bad }) => {
  const d = JSON.parse(localStorage.getItem("builder.studio") ?? "{\"state\":{}}");
  const layer = (id, src) => ({ id, kind: "image", role: "accent", scale: 60, angle: 0, opacity: 1, contrast: 0.45, blend: "normal", hue: 0, target: "page", pattern: false, cutout: false, tolerance: 0.35, weave: 0, on: true, src });
  d.state.look = { ...(d.state.look ?? {}), texture: [layer("tx_bad", bad), layer("tx_tall", tall)] };
  localStorage.setItem("builder.studio", JSON.stringify(d));
}, { tall: TALL, bad: BAD });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const tab = page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Look" }).first();
if (await tab.count()) await tab.click().catch(() => {});
await page.waitForTimeout(500);
const rows = page.locator("[data-look-texture]").getByRole("button").filter({ hasText: /image|picture/i });
check("two picture layers are listed", (await rows.count()) >= 2, `${await rows.count()} rows`);

/* 1. The picture that never loads. */
await rows.nth(0).click();
await page.waitForTimeout(1500);
const picker = page.locator("[data-crop-picker]").first();
const refused = page.locator("[data-look-texture] [data-crop-refused]");
check("a picture the browser cannot decode is said, on the picker's place", (await refused.count()) === 1 && /could not|cannot|not.*shown|not.*load/i.test(await refused.first().innerText()), (await refused.count()) ? await refused.first().innerText() : `no such line; picker ${await picker.count() ? `${Math.round((await picker.boundingBox()).width)} × ${Math.round((await picker.boundingBox()).height)} and blank` : "absent"}`);
await rows.nth(0).click();
await page.waitForTimeout(400);

/* 2. The tall picture. */
await rows.nth(1).click();
await page.waitForTimeout(1500);
const tallBox = await page.locator("[data-crop-picker]").first().boundingBox();
check("a 1:10 picture's picker is there", !!tallBox && tallBox.width > 100, tallBox ? `${Math.round(tallBox.width)} wide` : "absent");
check("and held to a height, not ten times the column", !!tallBox && tallBox.height <= 420, tallBox ? `${Math.round(tallBox.height)} tall for ${Math.round(tallBox.width)} wide` : "absent");
const imgBox = await page.locator("[data-crop-picker] img").first().boundingBox().catch(() => null);
check("with the whole picture filling that box, so a patch picked on it is a patch of the picture", !!imgBox && !!tallBox && Math.abs(imgBox.height - tallBox.height) <= 2 && Math.abs(imgBox.width - tallBox.width) <= 2, imgBox ? `picture ${Math.round(imgBox.width)} × ${Math.round(imgBox.height)} in ${Math.round(tallBox.width)} × ${Math.round(tallBox.height)}` : "no picture");
const squashed = page.locator("[data-crop-picker] [data-crop-squashed]");
check("and the squash is said on it", (await squashed.count()) === 1 && /squash/i.test(await squashed.first().innerText()), (await squashed.count()) ? await squashed.first().innerText() : "nothing said");

await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
