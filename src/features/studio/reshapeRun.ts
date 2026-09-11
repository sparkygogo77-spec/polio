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
import type { NewsInput } from "@/core/types";
import { FEATURES, getFeature } from "./catalog";
import { keyHeader, noKeyMessage } from "./agent";
import { checkAnswer, clamp, type KindInfo, type ReshapePatch } from "./reshape";
import { describeSketch, fitToSketch, outlinePath, readBoundary, type Sketch, type SketchPoint } from "./sketch";
import { useStudio, type NodeShape, type StudioNode } from "./store";
import type { DrawJob } from "./queue";
import { writeBody } from "./bodyRun";
import { drawBody } from "./drawRun";
import { pickCoded } from "./coded";
import { kindOfSketch } from "./shapeKind";

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

export interface RunDeps {
  publish: (input: NewsInput) => void;
  /** The vault is locked or empty and the reader could not run. */
  onNoKey: () => void;
  /** What the counter says this job is doing. */
  onStep?: (step: string) => void;
}

export interface RunResult {
  ok: boolean;
  madeId?: string;
  note: string;
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
  const drawn = job.sketch;
  const s = useStudio.getState();
  const node = job.nodeId ? s.nodes.find((n) => n.id === job.nodeId) ?? null : null;
  const feature = node ? getFeature(node.featureId) : null;
  const { frameWidth } = job;

