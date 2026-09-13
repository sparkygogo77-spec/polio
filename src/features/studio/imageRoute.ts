/**
 * Which model draws this, and at which step.
 *
 * Not a list of models with a default. A default is the wrong shape for
 * what this actually is: different kinds of element want different models,
 * and so do different steps of making one. So the route asks two questions
 * and a model declares which of the answers it can serve.
 *
 * **What is being made.**
 *
 * - An **icon** or small mark needs a transparent background and crisp
 *   edges, so it goes down the vector path or to a model that can really do
 *   alpha. Most cannot; the ones that say they can are the only ones
 *   offered it.
 * - A **surface** — a texture, a ground, a backdrop — needs no alpha and
 *   often wants a ratio nothing else offers. 21:9 and wider is a real
 *   requirement here and it rules most models out on its own.
 * - A **picture**, an illustrative element, wants prompt fidelity above
 *   everything.
 * - Something with **real text in it** wants the typography model, which is
 *   what ideogram is for. No amount of prompting makes a general image
 *   model set type.
 * - An **object** you can turn goes to a model that returns a solid rather
 *   than a picture — a GLB the board mounts and rotates. A drawn *box*
 *   never gets here: the catalogue already has a real cube with editable
 *   faces and it costs nothing, so the words-and-geometry road claims it
 *   first. This cell is for the things that are not boxes.
 *
 * **Which step we are at.**
 *
 * - **read** — what did the person actually draw? This is not an image
 *   model's job at all. It is a vision read of the strokes and it decides
 *   everything after it, so `route` refuses it by design rather than
 *   quietly picking a drawing model.
 * - **first** — the cheap pass that lands on the board while the person is
 *   still looking at what they drew.
 * - **refine** — an approved version worked on again, with different
 *   inputs: reference images, and where we have one an example pair.
 * - **alpha** — cutting the ground away *after* a render. It is the **last
 *   resort of three**, and the order matters more than the models do:
 *
 *   1. **The drawn line is the alpha.** A part drawn on the board is
 *      clipped to the line it was drawn as (`blocks.tsx`, `Cut`), and that
 *      clip is exact, free, instant, and preserves the holes in a mark by
 *      construction — because it *is* the person's own path. An opaque
 *      picture on a drawn mark does not land as a rectangle; it lands as
 *      the gull that was drawn. So a clipped part never asks for alpha at
 *      all, which is what lets the best model for the picture take the job
 *      instead of the only one that can leave a ground out.
 *   2. **Otherwise alpha is a property of the render.** A model told
 *      `background: transparent` never draws a ground, so there is no matte
 *      to cut: no halo, no filled hole, no second call, nothing to go
 *      wrong. Exact by construction.
 *   3. **Only then, cut it out afterwards.** For the case where neither
 *      holds — no drawn line, and the right model for this job cannot make
 *      a transparent one. It is a segmenter guessing at an edge after the
 *      fact, which is precisely the thing that fills in the hole in a ring
 *      and haloes a thin line, so it is where it belongs: last.
 *
 * Adding a model is one entry in `MODELS` and changes no call site. A model
 * declares only the cells it should actually be chosen for — declaring
 * narrowly *is* the ranking — and within a cell the table's own order
 * decides. That is the whole mechanism; there is no score, no weight and no
 * slug anywhere outside this file.
 *
 * **Every row was read off the model's own published schema** at
 * `replicate.com/<slug>/api/schema`, not off a datasheet. Three things that
 * were believed here and are not true are written down at their rows.
 *
 * Prices are not in this table. Replicate publishes no rate for most of
 * these, and a number invented for a card is worse than a card that says
 * the cost was not reported — so what a pass cost is read off the
 * prediction itself (`spend.ts`, `fromMetrics`) or not shown. The one
 * published price we have been given is noted at its row as a note, not as
 * something anything computes with.
 *
 * Pure: no fetch, no keys, no Replicate client. Tested by `tests/imaging.mjs`.
 */

