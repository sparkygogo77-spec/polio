/**
 * Remake this picture: one prompt, the picture as the reference, the new one
 * in its place at exactly its size.
 *
 * The owner's words: "right-click any image on the site, type one prompt,
 * make that image an instant reference, and by default have GPT Image 2
 * regenerate it with the prompt, replacing it at the exact same dimensions,
 * with the same purpose and animations."
 *
 * A stand-in for OpenAI is served here (no real call, no real key: the key
 * typed is STANDIN_OPENAI_KEY). It answers the model list and the image edit
 * call with a picture of the size asked, see-through when asked, and
 * remembers what it was sent. Checked: the menu on the wheel's tray and the
 * parts tree; the help line with no key; the reference and the model sent;
 * exact pixel sizes for a square, a wide, a tall and a see-through picture;
 * link, motion, clip, place and words for people who cannot see kept, and
 * the offer to change those words; progress and Cancel; the version strip;
 * Undo; the fall back when GPT Image 2 is not open to the key; the export
 * carrying the new file and the document no bytes. Screenshots to
 * .screenshots/lane-e/.
 *
 *   OPENAI_API=http://127.0.0.1:4341 npx next start -p 3014
 *   node tests/remake-picture.mjs http://127.0.0.1:3014
 */
import http from "node:http";
import zlib from "node:zlib";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { askSize } from "../src/features/studio/pictures/remake.ts";

const req = createRequire(import.meta.url);
const { chromium } = (() => {
  for (const c of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) {
    try { return req(c); } catch { /* next */ }
  }
  throw new Error("No Playwright found.");
})();

const URL_ = process.argv[2] ?? "http://127.0.0.1:3014";
const PORT = Number(process.env.STUB_PORT ?? 4341);
const KEY = "STANDIN_OPENAI_KEY_0000";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};
mkdirSync(".screenshots/lane-e", { recursive: true });

/* ------------------------------------------------------------ the stand-in */
/** A PNG of w×h, one colour; with `clear`, the left half see-through. */
function png(w, h, clear) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const o = y * (w * 4 + 1) + 1 + x * 4;
      raw[o] = 40; raw[o + 1] = 90; raw[o + 2] = 220; raw[o + 3] = clear && x < w / 2 ? 0 : 255;
    }
  }
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}
const field = (body, name) => new RegExp(`name="${name}"\\r\\n\\r\\n([^\\r]*)\\r\\n`).exec(body)?.[1] ?? null;
const sent = [];
let models = ["gpt-image-2", "gpt-image-1.5", "gpt-image-1", "dall-e-3"];
let slow = 0;
const stub = http.createServer(async (rq, res) => {
  const chunks = [];
  for await (const c of rq) chunks.push(c);
  const body = Buffer.concat(chunks).toString("latin1");
  const auth = rq.headers.authorization ?? "";
  if (auth !== `Bearer ${KEY}`) { res.writeHead(401, { "content-type": "application/json" }); res.end(JSON.stringify({ error: { message: "bad key" } })); return; }
  if (rq.url === "/v1/models") { res.writeHead(200, { "content-type": "application/json" }); res.end(JSON.stringify({ data: models.map((id) => ({ id })) })); return; }
  if (rq.url === "/v1/images/edits") {
    const one = { model: field(body, "model"), prompt: field(body, "prompt"), size: field(body, "size"), background: field(body, "background"), image: /name="image"; filename="[^"]+"\r\nContent-Type: image\//i.test(body) };
    sent.push(one);
    if (slow) await new Promise((r) => setTimeout(r, slow));
    const [w, h] = (one.size ?? "1024x1024").split("x").map(Number);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ data: [{ b64_json: png(w, h, one.background === "transparent").toString("base64") }] }));
    return;
  }
  res.writeHead(404); res.end();
});
await new Promise((r) => stub.listen(PORT, "127.0.0.1", r));

