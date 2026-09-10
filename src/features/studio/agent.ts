"use client";
/**
 * The Builder's side of every server call that reads the site: screenshots
 * of its pages, Claude with the blueprint and those pictures, and the push
 * to GitHub. Each one asks first whether the server can, and says so in
 * words when it cannot, so nothing here is load-bearing.
 */
import { heldKeys, useKeys, vaultExists } from "@/features/keys/store";
import { useStudio, type Revision } from "./store";

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
}

/**
 * A header carrying a key this browser holds, when it holds one and the
 * vault is open. Empty otherwise, and the server's own key wins regardless.
 */
export function keyHeader(): Record<string, string> {
  const held = heldKeys(["ANTHROPIC_API_KEY"]).ANTHROPIC_API_KEY;
  return held ? { "x-anthropic-key": held } : {};
}

/**
 * Where this browser stands with a Claude key: holding one and open, holding
 * one but locked, or holding none. The server's own key is invisible from
 * here and wins regardless; this is only for saying the right thing when a
 * route answers "no key".
 */
export type KeyState = "held" | "locked" | "none";

export function keyState(): KeyState {
  if (heldKeys(["ANTHROPIC_API_KEY"]).ANTHROPIC_API_KEY) return "held";
  const { unlocked, values } = useKeys.getState();
  if (unlocked) return values.ANTHROPIC_API_KEY ? "held" : "none";
  return vaultExists() ? "locked" : "none";
}

/**
 * What to say when a route had no key. A key that is in the vault but behind
 * the PIN is the common case after five quiet minutes, and "Claude isn't set
 * up" would be untrue and unhelpful; say what to press instead.
 */
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

