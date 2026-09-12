"use client";
/**
 * The weather. One implementation, everywhere it appears.
 *
 * Four surfaces stand on this: the workspace behind the page, the timeline's
 * own floor, the disc you pull parts out of, and the disc you draw on. They
 * used to be two implementations and four clocks — the walls repainted the
 * clouds every 420ms, the discs repainted *everything* on a 33ms
 * `setInterval`, which against a 16.7ms frame lands two frames on one beat
 * and none on the next. All four skipped, in their own ways, for the same
 * reason: the nebula was being **redrawn** to move it, and a redraw rate is
 * a frame rate however fast the page around it runs.
 *
 * So the clouds are not redrawn to move any more. They move:
 *
 *  · **A canvas per layer, bigger than the box.** Each of `CLOUD_LAYERS`
 *    gets its own, so each keeps its own heading, its own speed and its own
 *    slow turn. The near cloud passes the far one, the two near tiles
 *    counter-drift, and the bloom where they cross goes on shifting.
 *  · **Full resolution.** A pixel a pixel. The clouds were drawn at half
 *    size once so a whole repaint would fit inside a frame; there is no
 *    whole repaint any more, so there is no reason to.
 *  · **Screened together, as they always were.** `mix-blend-mode: screen`
 *    over a sky that is the same radial gradient, painted by the compositor
 *    instead of by us.
 *  · **Moved on the compositor.** `translate3d` for the drift and `rotate`
 *    for the turn, every frame, which the compositor does without touching
 *    the page: no layout, no paint, no main-thread raster.
 *  · **Repainted only when the material runs out** — or on a resize, or when
 *    the distance changes. A recycle re-lays that one layer with the turn
 *    and the drift it had reached baked in and its transform reset, so it is
 *    the same pixels in the same place and there is nothing to see. One
 *    layer to a frame, so even that moment fits in a frame.
 *
 * A disc is the same thing in a round hole: the holder is clipped to a
 * circle and wears its horizon as a static gradient, because a horizon does
 * not move either.
 *
 * **What it costs, and where that number came from.** Four window-sized
 * layers blended by the compositor every frame. On a graphics card that is
 * the compositor's day job. The container this repository is tested in has
 * **no GPU** — ANGLE/SwiftShader, software rasterisation — and there it
 * measures 13.9fps against a one-layer field's 60. That number is a floor
 * for software, not a verdict on the design: J runs hardware, and the call
 * was his. `docs/shelf/README.md` has the whole table.
 *
 * The embers are untouched: their own canvas at the box's own size, thirty
 * times a second, which is what a streak needs.
 *
 * **Nothing stops it.** There used to be a pause: a flag on the root while
 * the hand was down on the board, and the ground held where it was until it
 * let go. That was bought when the clouds were repainted every frame to move
 * them, and a pan and a full-surface repaint wanted the same main thread.
 * The field is painted once and slid on the compositor now, so a drifting
 * cloud costs a transform write, and the bill the pause was paying no longer
 * arrives — measured, with the whole ground running through a pan, in
 * `tests/pan-weather.mjs`. It is gone, and with it the flag that could go on
 * and not come off, which is how the sparks got stuck still.
 */
import * as React from "react";
import {
  CLOUD_LAYERS,
  cloudSpeed,
  cloudTravel,
  DRIFT_MS,
  paintCloudLayer,
  paintDarkMatter,
  resizeField,
  skyGradient,
  sparkField,
  type CloudLayer,
  type Shape,
  type SparkField,
} from "./darkMatter";

/** How often the embers are redrawn. */
export const SPARK_MS = DRIFT_MS;

/**
 * The clouds' backing store, as a share of the box. One is a pixel a pixel.
 *
 * This is the one number in this file that anybody can see, so it does not
 * move to buy frames without somebody being told.
 */
const CLOUD_SCALE = 1;

/**
 * How long a layer's material should last before it needs more.
 *
 * Raising it costs memory and compositing — the canvas is oversized by the
 * layer's own speed times this, and the compositor samples the whole layer
 * every frame. Lowering it costs how often a recycle runs, and a recycle is
 * one pattern fill that cannot be seen.
 */
const REFRESH_S = 14;
/** A little room either way even for a layer that barely moves, for a resize. */
const MARGIN_MIN = 48;
/**
 * How far a layer may turn before it is laid again, in degrees.
 *
 * A recycle is exact — the turn it had reached is baked in and the transform
 * reset — so this is not a fidelity number, it is how often a full-resolution
 * pattern fill runs. Ten degrees is twelve seconds for the fastest-turning
 * layer, and costs about 150px of extra margin to keep the box covered while
 * the corners sweep.
 */
const TURN_MAX = 10;

