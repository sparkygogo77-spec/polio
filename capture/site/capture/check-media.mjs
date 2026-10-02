/**
 * THE PAGE'S OWN BACKGROUND, AND A VIDEO AS IT STANDS.
 *
 * parasiteonsol.fun is drawn on grid paper: `body` has two 2px
 * linear-gradients repeated every 48px over its colour. The document kept
 * the colour alone (look.palette.bg), so the export was a flat sheet. And
 * its "Parasite in 90 seconds" `<video>` came through as an empty box: the
 * capture kept no source, no poster, no frame.
 *
 *   (1) a body painted with a picture or gradient is a backdrop part on each
 *       page: the page's whole size, first in paint order, taking no press,
 *       its colour and `art.background` as the body had them;
 *   (2) a video is a picture of what it shows as the page opens (its poster,
 *       else the frame on screen), and carries `media`: its source, poster
 *       and how it plays (autoplay, loop, muted, controls), for the backend;
 *   (4) the video's own file is downloaded with the capture and carried
 *       beside the pictures (`media.file`), so the site plays it from itself,
 *       not from the address it was captured at;
 *   (3) words painted with a gradient (trendtrader.pro's "TTP": a gradient
 *       `background-clip: text` over transparent letters) keep the clip, so
 *       the gradient is the letters' and not a box (`art.backgroundClip`).
 *
 *   node capture/site/capture/check-media.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26, timeout: 300000 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-media-"));
/* A 4 × 3 png, pink. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAQAAAADCAIAAAA7ljmRAAAAE0lEQVR4nGP4/58BDTEQFAIAz0kX6cQL1WkAAAAASUVORK5CYII=", "base64");
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><style>
  body{margin:0;font:16px sans-serif;background-color:rgb(234, 246, 214);background-image:linear-gradient(rgb(217, 237, 189) 2px, transparent 2px),linear-gradient(90deg, rgb(217, 237, 189) 2px, transparent 2px);background-size:48px 48px;background-position:-1px -1px}
  main{padding:40px} video{display:block;width:480px;height:270px;background:#2b1838;margin-bottom:40px}
</style></head><body><main><h1>Parasite in 90 seconds</h1><h2 style="font-size:80px;margin:0;display:inline-block;background:linear-gradient(92deg, rgb(52, 211, 153), rgb(34, 211, 238));-webkit-background-clip:text;background-clip:text;color:transparent">TTP</h2>
<video id="a" poster="/poster.png" controls muted playsinline preload="none" aria-label="Parasite explained"><source src="/explainer.mp4" type="video/mp4"></video>
<video id="b" src="/loop.webm" autoplay loop muted playsinline></video>
<div style="height:600px"></div></main></body></html>`;
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from("ftypmp42"), Buffer.alloc(4000, 7)]);
const WEBM = Buffer.concat([Buffer.from([0x1a, 0x45, 0xdf, 0xa3]), Buffer.alloc(3000, 9)]);
const server = createServer((req, res) => {
  if (req.url === "/poster.png") { res.writeHead(200, { "content-type": "image/png" }); res.end(PNG); return; }
  if (req.url === "/explainer.mp4") { res.writeHead(200, { "content-type": "video/mp4" }); res.end(MP4); return; }
  if (req.url === "/loop.webm") { res.writeHead(200, { "content-type": "video/webm" }); res.end(WEBM); return; }
  res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? PAGE : "");
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const routes = join(dir, "routes.json"), capture = join(dir, "routes", "page_home.json"), assets = join(dir, "source");
writeFileSync(routes, JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1000, 700], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1000", "--height", "700", "--assets", assets, "--settle", "1"]).catch((e) => console.error(String(e).slice(0, 300)));
await run([join(here, "capture-to-document.mjs"), routes, dir, "--assets", assets]).catch(() => {});
server.close();

const results = [];
const check = (name, ok, detail = "") => results.push({ name, ok: !!ok, detail: String(detail) });
const J = (x) => JSON.stringify(x);
let doc = { nodes: [] };
try { doc = JSON.parse(readFileSync(join(dir, "site", "document.json"), "utf8")); } catch { /* no document */ }
const page = doc.nodes.filter((n) => n.pageId === "page_home");
const back = page[0];
check("(1) the first part of the page is its backdrop: the body's gradients, size and place", back && /linear-gradient/.test(back.art?.background ?? "") && /48px 48px/.test(back.art?.backgroundOptions?.[0] ?? "") && /-1px -1px/.test(back.art?.backgroundOptions?.[1] ?? ""), J(back && { f: back.featureId, art: back.art, sel: back.from?.selector }));
check("(1) …over the body's colour, as large as the page, taking no press", back && back.colour?.bg === "rgb(234, 246, 214)" && back.x === 0 && back.y === 0 && back.w >= 1000 && back.h >= 1000 && back.inert === true, J(back && { x: back.x, y: back.y, w: back.w, h: back.h, colour: back.colour, inert: back.inert }));
const va = page.find((n) => /video#a|video:nth-of-type\(1\)$/.test(n.from?.selector ?? "") || n.media?.poster?.endsWith("/poster.png"));
const vb = page.find((n) => n !== va && (/video:nth-of-type\(2\)$/.test(n.from?.selector ?? "") || n.media?.src?.endsWith("/loop.webm")));
check("(2) the video with a poster is a picture of its poster", va?.featureId === "picture" && va.picture?.w === 4 && va.picture?.h === 3, J(va && { f: va.featureId, picture: va.picture }));
check("(2) …carrying its source, poster and how it plays", va?.media?.kind === "video" && /explainer\.mp4$/.test(va.media.src ?? "") && /poster\.png$/.test(va.media.poster ?? "") && va.media.controls === true && va.media.muted === true && !va.media.autoplay, J(va?.media));
check("(2) the video with no poster is a picture of the frame it shows", vb?.featureId === "picture" && Math.abs(vb.picture?.w - 480) <= 1 && Math.abs(vb.picture?.h - 270) <= 1, J(vb && { f: vb.featureId, picture: vb.picture }));
check("(2) …carrying that it plays by itself, looped and muted", vb?.media?.autoplay === true && vb.media.loop === true && vb.media.muted === true && /loop\.webm$/.test(vb.media.src ?? ""), J(vb?.media));

const fileOf = (v, bytes, type) => { const f = v?.media?.file; const on = f?.path && existsSync(join(dir, f.path)) ? readFileSync(join(dir, f.path)) : null; return f && f.type === type && on && Buffer.compare(on, bytes) === 0; };
check("(4) the video's own file comes with the site: its bytes, beside its pictures, named in media.file", fileOf(va, MP4, "video/mp4") && /^assets\/pictures\//.test(va.media.file.path), J(va?.media?.file));
check("(4) …the looping one's too", fileOf(vb, WEBM, "video/webm"), J(vb?.media?.file));
const ttp = page.find((n) => n.content === "TTP");
check("(3) the gradient words keep their clip: the gradient is the letters'", ttp && /linear-gradient/.test(ttp.art?.background ?? "") && ttp.art?.backgroundClip === "text", J(ttp && ttp.art));

for (const r of results) console.log(`  ${r.ok ? "ok  " : "FAIL"} ${r.name}${r.ok || !r.detail ? "" : `\n       ${r.detail.slice(0, 400)}`}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
