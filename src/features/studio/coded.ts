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
import { CUBE_SIDES, facesFrom, listItems, saysCube, written } from "./shelf/index.ts";
import { corners, isBox, kindOfSketch } from "./shapeKind.ts";
import { CUBE_MIN, REST } from "./shelf/index.ts";
import { sketchBox, strokeClosed, type Sketch } from "./sketch.ts";
import type { StudioNode } from "./board/store.ts";
import { plain } from "./shelf/index.ts";

/** What a matcher is handed: the drawing, and everything already said about the part. */
export interface CodedContext {
  sketch: Sketch;
  /** The element's own prompt, when it had one before the drawing. */
  prompt: string;
  /** The part being reshaped, when a drawing was made on one. */
  node: Pick<StudioNode, "w" | "h" | "content" | "prompt"> | null;
  /**
   * Does the drawing stand on its own: nothing of the page inside it, and
   * nothing drawn on that already is something? A lone box is a cube; a
   * box round three cards is their frame. Read by the caller off the
   * board, because a matcher sees only the strokes. Taken as true when
   * left out.
   */
  lone?: boolean;
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
  looksLike: "A box on its own, three quadrilaterals meeting at a corner, a hexagon with a Y in it, or any closed shape when the words say cube or box.",
  match: ({ sketch, prompt, lone }) => {
    const said = saysCube(`${sketch.words ?? ""} ${prompt}`);
    /*
     * The geometry decides. An isometric box is unmistakable; a plain box
     * is a box when it stands alone with nothing said beside it, because
     * that is the drawing this whole arc is judged on. A box with words
     * that name something else, a box round parts, and a box drawn over
     * a part that already is something are all left to the words.
     */
    const drawn = kindOfSketch(sketch, prompt, lone ?? true).kind === "cube";
    if (!drawn) return 0;
    return said ? 1 : isBox(sketch) ? 0.9 : 0.8;
  },
  configure: ({ sketch, node, lone }) => {
    const words = (node?.prompt ?? "").trim() || sketch.words.trim();
    const faces = facesFrom(plain(node?.content), words);
    const n = written({ faces });
    // Read off the typed words only: a part's saved description asks for nothing (`reshapeRun.ts`).
    const asBox = !saysCube(sketch.words ?? "") && kindOfSketch(sketch, "", lone ?? true).why.includes("four corners");
    /*
     * The proportion it was drawn at is kept: a square box is a cube and a
     * wide one is a wide box, which is what "the drawn ratio locking" means
     * for a solid. Only a part too small to read is grown, and grown in
     * proportion.
     */
    const size = node
      ? (() => {
          const short = Math.max(1, Math.min(node.w, node.h));
          const grow = Math.max(1, CUBE_MIN / short);
          return { w: Math.round(node.w * grow), h: Math.round(node.h * grow) };
        })()
      : null;
    return {
      patch: {
        featureId: "cube-3d",
        custom: false,
        kind: "cube",
        // A solid that turns cannot live inside a still silhouette, so the
        // clip goes. This is the only kind that gives it up.
        shape: null,
        outline: null,
        ...(size ?? {}),
        prompt: words,
        cube: { faces, turn: { ...REST } },
      },
      did: `${asBox ? "a box, read off its own four corners: " : ""}${n ? `a cube with ${n} of ${CUBE_SIDES.length} faces written` : "a cube with six empty faces"}`,
    };
  },
};

/**
 * Rows that open and close, drawn as a stack of bars.
 *
 * The second entry, and it is here to prove the catalogue's shape rather
 * than to be clever: the whole of it is a declaration, a number and a
 * patch, and the part it becomes has been in the library all along.
 *
 * The gate matters. Three parallel bars are already read as a **list**,
 * and most of the time that is exactly what someone drew — a list of
 * three things. A stack of bars only means an accordion when the words
 * say so, or when the bars are inside a box, which is the way nobody
 * draws a plain list. Everything else keeps the behaviour it had.
 */
const OPENS = /\b(accordion|faq|frequently asked|expand|collapse|collapsible|drop ?down list)\b/i;

