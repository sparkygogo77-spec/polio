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
 */

export const runtime = "nodejs";
export const maxDuration = 180;

/** A raster body is carried in the document, so it has a ceiling a document can hold. */
const RASTER_LIMIT = 2_400_000;

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

export async function POST(request: Request) {
  // Looked for before the body is read, so a request that could not be drawn
  // whatever it said gets the one answer worth giving.
  const token = tokenFor(request);
  if (!token) {
    return NextResponse.json({ ok: false, reason: "unavailable", message: RENDER_UNAVAILABLE });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-request", message: "Expected a JSON body." }, { status: 400 });
  }

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
