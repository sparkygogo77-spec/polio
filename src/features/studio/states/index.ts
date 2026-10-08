/* The states module's front door: the only file other modules import for states logic. Screens and anything that needs the board store or React are in ./ui.ts.
 * Pure rules: no React, no store, every import ends in .ts, so node tests can load it. Named re-exports (not export *) so an import cycle still sees every name. See README.md. */
export { boardShows, captureFit, facePlaces, groupHook, hiddenGroups, hookedHolders, inDetails, linedParts, overlayAdds, partPlaces, partSteps, partUnder, partsInside, runsAsShown, screenDraws, screenKey, screenLooks, screenPlaces, screensOfPart, stepLook, steppedParts, topKey } from "./boardStates.ts";
export type { PartStep, PlaceBox, ScreenRead, StateNode, StepLook } from "./boardStates.ts";
export { clampMove, frameFor, frameRiders, inside, keepInFrame, liftToFrame, plainName, readStepKey, seatStates, spills, stateFrames, stepData, stepKey } from "./stateFrames.ts";
export type { Box, FrameNode, FramesRead, StateFrame, StateStep } from "./stateFrames.ts";
export { declaredPagePanels, drawnWith, foldScenes, followsStateRules, isPageState, labelsOf, panelDecides, panelKey, partsChanged, readDeclared, readPanelKey, readSamples, readScenes, samplesFor, sceneScreens, stateIn, stateRuleNotes, statesOfPart, wordShape } from "./stateRules.ts";
export type { Declared, DeclaredPanel, DeclaredScene, RuleNode, Samples, SceneScreen } from "./stateRules.ts";
export { checkIn, checkOut, groupTwins, readStateEditKey, stateEditKey } from "./stateEdits.ts";
export type { CheckedOut } from "./stateEdits.ts";
export { allVariants, momentOf, nearlySame, pageScenes, sameLayout } from "./scenes.ts";
export type { PageScenes, Scene, SceneVariant } from "./scenes.ts";
export { drawnIn, pagePanels, panelDrawing } from "./panels.ts";
export type { Panel, PanelNode, PanelState } from "./panels.ts";
export { ISOLATE, isolateKey, panelsOfPage, readIsolateKey } from "./panelsOf.ts";
export type { PanelSource } from "./panelsOf.ts";
export { spotlight } from "./panelSpotlight.ts";
export { findItem, layoutDeclarations, moveToRegion, regionKey, regionList, regionMoves, reorder, restack, structureOf } from "./structure.ts";
export type { RegionMove, StructureItem, StructureNode } from "./structure.ts";
export { showPreviews, stateLooksIn } from "./show.ts";
export type { OnTop, Preview } from "./show.ts";
