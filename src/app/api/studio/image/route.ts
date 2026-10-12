import Replicate from "replicate";
import { NextResponse } from "next/server";
import { meterFirst } from "@/features/studio/renderMeter";
import { answerFrom, base64Picture, mimeOf, RASTER_LIMIT, UNKNOWN_PICTURE, type RenderAnswer } from "@/features/studio/renderAnswer";
import {
  fluxRatio,
  fromPicture,
  isRenderKind,
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
  effortField,
  model as modelNamed,
  type ImageModel,
  makingOf,
  needsAlpha,
  noModelSays,
  route,
  wordsFor,
  optionsFor,
} from "@/features/studio/pictures";
import { fromMetrics } from "@/features/studio/spend";
import { keyFor } from "@/app/api/keyFor";
import { answerBudget } from "../budget";

/**
 * The renderer service: a part's body, drawn rather than written.
 *
 * The token belongs to the person, not to the deployment. It is typed into
 * the keys panel under the key button, held in this browser exactly as the
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
 * writing one. A keys panel that holds a token but is locked is the common case,
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

/*
 * Rule 8b, at this end. A model that is slow cold (flux-2-pro often is) ran
 * past the platform's ceiling, the function was killed with no answer, and
 * the prediction went on at Replicate, finished and was charged for a
 * picture nobody collected. So every wait carries the budget the other
 * routes keep (`budget.ts`): when it runs out the prediction is cancelled
 * and the answer is `timeout` with the seconds it took.
 */
const ANSWER_BUDGET_MS = answerBudget(process.env, maxDuration);

/** What `predict` throws when the budget ran out, or the asker went away, first. */
const PREDICT_TIMEOUT = "PredictTimeout";
const cutShort = (error: unknown) => error instanceof Error && error.name === PREDICT_TIMEOUT;
const slowSays = (seconds: number) =>
  `The picture model had not finished after ${seconds}s, so it was stopped and is not charged past that point. Try again, or pick a faster model.`;

/** A raster body is carried in the document, so it has a ceiling a document can hold. */

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
  /*
   * The five things he can say about a picture, and no sixth.
   *
   * "with only the mentions i asked for of image, option to tweak, aspect
   * ratio, quality, effort, and model choice." The image is what comes back,
   * the tweak is `prompt`, and the model he picked is `model` below, which
   * the second pass already had \u2014 these three are the rest of it.
   */
  ratio?: string;
  quality?: string;
  effort?: string;
  /** Add the framing words. Off unless asked: what he types is what goes. */
  frame?: boolean;
  /** A picture to work from: his own drawing, or one he chose. A data URL. */
  reference?: string;
  /** Several pictures to work from, when the model takes more than one. */
  references?: string[];
  /** png, jpeg or webp. The model's own default when he has not said. */
  format?: string;
  /** How many pictures one press asks for. One unless he said. */
  count?: number;
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
  /**
   * More views of the same thing, for a model that takes them: the back,
   * the left and the right, in the order the model names its fields. A
   * cube's own faces are exactly these, so a box becomes a solid from the
   * words on its sides. PNG, base64, no data-URL head, each.
   */
  views?: string[];
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
  step?: "refine" | "recreate" | "alpha";
  /**
   * What the person set on the model, by field name (`ModelField`). Held to
   * the row's declared fields and values by `optionsFor`; applied after the
   * route's own choices, so theirs win.
   */
  options?: Record<string, unknown>;
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
 * The browser's wins, as it does on every route here (`keyFor`): they typed
 * it into the keys panel and they are the one being billed for the call. It
 * is returned, used, and dropped when the request ends; nothing holds it.
 */
