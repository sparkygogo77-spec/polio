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
import { isKeptVersion } from "./RemakePicture";
import * as React from "react";
import { Copy, ImageIcon, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { cn } from "@/core/lib/cn";
import { Button } from "@/core/ui/button";
import { Select } from "@/core/ui/select";
import { Textarea } from "@/core/ui/textarea";
import { effortField, modelTable, type ModelCard } from "./pictures";
import { rendererHeader } from "./loop/run";
import { money } from "./renderer";
import { GENERATION } from "./loop";
import { useStudio } from "./board/store";
import { drop as dropPicture, put as putPicture, usePicture, type Picture } from "./pictures";
import { CURSOR_ASK, cursorFrom, takeCursorAsk } from "./cursorPicture";
import { setCursorPicture } from "./ShelfCards";
import { estimateLine, pictureSeconds, progressOf, SOLID_SECONDS } from "./pictures/estimate";
import { asSolid, onShape, THREE_D, THREE_D_ASK, THREE_D_EVENT, THREE_D_RATIO, type ThreeD } from "./pictures/threeD";
import { askImage } from "./pictures/askImage";
import { usePictureJobs, type Job } from "./pictures/jobs";
import { copyPicture } from "./copyPicture";

/** What draws the views when the chosen model cannot work from a picture. */
const VIEW_MODEL = "openai/gpt-image-2";
const SAME = "The exact same object as in the picture, same design, colours, materials, proportions and style, the whole object in frame and centred, on a plain white background, nothing else in the picture.";
const VIEWS_ASKED: readonly (readonly [string, string])[] = [
  ["back", `${SAME} Seen from directly behind: the back of it.`],
  ["left", `${SAME} Seen from its left side, turned a quarter.`],
  ["right", `${SAME} Seen from its right side, turned a quarter.`],
];
/** A picture as a data URL, whatever it was kept as: a model can only be sent one. */
async function asDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:image/")) return src;
  try {
    const blob = await (await fetch(src)).blob();
    return await new Promise<string>((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = no; r.readAsDataURL(blob); });
  } catch {
    return null;
  }
}

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

/**
 * The drawing tool, on the Pictures tab (`PicturesPanel.tsx`). With
 * `forNode`, the part picked, each picture it draws can be put on that part
 * in one press.
 */
