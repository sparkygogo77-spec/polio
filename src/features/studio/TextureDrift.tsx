"use client";
/**
 * The keyframes a drifting texture moves on.
 *
 * A stack that drifts animates one property — `background-position` — and that
 * property holds a place for *every* layer in the stack at once. So there is
 * no fixed rule that could live in the stylesheet: the distances are the
 * stack's, they change when the stack changes, and they all have to be listed
 * together. This writes them out, and nothing else.
 *
 * Mounted wherever a texture is painted and allowed to move: the board and the
 * live site. The name is a hash of the distances, so a stack that has not
 * changed keeps its animation running rather than restarting it on every
 * keystroke somewhere else in the panel.
 */
import * as React from "react";
import { driftKeyframes, type Palette, type TextureLayer } from "./look";

export function TextureDrift({ layers, palette }: { layers: TextureLayer[] | undefined; palette: Palette }) {
  const kf = React.useMemo(() => (layers?.length ? driftKeyframes(layers, palette) : null), [layers, palette]);
  if (!kf) return null;
  return <style>{kf.css}</style>;
}
