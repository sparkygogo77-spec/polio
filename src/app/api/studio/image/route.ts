import Replicate from "replicate";
import { NextResponse } from "next/server";
import { cleanSnippet, RENDER_LIMIT } from "@/features/studio/snippet";
import {
  fluxRatio,
  fromPicture,
  isRenderKind,
  RENDER_COST,
  RENDER_MODELS,
  RENDER_UNAVAILABLE,
  rasterFragment,
  recraftSize,
  renderPrompt,
  type RenderKind,
} from "@/features/studio/renderer";
import {
  inputFor,
  isSolid,
  model as modelNamed,
  makingOf,
  needsAlpha,
  noModelSays,
  route,
  wordsFor,
} from "@/features/studio/imageRoute";
import { fromMetrics } from "@/features/studio/spend";

/**
 * The renderer service: a part's body, drawn rather than written.
 *
 * The token belongs to the person, not to the deployment. It is typed into
 * the vault under the key button, held in this browser exactly as the
 * Claude key is, unlocked the same way, and rides with each call as
 * `x-replicate-key`. This route holds it for the length of the call and no
 * longer: it is never written to disk, never logged, never echoed back —
 * the one place a library's error message could carry it is scrubbed on the
 * way out — and `/api/keys/status` reports only whether the server happens
 * to have one of its own.
 *
 * `REPLICATE_API_TOKEN` in the environment still works, and is a silent
 * fallback rather than the path: a browser that offered a token is using
 * that token, because the person who typed it is the person being charged
 * for the call.
 *
 * Two kinds:
 *
 * - `vector` goes to `recraft-ai/recraft-v3-svg` and comes back as SVG,
 *   which is cleaned by `cleanSnippet` exactly like a body Claude wrote and
 *   renders under the same sandbox and the same content policy. A drawing
 *   model's markup is not more trusted than a writing model's.
 * - `raster` goes to `black-forest-labs/flux-2-pro` and comes back as a
 *   `data:` URI inside an `<img>`, so nothing is fetched when the part is
 *   drawn. Nothing may be.
 *
 * With no token anywhere it answers HTTP 200 with `ok: false` and `reason:
 * "unavailable"`, the same shape and the same path as a missing Claude
 * key, so the dialog shows the reason and the body loop falls back to
 * writing one. A vault that holds a token but is locked is the common case,
 * and the caller says so rather than "no token".
 *
 * The price of the call rides back with the answer (`cost`), because this
 * is the first thing here that spends money per press.
 *
 * **Two stages.** A drawing lands twice. Stage one is everything above: the
 * path a part already took, answered as fast as it can be, so what was
 * drawn is on the board while the person is still looking at it. Stage two
 * is a large image model that takes stage one's picture and refines it, and
 * replaces it on the card when it arrives. It is asked for with `stage: 2`
 * and is a second request rather than a longer first one, because the whole
 * point is that the first answer is not held back for the second.
 *
 * Which model runs stage two is read out of `imageRoute.ts`, which routes on
 * two questions and never on a slug written here: *what is being made* —
 * a mark, a surface, a picture, something with real type in it, an object
 * you can turn — and *which step this is*. A mark and a surface have to
 * come back with a transparent ground or they land on the board as filled
 * rectangles, and only part of the table can do that; a surface often wants
 * a band no other model's ratio list has.
 *
 * Stage two never fails the render. No token, no model in the table that
 * can make what this part needs, or a call that failed: stage one stands,
 * and the answer says on the card that the better pass did not run and why.
 *
 * What stage two cost and how long it took is read off the prediction
 * itself rather than a price list. Replicate publishes no rate for these
 * models, so when the prediction reports no number the card says the cost
 * was not reported — which is the true thing to say, and better than a
 * figure somebody invented.
 */

export const runtime = "nodejs";
export const maxDuration = 180;

/** A raster body is carried in the document, so it has a ceiling a document can hold. */
const RASTER_LIMIT = 2_400_000;

