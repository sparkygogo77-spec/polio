"use client";
/**
 * The weather. One implementation, one instance per surface, everywhere.
 *
 * Four surfaces stand on this: the workspace behind the page, the disc you
 * pull parts out of, and the disc you draw on. The workspace's is mounted
 * once in `StudioPage`, *outside* the switch between the board and the
 * timeline, so moving between them changes what stands on the ground and
 * never the ground itself. There is no second ground anywhere; if you are
 * counting canvases and get a different number in the timeline, the extra
 * one is the timeline's own wires.
 *
 * **How it moves, and why it is barely anything.**
 *
 * A layer is painted **once** and then slid by a CSS animation. That is the
 * whole mechanism. It works because a repeating pattern lands exactly back on
 * itself after one tile period: oversize the canvas by one period along the
 * layer's heading, animate a translation of exactly one period, loop. The
 * loop point is the same pixels in the same place, so it runs for ever with
 * no seam, and — the part that matters — **nothing is ever repainted**.
 *
 * What that deleted, all of which existed to manage a repaint that no longer
 * happens:
 *
 *  · the per-frame transform writes, and the clock that drove them
 *  · the recycle: `lay` on exhaustion, `spent`, the queue, `marginFor`,
 *    `REFRESH_S`, `MARGIN_MIN`
 *  · the turn limit `TURN_MAX` and the margin the corners swept
 *  · `carry`, which existed to undo the rotation of an offset baked into a
 *    paint that is no longer re-baked
 *  · with them, the whole class of bug that ate a night: the seam at a
 *    recycle, the black frame between a clear and a fill, the buffer swap
 *
 * **What was dropped from the look, deliberately.** There were four layers,
 * each turning slowly on its own heading at its own scale, and they are one
 * layer now that does not turn. A slow rotation is the one thing that cannot
 * be done by translating a repeating pattern, and it was the source of the
 * seam; the four cost fourteen milliseconds a frame in blending, measured.
 * With them went the parallax and the shifting bloom where two crossed. The
 * ask was nearly static, so both were paid rather than the mechanism being
 * bent back around them. The pace is `DRIFT_PX_S`.
 *
 * **The embers are the only thing still on a clock**, and they are what says
 * the page is alive: their own canvas at the box's own size, thirty times a
 * second, which is what a streak needs.
 *
 * **On blending: there is none.** The two clouds are screened into each other
 * once, inside `nebulaField`, and what the compositor gets is a plain layer
 * over a nearly black sky. The holder is still `isolation: isolate` so that
 * nothing the app puts behind can reach into the ground. If the ground ever
 * looks black, the thing to check is not the blend mode but whether something
 * opaque is painted on top of it — which is exactly what went wrong once.
 */