/** What is being made. The first question. */
export type Making = "icon" | "surface" | "picture" | "type" | "object";

/** Which step of making it. The second. */
export type Step = "read" | "first" | "refine" | "alpha";

export const MAKINGS: readonly Making[] = ["icon", "surface", "picture", "type", "object"];
export const STEPS: readonly Step[] = ["read", "first", "refine", "alpha"];

/** How a model is asked for a thing, when it has a field for it at all. */
export interface Field {
  field: string;
  value: string;
}

export interface ImageModel {
  /** The Replicate slug. The only place it is written. */
  slug: `${string}/${string}`;
  /** What it is called in a sentence on a card. */
  name: string;
  /**
   * What it hands back.
   *
   * A picture is a body the board draws. A **mesh** is a solid: a GLB the
   * board mounts in a viewer and turns, which is a different answer, a
   * different part and a different set of input fields — so it is declared
   * rather than guessed from the kind being made.
   */
  returns: "picture" | "mesh";
  /**
   * Which kinds it should be chosen for, at which step.
   *
   * Narrow on purpose. A model that could technically produce an icon but
   * produces a bad one does not list `icon`, because listing it is what
   * makes it get picked.
   */
  serves: Partial<Record<Step, readonly Making[]>>;
  /** How many reference images it takes, and in which field. Zero means text only. */
  references: number;
  refField: string | null;
  /**
   * Can it be shown a before and an after and apply the same change to a
   * third image?
   *
   * The one that matters most. Once a person has taken one drawing to an
   * element they are happy with, that pair *is* the house style — every
   * later drawing gets the same treatment with nobody writing a prompt
   * describing it and nobody training a LoRA.
   */
  examplePair: boolean;
  /**
   * The `aspect_ratio` value meaning "keep the frame you were given", or
   * null. An edit that comes back reframed is the biggest single cause of
   * an iteration being worse than what went into it.
   */
  keepFrame: string | null;
  /** The ratios it will draw in, its own spelling. */
  ratios: readonly string[];
  /** How to ask for a transparent background, or false if it cannot make one. */
  alpha: Field | false;
  /** How to ask for the frame, when it takes pixels rather than a ratio. */
  pixels: { widthField: string; heightField: string; max: number; step: number; via?: Field } | null;
  /** How to ask for the largest sensible frame, if it has a field for it. */
  size: Field | null;
  /** How to ask for PNG out. */
  format: Field;
  /**
   * How a mesh model is asked, when `returns` is "mesh".
   *
   * None of the picture fields apply: there is no aspect ratio on a solid,
   * no transparent ground, and the thing that matters instead is how many
   * faces come back, because the board has to carry the file.
   */
  mesh: {
    /** Where the drawing goes. */
    imageField: string;
    /** Other views it will take, in the order it names them. A drawn box has more than one. */
    alsoViews?: readonly string[];
    /** How to ask for a GLB, which is the one format the viewer mounts. */
    format: Field;
    /** How to ask for a mesh small enough for a document to carry, and what to ask for. */
    facesField?: string;
    faces?: number;
    /** Ask it to cut the ground out of the drawing before it reads it. */
    cutGround?: Field;
  } | null;
  /**
   * How a remover is asked, when it serves the `alpha` step.
   *
   * A different shape again: one picture in, the same picture out with the
   * ground gone. No prompt, no ratio, no frame — it is not drawing
   * anything.
   */
  cut: {
    imageField: string;
    /** How to ask for a soft matte rather than a hard cut, if it has the field. */
    softness?: Field;
  } | null;
  /** Anything it has that we do not set, and anything believed about it that is wrong. */
  also?: string;
}

/**
 * The models, in the order a cell prefers them.
 *
 * Nothing here is a default. A model earns a cell by declaring it.
 */
