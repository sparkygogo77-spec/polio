/**
 * When a drawing is odd or ambiguous, ask one question before spending on it.
 *
 * The first paid call on a drawing is the read: Claude looks at the strokes
 * and says what part they are. A drawing that could be two things gets
 * guessed at there, and a wrong guess costs the read, the trace and the
 * second pass before anyone can say "no, the other thing". So the strokes
 * are looked at here first, for free, and when they are plainly ambiguous
 * the job stops and asks — one question, a few answers, and the answer goes
 * in beside the drawing as words the reader can use. Nothing is spent until
 * the person has answered or waved it on.
 *
 * Two questions, and no more than one is ever asked of a drawing:
 *
 * **Nothing is ever asked of a drawing with words beside it.** A described
 * drawing is not ambiguous, whatever the strokes look like: a box captioned
 * "a chunk of rock, in 3d, turnable" is a solid, and asking whether it is a
 * cube would be asking a person to repeat themselves — which is worse than
 * guessing. So both questions below are questions about a *silent* drawing.
 *
 * 1. **Is this box a cube?** One closed line with four-ish corners filling
 *    its frame — the catalogue has a real cube with editable faces, free,
 *    and the flat box is one word away from it. This used to be offered as
 *    a toast after the part had already been made the other way; now it is
 *    asked before.
 * 2. **What is this meant to be?** The strokes read as a bare mark — not a box round something, not a ring, not a list, not a
 *    connector — and there is more than a single stroke or the one stroke
 *    is not straight. An icon, a picture and a surface go to different
 *    models at different steps (`imageRoute.ts`), and a person's one word
 *    decides that better than a read of a scribble does.
 *
 * Everything else is left alone. A drawing with words beside it has been
 * described; a shape the reader can name has been named by the pen; a
 * single straight stroke is a line.
 *
 * **THE WORDS ALWAYS WIN.** A question and its answer are about the drawing
 * as it stood when it was asked, and a person can describe the drawing
 * afterwards — while the question is still up, or after answering it, by
 * typing on the part the drawing was made on. Either way what is left is an
 * answer attached to a drawing that no longer matches it: "A cube", against
 * a part now captioned "the pricing table". So the question is asked again
 * of what is true *now*, at the moment the job runs and while it waits: a
 * question that would no longer be asked is withdrawn, and an answer to it
 * is dropped. `stillAsks` is that one rule, and it is the whole of it.
 *
 * Pure, and tested by `tests/oddness.mjs`.
 */
import { kindOfSketch, straightness } from "./shapeKind.ts";
import { nearlyCoded } from "./coded.ts";
import { strokeClosed, type Sketch } from "./pictures/index.ts";

export interface Question {
  /** One line, ending in a question mark. */
  ask: string;
  /** What can be answered, in the person's own words. The first is the likeliest. */
  choices: readonly string[];
  /** Which rule asked, for the record. */
  why: "cube" | "kind";
}

/** The question a drawing raises, or null when it raises none. */
export function oddness(sketch: Sketch, said = "", /** Whether it stands alone, as the catalogue judged it (`loneDrawing`): a lone bare box is claimed as the cube outright, so only one that is not is asked about. */ lone = true): Question | null {
  const words = `${sketch.words ?? ""} ${said}`.trim();
  const strokes = sketch.strokes.filter((s) => s.length >= 2);
  if (!strokes.length) return null;

  /*
   * A drawing with words beside it has been described, and a described
   * drawing is not ambiguous — whatever the strokes look like. This is the
   * whole gate: a box captioned "a chunk of rock, in 3d, turnable" is a
   * solid and asking whether it is a cube would be asking a person to
   * repeat themselves, which is worse than guessing.
   */
  if (words) return null;

  // A box that is one word from being a cube, and nobody has said the word.
  if (nearlyCoded({ sketch, prompt: said, node: null, lone })) {
    return { ask: "Is this box a cube?", choices: ["A cube", "A flat box"], why: "cube" };
  }

  // The pen said nothing the reader can name either.
  {
    const role = kindOfSketch(sketch, said);
    const closed = strokes.filter(strokeClosed);
    const oneLine = strokes.length === 1 && !closed.length && straightness(strokes[0]!) > 0.9;
    if (role.kind === "mark" && !oneLine) {
      return { ask: "What is this drawing meant to be?", choices: ["An icon", "A picture", "A surface", "Just a mark"], why: "kind" };
    }
  }
  return null;
}

/**
 * Does the question still stand, of the drawing as it is now?
 *
 * The strokes cannot change once a drawing is queued; the words can, and
 * words are what silence the question. So this asks it again: false when
 * the drawing has since been described, or has become a different kind of
 * ambiguous, and true only when the very same question would be asked of
 * it today. A job whose question is no longer standing runs without it, and
 * whatever was answered is dropped — the person's later words are a better
 * account of what they meant than their earlier answer.
 */
export function stillAsks(q: { why?: Question["why"]; lone?: boolean } | null | undefined, sketch: Sketch, said = ""): boolean {
  if (!q) return false;
  /* Judged as it was asked: a question from before `lone` was kept is judged as a drawing on its own. */
  const now = oddness(sketch, said, q.lone ?? true);
  if (!now) return false;
  // A question from before `why` was carried is judged on the drawing alone:
  // if anything would still be asked of it, what was answered stands.
  return q.why === undefined || now.why === q.why;
}

/**
 * The answer, as words beside the drawing.
 *
 * The reader and the route already take their cue from what was typed, so
 * an answer is put there and nothing downstream has to know a question was
 * asked: "A cube" is the word the catalogue claims a box by, "An icon" is
 * the word a role is read from, and "Just a mark" says nothing new. A blank
 * answer is the person waving it on.
 */
export function withAnswer(sketch: Sketch, answer: string | undefined | null): Sketch {
  const a = (answer ?? "").trim();
  if (!a) return sketch;
  const word = ANSWER_WORDS[a] ?? a;
  if (!word) return sketch;
  return { ...sketch, words: [sketch.words?.trim(), word].filter(Boolean).join(" ") };
}

/** What each choice means, as the one word the rest of the app already reads. */
export const ANSWER_WORDS: Record<string, string> = {
  "A cube": "cube",
  "A flat box": "",
  "An icon": "icon",
  "A picture": "picture",
  "A surface": "surface",
  "Just a mark": "",
};
