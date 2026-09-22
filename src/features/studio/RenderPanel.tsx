"use client";
/**
 * Replicate, in the Builder, with his five controls and no sixth.
 *
 * HIS WORDS: "provide a panel tab where i can use replicate models exactly as
 * i do on their site, with only the mentions i asked for of image, option to
 * tweak, aspect ratio, quality, effort, and model choice."
 *
 * So: the image is what comes back, and the five things he can say about it
 * are the tweak, the aspect ratio, the quality, the effort and which model
 * runs it. Nothing else is offered — no seed, no steps, no guidance, no
 * negative prompt, no count — because he named five and a panel that grows a
 * sixth on its own is the panel he was complaining about.
 *
 * A ratio, a quality or an effort is only offered when the chosen model's own
 * table says it takes one, so the list is never a lie about what that model
 * will do. Everything is read from `imageRoute.ts`; no model and no field is
 * named in this file.
 *
 * His key, from the Keys panel, rides with the call and is never stored here.
 * The price is shown before the press, and what it really cost replaces it
 * afterwards.
 */
import * as React from "react";
import { Copy, ImageIcon, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Select } from "@/core/ui/select";
import { Textarea } from "@/core/ui/textarea";
import { effortField, modelTable, type ModelCard } from "./imageRoute";
import { rendererHeader } from "./agent";
import { money, RENDER_COST } from "./renderer";
import { GENERATION } from "./threads";
import { useStudio } from "./store";

/**
 * The models that DRAW a picture, which is what this panel is for.
 *
 * HIS WORDS: "background remover option also did not work, i think that just
 * telling the bot to empty the background is sufficient in the prompt. remove
 * background remover option."
 *
 * It is gone, and gone by a rule rather than by name: a remover returns a
 * picture but it never serves the step that MAKES one — its row says it
 * serves `alpha` and nothing else. So the panel asks the table for the models
 * that can draw first, and anything that only edits what it is handed falls
 * out on its own. The remover is still there for the part-making route's
 * alpha step, which is a different lane and not what he was using.
 */
function drawingModels(): ModelCard[] {
  return modelTable().models.filter((m) => m.returns === "picture" && m.serves.some((x) => x.step === "first" && x.makings.length > 0));
}

/**
 * The values a named field will take, or nothing when the model has no such
 * field.
 *
 * All three lists come from the model's own row, so the panel can never offer
 * a ratio, a quality or an effort that the model he has chosen would refuse.
 */
function choices(card: ModelCard | undefined, name: string): string[] {
  const f = card?.fields.find((x) => x.name === name);
  return f && f.kind === "enum" ? [...(f.values ?? [])] : [];
}

