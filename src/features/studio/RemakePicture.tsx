"use client";
/**
 * REMAKE THIS PICTURE: one prompt, the picture that is there as the
 * reference, and the new one in its place at exactly its size.
 *
 * The owner's words: "right-click any image on the site, type one prompt,
 * make that image an instant reference, and by default have GPT Image 2
 * regenerate it with the prompt, replacing it at the exact same dimensions,
 * with the same purpose and animations."
 *
 * Doors in: the wheel's tray under any part that holds a picture
 * (`RadialMenu.tsx`), and a right-click on its row in the parts tree
 * (`PartTreePanel.tsx`). Both open the one card here.
 *
 * What happens:
 *   1. the picture's own file is read from the browser's picture store and
 *      sent, with the prompt, to `/api/studio/remake`, which hands it to
 *      OpenAI's image edit call as the reference (the person's own key);
 *   2. the answer is fitted to the original's exact pixel width and height:
 *      scaled to cover, the overhang taken equally from both sides so the
 *      middle stays put, see-through where the original was see-through;
 *   3. it is kept as a file (`pictures.ts`), the document holding its path
 *      only, and put on the same part in place of the old one. Nothing else
 *      on the part is touched, so its place, size, link, clip, motion, hover
 *      and press are what they were; its words for people who cannot see it
 *      are kept, and the card offers the prompt instead;
 *   4. the old picture is kept too, in the part's versions (`pictureVersions`),
 *      original first, so the part panel can switch back, and Undo (one step,
 *      the same as any edit) puts the original back.
 *
 * While it works the part says so, with Cancel, and Cancel reaches OpenAI.
 */
import * as React from "react";
import { Loader2, RotateCcw, Sparkles, X } from "lucide-react";
import { useStudio, type StudioNode } from "./board/store";
import { bytesFor, put as putPicture, usePicture, type Picture } from "./pictures";
import { coverCrop, DEFAULT_REMAKE_MODEL, KEEP_VERSIONS, modelLabel, REMAKE_MODEL_SETTING } from "./remake";
import { heldKeys } from "@/features/keys/store";
import { getSetting } from "@/core/settings/store";
import { play } from "@/core/audio/engine";
import { cn } from "@/core/lib/cn";

/* ------------------------------------------------------------------ */
/* What is open, and what is running                                   */
/* ------------------------------------------------------------------ */

type Running = { phase: string; stop: () => void };
let asking: string | null = null;
const running = new Map<string, Running>();
const watchers = new Set<() => void>();
let tick = 0;
const changed = () => { tick++; watchers.forEach((w) => w()); };
const useTick = () => React.useSyncExternalStore((w) => { watchers.add(w); return () => { watchers.delete(w); }; }, () => tick, () => 0);

/** Open the card for this part. */
export function openRemake(nodeId: string) {
  asking = nodeId;
  play("open");
  changed();
}

/** Whether a part holds a picture that can be remade. */
export function canRemake(node: Pick<StudioNode, "picture"> | null | undefined): boolean {
  return !!node?.picture;
}

/** The model the person chose in Settings, or GPT Image 2. */
export function remakeModel(): string {
  return getSetting<string>(REMAKE_MODEL_SETTING) || DEFAULT_REMAKE_MODEL;
}

function openaiHeader(): Record<string, string> {
  const k = heldKeys(["OPENAI_API_KEY"]).OPENAI_API_KEY;
  return k ? { "x-openai-key": k } : {};
}

/* ------------------------------------------------------------------ */
/* The picture's own pixels                                            */
/* ------------------------------------------------------------------ */

async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob);
}

/** Whether any pixel of the picture is less than opaque: a picture with a clear background keeps one. */
function seeThrough(img: ImageBitmap): boolean {
  const w = Math.min(img.width, 512), h = Math.min(img.height, 512);
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext("2d")!;
  g.drawImage(img, 0, 0, w, h);
  const d = g.getImageData(0, 0, w, h).data;
  for (let i = 3; i < d.length; i += 4) if (d[i]! < 250) return true;
  return false;
}

const dataUrl = (blob: Blob) => new Promise<string>((done, no) => {
  const r = new FileReader();
  r.onload = () => done(String(r.result));
  r.onerror = () => no(r.error ?? new Error("Could not read the picture."));
  r.readAsDataURL(blob);
});

