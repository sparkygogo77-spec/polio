"use client";
/**
 * Making a drawing real, away from the board that drew it.
 *
 * This is what **Make real** used to do inline: send the drawing, the
 * picture of it and the part as it stands to `/api/studio/reshape`, hold
 * every field of the answer to the catalog and the frame (`reshape.ts`),
 * and put the result on the board. It lives here because the board no
 * longer waits for it — a drawing goes on the queue (`queue.ts`) and this
 * runs it, one at a time, with the menu long gone.
 *
 * Everything it needs is in the job, except the part, which is read from
 * the store when the job actually runs: the part may have been moved,
 * renamed or reshaped by the time its turn comes, and the drawing is still
 * about whatever that part is *now*.
 *
 * Without a key it still does the honest thing: the part takes the
 * boundary's proportion and its shape — the two things a drawing says
 * without being read — and the drawing is kept on the part so the blueprint
 * writes it out in words. A drawing is never lost to a missing key.
 */
import { CALL_DEADLINE_MS, heldEffort } from "./effort";
import type { ToastInput } from "@/core/types";
import { FEATURES, getFeature } from "./catalog";
import { keyHeader, noKeyMessage } from "./agent";
import { FULL_BLEED, checkAnswer, clamp, type KindInfo, type ReshapePatch } from "./reshape";
import { PART_MAX_H, describeSketch, fitToSketch, outlinePath, readBoundary, type Sketch, type SketchPoint } from "./sketch";
import { useStudio, type NodeShape, type StudioNode } from "./board/store";
import { changesThePart } from "./drawTarget";
import { typedSince, type DrawJob } from "./queue";
import { targetFor, writeBody, type Attempt } from "./bodyRun";
import { refinePart } from "./refineRun";
import type { PartCode } from "./snippet";
import { drawBody } from "./drawRun";
import { CODED, nearlyCoded, pickCoded } from "./coded";
import { kindOfSketch } from "./shapeKind";
import { roleFromWords, vectorFromStrokes } from "./vector";
import { claudeSpend, sayBill, sayPass } from "./spend";
import { tidySteps } from "./space";
import { oddness, stillAsks, withAnswer } from "./oddness";
import type { Step } from "./imageRoute";
import { play } from "@/core/audio/engine";
import { plain } from "./parts/spans";

/** A data URL down to its bytes, which is all the second pass takes. */
const bare = (dataUrl: string | null | undefined): string | null => {
  const at = dataUrl?.indexOf("base64,") ?? -1;
  return at < 0 ? null : dataUrl!.slice(at + 7);
};

/** The catalog as the answer check reads it: the entry without its icon. */
const kindInfo = (id: string): KindInfo | null => {
  const f = getFeature(id);
  if (!f) return null;
  return {
    id: f.id, name: f.name, w: f.w ?? 132, h: f.h ?? 76,
    options: (f.options ?? []).map((o) => ({ id: o.id, values: o.values, kind: o.kind, range: o.range ? { min: o.range.min, max: o.range.max } : undefined })),
  };
};

/** A trimmed string of at most `max` characters, or nothing. */
const text = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
/**
 * A name from the words: whole words, never cut mid-word.
 *
 * "chart associated with currently traded token" was landing as "chart
 * associated with currently traded t", forty characters and a fragment of
 * the last one, and a name that ends in a fragment reads as broken. The
 * words fit as they are up to the limit; past it the cut is at a space and
 * says it was cut.
 */
export function nameFrom(words: string, max = 56): string {
  const w = words.trim().replace(/\s+/g, " ");
  if (w.length <= max) return w;
  const cut = w.lastIndexOf(" ", max - 1);
  return `${w.slice(0, cut > max / 2 ? cut : max - 1).trim()}…`;
}

export interface RunDeps {
  publish: (input: ToastInput) => void;
  /** The keys panel is locked or empty and the reader could not run. */
  onNoKey: () => void;
  /** What the counter says this job is doing. */
  onStep?: (step: string) => void;
}

export interface RunResult {
  ok: boolean;
  madeId?: string;
  note: string;
  /** The run stopped to ask one question; the job is `asking`, not over. */
  asked?: boolean;
  /**
   * A later pass is still running and will finish the iteration itself.
   *
   * The second pass is deliberately not awaited — the part is on the board
   * and the person is looking at it — so the run returns before the
   * iteration is over. Whoever finishes last marks it done.
   */
  pending?: boolean;
  /**
   * What landed and where, in a line: the message the queue shows when the
   * job is over (`DrawQueue.tsx`). `tests/draw-change-says-undo.mjs`.
   */
  said?: string;
}

/** What landed, and where, for the one message a finished drawing shows. */
function sayWhere(label: string, node: StudioNode | null, over: StudioNode | null): string {
  if (node) return `${node.label} changed, as the words asked`;
  const what = `a new part, “${label}”`;
  return over ? `${what}, on top of ${over.label}; ${over.label} is as it was` : what;
}

/** The Icon choice, on a road with no reader to pin it: the strokes themselves, as the drawn icon. */
function asIcon(id: string, drawn: Sketch) {
  const vector = vectorFromStrokes(drawn.strokes);
  useStudio.getState().updateNode(id, { featureId: "drawn-icon", custom: false, outline: null, shape: null, options: { "drawn as": "line" }, ...(vector ? { vector } : {}) });
}

/**
 * What the node's plan says, read once per job.
 *
 * The create space writes `plan` on a node — the model and the ordered
 * steps — and this run reads it. `steps` is null when nobody has said, and
 * then the run does what it always did. A step left out is a step not
 * taken; the model is preferred wherever a model is picked, and the route
 * says on the card when it could not be.
 */
interface Planned {
  steps: Step[] | null;
  model: string | null;
  /** What the person set on the model, by field name, when the plan carries it. */
  options: Record<string, unknown> | null;
}

function planOf(node: StudioNode | null): Planned {
  const p = node?.plan;
  const steps = p?.steps?.length ? tidySteps(p.steps) : [];
  return { steps: steps.length ? steps : null, model: p?.model ?? null, options: p?.options ?? null };
}

/**
 * How a drawing is rasterised. Every rung of the tracer's ladder is one of
 * these turned up.
 */