/** One page, photographed on the server with the document in place. Null when the server cannot. */
export async function screenshotPage(pageId: string, opts: { device?: Device; width?: number; signal?: AbortSignal } = {}): Promise<Picture | null> {
  const s = useStudio.getState();
  const page = s.pages.find((p) => p.id === pageId) ?? s.pages[0];
  if (!page) return null;
  const path = "/builder/preview" + (page.path === "/" ? "" : page.path);
  const res = await fetch("/api/studio/screenshot", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ doc: studioDoc(), path, device: opts.device ?? "desktop", width: opts.width }),
    signal: opts.signal,
  });
  if (!(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const blob = await res.blob();
  const dataUrl = await blobToDataUrl(blob);
  return {
    data: dataUrl.slice(dataUrl.indexOf(",") + 1),
    mediaType: "image/png",
    label: `Page “${page.name}” (${page.path}), ${opts.device ?? "desktop"} width, top to bottom:`,
    preview: await thumb(dataUrl),
    pageId: page.id,
  };
}

/** The first `limit` pages, photographed in order. Pages the server could not do are left out. */
export async function screenshotPages(limit: number, device: Device, onProgress?: (done: number, total: number) => void, signal?: AbortSignal): Promise<Picture[]> {
  const pages = useStudio.getState().pages.slice(0, Math.max(1, limit));
  const out: Picture[] = [];
  for (let i = 0; i < pages.length; i++) {
    signal?.throwIfAborted();
    const p = await screenshotPage(pages[i]!.id, { device, signal }).catch(() => null);
    if (p) out.push(p);
    onProgress?.(i + 1, pages.length);
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Claude                                                              */
/* ------------------------------------------------------------------ */

export type AskResult =
  | { ok: true; text: string; model?: string; pictures: number; truncated: boolean; files: GeneratedFile[]; /** Findings with the prompt that settles each, from critique, fill and finish. */ revisions: Revision[] }
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

export async function askClaude(
  input: { markdown: string; mode: AskMode; prompt?: string; pictures?: Picture[] },
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
    let data: { ok?: boolean; text?: string; message?: string; reason?: string; pictures?: number; truncated?: boolean; usage?: { model?: string }; revisions?: Revision[] };
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
        ok: true, text: data.text, model: data.usage?.model, pictures: data.pictures ?? 0, truncated: !!data.truncated,
        files: input.mode === "build" ? filesFromMarkdown(data.text) : [],
        revisions: Array.isArray(data.revisions) ? data.revisions : [],
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
  github: { configured: boolean; repo: string | null; branch: string; missing: string[]; allow?: string[] | null };
  vercel: { hook: boolean };
}

export async function publishStatus(): Promise<PublishStatus> {
  try {
    const res = await fetch("/api/studio/publish", { cache: "no-store" });
    return (await res.json()) as PublishStatus;
  } catch {
    return { github: { configured: false, repo: null, branch: "main", missing: ["unreachable"] }, vercel: { hook: false } };
  }
}

/** The files that make the site: the document the app renders at /site, and the blueprint both ways. */
export function siteFiles(markdown: string, json: string): GeneratedFile[] {
  return [
    { path: "site/document.json", content: JSON.stringify(studioDoc(), null, 2) + "\n" },
    { path: "site/BLUEPRINT.md", content: markdown.endsWith("\n") ? markdown : markdown + "\n" },
    { path: "site/blueprint.json", content: json.endsWith("\n") ? json : json + "\n" },
  ];
}

export type PublishResult =
  | { ok: true; sha: string; commitUrl: string; branch: string; repo: string; files: number; deployed: boolean; hook: boolean; deployNote?: string }
  | { ok: false; message: string; reason?: string };

/* ------------------------------------------------------------------ */
/* Going live                                                          */
/* ------------------------------------------------------------------ */

/** The Vercel token this browser holds, when the vault is open and holds one. */
function vercelHeader(): Record<string, string> {
  const held = heldKeys(["VERCEL_TOKEN"]).VERCEL_TOKEN;
  return held ? { "x-vercel-token": held } : {};
}

/** The team the vault names, when it names one. Not a secret; it is part of the address. */
function heldTeam(): string | undefined {
  return heldKeys(["VERCEL_TEAM"]).VERCEL_TEAM || undefined;
}

export interface DeployStatus {
  configured: boolean;
  source: "server" | "browser" | null;
  repo: string | null;
  hook: boolean;
}

/** Can this put the site live at all — and off whose token? */
export async function deployStatus(): Promise<DeployStatus> {
  try {
    const res = await fetch("/api/studio/deploy", { cache: "no-store", headers: vercelHeader() });
    return (await res.json()) as DeployStatus;
  } catch {
    return { configured: false, source: null, repo: null, hook: false };
  }
}

export type DeployStart =
  | { ok: true; id: string; project: string; repo: string; branch: string; team: string | null; state: string; url: string | null; inspectorUrl: string | null }
  | { ok: false; message: string; reason?: string };

/** Ask Vercel to build the repository's branch. Returns as soon as it is queued. */
export async function deploy(input: { repo?: string; branch?: string; project?: string; team?: string } = {}): Promise<DeployStart> {
  try {
    const res = await fetch("/api/studio/deploy", {
      method: "POST",
      headers: { "content-type": "application/json", ...vercelHeader() },
      body: JSON.stringify({ ...input, team: input.team ?? heldTeam() }),
    });
    const data = (await res.json()) as DeployStart;
    return data.ok ? data : { ok: false, message: data.message ?? "The deploy failed.", reason: data.reason };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed." };
  }
}

export interface DeployState {
  ok: boolean;
  state: string;
  done: boolean;
  url: string | null;
  inspectorUrl: string | null;
  message?: string;
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
      const res = await fetch(`/api/studio/deploy?${query}`, { cache: "no-store", headers: vercelHeader(), signal: opts.signal });
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

export async function publish(input: { files: GeneratedFile[]; message: string; deploy: boolean; repo?: string; branch?: string }): Promise<PublishResult> {
  try {
    const res = await fetch("/api/studio/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        files: input.files.map((f) => ({ path: f.path, content: f.content })),
        message: input.message,
        deploy: input.deploy,
        // Which site this is. The server decides whether it may go there.
        ...(input.repo ? { repo: input.repo } : {}),
        ...(input.branch ? { branch: input.branch } : {}),
      }),
    });
    const data = (await res.json()) as PublishResult;
    return data.ok ? data : { ok: false, message: data.message ?? "The publish failed.", reason: data.reason };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed." };
  }
}
