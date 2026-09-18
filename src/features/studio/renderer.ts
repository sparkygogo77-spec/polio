/**
 * The renderer: a picture drawn by a model that draws, not by one that writes.
 *
 * Claude writes a body out of code, and code is the right answer for a
 * diagram, a band of sentences, a shape with rules in it. It is the wrong
 * answer for a thing that has to *look* like something — a crest, a
 * texture, an illustration — where a few hundred lines of hand-written SVG
 * is a worse drawing than a drawing. So there is a second way to fill a
 * part, and it goes through Replicate:
 *
 * - **vectorize** (`recraft-ai/recraft-vectorize`) is the one that matters:
 *   it takes the *drawing* and returns SVG. No description of the drawing
 *   goes anywhere, and no model that writes is asked what the drawing
 *   meant. The strokes are rasterised, traced, and what comes back is the
 *   line that was drawn. This is the whole of the Make real path for an
 *   Idea part.
 * - **vector** (`recraft-ai/recraft-v3-svg`) comes back as SVG. It is a
 *   fragment like any other, so it is cleaned by `cleanSnippet` and lives
 *   under the same two locks the coded body does: `sandbox=""` and a
 *   content policy that allows inline styles and `data:` images and
 *   nothing else. A model's SVG is not more trusted than a model's HTML.
 * - **raster** (`black-forest-labs/flux-2-pro`) comes back as pixels, and
 *   is stored as a `data:` URI inside an `<img>`. Nothing is fetched at
 *   render time, because nothing may be.
 *
 * The token is held where the Claude key is: typed into the keys panel under the
 * key button, kept in this browser, unlocked the same way, and sent as
 * `x-replicate-key` with each call. The route holds it for the length of
 * the call and never writes it down, logs it or returns it; a
 * `REPLICATE_API_TOKEN` in the server's environment still works and is a
 * silent fallback rather than the path. Without either the route answers
 * `unavailable` with a reason, at HTTP 200, exactly the way a missing Claude
 * key does, and the caller falls back to the written body.
 *
 * This file is the pure half: names, prices, sizes and the fragment. Tested
 * by `tests/renderer.mjs`.
 */

export type RenderKind = "vectorize" | "vector" | "raster";

/** The three models, named once. Changing one is changing it here. */
export const RENDER_MODELS: Record<RenderKind, `${string}/${string}`> = {
  /** The drawing itself, traced. Takes a picture, returns SVG. No words anywhere. */
  vectorize: "recraft-ai/recraft-vectorize",
  vector: "recraft-ai/recraft-v3-svg",
  raster: "black-forest-labs/flux-2-pro",
};

/**
 * What one call costs, in dollars.
 *
 * Written down because a renderer is the first thing in this app that
 * spends money per press rather than per token, and a number nobody sees
 * is a bill nobody expected. It rides back on every answer and lands in
 * the usage line.
 */
export const RENDER_COST: Record<RenderKind, number> = { raster: 0.04, vector: 0.08, vectorize: 0.08 };

/** What the route says when no token reached it. The dialog shows this, not a stack. */
export const RENDER_UNAVAILABLE =
  "No Replicate token, so nothing was drawn. Paste one under the key button in the top bar, where the Claude key lives, and it rides with the call. The part keeps its shape, and a body is written instead.";

/** A price, the way it is written everywhere it is shown. */
export function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

export function isRenderKind(v: unknown): v is RenderKind {
  return v === "vector" || v === "raster" || v === "vectorize";
}

/** Does this kind draw from a picture rather than from words? */
export function fromPicture(kind: RenderKind): boolean {
  return kind === "vectorize";
}

/* ------------------------------------------------------------------ */
/* Sizes                                                               */
/* ------------------------------------------------------------------ */

/** The frames recraft will draw in. A part's box is matched to the nearest by proportion. */
export const RECRAFT_SIZES = [
  "1024x1024", "1365x1024", "1024x1365", "1536x1024", "1024x1536",
  "1820x1024", "1024x1820", "1024x2048", "2048x1024", "1434x1024",
  "1024x1434", "1024x1280", "1280x1024", "1707x1024", "1024x1707",
] as const;

