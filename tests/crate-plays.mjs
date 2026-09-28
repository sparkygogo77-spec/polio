/**
 * A crate plays at the rate it says, and its sprite sheet always comes out.
 *
 * Measured on 4254477, clicking the Motion panel like a first-time owner:
 *   · "30 fps" played 19 frames a second and "60 fps" 33. The loop stepped
 *     one frame per animation frame that had waited a whole step, so at
 *     60 Hz a 33 ms step took three repaints (20 fps) and a 16.7 ms step
 *     took two (30 fps). A 1.5 s crate played for 2.3 s.
 *   · a long crate's sprite sheet never downloaded, and nothing said so.
 *     One row of 264px frames is 264 × frames wide; Chromium's canvas stops
 *     at 65,535px (Firefox's at 32,767), so past 248 frames — 60 fps for
 *     4.2 s of the 6 s the slider offers — toBlob hands back null.
 *
 * Held here, through the panel: five keyframes dropped into five sleeves; the
 * in-betweens are real pictures (they differ frame to frame and none is
 * blank); 1.5 s at 30 fps is 45 frames; played for a second it moves about
 * 30 frames at 30 fps and about 60 at 60; the sheet of 45 is one row of
 * 264 × 148; the sheet of 360 (60 fps, 6 s) downloads, inside the canvas limit, with room
 * for every frame; and the crate is still there after a reload.
 *
 *   node tests/crate-plays.mjs [url]
 */
import { existsSync, readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(async () => { localStorage.clear(); for (const d of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(d.name); });
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const panel = page.locator("[data-motion-panel]");
const openMotion = async () => { await page.locator("[data-side-panel] [role=radio]").filter({ hasText: "Motion" }).first().click(); await page.waitForTimeout(400); };
await openMotion();
await panel.getByRole("button", { name: /Crate/ }).click();
await page.waitForTimeout(300);

/* Five keyframes: a coloured block walking left to right. */
const pngs = await page.evaluate(() => ["#e33", "#3a3", "#33e", "#ee3", "#e3e"].map((c, i) => {
  const cv = document.createElement("canvas"); cv.width = 200; cv.height = 120;
  const x = cv.getContext("2d"); x.fillStyle = "#111"; x.fillRect(0, 0, 200, 120); x.fillStyle = c; x.fillRect(20 + i * 30, 20, 60, 80);
  return cv.toDataURL("image/png").split(",")[1];
}));
const inputs = panel.locator("input[type=file]");
for (let i = 0; i < 5; i++) {
  await inputs.nth(i).setInputFiles({ name: `key-${i + 1}.png`, mimeType: "image/png", buffer: Buffer.from(pngs[i], "base64") });
  await page.waitForTimeout(350);
}
await page.waitForTimeout(500);

const counter = panel.locator(".num").filter({ hasText: "/" }).first();
const frameNo = async () => Number((await counter.innerText()).split("/")[0]);
const total = async () => Number((await counter.innerText()).split("/")[1]);
check("five keyframes and 1.5 s at 30 fps is 45 frames", (await total()) === 45, await counter.innerText().catch(() => "no counter"));

/* The in-betweens: walk every frame and read the canvas. */
const slider = panel.locator("[role=slider]").first();
await slider.focus();
await page.keyboard.press("Home");
const seen = [];
for (let i = 0; i < 45; i++) {
  seen.push(await page.evaluate(() => {
    const c = document.querySelector("[data-motion-canvas]");
    const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data;
    let h = 0, lit = 0;
    for (let j = 0; j < d.length; j += 4) { h = (h * 31 + d[j] + d[j + 1] * 7 + d[j + 2] * 13) >>> 0; if (d[j] + d[j + 1] + d[j + 2] > 60) lit++; }
    return { h, lit };
  }));
  await page.keyboard.press("ArrowRight");
}
const distinct = new Set(seen.map((s) => s.h)).size;
check("the in-betweens are pictures of their own: 40 distinct frames of 45 (five keyframes held two frames each)", distinct === 40, `${distinct} distinct`);
check("…and none of them is blank", seen.every((s) => s.lit > 0), `${seen.filter((s) => s.lit === 0).length} blank`);

async function rate() {
  await slider.focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(100);
  const n = await total();
  await panel.getByLabel("Play the sequence").click();
  const t0 = Date.now();
  let last = 1, moved = 0;
  /* Read often, so a wrap back to frame 1 is counted rather than lost. */
  while (Date.now() - t0 < 1000) {
    const f = await frameNo();
    moved += (f - last + n) % n;
    last = f;
    await page.waitForTimeout(40);
  }
  const ms = Date.now() - t0;
  await panel.getByLabel("Pause").click();
  return Math.round((moved / ms) * 1000);
}
const at30 = await rate();
check("at 30 fps it plays about 30 frames a second", at30 >= 26 && at30 <= 34, `${at30} a second`);

async function sheet() {
  const [dl] = await Promise.all([
    page.waitForEvent("download", { timeout: 8000 }).catch(() => null),
    panel.getByRole("button", { name: "Sprite sheet" }).click(),
  ]);
  if (!dl) return null;
  const at = join(mkdtempSync(join(tmpdir(), "crate-")), dl.suggestedFilename());
  await dl.saveAs(at);
  const b = readFileSync(at);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
const small = await sheet();
check("the sheet of 45 downloads as one row, 264 × 45 by 148", small?.w === 264 * 45 && small?.h === 148, small ? `${small.w}×${small.h}` : "no download");

/* 60 fps, 6 s, the longest the panel offers: 360 frames. */
await panel.locator("[role=radio]").filter({ hasText: "60 fps" }).first().click();
const length = panel.locator("[role=slider]").nth(1);
await length.focus();
await page.keyboard.press("End");
await page.waitForTimeout(300);
check("60 fps for 6 s is 360 frames", (await total()) === 360, await counter.innerText());
const at60 = await rate();
check("at 60 fps it plays about 60 frames a second", at60 >= 50 && at60 <= 66, `${at60} a second`);
const big = await sheet();
/* 16,384 a side is inside every browser's canvas, Safari's area limit included. */
const fits = big && big.w <= 16384 && big.h <= 16384 && big.w % 264 === 0 && big.h % 148 === 0 && (big.w / 264) * (big.h / 148) >= 360;
check("the sheet of 360 downloads, inside any browser's canvas, with a cell for every frame", !!fits, big ? `${big.w}×${big.h}` : "no download");
const note = (await panel.locator("p.text-fine.text-fg-muted").allInnerTexts()).join(" ");
check("…and says how it is laid out", /360 frames/.test(note) && /\d+ rows/.test(note), note);

/* It is the owner's: a reload keeps it. */
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);
await openMotion();
const sleeves = await panel.locator("[style*=background-image], img").count();
check("the crate survives a reload, all five sleeves and its timing", sleeves >= 5 && (await total()) === 360, `${sleeves} pictures, ${await counter.innerText().catch(() => "no counter")}`);
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
