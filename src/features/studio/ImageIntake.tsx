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
 */
import * as React from "react";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";

export const MAX_EDGE = 640;

/** A file or a pasted blob, shrunk and turned into a data URL. */
export function readImage(file: Blob, maxEdge = MAX_EDGE): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that file"));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => resolve(src); // an SVG or something exotic — keep it as it came
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
        if (scale === 1 && src.length < 400_000) return resolve(src);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(src);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Keep transparency when there is any; otherwise WebP at quality is far smaller.
        const hasAlpha = /^data:image\/(png|webp|gif)/.test(src);
        resolve(canvas.toDataURL(hasAlpha ? "image/webp" : "image/webp", 0.86));
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
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
export function usePasteImage(active: boolean, onImage: (dataUrl: string) => void) {
  const ref = React.useRef(onImage);
  ref.current = onImage;
  React.useEffect(() => {
    if (!active) return;
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null;
      // Never steal a paste from something someone is typing into.
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA)$/.test(target.tagName))) return;
      const file = imageFrom(e.clipboardData);
      if (!file) return;
      e.preventDefault();
      void readImage(file).then((src) => { play("confirm"); ref.current(src); });
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
  const [hover, setHover] = React.useState(false);

  const take = React.useCallback(async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      onImage(await readImage(file));
      play("confirm");
    } catch {
      setError("That file could not be read.");
    } finally {
      setBusy(false);
    }
  }, [onImage]);

  // While the pointer is over the well, a paste lands here.
  usePasteImage(hover, onImage);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); void take(imageFrom(e.dataTransfer)); }}
      className={cn("space-y-1", className)}
    >
      <label
        title={compact ? (src ? `Replace ${label}` : `Drop, paste or choose ${label}`) : undefined}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed text-center text-[10px] transition-colors",
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
      {error ? <p className="text-[10px] text-danger">{error}</p> : null}
      {src && onClear ? (
        <button type="button" onClick={onClear} className="text-[10px] text-fg-muted hover:text-fg">
          Remove
        </button>
      ) : null}
    </div>
  );
}