/** The answer, at exactly the original's size: covered, the overhang taken equally from both sides. */
async function fit(answer: Blob, w: number, h: number, type: string, clear: boolean): Promise<Blob> {
  const img = await decode(answer);
  const c = new OffscreenCanvas(w, h);
  const g = c.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  const k = coverCrop(img.width, img.height, w, h);
  g.drawImage(img, k.sx, k.sy, k.sw, k.sh, 0, 0, w, h);
  /* A clear original stays able to be clear: never a jpeg, which has no clear. */
  const out = clear ? (type === "image/webp" ? "image/webp" : "image/png") : /^image\/(png|jpeg|webp)$/.test(type) ? type : "image/png";
  return c.convertToBlob({ type: out, quality: 0.95 });
}

/* ------------------------------------------------------------------ */
/* One remake                                                          */
/* ------------------------------------------------------------------ */

export type RemakeAnswer = { ok: true; picture: Picture; model: string; label: string; said: string | null } | { ok: false; message: string; cancelled?: boolean };

export async function remake(nodeId: string, prompt: string): Promise<RemakeAnswer> {
  const node = useStudio.getState().nodes.find((n) => n.id === nodeId);
  const pic = node?.picture;
  if (!node || !pic) return { ok: false, message: "This part holds no picture to remake." };
  const stop = new AbortController();
  const step = (phase: string) => { running.set(nodeId, { phase, stop: () => stop.abort() }); changed(); };
  step("Reading the picture…");
  try {
    const blob = await bytesFor(pic);
    if (!blob) return { ok: false, message: "This picture is not in this browser any more, so there is nothing to send as the reference. Choose it again first." };
    const img = await decode(blob);
    /* The exact size is the picture's own pixels, never the box it is shown in. */
    const w = pic.w || img.width, h = pic.h || img.height;
    const clear = seeThrough(img);
    step("Asking OpenAI…");
    const res = await fetch("/api/studio/remake", {
      method: "POST",
      headers: { "content-type": "application/json", ...openaiHeader() },
      body: JSON.stringify({ prompt, image: await dataUrl(blob), w, h, transparent: clear, model: remakeModel() }),
      signal: stop.signal,
    });
    const r = (await res.json()) as { ok: boolean; message?: string; image?: string; model?: string; label?: string; said?: string | null };
    if (!r.ok || !r.image) return { ok: false, message: r.message ?? "OpenAI did not send a picture back." };
    step("Fitting it to the exact size…");
    const answer = await (await fetch(r.image)).blob();
    const made = await putPicture(await fit(answer, w, h, pic.type, clear), { alt: pic.alt, from: "drawn" });
    /* The part keeps everything but the picture: its place, size, link, clip, motion, hover and press. */
    const now = useStudio.getState().nodes.find((n) => n.id === nodeId);
    if (!now) return { ok: false, message: "The part was removed while the picture was being made." };
    const before = now.pictureVersions?.length ? now.pictureVersions : [now.picture ?? pic];
    const versions = [...before.filter((v) => v.id !== made.id), made];
    /* The original is always kept; past that, the newest. */
    const kept = versions.length > KEEP_VERSIONS ? [versions[0]!, ...versions.slice(-(KEEP_VERSIONS - 1))] : versions;
    useStudio.getState().updateNode(nodeId, { picture: made, pictureVersions: kept });
    play("confirm");
    return { ok: true, picture: made, model: r.model ?? remakeModel(), label: r.label ?? modelLabel(r.model ?? remakeModel()), said: r.said ?? null };
  } catch (err) {
    if (stop.signal.aborted) return { ok: false, cancelled: true, message: "Cancelled. The picture is as it was." };
    return { ok: false, message: err instanceof Error ? `It did not work: ${err.message}` : "It did not work." };
  } finally {
    running.delete(nodeId);
    changed();
  }
}

/* ------------------------------------------------------------------ */
/* On the part: progress, with Cancel                                  */
/* ------------------------------------------------------------------ */

