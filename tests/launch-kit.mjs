#!/usr/bin/env node
/**
 * THE LAUNCH KIT IS MADE FROM THE SITE'S OWN STYLE, DOWNLOADS, AND GOES ON THE PUBLISHED PAGE.
 *
 * Lane H, item 15. The launch kit (the rocket key in the top bar, or
 * "Launch kit" in the palette) draws, from the site itself:
 *   1. a share card 1200 by 630, an X banner 1500 by 500, a site icon at
 *      16, 32, 48, 180, 192 and 512, and three meme templates;
 *   2. in the site's own colours (the ground and the accent stripe are the
 *      site's background and accent, to the pixel) and its own faces (the
 *      face its biggest words are set in; changing that face changes the
 *      card), with its logo;
 *   3. each downloadable under a name that says what it is, as a real PNG
 *      of the size it says; meme captions are typed and drawn;
 *   4. "Use on the published page" puts the share card and the icons into
 *      the published page: og:image and twitter:image name the card, the
 *      card is the large one, and every icon size is linked, the 180 as the
 *      Apple touch icon; the files are kept in this browser for the publish.
 *
 * Screenshot: .screenshots/lane-h/launch-kit.png, and the kit's own pictures
 * as .screenshots/lane-h/kit-*.png.
 *
 *   npx next start -p 3013
 *   node tests/launch-kit.mjs http://127.0.0.1:3013
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { tmpdir } from "node:os";
const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = process.argv[2] ?? "http://127.0.0.1:3013";
const SHOTS = ".screenshots/lane-h";
mkdirSync(SHOTS, { recursive: true });
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };
const J = (x) => JSON.stringify(x);
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
await page.route(/https:\/\/(api\.)?(vercel|github)\.com\/.*/, (r) => r.fulfill({ status: 404, contentType: "application/json", body: "{}" }));

const env = (s) => JSON.stringify({ state: s, version: 0 });
const page1 = { id: "page_home", name: "Home", path: "/", prompt: "", scroll: "inherit" };
const node = (id, featureId, content, x, y, w, h, extra = {}) => ({ id, pageId: "page_home", featureId, label: "", prompt: "", content, data: "", x, y, w, h, groupId: null, options: {}, priority: "must", custom: false, ...extra });
const LOGO = { id: "pic_logo", path: "assets/pictures/pic_logo.png", type: "image/png", w: 64, h: 64, bytes: 400, alt: "The logo", from: "upload" };
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR4nGP8z8DwnwEJMDIgBQAABgQB/1UzpsIAAAAASUVORK5CYII=";
const BG = "#101820", ACCENT = "#ff5500", TEXT = "#f5f5f5";

