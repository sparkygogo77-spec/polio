/**
 * A PICTURE DROPPED ON THE BOARD ARRIVES WHOLE, OR NOT AT ALL.
 *
 * The owner dragged a generated 1024×1024 picture onto the board. The part
 * said "Picture 1024×1024" and stood about 900 square, but only a strip at
 * the top drew; the rest was dark. MEASURED: the board wrote the dragged
 * picture into the part as a `data:` URL inside an <img> (2.3 MB for a
 * 1024² PNG), and Chrome refuses any URL past 2 MB (2,097,152 characters),
 * so the image never loaded. A file, a link or an <img> dragged from
 * another page landed nothing at all.
 *
 * Held here, for each way a picture comes: the Render panel's own drag (a
 * data: URL), a data: link, an http link, an <img> dragged from another
 * page (text/html), and a file from disk, as PNG and WebP:
 *
 *   · the part holds a stored picture (a file in this browser, a path in the
 *     document), never the bytes in its HTML;
 *   · every byte arrived: the stored size is the original's, and it draws
 *     at 1024×1024 with its last row where it should be;
 *   · a picture that is cut off is refused, and nothing is stored;
 *   · one over the cap is refused in words that name the cap.
 *
 *   node tests/picture-drop.mjs http://127.0.0.1:3013
 */
import { existsSync } from "node:fs";
import { createRequire } from "node:module";

const { chromium } = createRequire(import.meta.url)("playwright-core");
const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const AT = process.env.PLAYWRIGHT_CHROMIUM ?? "/opt/pw-browsers/chromium";
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