export const MODELS: readonly ImageModel[] = [
  {
    slug: "google/nano-banana-2",
    name: "Nano Banana 2",
    returns: "picture",
    // The widest ratio list of anything here, so it is the one that can
    // actually make a 21:9 band, and `match_input_image` makes it the safe
    // choice for an edit.
    serves: { first: ["surface", "picture", "icon"], refine: ["surface", "picture", "icon"] },
    references: 14,
    refField: "image_input",
    examplePair: false,
    keepFrame: "match_input_image",
    ratios: ["1:1", "1:4", "1:8", "2:3", "3:2", "3:4", "4:1", "4:3", "4:5", "5:4", "8:1", "9:16", "16:9", "21:9"],
    alpha: false,
    pixels: null,
    size: { field: "resolution", value: "2K" },
    format: { field: "output_format", value: "png" },
    mesh: null,
    cut: null,
    also: "resolution is 1K, 2K or 4K — there is no 512px, which was believed. It can also search the web for references, which is off.",
  },
  {
    slug: "bytedance/seedream-5-lite",
    name: "Seedream 5 Lite",
    returns: "picture",
    // The only one that does example-based editing, which is this app's own
    // loop expressed as a model feature, so it leads the refine step.
    serves: { refine: ["picture", "surface", "icon"], first: ["picture"] },
    references: 14,
    refField: "image_input",
    examplePair: true,
    keepFrame: "match_input_image",
    ratios: ["1:1", "4:3", "3:4", "16:9", "9:16", "3:2", "2:3", "21:9"],
    alpha: false,
    pixels: null,
    size: { field: "size", value: "2K" },
    format: { field: "output_format", value: "png" },
    mesh: null,
    cut: null,
    also: "size is 2K or 3K; sequential_image_generation auto gives a batch, which is off; max_images up to 15.",
  },
  {
    slug: "openai/gpt-image-2",
    name: "GPT Image 2",
    returns: "picture",
    // Alpha, and a wide enough ratio list to be useful with it.
    serves: { first: ["icon", "picture"], refine: ["icon", "picture"] },
    references: 10,
    refField: "input_images",
    examplePair: false,
    keepFrame: null,
    ratios: ["1:1", "3:2", "2:3", "4:3", "3:4", "16:9", "9:16"],
    alpha: { field: "background", value: "transparent" },
    pixels: null,
    size: null,
    format: { field: "output_format", value: "png" },
    mesh: null,
    cut: null,
    also:
      "It was briefed here as unable to do transparency at all: its schema carries background auto|transparent|opaque, the same field gpt-image-1.5 has. "
      + "The 1:1/3:2/2:3-only ratio list belongs to gpt-image-1.5, not to this — this also takes 4:3, 3:4, 16:9, 9:16, auto and explicit pixel sizes up to 3840x2160.",
  },
  {
    slug: "openai/gpt-image-1.5",
    name: "GPT Image 1.5",
    returns: "picture",
    serves: { first: ["icon"], refine: ["icon"] },
    references: 10,
    refField: "input_images",
    examplePair: false,
    keepFrame: null,
    ratios: ["1:1", "3:2", "2:3"],
    alpha: { field: "background", value: "transparent" },
    pixels: null,
    size: null,
    format: { field: "output_format", value: "png" },
    mesh: null,
    cut: null,
    also: "Three ratios and no more, so it is the alpha model of last resort rather than the first. input_fidelity high makes an edit hold closer to what it was given.",
  },
  {
    slug: "tencent/hunyuan3d-2mv",
    name: "Hunyuan3D 2 (multi-view)",
    returns: "mesh",
    /*
     * The only cell that wants a solid, and the reason this one has it.
     *
     * Seven image-to-3D models were compared on what they actually hand
     * back, because "3D model" is not a format:
     *
     *   firtoz/trellis          GLB, but only with generate_model on — off
     *                           by default — plus turntable videos and a
     *                           gaussian PLY; texture 1024, simplify 0.95.
     *   fishwowater/trellis2    GLB, and a video; but texture 4096 and a
     *                           decimation target of a million faces.
     *   tencent/hunyuan-3d-3.1  one file, format not declared anywhere in
     *                           the schema; 500,000 faces by default.
     *   tencent/hunyuan3d-2mv   glb | obj | ply | stl as an enum, 10,000
     *                           faces by default, removes the background
     *                           itself, and takes front, back, left and
     *                           right views.
     *   prunaai/hunyuan3d-2     glb | obj, 40,000 faces.
     *   hyper3d/rodin           glb and four others, but a prompt is
     *                           required — it will not work from a drawing
     *                           alone, which is this app's whole rule.
     *   cjwbw/shap-e            an array of files, older and coarser.
     *
     * This one wins on the thing that decides it: the board has to *carry*
     * the file. A document keeps its parts inside itself, so a mesh is
     * bytes in the page, and ten thousand faces is the only default here
     * that is already the right order of magnitude. It also names `glb` in
     * an enum rather than leaving the format to be discovered, and it takes
     * four views — which is exactly what a drawn box gives you.
     */
    serves: { first: ["object"] },
    references: 4,
    refField: null,
    examplePair: false,
    keepFrame: null,
    ratios: [],
    alpha: false,
    pixels: null,
    size: null,
    format: { field: "file_type", value: "glb" },
    mesh: {
      imageField: "front_image",
      alsoViews: ["back_image", "left_image", "right_image"],
      format: { field: "file_type", value: "glb" },
      facesField: "target_face_num",
      faces: 10000,
      cutGround: { field: "remove_background", value: "true" },
    },
    cut: null,
    also:
      "It also has steps, guidance_scale, octree_resolution, num_chunks and a seed, none of which are set. "
      + "The face count is the one that matters: a mesh has to fit inside the document that carries it.",
  },
  {
    slug: "851-labs/background-remover",
    name: "Background remover",
    returns: "picture",
    /*
     * The last resort, and the only cell it serves.
     *
     * Five removers were compared and they are all the same technique — a
     * salient-object matte, the rembg/BiRefNet family: bria/remove-background
     * (commercial, but its only knob keeps alpha the input already had),
     * men1scus/birefnet, lucataco/remove-bg and smoretalk/rembg-enhance
     * (no options at all between them). This one wins because it is the
     * only one that declares control over the matte itself: `threshold` 0
     * asks for **soft** alpha rather than a hard cut, which is what the
     * antialiased edge of a mark needs, and the output format is ours to
     * pick rather than whatever it feels like.
     *
     * None of them declares that it preserves the hole in a ring, and that
     * is the honest reason this step is third rather than first.
     */
    serves: { alpha: ["icon", "picture"] },
    references: 1,
    refField: null,
    examplePair: false,
    keepFrame: null,
    ratios: [],
    alpha: { field: "background_type", value: "rgba" },
    pixels: null,
    size: null,
    format: { field: "format", value: "png" },
    mesh: null,
    cut: {
      imageField: "image",
      /** 0 is soft alpha. A hard cut on a drawn line is a staircase. */
      softness: { field: "threshold", value: "0" },
    },
    also: "It can also reverse the matte, paint the ground a colour, blur it or map it, none of which is wanted here.",
  },
  {
    slug: "prunaai/p-image-ideogram",
    name: "Ideogram (Pruna)",
    returns: "picture",
    /*
     * Text only, and that asymmetry is exactly why this table has two axes:
     * it is a real first pass for anything prompted from words and cannot
     * serve `refine` or anything that starts from a drawing, because it has
     * no input image field at all.
     */
    serves: { first: ["type", "picture"] },
    references: 0,
    refField: null,
    examplePair: false,
    keepFrame: null,
    ratios: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"],
    alpha: false,
    pixels: { widthField: "width", heightField: "height", max: 2560, step: 16, via: { field: "aspect_ratio", value: "custom" } },
    size: { field: "image_size", value: "2K" },
    format: { field: "output_format", value: "png" },
    mesh: null,
    cut: null,
    also:
      "Said here to be jpg out: it takes png, jpg or webp, and png is what we ask for — a flat graphic with type on it should not carry jpeg artefacts. "
      + "Width and height only apply with aspect_ratio custom, rounded to a multiple of 16, up to 2560. "
      + "It also has a seed, prompt_upsampling (on by default) and a thinking level. "
      + "Quoted at $0.003 a generation, which is not in the schema and is not priced against here.",
  },
];

