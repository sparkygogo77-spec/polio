/**
 * A GIF encoder with nothing behind it.
 *
 * X takes GIF and MP4 and not WebM, and WebM is what browsers record and what
 * Playwright writes. The ffmpeg Playwright ships can pull frames out of a
 * WebM but cannot write a GIF, and asking for a system ffmpeg makes the
 * feature depend on one being there. So the GIF is written here, by hand:
 * one global palette cut from a sample of every frame (median cut), a small
 * ordered dither so flat gradients do not band, and then, frame by frame,
 * the pixels that did not change since the last frame marked transparent and
 * the frame cropped to what did — which is what makes a scrolling page
 * compress at all — and the lot LZW-packed the way GIF89a wants it.
 *
 * Plain TypeScript, no DOM, no Node: the server route and the browser both
 * use it. `encodeGif` does the whole thing from a list of frames;
 * `GifWriter` takes them one at a time when they are too many to hold.
 */

export interface FrameInput {
  /** Packed pixels, row-major, `stride` bytes each; the first three are R, G, B. */
  data: Uint8Array | Uint8ClampedArray;
  stride: 3 | 4;
}

export interface GifOptions {
  /** Time each frame is shown. GIF rounds to hundredths of a second. */
  delayMs: number;
  /** Colours in the palette, at most 255 so one index is left for "unchanged". */
  colors?: number;
  dither?: boolean;
  loop?: boolean;
  onProgress?: (fraction: number) => void;
}

const MAX_COLORS = 255;

/* ------------------------------------------------------------------ */
/* Palette                                                             */
/* ------------------------------------------------------------------ */

/** Every `step`-th pixel of a frame, packed as 0xRRGGBB. */
export function samplePixels(frame: FrameInput, count: number, into?: number[]): number[] {
  const out = into ?? [];
  const n = Math.floor(frame.data.length / frame.stride);
  const step = Math.max(1, Math.floor(n / Math.max(1, count)));
  const { data, stride } = frame;
  for (let p = 0; p < n; p += step) {
    const o = p * stride;
    out.push((data[o]! << 16) | (data[o + 1]! << 8) | data[o + 2]!);
  }
  return out;
}

interface Box { s: number; e: number; rMin: number; rMax: number; gMin: number; gMax: number; bMin: number; bMax: number }

function measure(samples: Int32Array, s: number, e: number): Box {
  let rMin = 255, rMax = 0, gMin = 255, gMax = 0, bMin = 255, bMax = 0;
  for (let i = s; i < e; i++) {
    const c = samples[i]!;
    const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255;
    if (r < rMin) rMin = r; if (r > rMax) rMax = r;
    if (g < gMin) gMin = g; if (g > gMax) gMax = g;
    if (b < bMin) bMin = b; if (b > bMax) bMax = b;
  }
  return { s, e, rMin, rMax, gMin, gMax, bMin, bMax };
}

/** Counting sort of one stretch of samples by one channel; linear, and stable enough. */
function sortByChannel(samples: Int32Array, s: number, e: number, shift: number, tmp: Int32Array) {
  const counts = new Int32Array(257);
  for (let i = s; i < e; i++) { const k = ((samples[i]! >> shift) & 255) + 1; counts[k] = counts[k]! + 1; }
  for (let v = 0; v < 256; v++) counts[v + 1] = counts[v + 1]! + counts[v]!;
  for (let i = s; i < e; i++) {
    const v = (samples[i]! >> shift) & 255;
    const at = counts[v]!;
    counts[v] = at + 1;
    tmp[at] = samples[i]!;
  }
  samples.set(tmp.subarray(0, e - s), s);
}

/** Median cut: the palette, `colors * 3` bytes, from packed sample colours. */
export function buildPalette(sampled: ArrayLike<number>, colors = MAX_COLORS): Uint8Array {
  const want = Math.max(2, Math.min(MAX_COLORS, colors));
  // Few distinct colours: keep them exactly, no cutting.
  const distinct = new Set<number>();
  for (let i = 0; i < sampled.length && distinct.size <= want; i++) distinct.add(sampled[i]!);
  if (distinct.size <= want) {
    const pal = new Uint8Array(want * 3);
    let k = 0;
    for (const c of distinct) { pal[k++] = (c >> 16) & 255; pal[k++] = (c >> 8) & 255; pal[k++] = c & 255; }
    return pal;
  }
  const samples = Int32Array.from(sampled);
  const tmp = new Int32Array(samples.length);
  const boxes: Box[] = [measure(samples, 0, samples.length)];
  while (boxes.length < want) {
    let bi = -1, best = 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i]!;
      if (b.e - b.s < 2) continue;
      const side = Math.max(b.rMax - b.rMin, b.gMax - b.gMin, b.bMax - b.bMin);
      // Big boxes with many pixels are cut first; a lone outlier box waits.
      const score = side * Math.log2(2 + b.e - b.s);
      if (score > best) { best = score; bi = i; }
    }
    if (bi < 0) break;
    const b = boxes[bi]!;
    const rr = b.rMax - b.rMin, gg = b.gMax - b.gMin, bb = b.bMax - b.bMin;
    const shift = gg >= rr && gg >= bb ? 8 : rr >= bb ? 16 : 0;
    sortByChannel(samples, b.s, b.e, shift, tmp);
    const mid = (b.s + b.e) >> 1;
    boxes[bi] = measure(samples, b.s, mid);
    boxes.push(measure(samples, mid, b.e));
  }
  const pal = new Uint8Array(want * 3);
  boxes.forEach((b, i) => {
    let r = 0, g = 0, bl = 0;
    for (let k = b.s; k < b.e; k++) { const c = samples[k]!; r += (c >> 16) & 255; g += (c >> 8) & 255; bl += c & 255; }
    const n = Math.max(1, b.e - b.s);
    pal[i * 3] = Math.round(r / n); pal[i * 3 + 1] = Math.round(g / n); pal[i * 3 + 2] = Math.round(bl / n);
  });
  return pal;
}

