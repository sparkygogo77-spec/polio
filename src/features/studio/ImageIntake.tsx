"use client";
/**
 * Getting a picture in.
 *
 * Three ways, because people reach for whichever is nearest: choose a file,
 * drag one onto the well, or paste one straight from the clipboard. All three
 * end in the same place.
 *
 * Everything is shrunk on the way in. The document is persisted to
 * localStorage, which holds a few megabytes in total, so a phone photo pasted
 * at full size would fill it on its own. 640px on the long edge is more than a
 * texture tile or a reference ever needs.
 *
 * A file the browser cannot decode (HEIC off a phone, TIFF, PSD, a file that
 * is not a picture) is refused with the same sentence the Import flow uses,
 * and nothing is kept: the full-size bytes would paint as nothing and sit in
 * the document, and localStorage has no room for them.
 *
 * The odd shapes are said, not swallowed: an animated GIF or WebP keeps its
 * first frame and the door says so; a picture with any transparent pixel is
 * kept lossless (PNG) so a cut-out's edges grow no halos, and one with none
 * is WebP, which is far smaller; a drag from another web page carries a link
 * and no file, and is told what would work.
 */
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";

export const MAX_EDGE = 640;

/** What every door says of a file the browser could not decode. */
export const REFUSED = "This browser cannot open that picture.";

/** The sentence for an intake that failed, whatever threw. */
export function refusal(e: unknown): string {
  return e instanceof Error && e.message ? e.message : REFUSED;
}

/** What came in: the picture as a data URL, and anything worth saying about it. */
export interface Picture {
  src: string;
  /** Said beside the picture when the file was more than one frame. */
  note?: string;
}

export const FIRST_FRAME = "That was an animation; its first frame was kept.";

/**
 * Whether a GIF or WebP holds more than one frame, off its bytes: a GIF's
 * second graphic-control block, a WebP's ANIM chunk. A still one has neither.
 */
export async function isAnimated(file: Blob): Promise<boolean> {
  if (!/^image\/(gif|webp)$/.test(file.type)) return false;
  const bytes = new Uint8Array(await file.slice(0, 1 << 20).arrayBuffer());
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    for (let i = 12; i < Math.min(bytes.length, 64) - 4; i++) {
      if (bytes[i] === 0x41 && bytes[i + 1] === 0x4e && bytes[i + 2] === 0x49 && bytes[i + 3] === 0x4d) return true;
    }
    return false;
  }
  let frames = 0;
  for (let i = 0; i < bytes.length - 2; i++) {
    if (bytes[i] === 0x21 && bytes[i + 1] === 0xf9 && bytes[i + 2] === 0x04 && ++frames > 1) return true;
  }
  return false;
}

/** A file or a pasted blob, shrunk and turned into a data URL, with what was done to it. */
export async function readPicture(file: Blob, maxEdge = MAX_EDGE): Promise<Picture> {
  const animated = await isAnimated(file).catch(() => false);
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error(REFUSED));
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        if (scale === 1 && src.length < 400_000 && !animated) return resolve(src);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // A picture with any see-through pixel stays lossless, so a cut-out's
        // edge keeps its edge; one with none is WebP, which is far smaller.
        // Only a type that can carry alpha is worth the read.
        const clear = /^data:image\/(png|webp|gif|avif)/.test(src) && seeThrough(ctx.getImageData(0, 0, canvas.width, canvas.height));
        resolve(clear ? canvas.toDataURL("image/png") : canvas.toDataURL("image/webp", 0.86));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
  return animated ? { src, note: FIRST_FRAME } : { src };
}

/** Any pixel not fully opaque. */
function seeThrough(data: ImageData): boolean {
  const px = data.data;
  for (let i = 3; i < px.length; i += 4) if (px[i]! < 255) return true;
  return false;
}

/** The picture alone, for a door with nowhere to say more. */
export function readImage(file: Blob, maxEdge = MAX_EDGE): Promise<string> {
  return readPicture(file, maxEdge).then((p) => p.src);
}

/**
 * What to say of a drop that carried no file: a picture dragged off another
 * web page arrives as a link, which the page cannot fetch from here.
 */
