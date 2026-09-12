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
import { FULL_BLEED, checkAnswer, clamp, type KindInfo, type ReshapePatch } from "./reshape";
import { describeSketch, fitToSketch, outlinePath, readBoundary, type Sketch, type SketchPoint } from "./sketch";
import { useStudio, type NodeShape, type StudioNode } from "./store";
import type { DrawJob } from "./queue";
import { targetFor, writeBody, type Attempt } from "./bodyRun";
import { refinePart } from "./refineRun";
import type { PartCode } from "./snippet";
import { drawBody } from "./drawRun";
import { pickCoded } from "./coded";
import { kindOfSketch } from "./shapeKind";
import { roleFromWords } from "./vector";
import { claudeSpend, sayBill, sayPass } from "./spend";

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
      return { ok: true, madeId: made.id, note: did };
    }

    deps.onStep?.("Claude is reading the drawing…");
    // What the person waits for is measured, not estimated.
    const readFrom = Date.now();
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
    const data = (await res.json()) as {
      ok: boolean;
      patch?: ReshapePatch;
      message?: string;
      reason?: string;
      usage?: { model?: string; input?: number; output?: number; cached?: number };
    };
    const readCost = claudeSpend(data.usage, Date.now() - readFrom);
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
      // The reading is the first paid call of this iteration; the tracer and
      // the writer add theirs to the same bill as they go.
      useStudio.getState().noteSpend(readCost);
      useStudio.getState().noteMade(landed, made.id);
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
      const role = useStudio.getState().applyDrawnKind(made.id, drawnRole, drawn.words);
      const bodied = useStudio.getState().nodes.some((n) => n.id === made.id) ? await bodyFor(made.id, drawn, deps) : "";
      useStudio.getState().markThread(landed, "done");
      /*
       * What it cost, said where the person is looking.
       *
       * The toast has to be published before the body is traced, because a
       * toast that arrives ten seconds after the part did is not a report;
       * so the bill is added to it here, once everything that spends has
       * spent, off the thread the whole iteration wrote to.
       */
      billToast(landed, deps, `studio:reshape:${made.id}`);
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
    useStudio.getState().noteMade(landed, made.id);
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
    billToast(landed, deps, `studio:reshape:${made.id}`);
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
  });
  if (written.message) useStudio.getState().noteThread([written.message]);
  if (!written.ok || !written.code) return "";
  /*
   * The drawing lands as vector first and takes a role after. The words
   * choose it when they say one; otherwise it stays null and the panel
   * asks, because a bird that quietly became an icon when it was meant to
   * be a frame is worse than a bird with no role yet.
   */
  const said = [node.prompt, drawn.words].filter(Boolean).join(" ");
  const role = roleFromWords(said);
  useStudio.getState().updateNode(nodeId, {
    code: written.code,
    ...(written.vector ? { vector: written.vector } : {}),
    ...(role ? { role } : {}),
  });
  // What the first pass was, on the bill as its own line, because the second
  // pass puts its own beside it and a total hides which was expensive.
  useStudio.getState().notePass(
    `first pass · ${sayPass(written.code.source === "renderer" ? `traced, ${written.code.kind ?? ""}`.trim() : "written", { ms: written.ms ?? 0, dollars: written.cost })}`,
  );
  secondPass(nodeId, node, drawn, written.code, written.attempts, role, deps);
  return [written.message, role ? `used as ${role}` : written.vector ? "no role chosen yet" : ""].filter(Boolean).join(" · ");
}

/**
 * Fire the second pass and walk away.
 *
 * Deliberately not awaited: the part is on the board and the person is
 * looking at it, and holding the job open for a large image model would
 * undo the whole reason the first pass exists. What comes back replaces the
 * body and writes its own line on the card — on *this* iteration, named
 * now, because by the time it lands a different one may be live.
 *
 * Every road out of it is a line on the card. A second pass that did not
 * run is never silent: the person is looking at something that was meant to
 * be replaced.
 */
function secondPass(
  nodeId: string,
  node: StudioNode,
  drawn: Sketch,
  code: PartCode,
  attempts: Attempt[],
  role: string | null,
  deps: RunDeps,
) {
  /*
   * The picture of what the first pass actually put on the board.
   *
   * Already taken: the loop photographs every go to score it, so the
   * winning shot is the first pass's own render and costs nothing to reuse.
   * Without one there is nothing to refine and the second pass does not
   * run — quietly, because a part with no photograph is a part the server
   * could not render, which the first pass has already said on the card.
   */
  const kept = attempts.reduce<Attempt | null>((a, b) => (!a || b.overlap > a.overlap ? b : a), null);
  const first = bare(kept?.shot);
  if (!first) return;
  const on = useStudio.getState().liveThreadId ?? undefined;
  const { mask, mode } = targetFor(node.outline ?? null, drawn.strokes);
  void refinePart({
    nodeId,
    code,
    first,
    label: node.label,
    prompt: [node.prompt, drawn.words].filter(Boolean).join("\n").trim(),
    role,
    kind: code.kind,
    w: node.w,
    h: node.h,
    score: { target: mask, mode, clip: node.outline?.cut ?? "" },
  }, { onStep: deps.onStep })
    .then((r) => {
      useStudio.getState().notePass(r.line, on);
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
        title: r.ok ? "The better pass landed" : "The better pass did not run",
        body: r.line,
        level: r.ok ? "info" : "warn",
        source: "studio",
        toast: true,
      });
    })
    .catch(() => {
      // A thrown second pass is still a second pass that did not run.
      useStudio.getState().notePass("second pass · did not run: it failed on the way out", on);
    });
}

/** Claude answered: hold every field to the catalog, the frame and the drawing (`reshape.ts`), then apply it. */
function apply(patch: ReshapePatch, drawn: Sketch, node: StudioNode | null, job: DrawJob) {
  const s = useStudio.getState();
  const { frameWidth } = job;
  // The proportion held is the boundary's: the outline the author drew round
  // the part, not the box round every mark that fell outside it.
  const bounds = readBoundary(drawn);
  const made = checkAnswer({ patch, node, drawn, aspect: bounds?.aspect ?? 1, outline: bounds?.shape, frameWidth, kind: kindInfo, drawnSize: job.drawn ?? null });
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
  const id = s.addNode(featureId, clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w)), Math.max(0, where.y - h / 2), shared);
  return { id, label, w, h, kind, kindChanged, reproportioned, keptSize, shape: made.shape };
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
  const w = job.drawn && !drewWide
    ? clamp(Math.round(job.drawn.w), 80, frameWidth)
    : clamp(Math.round((b?.box.w ?? 0.3) * frameWidth), 80, frameWidth);
  const h = shape === "circle"
    ? w
    : job.drawn && !drewWide
      ? clamp(Math.round(job.drawn.h), 24, 1600)
      : clamp(Math.round(w / (b?.aspect ?? 1)), 24, 1600);
  const label = text(drawn.words, 40) || "Drawn part";
  const where = job.at ?? { x: frameWidth / 2, y: 200 };
  const id = s.addNode("custom-idea", clamp(where.x - w / 2, 0, Math.max(0, frameWidth - w)), Math.max(0, where.y - h / 2), {
    w, h, label, prompt: drawn.words, sketch: drawn, ...shaped,
  });
  return { id, label, w, h };
}
