/**
 * Where parts go on a live page.
 *
 * At the width the board was designed for, positions are the board's — the
 * frame is the truth. Narrower than that, rows reflow: each row's parts stack
 * in reading order at the device width, and a part whose layout says it is a
 * row, a column or a grid keeps its children inside it (`reflow.ts`, which
 * holds the arithmetic and is pure so a test can hold it too). This wrapper
 * knows what the arithmetic must not: which parts are behaviours and take no
 * room, and which keep their aspect when narrowed.
 */
import { getFeature } from "../shelf";
import { resolvePart } from "../shelf/ui";
import { FULL_BLEED } from "../reshape";
import type { StudioNode } from "../board/store";
import { reflow, type Placed } from "./reflow";

export { frameHeightOf, type Placed } from "./reflow";

export type Device = "desktop" | "tablet" | "phone";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, tablet: 834, phone: 390 };

/** Pictures and first screens keep their aspect; everything else grows in height as it narrows. */
function aspectBound(n: StudioNode): boolean {
  const cat = getFeature(n.featureId)?.category;
  return cat === "media" || cat === "hero";
}

export function placeNodes(all: StudioNode[], device: Device, frameWidth: number): { width: number; height: number; placed: Placed[]; reflowed: boolean } {
  // Behaviours apply to the whole page; they take no room in it.
  const nodes = all.filter((n) => resolvePart(n.featureId)?.tier !== "B");
  const target = device === "desktop" ? frameWidth : DEVICE_WIDTH[device];
  return reflow(nodes, target, frameWidth, { fullBleed: FULL_BLEED, aspectBound });
}
