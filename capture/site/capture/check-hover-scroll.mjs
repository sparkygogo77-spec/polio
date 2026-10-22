/**
 * A HOVER READ LEAVES NO CLIPPED BOX SCROLLED.
 *
 * thesolface.site, on capture run 39688255459: #community came onto the
 * board at 9013 against 9106 live. The section is `overflow: hidden`, and a
 * picture in it runs 95px past its foot. To hover its button the capture
 * brought the button into view with `scrollIntoView`, which scrolls every box
 * around it, a clipped one too; the section was left scrolled 95px and read
 * at rest so, every part in it 95px above the section, and the Builder's
 * sweep lifted the section to meet them. Measured on the live page: at rest
 * its scrollTop is 0; after a hover of its first control, 95.
 *
 * A stand-in page with such a section, a button near its foot that lifts on
 * hover, is captured with the behaviours on: the section's words must sit
 * where the section is, and the section must be read unscrolled.
 *
 *   node capture/site/capture/check-hover-scroll.mjs
 */
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";

const here = fileURLToPath(new URL(".", import.meta.url));
const env = { ...process.env, HTTPS_PROXY: "", https_proxy: "" };
const run = (args) => new Promise((ok, no) => { const c = execFile("node", args, { env, maxBuffer: 1 << 26 }, (e) => (e ? no(e) : ok())); c.stderr.pipe(process.stderr); });
const dir = mkdtempSync(join(tmpdir(), "check-hover-scroll-"));
const page = `<!doctype html><html><head><style>
  body{margin:0;font:16px sans-serif}
  .gap{height:1200px;background:#123}
  #community{position:relative;height:600px;overflow:hidden;background:#022}
  #community .inner{position:relative;height:600px}
  #community h2{margin:0;padding:40px;color:#fff}
  #community .glow{position:absolute;left:0;top:400px;width:600px;height:400px;background:#0a8;opacity:.5}
  #community .join{position:absolute;left:40px;top:520px;padding:12px 20px;transition:transform .2s;background:#fc0;border:0}
  #community .join:hover{transform:translateY(-4px)}
</style></head><body>
  <div class="gap"></div>
  <section id="community"><div class="inner"><h2>Join the wave</h2><div class="glow"></div><button class="join">Join</button></div></section>
  <div class="gap"></div>
</body></html>`;
const server = createServer((req, res) => { res.writeHead(req.url === "/" ? 200 : 404, { "content-type": "text/html" }); res.end(req.url === "/" ? page : ""); });
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const capture = join(dir, "routes", "page_home.json");
writeFileSync(join(dir, "routes.json"), JSON.stringify({ site: `http://127.0.0.1:${port}`, viewport: [1200, 800], pages: [{ id: "page_home", name: "Home", path: "/", route: "/" }], sections: {} }));
await run([join(here, "capture-route.mjs"), `http://127.0.0.1:${port}/`, capture, "--width", "1200", "--height", "800", "--behaviours", "--settle", "3"]);
server.close();

const cap = JSON.parse(readFileSync(capture, "utf8"));
const els = []; (function g(e) { els.push(e); (e.kids ?? []).forEach(g); })(cap.tree);
const fails = [];
const must = (ok, what) => { if (!ok) fails.push(what); };

const section = els.find((e) => e.t === "section");
const inner = section?.kids?.find((k) => k.t === "div");
const title = els.find((e) => e.t === "h2");
const hovered = (cap.behaviours?.motion?.hover ?? []).length;
must(!!section && !!inner && !!title, "the stand-in's section, its inner box and its title are read");
must(Math.abs((inner?.y ?? 0) - (section?.y ?? -1)) < 1, `the inner box sits where the section is (section ${section?.y}, inner ${inner?.y})`);
must(Math.abs((title?.y ?? 0) - (section?.y ?? -1)) < 1, `the title sits at the section's top (section ${section?.y}, title ${title?.y})`);
console.error(`hover reads: ${hovered}`);

if (fails.length) { console.error("FAIL\n  " + fails.join("\n  ")); process.exit(1); }
console.log("ok: a hover read leaves no clipped box scrolled");
