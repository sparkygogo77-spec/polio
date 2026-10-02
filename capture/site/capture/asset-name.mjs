/**
 * The file a fetched address is kept as under `--assets`.
 *
 * By its file name alone, two addresses that end alike were one file: every
 * picture share.xyz serves through `/_next/image?url=…` was saved as
 * `image`, and every team logo from `…/fit=scale-down,w=144` as that, so
 * the first one fetched stood in for all the rest (76 of its 128 pictures
 * were one file). So the name carries a short hash of the whole address in
 * front of the file name: one address, one file.
 *
 * Captures taken before kept the bare file name (SOLCINERATOR's among
 * them); `assetFile` finds a file by the new name first and by that one
 * after, so they convert as they did.
 */
import { createHash } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { basename, join } from "node:path";

export function assetName(address) {
  const u = new URL(address);
  const base = basename(decodeURIComponent(u.pathname)).replace(/[^\w.,=@+-]+/g, "_").slice(-80) || "file";
  return `${createHash("sha1").update(u.href).digest("hex").slice(0, 10)}-${base}`;
}

/** Where the bytes of an address are under `dir`: the new name, else the bare file name of a capture taken before; null when neither is there. */
export function assetFile(dir, address) {
  if (!dir) return null;
  let u;
  try { u = new URL(address); } catch { return null; }
  /* A file, never the folder: an address ending in "/" (an <img src=""> read as the page's own address) has no bare name. */
  const isFile = (f) => { try { return statSync(f).isFile(); } catch { return false; } };
  const named = join(dir, assetName(u.href));
  if (isFile(named)) return named;
  const bare = basename(u.pathname) ? join(dir, basename(u.pathname)) : null;
  return bare && isFile(bare) ? bare : null;
}
