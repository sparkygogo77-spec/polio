"use client";
/**
 * Where a tweet's pictures and videos live.
 *
 * The drafts themselves are small and sit in localStorage with everything
 * else; a photo is not small, and one phone picture would fill the whole
 * quota. So the bytes go into IndexedDB under the media's id, and the draft
 * keeps only what it needs to draw the strip: a thumbnail, the size, the
 * kind, the alt text. `blobUrl` hands back an object URL for the real thing
 * when the preview or the send needs it.
 *
 * Pictures are re-encoded on the way in — X takes 5 MB, and it is kinder to
 * the upload to send a 2048-edge WebP than a 12-megapixel PNG — but a GIF or
 * a video is kept exactly as it came, because re-encoding either in a browser
 * is not something to do to someone's file without asking.
 */
import { uid } from "@/core/lib/ids";
import type { TweetMedia } from "./store";

const DB = "builder.tweets.media";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") return reject(new Error("No IndexedDB here"));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => { req.result.createObjectStore(STORE); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Could not open the media store"));
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = run(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Media store failed"));
    t.oncomplete = () => db.close();
  });
}

export const putBlob = (id: string, blob: Blob) => tx("readwrite", (s) => s.put(blob, id)).then(() => undefined);
export const getBlob = (id: string) => tx<Blob | undefined>("readonly", (s) => s.get(id));
export const deleteBlob = (id: string) => tx("readwrite", (s) => s.delete(id)).then(() => { revoke(id); });

const urls = new Map<string, string>();
/** An object URL for the stored bytes, kept until the media is deleted. */
export async function blobUrl(id: string): Promise<string | null> {
  const had = urls.get(id);
  if (had) return had;
  const blob = await getBlob(id);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urls.set(id, url);
  return url;
}
function revoke(id: string) {
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
}

/** What X will take, and how it will take it. */
export const LIMITS = {
  image: { bytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  gif: { bytes: 15 * 1024 * 1024, types: ["image/gif"] },
  video: { bytes: 512 * 1024 * 1024, types: ["video/mp4", "video/quicktime", "video/webm"] },
  perPost: { images: 4, other: 1 },
} as const;

export function kindOf(type: string): TweetMedia["kind"] | null {
  if (type === "image/gif") return "gif";
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return null;
}

/** Shrink and re-encode a picture; returns the blob and its size. */
async function cookImage(file: Blob, maxEdge: number, quality: number): Promise<{ blob: Blob; width: number; height: number }> {
  const src = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That picture could not be read"));
      el.src = src;
    });
    const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
    const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024 && (file.type === "image/jpeg" || file.type === "image/png" || file.type === "image/webp")) {
      return { blob: file, width: w, height: h };
    }
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")?.drawImage(img, 0, 0, w, h);
    const keepAlpha = file.type === "image/png";
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the picture"))), keepAlpha ? "image/png" : "image/webp", quality));
    return { blob, width: w, height: h };
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** A small data URL to draw in the strip: the picture, or a frame of the video. */
async function thumbOf(blob: Blob, kind: TweetMedia["kind"]): Promise<{ thumb: string; width: number; height: number }> {
  const url = URL.createObjectURL(blob);
  try {
    const canvas = document.createElement("canvas");
    const draw = (w: number, h: number, paint: (c: CanvasRenderingContext2D) => void) => {
      const scale = Math.min(1, 240 / Math.max(w, h));
      canvas.width = Math.max(1, Math.round(w * scale));
      canvas.height = Math.max(1, Math.round(h * scale));
      const c = canvas.getContext("2d");
      if (c) paint(c);
      return { thumb: canvas.toDataURL("image/webp", 0.7), width: w, height: h };
    };
    if (kind === "video") {
      const v = document.createElement("video");
      v.muted = true;
      v.playsInline = true;
      v.src = url;
      await new Promise<void>((resolve, reject) => {
        v.onloadeddata = () => resolve();
        v.onerror = () => reject(new Error("That video could not be read"));
      });
      v.currentTime = Math.min(0.5, (v.duration || 1) / 2);
      await new Promise<void>((resolve) => { v.onseeked = () => resolve(); setTimeout(resolve, 800); });
      return draw(v.videoWidth || 640, v.videoHeight || 360, (c) => c.drawImage(v, 0, 0, canvas.width, canvas.height));
    }
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("That picture could not be read"));
      el.src = url;
    });
    return draw(img.width, img.height, (c) => c.drawImage(img, 0, 0, canvas.width, canvas.height));
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Take a file in: check it is something X accepts, cook it if it is a
 * picture, store the bytes, and hand back the record the draft keeps.
 */
export async function intake(file: File | Blob, opts: { maxEdge: number; quality: number; name?: string }): Promise<TweetMedia> {
  const type = file.type || "application/octet-stream";
  const kind = kindOf(type);
  if (!kind) throw new Error(`X does not take ${type || "that kind of file"}.`);
  const name = opts.name ?? ("name" in file ? (file as File).name : `${kind}-${Date.now()}`);
  let blob: Blob = file;
  let size = { width: 0, height: 0 };
  if (kind === "image") {
    const cooked = await cookImage(file, opts.maxEdge, opts.quality);
    blob = cooked.blob;
    size = { width: cooked.width, height: cooked.height };
  }
  const limit = LIMITS[kind].bytes;
  if (blob.size > limit) throw new Error(`${name} is ${(blob.size / 1024 / 1024).toFixed(1)} MB; X takes ${kind === "image" ? "5" : kind === "gif" ? "15" : "512"} MB at most.`);
  const t = await thumbOf(blob, kind);
  const id = uid("m");
  await putBlob(id, blob);
  return {
    id, kind, name, type: blob.type || type, size: blob.size,
    width: size.width || t.width, height: size.height || t.height,
    alt: "", thumb: t.thumb,
  };
}
