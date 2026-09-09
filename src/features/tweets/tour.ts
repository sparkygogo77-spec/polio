"use client";
/**
 * The tour: the live site scrolled and worked, on its own.
 *
 * The console shows the site in an iframe — the same preview route the
 * Builder uses, same origin — and drives it: scrolls it top to bottom at a
 * walking pace, and as each part comes into the middle of the view, presses
 * what it has to press. A tab strip gets its second tab and then its third;
 * a set of expanding rows opens its first; nothing that navigates is
 * touched, because the tour is of one page. Then back to the top, and round
 * again if asked.
 *
 * Recording it is the browser's own tab capture: the console asks for the
 * current tab, hides everything but the frame, plays the tour, and hands
 * back a WebM. X will not take WebM; it will take a GIF or an MP4, which is
 * what the server render makes when it can. Both are honest about which
 * they produced.
 */

export type TourSpeed = "slow" | "normal" | "fast";
export interface TourOptions {
  speed: TourSpeed;
  interact: boolean;
  loops: number;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

/** Pixels per second of scroll, by speed. */
export const SPEED_PX: Record<TourSpeed, number> = { slow: 160, normal: 300, fast: 540 };

/** Hides the shell round the live site inside the frame: top bar, status bar, the preview's own toolbar. */
export const HIDE_CHROME_CSS = `
  header, footer { display: none !important; }
  div:has(> [data-live-scroller]) > div:first-child { display: none !important; }
  div:has(> [data-live-scroller]) { height: 100dvh !important; }
  [data-live-scroller] { scrollbar-width: none !important; }
  [data-live-scroller]::-webkit-scrollbar { display: none !important; }
`;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); }, { once: true });
  });

/** Put the chrome-hiding style into the frame's document, once. */
export function prepareFrame(doc: Document) {
  if (doc.getElementById("tweets-tour-css")) return;
  const style = doc.createElement("style");
  style.id = "tweets-tour-css";
  style.textContent = HIDE_CHROME_CSS;
  doc.head.appendChild(style);
}

/** Wait for the preview to be up inside the frame. */
export async function waitForFrame(iframe: HTMLIFrameElement, signal?: AbortSignal, timeoutMs = 10_000): Promise<{ doc: Document; scroller: HTMLElement }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    signal?.throwIfAborted();
    const doc = iframe.contentDocument;
    const scroller = doc?.querySelector<HTMLElement>("[data-live-scroller]");
    if (doc && scroller && scroller.scrollHeight > 0) {
      prepareFrame(doc);
      return { doc, scroller };
    }
    await sleep(120, signal);
  }
  throw new Error("The preview did not come up in time.");
}

/** Switch the preview's device from outside, the way its own menu does. */
export function setFrameDevice(iframe: HTMLIFrameElement, device: "desktop" | "tablet" | "phone") {
  const w = iframe.contentWindow as (Window & { __studioLiveDevice?: (d: string) => void }) | null;
  w?.__studioLiveDevice?.(device);
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

async function glide(scroller: HTMLElement, from: number, to: number, pxPerSec: number, signal: AbortSignal | undefined, onStep?: (y: number) => void) {
  const dist = Math.abs(to - from);
  const ms = Math.max(200, (dist / pxPerSec) * 1000);
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const step = (now: number) => {
      if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
      const t = Math.min(1, (now - t0) / ms);
      const y = from + (to - from) * ease(t);
      scroller.scrollTop = y;
      onStep?.(y);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

/** Press what a part has to press, once, as it comes into view. */
async function work(node: HTMLElement, signal?: AbortSignal) {
  const tabs = [...node.querySelectorAll<HTMLElement>('[role="tab"]')];
  if (tabs.length > 1) {
    const order = [tabs[1], tabs[2] ?? tabs[0]].filter((t): t is HTMLElement => !!t);
    for (const t of order) { t.click(); await sleep(520, signal); }
    return;
  }
  const rows = [...node.querySelectorAll<HTMLElement>('[aria-expanded="false"]')];
  if (rows.length) {
    rows[0]!.click();
    await sleep(420, signal);
    if (rows[1]) { rows[1].click(); await sleep(420, signal); }
  }
}

/** Scroll the page through, working the parts on the way; back to the top; again if asked. */
export async function runTour(iframe: HTMLIFrameElement, opts: TourOptions): Promise<void> {
  const { doc, scroller } = await waitForFrame(iframe, opts.signal);
  const pxPerSec = SPEED_PX[opts.speed];
  const loops = Math.max(1, opts.loops);
  for (let loop = 0; loop < loops; loop++) {
    scroller.scrollTop = 0;
    await sleep(500, opts.signal);
    const travel = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const nodes = [...doc.querySelectorAll<HTMLElement>("[data-live-node]")];
    const done = new Set<HTMLElement>();
    // Scroll in stretches; stop for a part when its middle reaches the middle of the view.
    let y = 0;
    while (y < travel || (y === 0 && travel === 0)) {
      const next = opts.interact
        ? nodes
            .filter((n) => !done.has(n))
            .map((n) => ({ n, at: n.offsetTop + n.offsetHeight / 2 - scroller.clientHeight / 2 }))
            .filter((x) => x.at > y + 4)
            .sort((a, b) => a.at - b.at)[0]
        : undefined;
      const target = next ? Math.min(travel, Math.max(0, next.at)) : travel;
      await glide(scroller, y, target, pxPerSec, opts.signal, (yy) => opts.onProgress?.((loop + Math.min(1, yy / Math.max(1, travel)) * 0.85) / loops));
      y = target;
      if (next) {
        done.add(next.n);
        // Opening rows makes the page longer; the loop reads the new bottom each pass.
        await work(next.n, opts.signal);
      }
      if (travel === 0) break;
      if (y >= Math.max(0, scroller.scrollHeight - scroller.clientHeight)) break;
    }
    await sleep(700, opts.signal);
    await glide(scroller, scroller.scrollTop, 0, pxPerSec * 2.2, opts.signal, () => opts.onProgress?.((loop + 0.95) / loops));
    await sleep(400, opts.signal);
  }
  opts.onProgress?.(1);
}

export interface RecordOptions extends TourOptions {
  fps: number;
  /** Called once the browser has granted the tab; the caller hides its own chrome now. */
  onStart?: () => void;
}

/** The mime the browser will record; WebM everywhere but Safari, which offers MP4. */
function pickMime(): string {
  const wanted = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
  return wanted.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Ask for this tab, run the tour, hand back the recording. */
export async function recordTour(iframe: HTMLIFrameElement, opts: RecordOptions): Promise<Blob> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser cannot record the tab.");
  const constraints = {
    video: { frameRate: opts.fps },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  } as DisplayMediaStreamOptions;
  const stream = await navigator.mediaDevices.getDisplayMedia(constraints);
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
  const ended = new Promise<never>((_, reject) => stream.getVideoTracks()[0]?.addEventListener("ended", () => reject(new Error("The capture was stopped."))));
  opts.onStart?.();
  await sleep(400, opts.signal);
  rec.start(250);
  try {
    await Promise.race([runTour(iframe, opts), ended]);
  } finally {
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  }
  return new Blob(chunks, { type: rec.mimeType || mime || "video/webm" });
}