export function RemakeOnPart({ nodeId }: { nodeId: string }) {
  useTick();
  /* Drawn inside the zoomed board: held at its own size, so it reads at any zoom. */
  const zoom = useStudio((s) => s.zoom);
  const run = running.get(nodeId);
  if (!run) return null;
  return (
    <div data-remake-running={nodeId} className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-black/45 backdrop-blur-[1px]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-2 rounded-md border border-border bg-panel/95 px-2.5 py-1.5 text-small text-fg shadow-lg" style={{ transform: `scale(${1 / Math.max(0.2, zoom || 1)})` }}>
        <Loader2 className="size-3.5 animate-spin text-accent" />
        <span data-remake-phase="">{run.phase}</span>
        <button type="button" data-remake-cancel="" onClick={(e) => { e.stopPropagation(); play("close"); run.stop(); }} className="tactile rounded-sm border border-border px-1.5 py-0.5 text-fine text-fg-muted hover:text-fg">
          Cancel
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The card                                                            */
/* ------------------------------------------------------------------ */

type Probe = { state: "looking" } | { state: "ready"; label: string; said: string | null } | { state: "no-key"; message: string } | { state: "trouble"; message: string };

export function RemakeCard() {
  useTick();
  const nodeId = asking;
  const node = useStudio((s) => (nodeId ? s.nodes.find((n) => n.id === nodeId) ?? null : null));
  const [prompt, setPrompt] = React.useState("");
  const [probe, setProbe] = React.useState<Probe>({ state: "looking" });
  const [done, setDone] = React.useState<RemakeAnswer | null>(null);
  const [busy, setBusy] = React.useState(false);
  const { src } = usePicture(node?.picture ?? null);

  /* Before anything is drawn: whose key, which model, or how to add a key. */
  React.useEffect(() => {
    if (!nodeId) return;
    setPrompt(""); setDone(null); setBusy(false); setProbe({ state: "looking" });
    let live = true;
    void fetch("/api/studio/remake", { method: "POST", headers: { "content-type": "application/json", ...openaiHeader() }, body: JSON.stringify({ probe: true, model: remakeModel() }) })
      .then((r) => r.json())
      .then((r: { ok: boolean; reason?: string; message?: string; label?: string; said?: string | null }) => {
        if (!live) return;
        if (r.ok) setProbe({ state: "ready", label: r.label ?? modelLabel(remakeModel()), said: r.said ?? null });
        else if (r.reason === "no-key") setProbe({ state: "no-key", message: r.message ?? "No OpenAI key yet." });
        else setProbe({ state: "trouble", message: r.message ?? "OpenAI could not be asked." });
      })
      .catch(() => { if (live) setProbe({ state: "trouble", message: "The server could not be reached." }); });
    return () => { live = false; };
  }, [nodeId]);

  React.useEffect(() => {
    if (!nodeId) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) { e.stopImmediatePropagation(); asking = null; changed(); } };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [nodeId, busy]);

  if (!nodeId || !node) return null;
  const close = () => { asking = null; play("close"); changed(); };
  const go = async () => {
    const say = prompt.trim();
    if (!say || busy) return;
    setBusy(true);
    setDone(null);
    const answer = await remake(node.id, say);
    setBusy(false);
    setDone(answer);
  };
  const alt = node.picture?.alt ?? "";

  return (
    <div data-remake-card={node.id} role="dialog" aria-label="Remake this picture" className="fixed bottom-24 left-1/2 z-[70] w-[min(460px,94vw)] -translate-x-1/2 rounded-lg border border-border bg-panel p-3 shadow-2xl">
      <div className="mb-2 flex items-center gap-2">
        <Sparkles className="size-4 text-accent" />
        <h2 className="min-w-0 flex-1 truncate text-plain font-semibold text-fg">Remake this picture…</h2>
        <button type="button" aria-label="Close" onClick={close} className="tactile rounded-sm p-0.5 text-fg-muted hover:text-fg"><X className="size-4" /></button>
      </div>
      <div className="flex gap-3">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="size-16 shrink-0 rounded-sm border border-border object-cover" />
        ) : null}
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-small leading-snug text-fg-muted">
            This picture is sent as the reference with what you write. The new one takes its place at exactly {node.picture?.w}×{node.picture?.h} pixels; the part keeps its place, size, link, motion and clip.
          </p>
          <textarea
            data-remake-prompt=""
            autoFocus
            rows={2}
            value={prompt}
            disabled={busy}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void go(); } }}
            placeholder="What it should be now, for example: the same orb at night, lit in blue"
            className="w-full resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-plain text-fg outline-none focus:border-accent"
          />
        </div>
      </div>
      <p data-remake-model="" className={cn("mt-2 text-small leading-snug", probe.state === "no-key" || probe.state === "trouble" ? "text-warn" : "text-fg-muted")}>
        {probe.state === "looking" ? "Checking your OpenAI key…"
          : probe.state === "ready" ? <>Made with {probe.label}, on your own OpenAI key, billed to your account.{probe.said ? <> {probe.said}</> : null}</>
            : probe.message}
      </p>
      {done ? (
        <div data-remake-done={done.ok ? "ok" : done.cancelled ? "cancelled" : "no"} className="mt-2 rounded-md border border-border p-2 text-small">
          {done.ok ? (
            <>
              <p className="text-fg">Done. The picture is replaced; Undo brings back the one before.</p>
              {alt !== prompt.trim() ? (
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-fg-muted">
                  <span>Its words for people who cannot see it are still “{alt || "none"}”.</span>
                  <button
                    type="button"
                    data-remake-alt=""
                    onClick={() => {
                      const n = useStudio.getState().nodes.find((x) => x.id === node.id);
                      if (!n?.picture) return;
                      const picture = { ...n.picture, alt: prompt.trim() };
                      useStudio.getState().updateNode(node.id, { picture, pictureVersions: (n.pictureVersions ?? []).map((v) => (v.id === picture.id ? picture : v)) });
                      play("confirm");
                    }}
                    className="tactile rounded-sm border border-border px-1.5 py-0.5 text-fg hover:border-accent"
                  >
                    Use what I wrote instead
                  </button>
                </div>
              ) : null}
            </>
          ) : <p className={done.cancelled ? "text-fg-muted" : "text-warn"}>{done.message}</p>}
        </div>
      ) : null}
      <div className="mt-2 flex items-center justify-end gap-2">
        <button type="button" onClick={close} className="tactile rounded-md px-2.5 py-1 text-small text-fg-muted hover:text-fg">{done?.ok ? "Close" : "Not now"}</button>
        <button
          type="button"
          data-remake-go=""
          disabled={busy || !prompt.trim() || probe.state === "no-key"}
          onClick={() => void go()}
          className="tactile flex items-center gap-1.5 rounded-md bg-accent px-3 py-1 text-small font-medium text-accent-fg disabled:opacity-40"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
          {done?.ok ? "Remake again" : "Remake"}
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* The part panel's strip of versions                                  */
/* ------------------------------------------------------------------ */

