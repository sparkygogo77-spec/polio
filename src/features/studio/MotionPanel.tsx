"use client";
/**
 * The crate — frame interpolation, on the left.
 *
 * Five sleeves. Drop a picture in each, and the Builder fills in every frame
 * between them: it holds each keyframe for a beat, then eases from one to the
 * next across the gap, on the timing the panel says. That is real
 * interpolation, running here, at the frame rate you chose — you can scrub it,
 * play it, and take it away as a sprite sheet or a WebM.
 *
 * It is a cross-dissolve, and it says so. A dissolve is exactly right for a
 * fade, a colour turn, a light coming up; it is not what a shape morphing
 * along its shortest path looks like. So the same panel writes the brief
 * (`motionBrief`) that tells a generator what the in-betweens ought to be, on
 * the identical timing — the Builder's own pass is the floor, the brief is the
 * ceiling, and both go into the blueprint.
 *
 * Everything is drawn to one canvas so nothing is stored twice: the frames are
 * computed, never kept.
 */
import * as React from "react";
import { useShallow } from "zustand/react/shallow";
import { ChevronLeft, ChevronRight, ClipboardCopy, Download, Film, Pause, Play, Plus, Trash2, X } from "lucide-react";
import { useStudio } from "./store";
import {
  filled, gapCount, motionBrief, planFrames, playOrder, SLEEVES, totalFrames,
  type MotionAsset, type MotionEase, type MotionLoop,
} from "./motion";
import { ImageWell } from "./ImageIntake";
import { cn } from "@/core/lib/cn";
import { play } from "@/core/audio/engine";
import { Button } from "@/core/ui/button";
import { Input } from "@/core/ui/input";
import { Select } from "@/core/ui/select";
import { Slider } from "@/core/ui/slider";
import { Segmented } from "@/core/ui/segmented";
import { Tooltip } from "@/core/ui/tooltip";

/* ------------------------------------------------------------------ */
/* Drawing one frame                                                   */
/* ------------------------------------------------------------------ */

/** Keep loaded keyframes around; a rAF loop cannot wait on an `onload`. */
function useImages(srcs: (string | null)[]) {
  const [images, setImages] = React.useState<(HTMLImageElement | null)[]>([]);
  React.useEffect(() => {
    let live = true;
    const out: (HTMLImageElement | null)[] = srcs.map(() => null);
    let left = srcs.filter(Boolean).length;
    if (!left) { setImages(out); return; }
    srcs.forEach((src, i) => {
      if (!src) return;
      const img = new Image();
      img.onload = img.onerror = () => {
        out[i] = img.naturalWidth ? img : null;
        if (--left === 0 && live) setImages([...out]);
      };
      img.src = src;
    });
    return () => { live = false; };
  }, [srcs]);
  return images;
}

/** Contain: the whole keyframe, centred, never cropped. */
function drawFitted(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, alpha: number) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
}

/* ------------------------------------------------------------------ */
/* The panel                                                           */
/* ------------------------------------------------------------------ */