const ACCORDION: CodedPart = {
  id: "accordion",
  featureId: "accordion",
  what: "Rows that open to show their answer and close again, one at a time.",
  needs: "One row a line, and a colon where a row has an answer: \"What does it cost: nothing until you publish\".",
  looksLike: "Three or more parallel bars, either inside a box or with the words saying accordion, FAQ, expand or collapse.",
  match: ({ sketch, prompt }) => {
    const role = kindOfSketch(sketch, prompt);
    if (role.kind !== "list" || (role.rows ?? 0) < 3) return 0;
    if (OPENS.test(`${sketch.words ?? ""} ${prompt}`)) return 1;
    // Bars inside a box: a list nobody draws a frame round.
    const strokes = sketch.strokes.filter((s) => s.length >= 2);
    const all = sketchBox(strokes);
    const framed = strokes.some((s) => {
      const b = sketchBox([s]);
      return !!b && !!all && b.w * b.h > all.w * all.h * 0.8 && strokeClosed(s);
    });
    return framed ? 0.8 : 0;
  },
  configure: ({ sketch, node }) => {
    const words = plain(node?.content).trim() || stripLeadIn((node?.prompt ?? "").trim() || sketch.words.trim(), OPENS);
    const rows = listItems(words).slice(0, 12);
    return {
      patch: {
        featureId: "accordion",
        custom: false,
        // A coded part is a component, not a silhouette: the cutout the
        // drawing would have made is what it replaces.
        shape: null,
        outline: null,
        kind: "list",
        ...(rows.length ? { content: rows.join(", ") } : {}),
      },
      did: rows.length ? `an accordion of ${rows.length} rows` : "an accordion, with its rows still to write",
    };
  },
};

/**
 * "An accordion: one, two, three" is a lead-in and then a list. Drop the
 * lead-in only when it is the bit naming the part, because "Pricing: from
 * nothing" is a row and its answer.
 */
function stripLeadIn(text: string, says: RegExp): string {
  const colon = text.indexOf(":");
  return colon > 0 && says.test(text.slice(0, colon)) ? text.slice(colon + 1) : text;
}

/**
 * Two entries, which is enough to prove the shape of the thing: one that
 * needed a new part written and one that needed only a declaration over a
 * part the library already had. The obvious next ones, in the order they
 * are worth doing: tabs (a box with a row of small boxes on its top edge),
 * a carousel (a wide box with arrows at its sides), a chart (axes with a
 * line or bars in them).
 */
export const CODED: CodedPart[] = [CUBE, ACCORDION];

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

/* ------------------------------------------------------------------ */
/* What it nearly was                                                  */
/* ------------------------------------------------------------------ */

/**
 * What the catalogue *nearly* claimed, and the one word that would have
 * done it.
 *
 * A closed box is the most-drawn shape there is, and the library's cube is
 * the part it nearly always means. A box on its own with nothing said
 * beside it is now taken as one (`isBox`, `kindOfSketch` with `lone`);
 * this is for the box that was *not* taken, because words beside it said
 * something else, or it was drawn round parts or over one. The guess is
 * still offered there rather than made, because a rectangle captioned
 * "the pricing table" is a pricing table.
 */
export function nearlyCoded(c: CodedContext): string {
  const said = `${c.sketch.words ?? ""} ${c.prompt}`;
  if (saysCube(said)) return "";
  // A lone, bare box is claimed outright now, so there is nothing to offer.
  if ((c.lone ?? true) && !said.trim() && isBox(c.sketch)) return "";
  const closed = c.sketch.strokes.filter((s) => s.length >= 2).filter(strokeClosed);
  if (closed.length !== 1) return "";
  const n = corners(closed[0]!);
  // Four corners and a box that fills its frame: a box, drawn as a box.
  if (n < 3 || n > 6) return "";
  const box = sketchBox(closed)!;
  if (box.w < 0.2 || box.h < 0.2) return "";
  return 'a closed box like this can be a real cube instead — six faces you can turn and write on. Say "cube" or "box" beside the drawing and it will be one.';
}
