import Replicate from "replicate";
import { NextResponse } from "next/server";
import { cleanSnippet, RENDER_LIMIT } from "@/features/studio/snippet";
import {
  fluxRatio,
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
 * One environment variable, `REPLICATE_API_TOKEN`, read by `new
 * Replicate()` out of the process and nowhere else. It is not in the
 * vault, there is no header the browser can set to supply it, it is never
 * logged, and it is never in anything this route returns — the one place
 * an error message could carry it is scrubbed on the way out.
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
 * With no token it answers HTTP 200 with `ok: false` and `reason:
 * "unavailable"`, the same shape and the same path as a missing Claude
 * key, so the dialog shows the reason and the body loop falls back to
 * writing one.
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
  prompt?: string;
  label?: string;
  closed?: boolean;
  w?: number;
  h?: number;
  palette?: { bg?: string; text?: string; accent?: string; muted?: string };
}

/** Nothing that leaves here may contain the token, whatever a library put in a message. */
function safe(message: string): string {
  const token = process.env.REPLICATE_API_TOKEN?.trim();
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
  return kind === "vector"
    ? { size: recraftSize(w, h), style: "any" }
    : { aspect_ratio: fluxRatio(w, h), output_format: "webp", safety_tolerance: 2 };
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
  // The token is the server's or there is no renderer. There is deliberately
  // no browser-supplied fallback here: unlike the Claude key, this one is
  // never held in the vault, so a header carrying it would be a route
  // accepting a secret it told the panel it would not take.
  if (!process.env.REPLICATE_API_TOKEN?.trim()) {
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
  if (!prompt && !label) {
    return NextResponse.json({ ok: false, reason: "empty", message: "Nothing to draw from." }, { status: 400 });
  }
  const w = Math.round(Math.max(24, Math.min(4000, Number(body.w) || 320)));
  const h = Math.round(Math.max(24, Math.min(4000, Number(body.h) || 320)));
  const words = renderPrompt({ kind, prompt, label, closed: body.closed, w, h, palette: body.palette });

  const replicate = new Replicate();
  const model = RENDER_MODELS[kind];
  let out: unknown;
  try {
    try {
      out = await replicate.run(model, { input: { prompt: words, ...shapeFor(kind, w, h) } });
    } catch (first) {
      // A field this version of the model does not have is the one failure
      // worth a second go: the prompt alone is a shape every model takes.
      const status = (first as { response?: { status?: number } }).response?.status;
      if (status !== 422 && status !== 400) throw first;
      out = await replicate.run(model, { input: { prompt: words } });
    }
  } catch (error) {
    const status = (error as { response?: { status?: number } }).response?.status;
    const message = error instanceof Error ? safe(error.message) : "The renderer failed.";
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
    return NextResponse.json({ ok: false, reason: "fetch", message: `The drawing could not be collected (${error instanceof Error ? safe(error.message) : "unknown"}).` });
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
    // renders in the same sandbox.
    const { html, stripped } = cleanSnippet(raw, RENDER_LIMIT);
    if (!html || !/<svg[\s>]/i.test(html)) {
      return NextResponse.json({ ok: false, reason: "empty-body", message: "Nothing usable was left of that drawing once it was cleaned.", cost });
    }
    return NextResponse.json({ ok: true, kind, html, stripped, bytes: html.length, cost, model });
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
