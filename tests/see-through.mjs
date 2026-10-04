/**
 * TRANSPARENT BACKGROUND, FROM THE WHEEL: POINT AT IT, AND IT GOES.
 *
 * HIS WORDS: "add a right click menu transparent background selector i will
 * test on the image". The image was a generated trading card on a white
 * plate: the plate should go, and the card, white text and all, should stay.
 *
 * The pure half holds the cut (`seeThrough.ts`) on a picture made here: a
 * white plate round a dark card that has a white mark inside it.
 *   · touching what was pressed, the plate goes and the mark inside stays;
 *   · "everywhere", the mark goes too;
 *   · the edge fades over the feather band rather than cutting hard;
 *   · nothing pressed, nothing changes.
 *
 * The browser half goes the way he would: a picture dropped on the board,
 * a right press on it, "Transparent background…" in the wheel's tray, a
 * press on the plate in the card, Apply. The part's picture is then a new
 * PNG whose plate is see-through and whose card is not, the old one kept in
 * its versions, and one Undo puts the old one back.
 *
 *   npx next start -p 3013
 *   node tests/see-through.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const here = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

/* ------------------------------------------------------------ the pure half */
const { createJiti } = await import("jiti");
const jiti = createJiti(import.meta.url, { alias: { "@": join(here, "..", "src") } });
const { seeThrough, cornerSeeds } = await jiti.import(join(here, "..", "src", "features", "studio", "seeThrough.ts"));

/* 40×40: a white plate, a dark card from 10 to 29, a white mark at 18..21 inside the card. */
const W = 40, H = 40;
const px = new Uint8ClampedArray(W * H * 4);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const i = (y * W + x) * 4;
  const card = x >= 10 && x < 30 && y >= 10 && y < 30;
  const mark = x >= 18 && x < 22 && y >= 18 && y < 22;
  const v = card && !mark ? 30 : 250;
  px[i] = v; px[i + 1] = v; px[i + 2] = v; px[i + 3] = 255;
}
const a = (d, x, y) => d[(y * W + x) * 4 + 3];
const touching = seeThrough(px, W, H, { seeds: [[0, 0]], tolerance: 20 });
check("pressing the plate clears the plate", a(touching, 0, 0) === 0 && a(touching, 39, 39) === 0 && a(touching, 5, 20) === 0);
check("…and keeps the card", a(touching, 12, 12) === 255 && a(touching, 27, 27) === 255);
check("…and the white mark inside the card, which it does not touch", a(touching, 19, 19) === 255);
const all = seeThrough(px, W, H, { seeds: [[0, 0]], tolerance: 20, everywhere: true });
check("“everywhere” clears the mark inside the card too", a(all, 19, 19) === 0 && a(all, 12, 12) === 255);
const corners = seeThrough(px, W, H, { seeds: cornerSeeds(W, H), tolerance: 20 });
check("the corners are a first guess that finds the plate", a(corners, 0, 39) === 0 && a(corners, 20, 2) === 0 && a(corners, 12, 12) === 255);
/* A soft edge: a pixel a little off the plate's colour, next to it, fades rather than staying hard. */
const soft = new Uint8ClampedArray(px);
const e = (20 * W + 9) * 4; soft[e] = soft[e + 1] = soft[e + 2] = 215; /* 35 from the plate, past a tolerance of 20 */
const faded = seeThrough(soft, W, H, { seeds: [[0, 0]], tolerance: 20, feather: 30 });
check("an edge pixel just past “how close” fades instead of cutting hard", a(faded, 9, 20) > 0 && a(faded, 9, 20) < 255, `alpha ${a(faded, 9, 20)}`);
check("nothing pressed, nothing changes", seeThrough(px, W, H, { seeds: [], tolerance: 40 }).every((v, i) => v === px[i]));

/* ------------------------------------------------------------ the browser half */
const { chromium } = createRequire(import.meta.url)("playwright-core");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors = [];
page.on("pageerror", (err) => errors.push(err.message));
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForFunction(() => typeof window.__studioPublishDoc === "function", null, { timeout: 30000 });
await page.waitForTimeout(800);