function tokenFor(request: Request): string | null {
  return keyFor(request, "x-replicate-key")?.key ?? null;
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
 * The five things he can say about a picture, on their way to the model.
 *
 * His words: "provide a panel tab where i can use replicate models exactly as
 * i do on their site, with only the mentions i asked for of image, option to
 * tweak, aspect ratio, quality, effort, and model choice." So the route takes
 * those and nothing else: they are passed under the names the model itself
 * uses, and a model that has no opinion about one of them simply never sees
 * it rather than being handed a field it would refuse.
 *
 * Nothing here is invented. A ratio is only sent if the chosen model lists it
 * (`imageRoute.ts` carries each model's own list), and quality and effort are
 * only sent to models whose own option table has them.
 */
export interface Asked {
  model?: string;
  ratio?: string;
  quality?: string;
  effort?: string;
  /** Add the framing words. Off unless asked: what he types is what goes. */
  frame?: boolean;
  /** A picture to work from: his own drawing, or one he chose. A data URL. */
  references?: string[];
  reference?: string;
  /** png, jpeg or webp. The model's own default when he has not said. */
  format?: string;
  /** How many pictures one press asks for: 1 to MOST_PICTURES. */
  count?: number;
}

/*
 * HIS WORDS (2026-10-12): "it definitely also only puts out one at a time
 * when i should be able to request multiple". One press may ask for up to
 * this many. A model that has its own count field is asked once for all of
 * them; any other is asked once per picture, side by side.
 */
const MOST_PICTURES = 4;
const COUNT_FIELDS = ["number_of_images", "num_outputs", "num_images"];
/** The field this model takes a picture count under, when it has one. */
function countField(card: ImageModel | null): { name: string; max: number } | null {
  const f = card?.fields.find((x) => COUNT_FIELDS.includes(x.name) && x.kind === "integer");
  return f ? { name: f.name, max: f.max ?? MOST_PICTURES } : null;
}

function said(card: ImageModel | null, asked: Asked): Record<string, unknown> {
  if (!card) return {};
  const out: Record<string, unknown> = {};
  if (asked.ratio && card.ratios.includes(asked.ratio)) out.aspect_ratio = asked.ratio;
  if (asked.quality) {
    const field = card.fields.find((f) => f.name === "quality");
    if (field && (field.kind !== "enum" || (field.values ?? []).includes(asked.quality))) out.quality = asked.quality;
  }
  /*
   * A picture to work from, under whatever this model calls that field.
   *
   * "I need the option for input images" \u2014 and "i would like it to be
   * possible that my freehand drawings become the prompts for replicate
   * directly creating an image with my drawing as an input image". Same
   * field either way: a drawing rasterised in the browser is a picture like
   * any other, so the panel sends one and the route does not care which it
   * was. A model with no reference field is simply not sent one.
   */
  /*
   * HIS WORDS: "just make the input images allow multiple". A model's own row
   * says how many it takes, so the list is cut to that rather than refused:
   * one picture to a model that takes one, up to `references` for a model
   * that takes more, and the field is shaped the way that model wants it.
   */
  const given = asked.references?.length ? asked.references : asked.reference ? [asked.reference] : [];
  if (given.length && card.refField) {
    const take = given.slice(0, Math.max(1, card.references));
    out[card.refField] = card.references > 1 ? take : take[0];
  }
  const many = countField(card);
  if (many && asked.count && asked.count > 1) out[many.name] = Math.min(asked.count, many.max);
  /* And the file type he asked for, under the model's own field. Left alone,
     the model's own default stands. */
  if (asked.format && card.format?.field) {
    const format = formatFor(card, asked.format);
    if (format) out[card.format.field] = format;
  }
  /* Effort goes out under the name this model gives it \u2014 `thinking` on the
     one that has one \u2014 rather than under his word for it, which no model
     would recognise. */
  if (asked.effort) {
    const field = effortField(card);
    if (field && (field.kind !== "enum" || (field.values ?? []).includes(asked.effort))) out[field.name] = asked.effort;
  }
  return out;
}

/**
 * The Replicate client for one call. `REPLICATE_API` points it somewhere
 * other than api.replicate.com — a stand-in for the checks, the way
 * GITHUB_API and VERCEL_API do for publishing — and is unset in use.
 */
function replicateFor(token: string): Replicate {
  const at = process.env.REPLICATE_API?.trim();
  return new Replicate({ auth: token, ...(at ? { baseUrl: at.replace(/\/+$/, "") } : {}) });
}

/**
 * Only what this model takes, and only choices it lists.
 *
 * `shapeFor` is the Flux shape, `output_format: "webp"` and
 * `safety_tolerance: 2`, and it went to every model he picked. Nano Banana 2
 * takes jpg or png: a choice outside a model's list is a 422, a 422 is
 * retried with the prompt alone, and so the pictures he gave it to work
 * from and the ratio he chose were dropped without a word. A model with a
 * row in the table is handed the fields that row declares.
 */
function fitted(card: ImageModel, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    const f = card.fields.find((x) => x.name === k);
    if (!f) continue;
    if (f.kind === "enum" && f.values && !f.values.includes(v as string)) continue;
    out[k] = v;
  }
  return out;
}

/** The file type he asked for, in this model's spelling: "JPEG" is `jpg` to one and `jpeg` to another. */
function formatFor(card: ImageModel, asked: string): string | null {
  const field = card.fields.find((f) => f.name === card.format?.field);
  const values = field?.kind === "enum" ? field.values ?? [] : [];
  if (!values.length || values.includes(asked)) return asked;
  const other = asked === "jpeg" ? "jpg" : asked === "jpg" ? "jpeg" : null;
  return other && values.includes(other) ? other : null;
}

/** What each model is handed: a picture to trace, or words to imagine from. */
function input(kind: RenderKind, words: string, picture: string | null, w: number, h: number, card: ImageModel | null = null, asked: Asked = {}): Record<string, unknown> {
  if (fromPicture(kind)) return { image: `data:image/png;base64,${picture}` };
  const shape = shapeFor(kind, w, h);
  return { prompt: words, ...(card ? fitted(card, shape) : shape), ...said(card, asked) };
}

/** How long the bytes behind an answer may take to arrive. */
const FETCH_MS = 30_000;

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
  // Under a clock: a vendor that stalls on the bytes used to hold the route
  // until the platform killed it, with nothing said.
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS) });
  if (!res.ok) return null;
  return { bytes: new Uint8Array(await res.arrayBuffer()), type: res.headers.get("content-type") ?? "" };
}

