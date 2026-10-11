"use client";
/**
 * The Builder's side of every server call that reads the site: screenshots
 * of its pages, Claude with the blueprint and those pictures, and the push
 * to GitHub. Each one asks first whether the server can, and says so in
 * words when it cannot, so nothing here is load-bearing.
 */
import { unmade } from "../polioMd";
import { heldKeys, useKeys, keysExist } from "@/features/keys/store";
import type { Piece } from "./threads";
import { useStudio, type Revision } from "../board/store";
import { MERGED_FILES } from "../shelf";
import { publishedHead, type SiteHead } from "../siteHead";
import { standInOn } from "../standIn";

export type AskMode = "plan" | "critique" | "expand" | "finish" | "ideas" | "ask" | "build";
export type Device = "desktop" | "tablet" | "phone";

export const MODES: { value: AskMode; label: string; verb: string; blurb: string }[] = [
  { value: "plan", label: "Plan", verb: "Generate plan", blurb: "A section-by-section build plan, in the order the canvas reads." },
  { value: "critique", label: "Critique", verb: "Critique it", blurb: "What contradicts, what is missing, what will fight." },
  { value: "expand", label: "Fill prompts", verb: "Write missing prompts", blurb: "A prompt for every part that has none, ready to paste." },
  { value: "finish", label: "Finish", verb: "What is left", blurb: "A checklist to finish the site, each item with the prompt that fixes it." },
  { value: "ideas", label: "Ideas", verb: "Give ideas", blurb: "Ten ideas for this site, placed, ranked by value against cost." },
  { value: "ask", label: "Ask", verb: "Ask Claude", blurb: "Anything, in your words, with the site as the facts." },
  { value: "build", label: "Build", verb: "Write the code", blurb: "Every file, complete, ready to publish to the repository." },
];

export interface Picture {
  data: string;
  mediaType: "image/png";
  label: string;
  /** A small data URL for the dialog to show. */
  preview: string;
  pageId: string;
}

export interface GeneratedFile {
  path: string;
  content: string;
  lang?: string;
  /** Bytes rather than words: a picture, sent base64 and committed as a file. */
  encoding?: "base64";
}

/**
 * A header carrying a key this browser holds, when it holds one and the
 * keys panel is open. Empty otherwise, and the server's own key wins regardless.
 */
export function keyHeader(): Record<string, string> {
  const held = heldKeys(["ANTHROPIC_API_KEY"]).ANTHROPIC_API_KEY;
  return held ? { "x-anthropic-key": held } : {};
}

/**
 * The same, for the renderer.
 *
 * A Replicate token is held in the same keys panel, unlocked the same way, and
 * rides with the call the same way. It is a separate function rather than a
 * second entry in the one above because the two are sent to different
 * routes: the image route has no use for a Claude key and should never be
 * handed one.
 */
export function rendererHeader(): Record<string, string> {
  const held = heldKeys(["REPLICATE_API_TOKEN"]).REPLICATE_API_TOKEN;
  return held ? { "x-replicate-key": held } : {};
}

/**
 * The same again, for GitHub.
 *
 * A publish writes to somebody's own account, so the token that does it is
 * theirs: typed into the keys panel, held in this browser, sent only to the
 * publish route, and to the deploy route, which reads a repository with it
 * before connecting Vercel to it and writes nothing. Separate from the other two for the same reason they are
 * separate from each other — a route that has no use for a key should never
 * be handed one.
 */
export function publisherHeader(): Record<string, string> {
  const held = heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
  return held ? { "x-github-token": held } : {};
}

/**
 * Where this browser stands with a Claude key: holding one and open, holding
 * one but locked, or holding none. The server's own key is invisible from
 * here and wins regardless; this is only for saying the right thing when a
 * route answers "no key".
 */
export type KeyState = "held" | "locked" | "none";

export function keyState(field = "ANTHROPIC_API_KEY"): KeyState {
  if (heldKeys([field])[field]) return "held";
  const { unlocked, values } = useKeys.getState();
  if (unlocked) return values[field] ? "held" : "none";
  return keysExist() ? "locked" : "none";
}

/**
 * What to say when a route had no key. A key that is in the keys panel but behind
 * the PIN is the common case after five quiet minutes, and "Claude isn't set
 * up" would be untrue and unhelpful; say what to press instead.
 */
/**
 * The same sentence for the renderer's token, which lives in the same keys panel
 * and is missed the same way: behind the PIN far more often than absent.
 */
export function noRendererKeyMessage(then: string): string {
  switch (keyState("REPLICATE_API_TOKEN")) {
    case "locked":
      return `Your keys are locked. Enter the PIN under the key button (⌘⇧K), or hold them for this tab instead, then try again. ${then}`;
    case "held":
      return `The Replicate token this browser holds didn't reach the server. Press Try it under the key button (⌘⇧K). ${then}`;
    default:
      return `No Replicate token yet. Paste one under the key button (⌘⇧K) and press Try it. ${then}`;
  }
}

export function noKeyMessage(then: string): string {
  switch (keyState()) {
    case "locked":
      return `Your key is locked. Enter the PIN under the key button (⌘⇧K), or hold the key for this tab instead, then try again. ${then}`;
    case "held":
      return `The key this browser holds didn't reach the server. Press Try it under the key button (⌘⇧K); if it keeps happening, put ANTHROPIC_API_KEY on the server. ${then}`;
    default:
      return `No Claude key yet. Put ANTHROPIC_API_KEY on the server, or paste one under the key button (⌘⇧K) and press Try it. ${then}`;
  }
}

/**
 * Is there a Claude key anywhere a call could use — the server's or this
 * browser's?
 *
 * Asked before a run rather than after it, so a locked keys panel is named as the
 * reason at the top of the banner instead of being guessed at from whatever
 * failed next. The server never says what its key is, only whether it has
 * one. When the question cannot be reached, the answer is yes: better to make
 * the call and hear the route's own reason than to refuse on a hunch.
 */
let serverKey: { at: number; value: boolean } | null = null;