/* A 400×400 card on a white plate, as JPEG, the way the generator sends one: dropped on the board. */
await page.evaluate(async () => {
  const c = document.createElement("canvas"); c.width = c.height = 400; const x = c.getContext("2d");
  x.fillStyle = "#fafafa"; x.fillRect(0, 0, 400, 400);
  x.fillStyle = "#e6c84a"; x.fillRect(80, 20, 240, 360);
  x.fillStyle = "#2a3a6a"; x.fillRect(100, 40, 200, 200);
  x.fillStyle = "#fafafa"; x.fillRect(180, 120, 40, 40);
  const frame = document.querySelector("[data-frame]"); const r = frame.getBoundingClientRect();
  const dt = new DataTransfer();
  dt.setData("application/x-studio-picture", JSON.stringify({ src: c.toDataURL("image/jpeg", 0.95), w: 400, h: 400 }));
  const at = { clientX: r.left + r.width / 2, clientY: r.top + 260 };
  const target = document.elementFromPoint(at.clientX, at.clientY) ?? frame;
  for (const t of ["dragenter", "dragover", "drop"]) target.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt, ...at }));
});
let node = null;
for (let t = 0; t < 30 && !node?.picture; t++) { await page.waitForTimeout(200); node = (await page.evaluate(() => window.__studioPublishDoc().nodes)).at(-1); }
check("the picture lands on the board", !!node?.picture, node ? `${node.picture?.w}×${node.picture?.h} ${node.picture?.type}` : "nothing");
const was = node?.picture;

/* Right press on it, the tray under the wheel, "Transparent background…". */
const box = await page.locator(`[data-node-id="${node.id}"]`).first().boundingBox();
await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2, { button: "right" });
await page.waitForTimeout(600);
const tray = page.locator("[data-tray]").first();
if (await tray.count()) { await tray.hover(); await page.waitForTimeout(300); }
const item = page.locator('[data-tray-item="clear-bg"]').first();
check("the wheel's tray offers “Transparent background…” on a picture", (await item.count()) === 1 && (await item.getAttribute("aria-label")) === "Transparent background…");
await item.click();
await page.waitForTimeout(400);
const card = page.locator("[data-clear-bg-card]");
check("…which opens the card", (await card.count()) === 1);
const canvas = card.locator("[data-clear-bg-canvas]");
await canvas.waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
const share0 = await card.locator("[data-clear-bg-share]").innerText();
check("the corners are picked to start, so the plate is already shown see-through", /^\d+% see-through$/.test(share0) && parseInt(share0) > 20, share0);

/* His press: the plate, left of the card. */
const cb = await canvas.boundingBox();
await canvas.click({ position: { x: cb.width * (30 / 400), y: cb.height * (200 / 400) } });
await page.waitForTimeout(400);
const share1 = await card.locator("[data-clear-bg-share]").innerText();
check("a press on the plate picks it", parseInt(share1) > 20, share1);
await card.locator("[data-clear-bg-apply]").click();
let after = null;
for (let t = 0; t < 30; t++) { await page.waitForTimeout(200); after = (await page.evaluate((id) => window.__studioPublishDoc().nodes.find((n) => n.id === id), node.id)); if (after?.picture?.id !== was?.id) break; }
check("Apply puts a new picture on the part, as a PNG", !!after?.picture && after.picture.id !== was.id && after.picture.type === "image/png", JSON.stringify({ type: after?.picture?.type }));
check("…the old one kept in its versions", (after?.pictureVersions ?? []).some((v) => v.id === was.id));
check("…and the card closes", (await card.count()) === 0);

/* What is drawn: the plate see-through, the card and the light mark inside it not. */
const alphaAt = await page.evaluate(async (id) => {
  const img = document.querySelector(`[data-node-id="${id}"] img`);
  for (let t = 0; t < 40 && !(img?.complete && img.naturalWidth); t++) await new Promise((r) => setTimeout(r, 100));
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const at = (px, py) => x.getImageData(px, py, 1, 1).data[3];
  return { plate: at(20, 20), plateBottom: at(380, 390), card: at(200, 300), art: at(120, 60), mark: at(200, 140) };
}, node.id);
check("the plate is see-through on the board", alphaAt.plate === 0 && alphaAt.plateBottom === 0, JSON.stringify(alphaAt));
check("…and the card, its art and the light mark inside it are not", alphaAt.card === 255 && alphaAt.art === 255 && alphaAt.mark === 255, JSON.stringify(alphaAt));

await page.keyboard.press("Control+z");
await page.waitForTimeout(500);
const undone = await page.evaluate((id) => window.__studioPublishDoc().nodes.find((n) => n.id === id)?.picture?.id, node.id);
check("one Undo puts the old picture back", undone === was.id, undone);
check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