/* ------------------------------------------------------------ a board with four pictures */
const PICS = {
  square: { w: 300, h: 300, clear: false },
  wide: { w: 900, h: 300, clear: false },
  tall: { w: 240, h: 720, clear: false },
  clear: { w: 256, h: 256, clear: true },
};
const node = (id, x, y, w, h, extra = {}) => ({
  id, pageId: "p0", featureId: "picture", label: id, prompt: "", content: "", data: "", x, y, w, h, groupId: null, options: {},
  priority: "must", custom: false, glyph: null, hue: null, locked: false, link: null, colour: null, font: null,
  anim: null, animSpeed: 1, animDelay: 0, animEase: "smooth", aura: null, auraSize: 1, auraStyle: "glow", texture: null, sketch: null, ...extra,
});
const picOf = (id, k) => ({ id: `pic_${id}`, path: `assets/pictures/pic_${id}.png`, type: "image/png", w: PICS[k].w, h: PICS[k].h, bytes: 0, alt: `the ${k} picture`, from: "upload" });
const NODES = [
  node("n_square", 100, 80, 300, 300, { picture: picOf("square", "square"), link: { kind: "url", target: "https://example.com/square" }, work: { id: "reveal", inputs: { direction: "up" } }, anim: "fade", outline: { d: "M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z", closed: true, cut: "M0.5 0 L1 0.5 L0.5 1 L0 0.5 Z", width: 0, encloses: 0.5, points: 4 } }),
  node("n_wide", 460, 80, 900, 300, { picture: picOf("wide", "wide") }),
  node("n_tall", 100, 440, 240, 720, { picture: picOf("tall", "tall") }),
  node("n_clear", 460, 440, 256, 256, { picture: picOf("clear", "clear") }),
];
const doc = JSON.stringify({ state: {
  pages: [{ id: "p0", name: "Home", path: "/", prompt: "", scroll: "inherit" }], nodes: NODES, groups: [], shapes: [],
  format: {}, brief: { name: "REMAKE", gimmick: "", master: "" }, frameWidth: 1440, activePageId: "p0", trail: [],
}, version: 0 });

const browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
await ctx.addInitScript((d) => { if (!sessionStorage.getItem("seeded")) { localStorage.setItem("builder.studio", d); sessionStorage.setItem("seeded", "1"); } }, doc);
const page = await ctx.newPage();
await page.goto(`${URL_}/builder`, { waitUntil: "networkidle" });
/* The four files, made in the page and kept where the Builder keeps pictures. */
await page.evaluate(async (pics) => {
  const db = await new Promise((ok, no) => { const r = indexedDB.open("builder.pictures", 1); r.onupgradeneeded = () => r.result.createObjectStore("files"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); });
  for (const [k, p] of Object.entries(pics)) {
    const c = new OffscreenCanvas(p.w, p.h); const g = c.getContext("2d");
    if (p.clear) { g.clearRect(0, 0, p.w, p.h); g.fillStyle = "#e33"; g.beginPath(); g.arc(p.w / 2, p.h / 2, p.w / 3, 0, Math.PI * 2); g.fill(); }
    else { g.fillStyle = "#e33"; g.fillRect(0, 0, p.w, p.h); g.fillStyle = "#fff"; g.fillRect(p.w / 4, p.h / 4, p.w / 2, p.h / 2); }
    const blob = await c.convertToBlob({ type: "image/png" });
    await new Promise((ok, no) => { const t = db.transaction("files", "readwrite"); t.objectStore("files").put(blob, `pic_${k}`); t.oncomplete = ok; t.onerror = () => no(t.error); });
  }
}, PICS);
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1800);

const state = () => page.evaluate(() => JSON.parse(localStorage.getItem("builder.studio") || "{}").state ?? {});
const nodeOf = async (id) => (await state()).nodes.find((n) => n.id === id);
/** A kept picture's real pixels, read back from the picture store. */
const pixels = (picId) => page.evaluate(async (id) => {
  const db = await new Promise((ok) => { const r = indexedDB.open("builder.pictures", 1); r.onsuccess = () => ok(r.result); });
  const blob = await new Promise((ok) => { const g = db.transaction("files").objectStore("files").get(id); g.onsuccess = () => ok(g.result); });
  if (!blob) return null;
  const img = await createImageBitmap(blob);
  const c = new OffscreenCanvas(img.width, img.height); const g = c.getContext("2d"); g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  let clear = 0; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) clear++;
  return { w: img.width, h: img.height, clear, type: blob.type };
}, picId);
const card = page.locator("[data-remake-card]");

