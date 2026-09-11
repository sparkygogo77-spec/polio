"use client";
/**
 * The weather, and the difference between moving and being redrawn.
 *
 * Both the workspace behind the page and the timeline's own floor stand on
 * the same dark matter, and both used to *repaint* it to move it: the clouds
 * every 420ms onto a half-resolution canvas, the embers thirty times a
 * second. The page loop was never the problem — measured on the live Builder
 * it ran at 385fps with a 1.4ms median — but the cloud layer's own content
 * changed 2.5 times a second, and 2.5 times a second is what an eye reads as
 * the nebula's frame rate. Slow motion redrawn that rarely judders, which is
 * worse than the hitch it was meant to cure.
 *
 * So the clouds are not redrawn to move any more. They move.
 *
 *  · **One field, painted bigger than the box.** All four cloud layers
 *    (`CLOUD_LAYERS`) are screened together onto one canvas, oversized by a
 *    margin holding about a dozen seconds of drift — small, because the
 *    compositor pays for the layer's size every frame and a recycle costs
 *    four frames of one pattern fill every twelve seconds.
 *  · **A transform every frame.** `translate3d`, which the compositor does
 *    without touching the page: no layout, no paint, no main-thread raster.
 *  · **A repaint only when the material runs out** — or on a resize, or when
 *    the distance changes. The offset the paint bakes in is snapped to a
 *    whole backing pixel and the transform hands back the remainder, so a
 *    recycle is the same pixels in the same place and there is nothing to
 *    see. It is laid one layer to a frame, so the one moment this file does
 *    real work still fits inside a frame.
 *  · **The sky does not move at all**, so it is not on a canvas that does:
 *    the ground gradient is one CSS `radial-gradient` on a div.
 *
 * **One field at half resolution is a decision, not a default.** A canvas
 * each would let the four layers keep their own headings and their own slow
 * turns, which is the look this had before the speed pass and is prettier:
 * the bloom where they cross goes on shifting. It was built, and it was
 * measured, and on a machine with no GPU it holds 13.9fps against this
 * one's 60. So the screening is done inside the canvas, once, and what the
 * compositor is given is one plain texture to slide, with
 * `CloudLayer.carries` naming the layer whose heading the field takes.
 *
 * That trade was put to J with the numbers and he chose this. The other one
 * is not lost: it is at `docs/shelf/nebula-four-layers.patch` with the whole
 * measurement beside it. Two things to know before touching any of this.
 * The container these numbers came from **rasterises in software**, so they
 * are a floor rather than a verdict — a graphics card may well hold 60 with
 * four layers, and that is the condition under which the shelf gets opened.
 * And the *original* held 60 only because its layer never moved: the canvas
 * was repainted 2.4 times a second and its transform changed on 0 of 241
 * frames. A frame rate about this ground is meaningless without the
 * companion number, which is how many frames the layer moved on.
 *
 * The embers are untouched: their own canvas at the box's own size, thirty
 * times a second, which is what a streak needs. The drag pause is kept and
 * is now a held clock rather than a skipped frame, so letting go of the
 * board no longer jumps the weather forward by however long the drag was.
 */
import * as React from "react";
import {
  CLOUD_LAYERS,
  DRIFT_MS,
  fieldDrift,
  paintCloudField,
  paintDarkMatter,
  resizeField,
  skyGradient,
  sparkField,
  type SparkField,
} from "./darkMatter";

/** How often the embers are redrawn. */
export const SPARK_MS = DRIFT_MS;

/** The clouds' backing store, as a share of the box. Soft things do not need pixels. */
const CLOUD_SCALE = 0.5;

/**
 * How long the painted material should last before the field needs more.
 *
 * Raising it costs compositing: the canvas is oversized by the field's own
 * speed times this, and the compositor samples the whole layer every frame,
 * so forty seconds of a 7.4px/s cloud is 300px of margin each way and
 * measurably more late frames on a machine with no GPU. Lowering it costs
 * only how often the recycle runs — four frames of one pattern fill — and a
 * recycle cannot be seen. So it is set low: a dozen seconds of material, and
 * a recycle nobody will ever notice.
 */
const REFRESH_S = 12;
/** A little room either way even on an axis that barely moves, for a resize. */
const MARGIN_MIN = 48;
/** And no more room than this, whatever the arithmetic says. */
const MARGIN_MAX = 320;

/** How much material one axis needs, in CSS pixels, for a field going this fast. */
export function marginFor(v: number): number {
  return Math.round(Math.max(MARGIN_MIN, Math.min(MARGIN_MAX, Math.abs(v) * REFRESH_S)));
}

/** How long that material lasts, in seconds. For the tests, and for the comment above. */
export function refreshEvery(): number {
  const { vx, vy } = fieldDrift();
  const x = Math.abs(vx) > 0.001 ? marginFor(vx) / Math.abs(vx) : Infinity;
  const y = Math.abs(vy) > 0.001 ? marginFor(vy) / Math.abs(vy) : Infinity;
  return Math.min(x, y);
}

/** True while the hand is down on the board: the weather holds where it is. */
const dragging = () => typeof document !== "undefined" && document.documentElement.dataset.boardDrag === "1";