/**
 * …and a solid is carried the same way, so it has one too.
 *
 * Higher, because a mesh is the whole part rather than one picture inside a
 * page, and because a solid small enough to be worthless is not a cheaper
 * solid. Still a ceiling: the document goes into this browser's own storage
 * and into publish, and a file nobody can save is not a part. The face
 * count asked for in the table is what usually keeps it under.
 */
const MESH_LIMIT = 3_600_000;

interface Body {
  kind?: string;
  /** The drawing, for the kinds that trace rather than imagine: PNG, base64, no data-URL head. */
  picture?: string;
  prompt?: string;
  label?: string;
  closed?: boolean;
  w?: number;
  h?: number;
  palette?: { bg?: string; text?: string; accent?: string; muted?: string };
  /** 2 asks for the second pass. Anything else is the first, unchanged. */
  stage?: number;
  /** What stage one produced, as a picture: PNG, base64, no data-URL head. */
  first?: string;
  /** What the part is for, which is what decides whether it needs a transparent ground. */
  role?: string | null;
  /**
   * A drawing and what it became once somebody was happy with it.
   *
   * Handed to a model that does example-based editing as the first two
   * images: it works out what was done between them and does the same to
   * the drawing that follows. This is the house style, carried by an
   * example rather than by a paragraph describing it.
   */
  example?: { before?: string; after?: string };
  /** Does the thing being made have real text in it? That changes which model draws it. */
  hasText?: boolean;
  /**
   * Which step this is, when it is not the refine: `recreate` is the
   * grounded step — the real thing the drawing stands for, from the world —
   * which the create space's second phase runs.
   */
  step?: "refine" | "recreate";
  /**
   * Did the person explicitly ask for something real-world?
   *
   * Grounding is off by default: a model that can search the web and search
   * images is told not to, in so many words, unless the step is recreate or
   * this is set. Only a model that declares the fields is sent them.
   */
  grounded?: boolean;
  /**
   * Whether the ground comes off, when the node's plan has said. Unsaid,
   * decided here from what is being made and whether the part is clipped.
   */
  alpha?: boolean;
  /** Is the part the ground rather than a thing on it? A ground wants no alpha and a wide frame. */
  ground?: boolean;
  /**
   * Is the part cut to a line somebody drew?
   *
   * The first and best answer to a transparent ground, and it costs
   * nothing: the board clips a drawn part to its own path, so the picture
   * behind it never shows. A clipped part is not sent to a model for its
   * alpha, which leaves the job to whichever model is best at the picture.
   */
  clipped?: boolean;
  /**
   * What was said next to the drawing.
   *
   * Read only to decide *what is being made*, never handed to a model on
   * the drawing path — a solid is asked for in words and drawn in strokes,
   * and the strokes are the whole brief.
   */
  said?: string;
  /** Which model runs the second pass, when something wants to say. */
  model?: string;
}

/**
 * The token for this call: the browser's, or the server's if it has one.
 *
 * The browser's wins, unlike every other route here, because this is the
 * one key the person is expected to bring: they typed it into the vault and
 * they are the one being billed for the call. It is returned, used, and
 * dropped when the request ends; nothing holds it.
 */
function tokenFor(request: Request): string | null {
  const supplied = request.headers.get("x-replicate-key")?.trim();
  if (supplied && supplied.length > 8) return supplied;
  const own = process.env.REPLICATE_API_TOKEN?.trim();
  return own || null;
}

/** Nothing that leaves here may contain the token, whatever a library put in a message. */
function safe(message: string, token: string | null): string {
  const clean = token ? message.split(token).join("[token]") : message;
  return clean.replace(/r8_[A-Za-z0-9]{8,}/g, "[token]").slice(0, 400);
}

/**
 * What the model is handed beyond the words.
 *
 * Kept separate from the prompt because it is the part that can be wrong:
 * a model's input schema is its own, and a field it does not know is a 422
 * rather than a shrug. So a rejected call is retried with the prompt alone,
 * which every model on Replicate takes.
 */
