/**
 * Copy puts the PICTURE on the clipboard, not its address.
 *
 * HIS WORDS (2026-10-12): "pressing copy on the images from the generator dont
 * copy as they should it copies a link". Two things made that happen: the
 * copy carried the address as text beside the picture, and many apps paste
 * the text when both are there; and the picture went as its own type (webp),
 * which browsers refuse to write, so nothing but the address could land.
 *
 * So: the bytes (through `/api/studio/picture` when the host will not hand
 * them over), redrawn as PNG — the one picture type every browser writes —
 * and that PNG alone on the clipboard. Only when the browser cannot copy
 * pictures at all does the address go instead, and the answer says so.
 */

export type Copied = "picture" | "link" | "none";

async function bytesOf(src: string): Promise<Blob> {
  try {
    const res = await fetch(src);
    if (res.ok) return await res.blob();
  } catch { /* blocked by its host: ask the builder's server */ }
  if (!/^https:\/\//i.test(src)) throw new Error("unreachable");
  const res = await fetch(`/api/studio/picture?url=${encodeURIComponent(src)}`);
  if (!res.ok) throw new Error("unreachable");
  return res.blob();
}

/** The same picture as PNG, unchanged when it already is one. */
export async function asPng(blob: Blob): Promise<Blob> {
  if (blob.type === "image/png") return blob;
  const bitmap = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0);
  bitmap.close();
  return new Promise((ok, no) => canvas.toBlob((b) => (b ? ok(b) : no(new Error("no png"))), "image/png"));
}

export async function copyPicture(src: string): Promise<Copied> {
  const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
  if (clip?.write && typeof ClipboardItem !== "undefined") {
    try {
      /* The PNG is handed over as a promise so the write starts inside the
         press itself: Safari refuses a clipboard write that begins after an
         await. */
      await clip.write([new ClipboardItem({ "image/png": bytesOf(src).then(asPng) })]);
      return "picture";
    } catch { /* fall through to the address */ }
  }
  try {
    await clip?.writeText(src);
    return clip ? "link" : "none";
  } catch {
    return "none";
  }
}