/**
 * The one asked for when a cell offers more than one that can do alpha.
 *
 * Named rather than falling out of row order, because it is a real choice
 * and belongs where it can be argued with. It is still held to the table:
 * `route` will not return a model whose row says it cannot.
 */
export const ALPHA_FIRST = "openai/gpt-image-2";

export function model(slug: string): ImageModel | null {
  return MODELS.find((m) => m.slug === slug) ?? null;
}

/**
 * What is being made, worked out from the part rather than from a switch.
 *
 * Two senses of the word "surface" meet here and they are not the same
 * thing. A drawn part's `surface` **role** is a frame — the outline holds
 * what is placed inside it — so it is a mark with a hole in it and it needs
 * the ground left out exactly as an icon does. A `surface` in this table is
 * a texture, a backdrop, a ground: it *is* the background, wants no alpha,
 * and usually wants a band no ordinary ratio list has. So a drawn frame
 * routes as a mark, and only a wide raster ground routes as a surface.
 *
 * A motion path is a line, and a line wants the same alpha and the same
 * crisp edges a mark does, so it is routed as one. A part with no role yet
 * is treated as a mark too, which is the only answer that cannot land a
 * filled rectangle on the board.
 */
/**
 * Words that ask for a solid rather than a picture of one.
 *
 * Deliberately narrow. A solid costs a model call and lands as a file the
 * document has to carry, so it is never guessed at from geometry: somebody
 * has to have asked. "cube" and "box" are not in here on purpose — those
 * are the catalogue's own cube, which is free, turnable and editable, and
 * they are claimed long before anything reaches this table.
 */