export interface PictureOpts {
  /** The square the picture is drawn in. */
  px?: number;
  /** Crop to the ink rather than keeping the whole board. Fills the frame with the drawing. */
  crop?: boolean;
  /** How thick the line is, at 640px. Thicker traces as more area. */
  width?: number;
  /** Pure black on pure white, no soft edge: a cleaner trace. */
  contrast?: boolean;
  /** Draw the board's rim. Off once the picture is for a tracer, which would trace it. */
  edge?: boolean;
  /** Paint a white ground. Off leaves it transparent, so nothing is traced under the line. */
  ground?: boolean;
}

/**
 * The drawing as a picture: black lines on white, small.
 *
 * Two readers want this and they want different things. A model that
 * *looks* at the drawing to describe it wants the board as it was, rim and
 * all, because where a shape sits on the disc is part of what was drawn. A
 * model that *traces* it wants the ink and nothing else: a rim it would
 * trace, a ground it would trace, and a hairline it would lose. So the
 * defaults are the first and the ladder in `drawBody` turns each knob for
 * the second.
 */
export function pictureOf(strokes: SketchPoint[][], opts: number | PictureOpts = {}): string | null {
  const o: PictureOpts = typeof opts === "number" ? { px: opts } : opts;
  const px = o.px ?? 640;
  const crop = o.crop ?? false;
  const edge = o.edge ?? !crop;
  const ground = o.ground ?? true;
  if (typeof document === "undefined") return null;
  const el = document.createElement("canvas");
  el.width = px;
  el.height = px;
  const c = el.getContext("2d");
  if (!c) return null;
  if (ground) {
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, px, px);
  }
  // Thicker at this size: the picture is the reference the reader works
  // from, and a hairline at 640px reads as noise once it is scaled.
  c.strokeStyle = "#000000";
  c.lineWidth = o.width ?? 6;
  c.lineCap = "round";
  c.lineJoin = "round";
  if (o.contrast) {
    // No soft edge at all: a tracer turns grey into a second, ghostly
    // outline beside the first.
    c.imageSmoothingEnabled = false;
    c.shadowBlur = 0;
  }
  // The board's edge, faintly, so a shape's place on the disc can be read.
  if (edge) {
    c.save();
    c.strokeStyle = "#d0d0d0";
    c.lineWidth = 2;
    c.beginPath();
    c.arc(px / 2, px / 2, px / 2 - 2, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  }
  /*
   * Cropping puts the ink's own box in the frame, and stretches each axis
   * on its own to fill it.
   *
   * That looks like it distorts the drawing, and it does: it has to. The
   * part's box *is* the ink's box, and the SVG that comes back is stretched
   * into the part with `preserveAspectRatio="none"`. Fitting the ink inside
   * a square here and stretching it into a wide part there applies the
   * distortion once instead of cancelling it, and the trace lands somewhere
   * the drawing never was. Stretching both ways here makes the round trip
   * exact, which is the whole of comparing like with like: the frames have
   * to be the same frame.
   */
  const box = crop ? boxOf(strokes) : null;
  const pad = (o.width ?? 6) / px + 0.02;
  const sx = box ? ((1 - pad * 2) / Math.max(box.w, 1e-3)) : 1;
  const sy = box ? ((1 - pad * 2) / Math.max(box.h, 1e-3)) : 1;
  const ox = box ? 0.5 - (box.x + box.w / 2) * sx : 0;
  const oy = box ? 0.5 - (box.y + box.h / 2) * sy : 0;
  const atX = (v: number) => (v * sx + ox) * px;
  const atY = (v: number) => (v * sy + oy) * px;
  for (const s of strokes) {
    if (!s.length) continue;
    c.beginPath();
    c.moveTo(atX(s[0]![0]), atY(s[0]![1]));
    if (s.length === 1) c.lineTo(atX(s[0]![0]) + 0.01, atY(s[0]![1]));
    for (let i = 1; i < s.length; i++) c.lineTo(atX(s[i]![0]), atY(s[i]![1]));
    c.stroke();
  }
  try {
    return el.toDataURL("image/png").split(",")[1] ?? null;
  } catch {
    return null;
  }
}