export async function claudeReady(force = false): Promise<boolean> {
  if (keyState() === "held") return true;
  if (!force && serverKey && Date.now() - serverKey.at < 60_000) return serverKey.value;
  try {
    const res = await fetch("/api/keys/status", { cache: "no-store" });
    const data = (await res.json()) as { set?: Record<string, boolean> };
    serverKey = { at: Date.now(), value: !!data.set?.ANTHROPIC_API_KEY };
  } catch {
    return true;
  }
  return serverKey.value;
}

/**
 * Is there a Replicate token anywhere a call could use — the server's or
 * this browser's?
 *
 * The same question as `claudeReady`, for the renderer, and asked for the
 * same reason: a control that spends money is lit only when the call can
 * be made, and says what it needs when it cannot. The server never says
 * what its token is, only whether it has one.
 */
let serverToken: { at: number; value: boolean } | null = null;

export async function rendererReady(force = false): Promise<boolean> {
  if (keyState("REPLICATE_API_TOKEN") === "held") return true;
  if (!force && serverToken && Date.now() - serverToken.at < 60_000) return serverToken.value;
  try {
    const res = await fetch("/api/keys/status", { cache: "no-store" });
    const data = (await res.json()) as { set?: Record<string, boolean> };
    serverToken = { at: Date.now(), value: !!data.set?.REPLICATE_API_TOKEN };
  } catch {
    return false;
  }
  return serverToken.value;
}

/** The document as the Builder saves it: what a headless browser needs to show the same site. */
export function studioDoc(): Record<string, unknown> {
  const s = useStudio.getState();
  return {
    pages: s.pages, nodes: s.nodes, groups: s.groups, shapes: s.shapes, format: s.format, brief: s.brief, look: s.look, motion: s.motion,
    activePageId: s.activePageId, hiddenFeatures: s.hiddenFeatures, frameWidth: s.frameWidth, companion: s.companion,
  };
}

/* ------------------------------------------------------------------ */
/* Screenshots                                                         */
/* ------------------------------------------------------------------ */

/**
 * What the server's browser can do.
 *
 * Two different answers, because there are two different browsers it might
 * have found. A full Playwright install opens pages and records them. The
 * cut-down Chromium a serverless function can carry opens pages and cannot
 * record a frame — recording is written by the ffmpeg a full install ships —
 * so anything that wants a video has to ask separately and say so plainly.
 */
export interface BrowserThere {
  /** Can it open the site at all? */
  open: boolean;
  /** Can it record the site being worked? */
  video: boolean;
  /** Which browser it found, for a tooltip that does not have to be vague. */
  from: string | null;
}

let browserThere: { at: number; value: BrowserThere } | null = null;

/** What the server can do with a browser. Asked once a minute at most. */
export async function serverBrowser(force = false): Promise<BrowserThere> {
  if (!force && browserThere && Date.now() - browserThere.at < 60_000) return browserThere.value;
  try {
    const res = await fetch("/api/studio/screenshot", { cache: "no-store" });
    const data = (await res.json()) as { available?: boolean; video?: boolean; from?: string | null };
    browserThere = { at: Date.now(), value: { open: !!data.available, video: !!data.video, from: data.from ?? null } };
  } catch {
    browserThere = { at: Date.now(), value: { open: false, video: false, from: null } };
  }
  return browserThere.value;
}

/** Can the server open the site in a browser? */
export async function screenshotsAvailable(force = false): Promise<boolean> {
  return (await serverBrowser(force)).open;
}

const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error("read failed"));
    r.readAsDataURL(blob);
  });

/** A small copy of a picture for the dialog, so the full one is not drawn a dozen times. */
async function thumb(dataUrl: string, width = 240): Promise<string> {
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("no image")); img.src = dataUrl; });
    const scale = Math.min(1, width / Math.max(1, img.naturalWidth));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.naturalWidth * scale));
    c.height = Math.max(1, Math.min(600, Math.round(img.naturalHeight * scale)));
    c.getContext("2d")?.drawImage(img, 0, 0, c.width, Math.round(img.naturalHeight * scale));
    return c.toDataURL("image/png");
  } catch {
    return dataUrl;
  }
}

/**
 * How long one page may take before the browser stops waiting for it.
 *
 * A deployment can kill the route mid-shot, and a request nothing is ever
 * going to answer leaves the caller on "Photographing the pages…" for good.
 * So the wait ends here: the page counts as one the server could not do, and
 * the ask goes on with the words.
 */
const SHOT_DEADLINE_MS = 90_000;

/** One page, photographed on the server with the document in place. Null when the server cannot. */
export async function screenshotPage(pageId: string, opts: { device?: Device; width?: number; signal?: AbortSignal; hook?: string } = {}): Promise<Picture | null> {
  const s = useStudio.getState();
  const page = s.pages.find((p) => p.id === pageId) ?? s.pages[0];
  if (!page) return null;
  const path = "/builder/preview" + (page.path === "/" ? "" : page.path);
  const mine = new AbortController();
  const ran = setTimeout(
    () => mine.abort(new DOMException(`The server did not answer within ${Math.round(SHOT_DEADLINE_MS / 1000)}s.`, "TimeoutError")),
    SHOT_DEADLINE_MS,
  );
  const res = await fetch("/api/studio/screenshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ doc: studioDoc(), path, device: opts.device ?? "desktop", width: opts.width, ...(opts.hook ? { hook: opts.hook } : {}) }),
    signal: opts.signal ? AbortSignal.any([opts.signal, mine.signal]) : mine.signal,
  }).finally(() => clearTimeout(ran));
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  // A page past the route's cap comes back cut, and the route says so; the
  // label says what the picture is rather than calling it top to bottom.
  const cut = res.headers.get("x-shot-cut") === "1";
  const shown = res.headers.get("x-shot-max");
  const whole = res.headers.get("x-shot-height");
  const extent = cut ? `the top ${shown}px of a page ${whole}px tall` : "top to bottom";
  return {
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mediaType: "image/png",
    label: `Page “${page.name}” (${page.path}), ${opts.device ?? "desktop"} width, ${extent}:`,
    preview: await thumb(dataUrl),
    pageId: page.id,
  };
}

/**
 * The first `limit` pages, photographed in order.
 *
 * Pages the server could not do are left out, and the count of the ones it
 * simply never answered for comes back too, so the caller can say which of
 * the two happened rather than blaming the camera for a silence.
 */