export function RenderPanel({ forNode }: { forNode?: string } = {}) {
  const models = React.useMemo(drawingModels, []);
  const [slug, setSlug] = React.useState(models[0]?.slug ?? "");
  const card = models.find((m) => m.slug === slug);
  const [tweak, setTweak] = React.useState("");
  const [ratio, setRatio] = React.useState("");
  const [quality, setQuality] = React.useState("");
  const [effort, setEffort] = React.useState("");
  /* How many are out at once. Not a lock: he may queue as many as he likes,
     and this only says whether anything is still working. */
  /* Kept outside the panel, so leaving it abandons nothing (`pictures/jobs.ts`). */
  const running = usePictureJobs((st) => st.running);
  const setRunning = usePictureJobs((st) => st.setRunning);
  const said = usePictureJobs((st) => st.said);
  const setSaid = usePictureJobs((st) => st.setSaid);
  const [format, setFormat] = React.useState("");
  /*
   * HIS WORDS (2026-10-12): "it definitely also only puts out one at a time
   * when i should be able to request multiple". How many one press asks for;
   * every one that comes back lands below, each its own picture.
   */
  const [count, setCount] = React.useState(1);
  /*
   * MAKE IT A CURSOR (J, 2026-10-09: "a dedicated generate cursor option in
   * the generate section"). The ask gains a line saying to draw a pointer
   * with its tip top left on a plain white ground, it is asked square, and
   * what comes back is cut out and made the site's cursor (`cursorPicture.ts`).
   */
  const [asCursor, setAsCursor] = React.useState(() => takeCursorAsk());
  const [cursorFor, setCursorFor] = React.useState<string | null>(null);
  React.useEffect(() => {
    const on = () => { takeCursorAsk(); setAsCursor(true); };
    window.addEventListener("studio:cursor-draw", on);
    return () => window.removeEventListener("studio:cursor-draw", on);
  }, []);
  /*
   * MAKE IT 3D (J, 2026-10-10). On a sphere, cube or pyramid (code, nothing
   * more spent), or a real 3D model from the one model that returns a solid
   * (`pictures/threeD.ts`). A Sphere, Cube or Pyramid card from Media dropped
   * on this panel picks the same.
   */
  const [threeD, setThreeD] = React.useState<ThreeD>("");
  const madeThreeD = usePictureJobs((st) => st.madeThreeD);
  const setMadeThreeD = usePictureJobs((st) => st.setMadeThreeD);
  React.useEffect(() => {
    const on = (e: Event) => { const v = (e as CustomEvent<ThreeD>).detail; if (THREE_D.some((c) => c.value === v)) { setThreeD(v); setAsCursor(false); } };
    window.addEventListener(THREE_D_EVENT, on);
    return () => window.removeEventListener(THREE_D_EVENT, on);
  }, []);
  /*
   * WHAT IS RUNNING, AND FOR HOW LONG (J, 2026-10-10: "detailed information
   * about the progress of it like i can see on replicate a loading bar or
   * time elapsed"). One row per job: what it is doing, the seconds so far,
   * and a bar against how long this model usually takes (his own runs
   * first, `pictures/estimate.ts`). Replicate reports no percentage for
   * these models, so the bar is time, and it says so when a run goes long.
   */
  const jobs = usePictureJobs((st) => st.jobs);
  const setJobs = usePictureJobs((st) => st.setJobs);
  const startJob = (label: string, expect: number) => {
    const id = `job_${Math.random().toString(36).slice(2, 8)}`;
    setJobs((was) => [...was, { id, label, expect, at: Date.now() }]);
    return {
      phase: (label2: string, expect2: number) => setJobs((was) => was.map((j) => (j.id === id ? { ...j, label: label2, expect: expect2, at: Date.now(), before: Date.now() - j.at + (j.before ?? 0) } : j))),
      end: () => setJobs((was) => was.filter((j) => j.id !== id)),
    };
  };
  const solidName = React.useMemo(() => modelTable().models.find((m) => m.returns === "mesh")?.name ?? "the 3D modeller", []);
  /*
   * The back and the sides, drawn before the solid is made.
   *
   * J (2026-10-12): from one front picture the 3D model "couldnt infer the
   * rest of it very well ... from the images itd have to generate what it
   * thinks all angles look like". So the picture model he chose (one that
   * takes a picture to work from; GPT Image 2 otherwise) draws the same
   * object from behind, left and right, each lands in the list below like
   * any picture so he sees what the solid was built from, and all of them go
   * to the 3D model together.
   */
  const drawViews = async (src: string, alt: string): Promise<string[]> => {
    const using = card && card.references > 0 ? slug : VIEW_MODEL;
    const front = await asDataUrl(src);
    if (!front) return [];
    const got = await Promise.all(VIEWS_ASKED.map(async ([name, side]) => {
      try {
        const began = Date.now();
        const res = await askImage({
          method: "POST",
          headers: { "content-type": "application/json", ...rendererHeader() },
          body: JSON.stringify({ kind: "raster", model: using, references: [front], w: 1024, h: 1024, prompt: `${side}${alt ? ` It is: ${alt.slice(0, 300)}` : ""}` }),
        });
        const r = (await res.json()) as { ok?: boolean; image?: string; cost?: number | null; ms?: number };
        if (!r.ok || !r.image) return null;
        const kept = await putPicture(await (await fetch(r.image)).blob(), { alt: `${alt.slice(0, 100)} (${name})`, from: "drawn" }).catch(() => null);
        addDraw({ prompt: `${alt} (${name})`, model: using, reference: front, ...(kept ? { picture: kept } : { image: r.image }), cost: r.cost ?? null, ms: typeof r.ms === "number" ? r.ms : Date.now() - began });
        return r.image;
      } catch {
        return null;
      }
    }));
    return got.filter((v): v is string => !!v);
  };
  const makeThreeD = async (src: string, alt: string, how: ThreeD, id?: string, job?: ReturnType<typeof startJob>, also: readonly string[] = []): Promise<string> => {
    if (!how) return "";
    let own: ReturnType<typeof startJob> | null = null;
    if (how === "solid") {
      // One picture is a guess at the rest; two or more he gave are views already.
      if (!also.length) {
        if (job) job.phase("Drawing the back and sides", pictureSeconds(slug, quality, draws)); else own = startJob("Drawing the back and sides", pictureSeconds(slug, quality, draws));
        also = await drawViews(src, alt);
      }
      if (job) job.phase(`Making the 3D model with ${solidName}`, SOLID_SECONDS);
      else if (own) own.phase(`Making the 3D model with ${solidName}`, SOLID_SECONDS);
      else own = startJob(`Making the 3D model with ${solidName}`, SOLID_SECONDS);
    }
    const r = how === "solid" ? await asSolid(src, alt, also).finally(() => own?.end()) : await onShape(src, how, alt).catch((err) => ({ ok: false, message: `It could not be put on the ${how}: ${err instanceof Error ? err.message : String(err)}` }));
    if (r.ok && id) setMadeThreeD(id);
    return r.message;
  };
  const makeCursor = async (src: string, id?: string) => {
    try { setCursorPicture(await cursorFrom(src)); if (id) setCursorFor(id); return true; } catch { return false; }
  };
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
  /** Which picture was just put on the part. */
  const [put, setPut] = React.useState<string | null>(null);
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

  /* A new choice is a new price: what the last press said gives way to the estimate for this one. */
  /* Not on the way in: what the last press said outlives the panel (`pictures/jobs.ts`). */
  const changed = React.useRef(false);
  React.useEffect(() => { if (changed.current) setSaid(null); changed.current = true; }, [slug, quality, threeD, asCursor]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async () => {
    const forPart = forNode ? useStudio.getState().nodes.find((n) => n.id === forNode) ?? null : null;
    const asked = tweak.trim();
    if (!asked) return;
    /* The iteration exists from the press, not from the answer: that is what
       puts it on the timeline while it is still working. */
    const threadId = landThread({ mode: GENERATION, model: slug, ask: asked, answer: "", state: "running" });
    setRunning((n) => n + 1);
    setSaid(null);
    const job = startJob(`Drawing with ${card?.name ?? "the model"}`, pictureSeconds(slug, quality, draws));
    const began = Date.now();
    try {
      /* It has been sent and is out with the model. There is nothing finer to
         report — Replicate gives no progress — so the bar says "gone, waiting"
         rather than inventing a percentage. */
      noteProgress(threadId, 0.35);
      const res = await askImage({
        method: "POST",
        headers: { "content-type": "application/json", ...rendererHeader() },
        /* `frame` is not sent, so nothing is added to what he typed. Drawn
           for a part, it is asked for at that part's size and by its name, as
           the part's own panel always asked: a square for a wide banner is a
           picture cropped or stretched the moment it lands. */
        body: JSON.stringify({
          kind: "raster", prompt: asCursor ? `${tweak.trim()}\n\n${CURSOR_ASK}` : threeD ? `${tweak.trim()}\n\n${THREE_D_ASK[threeD]}` : tweak.trim(),
          w: forPart && !asCursor ? Math.round(forPart.w) : 1024, h: forPart && !asCursor ? Math.round(forPart.h) : 1024,
          ...(forPart && !asCursor ? { label: forPart.label } : {}), model: slug,
          ratio: asCursor ? (ratios.includes("1:1") ? "1:1" : undefined) : ratio || (threeD && ratios.includes(THREE_D_RATIO[threeD]) ? THREE_D_RATIO[threeD] : undefined), quality: quality || undefined, effort: effort || undefined,
          format: format || undefined, references: references.length ? references : undefined,
          ...(count > 1 ? { count } : {}),
        }),
      });
      const r = (await res.json()) as { ok?: boolean; image?: string; images?: string[]; cost?: number | null; message?: string };
      const got = r.images?.length ? r.images : r.image ? [r.image] : [];
      if (r.ok && got.length) {
        /* Kept here first. The picture outlives its box on the timeline: he
           can delete the iteration and the picture is still his. Each one
           of several is its own picture, carrying its share of the price. */
        const share = typeof r.cost === "number" ? r.cost / got.length : null;
        const ms = typeof (r as { ms?: number }).ms === "number" ? (r as { ms?: number }).ms : Date.now() - began;
        /* Oldest first, so the first one back ends up on top. */
        for (const image of [...got].reverse()) {
          /* Kept as a file, the document holding only its path; where this
             browser keeps no files, as the bytes, which is how it always was. */
          const kept = await (async () => {
            try { return await putPicture(await (await fetch(image)).blob(), { alt: asked.slice(0, 120), from: "drawn" }); } catch { return null; }
          })();
          addDraw({ prompt: asked, model: slug, ratio: ratio || undefined, quality: quality || undefined, effort: effort || undefined, format: format || undefined, reference: references[0], ...(kept ? { picture: kept } : { image }), cost: share, ms, threadId });
        }
        markThread(threadId, "done");
        const cost = (got.length > 1 ? ` ${got.length} pictures.` : "") + (typeof r.cost === "number" ? ` It cost ${money(r.cost)}.` : "");
        if (asCursor) setSaid((await makeCursor(got[0]!)) ? `Drawn and made your cursor: point at the preview to see it.${cost}` : `Drawn, but it could not be made a cursor.${cost}`);
        else if (threeD) { setSaid(`Drawn.${cost} Making it 3D…`); setSaid(`Drawn.${cost} ${await makeThreeD(got[0]!, asked, threeD, undefined, job)}`); }
        else setSaid(cost ? `Drawn.${cost}` : "Drawn. The renderer reported no price for it.");
      } else {
        markThread(threadId, "cut");
        setSaid(r.message ?? "Nothing came back.");
      }
    } catch (err) {
      markThread(threadId, "cut");
      setSaid(`Could not reach the renderer: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      job.end();
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
        {/* Straight to 3D from the pictures he gave it, with no picture drawn
            first: the first is the front, the rest the other sides. */}
        {references.length ? (
          <button
            type="button"
            data-render-input-3d=""
            onClick={async () => setSaid(await makeThreeD(references[0]!, tweak.trim() || "From the input images", "solid", undefined, undefined, references.slice(1)))}
            className="tactile mt-1.5 rounded-sm border border-border px-1.5 py-0.5 text-small text-fg-muted hover:text-fg"
          >
            {references.length > 1 ? "Make a 3D model from these" : "Make a 3D model from this"}
          </button>
        ) : null}
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

      {/* HOW MANY */}
      <Row label="How many" mark="count">
        <Select value={String(count)} onChange={(v) => setCount(Number(v) || 1)} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
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

      <label data-render-row="cursor" className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="flex flex-col">
          <span className="text-plain text-fg-muted">Make it a cursor</span>
          <span className="text-fine text-fg-faint">Tip top left, background see-through, used as the site&apos;s pointer.</span>
        </span>
        <input data-render-cursor="" type="checkbox" checked={asCursor} onChange={(e) => { setAsCursor(e.target.checked); if (e.target.checked) setThreeD(""); }} className="size-4 accent-[var(--accent)]" />
      </label>

      <div data-render-row="3d" className="flex items-center justify-between gap-2 px-3 py-1.5">
        <span className="flex flex-col">
          <span className="text-plain text-fg-muted">Make it 3D</span>
          <span className="text-fine text-fg-faint">Or drop a Sphere, Cube or Pyramid from Media here.</span>
        </span>
        <span data-render-3d={threeD} className="shrink-0">
          <Select value={threeD} onChange={(v) => { setThreeD(String(v) as ThreeD); if (v) setAsCursor(false); }} options={THREE_D.map((c) => ({ value: c.value, label: c.label }))} />
        </span>
      </div>

      <div className="flex items-center gap-2 px-3 pb-3 pt-2">
        <Button data-render-go="" variant="primary" size="sm" disabled={!tweak.trim()} onClick={() => void run()}>
          {running ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
          {asCursor ? "Generate cursor" : threeD ? "Generate in 3D" : "Generate"}
        </Button>
        {/* The price before the press, not after it. It is his key and his
            money, so what it will cost is said before anything is spent, and
            what it actually cost replaces this when the picture comes back. */}
        <span data-render-price="" className="text-small text-fg-faint">
          {said ?? estimateLine(slug, quality, asCursor ? "" : threeD, draws, count)}
        </span>
      </div>
      {jobs.length ? (
        <div data-render-progress={jobs.length} className="flex flex-col gap-2 px-3 pb-3">
          {jobs.map((j) => <JobRow key={j.id} job={j} />)}
        </div>
      ) : null}

      {/*
        EVERYTHING HE HAS MADE, newest first, under the slot for the next one.
        Each one can be downloaded, put back in the box to tweak, run again as
        it stands, or dragged onto the page.
      */}
      {draws.length ? (
        <div data-render-past={draws.length} className="border-t border-border">
          {draws.map((d) => (
            <DrawnSrc key={d.id} picture={d.picture} image={d.image}>{(src) => (
            <figure data-render-iteration={d.id} className="m-0 border-b border-border/60 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- a stored drawing, drawn here */}
              <img
                src={src}
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
                  const type = d.picture?.type ?? /^data:(image\/[a-z0-9.+-]+)/i.exec(src)?.[1] ?? "image/webp";
                  const name = `${d.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-") || "drawing"}.${d.format ?? type.split("/")[1] ?? "webp"}`;
                  e.dataTransfer.setData("text/uri-list", src);
                  e.dataTransfer.setData("text/plain", src);
                  e.dataTransfer.setData("DownloadURL", `${type}:${name}:${src}`);
                  e.dataTransfer.setData("application/x-studio-picture", JSON.stringify({
                    src: src,
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
                  as a picture, PNG and nothing else beside it (an address
                  riding along is what many apps paste instead). Saving stays,
                  because he asked for it earlier and both are wanted.
                */}
                <button
                  type="button"
                  data-render-copy={d.id}
                  onClick={async () => {
                    /* The picture alone, as PNG (copyPicture.ts): an address
                       beside it is what most apps paste instead. */
                    const how = await copyPicture(src);
                    const mark = how === "picture" ? d.id : `${d.id}:${how === "link" ? "link" : "no"}`;
                    setCopied(mark);
                    window.setTimeout(() => setCopied((was) => (was === mark ? null : was)), how === "picture" ? 1400 : 3200);
                  }}
                  title={copied === `${d.id}:link` ? "This browser cannot copy pictures, so the link was copied instead." : copied === `${d.id}:no` ? "This browser would not let the page use the clipboard." : "Copy the picture"}
                  className="tactile flex items-center gap-0.5 rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg"
                >
                  <Copy className="size-2.5" />
                  {copied === d.id ? "Copied" : copied === `${d.id}:link` ? "Link only: no picture copy here" : copied === `${d.id}:no` ? "Cannot" : "Copy"}
                </button>
                {forNode ? (
                  <button
                    type="button"
                    data-render-put={d.id}
                    onClick={async () => {
                      const blob = await (await fetch(src)).blob();
                      const made = await putPicture(blob, { alt: d.prompt.slice(0, 120), from: "drawn" });
                      const had = useStudio.getState().nodes.find((n) => n.id === forNode)?.picture;
                      useStudio.getState().updateNode(forNode, { picture: made });
                      const part = useStudio.getState().nodes.find((n) => n.id === forNode);
                      if (had && !(part && isKeptVersion(part, had))) void dropPicture(had);
                      setPut(d.id);
                    }}
                    className="tactile rounded-sm border border-accent/60 bg-accent-soft px-1 py-0.5 text-small text-accent"
                  >
                    {put === d.id ? "On this part" : "Put it on this part"}
                  </button>
                ) : null}
                <button
                  type="button"
                  data-render-cursor-from={d.id}
                  onClick={() => void makeCursor(src, d.id)}
                  className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg"
                >
                  {cursorFor === d.id ? "Your cursor" : "Use as cursor"}
                </button>
                <button
                  type="button"
                  data-render-3d-from={d.id}
                  /* J (2026-10-12): "make 3d seems to just put it on a sphere lol i
                     want an actual ring". 3D on a picture is a real 3D model of
                     what is in it, unless he picked a shape in Make it 3D. */
                  title={threeD && threeD !== "solid" ? `Make this one 3D: ${THREE_D.find((c) => c.value === threeD)?.label.toLowerCase()}` : "Make a real 3D model of this one (or pick a shape in Make it 3D)"}
                  onClick={async () => setSaid(await makeThreeD(src, d.prompt, threeD || "solid", d.id))}
                  className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg"
                >
                  {madeThreeD === d.id ? "Made 3D" : "3D"}
                </button>
                <a data-render-download={d.id} href={src} download={`${d.prompt.slice(0, 40).replace(/[^a-z0-9]+/gi, "-") || "drawing"}.${d.format ?? "webp"}`} className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg">Save</a>
                <button type="button" data-render-tweak-from={d.id} onClick={() => { setTweak(d.prompt); setSlug(d.model); if (d.reference) setReferences((was) => (was[0] === d.reference ? was : [d.reference!])); }} className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg">Tweak</button>
                <button type="button" data-render-again={d.id} onClick={() => { setTweak(d.prompt); setSlug(d.model); if (d.reference) setReferences((was) => (was[0] === d.reference ? was : [d.reference!])); window.setTimeout(() => void run(), 0); }} className="tactile rounded-sm border border-border px-1 py-0.5 text-small text-fg-muted hover:text-fg">Again</button>
              </figcaption>
            </figure>
            )}</DrawnSrc>
          ))}
        </div>
      ) : null}
    </div>
  );
}