const SAYS_SOLID = /\b(3d|three[- ]d|solid|mesh|model|sculpt|turnable|rotatable|spin(?:nable)?|orbit(?:able)?|from every (?:side|angle))\b/i;

export function saysSolid(words: string): boolean {
  return SAYS_SOLID.test(words ?? "");
}

export function makingOf(what: {
  kind?: string;
  role?: string | null;
  hasText?: boolean;
  /** A part that is the ground rather than a thing on it. */
  ground?: boolean;
  /** What was said next to the drawing. A solid has to be asked for. */
  said?: string;
  w?: number;
  h?: number;
}): Making {
  // Asked for in words, and only in words: a thing you can turn is a file
  // the page has to carry, so nobody gets one by accident.
  if (what.said && saysSolid(what.said)) return "object";
  if (what.hasText) return "type";
  // A drawn frame is a mark with a hole in it, not a backdrop.
  if (what.role === "icon" || what.role === "motion" || what.role === "surface") return "icon";
  if (what.kind === "raster") {
    // A band far wider than it is tall is a ground, whatever it was called.
    const wide = what.w && what.h ? what.w / what.h >= 2.5 : false;
    return what.ground || wide ? "surface" : "picture";
  }
  return what.role ? "picture" : "icon";
}

/**
 * Does what is being made need a transparent background?
 *
 * Only a mark. It drops onto a button, onto whatever colour it lands on,
 * and an opaque ground turns it into a filled rectangle sitting on the
 * page. Everything else fills its own box: a surface *is* the ground, a
 * picture covers what it is placed over, and type sits on something of its
 * own. Asking for alpha where it is not needed narrows the table to two
 * models for no reason.
 */
export function needsAlpha(making: Making): boolean {
  return making === "icon";
}

/** Is this a solid rather than something flat? It lands as a different part. */
export function isSolid(making: Making): boolean {
  return making === "object";
}

