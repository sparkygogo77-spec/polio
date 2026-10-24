/**
 * A picture the browser cannot open is refused, not kept (inventory C1).
 *
 * Every door a picture comes in by (choose, drop, paste) shrinks it to 640 px
 * WebP on the way in, because the document lives in localStorage and a phone
 * photo at full size would fill it alone. When the browser could not decode
 * the file at all (HEIC from a phone, TIFF, PSD, a file that is not a
 * picture), the reader kept the full-size data URL "as it came": 3 to 8 MB
 * that paints as nothing and sits in the document. The Import flow already
 * refuses such a file with a sentence; this holds the other doors to the same:
 *
 *   · a sleeve well given an undecodable file says so and keeps nothing;
 *   · the Texture section's drop zone does the same;
 *   · a real picture by the same doors still lands, shrunk.
 *
 *   node tests/picture-refused.mjs [url]      # default http://localhost:3000
 */
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

/* 3 MB that says it is a HEIC and is not a picture at all. */
const JUNK = Buffer.alloc(3 * 1024 * 1024, 0x5a);
const PX = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
await page.goto(`${URL_BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1000);
const doc = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{\"state\":{}}").state);
const side = (name) => page.locator("[data-side-panel] [role=radio]").filter({ hasText: name }).first().click().catch(() => {});

/* 1. The sleeve well, by the file chooser. */
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
await sleeve.setInputFiles({ name: "photo.heic", mimeType: "image/heic", buffer: JUNK });
await page.waitForTimeout(1500);
let m = (await doc()).motion?.[0];
const kept = m?.frames?.filter(Boolean).map((f) => f.length) ?? [];
check("a 3 MB file the browser cannot open lands in no sleeve", kept.length === 0, kept.length ? `kept ${kept.map((n) => `${Math.round(n / 1024)} KB`).join(", ")}` : "nothing kept");
const said = (await crate.locator("[data-picture-refused]").allInnerTexts()).join(" ").trim();
check("and the well says so, in the import flow's own sentence", /cannot open that picture/i.test(said), said || "nothing said");

await sleeve.setInputFiles({ name: "dot.png", mimeType: "image/png", buffer: PX });
await page.waitForTimeout(1500);
m = (await doc()).motion?.[0];
check("a real picture by the same door still lands", typeof m?.frames?.[0] === "string" && m.frames[0].startsWith("data:image/"), m?.frames?.[0]?.slice(0, 22) ?? "no frame");
check("and the refusal is gone", (await crate.locator("[data-picture-refused]").count()) === 0);

/* 2. The Texture section, by a drop. */
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
await side("Look");
await page.waitForTimeout(500);
/* The Texture row of the page's editor (PieceTexture, since 1d680d3f): the page pressed in the Colours preview, its "Picture" tile, and the well that opens. */
await page.locator("[data-theme-preview]").first().click({ position: { x: 4, y: 4 }, force: true });
await page.waitForTimeout(400);
await page.locator('[data-kind-texture] [data-texture-sample="image"]').first().click();
await page.waitForTimeout(500);
const zone = page.locator("[data-texture-picture]");
const well = zone.locator("label").first();
check("the Texture section is there to drop on", (await zone.count()) === 1);
const drop = async (name, type, bytes) => {
  const dt = await page.evaluateHandle(({ name, type, bytes }) => {
    const dt = new DataTransfer();
    dt.items.add(new File([Uint8Array.from(bytes)], name, { type }));
    return dt;
  }, { name, type, bytes: Array.from(bytes) });
  await well.dispatchEvent("drop", { dataTransfer: dt });
  await page.waitForTimeout(1500);
};
const before = ((await doc()).look?.texture ?? []).length;
await drop("scan.tiff", "image/tiff", JUNK.subarray(0, 1024 * 1024));
const after = (await doc()).look?.texture ?? [];
const big = after.filter((l) => (l.src?.length ?? 0) > 200_000);
check("a dropped file the browser cannot open makes no layer and keeps no bytes", after.length === before && big.length === 0, `${after.length - before} layers added, ${big.length} carrying a full-size file`);
const zoneSaid = (await zone.locator("[data-picture-refused]").allInnerTexts()).join(" ").trim();
check("and the section says so", /cannot open that picture/i.test(zoneSaid), zoneSaid || "nothing said");
await drop("dot.png", "image/png", PX);
const real = (await doc()).look?.texture ?? [];
/* The Picture tile already made the page's one picture layer (empty); a real picture dropped on its well fills it. */
check("a real picture dropped there still becomes a layer", real.length === before && !!real.find((l) => l.kind === "image" && l.src?.startsWith("data:image/")), `${real.length - before} layers added, ${real.filter((l) => l.src?.startsWith("data:image/")).length} with a picture`);

check("no page error along the way", errors.length === 0, errors.join(" | ").slice(0, 200));
await page.evaluate(() => localStorage.removeItem("builder.studio"));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
