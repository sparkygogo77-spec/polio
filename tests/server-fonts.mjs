#!/usr/bin/env node
/**
 * THE SERVER MEASURES A PAGE IN THE FACES IT NAMES.
 *
 * A site from code is read in the server's browser and drawn in J's. The
 * serverless Chromium ships one face, so Georgia, Courier New and Consolas
 * were all measured as Open Sans: a ledger line read as one line came up
 * two on his screen and the settle pushed the panel under it into the next
 * (J, 2026-10-11, PonsStars' Balance panel). `api/studio/fonts.ts` gives
 * the browser open faces with the same widths and prefers them for those
 * names, so a box is as wide here as it is on his screen.
 *
 * Widths are checked against the real faces' metrics: Courier New's glyphs
 * are 0.6 em wide, Consolas' 0.55 em. Georgia and Calibri are checked
 * against their stand-ins by name (the stand-in and the named face measure
 * the same) and against the generic face (which they must not match: that
 * would be the fallback measuring both).
 *
 *   npm run build && npx next start -p 3013
 *   node tests/server-fonts.mjs http://127.0.0.1:3013
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

/* Ten digits at 100px in each face; a block per face so each is a part of its own, as wide as its words. */
const FACES = { courier: "'Courier New'", consolas: "Consolas", georgia: "Georgia", gelasio: "Gelasio", calibri: "Calibri", carlito: "Carlito", serif: "serif", sans: "sans-serif" };
const dir = mkdtempSync(join(tmpdir(), "faces-"));
mkdirSync(join(dir, "web"));
writeFileSync(join(dir, "web", "index.html"), `<!doctype html><html><head><style>
  body { margin: 0; font-size: 100px; line-height: 1; }
  p { margin: 0; width: max-content; white-space: nowrap; }
  ${Object.entries(FACES).map(([k, f]) => `[data-hook="${k}"] { font-family: ${f}; }`).join("\n  ")}
</style></head><body><main data-hook="app">${Object.keys(FACES).map((k) => `<p data-hook="${k}">0123456789</p>`).join("")}</main></body></html>`);
const form = new FormData();
form.set("zip", new File([zipOf(dir)], "faces.zip"));
form.set("parts", "1"); form.set("only", "1"); form.set("widths", "0"); form.set("width", "1440");
const r = await fetch(`${BASE}/api/studio/zip`, { method: "POST", body: form });
const j = await r.json();
if (!j.ok) { console.log(" FAIL  the zip route refused the page —", j.error ?? JSON.stringify(j).slice(0, 200)); process.exit(1); }
const parts = j.pages[0].read.parts;
const w = Object.fromEntries(Object.keys(FACES).map((k) => [k, parts.find((p) => p.hooks?.["data-hook"] === k)?.box?.w ?? null]));
console.log("widths of ten digits at 100px:", JSON.stringify(w));
const near = (a, b, tol) => a !== null && b !== null && Math.abs(a - b) <= tol;

check("Courier New measures 0.6 em a glyph, as the real face does", near(w.courier, 600, 3), `${w.courier}`);
check("Consolas measures 0.55 em a glyph, as the real face does", near(w.consolas, 550, 6), `${w.consolas}`);
check("Georgia measures as Gelasio, its stand-in", near(w.georgia, w.gelasio, 1), `${w.georgia} vs ${w.gelasio}`);
check("...and not as the generic serif, which would be the fallback measuring both", !near(w.georgia, w.serif, 1), `serif ${w.serif}`);
check("Calibri measures as Carlito, its stand-in", near(w.calibri, w.carlito, 1), `${w.calibri} vs ${w.carlito}`);
check("...and not as the generic sans", !near(w.calibri, w.sans, 1), `sans ${w.sans}`);
const bad = results.filter((x) => !x).length;
console.log(`\n${bad ? `${bad} FAILED` : "all good"} — ${results.length - bad}/${results.length}`);
process.exit(bad ? 1 : 0);
