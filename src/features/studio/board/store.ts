"use client";
/**
 * The Studio document: what the site should be, expressed as icons, drawings
 * and per-element prompts on a canvas.
 *
 * Shape of the model:
 *   Page      an artboard / route. "Number of pages" is just this list.
 *   Node      a feature icon placed on a page, with its OWN prompt.
 *   Group     a named set of nodes, with its own prompt covering the set.
 *   Shape     freehand ink, a region frame, or an arrow linking two nodes.
 *   Format    site-wide options (see format.ts).
 *   Brief     the central gimmick and the master prompt.
 *
 * Position is meaningful: the compiler reads x/y to infer reading order,
 * containment and adjacency, so where you put something is part of the spec.
 *
 * The board module's store door. The store lives in `store/`, split by topic (see store/README.md). This file
 * re-exports what it always exported, so no import elsewhere changes.
 */
export { heldBackground, heldNodes } from "./store/board";
export { useStudio } from "./store/create";
export { holdSaves, isHeld, useSteady } from "./store/hold";
export { useHeldStudio } from "./store/heldView";
export { startGesture, gestureFrame, endGesture, gestureBase, inGesture } from "./store/gesture";
export { frameHeight, frameTopReach, FRAME_WIDTHS, placeInFrame } from "./store/frame";
export { EDIT_RUN_MS, HUES, snapshot, onBoardEdit } from "./store/history";
export { holdImportMark, takeImportMark, swapDoc, pageNodes, pageShapes, pageSpaces, pageGroups, activePage, groupBounds, shapeBounds, useStudioHydration, livePath } from "./store/load";
export { BACKGROUND_ID, BASE_ZOOM, ZOOM_MIN, FIT_MIN, ZOOM_MAX, NODE_SHAPES } from "./store/model";
export type { Tool, Priority, ShapeKind, BoardMode, ShapeRelation, NodeShape, StudioNode, StudioGroup, StudioShape, StudioPage, StudioBrief, BroughtRepo, BroughtPart, RevisionKind, Revision, TrailStage, TrailTargetKind, TrailTarget, TrailEntry } from "./store/model";
export { takeCarriedRepo } from "./store/persist";
export { DRAW_KINDS, type DrawKind } from "../drawKinds";