/** The box round every stroke, in board fractions. */
function boxOf(strokes: SketchPoint[][]): { x: number; y: number; w: number; h: number } | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of strokes) for (const [x, y] of s) {
    if (x < x0) x0 = x;
    if (y < y0) y0 = y;
    if (x > x1) x1 = x;
    if (y > y1) y1 = y;
  }
  if (!Number.isFinite(x0) || x1 <= x0 || y1 <= y0) return null;
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Run one job: read the drawing if a reader can be reached, and put it on the board either way. */
export async function runDrawJob(job: DrawJob, deps: RunDeps): Promise<RunResult> {
  const s = useStudio.getState();
  const hit = job.nodeId ? s.nodes.find((n) => n.id === job.nodeId) ?? null : null;
  /*
   * A DRAWING ON A PART THAT HOLDS A SECTION IS MADE OVER IT, NOT INTO IT.
   *
   * The owner's trumpmorty.fun: a cube drawn on the hero turned the hero
   * itself into a 3D cube, resized to the drawing's proportion at its own
   * area (1440 × 901 became 1339 × 969), and the published page lost the
   * hero's full width and background right of 1340. A captured part that
   * holds others (the hero, a banner, a panel: `holds.ts`) is the page's
   * structure; reshaping it takes everything in it along. So the drawing
   * lands as a new part where it was made, centred on that part at the
   * drawing's own proportion, and the part keeps its size and its kind.
   * `tests/draw-on-section.mjs`.
   */
  /*
   * …AND SINCE THE AUDIT, A DRAWING ON ANY PART IS MADE OVER IT.
   *
   * The guard above held the hero, and only parts that wholly hold another:
   * a ribbon whose words run past its edges, a full-width strip, the title,
   * the buy button and the contract address were all still resized, moved,
   * turned into a cube or deleted by a drawing made on them
   * (`docs/audits/drawing-and-import-sequence.md`). So the rule is the same
   * for every part, captured or placed, container or single item, and for
   * the reader with a key as much as without: the drawing lands as a new
   * part at the drawing and the part is left exactly as it was — unless it
   * is a blank idea dropped to be drawn on, the door is "draw it again", or
   * the words typed with the drawing ask for this part to change
   * (`drawTarget.ts`). A straight line never changes a part: it is a line
   * put on top. `tests/draw-on-captured-part.mjs`, `tests/draw-line-keeps-part.mjs`.
   */
  const line = kindOfSketch({ strokes: job.sketch.strokes, words: "" }, "", true).kind === "connector";
  const onItself = !!hit && changesThePart(hit, { words: job.sketch.words ?? "", reshape: job.reshape, line });
  if (hit && !onItself) {
    const size = fitToSketch(job.sketch, Math.min(hit.w, 360), Math.min(hit.h, 360), job.frameWidth);
    job = { ...job, nodeId: null, over: hit.id, at: job.at ?? { x: hit.x + hit.w / 2, y: hit.y + hit.h / 2 }, drawn: job.drawn ?? size };
  }
  const node = onItself ? hit : null;
  const over = !onItself && hit ? hit : null;
  /*
   * ONE DRAWING IS ONE UNDO STEP.
   *
   * Landing a drawing writes the part two or three times (its size, then
   * what the catalogue made of it, then what the shape does), and each
   * write was its own checkpoint: undoing a cube took two presses. Every
   * checkpoint the landing takes is folded into the first (`oneStepSince`,
   * the import's own), and the checkpoint that survives is the drawing's
   * token: while it is still in the history the drawing still stands, and
   * the traced body arriving later writes into it without a checkpoint of
   * its own. Once it has been undone, nothing later writes at all.
   * `tests/draw-one-undo.mjs`.
   */
  let mark = useStudio.getState().historyMark();
  let token: unknown = null;
  let madeId: string | null = null;
  const oneStep = (id: string) => {
    madeId = id;
    const st = useStudio.getState();
    const took = st.historyMark() - mark;
    st.oneStepSince(mark);
    if (took > 0) token = useStudio.getState().past[useStudio.getState().past.length - 1] ?? null;
  };
  const still = () => token === null || useStudio.getState().past.includes(token as never);
  /*
   * The answer, but only if the question it answers still stands.
   *
   * A person can describe the drawing after answering — by typing on the
   * part it was made on — and then the answer is about a drawing that no
   * longer matches it. The words are the better account of what they meant,
   * so the stale answer is dropped and the question is not asked again
   * either (`stillAsks`). When it does stand, the answer goes in as words
   * beside the drawing and everything after this reads the words.
   */
  /*
   * Everything but the node is worked out *inside* the try below.
   *
   * It was worked out here, above it, which meant a throw in any of it —
   * reading the answer, folding it into the words, looking the feature up,
   * reading the plan — left this function rejecting rather than returning a
   * failure. A rejected run has no status to write, so the job stays
   * `running`, and the queue will not start anything while a job is
   * running: one unexpected error stopped every drawing behind it. The node
   * stays out here because the catch needs it, and finding it cannot throw.
   */
  let drawn: Sketch = job.sketch;

  try {
    const answered = stillAsks(job.question, job.sketch, typedSince(job.question, hit?.prompt)) ? job.question?.answer : undefined;
    drawn = withAnswer(job.sketch, answered);
    const feature = node ? getFeature(node.featureId) : null;
    const { frameWidth } = job;
    const plan = planOf(node);
    /*
     * The catalogue first, and it needs no reader.
     *
     * A drawing that is plainly a part we already have — a cube, and
     * whatever is added to `coded.ts` next — is answered here, for nothing,
     * the same way every time. Only when nothing in the catalogue fits does
     * the drawing go up to be read and, failing that, traced. The fall
     * through is still there; it is no longer the only road.
     */
    const lone = loneDrawing(node, job);
    /*
     * ONLY THE WORDS TYPED WITH THE DRAWING ASK FOR A KIND.
     *
     * The part's own saved description was read beside the drawing, and
     * every part sink captures says "…The box, the words, the colours…": a
     * bare "box", which is how a cube is asked for. So any closed shape
     * drawn on any captured part became a 3D cube with nothing typed at all
     * — the trumpmorty ribbon cut to 349px on the published page. The
     * description says what the part is; it asks for nothing.
     * `tests/draw-captured-prompt-not-cube.mjs`.
     */
    const drawnRole = kindOfSketch(drawn, "", lone);
    const ctx = { sketch: drawn, prompt: "", node, lone };
    /*
     * What he chose on the drawing row before he drew, honoured on every
     * road and not only when a reader answers: Cube is the catalogue's cube,
     * with or without a key. `tests/draw-kind-chips.mjs`.
     */
    const picked = job.want === "cube" ? { part: CODED.find((c) => c.id === "cube")!, score: 1 } : job.want === "icon" ? null : pickCoded(ctx);
    /*
     * What it nearly was, said out loud.
     *
     * A drawn box that nobody claimed used to land as a flat cutout in
     * silence, and the cube it nearly was — six faces, turnable, editable —
     * was one word away with nothing anywhere to say so. The guess is too
     * risky to take (every part in the library is a rectangle) and it is
     * not too risky to *offer*.
     */
    // Not offered after the fact when it was asked before (below).
    const nearly = picked || job.question ? "" : nearlyCoded(ctx);
    if (picked) {
      deps.onStep?.(`Reading the shape: ${picked.part.id}…`);
      const made = applyProportion(drawn, node, job);
      // Configured from the part as it now stands: the size the drawing
      // gave it, not the size it had before the drawing.
      const { patch, did } = picked.part.configure({ ...ctx, node: useStudio.getState().nodes.find((n) => n.id === made.id) ?? node });
      useStudio.getState().updateNode(made.id, patch);
      oneStep(made.id);
      const label = patch.featureId ? getFeature(patch.featureId)?.name ?? made.label : made.label;
      useStudio.getState().landThread({
        id: job.threadId,
        mode: "drawing",
        // A part out of the catalogue is one step and it is over: nothing
        // is written or traced after it.
        state: "done",
        ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
        answer: `${did}, chosen off the drawing with no model asked`,
        // Which part this was about, so the timeline can change that one
        // rather than making a second.
        madeId: made.id,
        sketch: { strokes: drawn.strokes as [number, number][][], words: drawn.words },
        changes: [`${node ? "turned" : "drew"} ${made.label} into ${label.toLowerCase()}`],
      });
      deps.publish({
        key: `studio:reshape:${made.id}`,
        title: node ? `Turned ${made.label} into ${label.toLowerCase()}` : `Drew ${label.toLowerCase()}`,
        body: did,
        level: "success",
        source: "studio",
        toast: true,
      });
      return { ok: true, madeId: made.id, note: did, said: sayWhere(label, node, over) };
    }

    /*
     * One question before anything is spent.
     *
     * A drawing that is plainly ambiguous — a box one word from being a
     * cube, a scribble with nothing typed beside it — stops here and asks
     * (`oddness.ts`), once. The job goes back on the queue as `asking`
     * until the person answers or waves it on, and the answer comes in as
     * words beside the drawing, so the reader is briefed rather than left
     * to guess at the first paid call. After the catalogue, which is free
     * and needs no question; before the read, which is neither.
     */
    // Nothing to ask when he said what it is before he drew it.
    if (!job.question && job.want !== "icon" && job.want !== "cube") {
      /* Asked of the drawing as the catalogue saw it: a box over a part is not claimed as a cube, so it is the one that is asked (`tests/solid.mjs`). */
      const q = oddness(drawn, "", lone);
      if (q) {
        // `why` travels with it: a question is only worth answering while
        // the same one would still be asked (`stillAsks`).
        useStudio.getState().updateJob(job.id, { status: "asking", question: { ask: q.ask, choices: q.choices, why: q.why, prompt: hit?.prompt ?? "", lone }, step: undefined });
        /*
         * The one sound this app makes. A job that is `asking` waits on the
         * person, not on the queue \u2014 the run has stopped and will not go on
         * until he answers, which is the only thing worth interrupting him
         * for. Everything else that used to click, tick and chime is silent.
         */
        play("notify");
        return { ok: true, asked: true, note: q.ask };
      }
    }

    /*
     * As planned: not read.
     *
     * A node whose plan leaves the reading out is not sent up to be read.
     * The drawing still shapes the part and the shape still says what it
     * does — both are measured off the strokes — and the work goes on to
     * whichever steps the plan kept. Said on the card as a decision, not as
     * a failure.
     */
    if (plan.steps && !plan.steps.includes("read")) {
      const made = applyProportion(drawn, node, job);
      const role = useStudio.getState().applyDrawnKind(made.id, drawnRole, drawn.words, { fresh: !node });
      if (job.want === "icon") asIcon(made.id, drawn);
      oneStep(made.id);
      const landed = useStudio.getState().landThread({
        id: job.threadId,
        mode: "drawing",
        state: "running",
        ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
        answer: [role.did, "not read: the plan left the reading out"].filter(Boolean).join(", "),
        sketch: { strokes: drawn.strokes as [number, number][][], words: drawn.words },
        changes: [`${node ? "reshaped" : "drew"} ${made.label} at ${made.w} × ${made.h}`, `as planned: ${plan.steps.join(" › ")}`],
      });
      useStudio.getState().noteMade(landed, made.id);
      deps.publish({
        key: `studio:reshape:${made.id}`,
        title: `${node ? "Reshaped" : "Drew"} ${made.label} as planned`,
        body: `Not read: the plan goes ${plan.steps.join(" › ")}.`,
        level: "info",
        source: "studio",
        toast: true,
      });
      const bodied = useStudio.getState().nodes.some((n) => n.id === made.id) ? await bodyFor(made.id, drawn, deps, plan, landed, still) : NOTHING_MADE;
      if (!bodied.pending) finish(landed, deps, `studio:reshape:${made.id}`);
      return { ok: true, madeId: made.id, pending: bodied.pending, note: [role.did, bodied.note].filter(Boolean).join(" · "), said: sayWhere(made.label, node, over) };
    }

    deps.onStep?.("Claude is reading the drawing…");
    // What the person waits for is measured, not estimated.
    const readFrom = Date.now();
    // The browser's own deadline, longer than the route's budget: for the
    // case where nothing arrives at all.
    const res = await fetch("/api/studio/reshape", {
      method: "POST",
      signal: AbortSignal.timeout(CALL_DEADLINE_MS),
      headers: { "content-type": "application/json", ...keyHeader() },
      body: JSON.stringify({
        sketch: drawn,
        picture: job.picture,
        frameWidth,
        effort: heldEffort(),
        node: node
          ? {
              featureId: node.featureId,
              feature: feature?.name ?? node.label,
              label: node.label,
              w: node.w,
              h: node.h,
              prompt: node.prompt,
              content: node.content,
              data: node.data,
              options: node.options,
              optionsAllowed: (feature?.options ?? []).map((o) => ({
                id: o.id, label: o.label, kind: o.kind ?? "one",
                // A range has no list of values to offer: it has two ends.
                values: o.kind === "range" && o.range ? [`${o.range.min}–${o.range.max}${o.range.unit ?? ""}`] : o.values,
              })),
              contentLabel: feature?.content?.label ?? null,
            }
          : null,
        candidates: FEATURES.map((f) => ({ id: f.id, name: f.name, category: f.category, w: f.w, h: f.h, blurb: f.blurb })),
      }),
    });
    const data = (await res.json()) as {
      ok: boolean;
      patch?: ReshapePatch;
      message?: string;
      reason?: string;
      usage?: { model?: string; input?: number; output?: number; cached?: number };
    };
    const readCost = claudeSpend(data.usage, Date.now() - readFrom);
    // Anything he did while the read was out is his own step, not the drawing's.
    mark = useStudio.getState().historyMark();
    if (data.ok && data.patch) {
      const made = apply(data.patch, drawn, node, job);
      // A drawing read is an API call that landed, so it is a thread too:
      // the words that went with the drawing, the note that came back, and
      // what it did to the part.
      /*
       * It lands as running, not done.
       *
       * A drawing read is the first half: a body is traced for it after
       * this, and until that finishes the iteration is not finished. The
       * box reads red the whole time and turns green when it is over,
       * which is the only honest thing a mark can say while work is in
       * flight.
       */
      const landed = useStudio.getState().landThread({
        id: job.threadId,
        mode: "drawing",
        state: "running",
        model: data.usage?.model,
        ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
        answer: data.patch.note ?? "",
        // The drawing goes on the thread: an element prompt is the line,
        // and the timeline shows the line rather than a sentence about it.
        sketch: { strokes: drawn.strokes as [number, number][][], words: drawn.words },
        changes: [`${node ? "reshaped" : "drew"} ${made.label} at ${made.w} × ${made.h}`, ...(made.kindChanged ? [`now a ${made.kind}`] : []), ...(nearly ? [nearly] : [])],
      });
      // The reading is the first paid call of this iteration; the tracer and
      // the writer add theirs to the same bill as they go.
      useStudio.getState().noteSpend(readCost, job.threadId);
      useStudio.getState().noteMade(landed, made.id);
      if (nearly) {
        deps.publish({
          key: `studio:nearly:${made.id}`,
          title: "This could be a cube",
          body: nearly,
          level: "info",
          source: "studio",
          toast: true,
        });
      }
      const body = [
        `${made.w} × ${made.h}`,
        made.kindChanged ? `now ${made.kind}` : null,
        made.shape && made.shape !== "box" ? `cut to ${made.shape === "rounded" ? "a rounded box" : `${made.shape === "circle" ? "a" : "an"} ${made.shape}`}` : null,
        made.reproportioned ? "held to the drawing's proportion" : null,
        made.keptSize ? "at the size it was drawn" : null,
        data.patch.note,
      ].filter(Boolean).join(" · ");
      deps.publish({
        key: `studio:reshape:${made.id}`,
        title: node ? `Reshaped ${made.label}` : `Drew ${made.label}`,
        body,
        level: "success",
        source: "studio",
        toast: true,
      });
      // The shape said what the part looks like; it also said what it does.
      // The clip is already on, and this adds behaviour on top of it.
      const role = useStudio.getState().applyDrawnKind(made.id, drawnRole, drawn.words, { fresh: !node });
      if (job.want === "icon") asIcon(made.id, drawn);
      oneStep(made.id);
      const bodied = useStudio.getState().nodes.some((n) => n.id === made.id) ? await bodyFor(made.id, drawn, deps, plan, landed, still) : NOTHING_MADE;
      /*
       * What it cost, said where the person is looking — and the iteration
       * marked finished, which is the same moment.
       *
       * The toast has to be published once everything that spends has
       * spent, off the thread the whole iteration wrote to; when a later
       * pass is still running, that moment is its end rather than this one,
       * and it does both there.
       */
      if (!bodied.pending) finish(landed, deps, `studio:reshape:${made.id}`);
      return { ok: true, madeId: made.id, pending: bodied.pending, note: [body, role.did, bodied.note].filter(Boolean).join(" · "), said: sayWhere(made.label, node, over) };
    }

    // No key, a refusal, a bad reply: the drawing still shapes the part, and
    // what the shape means is read here rather than asked for, so behaviour
    // survives a locked keys panel exactly as the crop does.
    const made = applyProportion(drawn, node, job);
    const role = useStudio.getState().applyDrawnKind(made.id, drawnRole, drawn.words, { fresh: !node });
    if (job.want === "icon") asIcon(made.id, drawn);
    oneStep(made.id);
    // A drawing that made a part is an iteration whether or not a reader
    // was involved: the shape, the crop, the behaviour and the traced body
    // all happened, and the timeline is where what happened is written.
    const landed = useStudio.getState().landThread({
      id: job.threadId,
      mode: "drawing",
      state: "running",
      ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
      answer: [role.did, "read off the drawing, with no reader"].filter(Boolean).join(", "),
      sketch: { strokes: drawn.strokes as [number, number][][], words: drawn.words },
      changes: [`${node ? "reshaped" : "drew"} ${made.label} at ${made.w} × ${made.h}`, ...(nearly ? [nearly] : [])],
    });
    useStudio.getState().noteMade(landed, made.id);
    if (data.reason === "no-key") deps.onNoKey();
    const body =
      data.reason === "no-key"
        ? noKeyMessage(node
          ? `For now ${made.label} took the drawing's proportion, read off the lines, and the drawing went into the blueprint.`
          : `For now the drawing was made${over ? ` as a new part on top of ${over.label}` : " as a new part"}, read off the lines, and ${over ? `${over.label} was left as it was` : "it went into the blueprint"}.`)
        : data.message ?? (node ? "Claude couldn't read it, so the part took the drawing's proportion." : "Claude couldn't read it, so the drawing was made from its lines alone.");
    deps.publish({
      key: `studio:reshape:${made.id}`,
      title: node ? `Reshaped ${made.label} from the drawing` : `Drew ${made.label} from the drawing`,
      body,
      level: "warn",
      source: "studio",
      toast: true,
    });
    // The body does not need a reader either. Tracing the drawing is
    // Claude-free from end to end, so a locked keys panel costs the description
    // and nothing else.
    const bodied = useStudio.getState().nodes.some((n) => n.id === made.id) ? await bodyFor(made.id, drawn, deps, plan, landed, still) : NOTHING_MADE;
    // The reader was missing, not the work: the shape, the behaviour and
    // the traced body all landed, so this iteration finished — unless a
    // later pass is still going, which finishes it itself.
    if (!bodied.pending) finish(landed, deps, `studio:reshape:${made.id}`);
    /*
     * DONE, NOT FAILED, WHEN ALL THAT WAS MISSING WAS A KEY. The drawing
     * landed — the shape, the kind, the body — and only the description was
     * missing; it was marked failed, in red beside a part plainly on the
     * board (`tests/draw-no-key-wording.mjs`). A reader that fell over is
     * still a failure of the read (`tests/two-in-a-row.mjs`).
     */
    return { ok: data.reason === "no-key", madeId: made.id, pending: bodied.pending, note: [body, role.did, bodied.note].filter(Boolean).join(" · "), said: `${sayWhere(made.label, node, over)}, without a reader` };
  } catch (err) {
    // The request itself failed. The drawing is still worth keeping, and the
    // proportion it says is still the part's.
    /* Only once: when the part was already made before the throw, it is not reshaped or made a second time. */
    const made = madeId ? { id: madeId } : applyProportion(drawn, node, job);
    if (!madeId) oneStep(made.id);
    const body = err instanceof Error ? err.message : "Couldn't reach the reshape route.";
    deps.publish({
      key: `studio:reshape:${made.id}`,
      title: "The drawing could not be read",
      body,
      level: "error",
      source: "studio",
      toast: true,
    });
    // The box on the timeline is this job: it stops forming where the job
    // stopped rather than sitting half-formed for ever.
    if (job.threadId) {
      useStudio.getState().noteThread([body], job.threadId);
      finish(job.threadId, deps, `studio:reshape:${made.id}`);
    }
    return { ok: false, madeId: made.id, note: body };
  }
}