/* ------------------------------------------------------------------ */
/* LZW                                                                 */
/* ------------------------------------------------------------------ */

class Bytes {
  buf = new Uint8Array(1 << 16);
  len = 0;
  push(b: number) {
    if (this.len >= this.buf.length) { const n = new Uint8Array(this.buf.length * 2); n.set(this.buf); this.buf = n; }
    this.buf[this.len++] = b & 255;
  }
  pushAll(a: ArrayLike<number>) { for (let i = 0; i < a.length; i++) this.push(a[i]!); }
  u16(v: number) { this.push(v & 255); this.push((v >> 8) & 255); }
  done(): Uint8Array { return this.buf.slice(0, this.len); }
}

/** GIF's LZW, minimum code size 8, written straight into sub-blocks. */
function lzw(indices: Uint8Array, out: Bytes) {
  const MIN = 8, CLEAR = 1 << MIN, EOI = CLEAR + 1;
  const child = new Int16Array(4096), sibling = new Int16Array(4096), suffix = new Uint8Array(4096);
  let codeSize = MIN + 1, next = EOI + 1;
  let acc = 0, nbits = 0;
  const block = new Uint8Array(255);
  let blockLen = 0;
  const flushBlock = () => { if (!blockLen) return; out.push(blockLen); for (let i = 0; i < blockLen; i++) out.push(block[i]!); blockLen = 0; };
  const byte = (b: number) => { block[blockLen++] = b; if (blockLen === 255) flushBlock(); };
  const emit = (code: number) => {
    acc |= code << nbits;
    nbits += codeSize;
    while (nbits >= 8) { byte(acc & 255); acc >>>= 8; nbits -= 8; }
  };
  const reset = () => { child.fill(-1); next = EOI + 1; codeSize = MIN + 1; };

  out.push(MIN);
  reset();
  emit(CLEAR);
  if (!indices.length) { emit(EOI); if (nbits > 0) byte(acc & 255); flushBlock(); out.push(0); return; }
  let prefix = indices[0]!;
  for (let i = 1; i < indices.length; i++) {
    const c = indices[i]!;
    let node = child[prefix]!;
    let found = -1;
    while (node !== -1) { if (suffix[node] === c) { found = node; break; } node = sibling[node]!; }
    if (found !== -1) { prefix = found; continue; }
    emit(prefix);
    if (next < 4096) {
      suffix[next] = c; sibling[next] = child[prefix]!; child[prefix] = next; next++;
      if (next > 1 << codeSize && codeSize < 12) codeSize++;
    } else {
      emit(CLEAR);
      reset();
    }
    prefix = c;
  }
  emit(prefix);
  emit(EOI);
  if (nbits > 0) byte(acc & 255);
  flushBlock();
  out.push(0);
}

/* ------------------------------------------------------------------ */
/* Writer                                                              */
/* ------------------------------------------------------------------ */

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

export class GifWriter {
  private out = new Bytes();
  private prev: Uint8Array | null = null;
  private cache = new Int16Array(32768).fill(-1);
  private colors: number;
  private transparent: number;
  private frames = 0;
  readonly width: number;
  readonly height: number;
  readonly palette: Uint8Array;

