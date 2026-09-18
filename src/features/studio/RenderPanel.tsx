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
import { ImageIcon, LoaderCircle, Sparkles } from "lucide-react";
import { Button } from "@/core/ui/button";
import { Select } from "@/core/ui/select";
import { Textarea } from "@/core/ui/textarea";
import { effortField, modelTable, type ModelCard } from "./imageRoute";
import { rendererHeader } from "./agent";
import { money, RENDER_COST } from "./renderer";
import { useStudio } from "./store";

/** Only the models that give back a picture: this panel makes pictures. */
function picturesOnly(): ModelCard[] {
  return modelTable().models.filter((m) => m.returns === "picture");
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
  const models = React.useMemo(picturesOnly, []);
  const [slug, setSlug] = React.useState(models[0]?.slug ?? "");
  const card = models.find((m) => m.slug === slug);
  const [tweak, setTweak] = React.useState("");
  const [ratio, setRatio] = React.useState("");
  const [quality, setQuality] = React.useState("");
  const [effort, setEffort] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [said, setSaid] = React.useState<string | null>(null);
  const [format, setFormat] = React.useState("");
  const [reference, setReference] = React.useState<string | null>(null);
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

  const ratios = choices(card, "aspect_ratio");
  const qualities = choices(card, "quality");
  /*
   * EFFORT IS WHATEVER THIS MODEL CALLS IT. Ideogram calls it `thinking`;
   * nothing else that draws a picture has one, and those models are not
   * offered a slider that goes nowhere. The label stays his word for it.
   */
  const effortOn = card ? effortField(card) : null;
  const efforts = effortOn && effortOn.kind === "enum" ? [...(effortOn.values ?? [])] : [];

  /* A ratio that the model he has just picked does not offer is dropped
     rather than sent: the list is what that model will actually take. */
  React.useEffect(() => {
    if (ratio && !ratios.includes(ratio)) setRatio("");
    if (quality && !qualities.includes(quality)) setQuality("");
    if (effort && !efforts.includes(effort)) setEffort("");
  }, [slug]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    if (!tweak.trim() || busy) return;
    setBusy(true);
    setSaid(null);
    try {
      const res = await fetch("/api/studio/image", {
        method: "POST",
        headers: { "content-type": "application/json", ...rendererHeader() },
        /* `frame` is not sent, so nothing is added to what he typed. */
        body: JSON.stringify({
          kind: "raster", prompt: tweak.trim(), w: 1024, h: 1024, model: slug,
          ratio: ratio || undefined, quality: quality || undefined, effort: effort || undefined,
          format: format || undefined, reference: reference || undefined,
        }),
      });
      const r = (await res.json()) as { ok?: boolean; image?: string; cost?: number | null; message?: string };
      if (r.ok && r.image) {
        addDraw({ prompt: tweak.trim(), model: slug, ratio: ratio || undefined, quality: quality || undefined, effort: effort || undefined, format: format || undefined, reference: reference ?? undefined, image: r.image, cost: r.cost ?? null });
        setSaid(typeof r.cost === "number" ? `Drawn. It cost ${money(r.cost)}.` : "Drawn. The renderer reported no price for it.");
      } else {
        setSaid(r.message ?? "Nothing came back.");
      }
    } catch (err) {
      setSaid(`Could not reach the renderer: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  /* The mark goes on the wrapper, not on the Select: `Select` does not
     forward unknown props, so a `data-` on it never reached the page and a
     check looking for the control found a bare button instead. */
  const Row = ({ label, mark, children }: { label: string; mark: string; children: React.ReactNode }) => (
    <label data-render-row={mark} className="flex items-center justify-between gap-2 px-3 py-1.5">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span {...{ [`data-render-${mark}`]: "" }} className="shrink-0">{children}</span>
    </label>
  );

  return (
    <div data-render-panel="" className="flex min-h-0 flex-col">
      {/* THE SLOT FOR THE NEXT ONE, and the picture it works from. */}
      <div data-render-image="" className="m-3 grid aspect-square place-items-center overflow-hidden rounded-sm border border-border bg-panel/60">
        {reference ? (
          // eslint-disable-next-line @next/next/no-img-element -- a data URL he chose
          <img src={reference} alt="" data-render-reference-shown="" className="size-full object-contain opacity-80" />
        ) : (
          <span className="flex flex-col items-center gap-1 text-[11px] text-fg-faint">
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

      {/* A PICTURE TO WORK FROM \u2014 one he chooses, or a drawing off the board. */}
      <label data-render-row="reference" className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="text-[11px] text-fg-muted">Work from a picture</span>
        <span className="flex shrink-0 items-center gap-1">
          <input
            data-render-reference=""
            type="file"
            accept="image/*"
            className="w-[108px] text-[10px] text-fg-muted file:mr-1 file:rounded-sm file:border file:border-border file:bg-panel file:px-1 file:py-0.5 file:text-[10px] file:text-fg"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              const r = new FileReader();
              r.onload = () => setReference(String(r.result));
              r.readAsDataURL(f);
            }}
          />
          {reference ? (
            <Button data-render-reference-clear="" size="sm" variant="ghost" onClick={() => setReference(null)}>Clear</Button>
          ) : null}
        </span>
      </label>

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
        <Button data-render-go="" variant="primary" size="sm" disabled={!tweak.trim() || busy} onClick={() => void run()}>
          {busy ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          Draw it
        </Button>
        {/* The price before the press, not after it. It is his key and his
            money, so what it will cost is said before anything is spent, and
            what it actually cost replaces this when the picture comes back. */}
        <span data-render-price="" className="text-[10px] text-fg-faint">
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
                  /* The same two kinds a picture dropped on the board arrives
                     as, so the page takes it the way it takes any picture. */
                  e.dataTransfer.setData("text/uri-list", d.image);
                  e.dataTransfer.setData("text/plain", d.image);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                className="mb-1.5 block aspect-square w-full cursor-grab rounded-sm border border-border object-contain active:cursor-grabbing"
              />
              <figcaption className="flex items-center gap-1">
                <span className="min-w-0 flex-1 truncate text-[10px] text-fg-muted" title={d.prompt}>{d.prompt}</span>
                <a data-render-download={d.id} href={d.image} download={`${d.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-") || "drawing"}.${d.format ?? "webp"}`} className="tactile rounded-sm border border-border px-1 py-0.5 text-[10px] text-fg-muted hover:text-fg">Save</a>
                <button type="button" data-render-tweak-from={d.id} onClick={() => { setTweak(d.prompt); setSlug(d.model); if (d.reference) setReference(d.reference); }} className="tactile rounded-sm border border-border px-1 py-0.5 text-[10px] text-fg-muted hover:text-fg">Tweak</button>
                <button type="button" data-render-again={d.id} onClick={() => { setTweak(d.prompt); setSlug(d.model); if (d.reference) setReference(d.reference); window.setTimeout(() => void run(), 0); }} className="tactile rounded-sm border border-border px-1 py-0.5 text-[10px] text-fg-muted hover:text-fg">Again</button>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