/**
 * The iteration is over: it is complete, and the bill is said.
 *
 * One place, because "complete" and "what it cost" are the same moment and
 * were drifting apart — the box reached complete when the read came back
 * and the bill was said before the second pass had spent anything. Whoever
 * finishes last calls this: the run when nothing was left going, and the
 * later passes when they were.
 */
function finish(threadId: string, deps: RunDeps, key: string) {
  useStudio.getState().markThread(threadId, "done");
  billToast(threadId, deps, key);
}

/** Nothing was made, so nothing is pending either. */
const NOTHING_MADE = { note: "", pending: false };

/**
 * Say what the iteration cost, where the person is already looking.
 *
 * A second toast rather than a longer first one: the first says what
 * appeared on the board and has to arrive with the part, and the bill is
 * not settled until the tracer and the writer have finished — which can be
 * ten seconds later. Both carry the same key, so the second replaces the
 * first rather than stacking under it.
 */
function billToast(threadId: string, deps: RunDeps, key: string) {
  const usage = useStudio.getState().threads.find((t) => t.id === threadId)?.usage;
  if (!usage) return;
  const line = sayBill({
    dollars: usage.cost ?? 0,
    ms: usage.ms ?? 0,
    calls: usage.calls ?? 0,
    ...(usage.claude ? { claude: usage.claude } : {}),
    ...(usage.renderer ? { renderer: usage.renderer } : {}),
  });
  if (!line) return;
  deps.publish({
    key: `${key}:bill`,
    title: "What that cost",
    body: line,
    level: "info",
    source: "studio",
    toast: true,
  });
}

