import { strandEnvelope, type Point, type StrandTone, type VineEnd } from "../strand";

/**
 * Which sides two boxes face each other with: out of one, into the other,
 * and the other way round when the child ended up to the left of its
 * parent — which it will, the moment anything is dragged.
 */
/** One thing on the vine canvas: a vine, or the rim of a forming box. */
export interface Vine {
  from: Point;
  to: Point;
  tone: StrandTone;
  phase: number;
  ends: [VineEnd, VineEnd];
  box: { x: number; y: number; w: number; h: number };
  /** How much of it there is yet, 0..1. A vine into a forming box grows. */
  grow: number;
  /** Being pulled, 0..1: the pointer is on its seam and the bow comes out of it. */
  tug?: number;
  /** Being cut, 0..1: parted at the middle, the ends drawing back and crumbling. */
  cut?: number;
  /**
   * Not a vine at all: the rim of a forming box, traced round it in green
   * and then closing in. It lives in the same map because it is painted
   * by the same canvas, repainted by the same rule, and gone the same way.
   */
  rim?: { p: number; rect: { x: number; y: number; w: number; h: number }; start: Point };
}

/**
 * The cloud over the vines, kept in step with the canvas.
 *
 * A vine is painted once and its colour still moves, the way a box's does:
 * not by repainting, but by two small elements per vine over the canvas —
 * one per strand, at that strand's temperature — each clipped to its
 * strand's near side and carrying the construct's own cloud gliding on the
 * same keyframe as every box (`.molten-vine`, `molten.css`). The green cloud
 * is on the green strand and the red on the red, and the clips never
 * overlap, so no colour is ever laid over the other. This is the whole of
 * the bookkeeping: two elements per vine that exists, placed on the vine's
 * own box, their clips rewritten only when that vine's mark changed — which
 * is the same rule the canvas repaints by — and gone when the vine is. The
 * rim traces are the canvas's alone; no cloud is laid over them.
 *
 * AT REST ONLY. Measured: restyling an element whose child carries a
 * running animation costs about two milliseconds, and a drag restyles the
 * two vines on the moving board every pointer move — fifteen milliseconds
 * a move at thirty boards, which is the drag going from smooth to not. So
 * while a board is held, the cloud on its vines is lifted (one restyle) and
 * laid again when it is let go; and a vine still growing has no cloud until
 * it has grown, which is also the order the formation asks for — the vine
 * first, the weather after. `rest` says whether anything is held.
 */