await page.goto(`${BASE}/builder`, { waitUntil: "domcontentloaded" });
await page.evaluate(async ({ doc, builds, PNG }) => {
  localStorage.clear();
  localStorage.setItem("builder.builds", builds);
  localStorage.setItem("builder.studio", doc);
  /* A real logo: a yellow disc on magenta, drawn here, so it can be told apart on the icons. */
  const c = document.createElement("canvas"); c.width = 64; c.height = 64;
  const g = c.getContext("2d"); g.fillStyle = "#ff00ff"; g.fillRect(0, 0, 64, 64); g.fillStyle = "#ffee00"; g.beginPath(); g.arc(32, 32, 22, 0, Math.PI * 2); g.fill();
  const blob = await new Promise((d) => c.toBlob(d, "image/png"));
  await new Promise((done) => { const r = indexedDB.open("builder.pictures", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => { const t = r.result.transaction("files", "readwrite"); t.objectStore("files").put(blob, "pic_logo"); t.oncomplete = () => done(); }; });
}, {
  PNG,
  builds: env({ projects: [{ id: "k1", name: "Pixel Pals", updatedAt: Date.now(), nudged: true }], activeId: "k1" }),
  doc: env({
    pages: [page1], activePageId: "page_home", groups: [], selection: [], threads: [], spaces: [], shapes: [], frameWidth: 1440,
    brief: { name: "Pixel Pals", gimmick: "", master: "", description: "Tiny friends who live on the chain" },
    nodes: [
      node("n_title", "big-headline", "PIXEL PALS", 80, 40, 1000, 160, { font: { family: "DejaVu Serif", size: 96, weight: 800 } }),
      node("n_words", "prose", "Words of the site", 80, 260, 600, 80, { font: { family: "DejaVu Sans Mono", size: 18 } }),
      node("n_more", "prose", "More words", 80, 360, 600, 80, { font: { family: "DejaVu Sans Mono", size: 18 } }),
      node("n_logo", "picture", "", 800, 260, 200, 200, { picture: LOGO }),
    ],
  }),
});
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.waitForFunction(() => !!window.__studioHistory, null, { timeout: 20000 });
/* The site's own colours. */
await page.evaluate(({ BG, ACCENT, TEXT }) => window.__studioHistory.act("setLook", { palette: { bg: BG, accent: ACCENT, text: TEXT } }), { BG, ACCENT, TEXT });
await page.waitForTimeout(400);

/* ------------------------------------------------ 1. the kit */
await page.locator("header [data-launch-kit-open]").click();
await page.waitForSelector('[data-kit-item="share"]', { timeout: 20000 });
await page.waitForTimeout(500);
const sizes = await page.locator("[data-kit-item]").evaluateAll((els) => Object.fromEntries(els.map((e) => [e.getAttribute("data-kit-item"), e.getAttribute("data-kit-size")])));
check("a share card 1200 by 630", sizes.share === "1200x630", J(sizes.share));
check("an X banner 1500 by 500", sizes.banner === "1500x500", J(sizes.banner));
check("a site icon at 16, 32, 48, 180, 192 and 512", [16, 32, 48, 180, 192, 512].every((s) => sizes[`icon-${s}`] === `${s}x${s}`), J(Object.keys(sizes).filter((k) => k.startsWith("icon"))));
check("three meme templates", Object.keys(sizes).filter((k) => k.startsWith("meme-")).length === 3, J(Object.keys(sizes)));
const said = (await page.getByText(/^Made from /).first().innerText().catch(() => "")) ?? "";
check("it says it is made from the site's own faces and logo", /DejaVu Serif/.test(said) && /DejaVu Sans Mono/.test(said) && /its logo/.test(said), said.slice(0, 200));
await page.screenshot({ path: `${SHOTS}/launch-kit.png` });

/* ------------------------------------------------ 2. the site's colours, to the pixel; its face changes the card */
const pixels = (id) => page.evaluate(async (id) => {
  const img = document.querySelector(`[data-kit-item="${id}"] img`);
  const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height;
  const g = c.getContext("2d"); g.drawImage(bmp, 0, 0);
  const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
  return { corner: at(4, bmp.height - 30), stripe: at(bmp.width / 2, bmp.height - 4), w: bmp.width, h: bmp.height, src: img.src };
}, id);
const share = await pixels("share");
check("the card's ground is the site's background", `#${share.corner}` === BG, `#${share.corner}`);
check("its stripe is the site's accent", `#${share.stripe}` === ACCENT, `#${share.stripe}`);
const logoAt = await page.evaluate(async () => {
  const img = document.querySelector('[data-kit-item="icon-512"] img');
  const bmp = await createImageBitmap(await (await fetch(img.src)).blob());
  const c = document.createElement("canvas"); c.width = bmp.width; c.height = bmp.height; const g = c.getContext("2d"); g.drawImage(bmp, 0, 0);
  const at = (x, y) => [...g.getImageData(x, y, 1, 1).data].slice(0, 3).map((v) => v.toString(16).padStart(2, "0")).join("");
  return { middle: at(256, 256), edge: at(40, 256) };
});
check("the icon is the site's logo (its yellow middle, its magenta ground)", logoAt.middle === "ffee00" && logoAt.edge === "ff00ff", J(logoAt));
const before = await page.evaluate(async () => { const b = await (await fetch(document.querySelector('[data-kit-item="share"] img').src)).arrayBuffer(); return [...new Uint8Array(b)].reduce((h, v) => (h * 31 + v) >>> 0, 7); });
await page.keyboard.press("Escape");
await page.evaluate(() => window.__studioHistory.act("updateNode", "n_title", { font: { family: "DejaVu Sans Mono", size: 96, weight: 800 } }));
await page.locator("header [data-launch-kit-open]").click();
const idle = () => page.waitForFunction(() => document.querySelector("[data-launch-kit]")?.getAttribute("data-kit-busy") === "0", null, { timeout: 30000 });
await idle();
await page.getByRole("button", { name: "Make again" }).click();
await page.waitForTimeout(200);
await idle();
await page.waitForTimeout(300);
const after = await page.evaluate(async () => { const b = await (await fetch(document.querySelector('[data-kit-item="share"] img').src)).arrayBuffer(); return [...new Uint8Array(b)].reduce((h, v) => (h * 31 + v) >>> 0, 7); });
check("the site's heading face is the card's: set the title in another face and the card changes", before !== after);

/* ------------------------------------------------ 3. downloads, real PNGs of the size they say; memes take captions */
const fetchPng = async (id) => {
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator(`[data-kit-download="${id}"]`).click()]);
  const path = join(tmpdir(), `kit-${Date.now()}-${dl.suggestedFilename()}`);
  await dl.saveAs(path);
  const b = readFileSync(path);
  writeFileSync(`${SHOTS}/kit-${id}.png`, b);
  return { name: dl.suggestedFilename(), png: b.subarray(1, 4).toString() === "PNG", w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
};
for (const [id, w, h] of [["share", 1200, 630], ["banner", 1500, 500], ["icon-180", 180, 180], ["meme-top-bottom", 1080, 1080]]) {
  const f = await fetchPng(id);
  check(`Download ${id}: a ${w} by ${h} PNG, named for what it is`, f.png && f.w === w && f.h === h && f.name.startsWith("pixel-pals-"), J(f));
}
const memeBefore = (await pixels("meme-top-bottom")).src;
const memeHash = (src) => page.evaluate(async (src) => { const b = await (await fetch(src)).arrayBuffer(); return [...new Uint8Array(b)].reduce((h, v) => (h * 31 + v) >>> 0, 7); }, src);
const h1 = await memeHash(memeBefore);
await page.locator('[data-meme-words="top"]').fill("GM PALS");
await page.locator('[data-meme-words="top"]').blur();
await page.waitForTimeout(200);
await idle();
await page.waitForTimeout(300);
const h2 = await memeHash((await pixels("meme-top-bottom")).src);
check("a meme's caption, typed, is drawn", h1 !== h2);

