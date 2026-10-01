/**
 * THE TOUR'S RULES, WITH NOTHING ELSE IN THEM.
 *
 * What a tour may press and what it never presses, how far down it goes, how
 * it spends a clip of a given length, how big a real screen is for each
 * device, and what X takes. Pure: no DOM, no React, no store, so
 * `tests/tweet-tour.mjs` reads them directly and `tour.ts` drives the page
 * with them.
 */

/** The window each device is shown in: its real width, and a screen's height. The site is drawn at this size and scaled down to fit the box. */
export const VIEWPORT = {
  desktop: { w: 1440, h: 900 },
  tablet: { w: 834, h: 1112 },
  phone: { w: 390, h: 844 },
} as const;
export type TourDevice = keyof typeof VIEWPORT;

/** How much of the box a page of this size gets: the whole page shown, never larger than itself. */
export function fitScale(box: { w: number; h: number }, device: TourDevice): number {
  const v = VIEWPORT[device];
  return Math.max(0.05, Math.min(1, box.w / v.w, box.h / v.h));
}

/*
 * NEVER PRESSED. A tour is a person looking round a site, not a person
 * using it: nothing that connects a wallet, signs anyone in, spends money,
 * or writes to a server. Read off everything a control says about itself
 * (its words, its label, its title, its name), so a control with no words
 * on it is still caught by what its label says.
 */
export const FORBIDDEN_WORDS = /\b(wallets?|connect|sign[\s-]?(in|up|out)|log[\s-]?(in|out)|login|logout|register|account|buy|purchase|checkout|cart|pay|payment|order|subscribe|donate|mint|swap|stake|deposit|withdraw|claim|bridge|trade|sell|bid|send|submit|delete|remove|save|post|publish|upload|vote|metamask|phantom|coinbase|password|e-?mail)\b/i;

/** What a control says about itself, for the rule above. */
export interface ControlFacts {
  tag: string;
  type?: string | null;
  role?: string | null;
  words: string;
  href?: string | null;
  target?: string | null;
  inForm?: boolean;
  disabled?: boolean;
}

/** Why the tour will not press this, or null when it may. */
export function refusal(c: ControlFacts): string | null {
  if (c.disabled) return "disabled";
  if (FORBIDDEN_WORDS.test(c.words)) return "says it signs in, pays, connects a wallet or writes";
  if (c.type === "submit" || (c.inForm && c.type !== "button")) return "sends a form";
  if (c.tag === "a" && ((c.role !== "tab" && c.role !== "button") || (c.href && !c.href.startsWith("#")))) return "a link: the tour never leaves the page";
  if (c.target && c.target !== "_self") return "opens somewhere else";
  if (["input", "select", "textarea"].includes(c.tag)) return "a field";
  return null;
}

/** What kind of thing a pressable control is, which decides its order and how long it is watched. */
export type StepKind = "tab" | "open" | "copy" | "button" | "chart";

/** "Stop scrolling at": how far down the page the tour goes before it ends. */
export type StopAt = "bottom" | "75" | "50" | "screens-2" | "screens-1";
export const STOP_AT: { value: StopAt; label: string }[] = [
  { value: "bottom", label: "the bottom" },
  { value: "75", label: "three quarters down" },
  { value: "50", label: "half way" },
  { value: "screens-2", label: "two screens down" },
  { value: "screens-1", label: "one screen down" },
];
/** The scroll position the tour ends at. */
export function stopY(stop: StopAt, scrollHeight: number, viewHeight: number): number {
  const max = Math.max(0, scrollHeight - viewHeight);
  switch (stop) {
    case "75": return Math.round(max * 0.75);
    case "50": return Math.round(max * 0.5);
    case "screens-2": return Math.min(max, viewHeight * 2);
    case "screens-1": return Math.min(max, viewHeight);
    default: return max;
  }
}

/** A clip is this long at the least and the most; the most is X's own limit on a video. */
export const CLIP_MIN_S = 3;
export const CLIP_MAX_S = 140;
/** A held moment at the top before anything moves, and at the end before the clip stops. */
export const LEAD_MS = 700;
export const TAIL_MS = 600;
/** How long one press is watched, at the least and the most. */
export const DWELL_MIN_MS = 900;
export const DWELL_MAX_MS = 3200;
/** The pace of a scroll between presses when there is time to spare: a person reading, not a fling. */
export const SCROLL_PX_PER_S = 420;

