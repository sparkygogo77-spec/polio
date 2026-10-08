"use client";
/**
 * Generate: make the surface a space describes.
 *
 * The create flow ends here. A boundary was drawn and became a black hole;
 * things were drawn inside it, each with its own prompt; now the lot is
 * made. Two things happen, and the order matters:
 *
 *   1. **Every drawing inside is queued as itself**, with its own words,
 *      through the same door a drawing on the bare page goes through
 *      (`enqueueDraw`). The part that lands does so where the drawing was,
 *      at the size it was drawn (`store.addNode` puts it inside the space,
 *      and the space's plan reaches it there). No second run, no second
 *      reader: the machinery that makes one element makes each of these.
 *   2. **The surface forms** on the timeline's own driver as they land
 *      (`SpaceForming` in the layer, `formFromJobs`), and when the last one
 *      has, the layout is **locked**: every element's rect kept as a share
 *      of the boundary, so the surface can be moved and resized as one
 *      thing and its contents keep the proportions they were drawn in.
 *
 * A space with parts already in it and nothing left to draw locks at once.
 * A space with nothing in it at all has nothing to make, and says so.
 *
 * Nothing here calls a model. What calls a model is the queue, one job at a
 * time, exactly as before; this only decides what goes on it.
 */
import { describeSketch } from "./sketch";
import { nameFrom, pictureOf } from "./reshapeRun";
import { inkGroups } from "./inkGroups";
import { QUEUED } from "./formation";
import { jobsInSpace, nodeInSpace, spaceOfDrawing, type Placed, type Space } from "./space";
import { useStudio } from "./board/store";

export interface Generated {
  /** How many drawings went on the queue. */
  queued: number;
  /** How many parts were already inside, and are part of the surface. */
  had: number;
  /** What happened, in a line. */
  did: string;
}

/**
 * Everything drawn inside the space goes on the queue, each as itself.
 *
 * Mirrors the ink door's own `makeInkReal` stroke for stroke, because the
 * whole point is that a drawing inside a space is made the same way a
 * drawing anywhere is — only with the space's plan reaching it when it
 * lands. Strokes are normalised against the drawing's box, not the
 * space's: the part is the drawing, and the space is where it sits.
 */
export function generateSurface(spaceId: string): Generated {
  const s = useStudio.getState();
  const space = s.spaces.find((sp) => sp.id === spaceId);
  if (!space) return { queued: 0, had: 0, did: "no such space" };
  const now = Date.now();

  const drawings = inkGroups(s.shapes.filter((sh) => sh.kind === "pen" && sh.pageId === space.pageId))
    .filter((g) => spaceOfDrawing([space], { pageId: space.pageId, bounds: g.bounds }, now)?.id === space.id);
  const had = s.nodes.filter((n) => nodeInSpace(space, n)).length;

  if (!drawings.length && !had) return { queued: 0, had: 0, did: "nothing in it yet: draw something inside the line first" };

  for (const g of drawings) {
    const b = g.bounds;
    if (b.w < 2 && b.h < 2) continue;
    const w = Math.max(b.w, 1);
    const h = Math.max(b.h, 1);
    const inGroup = s.shapes.filter((x) => g.strokeIds.includes(x.id));
    const strokes = inGroup.map((x) => x.points.map(([px, py]) => [(px - b.x) / w, (py - b.y) / h] as [number, number]));
    // The drawing's own words: what this one element is for.
    const words = inGroup.map((x) => (x.label || x.prompt || "").trim()).filter(Boolean).join(" ");
    const drawn = { strokes, words };
    useStudio.getState().enqueueDraw({
      nodeId: null,
      at: { x: b.x + b.w / 2, y: b.y + b.h / 2 },
      frameWidth: s.frameWidth,
      sketch: drawn,
      picture: pictureOf(strokes),
      drawn: { w: b.w, h: b.h },
      quiet: true,
      label: `Making ${nameFrom(words) || describeSketch({ strokes, words: "" })}`,
    });
    useStudio.getState().removeShapes(g.strokeIds);
  }

  // It is forming from this moment: a surface asked for exists.
  useStudio.getState().formSpace(space.id, QUEUED);
  if (!drawings.length) lockNow(space.id);

  const n = drawings.length;
  return {
    queued: n,
    had,
    did: n
      ? `${n} drawing${n === 1 ? "" : "s"} on the queue${had ? `, ${had} part${had === 1 ? "" : "s"} already in` : ""}; the surface forms as they land`
      : `${had} part${had === 1 ? "" : "s"} locked where they were drawn`,
  };
}

/** Lock the layout from whatever is inside now, and finish forming. */
export function lockNow(spaceId: string): void {
  const s = useStudio.getState();
  const space = s.spaces.find((sp) => sp.id === spaceId);
  if (!space) return;
  const placed: Placed[] = s.nodes
    .filter((n) => nodeInSpace(space, n))
    .map((n) => ({ id: n.id, x: n.x, y: n.y, w: n.w, h: n.h, label: n.label, prompt: n.prompt }));
  s.lockSpace(space.id, placed);
  s.formSpace(space.id, 1);
}

/**
 * Is the surface still being made? True while any job that belongs to it
 * is on the queue and not over.
 */
export function stillMaking(space: Space): boolean {
  const q = useStudio.getState().queue;
  return jobsInSpace(q, space).some((j) => j.status === "waiting" || j.status === "running" || j.status === "asking");
}
