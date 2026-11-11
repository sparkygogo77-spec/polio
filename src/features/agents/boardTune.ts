/**
 * The Agents board's Tune schema (Orbs 2, piece D): every slider the drawer
 * shows for the board, grouped as J asked (orientation, order, size,
 * texture, lighting, speeds, motion). Pure; `LanesBoard.tsx` reads the values.
 */
import type { TuneSchema } from "../../core/ui/tune/tune";

export const TEXTURE_SETS = [
  { value: "glass", label: "Glass" },
  { value: "planet", label: "Planet bands" },
  { value: "marble", label: "Marble" },
] as const;
export type TextureSet = (typeof TEXTURE_SETS)[number]["value"];

export const BOARD_TUNE: TuneSchema = {
  id: "agents-board",
  label: "Agents board",
  groups: [
    { id: "orientation", label: "Orientation", controls: [
      { key: "tilt", label: "Tilt", kind: "slider", min: 0, max: 70, step: 1, value: 22, unit: "°" },
      { key: "axis", label: "Spin axis", kind: "slider", min: -180, max: 180, step: 1, value: 0, unit: "°" },
    ] },
    { id: "order", label: "Order", controls: [
      { key: "order", label: "Order on a ring", kind: "choice", value: "coordinator", options: [{ value: "coordinator", label: "As the coordinator lists them" }, { value: "state", label: "By state" }, { value: "age", label: "By age" }] },
    ] },
    { id: "size", label: "Size", controls: [
      { key: "orb", label: "Orb", kind: "slider", min: 0.6, max: 1.6, step: 0.05, value: 1, unit: "×" },
      { key: "ring", label: "Ring", kind: "slider", min: 0.4, max: 2, step: 0.05, value: 1, unit: "×" },
    ] },
    { id: "texture", label: "Texture", controls: [
      { key: "texture", label: "Texture set", kind: "choice", value: "glass", options: TEXTURE_SETS.map((t) => ({ value: t.value, label: t.label })) },
    ] },
    { id: "lighting", label: "Lighting", controls: [
      { key: "key", label: "Key light", kind: "slider", min: 0, max: 1.5, step: 0.05, value: 1 },
      { key: "rim", label: "Rim", kind: "slider", min: 0, max: 1.5, step: 0.05, value: 0.6 },
      { key: "glow", label: "Glow", kind: "slider", min: 0, max: 1.5, step: 0.05, value: 1 },
    ] },
    { id: "speeds", label: "Speeds", controls: [
      { key: "orbit", label: "Orbit", kind: "slider", min: 0, max: 3, step: 0.05, value: 1, unit: "×" },
      { key: "spin", label: "Spin", kind: "slider", min: 0, max: 3, step: 0.05, value: 1, unit: "×" },
    ] },
    { id: "motion", label: "Motion", controls: [
      { key: "gravity", label: "Gravity", kind: "slider", min: 0.1, max: 3, step: 0.05, value: 1 },
      { key: "drag", label: "Resistance", kind: "slider", min: 0.1, max: 3, step: 0.05, value: 1 },
      { key: "bounce", label: "Bounce", kind: "slider", min: 0, max: 1, step: 0.05, value: 0.5 },
      { key: "settle", label: "Settle time", kind: "slider", min: 0.2, max: 3, step: 0.05, value: 0.9, unit: "s" },
    ] },
  ],
};

export interface BoardLook {
  tilt: number; axis: number; order: "coordinator" | "state" | "age"; orb: number; ring: number; texture: TextureSet;
  key: number; rim: number; glow: number; orbit: number; spin: number; gravity: number; drag: number; bounce: number; settle: number;
}
