"use client";
/**
 * Import: a picture or a video, and where the frame lands.
 *
 * WHAT THIS REPLACES. The background's wheel had a Picture piece that opened
 * an `image/*` chooser and, whatever you gave it, did exactly one thing: it
 * added a texture layer to the page with `pattern: true`, `scale: 60`,
 * `opacity: 0.5`, `contrast: 0.45`. That is a *tile* — the picture reduced
 * to a monochrome mask, repainted in a palette colour, half-transparent,
 * repeated across the whole page. It is the right answer for a background
 * texture and it was the only answer, so there was no way to bring a
 * picture in as a picture. There was also no video: `accept="image/*"` did
 * not offer one, and nothing anywhere took a video file.
 *
 * WHAT IT IS NOW. The piece is Import, it takes a picture or a video, and a
 * video is scrubbed to the frame you want with that frame live on the
 * background as you drag — the board behind this panel really is showing
 * the frame under the playhead, not a thumbnail of it, because it is the
 * same layer the chosen frame will become.
 *
 * Then the frame lands one of two ways, and they are genuinely different
 * things rather than two sizes of one thing:
 *
 *   · FIT TO STANDARD — one picture, covering, at the frame's own standard
 *     dimensions. A background. It stays a texture layer, because that is
 *     what a background is, but `weave: 1` and `pattern: false` make it one
 *     coherent covering picture instead of a recoloured tile.
 *
 *   · SHRINK IN — it comes in from the edges and settles as an ordinary
 *     part: its own aspect, inset from the frame, dragged and resized like
 *     anything else on the page. The picture rides on `node.texture`, which
 *     is the mechanism parts already have for wearing one.
 *
 * Nothing is committed until one of those two is pressed. Leaving takes the
 * preview off the page and leaves the document as it was.
 */
import * as React from "react";
import { Check, Image as ImageIcon, Scissors, X } from "lucide-react";
import { useStudio, frameHeight, BASE_ZOOM } from "./board/store";
import { newLayer } from "./look";
import { play } from "@/core/audio/engine";
import { haptic } from "@/core/feedback/haptics";
import { cn } from "@/core/lib/cn";

/** What the chooser handed over, before anything has been committed. */
export interface ImportDraft {
  /** Object URL of the file itself. A video keeps playing off this. */
  url: string;
  from: "picture" | "video";
  name: string;
}

let draft: ImportDraft | null = null;
const listeners = new Set<(d: ImportDraft | null) => void>();

/** Hand a chosen file to the flow. The wheel's Import piece calls this. */
export function openImport(d: ImportDraft) {
  draft = d;
  listeners.forEach((l) => l(draft));
}
export function closeImport() {
  if (draft) URL.revokeObjectURL(draft.url);
  draft = null;
  listeners.forEach((l) => l(null));
}
function subscribe(l: (d: ImportDraft | null) => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/**
 * The frame showing on the page right now, while it is still being chosen.
 *
 * This deliberately does NOT go through the texture system, and the reason
 * is worth writing down because the first version did. `addTexture` calls
 * `push()` — it is an edit, and it goes in the undo history and into the
 * saved document. A scrubber dragged across three seconds of video fires
 * one of those per frame: a hundred undo entries for a choice nobody has
 * made yet, and an abandoned import left in the document if the tab closed
 * mid-drag.
 *
 * A preview is not an edit. It lives here, outside the document entirely;
 * `Canvas` paints it over the page and forgets it the moment this clears.
 * The only write is the landing.
 */
let preview: string | null = null;
const watchers = new Set<(src: string | null) => void>();
function setPreview(src: string | null) {
  preview = src;
  watchers.forEach((w) => w(preview));
}
/** The board reads this to paint the frame being chosen. */
export function useImportPreview(): string | null {
  return React.useSyncExternalStore(
    (w) => { watchers.add(w); return () => { watchers.delete(w); }; },
    () => preview,
    () => null,
  );
}

/** The longest edge a frame is kept at. Matches `ImageIntake`'s own cap. */
const MAX_EDGE = 640;

/** A frame of a video, as a data URL, at the cap. */
function frameOf(video: HTMLVideoElement): { src: string; w: number; h: number } | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return null;
  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(vw * scale));
  c.height = Math.max(1, Math.round(vh * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, c.width, c.height);
  return { src: c.toDataURL("image/webp", 0.86), w: vw, h: vh };
}