/**
 * An Idea part is the one part with nothing in it: whatever was drawn, the
 * library had no entry for it. So it gets a body written for it, and the
 * body is judged against the drawing before it is kept (`bodyRun.ts`).
 *
 * Only the Idea part. Every other part in the library already knows what it
 * is, and a heading that quietly became a hand-written SVG would be a part
 * nobody could edit again.
 */
async function bodyFor(
  nodeId: string,
  drawn: Sketch,
  deps: RunDeps,
  plan: Planned = { steps: null, model: null, options: null },
  threadId?: string,
  /** Whether the drawing still stands (not undone): nothing is written once it does not. */
  still: () => boolean = () => true,
): Promise<{ note: string; pending: boolean }> {
  /* The drawing's own step, written into without a checkpoint of its own, and never after it was undone. */
  const later = (patch: Partial<StudioNode>) => { if (still()) useStudio.getState().updateNodeQuiet(nodeId, patch); };
  const s = useStudio.getState();
  const node = s.nodes.find((n) => n.id === nodeId);
  if (!node || node.featureId !== "custom-idea") return NOTHING_MADE;
  /*
   * As planned: no first pass.
   *
   * A plan that leaves the first pass out goes straight to the later ones,
   * and what they start from is the drawing itself — its own picture, in
   * place of the photograph of a traced body. Nothing is traced and nothing
   * is written; the card says so.
   */
  if (plan.steps && !plan.steps.includes("first")) {
    useStudio.getState().notePass("first pass · left out by the plan", threadId);
    const role = roleFromWords([node.prompt, drawn.words].filter(Boolean).join(" "));
    if (role) later({ role });
    const code: PartCode = node.code ?? { html: "", overlap: 0, attempts: 0, at: Date.now(), source: "renderer", kind: "vectorize" };
    const going = laterPasses(nodeId, node, drawn, code, bare(pictureOf(drawn.strokes)), role, deps, plan, threadId, still);
    return { note: "no first pass, as planned", pending: going };
  }
  const palette = s.look?.palette as Record<string, string> | undefined;
  // The drawing is traced, not described. No model that writes is asked
  // what the line meant, because the line is right there.
  const written = await (async () => {
    const traced = await drawBody({ label: node.label, w: node.w, h: node.h, outline: node.outline, strokes: drawn.strokes }, { onStep: deps.onStep });
    if (traced.ok) return traced;
    // Nothing was traced at all — no token, a refusal, nothing came back.
    // A part that was given words can still have a body written for it, and
    // that is the only door Claude comes through on this path.
    const words = [node.prompt, drawn.words].filter(Boolean).join("\n").trim();
    if (!words) return traced;
    deps.onStep?.("Nothing traced, writing a body from the words…");
    const wrote = await writeBody(
      {
        label: node.label,
        prompt: words,
        w: node.w,
        h: node.h,
        outline: node.outline,
        picture: pictureOf(drawn.strokes),
        palette: palette ? { bg: palette.bg, text: palette.text, accent: palette.accent, muted: palette.muted } : undefined,
        // The tracer has already been asked and had nothing; asking it again
        // inside the written loop would be the same answer twice.
        renderer: false,
      },
      { onStep: deps.onStep },
    );
    return {
      ...wrote,
      cost: wrote.cost + traced.cost,
      ms: (wrote.ms ?? 0) + (traced.ms ?? 0),
      calls: (wrote.calls ?? 0) + (traced.calls ?? 0),
      renderer: (wrote.renderer ?? 0) + (traced.renderer ?? 0),
      claude: (wrote.claude ?? 0) + (traced.claude ?? 0),
      message: [traced.message, wrote.message].filter(Boolean).join(" "),
    };
  })();
  // Spent is spent, whether or not a body came of it, and how the body got
  // here — drawn or written, at what price, how long it took, and why the
  // renderer was not used — is part of what this iteration did, so all of it
  // goes on the card.
  useStudio.getState().noteSpend({
    dollars: written.cost,
    ms: written.ms ?? 0,
    calls: written.calls ?? 0,
    ...(written.renderer ? { renderer: written.renderer } : {}),
    ...(written.claude ? { claude: written.claude } : {}),
  }, threadId);
  if (written.message) useStudio.getState().noteThread([written.message], threadId);
  if (!written.ok || !written.code) return NOTHING_MADE;
  /*
   * The drawing lands as vector first and takes a role after. The words
   * choose it when they say one; otherwise it stays null and the panel
   * asks, because a bird that quietly became an icon when it was meant to
   * be a frame is worse than a bird with no role yet.
   */
  const said = [node.prompt, drawn.words].filter(Boolean).join(" ");
  const role = roleFromWords(said);
  if (!still()) return NOTHING_MADE;
  later({
    code: written.code,
    ...(written.vector ? { vector: written.vector } : {}),
    ...(role ? { role } : {}),
  });
  // What the first pass was, on the bill as its own line, because the second
  // pass puts its own beside it and a total hides which was expensive.
  useStudio.getState().notePass(
    `first pass · ${sayPass(written.code.source === "renderer" ? `traced, ${written.code.kind ?? ""}`.trim() : "written", { ms: written.ms ?? 0, dollars: written.cost })}`,
    threadId,
  );
  /*
   * The picture of what the first pass actually put on the board.
   *
   * Already taken: the loop photographs every go to score it, so the
   * winning shot is the first pass's own render and costs nothing to reuse.
   * Without one there is nothing to refine and the later passes do not run
   * — quietly, because a part with no photograph is a part the server
   * could not render, which the first pass has already said on the card.
   */
  const kept = written.attempts.reduce<Attempt | null>((a, b) => (!a || b.overlap > a.overlap ? b : a), null);
  const going = laterPasses(nodeId, node, drawn, written.code, bare(kept?.shot), role, deps, plan, threadId, still);
  return {
    note: [written.message, role ? `used as ${role}` : written.vector ? "no role chosen yet" : ""].filter(Boolean).join(" · "),
    pending: going,
  };
}