/** How much material a layer needs past the box's edge, in CSS pixels. */
export function marginFor(l: CloudLayer, w: number, h: number): number {
  const drift = cloudSpeed(l) * REFRESH_S;
  // Turning sweeps the corners in: enough that the box stays covered at the
  // most this layer will have turned before it is laid again.
  const sweep = (Math.hypot(w, h) / 2) * Math.sin((TURN_MAX * Math.PI) / 180);
  return Math.round(Math.max(MARGIN_MIN, drift) + sweep);
}

/** One layer's canvas, and where its paint and its transform each stand. */
interface Live {
  el: HTMLCanvasElement;
  def: CloudLayer;
  /** How far past the box this one reaches. */
  m: number;
  /** The moment the paint has baked in. */
  at: number;
  /** What the transform is showing, so an unchanged one is not written again. */
  said: string;
}

export interface GroundOpts {
  /** How far away the weather is, 0..1. One is the disc's own. */
  dim?: number;
  /** A wall, or a round hole. A disc is clipped and wears a horizon. */
  shape?: Shape;
}

export function useGround(
  host: React.RefObject<HTMLElement | null>,
  clouds: React.RefObject<HTMLDivElement | null>,
  spark: React.RefObject<HTMLCanvasElement | null>,
  opts: number | GroundOpts = {},
) {
  const o: GroundOpts = typeof opts === "number" ? { dim: opts } : opts;
  const dim = o.dim ?? 1;
  const shape: Shape = o.shape ?? "ground";

  React.useEffect(() => {
    const box = host.current;
    const holder = clouds.current;
    const sp = spark.current;
    if (!box || !holder || !sp) return;
    const still = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const disc = shape === "disc";

    /* The sky: the half of the weather that never moves, so it is not on a
       canvas at all. `isolate` keeps the screening inside this box rather
       than reaching the app behind it. */
    holder.replaceChildren();
    holder.style.isolation = "isolate";
    if (disc) {
      holder.style.borderRadius = "50%";
      holder.style.overflow = "hidden";
    }
    const sky = document.createElement("div");
    sky.dataset.groundSky = "";
    sky.style.cssText = `position:absolute;inset:0;background:${skyGradient(dim)};`;
    holder.appendChild(sky);

    const layers: Live[] = CLOUD_LAYERS.map((def) => {
      const el = document.createElement("canvas");
      el.dataset.cloudLayer = def.id;
      el.style.cssText = "position:absolute;mix-blend-mode:screen;will-change:transform;transform-origin:50% 50%;";
      holder.appendChild(el);
      return { el, def, m: 0, at: 0, said: "" };
    });

    /* A disc's horizon: the edge falls off to near black. It does not move
       either, so it is a gradient rather than a pass of the paint. */
    if (disc) {
      const edge = document.createElement("div");
      edge.dataset.groundHorizon = "";
      edge.style.cssText =
        "position:absolute;inset:0;pointer-events:none;background:radial-gradient(circle closest-side at 50% 50%, rgba(0,0,0,0) 78%, rgba(4,2,8,0.5) 92.6%, rgba(3,1,6,0.9) 100%);";
      holder.appendChild(edge);
    }

    const embersField: { current: SparkField | null } = { current: null };
    let size = { w: 0, h: 0 };
    let raf = 0;
    /** Seconds of weather that have passed. Nothing ever stops it. */
    let clock = 0;
    let last = performance.now();
    let nextSpark = 0;
    /** Layers waiting to be laid again, one to a frame. */
    const queue: Live[] = [];
    /* The paint, straight onto the layer, in one operation.
     *
     * This used to go through an `OffscreenCanvas` and arrive by
     * `transferFromImageBitmap` — a pointer swap rather than a copy, which
     * measured beautifully here: the beat went 18.9ms to 10ms and the frames
     * over 80ms went 13 to 5.
     *
     * **It shipped to a machine with a graphics card and the ground went
     * black.** Four layers holding a bitmap renderer, waiting for an
     * ImageBitmap that never arrived, and not one line in the console. The
     * measurement that justified it came from a container with no GPU that
     * rasterises in software, so it was never evidence about the hardware it
     * was for. A number from the wrong machine is not a smaller number, it
     * is a different question answered confidently.
     *
     * So the layer keeps a plain 2D context and is painted directly. What
     * survives is the part that was never in doubt: `paintCloudLayer` fills
     * with `globalCompositeOperation = "copy"`, one operation with no
     * cleared canvas in the middle of it, which is what closed the
     * black-frame window in the first place.
     *
     * Do not put the transfer back without watching the ground on hardware
     * with a graphics card, and without `ground-paints.mjs` passing there.
     */
    const lay = (l: Live, at: number) => {
      const c = l.el.getContext("2d");
      if (!c) return;
      const w = size.w + l.m * 2;
      const h = size.h + l.m * 2;
      c.setTransform(CLOUD_SCALE, 0, 0, CLOUD_SCALE, 0, 0);
      paintCloudLayer(c, l.def, {
        w,
        h,
        dim,
        turn: l.def.turn + l.def.spin * at,
        dx: l.def.dx * at,
        dy: l.def.dy * at,
      });
      c.setTransform(1, 0, 0, 1, 0, 0);
      l.at = at;
      l.el.dataset.laidAt = at.toFixed(4);
    };

    /**
     * Where the compositor has to carry this layer, from where it was laid.
     *
     * **The rotation turns the paint's own offset, so it has to be taken off
     * again.** `transform: translate3d(d) rotate(t)` is the matrix `T·R`: the
     * canvas is rotated about its centre and then shifted. But the drift up
     * to the moment it was laid is baked *into the paint*, inside the canvas,
     * so `R` turns that too. The layer therefore sits at
     * `R(turn)·laid + d` when it should sit at `travel(now)`, and the
     * difference — `(R(turn) − I)·laid` — grows with the drift and with the
     * angle together, then snaps to nothing the moment the layer is laid
     * again. That snap was the reset. It had two periods per layer, because
     * a layer is laid again either when the drift exhausts its margin or
     * when the turn passes `TURN_MAX`, and the two beat against each other,
     * which is why it read as irregular rather than as a cycle.
     *
     * So the baked offset is turned by the same angle and subtracted. Then
     * the layer sits at `travel(now)` at every instant, whatever it was laid
     * with, and being laid again changes nothing anybody can see: the paint
     * takes the offset, the transform gives up exactly what the paint took.
     */
    const carry = (l: Live) => {
      const now = cloudTravel(l.def, clock);
      const laid = cloudTravel(l.def, l.at);
      const turn = l.def.spin * (clock - l.at);
      const a = (turn * Math.PI) / 180;
      const cos = Math.cos(a);
      const sin = Math.sin(a);
      return { x: now.x - (laid.x * cos - laid.y * sin), y: now.y - (laid.x * sin + laid.y * cos), turn };
    };

    const move = (l: Live, force = false) => {
      const { x, y, turn } = carry(l);
      const said = `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) rotate(${turn.toFixed(4)}deg)`;
      if (!force && said === l.said) return;
      l.el.style.transform = said;
      l.said = said;
    };

    /** Has this layer run out of the material it was laid with? */
    const spent = (l: Live) => {
      // The distance the compositor is actually carrying it, which is what
      // runs off the edge of the paint — not the raw difference in travel.
      const { x, y, turn } = carry(l);
      return Math.hypot(x, y) >= l.m - MARGIN_MIN || Math.abs(turn) >= TURN_MAX;
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
      for (const l of layers) {
        l.m = marginFor(l.def, w, h);
        const cw = w + l.m * 2;
        const ch = h + l.m * 2;
        l.el.width = Math.max(1, Math.round(cw * CLOUD_SCALE));
        l.el.height = Math.max(1, Math.round(ch * CLOUD_SCALE));
        l.el.style.width = `${cw}px`;
        l.el.style.height = `${ch}px`;
        l.el.style.left = `${-l.m}px`;
        l.el.style.top = `${-l.m}px`;
      }
      embersField.current = embersField.current ? resizeField(embersField.current, w, h) : sparkField(shape, w, h);
      return true;
    };

    const layAll = () => {
      queue.length = 0;
      for (const l of layers) {
        lay(l, clock);
        move(l, true);
      }
    };

    const embers = () => {
      const c = sp.getContext("2d");
      if (!c || !embersField.current) return;
      paintDarkMatter(c, { field: embersField.current, t: clock, vignette: false, dim, layers: "sparks" });
    };

    fit();
    layAll();
    embers();

    if (still) {
      // One frame, and then the weather holds.
      const ro = new ResizeObserver(() => { if (fit()) { layAll(); embers(); } });
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
      if (document.hidden) return;
      clock += dt;

      // One recycle to a frame, so the only expensive moment in this file
      // never doubles up.
      const due = queue.shift();
      if (due) {
        lay(due, clock);
        move(due, true);
      } else {
        for (const l of layers) if (spent(l) && !queue.includes(l)) queue.push(l);
      }
      for (const l of layers) if (l !== due) move(l);

      if (clock >= nextSpark) {
        nextSpark = clock + SPARK_MS / 1000;
        embers();
      }
    };
    raf = requestAnimationFrame(tick);

    const ro = new ResizeObserver(() => { if (fit()) { layAll(); embers(); } });
    ro.observe(box);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      holder.replaceChildren();
    };
  }, [host, clouds, spark, dim, shape]);
}