/** Can this model be asked for this cell at all? */
function serves(m: ImageModel, making: Making, step: Step): boolean {
  return (m.serves[step] ?? []).includes(making);
}

export interface Need {
  making: Making;
  step: Step;
  /**
   * Is the part already cut to a line somebody drew?
   *
   * The first and best answer to alpha, and the reason it is a question
   * asked of the *need* rather than a property of the kind: a mark on a
   * drawn part is clipped to that drawing, so it does not need a
   * transparent render and need not be sent to one of the two models that
   * can manage one. The best model for the picture can have the job.
   */
  clipped?: boolean;
  /** Is there an image going in? A refine has one; a first pass may not. */
  fromImage?: boolean;
  /** Do we have a before-and-after pair to teach it with? */
  example?: boolean;
  /** The frame, so a model that cannot hold it is not offered the job. */
  w?: number;
  h?: number;
  /** Override the pick. Honoured only if that model actually serves the cell. */
  prefer?: string;
}

/** Why a cell has no model, in the words the card will use. */
export type NoModel = "not-a-model-job" | "nothing-serves" | "cannot-take-an-image" | "cannot-do-alpha";

export interface Routed {
  model: ImageModel | null;
  /** Set when `model` is null. Never both. */
  why?: NoModel;
  /** What the pick can do of what was wanted, so the caller can say so. */
  usedExample?: boolean;
  /**
   * The pick cannot leave the ground out, and it is wanted, so it has to be
   * cut out afterwards.
   *
   * This is how the third answer is reached and the only way it is. It
   * exists so that a cell with nothing alpha-capable in it still gets a
   * picture — the best one for the job, with the ground taken off after —
   * rather than nothing at all. When the table changes and both models that
   * can do transparency go, this is what keeps marks working.
   */
  cutAfter?: boolean;
}

/**
 * Which model, for this cell.
 *
 * Honours `prefer` when that model really serves the cell, then the
 * declared alpha-first when alpha is required, then the table's order. A
 * cell with nobody in it is an answer, not an error: the caller keeps what
 * it has and says on the card that nothing ran.
 */
export function route(need: Need): Routed {
  // Reading a drawing is a vision job. Refusing it here is the point: the
  // alternative is quietly handing strokes to a model that draws.
  if (need.step === "read") return { model: null, why: "not-a-model-job" };

  // A drawn line is alpha already, so nothing is asked for twice.
  const wantAlpha = needsAlpha(need.making) && !need.clipped;
  const fits = (m: ImageModel) => {
    if (!serves(m, need.making, need.step)) return false;
    // A step that starts from a picture needs somewhere to put it.
    // A mesh model takes its picture in a field of its own rather than in a
    // reference list, so it is asked the same question a different way.
    const takesPicture = m.cut ? true : m.returns === "mesh" ? !!m.mesh : m.references > 0 && !!m.refField;
    if (need.fromImage && !takesPicture) return false;
    if (wantAlpha && m.alpha === false) return false;
    return true;
  };

  const asked = need.prefer ? model(need.prefer) : null;
  const alphaFirst = wantAlpha ? model(ALPHA_FIRST) : null;
  const order = [asked, alphaFirst, ...MODELS].filter((m): m is ImageModel => !!m);
  const pick = order.find(fits) ?? null;
  if (pick) return { model: pick, usedExample: !!need.example && pick.examplePair };

  // Why there is nobody, in the most useful order: the reason a person can
  // do something about first.
  const declared = MODELS.filter((m) => serves(m, need.making, need.step));
  if (!declared.length) return { model: null, why: "nothing-serves" };
  if (wantAlpha && declared.every((m) => m.alpha === false)) {
    /*
     * Nothing that draws this can leave the ground out — but something can
     * take it off afterwards, so the job still gets done. The best model
     * for the picture draws it and the cut follows, which is worse than a
     * transparent render and far better than no pass at all.
     */
    const after = need.step !== "alpha" && MODELS.some((m) => serves(m, need.making, "alpha") && !!m.cut);
    const best = declared.find((m) => (!need.fromImage || (m.cut ? true : m.returns === "mesh" ? !!m.mesh : m.references > 0 && !!m.refField)));
    if (after && best) return { model: best, usedExample: !!need.example && best.examplePair, cutAfter: true };
    return { model: null, why: "cannot-do-alpha" };
  }
  return { model: null, why: "cannot-take-an-image" };
}