function shapeFor(kind: RenderKind, w: number, h: number): Record<string, unknown> {
  if (kind === "vectorize") return {};
  return kind === "vector"
    ? { size: recraftSize(w, h), style: "any" }
    : { aspect_ratio: fluxRatio(w, h), output_format: "webp", safety_tolerance: 2 };
}

/**
 * The ground a tracer draws under the drawing.
 *
 * A picture handed to a vectorizer has a background, and the vectorizer
 * traces it: the first thing in the SVG is a rectangle the size of the
 * frame, filled white. On a part that is an opaque plate where there should
 * be a line, so it goes — always, not as a tuning knob. Only a shape that
 * covers the whole frame and is filled is touched; a drawing that genuinely
 * is a filled square keeps its square, because the square it drew is not
 * the first element under a `<svg>` tag with the viewBox's own dimensions.
 */
function dropGround(svg: string): { html: string; dropped: boolean } {
  const box = /viewBox\s*=\s*"([-\d.eE]+)[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)[,\s]+([-\d.eE]+)"/i.exec(svg);
  const w = box ? Number(box[3]) : 0;
  const h = box ? Number(box[4]) : 0;
  const open = svg.search(/<svg\b[^>]*>/i);
  if (open < 0) return { html: svg, dropped: false };
  const after = svg.indexOf(">", open) + 1;
  // Whatever comes first, skipping the bits that paint nothing.
  const head = svg.slice(after, after + 1400);
  const first = /<(rect|path|polygon)\b[^>]*\/?>/i.exec(head.replace(/<(defs|title|desc|metadata|style)\b[\s\S]*?<\/\1\s*>/gi, (m) => " ".repeat(m.length)));
  if (!first) return { html: svg, dropped: false };
  const tag = first[0];
  if (/fill\s*=\s*"?none/i.test(tag)) return { html: svg, dropped: false };
  const full =
    first[1]!.toLowerCase() === "rect"
      ? (() => {
          const rw = Number(/\bwidth\s*=\s*"([-\d.eE%]+)"/i.exec(tag)?.[1] ?? 0);
          const rh = Number(/\bheight\s*=\s*"([-\d.eE%]+)"/i.exec(tag)?.[1] ?? 0);
          return /width\s*=\s*"100%"/i.test(tag) || (w > 0 && rw >= w * 0.98 && rh >= h * 0.98);
        })()
      : w > 0 && new RegExp(`M\\s*-?0?\\.?0*[,\\s]`).test(tag) && tag.includes(String(Math.round(w)));
  if (!full) return { html: svg, dropped: false };
  const at = svg.indexOf(tag, after);
  return { html: svg.slice(0, at) + svg.slice(at + tag.length), dropped: true };
}

/** What each model is handed: a picture to trace, or words to imagine from. */
function input(kind: RenderKind, words: string, picture: string | null, w: number, h: number): Record<string, unknown> {
  if (fromPicture(kind)) return { image: `data:image/png;base64,${picture}` };
  return { prompt: words, ...shapeFor(kind, w, h) };
}

/** The bytes behind whatever `run` gave back: a file, a URL, a data URI, or the first of a list. */
async function bytesOf(out: unknown): Promise<{ bytes: Uint8Array; type: string } | null> {
  if (out == null) return null;
  if (Array.isArray(out)) return out.length ? bytesOf(out[0]) : null;
  if (typeof out === "object" && typeof (out as { blob?: unknown }).blob === "function") {
    const blob = await (out as { blob: () => Promise<Blob> }).blob();
    return { bytes: new Uint8Array(await blob.arrayBuffer()), type: blob.type || "" };
  }
  const url = typeof out === "string" ? out : String((out as { url?: () => URL }).url?.() ?? "");
  if (!/^https?:\/\/|^data:/.test(url)) return null;
  const res = await fetch(url);
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
}

/** What an image's bytes say they are, when the transport did not say. */
function mimeOf(bytes: Uint8Array, said: string): string {
  const clean = said.split(";")[0]!.trim();
  if (clean.startsWith("image/")) return clean;
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "image/webp";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  return "image/png";
}

interface Prediction {
  output?: unknown;
  metrics?: Record<string, unknown>;
  error?: unknown;
  status?: string;
}

/**
 * One prediction, run and waited on.
 *
 * `predictions.create` rather than `run`, because `run` hands back the
 * output alone and what a pass has to report — what it cost, how long the
 * model itself took — is on the prediction.
 */
async function predict(replicate: Replicate, slug: `${string}/${string}`, input: Record<string, unknown>): Promise<Prediction> {
  const started = await replicate.predictions.create({ model: slug, input });
  return replicate.wait(started, { interval: 700 });
}

/**
 * The token count a model's log reports, when it reports one.
 *
 * Nano Banana 2's log says how many tokens a generation took, which is the
 * number its price is set by; it is on the card next to the cost when it is
 * there, and absent when it is not. Read off the log, never computed.
 */
export function tokensOf(logs: unknown): number | null {
  if (typeof logs !== "string") return null;
  const m = /(\d[\d,]*)\s*(?:output\s+|total\s+)?tokens?\b/i.exec(logs);
  if (!m) return null;
  const n = Number(m[1]!.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** A picture that arrived as base64, or nothing. Never a data URL, never a URL. */
function picture(v: unknown, limit = 4_000_000): string | null {
  return typeof v === "string" && /^[A-Za-z0-9+/=]+$/.test(v) && v.length < limit ? v : null;
}

/**
 * The second pass.
 *
 * Stage one's picture goes in, a better one comes out, and the two-axis
 * table in `imageRoute.ts` decides which model sees it — from what is being
 * made and which step this is, never from a slug written here. Nothing in
 * this function can fail the render: every road out that is not a finished
 * picture is an `ok: false` the caller shows on the card while keeping what
 * stage one drew.
 */
async function refine(body: Body, token: string) {
  const first = picture(body.first);
  if (!first) {
    return NextResponse.json({ ok: false, stage: 2, reason: "no-first", message: "The second pass had no first pass to work from." }, { status: 400 });
  }
  const w = Math.round(Math.max(24, Math.min(4000, Number(body.w) || 320)));
  const h = Math.round(Math.max(24, Math.min(4000, Number(body.h) || 320)));
  const before = picture(body.example?.before);
  const after = picture(body.example?.after);
  const hasPair = !!before && !!after;

  /*
   * The two questions, in order. What is being made comes first because it
   * decides whether a transparent ground is required, and that rules most
   * of the table out before the step is even considered.
   */
  const making = makingOf({ kind: body.kind, role: body.role ?? null, hasText: !!body.hasText, ground: !!body.ground, said: body.said, w, h });
  // Wanted, and then asked for only if the render can supply it. What the
  // render cannot supply and the drawn line does not cover is cut out after.
  const wantsAlpha = typeof body.alpha === "boolean" ? body.alpha : needsAlpha(making) && !body.clipped;
  /*
   * A solid is made rather than refined: there is no earlier solid to
   * improve on, and the drawing is the input either way. So it asks the
   * table for the step it is really at, which is also what keeps a mesh
   * model out of every other cell.
   */
  /*
   * …or recreate, when the caller says so: the grounded step, which the
   * create space's second phase runs. A solid is still made, not recreated.
   */
  const step = isSolid(making) ? "first" : body.step === "recreate" ? "recreate" : "refine";
  // Grounding: on for the recreate step, on when the person explicitly asked
  // for the real thing, off otherwise. `inputFor` sends the flags only to a
  // model that declares them.
  const grounded = step === "recreate" || !!body.grounded;
  const clipped = !!body.clipped;
  const picked = route({ making, step, fromImage: true, example: hasPair, clipped, w, h, prefer: body.model });
  if (!picked.model) {
    return NextResponse.json({ ok: false, stage: 2, reason: picked.why, making, message: noModelSays(picked.why ?? "nothing-serves", making) });
  }
  const pick = picked.model;
  const pair = !!picked.usedExample;
  const asUri = (b: string) => `data:image/png;base64,${b}`;
  // A solid is handed the drawing alone: no pair, no house style, nothing
  // describing the line. Everything else gets the ordered list.
  const images = pick.returns === "mesh"
    ? [asUri(first)]
    : [...(pair ? [asUri(before!), asUri(after!)] : []), asUri(first)];
  // Asked of the model when it has the field; otherwise the ground comes
  // off afterwards, which is what `cutAfter` means.
  const transparent = wantsAlpha && pick.alpha !== false && !picked.cutAfter;
  const input = inputFor(pick, {
    prompt: wordsFor({ step, making, said: body.prompt, label: body.label, transparent, example: pair }),
    images,
    w,
    h,
    transparent,
    step,
    grounded,
  });

  const replicate = new Replicate({ auth: token });
  const began = Date.now();
  let done: Prediction;
  try {
    done = await predict(replicate, pick.slug, input);
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    const message = error instanceof Error ? safe(error.message, token) : "the model failed";
    const reason = status === 401 || status === 403 ? "auth" : status === 429 ? "rate-limit" : "refine";
    return NextResponse.json({ ok: false, stage: 2, reason, model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, `${pick.name} said: ${message}.`) });
  }
  if (done.status !== "succeeded") {
    const said = typeof done.error === "string" ? safe(done.error, token) : String(done.status ?? "no answer");
    return NextResponse.json({ ok: false, stage: 2, reason: "refine", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, `${pick.name} said: ${said}.`) });
  }

  const meter = fromMetrics(done.metrics, Date.now() - began);
  let file: { bytes: Uint8Array; type: string } | null;
  try {
    file = await bytesOf(done.output);
  } catch (error) {
    return NextResponse.json({ ok: false, stage: 2, reason: "fetch", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, `The refined picture could not be collected (${error instanceof Error ? safe(error.message, token) : "unknown"}).`), ms: meter.ms, cost: meter.dollars });
  }
  if (!file || !file.bytes.length) {
    return NextResponse.json({ ok: false, stage: 2, reason: "empty-answer", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, `${pick.name} answered with nothing.`), ms: meter.ms, cost: meter.dollars });
  }
  /*
   * A solid comes back as a file rather than a picture, so it is answered
   * as one: the board mounts it in a viewer and turns it, and nothing here
   * tries to make an `<img>` out of a GLB.
   */
  if (pick.returns === "mesh") {
    const glb = `data:model/gltf-binary;base64,${Buffer.from(file.bytes).toString("base64")}`;
    if (glb.length > MESH_LIMIT) {
      return NextResponse.json({ ok: false, stage: 2, reason: "too-big", model: pick.slug, name: pick.name, making,
        message: noModelSays("failed", making, `The solid came back as ${Math.round(glb.length / 1024)}KB, more than a document should carry — it needs fewer faces.`),
        ms: meter.ms, cost: meter.dollars });
    }
    return NextResponse.json({
      ok: true, stage: 2, model: pick.slug, name: pick.name, making,
      solid: true,
      mesh: { glb, bytes: glb.length, from: pick.slug },
      ms: meter.ms,
      cost: meter.dollars,
    });
  }

  let mime = mimeOf(file.bytes, file.type);
  let bytes = file.bytes;
  /*
   * The third answer, and only when the first two are gone.
   *
   * The part is not cut to a drawn line, and the model that drew this could
   * not leave the ground out — so it is cut out afterwards by a segmenter,
   * which is a guess at an edge rather than an edge. It is its own call and
   * its own charge, and it never fails the pass: a mark on a ground is
   * worse than a mark and better than nothing on the board.
   */
  let cut: { model: string; name: string; ms: number; cost: number | null } | null = null;
  if (wantsAlpha && !transparent && picked.cutAfter) {
    const cutter = route({ making, step: "alpha", fromImage: true, clipped }).model;
    if (cutter) {
      const from = Date.now();
      try {
        const said = await predict(replicate, cutter.slug, inputFor(cutter, {
          prompt: "",
          images: [`data:${mime};base64,${Buffer.from(bytes).toString("base64")}`],
        }));
        const meterCut = fromMetrics(said.metrics, Date.now() - from);
        const got = said.status === "succeeded" ? await bytesOf(said.output) : null;
        if (got?.bytes.length) {
          bytes = got.bytes;
          mime = mimeOf(got.bytes, got.type);
          cut = { model: cutter.slug, name: cutter.name, ms: meterCut.ms, cost: meterCut.dollars };
        }
      } catch {
        // A ground that would not come out is a ground. The picture stands.
      }
    }
  }

  const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  if (dataUri.length > RASTER_LIMIT) {
    return NextResponse.json({ ok: false, stage: 2, reason: "too-big", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, `It came back as ${Math.round(dataUri.length / 1024)}KB, more than a document should carry.`), ms: meter.ms, cost: meter.dollars });
  }
  const html = rasterFragment(dataUri);
  if (!html) {
    return NextResponse.json({ ok: false, stage: 2, reason: "empty-body", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, "What came back could not be read as an image.") });
  }
  return NextResponse.json({
    ok: true,
    stage: 2,
    model: pick.slug,
    name: pick.name,
    /* What was actually asked of it, so a card can say why it looks like it does. */
    making,
    transparent,
    /*
     * How this one got its ground left out — or that it never needed to,
     * because the part is cut to a line somebody drew. The card says which,
     * because "why has this got a background" is otherwise unanswerable.
     */
    alpha: clipped ? "the drawn line" : transparent ? "asked of the model" : cut ? "cut out after" : "none",
    ...(cut ? { cut } : {}),
    example: pair,
    /* Whether it was told to look things up, and what the log said it took
       — the number its price is set by — when the log says. */
    grounded: grounded && !!pick.grounding,
    ...(tokensOf((done as { logs?: unknown }).logs) !== null ? { tokens: tokensOf((done as { logs?: unknown }).logs) } : {}),
    ratio: input.aspect_ratio ?? `${input.width}x${input.height}`,
    html,
    image: dataUri,
    bytes: dataUri.length,
    ms: meter.ms,
    // Null is the answer when the prediction reported no number, and the
    // card says so rather than showing a price nobody can stand behind.
    cost: meter.dollars,
  });
}

