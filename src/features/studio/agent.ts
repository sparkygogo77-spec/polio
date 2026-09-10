"use client";
/**
 * The Builder's side of every server call that reads the site: screenshots
 * of its pages, Claude with the blueprint and those pictures, and the push
 * to GitHub. Each one asks first whether the server can, and says so in
 * words when it cannot, so nothing here is load-bearing.
 */
import { heldKeys } from "@/features/keys/store";
import { useStudio } from "./store";

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

let shotsAvailable: { at: number; value: boolean } | null = null;

/** Can the server open the site in a browser? Asked once a minute at most. */
export async function screenshotsAvailable(force = false): Promise<boolean> {
  if (!force && shotsAvailable && Date.now() - shotsAvailable.at < 60_000) return shotsAvailable.value;
  try {
    const res = await fetch("/api/studio/screenshot", { cache: "no-store" });
    const data = (await res.json()) as { available?: boolean };
    shotsAvailable = { at: Date.now(), value: !!data.available };
  } catch {
    shotsAvailable = { at: Date.now(), value: false };
  }
  return shotsAvailable.value;
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
  | { ok: true; text: string; model?: string; pictures: number; truncated: boolean; files: GeneratedFile[] }
  | { ok: false; message: string; reason?: string };

export async function askClaude(input: { markdown: string; mode: AskMode; prompt?: string; pictures?: Picture[] }): Promise<AskResult> {
  try {
    const res = await fetch("/api/studio/generate", {
      method: "POST",
      headers: { "content-type": "application/json", ...keyHeader() },
      body: JSON.stringify({
        markdown: input.markdown,
        mode: input.mode,
        prompt: input.prompt ?? "",
        pictures: (input.pictures ?? []).map((p) => ({ data: p.data, mediaType: p.mediaType, label: p.label })),
      }),
    });
    const data = (await res.json()) as { ok: boolean; text?: string; message?: string; reason?: string; pictures?: number; truncated?: boolean; usage?: { model?: string } };
    if (data.ok && typeof data.text === "string") {
      return { ok: true, text: data.text, model: data.usage?.model, pictures: data.pictures ?? 0, truncated: !!data.truncated, files: input.mode === "build" ? filesFromMarkdown(data.text) : [] };
    }
    return { ok: false, message: data.message ?? "Couldn't reach Claude.", reason: data.reason };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed." };
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
  github: { configured: boolean; repo: string | null; branch: string; missing: string[] };
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

export async function publish(input: { files: GeneratedFile[]; message: string; deploy: boolean }): Promise<PublishResult> {
  try {
    const res = await fetch("/api/studio/publish", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ files: input.files.map((f) => ({ path: f.path, content: f.content })), message: input.message, deploy: input.deploy }),
    });
    const data = (await res.json()) as PublishResult;
    return data.ok ? data : { ok: false, message: data.message ?? "The publish failed.", reason: data.reason };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Request failed." };
  }
}