/**
 * The ratio to ask for: the model's own nearest to the box, never a stretch.
 *
 * `match_input_image` wins whenever the model has it and there is a picture
 * going in, because the frame that came out of the step before is already
 * the part's frame and anything else is a reframe. Otherwise the nearest by
 * proportion, judged on the log of the ratio so 2:1 and 1:2 are the same
 * distance out — and the caller crops to the box rather than stretching to
 * it, because a stretched drawing is a wrong drawing.
 */
export function ratioFor(m: ImageModel, w: number, h: number, fromImage: boolean): string {
  if (fromImage && m.keepFrame) return m.keepFrame;
  const want = Math.max(0.05, Math.min(20, (w || 1) / (h || 1)));
  let best = m.ratios[0]!;
  let gap = Infinity;
  for (const v of m.ratios) {
    const [a, b] = v.split(":").map(Number);
    const d = Math.abs(Math.log(a! / b!) - Math.log(want));
    if (d < gap) {
      gap = d;
      best = v;
    }
  }
  return best;
}

/**
 * What goes in the box, built from the row rather than from a slug.
 *
 * `images` is ordered and the order carries meaning for a model that does
 * example-based editing: the pair first — what a drawing looked like and
 * what it became once somebody was happy with it — then the image being
 * worked on. A model that has no example pair gets the same list as plain
 * references, which is still the house style riding along. A model with no
 * reference field gets no images at all, which is why it may only be routed
 * to a step that does not start from one.
 */
export function inputFor(
  m: ImageModel,
  ask: { prompt: string; images?: string[]; w?: number; h?: number; transparent?: boolean },
): Record<string, unknown> {
  /*
   * A solid is asked for differently, and mostly by *not* asking: there is
   * no ratio on a mesh, no transparent ground, and no prompt — the drawing
   * is the whole brief, which is this app's rule for the drawing path and
   * happens to be how these models work anyway. What replaces all of it is
   * a face count, because the document has to carry what comes back.
   */
  /*
   * A remover is asked for one thing and given one thing. No prompt, no
   * ratio, no frame: it is not drawing, it is cutting.
   */
  if (m.cut) {
    const out: Record<string, unknown> = {};
    const one = (ask.images ?? [])[0];
    if (one) out[m.cut.imageField] = one;
    if (m.cut.softness) out[m.cut.softness.field] = Number(m.cut.softness.value);
    if (m.alpha) out[m.alpha.field] = m.alpha.value;
    out[m.format.field] = m.format.value;
    return out;
  }
  if (m.returns === "mesh" && m.mesh) {
    const views = (ask.images ?? []).slice(0, 1 + (m.mesh.alsoViews?.length ?? 0));
    const out: Record<string, unknown> = {};
    if (views[0]) out[m.mesh.imageField] = views[0];
    (m.mesh.alsoViews ?? []).forEach((field, i) => {
      if (views[i + 1]) out[field] = views[i + 1];
    });
    out[m.mesh.format.field] = m.mesh.format.value;
    if (m.mesh.facesField && m.mesh.faces) out[m.mesh.facesField] = m.mesh.faces;
    if (m.mesh.cutGround) out[m.mesh.cutGround.field] = m.mesh.cutGround.value === "true";
    return out;
  }
  const images = m.refField ? (ask.images ?? []).slice(0, m.references) : [];
  const input: Record<string, unknown> = { prompt: ask.prompt };
  if (images.length && m.refField) input[m.refField] = images;
  /*
   * A model that takes real pixels is given the part's real box, rounded to
   * what it will accept. That is the whole reason to prefer one for a
   * surface: no ratio in any list is the band a person actually drew.
   */
  if (m.pixels && ask.w && ask.h) {
    const fit = (n: number) => Math.max(m.pixels!.step, Math.min(m.pixels!.max, Math.round(n / m.pixels!.step) * m.pixels!.step));
    if (m.pixels.via) input[m.pixels.via.field] = m.pixels.via.value;
    input[m.pixels.widthField] = fit(ask.w);
    input[m.pixels.heightField] = fit(ask.h);
  } else {
    input.aspect_ratio = ratioFor(m, ask.w ?? 1, ask.h ?? 1, images.length > 0);
    if (m.size) input[m.size.field] = m.size.value;
  }
  input[m.format.field] = m.format.value;
  if (ask.transparent && m.alpha) input[m.alpha.field] = m.alpha.value;
  return input;
}

