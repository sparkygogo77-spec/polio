/**
 * Reading a zip, on the server.
 *
 * Written out rather than reached for a library, for the same reason the
 * private address ranges are: the format is short and legible, the two
 * methods a site export uses (stored and deflated) are the two Node
 * already knows how to undo, and a reader that is forty lines here is a
 * reader whose bounds can be read. Zip64 is not read: a zip that needs it
 * is far past `MAX_ZIP_BYTES` anyway, and it is refused by its name rather
 * than called not a zip.
 *
 * The names come back as they were written: UTF-8 when the entry's flag
 * (bit 11) says so or the bytes decode as it, CP437 otherwise, which is
 * what most Windows zips of the last thirty years wrote, and what used to
 * arrive as "caf\uFFFD.css" and match nothing. Whether they are safe to
 * use is `zipImport.ts`'s question (`checkZip`), asked before any file is
 * unpacked, so a zip that climbs out of itself costs a directory read and
 * nothing more. The method is on each entry for the same gate to read: a
 * page packed a way this reader cannot unpack is refused with a sentence,
 * not opened to a 500. And an entry inflates no further than the size it
 * declared, which is the size the gate's cap trusted.
 *
 * Server only: `node:zlib`. `tests/zip-import.mjs` holds it against zips
 * it writes itself.
 */
import { inflateRawSync } from "node:zlib";

export interface ZipFile {
  name: string;
  /** Unpacked size, as the directory says. */
  size: number;
  /** How it is packed: 0 stored, 8 deflated, anything else this reader cannot unpack. */
  method: number;
  /** The entry is encrypted, which this reader cannot unpack either. */
  encrypted: boolean;
  /**
   * Unpack it. Called only for files the bounds have allowed. Throws, with
   * a sentence, for a method it cannot unpack or an entry that inflates
   * past the size it declared.
   */
  bytes: () => Uint8Array;
}

/** Why the bytes gave no files. */
export type ZipReadRefusal = "not-a-zip" | "zip64";

const END = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const ZIP64_LOCATOR = 0x07064b50;

/** The upper half of CP437, the encoding zip names were written in before the UTF-8 flag. */
const CP437_HIGH =
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ";

const utf8Strict = new TextDecoder("utf-8", { fatal: true });
const utf8 = new TextDecoder();

/** A name as it was written: UTF-8 when the flag says so or the bytes decode as it, CP437 otherwise. */
export function zipName(bytes: Uint8Array, flags: number): string {
  if (flags & 0x0800) return utf8.decode(bytes);
  try {
    return utf8Strict.decode(bytes);
  } catch {
    let out = "";
    for (const b of bytes) out += b < 0x80 ? String.fromCharCode(b) : CP437_HIGH[b - 0x80]!;
    return out;
  }
}

/** The files in a zip, or why there are none. */
export function readZipInfo(buf: Uint8Array): { files: ZipFile[] | null; why: ZipReadRefusal | null } {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (at: number) => view.getUint32(at, true);
  const u16 = (at: number) => view.getUint16(at, true);
  const none = (why: ZipReadRefusal) => ({ files: null, why });
  // The end record is at the very end, or before a comment of up to 64K.
  let end = -1;
  for (let at = buf.length - 22; at >= 0 && at >= buf.length - 22 - 65_535; at--) {
    if (u32(at) === END) { end = at; break; }
  }
  if (end < 0) return none("not-a-zip");
  const count = u16(end + 10);
  const dirAt = u32(end + 16);
  // Zip64: the locator before the end record, or the fields that say "see the Zip64 record".
  if ((end >= 20 && u32(end - 20) === ZIP64_LOCATOR) || count === 0xffff || dirAt === 0xffffffff) return none("zip64");
  if (dirAt >= buf.length) return none("not-a-zip");
  const files: ZipFile[] = [];
  let at = dirAt;
  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || u32(at) !== CENTRAL) return none("not-a-zip");
    const flags = u16(at + 8);
    const method = u16(at + 10);
    const packed = u32(at + 20);
    const size = u32(at + 24);
    const nameLen = u16(at + 28);
    const extraLen = u16(at + 30);
    const commentLen = u16(at + 32);
    const local = u32(at + 42);
    const name = zipName(buf.subarray(at + 46, at + 46 + nameLen), flags);
    at += 46 + nameLen + extraLen + commentLen;
    if (size === 0xffffffff || packed === 0xffffffff || local === 0xffffffff) return none("zip64");
    const encrypted = (flags & 1) === 1;
    files.push({
      name,
      size,
      method,
      encrypted,
      bytes: () => {
        if (encrypted) throw new Error(`${name} is encrypted, which this reader cannot unpack.`);
        if (method !== 0 && method !== 8) throw new Error(`${name} is packed a way this reader cannot unpack (method ${method}); only stored and deflated entries are read.`);
        if (local + 30 > buf.length || u32(local) !== LOCAL) return new Uint8Array(0);
        const start = local + 30 + u16(local + 26) + u16(local + 28);
        const data = buf.subarray(start, start + packed);
        if (method === 0) return data;
        try {
          // No further than it declared: the declared size is what the gate's cap trusted.
          return new Uint8Array(inflateRawSync(data, { maxOutputLength: Math.max(1, size) }));
        } catch (e) {
          if (e instanceof RangeError || (e as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") {
            throw new Error(`${name} unpacks past the ${size} bytes it declared, so it was not unpacked.`);
          }
          throw e;
        }
      },
    });
  }
  return { files, why: null };
}

/** The files in a zip, or null when the bytes are not a zip this reader reads. */
export function readZip(buf: Uint8Array): ZipFile[] | null {
  return readZipInfo(buf).files;
}