export async function POST(request: Request) {
  // Looked for first, so a request that could not be drawn whatever it said
  // gets the one answer worth giving — in the words of the stage that asked.
  const token = tokenFor(request);

  /*
   * The body is read for the sentence, not for the decision.
   *
   * No token is still the first answer and a request that could not
   * possibly be drawn still gets it — but the two stages say it
   * differently, so which stage asked has to be known. A body that will not
   * parse simply leaves that unknown, and the first pass's words are the
   * right default: it is the one with nothing to fall back to.
   */
  let body: Body | null = null;
  try {
    body = (await request.json()) as Body;
  } catch {
    body = null;
  }
  const second = Number(body?.stage) === 2;
  if (!token) {
    return NextResponse.json(second
      ? { ok: false, stage: 2, reason: "unavailable", message: noModelSays("no-key", makingOf({ kind: body!.kind, role: body!.role ?? null, hasText: !!body!.hasText, ground: !!body!.ground, said: body!.said, w: Number(body!.w) || 0, h: Number(body!.h) || 0 })) }
      : { ok: false, reason: "unavailable", message: RENDER_UNAVAILABLE });
  }
  if (!body) {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

  // The second pass is its own road: it has a picture already and needs
  // none of the first pass's shaping.
  if (second) return refine(body, token);

  const kind: RenderKind = isRenderKind(body.kind) ? body.kind : "vector";
  const prompt = (body.prompt ?? "").trim().slice(0, 2000);
  const label = (body.label ?? "").trim().slice(0, 120);
  if (!prompt && !label && !isRenderKind(body.kind)) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Nothing to draw from." }, { status: 400 });
  }
  const w = Math.round(Math.max(24, Math.min(4000, Number(body.w) || 320)));
  const h = Math.round(Math.max(24, Math.min(4000, Number(body.h) || 320)));
  const words = renderPrompt({ kind, prompt, label, closed: body.closed, w, h, palette: body.palette });
  // Tracing needs the drawing, and only the drawing. No words go with it,
  // because the whole point of this path is that nothing describes the line.
  const picture = typeof body.picture === "string" && /^[A-Za-z0-9+/=]+$/.test(body.picture) && body.picture.length < 4_000_000 ? body.picture : null;
  if (fromPicture(kind) && !picture) {
    return NextResponse.json({ ok: false, reason: "no-picture", message: "Nothing to trace: the drawing did not arrive as a picture." }, { status: 400 });
  }

  // Handed the token for this call only. Nothing here keeps it, and it goes
  // when the request does.
  const replicate = new Replicate({ auth: token });
  const model = RENDER_MODELS[kind];
  let out: unknown;
  try {
    try {
      out = await replicate.run(model, { input: input(kind, words, picture, w, h) });
    } catch (first) {
      // A field this version of the model does not have is the one failure
      // worth a second go: the prompt alone is a shape every model takes.
      const status = (first as { response?: { status?: number } }).response?.status;
      if (status !== 422 && status !== 400) throw first;
      out = await replicate.run(model, { input: fromPicture(kind) ? { image: `data:image/png;base64,${picture}` } : { prompt: words } });
    }
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    const message = error instanceof Error ? safe(error.message, token) : "The renderer failed.";
    if (status === 401 || status === 403) {
      return NextResponse.json({ ok: false, reason: "auth", message: "The renderer token was rejected." });
    }
    if (status === 429) {
      return NextResponse.json({ ok: false, reason: "rate-limit", message: "The renderer is rate limited, try again in a moment." });
    }
    return NextResponse.json({ ok: false, reason: "render", message: `The renderer could not draw it (${message}).` });
  }

  let file: { bytes: Uint8Array; type: string } | null;
  try {
    file = await bytesOf(out);
  } catch (error) {
    return NextResponse.json({ ok: false, reason: "fetch", message: `The drawing could not be collected (${error instanceof Error ? safe(error.message, token) : "unknown"}).` });
  }
  if (!file || !file.bytes.length) {
    return NextResponse.json({ ok: false, reason: "empty-answer", message: "The renderer answered with nothing." });
  }

  const cost = RENDER_COST[kind];

  if (kind === "vector") {
    const raw = new TextDecoder().decode(file.bytes);
    if (raw.length > RENDER_LIMIT) {
      return NextResponse.json({ ok: false, reason: "too-big", message: `That drawing came back as ${Math.round(raw.length / 1024)}KB of SVG, past what a part carries. Half an SVG is not a smaller picture, so it was refused rather than cut.`, cost });
    }
    // Cleaned exactly like a written body: same rules, same locks, and it
    // renders in the same sandbox. The traced ground goes first, because a
    // white plate the tracer found under the drawing is not the drawing.
    const ground = dropGround(raw);
    const { html, stripped } = cleanSnippet(ground.html, RENDER_LIMIT);
    if (!html || !/<svg[\s>]/i.test(html)) {
      return NextResponse.json({ ok: false, reason: "empty-body", message: "Nothing usable was left of that drawing once it was cleaned.", cost });
    }
    return NextResponse.json({ ok: true, kind, html, stripped: ground.dropped ? [...stripped, "the ground it was drawn on"] : stripped, bytes: html.length, cost, model });
  }

  const mime = mimeOf(file.bytes, file.type);
  const dataUri = `data:${mime};base64,${Buffer.from(file.bytes).toString("base64")}`;
  if (dataUri.length > RASTER_LIMIT) {
    return NextResponse.json({ ok: false, reason: "too-big", message: `That picture is ${Math.round(dataUri.length / 1024)}KB as a data URI, more than a document should carry.`, cost });
  }
  const html = rasterFragment(dataUri);
  if (!html) {
    return NextResponse.json({ ok: false, reason: "empty-body", message: "The picture could not be read as an image.", cost });
  }
  return NextResponse.json({ ok: true, kind, html, image: dataUri, stripped: [], bytes: dataUri.length, cost, model });
}
