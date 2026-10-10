/**
 * Which parts stand up under the page's lamp, and what shape their shadow is.
 *
 * J, 2026-10-10, after placing the light on PST: "gave every single textbox
 * its own shadow and incorrectly made round buttons each a square box for the
 * shadow". Two mistakes, both here now:
 *
 *  · Every part cast, including a line of words with nothing behind it and the
 *    invisible wrappers an import lands as. A shadow under a thing you cannot
 *    see is a grey strip floating on the page. Only something with a painted
 *    surface (a fill, an edge, a picture) stands on the page; a captured part
 *    without one is just words or layout, and casts nothing.
 *  · The shadow's corner came from the drawn `shape` alone, which an imported
 *    part never has. Its corners are in `radius` / `radii` / `radiiY`, the
 *    same numbers `boxStyle` rounds the part with, so the shadow uses them.
 *
 * One file, read by the part's own render (`NodeView`) and by the drag rig
 * (`lightRig`), so what the drag shows and what the drop leaves agree.
 */

export interface CastNode {
  featureId?: string;
  shape?: string | null;
  outline?: unknown;
  w: number;
  h: number;
  radius?: number | null;
  radii?: readonly number[] | null;
  radiiY?: readonly number[] | null;
  edge?: { width?: number; style?: string } | null;
  art?: { background?: string } | null;
  colour?: { bg?: string } | null;
  picture?: unknown;
  from?: { selector?: string } | null;
  source?: unknown;
}

/** Parts that are words, or a box round other parts, and nothing of their own. */
const BARE = new Set(["prose", "box", "heading", "checkbox"]);

const clear = (c: string) => /^(transparent|none|initial|inherit)$/i.test(c) || /rgba\([^)]*,\s*0(\.0+)?\s*\)$/i.test(c);
const painted = (c: string | null | undefined) => typeof c === "string" && !!c.trim() && !clear(c.trim());

/** Whether this part has a surface of its own the lamp can stand up. */
export function castsShadow(n: CastNode): boolean {
  if (n.outline) return false;
  const e = n.edge;
  if (e && (e.width ?? 1) > 0 && e.style !== "none") return true;
  if (painted(n.art?.background) || painted(n.colour?.bg) || n.picture) return true;
  // Captured from a site and nothing above was painted: words or a wrapper.
  if (n.from?.selector || n.source) return false;
  return !BARE.has(n.featureId ?? "");
}

const four = (r: unknown): r is number[] => Array.isArray(r) && r.length === 4 && r.every((v) => typeof v === "number" && Number.isFinite(v) && v >= 0);

/** The corner the part is cut to, as `border-radius`, so the shadow hugs it. */
export function castRadius(n: CastNode): string | number | undefined {
  if (n.shape === "circle" || n.shape === "ellipse") return "50%";
  if (four(n.radii) && n.radii.some((r) => r > 0)) {
    return n.radii.map((r) => `${r}px`).join(" ") + (four(n.radiiY) ? ` / ${n.radiiY.map((r) => `${r}px`).join(" ")}` : "");
  }
  if (typeof n.radius === "number" && Number.isFinite(n.radius) && n.radius > 0) return n.radius;
  if (n.shape === "pill") return 9999;
  if (n.shape === "rounded") return Math.min(28, Math.min(n.w, n.h) / 6);
  return undefined;
}
