"use client";
/**
 * The tour: the site worked through on its own, the way a person would.
 *
 * The console shows the site in an iframe of the device's real size (the
 * same preview route the Builder uses, same origin, in its Window view, so
 * the page is laid out exactly as the published page is at that width) and
 * scales the whole frame down to fit its box. Then it drives it:
 *
 *   · a site with things to do gets them done in page order: each tab of a
 *     tab strip, a menu or a row that opens, a copy-address button, a chart
 *     swept with the pointer, a button that changes the page. A ring shows
 *     where each press lands, so a clip reads without a cursor.
 *   · nothing that connects a wallet, signs in, buys, sends a form or writes
 *     to a server is ever pressed (`tourRules.ts`, `refusal`), and nothing
 *     leaves the page: links are held where they are, forms do not submit,
 *     and the frame cannot open a window.
 *   · a site with nothing to do is scrolled down to the stop.
 *
 * It fits itself to a clip length: presses are watched a while each, the
 * scroll takes what is left, and the end is waited out, so the tour lasts
 * the length asked (`timing`). Recording is the person's own browser
 * capturing this tab, cut to the frame where the browser can, stopped at the
 * clip length. `tests/tweet-tour.mjs`.
 */
import { refusal, stopY as stopAtY, timing, CLIP_MAX_S, CLIP_MIN_S, LEAD_MS, type ControlFacts, type StepKind, type StopAt } from "./tourRules";

export interface TourOptions {
  /** How long the clip is, in seconds: the tour fits itself to it. */
  seconds: number;
  /** How far down the page to go before ending. */
  stopAt: StopAt;
  /** Press what the page offers; off, it only scrolls. */
  interact: boolean;
  /** A part's catalogue id, by its id: tells a chart from a picture. */
  featureOf?: (nodeId: string) => string | undefined;
  signal?: AbortSignal;
  onProgress?: (fraction: number) => void;
}

/** What a tour did, for the console's line under the frame and for the checks. */
export interface TourRun {
  /** What it pressed, in order, as "tab: Roadmap". */
  pressed: string[];
  /** Controls it saw and would not press, with why: a few, for the record. */
  refused: string[];
  /** Planned steps it had no time for. */
  dropped: number;
  /** Where it stopped, and how far it was asked to go. */
  endY: number;
  stopY: number;
  /** How long it took, in milliseconds. */
  ms: number;
}

/**
 * Hides the app round the live site inside the frame: its top bar, its side
 * bar, the preview's own toolbar. Only those, by their own marks: this used
 * to hide every `header` and `footer`, which took the site's own header and
 * footer off the page and left the tour showing a site that was not the one
 * built.
 */
export const HIDE_CHROME_CSS = `
  [data-app-topbar], [data-app-sidebar], [data-live-bar] { display: none !important; }
  [data-live-column] { height: 100dvh !important; }
  [data-live-scroller] { scrollbar-width: none !important; }
  [data-live-scroller]::-webkit-scrollbar { display: none !important; }
`;

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (ms <= 0) return resolve();
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new DOMException("aborted", "AbortError")); }, { once: true });
  });

/** Put the chrome-hiding style into the frame's document, once, and hold every way out of the page. */
export function prepareFrame(doc: Document) {
  if (doc.getElementById("tweets-tour-css")) return;
  const style = doc.createElement("style");
  style.id = "tweets-tour-css";
  style.textContent = HIDE_CHROME_CSS;
  doc.head.appendChild(style);
  /* THE TOUR NEVER LEAVES THE SITE. A link that goes anywhere but a place on this page is held; a form is not sent; no window opens. */
  doc.addEventListener("click", (e) => {
    const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
    const href = a?.getAttribute("href") ?? "";
    if (a && !href.startsWith("#")) e.preventDefault();
  }, true);
  doc.addEventListener("submit", (e) => e.preventDefault(), true);
  const win = doc.defaultView as (Window & { open: unknown }) | null;
  if (win) win.open = () => null;
  /* A copy pressed by the tour copies nothing: the person's clipboard is theirs, and a frame without focus is refused anyway. */
  const clip = win?.navigator?.clipboard as (Clipboard & { writeText: unknown; write: unknown }) | undefined;
  if (clip) {
    try { Object.defineProperty(clip, "writeText", { value: () => Promise.resolve(), configurable: true }); } catch { /* left as it is */ }
    try { Object.defineProperty(clip, "write", { value: () => Promise.resolve(), configurable: true }); } catch { /* left as it is */ }
  }
}

