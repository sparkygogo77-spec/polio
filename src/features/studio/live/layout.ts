/**
 * Where parts go on a live page.
 *
 * At the width the board was designed for, positions are the board's — the
 * frame is the truth. Narrower than that, rows reflow: each row's parts stack
 * in reading order at the device width, heights kept.
 */
import { getFeature } from "../catalog";
import type { StudioNode } from "../store";
import { toRows } from "../spec";

export type Device = "desktop" | "tablet" | "phone";
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1440, tablet: 834, phone: 390 };

export interface Placed {
  node: StudioNode;
  x: number;
  y: number;
  w: number;
  h: number;
}

export function frameHeightOf(nodes: StudioNode[], min = 900): number {
  const bottom = nodes.reduce((m, n) => Math.max(m, n.y + n.h), 0);
  return Math.max(min, bottom + 160);
}

export function placeNodes(nodes: StudioNode[], device: Device, frameWidth: number): { width: number; height: number; placed: Placed[]; reflowed: boolean } {
  const target = device === "desktop" ? frameWidth : DEVICE_WIDTH[device];
  if (target >= frameWidth) {
    return {
      width: frameWidth,
      height: frameHeightOf(nodes),
      placed: nodes.map((n) => ({ node: n, x: n.x, y: n.y, w: n.w, h: n.h })),
      reflowed: false,
    };
  }
  const gap = 12;
  const placed: Placed[] = [];
  let y = gap;
  for (const row of toRows(nodes)) {
    for (const n of row) {
      const full = n.w >= frameWidth - 1;
      const w = full ? target : Math.min(n.w, target - gap * 2);
      // Pictures keep their aspect; everything else keeps its height and lets text wrap.
      const cat = getFeature(n.featureId)?.category;
      const aspectBound = cat === "media" || cat === "hero";
      const h = aspectBound && n.w > target ? Math.round(n.h * Math.min(1, target / n.w) * 1.15) : n.h;
      placed.push({ node: n, x: full ? 0 : Math.round((target - w) / 2), y: full && placed.length === 0 ? 0 : y, w, h });
      y = (full && placed.length === 1 ? 0 : y) + h + gap;
    }
  }
  return { width: target, height: Math.max(y + gap, 320), placed, reflowed: true };
}
