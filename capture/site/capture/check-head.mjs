/**
 * A PAGE'S HEAD IS CAPTURED: ITS LINK PREVIEW AND ITS ICONS.
 *
 * The owner pasted gotchi.gg and our copy into Discord: gotchi.gg drew a
 * large card (title, description, a 1200-wide banner) and its own icon; the
 * copy drew its title and a tiny thumbnail. Nothing of the head was read.
 * A stand-in site holds what a head says:
 *
 *   <title>, meta description, og:* (title, description, type, url,
 *   site_name, image, image:width/height/alt), twitter:* (card
 *   summary_large_image, image), theme-color, link rel icon,
 *   apple-touch-icon, mask-icon and manifest;
 *
 * and a second page whose title and description differ. The capture keeps
 * each page's `head` with absolute addresses and downloads its share
 * picture and icon files beside the other pictures; the document carries
 * `doc.head` (pictures as pictures) and, for a page that differs, only
 * what differs in `page.head`.
 *
 *   node capture/site/capture/check-head.mjs
 */
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync, crc32 } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok === true);
  console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${ok === true || !detail ? "" : ` — ${String(detail).slice(0, 500)}`}`);
};
const J = (x) => JSON.stringify(x);
/** A PNG of one colour, w×h. */
function png(w, h, [r, g, b]) {
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array.from({ length: w }, () => [r, g, b]).flat())]);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: h }, () => row)))), chunk("IEND", Buffer.alloc(0))]);
}
const files = { "/share.png": png(1200, 630, [255, 80, 160]), "/favicon.png": png(32, 32, [40, 30, 50]), "/apple-touch-icon.png": png(180, 180, [255, 220, 60]) };
const headOf = (title, description, path = "/") => `<title>${title}</title>
<meta name="description" content="${description}">
<meta property="og:type" content="website"><meta property="og:site_name" content="stand in">
<meta property="og:title" content="${title}"><meta property="og:description" content="${description}">
<meta property="og:url" content="${path}"><meta property="og:image" content="/share.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="the device and the logo">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="/share.png"><meta name="twitter:site" content="@standin">
<meta name="theme-color" content="#ff50a0">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon.png"><link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
<link rel="mask-icon" href="/favicon.png" color="#2b1d2e"><link rel="manifest" href="/site.webmanifest">`;
const pages = {
  "/": `<!doctype html><html><head><meta charset="utf-8">${headOf("gotchi", "hold $gotchi, hatch a pixel pet, raise it.")}</head><body><h1>home</h1><a href="/about">about</a></body></html>`,
  "/about": `<!doctype html><html><head><meta charset="utf-8">${headOf("about · gotchi", "the rules of the pets.", "/about")}</head><body><h1>about</h1></body></html>`,
};
const serverCode = `const pages = ${J(pages)}; const files = ${J(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, v.toString("base64")])))};
require("node:http").createServer((req, res) => {
  if (pages[req.url]) { res.writeHead(200, { "content-type": "text/html" }); return res.end(pages[req.url]); }
  if (files[req.url]) { res.writeHead(200, { "content-type": "image/png" }); return res.end(Buffer.from(files[req.url], "base64")); }
  if (req.url === "/site.webmanifest") { res.writeHead(200, { "content-type": "application/manifest+json" }); return res.end("{}"); }
  res.writeHead(404); res.end();
}).listen(0, "127.0.0.1", function () { console.log("PORT " + this.address().port); });`;
const server = spawn(process.execPath, ["-e", serverCode], { stdio: ["ignore", "pipe", "inherit"] });
const port = await new Promise((resolve) => { let log = ""; server.stdout.on("data", (d) => { log += d; const m = /PORT (\d+)/.exec(log); if (m) resolve(m[1]); }); });
const origin = `http://127.0.0.1:${port}`;
const work = mkdtempSync(join(tmpdir(), "capture-head-"));
mkdirSync(join(work, "routes"), { recursive: true });
const assets = join(work, "source");
const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(https?|all)_proxy$/i.test(k)));
const take = (path, id) => new Promise((resolve) => {
  const p = spawn(process.execPath, [join(here, "capture-route.mjs"), origin + path, join(work, "routes", `${id}.json`), "--width", "1000", "--height", "600", "--assets", assets, "--settle", "1"], { stdio: ["ignore", "pipe", "pipe"], env });
  let err = ""; p.stderr.on("data", (d) => (err += d)); p.stdout.on("data", () => {});
  p.on("close", (status) => resolve({ status, err }));
});
const a = await take("/", "page_home");
const b = await take("/about", "page_about");
server.kill();
check("both stand-in pages were captured", a.status === 0 && b.status === 0, (a.err + b.err).trim().split("\n").pop());
const cap = existsSync(join(work, "routes", "page_home.json")) ? JSON.parse(readFileSync(join(work, "routes", "page_home.json"), "utf8")) : {};
const h = cap.head ?? {};
check("the capture keeps the head: title, description, theme colour", h.title === "gotchi" && h.description === "hold $gotchi, hatch a pixel pet, raise it." && h.themeColor === "#ff50a0", J(h));
check("…every og:* and twitter:* as written", h.meta?.["og:image:alt"] === "the device and the logo" && h.meta?.["twitter:card"] === "summary_large_image" && h.meta?.["twitter:site"] === "@standin", J(h.meta));
check("…addresses made absolute", h.meta?.["og:image"] === `${origin}/share.png` && h.meta?.["og:url"] === `${origin}/`, J(h.meta));
check("…and its links: icon, apple-touch-icon, mask-icon with its colour, manifest", J((h.links ?? []).map((l) => [l.rel, l.href.replace(origin, ""), l.sizes ?? l.color ?? ""])) === J([["icon", "/favicon.png", "32x32"], ["apple-touch-icon", "/apple-touch-icon.png", "180x180"], ["mask-icon", "/favicon.png", "#2b1d2e"], ["manifest", "/site.webmanifest", ""]]), J(h.links));