export function useGround(
  host: React.RefObject<HTMLDivElement | null>,
  clouds: React.RefObject<HTMLDivElement | null>,
  spark: React.RefObject<HTMLCanvasElement | null>,
  dim: number,
) {
  React.useEffect(() => {
    const box = host.current;
    const holder = clouds.current;
    const sp = spark.current;
    if (!box || !holder || !sp) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

    /* The sky: the half of the weather that never moves, so it is not on a
       canvas at all. */
    holder.replaceChildren();
    const sky = document.createElement("div");
    sky.dataset.groundSky = "";
    sky.style.cssText = `position:absolute;inset:0;background:${skyGradient(dim)};`;
    holder.appendChild(sky);

    /* The field: one canvas, one texture, one thing to slide. */
    const field = document.createElement("canvas");
    field.dataset.cloudLayer = "field";
    field.style.cssText = "position:absolute;will-change:transform;";
    holder.appendChild(field);

    const { vx, vy } = fieldDrift();
    const mx = marginFor(vx);
    const my = marginFor(vy);

    const embersField: { current: SparkField | null } = { current: null };
    let size = { w: 0, h: 0 };
    let raf = 0;
    /** Seconds of weather that have passed. Held while the hand is down. */
    let clock = 0;
    let last = performance.now();
    let nextSpark = 0;
    /** The drift the paint has baked in, and the drift the transform is showing. */
    let ox = 0;
    let oy = 0;
    let tx = NaN;
    let ty = NaN;
    /** A recycle in flight: what it is painting to, and which layer is next. */
    let laying: { ox: number; oy: number; next: number } | null = null;

    /** A whole backing pixel, so a recycle lands exactly where the transform had it. */
    const snap = (v: number) => Math.round(v * CLOUD_SCALE) / CLOUD_SCALE;

    const lay = (layers: typeof CLOUD_LAYERS, atX: number, atY: number, from: number) => {
      const c = field.getContext("2d");
      if (!c) return;
      c.setTransform(CLOUD_SCALE, 0, 0, CLOUD_SCALE, 0, 0);
      paintCloudField(c, layers, { w: size.w + mx * 2, h: size.h + my * 2, dim, ox: atX, oy: atY, from });
      c.setTransform(1, 0, 0, 1, 0, 0);
    };

    /** The whole field at once: the first paint, a resize, and reduced motion. */
    const paintAll = (atX: number, atY: number) => {
      lay(CLOUD_LAYERS, atX, atY, 0);
      ox = atX;
      oy = atY;
      laying = null;
    };

    const move = (force = false) => {
      const x = vx * clock - ox;
      const y = vy * clock - oy;
      if (!force && x === tx && y === ty) return;
      field.style.transform = `translate3d(${x}px, ${y}px, 0)`;
      tx = x;
      ty = y;
    };

    const fit = () => {
      const w = Math.max(1, Math.round(box.clientWidth));
      const h = Math.max(1, Math.round(box.clientHeight));
      if (w === size.w && h === size.h) return false;
      size = { w, h };
      // The embers are a pixel across, so they get a pixel each.
      sp.width = w;
      sp.height = h;
      sp.style.width = `${w}px`;
      sp.style.height = `${h}px`;
      const cw = w + mx * 2;
      const ch = h + my * 2;
      // Drawn small and blown up: the sharpest edge in a cloud is a gradient.
      field.width = Math.max(1, Math.round(cw * CLOUD_SCALE));
      field.height = Math.max(1, Math.round(ch * CLOUD_SCALE));
      field.style.width = `${cw}px`;
      field.style.height = `${ch}px`;
      field.style.left = `${-mx}px`;
      field.style.top = `${-my}px`;
      embersField.current = embersField.current ? resizeField(embersField.current, w, h) : sparkField("ground", w, h);
      return true;
    };

    const embers = () => {
      const c = sp.getContext("2d");
      if (!c || !embersField.current) return;
      paintDarkMatter(c, { field: embersField.current, t: clock, vignette: false, dim, layers: "sparks" });
    };

    fit();
    paintAll(0, 0);
    move(true);
    embers();

    if (still) {
      // One frame, and then the weather holds.
      const ro = new ResizeObserver(() => { if (fit()) { paintAll(ox, oy); move(true); embers(); } });
      ro.observe(box);
      return () => {
        ro.disconnect();
        holder.replaceChildren();
      };
    }

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, Math.max(0, (t - last) / 1000));
      last = t;
      // Held, not skipped: the clock does not advance while the hand is down,
      // so letting go carries on from here instead of jumping.
      if (document.hidden || dragging()) return;
      clock += dt;

      if (laying) {
        // A recycle in flight: one layer a frame.
        lay([CLOUD_LAYERS[laying.next]!], laying.ox, laying.oy, laying.next);
        laying.next++;
        if (laying.next >= CLOUD_LAYERS.length) {
          ox = laying.ox;
          oy = laying.oy;
          laying = null;
        }
      } else if (Math.abs(vx * clock - ox) >= mx || Math.abs(vy * clock - oy) >= my) {
        // Out of material on one axis. The same field is laid again with the
        // drift so far baked in, and the transform hands back the remainder.
        laying = { ox: snap(vx * clock), oy: snap(vy * clock), next: 0 };
      }
      move();

      if (clock >= nextSpark) {
        nextSpark = clock + SPARK_MS / 1000;
        embers();
      }
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => { if (fit()) { paintAll(snap(vx * clock), snap(vy * clock)); move(true); embers(); } });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      holder.replaceChildren();
    };
  }, [host, clouds, spark, dim]);
}
