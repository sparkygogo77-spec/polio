"use client";
/**
 * A recorded video turned into a GIF in the browser, so a tab recording can
 * go to X without a server.
 *
 * Two passes through the video. The first, fast, only samples colours for
 * the palette; the second, at real speed, draws each frame to a canvas,
 * quantises it on the spot and hands the indices to the writer, so nothing
 * bigger than one frame is ever held. MediaRecorder's WebM does not know
 * its own length until it has been played to the end, hence the seek to
 * nowhere before the first pass.
 */
import { buildPalette, GifWriter, samplePixels } from "./gif";

export interface VideoToGifOptions {
  fps: number;
  maxWidth: number;
  /** Frames are thinned to stay under this; the GIF keeps its length. */
  maxFrames?: number;
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

const once = (el: EventTarget, ev: string, ms: number) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(done, ms);
    function done() { clearTimeout(t); el.removeEventListener(ev, done); resolve(); }
    el.addEventListener(ev, done, { once: true });
  });

type FrameCallbackVideo = HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number };

/** Play the video through once, calling `onFrame` as each frame is shown. */
async function playThrough(video: FrameCallbackVideo, rate: number, signal: AbortSignal | undefined, onFrame: (t: number) => boolean | void) {
  video.currentTime = 0;
  await once(video, "seeked", 1500);
  video.playbackRate = rate;
  await new Promise<void>((resolve, reject) => {
    let stopped = false;
    const finish = () => { if (!stopped) { stopped = true; video.pause(); resolve(); } };
    const tick = () => {
      if (stopped) return;
      if (signal?.aborted) { stopped = true; video.pause(); reject(new DOMException("aborted", "AbortError")); return; }
      if (onFrame(video.currentTime) === false || video.ended) return finish();
      if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(tick); else requestAnimationFrame(tick);
    };
    video.addEventListener("ended", finish, { once: true });
    video.play().then(tick, reject);
  });
}

export async function videoToGif(blob: Blob, opts: VideoToGifOptions): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video") as FrameCallbackVideo;
  try {
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("The browser could not read this video."));
    });
    if (!Number.isFinite(video.duration) || video.duration === 0) {
      video.currentTime = 1e101;
      await once(video, "timeupdate", 4000);
      video.currentTime = 0;
      await once(video, "seeked", 1500);
    }
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (!video.videoWidth) throw new Error("The video has no picture.");
    const scale = Math.min(1, opts.maxWidth / video.videoWidth);
    const w = Math.max(2, Math.round(video.videoWidth * scale)) & ~1;
    const h = Math.max(2, Math.round(video.videoHeight * scale)) & ~1;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("No canvas to draw on.");
    const grab = () => { ctx.drawImage(video, 0, 0, w, h); return ctx.getImageData(0, 0, w, h).data; };

    // Pass one, fast: colours for the palette.
    const samples: number[] = [];
    let lastSampleAt = -1;
    await playThrough(video, 4, opts.signal, (t) => {
      if (t - lastSampleAt >= 0.25) { lastSampleAt = t; samplePixels({ data: grab(), stride: 4 }, 3000, samples); }
      opts.onProgress?.(duration ? Math.min(0.2, (0.2 * t) / duration) : 0.1);
    });
    if (!samples.length) samplePixels({ data: grab(), stride: 4 }, 4000, samples);
    const palette = buildPalette(samples);

    // Pass two, real speed: every frame, straight into the file.
    const maxFrames = opts.maxFrames ?? 360;
    const fps = duration ? Math.max(4, Math.min(opts.fps, maxFrames / duration)) : opts.fps;
    const step = 1 / fps;
    const writer = new GifWriter(w, h, palette, { delayMs: 1000 / fps });
    let nextAt = 0;
    await playThrough(video, 1, opts.signal, (t) => {
      if (t + 1e-3 >= nextAt) {
        writer.addFrame(writer.quantise({ data: grab(), stride: 4 }));
        nextAt = Math.floor(t / step) * step + step;
        opts.onProgress?.(duration ? 0.2 + Math.min(0.78, (0.78 * t) / duration) : 0.5);
      }
      if (writer.frameCount >= maxFrames) return false;
    });
    if (!writer.frameCount) writer.addFrame(writer.quantise({ data: grab(), stride: 4 }));
    opts.onProgress?.(1);
    const bytes = writer.finish();
    return new Blob([bytes.buffer as ArrayBuffer], { type: "image/gif" });
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