export function MotionPanel() {
  const assets = useStudio(useShallow((s) => s.motion));
  const [openId, setOpenId] = React.useState<string | null>(null);
  const asset = assets.find((a) => a.id === openId) ?? assets[0] ?? null;

  return (
    <div data-motion-panel="" className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-fg">Frame interpolation</span>
        <Button
          size="xs"
          variant="outline"
          onClick={() => { play("confirm"); setOpenId(useStudio.getState().addMotion()); }}
        >
          <Plus />
          Crate
        </Button>
      </div>

      {assets.length > 1 ? (
        <div className="flex flex-wrap gap-1">
          {assets.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpenId(a.id)}
              aria-pressed={a.id === asset?.id}
              className={cn(
                "tactile rounded-full border px-2 py-0.5 text-[10px]",
                a.id === asset?.id ? "border-accent/60 bg-accent-soft text-accent" : "border-border text-fg-muted hover:text-fg",
              )}
            >
              {a.name}
            </button>
          ))}
        </div>
      ) : null}

      {asset ? (
        <Crate key={asset.id} asset={asset} />
      ) : (
        <p className="rounded-md border border-dashed border-border p-3 text-[10px] leading-snug text-fg-muted">
          A crate holds five keyframes. Drop a picture in each sleeve and the Builder works out every
          frame in between, 45 of them in a second and a half, which you can scrub, play, and take
          away as a sprite sheet. The brief that goes with it tells whoever renders it properly what
          the in-betweens have to look like.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* One crate                                                           */
/* ------------------------------------------------------------------ */

function Crate({ asset }: { asset: MotionAsset }) {
  const s = () => useStudio.getState();
  const images = useImages(asset.frames);
  const keys = React.useMemo(() => filled(asset), [asset]);
  const plan = React.useMemo(() => playOrder(asset, planFrames(asset)), [asset]);
  const ready = keys.length >= 2;

  const [at, setAt] = React.useState(0);
  const [playing, setPlaying] = React.useState(false);
  const canvas = React.useRef<HTMLCanvasElement>(null);
  const [note, setNote] = React.useState<string | null>(null);

  // Keep the cursor inside the sequence when the plan gets shorter.
  React.useEffect(() => { setAt((n) => (plan.length ? Math.min(n, plan.length - 1) : 0)); }, [plan.length]);

  /* ------------------------------------------------------------ drawing */
  const paint = React.useCallback((index: number) => {
    const el = canvas.current;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    const w = el.width;
    const h = el.height;
    ctx.clearRect(0, 0, w, h);
    const step = plan[index];
    if (!step) return;
    const a = images[keys[step.from]?.at ?? -1] ?? null;
    const b = images[keys[step.to]?.at ?? -1] ?? null;
    // The in-between: the frame it is leaving, fading out under the frame it
    // is arriving at. At t = 0 that is the keyframe itself, exactly.
    if (a) drawFitted(ctx, a, w, h, 1);
    if (b && step.t > 0) drawFitted(ctx, b, w, h, step.t);
  }, [images, keys, plan]);

  React.useEffect(() => { paint(at); }, [paint, at]);

  /* ---------------------------------------------------------- playback */
  React.useEffect(() => {
    if (!playing || !ready || !plan.length) return;
    let raf = 0;
    let last = performance.now();
    let cursor = at;
    const step = 1000 / Math.max(1, asset.fps);
    const tick = (now: number) => {
      if (now - last >= step) {
        last = now;
        cursor = (cursor + 1) % plan.length;
        setAt(cursor);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // `at` is deliberately not a dependency: it would restart the loop every
    // frame. Playback picks up wherever the scrubber left it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, ready, plan.length, asset.fps]);

  /* ------------------------------------------------------------ taking it away */
  const sheet = async () => {
    const el = canvas.current;
    if (!el || !plan.length) return;
    const w = el.width;
    const h = el.height;
    const out = document.createElement("canvas");
    out.width = w * plan.length;
    out.height = h;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    for (let i = 0; i < plan.length; i++) {
      paint(i);
      ctx.drawImage(el, i * w, 0);
    }
    paint(at);
    out.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${asset.name.replace(/\s+/g, "-").toLowerCase()}-sprite.png`;
      a.click();
      URL.revokeObjectURL(url);
      setNote(`${plan.length} frames, one row.`);
    }, "image/png");
  };

  const webm = async () => {
    const el = canvas.current;
    if (!el || !plan.length || typeof MediaRecorder === "undefined") return;
    setNote("Recording…");
    const stream = el.captureStream(asset.fps);
    const type = ["video/webm;codecs=vp9", "video/webm"].find((t) => MediaRecorder.isTypeSupported(t));
    const rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const done = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
    rec.start();
    // Walk the sequence in real time so the recording is the sequence.
    for (let i = 0; i < plan.length; i++) {
      paint(i);
      await new Promise((r) => setTimeout(r, 1000 / asset.fps));
    }
    rec.stop();
    await done;
    paint(at);
    const blob = new Blob(chunks, { type: chunks[0]?.type || "video/webm" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${asset.name.replace(/\s+/g, "-").toLowerCase()}.webm`;
    a.click();
    URL.revokeObjectURL(url);
    setNote(`${(blob.size / 1024).toFixed(0)} KB of WebM.`);
  };

  const copyBrief = async () => {
    const el = canvas.current;
    try {
      await navigator.clipboard.writeText(motionBrief(asset, el ? { w: el.width, h: el.height } : undefined));
      setNote("The brief is on the clipboard.");
      play("confirm");
    } catch {
      setNote("Could not reach the clipboard.");
    }
  };

  const gaps = gapCount(asset);
  const step = plan[at];

  return (
    <div className="space-y-2 rounded-md border border-border p-2">
      <div className="flex items-center gap-1">
        <Input
          inputSize="sm"
          value={asset.name}
          onChange={(e) => s().updateMotion(asset.id, { name: e.target.value })}
          aria-label="Motion name"
        />
        <Button variant="ghost" size="iconXs" aria-label="Remove this crate" onClick={() => s().removeMotion(asset.id)}>
          <Trash2 />
        </Button>
      </div>

      {/* ------------------------------------------------------ the sleeves */}
      <div className="grid grid-cols-5 gap-1">
        {Array.from({ length: SLEEVES }, (_, i) => (
          <Sleeve key={i} asset={asset} at={i} live={keys.some((k) => k.at === i)} />
        ))}
      </div>

      {/* ------------------------------------------------------ the result */}
      <div className="space-y-1 rounded-md border border-border bg-elevated/50 p-1.5">
        <canvas
          ref={canvas}
          width={264}
          height={148}
          data-motion-canvas=""
          className="w-full rounded-sm"
          style={{ background: "var(--bg)", imageRendering: "auto" }}
        />
        {ready ? (
          <>
            <div className="flex items-center gap-1.5">
              <Button
                size="iconXs"
                variant="ghost"
                aria-label={playing ? "Pause" : "Play the sequence"}
                onClick={() => { play("tap"); setPlaying((v) => !v); }}
              >
                {playing ? <Pause /> : <Play />}
              </Button>
              <div className="min-w-0 flex-1">
                <Slider
                  value={[at]}
                  min={0}
                  max={Math.max(0, plan.length - 1)}
                  step={1}
                  onValueChange={(v) => { setPlaying(false); setAt(v[0] ?? 0); }}
                  aria-label="Scrub the sequence"
                />
              </div>
              <span className="num shrink-0 text-[10px] text-fg-muted">
                {at + 1}/{plan.length}
              </span>
            </div>
            <p className="text-[9px] leading-snug text-fg-faint">
              {step?.holding
                ? `Holding keyframe ${(step.from ?? 0) + 1}`
                : `Between ${(step?.from ?? 0) + 1} and ${(step?.to ?? 0) + 1}, ${Math.round((step?.t ?? 0) * 100)}% across`}
              {" · "}
              {totalFrames(asset)} frames at {asset.fps} fps
            </p>
          </>
        ) : (
          <p className="p-1 text-[10px] leading-snug text-fg-muted">
            Two sleeves filled and it starts moving.
          </p>
        )}
      </div>

      {/* ------------------------------------------------------ the timing */}
      <Row label="Length" value={`${asset.duration.toFixed(1)}s`}>
        <Slider
          value={[Math.round(asset.duration * 10)]}
          min={4}
          max={60}
          step={1}
          onValueChange={(v) => s().updateMotion(asset.id, { duration: (v[0] ?? 15) / 10 })}
        />
      </Row>
      <div className="flex items-center gap-1">
        <Segmented
          className="flex-1 [&>*]:flex-1"
          size="xs"
          value={String(asset.fps)}
          onChange={(v) => s().updateMotion(asset.id, { fps: Number(v) })}
          options={[{ value: "30", label: "30 fps" }, { value: "60", label: "60 fps" }]}
          aria-label="Frame rate"
        />
        <Select
          className="w-28"
          value={asset.loop}
          onChange={(v) => s().updateMotion(asset.id, { loop: v as MotionLoop })}
          options={[
            { value: "wrap", label: "Wrap" },
            { value: "ping-pong", label: "Ping-pong" },
            { value: "once", label: "Once" },
          ]}
          aria-label="Loop"
        />
      </div>
      <Row label="Hold each keyframe" value={`${asset.hold} frames`}>
        <Slider
          value={[asset.hold]}
          min={0}
          max={8}
          step={1}
          onValueChange={(v) => s().updateMotion(asset.id, { hold: v[0] ?? 2 })}
        />
      </Row>
      <Select
        className="w-full"
        value={asset.ease}
        onChange={(v) => s().updateMotion(asset.id, { ease: v as MotionEase })}
        options={[{ value: "ease", label: "Ease in and out of each gap" }, { value: "linear", label: "Linear, no easing" }]}
        aria-label="Easing"
      />

      {/* --------------------------------------------------------- the gaps */}
      {gaps > 0 ? (
        <div className="space-y-1 rounded-md border border-border p-1.5">
          <div className="text-[10px] font-medium uppercase tracking-wider text-fg-faint">Gaps</div>
          <p className="text-[9px] leading-snug text-fg-faint">
            How long each one takes, next to the others. Turn one up and the motion lingers there.
          </p>
          {Array.from({ length: gaps }, (_, i) => (
            <Row key={i} label={`${i + 1} → ${((i + 1) % keys.length) + 1}`} value={`×${(asset.gaps[i] ?? 1).toFixed(1)}`}>
              <Slider
                value={[Math.round((asset.gaps[i] ?? 1) * 10)]}
                min={2}
                max={40}
                step={1}
                onValueChange={(v) => {
                  const gapsNext = [...asset.gaps];
                  gapsNext[i] = (v[0] ?? 10) / 10;
                  s().updateMotion(asset.id, { gaps: gapsNext });
                }}
              />
            </Row>
          ))}
        </div>
      ) : null}

      <Input
        inputSize="sm"
        value={asset.use}
        onChange={(e) => s().updateMotion(asset.id, { use: e.target.value })}
        aria-label="Used as"
        placeholder="background layer, hero visual, button hover…"
      />

      {/* -------------------------------------------------- taking it away */}
      <div className="flex flex-wrap gap-1">
        <Tooltip content="Every frame in one row, as a PNG." side="top">
          <Button size="xs" variant="outline" disabled={!ready} onClick={() => void sheet()}>
            <Download />
            Sprite sheet
          </Button>
        </Tooltip>
        <Tooltip content="The sequence, recorded from the canvas at its own frame rate." side="top">
          <Button size="xs" variant="outline" disabled={!ready} onClick={() => void webm()}>
            <Film />
            WebM
          </Button>
        </Tooltip>
        <Tooltip content="What a generator needs to render these in-betweens properly, on this exact timing." side="top">
          <Button size="xs" variant="outline" onClick={() => void copyBrief()}>
            <ClipboardCopy />
            Brief
          </Button>
        </Tooltip>
      </div>
      {note ? <p className="text-[9px] text-fg-muted">{note}</p> : null}
      <p className="text-[9px] leading-snug text-fg-faint">
        The Builder dissolves between your keyframes on this timing. That is exactly right for a fade
        or a colour turn, and a floor for anything that has to morph, the brief carries the timing
        over to whoever renders those frames properly.
      </p>
    </div>
  );
}

/** One sleeve: a picture, or a place for one. */
function Sleeve({ asset, at, live }: { asset: MotionAsset; at: number; live: boolean }) {
  const s = () => useStudio.getState();
  return (
    <div className="group/sleeve space-y-0.5">
      <ImageWell
        compact
        src={asset.frames[at]}
        label={`frame ${at + 1}`}
        onImage={(src) => s().setMotionFrame(asset.id, at, src)}
      />
      <div className="flex items-center justify-between gap-0.5">
        <span className={cn("num shrink-0 text-[9px]", live ? "text-accent" : "text-fg-faint")}>{at + 1}</span>
        <span className="flex shrink-0 opacity-0 transition-opacity group-hover/sleeve:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            aria-label={`Move frame ${at + 1} earlier`}
            disabled={at === 0}
            onClick={() => s().moveMotionFrame(asset.id, at, -1)}
            className="tactile rounded-sm p-0.5 text-fg-faint hover:text-fg disabled:opacity-30"
          >
            <ChevronLeft className="size-3" />
          </button>
          <button
            type="button"
            aria-label={`Move frame ${at + 1} later`}
            disabled={at === SLEEVES - 1}
            onClick={() => s().moveMotionFrame(asset.id, at, 1)}
            className="tactile rounded-sm p-0.5 text-fg-faint hover:text-fg disabled:opacity-30"
          >
            <ChevronRight className="size-3" />
          </button>
          {asset.frames[at] ? (
            <button
              type="button"
              aria-label={`Empty sleeve ${at + 1}`}
              onClick={() => s().setMotionFrame(asset.id, at, null)}
              className="tactile rounded-sm p-0.5 text-fg-faint hover:text-fg"
            >
              <X className="size-3" />
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

function Row({ label, value, children }: { label: string; value?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between">
        <label className="text-[10px] text-fg-muted">{label}</label>
        {value ? <span className="num text-[10px] text-fg-faint">{value}</span> : null}
      </div>
      {children}
    </div>
  );
}