const browser = await chromium.launch({ args: ["--no-sandbox"], ...(existsSync(AT) ? { executablePath: AT } : {}) });
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
await page.route("**/api/studio/**", (r) => r.fulfill({ status: 200, contentType: "application/json", body: "{}" }));
await page.goto(`${BASE}/builder`, { waitUntil: "networkidle" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(1500);

/* Two noisy 1024² pictures (so they are big), kept on the page as data: URLs; the last row is a known colour. */
const sizes = await page.evaluate(() => {
  const c = document.createElement("canvas"); c.width = c.height = 1024; const x = c.getContext("2d");
  const im = x.createImageData(1024, 1024);
  for (let i = 0; i < im.data.length; i += 4) { const y = Math.floor(i / 4 / 1024); im.data[i] = y >= 1016 ? 250 : (i / 4) % 256; im.data[i + 1] = y >= 1016 ? 20 : Math.random() * 255; im.data[i + 2] = y >= 1016 ? 200 : y % 256; im.data[i + 3] = 255; }
  x.putImageData(im, 0, 0);
  window.__pics = { png: c.toDataURL("image/png"), webp: c.toDataURL("image/webp", 0.95) };
  const bytes = (d) => atob(d.split(",")[1]).length;
  return { png: window.__pics.png.length, pngBytes: bytes(window.__pics.png), webpBytes: bytes(window.__pics.webp) };
});
console.log(`  the PNG is a ${(sizes.png / 1e6).toFixed(2)} MB data: URL (${sizes.pngBytes} bytes); the WebP ${sizes.webpBytes} bytes`);

/* The same pictures served over http, as another page would link them. */
const served = {};
await page.route("http://pictures.test/**", (r) => {
  const f = served[new URL(r.request().url()).pathname];
  return f ? r.fulfill({ status: 200, contentType: f.type, body: f.body, headers: { "access-control-allow-origin": "*" } }) : r.fulfill({ status: 404, body: "" });
});
const pngBuf = Buffer.from((await page.evaluate(() => window.__pics.png)).split(",")[1], "base64");
const webpBuf = Buffer.from((await page.evaluate(() => window.__pics.webp)).split(",")[1], "base64");
served["/big.png"] = { type: "image/png", body: pngBuf };
served["/big.webp"] = { type: "image/webp", body: webpBuf };

const nodes = () => page.evaluate(() => window.__studioPublishDoc().nodes);
/** Drop onto the middle of the page, the way a browser hands a drop over. */
const drop = (how) => page.evaluate(async (how) => {
  const frame = document.querySelector("[data-frame]"); const r = frame.getBoundingClientRect();
  const dt = new DataTransfer();
  const P = window.__pics;
  const fileOf = (d, name, cut = 1) => { const bin = atob(d.split(",")[1]); const n = Math.floor(bin.length * cut); const u = new Uint8Array(n); for (let i = 0; i < n; i++) u[i] = bin.charCodeAt(i); return new File([u], name, { type: d.slice(5, d.indexOf(";")) }); };
  if (how.kind === "studio") dt.setData("application/x-studio-picture", JSON.stringify({ src: P[how.fmt], w: 1024, h: 1024 }));
  if (how.kind === "data-link") { dt.setData("text/uri-list", P[how.fmt]); dt.setData("text/plain", P[how.fmt]); }
  if (how.kind === "http-link") { dt.setData("text/uri-list", how.url); dt.setData("text/plain", how.url); }
  if (how.kind === "html-img") { dt.setData("text/html", `<meta charset="utf-8"><img src="${how.url}" alt="a picture">`); dt.setData("text/uri-list", how.url); }
  if (how.kind === "file") dt.items.add(fileOf(P[how.fmt], `big.${how.fmt}`, how.cut ?? 1));
  if (how.kind === "huge") dt.items.add(new File([new Uint8Array(how.bytes)], "huge.png", { type: "image/png" }));
  const at = { clientX: r.left + r.width / 2, clientY: r.top + 220 };
  const target = document.elementFromPoint(at.clientX, at.clientY) ?? frame;
  for (const t of ["dragenter", "dragover", "drop"]) target.dispatchEvent(new DragEvent(t, { bubbles: true, cancelable: true, dataTransfer: dt, ...at }));
}, how);

/** What the new part draws: the picture's own size, and its last rows' colour. */
const drawn = (id) => page.evaluate(async (id) => {
  const img = document.querySelector(`[data-node-id="${id}"] img`);
  if (!img) return null;
  for (let t = 0; t < 40 && !(img.complete && img.naturalWidth); t++) await new Promise((r) => setTimeout(r, 100));
  const c = document.createElement("canvas"); c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext("2d"); x.drawImage(img, 0, 0);
  const px = [...x.getImageData(512, 1020, 1, 1).data];
  return { w: img.naturalWidth, h: img.naturalHeight, last: px, src: img.src.slice(0, 5) };
}, id);

const whole = async (label, how, bytes) => {
  const before = (await nodes()).length;
  await drop(how);
  let added = [];
  for (let t = 0; t < 30 && !added.length; t++) { await page.waitForTimeout(300); added = (await nodes()).slice(before); }
  const n = added[0];
  const html = n?.code?.html ?? "";
  check(`${label}: it lands as a stored picture, not bytes in the part`, !!n?.picture && !/data:image/.test(html), n ? JSON.stringify({ picture: n.picture ? `${n.picture.w}×${n.picture.h} ${n.picture.bytes}B` : null, html: html.length }) : "nothing landed");
  if (!n?.picture) return;
  check(`${label}: every byte arrived`, n.picture.bytes === bytes && n.picture.w === 1024 && n.picture.h === 1024, `${n.picture.bytes} of ${bytes} bytes, ${n.picture.w}×${n.picture.h}`);
  const d = await drawn(n.id);
  const lastOk = !!d && Math.abs(d.last[0] - 250) < 12 && Math.abs(d.last[1] - 20) < 12 && Math.abs(d.last[2] - 200) < 12;
  check(`${label}: it draws whole, down to its last rows`, !!d && d.w === 1024 && d.h === 1024 && lastOk, JSON.stringify(d));
};

await whole("the Render panel's drag (a 2.3 MB PNG data: URL)", { kind: "studio", fmt: "png" }, sizes.pngBytes);
await whole("a data: link (WebP)", { kind: "data-link", fmt: "webp" }, sizes.webpBytes);
await whole("an http link (PNG), fetched whole", { kind: "http-link", url: "http://pictures.test/big.png" }, pngBuf.length);
await whole("an <img> dragged from another page (WebP)", { kind: "html-img", url: "http://pictures.test/big.webp" }, webpBuf.length);
await whole("a PNG file from disk", { kind: "file", fmt: "png" }, sizes.pngBytes);
await whole("a WebP file from disk", { kind: "file", fmt: "webp" }, sizes.webpBytes);

/* Cut off: half a PNG is refused, and nothing is stored. */
const toasts = () => page.evaluate(() => document.body.innerText);
let before = (await nodes()).length;
await drop({ kind: "file", fmt: "png", cut: 0.5 });
await page.waitForTimeout(2500);
check("half a PNG is refused, and nothing is stored", (await nodes()).length === before && /did not arrive whole|cut off|could not be read/i.test(await toasts()), `${(await nodes()).length - before} added`);

/* Over the cap: said, with the cap, never truncated. */
before = (await nodes()).length;
await drop({ kind: "huge", bytes: 26 * 1024 * 1024 });
await page.waitForTimeout(2500);
const said = await toasts();
check("a picture over the cap is refused in words that name the cap", (await nodes()).length === before && /over the \d+ MB/i.test(said), said.match(/[^.\n]*over the[^.\n]*/i)?.[0] ?? "nothing said");

await browser.close();
const bad = results.filter((r) => !r).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
