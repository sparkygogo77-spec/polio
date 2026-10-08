/* The pictures module's pure door: the image route (which model makes a picture), the picture store, remaking a part's picture, and sketches. No React, no store, every import ends in .ts, so node tests load it.
 * Drawing a sketch into parts (bundler imports) is behind ./run.ts; the Pictures panel and the drawing board behind ./ui.ts. Named re-exports (not export *) so an import cycle still sees every name. See README.md. */
export { ALPHA_FIRST, MAKINGS, MAKING_MEANS, MODELS, STEPS, effortField, formatFor, groundingFor, inputFor, isSolid, makingOf, model, modelTable, modelsFor, needsAlpha, noModelSays, optionsFor, ratioFor, route, saysSolid, wordsFor } from "./imageRoute.ts";
export type { Field, ImageModel, Making, ModelCard, ModelField, Need, NoModel, Routed, Step } from "./imageRoute.ts";
export { base64, bytesFor, drop, held, keep, keepAll, put, reach, seesThrough, urlFor, usePicture } from "./pictures.ts";
export type { Picture } from "./pictures.ts";
export { DEFAULT_REMAKE_MODEL, KEEP_VERSIONS, REMAKE_MODELS, REMAKE_MODEL_SETTING, askSize, coverCrop, modelLabel, pickModel } from "./remake.ts";
export { BOUNDARY_SHARE, CLIP_STROKE, PART_MAX_H, TAP_SIZE, aspectWords, boxAspect, describeBoundary, describeSketch, discLanding, fitToSketch, isBlankSketch, isTap, normaliseSketch, outlinePath, outlineShape, readBoundary, readSketch, refineStroke, sketchBox, sketchToText, smoothStroke, snapStroke, strokeClosed, tidyStroke } from "./sketch.ts";
export type { Boundary, BoundaryShape, DrawMode, OutlineClip, Sketch, SketchBox, SketchPoint, SketchReading, SnapKind } from "./sketch.ts";
