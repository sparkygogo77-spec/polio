/**
 * A PICTURE DROPPED ON THE BOARD: ALL OF IT, OR NOTHING, AND SAID WHICH.
 *
 * MEASURED, the owner's 1024×1024 picture: the board wrote a dragged picture
 * into the part as a `data:` URL inside an <img> (2.3 MB for a 1024² PNG),
 * and Chrome refuses any URL past 2 MB, so it never loaded: the part said
 * "Picture 1024×1024" and drew a strip. Files, links and <img>s dragged from
 * other pages landed nothing at all.
 *
 * So every way a picture comes is read here to its last byte — a file read
 * whole, a `data:` URL decoded by hand (never fetched: the same 2 MB limit
 * applies to fetching one), an http link fetched and its length checked —
 * then held to three things before anything is kept:
 *
 *   · it is not over the cap, which is said with the cap, never cut to fit;
 *   · it is whole: a PNG ends in IEND, a JPEG in FFD9, a WebP's RIFF length
 *     is its length, a GIF ends in 3B — a file cut off in transit is not;
 *   · it decodes, at the size it says.
 *
 * What passes is stored as a picture (`pictures.ts`), a path in the
 * document and the bytes in this browser, like a chosen one.
 *
 * The DataTransfer is read synchronously (`readDrop`): a browser empties it
 * the moment the drop handler returns.
 */

