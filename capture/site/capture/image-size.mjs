/**
 * The size and type of a picture, read from its first bytes: PNG, JPEG,
 * GIF, WebP (VP8, VP8L and VP8X) and SVG (its width/height or viewBox).
 * Null when the bytes are none of these.
 */
export function imageSize(buf) {
  if (!buf || buf.length < 12) return null;
  if (buf.readUInt32BE(0) === 0x89504e47 && buf.length >= 24) return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), type: "image/png", ext: "png" };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { w: buf.readUInt16LE(6), h: buf.readUInt16LE(8), type: "image/gif", ext: "gif" };
  if (buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") {
    const chunk = buf.toString("ascii", 12, 16);
    if (chunk === "VP8 " && buf.length >= 30) return { w: buf.readUInt16LE(26) & 0x3fff, h: buf.readUInt16LE(28) & 0x3fff, type: "image/webp", ext: "webp" };
    if (chunk === "VP8L" && buf.length >= 25) { const b = buf.readUInt32LE(21); return { w: (b & 0x3fff) + 1, h: ((b >> 14) & 0x3fff) + 1, type: "image/webp", ext: "webp" }; }
    if (chunk === "VP8X" && buf.length >= 30) return { w: (buf.readUIntLE(24, 3)) + 1, h: (buf.readUIntLE(27, 3)) + 1, type: "image/webp", ext: "webp" };
    return null;
  }
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue; }
      const marker = buf[i + 1];
      if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) { i += 2; continue; }
      const len = buf.readUInt16BE(i + 2);
      if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7), type: "image/jpeg", ext: "jpg" };
      }
      i += 2 + len;
    }
    return null;
  }
  const head = buf.toString("utf8", 0, Math.min(buf.length, 2048));
  if (/<svg[\s>]/i.test(head)) {
    const attr = (n) => { const m = head.match(new RegExp(`<svg[^>]*\\s${n}=["']([^"']+)["']`, "i")); return m ? m[1] : null; };
    let w = parseFloat(attr("width")), h = parseFloat(attr("height"));
    const vb = attr("viewBox");
    if ((!w || !h) && vb) { const p = vb.trim().split(/[\s,]+/).map(Number); if (p.length === 4) { w = w || p[2]; h = h || p[3]; } }
    if (w && h) return { w: Math.round(w), h: Math.round(h), type: "image/svg+xml", ext: "svg" };
  }
  return null;
}