export interface Timing {
  /** How many of the planned steps fit. Steps past it are dropped, the last first. */
  steps: number;
  dwellMs: number;
  /** Milliseconds for each pixel of scroll. */
  msPerPx: number;
}

/**
 * Spend a clip: a lead-in, the presses, the scrolling between them and to
 * the stop, and a tail. Presses get at least `DWELL_MIN_MS` each, dropping
 * the last ones when too many are planned for the length; scrolling gets
 * what is left, at a reading pace when there is plenty. Whatever the tour
 * does not use is waited out at the end, so the clip is the length asked.
 */
export function timing(clipMs: number, steps: number, scrollPx: (stepsKept: number) => number): Timing {
  const body = Math.max(0, clipMs - LEAD_MS - TAIL_MS);
  let n = steps;
  for (;;) {
    const px = Math.max(0, scrollPx(n));
    const relaxed = (px / SCROLL_PX_PER_S) * 1000;
    /* Scrolling never takes more than half the clip when there are presses, and never less than it needs to be watchable. */
    const scrollMs = n ? Math.min(relaxed, body * 0.5) : body;
    const left = body - scrollMs;
    const dwell = n ? left / n : 0;
    if (n && dwell < DWELL_MIN_MS) { n--; continue; }
    const dwellMs = n ? Math.min(DWELL_MAX_MS, dwell) : 0;
    /* What the presses do not use goes to the scroll, slower, up to the whole body. */
    const scrollAll = n ? body - dwellMs * n : body;
    return { steps: n, dwellMs, msPerPx: px > 0 ? scrollAll / px : 0 };
  }
}

/* ------------------------------------------------------------------ */
/* What X takes                                                         */
/* ------------------------------------------------------------------ */

export const X_VIDEO = { maxBytes: 512 * 1024 * 1024, minSeconds: 0.5, maxSeconds: 140, maxW: 1920, maxH: 1200, types: ["video/mp4", "video/quicktime"] } as const;
export const X_GIF = { maxBytes: 15 * 1024 * 1024 } as const;

export interface ClipFacts { type: string; bytes: number; seconds: number; width?: number; height?: number }

/** Every reason X would refuse this clip, in plain words. Empty when it would take it. */
export function xRefuses(c: ClipFacts): string[] {
  const out: string[] = [];
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  if (c.type.startsWith("image/gif")) {
    if (c.bytes > X_GIF.maxBytes) out.push(`The GIF is ${mb(c.bytes)}; X takes GIFs up to 15 MB. Make the clip shorter, or record at Phone size.`);
    return out;
  }
  const base = c.type.split(";")[0]!.trim();
  if (!(X_VIDEO.types as readonly string[]).includes(base)) out.push(`This browser recorded ${({ "video/webm": "WebM", "video/x-matroska": "Matroska" } as Record<string, string>)[base] ?? (base.replace("video/", "").toUpperCase() || "an unknown kind of")} video, and X takes MP4 or MOV only. Press Make a GIF to turn it into one X takes, or record in a browser that records MP4 (Chrome 126 or newer).`);
  if (c.bytes > X_VIDEO.maxBytes) out.push(`The video is ${mb(c.bytes)}; X takes videos up to 512 MB.`);
  if (c.seconds > X_VIDEO.maxSeconds + 0.5) out.push(`The video is ${Math.round(c.seconds)} seconds long; X takes videos up to 140 seconds (2 minutes 20 seconds).`);
  if (c.seconds > 0 && c.seconds < X_VIDEO.minSeconds) out.push("The video is under half a second; X takes videos half a second long or more.");
  if (c.width && c.height) {
    const wide = c.width >= c.height;
    const [mw, mh] = wide ? [X_VIDEO.maxW, X_VIDEO.maxH] : [X_VIDEO.maxH, X_VIDEO.maxW];
    if (c.width > mw || c.height > mh) out.push(`The video is ${c.width} by ${c.height} pixels; X takes up to ${mw} by ${mh}. Record at a smaller size.`);
  }
  return out;
}