/** The largest picture a part holds. */
export const PICTURE_CAP = 20 * 1024 * 1024;
const MB = (n: number) => `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
export const OVER_CAP = (bytes: number) => `That picture is ${MB(bytes)}, over the ${Math.round(PICTURE_CAP / 1024 / 1024)} MB a picture on the board can be. Make it smaller and drop it again; nothing was kept.`;
export const NOT_WHOLE = "That picture did not arrive whole (it was cut off on the way), so nothing was kept. Drop it again, or save it and drop the file.";
export const UNREADABLE = "That picture could not be read by this browser, so nothing was kept.";
export const NOT_REACHABLE = "The page that picture is on won't let it be copied from here. Save the picture and drop the file instead; nothing was kept.";

export interface Dropped {
  /** The Builder's own drag (the Render panel): its source and natural size. */
  studio: { src: string; w?: number; h?: number } | null;
  files: File[];
  /** Addresses, most likely first: an <img>'s src, then the link list, then plain text. */
  urls: string[];
}

/** Everything a drop carries that could be a picture, read while the event is live. */
export function readDrop(dt: DataTransfer | null | undefined): Dropped {
  const out: Dropped = { studio: null, files: [], urls: [] };
  if (!dt) return out;
  try {
    const s = dt.getData("application/x-studio-picture");
    if (s) { const p = JSON.parse(s) as { src?: string; w?: number; h?: number }; if (p.src) out.studio = { src: p.src, w: p.w, h: p.h }; }
  } catch { /* not ours */ }
  out.files = Array.from(dt.files ?? []).filter((f) => /^image\//.test(f.type) || /\.(png|jpe?g|webp|gif|avif)$/i.test(f.name));
  const html = dt.getData("text/html") ?? "";
  const img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/i.exec(html)?.[1];
  const list = (dt.getData("text/uri-list") ?? "").split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const plain = (dt.getData("text/plain") ?? "").trim();
  for (const u of [img ? img.replace(/&amp;/g, "&") : "", ...list, plain]) {
    if (u && /^(https?:|data:image\/|blob:)/i.test(u) && !out.urls.includes(u)) out.urls.push(u);
  }
  return out;
}

/** Is there anything in this drop that could be a picture? */
export const hasPicture = (d: Dropped) => !!d.studio || d.files.length > 0 || d.urls.length > 0;

/** The bytes of a `data:` URL, decoded by hand. */
function fromDataUrl(url: string): { bytes: Uint8Array; type: string } | null {
  const m = /^data:([^;,]+)?((?:;[^;,]+)*?)(;base64)?,(.*)$/is.exec(url);
  if (!m) return null;
  const type = m[1] || "application/octet-stream";
  try {
    if (m[3]) {
      const bin = atob(m[4]!.replace(/\s/g, ""));
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return { bytes, type };
    }
    return { bytes: new TextEncoder().encode(decodeURIComponent(m[4]!)), type };
  } catch {
    return null;
  }
}

/** The kind of picture, from its first bytes: what it is, whatever it was called. */
export function sniff(b: Uint8Array): "png" | "jpeg" | "webp" | "gif" | "avif" | "svg" | null {
  const at = (i: number, ...v: number[]) => v.every((x, k) => b[i + k] === x);
  if (at(0, 0x89, 0x50, 0x4e, 0x47)) return "png";
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50)) return "webp";
  if (at(0, 0x47, 0x49, 0x46, 0x38)) return "gif";
  if (at(4, 0x66, 0x74, 0x79, 0x70)) return "avif";
  const head = new TextDecoder().decode(b.slice(0, 256)).trimStart();
  if (/^<(\?xml|svg)/i.test(head)) return "svg";
  return null;
}

/** Did all of it arrive? Each format says where it ends, and a file cut in transit does not end there. */
export function looksWhole(b: Uint8Array): boolean {
  const kind = sniff(b);
  const n = b.length;
  if (kind === "png") {
    /* The last chunk is IEND: its type, then its CRC, at the very end. */
    return n >= 12 && b[n - 8] === 0x49 && b[n - 7] === 0x45 && b[n - 6] === 0x4e && b[n - 5] === 0x44;
  }
  if (kind === "jpeg") {
    let end = n;
    while (end > 2 && b[end - 1] === 0x00) end--; /* padding some writers leave */
    return b[end - 2] === 0xff && b[end - 1] === 0xd9;
  }
  if (kind === "webp") {
    const riff = b[4]! | (b[5]! << 8) | (b[6]! << 16) | (b[7]! << 24);
    return riff + 8 <= n;
  }
  if (kind === "gif") return b[n - 1] === 0x3b;
  if (kind === "avif" || kind === "svg") return true; /* no end marker to read; the decode says the rest */
  return false;
}

export interface Pipes { fetch?: typeof fetch; decode?: (blob: Blob) => Promise<{ w: number; h: number }> }

export type Got = { ok: true; blob: Blob; w: number; h: number; name: string } | { ok: false; says: string };

const typeOf = (kind: ReturnType<typeof sniff>, fallback: string) =>
  kind === "svg" ? "image/svg+xml" : kind ? `image/${kind}` : fallback;

async function decodeSize(blob: Blob): Promise<{ w: number; h: number }> {
  const bmp = await createImageBitmap(blob);
  const size = { w: bmp.width, h: bmp.height };
  bmp.close();
  return size;
}

/** Check, then hand back: over the cap, cut off, or unreadable is said; nothing partial is returned. */
async function held(bytes: Uint8Array, fallbackType: string, name: string, pipes: Pipes): Promise<Got> {
  if (bytes.length > PICTURE_CAP) return { ok: false, says: OVER_CAP(bytes.length) };
  const kind = sniff(bytes);
  if (!kind) return { ok: false, says: UNREADABLE };
  if (!looksWhole(bytes)) return { ok: false, says: NOT_WHOLE };
  const blob = new Blob([bytes as BlobPart], { type: typeOf(kind, fallbackType) });
  try {
    const { w, h } = await (pipes.decode ?? decodeSize)(blob);
    if (!w || !h) return { ok: false, says: UNREADABLE };
    return { ok: true, blob, w, h, name };
  } catch {
    return { ok: false, says: kind === "svg" ? UNREADABLE : NOT_WHOLE };
  }
}

/** The picture a drop carries, read to its last byte and checked; or why not. */
export async function pictureFrom(d: Dropped, pipes: Pipes = {}): Promise<Got | null> {
  const f = pipes.fetch ?? fetch;
  const file = d.files[0];
  if (file) {
    if (file.size > PICTURE_CAP) return { ok: false, says: OVER_CAP(file.size) };
    const bytes = new Uint8Array(await file.arrayBuffer());
    return held(bytes, file.type, file.name.replace(/\.[a-z0-9]+$/i, ""), pipes);
  }
  const src = d.studio?.src ?? d.urls[0];
  if (!src) return null;
  if (/^data:/i.test(src)) {
    /* Its size before decoding: a base64 character is three quarters of a byte. */
    const est = Math.floor((src.length - src.indexOf(",") - 1) * 0.75);
    if (est > PICTURE_CAP * 1.01) return { ok: false, says: OVER_CAP(est) };
    const got = fromDataUrl(src);
    if (!got) return { ok: false, says: UNREADABLE };
    return held(got.bytes, got.type, "Picture", pipes);
  }
  let r: Response;
  try {
    r = await f(src, { mode: "cors", credentials: "omit", cache: "no-store" });
  } catch {
    return { ok: false, says: NOT_REACHABLE };
  }
  if (!r.ok) return { ok: false, says: `That picture's address answered ${r.status}, so nothing was kept.` };
  const said = Number(r.headers.get("content-length") ?? "");
  if (Number.isFinite(said) && said > PICTURE_CAP) return { ok: false, says: OVER_CAP(said) };
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await r.arrayBuffer());
  } catch {
    return { ok: false, says: NOT_WHOLE };
  }
  /* A length the server promised and did not deliver is a picture cut off on the way. */
  const encoded = !!r.headers.get("content-encoding");
  if (Number.isFinite(said) && said > 0 && !encoded && bytes.length < said) return { ok: false, says: NOT_WHOLE };
  const name = decodeURIComponent(new URL(src, "http://x").pathname.split("/").pop() ?? "").replace(/\.[a-z0-9]+$/i, "") || "Picture";
  return held(bytes, r.headers.get("content-type") ?? "", name, pipes);
}