export async function screenshotPages(
  limit: number,
  device: Device,
  onProgress?: (done: number, total: number) => void,
  signal?: AbortSignal,
): Promise<{ pictures: Picture[]; timedOut: number }> {
  const pages = useStudio.getState().pages.slice(0, Math.max(1, limit));
  const out: Picture[] = [];
  let timedOut = 0;
  for (let i = 0; i < pages.length; i++) {
    signal?.throwIfAborted();
    // A page the server could not do is left out, but a request the caller
    // let go of is not that: it ends the loop rather than being counted as a
    // camera that failed.
    const p = await screenshotPage(pages[i]!.id, { device, signal }).catch((err) => {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      if (err instanceof DOMException && err.name === "TimeoutError") timedOut++;
      return null;
    });
    if (p) out.push(p);
    onProgress?.(i + 1, pages.length);
  }
  return { pictures: out, timedOut };
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */

export type AskResult =
  | {
      ok: true;
      text: string;
      model?: string;
      pictures: number;
      /** Pictures the browser sent that the route could not, and why. */
      dropped: number;
      droppedWhy: string;
      truncated: boolean;
      files: GeneratedFile[];
      cached: number;
      input: number;
      /** What came back, in tokens: the expensive half of the bill. */
      output: number;
      /** What was written into the cache, charged at more than an input token. */
      written: number;
      /** How long the person waited for it, measured. */
      ms: number;
      /** Findings with the prompt that settles each, from critique, fill and finish. */
      revisions: Revision[];
    }
  | { ok: false; message: string; reason?: string };

/**
 * The browser's own deadline on a Claude call, in milliseconds.
 *
 * The route answers within a budget of its own, so in the ordinary case this
 * never fires and the reason shown is the server's. This is for the case that
 * left a spinner running for minutes: the function is killed mid-call, or an
 * intermediary drops an idle connection, and the request simply hangs with no
 * status at all. Nothing on the far side is ever going to end it, so the
 * browser ends it and says so. Writing the code is the slow one; the rest
 * share a shorter wait.
 */
const CLIENT_DEADLINE_MS: Record<string, number> = { build: 330_000 };
const CLIENT_DEADLINE_DEFAULT_MS = 210_000;

/**
 * Ask Claude.
 *
 * Two shapes, one route. With nothing vined to the thread the whole
 * blueprint goes, as it always has. With pieces vined, the *brief* goes
 * first and is marked for the cache — the same bytes on every call of a
 * thread — and after it only those pieces, and only the ones whose
 * fingerprint has moved since this thread last sent them. The answer says
 * how many were sent, how many were skipped, and how much of the prefix the
 * cache gave back.
 */
export async function askClaude(
  input: {
    markdown: string;
    mode: AskMode;
    prompt?: string;
    pictures?: Picture[];
    /** The stable prefix: the site's brief, without the per-part detail. */
    brief?: string;
    /** The pieces vined to this thread, already filtered to what changed. */
    pieces?: Piece[];
    /** How many vined pieces were left out because they have not changed. */
    skipped?: number;
    /** For Build: what the document already wrote, and what it could not. */
    scaffold?: { files: { path: string; bytes: number }[]; gaps: string[]; stats?: Record<string, number> };
    /** Added to the house system prompt, not in place of it. */
    system?: string;
    /** How hard to think: the route decides when this is left out. */
    effort?: "low" | "medium" | "high";
    /** What has already been said, so an answer can be argued with. */
    turns?: { role: "user" | "assistant"; text: string }[];
  },
  opts: { signal?: AbortSignal } = {},
): Promise<AskResult> {
  const limit = CLIENT_DEADLINE_MS[input.mode] ?? CLIENT_DEADLINE_DEFAULT_MS;
  const mine = new AbortController();
  const ran = setTimeout(() => mine.abort(new DOMException("deadline", "TimeoutError")), limit);
  const started = Date.now();
  try {
    const res = await fetch("/api/studio/generate", {
      method: "POST",
      headers: { "content-type": "application/json", ...keyHeader() },
      // Stop has to reach this call, not only the photographs: a request the
      // caller has given up on must actually be let go of.
      signal: opts.signal ? AbortSignal.any([opts.signal, mine.signal]) : mine.signal,
      body: JSON.stringify({
        markdown: input.markdown,
        mode: input.mode,
        prompt: input.prompt ?? "",
        brief: input.brief ?? "",
        pieces: (input.pieces ?? []).map((x) => ({ id: x.id, label: x.label, where: x.where, prompt: x.prompt, size: x.size, neighbours: x.neighbours })),
        skipped: input.skipped ?? 0,
        ...(input.scaffold ? { scaffold: input.scaffold } : {}),
        ...(input.system ? { system: input.system } : {}),
        ...(input.effort ? { effort: input.effort } : {}),
        ...(input.turns?.length ? { turns: input.turns } : {}),
        pictures: (input.pictures ?? []).map((p) => ({ data: p.data, mediaType: p.mediaType, label: p.label })),
      }),
    });
    /*
     * Read the body defensively. The route answers JSON on every path it
     * controls, but a gateway that times the function out answers its own
     * error page, and `res.json()` on that throws a parse error that tells
     * the reader nothing. The status is what happened; say it.
     */
    const raw = await res.text();
    let data: { ok?: boolean; text?: string; message?: string; reason?: string; pictures?: number; dropped?: number; droppedWhy?: string; truncated?: boolean; usage?: { model?: string; input?: number; output?: number; cached?: number; written?: number }; revisions?: Revision[] };
    try {
      data = JSON.parse(raw) as typeof data;
    } catch {
      const secs = Math.round((Date.now() - started) / 1000);
      const gateway = res.status === 504 || res.status === 502 || res.status === 503;
      return {
        ok: false,
        reason: gateway ? "timeout" : "bad-response",
        message: gateway
          ? `The server gave up on this after ${secs}s (HTTP ${res.status}). The deployment stops a function before Claude finished: ask for less at once, turn the pictures off, or raise the function's limit.`
          : `The server answered HTTP ${res.status} with something that is not JSON: ${raw.slice(0, 200).replace(/\s+/g, " ").trim() || "an empty body"}`,
      };
    }
    if (data.ok && typeof data.text === "string") {
      return {
        ok: true, text: data.text, model: data.usage?.model, pictures: data.pictures ?? 0, dropped: data.dropped ?? 0, droppedWhy: data.droppedWhy ?? "", truncated: !!data.truncated,
        files: input.mode === "build" ? filesFromMarkdown(data.text) : [],
        revisions: Array.isArray(data.revisions) ? data.revisions : [],
        cached: data.usage?.cached ?? 0,
        input: data.usage?.input ?? 0,
        output: data.usage?.output ?? 0,
        written: data.usage?.written ?? 0,
        // Measured from the moment the request went out, so it is the wait
        // the person actually had rather than the model's own timing.
        ms: Date.now() - started,
      };
    }
    return { ok: false, message: data.message ?? "Couldn't reach Claude.", reason: data.reason };
  } catch (err) {
    const secs = Math.round((Date.now() - started) / 1000);
    // The caller's own Stop: not a failure, and the caller knows already.
    if (opts.signal?.aborted) return { ok: false, reason: "stopped", message: "Stopped." };
    if (mine.signal.aborted) {
      return {
        ok: false,
        reason: "timeout",
        message: `No answer after ${secs}s, and the request was still open with no status, so it was let go. The server was killed mid-call or the connection was dropped: try again, ask for less at once, or turn the pictures off.`,
      };
    }
    return { ok: false, reason: "network", message: err instanceof Error ? err.message : "Request failed." };
  } finally {
    clearTimeout(ran);
  }
}

/**
 * Files out of an answer: every fenced block whose info string names a path
 * (```tsx src/x.tsx), or that follows a heading or bold line that is a path.
 */
export function filesFromMarkdown(text: string): GeneratedFile[] {
  const out: GeneratedFile[] = [];
  const re = /(^|\n)(?:#{1,6}\s+`?([^\n`]+?)`?\s*\n|\*\*`?([^\n`*]+?)`?\*\*\s*\n)?(?:[^\n]*\n)?```([^\n]*)\n([\s\S]*?)\n```/g;
  const looksLikePath = (s: string) => /^[\w@./-]+\.[A-Za-z0-9]{1,8}$/.test(s.trim()) && s.includes("/") === true || /^[\w.-]+\.(tsx?|jsx?|css|json|md|mjs|cjs|html|svg|txt|yml|yaml)$/.test(s.trim());
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const info = (m[4] ?? "").trim();
    const [lang, ...rest] = info.split(/\s+/);
    let path = rest.find(looksLikePath) ?? "";
    if (!path) {
      const heading = (m[2] ?? m[3] ?? "").trim();
      if (looksLikePath(heading)) path = heading;
    }
    if (!path && lang && looksLikePath(lang)) path = lang;
    if (!path) continue;
    const content = m[5] ?? "";
    const seen = out.findIndex((f) => f.path === path);
    const file = { path: path.replace(/^\.?\//, ""), content, lang: lang && !looksLikePath(lang) ? lang : undefined };
    if (seen >= 0) out[seen] = file; else out.push(file);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Publishing                                                          */
/* ------------------------------------------------------------------ */

export interface PublishStatus {
  github: { configured: boolean; token: "browser" | "server" | null; repo: string | null; branch: string; missing: string[]; allow?: string[] | null };
  vercel: { hook: boolean };
}

/** What a caller gets when the route says nothing usable. */
const NO_PUBLISH: PublishStatus = {
  github: { configured: false, token: null, repo: null, branch: "main", missing: ["unreachable"] },
  vercel: { hook: false },
};

/**
 * The answer, checked rather than cast.
 *
 * `as PublishStatus` is a promise to the compiler and nothing to the runtime:
 * `{}`, `{"error":…}`, `null` for `github`, a proxy's own error page — all of
 * them are valid JSON, all of them got past the cast, and the first
 * `status.github.repo` after that threw inside render and took the whole
 * Builder down to two buttons. Measured, in `bar-survives`: five shapes out
 * of seven blanked it.
 *
 * So every field is read defensively and the shape that comes out is always
 * the shape the type says. A route that has lost its mind reads here as a
 * Builder that cannot publish, which is both true and survivable.
 */
function readPublishStatus(raw: unknown): PublishStatus {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NO_PUBLISH;
  const o = raw as Record<string, unknown>;
  const gh = (o.github && typeof o.github === "object" && !Array.isArray(o.github) ? o.github : {}) as Record<string, unknown>;
  const vc = (o.vercel && typeof o.vercel === "object" && !Array.isArray(o.vercel) ? o.vercel : {}) as Record<string, unknown>;
  const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
  return {
    github: {
      configured: gh.configured === true,
      token: gh.token === "browser" || gh.token === "server" ? gh.token : null,
      repo: str(gh.repo),
      branch: str(gh.branch) ?? "main",
      missing: Array.isArray(gh.missing) ? gh.missing.filter((m): m is string => typeof m === "string") : [],
      allow: Array.isArray(gh.allow) ? gh.allow.filter((a): a is string => typeof a === "string") : null,
    },
    vercel: { hook: vc.hook === true },
  };
}

/**
 * Can this publish push, and with whose token.
 *
 * The probe carries no token. It used to send the person's own so the route
 * could answer "configured", which sent a real GitHub token across to the
 * server on every load that asked, for a question this side already knows
 * the answer to. The route speaks for the server; whether this browser holds
 * one is read here, where it is held. The token still rides with the push
 * itself, which is the one call that needs it.
 */
export async function publishStatus(): Promise<PublishStatus> {
  const mine = !!heldKeys(["GITHUB_TOKEN"]).GITHUB_TOKEN;
  try {
    const res = await fetch("/api/studio/publish", { cache: "no-store" });
    const said = readPublishStatus(await res.json());
    if (!mine) return said;
    return { ...said, github: { ...said.github, configured: true, token: "browser", missing: [] } };
  } catch {
    return mine ? { ...NO_PUBLISH, github: { ...NO_PUBLISH.github, configured: true, token: "browser", missing: [] } } : NO_PUBLISH;
  }
}

/**
 * The document as it goes into a published repository: the site, and none of
 * how it was made.
 *
 * HIS WORDS: a private repository "should not contain such revealing files
 * and only comprise of what a website securely should". Measured on sink
 * brought in through the real door, the document carried the capture and his
 * working in exactly these places, and nowhere else: every part's prompt
 * ("Captured from ccc-woad.vercel.app/ … as body > div > …"), its notes (the
 * capture's description of the element), where it was captured (address,
 * host, element path, time), each page's prompt, the brief he writes for
 * Claude, and where each carried face was found. So those are emptied.
 *
 * What stays is what something downstream reads: Bring imports a site made
 * here from this file whole (`repoImport.ts`, MADE_HERE), and a repository
 * that is a copy of this app renders it at /site (`published.ts`). A part
 * keeps its `from.position`, the flag the header fix reads, which says how
 * the element was placed and nothing about where it came from.
 *
 * The cost, said: a document brought back in from a publish carries no
 * element paths and no notes, so the sweep that runs on it finds no wrapper
 * by its path and no control by its notes. A published board carries no
 * wrappers already; this is that, written down.
 */
/*
 * THE CAPTURE'S OWN RECORDS, WHEREVER THEY SIT. The fields above are the ones
 * measured; a capture taken since carries more of the same kind in new places
 * (each keyframe rule's stylesheet address, `keyframes[].sheet`; the block a
 * part's units are taken of, by its element path, `units.of.selector`), and
 * a list of places is always one short. So after them, the whole document is
 * swept for the shapes a capture records, by what they are and not where:
 * an element path under `selector`, a stylesheet address under `sheet`, and a
 * `from` that says where something was taken (an address, a host, an element
 * path, a sheet), which keeps only a part's `position`. Nothing downstream
 * reads any of them (a part's units keep the part and box they are of).
 */
/* An element path as a capture writes it: from the body down (a rule's own selector, `.card:hover > span`, is the site's and stays). */
const PATH = /^\s*(?:html\s*>\s*)?body(?:\s*>|\s*$)/;
function unrecorded(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(unrecorded);
  if (!v || typeof v !== "object") return v;
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
    if (k === "selector" && typeof x === "string" && PATH.test(x)) continue;
    if (k === "sheet" && typeof x === "string") continue;
    if (k === "from" && x && typeof x === "object" && !Array.isArray(x) && ["url", "host", "selector", "sheet"].some((f) => f in (x as object))) {
      const pos = (x as { position?: unknown }).position;
      if (pos !== undefined) out.from = { position: pos };
      continue;
    }
    out[k] = unrecorded(x);
  }
  return out;
}

export function publishedDoc(): Record<string, unknown> {
  const d = studioDoc() as {
    nodes?: (Record<string, unknown> & { from?: { position?: unknown } | null })[];
    pages?: Record<string, unknown>[];
    brief?: Record<string, unknown>;
    look?: Record<string, unknown> & { fonts?: (Record<string, unknown> & { from?: unknown })[] };
    shapes?: Record<string, unknown>[];
  } & Record<string, unknown>;
  const siteUrl = (d.brief?.head as SiteHead | undefined)?.url;
  /* The capture's hand-off rides in `look.capture` for POLIO.md; its element
     paths and the addresses the parts came from go the way of the parts' own. */
  const hosts = [...new Set((d.nodes ?? []).map((n) => { const u = (n.from as { url?: unknown } | null)?.url; try { return typeof u === "string" ? new URL(u).host : ""; } catch { return ""; } }).filter(Boolean))];
  const capture = d.look?.capture as ({ handoff?: unknown } & Record<string, unknown>) | undefined;
  const cleanCapture = capture && typeof capture.handoff === "string" ? { ...capture, handoff: unmade(capture.handoff, hosts) } : capture;
  const { standIn: _standIn, ...rest } = unrecorded({
    ...d,
    nodes: (d.nodes ?? []).map((n) => ({
      ...n,
      prompt: "",
      data: "",
      from: n.from && n.from.position ? { position: n.from.position } : null,
    })),
    /* A head keeps what it says and not where it was captured from (`publishedHead`). */
    pages: (d.pages ?? []).map((p) => ({ ...p, prompt: "", ...(p.head ? { head: publishedHead(p.head as SiteHead, [siteUrl]) } : {}) })),
    brief: { ...(d.brief ?? {}), master: "", gimmick: "", ...(d.brief?.head ? { head: publishedHead(d.brief.head as SiteHead) } : {}) },
    look: d.look ? { ...d.look, ...(d.look.fonts ? { fonts: d.look.fonts.map(({ from: _from, ...f }) => f) } : {}), ...(cleanCapture ? { capture: cleanCapture } : {}) } : d.look,
    shapes: (d.shapes ?? []).map((sh) => ("prompt" in sh ? { ...sh, prompt: "" } : sh)),
  }) as Record<string, unknown>;
  void _standIn;
  return {
    ...rest,
    /* The recorded reads and their samples go up only with the Build option Stand-in server on (`standIn.ts`), as recorded. */
    ...(() => { const s = useStudio.getState(); return standInOn(s.format, s.standIn) ? { standIn: s.standIn } : {}; })(),
  };
}

/**
 * The files that make the site's repository beside its pages: the document,
 * cleaned (`publishedDoc`), and nothing else.
 *
 * The blueprint (BLUEPRINT.md, blueprint.json) no longer goes up. Nothing
 * downstream reads either, it carried every part's prompt and the capture,
 * and blueprint.json carried his drafts, Claude's critiques, the prompts
 * they proposed and the model that proposed them. They are still in the
 * Brief dialog, to read and download, on his side of the publish.
 * tests/publish-leak.mjs reads the whole pushed tree for any of it.
 */
export function siteFiles(_markdown?: string, _json?: string): GeneratedFile[] {
  return [
    { path: "site/document.json", content: JSON.stringify(publishedDoc(), null, 2) + "\n" },
  ];
}

export type PublishResult =
  | { ok: true; sha: string; /** The tip the commit was written on; null for a repository's first. */ parent?: string | null; commitUrl: string; branch: string; repo: string; files: number; deployed: boolean; hook: boolean; deployNote?: string; /** Set only when this call made the repository. */ created?: string;
      /** How many files had changed from what the branch held, of how many the site is: only those were sent (`tests/publish-changed.mjs`). */
      changed?: number; total?: number }
  /* A failure can still have made the repository, and says so, so the next
     press goes to the one that exists rather than making another. */
  | { ok: false; message: string; reason?: string; created?: string; repo?: string; /** Set when the Builder's own server failed rather than answering. */ serverStatus?: number; status?: number };

/* ------------------------------------------------------------------ */
/* Going live                                                          */
/* ------------------------------------------------------------------ */

/** The Vercel token this browser holds, when the keys panel is open and holds one. */
function vercelHeader(): Record<string, string> {
  const held = heldKeys(["VERCEL_TOKEN"]).VERCEL_TOKEN;
  return held ? { "x-vercel-token": held } : {};
}

/** The team the keys panel names, when it names one. Not a secret; it is part of the address. */
function heldTeam(): string | undefined {
  return heldKeys(["VERCEL_TEAM"]).VERCEL_TEAM || undefined;
}

export interface DeployStatus {
  configured: boolean;
  source: "server" | "browser" | null;
  repo: string | null;
  hook: boolean;
}

/*
 * A KEY RIDES ONLY WHERE IT IS NEEDED. Whether this browser holds a Vercel
 * token is something the browser knows, so asking whether the site can go
 * live sends none: the route is asked only about its own, as the GitHub
 * status read already is (`publishStatus`). A read that does need a token
 * (following a deployment, asking a project's address) carries this
 * browser's only when the server has none of its own (`tests/no-plain-key.mjs`).
 */
let serverVercel: Promise<boolean> | null = null;
async function serverHasVercel(): Promise<boolean> {
  serverVercel ??= fetch("/api/studio/deploy", { cache: "no-store" })
    .then((r) => r.json() as Promise<DeployStatus>)
    .then((d) => d.source === "server")
    .catch(() => { serverVercel = null; return false; });
  return serverVercel;
}
/** This browser's token, for a read that needs one, unless the server brings its own. */
async function vercelHeaderIfNeeded(): Promise<Record<string, string>> {
  const mine = vercelHeader();
  if (!mine["x-vercel-token"]) return {};
  return (await serverHasVercel()) ? {} : mine;
}

/** Can this put the site live at all — and off whose token? */
export async function deployStatus(): Promise<DeployStatus> {
  const mine = !!vercelHeader()["x-vercel-token"];
  try {
    const res = await fetch("/api/studio/deploy", { cache: "no-store" });
    const said = (await res.json()) as DeployStatus;
    serverVercel = Promise.resolve(said.source === "server");
    /* The server's own token wins; with none, the one this browser holds is the one that will be used. */
    return said.configured || !mine ? said : { ...said, configured: true, source: "browser" };
  } catch {
    return { configured: mine, source: mine ? "browser" : null, repo: null, hook: false };
  }
}

/** The address a repository's Vercel project publishes at, asked before a push; null when it has no project or domain yet. */
export async function productionAddress(input: { repo?: string; sources?: string[] }): Promise<string | null> {
  if (!input.repo) return null;
  try {
    const q = new URLSearchParams({ address: input.repo });
    const team = heldTeam();
    if (team) q.set("team", team);
    for (const s of input.sources ?? []) q.append("source", s);
    const res = await fetch(`/api/studio/deploy?${q}`, { cache: "no-store", headers: await vercelHeaderIfNeeded() });
    const data = (await res.json()) as { ok?: boolean; url?: string };
    return data.ok && typeof data.url === "string" ? data.url.replace(/\/+$/, "") : null;
  } catch {
    return null;
  }
}

export type DeployStart =
  | { ok: true; id: string; project: string; repo: string; branch: string; team: string | null; state: string | null; url: string | null; inspectorUrl: string | null; /** Set when this call made the Vercel project. */ created?: string; note?: string }
  | { ok: false; message: string; reason?: string; /** One line on the likely fix, when the route has one. */ hint?: string;
      /** Vercel's status, code and a limit's reset, passed on by the route; `serverStatus` when the Builder's own server failed. */
      status?: number; code?: string; reset?: number; serverStatus?: number };

/**
 * Ask Vercel to build the repository's branch. Returns as soon as it is queued.
 *
 * A repository with no Vercel project gets one on the way, named after the
 * site (`name`), so the GitHub token rides too: the route looks for a capture
 * in the repository before it connects anything to it, and refuses every one
 * of `sources`, where sites here were brought in from.
 */
export async function deploy(input: { repo?: string; branch?: string; project?: string; team?: string; name?: string; sources?: string[]; /** The commit the push just made: its own deployment is followed rather than a second one made. */ sha?: string } = {}): Promise<DeployStart> {
  try {
    const res = await fetch("/api/studio/deploy", {
      method: "POST",
      headers: { "content-type": "application/json", ...vercelHeader(), ...publisherHeader() },
      body: JSON.stringify({ ...input, team: input.team ?? heldTeam() }),
    });
    const data = (await res.json().catch(() => null)) as DeployStart | null;
    /* Not an answer at all (a gateway's error page, a crash): the Builder's own server failed, and says with which status. */
    if (!data) return { ok: false, message: `The Builder's server answered ${res.status}.`, reason: "server", serverStatus: res.status };
    if (data.ok) return data;
    return { ok: false, message: data.message ?? "The deploy failed.", reason: data.reason, ...(data.hint ? { hint: data.hint } : {}),
      ...(data.status ? { status: data.status } : {}), ...(data.code ? { code: data.code } : {}), ...(data.reset ? { reset: data.reset } : {}),
      ...(!res.ok && res.status >= 500 ? { serverStatus: res.status } : {}) };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed.", reason: "builder-unreachable" };
  }
}

export interface DeployState {
  ok: boolean;
  state: string | null;
  done: boolean;
  url: string | null;
  inspectorUrl: string | null;
  message?: string;
  /** Why the route could not say, when it could not: "no-token" is a wait for a key, not an end. */
  reason?: string;
}

/**
 * Wait for a build, telling the caller how it is getting on.
 *
 * Polled rather than streamed because a build outlives any one request on a
 * serverless host: the route that started it has already answered by the time
 * the first file is compiled.
 */
export async function watchDeploy(
  id: string,
  opts: { team?: string | null; onState?: (s: DeployState) => void; signal?: AbortSignal } = {},
): Promise<DeployState> {
  const team = opts.team ?? heldTeam() ?? null;
  const query = new URLSearchParams({ id, ...(team ? { team } : {}) });
  const until = Date.now() + 10 * 60_000;
  let wait = 2_000;
  for (;;) {
    if (opts.signal?.aborted) return { ok: false, state: "ABORTED", done: true, url: null, inspectorUrl: null, message: "Stopped waiting." };
    let s: DeployState;
    try {
      const res = await fetch(`/api/studio/deploy?${query}`, { cache: "no-store", headers: await vercelHeaderIfNeeded(), signal: opts.signal });
      s = (await res.json()) as DeployState;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") throw err;
      s = { ok: false, state: "UNKNOWN", done: false, url: null, inspectorUrl: null, message: "Lost sight of the build for a moment." };
    }
    opts.onState?.(s);
    if (s.done || (!s.ok && s.state !== "UNKNOWN")) return s;
    if (Date.now() > until) return { ...s, done: true, message: "The build is taking longer than ten minutes; the Vercel log has it." };
    await new Promise((r) => setTimeout(r, wait));
    // Gentle at first, then out of the way: a cold build is minutes, not seconds.
    wait = Math.min(wait * 1.4, 10_000);
  }
}

/*
 * A BIG SITE GOES UP IN PARTS, AS ONE COMMIT.
 *
 * The Builder runs on Vercel, where a function takes a request body of at
 * most 4.5 MB ("Request body size", vercel.com/docs/functions/limitations),
 * and share.xyz's push was one request of 9.3 MB. So text goes packed
 * (gzip, which the route unpacks), and a push past what one request carries
 * sends its files in parts first (`stage`), each well under the limit; the
 * last request carries the document, the files merged on the branch and
 * the blobs the parts made, into one commit (`tests/publish-big-site.mjs`).
 */
const REQUEST_BUDGET = 3_500_000;
/** One piece of a file bigger than a request: base64 characters, a multiple of four so each piece decodes on its own. */
const PIECE = 3_000_000;
/** How many times one call carries on after stopping part-way: ~230 pictures at GitHub's pace is three or four. */
const RESUMES = 12;
type Answer = PublishResult & { staged?: { path: string; sha: string }[]; pending?: string[]; wait?: number };
/** What the route reads as it commits, so it goes in the last request, never a part. */
const COMMITTED_LAST = new Set(["site/document.json", ...MERGED_FILES]);

type Sent = { path: string; content: string; encoding?: "base64" | "gzip" };

function base64Of(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/** The git blob sha of a file's bytes, as GitHub would give it. */
async function gitSha(f: GeneratedFile): Promise<string | null> {
  if (typeof crypto === "undefined" || !crypto.subtle) return null;
  let bytes: Uint8Array;
  if (f.encoding === "base64") {
    const bin = atob(f.content);
    bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  } else bytes = new TextEncoder().encode(f.content);
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head);
  all.set(bytes, head.length);
  const d = new Uint8Array(await crypto.subtle.digest("SHA-1", all));
  return [...d].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** The branch's tree as it stands, path to blob sha; empty when it cannot be read, and then everything is sent. */
async function treeOf(repo: string, branch: string): Promise<Map<string, string>> {
  try {
    const res = await fetch(`/api/studio/publish?tree=1&repo=${encodeURIComponent(repo)}&branch=${encodeURIComponent(branch)}`, { headers: publisherHeader(), cache: "no-store" });
    const a = (await res.json()) as { ok?: boolean; tree?: { path: string; sha: string }[] };
    return new Map(a.ok ? (a.tree ?? []).map((e) => [e.path, e.sha]) : []);
  } catch {
    return new Map();
  }
}

/** Text past a few KB, packed: pages and the document shrink by ten or more. */
async function packed(f: GeneratedFile): Promise<Sent> {
  if (f.encoding === "base64") return { path: f.path, content: f.content, encoding: "base64" };
  if (f.content.length < 4096 || typeof CompressionStream === "undefined") return { path: f.path, content: f.content };
  const zipped = new Uint8Array(await new Response(new Blob([f.content]).stream().pipeThrough(new CompressionStream("gzip"))).arrayBuffer());
  return { path: f.path, content: base64Of(zipped), encoding: "gzip" };
}

export async function publish(input: { files: GeneratedFile[]; message: string; deploy: boolean; repo?: string; branch?: string; create?: string; boundTo?: string; sources?: string[] }): Promise<PublishResult> {
  const r = await pushed(input);
  /* Whoever pressed it, a push that went through ends the last refusal (`goLive.ts`, `studio:published`). */
  if (r.ok && typeof window !== "undefined") window.dispatchEvent(new Event("studio:published"));
  return r;
}

async function pushed(input: Parameters<typeof publish>[0]): Promise<PublishResult> {
  /* The site's open edit branch, unless the caller names one: main is
     never pushed to by accident while a branch is open. */
  const branch = input.branch ?? useStudio.getState().siteBranch;
  const send = async (repo: string | undefined, extra: Record<string, unknown>): Promise<Answer> => {
    const res = await fetch("/api/studio/publish", {
      method: "POST",
      headers: { "content-type": "application/json", ...publisherHeader() },
      body: JSON.stringify({
        message: input.message,
        deploy: input.deploy,
        // Which site this is. The server decides whether it may go there.
        ...(repo ? { repo } : {}),
        ...(branch ? { branch } : {}),
        // What to call a repository if this site has not got one yet.
        ...(!repo && input.create ? { create: input.create } : {}),
        // Which repository this site is bound to: the route refuses any other.
        ...(input.boundTo ? { boundTo: input.boundTo } : {}),
        // Where sites here were brought in from: the route refuses every one.
        ...(input.sources?.length ? { sources: input.sources } : {}),
        ...extra,
      }),
    });
    const data = (await res.json().catch(() => null)) as Answer | null;
    return data ?? { ok: false, message: res.status === 413 ? "The push was more than the Builder's server takes in one request." : `The Builder's server answered ${res.status}.`, ...(res.status >= 500 ? { reason: "server", serverStatus: res.status } : {}) };
  };
  /* A failure keeps what the route made: without `created` the site never
     learns the repository exists, and the next press makes a second one
     with a suffix (tests/publish-made-kept.mjs). */
  const failed = (data: PublishResult, created?: string): PublishResult => {
    const made = (data.ok ? undefined : data.created) ?? created;
    return data.ok ? data : { ok: false, message: data.message ?? "The publish failed.", reason: data.reason, ...(made ? { created: made } : {}), ...(data.repo ?? made ? { repo: data.repo ?? made } : {}),
      ...(data.serverStatus ? { serverStatus: data.serverStatus } : {}), ...(data.status ? { status: data.status } : {}) };
  };
  let repo = input.repo;
  let created: string | undefined;
  const staged = new Map<string, string>();
  /*
   * A CALL THAT STOPPED PART-WAY CARRIES ON. The route makes blobs one at a
   * time and stops inside Vercel's time limit, or on a GitHub rate limit
   * longer than it can wait, answering `resume` with what went up
   * (`staged`) and what did not (`pending`). The same call goes again with
   * only the pending files, after the wait GitHub asked for: nothing is sent
   * twice and it is still one commit at the end (`tests/publish-steady.mjs`).
   */
  const carry = async (files: Sent[], extra: () => Record<string, unknown>) => {
    let left = files;
    for (let n = 0; ; n++) {
      const got = await send(repo, { ...extra(), files: left });
      if (got.created) { created = got.created; repo = got.created; }
      for (const s of got.staged ?? []) staged.set(s.path, s.sha);
      if (got.ok || got.reason !== "resume" || n >= RESUMES) return got;
      const pending = new Set(got.pending ?? []);
      left = left.filter((f) => pending.has(f.path));
      await new Promise((r) => setTimeout(r, Math.min(got.wait ?? 0, 180) * 1000));
    }
  };
  const all = () => [...staged].map(([path, sha]) => ({ path, sha }));
  try {
    /*
     * ONLY WHAT CHANGED GOES UP. Each file's git blob sha is worked out here
     * and compared with the branch's tree as it stands; a file already there
     * at its path is named by its sha in the one commit and not sent at all.
     * What the route reads as it commits (the document, the merged files) is
     * always sent. Parasite's 354 files took six minutes to re-send when
     * little had changed.
     */
    const there = input.repo ? await treeOf(input.repo, branch ?? "main") : new Map<string, string>();
    const changedFiles: GeneratedFile[] = [];
    for (const f of input.files) {
      const sha = there.size ? await gitSha(f) : null;
      if (sha && there.get(f.path) === sha && !COMMITTED_LAST.has(f.path)) staged.set(f.path, sha);
      else changedFiles.push(f);
    }
    const counted = { changed: input.files.filter((f) => !staged.has(f.path)).length, total: input.files.length };
    const withCounts = <T extends PublishResult>(r: T): T => (r.ok ? { ...r, ...counted } : r);
    const files = await Promise.all(changedFiles.map(packed));
    const weight = (f: Sent) => f.content.length + f.path.length + 64;
    const total = files.reduce((a, f) => a + weight(f), 0);
    if (total <= REQUEST_BUDGET) {
      const done = await carry(files, () => ({ staged: all() }));
      return done.ok ? withCounts({ ...done, ...(created && !done.created ? { created } : {}) }) : failed(done, created);
    }

    /*
     * A FILE BIGGER THAN ONE REQUEST GOES IN PIECES, WHATEVER IT IS.
     * parasiteonsol.fun's picture was 5.1 MB encoded and a request carries
     * 4.5 MB, so Go live was refused; then its site document was, at 3.5 MB
     * even packed (10,683 parts on 12 pages). Any file past the budget, a
     * picture or packed text, the document included, is cut into pieces
     * (whole base64 quads, so each piece is its own bytes), each staged as a
     * blob, and the route joins them back into the file's own blob
     * (`assemble`), unpacking packed text and writing the document's
     * `publishedTo` as it would have in the last request. The pieces are
     * kept out of the commit; the file is the same bytes.
     * `tests/publish-big-picture.mjs`, `tests/publish-big-document.mjs`.
     */
    const splittable = (f: Sent) => (f.encoding === "base64" || f.encoding === "gzip") && !MERGED_FILES.has(f.path);
    const over = files.find((f) => weight(f) > REQUEST_BUDGET && !splittable(f));
    if (over) return { ok: false, reason: "too-big", message: `“${over.path}” is ${(weight(over) / 1e6).toFixed(1)} MB even packed, more than one request to the Builder carries.` };
    const big = files.filter((f) => weight(f) > REQUEST_BUDGET && splittable(f));
    const last = files.filter((f) => COMMITTED_LAST.has(f.path) && !big.includes(f));
    const parts: Sent[][] = [];
    let part: Sent[] = [], size = 0;
    for (const f of files.filter((x) => !COMMITTED_LAST.has(x.path) && !big.includes(x))) {
      if (size + weight(f) > REQUEST_BUDGET && part.length) { parts.push(part); part = []; size = 0; }
      part.push(f);
      size += weight(f);
    }
    if (part.length) parts.push(part);
    for (const p of parts) {
      const got = await carry(p, () => ({ stage: true }));
      if (!got.ok) return failed(got, created);
    }
    /* After the ordinary files, so the repository has something in it to put blobs beside. */
    for (const f of big) {
      const shas: string[] = [];
      for (let at = 0, n = 0; at < f.content.length; at += PIECE, n++) {
        const name = `${f.path}.piece${n}`;
        const got = await carry([{ path: name, content: f.content.slice(at, at + PIECE), encoding: "base64" }], () => ({ stage: true }));
        if (!got.ok) return failed(got, created);
        const sha = staged.get(name);
        staged.delete(name);
        if (!sha) return { ok: false, message: `A piece of “${f.path}” did not go up.` };
        shas.push(sha);
      }
      const got = await carry([], () => ({ stage: true, assemble: [{ path: f.path, parts: shas, ...(f.encoding === "gzip" ? { gzip: true } : {}) }] }));
      if (!got.ok) return failed(got, created);
      if (!staged.has(f.path)) return { ok: false, message: `“${f.path}” could not be put back together.` };
    }
    const done = await carry(last, () => ({ staged: all() }));
    return done.ok ? withCounts({ ...done, ...(created && !done.created ? { created } : {}) }) : failed(done, created);
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed.", reason: "builder-unreachable" };
  }
}