/** The wheel's tray on a part: right press, then "Remake this picture…". */
const fromWheel = async (id) => {
  const box = await page.locator(`[data-node-id="${id}"]`).first().boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 120), { button: "right" });
  await page.waitForTimeout(600);
  /* The tray under the wheel opens under the hand. */
  const tray = page.locator("[data-tray]").first();
  if (await tray.count()) { await tray.hover(); await page.waitForTimeout(300); }
  const item = page.locator('[data-tray-item="remake"]').first();
  const seen = await item.count();
  if (seen) await item.click();
  await page.waitForTimeout(500);
  return seen > 0;
};
/** The Element tab's list (flat, or the tree under Show nesting): a right-click on the picture's row. */
const fromTree = async (id) => {
  await page.locator("[data-side-panel] [role=radio]").filter({ hasText: /Element|Parts/ }).first().click({ force: true }).catch(() => {});
  await page.waitForTimeout(300);
  const row = page.locator(`[data-list-row="${id}"], [data-tree-row="${id}"]`).first();
  if (!(await row.count())) return false;
  await row.scrollIntoViewIfNeeded().catch(() => {});
  await row.click({ button: "right", force: true });
  await page.waitForTimeout(500);
  return (await card.count()) === 1;
};
const remakeWith = async (prompt) => {
  await card.locator("[data-remake-prompt]").fill(prompt);
  await card.locator("[data-remake-go]").click();
  await page.locator("[data-remake-done]").first().waitFor({ timeout: 30_000 }).catch(() => {});
  await page.waitForTimeout(400);
  return card.locator("[data-remake-done]").getAttribute("data-remake-done").catch(() => null);
};
const closeCard = async () => { if (await card.count()) { await page.keyboard.press("Escape"); await page.waitForTimeout(300); } };

/* 1 and 5: the menu, and no key */
check("right-pressing a picture on the board offers Remake this picture… in the wheel's tray", await fromWheel("n_square"));
check("it opens one prompt box", (await card.count()) === 1 && (await card.locator("[data-remake-prompt]").count()) === 1);
await card.locator("[data-remake-model]").filter({ hasNotText: "Checking" }).waitFor({ timeout: 10_000 }).catch(() => {});
const noKey = await card.locator("[data-remake-model]").innerText();
check("with no key, it says how to add one, and will not run", /No OpenAI key yet/.test(noKey) && /key button/.test(noKey) && (await card.locator("[data-remake-go]").isDisabled()), noKey);
await page.screenshot({ path: ".screenshots/lane-e/remake-no-key.png" });
await closeCard();

/* The person's own key, typed into the keys panel like any other. */
for (let go = 0; go < 3; go++) {
  const k = page.locator('[role="dialog"][aria-label="Keys"]').first();
  if ((await k.count()) && (await k.getAttribute("data-open")) === "1") break;
  await page.keyboard.press("Control+Shift+K");
  await page.waitForTimeout(800);
}
const keys = page.locator('[role="dialog"][aria-label="Keys"]').first();
check("the keys panel has a place for an OpenAI key", (await keys.locator('input[placeholder="sk-…"]').count()) === 1);
await keys.locator('input[placeholder="sk-…"]').fill(KEY);
const save = keys.getByRole("button", { name: /Save to this browser|Hold in this tab/ }).first();
if (await save.count()) await save.click();
await page.waitForTimeout(600);
await page.keyboard.press("Escape");
await page.waitForTimeout(400);