writeFileSync(join(work, "routes.json"), J({ site: origin, viewport: [1000, 600], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }, { id: "page_about", name: "About", path: "/about", route: "/about" }] }));
const conv = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(work, "routes.json"), join(work, "out"), "--assets", assets], { encoding: "utf8", env });
check("the captures convert", conv.status === 0, conv.stderr.trim().split("\n").pop());
const doc = existsSync(join(work, "out", "site", "document.json")) ? JSON.parse(readFileSync(join(work, "out", "site", "document.json"), "utf8")) : {};
const dh = doc.head ?? {};
const file = (pic) => (pic?.path && existsSync(join(work, "out", pic.path)) ? readFileSync(join(work, "out", pic.path)) : null);
check("doc.head: title, description, site name, card, theme colour, the original address", dh.title === "gotchi" && dh.description === "hold $gotchi, hatch a pixel pet, raise it." && dh.siteName === "stand in" && dh.card === "summary_large_image" && dh.themeColor === "#ff50a0" && dh.url === `${origin}/`, J({ ...dh, meta: undefined }));
check("doc.head.image: the 1200×630 share picture, a picture committed beside the document, with its alt", dh.image?.picture?.w === 1200 && dh.image.picture.h === 630 && file(dh.image.picture)?.equals(files["/share.png"]) && dh.image.alt === "the device and the logo" && dh.image.from === `${origin}/share.png`, J(dh.image));
const icon = (dh.icons ?? []).find((i) => i.rel === "icon"), touch = (dh.icons ?? []).find((i) => i.rel === "apple-touch-icon"), mask = (dh.icons ?? []).find((i) => i.rel === "mask-icon");
check("doc.head.icons: the favicon and the touch icon as pictures, the mask icon with its colour", !!file(icon?.picture)?.equals(files["/favicon.png"]) && icon.sizes === "32x32" && !!file(touch?.picture)?.equals(files["/apple-touch-icon.png"]) && mask?.color === "#2b1d2e", J(dh.icons));
check("doc.head.manifest and meta kept as words", dh.manifest === `${origin}/site.webmanifest` && dh.meta?.["twitter:site"] === "@standin", J([dh.manifest, dh.meta]));
const about = (doc.pages ?? []).find((p) => p.id === "page_about"), home = (doc.pages ?? []).find((p) => p.id === "page_home");
check("the page that differs holds only what differs: its title, description and address", J(Object.keys(about?.head ?? {}).sort()) === J(["description", "meta", "title", "url"]) && about.head.title === "about · gotchi" && about.head.url === `${origin}/about`, J(about?.head));
check("the home page holds no head of its own", !home?.head, J(home?.head));

const old = join(work, "old");
const again = spawnSync(process.execPath, [join(here, "capture-to-document.mjs"), join(here, "routes.json"), old, "--assets", join(root, "assets", "source")], { encoding: "utf8" });
check("control: the committed captures convert to the committed document byte for byte", again.status === 0 && readFileSync(join(old, "site", "document.json"), "utf8") === readFileSync(join(root, "site", "document.json"), "utf8"), again.status === 0 ? "" : again.stderr.trim().split("\n").pop());
const failed = results.filter((r) => !r).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
