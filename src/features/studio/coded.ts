/**
 * The catalogue of coded parts, and how a drawing picks one.
 *
 * Interpretation had exactly one road: whatever was drawn became a picture
 * of itself, traced and clipped to the line. That is right for a helix and
 * wrong for anything that has to *do* something, and it made the drawing
 * board a machine for producing cutouts. A cube drawn on it came back as a
 * cube-shaped hole.
 *
 * So there are two roads now. Before anything is traced, the drawing and
 * the words are offered to this catalogue: a list of real parts that
 * already exist in the library, each one saying what it is, what it needs
 * from the author, and what a drawing has to look like to mean it. The
 * best match over the bar wins, is configured from the drawing, and no
 * model is asked anything. Nothing matches and the old road is still
 * there: the reader names a library part, or the vectorizer traces the
 * line. **The fall-through stays; it is simply no longer the only way
 * through.**
 *
 * Adding the next one is a file and a line in `CODED`, not a rewrite. An
 * entry is four things:
 *
 *   what      one sentence, for the person and for the blueprint
 *   needs     what the author has to supply for it to be worth anything
 *   looksLike the drawing that means it, in words
 *   match     that same sentence as a number, 0 to 1, off the geometry
 *   configure the node patch, built from the drawing and the words
 *
 * `match` may read the words as well as the strokes, because "a box" and
 * "a box, as a cube" are different instructions and only one of them is a
 * cube. It must never call anything: the whole point of this layer is that
 * it decides for free and decides the same way every time.
 *
 * Pure, and tested by `tests/coded.mjs`.
 */
import { CUBE_SIDES, facesFrom, saysCube, written } from "./parts/cubeFaces.ts";
import { kindOfSketch } from "./shapeKind.ts";
import { sketchBox, type Sketch } from "./sketch.ts";
import type { StudioNode } from "./store.ts";

/** What a matcher is handed: the drawing, and everything already said about the part. */
export interface CodedContext {
  sketch: Sketch;
  /** The element's own prompt, when it had one before the drawing. */
  prompt: string;
  /** The part being reshaped, when a drawing was made on one. */
  node: Pick<StudioNode, "w" | "h" | "content" | "prompt"> | null;
}

export interface CodedPart {
  id: string;
  /** The library id this becomes. It must already exist in the catalog. */
  featureId: string;
  /** One sentence: what this is. */
  what: string;
  /** What the author has to supply. Shown when it is chosen, and said in the blueprint. */
  needs: string;
  /** The drawing that means it. */
  looksLike: string;
  /** How sure, 0 to 1. Zero means no. Never calls anything. */
  match: (c: CodedContext) => number;
  /** The patch that turns a node into this part, and the line that says what happened. */
  configure: (c: CodedContext) => { patch: Partial<StudioNode>; did: string };
}

/** How sure a match has to be before the catalogue claims the drawing. */
export const SURE_ENOUGH = 0.5;

/* ------------------------------------------------------------------ */
/* The parts                                                           */
/* ------------------------------------------------------------------ */

const CUBE: CodedPart = {
  id: "cube",
  featureId: "cube-3d",
  what: "Six faces in real 3D, turned with the pointer or the arrow keys, one piece of content a face.",
  needs: "One item a face, in the words: three pillars become three faces and the other three stay blank.",
  looksLike: "Three quadrilaterals meeting at a corner, a hexagon with a Y in it, or any closed shape when the words say cube or box.",
  match: ({ sketch, prompt }) => {
    const said = saysCube(`${sketch.words ?? ""} ${prompt}`);
    // The geometry alone is enough when it is unmistakable; a plain shape
    // needs the word, because a rectangle is every part in the library.
    const drawn = kindOfSketch(sketch, prompt).kind === "cube";
    if (!drawn) return 0;
    return said ? 1 : 0.8;
  },
  configure: ({ sketch, node }) => {
    const words = (node?.prompt ?? "").trim() || sketch.words.trim();
    const faces = facesFrom(node?.content ?? "", words);
    const n = written({ faces });
    const side = Math.max(160, Math.round(Math.min(node?.w ?? 360, node?.h ?? 360) || 360));
    return {
      patch: {
        featureId: "cube-3d",
        custom: false,
        kind: "cube",
        // A solid that turns cannot live inside a still silhouette, so the
        // clip goes. This is the only kind that gives it up.
        shape: null,
        outline: null,
        w: side,
        h: side,
        prompt: words,
        cube: { faces, turn: { x: -18, y: -32 } },
      },
      did: n ? `a cube with ${n} of ${CUBE_SIDES.length} faces written` : "a cube with six empty faces",
    };
  },
};

/**
 * The list is short on purpose and grows one file at a time. The obvious
 * next ones, in the order they are worth doing: an accordion (a stack of
 * bars), tabs (a box with a row of small boxes on its top edge), a
 * carousel (a wide box with arrows at its sides), a chart (axes with a
 * line or bars in them).
 */
export const CODED: CodedPart[] = [CUBE];

/* ------------------------------------------------------------------ */
/* Choosing                                                            */
/* ------------------------------------------------------------------ */

export interface CodedPick {
  part: CodedPart;
  score: number;
}

/**
 * The best coded part for this drawing, or nothing.
 *
 * Nothing is the ordinary answer and is not a failure: most drawings are
 * not a part in this list, and they go the way they always did.
 */
export function pickCoded(c: CodedContext): CodedPick | null {
  let best: CodedPick | null = null;
  for (const part of CODED) {
    const score = Math.max(0, Math.min(1, part.match(c)));
    if (score >= SURE_ENOUGH && (!best || score > best.score)) best = { part, score };
  }
  return best;
}

/** The catalogue as lines, for the blueprint and for anyone reading it. */
export function codedLines(): string[] {
  return CODED.map((p) => `${p.id} → ${p.featureId}: ${p.what} Needs: ${p.needs} Drawn as: ${p.looksLike}`);
}

/** Is this part one the catalogue can produce? Used to keep the two lists honest. */
export function isCoded(featureId: string): boolean {
  return CODED.some((p) => p.featureId === featureId);
}

/** A box round the drawing, for a matcher that needs one. */
export const boxOf = (sketch: Sketch) => sketchBox(sketch.strokes.filter((s) => s.length >= 2));