  try {
    /*
     * The catalogue first, and it needs no reader.
     *
     * A drawing that is plainly a part we already have — a cube, and
     * whatever is added to `coded.ts` next — is answered here, for nothing,
     * the same way every time. Only when nothing in the catalogue fits does
     * the drawing go up to be read and, failing that, traced. The fall
     * through is still there; it is no longer the only road.
     */
    const drawnRole = kindOfSketch(drawn, node?.prompt ?? "");
    const ctx = { sketch: drawn, prompt: node?.prompt ?? "", node };
    const picked = pickCoded(ctx);
    if (picked) {
      deps.onStep?.(`Reading the shape: ${picked.part.id}…`);
      const made = applyProportion(drawn, node, job);
      const { patch, did } = picked.part.configure(ctx);
      useStudio.getState().updateNode(made.id, patch);
      const label = patch.featureId ? getFeature(patch.featureId)?.name ?? made.label : made.label;
      useStudio.getState().landThread({
        mode: "drawing",
        // A part out of the catalogue is one step and it is over: nothing
        // is written or traced after it.
        state: "done",
        ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
        answer: `${did}, chosen off the drawing with no model asked`,
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
      return { ok: true, madeId: made.id, note: did };
    }

    deps.onStep?.("Claude is reading the drawing…");
    const res = await fetch("/api/studio/reshape", {
      method: "POST",
      headers: { "content-type": "application/json", ...keyHeader() },
      body: JSON.stringify({
        sketch: drawn,
        picture: job.picture,
        frameWidth,
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
    const data = (await res.json()) as { ok: boolean; patch?: ReshapePatch; message?: string; reason?: string; usage?: { model?: string } };
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
        mode: "drawing",
        state: "running",
        model: data.usage?.model,
        ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
        answer: data.patch.note ?? "",
        // The drawing goes on the thread: an element prompt is the line,
        // and the timeline shows the line rather than a sentence about it.
        sketch: { strokes: drawn.strokes as [number, number][][], words: drawn.words },
        changes: [`${node ? "reshaped" : "drew"} ${made.label} at ${made.w} × ${made.h}`, ...(made.kindChanged ? [`now a ${made.kind}`] : [])],
      });
      const body = [
        `${made.w} × ${made.h}`,
        made.kindChanged ? `now ${made.kind}` : null,
        made.shape && made.shape !== "box" ? `cut to ${made.shape === "rounded" ? "a rounded box" : `${made.shape === "circle" ? "a" : "an"} ${made.shape}`}` : null,
        made.reproportioned ? "held to the drawing's proportion" : null,
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
      const role = useStudio.getState().applyDrawnKind(made.id, drawnRole, drawn.words);
      const bodied = useStudio.getState().nodes.some((n) => n.id === made.id) ? await bodyFor(made.id, drawn, deps) : "";
      useStudio.getState().markThread(landed, "done");
      return { ok: true, madeId: made.id, note: [body, role.did, bodied].filter(Boolean).join(" · ") };
    }

    // No key, a refusal, a bad reply: the drawing still shapes the part, and
    // what the shape means is read here rather than asked for, so behaviour
    // survives a locked vault exactly as the crop does.
    const made = applyProportion(drawn, node, job);
    const role = useStudio.getState().applyDrawnKind(made.id, drawnRole, drawn.words);
    // A drawing that made a part is an iteration whether or not a reader
    // was involved: the shape, the crop, the behaviour and the traced body
    // all happened, and the timeline is where what happened is written.
    const landed = useStudio.getState().landThread({
      mode: "drawing",
      state: "running",
      ask: [drawn.words.trim(), `a drawing of ${describeSketch({ strokes: drawn.strokes, words: "" })}`].filter(Boolean).join("\n"),
      answer: [role.did, "read off the drawing, with no reader"].filter(Boolean).join(", "),
      sketch: { strokes: drawn.strokes as [number, number][][], words: drawn.words },
      changes: [`${node ? "reshaped" : "drew"} ${made.label} at ${made.w} × ${made.h}`],
    });
    if (data.reason === "no-key") deps.onNoKey();
    const body =
      data.reason === "no-key"
        ? noKeyMessage("For now the part took the drawing's proportion and the drawing went into the blueprint.")
        : data.message ?? "Claude couldn't read it, so the part took the drawing's proportion.";
    deps.publish({
      key: `studio:reshape:${made.id}`,
      title: node ? `Reshaped ${made.label} from the drawing` : `Drew ${made.label} from the drawing`,
      body,
      level: "warn",
      source: "studio",
      toast: true,
    });
    // The body does not need a reader either. Tracing the drawing is
    // Claude-free from end to end, so a locked vault costs the description
    // and nothing else.
    const bodied = useStudio.getState().nodes.some((n) => n.id === made.id) ? await bodyFor(made.id, drawn, deps) : "";
    // The reader was missing, not the work: the shape, the behaviour and
    // the traced body all landed, so this iteration finished.
    useStudio.getState().markThread(landed, "done");
    return { ok: false, madeId: made.id, note: [body, role.did, bodied].filter(Boolean).join(" · ") };
  } catch (err) {
    // The request itself failed. The drawing is still worth keeping, and the
    // proportion it says is still the part's.
    const made = applyProportion(drawn, node, job);
    const body = err instanceof Error ? err.message : "Couldn't reach the reshape route.";
    deps.publish({
      key: `studio:reshape:${made.id}`,
      title: "The drawing could not be read",
      body,
      level: "error",
      source: "studio",
      toast: true,
    });
    return { ok: false, madeId: made.id, note: body };
  }
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
async function bodyFor(nodeId: string, drawn: Sketch, deps: RunDeps): Promise<string> {
  const s = useStudio.getState();
  const node = s.nodes.find((n) => n.id === nodeId);
  if (!node || node.featureId !== "custom-idea") return "";
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
    return { ...wrote, cost: wrote.cost + traced.cost, message: [traced.message, wrote.message].filter(Boolean).join(" ") };
  })();
  // Spent is spent, whether or not a body came of it, and how the body got
  // here — drawn or written, at what price, and why the renderer was not
  // used — is part of what this iteration did, so it goes on the card.
  if (written.cost) useStudio.getState().noteCost(written.cost);
  if (written.message) useStudio.getState().noteThread([written.message]);
  if (!written.ok || !written.code) return "";
  useStudio.getState().updateNode(nodeId, { code: written.code });
  return written.message;
}

/** Claude answered: hold every field to the catalog, the frame and the drawing (`reshape.ts`), then apply it. */
function apply(patch: ReshapePatch, drawn: Sketch, node: StudioNode | null, job: DrawJob) {
  const s = useStudio.getState();
  const { frameWidth } = job;
  // The proportion held is the boundary's: the outline the author drew round
  // the part, not the box round every mark that fell outside it.
  const bounds = readBoundary(drawn);
  const made = checkAnswer({ patch, node, drawn, aspect: bounds?.aspect ?? 1, outline: bounds?.shape, frameWidth, kind: kindInfo });
  const { featureId, label, w, h, options, kindChanged, reproportioned } = made;
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
    return { id: node.id, label, w, h, kind, kindChanged, reproportioned, shape: made.shape };
  }
  const where = job.at ?? { x: frameWidth / 2, y: 200 };
  const id = s.addNode(featureId, clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w)), Math.max(0, where.y - h / 2), shared);
  return { id, label, w, h, kind, kindChanged, reproportioned, shape: made.shape };
}

/** No reader: the drawing's proportion is the reshape, and the drawing is kept. */
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
    s.updateNode(node.id, { w, h, sketch: drawn, ...shaped, x: clamp(node.x, 0, Math.max(0, frameWidth - w)) });
    return { id: node.id, label: node.label, w, h };
  }
  // A new part with nothing to keep the area of: the board is read as the
  // page, so a boundary across a third of it is a part across a third of
  // the frame.
  const w = clamp(Math.round((b?.box.w ?? 0.3) * frameWidth), 80, frameWidth);
  const h = shape === "circle" ? w : clamp(Math.round(w / (b?.aspect ?? 1)), 24, 1600);
  const label = text(drawn.words, 40) || "Drawn part";
  const where = job.at ?? { x: frameWidth / 2, y: 200 };
  const id = s.addNode("custom-idea", clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w)), Math.max(0, where.y - h / 2), {
    w, h, label, prompt: drawn.words, sketch: drawn, ...shaped,
  });
  return { id, label, w, h };
}