interface Prediction {
  output?: unknown;
  metrics?: Record<string, unknown>;
  error?: unknown;
  status?: string;
}

/*
 * A model's own address takes predictions only for Replicate's "official"
 * models. Any other (tencent/hunyuan3d-2mv, the 3D one, among them) answers
 * that address with a 404, "The requested resource could not be found", and
 * has to be run by its version instead. So a 404 there is answered by
 * asking the model for its latest version and running that; the version is
 * remembered for the life of the server so the lookup happens once.
 */
const versions = new Map<string, string>();
async function start(replicate: Replicate, slug: `${string}/${string}`, input: Record<string, unknown>) {
  const known = versions.get(slug);
  if (known) return replicate.predictions.create({ version: known, input });
  try {
    return await replicate.predictions.create({ model: slug, input });
  } catch (error) {
    if ((error as { response?: { status?: number } }).response?.status !== 404) throw error;
    const [owner, name] = slug.split("/");
    const version = owner && name ? (await replicate.models.get(owner, name)).latest_version?.id : undefined;
    if (!version) throw error;
    versions.set(slug, version);
    return replicate.predictions.create({ version, input });
  }
}

/**
 * One prediction, run and waited on.
 *
 * `predictions.create` rather than `run`, because `run` hands back the
 * output alone and what a pass has to report — what it cost, how long the
 * model itself took — is on the prediction.
 */
