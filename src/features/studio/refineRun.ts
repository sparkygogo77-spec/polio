"use client";
/**
 * The second pass, fired from the browser the moment the first one lands.
 *
 * A person who drew something wants to see it, so the first pass is never
 * held back for the second: whatever the part gets today goes on the board
 * at once, and this runs after it, on its own, with nobody pressing
 * anything. When it comes back the part's body is replaced and the card
 * says what the better pass cost and how long it took — separately from the
 * first, because they are two charges on somebody's bill and a total hides
 * which one is expensive.
 *
 * Nothing here can lose a part. No token, no model in the table that can
 * make what this part needs, a refusal, a timeout: the first pass stays
 * exactly where it is and the card says the better pass did not run, and
 * why. That is the whole contract — the second pass is an improvement, not
 * a dependency.
 *
 * **The house example.** Once one drawing has been through both passes, the
 * pair — what it looked like after the first pass and what it looked like
 * after the second — is the most precise description of this site's style
 * that exists, and it is a picture rather than a paragraph. A model that
 * does example-based editing is handed the pair and works out what was done
 * between them, so every later drawing gets the same treatment without
 * anybody writing a style prompt and without training anything.
 *
 * It is kept in memory for the length of the session and not in the store:
 * two pictures do not belong in something that has to fit in a browser's
 * local storage alongside every part on the page. The signal for "happy
 * with it" is currently "it landed and was kept" — an explicit blessing
 * would be a better one, and is the obvious next thing.
 */
import { useStudio } from "./store";
import { rendererHeader } from "./agent";
import { sayPass, type Metered } from "./spend";
import { cleanSnippet, RENDER_LIMIT, type PartCode } from "./snippet";
import { judge, type Compare } from "./bodyRun";

export interface RefineInput {
  /** The part that stage one put on the board. */
  nodeId: string;
  /** What stage one left on the part, which the refined body is written over. */
  code: PartCode;
  /**
   * What to score the refined body against, when the caller has it.
   *
   * Without this the part would keep the first pass's number over the
   * second pass's picture, which is a score describing something that is no
   * longer there. With it the refined body is rendered and compared to the
   * same drawing at the same bar, so the number on the card is about what
   * is on the board.
   */
  score?: { target: boolean[]; mode?: Compare; clip?: string };
  /** What stage one drew, photographed: PNG base64, with no data-URL head. */
  first: string;
  label?: string;
  prompt?: string;
  /** What the part is for. This, and the frame, are what decide which model draws it. */
  role?: string | null;
  kind?: string;
  /** Real text in it wants the typography model; a ground wants the widest frames. */
  hasText?: boolean;
  ground?: boolean;
  w: number;
  h: number;
}

export interface RefineResult {
  ok: boolean;
  /** What the card says about this pass, whichever way it went. */
  line: string;
  model?: string;
  name?: string;
  ms?: number;
  /** Null is a real answer: the prediction reported no cost and none is shown. */
  cost?: number | null;
  reason?: string;
}

/** A data URL down to its bytes, which is all the route takes. */
const bare = (dataUrl: string | null | undefined): string | null => {
  const at = dataUrl?.indexOf("base64,") ?? -1;
  return at < 0 ? null : dataUrl!.slice(at + 7);
};

/**
 * The pair every later call is shown: a first pass and the second pass that
 * was kept. In memory, for this session.
 */
let house: { before: string; after: string } | null = null;

/** What the session has to teach the next drawing, if anything. */
export function houseExample(): { before: string; after: string } | null {
  return house;
}

/** Forget it — for a test, and for a person who wants the next one to start clean. */
export function forgetExample(): void {
  house = null;
}

interface Answer {
  ok?: boolean;
  html?: string;
  image?: string;
  model?: string;
  name?: string;
  ms?: number;
  cost?: number | null;
  message?: string;
  reason?: string;
}

/**
 * Run the second pass for one part.
 *
 * Returns the line for the card either way. The part is only touched when
 * there is something better to put on it.
 */
export async function refinePart(input: RefineInput, deps: { onStep?: (s: string) => void } = {}): Promise<RefineResult> {
  deps.onStep?.("Refining the drawing…");
  const from = Date.now();
  let answer: Answer;
  try {
    const res = await fetch("/api/studio/image", {
      method: "POST",
      headers: { "content-type": "application/json", ...rendererHeader() },
      body: JSON.stringify({
        stage: 2,
        first: input.first,
        label: input.label,
        prompt: input.prompt,
        role: input.role ?? null,
        kind: input.kind,
        hasText: !!input.hasText,
        ground: !!input.ground,
        w: input.w,
        h: input.h,
        ...(house ? { example: house } : {}),
      }),
    });
    answer = (await res.json()) as Answer;
  } catch (error) {
    const why = error instanceof Error ? error.message : "the call did not complete";
    return { ok: false, reason: "network", line: `second pass · did not run: ${why}` };
  }

  const meter: Metered = { ms: answer.ms ?? Date.now() - from, dollars: answer.cost ?? null };
  if (!answer.ok || !answer.html) {
    return {
      ok: false,
      reason: answer.reason ?? "refine",
      model: answer.model,
      name: answer.name,
      ms: meter.ms,
      cost: meter.dollars,
      line: `second pass · ${answer.message ?? "did not run"}`,
    };
  }

  /*
   * The part is still there to be replaced only if nothing else has
   * happened to it. A person who deleted it, or drew over it, while the
   * model was thinking has said something louder than this pass has.
   */
  const node = useStudio.getState().nodes.find((n) => n.id === input.nodeId);
  if (!node) {
    return { ok: false, reason: "gone", ms: meter.ms, cost: meter.dollars, line: "second pass · came back to a part that was no longer there" };
  }
  /*
   * Cleaned exactly like a body Claude wrote, and under the same locks: a
   * second model's markup is not more trusted than a first model's, and a
   * refinement is not a way round the rule.
   */
  const { html, stripped } = cleanSnippet(answer.html, RENDER_LIMIT);
  if (!html) {
    return { ok: false, reason: "empty-body", ms: meter.ms, cost: meter.dollars, line: "second pass · nothing usable was left of it once it was cleaned" };
  }

  /*
   * Judged again, against the same drawing at the same bar. The first
   * pass's score was about the first pass's picture, and leaving it over
   * this one would be a number about something that is no longer there.
   */
  const scored = input.score
    ? await judge(html, { w: input.w, h: input.h, clip: input.score.clip ?? "" }, input.score.target, input.score.mode)
    : null;

  const code: PartCode = {
    ...input.code,
    html,
    at: Date.now(),
    ...(scored && scored.overlap >= 0 ? { overlap: scored.overlap } : {}),
    ...(stripped.length ? { stripped } : {}),
    refined: {
      model: answer.model ?? "",
      name: answer.name ?? answer.model ?? "the refiner",
      ms: meter.ms,
      cost: meter.dollars,
      at: Date.now(),
    },
  };
  useStudio.getState().updateNode(input.nodeId, { code });

  // What this drawing became is what the next drawing is shown.
  const after = bare(answer.image);
  if (after) house = { before: input.first, after };

  return {
    ok: true,
    model: answer.model,
    name: answer.name,
    ms: meter.ms,
    cost: meter.dollars,
    line: `second pass · ${sayPass(answer.name ?? answer.model ?? "the refiner", meter)}`,
  };
}