/** The ratios flux will draw in. Same idea, different vocabulary. */
export const FLUX_RATIOS = ["1:1", "16:9", "9:16", "3:2", "2:3", "4:3", "3:4", "4:5", "5:4"] as const;

/** Nearest by proportion, judged on the log of the ratio so 2:1 and 1:2 are the same distance out. */
function nearest<T extends string>(list: readonly T[], want: number, ratioOf: (v: T) => number): T {
  let best = list[0]!;
  let gap = Infinity;
  for (const v of list) {
    const d = Math.abs(Math.log(ratioOf(v)) - Math.log(want));
    if (d < gap) {
      gap = d;
      best = v;
    }
  }
  return best;
}

export function recraftSize(w: number, h: number): string {
  const want = Math.max(0.05, Math.min(20, (w || 1) / (h || 1)));
  return nearest(RECRAFT_SIZES, want, (s) => {
    const [a, b] = s.split("x").map(Number);
    return a! / b!;
  });
}

export function fluxRatio(w: number, h: number): string {
  const want = Math.max(0.05, Math.min(20, (w || 1) / (h || 1)));
  return nearest(FLUX_RATIOS, want, (s) => {
    const [a, b] = s.split(":").map(Number);
    return a! / b!;
  });
}

/* ------------------------------------------------------------------ */
/* What is asked for, and what comes back                              */
/* ------------------------------------------------------------------ */

export interface RenderAsk {
  kind: RenderKind;
  /** What the part should be, in the author's words. */
  prompt: string;
  label?: string;
  /** Was the drawn line closed? An open line is a band, and reads differently. */
  closed?: boolean;
  w?: number;
  h?: number;
  palette?: { bg?: string; text?: string; accent?: string; muted?: string };
  /**
   * Add the framing words, or send what was typed and nothing else.
   *
   * HIS WORDS: "my prompt was only 'apple' everything else the site added
   * during my api call ... im pretty sure thats unneccessary prompting." And
   * it was: he typed `apple` and Replicate was handed "apple, filling the
   * whole frame, edge to edge, nothing floating small in the middle, no
   * background plate, no border, no frame, no caption, no watermark, no
   * signature".
   *
   * The words are not useless \u2014 a part made from a drawing has its silhouette
   * compared against the line that was drawn, so it has to fill the box and
   * sit on nothing. They are useless to somebody typing a prompt. So they are
   * a toggle, OFF unless a caller asks, and the part-making runs ask.
   */
  frame?: boolean;
}

/**
 * The words sent to the drawing model.
 *
 * Two things matter and they are both about the frame rather than the
 * subject: it has to fill the box, because the silhouette of what comes
 * back is compared against the outline that was drawn, and it has to sit
 * on nothing, because a part with a white plate behind it is a white plate.
 */
export function renderPrompt(ask: RenderAsk): string {
  const bits: string[] = [];
  const said = (ask.prompt || ask.label || "").trim();
  bits.push(said || "an abstract mark");
  /* Nothing is added unless it was asked for. What he types is what goes. */
  if (!ask.frame) return bits[0]!;
  bits.push(
    ask.closed === false
      ? "drawn as a band following a single open line, edge to edge of the frame"
      : "filling the whole frame, edge to edge, nothing floating small in the middle",
  );
  bits.push("no background plate, no border, no frame, no caption, no watermark, no signature");
  const p = ask.palette;
  const colours = [p?.accent && `accent ${p.accent}`, p?.text && `line and text ${p.text}`, p?.bg && `sitting on ${p.bg}`].filter(Boolean);
  if (colours.length) bits.push(`in the site's colours: ${colours.join(", ")}`);
  return bits.join(", ");
}

/**
 * A raster answer as a fragment.
 *
 * `data:` and nothing else, so the content policy the part renders under
 * allows it without being loosened. `object-fit: cover` because the part's
 * box and the model's frame are near each other but never equal.
 */
export function rasterFragment(dataUri: string): string {
  if (!/^data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+$/i.test(dataUri)) return "";
  return `<img src="${dataUri}" alt="" style="display:block;width:100%;height:100%;object-fit:cover;">`;
}

/** How the usage line says what a renderer call cost. */
export function costLine(kind: RenderKind, calls = 1): string {
  return `${money(RENDER_COST[kind] * calls)} at the renderer`;
}