import * as React from "react";
import { isHeld } from "./board/store";
import {
  DRIFT_MS,
  fieldHeight,
  fieldPeriod,
  nebulaField,
  paintDarkMatter,
  resizeField,
  skyGradient,
  sparkField,
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
 * How fast the ground drifts, in pixels a second.
 *
 * Stated as a speed rather than as a fraction of something else, because a
 * fraction is how this went wrong: 15% of the old pace worked out at 1.1px a
 * second, which is five seconds to move five pixels — a still image with a
 * duration attached. Nearly static was the ask and that overshot it into
 * frozen.
 *
 * The honest test is whether you can see it over a few seconds rather than a
 * few minutes: at six a second the field moves about a fifth of its own
 * cloud-width while you read a sentence. Mild, not fast. This is also close
 * to what the near clouds did before any of the speed work — 7.5px a second —
 * so it is a return rather than an invention.
 */
const DRIFT_PX_S = 6;

/**
 * How far away the whole nebula sits, per surface, as the one layer's opacity.
 *
 * The two clouds' weights against each other are baked into the field — they
 * are what the picture is — and this is the only weighting applied outside
 * it. One property, one place.
 *
 * Above one on purpose, and clamped: the workspace sits at `dim` 0.5 and
 * wants 0.55, the discs sit at 1 and want the picture at full strength.
 * Chosen by matching pixels against the four-layer ground it replaces, not by
 * eye: at 0.55 the bare ground reads mean 20.7, spread 7.0, rgb 32/14/52
 * against the old 19.6, 7.7, 30/14/44. An earlier attempt multiplied 0.55 by
 * `dim` and landed on 0.275, which looked exactly like the flat, washed-out
 * haze that number deserves.
 */
const FAR = 1.1;

export interface GroundOpts {
  /** How far away the weather is, 0..1. One is the disc's own. */
  dim?: number;
  /** A wall, or a round hole. A disc is clipped and wears a horizon. */
  shape?: Shape;
  /**
   * A hole of any shape: a CSS `clip-path` value in the host's own pixels,
   * for a space drawn on the page (`space.ts`). The clouds and the embers
   * are cut to it; the horizon is the space's own to paint, because a
   * gradient from the middle does not follow a drawn line.
   */
  clip?: string;
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
  const clip = o.clip ?? "";

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
    holder.style.clipPath = clip;
    sp.style.clipPath = clip;
    const sky = document.createElement("div");
    sky.dataset.groundSky = "";
    sky.style.cssText = `position:absolute;inset:0;background:${skyGradient(dim)};`;
    holder.appendChild(sky);

    /* One layer, not four.
     *
     * The nebula is screened together once into a field wider than the board
     * (`nebulaField`) and this is the only thing that moves: a plain layer,
     * no blend mode, sliding exactly one field. Four full-screen layers
     * blended with `screen` every frame was the cost — hiding them during a
     * pan took p95 from 63.5ms to 9.6ms, and stopping only the animation
     * left it at 61.8ms, so it was the blending and never the motion.
     *
     * No `mix-blend-mode`. The field already carries the screened result and
     * the sky behind it is nearly black, so plain compositing puts the same
     * pixels on the screen for none of the cost. */
    const layer = document.createElement("canvas");
    layer.dataset.cloudLayer = "nebula";
    layer.style.cssText = "position:absolute;will-change:transform;";
    layer.style.opacity = String(Math.min(1, FAR * dim));
    holder.appendChild(layer);

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
    let clock = 0;
    let last = performance.now();
    let nextSpark = 0;

    /**
     * Size the layer, fill it once, and set it drifting.
     *
     * It is one tile wider than the box and slides exactly one tile, so the
     * loop lands the pattern back on itself and there is nothing to see at
     * the join. Sideways only: a second axis would cost another tile of
     * canvas for a difference nobody can name.
     */
    const dress = (w: number, h: number) => {
      /* The field wraps on `period`, which is at least 1.15× the box wide, so
         nothing repeats inside one screenful. The canvas is the box plus that
         period and slides exactly it, so the loop lands the pattern back on
         itself. */
      const period = fieldPeriod(w);
      const cw = w + period;
      layer.width = Math.max(1, Math.round(cw * CLOUD_SCALE));
      layer.height = Math.max(1, Math.round(h * CLOUD_SCALE));
      layer.style.width = `${cw}px`;
      layer.style.height = `${h}px`;
      layer.style.left = `${-period}px`;
      layer.style.top = "0px";

      const c = layer.getContext("2d");
      if (!c) return;
      /* The field is generated a little taller than the box and the surplus
         is clipped, so that dragging a pane taller by a pixel does not throw
         a third of a second of generation away. */
      const nebula = nebulaField(period, fieldHeight(h));
      c.setTransform(CLOUD_SCALE, 0, 0, CLOUD_SCALE, 0, 0);
      c.clearRect(0, 0, cw, h);
      /* Drawn one to one, twice, rather than filled with a scaled pattern.
         A `createPattern` carrying a scale makes the browser filter across
         the tile's edge and sample clamped pixels there, which is a hard
         straight seam every period — the lines that were reported. At 1:1
         there is no filtering and the field's own wrap does the joining. */
      for (let x = 0; x < cw; x += period) c.drawImage(nebula, x, 0);
      c.setTransform(1, 0, 0, 1, 0, 0);

      layer.style.setProperty("--gx", `${period}px`);
      layer.style.setProperty("--gy", "0px");
      const secs = Math.round(period / DRIFT_PX_S);
      /*
       * IT SLIDES A WHOLE PIXEL AT A TIME, AND THAT IS THE WHOLE OF IT.
       *
       * A composited layer that lands between pixels has to be resampled
       * across its whole surface on every frame it moves; one that lands on
       * a pixel can be copied. This layer is the pane and a bit — 1835 by
       * 1191 at the pane the shelf left behind — so that is two and a
       * quarter million pixels filtered thirty times a second to move the
       * clouds six pixels.
       *
       * `steps(period)` over a slide of exactly `period` pixels is a step of
       * exactly one pixel, and at six pixels a second that is a step every
       * sixth of a second. It is the same speed, the same distance and the
       * same loop: what changes is that every frame now lands on the grid.
       *
       * Measured at twelve boards, frames per 900ms:
       *
       *   a continuous slide              31.0     (43% dropped)
       *   steps of exactly one pixel      34.0     (37%)
       *   steps of two thirds of a pixel  31.4     (42%)
       *   steps of one and a half pixels  31.3     (42%)
       *   steps of exactly two pixels     35.2     (35%)
       *   not sliding at all              34.3     (37%)
       *
       * Read the fractional rows: more steps than one-pixel and fewer steps
       * than one-pixel both give back nothing, so it is not the stepping. It
       * is the alignment — and aligned, a sliding layer costs what a still
       * one costs. `fieldPeriod` already returns a whole number of pixels;
       * the round is here so that stays a requirement rather than a
       * coincidence, because a period of 1024.5 would put every other step
       * back between the pixels and quietly give all of this away.
       */
      layer.style.animation = still ? "none" : `ground-drift ${secs}s steps(${Math.round(period)}, end) infinite`;
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
      dress(w, h);
      embersField.current = embersField.current ? resizeField(embersField.current, w, h) : sparkField(shape, w, h);
      return true;
    };

    const embers = () => {
      const c = sp.getContext("2d");
      if (!c || !embersField.current) return;
      paintDarkMatter(c, { field: embersField.current, t: clock });
    };

    fit();
    embers();

    const ro = new ResizeObserver(() => { if (fit()) embers(); });
    ro.observe(box);

    if (still) {
      // One frame, and then the weather holds.
      return () => {
        ro.disconnect();
        holder.replaceChildren();
      };
    }

    /* The only clock left in the ground, and it drives the embers alone. The
       clouds are the compositor's business now. */
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.25, Math.max(0, (t - last) / 1000));
      last = t;
      /* And while a part is under the hand: thirty repaints a second of the
         ground is a frame budget the drag needs more (J, 2026-10-06). */
      if (document.hidden || isHeld()) return;
      clock += dt;
      if (clock >= nextSpark) {
        nextSpark = clock + SPARK_MS / 1000;
        embers();
      }
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      holder.replaceChildren();
    };
  }, [host, clouds, spark, dim, shape, clip]);
}