check("a right-click on the picture's row in the parts tree opens the same card", await fromTree("n_square"));
await card.locator("[data-remake-model]").filter({ hasNotText: "Checking" }).waitFor({ timeout: 10_000 }).catch(() => {});
const ready = await card.locator("[data-remake-model]").innerText();
check("before anything is drawn it says GPT Image 2, and that it uses the person's own key", /GPT Image 2/.test(ready) && /your own OpenAI key/.test(ready), ready);
await page.screenshot({ path: ".screenshots/lane-e/remake-card.png" });

/* 2, 3: the square, its reference, its exact size, and everything else kept */
const before = await nodeOf("n_square");
const r1 = await remakeWith("the same square at night, lit in blue");
const last = sent[sent.length - 1];
check("the picture itself is sent as the reference, with the prompt, to GPT Image 2", r1 === "ok" && last?.image && last.model === "gpt-image-2" && last.prompt === "the same square at night, lit in blue", JSON.stringify(last));
const want = askSize("gpt-image-2", 300, 300);
check("it asks for the supported size nearest the original's shape", last?.size === `${want.w}x${want.h}`, `${last?.size}, nearest to 300×300`);
const after = await nodeOf("n_square");
const px1 = await pixels(after.picture.id);
check("the new picture replaces the old one on the same part", after.picture.id !== before.picture.id && after.picture.from === "drawn");
check("square: exactly 300×300 pixels", px1?.w === 300 && px1?.h === 300 && after.picture.w === 300 && after.picture.h === 300, px1 ? `${px1.w}×${px1.h}` : "no file");
const kept = (k) => JSON.stringify(after[k]) === JSON.stringify(before[k]);
check("its link, motion, clip, place and size are kept", ["link", "work", "anim", "outline", "x", "y", "w", "h"].every(kept), ["link", "work", "anim", "outline", "x", "y", "w", "h"].filter((k) => !kept(k)).join(", ") || "all");
check("its words for people who cannot see it are kept", after.picture.alt === before.picture.alt, after.picture.alt);
await page.screenshot({ path: ".screenshots/lane-e/remake-done.png" });
await card.locator("[data-remake-alt]").click();
await page.waitForTimeout(300);
check("and the card offers what was written instead, and uses it when pressed", (await nodeOf("n_square")).picture.alt === "the same square at night, lit in blue");
await closeCard();

/* Wide, tall and see-through, each its exact size; the see-through one stays see-through. */
for (const k of ["wide", "tall", "clear"]) {
  const id = `n_${k}`;
  const opened = (await fromTree(id)) || (await fromWheel(id));
  const r = opened ? await remakeWith(`a ${k} remake`) : null;
  const n = await nodeOf(id);
  const px = n?.picture ? await pixels(n.picture.id) : null;
  check(`${k}: exactly ${PICS[k].w}×${PICS[k].h} pixels`, r === "ok" && px?.w === PICS[k].w && px?.h === PICS[k].h, px ? `${px.w}×${px.h}, asked ${sent[sent.length - 1]?.size}` : "no file");
  if (k === "clear") {
    check("a see-through picture is asked for a see-through background, and stays see-through", sent[sent.length - 1]?.background === "transparent" && px?.clear > 0 && px.type === "image/png", `${px?.clear} clear pixels, ${px?.type}`);
  } else check(`${k}: an opaque picture is not asked for a see-through background`, sent[sent.length - 1]?.background === null);
  await closeCard();
}

/* 4: progress on the part, and Cancel */
slow = 4000;
await fromTree("n_wide");
const wideBefore = (await nodeOf("n_wide")).picture.id;
await card.locator("[data-remake-prompt]").fill("a slow one");
await card.locator("[data-remake-go]").click();
await page.waitForTimeout(700);
const onPart = page.locator('[data-remake-running="n_wide"]');
check("while it works the part says so, with Cancel", (await onPart.count()) === 1 && (await onPart.locator("[data-remake-cancel]").count()) === 1, await onPart.innerText().catch(() => ""));
await page.screenshot({ path: ".screenshots/lane-e/remake-progress.png" });
await onPart.locator("[data-remake-cancel]").click();
await page.waitForTimeout(800);
check("Cancel leaves the picture as it was, and says so", (await nodeOf("n_wide")).picture.id === wideBefore && (await card.locator('[data-remake-done="cancelled"]').count()) === 1);
slow = 0;
await closeCard();

