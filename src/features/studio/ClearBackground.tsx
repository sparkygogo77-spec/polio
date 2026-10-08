"use client";
/**
 * TRANSPARENT BACKGROUND: point at the background, and it goes see-through.
 *
 * The owner's words: "add a right click menu transparent background
 * selector". The door in is the wheel's tray under any part that holds a
 * picture (`RadialMenu.tsx`). The card shows the picture over a checkerboard,
 * so what is see-through reads as see-through:
 *
 *   · it starts with the four corners picked, the usual place a background
 *     is, so the first look is already a guess;
 *   · a press on the picture picks that colour instead; Shift-press adds it
 *     to what is picked, for a background of more than one colour;
 *   · "How close" widens or narrows what counts as the same colour, and
 *     "Everywhere in the picture" clears that colour even where it does not
 *     touch what was pressed (the holes inside a ring, say);
 *   · Apply keeps the result as a new PNG file (`pictures.ts`) on the same
 *     part, the old one kept in the part's versions, and one Undo puts it
 *     back, as Remake does (`RemakePicture.tsx`).
 *
 * The cut itself is `seeThrough.ts`, pure and held by `tests/see-through.mjs`.
 */
import * as React from "react";
import { Eraser, Loader2, X } from "lucide-react";
import { useStudio, type StudioNode } from "./board/store";
import { bytesFor, put as putPicture } from "./pictures";
import { KEEP_VERSIONS } from "./remake";
import { clearShare, cornerSeeds, seeThrough } from "./seeThrough";
import { play } from "@/core/audio/engine";

let asking: string | null = null;
const watchers = new Set<() => void>();
let tick = 0;
const changed = () => { tick++; watchers.forEach((w) => w()); };
const useTick = () => React.useSyncExternalStore((w) => { watchers.add(w); return () => { watchers.delete(w); }; }, () => tick, () => 0);

/** Open the card for this part. */
export function openClearBackground(nodeId: string) {
  asking = nodeId;
  play("open");
  changed();
}

/** Whether a part holds a picture whose background can be cleared. */
export function canClearBackground(node: Pick<StudioNode, "picture"> | null | undefined): boolean {
  return !!node?.picture;
}

const CHECKER = "repeating-conic-gradient(oklch(0.42 0 0) 0% 25%, oklch(0.3 0 0) 0% 50%) 0 0 / 16px 16px";

type Loaded = { w: number; h: number; data: Uint8ClampedArray } | { error: string };