/* ------------------------------------------------ 4. on the published page */
await page.locator("[data-kit-use]").click();
await page.waitForSelector("[data-kit-said]", { timeout: 15000 });
const head = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio")).state.brief.head);
check("the share card and the icons are the site's link preview now", head?.image?.w === 1200 && head?.image?.h === 630 && head?.icons?.length === 6, J({ image: head?.image?.picture?.path, icons: head?.icons?.map((i) => `${i.rel} ${i.sizes}`) }));
const held = await page.evaluate(async (ids) => new Promise((done) => { const r = indexedDB.open("builder.pictures", 1); r.onsuccess = () => { const g = r.result.transaction("files").objectStore("files").getAllKeys(); g.onsuccess = () => done(ids.every((id) => g.result.includes(id))); }; }), [head.image.picture.id, ...head.icons.map((i) => i.picture.id)]);
check("their files are kept in this browser, for the publish to carry", held === true);
const files = await page.evaluate(() => window.__studioExport());
const index = files.find((f) => f.path === "index.html")?.content ?? "";
const card = head.image.picture.path;
check("the published page's og:image is the share card", new RegExp(`property="og:image" content="[^"]*${card}"`).test(index), (index.match(/og:image"[^>]*/) ?? [""])[0]);
check("its twitter:image too, as the large card", new RegExp(`name="twitter:image" content="[^"]*${card}"`).test(index) && /name="twitter:card" content="summary_large_image"/.test(index));
const links = [...index.matchAll(/<link rel="(icon|apple-touch-icon)"[^>]*>/g)].map((m) => m[0]);
check("every icon size is linked, the 180 as the Apple touch icon", [16, 32, 48, 192, 512].every((s) => links.some((l) => l.includes(`sizes="${s}x${s}"`) && l.includes('rel="icon"'))) && links.some((l) => /apple-touch-icon/.test(l) && /180x180/.test(l)), J(links.slice(0, 8)));

check("no page errors", errors.length === 0, errors.slice(0, 3).join(" | "));
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
