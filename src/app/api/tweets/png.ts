import { inflateSync } from "node:zlib";

/**
 * Enough of a PNG reader to take the frames ffmpeg writes: 8-bit, not
 * interlaced, grey or colour with or without alpha. Anything else is an
 * error, in words, so the route can fall back to the WebM.
 */
export function decodePng(file: Uint8Array): { width: number; height: number; stride: 3 | 4; data: Uint8Array } {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (file.length < 33 || sig.some((b, i) => file[i] !== b)) throw new Error("Not a PNG.");
  const view = new DataView(file.buffer, file.byteOffset, file.byteLength);
  let pos = 8;
  let width = 0, height = 0, depth = 0, type = 0, interlace = 0;
  const idat: Uint8Array[] = [];
  while (pos + 8 <= file.length) {
    const len = view.getUint32(pos);
    const name = String.fromCharCode(file[pos + 4]!, file[pos + 5]!, file[pos + 6]!, file[pos + 7]!);
    const body = file.subarray(pos + 8, pos + 8 + len);
    if (name === "IHDR") {
      width = view.getUint32(pos + 8);
      height = view.getUint32(pos + 12);
      depth = file[pos + 16]!;
      type = file[pos + 17]!;
      interlace = file[pos + 20]!;
    } else if (name === "IDAT") idat.push(body);
    else if (name === "IEND") break;
    pos += 12 + len;
  }
  if (!width || !height) throw new Error("PNG has no header.");
  if (depth !== 8) throw new Error(`PNG is ${depth}-bit; only 8-bit is read.`);
  if (interlace) throw new Error("Interlaced PNG is not read.");
  const channels = type === 0 ? 1 : type === 2 ? 3 : type === 4 ? 2 : type === 6 ? 4 : 0;
  if (!channels) throw new Error(`PNG colour type ${type} is not read.`);

  const raw = inflateSync(Buffer.concat(idat.map((b) => Buffer.from(b.buffer, b.byteOffset, b.byteLength))));
  const rowLen = width * channels;
  const pixels = new Uint8Array(height * rowLen);
  let rp = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[rp++]!;
    const row = y * rowLen, up = row - rowLen;
    for (let i = 0; i < rowLen; i++) {
      const x = raw[rp + i]!;
      const a = i >= channels ? pixels[row + i - channels]! : 0;
      const b = y > 0 ? pixels[up + i]! : 0;
      const c = y > 0 && i >= channels ? pixels[up + i - channels]! : 0;
      let v: number;
      switch (filter) {
        case 0: v = x; break;
        case 1: v = x + a; break;
        case 2: v = x + b; break;
        case 3: v = x + ((a + b) >> 1); break;
        case 4: {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = x + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
          break;
        }
        default: throw new Error(`PNG row filter ${filter} is not read.`);
      }
      pixels[row + i] = v & 255;
    }
    rp += rowLen;
  }

  if (channels === 3) return { width, height, stride: 3, data: pixels };
  if (channels === 4) return { width, height, stride: 4, data: pixels };
  // Grey, with or without alpha, spread to RGB.
  const rgb = new Uint8Array(width * height * 3);
  for (let p = 0, n = width * height; p < n; p++) {
    const g = pixels[p * channels]!;
    rgb[p * 3] = g; rgb[p * 3 + 1] = g; rgb[p * 3 + 2] = g;
  }
  return { width, height, stride: 3, data: rgb };
}