async function predict(replicate: Replicate, slug: `${string}/${string}`, input: Record<string, unknown>, until: number, signal?: AbortSignal): Promise<Prediction> {
  const started = await start(replicate, slug, input);
  // The wait, raced against the budget and the asker leaving. Whichever
  // ends it first also stops the polling, and a cut cancels the prediction
  // so Replicate does not draw (and bill) a picture nobody will collect.
  let cut = false;
  let ran: ReturnType<typeof setTimeout> | undefined;
  const stop = () => { cut = true; };
  const late = new Promise<never>((_, reject) => {
    const quit = () => { stop(); reject(Object.assign(new Error("the picture model took too long"), { name: PREDICT_TIMEOUT })); };
    ran = setTimeout(quit, Math.max(0, until - Date.now()));
    if (signal?.aborted) quit();
    else signal?.addEventListener("abort", quit, { once: true });
  });
  try {
    return await Promise.race([replicate.wait(started, { interval: 700 }, async () => cut), late]);
  } catch (error) {
    if (cut) await replicate.predictions.cancel(started.id, { signal: AbortSignal.timeout(3_000) }).catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(ran);
  }
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

/** A picture that arrived as base64, made standard, or nothing. Never a data URL, never a URL. */
const picture = (v: unknown, limit = 4_000_000): string | null => base64Picture(v, limit);

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
async function refine(body: Body, token: string, until: number, signal: AbortSignal) {
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
  const step = isSolid(making) ? "first" : body.step === "recreate" ? "recreate" : body.step === "alpha" ? "alpha" : "refine";
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
  const views = Array.isArray(body.views) ? body.views.map((v) => picture(v)).filter((v): v is string => !!v).slice(0, 3) : [];
  const images = pick.returns === "mesh"
    ? [asUri(first), ...views.map(asUri)]
    : [...(pair ? [asUri(before!), asUri(after!)] : []), asUri(first)];
  // Asked of the model when it has the field; otherwise the ground comes
  // off afterwards, which is what `cutAfter` means.
  // The alpha step is the ground left out, whatever is being made: asked of
  // the model when it can, cut afterwards when it cannot.
  const transparent = step === "alpha" ? pick.alpha !== false : wantsAlpha && pick.alpha !== false && !picked.cutAfter;
  const input = inputFor(pick, {
    prompt: wordsFor({ step, making, said: body.prompt, label: body.label, transparent, example: pair }),
    images,
    w,
    h,
    transparent,
    step,
    grounded,
    options: body.options,
  });

  const replicate = replicateFor(token);
  const began = Date.now();
  let done: Prediction;
  try {
    done = await predict(replicate, pick.slug, input, until, signal);
  } catch (error) {
    if (cutShort(error)) {
      const seconds = Math.round((Date.now() - began) / 1000);
      return NextResponse.json({ ok: false, stage: 2, reason: "timeout", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, slowSays(seconds)), seconds });
    }
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
        }), until, signal);
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

  if (mime === UNKNOWN_PICTURE) {
    return NextResponse.json({ ok: false, stage: 2, reason: "failed", model: pick.slug, name: pick.name, making, message: noModelSays("failed", making, `It came back as ${Math.round(bytes.length / 1024)}KB of bytes that are not a picture.`), ms: meter.ms, cost: meter.dollars });
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
    /* What the person set, as applied — the names, so a card can say them. */
    set: Object.keys(optionsFor(pick, body.options)),
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
  // The budget runs from the moment the request arrived, for every pass in it.
  const until = Date.now() + ANSWER_BUDGET_MS;
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
  if (second) return refine(body, token, until, request.signal);

  const kind: RenderKind = isRenderKind(body.kind) ? body.kind : "vector";
  const prompt = (body.prompt ?? "").trim().slice(0, 2000);
  const label = (body.label ?? "").trim().slice(0, 120);
  if (!prompt && !label && !isRenderKind(body.kind)) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Nothing to draw from." }, { status: 400 });
  }
  const w = Math.round(Math.max(24, Math.min(4000, Number(body.w) || 320)));
  const h = Math.round(Math.max(24, Math.min(4000, Number(body.h) || 320)));
  const words = renderPrompt({ kind, prompt, label, closed: body.closed, w, h, palette: body.palette, frame: body.frame === true });
  // Tracing needs the drawing, and only the drawing. No words go with it,
  // because the whole point of this path is that nothing describes the line.
  const picture = base64Picture(body.picture);
  if (fromPicture(kind) && !picture) {
    return NextResponse.json({ ok: false, reason: "no-picture", message: "Nothing to trace: the drawing did not arrive as a picture." }, { status: 400 });
  }

  // Handed the token for this call only. Nothing here keeps it, and it goes
  // when the request does.
  const replicate = replicateFor(token);
  /* His model, when he named one and the table knows it; otherwise the one
     this kind of drawing has always used. */
  const asked: Asked = {
    model: typeof body.model === "string" ? body.model : undefined,
    ratio: typeof body.ratio === "string" ? body.ratio : undefined,
    quality: typeof body.quality === "string" ? body.quality : undefined,
    effort: typeof body.effort === "string" ? body.effort : undefined,
    reference: typeof body.reference === "string" && /^data:image\//.test(body.reference) ? body.reference : undefined,
    references: Array.isArray(body.references)
      ? body.references.filter((r): r is string => typeof r === "string" && /^data:image\//.test(r))
      : undefined,
    format: typeof body.format === "string" && ["png", "jpeg", "webp"].includes(body.format) ? body.format : undefined,
    count: Math.max(1, Math.min(MOST_PICTURES, Math.round(Number(body.count)) || 1)),
  };
  const card = asked.model ? modelNamed(asked.model) : null;
  const model = (card?.returns === "picture" ? card.slug : RENDER_MODELS[kind]) as `${string}/${string}`;
  /*
   * A prediction, created and waited on, rather than `run`: `run` hands
   * back the output alone and throws the prediction away with its metrics,
   * and the metrics are the only measured thing about the call.
   */
  const began = Date.now();
  /*
   * As many pictures as he asked for. A model with a count field is asked
   * once for all of them; any other is asked once per picture, side by side,
   * under the same clock. Whatever comes back is kept, so one failure out of
   * four still hands back the other three.
   */
  const many = countField(card);
  const runs = card?.returns === "picture" && !many ? asked.count ?? 1 : 1;
  const shaped = input(kind, words, picture, w, h, card, asked);
  const once = async (): Promise<Prediction> => {
    try {
      return await predict(replicate, model, shaped, until, request.signal);
    } catch (first) {
      // A field this version of the model does not have is the one failure
      // worth a second go: the prompt alone is a shape every model takes,
      // with the pictures to work from kept, since a picture of something
      // else is not the picture he asked for.
      const status = (first as { response?: { status?: number } }).response?.status;
      if (status !== 422 && status !== 400) throw first;
      const refs = card?.refField && shaped[card.refField] ? { [card.refField]: shaped[card.refField] } : {};
      return predict(replicate, model, fromPicture(kind) ? { image: `data:image/png;base64,${picture}` } : { prompt: words, ...refs }, until, request.signal);
    }
  };
  let dones: Prediction[];
  try {
    const settled = await Promise.allSettled(Array.from({ length: runs }, once));
    dones = settled.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
    if (!dones.length) throw (settled[0] as PromiseRejectedResult).reason;
  } catch (error) {
    if (cutShort(error)) {
      const seconds = Math.round((Date.now() - began) / 1000);
      return NextResponse.json({ ok: false, reason: "timeout", message: slowSays(seconds), seconds });
    }
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

  // What was measured: the seconds off the prediction, the cost as the
  // prediction reported it or, failing that, the model's published rate.
  const meters = dones.map((d) => meterFirst(kind, d.metrics, Date.now() - began));
  const succeeded = dones.filter((d) => d.status === "succeeded");
  const priced = meters.every((m) => m.priced === "reported") ? "reported" : "card";
  const meter = { ms: Math.max(...meters.map((m) => m.ms)), cost: meters.reduce((sum, m) => sum + (m.cost ?? 0), 0), priced };
  if (!succeeded.length) {
    const done = dones[0]!;
    const said = typeof done.error === "string" ? safe(done.error, token) : String(done.status ?? "no answer");
    return NextResponse.json({ ok: false, reason: "render", message: `The renderer could not draw it (${said}).`, ms: meter.ms, cost: meter.cost, priced: meter.priced });
  }

  /* Every picture each prediction gave back, not only its first. */
  const outputs = succeeded.flatMap((d) => (Array.isArray(d.output) ? d.output : [d.output])).filter((o) => o != null).slice(0, MOST_PICTURES);
  const answers: RenderAnswer[] = [];
  let failed: { reason: string; message: string } | null = null;
  for (const out of outputs) {
    let file: { bytes: Uint8Array; type: string } | null;
    try {
      file = await bytesOf(out);
    } catch (error) {
      failed ??= { reason: "fetch", message: `The drawing could not be collected (${error instanceof Error ? safe(error.message, token) : "unknown"}).` };
      continue;
    }
    if (!file || !file.bytes.length) {
      failed ??= { reason: "empty-answer", message: "The renderer answered with nothing." };
      continue;
    }
    const answer = answerFrom(kind, file.bytes, file.type);
    if (answer.ok) answers.push(answer);
    else failed ??= answer;
  }
  if (!answers.length) {
    const why = failed ?? { reason: "empty-answer", message: "The renderer answered with nothing." };
    return NextResponse.json({ ok: false, ...why, ms: meter.ms, cost: meter.cost, priced: meter.priced });
  }
  // A card price is per picture: a count asked of one prediction is that many.
  const cost = priced === "card" && many ? meter.cost * answers.length : meter.cost;
  const images = answers.flatMap((a) => (a.ok && a.image ? [a.image] : []));
  return NextResponse.json({ ...answers[0], ...(images.length ? { images } : {}), cost, priced: meter.priced, ms: meter.ms, model });
}