/**
 * The words a step is given.
 *
 * A refine is not a second guess: what came out of the first pass is
 * already the right shape in the right frame, and the job is to render
 * *that* well. So the prompt is mostly about what must not change, and the
 * words the person typed come last and quietly — on this step the picture
 * is the brief and the words are the footnote, which is the other way round
 * from a first pass, where there is no picture yet.
 */
export function wordsFor(ask: {
  step: Step;
  making: Making;
  said?: string;
  label?: string;
  transparent?: boolean;
  example?: boolean;
}): string {
  const said = (ask.said || ask.label || "").trim().slice(0, 300);
  const bits: string[] = [];
  /*
   * A solid takes no words at all. The model is handed the drawing and
   * nothing else, which is this app's rule for the drawing path — nothing
   * describes the line — and is also how these models want to be asked.
   */
  if (ask.making === "object") return "";
  if (ask.step === "refine") {
    bits.push(
      ask.example
        ? "The first two images are a before and an after: work out what was done between them and do the same thing to the last image."
        : "Redraw the image you were given at full quality.",
      "Keep its exact shape, proportions, composition and framing — every line where it is. Nothing moves, nothing is added, nothing is cropped.",
    );
  } else {
    bits.push(said || "an abstract mark");
    bits.push(
      ask.making === "surface"
        ? "filling the whole frame edge to edge as a texture, with no subject in the middle of it"
        : "filling the whole frame, edge to edge, nothing floating small in the middle",
    );
  }
  if (ask.making === "type") bits.push("The words must be set correctly and be the subject of the image.");
  bits.push("Clean edges, even weight, no sketch texture, no paper, no drop shadow, no border, no frame, no caption, no watermark, no signature.");
  if (ask.transparent) bits.push("Transparent background: the subject alone, nothing behind it.");
  if (ask.step === "refine" && said) bits.push(`It is ${said}.`);
  return bits.join(" ");
}

/**
 * What to say on the card when a step did not run.
 *
 * Never silently: the person is looking at something that was meant to be
 * replaced, and the only thing worse than not refining it is not saying so.
 */
export function noModelSays(why: NoModel | "no-key" | "failed", making: Making, detail = ""): string {
  const head =
    why === "no-key"
      ? "The better pass did not run: no Replicate token, so only the first pass happened."
      : why === "not-a-model-job"
        ? "That step is a vision read of the strokes, not an image model's job."
        : why === "nothing-serves"
          ? `The better pass did not run: no model in the table serves a ${making} at that step yet.`
          : why === "cannot-do-alpha"
            ? `The better pass did not run: a ${making} needs a transparent ground and nothing offered for it can make one.`
            : why === "cannot-take-an-image"
              ? `The better pass did not run: the models for a ${making} take words only, and this step starts from a picture.`
              : "The better pass failed, so the first pass is what is on the board.";
  // One full stop at the end, whatever the model's own message ended with.
  const said = detail.trim().replace(/[\s.]+$/, "");
  return said ? `${head} ${said}.` : head;
}
