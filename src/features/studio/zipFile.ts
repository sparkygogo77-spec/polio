/**
 * Reading a zip, on the server.
 *
 * Written out rather than reached for a library, for the same reason the
 * private address ranges are: the format is short and legible, the two
 * methods a site export uses (stored and deflated) are the two Node
 * already knows how to undo, and a reader that is forty lines here is a
 * reader whose bounds can be read. Zip64 is not read: a zip that needs it
 * is far past `MAX_ZIP_BYTES` anyway.
 *
 * The names come back exactly as they are in the file. Whether they are
 * safe to use is `zipImport.ts`'s question (`checkZip`), asked before any
 * file is unpacked, so a zip that climbs out of itself costs a directory
 * read and nothing more.
 *
 * Server only: `node:zlib`. `tests/zip-import.mjs` holds it against zips
 * it writes itself.
 */
import { inflateRawSync } from "node:zlib";

export interface ZipFile {
  name: string;
  /** Unpacked size, as the directory says. */
  size: number;
  /** Unpack it. Called only for files the bounds have allowed. */
  bytes: () => Uint8Array;
}

const END = 0x06054b50;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;

/** The files in a zip, or null when the bytes are not a zip at all. */
export function readZip(buf: Uint8Array): ZipFile[] | null {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u32 = (at: number) => view.getUint32(at, true);
  const u16 = (at: number) => view.getUint16(at, true);
  // The end record is at the very end, or before a comment of up to 64K.
  let end = -1;
  for (let at = buf.length - 22; at >= 0 && at >= buf.length - 22 - 65_535; at--) {
    if (u32(at) === END) { end = at; break; }
  }
  if (end < 0) return null;
  const count = u16(end + 10);
  const dirAt = u32(end + 16);
  if (dirAt >= buf.length) return null;
  const files: ZipFile[] = [];
  const text = new TextDecoder();
  let at = dirAt;
  for (let i = 0; i < count; i++) {
    if (at + 46 > buf.length || u32(at) !== CENTRAL) return null;
    const method = u16(at + 10);
    const packed = u32(at + 20);
    const size = u32(at + 24);
    const nameLen = u16(at + 28);
    const extraLen = u16(at + 30);
    const commentLen = u16(at + 32);
    const local = u32(at + 42);
    const name = text.decode(buf.subarray(at + 46, at + 46 + nameLen));
    at += 46 + nameLen + extraLen + commentLen;
    if (size === 0xffffffff || packed === 0xffffffff) return null;
    files.push({
      name,
      size,
      bytes: () => {
        if (local + 30 > buf.length || u32(local) !== LOCAL) return new Uint8Array(0);
        const start = local + 30 + u16(local + 26) + u16(local + 28);
        const data = buf.subarray(start, start + packed);
        if (method === 0) return data;
        if (method === 8) return new Uint8Array(inflateRawSync(data));
        return new Uint8Array(0);
      },
    });
  }
  return files;
}