/**
 * Fire the later passes and walk away.
 *
 * Deliberately not awaited: the part is on the board and the person is
 * looking at it, and holding the job open for a large image model would
 * undo the whole reason the first pass exists. What comes back replaces the
 * body and writes its own line on the card — on *this* iteration, named
 * now, because by the time it lands a different one may be live.
 *
 * Which later steps, in what order: the plan's, when there is one, and the
 * one refine there always was when there is not. Refine, recreate and alpha
 * run one after the other in the order the plan gives them, each starting
 * from what the one before it made — alpha as a pass of its own, routed to
 * a model that serves the alpha step (gpt-image-2 first: the picture again
 * with no ground, which beats cutting one off); the plan's model is
 * preferred at each. Read and first come before all of these by the shape
 * of the pipeline — there is nothing to refine before something has been
 * drawn — whatever position the plan wrote them at.
 *
 * Every road out of it is a line on the card. A pass that did not run is
 * never silent: the person is looking at something that was meant to be
 * replaced.
 */
function laterPasses(
  nodeId: string,
  node: StudioNode,
  drawn: Sketch,
  code: PartCode,
  first: string | null,
  role: string | null,
  deps: RunDeps,
  plan: Planned,
  threadId?: string,
  still: () => boolean = () => true,
): boolean {
  if (!first) return false;
  /*
   * This iteration's own card, not whatever is live.
   *
   * The job carries the thread it is making, and a second drawing queued
   * while this one runs would otherwise take the lines: `liveThreadId` is
   * whatever landed last, which stopped being this one the moment another
   * was queued.
   */
  const on = threadId ?? useStudio.getState().liveThreadId ?? undefined;
  const done = () => { if (on) finish(on, deps, `studio:reshape:${nodeId}`); };
  const stages = plan.steps
    ? plan.steps.filter((st): st is "refine" | "recreate" | "alpha" => st === "refine" || st === "recreate" || st === "alpha")
    : (["refine"] as const);
  if (!stages.length) {
    useStudio.getState().notePass("second pass · left out by the plan", on);
    return false;
  }
  const { mask, mode } = targetFor(node.outline ?? null, drawn.strokes);
  void (async () => {
    let picture = first;
    let base = code;
    for (const step of stages) {
      const r = await refinePart({
        nodeId,
        still,
        code: base,
        first: picture,
        step,
        prefer: plan.model ?? undefined,
        options: plan.options,
        label: node.label,
        prompt: [node.prompt, drawn.words].filter(Boolean).join("\n").trim(),
        // What was said, for deciding what is being made. A drawing that
        // asked for something you can turn is a solid, and nothing else is.
        said: [node.prompt, drawn.words].filter(Boolean).join(" ").trim(),
        /*
         * The part is cut to the line it was drawn as, so the picture behind
         * it never shows and nothing has to be asked for a transparent
         * ground. That is the first and best of the three answers to alpha,
         * and saying so lets the best model for the picture take the job.
         */
        clipped: !!node.outline,
        role,
        kind: code.kind,
        w: node.w,
        h: node.h,
        score: { target: mask, mode, clip: node.outline?.cut ?? "" },
      }, { onStep: deps.onStep });
      useStudio.getState().notePass(r.line, on);
      if (r.cut) useStudio.getState().notePass(r.cut, on);
      if (r.ok) {
        useStudio.getState().noteSpend({
          dollars: r.cost ?? 0,
          ms: r.ms ?? 0,
          calls: 1,
          ...(r.cost ? { renderer: r.cost } : {}),
        }, on);
      }
      deps.publish({
        key: `refine:${nodeId}`,
        title: r.ok
          ? (step === "recreate" ? "The real thing landed" : step === "alpha" ? "The ground came off" : "The better pass landed")
          : `The ${step === "recreate" ? "recreate" : step === "alpha" ? "ground" : "better pass"} did not run`,
        body: r.line,
        level: r.ok ? "info" : "warn",
        source: "studio",
        toast: true,
      });
      // The next step starts from what this one made, and writes over it.
      if (!r.ok) return;
      if (r.image) picture = r.image;
      base = useStudio.getState().nodes.find((n) => n.id === nodeId)?.code ?? base;
    }
  })()
    .catch(() => {
      // A thrown pass is still a pass that did not run.
      useStudio.getState().notePass("second pass · did not run: it failed on the way out", on);
    })
    // Whichever way it went, this was the last thing the iteration was
    // waiting for: it is complete here, and the bill is said here.
    .finally(done);
  return true;
}