/** A still picture, read to a data URL at the same cap. */
function pictureOf(img: HTMLImageElement): { src: string; w: number; h: number } | null {
  const vw = img.naturalWidth;
  const vh = img.naturalHeight;
  if (!vw || !vh) return null;
  const scale = Math.min(1, MAX_EDGE / Math.max(vw, vh));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(vw * scale));
  c.height = Math.max(1, Math.round(vh * scale));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL("image/webp", 0.9), w: vw, h: vh };
}

const clock = (t: number) => {
  const s = Math.max(0, t);
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}.${String(Math.floor((s % 1) * 10))}`;
};

export function ImportFlow() {
  const d = React.useSyncExternalStore(subscribe, () => draft, () => null);
  const video = React.useRef<HTMLVideoElement>(null);
  const [ready, setReady] = React.useState(false);
  const [length, setLength] = React.useState(0);
  const [at, setAt] = React.useState(0);
  /** The frame as chosen: what both of the two keys below will commit. */
  const [frame, setFrame] = React.useState<{ src: string; w: number; h: number } | null>(null);
  /*
   * A file this browser cannot open.
   *
   * A chooser that says `video/*` will hand over a .mov full of ProRes, or
   * an HEIC photo, and the answer is a decode that never completes: no
   * metadata, no frame, `ready` false for ever, and two keys greyed out
   * with nothing anywhere saying why. Silence is the worst of the three
   * possible answers. It says so instead, and offers the way out.
   */
  const [refused, setRefused] = React.useState<string | null>(null);

  /* Every trace of the flow comes off the page when it closes, whether it
     was finished or abandoned. Nothing to undo, because nothing was done. */
  const wipe = React.useCallback(() => setPreview(null), []);

  React.useEffect(() => {
    if (!d) { setReady(false); setLength(0); setAt(0); setFrame(null); setRefused(null); wipe(); }
  }, [d, wipe]);

  /** Put a frame on the page, live. One assignment, no document touched. */
  const show = React.useCallback((src: string) => setPreview(src), []);

  /* A still picture needs no scrubbing: read it and go straight to landing. */
  React.useEffect(() => {
    if (!d || d.from !== "picture") return;
    const img = new Image();
    img.onload = () => {
      const f = pictureOf(img);
      if (!f) { setRefused("That picture opened with no size to it."); return; }
      setFrame(f);
      show(f.src);
      setReady(true);
    };
    img.onerror = () => setRefused("This browser cannot open that picture.");
    img.src = d.url;
  }, [d, show]);

  /* A video: hold the frame under the playhead, and publish it as it moves. */
  const seek = React.useCallback((t: number) => {
    const v = video.current;
    if (!v) return;
    setAt(t);
    v.currentTime = t;
  }, []);

  React.useEffect(() => {
    const v = video.current;
    if (!v || !d || d.from !== "video") return;
    const meta = () => { setLength(v.duration || 0); v.currentTime = Math.min(0.1, (v.duration || 1) / 10); };
    const seeked = () => {
      const f = frameOf(v);
      if (!f) return;
      setFrame(f);
      show(f.src);
      setReady(true);
    };
    /* Two ways a video refuses: it errors, or it never says anything at
       all. The second is the one that used to hang, so it is on a clock. */
    const failed = () => setRefused("This browser cannot open that video.");
    const waited = window.setTimeout(() => {
      if (!v.videoWidth) setRefused("That video did not open. It may be in a format this browser cannot play.");
    }, 6000);
    v.addEventListener("loadedmetadata", meta);
    v.addEventListener("seeked", seeked);
    v.addEventListener("error", failed);
    return () => {
      window.clearTimeout(waited);
      v.removeEventListener("loadedmetadata", meta);
      v.removeEventListener("seeked", seeked);
      v.removeEventListener("error", failed);
    };
  }, [d, show]);

  if (!d) return null;

  /**
   * One picture, covering, at the frame's standard dimensions.
   *
   * It stays a texture layer, because a background IS a texture layer — but
   * `pattern: false` and `weave: 1` make it one coherent covering picture
   * rather than the half-opaque recoloured tile Picture used to make, which
   * is the whole difference between importing a picture and papering with
   * one.
   */
  const fitToStandard = () => {
    if (!frame) return;
    /* A background just laid is the next thing to look at: the Look panel, where its layer is (a press on a part had put the Element panel first). */
    useStudio.getState().want({ panel: "look" });
    useStudio.getState().addTexture({
      ...newLayer("image"),
      src: frame.src,
      pattern: false, weave: 1, opacity: 1, contrast: 0, scale: 100,
      target: "page",
    });
    play("confirm");
    haptic(18);
    closeImport();
  };

  /** An ordinary part, inset from the edges, wearing the picture. */
  const shrinkIn = () => {
    if (!frame) return;
    const s = useStudio.getState();
    /* Off for the page: the part wears it whether or not it is on, and on it
       was painted by every card as well (`docTake.pictureLayersOff`). */
    const layer = { ...newLayer("image"), src: frame.src, pattern: false, weave: 1, opacity: 1, contrast: 0, scale: 100, target: "surfaces" as const, on: false };
    /* The picture's layer is the next thing to look at: the Look panel, where its selection is. */
    s.want({ panel: "look" });
    s.addTexture(layer);
    /* Its own aspect, inset from the frame so it reads as a thing ON the
       page rather than as the page. Two thirds across is the same room a
       dropped part is given. */
    const frameW = s.frameWidth;
    const w = Math.round(frameW * 0.62);
    const h = Math.max(40, Math.round((w * frame.h) / Math.max(1, frame.w)));
    const x = Math.round((frameW - w) / 2);
    const y = 120;
    const id = s.addNode("picture", x, y);
    if (id) {
      s.updateNode(id, { w, h, texture: layer.id, label: d.name.replace(/\.[^.]+$/, "") || "Picture" });
      /*
       * Where it comes in from: covering the page. Written in the part's own
       * coordinates with the origin at its top-left, so `translate` puts the
       * part's corner on the page's corner and `scale` stretches its box out
       * to the page's. Running that backwards is the shrink.
       */
      const pageH = Math.max(900, frameHeight(
        s.nodes.filter((n) => n.pageId === s.activePageId),
        900,
        { shapes: s.shapes.filter((sh) => sh.pageId === s.activePageId), spaces: s.spaces.filter((sp) => sp.pageId === s.activePageId) },
      ));
      markArriving(id, `translate(${-x}px, ${-y}px) scale(${(frameW / w).toFixed(4)}, ${(pageH / h).toFixed(4)})`);
    }
    play("confirm");
    haptic(18);
    closeImport();
  };

  const scrubbing = d.from === "video";
  return (
    <div
      data-import-flow=""
      className="pointer-events-none fixed inset-0 z-[70] flex items-end justify-center pb-10"
      role="dialog"
      aria-label="Import a picture or a video"
    >
      {scrubbing ? (
        <video ref={video} src={d.url} className="hidden" preload="metadata" muted playsInline />
      ) : null}
      <div className="pointer-events-auto w-[min(660px,92vw)] rounded-xl border border-border bg-panel/95 p-3 shadow-panel backdrop-blur">
        <div className="mb-2 flex items-center gap-2">
          <ImageIcon className="size-4 text-fg-muted" />
          <span className="text-large font-medium text-fg">{d.from === "video" ? "Pick the frame" : "Where it lands"}</span>
          <span className="truncate text-plain text-fg-faint">{d.name}</span>
          <button
            type="button"
            aria-label="Cancel the import"
            className="tactile ml-auto rounded-md p-1 text-fg-muted hover:text-fg"
            onClick={() => { play("close"); closeImport(); }}
          >
            <X className="size-4" />
          </button>
        </div>

        {refused ? (
          <p data-import-refused="" className="mb-3 text-plain leading-snug text-fg-muted">
            {refused} Nothing has been changed — a picture, or a video in a format it plays, will go through.
          </p>
        ) : null}

        {scrubbing && !refused ? (
          <div className="mb-3">
            {/*
              The scrubber. Dragging it moves the playhead and the background
              behind this panel changes with it — the frame under the head is
              on the page, full size, not in a filmstrip.
            */}
            <input
              data-import-scrub=""
              type="range"
              min={0}
              max={Math.max(0.01, length)}
              step={Math.max(0.01, length / 600)}
              value={at}
              aria-label="Which frame"
              className="w-full accent-[var(--accent)]"
              onChange={(e) => seek(Number(e.target.value))}
            />
            <div className="mt-1 flex justify-between text-small text-fg-faint">
              <span className="num">{clock(at)}</span>
              <span className="num">{clock(length)}</span>
            </div>
          </div>
        ) : null}

        <div className="flex gap-2">
          {/*
            Two landings, said as what they do rather than as sizes. Neither
            is a default: a background and a part are different intentions
            and the person has one of them in mind already.
          */}
          <button
            type="button"
            data-import-fit=""
            disabled={!ready}
            className={cn("tactile flex-1 rounded-lg border border-border px-3 py-2 text-left", !ready && "opacity-40")}
            onClick={fitToStandard}
          >
            <span className="flex items-center gap-1.5 text-large font-medium text-fg"><Check className="size-3.5" /> Fit to standard</span>
            <span className="mt-0.5 block text-small leading-snug text-fg-muted">
              {refused ? "Nothing to land." : "One picture, covering the page at its standard size."}
            </span>
          </button>
          <button
            type="button"
            data-import-shrink=""
            disabled={!ready}
            className={cn("tactile flex-1 rounded-lg border border-border px-3 py-2 text-left", !ready && "opacity-40")}
            onClick={shrinkIn}
          >
            <span className="flex items-center gap-1.5 text-large font-medium text-fg"><Scissors className="size-3.5" /> Shrink in</span>
            <span className="mt-0.5 block text-small leading-snug text-fg-muted">
              {refused ? "Nothing to land." : "In from the edges, as a part you can drag and resize."}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** How long the shrink takes. Long enough to read as a movement, short
    enough that nobody waits for it. */
export const IMPORT_SETTLE_MS = 420;

/**
 * The part that has just arrived, and the box it starts from.
 *
 * "Shrink in from the edges" is the whole of the name, so it has to be the
 * whole of the behaviour: the picture begins covering the page, edge to
 * edge, and closes to the box it will keep. That is one transform, run once
 * by the part itself — not a class, because the start depends on where the
 * part landed and how big the page is, and a stylesheet cannot know either.
 *
 * It is cleared as soon as it is claimed. An arrival is a moment, and a
 * board that re-renders for any other reason must not replay it.
 */
let arriving: { id: string; from: string } | null = null;
const arrivers = new Set<() => void>();

/**
 * Say which part has just arrived, and the box it comes in from.
 *
 * This notifies rather than just setting a value, and that is the whole of
 * why it works. The first version was a plain variable read once in the
 * part's mount effect — and the mark is set *after* `addNode`, which
 * flushes React synchronously, so the part had already mounted and read
 * nothing by the time the mark existed. It measured 647px in flight and
 * 647px at rest: no animation at all, silently.
 */
export function markArriving(id: string, from: string) {
  arriving = { id, from };
  arrivers.forEach((f) => f());
}

/**
 * The box this part comes in from, once, whenever the mark arrives —
 * before this mounted or after. Reading it spends it, so a board that
 * re-renders for any other reason never replays the arrival.
 */
export function useArrival(id: string): string | null {
  const [from, setFrom] = React.useState<string | null>(null);
  React.useEffect(() => {
    const take = () => {
      if (!arriving || arriving.id !== id) return;
      const box = arriving.from;
      arriving = null;
      setFrom(box);
    };
    arrivers.add(take);
    take();
    return () => { arrivers.delete(take); };
  }, [id]);
  return from;
}

void BASE_ZOOM;