export function syncLights(host: HTMLDivElement, els: Map<string, HTMLDivElement>, want: Map<string, Vine>, changed: Set<string>, rest: boolean) {
  for (const [k, el] of els) {
    const of = want.get(k.slice(0, -2));
    if (of && !of.rim && of.tone !== "cut") continue;
    el.remove();
    els.delete(k);
  }
  const period = 512;
  for (const [k, v] of want) {
    if (v.rim || v.tone === "cut") continue;
    /*
     * ONE LIGHT WHERE ONE TEMPERATURE RUNS THE LENGTH OF THE CABLE.
     *
     * There are two strands on a vine and each had its own light, because
     * green-to-red exists and a green cloud must not cross onto the red
     * strand. On a cable that is one temperature end to end — which is every
     * vine in a chain of updates, and nearly all of them — the two elements
     * were drawing the *same tile at the same phase* into complementary
     * halves of the same rope. Merging them is pixel for pixel identical and
     * halves the count.
     *
     * It matters because these are the largest painted surface a timeline
     * has: each one is the size of the whole gap between two boards, plus a
     * period for the slide, and it is clipped to a thin diagonal rope that
     * covers a twentieth of it. A clip does not save the compositor
     * anything — only geometry does, and the geometry of a diagonal is its
     * bounding box — so each light costs its whole box on every frame the
     * ground damages the viewport. At thirty boards, taking two to one
     * measured 59% of frames dropped to 50%; taking them away altogether
     * would be 39%, and that is what the other half is worth and is not for
     * sale, because the cloud on a vine is what makes it the same material
     * as the boxes.
     */
    const heats = [0, 1].map((b) => (v.ends[b] === "drawing" ? "ember" : "verdant"));
    const one = heats[0] === heats[1];
    for (const b of (one ? ["a"] : [0, 1]) as readonly (0 | 1 | "a")[]) {
      const key = `${k}#${b}`;
      let el = els.get(key);
      if (!el) {
        el = document.createElement("div");
        el.className = "molten-vine";
        el.dataset.laid = "0";
        el.appendChild(document.createElement("i"));
        host.appendChild(el);
        els.set(key, el);
      }
      if (!rest || v.grow < 1) {
        // Lifted while the vine moves or grows: one change, then nothing.
        if (el.dataset.laid !== "0") { el.dataset.laid = "0"; el.style.clipPath = "inset(100%)"; }
        continue;
      }
      if (el.dataset.laid === "1" && !changed.has(k)) continue;
      el.dataset.laid = "1";
      /*
       * The strand's temperature, as one attribute and not as `.molten`.
       * Measured: any style change on an element carrying the construct's
       * class costs close to two milliseconds of recalc — its face is a
       * stack of colour-mixed shadows and two pseudo-elements — against a
       * tenth of that for a plain one. The light needs the construct's
       * cloud, not its face, so it takes the tile by name and nothing else.
       */
      const heat = heats[b === "a" ? 0 : b];
      if (el.dataset.heat !== heat) el.dataset.heat = heat;
      const { box } = v;
      el.style.left = `${box.x}px`;
      el.style.top = `${box.y}px`;
      el.style.width = `${box.w}px`;
      el.style.height = `${box.h}px`;
      // The outline in the element's own coordinates: the same path, moved
      // by the box, because a curve does not care where its ends are.
      /* Both halves in one path when it is one light: two subpaths clip to
         their union, which is the whole rope and exactly what the two
         elements covered between them. */
      /*
       * AT THE SHAPE THE VINE IS ACTUALLY IN, tug included.
       *
       * This was called without `tug`, so the clip was always the RESTING
       * curve. That was right while `tug` was a boolean that snapped once
       * and sat still, and wrong the moment a vine became a rope: the paint
       * swings for 1.3s and the cloud stayed where it was. His words —
       * "when im hovering it now it bounces out properly but it does it
       * while leaving the texture in place because it doesnt seem to want
       * to move with it". My regression, from the commit that made it
       * bounce.
       *
       * It costs a re-clip per frame for the one vine under the hand, and
       * `changed` already had it in the set because `mark` carries `tug` —
       * so the work was being done and thrown at the old shape.
       */
      const envelope = (side: 0 | 1) => strandEnvelope(
        { x: v.from.x - box.x, y: v.from.y - box.y },
        { x: v.to.x - box.x, y: v.to.y - box.y },
        side,
        { ends: v.ends, grow: v.grow, tone: v.tone, tug: v.tug },
      );
      const d = b === "a" ? [envelope(0), envelope(1)].filter(Boolean).join(" ") : envelope(b);
      el.style.clipPath = d ? `path("${d}")` : "inset(100%)";
      // One weather across the board: every element shows the tile at the
      // phase its own place gives it, so the cloud is continuous from vine
      // to vine and from a vine to the box beside it.
      const tile = el.firstElementChild as HTMLElement | null;
      if (tile) tile.style.backgroundPositionX = `${-(((box.x % period) + period) % period)}px`;
    }
  }
}

export function ends(a: { left: number; right: number; mid: number }, b: { left: number; right: number; mid: number }): [Point, Point] {
  const backwards = b.left < a.left;
  return [
    { x: backwards ? a.left : a.right, y: a.mid },
    { x: backwards ? b.right : b.left, y: b.mid },
  ];
}