/* 4: the version strip, and Undo */
await fromTree("n_square");
await remakeWith("a second remake of the square");
await closeCard();
const sq = await nodeOf("n_square");
check("the part keeps its versions: the original and each remake", sq.pictureVersions?.length === 3 && sq.pictureVersions[0].id === before.picture.id && sq.picture.id === sq.pictureVersions[2].id, `${sq.pictureVersions?.length} versions`);
/* Undo straight after a remake: the picture before it, and Redo the remake again. */
await page.mouse.click(5, 300);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
check("Undo straight after a remake puts back the picture it replaced", (await nodeOf("n_square")).picture.id === sq.pictureVersions[1].id);
await page.keyboard.press("Control+Shift+z");
await page.waitForTimeout(400);
check("and Redo brings the remake back", (await nodeOf("n_square")).picture.id === sq.pictureVersions[2].id);
await page.locator('[data-list-row="n_square"] [data-element-row], [data-tree-row="n_square"] [data-element-row]').first().click({ force: true });
await page.waitForTimeout(600);
const strip = page.locator("[data-picture-versions]");
await strip.first().scrollIntoViewIfNeeded().catch(() => {});
check("the part panel's picture section shows the strip of versions", (await strip.count()) === 1 && (await strip.locator("[data-picture-version]").count()) === 3);
await page.screenshot({ path: ".screenshots/lane-e/remake-versions.png" });
await strip.locator("[data-picture-version]").first().click();
await page.waitForTimeout(400);
check("pressing the original wears it again", (await nodeOf("n_square")).picture.id === before.picture.id);
await strip.locator("[data-picture-version]").last().click();
await page.waitForTimeout(400);
const newest = (await nodeOf("n_square")).picture.id;
await page.mouse.click(5, 300);
await page.keyboard.press("Control+z");
await page.waitForTimeout(400);
check("Undo brings back the picture before", (await nodeOf("n_square")).picture.id !== newest && (await nodeOf("n_square")).picture.id === before.picture.id);

/* 6: the export ships the new file; the document holds no bytes */
await page.keyboard.press("Control+Shift+z").catch(() => {});
await page.waitForTimeout(300);
const wide = await nodeOf("n_wide");
const files = await page.evaluate(async () => (await window.__studioExport()).map((f) => ({ path: f.path, encoding: f.encoding ?? null, size: typeof f.content === "string" ? f.content.length : 0 })));
check("the export carries the new picture as a file", files.some((f) => f.path === wide.picture.path && f.size > 0), wide.picture.path);
const raw = await page.evaluate(() => localStorage.getItem("builder.studio") ?? "");
check("and the document holds paths, never picture bytes", !/iVBORw0|data:image\//.test(raw), `${raw.length} characters`);

/* 2: GPT Image 2 not open to the key: the newest that is, and the card says so */
models = ["gpt-image-2.5-sunburst", "gpt-image-1"];
await fromTree("n_tall");
await card.locator("[data-remake-model]").filter({ hasNotText: "Checking" }).waitFor({ timeout: 10_000 }).catch(() => {});
const fell = await card.locator("[data-remake-model]").innerText();
check("when GPT Image 2 is not open to the key, the newest GPT image model is used, and it says so", /GPT Image 2 is not open to this key/.test(fell) && /2\.5 Sunburst/.test(fell), fell);
await remakeWith("fallback remake");
check("and that model is the one asked", sent[sent.length - 1]?.model === "gpt-image-2.5-sunburst", sent[sent.length - 1]?.model);
await page.screenshot({ path: ".screenshots/lane-e/remake-fallback.png" });

await browser.close();
stub.close();
const failed = results.filter((r) => !r).length;
console.log(`\n${failed ? `${failed} FAILED` : "all good"} — ${results.length - failed}/${results.length}`);
process.exit(failed ? 1 : 0);