/** Wait for the preview to be up inside the frame. */
export async function waitForFrame(iframe: HTMLIFrameElement, signal?: AbortSignal, timeoutMs = 15_000): Promise<{ doc: Document; scroller: HTMLElement }> {
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

/**
 * The page as it is published: the preview's Window view, 1:1 at the
 * frame's own size. The frame is sized to the device, so this is the site
 * at that device's width, exactly as a visitor's browser lays it out.
 */
export function setFrameWindow(iframe: HTMLIFrameElement) {
  const w = iframe.contentWindow as (Window & { __studioLiveDevice?: (d: string) => void }) | null;
  w?.__studioLiveDevice?.("window");
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

async function glide(scroller: HTMLElement, to: number, ms: number, signal: AbortSignal | undefined, deadline: number) {
  const from = scroller.scrollTop;
  const span = Math.max(0, Math.min(ms, deadline - performance.now()));
  if (span < 16 || Math.abs(to - from) < 1) { scroller.scrollTop = to; return; }
  const t0 = performance.now();
  await new Promise<void>((resolve, reject) => {
    const step = (now: number) => {
      if (signal?.aborted) return reject(new DOMException("aborted", "AbortError"));
      const t = Math.min(1, (now - t0) / span);
      scroller.scrollTop = from + (to - from) * ease(t);
      if (t < 1) requestAnimationFrame(step); else resolve();
    };
    requestAnimationFrame(step);
  });
}

/* ------------------------------------------------------------------ */
/* Reading what a page offers                                           */
/* ------------------------------------------------------------------ */

interface Step { kind: StepKind; el: HTMLElement; label: string; closeAfter?: boolean }

const wordsOf = (el: HTMLElement) =>
  [el.innerText, el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("name"), (el as HTMLInputElement).value, el.getAttribute("data-action")]
    .filter(Boolean).join(" ").replace(/\s+/g, " ").trim();

function factsOf(el: HTMLElement): ControlFacts {
  return {
    tag: el.tagName.toLowerCase(),
    type: el.getAttribute("type"),
    role: el.getAttribute("role"),
    words: wordsOf(el),
    href: el.getAttribute("href"),
    target: el.getAttribute("target"),
    inForm: !!el.closest("form"),
    disabled: (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true",
  };
}

const short = (s: string) => (s.length > 40 ? `${s.slice(0, 39)}…` : s) || "unnamed";

/** Where an element sits in the scrolled page, from the top of the content. */
function yIn(scroller: HTMLElement, el: Element): { top: number; h: number } {
  const r = el.getBoundingClientRect();
  const s = scroller.getBoundingClientRect();
  return { top: r.top - s.top + scroller.scrollTop, h: r.height };
}
const shown = (el: Element) => { const r = el.getBoundingClientRect(); return r.width > 2 && r.height > 2; };

/**
 * Everything worth pressing on the page, in page order, and what was turned
 * down. Tabs of one strip stay together, the selected one last so the strip
 * ends where it began; a menu that opens is closed again after it is seen.
 */
export function planSteps(doc: Document, scroller: HTMLElement, opts: { interact: boolean; stopY: number; featureOf?: (id: string) => string | undefined }): { steps: Step[]; refused: string[] } {
  const refused: string[] = [];
  if (!opts.interact) return { steps: [], refused };
  const view = scroller.clientHeight;
  const reachable = (el: Element) => { const { top, h } = yIn(scroller, el); return top + h / 2 <= opts.stopY + view - 8; };
  const taken = new Set<Element>();
  const out: (Step & { y: number })[] = [];
  const allow = (el: HTMLElement): boolean => {
    if (taken.has(el) || !shown(el) || !reachable(el)) return false;
    const no = refusal(factsOf(el));
    if (no) { if (refused.length < 12) refused.push(`${short(wordsOf(el))}: ${no}`); taken.add(el); return false; }
    return true;
  };
  const add = (kind: StepKind, el: HTMLElement, label: string, closeAfter?: boolean) => { taken.add(el); out.push({ kind, el, label, closeAfter, y: yIn(scroller, el).top }); };

  /* Tab strips: every tab, the one already showing last. */
  const strips = new Map<Element, HTMLElement[]>();
  for (const t of doc.querySelectorAll<HTMLElement>('[role="tab"]')) {
    const strip = t.closest('[role="tablist"]') ?? t.parentElement ?? doc.body;
    strips.set(strip, [...(strips.get(strip) ?? []), t]);
  }
  for (const tabs of strips.values()) {
    if (tabs.length < 2) continue;
    const on = tabs.find((t) => t.getAttribute("aria-selected") === "true") ?? tabs[0]!;
    const order = [...tabs.filter((t) => t !== on).slice(0, 4), on];
    for (const t of order) if (allow(t)) add("tab", t, `tab: ${short(wordsOf(t))}`);
  }
  /* Menus and rows that open. */
  let opens = 0;
  for (const el of doc.querySelectorAll<HTMLElement>('[aria-expanded="false"]')) {
    if (opens >= 3) break;
    if (el.getAttribute("role") === "tab") continue;
    if (allow(el)) { add("open", el, `open: ${short(wordsOf(el))}`, !!el.getAttribute("aria-haspopup")); opens++; }
  }
  /* A chart: swept with the pointer, so its readouts show. */
  let charts = 0;
  for (const el of doc.querySelectorAll<HTMLElement>("svg, canvas")) {
    if (charts >= 2) break;
    const r = el.getBoundingClientRect();
    if (r.width < 160 || r.height < 80) continue;
    const node = el.closest("[data-live-node]");
    const feature = node ? opts.featureOf?.(node.getAttribute("data-live-node") ?? "") ?? "" : "";
    const says = `${feature} ${el.getAttribute("aria-label") ?? ""} ${el.getAttribute("class") ?? ""}`;
    if (!/chart|graph|candle|spark|price|ticker|plot/i.test(says)) continue;
    if (taken.has(el) || !reachable(el)) continue;
    add("chart", el as unknown as HTMLElement, `chart: ${short(feature || "chart")}`);
    charts++;
  }
  /* Copy buttons, then the page's other buttons, a few. */
  const buttons = [...doc.querySelectorAll<HTMLElement>('button, [role="button"], a[role="button"]')].filter((b) => !b.closest('[role="tablist"]'));
  let copies = 0;
  for (const b of buttons) {
    if (copies >= 2) break;
    if (/\bcopy\b/i.test(wordsOf(b)) && allow(b)) { add("copy", b, `copy: ${short(wordsOf(b))}`); copies++; }
  }
  let plain = 0;
  for (const b of buttons) {
    if (plain >= 4) break;
    if (b.closest("[data-live-node]") === null) continue;
    /* A row or menu already open is not pressed: that would close what the page shows. Closed ones were taken above. */
    if (b.hasAttribute("aria-expanded")) continue;
    if (allow(b)) { add("button", b, `button: ${short(wordsOf(b))}`); plain++; }
  }
  /* Page order; a strip's tabs stay in the order they were planned. */
  const firstOf = new Map<Element, number>();
  for (const st of out) if (st.kind === "tab") { const k = st.el.closest('[role="tablist"]') ?? st.el.parentElement!; if (!firstOf.has(k)) firstOf.set(k, st.y); }
  const keyOf = (st: Step & { y: number }) => (st.kind === "tab" ? firstOf.get(st.el.closest('[role="tablist"]') ?? st.el.parentElement!) ?? st.y : st.y);
  const steps = out.map((st, i) => ({ st, i })).sort((a, b) => keyOf(a.st) - keyOf(b.st) || a.i - b.i).map(({ st }) => st).slice(0, 12);
  return { steps, refused };
}

/* ------------------------------------------------------------------ */
/* The ring that shows where a press lands                              */
/* ------------------------------------------------------------------ */

function ringIn(doc: Document): HTMLElement {
  let ring = doc.getElementById("tweets-tour-ring");
  if (ring) return ring;
  ring = doc.createElement("div");
  ring.id = "tweets-tour-ring";
  ring.setAttribute("aria-hidden", "true");
  Object.assign(ring.style, {
    position: "fixed", left: "0", top: "0", width: "34px", height: "34px", marginLeft: "-17px", marginTop: "-17px",
    borderRadius: "999px", border: "3px solid rgba(255,255,255,0.95)", boxShadow: "0 0 0 3px rgba(0,0,0,0.45), 0 0 18px rgba(255,255,255,0.5)",
    pointerEvents: "none", zIndex: "2147483647", opacity: "0", transition: "transform 380ms cubic-bezier(.2,.8,.2,1), opacity 200ms",
  } as CSSStyleDeclaration);
  doc.body.appendChild(ring);
  return ring;
}
function ringTo(doc: Document, el: Element, pulse: boolean) {
  const ring = ringIn(doc);
  const r = el.getBoundingClientRect();
  ring.style.opacity = "1";
  ring.style.transform = `translate(${Math.round(r.left + r.width / 2)}px, ${Math.round(r.top + r.height / 2)}px) scale(${pulse ? 0.7 : 1})`;
}

/** A press as a hand makes one: the pointer arrives, goes down, comes up, and the click lands. */
function press(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  const at = { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, view: el.ownerDocument.defaultView } as MouseEventInit;
  const P = el.ownerDocument.defaultView?.PointerEvent ?? PointerEvent;
  el.dispatchEvent(new P("pointerover", at));
  el.dispatchEvent(new P("pointerdown", { ...at, pointerId: 1, isPrimary: true } as PointerEventInit));
  el.dispatchEvent(new MouseEvent("mousedown", at));
  el.dispatchEvent(new P("pointerup", { ...at, pointerId: 1, isPrimary: true } as PointerEventInit));
  el.dispatchEvent(new MouseEvent("mouseup", at));
  el.click();
}

async function sweep(el: Element, ms: number, signal?: AbortSignal) {
  const doc = el.ownerDocument;
  const r = el.getBoundingClientRect();
  const ring = ringIn(doc);
  const t0 = performance.now();
  while (performance.now() - t0 < ms) {
    signal?.throwIfAborted();
    const t = (performance.now() - t0) / ms;
    const x = r.left + r.width * (0.08 + 0.84 * t);
    const y = r.top + r.height * 0.5;
    ring.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) scale(0.6)`;
    const at = { bubbles: true, clientX: x, clientY: y, view: doc.defaultView } as MouseEventInit;
    const target = doc.elementFromPoint(x, y) ?? el;
    target.dispatchEvent(new (doc.defaultView?.PointerEvent ?? PointerEvent)("pointermove", at));
    target.dispatchEvent(new MouseEvent("mousemove", at));
    await sleep(60, signal);
  }
  el.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
}

/* ------------------------------------------------------------------ */
/* The tour                                                             */
/* ------------------------------------------------------------------ */

/** Clamp a clip length to what the console allows: a few seconds, up to X's own limit. */
export const clipSeconds = (s: number) => Math.min(CLIP_MAX_S, Math.max(CLIP_MIN_S, Math.round(Number(s) || 0)));

/** Run the tour once, lasting `seconds`, and say what it did. */
export async function runTour(iframe: HTMLIFrameElement, opts: TourOptions): Promise<TourRun> {
  const { doc, scroller } = await waitForFrame(iframe, opts.signal);
  const clipMs = clipSeconds(opts.seconds) * 1000;
  const t0 = performance.now();
  const deadline = t0 + clipMs;
  const tick = window.setInterval(() => opts.onProgress?.(Math.min(1, (performance.now() - t0) / clipMs)), 200);
  try {
    scroller.scrollTop = 0;
    const view = scroller.clientHeight;
    const stop = stopAtY(opts.stopAt, scroller.scrollHeight, view);
    const { steps: planned, refused } = planSteps(doc, scroller, { interact: opts.interact, stopY: stop, featureOf: opts.featureOf });
    const targetOf = (el: Element) => { const { top, h } = yIn(scroller, el); return Math.max(0, Math.min(stop, Math.round(top + h / 2 - view / 2))); };
    const ys = planned.map((st) => targetOf(st.el));
    const path = (n: number) => { let y = 0, px = 0; for (let i = 0; i < n; i++) { px += Math.abs(ys[i]! - y); y = ys[i]!; } return px + Math.abs(stop - y); };
    const plan = timing(clipMs, planned.length, path);
    const steps = planned.slice(0, plan.steps);
    const pressed: string[] = [];

    await sleep(LEAD_MS, opts.signal);
    for (const st of steps) {
      if (performance.now() >= deadline - 300) break;
      /* Read the place again: an earlier press may have opened a row above it. */
      const to = targetOf(st.el);
      await glide(scroller, to, Math.abs(to - scroller.scrollTop) * plan.msPerPx, opts.signal, deadline);
      const dwell = Math.min(plan.dwellMs, Math.max(0, deadline - performance.now() - 200));
      if (st.kind === "chart") {
        ringTo(doc, st.el, false);
        await sweep(st.el, dwell, opts.signal);
      } else {
        ringTo(doc, st.el, false);
        await sleep(Math.min(260, dwell / 4), opts.signal);
        ringTo(doc, st.el, true);
        press(st.el);
        await sleep(dwell * (st.closeAfter ? 0.6 : 1) - Math.min(260, dwell / 4), opts.signal);
        if (st.closeAfter && st.el.getAttribute("aria-expanded") === "true") { press(st.el); await sleep(dwell * 0.4, opts.signal); }
      }
      pressed.push(st.label);
    }
    const ring = doc.getElementById("tweets-tour-ring");
    if (ring) ring.style.opacity = "0";
    /* On to the stop with what is left, then the end is waited out: the tour lasts the clip. */
    const last = Math.min(stopAtY(opts.stopAt, scroller.scrollHeight, view), stop);
    await glide(scroller, last, Math.abs(last - scroller.scrollTop) * plan.msPerPx, opts.signal, deadline - 200);
    await sleep(deadline - performance.now(), opts.signal);
    const run: TourRun = { pressed, refused, dropped: planned.length - steps.length, endY: Math.round(scroller.scrollTop), stopY: stop, ms: Math.round(performance.now() - t0) };
    (window as unknown as { __tweetsTourLast?: TourRun }).__tweetsTourLast = run;
    opts.onProgress?.(1);
    return run;
  } finally {
    window.clearInterval(tick);
  }
}

/* ------------------------------------------------------------------ */
/* Recording, in the person's own browser                               */
/* ------------------------------------------------------------------ */

export interface RecordOptions extends TourOptions {
  fps: number;
  /** The element the recording is cut to, where the browser can cut one (Chrome's Region Capture). */
  cropTo?: HTMLElement | null;
  /** Called once the browser has granted the tab; the caller lifts the frame to fill the window now. */
  onStart?: () => void;
  /** A recording of this tab already granted (the publish's press asked for it): used instead of asking again. */
  stream?: MediaStream;
}

export interface Recording { blob: Blob; type: string; seconds: number; width: number; height: number; tour: TourRun | null }

/** MP4 first, because X takes it as it is; WebM where the browser records nothing else. */
export function pickMime(): string {
  const wanted = ["video/mp4;codecs=avc1.42E01E", "video/mp4;codecs=avc1", "video/mp4", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return wanted.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) ?? "";
}

/** Ask for this tab, play the tour, stop at the clip length, hand back the recording. */
export async function recordTour(iframe: HTMLIFrameElement, opts: RecordOptions): Promise<Recording> {
  if (!navigator.mediaDevices?.getDisplayMedia) throw new Error("This browser cannot record a tab. Chrome, Edge and Firefox can.");
  const constraints = {
    /* Within what X takes (1920 by 1200), so the clip never has to be made smaller after. */
    video: { frameRate: opts.fps, width: { max: 1920 }, height: { max: 1200 } },
    audio: false,
    preferCurrentTab: true,
    selfBrowserSurface: "include",
    surfaceSwitching: "exclude",
    monitorTypeSurfaces: "exclude",
  } as DisplayMediaStreamOptions;
  let stream: MediaStream;
  try {
    stream = opts.stream && opts.stream.getVideoTracks().some((t) => t.readyState === "live") ? opts.stream : await navigator.mediaDevices.getDisplayMedia(constraints);
  } catch (err) {
    throw new Error(err instanceof DOMException && err.name === "NotAllowedError" ? "Recording was not allowed: choose this tab when the browser asks, then press Record again." : `The browser would not record: ${err instanceof Error ? err.message : String(err)}`);
  }
  const track = stream.getVideoTracks()[0];
  opts.onStart?.();
  await sleep(450, opts.signal);
  /* Cut to the frame where the browser can, so nothing of the console is in the clip. */
  const CT = (globalThis as unknown as { CropTarget?: { fromElement: (el: Element) => Promise<unknown> } }).CropTarget;
  if (CT && opts.cropTo && track && "cropTo" in track) {
    try { await (track as unknown as { cropTo: (t: unknown) => Promise<void> }).cropTo(await CT.fromElement(opts.cropTo)); } catch { /* the whole tab, then */ }
  }
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6_000_000 } : undefined);
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const stopped = new Promise<void>((resolve) => { rec.onstop = () => resolve(); });
  const ended = new Promise<never>((_, reject) => track?.addEventListener("ended", () => reject(new Error("The recording was stopped from the browser's own bar."))));
  const clipMs = clipSeconds(opts.seconds) * 1000;
  const settings = track?.getSettings() ?? {};
  rec.start(250);
  const began = performance.now();
  /* The clip ends at its length whatever the tour is doing. */
  const cut = new Promise<null>((resolve) => setTimeout(() => resolve(null), clipMs));
  let tour: TourRun | null = null;
  try {
    tour = await Promise.race([runTour(iframe, { ...opts, seconds: clipMs / 1000 }), cut, ended]);
  } finally {
    if (rec.state !== "inactive") rec.stop();
    await stopped;
    stream.getTracks().forEach((t) => t.stop());
  }
  const seconds = (performance.now() - began) / 1000;
  const type = rec.mimeType || mime || "video/webm";
  return { blob: new Blob(chunks, { type }), type, seconds, width: Number(settings.width) || 0, height: Number(settings.height) || 0, tour };
}
