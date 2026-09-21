/**
 * A picture part draws the picture it holds, and the layer it wears is its own.
 *
 * Two ways a part can carry a picture, and both used to go wrong:
 *   · `node.picture`, a file in this browser's storage, the way the split
 *     hero and the product page hold theirs. The Picture part ignored the
 *     prop and drew its stand-in crop with the file's name on a plate.
 *   · `node.texture`, an image layer in the look's stack, the way the
 *     Builder's own import and his capture carry theirs. The part wore it,
 *     and because the layer was on, the page and every card wore it too:
 *     his logo tiled across the whole ground with the parts unreadable under
 *     it. A layer a picture wears is the picture's, so it is turned off for
 *     the page when the document is taken in, and stays on the part.
 *
 *   node tests/picture-held.mjs [url]      # default http://localhost:3000
 */
import { createRequire } from "node:module";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found. npm i -D playwright, or set PLAYWRIGHT_MODULE.");
})();

const URL_ = process.argv[2] ?? "http://localhost:3000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* A 2×2 red PNG. */
const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEklEQVR4nGP4z8DwHwyBFBAAAGV1B/3l7cfLAAAAAElFTkSuQmCC";
const DATA = `data:image/png;base64,${PNG}`;
const node = (id, f, label, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: f, label, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null,
  ...extra,
});
const layer = { id: "tx_logo", kind: "image", role: "accent", scale: 100, angle: 0, opacity: 1, contrast: 0, blend: "normal", hue: 0, target: "page", pattern: false, cutout: false, tolerance: 0.35, weave: 1, on: true, src: DATA };
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }],
  nodes: [
    node("held", "picture", "solworks-logo", 40, 40, 112, 112, { picture: { id: "pic_held1", path: "assets/pictures/pic_held1.png", type: "image/png", w: 2, h: 2, bytes: 70, alt: "the logo", from: "upload" } }),
    node("worn", "picture", "solana-logo", 200, 40, 112, 112, { texture: "tx_logo" }),
    node("bare", "picture", "a-picture", 360, 40, 112, 112),
    node("words", "prose", "words", 40, 200, 600, 80, { content: "Words on a card" }),
  ],
  groups: [], shapes: [], format: {}, brief: { name: "Capture", gimmick: "", master: "" },
  look: { palette: {}, texture: [layer], target: "page", light: { on: false, x: 0.5, y: 0.2, strength: 0.6, height: 0.5 } },
  frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
await context.addInitScript((d) => localStorage.setItem("builder.studio", d), doc);
/* The held picture's bytes, in this browser's file storage under the id the part names. */
await context.addInitScript((png) => {
  const bytes = Uint8Array.from(atob(png), (c) => c.charCodeAt(0));
  const rq = indexedDB.open("builder.pictures", 1);
  rq.onupgradeneeded = () => { if (!rq.result.objectStoreNames.contains("files")) rq.result.createObjectStore("files"); };
  rq.onsuccess = () => { rq.result.transaction("files", "readwrite").objectStore("files").put(new Blob([bytes], { type: "image/png" }), "pic_held1"); };
}, PNG);
const page = await context.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
await page.waitForTimeout(2200);

const partOf = (id) => page.evaluate((id) => {
  const el = document.querySelector(`[data-node-id="${id}"] [data-part]`);
  if (!el) return null;
  const img = el.querySelector("img");
  return {
    painted: el.hasAttribute("data-part-picture"),
    img: img ? { src: img.getAttribute("src")?.slice(0, 5), alt: img.getAttribute("alt"), w: img.clientWidth, h: img.clientHeight } : null,
    bg: getComputedStyle(el).backgroundImage.slice(0, 24),
    text: (el.textContent ?? "").trim(),
  };
}, id);

const held = await partOf("held");
check("a picture the node holds as a file is drawn as that picture, through the same slot the split hero uses", !!held?.img && held.img.src === "blob:" && held.img.alt === "the logo" && held.img.w > 100, JSON.stringify(held));
check("not as the stand-in crop with the file's name on a plate", !!held && held.painted && held.text === "", JSON.stringify(held));

const worn = await partOf("worn");
check("a picture that wears an image layer is painted with it", !!worn && worn.painted && /^url\("data:image/.test(worn.bg), JSON.stringify(worn));

const bare = await partOf("bare");
check("a picture with neither still shows its stand-in and its name, so the slot is visibly empty", !!bare && !bare.painted && bare.text === "a-picture", JSON.stringify(bare));

const state = await page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") ?? "{}").state);
check("the layer the picture wears is turned off for the page when the document is taken in", state?.look?.texture?.[0]?.on === false, JSON.stringify(state?.look?.texture?.[0]?.on));
const ground = await page.evaluate(() => {
  const frame = document.querySelector("[data-frame]");
  if (!frame) return "no frame";
  return [frame, ...frame.querySelectorAll("[data-frame-wash], [data-frame-light]")].map((e) => getComputedStyle(e).backgroundImage).join(" ");
});
check("so the page's ground is not tiled with the logo", typeof ground === "string" && ground !== "no frame" && !/data:image/.test(ground), `the frame paints: ${String(ground).slice(0, 60)}`);
const wordsCard = await partOf("words");
check("and the words' card is not either", !!wordsCard && !/data:image/.test(wordsCard.bg), JSON.stringify(wordsCard?.bg));

await page.evaluate(() => localStorage.clear());
await browser.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
