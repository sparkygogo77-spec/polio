"use client";
/**
 * The board.
 *
 * A page frame sits at the origin — it IS the website's viewport, at the width
 * you pick — and parts render inside it as what they'll be, at the size
 * they'll be. Space outside the frame is scratch. Nothing "slips to fit":
 * where a part sits and how big it is in the frame is the specification.
 *
 * Drag snaps to the frame's edges and centre and to other parts' edges, with
 * guide lines while it happens. Tools: select, pen, region, arrow, erase, pan.
 *
 * The board lives in `canvas/`, split by topic (see canvas/README.md). This
 * file re-exports what it always exported, so no import elsewhere changes.
 */
export { Canvas } from "./canvas/DesktopCanvas";
export { isChain } from "./canvas/ShapeView";