export function ClearBackgroundCard() {
  useTick();
  const nodeId = asking;
  const node = useStudio((s) => (nodeId ? s.nodes.find((n) => n.id === nodeId) ?? null : null));
  const pic = node?.picture ?? null;
  const [loaded, setLoaded] = React.useState<Loaded | null>(null);
  const [seeds, setSeeds] = React.useState<[number, number][]>([]);
  const [tolerance, setTolerance] = React.useState(30);
  const [everywhere, setEverywhere] = React.useState(false);
  const [trim, setTrim] = React.useState(0);
  const [busy, setBusy] = React.useState(false);
  const [share, setShare] = React.useState(0);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const result = React.useRef<Uint8ClampedArray<ArrayBuffer> | null>(null);

  /* The picture's own pixels, read once per opening. */
  React.useEffect(() => {
    setLoaded(null); setBusy(false);
    if (!pic) return;
    let live = true;
    void (async () => {
      const blob = await bytesFor(pic);
      if (!blob) { if (live) setLoaded({ error: "This picture is not in this browser any more. Choose it again first." }); return; }
      try {
        const bmp = await createImageBitmap(blob);
        const c = document.createElement("canvas");
        c.width = bmp.width; c.height = bmp.height;
        const x = c.getContext("2d", { willReadFrequently: true })!;
        x.drawImage(bmp, 0, 0);
        bmp.close();
        const data = x.getImageData(0, 0, c.width, c.height).data;
        if (!live) return;
        setLoaded({ w: c.width, h: c.height, data });
        setSeeds(cornerSeeds(c.width, c.height));
      } catch {
        if (live) setLoaded({ error: "This browser could not read the picture." });
      }
    })();
    return () => { live = false; };
  }, [pic?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  /* The cut, redrawn whenever what is picked or how close changes. */
  React.useEffect(() => {
    if (!loaded || "error" in loaded || !canvas.current) return;
    const id = requestAnimationFrame(() => {
      const out = seeThrough(loaded.data, loaded.w, loaded.h, { seeds, tolerance, everywhere, trim });
      result.current = out;
      const c = canvas.current;
      if (!c) return;
      c.width = loaded.w; c.height = loaded.h;
      c.getContext("2d")!.putImageData(new ImageData(out, loaded.w, loaded.h), 0, 0);
      setShare(clearShare(out));
    });
    return () => cancelAnimationFrame(id);
  }, [loaded, seeds, tolerance, everywhere, trim]);

  React.useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) { e.stopImmediatePropagation(); asking = null; changed(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [nodeId, busy]);

  if (!nodeId || !node || !pic) return null;
  const close = () => { asking = null; play("close"); changed(); };
  const ready = !!loaded && !("error" in loaded);

  const pick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const r = e.currentTarget.getBoundingClientRect();
    const at: [number, number] = [
      Math.floor(((e.clientX - r.left) / r.width) * loaded.w),
      Math.floor(((e.clientY - r.top) / r.height) * loaded.h),
    ];
    play("select");
    setSeeds((was) => (e.shiftKey ? [...was, at] : [at]));
  };

  const apply = async () => {
    if (!ready || !result.current || busy) return;
    setBusy(true);
    try {
      const c = document.createElement("canvas");
      c.width = loaded.w; c.height = loaded.h;
      c.getContext("2d")!.putImageData(new ImageData(result.current, loaded.w, loaded.h), 0, 0);
      /* PNG, always: a JPEG or a WebP saved lossy has nowhere to keep see-through. */
      const blob = await new Promise<Blob | null>((ok) => c.toBlob(ok, "image/png"));
      if (!blob) throw new Error("no file");
      const made = { ...(await putPicture(blob, { alt: pic.alt, from: pic.from })), seeThrough: true };
      const now = useStudio.getState().nodes.find((n) => n.id === node.id);
      if (!now) return;
      /* The old one kept in the part's versions, the original first, as Remake keeps them. */
      const before = now.pictureVersions?.length ? now.pictureVersions : [now.picture ?? pic];
      const versions = [...before.filter((v) => v.id !== made.id), made];
      const kept = versions.length > KEEP_VERSIONS ? [versions[0]!, ...versions.slice(-(KEEP_VERSIONS - 1))] : versions;
      useStudio.getState().updateNode(node.id, { picture: made, pictureVersions: kept });
      play("confirm");
      asking = null;
      changed();
    } catch {
      play("deny");
      setBusy(false);
    }
  };

  return (
    <div data-clear-bg-card={node.id} role="dialog" aria-label="Transparent background" className="fixed bottom-24 left-1/2 z-[70] w-[min(420px,94vw)] -translate-x-1/2 rounded-lg border border-border bg-panel p-3 shadow-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Eraser className="size-4 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-plain font-semibold text-fg">Transparent background</h2>
        <button type="button" aria-label="Close" onClick={close} className="tactile rounded-sm p-0.5 text-fg-muted hover:text-fg"><X className="size-4" /></button>
      </div>
      <p className="mb-2 text-small leading-snug text-fg-muted">
        Click the background in the picture to clear that colour. Shift-click to add another.
      </p>
      <div className="grid place-items-center overflow-hidden rounded-sm border border-border" style={{ background: CHECKER }}>
        {loaded && "error" in loaded ? (
          <p className="p-6 text-center text-small text-warn">{loaded.error}</p>
        ) : !loaded ? (
          <Loader2 className="m-10 size-5 animate-spin text-fg-muted" />
        ) : (
          <canvas
            ref={canvas}
            data-clear-bg-canvas=""
            onClick={pick}
            className="block max-h-[46vh] w-full cursor-crosshair object-contain"
            style={{ aspectRatio: `${loaded.w} / ${loaded.h}` }}
          />
        )}
      </div>
      <label className="mt-2 flex items-center gap-2 text-small text-fg-muted">
        <span className="shrink-0">How close</span>
        <input
          type="range"
          data-clear-bg-tolerance=""
          min={0}
          max={120}
          value={tolerance}
          onChange={(e) => setTolerance(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
          aria-label="How close a colour must be to clear"
        />
        <span className="num w-7 text-right text-fg">{tolerance}</span>
      </label>
      {/* A thin ring of the old background can cling to the subject's edge; this takes it off, a pixel at a time, without reaching further into the picture. */}
      <label className="mt-1 flex items-center gap-2 text-small text-fg-muted">
        <span className="shrink-0">Trim edge</span>
        <input
          type="range"
          data-clear-bg-trim=""
          min={0}
          max={4}
          value={trim}
          onChange={(e) => setTrim(Number(e.target.value))}
          className="min-w-0 flex-1 accent-[var(--color-accent)]"
          aria-label="Pixels taken off the edge of what is kept"
        />
        <span className="num w-7 text-right text-fg">{trim}px</span>
      </label>
      <label className="mt-1 flex items-center gap-2 text-small text-fg-muted">
        <input type="checkbox" data-clear-bg-everywhere="" checked={everywhere} onChange={(e) => setEverywhere(e.target.checked)} />
        Everywhere in the picture, not only where it touches what I clicked
      </label>
      <div className="mt-2 flex items-center gap-2">
        <span data-clear-bg-share="" className="min-w-0 flex-1 text-small text-fg-faint">{ready ? `${Math.round(share * 100)}% see-through` : ""}</span>
        <button type="button" onClick={close} className="tactile rounded-md px-2.5 py-1 text-small text-fg-muted hover:text-fg">Not now</button>
        <button
          type="button"
          data-clear-bg-apply=""
          disabled={!ready || busy}
          onClick={() => void apply()}
          className="tactile flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-small font-medium text-accent-fg disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Eraser className="size-3.5" />}
          Apply
        </button>
      </div>
    </div>
  );
}
