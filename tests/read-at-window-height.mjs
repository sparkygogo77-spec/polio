#!/usr/bin/env node
/**
 * A SITE FROM CODE IS READ AT THE HEIGHT OF THE WINDOW IT IS SEEN FROM.
 *
 * The width already follows his window (J, 2026-10-04). The height was
 * always 900, so whatever the page sets by the window's height — a rail
 * as tall as the screen with its clock at the foot, a 100vh hero, what
 * sits under either — was read for a 900px window and drawn 81px low on
 * PonsStars' redesign in his taller one (J, 2026-10-11).
 *
 * The zip route takes `height` beside `width`, as `landParts` sends it
 * (the window's innerHeight, 600..1600); read at 1200, a part at the foot
 * of a 100vh rail sits 300px lower than read at 900.
 *
 *   npm run build && npx next start -p 3013
 *   node tests/read-at-window-height.mjs http://127.0.0.1:3013
 */
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { deflateRawSync, crc32 } from "node:zlib";

const BASE = (process.argv[2] ?? "http://127.0.0.1:3013").replace(/\/$/, "");
const results = [];
const check = (name, ok, detail = "") => { results.push(ok === true); console.log(`${ok === true ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`); };

const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
function zipOf(dir) {
  const locals = [], central = [];
  let at = 0;
  for (const file of walk(dir).sort()) {
    const name = Buffer.from(relative(dir, file).split("\\").join("/"));
    const raw = readFileSync(file), packed = deflateRawSync(raw), crc = crc32(raw);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(0x0008, 6); lh.writeUInt16LE(8, 8); lh.writeUInt16LE(name.length, 26); lh.writeUInt16LE(0, 28);
    const dd = Buffer.alloc(16);
    dd.writeUInt32LE(0x08074b50, 0); dd.writeUInt32LE(crc, 4); dd.writeUInt32LE(packed.length, 8); dd.writeUInt32LE(raw.length, 12);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(20, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(0x0008, 8); ch.writeUInt16LE(8, 10);
    ch.writeUInt32LE(crc, 16); ch.writeUInt32LE(packed.length, 20); ch.writeUInt32LE(raw.length, 24); ch.writeUInt16LE(name.length, 28); ch.writeUInt32LE(at, 42);
    locals.push(lh, name, packed, dd); central.push(ch, name);
    at += lh.length + name.length + packed.length + dd.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(central.length / 2, 8); end.writeUInt16LE(central.length / 2, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(at, 16);
  return Buffer.concat([...locals, cd, end]);
}

const dir = mkdtempSync(join(tmpdir(), "tall-"));
mkdirSync(join(dir, "web"));
writeFileSync(join(dir, "web", "index.html"), `<!doctype html><html><head><style>
  body { margin: 0; font: 16px Arial; }
  [data-hook="app"] { display: grid; grid-template-columns: 176px 1fr; }
  [data-hook="nav"] { position: sticky; top: 0; height: 100vh; display: grid; grid-template-rows: auto 1fr auto; background: #5a3a21; color: #fff; }
  [data-hook="nav-title"] { padding: 16px; }
  [data-hook="nav-clock"] { padding: 16px; }
  [data-hook="main"] { min-height: 2000px; padding: 24px; }
</style></head><body><div data-hook="app"><nav data-hook="nav"><p data-hook="nav-title">Records</p><span></span><p data-hook="nav-clock">Night desk</p></nav><main data-hook="main"><h1 data-hook="title">Play</h1></main></div></body></html>`);
const zip = zipOf(dir);

const ask = async (height) => {
  const form = new FormData();
  form.set("zip", new File([zip], "tall.zip"));
  form.set("parts", "1"); form.set("only", "1"); form.set("widths", "0"); form.set("width", "1440");
  if (height) form.set("height", String(height));
  const r = await fetch(`${BASE}/api/studio/zip`, { method: "POST", body: form });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error ?? JSON.stringify(j).slice(0, 200));
  const parts = j.pages[0].read.parts;
  const by = (h) => parts.find((p) => p.hooks?.["data-hook"] === h);
  return { nav: by("nav")?.box, clock: by("nav-clock")?.box, title: by("title")?.box };
};
const at900 = await ask(900), at1200 = await ask(1200), unsaid = await ask(null);
/* The rail itself is run to the page's foot (#219: a sticky rail at least window-tall), so it is its clock that says where the screen's foot was. */
check("read at 900, the rail's clock sits at the foot of a 900px screen", !!at900.clock && Math.abs(at900.clock.y + at900.clock.h + 16 - 900) <= 2, JSON.stringify(at900));
check("read at 1200, the clock sits 300 lower", !!at1200.clock && Math.abs(at1200.clock.y - at900.clock.y - 300) <= 2, JSON.stringify(at1200));
check("the main column's title does not move with the height", !!at1200.title && Math.abs(at1200.title.y - at900.title.y) <= 1, JSON.stringify({ at900: at900.title, at1200: at1200.title }));
check("with no height said, the read is 900 tall as before", !!unsaid.clock && Math.abs(unsaid.clock.y - at900.clock.y) <= 1, JSON.stringify(unsaid.clock));
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