/** One running job: what it is doing, seconds so far, and a bar against its usual time. Ticks on its own. */
function JobRow({ job }: { job: Job }) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 250); return () => window.clearInterval(t); }, []);
  const s = Math.max(0, (now - job.at) / 1000);
  const total = s + (job.before ?? 0) / 1000;
  const { fraction, late } = progressOf(s, job.expect);
  return (
    <div data-render-job="" className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2 text-small">
        <span className="min-w-0 truncate text-fg-muted">{job.label}…</span>
        <span data-render-elapsed={Math.floor(total)} className="num shrink-0 text-fg-faint">
          {Math.floor(total)}s{late ? `, longer than the usual ${job.expect}s` : ` of about ${job.expect}s`}
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-panel">
        <div data-render-bar={Math.round(fraction * 100)} className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${Math.round(fraction * 1000) / 10}%` }} />
      </div>
    </div>
  );
}

/**
 * A drawing's address: its file from the picture store, or the bytes it was
 * kept as before. Said plainly while the file is still being read.
 */
function DrawnSrc({ picture, image, children }: { picture?: Picture; image?: string; children: (src: string) => React.ReactNode }) {
  const { src, looked } = usePicture(picture ?? null);
  const at = src ?? image;
  if (!at) {
    return (
      <p data-render-missing="" className="m-0 border-b border-border/60 p-3 text-small text-fg-faint">
        {looked ? "This drawing's file is not in this browser any more." : "Reading this drawing…"}
      </p>
    );
  }
  return <>{children(at)}</>;
}