function Thumb({ pic, on, first, onPick }: { pic: Picture; on: boolean; first: boolean; onPick: () => void }) {
  const { src } = usePicture(pic);
  return (
    <button
      type="button"
      data-picture-version={pic.id}
      aria-pressed={on}
      title={first ? "The original" : pic.alt || "A remake"}
      onClick={onPick}
      className={cn("tactile relative size-11 shrink-0 overflow-hidden rounded-sm border", on ? "border-accent ring-1 ring-accent" : "border-border opacity-80 hover:opacity-100")}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="size-full object-cover" />
      ) : <span className="text-fine text-fg-faint">…</span>}
      {first ? <span className="absolute inset-x-0 bottom-0 bg-black/60 text-center text-fine leading-tight text-white">original</span> : null}
    </button>
  );
}

/** Original and remakes, newest last: press one to wear it. */
export function PictureVersions({ node }: { node: StudioNode }) {
  const versions = node.pictureVersions ?? [];
  if (versions.length < 2) return null;
  return (
    <div data-picture-versions={versions.length} className="space-y-1">
      <div className="flex items-center gap-1.5 text-fine text-fg-faint"><RotateCcw className="size-3" /> Versions: the original and each remake</div>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {versions.map((v, i) => (
          <Thumb key={v.id} pic={v} first={i === 0} on={node.picture?.id === v.id} onPick={() => { play("select"); useStudio.getState().updateNode(node.id, { picture: v }); }} />
        ))}
      </div>
    </div>
  );
}

/** Whether a picture is one of the part's kept versions, so replacing it must not throw its file away. */
export function isKeptVersion(node: Pick<StudioNode, "pictureVersions">, pic: Picture | null | undefined): boolean {
  return !!pic && !!node.pictureVersions?.some((v) => v.id === pic.id);
}