/** Claude answered: hold every field to the catalog, the frame and the drawing (`reshape.ts`), then apply it. */
function apply(patch: ReshapePatch, drawn: Sketch, node: StudioNode | null, job: DrawJob) {
  const s = useStudio.getState();
  const { frameWidth } = job;
  // The proportion held is the boundary's: the outline the author drew round
  // the part, not the box round every mark that fell outside it.
  const bounds = readBoundary(drawn);
  /*
   * The preselect, as a part id.
   *
   * `surface` is not in here because a surface is not a part: a boundary
   * becomes a `Space` (`space.ts`) and never goes through the reader at all,
   * so it is handled where the line is drawn. `part` is absent because it IS
   * the reader working it out, which is what this whole path does.
   */
  const WANTED: Record<string, string> = { icon: "drawn-icon", cube: "cube-3d" };
  const made = checkAnswer({ patch, node, drawn, aspect: bounds?.aspect ?? 1, outline: bounds?.shape, frameWidth, kind: kindInfo, drawnSize: job.drawn ?? null,
    want: job.want ? WANTED[job.want] ?? null : null });
  const { featureId, label, w, h, options, kindChanged, reproportioned, keptSize } = made;
  const shared: Partial<StudioNode> = {
    featureId,
    label,
    w,
    h,
    options,
    sketch: drawn,
    // A circle drawn round something makes it a circle, not a square — and
    // anything the five names do not cover is cut to the line itself.
    ...(made.shape ? { shape: made.shape === "box" ? null : made.shape } : {}),
    outline: outlinePath(drawn),
    ...(made.content != null ? { content: made.content } : {}),
    ...(made.prompt != null ? { prompt: made.prompt } : {}),
    // A part that became another kind is a custom idea exactly when `addNode` would say so.
    ...(kindChanged ? { custom: made.custom } : {}),
  };
  const kind = getFeature(featureId)?.name ?? label;
  if (node) {
    s.updateNode(node.id, { ...shared, x: clamp(node.x, 0, Math.max(0, frameWidth - w)) });
    return { id: node.id, label, w, h, kind, kindChanged, reproportioned, keptSize, shape: made.shape };
  }
  const where = job.at ?? { x: frameWidth / 2, y: 200 };
  // On whole pixels, as every other part lands: a drawing's middle is wherever the hand was.
  const id = s.addNode(featureId, Math.round(clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w))), Math.round(Math.max(0, where.y - h / 2)), shared);
  return { id, label, w, h, kind, kindChanged, reproportioned, keptSize, shape: made.shape };
}

