/**
 * A zip of files, stored (not compressed): what Export for code downloads.
 * Plain enough to read in one go: a local header and the bytes for each
 * file, then the central directory. Pure; no browser needed.
 */
const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export function zipFiles(files: { path: string; bytes: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path);
    const crc = crc32(f.bytes);
    const local = new Uint8Array(30 + name.length);
    const v = new DataView(local.buffer);
    v.setUint32(0, 0x04034b50, true); v.setUint16(4, 20, true); v.setUint16(6, 0x0800, true); v.setUint16(8, 0, true);
    v.setUint32(14, crc, true); v.setUint32(18, f.bytes.length, true); v.setUint32(22, f.bytes.length, true); v.setUint16(26, name.length, true);
    local.set(name, 30);
    const dir = new Uint8Array(46 + name.length);
    const d = new DataView(dir.buffer);
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(8, 0x0800, true);
    d.setUint32(16, crc, true); d.setUint32(20, f.bytes.length, true); d.setUint32(24, f.bytes.length, true); d.setUint16(28, name.length, true);
    d.setUint32(42, offset, true);
    dir.set(name, 46);
    parts.push(local, f.bytes);
    central.push(dir);
    offset += local.length + f.bytes.length;
  }
  const size = central.reduce((n, c) => n + c.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, size, true); e.setUint32(16, offset, true);
  const out = new Uint8Array(offset + size + 22);
  let at = 0;
  for (const p of [...parts, ...central, end]) { out.set(p, at); at += p.length; }
  return out;
}

/**
 * A site's files as one zip, every file at its own path: what the export
 * and the book's Download All save. A file sent as base64 (a picture) goes
 * in as its bytes, not as the base64 text.
 */
export function siteZip(files: { path: string; content: string; encoding?: string }[]): Uint8Array {
  const enc = new TextEncoder();
  return zipFiles(files.map((f) => ({ path: f.path, bytes: f.encoding === "base64" ? Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0)) : enc.encode(f.content) })));
}