export function RenderPanel() {
  const models = React.useMemo(drawingModels, []);
  const [slug, setSlug] = React.useState(models[0]?.slug ?? "");
  const card = models.find((m) => m.slug === slug);
  const [tweak, setTweak] = React.useState("");
  const [ratio, setRatio] = React.useState("");
  const [quality, setQuality] = React.useState("");
  const [effort, setEffort] = React.useState("");
  /* How many are out at once. Not a lock: he may queue as many as he likes,
     and this only says whether anything is still working. */
  const [running, setRunning] = React.useState(0);
  const [said, setSaid] = React.useState<string | null>(null);
  const [format, setFormat] = React.useState("");
  /*
   * The pictures it works from, not the picture.
   *
   * HIS WORDS: "just make the input images allow multiple, as well as be drag
   * and droppable or pastable". A model's own row says how many it will take,
   * so the box stops accepting at that number rather than sending more than
   * the model would keep.
   */
  const [references, setReferences] = React.useState<string[]>([]);
  const picker = React.useRef<HTMLInputElement>(null);
  /** Whether a file is being held over the box, so the box can say so. */
  const [over, setOver] = React.useState(false);
  /** Which picture was just copied, so the control can say it happened. */
  const [copied, setCopied] = React.useState<string | null>(null);
  /*
   * The work lives in the document, not in this component.
   *
   * "stepping out of the tab resets the tab completely while below i would
   * want my previous works to continue as well as the option for a new
   * image." A panel that holds its own results loses them the moment it
   * unmounts, which is what leaving the tab does. So the panel is a view of
   * what the document holds, and the newest is simply the first of them.
   */
  const draws = useStudio((st) => st.draws);
  const addDraw = useStudio((st) => st.addDraw);
  /*
   * A generation is a job like any other job.
   *
   * HIS WORDS: "I should be able to queue multiple images, and these image
   * generations should appear in my timeline ... they should be queued like
   * any other generation being made in the builder."
   *
   * So pressing it lands an iteration straight away, running, and the picture
   * fills it in when it arrives — the same shape a drawing being made real
   * has. Nothing is awaited in the press, so a second press while the first
   * is still out queues a second one rather than being refused.
   */
  const landThread = useStudio((st) => st.landThread);
  const markThread = useStudio((st) => st.markThread);
  const noteProgress = useStudio((st) => st.noteProgress);

  const ratios = choices(card, "aspect_ratio");
  const qualities = choices(card, "quality");
  /*
   * EFFORT IS WHATEVER THIS MODEL CALLS IT. Ideogram calls it `thinking`;
   * nothing else that draws a picture has one, and those models are not
   * offered a slider that goes nowhere. The label stays his word for it.
   */
  const effortOn = card ? effortField(card) : null;
  const efforts = effortOn && effortOn.kind === "enum" ? [...(effortOn.values ?? [])] : [];

  /** How many pictures this model will take. One, unless its row says more. */
  const mostPictures = Math.max(1, card?.references ?? 1);

  /**
   * Take pictures in, however they arrived.
   *
   * Three doors and one handler: the + box's picker, a drop, and a paste.
   * They add rather than replace — "beside it rather than instead of it" is
   * the whole of "allow multiple" — and they stop at what the model takes,
   * quietly, because a picture silently sent to a model that discards it is
   * money spent on nothing.
   */
  const take = React.useCallback((files: FileList | File[] | null | undefined) => {
    const pics = [...(files ?? [])].filter((f) => f.type.startsWith("image/"));
    if (!pics.length) return;
    for (const f of pics) {
      const r = new FileReader();
      r.onload = () => setReferences((was) => (was.length >= mostPictures ? was : [...was, String(r.result)]));
      r.readAsDataURL(f);
    }
  }, [mostPictures]);

  /*
   * A paste is not a drop and does not land on anything in particular, so it
   * is listened for on the panel rather than on one box. Only while the panel
   * is open, and only when what was pasted is a picture — pasting words into
   * the prompt is still pasting words into the prompt.
   */
  React.useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const files = [...(e.clipboardData?.files ?? [])];
      if (!files.some((f) => f.type.startsWith("image/"))) return;
      e.preventDefault();
      take(files);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [take]);

  /* A ratio that the model he has just picked does not offer is dropped
     rather than sent: the list is what that model will actually take. */
  React.useEffect(() => {
    if (ratio && !ratios.includes(ratio)) setRatio("");
    if (quality && !qualities.includes(quality)) setQuality("");
    if (effort && !efforts.includes(effort)) setEffort("");
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    const asked = tweak.trim();
    if (!asked) return;
    /* The iteration exists from the press, not from the answer: that is what
       puts it on the timeline while it is still working. */
    const threadId = landThread({ mode: GENERATION, model: slug, ask: asked, answer: "", state: "running" });
    setRunning((n) => n + 1);
    setSaid(null);
    try {
      /* It has been sent and is out with the model. There is nothing finer to
         report — Replicate gives no progress — so the bar says "gone, waiting"
         rather than inventing a percentage. */
      noteProgress(threadId, 0.35);
      const res = await fetch("/api/studio/image", {
        method: "POST",
        headers: { "content-type": "application/json", ...rendererHeader() },
        /* `frame` is not sent, so nothing is added to what he typed. */
        body: JSON.stringify({
          kind: "raster", prompt: tweak.trim(), w: 1024, h: 1024, model: slug,
          ratio: ratio || undefined, quality: quality || undefined, effort: effort || undefined,
          format: format || undefined, references: references.length ? references : undefined,
        }),
      });
      const r = (await res.json()) as { ok?: boolean; image?: string; cost?: number | null; message?: string };
      if (r.ok && r.image) {
        /* Kept here first. The picture outlives its box on the timeline: he
           can delete the iteration and the picture is still his. */
        addDraw({ prompt: asked, model: slug, ratio: ratio || undefined, quality: quality || undefined, effort: effort || undefined, format: format || undefined, reference: references[0], image: r.image, cost: r.cost ?? null, threadId });
        markThread(threadId, "done");
        setSaid(typeof r.cost === "number" ? `Drawn. It cost ${money(r.cost)}.` : "Drawn. The renderer reported no price for it.");
      } else {
        markThread(threadId, "cut");
        setSaid(r.message ?? "Nothing came back.");
      }
    } catch (err) {
      markThread(threadId, "cut");
      setSaid(`Could not reach the renderer: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRunning((n) => Math.max(0, n - 1));
    }
  };

  /* The mark goes on the wrapper, not on the Select: `Select` does not
     forward unknown props, so a `data-` on it never reached the page and a
     check looking for the control found a bare button instead. */
  const Row = ({ label, mark, children }: { label: string; mark: string; children: React.ReactNode }) => (
    <label data-render-row={mark} className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="text-plain text-fg-muted">{label}</span>
      <span {...{ [`data-render-${mark}`]: "" }} className="shrink-0">{children}</span>
    </label>
  );

  return (
    <div data-render-panel="" className="flex min-h-0 flex-col">
      {/* THE SLOT FOR THE NEXT ONE, and the picture it works from. */}
      <div data-render-image="" className="m-3 grid aspect-square place-items-center overflow-hidden rounded-sm border border-border bg-panel/60">
        {references[0] ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL he chose
          <img src={references[0]} alt="" data-render-reference-shown="" className="size-full object-contain opacity-80" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-plain text-fg-faint">
            <ImageIcon className="size-5" />
            A new one
          </span>
        )}
      </div>

      {/* TWEAK IT */}
      <div className="px-3">
        <Textarea
          data-render-tweak=""
          rows={3}
          value={tweak}
          placeholder="Say what to draw, or tweak what came back."
          onChange={(e) => setTweak(e.target.value)}
        />
      </div>

      {/* MODEL CHOICE */}
      <Row label="Model" mark="model">
        <Select value={slug} onChange={(v) => setSlug(String(v))} options={models.map((m) => ({ value: m.slug, label: m.name }))} />
      </Row>

      {/*
        INPUT IMAGES — as many as the model takes, by drop, by paste, or by
        pressing the + box.

        HIS WORDS: "there should be an input images section with just a + box
        to add and drop pictures instead of choose file which should pop up if
        that box is clicked." The file field is still there, because it is the
        only thing that can open a picker, and it is not on the face of it:
        the + box is what you see and what you drop on, and pressing it opens
        the picker.
      */}
      <div
        data-render-inputs=""
        className="px-3 pb-1 pt-1.5"
        onDragOver={(e) => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; setOver(true); } }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files); }}
      >
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-plain text-fg-muted">Input images</span>
          {/* What this model will take, said before he fills it rather than
              after it refuses one. */}
          <span data-render-inputs-count="" className="num text-small text-fg-faint">
            {references.length ? `${references.length} of ${mostPictures}` : mostPictures > 1 ? `up to ${mostPictures}` : "one"}
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {references.map((src, i) => (
            <span key={`${i}-${src.slice(-24)}`} data-render-input={i} className="group relative size-12 overflow-hidden rounded-sm border border-border bg-panel/60">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL he chose */}
              <img src={src} alt="" className="size-full object-cover" />
              <button
                type="button"
                data-render-input-drop={i}
                aria-label="Take this picture out"
                onClick={() => setReferences((was) => was.filter((_, j) => j !== i))}
                className="tactile absolute right-0 top-0 grid size-4 place-items-center rounded-bl-sm border-b border-l border-border bg-panel/90 leading-none text-fg-muted opacity-0 group-hover:opacity-100"
              >
                <X className="size-2.5" />
              </button>
            </span>
          ))}
          {references.length < mostPictures ? (
            <button
              type="button"
              data-render-add=""
              aria-label="Add a picture to work from"
              onClick={() => picker.current?.click()}
              className={cn(
                "tactile grid size-12 place-items-center rounded-sm border border-dashed text-fg-faint hover:text-fg",
                over ? "border-accent bg-accent-soft text-fg" : "border-border bg-panel/40",
              )}
            >
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
        <input
          ref={picker}
          data-render-reference=""
          type="file"
          accept="image/*"
          multiple={mostPictures > 1}
          className="sr-only"
          onChange={(e) => { take(e.target.files); e.target.value = ""; }}
        />
      </div>

      {/* WHAT COMES BACK */}
      <Row label="Output" mark="format">
        <Select value={format} onChange={(v) => setFormat(String(v))} options={[{ value: "", label: "Its own" }, { value: "webp", label: "WebP" }, { value: "png", label: "PNG" }, { value: "jpeg", label: "JPEG" }]} />
      </Row>

      {/* ASPECT RATIO */}
      {ratios.length ? (
        <Row label="Aspect ratio" mark="ratio">
          <Select value={ratio} onChange={(v) => setRatio(String(v))} options={[{ value: "", label: "Its own" }, ...ratios.map((r: string) => ({ value: r, label: r }))]} />
        </Row>
      ) : null}

      {/* QUALITY */}
      {qualities.length ? (
        <Row label="Quality" mark="quality">
          <Select value={quality} onChange={(v) => setQuality(String(v))} options={[{ value: "", label: "Its own" }, ...qualities.map((q: string) => ({ value: q, label: q }))]} />
        </Row>
      ) : null}

      {/* EFFORT */}
      {efforts.length ? (
        <Row label="Effort" mark="effort">
          <Select value={effort} onChange={(v) => setEffort(String(v))} options={[{ value: "", label: "Its own" }, ...efforts.map((e: string) => ({ value: e, label: e }))]} />
        </Row>
      ) : null}

      <div className="flex items-center gap-2 px-3 pb-3 pt-2">
        <Button data-render-go="" variant="primary" size="sm" disabled={!tweak.trim()} onClick={() => void run()}>
          {running ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          Generate
        </Button>
        {/* The price before the press, not after it. It is his key and his
            money, so what it will cost is said before anything is spent, and
            what it actually cost replaces this when the picture comes back. */}
        <span data-render-price="" className="text-small text-fg-faint">
          {said ?? `About ${money(RENDER_COST.raster)} a picture, on your own Replicate key.`}
        </span>
      </div>

      {/*
        EVERYTHING HE HAS MADE, newest first, under the slot for the next one.
        Each one can be downloaded, put back in the box to tweak, run again as
        it stands, or dragged onto the page.
      */}
      {draws.length ? (
        <div data-render-past={draws.length} className="border-t border-border">
          {draws.map((d) => (
            <figure key={d.id} data-render-iteration={d.id} className="m-0 border-b border-border/60 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a data URL, drawn here */}
              <img
                src={d.image}
                alt={d.prompt}
                draggable
                data-render-drag={d.id}
                onDragStart={(e) => {
                  /*
                   * ONE DRAG, TWO DESTINATIONS.
                   *
                   * HIS WORDS: "the output should also be draggable off the
                   * output image onto the web design 1 to 1 or draggable
                   * outside of the website."
                   *
                   * Onto the design: the two kinds a picture dropped on the
                   * board already arrives as, plus the picture's own size, so
                   * the board can land it at the size it really is instead of
                   * guessing a box. Out of the site: `DownloadURL`, which is
                   * what a browser reads when something is dropped on the
                   * desktop — type, name, source, and it writes the file.
                   *
                   * Both are set on the same drag because which one is meant
                   * is decided by where he lets go, not before.
                   */
                  const el = e.currentTarget as HTMLImageElement;
                  const type = /^data:(image\/[a-z0-9.+-]+)/i.exec(d.image)?.[1] ?? "image/webp";
                  const name = `${d.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-") || "drawing"}.${d.format ?? type.split("/")[1] ?? "webp"}`;
                  e.dataTransfer.setData("text/uri-list", d.image);
                  e.dataTransfer.setData("text/plain", d.image);
                  e.dataTransfer.setData("DownloadURL", `${type}:${name}:${d.image}`);
                  e.dataTransfer.setData("application/x-studio-picture", JSON.stringify({
                    src: d.image,
                    w: el.naturalWidth || undefined,
                    h: el.naturalHeight || undefined,
                  }));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="mb-1.5 block aspect-square w-full cursor-grab rounded-sm border border-border object-contain active:cursor-grabbing"
              />
              <figcaption className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-small text-fg-muted" title={d.prompt}>{d.prompt}</span>
                {/*
                  COPIED, not only saved.

                  HIS WORDS: "make the output image generated pastable instead
                  of just a savable file." So the picture goes to the clipboard
                  as a picture — a real blob of its own type, which is what
                  another app pastes — and the address goes with it as text for
                  anything that would rather have that. Saving stays, because
                  he asked for it earlier and both are wanted.
                */}
                <button
                  type="button"
                  data-render-copy={d.id}
                  onClick={async () => {
                    try {
                      const blob = await (await fetch(d.image)).blob();
                      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob, "text/plain": new Blob([d.image], { type: "text/plain" }) })]);
                      setCopied(d.id);
                      window.setTimeout(() => setCopied((was) => (was === d.id ? null : was)), 1400);
                    } catch {
                      /* Some browsers will not write a picture to the clipboard
                         at all. Say so on the control rather than in silence. */
                      setCopied(`${d.id}:no`);
                      window.setTimeout(() => setCopied((was) => (was === `${d.id}:no` ? null : was)), 2200);
                    }
                  }}
                  className="tactile flex items-center gap-0.5 rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg"
                >
                  <Copy className="size-2.5" />
                  {copied === d.id ? "Copied" : copied === `${d.id}:no` ? "Cannot" : "Copy"}
                </button>
                <a data-render-download={d.id} href={d.image} download={`${d.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-") || "drawing"}.${d.format ?? "webp"}`} className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg">Save</a>
                <button type="button" data-render-tweak-from={d.id} onClick={() => { setTweak(d.prompt); setSlug(d.model); if (d.reference) setReferences([d.reference]); }} className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg">Tweak</button>
                <button type="button" data-render-again={d.id} onClick={() => { setTweak(d.prompt); setSlug(d.model); if (d.reference) setReferences([d.reference]); window.setTimeout(() => void run(), 0); }} className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg">Again</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