/** No reader: the drawing's proportion is the reshape, and the drawing is kept. */
/**
 * Does this drawing stand on its own?
 *
 * A box is a cube only when it is nothing else first: not the frame round
 * three cards, not the new edge of a hero. So the board is asked what is
 * inside the drawing's box, and what it was drawn on. A blank idea part
 * (dropped to be drawn on, with nothing typed in it) counts as nothing;
 * any real part, or any part inside the box, means the box is about them.
 */
function loneDrawing(node: StudioNode | null, job: DrawJob): boolean {
  const s = useStudio.getState();
  if (node && (node.featureId !== "custom-idea" || plain(node.content).trim())) return false;
  const box = node
    ? { x: node.x, y: node.y, w: node.w, h: node.h }
    : job.at && job.drawn
      ? { x: job.at.x - job.drawn.w / 2, y: job.at.y - job.drawn.h / 2, w: job.drawn.w, h: job.drawn.h }
      : null;
  if (!box) return true;
  const pageId = node?.pageId ?? s.activePageId;
  const inside = s.nodes.some((n) =>
    n.id !== node?.id && n.pageId === pageId &&
    n.x + n.w / 2 >= box.x && n.x + n.w / 2 <= box.x + box.w && n.y + n.h / 2 >= box.y && n.y + n.h / 2 <= box.y + box.h);
  return !inside;
}

function applyProportion(drawn: Sketch, node: StudioNode | null, job: DrawJob) {
  const s = useStudio.getState();
  const { frameWidth } = job;
  const b = readBoundary(drawn);
  /*
   * The shape needs no reader either: it was measured off the drawing.
   * With no key the part still comes out round when a circle was drawn
   * round it, and square when the circle was a square.
   */
  const shape: NodeShape | null | undefined =
    b?.shape === "circle" ? "circle"
      : b?.shape === "ellipse" ? "ellipse"
        : b?.shape === "rounded box" ? "rounded"
          : b?.shape === "box" ? null
            : undefined;
  const shaped: Partial<StudioNode> = { ...(shape === undefined ? {} : { shape }), outline: outlinePath(drawn) };
  if (node) {
    const fitted = fitToSketch(drawn, node.w, node.h, frameWidth);
    const side = Math.round(Math.sqrt(Math.max(40 * 24, fitted.w * fitted.h)));
    const w = shape === "circle" ? side : fitted.w;
    const h = shape === "circle" ? side : fitted.h;
    // Reshaping an existing part keeps that part's area on purpose: the
    // drawing said what shape it is, not how big the thing on the page is.
    s.updateNode(node.id, { w, h, sketch: drawn, ...shaped, x: clamp(node.x, 0, Math.max(0, frameWidth - w)) });
    return { id: node.id, label: node.label, w, h };
  }
  /*
   * A new part with nothing to keep the area of.
   *
   * When the board said how big the drawing was, that is the size: ink
   * drawn eighty pixels wide became a band across the whole page, because
   * the strokes are fractions of their own box and the only thing left to
   * read was "a third of the disc". Only a drawing actually made across the
   * page is made across the page.
   */
  const drewWide = !job.drawn || job.drawn.w >= frameWidth * FULL_BLEED;
  /*
   * A drawing too small to be a part is grown to the floors *in
   * proportion*. The floors are different on each axis (80 wide, 24 tall),
   * so clamping each on its own turned a 44 × 36 mark into an 80 × 36 one:
   * the proportion, the one thing a bare drawing says, was lost to a
   * minimum. Both sides are scaled by the same factor instead.
   */
  const raw = job.drawn && !drewWide
    ? { w: job.drawn.w, h: job.drawn.h }
    : { w: (b?.box.w ?? 0.3) * frameWidth, h: ((b?.box.w ?? 0.3) * frameWidth) / (b?.aspect ?? 1) };
  const grow = Math.max(1, 80 / Math.max(1, raw.w), 24 / Math.max(1, raw.h));
  // And one taller than the ceiling is brought under it the same way, both
  // sides by one factor, so a tall column stays the column it was drawn.
  const tall = raw.h * grow > PART_MAX_H ? PART_MAX_H / (raw.h * grow) : 1;
  const w = clamp(Math.round(raw.w * grow * tall), 80, frameWidth);
  const h = shape === "circle" ? w : clamp(Math.round(raw.h * grow * tall), 24, PART_MAX_H);
  const label = nameFrom(drawn.words) || "Drawn part";
  const where = job.at ?? { x: frameWidth / 2, y: 200 };
  const id = s.addNode("custom-idea", Math.round(clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w))), Math.round(Math.max(0, where.y - h / 2)), {
    w, h, label, prompt: drawn.words, sketch: drawn, ...shaped,
  });
  return { id, label, w, h };
}