export function dropSays(source: DataTransfer | null | undefined): string | null {
  if (!source || imageFrom(source)) return null;
  const types = Array.from(source.types ?? []);
  if (types.includes("text/uri-list") || /^https?:\/\//.test(source.getData("text/plain") ?? "")) {
    return "That was a link to a picture, not the picture. Save it to your computer first, then drop or paste the file.";
  }
  if (Array.from(source.files ?? []).length) return "That file is not a picture this browser can open.";
  return null;
}

/** The first image in a drop or a paste, if there is one. */
export function imageFrom(source: DataTransfer | null | undefined): File | null {
  if (!source) return null;
  const items = Array.from(source.items ?? []);
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  const files = Array.from(source.files ?? []);
  return files.find((f) => f.type.startsWith("image/")) ?? null;
}

/**
 * Listens for a pasted image while `active`. Paste has no drop target, so it
 * is caught at the window and handed to whoever is listening.
 */
export function usePasteImage(active: boolean, onImage: (dataUrl: string, note?: string) => void, onRefuse?: (why: string) => void) {
  const ref = React.useRef(onImage);
  ref.current = onImage;
  const refuse = React.useRef(onRefuse);
  refuse.current = onRefuse;
  React.useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never steal a paste from something someone is typing into.
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))) return;
      const file = imageFrom(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      void readPicture(file)
        .then((p) => { play("confirm"); ref.current(p.src, p.note); })
        .catch((e: unknown) => { play("deny"); refuse.current?.(refusal(e)); });
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [active]);
}

/** Click, drop or paste. Shows what landed, and lets you take it out again. */
export function ImageWell({
  src, onImage, onClear, label = "image", className, compact,
}: {
  src?: string | null;
  onImage: (dataUrl: string) => void;
  onClear?: () => void;
  label?: string;
  className?: string;
  /** A thumbnail and nothing else — for a row of wells too narrow for words. */
  compact?: boolean;
}) {
  const [over, setOver] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [note, setNote] = React.useState<string | null>(null);
  const [hover, setHover] = React.useState(false);

  const take = React.useCallback(async (file: File | null, says?: string | null) => {
    if (!file) { if (says) { play("deny"); setError(says); } return; }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const p = await readPicture(file);
      onImage(p.src);
      setNote(p.note ?? null);
      play("confirm");
    } catch (e) {
      play("deny");
      setError(refusal(e));
    } finally {
      setBusy(false);
    }
  }, [onImage]);

  // While the pointer is over the well, a paste lands here.
  usePasteImage(hover, (src, said) => { setError(null); setNote(said ?? null); onImage(src); }, setError);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void take(imageFrom(e.dataTransfer), dropSays(e.dataTransfer)); }}
      className={cn("space-y-1", className)}
    >
      <label
        title={compact ? (src ? `Replace ${label}` : `Drop, paste or choose ${label}`) : undefined}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center text-small transition-colors",
          compact ? "h-11 p-0.5" : "p-2",
          over ? "border-accent bg-accent/10 text-fg" : "border-border text-fg-muted hover:border-accent hover:text-fg",
        )}
      >
        {src ? (
          <span
            aria-hidden
            className={cn("w-full rounded-sm border border-border", compact ? "h-full" : "h-10")}
            style={{ backgroundImage: `url(${src})`, backgroundSize: "cover", backgroundPosition: "center" }}
          />
        ) : null}
        <span className={cn(compact && "sr-only")}>
          {busy ? "Reading…" : src ? `Replace ${label}` : `Drop, paste or choose ${label === "image" ? "an image" : `a ${label}`}`}
        </span>
        {compact && !src ? <span aria-hidden className="text-fg-faint">+</span> : null}
        <input
          type="file"
          accept="image/*"
          aria-label={`Texture ${label}`}
          className="sr-only"
          onChange={(e) => void take(e.target.files?.[0] ?? null)}
        />
      </label>
      {error ? <p data-picture-refused="" className="text-small text-danger">{error}</p> : null}
      {note ? <p data-picture-note="" className="text-small text-fg-muted">{note}</p> : null}
      {src && onClear ? (
        <button type="button" onClick={onClear} className="text-small text-fg-muted hover:text-fg">
          Remove
        </button>
      ) : null}
    </div>
  );
}
