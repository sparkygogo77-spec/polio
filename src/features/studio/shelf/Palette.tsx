"use client";
// Split by topic into ./palette/ (see its README). Re-exports keep every import working.
export { dropPoint, visibleMiddle, addFeatureToCanvas, useShelfOpen, SHELF_SHARE, SHELF_GRIP_SHARE, setShelfFolded, useShelfFolded, useShelfTall } from "./palette/shelf";
export { Palette } from "./palette/Palette";
export { ShelfGrip, onThisPage, goToPart } from "./palette/onPage";
