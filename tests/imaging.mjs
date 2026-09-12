/**
 * Which model draws this, and at which step.
 *
 * The table routes on two questions — what is being made, and which step of
 * making it — and a model earns a cell by declaring it. What is checked here
 * is that the routing is honest about what the rows actually say:
 *
 *   · a step that starts from a picture never reaches a text-only model;
 *   · a thing that needs a transparent ground never reaches one that cannot
 *     make one;
 *   · reading a drawing is refused rather than handed to a drawing model;
 *   · a cell with nobody in it says which of those it was;
 *   · and the input built for a model only uses fields its own row declares.
 *
 * Every row in the table was read off the model's published schema, so the
 * schemas are pinned here too: if a row drifts from what was verified, this
 * fails rather than a card quietly telling somebody a wrong thing.
 *
 *   node tests/imaging.mjs
 */
import { readFileSync } from "node:fs";
import {
  ALPHA_FIRST,
  MAKINGS,
  MODELS,
  STEPS,
  inputFor,
  makingOf,
  model,
  needsAlpha,
  noModelSays,
  ratioFor,
  route,
  wordsFor,
} from "../src/features/studio/imageRoute.ts";

const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "  ok  " : " FAIL "} ${name}${detail ? ` — ${detail}` : ""}`);
};

/* ------------------------------------------------------------------ */
/* 1. The table says what the schemas say                              */
/* ------------------------------------------------------------------ */

/**
 * Pinned from `replicate.com/<slug>/api/schema`, read rather than assumed.
 * Three of these contradict what the table was briefed with, and the rows
 * say so in their own notes.
 */
const SCHEMA = {
  "google/nano-banana-2": { alpha: false, refs: 14, refField: "image_input", keepFrame: true, widest: "8:1" },
  "bytedance/seedream-5-lite": { alpha: false, refs: 14, refField: "image_input", keepFrame: true, widest: "21:9" },
  "openai/gpt-image-2": { alpha: true, refs: 10, refField: "input_images", keepFrame: false, widest: "16:9" },
  "openai/gpt-image-1.5": { alpha: true, refs: 10, refField: "input_images", keepFrame: false, widest: "3:2" },
  "prunaai/p-image-ideogram": { alpha: false, refs: 0, refField: null, keepFrame: false, widest: "16:9" },
};

for (const [slug, said] of Object.entries(SCHEMA)) {
  const m = model(slug);
  check(`${slug}: in the table`, !!m);
  if (!m) continue;
  check(`${slug}: transparency matches the schema`, (m.alpha !== false) === said.alpha,
    m.alpha === false ? "cannot" : `via ${m.alpha.field}: ${m.alpha.value}`);
  check(`${slug}: reference images match the schema`, m.references === said.refs && m.refField === said.refField,
    `${m.references} in ${m.refField ?? "nowhere"}`);
  check(`${slug}: keeping the input frame matches the schema`, !!m.keepFrame === said.keepFrame);
  const wide = m.ratios.reduce((a, b) => {
    const r = (v) => Number(v.split(":")[0]) / Number(v.split(":")[1]);
    return r(b) > r(a) ? b : a;
  });
  check(`${slug}: the widest ratio it offers is ${said.widest}`, wide === said.widest, wide);
}
check("gpt-image-2 is recorded as able to do transparency, which it was briefed as unable to do",
  model("openai/gpt-image-2").alpha !== false
  && /briefed here as unable to do transparency/.test(model("openai/gpt-image-2").also ?? ""));
check("the three-ratio list is recorded against gpt-image-1.5, not gpt-image-2",
  model("openai/gpt-image-1.5").ratios.length === 3 && model("openai/gpt-image-2").ratios.length > 3);
check("ideogram is recorded as able to output png, which it was briefed as jpg only",
  model("prunaai/p-image-ideogram").format.value === "png"
  && /jpg out/.test(model("prunaai/p-image-ideogram").also ?? ""));

/* ------------------------------------------------------------------ */
/* 2. The table is consistent with itself                              */
/* ------------------------------------------------------------------ */

for (const m of MODELS) {
  for (const [step, kinds] of Object.entries(m.serves)) {
    check(`${m.slug}: does not claim a step that does not exist (${step})`, STEPS.includes(step));
    for (const k of kinds) check(`${m.slug}: ${step} names a real kind (${k})`, MAKINGS.includes(k));
    if (step === "refine") {
      check(`${m.slug}: claims refine and can actually take a picture`, m.references > 0 && !!m.refField);
    }
    for (const k of kinds) {
      if (needsAlpha(k)) {
        check(`${m.slug}: claims ${k}, which needs a transparent ground, and can make one`, m.alpha !== false,
          m.alpha === false ? "it cannot — routing will refuse it" : "");
      }
    }
  }
}
check("the named alpha-first model really can do alpha", model(ALPHA_FIRST)?.alpha !== false);
check("no two rows are the same model", new Set(MODELS.map((m) => m.slug)).size === MODELS.length);
check("nothing in the table computes with a price", (() => {
  /*
   * A row may *note* a published price — one of them has one and it is
   * worth writing down — but nothing may price a call against it, because
   * Replicate publishes no rate for most of these and a made-up number on
   * a card is worse than a card that says the cost was not reported. So
   * the notes and the comments come out and what is left must have no
   * money in it at all.
   */
  const code = readFileSync("src/features/studio/imageRoute.ts", "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*/g, "")
    .replace(/also:[\s\S]*?",\n/g, "");
  return !/\$\d|price|\bcost\b/.test(code);
})());

/* ------------------------------------------------------------------ */
/* 3. The two axes actually route                                      */
/* ------------------------------------------------------------------ */

check("reading a drawing is refused rather than given to a model that draws", (() => {
  const r = route({ making: "icon", step: "read" });
  return r.model === null && r.why === "not-a-model-job";
})());
check("a 3D object has nobody yet, and says so rather than getting a picture of one", (() => {
  const r = route({ making: "object", step: "first" });
  return r.model === null && r.why === "nothing-serves";
})());
check("text only: a refine never reaches the model with no input image field", (() => {
  const r = route({ making: "type", step: "refine", fromImage: true });
  return r.model?.slug !== "prunaai/p-image-ideogram";
})(), `${route({ making: "type", step: "refine", fromImage: true }).model?.slug ?? route({ making: "type", step: "refine", fromImage: true }).why}`);
check("…and the reason given is that those models take words only",
  route({ making: "type", step: "refine", fromImage: true }).why === "cannot-take-an-image"
  || route({ making: "type", step: "refine", fromImage: true }).why === "nothing-serves");
check("type at the first step goes to the typography model",
  route({ making: "type", step: "first" }).model?.slug === "prunaai/p-image-ideogram");
check("a mark goes to a model that can leave the ground out", (() => {
  const m = route({ making: "icon", step: "refine", fromImage: true }).model;
  return !!m && m.alpha !== false;
})(), `${route({ making: "icon", step: "refine", fromImage: true }).model?.name}`);
check("a mark goes to the named alpha-first model when it serves the cell",
  route({ making: "icon", step: "refine", fromImage: true }).model?.slug === ALPHA_FIRST);
check("a surface goes to the model with the widest frames, and is not asked for alpha it does not need", (() => {
  const r = route({ making: "surface", step: "refine", fromImage: true });
  return r.model?.slug === "google/nano-banana-2";
})(), `${route({ making: "surface", step: "refine", fromImage: true }).model?.name}`);
check("a picture goes to the widest-framed model first",
  route({ making: "picture", step: "refine", fromImage: true }).model?.slug === "google/nano-banana-2");
check("a preference is honoured when that model serves the cell",
  route({ making: "picture", step: "refine", fromImage: true, prefer: "bytedance/seedream-5-lite" }).model?.slug === "bytedance/seedream-5-lite");
check("…and ignored when it does not, rather than sending a job somewhere it cannot go",
  route({ making: "picture", step: "refine", fromImage: true, prefer: "prunaai/p-image-ideogram" }).model?.slug !== "prunaai/p-image-ideogram");
check("an example pair is used only by a model that says it can learn from one", (() => {
  const withPair = route({ making: "picture", step: "refine", fromImage: true, example: true, prefer: "bytedance/seedream-5-lite" });
  const without = route({ making: "picture", step: "refine", fromImage: true, example: true, prefer: "google/nano-banana-2" });
  return withPair.usedExample === true && without.usedExample === false;
})());

/* ------------------------------------------------------------------ */
/* 4. What is being made is worked out, not asked for                  */
/* ------------------------------------------------------------------ */

check("an icon role is a mark", makingOf({ role: "icon" }) === "icon");
check("a motion path is routed as a mark, because a line wants the same alpha and the same edges",
  makingOf({ role: "motion" }) === "icon");
check("a drawn frame routes as a mark, because it is a mark with a hole in it and needs the ground left out",
  makingOf({ role: "surface" }) === "icon");
check("a wide raster ground routes as a surface", makingOf({ kind: "raster", role: "x", w: 1600, h: 400 }) === "surface");
check("a part that says it is the ground routes as a surface", makingOf({ kind: "raster", ground: true }) === "surface");
check("a part with no role yet is treated as a mark, which cannot land a filled rectangle",
  makingOf({ role: null }) === "icon");
check("an ordinary raster body is a picture", makingOf({ kind: "raster", role: "x", w: 400, h: 300 }) === "picture");
check("real text in it beats everything else", makingOf({ role: "icon", hasText: true }) === "type");
check("only a mark needs a transparent ground — a surface is the ground",
  needsAlpha("icon") && !needsAlpha("surface") && !needsAlpha("picture") && !needsAlpha("type"));

/* ------------------------------------------------------------------ */
/* 5. The box is built from the row and nothing else                   */
/* ------------------------------------------------------------------ */

const nano = model("google/nano-banana-2");
const ideo = model("prunaai/p-image-ideogram");
const gpt2 = model("openai/gpt-image-2");

check("a model that keeps the input frame is told to, when there is a picture going in",
  inputFor(nano, { prompt: "x", images: ["data:image/png;base64,AA"], w: 400, h: 100 }).aspect_ratio === "match_input_image");
check("…and gets the nearest real ratio when there is not", (() => {
  const got = inputFor(nano, { prompt: "x", w: 2100, h: 900 }).aspect_ratio;
  return got === "21:9";
})(), `${inputFor(nano, { prompt: "x", w: 2100, h: 900 }).aspect_ratio}`);
check("a very wide band gets a very wide ratio rather than being cropped out of 3:2",
  ratioFor(nano, 1600, 200, false) === "8:1", ratioFor(nano, 1600, 200, false));
check("a model that takes real pixels gets the part's own box, rounded to what it accepts", (() => {
  const got = inputFor(ideo, { prompt: "x", w: 1001, h: 250 });
  return got.aspect_ratio === "custom" && got.width === 1008 && got.height === 256 && got.output_format === "png";
})(), JSON.stringify(inputFor(ideo, { prompt: "x", w: 1001, h: 250 })));
check("…and is never given a pixel size past what it accepts",
  inputFor(ideo, { prompt: "x", w: 9000, h: 9000 }).width === 2560);
check("a text-only model is never handed images, whatever it is given",
  inputFor(ideo, { prompt: "x", images: ["data:image/png;base64,AA"], w: 100, h: 100 }).image_input === undefined);
check("transparency is only asked for from a model that has the field",
  inputFor(gpt2, { prompt: "x", w: 1, h: 1, transparent: true }).background === "transparent"
  && inputFor(nano, { prompt: "x", w: 1, h: 1, transparent: true }).background === undefined);
check("only the reference count the row declares is sent", (() => {
  const many = Array.from({ length: 20 }, (_, i) => `data:image/png;base64,${i}`);
  return inputFor(gpt2, { prompt: "x", images: many, w: 1, h: 1 }).input_images.length === 10;
})());

/* ------------------------------------------------------------------ */
/* 6. Words, and the sentence a card gets when nothing ran             */
/* ------------------------------------------------------------------ */

check("a refine is told what must not change, and the words come last",
  /Keep its exact shape/.test(wordsFor({ step: "refine", making: "picture", said: "a gull" }))
  && wordsFor({ step: "refine", making: "picture", said: "a gull" }).indexOf("a gull") > 40);
check("a first pass leads with what the thing is",
  wordsFor({ step: "first", making: "picture", said: "a gull" }).startsWith("a gull"));
check("a surface is asked for a texture rather than a subject in the middle",
  /no subject in the middle/.test(wordsFor({ step: "first", making: "surface", said: "bark" })));
check("something with type in it is told the words are the subject",
  /words must be set correctly/.test(wordsFor({ step: "first", making: "type", said: "SALE" })));
check("nothing anywhere asks for a border, a caption or a watermark",
  /no border, no frame, no caption, no watermark/.test(wordsFor({ step: "first", making: "picture" })));
for (const why of ["no-key", "not-a-model-job", "nothing-serves", "cannot-do-alpha", "cannot-take-an-image", "failed"]) {
  const said = noModelSays(why, "icon");
  check(`a card gets a sentence when the pass did not run (${why})`, said.length > 20 && said.endsWith("."));
}
check("the card is never told the pass simply did not happen, without a reason",
  !noModelSays("nothing-serves", "object").endsWith("run."));

/* ------------------------------------------------------------------ */
/* 7. The route and the client only reach it through the table         */
/* ------------------------------------------------------------------ */

const routeSrc = readFileSync("src/app/api/studio/image/route.ts", "utf8");
const runSrc = readFileSync("src/features/studio/refineRun.ts", "utf8");
const table = readFileSync("src/features/studio/imageRoute.ts", "utf8");
const slugs = MODELS.map((m) => m.slug);
check("no model slug is written anywhere but the table",
  slugs.every((s) => !routeSrc.includes(s) && !runSrc.includes(s)));
check("the route asks both questions rather than picking a model",
  /makingOf\(/.test(routeSrc) && /route\(\{ making, step: "refine"/.test(routeSrc));
const refineSrc = (routeSrc.split("async function refine")[1] ?? "").split("export async function POST")[0] ?? "";
check("what a pass cost is read off the prediction rather than a price list",
  /predictions\.create\(/.test(routeSrc) && /fromMetrics\(/.test(refineSrc) && !/RENDER_COST/.test(refineSrc));
check("a second pass never fails the render",
  // Every exit from it is an answer the caller can show.
  refineSrc.includes("ok: false, stage: 2") && !/throw /.test(refineSrc));
check("adding a model is one entry: every cell the route asks for is answered by the table alone",
  MAKINGS.every((k) => STEPS.every((st) => {
    const r = route({ making: k, step: st, fromImage: st === "refine" });
    return (r.model === null) !== (r.why === undefined);
  })));
check("the table says it was read off the published schemas rather than a datasheet",
  /replicate\.com\/<slug>\/api\/schema/.test(table));

const passed = results.filter(Boolean).length;
console.log(`\nall good — ${passed}/${results.length}`);
process.exit(passed === results.length ? 0 : 1);
