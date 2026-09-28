/**
 * "Light on the page" lands on the page in Preview and in the export, not
 * only on the board; and the light's switch has a name.
 *
 * Measured before this, with the light on and "Light on the page" turned
 * right up: the board changed across 41% of its pixels, Preview and the
 * exported page by 0%. The board drew the wash (`washCss`) and nothing else
 * did. And the switch that turns the light on was a checkbox named "" —
 * nothing a screen reader could say, nothing a person could be pointed at.
 *
 * Through the Look tab, on a page with a card on it: the switch is found by
 * its name and turns the light on; the wash dial goes to the top; then the
 * board, Preview and the exported page (served on its own) are each held to
 * how they looked with no wash, and all three must have changed.
 *
 *   node tests/light-wash.mjs [url]
 */
import { existsSync } from "node:fs";
import { chromium } from "playwright-core";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const context = await browser.newContext({ viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await context.route(/^https:\/\/(?!fonts\.)/, (r) => r.fulfill({ status: 404, body: "" }));

const part = (id, featureId, y, words) => ({
  id, pageId: "p0", featureId, label: id, prompt: "", content: words, data: "", x: 120, y, w: 420, h: 160,
  groupId: null, options: {}, priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(async (d) => {
  localStorage.clear();
  for (const x of (await indexedDB.databases?.()) ?? []) indexedDB.deleteDatabase(x.name);
  localStorage.setItem("builder.studio", JSON.stringify({ state: d, version: 0 }));
}, {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [part("n0", "card", 120, "A card"), part("n1", "prose", 360, "Some words")],
  groups: [], shapes: [], format: {}, brief: { name: "Site", gimmick: "", master: "" }, frameWidth: 1400, activePageId: "p0", trail: [],
});
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1200);

/** The board, Preview and the exported page, as pictures. */
async function pictures() {
  await page.waitForTimeout(600);
  const board = await page.locator("[data-frame]").first().screenshot();
  const pv = await context.newPage();
  await pv.goto(`${BASE}/builder/preview`, { waitUntil: "networkidle" });
  await pv.waitForTimeout(900);
  const preview = await pv.screenshot();
  await pv.close();
  const files = await page.evaluate(async () => (await window.__studioExport?.()) ?? []);
  const ex = await context.newPage();
  await ex.route("http://export.invalid/**", (r) => {
    const p = new URL(r.request().url()).pathname.slice(1) || "index.html";
    const f = files.find((x) => x.path === p);
    if (!f) return r.fulfill({ status: 404, body: "" });
    const type = p.endsWith(".css") ? "text/css" : p.endsWith(".js") ? "text/javascript" : p.endsWith(".html") ? "text/html" : "application/octet-stream";
    return r.fulfill({ status: 200, contentType: type, body: f.encoding === "base64" ? Buffer.from(f.content, "base64") : f.content });
  });
  await ex.goto("http://export.invalid/index.html", { waitUntil: "networkidle" }).catch(() => {});
  await ex.waitForTimeout(900);
  const exported = await ex.screenshot();
  await ex.close();
  return { board, preview, exported };
}
const cmp = await context.newPage();
const moved = (a, b) => cmp.evaluate(async ([a, b]) => {
  const load = (s) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = `data:image/png;base64,${s}`; });
  const [A, B] = await Promise.all([load(a), load(b)]);
  const w = Math.min(A.width, B.width), h = Math.min(A.height, B.height);
  const px = (I) => { const c = document.createElement("canvas"); c.width = w; c.height = h; const x = c.getContext("2d"); x.drawImage(I, 0, 0); return x.getImageData(0, 0, w, h).data; };
  const p = px(A), q = px(B);
  let n = 0;
  for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 24) n++;
  return Math.round((n / (w * h)) * 1000) / 10;
}, [a.toString("base64"), b.toString("base64")]);

const side = page.locator("[data-side-panel]");
await side.locator("[role=radio]").filter({ hasText: "Look" }).first().click();
await page.waitForTimeout(300);
const light = page.locator("[data-look-light]");
const switchOn = light.getByRole("checkbox", { name: /light/i });
check("the light's switch has a name", (await switchOn.count()) === 1, await light.locator("input[type=checkbox]").first().getAttribute("aria-label").then((l) => `named ${JSON.stringify(l)}`).catch(() => "no switch"));
if (await switchOn.count()) await switchOn.check();
else await light.locator("input[type=checkbox]").first().check();
await page.waitForTimeout(400);
const without = await pictures();

await light.locator("[data-light-open]").click();
await page.waitForTimeout(300);
await light.locator("[data-light-dials] [role=slider]").nth(4).focus();
await page.keyboard.press("End");
await page.waitForTimeout(400);
const withWash = await pictures();

const b = await moved(without.board, withWash.board);
const p = await moved(without.preview, withWash.preview);
const e = await moved(without.exported, withWash.exported);
check("the wash changes the board", b >= 5, `${b}% of pixels`);
check("…and Preview", p >= 5, `${p}% of pixels`);
check("…and the exported page", e >= 5, `${e}% of pixels`);
check("no page error", errors.length === 0, errors.join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