  constructor(width: number, height: number, palette: Uint8Array, private opts: { delayMs: number; loop?: boolean; dither?: boolean }) {
    this.width = width;
    this.height = height;
    this.colors = Math.min(MAX_COLORS, palette.length / 3);
    this.palette = palette;
    this.transparent = this.colors; // one past the palette; the table is padded to 256
    const o = this.out;
    o.pushAll([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
    o.u16(width); o.u16(height);
    o.push(0xf7); // global table, 8 bits per colour, 256 entries
    o.push(0); o.push(0);
    for (let i = 0; i < 256; i++) {
      if (i < this.colors) { o.push(palette[i * 3]!); o.push(palette[i * 3 + 1]!); o.push(palette[i * 3 + 2]!); }
      else { o.push(0); o.push(0); o.push(0); }
    }
    if (opts.loop !== false) o.pushAll([0x21, 0xff, 0x0b, 0x4e, 0x45, 0x54, 0x53, 0x43, 0x41, 0x50, 0x45, 0x32, 0x2e, 0x30, 0x03, 0x01, 0x00, 0x00, 0x00]);
  }

  private nearest(r: number, g: number, b: number): number {
    const pal = this.palette;
    let best = 0, bestD = Infinity;
    for (let i = 0; i < this.colors; i++) {
      const dr = r - pal[i * 3]!, dg = g - pal[i * 3 + 1]!, db = b - pal[i * 3 + 2]!;
      const d = dr * dr * 2 + dg * dg * 3 + db * db;
      if (d < bestD) { bestD = d; best = i; }
    }
    return best;
  }

  /** Palette indices for a frame, dithered a little unless told not to. */
  quantise(frame: FrameInput): Uint8Array {
    const { width, height, cache } = this;
    const { data, stride } = frame;
    const dither = this.opts.dither !== false;
    const idx = new Uint8Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = y * width + x;
        const o = p * stride;
        let r = data[o]!, g = data[o + 1]!, b = data[o + 2]!;
        if (dither) {
          const d = (BAYER[((y & 3) << 2) | (x & 3)]! - 7.5) * 0.9;
          r = r + d < 0 ? 0 : r + d > 255 ? 255 : (r + d) | 0;
          g = g + d < 0 ? 0 : g + d > 255 ? 255 : (g + d) | 0;
          b = b + d < 0 ? 0 : b + d > 255 ? 255 : (b + d) | 0;
        }
        const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
        let i = cache[key]!;
        if (i < 0) { i = this.nearest(r, g, b); cache[key] = i; }
        idx[p] = i;
      }
    }
    return idx;
  }

  /** Add a frame of palette indices. Only what changed since the last one is written. */
  addFrame(indices: Uint8Array, delayMs = this.opts.delayMs) {
    const { width, height, out, prev, transparent } = this;
    let x0 = 0, y0 = 0, x1 = width - 1, y1 = height - 1;
    let sub = indices;
    let useTransparent = false;
    if (prev) {
      x0 = width; y0 = height; x1 = -1; y1 = -1;
      for (let y = 0; y < height; y++) {
        const row = y * width;
        for (let x = 0; x < width; x++) {
          if (indices[row + x] !== prev[row + x]) {
            if (x < x0) x0 = x; if (x > x1) x1 = x;
            if (y < y0) y0 = y; if (y > y1) y1 = y;
          }
        }
      }
      useTransparent = true;
      if (x1 < 0) {
        // Nothing moved: one transparent pixel keeps the timing.
        x0 = 0; y0 = 0; x1 = 0; y1 = 0;
        sub = new Uint8Array([transparent]);
      } else {
        const w = x1 - x0 + 1, h = y1 - y0 + 1;
        sub = new Uint8Array(w * h);
        for (let y = 0; y < h; y++) {
          const srow = (y0 + y) * width + x0, drow = y * w;
          for (let x = 0; x < w; x++) {
            const p = srow + x;
            sub[drow + x] = indices[p] === prev[p] ? transparent : indices[p]!;
          }
        }
      }
    }
    const delay = Math.max(2, Math.round(delayMs / 10));
    out.pushAll([0x21, 0xf9, 0x04, (1 << 2) | (useTransparent ? 1 : 0)]);
    out.u16(delay);
    out.push(useTransparent ? transparent : 0);
    out.push(0);
    out.push(0x2c);
    out.u16(x0); out.u16(y0); out.u16(x1 - x0 + 1); out.u16(y1 - y0 + 1);
    out.push(0);
    lzw(sub, out);
    this.prev = indices;
    this.frames++;
  }

  get frameCount() { return this.frames; }

  finish(): Uint8Array {
    this.out.push(0x3b);
    return this.out.done();
  }
}

/** The whole thing at once: palette from every frame, then each frame written. */
export function encodeGif(frames: FrameInput[], width: number, height: number, opts: GifOptions): Uint8Array {
  if (!frames.length) throw new Error("No frames to write.");
  const per = Math.max(500, Math.floor(160_000 / frames.length));
  const samples: number[] = [];
  for (const f of frames) samplePixels(f, per, samples);
  const palette = buildPalette(samples, opts.colors ?? MAX_COLORS);
  const w = new GifWriter(width, height, palette, { delayMs: opts.delayMs, loop: opts.loop, dither: opts.dither });
  frames.forEach((f, i) => {
    w.addFrame(w.quantise(f));
    opts.onProgress?.((i + 1) / frames.length);
  });
  return w.finish();
}
