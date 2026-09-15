/**
 * What a renderer's answer becomes, as a part's body.
 *
 * The route fetches the bytes and this decides what they are: an SVG that is
 * cleaned like a written body, with the plate the tracer found under the
 * drawing taken away first, or a raster wrapped as a picture. Pure, so it can
 * be held to its rules without a Replicate token in hand.
 */
import { cleanSnippet, RENDER_LIMIT } from "./snippet.ts";
import { rasterFragment, type RenderKind } from "./renderer.ts";

/** A picture larger than this, as a data URI, is more than a document should carry. */
export const RASTER_LIMIT = 2_400_000;

export type RenderAnswer =
  | { ok: true; kind: RenderKind; html: string; image?: string; stripped: string[]; bytes: number }
  | { ok: false; reason: "too-big" | "empty-body"; message: string };

/** What an image's bytes say they are, when the transport did not say. */
export function mimeOf(bytes: Uint8Array, said: string): string {
  const clean = said.split(";")[0]!.trim();
  if (clean.startsWith("image/")) return clean;
  const b = bytes;
  if (b[0] === 0x89 && b[1] === 0x50) return "image/png";
  if (b[0] === 0xff && b[1] === 0xd8) return "image/jpeg";
  if (b[0] === 0x52 && b[1] === 0x49 && b[8] === 0x57) return "image/webp";
  if (b[0] === 0x47 && b[1] === 0x49) return "image/gif";
  return "image/png";
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
export function dropGround(svg: string): { html: string; dropped: boolean } {
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

/** The answer of a first pass, from the bytes the model returned. */
export function answerFrom(kind: RenderKind, bytes: Uint8Array, type: string): RenderAnswer {
  // The tracer's answer is SVG too: it took the raster road once, and its
  // markup went into the part wrapped as a picture, which nothing after it
  // could read, repaint or strip the plate from.
  if (kind === "vector" || kind === "vectorize") {
    const raw = new TextDecoder().decode(bytes);
    if (raw.length > RENDER_LIMIT) {
      return { ok: false, reason: "too-big", message: `That drawing came back as ${Math.round(raw.length / 1024)}KB of SVG, past what a part carries. Half an SVG is not a smaller picture, so it was refused rather than cut.` };
    }
    // Cleaned exactly like a written body: same rules, same locks, and it
    // renders in the same sandbox. The traced ground goes first, because a
    // white plate the tracer found under the drawing is not the drawing.
    const ground = dropGround(raw);
    const { html, stripped } = cleanSnippet(ground.html, RENDER_LIMIT);
    if (!html || !/<svg[\s>]/i.test(html)) {
      return { ok: false, reason: "empty-body", message: "Nothing usable was left of that drawing once it was cleaned." };
    }
    return { ok: true, kind, html, stripped: ground.dropped ? [...stripped, "the ground it was drawn on"] : stripped, bytes: html.length };
  }

  const mime = mimeOf(bytes, type);
  const dataUri = `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
  if (dataUri.length > RASTER_LIMIT) {
    return { ok: false, reason: "too-big", message: `That picture is ${Math.round(dataUri.length / 1024)}KB as a data URI, more than a document should carry.` };
  }
  const html = rasterFragment(dataUri);
  if (!html) return { ok: false, reason: "empty-body", message: "The picture could not be read as an image." };
  return { ok: true, kind, html, image: dataUri, stripped: [], bytes: dataUri.length };
}
